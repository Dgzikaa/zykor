import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { agregarDimensoes } from '@/lib/analytics/nps-dimensoes';

export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();

// Cache em memória do ranking (instância morna do Fluid Compute). O dado muda ~1x/dia
// (ETL), então servir de cache por alguns minutos deixa a re-navegação instantânea.
const rankingCache = new Map<string, { at: number; payload: any }>();
const RANKING_TTL_MS = 5 * 60 * 1000;

function getBarId(request: NextRequest): number | null {
  const { searchParams } = new URL(request.url);
  const h = request.headers.get('x-selected-bar-id');
  const q = searchParams.get('bar_id');
  return parseInt(String(h || q || ''), 10) || null;
}

interface EventoRow {
  id: number;
  data_evento: string;
  dia_semana: string;
  real_r: number;
  cl_real: number;
  c_art: number;
  t_medio: number;
  faturamento_bar: number; // consumo do bar na noite
}

interface ShowArtista {
  evento_id: number;
  data: string;
  dia_semana: string;
  faturamento: number;
  publico: number;
  custo: number;
  ticket: number;
  consumo: number; // faturamento de bar/consumo da noite
  co_headline: boolean; // evento com mais de 1 artista
}

/**
 * Análise de atrações a partir da estrutura relacional operations.evento_artistas
 * (1 evento -> N artistas), cruzando com as métricas do evento em eventos_base.
 * Nível 1: evolução/ROI/tendência por artista.
 * Nível 2: "lift" — quanto o artista rende acima da média da casa no mesmo dia-da-semana
 *          (baseline calculado excluindo os shows do próprio artista).
 */
