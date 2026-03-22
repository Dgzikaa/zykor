import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, barId, periodo, categoria } = body;
    if (!barId) return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });

    const response = await fetch(`${SUPABASE_URL}/functions/v1/agente-custos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ action, barId, periodo, categoria })
    });

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Erro na API de custos:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
