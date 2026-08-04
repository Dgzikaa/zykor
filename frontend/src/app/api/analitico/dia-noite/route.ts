import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * Almoço × Noite — quanto do faturamento do dia veio antes e depois da hora de corte.
 *
 * Nasceu da pergunta do Rodrigo (04/08/2026): "no sábado, quanto foi feijuca e quanto foi a noite?".
 * Agrega em operations.fn_dia_noite (database/functions/fn_dia_noite.sql).
 *
 * Params: bar_id, de, ate, corte (hora, 12-23 — default 18), inicio (hora que abre a janela do
 *         almoço, 6-14 — default 11), dow (0=dom..6=sáb, opcional), produto (ILIKE em prd_desc pra
 *         isolar o prato âncora do almoço — default 'feijoada').
 *
 * A tela é a ANÁLISE DO SÁBADO: é o único dia que a casa opera em dois turnos (feijoada + noite).
 * Nos demais dias a casa abre 16h/17h e roda direto — lá o dia inteiro volta como TURNO ÚNICO
 * (fat_noite = dia inteiro, fat_dia = 0). Partir o dia de quinta em "antes/depois das 18h" só
 * inventava um almoço que não existe: domingo aparecia com R$ 2,5k e quinta com R$ 370 de "almoço".
 *
 * O detector de almoço é o `fat_almoco_cedo` da fn (venda entre a abertura da janela e 15h), não
 * uma regra chumbada em sábado. O que fica antes de `inicio` volta em `fat_fora` — nada some.
 */

interface DiaRow {
  data: string;
  fat_dia: number | string;
  fat_noite: number | string;
  fat_fora: number | string;
  fat_almoco_cedo: number | string;
  pessoas_dia: number | string;
  pessoas_noite: number | string;
  comandas_dia: number | string;
  comandas_noite: number | string;
  prod_qtd: number | string;
  prod_valor: number | string;
}

