import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();

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
    const periodo = parseInt(searchParams.get('periodo') || '12', 10); // meses
    const minShows = parseInt(searchParams.get('min_shows') || '2', 10);

    const dataInicial = new Date();
    dataInicial.setMonth(dataInicial.getMonth() - periodo);
    const dataInicialStr = dataInicial.toISOString().split('T')[0];
    const hojeStr = new Date().toISOString().split('T')[0];

    // 1) Eventos válidos do período (dias com operação) — base para métricas e baseline
    const { data: eventosRaw, error: evErr } = await supabase
      .from('eventos_base')
      .select('id, data_evento, dia_semana, real_r, cl_real, c_art, t_medio, faturamento_bar')
      .eq('bar_id', barId)
      .gt('real_r', 1000)
      .gte('data_evento', dataInicialStr)
      .lte('data_evento', hojeStr)
      .order('data_evento', { ascending: true });
    if (evErr) throw evErr;

    const eventos: EventoRow[] = (eventosRaw || []).map((e: any) => ({
      id: e.id,
      data_evento: e.data_evento,
      dia_semana: e.dia_semana || '',
      real_r: parseFloat(e.real_r) || 0,
      cl_real: e.cl_real || 0,
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
    const ops = (supabase as any).schema('operations');
    const eventoIds = eventos.map((e) => e.id);
    const { data: linksRaw, error: lkErr } = await ops
      .from('evento_artistas')
      .select('evento_id, artista_id, artista_nome, c_art, horario_inicio, horario_fim')
      .eq('bar_id', barId);
    if (lkErr) throw lkErr;

    const links = (linksRaw || []).filter((l: any) => eventoById.has(l.evento_id));

    // quantos artistas por evento (para ratear custo em co-headline)
    const artistasPorEvento = new Map<number, number>();
    for (const l of links) {
      artistasPorEvento.set(l.evento_id, (artistasPorEvento.get(l.evento_id) || 0) + 1);
    }

    // cadastro para tipo (banda/dj/solo)
    const { data: cadastro } = await ops
      .from('bar_artistas')
      .select('id, nome, tipo')
      .eq('bar_id', barId);
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
      const ev = eventoById.get(l.evento_id)!;
      const chave = l.artista_id ? `id:${l.artista_id}` : `nome:${String(l.artista_nome || '').trim().toLowerCase()}`;
      const nArt = artistasPorEvento.get(l.evento_id) || 1;
      const custoLink = l.c_art != null && l.c_art !== '' ? parseFloat(l.c_art) : null;
      const custo = custoLink != null && !isNaN(custoLink) ? custoLink : (nArt > 0 ? ev.c_art / nArt : ev.c_art);

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
        const consumo_total = shows.reduce((s, e) => s + (e.consumo || 0), 0);
        const consumo_medio = consumo_total / n;
        const retorno = custo_total > 0 ? fat_total / custo_total : null; // R$ faturado por R$ de cachê
        const pct_cachet = fat_total > 0 ? (custo_total / fat_total) * 100 : null; // % do fat que vira cachê

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

        return {
          artista_id: a.artista_id,
          nome: a.nome,
          tipo: a.tipo,
          shows: n,
          fat_total, fat_medio,
          publico_total, publico_medio,
          custo_total, custo_medio,
          ticket_medio,
          roi,
          fat_max, fat_min: fat_min === Infinity ? 0 : fat_min,
          consumo_total, consumo_medio,
          retorno, pct_cachet,
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

    return NextResponse.json({
      success: true,
      sem_dados: links.length === 0,
      data: atracoes,
      stats,
      periodo: { inicio: dataInicialStr, fim: hojeStr, meses: periodo },
    });
  } catch (error: any) {
    console.error('Erro ao buscar atrações:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Erro ao buscar dados de atrações' }, { status: 500 });
  }
}
