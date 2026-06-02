import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic'

const supabase = createServiceRoleClient();

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: 'E-mail é obrigatório',
        },
        { status: 400 }
      );
    }

    // Verificar se o usuário existe na tabela usuario_bares
    const { data: user, error: userError } = await supabase
      .from('usuario_bares')
      .select('*')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: 'E-mail não encontrado em nosso sistema',
        },
        { status: 404 }
      );
    }

    // Gerar token de redefinição de senha
    const resetToken = crypto.randomUUID();
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1); // Expira em 1 hora

    // Salvar token no banco
    const { error: updateError } = await supabase
      .from('usuario_bares')
      .update({
        reset_token: resetToken,
        reset_token_expiry: resetTokenExpiry.toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Erro ao salvar token:', updateError);
      return NextResponse.json(
        {
          success: false,
          error: 'Erro interno do servidor',
        },
        { status: 500 }
      );
    }

    // Enviar e-mail de recuperação (usando Supabase Auth)
    const { error: authError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/usuarios/redefinir-senha?token=${resetToken}&email=${encodeURIComponent(email)}`,
      }
    );

    if (authError) {
      console.error('Erro ao enviar e-mail:', authError);
      return NextResponse.json(
        {
          success: false,
          error: 'Erro ao enviar e-mail de recuperação',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'E-mail de recuperação enviado com sucesso',
    });
  } catch (error) {
    console.error('Erro na recuperação de senha:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
      },
      { status: 500 }
    );
  }
}
