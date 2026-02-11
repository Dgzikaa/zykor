import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// INTERFACES
// ============================================

interface Template {
  nome: string;
  tipo: 'whatsapp' | 'email';
  conteudo: string;
  variaveis: string[];
  categoria: string;
  whatsapp_template_name?: string; // Nome do template aprovado na Meta
}

interface WhatsAppConfig {
  provider: 'meta' | 'umbler';
  phone_number_id?: string;
  access_token?: string;
  api_version?: string;
  rate_limit_per_minute?: number;
  bar_id?: number; // para Umbler
}

// ============================================
// TEMPLATES PRÉ-DEFINIDOS
// ============================================

const TEMPLATES_WHATSAPP: Template[] = [
  {
    nome: 'Reengajamento - Cliente em Risco',
    tipo: 'whatsapp',
    categoria: 'reengajamento',
    conteudo: `Olá {nome}! 👋

Sentimos sua falta no Deboche Ordinário! 🍺✨

Preparamos algo especial para você: *{cupom_desconto}% de desconto* em sua próxima visita!

Use o cupom: *{cupom_codigo}*
Válido até: {cupom_validade}

Venha nos visitar! Estamos com novidades incríveis! 🎉

Te esperamos! 🤗`,
    variaveis: ['{nome}', '{cupom_desconto}', '{cupom_codigo}', '{cupom_validade}']
  },
  {
    nome: 'Boas-vindas - Novo Cliente',
    tipo: 'whatsapp',
    categoria: 'boas_vindas',
    conteudo: `Olá {nome}! 🎉

Foi um prazer te receber no Deboche Ordinário!

Como primeira visita, queremos te dar um presente: *{cupom_desconto}% de desconto* na sua próxima vez!

Cupom: *{cupom_codigo}*
Válido até: {cupom_validade}

Mal podemos esperar pra te ver de novo! 🍻`,
    variaveis: ['{nome}', '{cupom_desconto}', '{cupom_codigo}', '{cupom_validade}']
  },
  {
    nome: 'VIP - Cliente Especial',
    tipo: 'whatsapp',
    categoria: 'vip',
    conteudo: `Olá {nome}! ⭐

Você é um cliente VIP do Deboche Ordinário!

Como agradecimento pela sua fidelidade, temos um presente exclusivo: *{cupom_desconto}% de desconto* para você!

Cupom VIP: *{cupom_codigo}*
Válido até: {cupom_validade}

Você faz parte da nossa família! 🍺❤️`,
    variaveis: ['{nome}', '{cupom_desconto}', '{cupom_codigo}', '{cupom_validade}']
  },
  {
    nome: 'Evento Especial - Convite',
    tipo: 'whatsapp',
    categoria: 'evento',
    conteudo: `Olá {nome}! 🎊

Temos um EVENTO ESPECIAL chegando e você está convidado!

📅 Data: {evento_data}
🎵 Atração: {evento_atracao}

E mais: *{cupom_desconto}% de desconto* na entrada para você!

Cupom: *{cupom_codigo}*

Garanta sua vaga! 🎉`,
    variaveis: ['{nome}', '{evento_data}', '{evento_atracao}', '{cupom_desconto}', '{cupom_codigo}']
  },
  {
    nome: 'Saudade - Cliente Inativo',
    tipo: 'whatsapp',
    categoria: 'reativacao',
    conteudo: `Ei {nome}! 😢

Faz tempo que você não aparece por aqui...

O Deboche tá com saudade! 🍺

Volta pra gente? Temos *{cupom_desconto}% de desconto* te esperando!

Cupom: *{cupom_codigo}*
Válido até: {cupom_validade}

Bora matar a saudade? 🤗`,
    variaveis: ['{nome}', '{cupom_desconto}', '{cupom_codigo}', '{cupom_validade}']
  }
];

const TEMPLATES_EMAIL: Template[] = [
  {
    nome: 'Newsletter Mensal',
    tipo: 'email',
    categoria: 'newsletter',
    conteudo: `
      <h1>Olá {nome}!</h1>
      <p>Confira as novidades do mês no Deboche Ordinário:</p>
      <ul>
        <li>🎵 Novos shows toda semana</li>
        <li>🍔 Menu renovado com pratos especiais</li>
        <li>🍺 Cervejas artesanais em promoção</li>
      </ul>
      <p>E mais: <strong>{cupom_desconto}% de desconto</strong> especial para você!</p>
      <p>Cupom: <strong>{cupom_codigo}</strong></p>
      <p>Válido até: {cupom_validade}</p>
    `,
    variaveis: ['{nome}', '{cupom_desconto}', '{cupom_codigo}', '{cupom_validade}']
  }
];

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function gerarCodigoCupom(prefixo: string = 'DBO'): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let codigo = prefixo;
  for (let i = 0; i < 6; i++) {
    codigo += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return codigo;
}

