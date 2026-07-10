import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser } from '@/middleware/auth';
import { UMBLER_API_V1, UMBLER_ORG_FALLBACK, getUmblerAccount, getUmblerToken, umblerAuthHeaders } from '@/lib/umbler';

export const dynamic = 'force-dynamic';

const supabase = createServiceRoleClient();

/**
 * Config da CONTA Umbler (nível conta — token serve os 2 bares) + canais por bar.
 *
 * GET  /api/umbler/account            → { account, bares_config, bares }
 * GET  /api/umbler/account?action=test → testa a conexão (lista templates da conta)
 * POST /api/umbler/account            → salva { organization_id?, api_token? } (só troca o token se vier)
 *
 * Admin-only. O token nunca é devolvido — só um preview.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Apenas admin' }, { status: 403 });

  try {
    const action = new URL(request.url).searchParams.get('action');

    // Teste de conexão: lista templates da conta com o token efetivo.
    if (action === 'test') {
      const token = await getUmblerToken(supabase);
      if (!token) return NextResponse.json({ ok: false, erro: 'Sem token (nem na conta, nem no env)' });
      const acc = await getUmblerAccount(supabase);
      const org = acc?.organization_id || UMBLER_ORG_FALLBACK;
      const resp = await fetch(`${UMBLER_API_V1}/templates/?organizationId=${org}&Take=100`, { headers: umblerAuthHeaders(token) });
      if (!resp.ok) {
        return NextResponse.json({ ok: false, http_status: resp.status, erro: (await resp.text()).slice(0, 200) });
      }
      const json = await resp.json();
      const items: any[] = json.items || [];
      const aprovados = items.filter((t) => String(t.status || '').toLowerCase() === 'approved').length;
      return NextResponse.json({ ok: true, total: items.length, aprovados });
    }

    const acc = await getUmblerAccount(supabase);
    const rawToken = (acc?.api_token || '').trim();

    // canais cadastrados por bar (join com nome do bar)
    const { data: configs } = await supabase
      .from('umbler_config')
      .select('bar_id, channel_id, channel_name, phone_number, organization_id, ativo');

    const { data: bares } = await (supabase as any)
      .schema('operations').from('bares').select('id, nome').eq('ativo', true).order('id');

    const nomePorBar = new Map<number, string>((bares || []).map((b: any) => [b.id, b.nome]));

    return NextResponse.json({
      account: {
        organization_id: acc?.organization_id || '',
        tem_token: rawToken.length > 0,
        token_preview: rawToken ? `${rawToken.slice(0, 6)}…${rawToken.slice(-4)}` : '',
        usando_env: rawToken.length === 0, // vazio no banco → cai no env (fallback)
        updated_at: acc?.updated_at || null,
      },
      bares_config: (configs || []).map((c: any) => ({
        ...c,
        bar_nome: nomePorBar.get(c.bar_id) || `Bar ${c.bar_id}`,
      })),
      bares: bares || [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Apenas admin' }, { status: 403 });

  try {
    const body = await request.json();
    const organizationId = (body.organization_id ?? '').toString().trim();
    const apiToken = (body.api_token ?? '').toString().trim();

    // monta o update: só troca o token se veio um novo (não apaga o atual com vazio)
    const patch: Record<string, any> = { id: 1, updated_at: new Date().toISOString() };
    if (organizationId) patch.organization_id = organizationId;
    if (apiToken) patch.api_token = apiToken;

    const { error } = await (supabase as any)
      .schema('integrations').from('umbler_account')
      .upsert(patch, { onConflict: 'id' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 });
  }
}
