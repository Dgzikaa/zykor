import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * DELETE /api/financeiro/trocas/[id] → exclui (reprova) uma troca.
 * Reverte o desvio dos dois bares NA HORA (gold.fn_desvios lê financial.trocas ao vivo).
 * TRAVA: só permite excluir se a troca ainda NÃO foi lançada no Conta Azul — o CA v2
 * não tem DELETE de lançamento [[feedback_contaazul_api_sem_delete_lancamento]], então
 * apagar aqui deixaria o CA/PIX órfão. Uso: limpar trocas de teste.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { id } = await params;
  const fin = (sb() as any).schema('financial');

  const { data: troca, error: eGet } = await fin.from('trocas')
    .select('id,bar_origem,bar_destino,status').eq('id', id).single();
  if (eGet || !troca) return NextResponse.json({ success: false, error: 'Troca não encontrada' }, { status: 404 });

  // só quem faz parte da troca (origem ou destino) pode excluir
  if (troca.bar_origem !== user.bar_id && troca.bar_destino !== user.bar_id) {
    return NextResponse.json({ success: false, error: 'Sem acesso a esta troca' }, { status: 403 });
  }
  // trava: já lançada no CA → não dá pra reverter (CA sem DELETE)
  if (troca.status === 'ca_lancado') {
    return NextResponse.json({ success: false, error: 'Já lançada no Conta Azul — não pode ser excluída. Faça o estorno pelo CA.' }, { status: 409 });
  }

  await fin.from('troca_itens').delete().eq('troca_id', id);
  const { error: eDel } = await fin.from('trocas').delete().eq('id', id);
  if (eDel) return NextResponse.json({ success: false, error: eDel.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
