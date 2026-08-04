import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { paginate } from '@/lib/supabase/paginate';
import { dimensaoDe } from '@/lib/analytics/nps-dimensoes';

export const dynamic = 'force-dynamic';

/**
 * NPS por ÁREA e por DATA DA VISITA (tela /analitico/nps).
 *
 * Fonte: silver.v_nps_resposta (1 linha/resposta) + silver.v_nps_area (1 linha por resposta × área),
 * criadas em database/migrations/2026-08-04-nps-area-e-data-visita.sql. Regra canônica do NPS
 * (pesquisas 'NPS' / 'NPS Digital' / 'Salão') já aplicada nas views.
 *
 * `base=visita` (padrão) recorta pelo DIA EM QUE A PESSOA ESTEVE no bar — é o que responde
 * "em que dia o tempo de entrega foi ruim". `base=resposta` recorta pelo dia em que ela respondeu
 * (é o corte do Falae e o do Desempenho semanal).
 *
 * VOLUME: o Falae acumula ~150 respostas/mês nos dois bares (≈600 respostas e ≈5k linhas de área
 * em toda a história). A rota lê a base inteira do bar e filtra em memória de propósito: assim o
 * "sem data de visita" é exato e o filtro de período não precisa de segunda query. Se um dia isso
 * crescer uma ordem de grandeza, filtrar por data no `paginate` (as views já têm as duas datas).
 */

interface RespostaRow {
  falae_id: string;
  search_name: string | null;
  nps: number;
  cliente_nome: string | null;
  data_resposta: string;
  data_visita: string | null;
  categoria: 'promotor' | 'neutro' | 'detrator';
  comentario: string | null;
}

interface AreaRow {
  falae_id: string;
  data_visita: string | null;
  data_resposta: string;
  area_raw: string;
  nota: number;
}

const media = (soma: number, n: number) => (n > 0 ? Math.round((soma / n) * 100) / 100 : null);

/** NPS score clássico: %promotores − %detratores, 1 casa. */
function npsScore(promotores: number, detratores: number, total: number): number | null {
  if (!total) return null;
  return Math.round(((promotores - detratores) / total) * 1000) / 10;
}

