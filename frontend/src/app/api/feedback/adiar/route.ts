import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

const LIMITE_TENTATIVAS = 3; // reaparece até 3x, depois para
const ADIAR_DIAS = 2;

/** "Responder depois": adia a pesquisa; após LIMITE_TENTATIVAS, para de aparecer. */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');

  const body = await request.json().catch(() => null);
  const pesquisaId = Number(body?.pesquisa_id);
  if (!pesquisaId) {
    return NextResponse.json({ success: false, error: 'pesquisa_id obrigatório' }, { status: 400 });
  }

  const supabase = await getAdminClient();

  const { data: atual } = await supabase
    .schema('feedback')
    .from('respostas')
    .select('tentativas')
    .eq('pesquisa_id', pesquisaId)
    .eq('email', user.email)
    .maybeSingle();

  const tentativas = (atual?.tentativas ?? 0) + 1;
  const chegouNoLimite = tentativas >= LIMITE_TENTATIVAS;
  const status = chegouNoLimite ? 'dispensada' : 'adiada';
  const adiarAte = chegouNoLimite
    ? null
    : new Date(Date.now() + ADIAR_DIAS * 24 * 60 * 60 * 1000).toISOString();

  await supabase
    .schema('feedback')
    .from('respostas')
    .upsert(
      {
        pesquisa_id: pesquisaId,
        email: user.email,
        usuario_id: user.auth_id ?? null,
        bar_id: user.bar_id ?? null,
        status,
        tentativas,
        adiar_ate: adiarAte,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'pesquisa_id,email' }
    );

  return NextResponse.json({ success: true, status });
}
