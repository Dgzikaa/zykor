import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await getAdminClient();
    
    // Obter parâmetros
    const { searchParams } = new URL(request.url);
    const mes = parseInt(searchParams.get('mes') || (new Date().getMonth() + 1).toString());
    const ano = parseInt(searchParams.get('ano') || new Date().getFullYear().toString());
    
    // Obter bar_id do header
    const userDataHeader = request.headers.get('x-user-data');
    let barId = 3; // Default
    
    if (userDataHeader) {
      try {
        const userData = JSON.parse(decodeURIComponent(userDataHeader));
        if (userData.bar_id) barId = userData.bar_id;
      } catch (e) {
        console.warn('Erro ao parsear user data:', e);
      }
    }

    // Datas do mês
    const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const dataFim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

    // ========== PARTE 1: Dados diários de eventos_base ==========
    const { data: eventosDiarios, error: eventosError } = await supabase
      .from('eventos_base')
      .select('data_evento, real_r, cl_real, t_medio, percent_b, percent_d, percent_c, res_tot, res_p, t_coz, t_bar, fat_19h_percent, faturamento_couvert, faturamento_bar')
      .eq('bar_id', barId)
      .gte('data_evento', dataInicio)
      .lte('data_evento', dataFim);

    if (eventosError) {
      console.error('Erro ao buscar eventos diários:', eventosError);
    }

    // Agregar dados diários
    const dadosDiarios = agregarDadosDiarios(eventosDiarios || []);

    // ========== PARTE 2: Dados semanais proporcionais ==========
    // Identificar semanas que têm dias no mês e calcular proporção
    const semanasComProporcao = calcularSemanasComProporcao(mes, ano);
    
    // Buscar dados de todas as semanas envolvidas
    const todasSemanas = [...new Set(semanasComProporcao.map(s => `${s.anoISO}-${s.semana}`))];
    const semanasPorAno: Record<number, number[]> = {};
    for (const s of semanasComProporcao) {
      if (!semanasPorAno[s.anoISO]) semanasPorAno[s.anoISO] = [];
      if (!semanasPorAno[s.anoISO].includes(s.semana)) {
        semanasPorAno[s.anoISO].push(s.semana);
      }
    }

    const desempenhoPromises = Object.entries(semanasPorAno).map(([anoISO, semanas]) =>
      supabase
        .from('desempenho_semanal')
        .select('*')
        .eq('bar_id', barId)
        .eq('ano', parseInt(anoISO))
        .in('numero_semana', semanas)
    );
    
    const marketingPromises = Object.entries(semanasPorAno).map(([anoISO, semanas]) =>
      supabase
        .from('marketing_semanal')
        .select('*')
        .eq('bar_id', barId)
        .eq('ano', parseInt(anoISO))
        .in('semana', semanas)
    );

    const [desempenhoResults, marketingResults] = await Promise.all([
      Promise.all(desempenhoPromises),
      Promise.all(marketingPromises)
    ]);

    const desempenhoData = desempenhoResults.flatMap(r => r.data || []);
    const marketingData = marketingResults.flatMap(r => r.data || []);

    // Criar mapa de dados por semana
    const desempenhoMap = new Map<string, any>();
    for (const d of desempenhoData) {
      desempenhoMap.set(`${d.ano}-${d.numero_semana}`, d);
    }
    const marketingMap = new Map<string, any>();
    for (const m of marketingData) {
      marketingMap.set(`${m.ano}-${m.semana}`, m);
    }

    // Agregar dados semanais com proporção
    const dadosSemanais = agregarDadosSemanaisProporcionais(semanasComProporcao, desempenhoMap, marketingMap);

    // ========== Combinar dados diários e semanais ==========
    const dadosMensais = {
      // Dados semanais proporcionais (para métricas que só existem por semana: CMV, retenção, NPS, marketing)
      ...dadosSemanais,
      // Dados diários sobrescrevem (são mais precisos para faturamento, clientes, mix, etc)
      ...dadosDiarios,
      // Quantidade de dias com dados
      dias_com_dados: eventosDiarios?.filter(e => parseFloat(e.real_r) > 0).length || 0,
    };

    return NextResponse.json({
      success: true,
      mes: dadosMensais,
      periodo: { dataInicio, dataFim },
      semanasIncluidas: semanasComProporcao.map(s => `${s.anoISO}-S${s.semana} (${Math.round(s.proporcao * 100)}%)`),
      diasEventos: eventosDiarios?.length || 0,
      parametros: { mes, ano, barId }
    });

  } catch (error) {
    console.error('Erro na API de desempenho mensal:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Calcular semanas com proporção de dias no mês
function calcularSemanasComProporcao(mes: number, ano: number): { semana: number; anoISO: number; proporcao: number; diasNoMes: number }[] {
  const primeiroDia = new Date(ano, mes - 1, 1);
  const ultimoDia = new Date(ano, mes, 0);
  
  // Contar dias de cada semana que pertencem ao mês
  const contagemDias = new Map<string, { semana: number; anoISO: number; diasNoMes: number }>();
  
  for (let d = new Date(primeiroDia); d <= ultimoDia; d.setDate(d.getDate() + 1)) {
    const { semana, ano: anoISO } = getWeekAndYear(new Date(d));
    const key = `${anoISO}-${semana}`;
    
    if (!contagemDias.has(key)) {
      contagemDias.set(key, { semana, anoISO, diasNoMes: 0 });
    }
    contagemDias.get(key)!.diasNoMes++;
  }
  
  // Calcular proporção (diasNoMes / 7)
  return Array.from(contagemDias.values()).map(s => ({
    ...s,
    proporcao: s.diasNoMes / 7
  }));
}

// Obter número da semana ISO e o ano ISO
function getWeekAndYear(date: Date): { semana: number; ano: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const ano = d.getUTCFullYear();
  return { semana, ano };
}

// Agregar dados diários de eventos_base
function agregarDadosDiarios(eventos: any[]): any {
  if (!eventos || eventos.length === 0) {
    return {};
  }

  // Filtrar dias com faturamento real
  const diasComFaturamento = eventos.filter(e => parseFloat(e.real_r) > 0);
  const n = diasComFaturamento.length;

  if (n === 0) {
    return {
      faturamento_total: 0,
      clientes_atendidos: 0,
      ticket_medio: 0,
      perc_bebidas: 0,
      perc_drinks: 0,
      perc_comida: 0,
    };
  }

  // Somas
  const faturamentoTotal = diasComFaturamento.reduce((acc, e) => acc + (parseFloat(e.real_r) || 0), 0);
  const clientesTotal = diasComFaturamento.reduce((acc, e) => acc + (parseInt(e.cl_real) || 0), 0);
  const reservasTotal = eventos.reduce((acc, e) => acc + (parseInt(e.res_tot) || 0), 0);
  const reservasPresentes = eventos.reduce((acc, e) => acc + (parseInt(e.res_p) || 0), 0);
  const faturamentoCouvert = diasComFaturamento.reduce((acc, e) => acc + (parseFloat(e.faturamento_couvert) || 0), 0);
  const faturamentoBar = diasComFaturamento.reduce((acc, e) => acc + (parseFloat(e.faturamento_bar) || 0), 0);

  // Médias ponderadas por faturamento para percentuais
  const somaPercentB = diasComFaturamento.reduce((acc, e) => acc + (parseFloat(e.percent_b) || 0), 0);
  const somaPercentD = diasComFaturamento.reduce((acc, e) => acc + (parseFloat(e.percent_d) || 0), 0);
  const somaPercentC = diasComFaturamento.reduce((acc, e) => acc + (parseFloat(e.percent_c) || 0), 0);

  // Médias simples para tempos e percentuais
  const diasComTempo = diasComFaturamento.filter(e => parseFloat(e.t_coz) > 0 || parseFloat(e.t_bar) > 0);
  const tempoMedioCoz = diasComTempo.length > 0 
    ? diasComTempo.reduce((acc, e) => acc + (parseFloat(e.t_coz) || 0), 0) / diasComTempo.length 
    : 0;
  const tempoMedioBar = diasComTempo.length > 0 
    ? diasComTempo.reduce((acc, e) => acc + (parseFloat(e.t_bar) || 0), 0) / diasComTempo.length 
    : 0;

  const diasComFat19h = diasComFaturamento.filter(e => parseFloat(e.fat_19h_percent) > 0);
  const percFat19h = diasComFat19h.length > 0
    ? diasComFat19h.reduce((acc, e) => acc + (parseFloat(e.fat_19h_percent) || 0), 0) / diasComFat19h.length
    : 0;

  return {
    // Faturamentos
    faturamento_total: faturamentoTotal,
    faturamento_entrada: faturamentoCouvert,
    faturamento_bar: faturamentoBar,
    
    // Clientes
    clientes_atendidos: clientesTotal,
    
    // Ticket médio (faturamento / clientes)
    ticket_medio: clientesTotal > 0 ? faturamentoTotal / clientesTotal : 0,
    
    // Mix de vendas (média dos dias)
    perc_bebidas: somaPercentB / n,
    perc_drinks: somaPercentD / n,
    perc_comida: somaPercentC / n,
    
    // Reservas
    reservas_totais: reservasTotal,
    reservas_presentes: reservasPresentes,
    
    // Tempos
    tempo_saida_cozinha: tempoMedioCoz,
    tempo_saida_bar: tempoMedioBar,
    
    // Faturamento até 19h
    perc_faturamento_ate_19h: percFat19h,
  };
}

// Agregar dados semanais com proporção
function agregarDadosSemanaisProporcionais(
  semanasComProporcao: { semana: number; anoISO: number; proporcao: number }[],
  desempenhoMap: Map<string, any>,
  marketingMap: Map<string, any>
): any {
  let totalProporcao = 0;
  
  // Funções para somar com proporção
  const somaProportional = (campo: string) => {
    let soma = 0;
    for (const s of semanasComProporcao) {
      const dados = desempenhoMap.get(`${s.anoISO}-${s.semana}`);
      if (dados && dados[campo] !== null && dados[campo] !== undefined) {
        soma += (parseFloat(dados[campo]) || 0) * s.proporcao;
      }
    }
    return soma;
  };

  const mediaProportional = (campo: string) => {
    let soma = 0;
    let pesoTotal = 0;
    for (const s of semanasComProporcao) {
      const dados = desempenhoMap.get(`${s.anoISO}-${s.semana}`);
      if (dados && dados[campo] !== null && dados[campo] !== undefined) {
        soma += (parseFloat(dados[campo]) || 0) * s.proporcao;
        pesoTotal += s.proporcao;
      }
    }
    return pesoTotal > 0 ? soma / pesoTotal : 0;
  };

  const somaMarketingProportional = (campo: string) => {
    let soma = 0;
    for (const s of semanasComProporcao) {
      const dados = marketingMap.get(`${s.anoISO}-${s.semana}`);
      if (dados && dados[campo] !== null && dados[campo] !== undefined) {
        soma += (parseFloat(dados[campo]) || 0) * s.proporcao;
      }
    }
    return soma;
  };

  const mediaMarketingProportional = (campo: string) => {
    let soma = 0;
    let pesoTotal = 0;
    for (const s of semanasComProporcao) {
      const dados = marketingMap.get(`${s.anoISO}-${s.semana}`);
      if (dados && dados[campo] !== null && dados[campo] !== undefined) {
        soma += (parseFloat(dados[campo]) || 0) * s.proporcao;
        pesoTotal += s.proporcao;
      }
    }
    return pesoTotal > 0 ? soma / pesoTotal : 0;
  };

  return {
    // CMV (proporcionais)
    cmv_rs: somaProportional('cmv_rs'),
    cmv_limpo: mediaProportional('cmv_limpo'),
    cmv_global_real: mediaProportional('cmv_global_real'),
    cmv_teorico: mediaProportional('cmv_teorico'),
    
    // CMO
    cmo: mediaProportional('cmo'),
    cmo_custo: somaProportional('cmo_custo'),
    custo_atracao_faturamento: mediaProportional('custo_atracao_faturamento'),
    
    // Clientes ativos (média)
    clientes_ativos: mediaProportional('clientes_ativos'),
    clientes_30d: mediaProportional('clientes_30d'),
    clientes_60d: mediaProportional('clientes_60d'),
    clientes_90d: mediaProportional('clientes_90d'),
    
    // Retenção (média)
    retencao_1m: mediaProportional('retencao_1m'),
    retencao_2m: mediaProportional('retencao_2m'),
    perc_clientes_novos: mediaProportional('perc_clientes_novos'),
    
    // Qualidade
    avaliacoes_5_google_trip: somaProportional('avaliacoes_5_google_trip'),
    media_avaliacoes_google: mediaProportional('media_avaliacoes_google'),
    nps_geral: mediaProportional('nps_geral'),
    nps_reservas: mediaProportional('nps_reservas'),
    nota_felicidade_equipe: mediaProportional('nota_felicidade_equipe'),
    
    // Happy Hour
    perc_happy_hour: mediaProportional('perc_happy_hour'),
    
    // Cockpit Financeiro (proporcionais)
    imposto: somaProportional('imposto'),
    comissao: somaProportional('comissao'),
    cmv: somaProportional('cmv'),
    freelas: somaProportional('freelas'),
    cmo_fixo_simulacao: somaProportional('cmo_fixo_simulacao'),
    alimentacao: somaProportional('alimentacao'),
    pro_labore: somaProportional('pro_labore'),
    rh_estorno_outros_operacao: somaProportional('rh_estorno_outros_operacao'),
    materiais: somaProportional('materiais'),
    manutencao: somaProportional('manutencao'),
    atracoes_eventos: somaProportional('atracoes_eventos'),
    utensilios: somaProportional('utensilios'),
    
    // Stockout e produção
    stockout_comidas: somaProportional('stockout_comidas'),
    stockout_drinks: somaProportional('stockout_drinks'),
    stockout_bar: somaProportional('stockout_bar'),
    qtde_itens_bar: somaProportional('qtde_itens_bar'),
    atrasos_bar: somaProportional('atrasos_bar'),
    qtde_itens_cozinha: somaProportional('qtde_itens_cozinha'),
    atrasos_cozinha: somaProportional('atrasos_cozinha'),
    
    // Vendas extras
    venda_balcao: somaProportional('venda_balcao'),
    couvert_atracoes: somaProportional('couvert_atracoes'),
    qui_sab_dom: somaProportional('qui_sab_dom'),
    
    // Marketing Orgânico
    o_num_posts: somaMarketingProportional('o_num_posts'),
    o_alcance: somaMarketingProportional('o_alcance'),
    o_interacao: somaMarketingProportional('o_interacao'),
    o_compartilhamento: somaMarketingProportional('o_compartilhamento'),
    o_engajamento: mediaMarketingProportional('o_engajamento'),
    o_num_stories: somaMarketingProportional('o_num_stories'),
    o_visu_stories: somaMarketingProportional('o_visu_stories'),
    
    // Marketing Pago - Meta
    m_valor_investido: somaMarketingProportional('m_valor_investido'),
    m_alcance: somaMarketingProportional('m_alcance'),
    m_frequencia: mediaMarketingProportional('m_frequencia'),
    m_cpm: mediaMarketingProportional('m_cpm'),
    m_cliques: somaMarketingProportional('m_cliques'),
    m_ctr: mediaMarketingProportional('m_ctr'),
    m_custo_por_clique: mediaMarketingProportional('m_cpc'),
    m_conversas_iniciadas: somaMarketingProportional('m_conversas_iniciadas'),
    
    // Google Ads
    g_valor_investido: somaMarketingProportional('g_valor_investido'),
    g_impressoes: somaMarketingProportional('g_impressoes'),
    g_cliques: somaMarketingProportional('g_cliques'),
    g_ctr: mediaMarketingProportional('g_ctr'),
    g_solicitacoes_rotas: somaMarketingProportional('g_solicitacoes_rotas'),
    
    // GMN
    gmn_total_acoes: somaMarketingProportional('gmn_total_acoes'),
    gmn_total_visualizacoes: somaMarketingProportional('gmn_total_visualizacoes'),
    gmn_solicitacoes_rotas: somaMarketingProportional('gmn_solicitacoes_rotas'),
  };
}
