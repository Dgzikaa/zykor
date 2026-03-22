import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tipo, barId, periodo, formato = 'json', enviarPara } = body;
    if (!barId) return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });

    const response = await fetch(`${SUPABASE_URL}/functions/v1/relatorio-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ tipo, barId, periodo, formato, enviarPara })
    });

    // Se formato for HTML, retornar o HTML direto
    if (formato === 'html') {
      const html = await response.text();
      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Erro na API de relatório:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Endpoint GET para gerar relatório direto no browser
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get('tipo') || 'semanal';
  const barId = parseInt(searchParams.get('barId') || '3');

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/relatorio-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ tipo, barId, formato: 'html' })
    });

    const html = await response.text();
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });

  } catch (error: any) {
    return new Response(`<h1>Erro: ${error.message}</h1>`, {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}
