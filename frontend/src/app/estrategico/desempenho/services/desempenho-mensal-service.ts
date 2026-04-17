import { SupabaseClient } from '@supabase/supabase-js';
import {
  ContahubStockoutMixRow,
  DadosSemana,
  DesempenhoSemanalDbRow,
  EventoBaseDiarioRow,
  MarketingSemanalRow,
  SemanaProporcaoMes,
} from '../types';

export async function getMeses(
  supabase: SupabaseClient,
  barId: number,
  anoInicio: number,
  mesInicio: number,
  anoFim: number,
  mesFim: number
): Promise<DadosSemana[]> {
  
  const mesesParaCarregar: { mes: number; ano: number }[] = [];
  
  for (let ano = anoInicio; ano <= anoFim; ano++) {
    const minMes = ano === anoInicio ? mesInicio : 1;
    const maxMes = ano === anoFim ? mesFim : 12;
    
    for (let mes = minMes; mes <= maxMes; mes++) {
      mesesParaCarregar.push({ mes, ano });
    }
  }

  // Executar em paralelo (limite de concorrência se necessário, mas aqui são poucos meses)
  // Em RSC, Promise.all é seguro
  const results = await Promise.all(
    mesesParaCarregar.map(({ mes, ano }) => getDadosMensais(supabase, barId, mes, ano))
  );

  return results.filter(Boolean) as DadosSemana[];
}

