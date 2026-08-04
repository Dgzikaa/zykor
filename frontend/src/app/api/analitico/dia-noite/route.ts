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
 * Params: bar_id, de, ate, corte (hora, 12-23 — default 18), dow (0=dom..6=sáb, opcional),
 *         produto (ILIKE em prd_desc pra isolar o prato âncora do almoço — default 'feijoada').
 */

interface DiaRow {
  data: string;
  fat_dia: number | string;
  fat_noite: number | string;
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
  const dowParam = sp.get('dow');
  const dow = dowParam === null || dowParam === '' ? null : Number(dowParam);
  const produto = (sp.get('produto') ?? 'feijoada').trim() || null;

  if (!barId) return NextResponse.json({ success: false, error: 'bar_id ausente' }, { status: 400 });
  if (!de || !ate) return NextResponse.json({ success: false, error: 'de e ate são obrigatórios' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any)
    .schema('operations')
    .rpc('fn_dia_noite', { p_bar_id: barId, p_ini: de, p_fim: ate, p_corte: corte, p_produto: produto });

  if (error) {
    console.error('[analitico/dia-noite] erro:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const brutos = ((data || []) as DiaRow[])
    .map((r) => {
      const fatDia = num(r.fat_dia);
      const fatNoite = num(r.fat_noite);
      const total = fatDia + fatNoite;
      return {
        data: r.data,
        dow: dowDe(r.data),
        fat_dia: fatDia,
        fat_noite: fatNoite,
        fat_total: total,
        pct_dia: pct(fatDia, total),
        pessoas_dia: num(r.pessoas_dia),
        pessoas_noite: num(r.pessoas_noite),
        comandas_dia: num(r.comandas_dia),
        comandas_noite: num(r.comandas_noite),
        ticket_dia: div(fatDia, num(r.pessoas_dia)),
        ticket_noite: div(fatNoite, num(r.pessoas_noite)),
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
  const pessoasDia = soma((r) => r.pessoas_dia);
  const pessoasNoite = soma((r) => r.pessoas_noite);

  const resumo = {
    dias: dias.length,
    fat_dia: fatDia,
    fat_noite: fatNoite,
    fat_total: fatDia + fatNoite,
    pct_dia: pct(fatDia, fatDia + fatNoite),
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
  const porDowMap = new Map<number, { fat_dia: number; fat_noite: number; n: number }>();
  for (const r of brutos) {
    const acc = porDowMap.get(r.dow) || { fat_dia: 0, fat_noite: 0, n: 0 };
    acc.fat_dia += r.fat_dia;
    acc.fat_noite += r.fat_noite;
    acc.n += 1;
    porDowMap.set(r.dow, acc);
  }
  const por_dow = [...porDowMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([d, a]) => ({
      dow: d,
      dias: a.n,
      media_dia: div(a.fat_dia, a.n) ?? 0,
      media_noite: div(a.fat_noite, a.n) ?? 0,
      pct_dia: pct(a.fat_dia, a.fat_dia + a.fat_noite),
    }));

  return NextResponse.json({
    success: true,
    corte,
    produto,
    periodo: { de, ate, dow },
    resumo,
    dias: dias.slice().sort((a, b) => b.data.localeCompare(a.data)),
    por_dow,
  });
}
