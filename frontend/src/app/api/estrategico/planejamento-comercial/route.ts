import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser } from '@/middleware/auth';

// Desabilitar cache para garantir dados sempre atualizados
export const revalidate = 0;
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    console.log('🚀 API Planejamento Comercial - Estrutura Única Otimizada');

    // Autenticação
    const user = await authenticateUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Parâmetros da URL
    const { searchParams } = new URL(request.url);
    const mes = parseInt(searchParams.get('mes') || (new Date().getMonth() + 1).toString());
    const ano = parseInt(searchParams.get('ano') || new Date().getFullYear().toString());

    console.log(`📅 Buscando dados para ${mes}/${ano} - Bar ID: ${user.bar_id}`);

    // Calcular período - ser mais específico para evitar dados de outros meses
    const dataInicio = `${ano}-${mes.toString().padStart(2, '0')}-01`;
    const dataFinalConsulta = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${(mes + 1).toString().padStart(2, '0')}-01`;
    console.log(`🔍 Período calculado: ${dataInicio} (>=) até ${dataFinalConsulta} (<) - Mês ${mes}/${ano}`);
    console.log(`🔍 Query Supabase: data_evento >= '${dataInicio}' AND data_evento < '${dataFinalConsulta}'`);

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

    console.log(`📊 Eventos encontrados: ${eventos?.length || 0}`);
    if (eventos && eventos.length > 0) {
      console.log(`🔍 Primeira data: ${eventos[0].data_evento}, Última data: ${eventos[eventos.length - 1].data_evento}`);
    }

    // Filtro adicional para garantir apenas eventos do mês correto (evitar problemas de timezone)
    // E remover segundas-feiras (bar fechado)
    const eventosFiltrados = eventos?.filter(evento => {
      const dataEvento = new Date(evento.data_evento + 'T00:00:00Z');
      const mesEvento = dataEvento.getUTCMonth() + 1;
      const anoEvento = dataEvento.getUTCFullYear();
      const isCorrectMonth = mesEvento === mes && anoEvento === ano;
      
      // Remover segundas-feiras (dow = 1)
      const dow = dataEvento.getUTCDay();
      const isSegunda = dow === 1;
      
      if (!isCorrectMonth) {
        console.log(`⚠️ Evento fora do período: ${evento.data_evento} (${evento.nome}) - Mês: ${mesEvento}, Ano: ${anoEvento}`);
      }
      
      if (isSegunda) {
        console.log(`⚠️ Segunda-feira removida: ${evento.data_evento} (${evento.nome})`);
      }
      
      return isCorrectMonth && !isSegunda;
    }) || [];

    console.log(`📊 Eventos após filtro adicional: ${eventosFiltrados.length}`);
    if (eventosFiltrados.length > 0) {
      console.log(`🔍 Primeira data filtrada: ${eventosFiltrados[0].data_evento}, Última data filtrada: ${eventosFiltrados[eventosFiltrados.length - 1].data_evento}`);
    }

    if (eventosFiltrados.length === 0) {
      console.log('⚠️ Nenhum evento encontrado para o período após filtro');
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

    console.log(`✅ ${eventosFiltrados.length} eventos encontrados após filtro`);

    // Verificar se há eventos que precisam de recálculo
    // NOVA LÓGICA: Só recalcular se não há valores salvos manualmente (versao_calculo != 999)
    const eventosParaRecalcular = eventosFiltrados.filter(e => 
      e.precisa_recalculo && 
      (e.versao_calculo !== 999) && // 999 = editado manualmente
      (e.real_r === 0 || e.real_r === null) // Só recalcular se não há valor real salvo
    );
    
    if (eventosParaRecalcular.length > 0) {
      console.log(`🔄 ${eventosParaRecalcular.length} eventos precisam de recálculo (excluindo editados manualmente)`);
      
      // Trigger recálculo assíncrono usando a função completa
      for (const evento of eventosParaRecalcular) {
        supabase.rpc('calculate_evento_metrics', { evento_id: evento.id })
          .then((result) => {
            if (result.error) {
              console.error(`❌ Erro ao recalcular evento ${evento.id}:`, result.error);
            } else {
              console.log(`✅ Evento ${evento.id} recalculado com função completa`);
            }
          });
      }
    }

    // Log de eventos com valores editados manualmente
    const eventosEditadosManualmente = eventosFiltrados.filter(e => e.versao_calculo === 999);
    if (eventosEditadosManualmente.length > 0) {
      console.log(`📝 ${eventosEditadosManualmente.length} eventos com valores editados manualmente (não serão recalculados)`);
    }

    // 📊 Calcular métricas de segmentação para cada evento (em paralelo)
    console.log('📊 Calculando métricas de segmentação de clientes...');
    
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

    console.log(`📊 Dados processados: ${dadosProcessados.length} registros`);

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
