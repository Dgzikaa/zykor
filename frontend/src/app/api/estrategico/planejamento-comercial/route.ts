import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser } from '@/middleware/auth';

// Desabilitar cache para garantir dados sempre atualizados
export const revalidate = 0;
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// =====================================================
// ONDA 2C: Buscar dias de operação do banco
// SEM FALLBACK: Se não encontrar, retornar erro 500
// =====================================================
interface BarOperacao {
  opera_segunda: boolean;
  opera_terca: boolean;
  opera_quarta: boolean;
  opera_quinta: boolean;
  opera_sexta: boolean;
  opera_sabado: boolean;
  opera_domingo: boolean;
}

let cachedOperacao: Record<number, BarOperacao> = {};
let cacheTimestamp: Record<number, number> = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

async function getBarOperacao(barId: number): Promise<BarOperacao | null> {
  const agora = Date.now();
  
  if (cachedOperacao[barId] && (agora - (cacheTimestamp[barId] || 0)) < CACHE_TTL_MS) {
    return cachedOperacao[barId];
  }
  
  const { data, error } = await supabase
    .from('bares_config')
    .select('opera_segunda, opera_terca, opera_quarta, opera_quinta, opera_sexta, opera_sabado, opera_domingo')
    .eq('bar_id', barId)
    .single();
  
  if (error || !data) {
    console.error(`❌ [ERRO CONFIG] Dias de operação não encontrados para bar ${barId}. Configure bares_config.`);
    return null;
  }
  
  cachedOperacao[barId] = data;
  cacheTimestamp[barId] = agora;
  return data;
}

// Verifica se o bar opera no dia da semana especificado
// dow: 0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado
function barOperaNoDia(operacao: BarOperacao, dow: number): boolean {
  switch (dow) {
    case 0: return operacao.opera_domingo;
    case 1: return operacao.opera_segunda;
    case 2: return operacao.opera_terca;
    case 3: return operacao.opera_quarta;
    case 4: return operacao.opera_quinta;
    case 5: return operacao.opera_sexta;
    case 6: return operacao.opera_sabado;
    default: return true;
  }
}

interface PlanejamentoDataFinal {
  evento_id: number;
  data_evento: string;
  dia_semana: string;
  evento_nome: string;
  dia: number;
  mes: number;
  ano: number;
  dia_formatado: string;
  data_curta: string;
  
  // Dados financeiros
  real_receita: number;
  m1_receita: number;
  
  // Dados de público
  clientes_plan: number;
  clientes_real: number;
  res_tot: number;
  res_p: number;
  lot_max: number;
  
  // Tickets
  te_plan: number;
  te_real: number;
  tb_plan: number;
  tb_real: number;
  t_medio: number;
  
  // Custos
  c_art: number;
  c_prod: number;
  percent_art_fat: number;
  
  // Percentuais
  percent_b: number;
  percent_d: number;
  percent_c: number;
  
  // Tempos e performance
  t_coz: number;
  t_bar: number;
  fat_19h: number;
  
  // Stockout
  percent_stockout: number;
  
  // Segmentação de clientes
  percent_clientes_novos: number | null;
  clientes_ativos: number | null;
  
  // Flags de performance
  real_vs_m1_green: boolean;
  ci_real_vs_plan_green: boolean;
  te_real_vs_plan_green: boolean;
  tb_real_vs_plan_green: boolean;
  t_medio_green: boolean;
  percent_art_fat_green: boolean;
  t_coz_green: boolean;
  t_bar_green: boolean;
  fat_19h_green: boolean;
}