async function getDadosMensais(
  supabase: SupabaseClient,
  barId: number,
  mes: number,
  ano: number
): Promise<DadosSemana | null> {
  // Datas do mês
  const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dataFim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

  // 1. Dados diários
  let query = supabase
    .from('eventos_base')
    .select('data_evento, real_r, cl_real, t_medio, percent_b, percent_d, percent_c, res_tot, res_p, num_mesas_tot, num_mesas_presentes, t_coz, t_bar, fat_19h_percent, faturamento_couvert, faturamento_bar')
    .eq('bar_id', barId)
    .gte('data_evento', dataInicio)
    .lte('data_evento', dataFim);

  // Excluir dias de Carnaval 2026 (13-17/02) para ambos os bares
  if (ano === 2026 && mes === 2) {
    query = query.not('data_evento', 'in', '("2026-02-13","2026-02-14","2026-02-15","2026-02-16","2026-02-17")');
  }

  const { data: eventosDiarios } = await query;

  // Stockout mensal canônico por categoria_mix (fonte: gold_contahub_operacional_stockout)
  const { data: stockoutMensal } = await supabase
    .schema('gold')
    .from('gold_contahub_operacional_stockout')
    .select('categoria_mix, prd_venda')
    .eq('bar_id', barId)
    .gte('data_consulta', dataInicio)
    .lte('data_consulta', dataFim)
    .eq('prd_ativo', 'S')
    .in('categoria_mix', ['BEBIDA', 'DRINK', 'COMIDA']);

  const dadosDiarios = agregarDadosDiarios(
    (eventosDiarios || []) as EventoBaseDiarioRow[],
    (stockoutMensal || []) as ContahubStockoutMixRow[]
  );

  // 2. Dados semanais proporcionais
  const semanasComProporcao = calcularSemanasComProporcao(mes, ano);
  
  const semanasIds = [...new Set(semanasComProporcao.map(s => `${s.anoISO}-${s.semana}`))];
  
  // Buscar semanas envolvidas
  // Otimização: buscar em lote por ano
  const anosEnvolvidos = [...new Set(semanasComProporcao.map(s => s.anoISO))];
  
  const desempenhoPromises = anosEnvolvidos.map(anoISO => 
    supabase
      .from('desempenho_semanal')
      .select('*')
      .eq('bar_id', barId)
      .eq('ano', anoISO)
      .in('numero_semana', semanasComProporcao.filter(s => s.anoISO === anoISO).map(s => s.semana))
  );

  const marketingPromises = anosEnvolvidos.map(anoISO => 
    supabase
      .from('marketing_semanal')
      .select('*')
      .eq('bar_id', barId)
      .eq('ano', anoISO)
      .in('semana', semanasComProporcao.filter(s => s.anoISO === anoISO).map(s => s.semana))
  );

  // 3. Buscar Conta Assinada (de faturamento_pagamentos - tabela de domínio)
  const contaAssinadaPromise = supabase
    .from('faturamento_pagamentos')
    .select('data_pagamento, valor_bruto')
    .eq('bar_id', barId)
    .eq('meio', 'Conta Assinada')
    .gte('data_pagamento', dataInicio)
    .lte('data_pagamento', dataFim);

  // 4. Buscar Descontos (de visitas - tabela de domínio)
  const descontosPromise = supabase
    .from('visitas')
    .select('data_visita, valor_desconto, motivo_desconto')
    .eq('bar_id', barId)
    .gt('valor_desconto', 0)
    .gte('data_visita', dataInicio)
    .lte('data_visita', dataFim);

  // 5. Clientes Ativos: usar RPC get_count_base_ativa com os 90 dias anteriores ao último dia do mês
  const dataFimDate = new Date(ano, mes, 0); // Último dia do mês
  const data90DiasAtras = new Date(dataFimDate);
  data90DiasAtras.setDate(data90DiasAtras.getDate() - 90);
  const data90DiasAtrasStr = data90DiasAtras.toISOString().split('T')[0];

  const clientesAtivosPromise = supabase.rpc('get_count_base_ativa', {
    p_bar_id: barId,
    p_data_inicio: data90DiasAtrasStr,
    p_data_fim: dataFim
  });

  // 6. NPS Falaê diário agregado
  const falaeNpsPromise = supabase
    .from('nps_falae_diario')
    .select('respostas_total, promotores, detratores, nps_media')
    .eq('bar_id', barId)
    .gte('data_referencia', dataInicio)
    .lte('data_referencia', dataFim);

  // 7. Buscar dados de marketing mensal (preenchimento manual)
  const marketingMensalPromise = supabase
    .from('marketing_mensal')
    .select('*')
    .eq('bar_id', barId)
    .eq('ano', ano)
    .eq('mes', mes)
    .single();

  const [desempenhoResults, marketingResults, contaAssinadaResult, descontosResult, clientesAtivosResult, falaeNpsResult, marketingMensalResult] = await Promise.all([
    Promise.all(desempenhoPromises),
    Promise.all(marketingPromises),
    contaAssinadaPromise,
    descontosPromise,
    clientesAtivosPromise,
    falaeNpsPromise,
    marketingMensalPromise
  ]);

  const desempenhoData = desempenhoResults.flatMap(r => r.data || []);
  const marketingData = marketingResults.flatMap(r => r.data || []);

  const desempenhoMap = new Map<string, DesempenhoSemanalDbRow>();
  desempenhoData.forEach((d) =>
    desempenhoMap.set(`${d.ano}-${d.numero_semana}`, d as DesempenhoSemanalDbRow)
  );

  const marketingMap = new Map<string, MarketingSemanalRow>();
  marketingData.forEach((m) =>
    marketingMap.set(`${m.ano}-${m.semana}`, m as MarketingSemanalRow)
  );

  // Calcular Conta Assinada total do mês
  const contaAssinadaValor = (contaAssinadaResult.data || []).reduce(
    (sum, p) => sum + (Number(p.valor_bruto) || 0), 0
  );

  // Calcular Descontos total do mês
  const descontosValor = (descontosResult.data || []).reduce(
    (sum, d) => sum + (Number(d.valor_desconto) || 0), 0
  );

  // Clientes Ativos: número calculado pela RPC (clientes com 2+ visitas nos últimos 90 dias até o último dia do mês)
  const clientesAtivos = clientesAtivosResult.error ? 0 : Number(clientesAtivosResult.data) || 0;

  // NPS Falaê: calcular score do mês
  const falaeDiario = falaeNpsResult.data || [];
  let falaeNpsScore: number | null = null;
  let falaeNpsMedia: number | null = null;
  const total = falaeDiario.reduce((sum, d) => sum + (Number(d.respostas_total) || 0), 0);
  const promotores = falaeDiario.reduce((sum, d) => sum + (Number(d.promotores) || 0), 0);
  const detratores = falaeDiario.reduce((sum, d) => sum + (Number(d.detratores) || 0), 0);
  const somaMediaPonderada = falaeDiario.reduce(
    (sum, d) => sum + ((Number(d.nps_media) || 0) * (Number(d.respostas_total) || 0)),
    0
  );
  if (total > 0) {
    falaeNpsScore = Math.round((((promotores - detratores) / total) * 100) * 10) / 10;
    falaeNpsMedia = Math.round((somaMediaPonderada / total) * 10) / 10;
  }

  const dadosSemanais = agregarDadosSemanaisProporcionais(semanasComProporcao, desempenhoMap, marketingMap);

  // Sobrescrever dados de marketing com valores manuais da tabela marketing_mensal (se existirem)
  const marketingMensal = marketingMensalResult.data;
  if (marketingMensal) {
    // Marketing Orgânico
    if (marketingMensal.o_num_posts !== null) dadosSemanais.o_num_posts = marketingMensal.o_num_posts;
    if (marketingMensal.o_alcance !== null) dadosSemanais.o_alcance = marketingMensal.o_alcance;
    if (marketingMensal.o_interacao !== null) dadosSemanais.o_interacao = marketingMensal.o_interacao;
    if (marketingMensal.o_compartilhamento !== null) dadosSemanais.o_compartilhamento = marketingMensal.o_compartilhamento;
    if (marketingMensal.o_engajamento !== null) dadosSemanais.o_engajamento = marketingMensal.o_engajamento;
    if (marketingMensal.o_num_stories !== null) dadosSemanais.o_num_stories = marketingMensal.o_num_stories;
    if (marketingMensal.o_visu_stories !== null) dadosSemanais.o_visu_stories = marketingMensal.o_visu_stories;
    
    // Marketing Pago - Meta
    if (marketingMensal.m_valor_investido !== null) dadosSemanais.m_valor_investido = marketingMensal.m_valor_investido;
    if (marketingMensal.m_alcance !== null) dadosSemanais.m_alcance = marketingMensal.m_alcance;
    if (marketingMensal.m_frequencia !== null) dadosSemanais.m_frequencia = marketingMensal.m_frequencia;
    if (marketingMensal.m_cpm !== null) dadosSemanais.m_cpm = marketingMensal.m_cpm;
    if (marketingMensal.m_cliques !== null) dadosSemanais.m_cliques = marketingMensal.m_cliques;
    if (marketingMensal.m_ctr !== null) dadosSemanais.m_ctr = marketingMensal.m_ctr;
    if (marketingMensal.m_custo_por_clique !== null) dadosSemanais.m_custo_por_clique = marketingMensal.m_custo_por_clique;
    if (marketingMensal.m_conversas_iniciadas !== null) dadosSemanais.m_conversas_iniciadas = marketingMensal.m_conversas_iniciadas;
    
    // Google Ads
    if (marketingMensal.g_valor_investido !== null) dadosSemanais.g_valor_investido = marketingMensal.g_valor_investido;
    if (marketingMensal.g_impressoes !== null) dadosSemanais.g_impressoes = marketingMensal.g_impressoes;
    if (marketingMensal.g_cliques !== null) dadosSemanais.g_cliques = marketingMensal.g_cliques;
    if (marketingMensal.g_ctr !== null) dadosSemanais.g_ctr = marketingMensal.g_ctr;
    if (marketingMensal.g_solicitacoes_rotas !== null) dadosSemanais.g_solicitacoes_rotas = marketingMensal.g_solicitacoes_rotas;
    
    // GMN
    if (marketingMensal.gmn_total_acoes !== null) dadosSemanais.gmn_total_acoes = marketingMensal.gmn_total_acoes;
    if (marketingMensal.gmn_total_visualizacoes !== null) dadosSemanais.gmn_total_visualizacoes = marketingMensal.gmn_total_visualizacoes;
    if (marketingMensal.gmn_solicitacoes_rotas !== null) dadosSemanais.gmn_solicitacoes_rotas = marketingMensal.gmn_solicitacoes_rotas;
  }

  // Calcular reservas e mesas de eventos_base (já sincronizados do GetIn via sync_mesas_getin_to_eventos)
  const sumIntEventos = (arr: EventoBaseDiarioRow[], key: keyof EventoBaseDiarioRow) =>
    arr.reduce((acc, e) => acc + (parseInt(String(e[key]), 10) || 0), 0);
  const reservasTotaisDiarias = sumIntEventos((eventosDiarios || []) as EventoBaseDiarioRow[], 'res_tot');
  const reservasPresentesDiarias = sumIntEventos((eventosDiarios || []) as EventoBaseDiarioRow[], 'res_p');
  const mesasTotaisDiarias = sumIntEventos((eventosDiarios || []) as EventoBaseDiarioRow[], 'num_mesas_tot');
  const mesasPresentesDiarias = sumIntEventos(
    (eventosDiarios || []) as EventoBaseDiarioRow[],
    'num_mesas_presentes'
  );

  // Calcular faturamento total para os percentuais
  const faturamentoTotal = dadosDiarios.faturamento_total || 0;
  const contaAssinadaPerc = faturamentoTotal > 0 ? (contaAssinadaValor / faturamentoTotal) * 100 : 0;
  const descontosPerc = faturamentoTotal > 0 ? (descontosValor / faturamentoTotal) * 100 : 0;

  return {
    id: ano * 100 + mes,
    numero_semana: mes, // Mês usado como numero_semana para compatibilidade
    ano,
    data_inicio: dataInicio,
    data_fim: dataFim,
    ...dadosSemanais,
    ...dadosDiarios,
    // Sobrescrever reservas e mesas com dados diários (de eventos_base)
    reservas_totais: reservasTotaisDiarias,
    reservas_presentes: reservasPresentesDiarias,
    mesas_totais: mesasTotaisDiarias,
    mesas_presentes: mesasPresentesDiarias,
    // Sobrescrever com valores calculados diretamente das tabelas de origem
    conta_assinada_valor: contaAssinadaValor,
    conta_assinada_perc: contaAssinadaPerc,
    descontos_valor: descontosValor,
    descontos_perc: descontosPerc,
    // Clientes Ativos: calculado pela RPC get_count_base_ativa (90 dias até último dia do mês)
    clientes_ativos: clientesAtivos,
    // NPS Falaê: se houver dados do Falaê, sobrescrever nps_geral
    ...(falaeNpsScore !== null && { nps_geral: falaeNpsScore }),
    // Adicionar campo específico para NPS Falaê
    falae_nps_score: falaeNpsScore,
    falae_nps_media: falaeNpsMedia,
    falae_respostas_total: total,
  } as unknown as DadosSemana;
}

