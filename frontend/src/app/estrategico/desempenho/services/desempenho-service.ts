import { SupabaseClient } from '@supabase/supabase-js';
import {
  CmvSemanalRow,
  DadosSemana,
  DescontosSemanaAgregados,
  MarketingSemanalRow,
  PaginatedFilter,
} from '../types';

// Helper for pagination
async function fetchAllPaginated<T>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  filters: PaginatedFilter[],
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

  const marketingMap = new Map<string, MarketingSemanalRow>();
  (marketingData as MarketingSemanalRow[] | null | undefined)?.forEach((m) =>
    marketingMap.set(`${m.ano}-${m.semana}`, m)
  );

  // Buscar CMV Semanal
  let cmvQuery = supabase
    .from('cmv_semanal')
    .select('semana, ano, cmv_real, cmv_limpo_percentual, faturamento_cmvivel')
    .eq('bar_id', barId);
  
  if (ano) {
    cmvQuery = cmvQuery.eq('ano', ano);
  }

  const { data: cmvData } = await cmvQuery;

  const cmvMap = new Map<string, CmvSemanalRow>();
  (cmvData as CmvSemanalRow[] | null | undefined)?.forEach((c) => cmvMap.set(`${c.ano}-${c.semana}`, c));

  // Buscar Pagamentos e Descontos (Otimização: filtrar pelo range de datas das semanas encontradas)
  const datas = semanas.map(s => ({ inicio: s.data_inicio, fim: s.data_fim }));
  const dataMin = datas.reduce((min, d) => d.inicio < min ? d.inicio : min, datas[0].inicio);
  const dataMax = datas.reduce((max, d) => d.fim > max ? d.fim : max, datas[0].fim);

  const contaAssinadaMap = new Map<string, number>();
  const descontosMap = new Map<string, DescontosSemanaAgregados>();
  const falaeNpsMap = new Map<string, { respostas: number; promotores: number; detratores: number; mediaPonderada: number }>();
  const falaeDetalhesMap = new Map<
    string,
    {
      criterios: Map<string, { soma: number; total: number }>;
      comentarios: {
        nps: number;
        comentario: string;
        data: string;
        tipo: 'promotor' | 'neutro' | 'detrator';
        avaliacoes: { nome: string; nota: number }[];
      }[];
    }
  >();

  if (dataMin && dataMax) {
    // Conta Assinada (de faturamento_pagamentos - tabela final)
    const pagamentos = await fetchAllPaginated<{ data_pagamento: string; valor_bruto: number }>(
      supabase,
      'faturamento_pagamentos',
      'data_pagamento, valor_bruto',
      [
        { column: 'bar_id', operator: 'eq', value: barId },
        { column: 'meio', operator: 'eq', value: 'Conta Assinada' },
        { column: 'data_pagamento', operator: 'gte', value: dataMin },
        { column: 'data_pagamento', operator: 'lte', value: dataMax },
      ]
    );

    pagamentos.forEach(p => {
      const semana = semanas.find(s => p.data_pagamento >= s.data_inicio && p.data_pagamento <= s.data_fim);
      if (semana) {
        const key = `${semana.ano}-${semana.numero_semana}`;
        contaAssinadaMap.set(key, (contaAssinadaMap.get(key) || 0) + Number(p.valor_bruto || 0));
      }
    });

    // Descontos (de visitas - tabela final)
    const descontos = await fetchAllPaginated<{ data_visita: string; valor_desconto: number; motivo: string }>(
      supabase,
      'visitas',
      'data_visita, valor_desconto, motivo',
      [
        { column: 'bar_id', operator: 'eq', value: barId },
        { column: 'valor_desconto', operator: 'gt', value: 0 },
        { column: 'data_visita', operator: 'gte', value: dataMin },
        { column: 'data_visita', operator: 'lte', value: dataMax },
      ]
    );

    // Processar descontos (agrupamento)
    descontos.forEach(d => {
      const semana = semanas.find(s => d.data_visita >= s.data_inicio && d.data_visita <= s.data_fim);
      if (semana) {
        const key = `${semana.ano}-${semana.numero_semana}`;
        const valor = Number(d.valor_desconto || 0);
        const motivo = d.motivo || 'Sem motivo';
        const data = new Date(d.data_visita + 'T00:00:00');
        const diaSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][data.getDay()];

        if (!descontosMap.has(key)) {
          descontosMap.set(key, { valor: 0, detalhes: new Map() });
        }
        const semanaData = descontosMap.get(key)!;
        semanaData.valor += valor;

        // Agrupamento inteligente
        const { categoria, exibicao } = agruparMotivo(motivo);
        
        if (!semanaData.detalhes.has(categoria)) {
          semanaData.detalhes.set(categoria, { motivo_exibicao: exibicao, valor: 0, qtd: 0, por_dia: new Map() });
        }
        const motivoData = semanaData.detalhes.get(categoria)!;
        motivoData.valor += valor;
        motivoData.qtd += 1;

        if (!motivoData.por_dia.has(diaSemana)) {
          motivoData.por_dia.set(diaSemana, { valor: 0, qtd: 0 });
        }
        const diaData = motivoData.por_dia.get(diaSemana)!;
        diaData.valor += valor;
        diaData.qtd += 1;
      }
    });

    // NPS Falaê diário agregado -> semanal
    const falaeDiario = await fetchAllPaginated<{
      data_referencia: string;
      respostas_total: number;
      promotores: number;
      detratores: number;
      nps_media: number | null;
    }>(
      supabase,
      'nps_falae_diario',
      'data_referencia, respostas_total, promotores, detratores, nps_media',
      [
        { column: 'bar_id', operator: 'eq', value: barId },
        { column: 'data_referencia', operator: 'gte', value: dataMin },
        { column: 'data_referencia', operator: 'lte', value: dataMax },
      ]
    );

    falaeDiario.forEach((d) => {
      const data = new Date(`${d.data_referencia}T12:00:00`);
      const { semana: numeroSemana, ano: anoSemana } = getWeekAndYear(data);
      const key = `${anoSemana}-${numeroSemana}`;

      if (!falaeNpsMap.has(key)) {
        falaeNpsMap.set(key, { respostas: 0, promotores: 0, detratores: 0, mediaPonderada: 0 });
      }

      const cur = falaeNpsMap.get(key)!;
      const respostas = Number(d.respostas_total) || 0;
      cur.respostas += respostas;
      cur.promotores += Number(d.promotores) || 0;
      cur.detratores += Number(d.detratores) || 0;
      cur.mediaPonderada += (Number(d.nps_media) || 0) * respostas;
    });

    // Detalhes Falaê por semana (médias por tema + comentários)
    const falaeRespostas = await fetchAllPaginated<{
      created_at: string;
      nps: number;
      criterios: unknown;
      discursive_question: string | null;
    }>(
      supabase,
      'falae_respostas',
      'created_at, nps, criterios, discursive_question',
      [
        { column: 'bar_id', operator: 'eq', value: barId },
        { column: 'created_at', operator: 'gte', value: `${dataMin}T00:00:00` },
        { column: 'created_at', operator: 'lte', value: `${dataMax}T23:59:59` },
      ]
    );

    falaeRespostas.forEach((r) => {
      const data = new Date(String(r.created_at));
      if (Number.isNaN(data.getTime())) return;
      const { semana: numeroSemana, ano: anoSemana } = getWeekAndYear(data);
      const key = `${anoSemana}-${numeroSemana}`;

      if (!falaeDetalhesMap.has(key)) {
        falaeDetalhesMap.set(key, {
          criterios: new Map(),
          comentarios: [],
        });
      }

      const bucket = falaeDetalhesMap.get(key)!;
      const criterios: unknown[] = Array.isArray(r.criterios) ? r.criterios : [];
      const avaliacoesDaResposta: { nome: string; nota: number }[] = [];
      criterios.forEach((c: unknown) => {
        if (!isPlainRecord(c) || c.type !== 'Rating') return;
        const valor = typeof c.name === 'number' ? c.name : parseFloat(String(c.name ?? ''));
        if (!Number.isFinite(valor)) return;
        const nome = String(c.nick ?? c.title ?? c.question ?? 'Geral').trim();
        const nomeFinal = nome || 'Geral';
        avaliacoesDaResposta.push({
          nome: nomeFinal,
          nota: Math.round(valor * 10) / 10,
        });
        if (!bucket.criterios.has(nomeFinal)) {
          bucket.criterios.set(nomeFinal, { soma: 0, total: 0 });
        }
        const atual = bucket.criterios.get(nomeFinal)!;
        atual.soma += valor;
        atual.total += 1;
      });

      const comentario = String(r.discursive_question || '').trim();
      if (comentario) {
        const nps = Number(r.nps) || 0;
        bucket.comentarios.push({
          nps,
          comentario,
          data: String(r.created_at),
          tipo: nps >= 9 ? 'promotor' : nps <= 6 ? 'detrator' : 'neutro',
          avaliacoes: avaliacoesDaResposta,
        });
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
      ? Array.from(descontosData.detalhes.entries())
          .map(([_, data]) => ({ 
            motivo: data.motivo_exibicao,
            valor: data.valor, 
            qtd: data.qtd,
            por_dia: Array.from(data.por_dia.entries())
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
    // reservas_totais e reservas_presentes no banco = pessoas (não mesas)
    const pessoasTotal = s.reservas_totais || 0;
    const pessoasPresentes = s.reservas_presentes || 0;
    const quebraReservas = pessoasTotal > 0 
      ? ((pessoasTotal - pessoasPresentes) / pessoasTotal) * 100 
      : 0;

    // Garantir que valores numéricos vindos como string do Postgres sejam convertidos
    const toNum = (v: unknown): number | null => {
      if (v === null || v === undefined) return null;
      if (typeof v === 'number' && !isNaN(v)) return v;
      if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? null : n; }
      return null;
    };

    return {
      ...s,
      cancelamentos: toNum(s.cancelamentos) ?? s.cancelamentos,
      atrasinhos_bar: toNum(s.atrasinhos_bar) ?? s.atrasinhos_bar,
      atrasinhos_bar_perc: toNum(s.atrasinhos_bar_perc) ?? s.atrasinhos_bar_perc,
      atrasinhos_cozinha: toNum(s.atrasinhos_cozinha) ?? s.atrasinhos_cozinha,
      atrasinhos_cozinha_perc: toNum(s.atrasinhos_cozinha_perc) ?? s.atrasinhos_cozinha_perc,
      atraso_bar: toNum(s.atraso_bar) ?? s.atraso_bar,
      atraso_cozinha: toNum(s.atraso_cozinha) ?? s.atraso_cozinha,
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
      ...(falaeNpsMap.has(key)
        ? (() => {
            const falae = falaeNpsMap.get(key)!;
            const detalhes = falaeDetalhesMap.get(key);
            const score =
              falae.respostas > 0
                ? Math.round((((falae.promotores - falae.detratores) / falae.respostas) * 100) * 10) / 10
                : null;
            const media =
              falae.respostas > 0
                ? Math.round((falae.mediaPonderada / falae.respostas) * 10) / 10
                : null;
            return {
              falae_nps_score: score,
              falae_nps_media: media,
              falae_respostas_total: falae.respostas,
              falae_promotores_total: falae.promotores,
              falae_neutros_total: Math.max(0, falae.respostas - falae.promotores - falae.detratores),
              falae_detratores_total: falae.detratores,
              falae_avaliacoes_detalhes: detalhes
                ? Array.from(detalhes.criterios.entries())
                    .map(([nome, v]) => ({
                      nome,
                      media: Math.round((v.soma / v.total) * 10) / 10,
                      total: v.total,
                    }))
                    .sort((a, b) => b.total - a.total)
                : [],
              falae_comentarios_detalhes: detalhes
                ? [...detalhes.comentarios]
                    .sort((a, b) => (a.data < b.data ? 1 : -1))
                    .slice(0, 30)
                : [],
            };
          })()
        : {}),
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

function getWeekAndYear(date: Date): { semana: number; ano: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const ano = d.getUTCFullYear();
  return { semana, ano };
}

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
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
