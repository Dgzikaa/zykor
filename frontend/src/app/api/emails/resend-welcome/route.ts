import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ResendWelcomeRequest {
  userId: string;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json() as ResendWelcomeRequest;

    if (!userId) {
      return NextResponse.json(
        { error: 'ID do usuário é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar dados do usuário
    const { data: usuario, error } = await supabase
      .from('usuarios_bar')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !usuario) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se o usuário ainda não redefiniu a senha
    if (usuario.senha_redefinida) {
      return NextResponse.json(
        { error: 'Usuário já redefiniu a senha. Email de boas-vindas não é mais necessário.' },
        { status: 400 }
      );
    }

    // Enviar email de boas-vindas
    const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://sgbv2.vercel.app'}/api/emails/user-welcome`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: usuario.email,
        nome: usuario.nome,
        email: usuario.email,
        senha_temporaria: 'TempPassword123!',
        role: usuario.role,
        loginUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://sgbv2.vercel.app'
      })
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error('❌ Erro ao reenviar email:', emailResult.error);
      return NextResponse.json(
        { error: `Erro ao enviar email: ${emailResult.error}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email de boas-vindas reenviado com sucesso',
      messageId: emailResult.messageId
    });

  } catch (error) {
    console.error('🚨 Erro ao reenviar email de boas-vindas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
