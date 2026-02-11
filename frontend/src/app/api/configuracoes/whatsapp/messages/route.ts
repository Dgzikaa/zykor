import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import { z } from 'zod';

export const dynamic = 'force-dynamic'

// Interfaces para tipagem adequada
interface ProcessedParams {
  page?: number;
  limit?: number;
  status?: string;
  modulo?: string;
  template_name?: string;
  data_inicio?: string;
  data_fim?: string;
  destinatario?: string;
}

interface WhatsAppContact {
  numero_whatsapp: string;
  nome_contato: string;
  dias_semana: number[];
  horario_inicio: string;
  horario_fim: string;
  usuarios_bar: {
    nome: string;
    cargo: string;
  };
}

interface WhatsAppMessage {
  id: string;
  whatsapp_message_id: string;
  tipo_mensagem: 'template' | 'text';
  template_name?: string;
  template_parameters?: string[];
  conteudo?: string;
  status: string;
  error_message?: string;
  tentativas: number;
  enviado_em?: string;
  entregue_em?: string;
  lido_em?: string;
  modulo: string;
  checklist_id?: string;
  checklist_execucao_id?: string;
  created_at: string;
  whatsapp_contatos: WhatsAppContact;
}

interface WhatsAppConfig {
  api_version: string;
  phone_number_id: string;
  access_token: string;
  idioma: string;
}

// Schema de validação para enviar mensagem
const SendMessageSchema = z.object({
  destinatario: z.string().min(1, 'Destinatário é obrigatório'),
  tipo_mensagem: z.enum(['text', 'template']),
  conteudo: z.string().min(1, 'Conteúdo é obrigatório'),
  template_name: z.string().optional(),
  template_parameters: z.array(z.string()).optional(),
  modulo: z.string().optional(),
  checklist_id: z.number().optional(),
  checklist_execucao_id: z.number().optional(),
  prioridade: z.enum(['baixa', 'normal', 'alta']).default('normal'),
});

