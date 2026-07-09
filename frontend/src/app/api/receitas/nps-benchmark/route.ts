import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

/**
 * Benchmark de NPS de concorrentes (entrada manual) — meta.nps_benchmark.
 * GET: lista ordenada. PUT { itens: [{nome, nps}] }: substitui a lista inteira.
 */
export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();
const meta = () => (supabase as any).schema('meta');

export async function GET() {
  const { data, error } = await meta().from('nps_benchmark').select('id, nome, nps, ordem').order('ordem', { ascending: true });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, itens: data || [] });
}

export async function PUT(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'body inválido' }, { status: 400 });
  }
  const itens = Array.isArray(body?.itens) ? body.itens : [];
  const limpos = itens
    .map((x: any, i: number) => ({ nome: String(x.nome || '').trim(), nps: Number(x.nps), ordem: i + 1 }))
    .filter((x: any) => x.nome && Number.isFinite(x.nps));

  const del = await meta().from('nps_benchmark').delete().neq('id', 0);
  if (del.error) return NextResponse.json({ success: false, error: del.error.message }, { status: 500 });

  if (limpos.length) {
    const ins = await meta()
      .from('nps_benchmark')
      .insert(limpos.map((x: any) => ({ ...x, atualizado_em: new Date().toISOString() })));
    if (ins.error) return NextResponse.json({ success: false, error: ins.error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, itens: limpos });
}