export async function GET(request: NextRequest) {
  try {
    const barId = getBarId(request);
    if (!barId) {
      return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });
    }
    const { searchParams } = new URL(request.url);
    const ops = (supabase as any).schema('operations');

    // Filtros globais da Visão do Artista: período (de/ate) + dia da semana (dow 0=dom..6=sáb).
    const de = searchParams.get('de') || null;
    const ate = searchParams.get('ate') || null;
    const dowRaw = searchParams.get('dow');
    const dow = dowRaw != null && dowRaw !== '' ? Number(dowRaw) : null;

    // Modo artista-first: lista p/ dropdown (respeita o filtro → só artistas que tocaram no período)
    if (searchParams.get('view') === 'lista') {
      const { data, error } = await ops.rpc('fn_artista_lista', { p_bar: barId, p_ini: de, p_fim: ate, p_dow: dow });
      if (error) throw error;
      return NextResponse.json({ success: true, lista: data || [] });
    }
    // NPS por artista (silver.nps_artista_respostas) — resumo + cada resposta, com filtro de período + dow.
    // NPS vem da "Data da Visita" do Falae vinculada ao artista da noite (ver project_nps_por_artista).
    if (searchParams.get('view') === 'nps') {
      const artistaId = Number(searchParams.get('artista_id'));
      if (!artistaId) return NextResponse.json({ success: true, resumo: null, respostas: [] });
      let q = (supabase as any).schema('silver')
        .from('nps_artista_respostas')
        .select('nps, data_visita, categoria, evento_nome, comentario')
        .eq('bar_id', barId).eq('artista_id', artistaId);
      if (de) q = q.gte('data_visita', de);
      if (ate) q = q.lte('data_visita', ate);
      const { data, error } = await q.order('data_visita', { ascending: false });
      if (error) throw error;
      // dia da semana: filtra pela data da visita (getUTCDay p/ casar com o corte ISO do frontend)
      const respostas = (dow == null ? (data || []) : (data || []).filter((r: any) => r.data_visita && new Date(r.data_visita + 'T12:00:00Z').getUTCDay() === dow));
      const n = respostas.length;
      const promot = respostas.filter((r: any) => r.categoria === 'promotor').length;
      const detrat = respostas.filter((r: any) => r.categoria === 'detrator').length;
      const soma = respostas.reduce((s: number, r: any) => s + (Number(r.nps) || 0), 0);
      const resumo = n === 0 ? null : {
        respostas: n,
        nps_medio: Math.round((soma / n) * 100) / 100,
        nps_score: Math.round((promot / n) * 100 - (detrat / n) * 100),
        promotores: promot, neutros: n - promot - detrat, detratores: detrat,
      };
      // #1 dimensões: notas por sub-critério (Atendimento/Comida/Música/Tempo...) das noites do artista
      let dimensoes: any[] = [];
      const { data: linkRows } = await ops.from('evento_artistas').select('evento_id').eq('bar_id', barId).eq('artista_id', artistaId);
      const evIds = (linkRows || []).map((l: any) => l.evento_id);
      if (evIds.length) {
        let cq = (supabase as any).schema('silver').from('nps_criterio_evento')
          .select('criterio_raw, nota, data_visita').eq('bar_id', barId).in('evento_id', evIds);
        if (de) cq = cq.gte('data_visita', de);
        if (ate) cq = cq.lte('data_visita', ate);
        const { data: critRows } = await cq;
        const critF = dow == null ? (critRows || []) : (critRows || []).filter((r: any) => r.data_visita && new Date(r.data_visita + 'T12:00:00Z').getUTCDay() === dow);
        dimensoes = agregarDimensoes(critF);
      }
      return NextResponse.json({ success: true, resumo, respostas, dimensoes });
    }

    // Modo artista-first: trajetória completa de 1 artista
    const artistaIdParam = searchParams.get('artista_id');
    if (artistaIdParam) {
      const { data, error } = await ops.rpc('fn_artista_trajetoria', { p_bar: barId, p_artista_id: Number(artistaIdParam), p_ini: de, p_fim: ate, p_dow: dow });
      if (error) throw error;
      return NextResponse.json({ success: true, artista: data || null });
    }

    const periodo = parseInt(searchParams.get('periodo') || '12', 10); // meses
    const minShows = parseInt(searchParams.get('min_shows') || '2', 10);

    const dataInicial = new Date();
    dataInicial.setMonth(dataInicial.getMonth() - periodo);
    const dataInicialStr = dataInicial.toISOString().split('T')[0];
    const hojeStr = new Date().toISOString().split('T')[0];

    // mix + consumação são pesados (fn_consumo_por_artista ~12s) e nenhuma tela do ranking
    // exibe esses campos → só computa com ?extras=1. Off por padrão.
    const extras = searchParams.get('extras') === '1';

    // cache morno (instância do Fluid Compute): re-navegação no mesmo período volta instantânea
    const cacheKey = `rank:${barId}:${periodo}:${minShows}:${extras ? 1 : 0}`;
    const hit = rankingCache.get(cacheKey);
    if (hit && Date.now() - hit.at < RANKING_TTL_MS) return NextResponse.json(hit.payload);

    const gold = (supabase as any).schema('gold');
    const fin = (supabase as any).schema('financial');
    const silver = (supabase as any).schema('silver');

    // 1) Todas as queries independentes em PARALELO (antes eram awaits sequenciais → somavam o tempo).
    const [evRes, lkRes, caRes, cadRes, npsRes, mixRes, consRes] = await Promise.all([
      supabase.from('eventos_base')
        .select('id, data_evento, dia_semana, real_r, cl_real, publico_real, c_art, t_medio, faturamento_bar')
        .eq('bar_id', barId).gt('real_r', 1000)
        .gte('data_evento', dataInicialStr).lte('data_evento', hojeStr)
        .order('data_evento', { ascending: true }),
      ops.from('evento_artistas')
        .select('evento_id, artista_id, artista_nome, c_art, horario_inicio, horario_fim')
        .eq('bar_id', barId),
      ops.rpc('fn_ca_cache_artista', { p_bar: barId, p_ini: dataInicialStr, p_fim: hojeStr }),
      ops.from('bar_artistas').select('id, nome, tipo').eq('bar_id', barId),
      silver.from('nps_artista_respostas')
        .select('artista_id, nps, categoria')
        .eq('bar_id', barId).gte('data_visita', dataInicialStr).lte('data_visita', hojeStr),
      extras
        ? gold.from('mix_produtos_diario').select('dt_gerencial, categoria_mix, faturamento')
            .eq('bar_id', barId).gte('dt_gerencial', dataInicialStr).lte('dt_gerencial', hojeStr)
        : Promise.resolve({ data: [] as any[] }),
      extras
        ? fin.rpc('fn_consumo_por_artista', { p_bar: barId, p_ini: dataInicialStr, p_fim: hojeStr })
        : Promise.resolve({ data: [] as any[] }),
    ]);
    if (evRes.error) throw evRes.error;
    const eventosRaw = evRes.data;

    const eventos: EventoRow[] = (eventosRaw || []).map((e: any) => ({
      id: e.id,
      data_evento: e.data_evento,
      dia_semana: e.dia_semana || '',
      real_r: parseFloat(e.real_r) || 0,
      cl_real: Math.max(e.cl_real || 0, e.publico_real || 0), // público total (inclui bilheteria)
      c_art: parseFloat(e.c_art) || 0,
      t_medio: parseFloat(e.t_medio) || 0,
      faturamento_bar: parseFloat(e.faturamento_bar) || 0,
    }));
    const eventoById = new Map<number, EventoRow>(eventos.map((e) => [e.id, e]));

    // baseline por dia-da-semana (todos os eventos válidos do período)
    const eventosPorDow = new Map<string, EventoRow[]>();
    for (const e of eventos) {
      const arr = eventosPorDow.get(e.dia_semana) || [];
      arr.push(e);
      eventosPorDow.set(e.dia_semana, arr);
    }

    // 2) Ligações artista -> evento (só as que caem no período)
    const linksRaw = lkRes.data;
    const links = (linksRaw || []).filter((l: any) => eventoById.has(l.evento_id));

    // quantos artistas por evento (para ratear custo em co-headline)
    const artistasPorEvento = new Map<number, number>();
    for (const l of links) {
      artistasPorEvento.set(l.evento_id, (artistasPorEvento.get(l.evento_id) || 0) + 1);
    }

    // cachê EXATO por (evento, artista) do Conta Azul — mesma fonte da trajetória (não rateio)
    const caCacheRaw = caRes.data;
    const caCacheMap = new Map<string, number>();
    for (const r of caCacheRaw || []) caCacheMap.set(`${r.evento_id}:${r.artista_id}`, Number(r.cachet) || 0);

    // PRINCIPAL da noite = artista de MAIOR cachê (modelo da casa). A noite (fat/público) é creditada
    // SÓ ao principal — senão um DJ de apoio numa noite de festival herda o público inteiro (bug do Larbac).
    const custoDeLink = (l: any): number => {
      const cm = l.artista_id ? (caCacheMap.get(`${l.evento_id}:${l.artista_id}`) || 0) : 0;
      if (cm > 0) return cm;
      const cl = l.c_art != null && l.c_art !== '' ? parseFloat(l.c_art) : 0;
      if (cl > 0) return cl;
      const n = artistasPorEvento.get(l.evento_id) || 1;
      return n === 1 ? (eventoById.get(l.evento_id)?.c_art || 0) : 0;
    };
    const principalPorEvento = new Map<number, number | null>();
    const bestCusto = new Map<number, number>();
    for (const l of links) {
      const c = custoDeLink(l);
      if (c > (bestCusto.get(l.evento_id) ?? -1)) { bestCusto.set(l.evento_id, c); principalPorEvento.set(l.evento_id, l.artista_id ?? null); }
    }

    // cadastro para tipo (banda/dj/solo)
    const cadastro = cadRes.data;
    const tipoPorId = new Map<number, string>((cadastro || []).map((a: any) => [a.id, a.tipo]));
    const tipoPorNome = new Map<string, string>((cadastro || []).map((a: any) => [a.nome, a.tipo]));

    // 3) Agrupa por artista (chave = artista_id quando existe, senão nome normalizado)
    interface Acc {
      chave: string;
      artista_id: number | null;
      nome: string;
      tipo: string;
      shows: ShowArtista[];
      eventoIds: Set<number>;
    }
    const mapa = new Map<string, Acc>();
    for (const l of links) {
      // credita a noite (fat/público/cachê) SÓ ao principal; apoio não entra no ranking daquela noite
      if (principalPorEvento.get(l.evento_id) !== (l.artista_id ?? null)) continue;
      const ev = eventoById.get(l.evento_id)!;
      const chave = l.artista_id ? `id:${l.artista_id}` : `nome:${String(l.artista_nome || '').trim().toLowerCase()}`;
      const nArt = artistasPorEvento.get(l.evento_id) || 1;
      const custoLink = l.c_art != null && l.c_art !== '' ? parseFloat(l.c_art) : null;
      const caMatch = l.artista_id ? caCacheMap.get(`${l.evento_id}:${l.artista_id}`) : undefined;
      // MESMO critério da trajetória: cachê exato do CA > manual no link > c_art do evento SÓ em noite
      // solo > 0 (co-headline sem match = desconhecido, NÃO rateia — pra bater com o relatório do artista)
      const custo = caMatch != null && caMatch > 0 ? caMatch
        : (custoLink != null && !isNaN(custoLink) ? custoLink
          : (nArt === 1 ? ev.c_art : 0));

      let acc = mapa.get(chave);
      if (!acc) {
        acc = {
          chave,
          artista_id: l.artista_id ?? null,
          nome: l.artista_nome || '(sem nome)',
          tipo: (l.artista_id && tipoPorId.get(l.artista_id)) || tipoPorNome.get(l.artista_nome) || 'banda',
          shows: [],
          eventoIds: new Set<number>(),
        };
        mapa.set(chave, acc);
      }
      acc.eventoIds.add(l.evento_id);
      acc.shows.push({
        evento_id: l.evento_id,
        data: ev.data_evento,
        dia_semana: ev.dia_semana,
        faturamento: ev.real_r,
        publico: ev.cl_real,
        custo,
        ticket: ev.t_medio,
        consumo: ev.faturamento_bar,
        co_headline: nArt > 1,
      });
    }

    const media = (arr: number[]) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0);

    // mix de produtos por dia (BEBIDA/DRINK/COMIDA) — só com ?extras=1 (view pesada ~1s)
    const mixRaw = mixRes.data;
    const mixPorData = new Map<string, { bebida: number; drink: number; comida: number }>();
    for (const r of mixRaw || []) {
      const d = String(r.dt_gerencial).slice(0, 10);
      const o = mixPorData.get(d) || { bebida: 0, drink: 0, comida: 0 };
      const cat = String(r.categoria_mix || '').toUpperCase();
      const val = Number(r.faturamento) || 0;
      if (cat === 'BEBIDA') o.bebida += val;
      else if (cat === 'DRINK') o.drink += val;
      else if (cat === 'COMIDA') o.comida += val;
      mixPorData.set(d, o);
    }

    // consumação do PRÓPRIO artista (só com ?extras=1 — fn_consumo_por_artista ~12s)
    const consArtRaw = consRes.data;
    const consumoPorArtista = new Map<number, number>();
    for (const r of consArtRaw || []) if (r.artista_id != null) consumoPorArtista.set(Number(r.artista_id), Number(r.valor) || 0);

    // NPS por artista no MESMO período do ranking (Falae · Data da Visita → artista da noite).
    const npsRows = npsRes.data;
    const npsPorArtista = new Map<number, { n: number; soma: number; promot: number; detrat: number }>();
    for (const r of npsRows || []) {
      if (r.artista_id == null) continue;
      const a = npsPorArtista.get(Number(r.artista_id)) || { n: 0, soma: 0, promot: 0, detrat: 0 };
      a.n++; a.soma += Number(r.nps) || 0;
      if (r.categoria === 'promotor') a.promot++; else if (r.categoria === 'detrator') a.detrat++;
      npsPorArtista.set(Number(r.artista_id), a);
    }

    const atracoes = Array.from(mapa.values())
      .filter((a) => a.shows.length >= minShows)
      .map((a) => {
        const shows = [...a.shows].sort((x, y) => (x.data < y.data ? 1 : -1)); // desc
        const showsAsc = [...shows].reverse();
        const n = shows.length;
        const fat_total = shows.reduce((s, e) => s + e.faturamento, 0);
        const publico_total = shows.reduce((s, e) => s + e.publico, 0);
        const custo_total = shows.reduce((s, e) => s + e.custo, 0);
        const fat_medio = fat_total / n;
        const publico_medio = Math.round(publico_total / n);
        const custo_medio = custo_total / n;
        const ticket_medio = media(shows.map((e) => e.ticket));
        const roi = custo_total > 0 ? ((fat_total - custo_total) / custo_total) * 100 : null;
        // rankings extras: maior/menor noite, consumo do bar, retorno e % do fat que vira cachê
        const fat_max = shows.reduce((m, e) => Math.max(m, e.faturamento), 0);
        const fat_min = shows.reduce((m, e) => Math.min(m, e.faturamento), Infinity);
        // datas únicas dos shows do artista (p/ mix)
        const datasArtista = new Set(shows.map((e) => String(e.data).slice(0, 10)));
        // consumação = consumo do PRÓPRIO artista (cortesia dele), vinculada por artista
        const consumo_total = a.artista_id ? (consumoPorArtista.get(a.artista_id) || 0) : 0;
        const consumo_medio = n ? consumo_total / n : 0;
        const retorno = custo_total > 0 ? fat_total / custo_total : null; // R$ faturado por R$ de cachê
        const pct_cachet = fat_total > 0 ? (custo_total / fat_total) * 100 : null; // % do fat que vira cachê
        // mix de produtos nas noites do artista (soma por categoria nas datas únicas dos shows)
        let mix_bebida = 0, mix_drink = 0, mix_comida = 0;
        for (const d of datasArtista) { const m = mixPorData.get(d); if (m) { mix_bebida += m.bebida; mix_drink += m.drink; mix_comida += m.comida; } }
        const mix_total = mix_bebida + mix_drink + mix_comida;
        const pct_drink = mix_total > 0 ? (mix_drink / mix_total) * 100 : null;
        const pct_bebida = mix_total > 0 ? (mix_bebida / mix_total) * 100 : null;
        const pct_comida = mix_total > 0 ? (mix_comida / mix_total) * 100 : null;

        // tendência (3 shows mais recentes vs anteriores)
        let tendencia: 'subindo' | 'estavel' | 'caindo' = 'estavel';
        if (n >= 4) {
          const rec = media(shows.slice(0, 3).map((e) => e.faturamento));
          const ant = media(shows.slice(3).map((e) => e.faturamento));
          const varp = ant > 0 ? ((rec - ant) / ant) * 100 : 0;
          if (varp > 10) tendencia = 'subindo';
          else if (varp < -10) tendencia = 'caindo';
        }

        const ultimo_show = shows[0]?.data || '';
        const dias_sem_tocar = ultimo_show
          ? Math.floor((Date.now() - new Date(ultimo_show).getTime()) / 86400000)
          : 0;

        // Nível 2 — lift vs baseline do mesmo dia-da-semana (excluindo os próprios shows)
        let baseFatSum = 0, basePubSum = 0, baseN = 0;
        for (const e of shows) {
          const pool = (eventosPorDow.get(e.dia_semana) || []).filter((x) => !a.eventoIds.has(x.id));
          if (pool.length) {
            baseFatSum += media(pool.map((p) => p.real_r));
            basePubSum += media(pool.map((p) => p.cl_real));
            baseN++;
          }
        }
        const baseline_fat = baseN ? baseFatSum / baseN : null;
        const baseline_publico = baseN ? Math.round(basePubSum / baseN) : null;
        const lift_fat = baseline_fat != null ? fat_medio - baseline_fat : null;
        const lift_fat_pct = baseline_fat && baseline_fat > 0 ? ((fat_medio - baseline_fat) / baseline_fat) * 100 : null;
        const lift_publico = baseline_publico != null ? publico_medio - baseline_publico : null;

        // NPS do artista no período (null quando não há respostas vinculadas)
        const npsAcc = a.artista_id ? npsPorArtista.get(a.artista_id) : null;
        const nps_respostas = npsAcc?.n || 0;
        const nps_medio = npsAcc && npsAcc.n ? Math.round((npsAcc.soma / npsAcc.n) * 100) / 100 : null;
        const nps_score = npsAcc && npsAcc.n ? Math.round((npsAcc.promot / npsAcc.n) * 100 - (npsAcc.detrat / npsAcc.n) * 100) : null;

        return {
          artista_id: a.artista_id,
          nome: a.nome,
          tipo: a.tipo,
          shows: n,
          nps_respostas, nps_medio, nps_score,
          fat_total, fat_medio,
          publico_total, publico_medio,
          custo_total, custo_medio,
          ticket_medio,
          roi,
          fat_max, fat_min: fat_min === Infinity ? 0 : fat_min,
          consumo_total, consumo_medio,
          retorno, pct_cachet,
          mix_bebida, mix_drink, mix_comida, mix_total,
          pct_drink, pct_bebida, pct_comida,
          tendencia,
          ultimo_show,
          dias_sem_tocar,
          baseline_fat, baseline_publico,
          lift_fat, lift_fat_pct, lift_publico,
          // série temporal ascendente para gráfico
          eventos: showsAsc.map((e) => ({
            data: e.data,
            dia_semana: e.dia_semana,
            faturamento: e.faturamento,
            publico: e.publico,
            custo: e.custo,
            ticket: e.ticket,
            co_headline: e.co_headline,
          })),
        };
      })
      .sort((a, b) => b.fat_total - a.fat_total);

    const comRoi = atracoes.filter((a) => a.roi !== null);
    const stats = {
      total_atracoes: atracoes.length,
      total_shows: atracoes.reduce((s, a) => s + a.shows, 0),
      fat_total: atracoes.reduce((s, a) => s + a.fat_total, 0),
      custo_total: atracoes.reduce((s, a) => s + a.custo_total, 0),
      roi_medio: comRoi.length ? comRoi.reduce((s, a) => s + (a.roi || 0), 0) / comRoi.length : null,
      top_faturamento: atracoes[0]?.nome || null,
      top_roi: [...comRoi].sort((a, b) => (b.roi || 0) - (a.roi || 0))[0]?.nome || null,
      top_publico: [...atracoes].sort((a, b) => b.publico_medio - a.publico_medio)[0]?.nome || null,
      top_lift: [...atracoes].filter((a) => a.lift_fat != null).sort((a, b) => (b.lift_fat || 0) - (a.lift_fat || 0))[0]?.nome || null,
    };

    const payload = {
      success: true,
      sem_dados: links.length === 0,
      data: atracoes,
      stats,
      periodo: { inicio: dataInicialStr, fim: hojeStr, meses: periodo },
    };
    rankingCache.set(cacheKey, { at: Date.now(), payload });
    return NextResponse.json(payload);
  } catch (error: any) {
    console.error('Erro ao buscar atrações:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Erro ao buscar dados de atrações' }, { status: 500 });
  }
}