export async function GET(request: NextRequest) {
  try {
    // Autenticação
    const user = await authenticateUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Parâmetros da URL
    const { searchParams } = new URL(request.url);
    const mes = parseInt(searchParams.get('mes') || (new Date().getMonth() + 1).toString());
    const ano = parseInt(searchParams.get('ano') || new Date().getFullYear().toString());

    // Calcular período - ser mais específico para evitar dados de outros meses
    const dataInicio = `${ano}-${mes.toString().padStart(2, '0')}-01`;
    const dataFinalConsulta = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${(mes + 1).toString().padStart(2, '0')}-01`;

    // Buscar dados APENAS da tabela eventos_base (com todos os cálculos)
    const { data: eventos, error } = await supabase
      .from('eventos_base')
      .select(`
        id,
        data_evento,
        nome,
        dia_semana,
        bar_id,
        m1_r,
        cl_plan,
        te_plan,
        tb_plan,
        c_artistico_plan,
        observacoes,
        real_r,
        cl_real,
        lot_max,
        te_real,
        tb_real,
        t_medio,
        c_art,
        c_prod,
        percent_art_fat,
        percent_b,
        percent_d,
        percent_c,
        percent_stockout,
        t_coz,
        t_bar,
        fat_19h_percent,
        sympla_liquido,
        sympla_checkins,
        yuzer_liquido,
        yuzer_ingressos,
        res_tot,
        res_p,
        faturamento_couvert_manual,
        faturamento_bar_manual,
        faturamento_couvert,
        couvert_vr_contahub,
        calculado_em,
        precisa_recalculo,
        versao_calculo
      `)
      .eq('bar_id', user.bar_id)
      .gte('data_evento', dataInicio)
      .lt('data_evento', dataFinalConsulta)
      .eq('ativo', true)
      .order('data_evento', { ascending: true });

    if (error) {
      console.error('❌ Erro ao buscar eventos:', error);
      return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 });
    }

    // ONDA 2C: Buscar dias de operação do banco - erro se não configurado
    const operacaoBar = await getBarOperacao(user.bar_id!);
    if (!operacaoBar) {
      return NextResponse.json(
        { error: `Configuração ausente: dias de operação para bar ${user.bar_id}. Configure bares_config.` },
        { status: 500 }
      );
    }

    // Filtro adicional para garantir apenas eventos do mês correto (evitar problemas de timezone)
    // E remover dias em que o bar não opera (via bares_config)
    const eventosFiltrados = eventos?.filter(evento => {
      // Parse da data no formato YYYY-MM-DD (sem timezone para evitar conversão)
      const [anoEvento, mesEvento, diaEvento] = evento.data_evento.split('-').map(Number);
      
      // CRITICAL FIX: Garantir que APENAS eventos do mês/ano solicitado sejam retornados
      const isCorrectMonth = mesEvento === mes && anoEvento === ano;
      
      if (!isCorrectMonth) {
        return false; // Rejeitar imediatamente eventos de outros meses
      }
      
      // ONDA 2C: Verificar se o bar opera nesse dia (via bares_config)
      const dataEvento = new Date(evento.data_evento + 'T00:00:00Z');
      const dow = dataEvento.getUTCDay();
      const barOpera = barOperaNoDia(operacaoBar, dow);

      return barOpera;
    }) || [];

    if (eventosFiltrados.length === 0) {
      return NextResponse.json({ 
        success: true,
        data: [],
        meta: {
          estrutura: 'eventos_base_unificada',
          eventos_recalculados: 0,
          dados_reais_disponiveis: [],
          periodo: `${mes}/${ano}`,
          total_eventos: 0
        }
      });
    }

    // Verificar se há eventos que precisam de recálculo
    // NOVA LÓGICA: Só recalcular se não há valores salvos manualmente (versao_calculo != 999)
    const eventosParaRecalcular = eventosFiltrados.filter(e => 
      e.precisa_recalculo && 
      (e.versao_calculo !== 999) && // 999 = editado manualmente
      (e.real_r === 0 || e.real_r === null) // Só recalcular se não há valor real salvo
    );
    
    if (eventosParaRecalcular.length > 0) {
      // Trigger recálculo assíncrono usando a função completa
      for (const evento of eventosParaRecalcular) {
        supabase.rpc('calculate_evento_metrics', { evento_id: evento.id })
          .then((result) => {
            if (result.error) {
              console.error(`❌ Erro ao recalcular evento ${evento.id}:`, result.error);
            }
          });
      }
    }

    // 📊 Calcular métricas de segmentação para cada evento (em paralelo)
    // Processar dados para o formato esperado pelo frontend
    const dadosProcessados: PlanejamentoDataFinal[] = await Promise.all(eventosFiltrados.map(async (evento) => {
      // Forçar timezone UTC para evitar problemas de fuso horário
      const dataEvento = new Date(evento.data_evento + 'T00:00:00Z');
      
      // Flags de performance (verde/vermelho)
      const realVsM1Green = (evento.real_r || 0) >= (evento.m1_r || 0);
      const ciRealVsPlanGreen = (evento.cl_real || 0) >= (evento.cl_plan || 0);
      const teRealVsPlanGreen = (evento.te_real || 0) >= (evento.te_plan || 0);
      const tbRealVsPlanGreen = (evento.tb_real || 0) >= (evento.tb_plan || 0);
      const tMedioGreen = (evento.t_medio || 0) >= 93; // Meta de R$ 93
      const percentArtFatGreen = (evento.percent_art_fat || 0) <= 15; // Meta <= 15%
      const tCozGreen = (evento.t_coz || 0) <= 12; // Meta <= 12min
      const tBarGreen = (evento.t_bar || 0) <= 4; // Meta <= 4min
      const fat19hGreen = (evento.fat_19h_percent || 0) >= 40; // Meta >= 40%

      // Calcular métricas de segmentação de clientes para o dia
      let percClientesNovos: number | null = null;
      let clientesAtivos: number | null = null;

      // Só calcular se o evento tiver clientes reais
      if (evento.cl_real && evento.cl_real > 0) {
        try {
          // Calcular data anterior (7 dias atrás para comparação)
          const dataEventoDate = new Date(evento.data_evento + 'T00:00:00');
          const dataAnterior = new Date(dataEventoDate);
          dataAnterior.setDate(dataEventoDate.getDate() - 7);
          const dataAnteriorStr = dataAnterior.toISOString().split('T')[0];

          // Calcular métricas de clientes (novos vs retornantes)
          const { data: metricas } = await supabase.rpc('calcular_metricas_clientes', {
            p_bar_id: user.bar_id,
            p_data_inicio_atual: evento.data_evento,
            p_data_fim_atual: evento.data_evento,
            p_data_inicio_anterior: dataAnteriorStr,
            p_data_fim_anterior: dataAnteriorStr
          });

          if (metricas && metricas[0]) {
            const totalClientes = Number(metricas[0].total_atual) || 0;
            const novosClientes = Number(metricas[0].novos_atual) || 0;
            percClientesNovos = totalClientes > 0 ? parseFloat(((novosClientes / totalClientes) * 100).toFixed(1)) : 0;
          }

          // Calcular clientes ativos (2+ visitas nos últimos 90 dias)
          const data90DiasAtras = new Date(dataEventoDate);
          data90DiasAtras.setDate(dataEventoDate.getDate() - 90);
          const data90DiasAtrasStr = data90DiasAtras.toISOString().split('T')[0];

          const { data: baseAtivaResult } = await supabase.rpc('get_count_base_ativa', {
            p_bar_id: user.bar_id,
            p_data_inicio: data90DiasAtrasStr,
            p_data_fim: evento.data_evento
          });

          if (baseAtivaResult !== null) {
            clientesAtivos = Number(baseAtivaResult);
          }
        } catch (error) {
          console.error(`❌ Erro ao calcular métricas para evento ${evento.id}:`, error);
        }
      }

      return {
        evento_id: evento.id,
        data_evento: evento.data_evento,
        dia_semana: evento.dia_semana || '',
        evento_nome: evento.nome || '',
        dia: dataEvento.getUTCDate(),
        mes: dataEvento.getUTCMonth() + 1,
        ano: dataEvento.getUTCFullYear(),
        dia_formatado: dataEvento.getUTCDate().toString().padStart(2, '0'),
        data_curta: `${dataEvento.getUTCDate().toString().padStart(2, '0')}/${(dataEvento.getUTCMonth() + 1).toString().padStart(2, '0')}`,
        
        // Dados financeiros
        // real_r JÁ INCLUI ContaHub + Sympla + Yuzer (calculado pela função calculate_evento_metrics)
        real_receita: evento.real_r || 0,
        m1_receita: evento.m1_r || 0,
        
        // Dados de público
        clientes_plan: evento.cl_plan || 0,
        clientes_real: evento.cl_real || 0,
        res_tot: evento.res_tot || 0,
        res_p: evento.res_p || 0,
        lot_max: evento.lot_max || 0,
        
        // Tickets
        te_plan: evento.te_plan || 0,
        te_real: evento.te_real || 0,
        tb_plan: evento.tb_plan || 0,
        tb_real: evento.tb_real || 0,
        t_medio: evento.t_medio || 0,
        
        // Custos
        c_art: evento.c_art || 0,
        c_prod: evento.c_prod || 0,
        percent_art_fat: evento.percent_art_fat || 0,
        faturamento_couvert: evento.faturamento_couvert || 0,
        couvert_vr_contahub:
          evento.couvert_vr_contahub !== null && evento.couvert_vr_contahub !== undefined
            ? Number(evento.couvert_vr_contahub)
            : null,
        
        // Percentuais
        percent_b: evento.percent_b || 0,
        percent_d: evento.percent_d || 0,
        percent_c: evento.percent_c || 0,
        
        // Tempos
        t_coz: evento.t_coz || 0,
        t_bar: evento.t_bar || 0,
        fat_19h: evento.fat_19h_percent || 0,
        
        // Stockout (agora salvo na tabela eventos_base)
        percent_stockout: evento.percent_stockout || 0,
        
        // Segmentação de clientes (calculado em tempo real)
        percent_clientes_novos: percClientesNovos,
        clientes_ativos: clientesAtivos,
        
        // Campos manuais para domingos
        faturamento_couvert_manual: evento.faturamento_couvert_manual || undefined,
        faturamento_bar_manual: evento.faturamento_bar_manual || undefined,
        
        // Flags de performance
        real_vs_m1_green: realVsM1Green,
        ci_real_vs_plan_green: ciRealVsPlanGreen,
        te_real_vs_plan_green: teRealVsPlanGreen,
        tb_real_vs_plan_green: tbRealVsPlanGreen,
        t_medio_green: tMedioGreen,
        percent_art_fat_green: percentArtFatGreen,
        t_coz_green: tCozGreen,
        t_bar_green: tBarGreen,
        fat_19h_green: fat19hGreen
      };
    }));

    return NextResponse.json({
      success: true,
      data: dadosProcessados,
      meta: {
        total_eventos: dadosProcessados.length,
        periodo: `${mes}/${ano}`,
        estrutura: 'tabela_unica_otimizada',
        eventos_recalculados: eventosParaRecalcular.length,
        ultima_atualizacao: new Date().toISOString(),
        dados_reais_disponiveis: {
          contahub: '2025-01-31 a 2025-07-29',
          yuzer: '2025-03-04 a 2025-08-10',
          sympla: '2025-08-11 a 2025-08-14'
        }
      }
    });

  } catch (error) {
    console.error('❌ Erro na API:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

// Endpoint para forçar recálculo de eventos
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { data_inicio, data_fim, evento_ids } = body;

    let totalRecalculados = 0;

    if (evento_ids && Array.isArray(evento_ids)) {
      // Recalcular eventos específicos
      for (const eventoId of evento_ids) {
        const { error } = await supabase.rpc('calculate_evento_metrics', { 
          evento_id: eventoId 
        });
        if (!error) totalRecalculados++;
      }
    } else if (data_inicio) {
      // Recalcular período
      const { data, error } = await supabase.rpc('recalcular_eventos_periodo', {
        data_inicio,
        data_fim: data_fim || data_inicio
      });
      if (!error) totalRecalculados = data || 0;
    } else {
      // Recalcular todos os pendentes
      const { data, error } = await supabase.rpc('recalcular_eventos_pendentes', { limite: 50 });
      if (!error) totalRecalculados = data || 0;
    }

    return NextResponse.json({
      success: true,
      message: `${totalRecalculados} eventos recalculados com sucesso`,
      total_recalculados: totalRecalculados
    });

  } catch (error) {
    console.error('❌ Erro ao recalcular eventos:', error);
    return NextResponse.json({ 
      error: 'Erro ao recalcular eventos',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
