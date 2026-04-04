import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bar_id, sync_mode = 'full_sync' } = body;

    if (!bar_id) {
      return NextResponse.json({ error: 'bar_id e obrigatorio' }, { status: 400 });
    }

    const edgeFunctionUrl = SUPABASE_URL + '/functions/v1/contaazul-sync';
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        bar_id: bar_id,
        sync_mode: sync_mode
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.error || 'Erro ao sincronizar' }, { status: response.status });
    }

    return NextResponse.json(data);

  } catch (err) {
    console.error('[sync] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}