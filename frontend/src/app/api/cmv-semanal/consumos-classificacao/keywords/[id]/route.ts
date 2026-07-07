import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser } from '@/middleware/auth';

const supabase = createServiceRoleClient();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await authenticateUser(request);
  try {
    const { id } = await params;
    const body = await request.json();
    const { ativo, pattern, categoria, descricao } = body;

    const update: any = { atualizado_em: new Date().toISOString() };
    if (typeof ativo === 'boolean') update.ativo = ativo;
    if (pattern) update.pattern = pattern.toLowerCase().trim();
    if (categoria) update.categoria = categoria;
    if (descricao !== undefined) update.descricao = descricao;

    const { data, error } = await supabase
      .schema('financial' as any)
      .from('consumos_keywords')
      .update(update)
      .eq('id', parseInt(id))
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ keyword: data });
  } catch (err: any) {
    console.error('Erro PATCH keyword:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await authenticateUser(request);
  try {
    const { id } = await params;
    const { error } = await supabase
      .schema('financial' as any)
      .from('consumos_keywords')
      .delete()
      .eq('id', parseInt(id));

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Erro DELETE keyword:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