function substituirVariaveis(template: string, dados: Record<string, string>): string {
  let resultado = template;
  Object.entries(dados).forEach(([key, value]) => {
    resultado = resultado.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  });
  return resultado;
}

// Função para delay entre mensagens (rate limiting)
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// WHATSAPP BUSINESS API - ENVIO REAL
// ============================================

async function getWhatsAppConfig(barId?: number): Promise<WhatsAppConfig | null> {
  try {
    let query = supabase.from('whatsapp_configuracoes').select('*').eq('ativo', true);
    if (barId) query = query.eq('bar_id', barId);
    const { data, error } = await query.single();
    if (!error && data) {
      return {
        provider: 'meta',
        phone_number_id: data.phone_number_id,
        access_token: data.access_token,
        api_version: data.api_version || 'v18.0',
        rate_limit_per_minute: data.rate_limit_per_minute || 80,
      };
    }
  } catch (_e) {
    /* tabela pode não existir - fallback Umbler */
  }

  const umblerQuery = barId
    ? supabase.from('umbler_config').select('bar_id').eq('bar_id', barId).eq('ativo', true)
    : supabase.from('umbler_config').select('bar_id').eq('ativo', true).limit(1);
  const { data: uc } = await umblerQuery.single();
  const uid = (uc as any)?.bar_id;
  if (uid) {
    return { provider: 'umbler', bar_id: uid, rate_limit_per_minute: 60 };
  }
  return null;
}

async function enviarWhatsAppMessage(
  config: WhatsAppConfig,
  telefone: string,
  mensagem: string,
  campanhaId: string,
  clienteNome: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (config.provider === 'umbler' && config.bar_id) {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/umbler/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bar_id: config.bar_id,
        mode: 'single',
        to_phone: telefone,
        message: mensagem,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      await supabase.from('crm_envios').insert({
        campanha_id: campanhaId,
        cliente_telefone: telefone,
        cliente_nome: clienteNome,
        tipo: 'whatsapp',
        mensagem,
        status: 'erro',
        erro_detalhes: data.error || String(data),
        criado_em: new Date().toISOString(),
      });
      return { success: false, error: data.error || 'Erro Umbler' };
    }
    const ok = data.success ?? !!data.messageId;
    if (ok) {
      await supabase.from('crm_envios').insert({
        campanha_id: campanhaId,
        cliente_telefone: telefone,
        cliente_nome: clienteNome,
        tipo: 'whatsapp',
        mensagem,
        status: 'enviado',
        whatsapp_message_id: data.messageId,
        enviado_em: new Date().toISOString(),
      });
    }
    return { success: ok, messageId: data.messageId };
  }

  try {
    const url = `https://graph.facebook.com/${config.api_version}/${config.phone_number_id}/messages`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: telefone,
        type: 'text',
        text: {
          preview_url: false,
          body: mensagem
        }
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('Erro WhatsApp API:', result);
      
      // Registrar erro no banco
      await supabase.from('crm_envios').insert({
        campanha_id: campanhaId,
        cliente_telefone: telefone,
        cliente_nome: clienteNome,
        tipo: 'whatsapp',
        mensagem,
        status: 'erro',
        erro_detalhes: result.error?.message || JSON.stringify(result),
        criado_em: new Date().toISOString()
      });
      
      return { success: false, error: result.error?.message || 'Erro desconhecido' };
    }
    
    const messageId = result.messages?.[0]?.id;
    
    // Registrar sucesso no banco
    await supabase.from('crm_envios').insert({
      campanha_id: campanhaId,
      cliente_telefone: telefone,
      cliente_nome: clienteNome,
      tipo: 'whatsapp',
      mensagem,
      status: 'enviado',
      whatsapp_message_id: messageId,
      enviado_em: new Date().toISOString()
    });
    
    try {
      await supabase.from('whatsapp_messages').insert({
        to_number: telefone,
        message: mensagem,
        type: 'campanha',
        provider: 'meta',
        status: 'sent',
        provider_response: result,
        sent_at: new Date().toISOString(),
      });
    } catch (_e) {
      /* tabela pode não existir - legado */
    }
    
    return { success: true, messageId };
    
  } catch (error: any) {
    console.error('Erro ao enviar WhatsApp:', error);
    
    await supabase.from('crm_envios').insert({
      campanha_id: campanhaId,
      cliente_telefone: telefone,
      cliente_nome: clienteNome,
      tipo: 'whatsapp',
      mensagem,
      status: 'erro',
      erro_detalhes: error.message,
      criado_em: new Date().toISOString()
    });
    
    return { success: false, error: error.message };
  }
}

