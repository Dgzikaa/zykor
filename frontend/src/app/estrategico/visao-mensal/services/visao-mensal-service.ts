import { SupabaseClient } from '@supabase/supabase-js';

export interface IndicadorMensal {
  mes: string;
  mesNome: string;
  mesAbrev: string;
  faturamentoTotal: number;
  clientesAtivos: number;
  clientesTotais: number;
  novosClientes: number;
  clientesRecorrentes: number;
  taxaRetencao: number;
  reputacao: number;
  percentualNovos: number;
  percentualRecorrentes: number;
  percentualAtivos: number;
  cmoTotal: number;
  percentualArtistico: number;
  ticketMedio: number;
  totalPessoas: number;
  variacoes: any | null;
}

export interface DadosComparativos {
  meses: IndicadorMensal[];
  periodo: string;
  ultimaAtualizacao: string;
}

async function fetchAllPaginated<T>(
  supabase: SupabaseClient, 
  tableName: string, 
  select: string, 
  filters: (query: any) => any,
  limit: number = 1000
): Promise<T[]> {
  let allData: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from(tableName).select(select).range(from, from + limit - 1);
    query = filters(query);
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData = allData.concat(data as T[]);
      from += limit;
      hasMore = data.length === limit;
    }
  }
  return allData;
}

