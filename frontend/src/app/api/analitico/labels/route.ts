import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { agregarDimensoes } from '@/lib/analytics/nps-dimensoes';

export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();

function getBarId(request: NextRequest): number | null {
  const h = request.headers.get('x-selected-bar-id');
  const q = new URL(request.url).searchParams.get('bar_id');
  return parseInt(String(h || q || ''), 10) || null;
}

// ---------------------------------------------------------------------------
// Canonicalização de LABEL (operations.eventos_base.nome)
// Os nomes são sujos: variam em caixa/acento/hífen ("Pagode Vira Lata" vs
// "Pagode Vira-Lata") e o histórico antigo cola o artista no nome
// ("Sambadona e DJ Jess", "STZ + Sambadona + ...", "Quintal do Pagode com HH").
// A partir da separação Label/Artistas no Planejamento os nomes ficaram limpos,
// mas p/ análise histórica normalizamos e cortamos o sufixo de guest/co-headline.
// NB: em JS o `\b` é fronteira de palavra de verdade (no regex do Postgres é
// backspace — por isso a normalização precisa viver aqui, não no SQL).
// ---------------------------------------------------------------------------
const unaccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

function canonKey(nome: string): string {
  let s = unaccent(String(nome || ''))
    .toLowerCase()
    .replace(/-/g, ' ') // vira-lata -> vira lata
    .replace(/\s+/g, ' ')
    .trim();
  // corta o que vem depois de um separador de guest/co-headline
  s = s
    .replace(/\s*(?::|\+|\/|\be\s+dj\b|\bcom\s+dj\b|\bcom\s+hh\b|\bconvida\b|\bconvidados?\b|\bfeat\.?\b|\bft\.?\b|\bpart\.?\b|\bc\/\s*dj\b).*$/i, '')
    .trim();
  return s;
}

// nome de exibição bonito a partir do nome bruto (preserva caixa/hífen, mas
// aplica o mesmo corte de sufixo)
function displayFromRaw(nome: string): string {
  const s = String(nome || '').replace(/\s+/g, ' ').trim();
  return s
    .replace(/\s*(?::|\+|\/|\be\s+dj\b|\bcom\s+dj\b|\bcom\s+hh\b|\bconvida\b|\bconvidados?\b|\bfeat\.?\b|\bft\.?\b|\bpart\.?\b|\bc\/\s*dj\b).*$/i, '')
    .trim() || s;
}

// dia-da-semana canônico (o campo tem "Quarta"/"QUARTA", "TERCA"/"Terça"/"TERÇA")
const DIAS = ['DOMINGO', 'SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO'];
const DIA_LABEL: Record<string, string> = {
  DOMINGO: 'Domingo', SEGUNDA: 'Segunda', TERCA: 'Terça', QUARTA: 'Quarta',
  QUINTA: 'Quinta', SEXTA: 'Sexta', SABADO: 'Sábado',
};
const canonDia = (d: string) => {
  const u = unaccent(String(d || '')).toUpperCase().trim();
  return DIAS.includes(u) ? u : u;
};

// segunda-feira (ISO) da semana de uma data 'YYYY-MM-DD'
function weekStart(dateStr: string): string {
  const d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00');
  const dow = (d.getDay() + 6) % 7; // 0 = segunda
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}

const PALETA = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#f43f5e', '#84cc16'];

