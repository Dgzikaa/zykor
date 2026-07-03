import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * Há pesquisa ativa pendente para este usuário?
 * Regras de 1x-por-usuário: sem resposta → mostra; respondida/dispensada → não;
 * adiada → mostra só se adiar_ate já passou.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const supabase = await getAdminClient();

  const { data: pesquisas } = await supabase
    .schema('feedback')
    .from('pesquisas')
    .select('id, slug, titulo, subtitulo')
    .eq('ativa', true)
    .order('created_at', { ascending: false })
    .limit(1);

  const pesquisa = pesquisas?.[0];
  if (!pesquisa) return NextResponse.json({ pendente: false });

  const { data: resposta } = await supabase
    .schema('feedback')
    .from('respostas')
    .select('status, adiar_ate')
    .eq('pesquisa_id', pesquisa.id)
    .eq('email', user.email)
    .maybeSingle();

  let pendente = true;
  if (resposta) {
    if (resposta.status === 'respondida' || resposta.status === 'dispensada') {
      pendente = false;
    } else if (resposta.status === 'adiada') {
      pendente = resposta.adiar_ate ? new Date(resposta.adiar_ate) <= new Date() : true;
    }
  }
  if (!pendente) return NextResponse.json({ pendente: false });

  const { data: itens } = await supabase
    .schema('feedback')
    .from('pesquisa_itens')
    .select('ordem, chave, tipo, titulo, obrigatoria')
    .eq('pesquisa_id', pesquisa.id)
    .order('ordem', { ascending: true });

  return NextResponse.json({
    pendente: true,
    pesquisa: { ...pesquisa, itens: itens || [] },
  });
}
