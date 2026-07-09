import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

/**
 * Persistência da análise (Bloco 3) — meta.analise_receita, por bar + mês.
 * GET ?bar_id=&mes=  → devolve a análise salva (ou null).
 * PUT { bar_id, mes, contexto, problemas, oportunidades, reflexoes } → upsert.
 */
export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();
const meta = () => (supabase as any).schema('meta');

export async function GET(request: NextRequest) {
  const sp = new URL(request.url).searchParams;
  const barId = parseInt(String(sp.get('bar_id') || ''), 10);
  const mes = sp.get('mes');
  if (!barId || !mes) return NextResponse.json({ success: false, error: 'bar_id e mes são obrigatórios' }, { status: 400 });

  const { data, error } = await meta()
    .from('analise_receita')
    .select('contexto, problemas, oportunidades, reflexoes, atualizado_em')
    .eq('bar_id', barId)
    .eq('mes', mes)
    .maybeSingle();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, analise: data || null });
}

export async function PUT(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'body inválido' }, { status: 400 });
  }
  const { bar_id, mes, contexto, problemas, oportunidades, reflexoes } = body || {};
  if (!bar_id || !mes) return NextResponse.json({ success: false, error: 'bar_id e mes são obrigatórios' }, { status: 400 });

  const row = {
    bar_id: Number(bar_id),
    mes: String(mes),
    contexto: contexto ?? null,
    problemas: Array.isArray(problemas) ? problemas : [],
    oportunidades: Array.isArray(oportunidades) ? oportunidades : [],
    reflexoes: Array.isArray(reflexoes) ? reflexoes : [],
    atualizado_em: new Date().toISOString(),
  };

  const { error } = await meta().from('analise_receita').upsert(row, { onConflict: 'bar_id,mes' });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
