import { SupabaseClient } from '@supabase/supabase-js';
import { DadosSemana } from '../types';

// Helper for pagination
async function fetchAllPaginated<T>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  filters: { column: string; operator: string; value: any }[],
  pageSize: number = 1000
): Promise<T[]> {
  let allData: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1);

    for (const filter of filters) {
      if (filter.operator === 'eq') query = query.eq(filter.column, filter.value);
      else if (filter.operator === 'gt') query = query.gt(filter.column, filter.value);
      else if (filter.operator === 'gte') query = query.gte(filter.column, filter.value);
      else if (filter.operator === 'lte') query = query.lte(filter.column, filter.value);
      else if (filter.operator === 'lt') query = query.lt(filter.column, filter.value);
      else if (filter.operator === 'in') query = query.in(filter.column, filter.value);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Erro ao buscar ${table}:`, error);
      break;
    }

    if (data && data.length > 0) {
      allData = allData.concat(data as T[]);
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return allData;
}

export async function getSemanas(
  supabase: SupabaseClient,
  barId: number,
  ano?: number
): Promise<{ semanas: DadosSemana[], semanaAtual: number, anoAtual: number }> {
  
  // Buscar semanas básicas
  let query = supabase
    .from('desempenho_semanal')
    .select('*')
    .eq('bar_id', barId)
    .order('ano', { ascending: true })
    .order('numero_semana', { ascending: true });
  
  if (ano) {
    query = query.eq('ano', ano);
  }

  const { data: semanas, error } = await query;

  if (error) {
    console.error('Erro ao buscar semanas:', error);
    throw new Error('Erro ao buscar dados semanais');
  }

  if (!semanas || semanas.length === 0) {
    const hoje = new Date();
    return { semanas: [], semanaAtual: getWeekNumber(hoje), anoAtual: hoje.getFullYear() };
  }

  // Buscar Marketing
  let marketingQuery = supabase
    .from('marketing_semanal')
    .select('*')
    .eq('bar_id', barId);
  
  if (ano) {
    marketingQuery = marketingQuery.eq('ano', ano);
  }

  const { data: marketingData } = await marketingQuery;

  const marketingMap = new Map<string, any>();
  marketingData?.forEach(m => marketingMap.set(`${m.ano}-${m.semana}`, m));

  // Buscar CMV Semanal
  let cmvQuery = supabase
    .from('cmv_semanal')
    .select('semana, ano, cmv_real, cmv_limpo_percentual, faturamento_cmvivel')
    .eq('bar_id', barId);
  
  if (ano) {
    cmvQuery = cmvQuery.eq('ano', ano);
  }

  const { data: cmvData } = await cmvQuery;

  const cmvMap = new Map<string, any>();
  cmvData?.forEach(c => cmvMap.set(`${c.ano}-${c.semana}`, c));

  // Buscar Pagamentos e Descontos (Otimização: filtrar pelo range de datas das semanas encontradas)
  const datas = semanas.map(s => ({ inicio: s.data_inicio, fim: s.data_fim }));
  const dataMin = datas.reduce((min, d) => d.inicio < min ? d.inicio : min, datas[0].inicio);
  const dataMax = datas.reduce((max, d) => d.fim > max ? d.fim : max, datas[0].fim);

  const contaAssinadaMap = new Map<string, number>();
  const descontosMap = new Map<string, any>();

  if (dataMin && dataMax) {
    // Conta Assinada
    const pagamentos = await fetchAllPaginated<{ dt_gerencial: string; valor: number }>(
      supabase,
      'contahub_pagamentos',
      'dt_gerencial, valor',
      [
        { column: 'bar_id', operator: 'eq', value: barId },
        { column: 'meio', operator: 'eq', value: 'Conta Assinada' },
        { column: 'dt_gerencial', operator: 'gte', value: dataMin },
        { column: 'dt_gerencial', operator: 'lte', value: dataMax },
      ]
    );

    pagamentos.forEach(p => {
      const semana = semanas.find(s => p.dt_gerencial >= s.data_inicio && p.dt_gerencial <= s.data_fim);
      if (semana) {
        const key = `${semana.ano}-${semana.numero_semana}`;
        contaAssinadaMap.set(key, (contaAssinadaMap.get(key) || 0) + Number(p.valor || 0));
      }
    });

    // Descontos
    const descontos = await fetchAllPaginated<{ dt_gerencial: string; vr_desconto: number; motivo: string }>(
      supabase,
      'contahub_periodo',
      'dt_gerencial, vr_desconto, motivo',
      [
        { column: 'bar_id', operator: 'eq', value: barId },
        { column: 'vr_desconto', operator: 'gt', value: 0 },
        { column: 'dt_gerencial', operator: 'gte', value: dataMin },
        { column: 'dt_gerencial', operator: 'lte', value: dataMax },
      ]
    );

    // Processar descontos (agrupamento)
    descontos.forEach(d => {
      const semana = semanas.find(s => d.dt_gerencial >= s.data_inicio && d.dt_gerencial <= s.data_fim);
      if (semana) {
        const key = `${semana.ano}-${semana.numero_semana}`;
        const valor = Number(d.vr_desconto || 0);
        const motivo = d.motivo || 'Sem motivo';
        const data = new Date(d.dt_gerencial + 'T00:00:00');
        const diaSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][data.getDay()];

        if (!descontosMap.has(key)) {
          descontosMap.set(key, { valor: 0, detalhes: new Map() });
        }
        const semanaData = descontosMap.get(key);
        semanaData.valor += valor;

        // Agrupamento inteligente
        const { categoria, exibicao } = agruparMotivo(motivo);
        
        if (!semanaData.detalhes.has(categoria)) {
          semanaData.detalhes.set(categoria, { motivo_exibicao: exibicao, valor: 0, qtd: 0, por_dia: new Map() });
        }
        const motivoData = semanaData.detalhes.get(categoria);
        motivoData.valor += valor;
        motivoData.qtd += 1;

        if (!motivoData.por_dia.has(diaSemana)) {
          motivoData.por_dia.set(diaSemana, { valor: 0, qtd: 0 });
        }
        const diaData = motivoData.por_dia.get(diaSemana);
        diaData.valor += valor;
        diaData.qtd += 1;
      }
    });
  }

  // Mesclar tudo
  const semanasCompletas = semanas.map(s => {
    const key = `${s.ano}-${s.numero_semana}`;
    const marketing = marketingMap.get(key);
    
    // Conta Assinada
    const contaAssinadaValor = contaAssinadaMap.get(key) || 0;
    const contaAssinadaPerc = s.faturamento_total && s.faturamento_total > 0 
      ? (contaAssinadaValor / s.faturamento_total) * 100 
      : 0;
    
    // Descontos
    const descontosData = descontosMap.get(key);
    const descontosValor = descontosData?.valor || 0;
    const descontosPerc = s.faturamento_total && s.faturamento_total > 0 
      ? (descontosValor / s.faturamento_total) * 100 
      : 0;
    
    // Detalhes Descontos
    const descontosDetalhes = descontosData 
      ? Array.from(descontosData.detalhes.entries() as Iterable<[string, any]>)
          .map(([_, data]) => ({ 
            motivo: data.motivo_exibicao,
            valor: data.valor, 
            qtd: data.qtd,
            por_dia: Array.from(data.por_dia.entries() as Iterable<[string, any]>)
              .map(([dia, diaData]) => ({ 
                dia_semana: dia, 
                valor: diaData.valor, 
                qtd: diaData.qtd 
              }))
              .sort((a, b) => {
                const ordem = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
                return ordem.indexOf(a.dia_semana) - ordem.indexOf(b.dia_semana);
              })
          }))
          .sort((a, b) => b.valor - a.valor)
      : [];

    // CMV Semanal (calculado)
    const cmv = cmvMap.get(key);
    const cmvRsCalculado = cmv?.cmv_real || null;
    const cmvLimpoCalculado = cmv?.cmv_limpo_percentual || null;
    
    // Calcular CMV Global % = CMV R$ / Faturamento Total × 100
    const cmvGlobalCalculado = (cmvRsCalculado !== null && s.faturamento_total && s.faturamento_total > 0)
      ? (cmvRsCalculado / s.faturamento_total) * 100
      : null;

    // Calcular Quebra de Reservas = (Pessoas Total - Pessoas Presentes) / Pessoas Total × 100
    const pessoasTotal = s.pessoas_reservas_totais || 0;
    const pessoasPresentes = s.pessoas_reservas_presentes || 0;
    const quebraReservas = pessoasTotal > 0 
      ? ((pessoasTotal - pessoasPresentes) / pessoasTotal) * 100 
      : 0;

    return {
      ...s,
      quebra_reservas: quebraReservas,
      conta_assinada_valor: contaAssinadaValor,
      conta_assinada_perc: contaAssinadaPerc,
      descontos_valor: descontosValor,
      descontos_perc: descontosPerc,
      descontos_detalhes: descontosDetalhes,
      // Sobrescrever CMV R$ com valor calculado do CMV Semanal (se existir)
      ...(cmvRsCalculado !== null ? { cmv_rs: cmvRsCalculado } : {}),
      // Sobrescrever CMV Limpo % com valor calculado do CMV Semanal (se existir)
      ...(cmvLimpoCalculado !== null ? { cmv_limpo: cmvLimpoCalculado } : {}),
      // Sobrescrever CMV Global % calculado a partir do CMV R$ (se existir)
      ...(cmvGlobalCalculado !== null ? { cmv_global_real: cmvGlobalCalculado } : {}),
      ...(marketing ? {
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
      } : {})
    } as DadosSemana;
  });

  const hoje = new Date();
  const semanaAtual = getWeekNumber(hoje);
  const anoAtual = hoje.getFullYear();

  return { semanas: semanasCompletas, semanaAtual, anoAtual };
}

// Helper: Semana ISO
function getWeekNumber(d: Date): number {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function agruparMotivo(motivo: string): { categoria: string; exibicao: string } {
  const m = motivo.toLowerCase().trim();
  
  if (
    m.includes('banda') || m.includes('musico') || m.includes('músico') ||
    m.includes('doze') || m.includes('12') ||
    m.includes('stz') ||
    m.includes('7 na roda') || m.includes('sete na roda') || m === '7' || m === 'sete' ||
    m.includes('sambadona') ||
    m.includes('dj ') || m.startsWith('dj') || m.endsWith(' dj') ||
    m.includes('roadie') || m.includes('roudier')
  ) {
    return { categoria: 'banda', exibicao: 'Banda/DJ/Músicos' };
  }
  
  if (m.includes('socio') || m.includes('sócio')) {
    return { categoria: 'sócio', exibicao: 'Sócio' };
  }
  
  if (
    m.includes('aniversar') || m.includes('aniversár') ||
    m.includes('niver')
  ) {
    return { categoria: 'aniversário', exibicao: 'Aniversário' };
  }
  
  return { categoria: m, exibicao: motivo.trim() };
}
