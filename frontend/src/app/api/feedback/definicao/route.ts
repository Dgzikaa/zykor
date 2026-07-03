import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * Definição de uma pesquisa (título + itens), independente de estar ativa.
 * Usada pela pré-visualização na tela Configurações → Pesquisas. Só admin.
 * ?slug=... (padrão: a pesquisa mais recente).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Apenas administradores' }, { status: 403 });
  }

  const slug = new URL(request.url).searchParams.get('slug');
  const supabase = await getAdminClient();

  let query = supabase.schema('feedback').from('pesquisas').select('id, slug, titulo, subtitulo');
  query = slug ? query.eq('slug', slug) : query.order('created_at', { ascending: false });
  const { data: pesquisas } = await query.limit(1);
  const pesquisa = pesquisas?.[0];
  if (!pesquisa) return NextResponse.json({ success: false, error: 'Pesquisa não encontrada' }, { status: 404 });

  const { data: itens } = await supabase
    .schema('feedback')
    .from('pesquisa_itens')
    .select('ordem, chave, tipo, titulo, obrigatoria')
    .eq('pesquisa_id', pesquisa.id)
    .order('ordem', { ascending: true });

  return NextResponse.json({ success: true, pesquisa: { ...pesquisa, itens: itens || [] } });
}
