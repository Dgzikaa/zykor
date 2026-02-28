import { SupabaseClient } from '@supabase/supabase-js';
import { DadosSemana } from '../types';

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
  const { data: eventosDiarios } = await supabase
    .from('eventos_base')
    .select('data_evento, real_r, cl_real, t_medio, percent_b, percent_d, percent_c, res_tot, res_p, t_coz, t_bar, fat_19h_percent, faturamento_couvert, faturamento_bar')
    .eq('bar_id', barId)
    .gte('data_evento', dataInicio)
    .lte('data_evento', dataFim);

  const dadosDiarios = agregarDadosDiarios(eventosDiarios || []);

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

  // 3. Buscar Conta Assinada (de contahub_pagamentos)
  const contaAssinadaPromise = supabase
    .from('contahub_pagamentos')
    .select('dt_gerencial, valor')
    .eq('bar_id', barId)
    .eq('meio', 'Conta Assinada')
    .gte('dt_gerencial', dataInicio)
    .lte('dt_gerencial', dataFim);

  // 4. Buscar Descontos (de contahub_periodo)
  const descontosPromise = supabase
    .from('contahub_periodo')
    .select('dt_gerencial, vr_desconto, motivo')
    .eq('bar_id', barId)
    .gt('vr_desconto', 0)
    .gte('dt_gerencial', dataInicio)
    .lte('dt_gerencial', dataFim);

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

  // 6. NPS Falaê: buscar respostas do mês
  const falaeNpsPromise = supabase
    .from('falae_respostas')
    .select('nps')
    .eq('bar_id', barId)
    .gte('created_at', dataInicio)
    .lte('created_at', dataFim + 'T23:59:59');

  const [desempenhoResults, marketingResults, contaAssinadaResult, descontosResult, clientesAtivosResult, falaeNpsResult] = await Promise.all([
    Promise.all(desempenhoPromises),
    Promise.all(marketingPromises),
    contaAssinadaPromise,
    descontosPromise,
    clientesAtivosPromise,
    falaeNpsPromise
  ]);

  const desempenhoData = desempenhoResults.flatMap(r => r.data || []);
  const marketingData = marketingResults.flatMap(r => r.data || []);

  const desempenhoMap = new Map<string, any>();
  desempenhoData.forEach(d => desempenhoMap.set(`${d.ano}-${d.numero_semana}`, d));
  
  const marketingMap = new Map<string, any>();
  marketingData.forEach(m => marketingMap.set(`${m.ano}-${m.semana}`, m));

  // Calcular Conta Assinada total do mês
  const contaAssinadaValor = (contaAssinadaResult.data || []).reduce(
    (sum, p) => sum + (Number(p.valor) || 0), 0
  );

  // Calcular Descontos total do mês
  const descontosValor = (descontosResult.data || []).reduce(
    (sum, d) => sum + (Number(d.vr_desconto) || 0), 0
  );

  // Clientes Ativos: número calculado pela RPC (clientes com 2+ visitas nos últimos 90 dias até o último dia do mês)
  const clientesAtivos = clientesAtivosResult.error ? 0 : Number(clientesAtivosResult.data) || 0;

  // NPS Falaê: calcular score do mês
  const falaeRespostas = falaeNpsResult.data || [];
  let falaeNpsScore: number | null = null;
  let falaeNpsMedia: number | null = null;
  if (falaeRespostas.length > 0) {
    const promotores = falaeRespostas.filter(r => r.nps >= 9).length;
    const detratores = falaeRespostas.filter(r => r.nps <= 6).length;
    const total = falaeRespostas.length;
    falaeNpsScore = Math.round(((promotores - detratores) / total) * 100);
    falaeNpsMedia = Math.round((falaeRespostas.reduce((acc, r) => acc + r.nps, 0) / total) * 10) / 10;
  }

  const dadosSemanais = agregarDadosSemanaisProporcionais(semanasComProporcao, desempenhoMap, marketingMap);

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
    falae_respostas_total: falaeRespostas.length,
  } as unknown as DadosSemana;
}

