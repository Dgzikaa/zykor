import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminClient } from '@/lib/supabase-admin';
import { buildGoogleAuthUrl, getGoogleOAuthConfig, GOOGLE_SCOPES } from '@/lib/google/oauth';

/**
 * GET /api/integracoes/google/iniciar?bar_id=N
 *
 * Gera a URL de consentimento do Google e guarda o state (CSRF) no banco.
 * Molde igual ao do Instagram — o bar_id viaja no state, então um redirect URI único
 * atende todos os bares.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const barId = Number(new URL(req.url).searchParams.get('bar_id'));
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatório' }, { status: 400 });

    const cfg = getGoogleOAuthConfig();
    if (!cfg) {
      return NextResponse.json(
        { error: 'GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET ausentes no env do Vercel' },
        { status: 500 },
      );
    }

    const supabase = await getAdminClient();
    const state = crypto.randomBytes(24).toString('hex');

    // 30 min: o fluxo do Google pode exigir login, troca de conta e — o caso lento — pedir
    // acesso a uma ficha no meio do caminho. Mesmo prazo adotado no Instagram pelo mesmo motivo.
    const { error } = await supabase
      .schema('integrations')
      .from('google_oauth_states')
      .insert({
        state,
        bar_id: barId,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });

    if (error) {
      console.error('[google/iniciar] erro salvando state:', error);
      return NextResponse.json({ error: 'Falha ao iniciar OAuth' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      url: buildGoogleAuthUrl(cfg, state),
      scopes: GOOGLE_SCOPES,
    });
  } catch (e: any) {
    console.error('[google/iniciar] erro:', e);
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 500 });
  }
}
