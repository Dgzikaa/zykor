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
  pageSize: number = 1000,
  schema?: string
): Promise<T[]> {
  let allData: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    // Supabase tipa schema() apenas para schemas declarados no Database type.
    // Após a migração medallion, várias tabelas vivem em schemas dinâmicos
    // (operations, financial, integrations, crm, meta, bronze, gold).
    // Cast pra any aqui é o padrão usado no resto do projeto pra contornar isso.
    const base = schema
      ? (supabase as unknown as { schema: (s: string) => SupabaseClient }).schema(schema).from(table)
      : supabase.from(table);

    let query = base
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
      const fqn = schema ? `${schema}.${table}` : table;
      console.error(`❌ Erro em fetchAllPaginated(${fqn}):`, {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        filters,
      });
      // Propaga: antes fazia 'break' silencioso e retornava parcial,
      // o que mascarava falhas de schema/conexão como dados zerados.
      throw new Error(
        `Erro ao paginar ${fqn}: ${error.message} (code: ${error.code})`
      );
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
  
  // Buscar semanas básicas de gold.desempenho (ETL automatizado)
  let query = supabase
    .schema('gold' as never)
    .from('desempenho')
    .select('*')
    .eq('bar_id', barId)
    .eq('granularidade', 'semanal')
    .order('ano', { ascending: true })
    .order('numero_semana', { ascending: true });
  
  if (ano) {
    query = query.eq('ano', ano);
  }

  const { data: semanasGold, error } = await query;

  if (error) {
    console.error('❌ Erro em gold.desempenho:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      barId,
      ano,
    });
    throw new Error(
      `Erro ao carregar desempenho semanal: ${error.message} (code: ${error.code})`
    );
  }

  if (!semanasGold || semanasGold.length === 0) {
    const hoje = new Date();
    return { semanas: [], semanaAtual: getWeekNumber(hoje), anoAtual: hoje.getFullYear() };
  }

  // LEFT JOIN meta.desempenho_semanal para campos manuais (RH, checklists, observacoes, audit)
  let metaQuery = supabase
    .schema('meta' as never)
    .from('desempenho_semanal')
    .select(`
      bar_id, ano, numero_semana,
      observacoes, alertas_dados, nota_felicidade_equipe, vagas_abertas,
      num_testes_ps, perc_comparecimento_ps, aprovados_ps, absenteismo,
      perc_checklist_producao, perc_checklist_rh, perc_checklist_semanal_terca,
      quorum_pesquisa_felicidade, conciliacoes_pendentes, erros_pente_fino,
      consumacao_sem_socio, meta_semanal, atingimento,
      atualizado_em, atualizado_por, atualizado_por_nome
    `)
    .eq('bar_id', barId);
  
  if (ano) {
    metaQuery = metaQuery.eq('ano', ano);
  }

  const { data: metaManuais } = await metaQuery;

  // Merge Gold (automatizado) + Meta (campos manuais)
  const metaMap = new Map<string, any>();
  (metaManuais || []).forEach(m => 
    metaMap.set(`${m.ano}-${m.numero_semana}`, m)
  );

  const semanas = semanasGold.map(g => {
    const meta = metaMap.get(`${g.ano}-${g.numero_semana}`);
    return {
      ...g,
      observacoes: meta?.observacoes ?? null,
      alertas_dados: meta?.alertas_dados ?? null,
      nota_felicidade_equipe: meta?.nota_felicidade_equipe ?? null,
      vagas_abertas: meta?.vagas_abertas ?? null,
      num_testes_ps: meta?.num_testes_ps ?? null,
      perc_comparecimento_ps: meta?.perc_comparecimento_ps ?? null,
      aprovados_ps: meta?.aprovados_ps ?? null,
      absenteismo: meta?.absenteismo ?? null,
      perc_checklist_producao: meta?.perc_checklist_producao ?? null,
      perc_checklist_rh: meta?.perc_checklist_rh ?? null,
      perc_checklist_semanal_terca: meta?.perc_checklist_semanal_terca ?? null,
      quorum_pesquisa_felicidade: meta?.quorum_pesquisa_felicidade ?? null,
      conciliacoes_pendentes: meta?.conciliacoes_pendentes ?? null,
      erros_pente_fino: meta?.erros_pente_fino ?? null,
      consumacao_sem_socio: meta?.consumacao_sem_socio ?? null,
      meta_semanal: meta?.meta_semanal ?? null,
      atingimento: meta?.atingimento ?? null,
      atualizado_em: meta?.atualizado_em ?? g.calculado_em,
      atualizado_por: meta?.atualizado_por ?? null,
      atualizado_por_nome: meta?.atualizado_por_nome ?? 'Sistema ETL',
    };
  });

  // Buscar Marketing
  let marketingQuery = supabase
    .schema('meta' as never)
    .from('marketing_semanal')
    .select('*')
    .eq('bar_id', barId);
  
  if (ano) {
    marketingQuery = marketingQuery.eq('ano', ano);
  }

  const { data: marketingData, error: marketingError } = await marketingQuery;

  if (marketingError) {
    console.error('❌ Erro em meta.marketing_semanal:', {
      message: marketingError.message,
      code: marketingError.code,
      details: marketingError.details,
      hint: marketingError.hint,
      barId,
      ano,
    });
    throw new Error(
      `Erro ao carregar marketing semanal: ${marketingError.message} (code: ${marketingError.code})`
    );
  }

  const marketingMap = new Map<string, MarketingSemanalRow>();
  (marketingData as MarketingSemanalRow[] | null | undefined)?.forEach((m) =>
    marketingMap.set(`${m.ano}-${m.semana}`, m)
  );

  // Buscar CMV Semanal
  let cmvQuery = supabase
    .schema('financial' as never)
    .from('cmv_semanal')
    .select('semana, ano, cmv_real, cmv_limpo_percentual, faturamento_cmvivel')
    .eq('bar_id', barId);
  
  if (ano) {
    cmvQuery = cmvQuery.eq('ano', ano);
  }

  const { data: cmvData, error: cmvError } = await cmvQuery;

  if (cmvError) {
    console.error('❌ Erro em financial.cmv_semanal:', {
      message: cmvError.message,
      code: cmvError.code,
      details: cmvError.details,
      hint: cmvError.hint,
      barId,
      ano,
    });
    throw new Error(
      `Erro ao carregar CMV semanal: ${cmvError.message} (code: ${cmvError.code})`
    );
  }

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
    // Conta Assinada (de bronze.bronze_contahub_financeiro_pagamentosrecebidos)
    // Tabela renomeada na migração medallion (antes: bronze_contahub_financeiro_pagamentos).
    const pagamentos = await fetchAllPaginated<{ dt_gerencial: string; liquido: number }>(
      supabase,
      'bronze_contahub_financeiro_pagamentosrecebidos',
      'dt_gerencial, liquido',
      [
        { column: 'bar_id', operator: 'eq', value: barId },
        { column: 'meio', operator: 'eq', value: 'Conta Assinada' },
        { column: 'dt_gerencial', operator: 'gte', value: dataMin },
        { column: 'dt_gerencial', operator: 'lte', value: dataMax },
      ],
      1000,
      'bronze'
    );

    pagamentos.forEach(p => {
      const semana = semanas.find(s => p.dt_gerencial >= s.data_inicio && p.dt_gerencial <= s.data_fim);
      if (semana) {
        const key = `${semana.ano}-${semana.numero_semana}`;
        contaAssinadaMap.set(key, (contaAssinadaMap.get(key) || 0) + Number(p.liquido || 0));
      }
    });

    // Descontos (antes: 'visitas', deletada na migração medallion).
    // Substituído por bronze.bronze_contahub_avendas_vendasperiodo, que contém
    // 1 linha por venda do ContaHub. Remapeamento de colunas:
    //   data_visita      → vd_dtgerencial
    //   valor_desconto   → vd_vrdescontos
    //   motivo_desconto  → vd_motivodesconto
    const descontosRaw = await fetchAllPaginated<{
      vd_dtgerencial: string;
      vd_vrdescontos: number;
      vd_motivodesconto: string | null;
    }>(
      supabase,
      'bronze_contahub_avendas_vendasperiodo',
      'vd_dtgerencial, vd_vrdescontos, vd_motivodesconto',
      [
        { column: 'bar_id', operator: 'eq', value: barId },
        { column: 'vd_vrdescontos', operator: 'gt', value: 0 },
        { column: 'vd_dtgerencial', operator: 'gte', value: dataMin },
        { column: 'vd_dtgerencial', operator: 'lte', value: dataMax },
      ],
      1000,
      'bronze'
    );

    // Mapeia para o shape antigo para não tocar no resto do código de agrupamento.
    const descontos = descontosRaw.map((d) => ({
      data_visita: d.vd_dtgerencial,
      valor_desconto: Number(d.vd_vrdescontos || 0),
      motivo_desconto: d.vd_motivodesconto,
    }));

    // Processar descontos (agrupamento)
    descontos.forEach(d => {
      const semana = semanas.find(s => d.data_visita >= s.data_inicio && d.data_visita <= s.data_fim);
      if (semana) {
        const key = `${semana.ano}-${semana.numero_semana}`;
        const valor = Number(d.valor_desconto || 0);
        const motivo = d.motivo_desconto || 'Sem motivo';
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

    // NPS Falaê diário agregado -> semanal (schema 'crm' após migração)
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
      ],
      1000,
      'crm'
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
      ],
      1000,
      'integrations'
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
      // Mapear cancelamentos_total (gold) para cancelamentos (types)
      cancelamentos: toNum((s as any).cancelamentos_total) ?? toNum(s.cancelamentos) ?? s.cancelamentos,
      // Mapear tempos de drinks (gold ETL v2): tempo_drinks em SEGUNDOS -> converter para MINUTOS
      // Filtrar clamp 9999 (outliers) como null para UI mostrar "-"
      tempo_saida_bar: ((s as any).tempo_drinks && toNum((s as any).tempo_drinks)! < 9999) ? Math.round(toNum((s as any).tempo_drinks)! / 60 * 100) / 100 : null,
      tempo_drinks: toNum((s as any).tempo_drinks) ?? (s as any).tempo_drinks,
      // Mapear tempo cozinha (gold ETL v2): tempo_cozinha em SEGUNDOS -> converter para MINUTOS
      // Filtrar clamp 9999 (outliers) como null para UI mostrar "-"
      tempo_saida_cozinha: ((s as any).tempo_cozinha && toNum((s as any).tempo_cozinha)! < 9999) ? Math.round(toNum((s as any).tempo_cozinha)! / 60 * 100) / 100 : null,
      // Mapear atrasinhos/atrasões drinks (gold ETL v2) para os campos esperados pela UI
      atrasinhos_bar: toNum((s as any).atrasinho_drinks) ?? toNum(s.atrasinhos_bar) ?? s.atrasinhos_bar,
      atrasinho_drinks: toNum((s as any).atrasinho_drinks) ?? (s as any).atrasinho_drinks,
      atrasos_bar: toNum((s as any).atrasao_drinks) ?? toNum(s.atrasos_bar) ?? s.atrasos_bar,
      atrasao_drinks: toNum((s as any).atrasao_drinks) ?? (s as any).atrasao_drinks,
      atrasos_bar_perc: toNum((s as any).atrasos_drinks_perc) ?? toNum(s.atrasos_bar_perc) ?? s.atrasos_bar_perc,
      atrasos_drinks_perc: toNum((s as any).atrasos_drinks_perc) ?? (s as any).atrasos_drinks_perc,
      qtd_drinks_total: toNum((s as any).qtd_drinks_total) ?? (s as any).qtd_drinks_total,
      atrasinhos_bar_perc: toNum(s.atrasinhos_bar_perc) ?? s.atrasinhos_bar_perc,
      // Mapear atrasinhos/atrasões cozinha (gold ETL v2)
      atrasinhos_cozinha: toNum((s as any).atrasinho_cozinha) ?? toNum(s.atrasinhos_cozinha) ?? s.atrasinhos_cozinha,
      atrasinhos_cozinha_perc: toNum(s.atrasinhos_cozinha_perc) ?? s.atrasinhos_cozinha_perc,
      atrasos_cozinha: toNum((s as any).atrasao_cozinha) ?? toNum(s.atrasos_cozinha) ?? s.atrasos_cozinha,
      atrasos_cozinha_perc: toNum((s as any).atrasos_comida_perc) ?? toNum(s.atrasos_cozinha_perc) ?? s.atrasos_cozinha_perc,
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
        // Orgânico
        o_num_posts: marketing.o_num_posts,
        o_alcance: marketing.o_alcance,
        o_interacao: marketing.o_interacao,
        o_compartilhamento: marketing.o_compartilhamento,
        o_engajamento: marketing.o_engajamento,
        o_num_stories: marketing.o_num_stories,
        o_visu_stories: marketing.o_visu_stories,
        // Meta Ads
        m_valor_investido: marketing.m_valor_investido,
        m_alcance: marketing.m_alcance,
        m_frequencia: marketing.m_frequencia,
        m_cpm: marketing.m_cpm,
        m_cliques: marketing.m_cliques,
        m_ctr: marketing.m_ctr,
        m_custo_por_clique: marketing.m_cpc,
        m_conversas_iniciadas: marketing.m_conversas_iniciadas,
        // Google Ads
        g_valor_investido: marketing.g_valor_investido,
        g_impressoes: marketing.g_impressoes,
        g_cliques: marketing.g_cliques,
        g_ctr: marketing.g_ctr,
        g_solicitacoes_rotas: marketing.g_solicitacoes_rotas,
        // Google Meu Negócio
        gmn_total_visualizacoes: marketing.gmn_total_visualizacoes,
        gmn_total_acoes: marketing.gmn_total_acoes,
        gmn_solicitacoes_rotas: marketing.gmn_solicitacoes_rotas,
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
