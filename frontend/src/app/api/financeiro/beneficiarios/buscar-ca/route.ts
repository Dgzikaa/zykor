import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { fin } from '@/lib/financeiro/pedidos-pagamento';

export const dynamic = 'force-dynamic';

/**
 * Busca fornecedores/pessoas que JÁ EXISTEM no Conta Azul (bronze.bronze_contaazul_pessoas),
 * pra na hora de cadastrar um beneficiário a gente reusar o vínculo (não criar duplicado).
 * GET /api/financeiro/beneficiarios/buscar-ca?q=texto
 * Retorna candidatos {contaazul_id, nome, documento} + flag ja_vinculado (já está no de-para).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const termo = (new URL(request.url).searchParams.get('q') || '').trim();
  if (termo.length < 2) return NextResponse.json({ success: true, candidatos: [] });

  const supabase = await getAdminClient();
  const soDigitos = termo.replace(/\D/g, '');
  const { data: pessoas, error } = await (supabase.schema('bronze' as any) as any)
    .from('bronze_contaazul_pessoas')
    .select('contaazul_id, nome, documento, tipo_pessoa')
    .eq('bar_id', user.bar_id)
    .or(`nome.ilike.%${termo}%${soDigitos.length >= 3 ? `,documento.ilike.%${soDigitos}%` : ''}`)
    .limit(20);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const ids = (pessoas || []).map((p: any) => p.contaazul_id);
  let vinculados = new Set<string>();
  if (ids.length) {
    const { data: maps } = await fin(supabase)
      .from('beneficiario_contaazul_map')
      .select('contaazul_pessoa_id')
      .eq('bar_id', user.bar_id)
      .in('contaazul_pessoa_id', ids);
    vinculados = new Set((maps || []).map((m: any) => m.contaazul_pessoa_id));
  }

  const candidatos = (pessoas || []).map((p: any) => ({
    contaazul_id: p.contaazul_id,
    nome: p.nome,
    documento: p.documento || null,
    tipo_pessoa: p.tipo_pessoa || null,
    ja_vinculado: vinculados.has(p.contaazul_id),
  }));
  return NextResponse.json({ success: true, candidatos });
}