// ============================================
// GET - LISTAR CAMPANHAS E ESTATÍSTICAS
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo');
    const status = searchParams.get('status');
    const incluirStats = searchParams.get('stats') === 'true';

    // Listar campanhas
    let query = supabase
      .from('crm_campanhas')
      .select('*')
      .order('criado_em', { ascending: false });

    if (tipo) {
      query = query.eq('tipo', tipo);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data: campanhas, error } = await query;

    if (error) {
      throw error;
    }

    // Buscar templates do banco
    const { data: templatesDB } = await supabase
      .from('crm_templates')
      .select('*')
      .eq('ativo', true)
      .order('categoria');
    
    const templatesWhatsapp = templatesDB?.filter(t => t.tipo === 'whatsapp') || TEMPLATES_WHATSAPP;
    const templatesEmail = templatesDB?.filter(t => t.tipo === 'email') || TEMPLATES_EMAIL;

    // Contar clientes por segmento
    let segmentosStats: Record<string, number> | null = null;
    if (incluirStats) {
      const { data: stats } = await supabase
        .from('crm_segmentacao')
        .select('segmento')
        .then(res => {
          if (!res.data) return { data: null };
          const counts: Record<string, number> = {};
          res.data.forEach(item => {
            counts[item.segmento] = (counts[item.segmento] || 0) + 1;
          });
          return { data: counts };
        });
      segmentosStats = stats;
    }

    // Verificar se WhatsApp está configurado
    const whatsappConfig = await getWhatsAppConfig();
    const whatsappConfigurado = !!whatsappConfig;

    return NextResponse.json({
      success: true,
      data: campanhas || [],
      templates_whatsapp: templatesWhatsapp,
      templates_email: templatesEmail,
      segmentos_stats: segmentosStats,
      whatsapp_configurado: whatsappConfigurado
    });

  } catch (error: any) {
    console.error('Erro ao listar campanhas:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ============================================
// POST - CRIAR E EXECUTAR CAMPANHA
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      nome,
      tipo,
      segmento_alvo,
      template_id,
      template_custom,
      cupom_desconto,
      cupom_validade_dias,
      agendamento,
      executar_agora,
      dados_extras,
      bar_id,
      limite_envios // Opcional: limitar quantidade para teste
    } = body;

    // 1. Validações
    if (!nome || !tipo || !segmento_alvo || segmento_alvo.length === 0) {
      throw new Error('Nome, tipo e segmento são obrigatórios');
    }

    // 2. Selecionar template
    let template: Template | undefined;
    if (template_id) {
      if (tipo === 'whatsapp') {
        template = TEMPLATES_WHATSAPP.find(t => t.nome === template_id);
      } else if (tipo === 'email') {
        template = TEMPLATES_EMAIL.find(t => t.nome === template_id);
      }
    }

    const mensagemTemplate = template?.conteudo || template_custom;

    if (!mensagemTemplate) {
      throw new Error('Template ou mensagem personalizada é obrigatório');
    }

    // 3. Gerar cupom se necessário
    let codigoCupom: string | undefined;
    let validadeCupom: string | undefined;

    if (cupom_desconto && cupom_desconto > 0) {
      codigoCupom = gerarCodigoCupom();
      
      const dataValidade = new Date();
      dataValidade.setDate(dataValidade.getDate() + (cupom_validade_dias || 7));
      validadeCupom = dataValidade.toISOString().split('T')[0];

      // Salvar cupom
      await supabase.from('crm_cupons').insert({
        bar_id,
        codigo: codigoCupom,
        desconto_percentual: cupom_desconto,
        validade: validadeCupom,
        tipo: 'campanha',
        ativo: true
      });
    }

    // 4. Buscar clientes do segmento alvo (usando tabela real!)
    let clientesQuery = supabase
      .from('crm_segmentacao')
      .select('cliente_telefone, cliente_telefone_normalizado, cliente_nome, segmento')
      .in('segmento', segmento_alvo)
      .eq('aceita_whatsapp', true);

    if (bar_id) {
      clientesQuery = clientesQuery.eq('bar_id', bar_id);
    }

    const { data: clientes, error: clientesError } = await clientesQuery;

    if (clientesError) {
      throw clientesError;
    }

    if (!clientes || clientes.length === 0) {
      throw new Error('Nenhum cliente encontrado no segmento alvo');
    }

    // 5. Criar campanha
    const { data: campanhaData, error: campanhaError } = await supabase
      .from('crm_campanhas')
      .insert({
        bar_id,
        nome,
        tipo,
        segmento_alvo,
        template_mensagem: mensagemTemplate,
        cupom_desconto,
        cupom_codigo: codigoCupom,
        cupom_validade: validadeCupom,
        agendamento,
        status: executar_agora ? 'em_execucao' : agendamento ? 'agendada' : 'rascunho',
        enviados: 0,
        entregues: 0,
        abertos: 0,
        cliques: 0,
        conversoes: 0
      })
      .select()
      .single();

    if (campanhaError) {
      throw campanhaError;
    }

    // 6. Se executar agora, enviar mensagens
    if (executar_agora && tipo === 'whatsapp') {
      const whatsappConfig = await getWhatsAppConfig(bar_id);
      if (!whatsappConfig) {
        // Atualizar status da campanha para rascunho
        await supabase
          .from('crm_campanhas')
          .update({ status: 'rascunho' })
          .eq('id', campanhaData.id);
          
        throw new Error('WhatsApp não configurado. Configure as credenciais em Configurações > WhatsApp');
      }

      let enviadosCount = 0;
      let errosCount = 0;
      
      // Limitar envios para teste (ou usar todos)
      const clientesParaEnviar = limite_envios 
        ? clientes.slice(0, limite_envios) 
        : clientes;
      
      const delayMs = Math.ceil(60000 / (whatsappConfig.rate_limit_per_minute || 60));
      
      console.log(`Iniciando envio para ${clientesParaEnviar.length} clientes...`);
      console.log(`Rate limit: ${whatsappConfig.rate_limit_per_minute}/min (delay: ${delayMs}ms)`);

      for (let i = 0; i < clientesParaEnviar.length; i++) {
        const cliente = clientesParaEnviar[i];
        
        try {
          // Substituir variáveis na mensagem
          const primeiroNome = cliente.cliente_nome?.split(' ')[0] || 'Cliente';
          
          const mensagemPersonalizada = substituirVariaveis(mensagemTemplate, {
            nome: primeiroNome,
            cupom_desconto: cupom_desconto?.toString() || '',
            cupom_codigo: codigoCupom || '',
            cupom_validade: validadeCupom ? new Date(validadeCupom).toLocaleDateString('pt-BR') : '',
            ...dados_extras
          });

          // Enviar via WhatsApp Business API
          const resultado = await enviarWhatsAppMessage(
            whatsappConfig,
            cliente.cliente_telefone_normalizado,
            mensagemPersonalizada,
            campanhaData.id,
            cliente.cliente_nome || 'Cliente'
          );

          if (resultado.success) {
            enviadosCount++;
          } else {
            errosCount++;
          }

          // Rate limiting - aguardar entre mensagens
          if (i < clientesParaEnviar.length - 1) {
            await delay(delayMs);
          }

          // Log de progresso a cada 10 mensagens
          if ((i + 1) % 10 === 0) {
            console.log(`Progresso: ${i + 1}/${clientesParaEnviar.length} (${enviadosCount} OK, ${errosCount} erros)`);
            
            // Atualizar contador no banco
            await supabase
              .from('crm_campanhas')
              .update({ enviados: enviadosCount })
              .eq('id', campanhaData.id);
          }

        } catch (error) {
          console.error(`Erro ao enviar para ${cliente.cliente_nome}:`, error);
          errosCount++;
        }
      }

      // Atualizar campanha com totais finais
      await supabase
        .from('crm_campanhas')
        .update({ 
          enviados: enviadosCount,
          status: 'concluida'
        })
        .eq('id', campanhaData.id);

      campanhaData.enviados = enviadosCount;
      campanhaData.status = 'concluida';

      console.log(`✅ Campanha finalizada: ${enviadosCount} enviados, ${errosCount} erros`);
    }

    return NextResponse.json({
      success: true,
      data: campanhaData,
      total_clientes: clientes.length,
      mensagem: executar_agora 
        ? `Campanha executada! ${campanhaData.enviados} mensagens enviadas para ${clientes.length} clientes.`
        : `Campanha criada com sucesso! ${clientes.length} clientes no segmento alvo.`
    });

  } catch (error: any) {
    console.error('Erro ao criar campanha:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ============================================
// PUT - ATUALIZAR CAMPANHA
// ============================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      throw new Error('ID da campanha é obrigatório');
    }

    const { data, error } = await supabase
      .from('crm_campanhas')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error: any) {
    console.error('Erro ao atualizar campanha:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - CANCELAR CAMPANHA
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      throw new Error('ID da campanha é obrigatório');
    }

    const { data, error } = await supabase
      .from('crm_campanhas')
      .update({ status: 'cancelada' })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error: any) {
    console.error('Erro ao cancelar campanha:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
