import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/** GET ?bar_id&id_vmarket -> compras (itens de pedido VMarket) desse produto, da mais recente p/ a mais antiga. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  const idVm = Number(sp.get('id_vmarket'));
  if (!barId || !idVm) return NextResponse.json({ success: false, error: 'bar_id e id_vmarket obrigatórios' }, { status: 400 });

  const gold = (await getAdminClient() as any).schema('gold');
  const { data: itens, error } = await gold.from('vmarket_pedido_item')
    .select('id_pedido, preco, quantidade, total, gramatura_cotacao')
    .eq('bar_id', barId).eq('id_produto_sisfood_cotacao', idVm);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const pedidoIds = Array.from(new Set((itens || []).map((i: any) => i.id_pedido)));
  const pmap = new Map<number, any>();
  if (pedidoIds.length) {
    const { data: peds } = await gold.from('vmarket_pedido').select('id_pedido, data, fornecedor, nm_status').eq('bar_id', barId).in('id_pedido', pedidoIds);
    (peds || []).forEach((p: any) => pmap.set(p.id_pedido, p));
  }
  const compras = (itens || []).map((i: any) => ({
    id_pedido: i.id_pedido,
    data: pmap.get(i.id_pedido)?.data ?? null,
    fornecedor: pmap.get(i.id_pedido)?.fornecedor ?? null,
    status: pmap.get(i.id_pedido)?.nm_status ?? null,
    gramatura: i.gramatura_cotacao,
    quantidade: Number(i.quantidade || 0),
    preco: Number(i.preco || 0),
    total: Number(i.total || 0),
  })).sort((a: any, b: any) => String(b.data || '').localeCompare(String(a.data || '')));
  return NextResponse.json({ success: true, compras });
}