/** Dia da semana (0=dom) de um ISO date, sem `new Date(iso)` — que puxa o dia anterior em UTC-3. */
function dowDe(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');

  const sp = request.nextUrl.searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  const de = sp.get('de') || '';
  const ate = sp.get('ate') || '';
  const base = sp.get('base') === 'resposta' ? 'resposta' : 'visita';
  const dowParam = sp.get('dow'); // '' | '0'..'6' (dia da semana da VISITA)
  const dow = dowParam === null || dowParam === '' ? null : Number(dowParam);

  if (!barId) return NextResponse.json({ success: false, error: 'bar_id ausente' }, { status: 400 });

  const supabase = await getAdminClient();

  try {
    const [respostas, areas] = await Promise.all([
      paginate<RespostaRow>(() =>
        (supabase as any)
          .schema('silver')
          .from('v_nps_resposta')
          .select('falae_id, search_name, nps, cliente_nome, data_resposta, data_visita, categoria, comentario')
          .eq('bar_id', barId)
          .order('falae_id')
      ),
      paginate<AreaRow>(() =>
        (supabase as any)
          .schema('silver')
          .from('v_nps_area')
          .select('falae_id, data_visita, data_resposta, area_raw, nota')
          .eq('bar_id', barId)
          .order('falae_id')
      ),
    ]);

    // ---- recorte do período ------------------------------------------------
    const dataDe = (r: { data_visita: string | null; data_resposta: string }) =>
      base === 'visita' ? r.data_visita : r.data_resposta;

    const noPeriodo = (r: { data_visita: string | null; data_resposta: string }) => {
      const d = dataDe(r);
      if (!d) return false; // sem data da visita => fora do corte por visita
      if (de && d < de) return false;
      if (ate && d > ate) return false;
      if (dow !== null && dowDe(d) !== dow) return false;
      return true;
    };

    // Respostas sem data da visita mas que responderam na janela — o "buraco" a reportar na tela.
    const semDataVisita =
      base === 'visita'
        ? respostas.filter(
            (r) =>
              !r.data_visita &&
              (!de || r.data_resposta >= de) &&
              (!ate || r.data_resposta <= ate)
          ).length
        : respostas.filter((r) => noPeriodo(r) && !r.data_visita).length;

    const resp = respostas.filter(noPeriodo);
    const idsNoPeriodo = new Set(resp.map((r) => r.falae_id));
    const areasPeriodo = areas.filter((a) => idsNoPeriodo.has(a.falae_id));

    // ---- eventos da janela (dá nome ao dia: "Sábado - Feijoada", artista...) ----
    const datas = Array.from(new Set(resp.map((r) => dataDe(r)).filter(Boolean) as string[]));
    const eventoPorData = new Map<string, string>();
    if (datas.length) {
      const { data: evs } = await (supabase as any)
        .schema('operations')
        .from('eventos_base')
        .select('data_evento, nome')
        .eq('bar_id', barId)
        .in('data_evento', datas);
      for (const e of (evs || []) as { data_evento: string; nome: string | null }[]) {
        if (e.nome) eventoPorData.set(e.data_evento, e.nome);
      }
    }

    // ---- resumo ------------------------------------------------------------
    const promotores = resp.filter((r) => r.categoria === 'promotor').length;
    const neutros = resp.filter((r) => r.categoria === 'neutro').length;
    const detratores = resp.filter((r) => r.categoria === 'detrator').length;
    const somaNps = resp.reduce((s, r) => s + (Number(r.nps) || 0), 0);

    const resumo = {
      respostas: resp.length,
      nps_score: npsScore(promotores, detratores, resp.length),
      nps_medio: media(somaNps, resp.length),
      promotores,
      neutros,
      detratores,
      comentarios: resp.filter((r) => r.comentario).length,
      sem_data_visita: semDataVisita,
    };

    // ---- notas por ÁREA (canonizadas) --------------------------------------
    const porArea = new Map<string, { soma: number; n: number; baixas: number }>();
    for (const a of areasPeriodo) {
      const area = dimensaoDe(a.area_raw);
      if (!area) continue;
      const acc = porArea.get(area) || { soma: 0, n: 0, baixas: 0 };
      acc.soma += Number(a.nota) || 0;
      acc.n += 1;
      if (Number(a.nota) <= 3) acc.baixas += 1;
      porArea.set(area, acc);
    }
    const areasAgg = [...porArea.entries()]
      .map(([area, a]) => ({
        area,
        nota_media: media(a.soma, a.n) ?? 0,
        n: a.n,
        notas_baixas: a.baixas,
        pct_baixas: a.n ? Math.round((a.baixas / a.n) * 1000) / 10 : 0,
      }))
      .sort((x, y) => x.nota_media - y.nota_media); // pior primeiro: o gargalo lidera

    // ---- evolução mensal (NPS + nota por área) -----------------------------
    const porMes = new Map<string, { prom: number; det: number; n: number; areas: Map<string, { soma: number; n: number }> }>();
    const mesDe = (iso: string) => iso.slice(0, 7);
    for (const r of resp) {
      const d = dataDe(r)!;
      const k = mesDe(d);
      const m = porMes.get(k) || { prom: 0, det: 0, n: 0, areas: new Map() };
      m.n += 1;
      if (r.categoria === 'promotor') m.prom += 1;
      if (r.categoria === 'detrator') m.det += 1;
      porMes.set(k, m);
    }
    for (const a of areasPeriodo) {
      const d = base === 'visita' ? a.data_visita : a.data_resposta;
      if (!d) continue;
      const m = porMes.get(mesDe(d));
      if (!m) continue;
      const area = dimensaoDe(a.area_raw);
      if (!area) continue;
      const acc = m.areas.get(area) || { soma: 0, n: 0 };
      acc.soma += Number(a.nota) || 0;
      acc.n += 1;
      m.areas.set(area, acc);
    }
    const evolucao = [...porMes.entries()]
      .sort((x, y) => x[0].localeCompare(y[0]))
      .map(([mes, m]) => ({
        mes,
        n: m.n,
        nps_score: npsScore(m.prom, m.det, m.n),
        areas: Object.fromEntries([...m.areas.entries()].map(([k, v]) => [k, media(v.soma, v.n)])),
      }));

    // ---- por DIA (o corte que o Cadu pediu) --------------------------------
    const porDia = new Map<string, { prom: number; det: number; n: number; soma: number; areas: Map<string, { soma: number; n: number }> }>();
    for (const r of resp) {
      const d = dataDe(r)!;
      const dia = porDia.get(d) || { prom: 0, det: 0, n: 0, soma: 0, areas: new Map() };
      dia.n += 1;
      dia.soma += Number(r.nps) || 0;
      if (r.categoria === 'promotor') dia.prom += 1;
      if (r.categoria === 'detrator') dia.det += 1;
      porDia.set(d, dia);
    }
    for (const a of areasPeriodo) {
      const d = base === 'visita' ? a.data_visita : a.data_resposta;
      if (!d) continue;
      const dia = porDia.get(d);
      if (!dia) continue;
      const area = dimensaoDe(a.area_raw);
      if (!area) continue;
      const acc = dia.areas.get(area) || { soma: 0, n: 0 };
      acc.soma += Number(a.nota) || 0;
      acc.n += 1;
      dia.areas.set(area, acc);
    }
    const dias = [...porDia.entries()]
      .sort((x, y) => y[0].localeCompare(x[0])) // mais recente primeiro
      .map(([data, d]) => {
        const areasDia = [...d.areas.entries()]
          .map(([area, v]) => ({ area, nota: media(v.soma, v.n) ?? 0, n: v.n }))
          .sort((x, y) => x.nota - y.nota);
        return {
          data,
          dow: dowDe(data),
          evento: eventoPorData.get(data) || null,
          respostas: d.n,
          nps_score: npsScore(d.prom, d.det, d.n),
          nps_medio: media(d.soma, d.n),
          pior_area: areasDia[0]?.area || null,
          pior_nota: areasDia[0]?.nota ?? null,
          areas: Object.fromEntries(areasDia.map((a) => [a.area, a.nota])),
        };
      });

    // ---- lista de respostas (com as notas de área de cada uma) -------------
    const areasPorResposta = new Map<string, { area: string; nota: number }[]>();
    for (const a of areasPeriodo) {
      const area = dimensaoDe(a.area_raw);
      if (!area) continue;
      const arr = areasPorResposta.get(a.falae_id) || [];
      arr.push({ area, nota: Number(a.nota) });
      areasPorResposta.set(a.falae_id, arr);
    }
    const lista = resp
      .slice()
      .sort((x, y) => (dataDe(y) || '').localeCompare(dataDe(x) || ''))
      .map((r) => ({
        falae_id: r.falae_id,
        pesquisa: r.search_name,
        data_visita: r.data_visita,
        data_resposta: r.data_resposta,
        dow: r.data_visita ? dowDe(r.data_visita) : null,
        evento: r.data_visita ? eventoPorData.get(r.data_visita) || null : null,
        nps: r.nps,
        categoria: r.categoria,
        cliente: r.cliente_nome,
        comentario: r.comentario,
        areas: (areasPorResposta.get(r.falae_id) || []).sort((a, b) => a.nota - b.nota),
      }));

    return NextResponse.json({
      success: true,
      base,
      periodo: { de: de || null, ate: ate || null, dow },
      resumo,
      areas: areasAgg,
      evolucao,
      dias,
      respostas: lista,
    });
  } catch (error) {
    console.error('[analitico/nps] erro:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao carregar NPS' },
      { status: 500 }
    );
  }
}
