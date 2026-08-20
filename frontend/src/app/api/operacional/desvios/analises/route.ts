import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { areaDe } from '@/lib/operacional/desvios-area';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * ANÁLISES DE DESVIO — a evolução no tempo, não o retrato de uma semana.
 *
 * Gonza (20/08/2026): "gráficos dos desvios semana a semana, mês a mês. O desvio aberto por
 * Insumo/Produção/Proteína evoluindo no tempo. Quais insumos estão dando mais desvio, ranking".
 *
 * O desvio só existe ENTRE DUAS CONTAGENS — não é um valor diário que dá pra somar por período.
 * Então a série é montada janela a janela: cada ponto é o intervalo entre duas contagens
 * consecutivas (operations.contagem_datas), do mesmo jeito que a tela principal calcula um
 * período. Isso garante que o gráfico e a aba de Insumos digam o mesmo número na mesma semana.
 *
 * CUSTO: fn_desvios leva ~700ms por janela e fn_desvios_proteina ~460ms. 12 janelas em série
 * seriam ~14s; por isso vão em lotes de 4 em paralelo (~4s). Uma query só com LATERAL sobre as
 * janelas seria mais elegante, mas viraria UM statement de 14s — refém do statement_timeout.
 */

const LOTE = 4;
const JANELAS_PADRAO = 12;
const JANELAS_MAX = 26;

type Totais = { perdas: number; sobras: number; liquido: number; itens: number };
const zero = (): Totais => ({ perdas: 0, sobras: 0, liquido: 0, itens: 0 });

function acumular(t: Totais, rs: number) {
  t.liquido += rs;
  if (rs < 0) { t.perdas += Math.abs(rs); t.itens++; } else if (rs > 0) { t.sobras += rs; }
}

