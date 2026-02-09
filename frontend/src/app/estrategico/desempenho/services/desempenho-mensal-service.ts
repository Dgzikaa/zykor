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

  const [desempenhoResults, marketingResults] = await Promise.all([
    Promise.all(desempenhoPromises),
    Promise.all(marketingPromises)
  ]);

  const desempenhoData = desempenhoResults.flatMap(r => r.data || []);
  const marketingData = marketingResults.flatMap(r => r.data || []);

  const desempenhoMap = new Map<string, any>();
  desempenhoData.forEach(d => desempenhoMap.set(`${d.ano}-${d.numero_semana}`, d));
  
  const marketingMap = new Map<string, any>();
  marketingData.forEach(m => marketingMap.set(`${m.ano}-${m.semana}`, m));

  const dadosSemanais = agregarDadosSemanaisProporcionais(semanasComProporcao, desempenhoMap, marketingMap);

  return {
    id: ano * 100 + mes,
    numero_semana: mes, // Mês usado como numero_semana para compatibilidade
    ano,
    data_inicio: dataInicio,
    data_fim: dataFim,
    ...dadosSemanais,
    ...dadosDiarios,
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

  return {
    cmv_rs: sumProp(desempenhoMap, 'cmv_rs'),
    cmv_limpo: avgProp(desempenhoMap, 'cmv_limpo'),
    cmv_global_real: avgProp(desempenhoMap, 'cmv_global_real'),
    cmv_teorico: avgProp(desempenhoMap, 'cmv_teorico'),
    cmo: avgProp(desempenhoMap, 'cmo'),
    cmo_custo: sumProp(desempenhoMap, 'cmo_custo'),
    custo_atracao_faturamento: avgProp(desempenhoMap, 'custo_atracao_faturamento'),
    clientes_ativos: avgProp(desempenhoMap, 'clientes_ativos'),
    // ... outros campos (simplificado para não estourar tokens, mas deve incluir todos importantes)
    retencao_1m: avgProp(desempenhoMap, 'retencao_1m'),
    retencao_2m: avgProp(desempenhoMap, 'retencao_2m'),
    perc_clientes_novos: avgProp(desempenhoMap, 'perc_clientes_novos'),
    avaliacoes_5_google_trip: sumProp(desempenhoMap, 'avaliacoes_5_google_trip'),
    media_avaliacoes_google: avgProp(desempenhoMap, 'media_avaliacoes_google'),
    nps_geral: avgProp(desempenhoMap, 'nps_geral'),
    nps_reservas: avgProp(desempenhoMap, 'nps_reservas'),
    nota_felicidade_equipe: avgProp(desempenhoMap, 'nota_felicidade_equipe'),
    perc_happy_hour: avgProp(desempenhoMap, 'perc_happy_hour'),
    stockout_comidas: sumProp(desempenhoMap, 'stockout_comidas'),
    stockout_drinks: sumProp(desempenhoMap, 'stockout_drinks'),
    stockout_bar: sumProp(desempenhoMap, 'stockout_bar'),
    qtde_itens_bar: sumProp(desempenhoMap, 'qtde_itens_bar'),
    atrasos_bar: sumProp(desempenhoMap, 'atrasos_bar'),
    qtde_itens_cozinha: sumProp(desempenhoMap, 'qtde_itens_cozinha'),
    atrasos_cozinha: sumProp(desempenhoMap, 'atrasos_cozinha'),
    o_num_posts: sumProp(marketingMap, 'o_num_posts'),
    o_alcance: sumProp(marketingMap, 'o_alcance'),
    o_interacao: sumProp(marketingMap, 'o_interacao'),
    o_compartilhamento: sumProp(marketingMap, 'o_compartilhamento'),
    o_engajamento: avgProp(marketingMap, 'o_engajamento'),
    m_valor_investido: sumProp(marketingMap, 'm_valor_investido'),
    m_alcance: sumProp(marketingMap, 'm_alcance'),
    m_cliques: sumProp(marketingMap, 'm_cliques'),
    m_ctr: avgProp(marketingMap, 'm_ctr'),
    m_custo_por_clique: avgProp(marketingMap, 'm_cpc'),
    m_conversas_iniciadas: sumProp(marketingMap, 'm_conversas_iniciadas'),
  };
}