const mediaDe = (arr: number[]) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0);
function desvioPadrao(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mediaDe(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
}

interface Ev {
  id: number;
  data: string;
  dia: string;
  canon: string;
  raw: string;
  fat: number;
  publico: number;
  cache: number; // c_art do evento
  ticket: number;
  meta: number; // m1_r
  reservas: number;
  capacidade: number;
  bar: number; // faturamento_bar (consumo)
  couvert: number; // faturamento_couvert (entrada/couvert ContaHub)
}

interface ArtAcc {
  artista_id: number | null;
  nome: string;
  fats: number[];
  publicos: number[];
  caches: number[];
  melhor: { data: string; fat: number; publico: number } | null;
  pior: { data: string; fat: number; publico: number } | null;
}

export async function GET(request: NextRequest) {
  try {
    const barId = getBarId(request);
    if (!barId) return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const periodo = parseInt(searchParams.get('periodo') || '12', 10);
    const minShows = parseInt(searchParams.get('min_shows') || '3', 10);

    const dataInicial = new Date();
    dataInicial.setMonth(dataInicial.getMonth() - periodo);
    const iniStr = dataInicial.toISOString().split('T')[0];
    const hojeStr = new Date().toISOString().split('T')[0];

    const ops = (supabase as any).schema('operations');

    // 1) eventos válidos do período (mesma régua da tela de artistas: real_r > 1000)
    const { data: eventosRaw, error: evErr } = await supabase
      .from('eventos_base')
      .select('id, data_evento, dia_semana, nome, real_r, cl_real, publico_real, c_art, t_medio, m1_r, res_tot, lot_max, capacidade_estimada, faturamento_bar, faturamento_couvert')
      .eq('bar_id', barId)
      .gt('real_r', 1000)
      .not('nome', 'is', null)
      .gte('data_evento', iniStr)
      .lte('data_evento', hojeStr)
      .order('data_evento', { ascending: true });
    if (evErr) throw evErr;

    const eventos: Ev[] = (eventosRaw || [])
      .map((e: any) => {
        const raw = String(e.nome || '').trim();
        return {
          id: e.id,
          data: String(e.data_evento).slice(0, 10),
          dia: canonDia(e.dia_semana),
          canon: canonKey(raw),
          raw,
          fat: parseFloat(e.real_r) || 0,
          publico: Math.max(e.cl_real || 0, e.publico_real || 0),
          cache: parseFloat(e.c_art) || 0,
          ticket: parseFloat(e.t_medio) || 0,
          meta: parseFloat(e.m1_r) || 0,
          reservas: e.res_tot || 0,
          capacidade: Math.max(e.lot_max || 0, e.capacidade_estimada || 0),
          bar: parseFloat(e.faturamento_bar) || 0,
          couvert: parseFloat(e.faturamento_couvert) || 0,
        };
      })
      .filter((e: Ev) => e.canon.length > 0);

    const evById = new Map<number, Ev>(eventos.map((e) => [e.id, e]));

    // 2) ligações artista->evento + cachê exato do CA (mesma fonte da trajetória)
    const { data: linksRaw } = await ops
      .from('evento_artistas')
      .select('evento_id, artista_id, artista_nome, c_art')
      .eq('bar_id', barId);
    const links = (linksRaw || []).filter((l: any) => evById.has(l.evento_id));

    const artistasPorEvento = new Map<number, number>();
    for (const l of links) artistasPorEvento.set(l.evento_id, (artistasPorEvento.get(l.evento_id) || 0) + 1);

    const { data: caCacheRaw } = await ops.rpc('fn_ca_cache_artista', { p_bar: barId, p_ini: iniStr, p_fim: hojeStr });
    const caCacheMap = new Map<string, number>();
    for (const r of caCacheRaw || []) caCacheMap.set(`${r.evento_id}:${r.artista_id}`, Number(r.cachet) || 0);

    // custo por link (CA > manual no link > c_art do evento em noite solo)
    const custoDeLink = (l: any): number => {
      const cm = l.artista_id ? (caCacheMap.get(`${l.evento_id}:${l.artista_id}`) || 0) : 0;
      if (cm > 0) return cm;
      const cl = l.c_art != null && l.c_art !== '' ? parseFloat(l.c_art) : 0;
      if (cl > 0) return cl;
      const n = artistasPorEvento.get(l.evento_id) || 1;
      return n === 1 ? (evById.get(l.evento_id)?.cache || 0) : 0;
    };
    // PRINCIPAL da noite = maior cachê (a noite é creditada só a ele — modelo da casa)
    const principalPorEvento = new Map<number, { artista_id: number | null; nome: string; cache: number }>();
    for (const l of links) {
      const c = custoDeLink(l);
      const cur = principalPorEvento.get(l.evento_id);
      if (!cur || c > cur.cache) {
        principalPorEvento.set(l.evento_id, { artista_id: l.artista_id ?? null, nome: l.artista_nome || '(sem nome)', cache: c });
      }
    }

    // 2.5) NPS por evento no período → agrega por label canônica (independe de artista taggeado,
    // então funciona no Deboche). Mapeia evento_id → canon via evById pra casar 1:1 com o label.
    const { data: npsRows } = await (supabase as any).schema('silver')
      .from('nps_evento_respostas')
      .select('evento_id, nps, categoria')
      .eq('bar_id', barId)
      .gte('data_visita', iniStr).lte('data_visita', hojeStr);
    const npsPorCanon = new Map<string, { n: number; soma: number; promot: number; detrat: number }>();
    for (const r of npsRows || []) {
      const ev = evById.get(r.evento_id); if (!ev) continue;
      const a = npsPorCanon.get(ev.canon) || { n: 0, soma: 0, promot: 0, detrat: 0 };
      a.n++; a.soma += Number(r.nps) || 0;
      if (r.categoria === 'promotor') a.promot++; else if (r.categoria === 'detrator') a.detrat++;
      npsPorCanon.set(ev.canon, a);
    }

    // #1 dimensões (Atendimento/Comida/Música/Tempo...) por evento → agregadas por label no map abaixo
    const { data: critRows } = await (supabase as any).schema('silver')
      .from('nps_criterio_evento')
      .select('evento_id, criterio_raw, nota')
      .eq('bar_id', barId)
      .gte('data_visita', iniStr).lte('data_visita', hojeStr);
    const critPorEvento = new Map<number, Array<{ criterio_raw: string; nota: number }>>();
    for (const r of critRows || []) {
      const a = critPorEvento.get(r.evento_id) || [];
      a.push({ criterio_raw: r.criterio_raw, nota: r.nota });
      critPorEvento.set(r.evento_id, a);
    }

    // 3) agrupa eventos por label canônica
    interface LabelAcc {
      canon: string;
      displayCount: Map<string, number>; // p/ escolher a exibição mais frequente
      diaCount: Map<string, number>;
      evs: Ev[];
      artistas: Map<string, ArtAcc>;
    }
    const mapa = new Map<string, LabelAcc>();
    for (const e of eventos) {
      let acc = mapa.get(e.canon);
      if (!acc) {
        acc = { canon: e.canon, displayCount: new Map(), diaCount: new Map(), evs: [], artistas: new Map() };
        mapa.set(e.canon, acc);
      }
      acc.evs.push(e);
      const disp = displayFromRaw(e.raw);
      acc.displayCount.set(disp, (acc.displayCount.get(disp) || 0) + 1);
      if (e.dia) acc.diaCount.set(e.dia, (acc.diaCount.get(e.dia) || 0) + 1);

      // artista principal daquela noite entra no breakdown da label
      const prin = principalPorEvento.get(e.id);
      if (prin) {
        const chave = prin.artista_id ? `id:${prin.artista_id}` : `nome:${prin.nome.toLowerCase()}`;
        let a = acc.artistas.get(chave);
        if (!a) {
          a = { artista_id: prin.artista_id, nome: prin.nome, fats: [], publicos: [], caches: [], melhor: null, pior: null };
          acc.artistas.set(chave, a);
        }
        a.fats.push(e.fat);
        a.publicos.push(e.publico);
        a.caches.push(prin.cache);
        if (!a.melhor || e.fat > a.melhor.fat) a.melhor = { data: e.data, fat: e.fat, publico: e.publico };
        if (!a.pior || e.fat < a.pior.fat) a.pior = { data: e.data, fat: e.fat, publico: e.publico };
      }
    }

    // 4) monta cada label
    const labels = Array.from(mapa.values())
      .filter((l) => l.evs.length >= minShows)
      .map((l) => {
        const evs = [...l.evs].sort((a, b) => (a.data < b.data ? -1 : 1)); // asc
        const n = evs.length;
        const fats = evs.map((e) => e.fat);
        const publicos = evs.map((e) => e.publico);
        const fat_total = fats.reduce((s, x) => s + x, 0);
        const fat_medio = fat_total / n;
        const publico_medio = Math.round(mediaDe(publicos));
        const ticket_medio = mediaDe(evs.map((e) => e.ticket).filter((x) => x > 0));
        const cache_total = evs.reduce((s, e) => s + e.cache, 0);
        const cache_medio = cache_total / n;
        const pct_cachet = fat_total > 0 ? (cache_total / fat_total) * 100 : null;
        const retorno = cache_total > 0 ? fat_total / cache_total : null;

        // composição do faturamento: Bar (consumo) × Couvert × Bilheteria (Yuzer/Sympla).
        // bilheteria = real_r − bar − couvert (o que sobra é ticketing das plataformas).
        const bar_total = evs.reduce((s, e) => s + e.bar, 0);
        const couvert_total = evs.reduce((s, e) => s + e.couvert, 0);
        const bilheteria_total = Math.max(0, fat_total - bar_total - couvert_total);
        const compDenom = bar_total + couvert_total + bilheteria_total || 1;
        const composicao = {
          bar: bar_total, couvert: couvert_total, bilheteria: bilheteria_total,
          pct_bar: (bar_total / compDenom) * 100,
          pct_couvert: (couvert_total / compDenom) * 100,
          pct_bilheteria: (bilheteria_total / compDenom) * 100,
        };

        // meta (m1_r) — só onde há meta lançada
        const comMeta = evs.filter((e) => e.meta > 0);
        const metaSum = comMeta.reduce((s, e) => s + e.meta, 0);
        const realComMeta = comMeta.reduce((s, e) => s + e.fat, 0);
        const meta_atingimento = metaSum > 0 ? (realComMeta / metaSum) * 100 : null;

        // ocupação (público / capacidade) onde houver capacidade
        const comCap = evs.filter((e) => e.capacidade > 0);
        const ocupacao = comCap.length ? mediaDe(comCap.map((e) => Math.min(e.publico / e.capacidade, 1.5))) * 100 : null;

        const reservas_medio = mediaDe(evs.map((e) => e.reservas));

        // consistência: coeficiente de variação (menor = mais previsível)
        const cv = fat_medio > 0 ? desvioPadrao(fats) / fat_medio : 0;

        // melhor / pior noite
        const melhor = evs.reduce((m, e) => (e.fat > m.fat ? e : m), evs[0]);
        const pior = evs.reduce((m, e) => (e.fat < m.fat ? e : m), evs[0]);

        // tendência (3 shows recentes vs anteriores)
        let tendencia: 'subindo' | 'estavel' | 'caindo' = 'estavel';
        let tendencia_var = 0;
        if (n >= 4) {
          const desc = [...evs].reverse();
          const rec = mediaDe(desc.slice(0, 3).map((e) => e.fat));
          const ant = mediaDe(desc.slice(3).map((e) => e.fat));
          tendencia_var = ant > 0 ? ((rec - ant) / ant) * 100 : 0;
          if (tendencia_var > 10) tendencia = 'subindo';
          else if (tendencia_var < -10) tendencia = 'caindo';
        }

        const diaDom = [...l.diaCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
        const display = [...l.displayCount.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0]?.[0] || l.canon;

        // NPS da label no período (agregado por evento → canon). null quando não há respostas.
        const npsAcc = npsPorCanon.get(l.canon);
        const nps_respostas = npsAcc?.n || 0;
        const nps_medio = npsAcc && npsAcc.n ? Math.round((npsAcc.soma / npsAcc.n) * 100) / 100 : null;
        const nps_score = npsAcc && npsAcc.n ? Math.round((npsAcc.promot / npsAcc.n) * 100 - (npsAcc.detrat / npsAcc.n) * 100) : null;
        const dimensoes = agregarDimensoes(l.evs.flatMap((e) => critPorEvento.get(e.id) || []));

        // série semanal (agrega por semana ISO — em geral 1 show/semana)
        const porSemana = new Map<string, { fat: number; publico: number; meta: number; n: number }>();
        for (const e of evs) {
          const w = weekStart(e.data);
          const o = porSemana.get(w) || { fat: 0, publico: 0, meta: 0, n: 0 };
          o.fat += e.fat; o.publico += e.publico; o.meta += e.meta; o.n += 1;
          porSemana.set(w, o);
        }
        const serie = [...porSemana.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([semana, o]) => ({
          semana, fat: o.fat, publico: o.publico, meta: o.meta || null,
        }));

        // breakdown de artistas na label (ranking melhor->pior por fat médio)
        const artistas = [...l.artistas.values()]
          .map((a) => {
            const an = a.fats.length;
            const fmed = mediaDe(a.fats);
            const ctot = a.caches.reduce((s, x) => s + x, 0);
            return {
              artista_id: a.artista_id,
              nome: a.nome,
              shows: an,
              fat_medio: fmed,
              publico_medio: Math.round(mediaDe(a.publicos)),
              cache_medio: mediaDe(a.caches),
              retorno: ctot > 0 ? a.fats.reduce((s, x) => s + x, 0) / ctot : null,
              lift_vs_label: fmed - fat_medio, // quanto rende acima/abaixo da média da label
              melhor_noite: a.melhor,
              pior_noite: a.pior,
            };
          })
          .sort((a, b) => b.fat_medio - a.fat_medio);

        return {
          key: l.canon,
          nome: display,
          dia: diaDom,
          dia_label: DIA_LABEL[diaDom] || display,
          shows: n,
          nps_respostas, nps_medio, nps_score, dimensoes,
          fat_total, fat_medio,
          publico_total: publicos.reduce((s, x) => s + x, 0), publico_medio,
          ticket_medio,
          cache_total, cache_medio, pct_cachet, retorno,
          composicao,
          meta_atingimento,
          ocupacao,
          reservas_medio,
          cv, // coef. variação (0 = idêntico todo show)
          tendencia, tendencia_var,
          primeiro: evs[0].data, ultimo: evs[n - 1].data,
          melhor_noite: { data: melhor.data, fat: melhor.fat, publico: melhor.publico, artista: principalPorEvento.get(melhor.id)?.nome || null },
          pior_noite: { data: pior.data, fat: pior.fat, publico: pior.publico, artista: principalPorEvento.get(pior.id)?.nome || null },
          serie,
          artistas,
        };
      })
      .sort((a, b) => b.fat_total - a.fat_total);

    // 5) série semana-a-semana combinada (top labels) p/ o gráfico geral
    const topParaGrafico = [...labels].sort((a, b) => b.shows - a.shows).slice(0, 6);
    const series = topParaGrafico.map((l, i) => ({ key: l.key, nome: l.nome, cor: PALETA[i % PALETA.length] }));
    const semanasSet = new Set<string>();
    for (const l of topParaGrafico) for (const p of l.serie) semanasSet.add(p.semana);
    const semanas = [...semanasSet].sort();
    const semanalFat = semanas.map((w) => {
      const ponto: Record<string, any> = { semana: w };
      for (const l of topParaGrafico) {
        const p = l.serie.find((x) => x.semana === w);
        if (p) ponto[l.key] = Math.round(p.fat);
      }
      return ponto;
    });

    // 6) stats + insights automáticos
    const comRetorno = labels.filter((l) => l.retorno != null);
    const comCV = labels.filter((l) => l.shows >= 4);
    const paresArtLabel = labels.flatMap((l) =>
      l.artistas.filter((a) => a.shows >= 2).map((a) => ({ label: l.nome, label_key: l.key, artista: a.nome, lift: a.lift_vs_label, fat_medio: a.fat_medio, publico_medio: a.publico_medio }))
    );

    const stats = {
      total_labels: labels.length,
      total_shows: labels.reduce((s, l) => s + l.shows, 0),
      fat_total: labels.reduce((s, l) => s + l.fat_total, 0),
      top_fat: labels[0]?.nome || null,
      top_publico: [...labels].sort((a, b) => b.publico_medio - a.publico_medio)[0]?.nome || null,
      top_retorno: [...comRetorno].sort((a, b) => (b.retorno || 0) - (a.retorno || 0))[0]?.nome || null,
    };

    const insights = {
      mais_rentavel: [...comRetorno].sort((a, b) => (b.retorno || 0) - (a.retorno || 0))[0] || null,
      mais_cresce: [...labels].filter((l) => l.tendencia === 'subindo').sort((a, b) => b.tendencia_var - a.tendencia_var)[0] || null,
      em_queda: [...labels].filter((l) => l.tendencia === 'caindo').sort((a, b) => a.tendencia_var - b.tendencia_var)[0] || null,
      mais_consistente: [...comCV].sort((a, b) => a.cv - b.cv)[0] || null,
      melhor_dupla: [...paresArtLabel].sort((a, b) => b.lift - a.lift)[0] || null,
    };

    return NextResponse.json({
      success: true,
      sem_dados: labels.length === 0,
      labels,
      grafico: { series, dados: semanalFat },
      stats,
      insights,
      periodo: { inicio: iniStr, fim: hojeStr, meses: periodo, min_shows: minShows },
    });
  } catch (error: any) {
    console.error('Erro ao analisar labels:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Erro ao analisar labels' }, { status: 500 });
  }
}
