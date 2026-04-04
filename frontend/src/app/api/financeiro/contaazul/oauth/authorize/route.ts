import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;

const CONTA_AZUL_AUTH_URL = 'https://auth.contaazul.com';
const REDIRECT_URI = 'https://zykor.com.br/api/financeiro/contaazul/oauth/callback';
const OAUTH_SCOPE = 'openid profile aws.cognito.signin.user.admin';

function getSupabaseAdmin() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');

    if (!barId) {
      return NextResponse.json({ error: 'bar_id e obrigatorio' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: credentials, error } = await supabase
      .from('api_credentials')
      .select('client_id, scopes')
      .eq('sistema', 'conta_azul')
      .eq('bar_id', parseInt(barId))
      .single();

    if (error || !credentials?.client_id) {
      return NextResponse.json({ error: 'Credenciais nao configuradas. Salve client_id e client_secret primeiro.' }, { status: 400 });
    }

    const uuid = crypto.randomUUID();
    const state = barId + '_' + uuid;

    const { error: updateError } = await supabase
      .from('api_credentials')
      .update({ scopes: state, updated_at: new Date().toISOString() })
      .eq('sistema', 'conta_azul')
      .eq('bar_id', parseInt(barId));

    if (updateError) {
      console.error('[authorize] Erro ao salvar state:', updateError);
    }

    const authUrl = new URL(CONTA_AZUL_AUTH_URL + '/login');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', credentials.client_id);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', OAUTH_SCOPE);

    return NextResponse.redirect(authUrl.toString());

  } catch (err) {
    console.error('[authorize] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}