// Schema para filtros de listagem
const FilterSchema = z.object({
  status: z.enum(['pending', 'sent', 'delivered', 'read', 'failed']).optional(),
  modulo: z.string().optional(),
  data_inicio: z.string().optional(),
  data_fim: z.string().optional(),
  destinatario: z.string().optional(),
  template_name: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// ========================================
// 📱 GET /api/configuracoes/whatsapp/messages
// ========================================
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseClient();
    
    if (!supabase) {
      return NextResponse.json(
        { error: 'Erro ao conectar com o banco de dados' },
        { status: 500 }
      );
    }

    // Extrair bar_id do header ou query
    const bar_id = request.headers.get('x-bar-id') || 
                   new URL(request.url).searchParams.get('bar_id');

    if (!bar_id) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    // Parse dos parâmetros de query
    const url = new URL(request.url);
    const rawParams = Object.fromEntries(url.searchParams.entries());

    // Converter tipos numéricos
    const processedParams: ProcessedParams = { ...rawParams };
    if (processedParams.page) {
      processedParams.page = parseInt(processedParams.page.toString());
    }
    if (processedParams.limit) {
      processedParams.limit = parseInt(processedParams.limit.toString());
    }

    const params = FilterSchema.parse(processedParams);

    // Construir query base (tabelas legadas - sistema migrado para Umbler)
    let query = (supabase as any)
      .from('whatsapp_mensagens')
      .select(
        `
        id,
        whatsapp_message_id,
        tipo_mensagem,
        template_name,
        conteudo,
        status,
        error_message,
        tentativas,
        enviado_em,
        entregue_em,
        lido_em,
        modulo,
        checklist_id,
        checklist_execucao_id,
        created_at,
        whatsapp_contatos!inner(
          numero_whatsapp,
          nome_contato,
          usuarios_bar!inner(nome, cargo)
        )
      `
      )
      .eq('bar_id', parseInt(bar_id))
      .order('created_at', { ascending: false });

    // Aplicar filtros
    if (params.status) {
      query = query.eq('status', params.status);
    }
    if (params.modulo) {
      query = query.eq('modulo', params.modulo);
    }
    if (params.template_name) {
      query = query.eq('template_name', params.template_name);
    }
    if (params.data_inicio) {
      query = query.gte('created_at', params.data_inicio);
    }
    if (params.data_fim) {
      query = query.lte('created_at', params.data_fim);
    }
    if (params.destinatario) {
      query = query.ilike(
        'whatsapp_contatos.numero_whatsapp',
        `%${params.destinatario}%`
      );
    }

    // Paginação
    const offset = (params.page - 1) * params.limit;
    query = query.range(offset, offset + params.limit - 1);

    const { data: mensagens, error } = await query;

    if (error) {
      console.error('Erro ao buscar mensagens:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar mensagens' },
        { status: 500 }
      );
    }

    // Buscar estatísticas
    const { data: stats } = await (supabase as any)
      .from('whatsapp_mensagens')
      .select('status')
      .eq('bar_id', parseInt(bar_id));

    const estatisticas = {
      total: stats?.length || 0,
      pending: stats?.filter(m => m.status === 'pending').length || 0,
      sent: stats?.filter(m => m.status === 'sent').length || 0,
      delivered: stats?.filter(m => m.status === 'delivered').length || 0,
      read: stats?.filter(m => m.status === 'read').length || 0,
      failed: stats?.filter(m => m.status === 'failed').length || 0,
    };

    return NextResponse.json({
      success: true,
      data: mensagens,
      estatisticas,
      pagination: {
        page: params.page,
        limit: params.limit,
        total: estatisticas.total,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Parâmetros inválidos',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    console.error('Erro na API de mensagens WhatsApp:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// ========================================
// 📱 POST /api/configuracoes/whatsapp/messages
// ========================================
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        { error: 'Erro ao conectar com o banco de dados' },
        { status: 500 }
      );
    }

    // Extrair bar_id do header ou query
    const bar_id = request.headers.get('x-bar-id') || 
                   new URL(request.url).searchParams.get('bar_id');

    if (!bar_id) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    const { bar_id: barId, permissao, usuario_id } = JSON.parse(request.headers.get('x-user-data') || '{}');

    // Verificar permissões
    if (!['financeiro', 'admin'].includes(permissao)) {
      return NextResponse.json(
        { error: 'Sem permissão para enviar mensagens' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = SendMessageSchema.parse(body);

    // Verificar se WhatsApp está configurado
    const { data: config, error: configError } = await (supabase as any)
      .from('whatsapp_configuracoes')
      .select('*')
      .eq('bar_id', parseInt(bar_id))
      .eq('ativo', true)
      .single();

    if (configError || !config) {
      return NextResponse.json(
        {
          error: 'WhatsApp não configurado ou inativo',
        },
        { status: 409 }
      );
    }

    // Buscar ou criar contato
    const contato = await getOrCreateContact(
      bar_id,
      validatedData.destinatario,
      usuario_id
    );

    if (!contato) {
      return NextResponse.json(
        {
          error: 'Não foi possível identificar o contato',
        },
        { status: 400 }
      );
    }

    // Verificar se contato aceita notificações
    if (!contato.aceita_notificacoes) {
      return NextResponse.json(
        {
          error: 'Contato não aceita notificações WhatsApp',
        },
        { status: 409 }
      );
    }

    // Verificar horário permitido
    if (!isWithinAllowedHours(contato as any)) {
      return NextResponse.json(
        {
          error: 'Fora do horário permitido para envio',
        },
        { status: 409 }
      );
    }

    // Preparar dados da mensagem
    const messageData = {
      bar_id: parseInt(bar_id),
      contato_id: contato.id,
      tipo_mensagem: validatedData.tipo_mensagem,
      template_name: validatedData.template_name,
      conteudo: validatedData.conteudo,
      template_parameters: JSON.stringify(validatedData.template_parameters || []),
      modulo: validatedData.modulo || 'manual',
      checklist_id: validatedData.checklist_id,
      checklist_execucao_id: validatedData.checklist_execucao_id,
      status: 'pending',
    };

    // Salvar mensagem no banco
    const { data: mensagem, error: saveError } = await (supabase as any)
      .from('whatsapp_mensagens')
      .insert(messageData)
      .select()
      .single();

    if (saveError) {
      console.error('Erro ao salvar mensagem:', saveError);
      return NextResponse.json(
        { error: 'Erro ao salvar mensagem' },
        { status: 500 }
      );
    }

    // Enviar mensagem via WhatsApp API
    const sendResult = await sendWhatsAppMessage(config as any, contato as any, mensagem as any);

    // Atualizar status da mensagem
    const updateData = {
      status: sendResult.success ? 'sent' : 'failed',
      whatsapp_message_id: sendResult.messageId,
      tentativas: 1,
      enviado_em: sendResult.success ? new Date().toISOString() : null,
      error_code: sendResult.errorCode,
      error_message: sendResult.errorMessage,
    };

    await (supabase as any)
      .from('whatsapp_mensagens')
      .update(updateData)
      .eq('id', mensagem.id);

    // Atualizar estatísticas do contato
    if (sendResult.success) {
      await (supabase as any)
        .from('whatsapp_contatos')
        .update({
          total_mensagens_enviadas: (contato.total_mensagens_enviadas || 0) + 1,
          ultima_interacao: new Date().toISOString(),
        })
        .eq('id', contato.id);
    }

    return NextResponse.json(
      {
        success: sendResult.success,
        data: { ...mensagem, ...updateData },
        message: sendResult.success
          ? 'Mensagem enviada com sucesso'
          : 'Falha no envio',
        details: sendResult.errorMessage,
      },
      { status: sendResult.success ? 201 : 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    console.error('Erro na API de mensagens:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// ========================================
// 🔧 FUNÇÕES AUXILIARES
// ========================================

/**
 * Busca ou cria contato WhatsApp
 */
async function getOrCreateContact(
  barId: string,
  numeroWhatsapp: string,
  usuarioId?: number
) {
  const supabase = await getSupabaseClient();

  if (!supabase) {
    return null;
  }

  // Primeiro, tentar buscar contato existente (tabela legada)
  const { data: contato } = await (supabase as any)
    .from('whatsapp_contatos')
    .select('*')
    .eq('bar_id', parseInt(barId))
    .eq('numero_whatsapp', numeroWhatsapp)
    .single();

  if (contato) {
    return contato;
  }

  // Se não encontrou e tem usuarioId, criar novo contato
  if (usuarioId) {
    // Buscar dados do usuário
    const { data: usuario } = await supabase
      .from('usuarios_bar')
      .select('nome')
      .eq('id', usuarioId)
      .single();

    if (usuario) {
      const { data: novoContato } = await (supabase as any)
        .from('whatsapp_contatos')
        .insert({
          bar_id: parseInt(barId),
          usuario_id: usuarioId,
          numero_whatsapp: numeroWhatsapp,
          nome_contato: usuario.nome,
          verificado: false,
        })
        .select()
        .single();

      return novoContato;
    }
  }

  return null;
}

/**
 * Verifica se está dentro do horário permitido
 */
function isWithinAllowedHours(contato: WhatsAppContact): boolean {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM
  const currentDay = now.getDay() + 1; // 1=Domingo

  // Verificar dia da semana
  if (!contato.dias_semana.includes(currentDay)) {
    return false;
  }

  // Verificar horário
  return (
    currentTime >= contato.horario_inicio && currentTime <= contato.horario_fim
  );
}

/**
 * Envia mensagem via WhatsApp Business API
 */
async function sendWhatsAppMessage(
  config: WhatsAppConfig,
  contato: WhatsAppContact,
  mensagem: WhatsAppMessage
): Promise<{
  success: boolean;
  messageId?: string;
  errorCode?: string;
  errorMessage?: string;
}> {
  try {
    const url = `https://graph.facebook.com/${config.api_version}/${config.phone_number_id}/messages`;

    interface WhatsAppPayload {
      messaging_product: string;
      to: string;
      type: 'template' | 'text';
      template?: {
        name: string;
        language: { code: string };
        components: Array<{
          type: string;
          parameters: Array<{
            type: string;
            text: string;
          }>;
        }>;
      };
      text?: {
        body: string;
      };
    }

    const payload: WhatsAppPayload = {
      messaging_product: 'whatsapp',
      to: contato.numero_whatsapp,
      type: mensagem.tipo_mensagem,
    };

    if (mensagem.tipo_mensagem === 'template') {
      payload.template = {
        name: mensagem.template_name || '',
        language: { code: config.idioma },
        components: [],
      };

      // Adicionar parâmetros se existirem
      if (
        mensagem.template_parameters &&
        mensagem.template_parameters.length > 0
      ) {
        payload.template.components.push({
          type: 'body',
          parameters: mensagem.template_parameters.map((param: string) => ({
            type: 'text',
            text: param,
          })),
        });
      }
    } else {
      payload.text = { body: mensagem.conteudo || '' };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (response.ok) {
      return {
        success: true,
        messageId: result.messages[0].id,
      };
    } else {
      return {
        success: false,
        errorCode: result.error?.code?.toString(),
        errorMessage: result.error?.message || 'Erro desconhecido',
      };
    }
  } catch (error) {
    console.error('Erro ao enviar mensagem WhatsApp:', error);
    return {
      success: false,
      errorCode: 'NETWORK_ERROR',
      errorMessage: 'Erro de conexão com WhatsApp API',
    };
  }
}