// Helpers copiados de route.ts
function calcularSemanasComProporcao(mes: number, ano: number) {
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

function agregarDadosDiarios(eventos: any[]) {
  if (!eventos || eventos.length === 0) return {};
  
  const diasComFaturamento = eventos.filter(e => parseFloat(e.real_r) > 0);
  const n = diasComFaturamento.length;

  if (n === 0) return { faturamento_total: 0, clientes_atendidos: 0 };

  const sum = (arr: any[], key: string) => arr.reduce((acc, e) => acc + (parseFloat(e[key]) || 0), 0);
  const sumInt = (arr: any[], key: string) => arr.reduce((acc, e) => acc + (parseInt(e[key]) || 0), 0);

  const faturamentoTotal = sum(diasComFaturamento, 'real_r');
  const clientesTotal = sumInt(diasComFaturamento, 'cl_real');
  
  const diasComTempo = diasComFaturamento.filter(e => parseFloat(e.t_coz) > 0 || parseFloat(e.t_bar) > 0);
  const tmCoz = diasComTempo.length > 0 ? sum(diasComTempo, 't_coz') / diasComTempo.length : 0;
  const tmBar = diasComTempo.length > 0 ? sum(diasComTempo, 't_bar') / diasComTempo.length : 0;

  const diasFat19 = diasComFaturamento.filter(e => parseFloat(e.fat_19h_percent) > 0);
  const percFat19 = diasFat19.length > 0 ? sum(diasFat19, 'fat_19h_percent') / diasFat19.length : 0;

  // Mix de vendas: média ponderada pelo faturamento
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

  return {
    faturamento_total: faturamentoTotal,
    faturamento_entrada: sum(diasComFaturamento, 'faturamento_couvert'),
    faturamento_bar: sum(diasComFaturamento, 'faturamento_bar'),
    clientes_atendidos: clientesTotal,
    ticket_medio: clientesTotal > 0 ? faturamentoTotal / clientesTotal : 0,
    perc_bebidas: faturamentoTotal > 0 ? somaPercentBPonderado / faturamentoTotal : 0,
    perc_drinks: faturamentoTotal > 0 ? somaPercentDPonderado / faturamentoTotal : 0,
    perc_comida: faturamentoTotal > 0 ? somaPercentCPonderado / faturamentoTotal : 0,
    reservas_totais: sumInt(eventos, 'res_tot'),
    reservas_presentes: sumInt(eventos, 'res_p'),
    tempo_saida_cozinha: tmCoz,
    tempo_saida_bar: tmBar,
    perc_faturamento_ate_19h: percFat19,
  };
}

function agregarDadosSemanaisProporcionais(
  semanasComProporcao: any[],
  desempenhoMap: Map<string, any>,
  marketingMap: Map<string, any>
) {
  const sumProp = (map: Map<string, any>, campo: string) => {
    let soma = 0;
    for (const s of semanasComProporcao) {
      const dados = map.get(`${s.anoISO}-${s.semana}`);
      if (dados && dados[campo]) soma += (parseFloat(dados[campo]) || 0) * s.proporcao;
    }
    return soma;
  };

  const avgProp = (map: Map<string, any>, campo: string) => {
    let soma = 0, peso = 0;
    for (const s of semanasComProporcao) {
      const dados = map.get(`${s.anoISO}-${s.semana}`);
      if (dados && dados[campo]) {
        soma += (parseFloat(dados[campo]) || 0) * s.proporcao;
        peso += s.proporcao;
      }
    }
    return peso > 0 ? soma / peso : 0;
  };

  // Calcular quebra de reservas corretamente (igual à API route)
  const pessoasReservasTotal = Math.round(sumProp(desempenhoMap, 'pessoas_reservas_totais'));
  const pessoasReservasPresentes = Math.round(sumProp(desempenhoMap, 'pessoas_reservas_presentes'));
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
    reservas_totais_semanal: Math.round(sumProp(desempenhoMap, 'reservas_totais')),
    reservas_presentes_semanal: Math.round(sumProp(desempenhoMap, 'reservas_presentes')),
    pessoas_reservas_totais: pessoasReservasTotal,
    pessoas_reservas_presentes: pessoasReservasPresentes,
    // Quebra de reservas = (Pessoas Total - Pessoas Presentes) / Pessoas Total × 100
    quebra_reservas: quebraReservasCalc,
    
    // Qualidade (avaliações são números absolutos - soma arredondada, NPS são médias arredondadas)
    avaliacoes_5_google_trip: Math.round(sumProp(desempenhoMap, 'avaliacoes_5_google_trip')),
    media_avaliacoes_google: Math.round(avgProp(desempenhoMap, 'media_avaliacoes_google') * 100) / 100,
    nps_geral: Math.round(avgProp(desempenhoMap, 'nps_geral')),
    nps_reservas: Math.round(avgProp(desempenhoMap, 'nps_reservas')),
    nota_felicidade_equipe: Math.round(avgProp(desempenhoMap, 'nota_felicidade_equipe') * 100) / 100,
    
    // Vendas
    perc_happy_hour: avgProp(desempenhoMap, 'perc_happy_hour'),
    perc_faturamento_apos_22h: avgProp(desempenhoMap, 'perc_faturamento_apos_22h'),
    qui_sab_dom: sumProp(desempenhoMap, 'qui_sab_dom'),
    cancelamentos: sumProp(desempenhoMap, 'cancelamentos'),
    // Nota: conta_assinada e descontos são calculados diretamente de contahub_pagamentos e contahub_periodo
    
    // Stockout (quantidades arredondadas, percentuais com 1 casa decimal)
    stockout_comidas: Math.round(sumProp(desempenhoMap, 'stockout_comidas')),
    stockout_comidas_perc: Math.round(avgProp(desempenhoMap, 'stockout_comidas_perc') * 10) / 10,
    stockout_drinks: Math.round(sumProp(desempenhoMap, 'stockout_drinks')),
    stockout_drinks_perc: Math.round(avgProp(desempenhoMap, 'stockout_drinks_perc') * 10) / 10,
    stockout_bar: Math.round(sumProp(desempenhoMap, 'stockout_bar')),
    stockout_bar_perc: Math.round(avgProp(desempenhoMap, 'stockout_bar_perc') * 10) / 10,
    
    // Atrasos (quantidades são soma arredondada, percentuais são média)
    qtde_itens_bar: Math.round(sumProp(desempenhoMap, 'qtde_itens_bar')),
    atrasinhos_bar: Math.round(sumProp(desempenhoMap, 'atrasinhos_bar')),
    atrasinhos_cozinha: Math.round(sumProp(desempenhoMap, 'atrasinhos_cozinha')),
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
    
    // Marketing Orgânico
    o_num_posts: sumProp(marketingMap, 'o_num_posts'),
    o_alcance: sumProp(marketingMap, 'o_alcance'),
    o_interacao: sumProp(marketingMap, 'o_interacao'),
    o_compartilhamento: sumProp(marketingMap, 'o_compartilhamento'),
    o_engajamento: avgProp(marketingMap, 'o_engajamento'),
    o_num_stories: sumProp(marketingMap, 'o_num_stories'),
    o_visu_stories: sumProp(marketingMap, 'o_visu_stories'),
    
    // Marketing Pago - Meta
    m_valor_investido: sumProp(marketingMap, 'm_valor_investido'),
    m_alcance: sumProp(marketingMap, 'm_alcance'),
    m_frequencia: avgProp(marketingMap, 'm_frequencia'),
    m_cpm: avgProp(marketingMap, 'm_cpm'),
    m_cliques: sumProp(marketingMap, 'm_cliques'),
    m_ctr: avgProp(marketingMap, 'm_ctr'),
    m_custo_por_clique: avgProp(marketingMap, 'm_cpc'),
    m_conversas_iniciadas: sumProp(marketingMap, 'm_conversas_iniciadas'),
    
    // Google Ads
    g_valor_investido: sumProp(marketingMap, 'g_valor_investido'),
    g_impressoes: sumProp(marketingMap, 'g_impressoes'),
    g_cliques: sumProp(marketingMap, 'g_cliques'),
    g_ctr: avgProp(marketingMap, 'g_ctr'),
    g_solicitacoes_rotas: sumProp(marketingMap, 'g_solicitacoes_rotas'),
    
    // GMN
    gmn_total_acoes: sumProp(marketingMap, 'gmn_total_acoes'),
    gmn_total_visualizacoes: sumProp(marketingMap, 'gmn_total_visualizacoes'),
    gmn_solicitacoes_rotas: sumProp(marketingMap, 'gmn_solicitacoes_rotas'),
    
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
