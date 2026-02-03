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

    // Calcular quais semanas pertencem ao mês (considerando ano ISO)
    const semanasDoMes = calcularSemanasDoMesComAno(mes, ano);
    
    // Agrupar semanas por ano para fazer queries eficientes
    const semanasPorAno: Record<number, number[]> = {};
    for (const { semana, anoISO } of semanasDoMes) {
      if (!semanasPorAno[anoISO]) semanasPorAno[anoISO] = [];
      semanasPorAno[anoISO].push(semana);
    }

    // Buscar dados de todas as semanas do mês (considerando múltiplos anos)
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

    // Combinar resultados de múltiplos anos
    const desempenhoData = desempenhoResults.flatMap(r => r.data || []);
    const marketingData = marketingResults.flatMap(r => r.data || []);
    
    const desempenhoResult = { data: desempenhoData, error: desempenhoResults.find(r => r.error)?.error };

    if (desempenhoResult.error) {
      console.error('Erro ao buscar dados mensais:', desempenhoResult.error);
      return NextResponse.json({ error: desempenhoResult.error.message }, { status: 500 });
    }

    // Mesclar dados de desempenho com marketing por semana
    const semanasData = mesclarDadosMarketing(desempenhoData, marketingData);

    // Agregar os dados
    const dadosMensais = agregarDadosMensais(semanasData);

    // Buscar dados do mês anterior para comparação
    let mesAnterior = mes - 1;
    let anoAnterior = ano;
    if (mesAnterior < 1) {
      mesAnterior = 12;
      anoAnterior = ano - 1;
    }

    const semanasMesAnteriorComAno = calcularSemanasDoMesComAno(mesAnterior, anoAnterior);
    
    // Agrupar semanas do mês anterior por ano
    const semanasAnteriorPorAno: Record<number, number[]> = {};
    for (const { semana, anoISO } of semanasMesAnteriorComAno) {
      if (!semanasAnteriorPorAno[anoISO]) semanasAnteriorPorAno[anoISO] = [];
      semanasAnteriorPorAno[anoISO].push(semana);
    }

    const desempenhoAnteriorPromises = Object.entries(semanasAnteriorPorAno).map(([anoISO, semanas]) =>
      supabase
        .from('desempenho_semanal')
        .select('*')
        .eq('bar_id', barId)
        .eq('ano', parseInt(anoISO))
        .in('numero_semana', semanas)
    );
    
    const marketingAnteriorPromises = Object.entries(semanasAnteriorPorAno).map(([anoISO, semanas]) =>
      supabase
        .from('marketing_semanal')
        .select('*')
        .eq('bar_id', barId)
        .eq('ano', parseInt(anoISO))
        .in('semana', semanas)
    );

    const [desempenhoAnteriorResults, marketingAnteriorResults] = await Promise.all([
      Promise.all(desempenhoAnteriorPromises),
      Promise.all(marketingAnteriorPromises)
    ]);

    const desempenhoAnteriorData = desempenhoAnteriorResults.flatMap(r => r.data || []);
    const marketingAnteriorData = marketingAnteriorResults.flatMap(r => r.data || []);

    const semanasAnteriorData = mesclarDadosMarketing(desempenhoAnteriorData, marketingAnteriorData);
    const dadosMesAnterior = agregarDadosMensais(semanasAnteriorData);

    return NextResponse.json({
      success: true,
      mes: dadosMensais,
      mesAnterior: dadosMesAnterior,
      semanasIncluidas: semanasDoMes.map(s => `${s.anoISO}-S${s.semana}`),
      quantidadeSemanas: semanasData?.length || 0,
      parametros: {
        mes,
        ano,
        barId
      }
    });

  } catch (error) {
    console.error('Erro na API de desempenho mensal:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Mesclar dados de desempenho com marketing
function mesclarDadosMarketing(desempenhoData: any[], marketingData: any[]): any[] {
  // Criar um mapa de marketing por semana
  const marketingMap = new Map<number, any>();
  for (const m of marketingData) {
    marketingMap.set(m.semana, m);
  }

  // Mesclar dados
  return desempenhoData.map(d => {
    const marketing = marketingMap.get(d.numero_semana);
    if (!marketing) return d;

    return {
      ...d,
      o_num_posts: marketing.o_num_posts,
      o_alcance: marketing.o_alcance,
      o_interacao: marketing.o_interacao,
      o_compartilhamento: marketing.o_compartilhamento,
      o_engajamento: marketing.o_engajamento,
      o_num_stories: marketing.o_num_stories,
      o_visu_stories: marketing.o_visu_stories,
      m_valor_investido: marketing.m_valor_investido,
      m_alcance: marketing.m_alcance,
      m_frequencia: marketing.m_frequencia,
      m_cpm: marketing.m_cpm,
      m_cliques: marketing.m_cliques,
      m_ctr: marketing.m_ctr,
      m_custo_por_clique: marketing.m_cpc,
      m_conversas_iniciadas: marketing.m_conversas_iniciadas,
      g_valor_investido: marketing.g_valor_investido,
      g_impressoes: marketing.g_impressoes,
      g_cliques: marketing.g_cliques,
      g_ctr: marketing.g_ctr,
      g_solicitacoes_rotas: marketing.g_solicitacoes_rotas,
      gmn_total_acoes: marketing.gmn_total_acoes,
      gmn_total_visualizacoes: marketing.gmn_total_visualizacoes,
      gmn_solicitacoes_rotas: marketing.gmn_solicitacoes_rotas,
    };
  });
}

// Calcular quais semanas pertencem a um mês (versão antiga - mantida para compatibilidade)
function calcularSemanasDoMes(mes: number, ano: number): number[] {
  const semanas: number[] = [];
  
  // Primeiro dia do mês
  const primeiroDia = new Date(ano, mes - 1, 1);
  // Último dia do mês
  const ultimoDia = new Date(ano, mes, 0);
  
  // Iterar por cada dia do mês e encontrar as semanas
  const semanasSet = new Set<number>();
  
  for (let d = new Date(primeiroDia); d <= ultimoDia; d.setDate(d.getDate() + 1)) {
    const semana = getWeekNumber(new Date(d));
    semanasSet.add(semana);
  }
  
  return Array.from(semanasSet).sort((a, b) => a - b);
}

// Calcular quais semanas pertencem a um mês (com ano ISO correto)
function calcularSemanasDoMesComAno(mes: number, ano: number): { semana: number; anoISO: number }[] {
  // Primeiro dia do mês
  const primeiroDia = new Date(ano, mes - 1, 1);
  // Último dia do mês
  const ultimoDia = new Date(ano, mes, 0);
  
  // Usar um Map para evitar duplicatas (chave = "ano-semana")
  const semanasMap = new Map<string, { semana: number; anoISO: number }>();
  
  for (let d = new Date(primeiroDia); d <= ultimoDia; d.setDate(d.getDate() + 1)) {
    const { semana, ano: anoISO } = getWeekAndYear(new Date(d));
    const key = `${anoISO}-${semana}`;
    if (!semanasMap.has(key)) {
      semanasMap.set(key, { semana, anoISO });
    }
  }
  
  return Array.from(semanasMap.values());
}

// Obter número da semana ISO e o ano ISO
function getWeekAndYear(date: Date): { semana: number; ano: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const ano = d.getUTCFullYear(); // Este é o ano ISO correto
  return { semana, ano };
}

// Obter número da semana ISO
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Agregar dados de múltiplas semanas
function agregarDadosMensais(semanas: any[]): any {
  if (!semanas || semanas.length === 0) {
    return null;
  }

  const n = semanas.length;

  // Funções auxiliares
  const soma = (campo: string) => semanas.reduce((acc, s) => acc + (parseFloat(s[campo]) || 0), 0);
  const media = (campo: string) => soma(campo) / n;
  const mediaValida = (campo: string) => {
    const valores = semanas.filter(s => s[campo] !== null && s[campo] !== undefined);
    if (valores.length === 0) return 0;
    return valores.reduce((acc, s) => acc + (parseFloat(s[campo]) || 0), 0) / valores.length;
  };

  return {
    // Identificação
    quantidade_semanas: n,
    
    // Faturamentos (soma)
    faturamento_total: soma('faturamento_total'),
    faturamento_entrada: soma('faturamento_entrada'),
    faturamento_bar: soma('faturamento_bar'),
    faturamento_cmovivel: soma('faturamento_cmovivel'),
    
    // CMV
    cmv_rs: soma('cmv_rs'),
    cmv_limpo: mediaValida('cmv_limpo'),
    cmv_global_real: mediaValida('cmv_global_real'),
    cmv_teorico: mediaValida('cmv_teorico'),
    
    // Tickets (média)
    ticket_medio: mediaValida('ticket_medio'),
    tm_entrada: mediaValida('tm_entrada'),
    tm_bar: mediaValida('tm_bar'),
    
    // CMO
    cmo: mediaValida('cmo'),
    cmo_custo: soma('cmo_custo'),
    custo_atracao_faturamento: mediaValida('custo_atracao_faturamento'),
    
    // Clientes (soma)
    clientes_atendidos: soma('clientes_atendidos'),
    clientes_ativos: mediaValida('clientes_ativos'),
    
    // Retenção (média)
    retencao_1m: mediaValida('retencao_1m'),
    retencao_2m: mediaValida('retencao_2m'),
    perc_clientes_novos: mediaValida('perc_clientes_novos'),
    
    // Reservas (soma)
    reservas_totais: soma('reservas_totais'),
    reservas_presentes: soma('reservas_presentes'),
    
    // Qualidade (média)
    avaliacoes_5_google_trip: soma('avaliacoes_5_google_trip'),
    media_avaliacoes_google: mediaValida('media_avaliacoes_google'),
    nps_reservas: mediaValida('nps_reservas'),
    nota_felicidade_equipe: mediaValida('nota_felicidade_equipe'),
    
    // Cockpit Financeiro (soma)
    imposto: soma('imposto'),
    comissao: soma('comissao'),
    cmv: soma('cmv'),
    freelas: soma('freelas'),
    cmo_fixo_simulacao: soma('cmo_fixo_simulacao'),
    alimentacao: soma('alimentacao'),
    pro_labore: soma('pro_labore'),
    rh_estorno_outros_operacao: soma('rh_estorno_outros_operacao'),
    materiais: soma('materiais'),
    manutencao: soma('manutencao'),
    atracoes_eventos: soma('atracoes_eventos'),
    utensilios: soma('utensilios'),
    
    // Cockpit Produtos (soma para quantidades, média para percentuais)
    stockout_comidas: soma('stockout_comidas'),
    stockout_drinks: soma('stockout_drinks'),
    stockout_bar: soma('stockout_bar'),
    perc_bebidas: mediaValida('perc_bebidas'),
    perc_drinks: mediaValida('perc_drinks'),
    perc_comida: mediaValida('perc_comida'),
    perc_happy_hour: mediaValida('perc_happy_hour'),
    qtde_itens_bar: soma('qtde_itens_bar'),
    atrasos_bar: soma('atrasos_bar'),
    tempo_saida_bar: mediaValida('tempo_saida_bar'),
    qtde_itens_cozinha: soma('qtde_itens_cozinha'),
    atrasos_cozinha: soma('atrasos_cozinha'),
    tempo_saida_cozinha: mediaValida('tempo_saida_cozinha'),
    
    // Vendas (soma e média)
    perc_faturamento_ate_19h: mediaValida('perc_faturamento_ate_19h'),
    venda_balcao: soma('venda_balcao'),
    couvert_atracoes: soma('couvert_atracoes'),
    qui_sab_dom: soma('qui_sab_dom'),
    
    // Marketing (soma)
    o_num_posts: soma('o_num_posts'),
    o_alcance: soma('o_alcance'),
    o_interacao: soma('o_interacao'),
    o_compartilhamento: soma('o_compartilhamento'),
    o_engajamento: mediaValida('o_engajamento'),
    o_num_stories: soma('o_num_stories'),
    o_visu_stories: soma('o_visu_stories'),
    m_valor_investido: soma('m_valor_investido'),
    m_alcance: soma('m_alcance'),
    m_frequencia: mediaValida('m_frequencia'),
    m_cpm: mediaValida('m_cpm'),
    m_cliques: soma('m_cliques'),
    m_ctr: mediaValida('m_ctr'),
    m_custo_por_clique: mediaValida('m_custo_por_clique'),
    m_conversas_iniciadas: soma('m_conversas_iniciadas'),
  };
}
