import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

/**
 * GET /api/integracoes/instagram/perfil?bar_id=N
 *
 * Endpoint de teste — busca dados reais do IG via Graph API usando o token
 * salvo. Comprova que a integracao OAuth + token estao funcionando
 * end-to-end. Retorna: username, account_type, media_count, followers_count
 * + ultimas 3 posts.
 *
 * Usa scope `instagram_business_basic` (ja autorizado). Sem necessidade de
 * App Review pra Dev Mode com Instagram Tester.
 */
export const dynamic = 'force-dynamic';

const IG_GRAPH = 'https://graph.instagram.com';

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const barId = Number(sp.get('bar_id'));
    if (!barId) {
      return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });
    }

    const supabase = await getAdminClient();

    const { data: conta, error: contaErr } = await (supabase as any)
      .schema('integrations')
      .from('instagram_contas')
      .select('ig_business_id, ig_username, access_token, expires_at, ativo')
      .eq('bar_id', barId)
      .maybeSingle();

    if (contaErr || !conta) {
      return NextResponse.json(
        { error: 'Nenhuma conta IG conectada para esse bar' },
        { status: 404 },
      );
    }
    if (!conta.ativo || !conta.access_token) {
      return NextResponse.json(
        { error: 'Conta IG desativada ou sem token' },
        { status: 400 },
      );
    }

    const token = conta.access_token as string;

    // 1) Perfil basico
    const perfilRes = await fetch(
      `${IG_GRAPH}/v22.0/me?fields=user_id,username,name,account_type,profile_picture_url,media_count,followers_count,follows_count,biography&access_token=${token}`,
    );
    const perfil = await perfilRes.json();
    if (!perfilRes.ok) {
      return NextResponse.json(
        { error: 'Erro chamando IG Graph API', detalhes: perfil },
        { status: 502 },
      );
    }

    // 2) Ultimas 3 posts
    const mediaRes = await fetch(
      `${IG_GRAPH}/v22.0/me/media?fields=id,caption,media_type,permalink,timestamp,thumbnail_url,media_url&limit=3&access_token=${token}`,
    );
    const media = await mediaRes.json();

    return NextResponse.json({
      success: true,
      bar_id: barId,
      conta_salva: {
        ig_username: conta.ig_username,
        ig_business_id: conta.ig_business_id,
        expires_at: conta.expires_at,
      },
      perfil_ao_vivo: perfil,
      ultimas_3_posts: mediaRes.ok ? media.data : { erro: media },
    });
  } catch (e: any) {
    console.error('[ig/perfil] excecao:', e);
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 500 });
  }
}
