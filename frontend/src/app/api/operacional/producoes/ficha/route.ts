import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/** Componentes da ficha técnica de uma produção (insumos do VMarket + outras produções). */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const producaoId = Number(new URL(request.url).searchParams.get('producao_id'));
  if (!producaoId) return NextResponse.json({ success: false, error: 'producao_id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data, error } = await supabase
    .from('producao_ficha_item')
    .select('id,componente_tipo,insumo_codigo,insumo_id_vmarket,producao_ref,nome_componente,quantidade,unidade')
    .eq('producao_id', producaoId)
    .order('id', { ascending: true });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, itens: data ?? [] });
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const body = await request.json().catch(() => ({}));
  const producaoId = Number(body.producao_id);
  const tipo = String(body.componente_tipo || '');
  if (!producaoId || !['insumo', 'producao'].includes(tipo)) {
    return NextResponse.json({ success: false, error: 'producao_id e componente_tipo válidos obrigatórios' }, { status: 400 });
  }
  const supabase = await getAdminClient();
  const payload = {
    producao_id: producaoId,
    componente_tipo: tipo,
    insumo_codigo: tipo === 'insumo' ? (body.insumo_codigo || null) : null,
    insumo_id_vmarket: tipo === 'insumo' && body.insumo_id_vmarket != null ? Number(body.insumo_id_vmarket) : null,
    producao_ref: tipo === 'producao' && body.producao_ref != null ? Number(body.producao_ref) : null,
    nome_componente: body.nome_componente ? String(body.nome_componente) : null,
    quantidade: body.quantidade != null ? Number(body.quantidade) : 0,
    unidade: body.unidade ? String(body.unidade) : null,
  };
  const { data, error } = await supabase.from('producao_ficha_item').insert(payload).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, item: data });
}

export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });
  const supabase = await getAdminClient();
  const { error } = await supabase.from('producao_ficha_item').delete().eq('id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
