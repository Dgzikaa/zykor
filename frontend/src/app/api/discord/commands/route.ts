import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { command, barId } = body;
    if (!barId) return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });

    if (!command) {
      return NextResponse.json({ 
        success: false, 
        error: 'Comando é obrigatório' 
      }, { status: 400 });
    }

    // Chamar Edge Function de comandos Discord
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/discord-commands`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ command, barId })
      }
    );

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Erro ao executar comando Discord:', error);
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 });
  }
}
