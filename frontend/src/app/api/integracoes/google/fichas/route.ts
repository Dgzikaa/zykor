import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { getGoogleAccessToken } from '@/lib/google/oauth';
import { listarFichas } from '@/lib/google/business-profile';

/**
 * GET  /api/integracoes/google/fichas?bar_id=N  → fichas visíveis pela conta conectada
 * POST /api/integracoes/google/fichas           → amarra uma ficha ao bar
 *      body: { bar_id, location_id, location_nome?, account_id?, account_nome? }
 *
 * Por que a escolha é manual: uma mesma conta Google costuma administrar as fichas de TODOS
 * os bares. Casar por nome erraria (marcas parecidas, unidades da mesma rede), e errar aqui
 * significa gravar as métricas de um bar na linha de outro.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const neg = negarPorRota(user, req);
  if (neg) return neg;

  try {
    const barId = Number(new URL(req.url).searchParams.get('bar_id'));
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatório' }, { status: 400 });

    const supabase = await getAdminClient();
    const tk = await getGoogleAccessToken(supabase, barId);
    if ('error' in tk) return NextResponse.json({ error: tk.error }, { status: tk.status });

    const { data: conexao } = await supabase
      .schema('integrations')
      .from('google_oauth_tokens')
      .select('location_id, location_nome, google_email')
      .eq('bar_id', barId)
      .maybeSingle();

    const fichas = await listarFichas(tk.token);

    return NextResponse.json({
      fichas,
      selecionada: (conexao as any)?.location_id ?? null,
      selecionada_nome: (conexao as any)?.location_nome ?? null,
      conta_google: (conexao as any)?.google_email ?? null,
    });
  } catch (e: any) {
    console.error('[google/fichas] GET erro:', e);
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const neg = negarPorRota(user, req);
  if (neg) return neg;

  try {
    const body = await req.json().catch(() => ({}));
    const barId = Number(body?.bar_id);
    const locationId = String(body?.location_id || '').trim();
    if (!barId || !locationId) {
      return NextResponse.json({ error: 'bar_id e location_id obrigatórios' }, { status: 400 });
    }

    const supabase = await getAdminClient();

    // Uma ficha só pode alimentar um bar — se já estiver amarrada em outro, as métricas do
    // Google iriam parar em dois lugares e ninguém perceberia (os dois números pareceriam certos).
    const { data: emUso } = await supabase
      .schema('integrations')
      .from('google_oauth_tokens')
      .select('bar_id')
      .eq('location_id', locationId)
      .neq('bar_id', barId)
      .maybeSingle();

    if (emUso) {
      return NextResponse.json(
        { error: `Esta ficha já está vinculada ao bar ${(emUso as any).bar_id}. Desvincule lá antes.` },
        { status: 409 },
      );
    }

    const { error } = await supabase
      .schema('integrations')
      .from('google_oauth_tokens')
      .update({
        location_id: locationId,
        location_nome: body?.location_nome ?? null,
        ...(body?.account_id ? { account_id: body.account_id } : {}),
        ...(body?.account_nome ? { account_nome: body.account_nome } : {}),
        ultimo_erro: null,
        ultimo_erro_em: null,
        updated_at: new Date().toISOString(),
      })
      .eq('bar_id', barId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[google/fichas] POST erro:', e);
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 500 });
  }
}