const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);
const div = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) / 100 : null);
const pct = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 1000) / 10 : null);

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
  const de = sp.get('de');
  const ate = sp.get('ate');
  const corte = Math.min(Math.max(Number(sp.get('corte')) || 18, 12), 23);
  // Janela do almoço abre às 10h por padrão (pedido do Rodrigo: "pode até pegar 10h-18h").
  const inicio = Math.min(Math.max(Number(sp.get('inicio')) || 10, 6), Math.min(corte - 1, 14));
  const dowParam = sp.get('dow');
  const dow = dowParam === null || dowParam === '' ? null : Number(dowParam);
  const produto = (sp.get('produto') ?? 'feijoada').trim() || null;

  if (!barId) return NextResponse.json({ success: false, error: 'bar_id ausente' }, { status: 400 });
  if (!de || !ate) return NextResponse.json({ success: false, error: 'de e ate são obrigatórios' }, { status: 400 });

  const supabase = await getAdminClient();
  const [{ data, error }, { data: prodRows, error: prodError }] = await Promise.all([
    (supabase as any).schema('operations').rpc('fn_dia_noite', {
      p_bar_id: barId,
      p_ini: de,
      p_fim: ate,
      p_corte: corte,
      p_produto: produto,
      p_ini_almoco: inicio,
    }),
    // Quebra por produto: sem ela, "0 vendidos" no KPI não diz se o produto não existe no bar,
    // se o texto não casou, ou se realmente não vendeu.
    produto
      ? (supabase as any).schema('operations').rpc('fn_dia_noite_produtos', {
          p_bar_id: barId,
          p_ini: de,
          p_fim: ate,
          p_produto: produto,
        })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (error) {
    console.error('[analitico/dia-noite] erro:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  if (prodError) console.error('[analitico/dia-noite] erro na quebra por produto:', prodError);

  const brutos = ((data || []) as DiaRow[])
    .map((r) => {
      // Teve almoço de verdade? Só se vendeu no miolo do almoço (janela → 15h). Dia que abre
      // 16h/17h (domingo, quinta) não tem almoço — o pré-corte dele é abertura da casa.
      const temAlmoco = num(r.fat_almoco_cedo) > 0;

      const dia = num(r.fat_dia);
      const noite = num(r.fat_noite);
      const fora = num(r.fat_fora);
      const total = dia + noite + fora;

      const pDia = num(r.pessoas_dia);
      const pNoite = num(r.pessoas_noite);
      const cDia = num(r.comandas_dia);
      const cNoite = num(r.comandas_noite);

      // TURNO ÚNICO: só o sábado (dia com almoço) é dividido em dois. Nos outros dias a casa abre
      // 16h/17h e roda direto até fechar — partir isso em "antes/depois das 18h" inventa dois turnos
      // que não existem na operação. Então tudo entra como turno principal.
      const fatDia = temAlmoco ? dia : 0;
      const fatNoite = temAlmoco ? noite : total;
      const fatFora = temAlmoco ? fora : 0;
      const pessoasDia = temAlmoco ? pDia : 0;
      const pessoasNoite = temAlmoco ? pNoite : pDia + pNoite;

      return {
        data: r.data,
        dow: dowDe(r.data),
        tem_almoco: temAlmoco,
        fat_dia: fatDia,
        fat_noite: fatNoite,
        fat_fora: fatFora,
        fat_total: total,
        pct_dia: temAlmoco ? pct(fatDia, total) : null,
        pessoas_dia: pessoasDia,
        pessoas_noite: pessoasNoite,
        comandas_dia: temAlmoco ? cDia : 0,
        comandas_noite: temAlmoco ? cNoite : cDia + cNoite,
        ticket_dia: div(fatDia, pessoasDia),
        ticket_noite: div(fatNoite, pessoasNoite),
        prod_qtd: num(r.prod_qtd),
        prod_valor: num(r.prod_valor),
      };
    })
    // Dia sem movimento nenhum não é linha de análise (bar fechado / feriado).
    .filter((r) => r.fat_total > 0);

  const dias = dow === null ? brutos : brutos.filter((r) => r.dow === dow);

  const soma = (get: (r: (typeof dias)[number]) => number) => dias.reduce((s, r) => s + get(r), 0);
  const fatDia = soma((r) => r.fat_dia);
  const fatNoite = soma((r) => r.fat_noite);
  const fatFora = soma((r) => r.fat_fora);
  const pessoasDia = soma((r) => r.pessoas_dia);
  const pessoasNoite = soma((r) => r.pessoas_noite);

  const resumo = {
    dias: dias.length,
    dias_com_almoco: dias.filter((r) => r.tem_almoco).length,
    fat_dia: fatDia,
    fat_noite: fatNoite,
    fat_fora: fatFora,
    fat_total: fatDia + fatNoite + fatFora,
    pct_dia: pct(fatDia, fatDia + fatNoite + fatFora),
    media_fat_dia: div(fatDia, dias.length),
    media_fat_noite: div(fatNoite, dias.length),
    pessoas_dia: pessoasDia,
    pessoas_noite: pessoasNoite,
    ticket_dia: div(fatDia, pessoasDia),
    ticket_noite: div(fatNoite, pessoasNoite),
    prod_qtd: soma((r) => r.prod_qtd),
    prod_valor: soma((r) => r.prod_valor),
  };

  // Média por dia da semana (sempre sobre a base inteira, ignorando o filtro de dow —
  // é o comparativo "sábado rende almoço, terça não").
  const porDowMap = new Map<number, { fat_dia: number; fat_noite: number; n: number; comAlmoco: number }>();
  for (const r of brutos) {
    const acc = porDowMap.get(r.dow) || { fat_dia: 0, fat_noite: 0, n: 0, comAlmoco: 0 };
    acc.fat_dia += r.fat_dia;
    acc.fat_noite += r.fat_noite;
    acc.n += 1;
    if (r.tem_almoco) acc.comAlmoco += 1;
    porDowMap.set(r.dow, acc);
  }
  const por_dow = [...porDowMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([d, a]) => ({
      dow: d,
      dias: a.n,
      dias_com_almoco: a.comAlmoco,
      media_dia: div(a.fat_dia, a.n) ?? 0,
      media_noite: div(a.fat_noite, a.n) ?? 0,
      pct_dia: pct(a.fat_dia, a.fat_dia + a.fat_noite),
    }));

  // Produtos que casaram com o texto do prato âncora, respeitando o filtro de dia da semana.
  const datasNoFiltro = new Set(dias.map((d) => d.data));
  const prodMap = new Map<string, { qtd: number; valor: number }>();
  for (const r of (prodRows || []) as { data: string; prd_desc: string; qtd: number; valor: number }[]) {
    if (!datasNoFiltro.has(r.data)) continue;
    const acc = prodMap.get(r.prd_desc) || { qtd: 0, valor: 0 };
    acc.qtd += num(r.qtd);
    acc.valor += num(r.valor);
    prodMap.set(r.prd_desc, acc);
  }
  const produtos = [...prodMap.entries()]
    .map(([prd_desc, a]) => ({ produto: prd_desc, qtd: a.qtd, valor: a.valor }))
    .sort((a, b) => b.valor - a.valor);

  return NextResponse.json({
    success: true,
    corte,
    inicio,
    produto,
    produtos,
    periodo: { de, ate, dow },
    resumo,
    dias: dias.slice().sort((a, b) => b.data.localeCompare(a.data)),
    por_dow,
  });
}
