import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFerramentaFinanceira, FERRAMENTA_FINANCEIRA } from '@/lib/auth/financeiro-guard';
import { fin } from '@/lib/financeiro/pedidos-pagamento';
import { paginate } from '@/lib/supabase/paginate';

export const dynamic = 'force-dynamic';

// =====================================================
// GET — lista as linhas de fatura importadas, com filtros.
//   ?banco= ?cartao= ?bar_id= ?status= ?tipo= ?data_de= ?data_ate= ?busca=
// =====================================================
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.pedidos, 'ver')) return permissionErrorResponse('Sem permissão');

  const { searchParams } = new URL(request.url);
  const banco = searchParams.get('banco');
  const cartao = searchParams.get('cartao');
  const barId = searchParams.get('bar_id');
  const status = searchParams.get('status');
  const tipo = searchParams.get('tipo');
  const dataDe = searchParams.get('data_de');
  const dataAte = searchParams.get('data_ate');
  const busca = searchParams.get('busca');

  const supabase = await getAdminClient();
  const linhas = await paginate<any>(
    () => {
      let q = fin(supabase)
        .from('cartao_fatura_linhas')
        .select('*')
        .order('data_transacao', { ascending: false })
        .order('id', { ascending: true });
      if (banco) q = q.eq('banco', banco);
      if (cartao) q = q.eq('cartao_final', cartao);
      if (barId) q = q.eq('bar_id', Number(barId));
      if (status) q = q.eq('status', status);
      if (tipo) q = q.eq('tipo', tipo);
      if (dataDe) q = q.gte('data_transacao', dataDe);
      if (dataAte) q = q.lte('data_transacao', dataAte);
      if (busca) q = q.ilike('descricao', `%${busca}%`);
      return q;
    },
    { label: 'cartao-fatura:list' },
  );

  return NextResponse.json({ success: true, linhas });
}