// Helpers copiados de route.ts
function calcularSemanasComProporcao(mes: number, ano: number): SemanaProporcaoMes[] {
  const primeiroDia = new Date(ano, mes - 1, 1);
  const ultimoDia = new Date(ano, mes, 0);
  const contagemDias = new Map<string, { semana: number; anoISO: number; diasNoMes: number }>();
  
  for (let d = new Date(primeiroDia); d <= ultimoDia; d.setDate(d.getDate() + 1)) {
    const { semana, ano: anoISO } = getWeekAndYear(new Date(d));
    const key = `${anoISO}-${semana}`;
    if (!contagemDias.has(key)) contagemDias.set(key, { semana, anoISO, diasNoMes: 0 });
    contagemDias.get(key)!.diasNoMes++;
  }
  
  return Array.from(contagemDias.values()).map(s => ({ ...s, proporcao: s.diasNoMes / 7 }));
}

function getWeekAndYear(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const ano = d.getUTCFullYear();
  return { semana, ano };
}

function agregarDadosDiarios(eventos: EventoBaseDiarioRow[], stockoutRows: ContahubStockoutMixRow[]) {
  if (!eventos || eventos.length === 0) return {};
  
  const diasComFaturamento = eventos.filter((e) => parseFloat(String(e.real_r)) > 0);
  const n = diasComFaturamento.length;

  const sum = (arr: EventoBaseDiarioRow[], key: keyof EventoBaseDiarioRow) =>
    arr.reduce((acc, e) => acc + (parseFloat(String(e[key])) || 0), 0);
  const sumInt = (arr: EventoBaseDiarioRow[], key: keyof EventoBaseDiarioRow) =>
    arr.reduce((acc, e) => acc + (parseInt(String(e[key]), 10) || 0), 0);

  if (n === 0) return { 
    faturamento_total: 0, 
    clientes_atendidos: 0,
    reservas_totais: sumInt(eventos, 'res_tot'),
    reservas_presentes: sumInt(eventos, 'res_p'),
  };

  const faturamentoTotal = sum(diasComFaturamento, 'real_r');
  const clientesTotal = sumInt(diasComFaturamento, 'cl_real');
  
  const diasComTempo = diasComFaturamento.filter(
    (e) => parseFloat(String(e.t_coz)) > 0 || parseFloat(String(e.t_bar)) > 0
  );
  // t_coz e t_bar estão em segundos, converter para minutos
  const tmCoz = diasComTempo.length > 0 ? (sum(diasComTempo, 't_coz') / diasComTempo.length) / 60 : 0;
  const tmBar = diasComTempo.length > 0 ? (sum(diasComTempo, 't_bar') / diasComTempo.length) / 60 : 0;

  const diasFat19 = diasComFaturamento.filter((e) => parseFloat(String(e.fat_19h_percent)) > 0);
  const percFat19 = diasFat19.length > 0 ? sum(diasFat19, 'fat_19h_percent') / diasFat19.length : 0;

  // Mix de vendas: média ponderada pelo faturamento
  const somaPercentBPonderado = diasComFaturamento.reduce((acc, e) => {
    const fat = parseFloat(String(e.real_r)) || 0;
    const perc = parseFloat(String(e.percent_b)) || 0;
    return acc + (perc * fat);
  }, 0);
  const somaPercentDPonderado = diasComFaturamento.reduce((acc, e) => {
    const fat = parseFloat(String(e.real_r)) || 0;
    const perc = parseFloat(String(e.percent_d)) || 0;
    return acc + (perc * fat);
  }, 0);
  const somaPercentCPonderado = diasComFaturamento.reduce((acc, e) => {
    const fat = parseFloat(String(e.real_r)) || 0;
    const perc = parseFloat(String(e.percent_c)) || 0;
    return acc + (perc * fat);
  }, 0);

  return {
    faturamento_total: faturamentoTotal,
    faturamento_entrada: sum(diasComFaturamento, 'faturamento_couvert'),
    faturamento_bar: sum(diasComFaturamento, 'faturamento_bar'),
    clientes_atendidos: clientesTotal,
    ticket_medio: clientesTotal > 0 ? faturamentoTotal / clientesTotal : 0,
    perc_bebidas: faturamentoTotal > 0 ? somaPercentBPonderado / faturamentoTotal : 0,
    perc_drinks: faturamentoTotal > 0 ? somaPercentDPonderado / faturamentoTotal : 0,
    perc_comida: faturamentoTotal > 0 ? somaPercentCPonderado / faturamentoTotal : 0,
    tempo_saida_cozinha: tmCoz,
    tempo_saida_bar: tmBar,
    perc_faturamento_ate_19h: percFat19,
    ...agregarStockoutCategoriaMix(stockoutRows),
  };
}

