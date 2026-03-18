import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

// Cache por 2 minutos para dados mensais de desempenho
export const revalidate = 120;

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
      .select('data_evento, real_r, cl_real, t_medio, percent_b, percent_d, percent_c, res_tot, res_p, num_mesas_tot, num_mesas_presentes, t_coz, t_bar, fat_19h_percent, faturamento_couvert, faturamento_bar')
      .eq('bar_id', barId)
      .gte('data_evento', dataInicio)
      .lte('data_evento', dataFim);

    if (eventosError) {
      console.error('Erro ao buscar eventos diários:', eventosError);
    }

    // Stockout mensal canônico por categoria_mix (fonte: contahub_stockout)
    const { data: stockoutMensal, error: stockoutError } = await supabase
      .from('contahub_stockout')
      .select('categoria_mix, prd_venda')
      .eq('bar_id', barId)
      .gte('data_consulta', dataInicio)
      .lte('data_consulta', dataFim)
      .eq('prd_ativo', 'S')
      .in('categoria_mix', ['BEBIDA', 'DRINK', 'COMIDA']);

    if (stockoutError) {
      console.error('Erro ao buscar stockout mensal:', stockoutError);
    }

    // Agregar dados diários + stockout canônico do mês
    const dadosDiarios = agregarDadosDiarios(eventosDiarios || [], stockoutMensal || []);

    // ========== PARTE 1.5: Dados mensais de marketing (100% manual) ==========
    const { data: marketingMensal, error: marketingMensalError } = await supabase
      .from('marketing_mensal')
      .select('*')
      .eq('bar_id', barId)
      .eq('ano', ano)
      .eq('mes', mes)
      .single();

    if (marketingMensalError && marketingMensalError.code !== 'PGRST116') {
      console.error('Erro ao buscar marketing mensal:', marketingMensalError);
    }

    // ========== PARTE 1.6: NPS Falaê diário agregado ==========
    const { data: falaeNpsDiario, error: falaeNpsError } = await supabase
      .from('nps_falae_diario')
      .select('respostas_total, promotores, detratores, nps_media')
      .eq('bar_id', barId)
      .gte('data_referencia', dataInicio)
      .lte('data_referencia', dataFim);

    if (falaeNpsError) {
      console.error('Erro ao buscar nps_falae_diario:', falaeNpsError);
    }

    const falaeRows = falaeNpsDiario || [];
    const falaeTotalRespostas = falaeRows.reduce((sum, r) => sum + (Number(r.respostas_total) || 0), 0);
    const falaePromotores = falaeRows.reduce((sum, r) => sum + (Number(r.promotores) || 0), 0);
    const falaeDetratores = falaeRows.reduce((sum, r) => sum + (Number(r.detratores) || 0), 0);
    const falaeMediaPonderada = falaeRows.reduce(
      (sum, r) => sum + ((Number(r.nps_media) || 0) * (Number(r.respostas_total) || 0)),
      0
    );
    const falaeNpsScore =
      falaeTotalRespostas > 0
        ? Math.round((((falaePromotores - falaeDetratores) / falaeTotalRespostas) * 100) * 10) / 10
        : null;
    const falaeNpsMedia =
      falaeTotalRespostas > 0 ? Math.round((falaeMediaPonderada / falaeTotalRespostas) * 10) / 10 : null;

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
    const dadosSemanais = agregarDadosSemanaisProporcionais(semanasComProporcao, desempenhoMap, marketingMap, marketingMensal);

    // ========== Combinar dados diários e semanais ==========
    const dadosMensais = {
      // Dados semanais proporcionais (para métricas que só existem por semana: CMV, retenção, NPS, marketing)
      ...dadosSemanais,
      // Dados diários sobrescrevem (são mais precisos para faturamento, clientes, mix, etc)
      ...dadosDiarios,
      // NPS Falaê mensal derivado da tabela diária agregada
      ...(falaeNpsScore !== null && { nps_geral: falaeNpsScore }),
      falae_nps_score: falaeNpsScore,
      falae_nps_media: falaeNpsMedia,
      falae_respostas_total: falaeTotalRespostas,
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
function agregarDadosDiarios(eventos: any[], stockoutRows: any[]): any {
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
  const mesasTotal = eventos.reduce((acc, e) => acc + (parseInt(e.num_mesas_tot) || 0), 0);
  const mesasPresentes = eventos.reduce((acc, e) => acc + (parseInt(e.num_mesas_presentes) || 0), 0);
  const faturamentoCouvert = diasComFaturamento.reduce((acc, e) => acc + (parseFloat(e.faturamento_couvert) || 0), 0);
  const faturamentoBar = diasComFaturamento.reduce((acc, e) => acc + (parseFloat(e.faturamento_bar) || 0), 0);

  // Médias ponderadas por faturamento para percentuais (% Mix de Vendas)
  // Fórmula: Σ(percent * faturamento) / Σ(faturamento)
  const somaPercentBPonderado = diasComFaturamento.reduce((acc, e) => {
    const fat = parseFloat(e.real_r) || 0;
    const perc = parseFloat(e.percent_b) || 0;
    return acc + (perc * fat);
  }, 0);
  const somaPercentDPonderado = diasComFaturamento.reduce((acc, e) => {
    const fat = parseFloat(e.real_r) || 0;
    const perc = parseFloat(e.percent_d) || 0;
    return acc + (perc * fat);
  }, 0);
  const somaPercentCPonderado = diasComFaturamento.reduce((acc, e) => {
    const fat = parseFloat(e.real_r) || 0;
    const perc = parseFloat(e.percent_c) || 0;
    return acc + (perc * fat);
  }, 0);

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
    
    // Mix de vendas (média ponderada pelo faturamento)
    perc_bebidas: faturamentoTotal > 0 ? somaPercentBPonderado / faturamentoTotal : 0,
    perc_drinks: faturamentoTotal > 0 ? somaPercentDPonderado / faturamentoTotal : 0,
    perc_comida: faturamentoTotal > 0 ? somaPercentCPonderado / faturamentoTotal : 0,
    
    // Reservas (mesas / pessoas)
    reservas_totais: reservasTotal,
    reservas_presentes: reservasPresentes,
    mesas_totais: mesasTotal,
    mesas_presentes: mesasPresentes,
    
    // Tempos
    tempo_saida_cozinha: tempoMedioCoz,
    tempo_saida_bar: tempoMedioBar,
    
    // Faturamento até 19h
    perc_faturamento_ate_19h: percFat19h,
    
    ...agregarStockoutCategoriaMix(stockoutRows),
  };
}

