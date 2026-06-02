import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

const supabase = createServiceRoleClient();

/**
 * GET /api/umbler/config
 * Retorna configuração da Umbler para o bar
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id') || '3';

    const { data, error } = await supabase
      .from('umbler_config')
      .select('id, bar_id, organization_id, channel_id, channel_name, phone_number, ativo, rate_limit_per_minute, created_at, updated_at')
      .eq('bar_id', parseInt(barId))
      .eq('ativo', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Erro ao buscar config Umbler:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      configurado: !!data,
      config: data || null
    });

  } catch (error) {
    console.error('Erro na API Umbler Config:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/umbler/config
 * Cria ou atualiza configuração da Umbler
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      bar_id,
      organization_id,
      channel_id,
      channel_name,
      phone_number,
      api_token,
      webhook_secret,
      rate_limit_per_minute
    } = body;

    if (!bar_id || !organization_id || !channel_id || !phone_number || !api_token) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: bar_id, organization_id, channel_id, phone_number, api_token' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('umbler_config')
      .upsert({
        bar_id: parseInt(bar_id),
        organization_id,
        channel_id,
        channel_name,
        phone_number,
        api_token,
        webhook_secret,
        rate_limit_per_minute: rate_limit_per_minute || 60,
        ativo: true
      }, { onConflict: 'bar_id,channel_id' })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar config Umbler:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      config: data
    });

  } catch (error) {
    console.error('Erro na API Umbler Config:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/umbler/config
 * Desativa configuração da Umbler
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const channelId = searchParams.get('channel_id');

    if (!barId) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('umbler_config')
      .update({ ativo: false })
      .eq('bar_id', parseInt(barId));

    if (channelId) {
      query = query.eq('channel_id', channelId);
    }

    const { error } = await query;

    if (error) {
      console.error('Erro ao desativar config Umbler:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Erro na API Umbler Config:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