function agregarStockoutCategoriaMix(stockoutRows: ContahubStockoutMixRow[]) {
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

function agregarDadosSemanaisProporcionais(
  semanasComProporcao: SemanaProporcaoMes[],
  desempenhoMap: Map<string, DesempenhoSemanalDbRow>,
  _marketingMap: Map<string, MarketingSemanalRow>
) {
  const sumProp = (map: Map<string, DesempenhoSemanalDbRow>, campo: string) => {
    let soma = 0;
    for (const s of semanasComProporcao) {
      const dados = map.get(`${s.anoISO}-${s.semana}`);
      if (dados && dados[campo]) soma += (parseFloat(String(dados[campo])) || 0) * s.proporcao;
    }
    return soma;
  };

  const avgProp = (map: Map<string, DesempenhoSemanalDbRow>, campo: string) => {
    let soma = 0, peso = 0;
    for (const s of semanasComProporcao) {
      const dados = map.get(`${s.anoISO}-${s.semana}`);
      if (dados && dados[campo]) {
        soma += (parseFloat(String(dados[campo])) || 0) * s.proporcao;
        peso += s.proporcao;
      }
    }
    return peso > 0 ? soma / peso : 0;
  };

  // Calcular quebra de reservas corretamente (igual à API route)
  // reservas_totais e reservas_presentes no banco = pessoas (não mesas)
  const pessoasReservasTotal = Math.round(sumProp(desempenhoMap, 'reservas_totais'));
  const pessoasReservasPresentes = Math.round(sumProp(desempenhoMap, 'reservas_presentes'));
  const quebraReservasCalc = pessoasReservasTotal > 0 
    ? ((pessoasReservasTotal - pessoasReservasPresentes) / pessoasReservasTotal) * 100 
    : 0;

  return {
    // CMV
    cmv_rs: sumProp(desempenhoMap, 'cmv_rs'),
    cmv_limpo: avgProp(desempenhoMap, 'cmv_limpo'),
    cmv_global_real: avgProp(desempenhoMap, 'cmv_global_real'),
    cmv_teorico: avgProp(desempenhoMap, 'cmv_teorico'),
    
    // Custos
    cmo: avgProp(desempenhoMap, 'cmo'),
    cmo_custo: sumProp(desempenhoMap, 'cmo_custo'),
    custo_atracao_faturamento: avgProp(desempenhoMap, 'custo_atracao_faturamento'),
    
    // Clientes (clientes_ativos é calculado via RPC, os demais são soma proporcional)
    // Nota: clientes_ativos é sobrescrito no retorno da função com valor da RPC get_count_base_ativa
    clientes_30d: Math.round(sumProp(desempenhoMap, 'clientes_30d')),
    clientes_60d: Math.round(sumProp(desempenhoMap, 'clientes_60d')),
    clientes_90d: Math.round(sumProp(desempenhoMap, 'clientes_90d')),
    retencao_1m: avgProp(desempenhoMap, 'retencao_1m'),
    retencao_2m: avgProp(desempenhoMap, 'retencao_2m'),
    perc_clientes_novos: avgProp(desempenhoMap, 'perc_clientes_novos'),
    
    // Reservas (números absolutos - soma arredondada)
    // reservas_totais/reservas_presentes = PESSOAS
    // mesas_totais/mesas_presentes = MESAS (COUNT de reservas)
    reservas_totais: pessoasReservasTotal,
    reservas_presentes: pessoasReservasPresentes,
    mesas_totais: Math.round(sumProp(desempenhoMap, 'mesas_totais')),
    mesas_presentes: Math.round(sumProp(desempenhoMap, 'mesas_presentes')),
    // Quebra de reservas = (Pessoas Total - Pessoas Presentes) / Pessoas Total × 100
    quebra_reservas: quebraReservasCalc,
    
    // Qualidade (avaliações são números absolutos - soma arredondada, NPS são médias arredondadas)
    avaliacoes_5_google_trip: Math.round(sumProp(desempenhoMap, 'avaliacoes_5_google_trip')),
    media_avaliacoes_google: Math.round(avgProp(desempenhoMap, 'media_avaliacoes_google') * 100) / 100,
    nps_geral: Math.round(avgProp(desempenhoMap, 'nps_geral')),
    nps_reservas: Math.round(avgProp(desempenhoMap, 'nps_reservas')),
    nps_digital: Math.round(avgProp(desempenhoMap, 'nps_digital')),
    nps_salao: Math.round(avgProp(desempenhoMap, 'nps_salao')),
    nps_digital_respostas: Math.round(sumProp(desempenhoMap, 'nps_digital_respostas')),
    nps_salao_respostas: Math.round(sumProp(desempenhoMap, 'nps_salao_respostas')),
    nps_reservas_respostas: Math.round(sumProp(desempenhoMap, 'nps_reservas_respostas')),
    nota_felicidade_equipe: Math.round(avgProp(desempenhoMap, 'nota_felicidade_equipe') * 100) / 100,
    
    // Vendas
    perc_happy_hour: avgProp(desempenhoMap, 'perc_happy_hour'),
    perc_faturamento_apos_22h: avgProp(desempenhoMap, 'perc_faturamento_apos_22h'),
    qui_sab_dom: sumProp(desempenhoMap, 'qui_sab_dom'),
    cancelamentos: sumProp(desempenhoMap, 'cancelamentos'),
    // Nota: conta_assinada e descontos são calculados diretamente de faturamento_pagamentos e visitas
    
    // Stockout mensal agora vem do contahub_stockout (categoria_mix) no bloco diário
    
    // Atrasos (quantidades são soma arredondada, percentuais são média)
    qtde_itens_bar: Math.round(sumProp(desempenhoMap, 'qtde_itens_bar')),
    atrasinhos_bar: Math.round(sumProp(desempenhoMap, 'atrasinhos_bar')),
    atrasinhos_bar_perc: Math.round(avgProp(desempenhoMap, 'atrasinhos_bar_perc') * 10) / 10,
    atrasinhos_cozinha: Math.round(sumProp(desempenhoMap, 'atrasinhos_cozinha')),
    atrasinhos_cozinha_perc: Math.round(avgProp(desempenhoMap, 'atrasinhos_cozinha_perc') * 10) / 10,
    atraso_bar: Math.round(sumProp(desempenhoMap, 'atraso_bar')),
    atraso_cozinha: Math.round(sumProp(desempenhoMap, 'atraso_cozinha')),
    atrasos_bar: Math.round(sumProp(desempenhoMap, 'atrasos_bar')),
    atrasos_bar_perc: Math.round(avgProp(desempenhoMap, 'atrasos_bar_perc') * 10) / 10,
    qtde_itens_cozinha: Math.round(sumProp(desempenhoMap, 'qtde_itens_cozinha')),
    atrasos_cozinha: Math.round(sumProp(desempenhoMap, 'atrasos_cozinha')),
    atrasos_cozinha_perc: Math.round(avgProp(desempenhoMap, 'atrasos_cozinha_perc') * 10) / 10,
    
    // Ticket Médio (médias)
    tm_entrada: avgProp(desempenhoMap, 'tm_entrada'),
    tm_bar: avgProp(desempenhoMap, 'tm_bar'),
    
    // Faturamento CMVível
    faturamento_cmovivel: sumProp(desempenhoMap, 'faturamento_cmovivel'),
    
    // Vendas extras
    venda_balcao: sumProp(desempenhoMap, 'venda_balcao'),
    couvert_atracoes: sumProp(desempenhoMap, 'couvert_atracoes'),
    
    // Marketing Orgânico - ZERADO (preenchimento manual no mensal)
    o_num_posts: 0,
    o_alcance: 0,
    o_interacao: 0,
    o_compartilhamento: 0,
    o_engajamento: 0,
    o_num_stories: 0,
    o_visu_stories: 0,
    
    // Marketing Pago - Meta - ZERADO (preenchimento manual no mensal)
    m_valor_investido: 0,
    m_alcance: 0,
    m_frequencia: 0,
    m_cpm: 0,
    m_cliques: 0,
    m_ctr: 0,
    m_custo_por_clique: 0,
    m_conversas_iniciadas: 0,
    
    // Google Ads - ZERADO (preenchimento manual no mensal)
    g_valor_investido: 0,
    g_impressoes: 0,
    g_cliques: 0,
    g_ctr: 0,
    g_solicitacoes_rotas: 0,
    
    // GMN - ZERADO (preenchimento manual no mensal)
    gmn_total_acoes: 0,
    gmn_total_visualizacoes: 0,
    gmn_solicitacoes_rotas: 0,
    
    // Gestão Produção
    quebra_utensilios: sumProp(desempenhoMap, 'quebra_utensilios'),
    bonificacoes_contratos: sumProp(desempenhoMap, 'bonificacoes_contratos'),
    nota_producao_bar: avgProp(desempenhoMap, 'nota_producao_bar'),
    nota_producao_cozinha: avgProp(desempenhoMap, 'nota_producao_cozinha'),
    perc_checklist_producao: avgProp(desempenhoMap, 'perc_checklist_producao'),
    desvio_semana: sumProp(desempenhoMap, 'desvio_semana'),
    
    // Gestão RH
    quorum_pesquisa_felicidade: avgProp(desempenhoMap, 'quorum_pesquisa_felicidade'),
    vagas_abertas: Math.round(avgProp(desempenhoMap, 'vagas_abertas')),
    num_testes_ps: sumProp(desempenhoMap, 'num_testes_ps'),
    perc_comparecimento_ps: avgProp(desempenhoMap, 'perc_comparecimento_ps'),
    aprovados_ps: sumProp(desempenhoMap, 'aprovados_ps'),
    perc_checklist_rh: avgProp(desempenhoMap, 'perc_checklist_rh'),
    absenteismo: avgProp(desempenhoMap, 'absenteismo'),
    
    // Gestão Financeiro
    num_lancamentos_vencidos: sumProp(desempenhoMap, 'num_lancamentos_vencidos'),
    conciliacoes_pendentes: sumProp(desempenhoMap, 'conciliacoes_pendentes'),
    erros_pente_fino: sumProp(desempenhoMap, 'erros_pente_fino'),
    lancamentos_atrasados: sumProp(desempenhoMap, 'lancamentos_atrasados'),
    perc_checklist_semanal_terca: avgProp(desempenhoMap, 'perc_checklist_semanal_terca'),
  };
}
