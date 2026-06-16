import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();
const fin = () => (supabase as any).schema('financial');

/** GET /api/financeiro/balanco/imobilizado?bar_id=3 — lista os ativos cadastrados */
export async function GET(req: NextRequest) {
  try {
    const barId = Number(req.nextUrl.searchParams.get('bar_id'));
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatório' }, { status: 400 });
    const { data, error } = await fin().from('imobilizado_ativos')
      .select('*').eq('bar_id', barId).eq('ativo', true)
      .order('data_aquisicao', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ ativos: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 });
  }
}

/** POST { bar_id, descricao, valor, data_aquisicao, tipo, taxa_anual?, observacao? } — cadastra ativo */
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const { bar_id, descricao, valor, data_aquisicao, tipo } = b;
    if (!bar_id || !descricao || !valor || !data_aquisicao) return NextResponse.json({ error: 'dados inválidos' }, { status: 400 });
    if (tipo && !['inicial', 'reinvestimento'].includes(tipo)) return NextResponse.json({ error: 'tipo inválido' }, { status: 400 });
    const row = {
      bar_id: Number(bar_id), descricao: String(descricao),
      valor: Number(valor) || 0, data_aquisicao,
      tipo: tipo || 'reinvestimento',
      taxa_anual: Number(b.taxa_anual) || 10,
      observacao: b.observacao || null,
    };
    const { error } = await fin().from('imobilizado_ativos').insert(row);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 });
  }
}

/** DELETE /api/financeiro/balanco/imobilizado?id=123 — soft delete (ativo=false) */
export async function DELETE(req: NextRequest) {
  try {
    const id = Number(req.nextUrl.searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    const { error } = await fin().from('imobilizado_ativos').update({ ativo: false }).eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 });
  }
}
