import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import crypto from 'crypto';

/**
 * GET /api/integracoes/instagram/iniciar?bar_id=N
 *
 * Gera URL do **Instagram Business Login** (não Facebook Login) e salva
 * state aleatório no banco pra validar no callback.
 *
 * Diferente do antigo Facebook Login for Business: usa endpoint
 * `instagram.com/oauth/authorize` direto, com o Instagram sub-app ID
 * (não o Facebook App principal). Apps criados via "Use Case Instagram"
 * só funcionam por esse caminho.
 */
export const dynamic = 'force-dynamic';

const INSTAGRAM_OAUTH_BASE = 'https://www.instagram.com/oauth/authorize';

const SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_comments',
  'instagram_business_manage_messages',
  'instagram_business_content_publish',
].join(',');

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const barId = Number(sp.get('bar_id'));
    if (!barId) {
      return NextResponse.json({ error: 'bar_id obrigatório' }, { status: 400 });
    }

    const appId = process.env.INSTAGRAM_APP_ID;
    const redirectUri = process.env.META_OAUTH_REDIRECT_URI;
    if (!appId || !redirectUri) {
      return NextResponse.json(
        { error: 'INSTAGRAM_APP_ID/META_OAUTH_REDIRECT_URI ausentes no env do Vercel' },
        { status: 500 },
      );
    }

    const supabase = await getAdminClient();

    // state aleatório (CSRF) com expiração de 10 minutos
    const state = crypto.randomBytes(24).toString('hex');
    const { error: stateErr } = await supabase
      .from('instagram_oauth_states')
      .insert({
        state,
        bar_id: barId,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

    if (stateErr) {
      console.error('[ig/iniciar] erro salvando state:', stateErr);
      return NextResponse.json({ error: 'Falha ao iniciar OAuth' }, { status: 500 });
    }

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
      scope: SCOPES,
    });

    return NextResponse.json({
      success: true,
      url: `${INSTAGRAM_OAUTH_BASE}?${params.toString()}`,
    });
  } catch (e: any) {
    console.error('[ig/iniciar] erro:', e);
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 500 });
  }
}