const n = (v: any) => Number(v || 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const tipo = ['semanal', 'mensal'].includes(sp.get('tipo') || '') ? sp.get('tipo')! : 'semanal';
  const janelas = Math.min(JANELAS_MAX, Math.max(3, Number(sp.get('janelas')) || JANELAS_PADRAO));
  // Recorte por DATA (Rodrigo, 20/08/2026: "pra pegar os maiores do último mês, ou da última
  // semana, ou do ano todo"). Uma janela entra quando FECHA dentro do intervalo — é a data em
  // que a contagem aconteceu, e é assim que a operação fala do desvio ("o desvio do dia 17").
  const dataOk = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const de = dataOk(sp.get('de'));
  const ate = dataOk(sp.get('ate'));

  const c = sb();
  const gold = (fn: string, args: any) => (c as any).schema('gold').rpc(fn, args);

  const { data: datasRaw, error: errDatas } = await (c as any).schema('operations')
    .rpc('contagem_datas', { p_bar_id: user.bar_id, p_tipo: tipo, p_classe: 'insumo' });
  if (errDatas) return NextResponse.json({ success: false, error: errDatas.message }, { status: 500 });

  const ds: string[] = ((datasRaw || []) as any[]).map((d) => d.data_contagem);
  // cada ponto = intervalo ENTRE duas contagens; com 1 contagem só não há desvio pra calcular
  const todas = ds
    .map((fim, i, arr) => (i < arr.length - 1 ? { ini: arr[i + 1], fim } : null))
    .filter(Boolean) as { ini: string; fim: string }[];

  const noIntervalo = (de || ate)
    ? todas.filter((p) => (!de || p.fim >= de) && (!ate || p.fim <= ate))
    : todas.slice(0, janelas);

  /**
   * Teto de janelas mesmo com data: cada uma custa ~1,2s de RPC, então "o ano todo" (52
   * semanas) seria mais de um minuto. Corta nas mais RECENTES e AVISA — corte silencioso faria
   * o total parecer menor do que é.
   */
  const periodos = noIntervalo.slice(0, JANELAS_MAX);
  const truncado = noIntervalo.length > periodos.length ? noIntervalo.length - periodos.length : 0;

  if (!periodos.length) {
    return NextResponse.json({ success: true, tipo, serie: [], ranking: [], areas: [], sem_dados: true, truncado: 0 });
  }

  // Ignorados (olhinho) saem da conta — senão a análise contradiz a tela, que já os exclui.
  // Duas fontes, como na rota principal: insumo comum e produção que só existe em producao_base.
  const [{ data: ignA }, { data: ignB }] = await Promise.all([
    (c as any).schema('operations').from('insumos')
      .select('codigo').eq('bar_id', user.bar_id).eq('ignorar_desvio', true),
    (c as any).from('producao_base')
      .select('codigo').eq('bar_id', user.bar_id).eq('ignorar_desvio', true),
  ]);
  const ignorados = new Set<string>([
    ...((ignA || []) as any[]).map((i) => String(i.codigo).toUpperCase()),
    ...((ignB || []) as any[]).map((i) => String(i.codigo).toUpperCase()),
  ]);

  /** Acumuladores do ranking, por código, ao longo de TODAS as janelas. */
  const rank = new Map<string, {
    codigo: string; nome: string; categoria: string | null; area: string; grupo: 'insumo' | 'producao' | 'proteina';
    perda: number; sobra: number; janelas_com_perda: number; ultima: number;
  }>();

  const somaRank = (
    codigo: string, nome: string, categoria: string | null,
    grupo: 'insumo' | 'producao' | 'proteina', rs: number,
  ) => {
    const k = `${grupo}:${codigo}`.toUpperCase();
    const at = rank.get(k) ?? {
      codigo, nome, categoria, area: areaDe(categoria, codigo), grupo,
      perda: 0, sobra: 0, janelas_com_perda: 0, ultima: 0,
    };
    if (rs < 0) { at.perda += Math.abs(rs); at.janelas_com_perda++; } else { at.sobra += rs; }
    at.ultima = rs;
    rank.set(k, at);
  };

  const serie: any[] = [];

  for (let i = 0; i < periodos.length; i += LOTE) {
    const lote = periodos.slice(i, i + LOTE);
    const resultados = await Promise.all(lote.map(async (p) => {
      const [rDesv, rProt] = await Promise.all([
        gold('fn_desvios', { p_bar: user.bar_id, p_ini: p.ini, p_fim: p.fim }),
        gold('fn_desvios_proteina', { p_bar: user.bar_id, p_ini: p.ini, p_fim: p.fim }),
      ]);
      return { p, linhas: (rDesv.data || []) as any[], prot: (rProt.data || []) as any[] };
    }));

    for (const { p, linhas, prot } of resultados) {
      const insumos = zero(); const producoes = zero(); const proteinas = zero();
      const porArea: Record<string, number> = {};

      for (const l of linhas) {
        const cod = String(l.insumo_codigo || '').toUpperCase();
        if (ignorados.has(cod)) continue;
        const rs = n(l.desvio_rs);
        const ehProd = l.is_producao === true;
        acumular(ehProd ? producoes : insumos, rs);
        somaRank(l.insumo_codigo, l.insumo_nome, l.categoria ?? null, ehProd ? 'producao' : 'insumo', rs);
        // a área só faz sentido pra perda: sobra dilui e some do gráfico de concentração
        if (rs < 0) {
          const a = areaDe(l.categoria ?? null, l.insumo_codigo);
          porArea[a] = (porArea[a] || 0) + Math.abs(rs);
        }
      }

      for (const l of prot) {
        const cod = String(l.insumo_cod ?? l.insumo_codigo ?? '').toUpperCase();
        if (ignorados.has(cod)) continue;
        const rs = n(l.desvio_rs);
        acumular(proteinas, rs);
        somaRank(l.insumo_cod ?? l.insumo_codigo, l.insumo_nome, null, 'proteina', rs);
      }

      serie.push({
        ini: p.ini, fim: p.fim,
        insumos: { perdas: r2(insumos.perdas), sobras: r2(insumos.sobras), liquido: r2(insumos.liquido), itens: insumos.itens },
        producoes: { perdas: r2(producoes.perdas), sobras: r2(producoes.sobras), liquido: r2(producoes.liquido), itens: producoes.itens },
        proteinas: { perdas: r2(proteinas.perdas), sobras: r2(proteinas.sobras), liquido: r2(proteinas.liquido), itens: proteinas.itens },
        /**
         * TOTAL = insumos + produções. Proteína NÃO entra: ela não é uma terceira origem, é uma
         * LEITURA DIFERENTE dos mesmos insumos (VMarket × utilizado na produção, ancorado no
         * estoque). Conferido no banco: os 8 itens de proteína de uma janela existem TODOS
         * também como insumo, com valor diferente — o Filé mignon deu −1.333,73 como insumo e
         * +97,87 como proteína na mesma semana. Somar os dois contava o mesmo quilo duas vezes
         * e inflava o total (Gonza, 20/08/2026).
         */
        perda_total: r2(insumos.perdas + producoes.perdas),
        por_area: Object.fromEntries(Object.entries(porArea).map(([k, v]) => [k, r2(v)])),
      });
    }
  }

  // do mais antigo pro mais novo — gráfico de evolução se lê da esquerda pra direita
  serie.sort((a, b) => a.fim.localeCompare(b.fim));

  /**
   * Top 30 POR ORIGEM, não top 30 geral. O corte global escondia as produções: os insumos são
   * muito mais numerosos e ocupavam a lista inteira, então filtrar por "Produções" na tela
   * peneirava uma lista que já não tinha nenhuma (Rodrigo, 20/08/2026: "de Produções acho que
   * ele não puxou aqui"). A tela junta e ordena de novo pra ver "Todos".
   */
  const topDoGrupo = (g: 'insumo' | 'producao' | 'proteina') =>
    [...rank.values()].filter((r) => r.grupo === g && r.perda > 0)
      .sort((a, b) => b.perda - a.perda).slice(0, 30);

  // 'proteina' vai junto mas a TELA a esconde em "Todos": listar as duas leituras do mesmo item
  // lado a lado é o que fez o Filé mignon aparecer com dois valores diferentes.
  const ranking = [...topDoGrupo('insumo'), ...topDoGrupo('producao'), ...topDoGrupo('proteina')]
    .sort((a, b) => b.perda - a.perda)
    .map((r) => ({
      ...r, perda: r2(r.perda), sobra: r2(r.sobra), ultima: r2(r.ultima),
      // perda média por janela em que apareceu — separa "muito de uma vez" de "sangramento"
      media: r2(r.perda / Math.max(1, r.janelas_com_perda)),
      recorrente: r.janelas_com_perda >= Math.max(3, Math.ceil(periodos.length * 0.5)),
    }));

  // Concentração por área no período inteiro (o que o gráfico de pizza mostra)
  const areasTot: Record<string, number> = {};
  for (const s of serie) for (const [a, v] of Object.entries(s.por_area)) areasTot[a] = (areasTot[a] || 0) + Number(v);
  const areas = Object.entries(areasTot).map(([nome, perda]) => ({ nome, perda: r2(perda) }))
    .sort((a, b) => b.perda - a.perda);

  return NextResponse.json({
    success: true, tipo, janelas: periodos.length, serie, ranking, areas,
    // o intervalo REAL coberto — a tela escreve isso do lado do ranking
    intervalo: serie.length ? { de: serie[0].ini, ate: serie[serie.length - 1].fim } : null,
    truncado,
    // total do período: insumos + produções (ver perda_total). Proteína sai à parte.
    total: {
      perdas: r2(serie.reduce((s, x) => s + x.perda_total, 0)),
      proteinas: r2(serie.reduce((s, x) => s + x.proteinas.perdas, 0)),
      media_por_periodo: r2(serie.reduce((s, x) => s + x.perda_total, 0) / Math.max(1, serie.length)),
    },
  });
}
