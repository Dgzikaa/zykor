import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Obter configuração atual do WhatsApp (usa Umbler - whatsapp_configuracoes foi removido na limpeza)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');

    // Tabela whatsapp_configuracoes foi removida - sistema usa Umbler para WhatsApp
    // Buscar config do Umbler como fallback
    let query = supabase.from('umbler_config').select('*');
    
    if (barId) {
      query = query.eq('bar_id', parseInt(barId));
    }
    
    const { data, error } = await query.maybeSingle();

    if (error) {
      // Tabela pode não existir ou erro de permissão
      console.warn('Erro ao buscar config Umbler:', error.message);
      return NextResponse.json({
        success: true,
        data: null,
        configurado: false,
        mensagem: 'Configuração WhatsApp (Umbler) não encontrada'
      });
    }

    // Mascarar token para segurança (umbler_config usa api_token)
    const configMascarada = data ? {
      ...data,
      access_token: data.api_token ? '***' + (String(data.api_token).slice(-10)) : null,
      configurado: !!data.api_token && !!data.channel_id
    } : null;

    return NextResponse.json({
      success: true,
      data: configMascarada,
      configurado: !!configMascarada?.configurado
    });

  } catch (error: any) {
    console.error('Erro ao buscar config WhatsApp:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - Salvar/Atualizar configuração do WhatsApp (usa Umbler - umbler_config)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      bar_id,
      phone_number_id,
      access_token,
      channel_id,
      organization_id,
      api_token,
      rate_limit_per_minute
    } = body;

    // Validações - Umbler usa api_token, channel_id
    const token = api_token || access_token;
    const channel = channel_id || phone_number_id;
    
    if (!channel) {
      throw new Error('Channel ID / Phone Number ID é obrigatório');
    }
    if (!token) {
      throw new Error('API Token / Access Token é obrigatório');
    }

    // Verificar se já existe configuração para este bar
    const { data: existente } = await supabase
      .from('umbler_config')
      .select('id')
      .eq('bar_id', bar_id || null)
      .maybeSingle();

    const configData = {
      bar_id: bar_id || null,
      channel_id: channel,
      organization_id: organization_id || null,
      api_token: token,
      rate_limit_per_minute: rate_limit_per_minute || 80,
      ativo: true,
      updated_at: new Date().toISOString()
    };

    let result;
    if (existente) {
      result = await supabase
        .from('umbler_config')
        .update(configData)
        .eq('id', existente.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('umbler_config')
        .insert({
          ...configData,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
    }

    if (result.error) {
      throw result.error;
    }

    return NextResponse.json({
      success: true,
      data: {
        ...result.data,
        api_token: '***' + String(token).slice(-10)
      },
      mensagem: existente ? 'Configuração atualizada!' : 'Configuração salva!'
    });

  } catch (error: any) {
    console.error('Erro ao salvar config WhatsApp:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PUT - Testar conexão com WhatsApp
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone_number_id, access_token, api_version } = body;

    if (!phone_number_id || !access_token) {
      throw new Error('Phone Number ID e Access Token são obrigatórios para teste');
    }

    const version = api_version || 'v18.0';
    
    // Testar conexão buscando informações do telefone
    const url = `https://graph.facebook.com/${version}/${phone_number_id}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: result.error?.message || 'Erro ao conectar com WhatsApp API',
        detalhes: result.error
      });
    }

    return NextResponse.json({
      success: true,
      mensagem: 'Conexão estabelecida com sucesso!',
      dados_telefone: {
        id: result.id,
        display_phone_number: result.display_phone_number,
        verified_name: result.verified_name,
        quality_rating: result.quality_rating
      }
    });

  } catch (error: any) {
    console.error('Erro ao testar WhatsApp:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Desativar configuração
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      throw new Error('ID da configuração é obrigatório');
    }

    const { data, error } = await supabase
      .from('umbler_config')
      .update({ ativo: false })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      mensagem: 'Configuração desativada'
    });

  } catch (error: any) {
    console.error('Erro ao desativar config:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}






















