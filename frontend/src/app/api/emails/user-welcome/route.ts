import { NextRequest, NextResponse } from 'next/server';
import { enviarEmailBoasVindas } from '@/lib/emails/user-welcome';

export const dynamic = 'force-dynamic';

// Mantida por compatibilidade — a lógica vive em @/lib/emails/user-welcome.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, nome, email, senha_temporaria, role, loginUrl } = body || {};

    if (!to || !nome || !email || !senha_temporaria || !role) {
      return NextResponse.json(
        { error: 'Dados obrigatórios: to, nome, email, senha_temporaria, role' },
        { status: 400 }
      );
    }

    const r = await enviarEmailBoasVindas({ to, nome, email, senha_temporaria, role, loginUrl });
    if (!r.success) {
      const status = r.error.includes('não configurado') ? 503 : 500;
      return NextResponse.json({ error: r.error }, { status });
    }
    return NextResponse.json({ success: true, messageId: r.messageId, message: 'Email enviado' });
  } catch (error: any) {
    console.error('🚨 Erro ao enviar email de boas-vindas:', error);
    return NextResponse.json({ error: 'Erro ao enviar email de boas-vindas.' }, { status: 500 });
  }
}
