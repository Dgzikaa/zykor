import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await getAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Erro ao conectar ao banco' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '', 10);

    if (!barId || Number.isNaN(barId)) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    // Buscar credenciais do Falaê
    const { data: credencial, error } = await supabase
      .from('api_credentials')
      .select('bar_id, api_token, empresa_id, base_url')
      .eq('sistema', 'falae')
      .eq('bar_id', barId)
      .eq('ativo', true)
      .single();

    if (error || !credencial) {
      return NextResponse.json(
        { error: 'Credenciais do Falaê não encontradas para este bar' },
        { status: 404 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://zykor.vercel.app');

    return NextResponse.json({
      success: true,
      bar_id: credencial.bar_id,
      webhook_config: {
        url: `${baseUrl}/api/falae/webhook`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${credencial.api_token}`,
        },
        empresa_id: credencial.empresa_id,
      },
      instructions: {
        pt: [
          '1. Acesse o painel do Falaê: https://plataforma.falae.app/rede/integracao/webhook',
          '2. Cole a URL do webhook no campo "Link"',
          '3. Deixe o campo "Token (Opcional)" em branco',
          '4. Clique em "Configurar"',
          '5. O webhook irá enviar automaticamente as respostas para o Zykor',
        ],
      },
    });
  } catch (error) {
    console.error('Erro ao buscar configuração do webhook:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
