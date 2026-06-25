import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/conciliacao/nf-stone-cnpj?de=YYYY-MM-DD&ate=YYYY-MM-DD
 * Item 2: NF emitida por CNPJ/dia × Venda Stone por CNPJ/dia (gold.conciliacao_nf_stone_cnpj_diaria).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const de = searchParams.get('de');
  const ate = searchParams.get('ate');
  if (!de || !ate) return NextResponse.json({ success: false, error: 'de e ate obrigatórios' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any).schema('gold')
    .from('conciliacao_nf_stone_cnpj_diaria')
    .select('data, cnpj_indice, cnpj_documento, cnpj_label, nf_autorizado, nf_qtd, nf_cancelado, stone_bruto, stone_qtd, diferenca')
    .eq('bar_id', user.bar_id)
    .gte('data', de).lte('data', ate)
    .order('data', { ascending: false }).order('cnpj_indice', { ascending: true });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Meta de NF do CNPJ do Simples Nacional = custo-empresa funcionário projetado (folha) do período.
  // Ideal não emitir NF acima da folha nesse CNPJ. Config por bar: qual CNPJ é o Simples.
  const SIMPLES_POR_BAR: Record<number, { cnpj_indice: number }> = { 3: { cnpj_indice: 2 }, 4: { cnpj_indice: 3 } };
  let meta_nf: { cnpj_indice: number; valor: number } | null = null;
  const cfg = SIMPLES_POR_BAR[user.bar_id];
  if (cfg) {
    const meses: Array<{ ano: number; mes: number }> = [];
    let y = Number(de.slice(0, 4)), m = Number(de.slice(5, 7));
    const yf = Number(ate.slice(0, 4)), mf = Number(ate.slice(5, 7));
    while (y < yf || (y === yf && m <= mf)) { meses.push({ ano: y, mes: m }); m++; if (m > 12) { m = 1; y++; } }
    const anos = Array.from(new Set(meses.map((x) => x.ano)));
    const mesesNum = Array.from(new Set(meses.map((x) => x.mes)));
    const { data: plan } = await (supabase as any).schema('meta')
      .from('orcamento_planilha')
      .select('ano, mes, valor_planejado, valor_projetado')
      .eq('bar_id', user.bar_id)
      .ilike('categoria_nome', '%EMPRESA FUNCION%')
      .in('ano', anos).in('mes', mesesNum);
    const valor = (plan ?? [])
      .filter((p: any) => meses.some((x) => x.ano === p.ano && x.mes === p.mes))
      .reduce((s: number, p: any) => s + Number(p.valor_projetado ?? p.valor_planejado ?? 0), 0);
    if (valor > 0) meta_nf = { cnpj_indice: cfg.cnpj_indice, valor };
  }

  return NextResponse.json({ success: true, linhas: data ?? [], meta_nf });
}
