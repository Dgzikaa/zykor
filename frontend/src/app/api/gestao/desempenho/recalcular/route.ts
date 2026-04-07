import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'

// Função para fetch de todos os dados (paginação)
async function fetchAllData(supabase: any, tableName: string, columns: string, filters: any = {}) {
  let allData: any[] = [];
  let from = 0;
  const limit = 1000;
  
  const MAX_ITERATIONS = 1000;
  let iterations = 0;
  while (iterations < MAX_ITERATIONS) {
    iterations++;
    let query = supabase
      .from(tableName)
      .select(columns)
      .range(from, from + limit - 1);
    
    // Aplicar filtros
    Object.entries(filters).forEach(([key, value]) => {
      if (key.includes('gte_')) query = query.gte(key.replace('gte_', ''), value);
      else if (key.includes('lte_')) query = query.lte(key.replace('lte_', ''), value);
      else if (key.includes('eq_')) query = query.eq(key.replace('eq_', ''), value);
      else if (key.includes('in_')) query = query.in(key.replace('in_', ''), value);
    });
    
    const { data, error } = await query;
    
    if (error) {
      console.error(`❌ Erro ao buscar ${tableName}:`, error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    allData.push(...data);
    if (data.length < limit) break;
    
    from += limit;
  }

  return allData;
}

// Obter semana do ano de uma data (padrão ISO - segunda a domingo)
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// POST - Recalcular dados automáticos da tabela de desempenho
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { semana_id, recalcular_todas = false } = body;
    
    const barIdHeader = request.headers.get('x-selected-bar-id');
    const barId = barIdHeader ? parseInt(barIdHeader, 10) : null;

    if (!barId) {
      return NextResponse.json(
        { success: false, error: 'Bar não selecionado' },
        { status: 400 }
      );
    }

    // Usar service_role para dados administrativos (bypass RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Buscar semanas para recalcular
    let semanasQuery = supabase
      .from('desempenho_semanal')
      .select('*')
      .eq('bar_id', barId);

    if (!recalcular_todas && semana_id) {
      semanasQuery = semanasQuery.eq('id', semana_id);
    }

    const { data: semanas, error: semanaError } = await semanasQuery;

    if (semanaError || !semanas || semanas.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nenhuma semana encontrada para recalcular' },
        { status: 404 }
      );
    }

    const semanasAtualizadas = [];

    for (const semana of semanas) {
      const startDate = semana.data_inicio;
      const endDate = semana.data_fim;

      // =============================================
      // 1. FATURAMENTO TOTAL (ContaHub + Yuzer + Sympla)
      // =============================================

      const [contahubPeriodoData, yuzerData, symplaData] = await Promise.all([
        fetchAllData(supabase, 'contahub_periodo', 'vr_pagamentos, pessoas', {
          'gte_vd_dtcontabil': startDate,
          'lte_vd_dtcontabil': endDate,
          'eq_bar_id': barId
        }),
        fetchAllData(supabase, 'yuzer_pagamento', 'valor_liquido', {
          'gte_data_evento': startDate,
          'lte_data_evento': endDate,
          'eq_bar_id': barId
        }),
        fetchAllData(supabase, 'sympla_pedidos', 'valor_liquido', {
          'gte_data_pedido': startDate,
          'lte_data_pedido': endDate
        })
      ]);

      // ContaHub: Apenas linhas com vr_pagamentos > 0
      const contahubComPagamento = (contahubPeriodoData || []).filter(item => 
        (parseFloat(item.vr_pagamentos) || 0) > 0
      );
      
      const faturamentoContahub = contahubComPagamento.reduce((sum, item) => 
        sum + (parseFloat(item.vr_pagamentos) || 0), 0
      );
      
      const faturamentoYuzer = yuzerData?.reduce((sum, item) => sum + (parseFloat(item.valor_liquido) || 0), 0) || 0;
      const faturamenteSympla = symplaData?.reduce((sum, item) => sum + (parseFloat(item.valor_liquido) || 0), 0) || 0;
      
      const faturamentoTotal = faturamentoContahub + faturamentoYuzer + faturamenteSympla;

      // =============================================
      // 2. ATRAÇÃO/FATURAMENTO % (Custos de Atração)
      // =============================================

      const atracaoData = await fetchAllData(supabase, 'lancamentos_financeiros', 'valor, categoria', {
        'gte_data_competencia': startDate,
        'lte_data_competencia': endDate,
        'eq_bar_id': barId
      });

      // Categorias por bar:
      // Ordinário (bar_id=3): Custo Artístico = "Atrações Programação", Custo Produção = "Produção Eventos"
      // Deboche (bar_id=4): Custo Artístico = "Atrações/Eventos"
      const categoriasArtistico = barId === 3 
        ? ['Atrações Programação']
        : ['Atrações/Eventos'];
      
      const categoriasProducao = barId === 3
        ? ['Produção Eventos']
        : [];

      const custoArtistico = atracaoData?.filter(item => 
        item.categoria && categoriasArtistico.some(cat => 
          item.categoria.toLowerCase().includes(cat.toLowerCase())
        )
      ).reduce((sum, item) => sum + Math.abs(parseFloat(item.valor) || 0), 0) || 0;

      const custoProducao = atracaoData?.filter(item => 
        item.categoria && categoriasProducao.some(cat => 
          item.categoria.toLowerCase().includes(cat.toLowerCase())
        )
      ).reduce((sum, item) => sum + Math.abs(parseFloat(item.valor) || 0), 0) || 0;

      const custoAtracao = custoArtistico + custoProducao;
      const atracaoFaturamentoPercent = faturamentoTotal > 0 ? (custoAtracao / faturamentoTotal) * 100 : 0;

      // =============================================
      // 3. CMO (CUSTO DE MÃO DE OBRA) - AUTOMÁTICO
      // =============================================

      // Calcular CMO proporcional ao mês
      // Salários/VT/Provisões têm data_competencia no dia 15 do mês
      // Freelancers têm data_competencia no dia do evento
      
      const dataInicioCMO = new Date(startDate + 'T00:00:00');
      const dataFimCMO = new Date(endDate + 'T00:00:00');
      const mesInicio = dataInicioCMO.getMonth() + 1;
      const anoInicio = dataInicioCMO.getFullYear();
      const mesFim = dataFimCMO.getMonth() + 1;
      const anoFim = dataFimCMO.getFullYear();
      
      // Buscar dados de CMO do(s) mês(es) da semana
      const mesInicioStr = `${anoInicio}-${mesInicio.toString().padStart(2, '0')}-01`;
      // 🔄 NOVO: Buscar CMO da simulação travada ao invés de calcular pelo NIBO
      const { data: cmoTravado } = await supabase
        .from('cmo_semanal')
        .select('cmo_total, freelas, fixos_total, cma_alimentacao, pro_labore_semanal, simulacao_salva')
        .eq('bar_id', barId)
        .eq('ano', anoInicio)
        .eq('semana', semana.numero_semana)
        .eq('simulacao_salva', true) // Apenas simulações travadas
        .single();

      let custoTotalCMO = 0;
      const custosCMODetalhados: { categoria: string; quantidade: number; total: number }[] = [];

      if (cmoTravado) {
        // Usar CMO da simulação travada
        custoTotalCMO = cmoTravado.cmo_total || 0;
        
        custosCMODetalhados.push(
          { categoria: 'Freelas', quantidade: 1, total: cmoTravado.freelas || 0 },
          { categoria: 'Fixos', quantidade: 1, total: cmoTravado.fixos_total || 0 },
          { categoria: 'Alimentação (CMA)', quantidade: 1, total: cmoTravado.cma_alimentacao || 0 },
          { categoria: 'Pro Labore', quantidade: 1, total: cmoTravado.pro_labore_semanal || 0 }
        );
      } else {
        // Fallback: Calcular pelo Conta Azul (método antigo) se não houver simulação travada
        const mesFimStr = `${anoFim}-${(mesFim + 1).toString().padStart(2, '0')}-01`;
        
        const cmoData = await fetchAllData(supabase, 'lancamentos_financeiros', 'valor, categoria, data_competencia', {
          'gte_data_competencia': mesInicioStr,
          'lte_data_competencia': mesFimStr,
          'eq_bar_id': barId
        });

        const categoriasCMO = [
          'SALARIO FUNCIONARIOS', 'VALE TRANSPORTE', 'ALIMENTAÇÃO', 'ADICIONAIS',
          'FREELA ATENDIMENTO', 'FREELA BAR', 'FREELA COZINHA', 'FREELA LIMPEZA',
          'FREELA SEGURANÇA', 'PRO LABORE', 'PROVISÃO TRABALHISTA'
        ];

        const categoriasFixas = ['SALARIO FUNCIONARIOS', 'VALE TRANSPORTE', 'ADICIONAIS', 'PRO LABORE', 'PROVISÃO TRABALHISTA'];
        const categoriasVariaveis = ['ALIMENTAÇÃO', 'FREELA ATENDIMENTO', 'FREELA BAR', 'FREELA COZINHA', 'FREELA LIMPEZA', 'FREELA SEGURANÇA'];

        // Calcular custos fixos proporcionais
        for (const categoria of categoriasFixas) {
          const itens = cmoData?.filter(item => 
            item.categoria && item.categoria.trim() === categoria
          ) || [];
          
          const itensMesInicio = itens.filter(item => {
            const d = new Date(item.data_competencia);
            return d.getMonth() + 1 === mesInicio && d.getFullYear() === anoInicio;
          });
          const itensMesFim = itens.filter(item => {
            const d = new Date(item.data_competencia);
            return d.getMonth() + 1 === mesFim && d.getFullYear() === anoFim;
          });
          
          const totalMesInicio = itensMesInicio.reduce((sum, item) => sum + Math.abs(parseFloat(item.valor) || 0), 0);
          const totalMesFim = mesInicio !== mesFim ? itensMesFim.reduce((sum, item) => sum + Math.abs(parseFloat(item.valor) || 0), 0) : 0;
          
          const diasNoMesInicio = new Date(anoInicio, mesInicio, 0).getDate();
          const diasNoMesFim = mesInicio !== mesFim ? new Date(anoFim, mesFim, 0).getDate() : 0;
          
          const ultimoDiaMesInicio = new Date(anoInicio, mesInicio, 0).getDate();
          const diasSemanaNoMesInicio = Math.min(ultimoDiaMesInicio, dataFimCMO.getDate()) - dataInicioCMO.getDate() + 1;
          const diasSemanaNoMesFim = mesInicio !== mesFim ? dataFimCMO.getDate() : 0;
          
          const proporcaoMesInicio = diasSemanaNoMesInicio / diasNoMesInicio;
          const proporcaoMesFim = mesInicio !== mesFim ? diasSemanaNoMesFim / diasNoMesFim : 0;
          
          const totalProporcional = (totalMesInicio * proporcaoMesInicio) + (totalMesFim * proporcaoMesFim);
          
          custosCMODetalhados.push({ categoria, quantidade: itensMesInicio.length + itensMesFim.length, total: totalProporcional });
          custoTotalCMO += totalProporcional;
        }

        // Calcular custos variáveis
        for (const categoria of categoriasVariaveis) {
          const itens = cmoData?.filter(item => {
            if (!item.categoria || item.categoria.trim() !== categoria) return false;
            const d = item.data_competencia;
            return d >= startDate && d <= endDate;
          }) || [];
          
          const total = itens.reduce((sum, item) => sum + Math.abs(parseFloat(item.valor) || 0), 0);
          custosCMODetalhados.push({ categoria, quantidade: itens.length, total });
          custoTotalCMO += total;
        }
      }

      // Calcular CMO percentual
      const cmoPercentual = faturamentoTotal > 0 ? (custoTotalCMO / faturamentoTotal) * 100 : 0;

      // =============================================
      // 4. CLIENTES ATENDIDOS
      // =============================================

      // ContaHub: Soma pessoas APENAS das linhas com vr_pagamentos > 0
      const pessoasContahub = contahubComPagamento.reduce((sum, item) => 
        sum + (parseInt(item.pessoas) || 0), 0
      );

      const [yuzerProdutos, symplaParticipantes] = await Promise.all([
        fetchAllData(supabase, 'yuzer_produtos', 'quantidade, produto_nome', {
          'gte_data_evento': startDate,
          'lte_data_evento': endDate,
          'eq_bar_id': barId
        }),
        fetchAllData(supabase, 'sympla_participantes', '*', {
          'gte_data_checkin': startDate,
          'lte_data_checkin': endDate,
          'eq_fez_checkin': true
        })
      ]);
      
      const pessoasYuzer = yuzerProdutos?.filter(item => 
        item.produto_nome && (
          item.produto_nome.toLowerCase().includes('ingresso') || 
          item.produto_nome.toLowerCase().includes('entrada')
        )
      ).reduce((sum, item) => sum + (parseInt(item.quantidade) || 0), 0) || 0;
      
      const pessoasSympla = symplaParticipantes?.length || 0;
      
      const clientesAtendidos = pessoasContahub + pessoasYuzer + pessoasSympla;

      // =============================================
      // 5. TICKET MÉDIO
      // =============================================

      const ticketMedio = clientesAtendidos > 0 ? faturamentoTotal / clientesAtendidos : 0;

      // =============================================
      // 6. % CLIENTES NOVOS (usando stored procedure)
      // =============================================

      // Calcular período anterior para comparação (semana anterior)
      const dataInicio = new Date(startDate + 'T00:00:00');
      const dataFim = new Date(endDate + 'T00:00:00');
      const inicioAnterior = new Date(dataInicio);
      inicioAnterior.setDate(dataInicio.getDate() - 7);
      const fimAnterior = new Date(dataFim);
      fimAnterior.setDate(dataFim.getDate() - 7);
      
      const inicioAnteriorStr = inicioAnterior.toISOString().split('T')[0];
      const fimAnteriorStr = fimAnterior.toISOString().split('T')[0];

      let percClientesNovos = 0;
      let clientesAtivosCalculado = 0;

      // Chamar stored procedure para métricas de clientes
      const { data: metricas, error: metricasError } = await supabase.rpc('calcular_metricas_clientes', {
        p_bar_id: barId,
        p_data_inicio_atual: startDate,
        p_data_fim_atual: endDate,
        p_data_inicio_anterior: inicioAnteriorStr,
        p_data_fim_anterior: fimAnteriorStr
      });

      if (!metricasError && metricas && metricas[0]) {
        const resultado = metricas[0];
        const totalClientes = Number(resultado.total_atual) || 0;
        const novosClientes = Number(resultado.novos_atual) || 0;
        
        // Calcular percentual de novos
        percClientesNovos = totalClientes > 0 ? (novosClientes / totalClientes) * 100 : 0;
      } else {
        console.error(`❌ Erro ao calcular métricas de clientes:`, metricasError);
      }

      // =============================================
      // 7. CLIENTES ATIVOS (base ativa 90 dias)
      // =============================================

      // Calcular 90 dias antes do fim do período
      const dataRef = new Date(endDate + 'T00:00:00');
      const data90DiasAtras = new Date(dataRef);
      data90DiasAtras.setDate(dataRef.getDate() - 90);
      const data90DiasAtrasStr = data90DiasAtras.toISOString().split('T')[0];

      // Usar get_count_base_ativa (mesma lógica da API /relatorios/clientes-ativos)
      const { data: resultBaseAtiva, error: errorBaseAtiva } = await supabase.rpc('get_count_base_ativa', {
        p_bar_id: barId,
        p_data_inicio: data90DiasAtrasStr,
        p_data_fim: endDate
      });

      if (!errorBaseAtiva && resultBaseAtiva !== null) {
        clientesAtivosCalculado = Number(resultBaseAtiva) || 0;
      } else {
        console.error('❌ Erro ao calcular base ativa:', errorBaseAtiva);
        clientesAtivosCalculado = 0;
      }

      // =============================================
      // 8. CALCULAR META SEMANAL (soma dos m1_r dos eventos)
      // =============================================

      const { data: eventosParaMeta } = await supabase
        .from('eventos_base')
        .select('m1_r')
        .eq('bar_id', barId)
        .gte('data_evento', startDate)
        .lte('data_evento', endDate)
        .eq('ativo', true);

      const metaSemanal = (eventosParaMeta || []).reduce((sum, e) => sum + (parseFloat(String(e.m1_r)) || 0), 0);

      // =============================================
      // 9. ATUALIZAR REGISTRO NO BANCO
      // =============================================

      const dadosAtualizados = {
        // CAMPOS AUTOMÁTICOS (conforme planilha Excel)
        faturamento_total: faturamentoTotal,
        clientes_atendidos: clientesAtendidos,
        ticket_medio: ticketMedio,
        custo_atracao_faturamento: atracaoFaturamentoPercent,
        cmo: cmoPercentual, // CMO % AUTOMÁTICO (proporcional ao mês)
        perc_clientes_novos: parseFloat(percClientesNovos.toFixed(2)),
        clientes_ativos: clientesAtivosCalculado,
        meta_semanal: metaSemanal, // RECALCULADO: soma dos m1_r dos eventos
        updated_at: new Date().toISOString(),
        
        // 🔒 MANTER VALORES MANUAIS EXISTENTES (NÃO SOBRESCREVER)
        // Reservas (manuais)
        reservas_totais: semana.reservas_totais,
        reservas_presentes: semana.reservas_presentes,
        
        // CMV (manual)
        cmv_limpo: semana.cmv_limpo,
        cmv: semana.cmv,
        cmv_rs: semana.cmv_rs,
        
        // NPS Reservas (manual)
        nps_reservas: semana.nps_reservas,
        nps_reservas_respostas: semana.nps_reservas_respostas,
        
        // Marketing Orgânico (manual)
        o_num_posts: semana.o_num_posts,
        o_alcance: semana.o_alcance,
        o_interacao: semana.o_interacao,
        o_compartilhamento: semana.o_compartilhamento,
        o_engajamento: semana.o_engajamento,
        o_num_stories: semana.o_num_stories,
        o_visu_stories: semana.o_visu_stories,
        
        // Marketing Pago - Meta (manual)
        m_valor_investido: semana.m_valor_investido,
        m_alcance: semana.m_alcance,
        m_frequencia: semana.m_frequencia,
        m_cpm: semana.m_cpm,
        m_cliques: semana.m_cliques,
        m_ctr: semana.m_ctr,
        m_custo_por_clique: semana.m_custo_por_clique,
        m_conversas_iniciadas: semana.m_conversas_iniciadas,
        
        // Google Ads (manual)
        g_valor_investido: semana.g_valor_investido,
        g_impressoes: semana.g_impressoes,
        g_cliques: semana.g_cliques,
        g_ctr: semana.g_ctr,
        g_solicitacoes_rotas: semana.g_solicitacoes_rotas,
        
        // GMN - Google Meu Negócio (manual)
        gmn_total_acoes: semana.gmn_total_acoes,
        gmn_total_visualizacoes: semana.gmn_total_visualizacoes,
        gmn_solicitacoes_rotas: semana.gmn_solicitacoes_rotas,
        
        // Outros campos existentes
        faturamento_entrada: semana.faturamento_entrada,
        faturamento_bar: semana.faturamento_bar,
        faturamento_cmovivel: semana.faturamento_cmovivel,
        
        observacoes: `Recalculado automaticamente em ${new Date().toLocaleString('pt-BR')} - Faturamento, Clientes, Ticket Médio, Meta Semanal, CMO, Atração, % Novos e Ativos`
      };

      const { data: atualizada, error: updateError } = await supabase
        .from('desempenho_semanal')
        .update(dadosAtualizados)
        .eq('id', semana.id)
        .eq('bar_id', barId)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Erro ao atualizar semana:', updateError);
        continue;
      }

      (semanasAtualizadas as any).push(atualizada);
    }

    return NextResponse.json({
      success: true,
      message: `${semanasAtualizadas.length} semana(s) recalculada(s) com sucesso`,
      data: semanasAtualizadas
    });

  } catch (error) {
    console.error('❌ Erro no recálculo:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
