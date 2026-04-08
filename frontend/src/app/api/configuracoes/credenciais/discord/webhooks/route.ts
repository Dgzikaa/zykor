import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { bar_id } = await request.json();

    if (!bar_id) {
      return NextResponse.json(
        {
          error: 'bar_id é obrigatório',
        },
        { status: 400 }
      );
    }

    // Buscar todas as credenciais que podem ter webhooks do Discord
    const { data: credentials, error } = await supabase
      .from('api_credentials')
      .select('sistema, configuracoes')
      .eq('bar_id', bar_id)
      .eq('ativo', true)
      .in('sistema', [
        'banco_inter',
        'contaazul',
        'contahub',
        'checklists',
        'sistema',
        'sympla',
        'yuzer',
      ]);

    if (error) {
      console.error('❌ Erro ao buscar credenciais:', error);
      return NextResponse.json(
        {
          error: 'Erro ao buscar credenciais',
        },
        { status: 500 }
      );
    }

    // Organizar webhooks por sistema
    const webhooks: Record<string, any> = {
      banco_inter: null,
      contaazul: null,
      contahub: null,
      checklists: null,
      sistema: null,
      sympla: null,
      yuzer: null,
    };

    credentials?.forEach(cred => {
      if (cred.configuracoes?.webhook_url) {
        webhooks[cred.sistema] = {
          webhook_url: cred.configuracoes.webhook_url,
        };
      }
    });

    return NextResponse.json({
      success: true,
      ...webhooks,
    });
  } catch (error) {
    console.error('❌ Erro na API de webhooks Discord:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
      },
      { status: 500 }
    );
  }
}
