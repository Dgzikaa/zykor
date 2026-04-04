import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      console.error('[oauth/callback] Erro OAuth:', error, errorDescription);
      return NextResponse.redirect(new URL('/configuracoes?contaazul=error&msg=' + encodeURIComponent(errorDescription || error), request.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/configuracoes?contaazul=error&msg=Parametros+invalidos', request.url));
    }

    const stateParts = state.split('_');
    if (stateParts.length < 2) {
      return NextResponse.redirect(new URL('/configuracoes?contaazul=error&msg=State+invalido', request.url));
    }
    const barId = parseInt(stateParts[0]);

    if (isNaN(barId)) {
      return NextResponse.redirect(new URL('/configuracoes?contaazul=error&msg=Bar+ID+invalido', request.url));
    }

    const edgeFunctionUrl = SUPABASE_URL + '/functions/v1/contaazul-auth';
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        action: 'exchange_code',
        bar_id: barId,
        code: code,
        state: state
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error('[oauth/callback] Erro ao trocar code:', data);
      return NextResponse.redirect(new URL('/configuracoes?contaazul=error&msg=' + encodeURIComponent(data.error || 'Erro+ao+conectar'), request.url));
    }

    return NextResponse.redirect(new URL('/configuracoes?contaazul=connected', request.url));

  } catch (err) {
    console.error('[oauth/callback] Erro nao tratado:', err);
    return NextResponse.redirect(new URL('/configuracoes?contaazul=error&msg=Erro+interno', request.url));
  }
}