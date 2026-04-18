import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

// Cache por 2 minutos para dados mensais de desempenho
export const revalidate = 120;

// =====================================================
// ONDA 2B: Buscar categorias de atração do banco
// SEM FALLBACK: Se não encontrar, retornar erro 500
// =====================================================
async function getCategoriasAtracao(supabase: any, barId: number): Promise<string[] | null> {
  const { data, error } = await supabase
    .from('bar_categorias_custo')
    .select('nome_categoria')
    .eq('bar_id', barId)
    .eq('tipo', 'atracao')
    .eq('ativo', true);
  
  if (error || !data || data.length === 0) {
    console.error(`❌ [ERRO CONFIG] Categorias de atração não encontradas para bar ${barId}. Configure bar_categorias_custo.`);
    return null;
  }
  
  const categorias = data.map((d: { nome_categoria: string }) => d.nome_categoria);
  return categorias;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getAdminClient();
    
    // Obter parâmetros
    const { searchParams } = new URL(request.url);
    const mes = parseInt(searchParams.get('mes') || (new Date().getMonth() + 1).toString());
    const ano = parseInt(searchParams.get('ano') || new Date().getFullYear().toString());
    
    // Obter bar_id do header x-selected-bar-id
    const barIdHeader = request.headers.get('x-selected-bar-id');
    const barId = barIdHeader ? parseInt(barIdHeader, 10) : null;
    
    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
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

    // Stockout mensal via view filtrada (mesma lógica do semanal)
    const { data: stockoutMensal, error: stockoutError } = await supabase
      .schema('gold')
      .from('gold_contahub_operacional_stockout_filtrado')
      .select('categoria_local, prd_venda')
      .eq('bar_id', barId)
      .gte('data_consulta', dataInicio)
      .lte('data_consulta', dataFim);

    if (stockoutError) {
      console.error('Erro ao buscar stockout mensal:', stockoutError);
    }

    // Mix de vendas mensal direto do ContaHub (mais preciso que eventos_base)
    const { data: mixMensal, error: mixError } = await supabase
      .rpc('calcular_mix_vendas', {
        p_bar_id: barId,
        p_data_inicio: dataInicio,
        p_data_fim: dataFim
      });

    if (mixError) {
      console.error('Erro ao buscar mix de vendas mensal:', mixError);
    }

    // Couvert mensal - soma dia a dia de visitas
    const { data: couvertRows, error: couvertError } = await supabase
      .from('visitas')
      .select('valor_couvert')
      .eq('bar_id', barId)
      .gte('data_visita', dataInicio)
      .lte('data_visita', dataFim);

    if (couvertError) {
      console.error('Erro ao buscar couvert mensal:', couvertError);
    }

    // Cancelamentos mensal - soma dia a dia de bronze.bronze_contahub_avendas_cancelamentos
    const { data: cancelamentosRows, error: cancelError } = await supabase
      .schema('bronze' as never)
      .from('bronze_contahub_avendas_cancelamentos')
      .select('custototal')
      .eq('bar_id', barId)
      .gte('dt_gerencial', dataInicio)
      .lte('dt_gerencial', dataFim);

    if (cancelError) {
      console.error('Erro ao buscar cancelamentos mensal:', cancelError);
    }

    // Atrações/Eventos mensal - soma de contaazul_lancamentos (antes nibo_agendamentos) (mesma lógica do semanal)
    // ONDA 2B: Buscar categorias do banco - erro se não configurado
    const categoriasAtracao = await getCategoriasAtracao(supabase, barId);
    if (!categoriasAtracao) {
      return NextResponse.json(
        { error: `Configuração ausente: categorias de atração para bar ${barId}. Configure bar_categorias_custo.` },
        { status: 500 }
      );
    }
    const { data: atracaoRows, error: atracaoError } = await supabase
      .from('lancamentos_financeiros')
      .select('valor')
      .eq('bar_id', barId)
      .eq('tipo', 'DESPESA')
      .in('categoria', categoriasAtracao)
      .gte('data_competencia', dataInicio)
      .lte('data_competencia', dataFim);

    if (atracaoError) {
      console.error('Erro ao buscar atrações Conta Azul mensal:', atracaoError);
    }

    const atracoesEventos = (atracaoRows || []).reduce((sum, r) => sum + (parseFloat(r.valor) || 0), 0);
    const couvertAtracoes = (couvertRows || []).reduce((sum, r) => sum + (parseFloat(r.valor_couvert) || 0), 0);
    const cancelamentos = (cancelamentosRows || []).reduce((sum, r) => sum + (parseFloat(r.custototal) || 0), 0);

    // Agregar dados diários + stockout + mix + vendas (tudo soma dia a dia, sem proporção)
    const dadosDiarios = agregarDadosDiarios(
      eventosDiarios || [],
      stockoutMensal || [],
      mixMensal?.[0] || null,
      { couvertAtracoes, cancelamentos, atracoesEventos }
    );

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

// Extras opcionais: couvert, cancelamentos, atrações (soma dia a dia)
type ExtrasDiarios = { couvertAtracoes: number; cancelamentos: number; atracoesEventos: number };

// Agregar dados diários de eventos_base
function agregarDadosDiarios(
  eventos: any[],
  stockoutRows: any[],
  mixContahub: any,
  extras?: ExtrasDiarios
): any {
  if (!eventos || eventos.length === 0) {
    return extras ? {
      qui_sab_dom: 0,
      ter_qua_qui: 0,
      sex_sab: 0,
      couvert_atracoes: extras.couvertAtracoes,
      cancelamentos: extras.cancelamentos,
      atracoes_eventos: extras.atracoesEventos,
    } : {};
  }

  // Filtrar dias com faturamento real
  const diasComFaturamento = eventos.filter(e => parseFloat(e.real_r) > 0);
  const n = diasComFaturamento.length;

  // Faturamento por dia da semana (soma dia a dia - mesma lógica da Edge Function)
  // Ordinário: Qui(4), Sab(6), Dom(0) | Deboche: Ter(2), Qua(3), Qui(4) e Sex(5), Sab(6)
  let quiSabDom = 0;
  let terQuaQui = 0;
  let sexSab = 0;
  for (const e of eventos) {
    const dataEvento = e.data_evento;
    if (!dataEvento) continue;
    const d = new Date(dataEvento + 'T12:00:00Z');
    const dia = d.getUTCDay(); // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
    const valor = parseFloat(e.real_r) || 0;
    if (dia === 4 || dia === 6 || dia === 0) quiSabDom += valor;
    if (dia === 2 || dia === 3 || dia === 4) terQuaQui += valor;
    if (dia === 5 || dia === 6) sexSab += valor;
  }

  if (n === 0) {
    return {
      faturamento_total: 0,
      clientes_atendidos: 0,
      ticket_medio: 0,
      perc_bebidas: 0,
      perc_drinks: 0,
      perc_comida: 0,
      qui_sab_dom: quiSabDom,
      ter_qua_qui: terQuaQui,
      sex_sab: sexSab,
      ...(extras && {
        couvert_atracoes: extras.couvertAtracoes,
        cancelamentos: extras.cancelamentos,
        atracoes_eventos: extras.atracoesEventos,
      }),
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

    // $ Vendas por dia da semana (soma dia a dia, sem proporção)
    qui_sab_dom: quiSabDom,
    ter_qua_qui: terQuaQui,
    sex_sab: sexSab,

    // Clientes
    clientes_atendidos: clientesTotal,

    // Ticket médio (faturamento / clientes)
    ticket_medio: clientesTotal > 0 ? faturamentoTotal / clientesTotal : 0,

    // Mix de vendas - usar direto do ContaHub (stored procedure) se disponível
    perc_bebidas: mixContahub?.perc_bebidas ?? 0,
    perc_drinks: mixContahub?.perc_drinks ?? 0,
    perc_comida: mixContahub?.perc_comidas ?? 0,
    perc_happy_hour: mixContahub?.perc_happy_hour ?? 0,

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

    // Couvert, cancelamentos, atrações (soma dia a dia)
    ...(extras && {
      couvert_atracoes: extras.couvertAtracoes,
      cancelamentos: extras.cancelamentos,
      atracoes_eventos: extras.atracoesEventos,
    }),

    ...agregarStockoutCategoriaLocal(stockoutRows),
  };
}

function agregarStockoutCategoriaLocal(stockoutRows: any[]) {
  const totalBar = stockoutRows.filter(r => r.categoria_local === 'Bar').length;
  const totalDrinks = stockoutRows.filter(r => r.categoria_local === 'Drinks').length;
  const totalComidas = stockoutRows.filter(r => r.categoria_local === 'Comidas').length;

  const soBar = stockoutRows.filter(r => r.categoria_local === 'Bar' && r.prd_venda === 'N').length;
  const soDrinks = stockoutRows.filter(r => r.categoria_local === 'Drinks' && r.prd_venda === 'N').length;
  const soComidas = stockoutRows.filter(r => r.categoria_local === 'Comidas' && r.prd_venda === 'N').length;

  const totalItens = totalBar + totalDrinks + totalComidas;
  const totalStockout = soBar + soDrinks + soComidas;

  return {
    stockout_bar: soBar,
    stockout_drinks: soDrinks,
    stockout_comidas: soComidas,
    stockout_bar_perc: totalBar > 0 ? (soBar / totalBar) * 100 : 0,
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
