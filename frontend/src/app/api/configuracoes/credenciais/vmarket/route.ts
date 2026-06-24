import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

const BASE_PADRAO = 'https://integracao-compras.vmarketcompras.com.br';
// Endpoint de login (e-mail+senha -> token Bearer). Doc VMarket: POST /api/autenticar
// { email, password } -> { token }. Demais ficam como fallback defensivo.
const LOGIN_PATHS = ['/api/autenticar', '/api/login', '/api/auth/login', '/api/token'];

async function credsDoBar(supabase: any, barId: number) {
  const { data } = await supabase.from('api_credentials')
    .select('*').eq('bar_id', barId).eq('sistema', 'vmarket').maybeSingle();
  return data;
}

/** Tenta logar e devolver o token. Testa rotas comuns até uma responder com token. */
async function vmarketLogin(base: string, email: string, senha: string, pathPreferido?: string) {
  const paths = pathPreferido ? [pathPreferido, ...LOGIN_PATHS.filter(p => p !== pathPreferido)] : LOGIN_PATHS;
  const tentativas: Array<{ path: string; status: number; trecho: string }> = [];
  for (const path of paths) {
    try {
      const r = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, password: senha, senha }),
      });
      const txt = await r.text();
      let j: any = null; try { j = JSON.parse(txt); } catch { /* não-json */ }
      const token = j?.token || j?.access_token || j?.data?.token || j?.data?.access_token || j?.authorization || null;
      if (r.ok && token) return { token: String(token), path, raw: j };
      tentativas.push({ path, status: r.status, trecho: txt.slice(0, 160) });
    } catch (e: any) {
      tentativas.push({ path, status: 0, trecho: e?.message || 'fetch falhou' });
    }
  }
  return { token: null, path: null, raw: null, tentativas };
}

/** GET ?bar_id= -> status da credencial (mascarado). */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const barId = Number(new URL(request.url).searchParams.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const c = await credsDoBar(supabase, barId);
  return NextResponse.json({
    success: true,
    configurado: !!(c && c.username && c.password),
    email: c?.username || null,
    base_url: c?.base_url || BASE_PADRAO,
    tem_token: !!c?.access_token,
    expires_at: c?.expires_at || null,
    ativo: c?.ativo ?? false,
  });
}

/** POST -> salvar credencial (sem action) ou testar (action='testar'). */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const body = await request.json().catch(() => ({}));
  const barId = Number(body.bar_id) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();

  // ---- TESTAR ----
  if (body.action === 'testar') {
    const c = await credsDoBar(supabase, barId);
    if (!c?.username || !c?.password) return NextResponse.json({ success: false, error: 'Preencha e salve e-mail e senha antes de testar' }, { status: 400 });
    const base = c.base_url || BASE_PADRAO;
    const login = await vmarketLogin(base, c.username, c.password, c.configuracoes?.login_path);
    if (!login.token) {
      return NextResponse.json({ success: false, etapa: 'login', error: 'Não consegui autenticar (e-mail/senha ou endpoint de login).', tentativas: (login as any).tentativas });
    }
    // Guarda o token
    await supabase.from('api_credentials').update({
      access_token: login.token, token_type: 'Bearer',
      configuracoes: { ...(c.configuracoes || {}), login_path: login.path },
      atualizado_em: new Date().toISOString(),
    }).eq('id', c.id);
    // Lista 1 aprovação pra validar o Bearer
    try {
      const r = await fetch(`${base}/api/listar-aprovacao?paginate=1`, { headers: { Authorization: `Bearer ${login.token}`, Accept: 'application/json' } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return NextResponse.json({ success: false, etapa: 'listar', login_ok: true, login_path: login.path, status: r.status, error: 'Login OK, mas listar-aprovacao falhou', corpo: JSON.stringify(j).slice(0, 200) });
      return NextResponse.json({ success: true, login_path: login.path, indicadores: j.indicadores || null, total: j.aprovacoes?.total ?? null });
    } catch (e: any) {
      return NextResponse.json({ success: false, etapa: 'listar', login_ok: true, error: e?.message });
    }
  }

  // ---- SALVAR ----
  const email = String(body.email || '').trim();
  const senha = String(body.senha || '');
  const base_url = String(body.base_url || BASE_PADRAO).trim().replace(/\/$/, '');
  if (!email || !senha) return NextResponse.json({ success: false, error: 'E-mail e senha obrigatórios' }, { status: 400 });

  const c = await credsDoBar(supabase, barId);
  const payload: any = { bar_id: barId, sistema: 'vmarket', username: email, password: senha, base_url, ativo: true, atualizado_em: new Date().toISOString() };
  const { error } = c
    ? await supabase.from('api_credentials').update(payload).eq('id', c.id)
    : await supabase.from('api_credentials').insert(payload);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