export async function getIndicadoresMensais(
  supabase: SupabaseClient, 
  barId: number, 
  mesReferencia?: string
): Promise<DadosComparativos> {
  const dataRef = mesReferencia ? 
    new Date(parseInt(mesReferencia.split('-')[0]), parseInt(mesReferencia.split('-')[1]) - 1, 1) : 
    new Date();
  
  if (!mesReferencia) dataRef.setMonth(dataRef.getMonth()); // Default mês atual

  const mesesInfo: { mes: string; mesNome: string; mesAbrev: string }[] = [];
  for (let i = 3; i >= 0; i--) {
    const mesData = new Date(dataRef.getFullYear(), dataRef.getMonth() - i, 1);
    mesesInfo.push({
      mes: `${mesData.getFullYear()}-${(mesData.getMonth() + 1).toString().padStart(2, '0')}`,
      mesNome: mesData.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      mesAbrev: mesData.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase()
    });
  }

  // Otimização: Buscar todo o histórico de clientes do bar UMA VEZ para calcular novos clientes
  // em vez de repetir para cada mês do loop.
  const todosClientesData = await fetchAllPaginated<{cli_fone: string, dt_gerencial: string}>(
    supabase, 'contahub_periodo', 'cli_fone, dt_gerencial', 
    (q) => q.eq('bar_id', barId).not('cli_fone', 'is', null).order('dt_gerencial', { ascending: true })
  );

  const primeiraVisitaMap = new Map<string, string>();
  todosClientesData.forEach(row => {
    const fone = (row.cli_fone || '').toString().trim();
    if (fone && !primeiraVisitaMap.has(fone)) {
      primeiraVisitaMap.set(fone, row.dt_gerencial);
    }
  });

  const indicadoresPorMes: IndicadorMensal[] = [];

  for (const mesInfo of mesesInfo) {
    const [ano, mes] = mesInfo.mes.split('-');
    const inicioMes = `${mesInfo.mes}-01`;
    const fimMes = new Date(parseInt(ano), parseInt(mes), 0).toISOString().split('T')[0];

    // Faturamento paralelo
    const [contahubBatch, yuzerBatch, symplaBatch] = await Promise.all([
      fetchAllPaginated<any>(supabase, 'contahub_pagamentos', 'liquido, meio', 
        (q) => q.eq('bar_id', barId).gte('dt_gerencial', inicioMes).lte('dt_gerencial', fimMes).neq('meio', 'Conta Assinada')),
      supabase.from('yuzer_pagamento').select('valor_liquido').eq('bar_id', barId).gte('data_evento', inicioMes).lte('data_evento', fimMes),
      supabase.from('sympla_pedidos').select('valor_liquido').gte('data_pedido', inicioMes).lte('data_pedido', fimMes)
    ]);

    const fatTotal = (contahubBatch.reduce((s, i) => s + (parseFloat(i.liquido) || 0), 0)) +
                     (yuzerBatch.data?.reduce((s, i) => s + (parseFloat(i.valor_liquido) || 0), 0) || 0) +
                     (symplaBatch.data?.reduce((s, i) => s + (parseFloat(i.valor_liquido) || 0), 0) || 0);

    // Clientes do mês
    const clientesDoMesData = await fetchAllPaginated<any>(supabase, 'contahub_periodo', 'cli_fone, pessoas', 
      (q) => q.eq('bar_id', barId).gte('dt_gerencial', inicioMes).lte('dt_gerencial', fimMes).not('cli_fone', 'is', null));
    
    const clientesUnicosSet = new Set(clientesDoMesData.map(r => r.cli_fone.toString().trim()));
    const clientesTotais = clientesUnicosSet.size;
    const totalPessoas = clientesDoMesData.reduce((s, i) => s + (parseInt(i.pessoas) || 0), 0);

    let novosClientes = 0;
    clientesUnicosSet.forEach(fone => {
      const pVisita = primeiraVisitaMap.get(fone);
      if (pVisita && pVisita >= inicioMes && pVisita <= fimMes) novosClientes++;
    });

    // Clientes Ativos (90 dias antes deste mês)
    const data90d = new Date(inicioMes); data90d.setDate(data90d.getDate() - 90);
    const data90dStr = data90d.toISOString().split('T')[0];
    const fimAntStr = new Date(new Date(inicioMes).getTime() - 86400000).toISOString().split('T')[0];

    const hist90d = await fetchAllPaginated<any>(supabase, 'contahub_periodo', 'cli_fone',
      (q) => q.eq('bar_id', barId).gte('dt_gerencial', data90dStr).lte('dt_gerencial', fimAntStr).not('cli_fone', 'is', null));
    const set90d = new Set(hist90d.map(r => r.cli_fone.toString().trim()));
    
    let clientesAtivos = 0;
    clientesUnicosSet.forEach(c => { if (set90d.has(c)) clientesAtivos++; });

    // CMO e Artístico
    const { data: niboBatch } = await supabase.from('nibo_agendamentos').select('valor, categoria_nome')
      .eq('bar_id', barId).gte('data_competencia', inicioMes).lte('data_competencia', fimMes);
    
    const cmoTotal = niboBatch?.filter(i => ['SALARIO FUNCIONARIOS', 'PROVISÃO TRABALHISTA', 'VALE TRANSPORTE', 'FREELA ATENDIMENTO', 'FREELA BAR', 'FREELA COZINHA', 'FREELA LIMPEZA', 'FREELA SEGURANÇA'].includes(i.categoria_nome))
      .reduce((s, i) => s + (parseFloat(i.valor) || 0), 0) || 0;
    const cArt = niboBatch?.filter(i => ['ATRAÇÕES', 'PRODUÇÃO', 'MARKETING'].includes(i.categoria_nome))
      .reduce((s, i) => s + (parseFloat(i.valor) || 0), 0) || 0;

    // Reputação
    const { data: repBatch } = await supabase.from('windsor_google').select('review_average_rating_total')
      .eq('bar_id', barId).gte('created_at', inicioMes).lte('created_at', fimMes + 'T23:59:59');
    const reputacao = repBatch && repBatch.length > 0 ? repBatch.reduce((s, i) => s + (i.review_average_rating_total || 0), 0) / repBatch.length : 0;

    indicadoresPorMes.push({
      mes: mesInfo.mes, mesNome: mesInfo.mesNome, mesAbrev: mesInfo.mesAbrev,
      faturamentoTotal: fatTotal, clientesRecorrentes: clientesTotais - novosClientes,
      clientesTotais, novosClientes, clientesAtivos,
      taxaRetencao: clientesTotais > 0 ? (clientesAtivos / clientesTotais) * 100 : 0,
      percentualNovos: clientesTotais > 0 ? (novosClientes / clientesTotais) * 100 : 0,
      percentualRecorrentes: clientesTotais > 0 ? ((clientesTotais - novosClientes) / clientesTotais) * 100 : 0,
      percentualAtivos: clientesTotais > 0 ? (clientesAtivos / clientesTotais) * 100 : 0,
      cmoTotal, percentualArtistico: fatTotal > 0 ? (cArt / fatTotal) * 100 : 0,
      ticketMedio: totalPessoas > 0 ? fatTotal / totalPessoas : 0,
      totalPessoas, reputacao, variacoes: null
    });
  }

  // Calcular variações
  const mesesComVariacao = indicadoresPorMes.map((ind, i) => {
    const ant = i > 0 ? indicadoresPorMes[i-1] : null;
    if (!ant) return ind;
    const calcVar = (at: number, an: number) => an === 0 ? (at > 0 ? 100 : 0) : ((at - an) / an) * 100;
    return {
      ...ind,
      variacoes: {
        faturamento: calcVar(ind.faturamentoTotal, ant.faturamentoTotal),
        clientesRecorrentes: calcVar(ind.clientesRecorrentes, ant.clientesRecorrentes),
        clientesTotais: calcVar(ind.clientesTotais, ant.clientesTotais),
        novosClientes: calcVar(ind.novosClientes, ant.novosClientes),
        clientesAtivos: calcVar(ind.clientesAtivos, ant.clientesAtivos),
        percentualNovos: calcVar(ind.percentualNovos, ant.percentualAtivos), // fix variacao percentuais se necessario
        cmoTotal: calcVar(ind.cmoTotal, ant.cmoTotal),
        percentualArtistico: calcVar(ind.percentualArtistico, ant.percentualArtistico),
        ticketMedio: calcVar(ind.ticketMedio, ant.ticketMedio),
        reputacao: calcVar(ind.reputacao, ant.reputacao)
      }
    };
  });

  return {
    meses: mesesComVariacao,
    periodo: `${mesesInfo[0].mesNome} - ${mesesInfo[3].mesNome}`,
    ultimaAtualizacao: new Date().toISOString()
  };
}