function agregarStockoutCategoriaMix(stockoutRows: any[]) {
  const totalBebidas = stockoutRows.filter(r => r.categoria_mix === 'BEBIDA').length;
  const totalDrinks = stockoutRows.filter(r => r.categoria_mix === 'DRINK').length;
  const totalComidas = stockoutRows.filter(r => r.categoria_mix === 'COMIDA').length;

  const soBebidas = stockoutRows.filter(r => r.categoria_mix === 'BEBIDA' && r.prd_venda === 'N').length;
  const soDrinks = stockoutRows.filter(r => r.categoria_mix === 'DRINK' && r.prd_venda === 'N').length;
  const soComidas = stockoutRows.filter(r => r.categoria_mix === 'COMIDA' && r.prd_venda === 'N').length;

  const totalItens = totalBebidas + totalDrinks + totalComidas;
  const totalStockout = soBebidas + soDrinks + soComidas;

  return {
    stockout_bar: soBebidas,
    stockout_drinks: soDrinks,
    stockout_comidas: soComidas,
    stockout_bar_perc: totalBebidas > 0 ? (soBebidas / totalBebidas) * 100 : 0,
    stockout_drinks_perc: totalDrinks > 0 ? (soDrinks / totalDrinks) * 100 : 0,
    stockout_comidas_perc: totalComidas > 0 ? (soComidas / totalComidas) * 100 : 0,
    percent_stockout: totalItens > 0 ? (totalStockout / totalItens) * 100 : 0,
  };
}

// Agregar dados semanais com proporção
function agregarDadosSemanaisProporcionais(
  semanasComProporcao: { semana: number; anoISO: number; proporcao: number }[],
  desempenhoMap: Map<string, any>,
  marketingMap: Map<string, any>,
  marketingMensal: any
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
    
    // Clientes ativos (soma, não média - é contagem única de clientes)
    clientes_ativos: Math.round(somaProportional('clientes_ativos')),
    clientes_30d: Math.round(somaProportional('clientes_30d')),
    clientes_60d: Math.round(somaProportional('clientes_60d')),
    clientes_90d: Math.round(somaProportional('clientes_90d')),
    
    // Reservas (soma das semanas proporcionais)
    reservas_totais_semanal: Math.round(somaProportional('reservas_totais')),
    reservas_presentes_semanal: Math.round(somaProportional('reservas_presentes')),
    pessoas_reservas_totais: Math.round(somaProportional('pessoas_reservas_totais')),
    pessoas_reservas_presentes: Math.round(somaProportional('pessoas_reservas_presentes')),
    // Quebra de reservas = (Pessoas Total - Pessoas Presentes) / Pessoas Total × 100
    quebra_reservas: (() => {
      const pessoasTotal = Math.round(somaProportional('pessoas_reservas_totais'));
      const pessoasPresentes = Math.round(somaProportional('pessoas_reservas_presentes'));
      return pessoasTotal > 0 ? ((pessoasTotal - pessoasPresentes) / pessoasTotal) * 100 : 0;
    })(),
    
    // Retenção (média)
    retencao_1m: mediaProportional('retencao_1m'),
    retencao_2m: mediaProportional('retencao_2m'),
    perc_clientes_novos: mediaProportional('perc_clientes_novos'),
    
    // Qualidade
    avaliacoes_5_google_trip: Math.round(somaProportional('avaliacoes_5_google_trip')),
    media_avaliacoes_google: Math.round(mediaProportional('media_avaliacoes_google') * 100) / 100, // 2 casas decimais
    nps_geral: Math.round(mediaProportional('nps_geral')),
    nps_reservas: Math.round(mediaProportional('nps_reservas')),
    nota_felicidade_equipe: Math.round(mediaProportional('nota_felicidade_equipe') * 100) / 100,
    
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
    
    // Stockout mensal agora vem do contahub_stockout (categoria_mix) no bloco diário
    qtde_itens_bar: somaProportional('qtde_itens_bar'),
    atrasos_bar: somaProportional('atrasos_bar'),
    qtde_itens_cozinha: somaProportional('qtde_itens_cozinha'),
    atrasos_cozinha: somaProportional('atrasos_cozinha'),
    
    // Vendas extras
    venda_balcao: somaProportional('venda_balcao'),
    couvert_atracoes: somaProportional('couvert_atracoes'),
    qui_sab_dom: somaProportional('qui_sab_dom'),
    ter_qua_qui: somaProportional('ter_qua_qui'),
    sex_sab: somaProportional('sex_sab'),
    
    // Marketing Orgânico (100% MANUAL - não usar proporção)
    o_num_posts: marketingMensal?.o_num_posts || 0,
    o_alcance: marketingMensal?.o_alcance || 0,
    o_interacao: marketingMensal?.o_interacao || 0,
    o_compartilhamento: marketingMensal?.o_compartilhamento || 0,
    o_engajamento: marketingMensal?.o_engajamento || 0,
    o_num_stories: marketingMensal?.o_num_stories || 0,
    o_visu_stories: marketingMensal?.o_visu_stories || 0,

    // Marketing Pago - Meta (100% MANUAL - não usar proporção)
    m_valor_investido: marketingMensal?.m_valor_investido || 0,
    m_alcance: marketingMensal?.m_alcance || 0,
    m_frequencia: marketingMensal?.m_frequencia || 0,
    m_cpm: marketingMensal?.m_cpm || 0,
    m_cliques: marketingMensal?.m_cliques || 0,
    m_ctr: marketingMensal?.m_ctr || 0,
    m_custo_por_clique: marketingMensal?.m_cpc || 0,
    m_conversas_iniciadas: marketingMensal?.m_conversas_iniciadas || 0,

    // Google Ads (100% MANUAL - não usar proporção)
    g_valor_investido: marketingMensal?.g_valor_investido || 0,
    g_impressoes: marketingMensal?.g_impressoes || 0,
    g_cliques: marketingMensal?.g_cliques || 0,
    g_ctr: marketingMensal?.g_ctr || 0,
    g_solicitacoes_rotas: marketingMensal?.g_solicitacoes_rotas || 0,

    // GMN (100% MANUAL - não usar proporção)
    gmn_total_acoes: marketingMensal?.gmn_total_acoes || 0,
    gmn_total_visualizacoes: marketingMensal?.gmn_total_visualizacoes || 0,
    gmn_solicitacoes_rotas: marketingMensal?.gmn_solicitacoes_rotas || 0,
    
    // Gestão Produção
    quebra_utensilios: somaProportional('quebra_utensilios'),
    bonificacoes_contratos: somaProportional('bonificacoes_contratos'),
    nota_producao_bar: mediaProportional('nota_producao_bar'),
    nota_producao_cozinha: mediaProportional('nota_producao_cozinha'),
    perc_checklist_producao: mediaProportional('perc_checklist_producao'),
    desvio_semana: somaProportional('desvio_semana'),
    
    // Gestão RH
    quorum_pesquisa_felicidade: mediaProportional('quorum_pesquisa_felicidade'),
    vagas_abertas: Math.round(mediaProportional('vagas_abertas')),
    num_testes_ps: somaProportional('num_testes_ps'),
    perc_comparecimento_ps: mediaProportional('perc_comparecimento_ps'),
    aprovados_ps: somaProportional('aprovados_ps'),
    perc_checklist_rh: mediaProportional('perc_checklist_rh'),
    absenteismo: mediaProportional('absenteismo'),
    
    // Gestão Financeiro
    num_lancamentos_vencidos: somaProportional('num_lancamentos_vencidos'),
    conciliacoes_pendentes: somaProportional('conciliacoes_pendentes'),
    erros_pente_fino: somaProportional('erros_pente_fino'),
    lancamentos_atrasados: somaProportional('lancamentos_atrasados'),
    perc_checklist_semanal_terca: mediaProportional('perc_checklist_semanal_terca'),
  };
}
