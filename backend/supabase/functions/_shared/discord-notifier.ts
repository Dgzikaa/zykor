/**
 * 📢 Discord Notifier - Envio Padronizado de Notificações
 * 
 * Módulo compartilhado para envio de mensagens ao Discord.
 * Suporta webhooks, embeds, e formatação rica.
 */

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: {
    text: string;
    icon_url?: string;
  };
  timestamp?: string;
  thumbnail?: {
    url: string;
  };
  image?: {
    url: string;
  };
}

export interface DiscordMessage {
  content?: string;
  embeds?: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}

/**
 * Cores padrão para embeds
 */
export const DiscordColors = {
  SUCCESS: 0x00ff00,
  ERROR: 0xff0000,
  WARNING: 0xffaa00,
  INFO: 0x0099ff,
  NEUTRAL: 0x95a5a6,
  PURPLE: 0x9b59b6,
  GOLD: 0xf1c40f,
} as const;

/**
 * Obter webhook URL do Discord via variáveis de ambiente
 */
function getDiscordWebhookUrl(tipo: 'alertas' | 'agentes' | 'sync' | 'geral' = 'geral'): string {
  const webhookMap = {
    alertas: Deno.env.get('DISCORD_WEBHOOK_ALERTAS'),
    agentes: Deno.env.get('DISCORD_WEBHOOK_AGENTES'),
    sync: Deno.env.get('DISCORD_WEBHOOK_SYNC'),
    geral: Deno.env.get('DISCORD_WEBHOOK_URL'),
  };
  
  const webhook = webhookMap[tipo] || webhookMap.geral;
  
  if (!webhook) {
    throw new Error(`Discord webhook não configurado para tipo: ${tipo}`);
  }
  
  return webhook;
}

/**
 * Obter webhook URL do Discord via banco de dados
 * Fallback para variáveis de ambiente se não encontrar no banco
 */
export async function getDiscordWebhookFromDb(
  supabase: any,
  tipo: string,
  barId?: number
): Promise<string | null> {
  try {
    let query = supabase
      .from('discord_webhooks')
      .select('webhook_url')
      .eq('tipo', tipo)
      .eq('ativo', true);
    
    if (barId) {
      query = query.eq('bar_id', barId);
    }
    
    const { data, error } = await query.single();
    
    if (error || !data?.webhook_url) {
      const envMap: Record<string, string | undefined> = {
        alertas: Deno.env.get('DISCORD_WEBHOOK_ALERTAS'),
        agentes: Deno.env.get('DISCORD_WEBHOOK_AGENTES'),
        sync: Deno.env.get('DISCORD_WEBHOOK_SYNC'),
        geral: Deno.env.get('DISCORD_WEBHOOK_URL'),
      };
      return envMap[tipo] || envMap.geral || null;
    }
    
    return data.webhook_url;
  } catch (err) {
    console.error(`⚠️ Erro ao buscar webhook do tipo ${tipo}:`, err);
    return null;
  }
}

/**
 * Enviar mensagem simples ao Discord
 */
export async function sendDiscordMessage(
  content: string,
  tipo: 'alertas' | 'agentes' | 'sync' | 'geral' = 'geral'
): Promise<boolean> {
  try {
    const webhookUrl = getDiscordWebhookUrl(tipo);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    
    if (!response.ok) {
      console.error(`❌ Erro ao enviar mensagem ao Discord: ${response.status}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem ao Discord:', error);
    return false;
  }
}

/**
 * Enviar embed rico ao Discord
 */
export async function sendDiscordEmbed(
  embed: DiscordEmbed,
  tipo: 'alertas' | 'agentes' | 'sync' | 'geral' = 'geral',
  content?: string
): Promise<boolean> {
  try {
    const webhookUrl = getDiscordWebhookUrl(tipo);
    
    const message: DiscordMessage = {
      embeds: [embed],
    };
    
    if (content) {
      message.content = content;
    }
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    
    if (!response.ok) {
      console.error(`❌ Erro ao enviar embed ao Discord: ${response.status}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar embed ao Discord:', error);
    return false;
  }
}

/**
 * Enviar múltiplos embeds ao Discord
 */
export async function sendDiscordEmbeds(
  embeds: DiscordEmbed[],
  tipo: 'alertas' | 'agentes' | 'sync' | 'geral' = 'geral',
  content?: string
): Promise<boolean> {
  try {
    const webhookUrl = getDiscordWebhookUrl(tipo);
    
    const message: DiscordMessage = { embeds };
    
    if (content) {
      message.content = content;
    }
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    
    if (!response.ok) {
      console.error(`❌ Erro ao enviar embeds ao Discord: ${response.status}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar embeds ao Discord:', error);
    return false;
  }
}

/**
 * Criar embed de sucesso
 */
export function createSuccessEmbed(
  title: string,
  description: string,
  fields?: DiscordEmbed['fields']
): DiscordEmbed {
  return {
    title: `✅ ${title}`,
    description,
    color: DiscordColors.SUCCESS,
    fields,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Criar embed de erro
 */
export function createErrorEmbed(
  title: string,
  description: string,
  error?: Error | string
): DiscordEmbed {
  const fields: DiscordEmbed['fields'] = [];
  
  if (error) {
    fields.push({
      name: '❌ Erro',
      value: typeof error === 'string' ? error : error.message,
      inline: false,
    });
  }
  
  return {
    title: `❌ ${title}`,
    description,
    color: DiscordColors.ERROR,
    fields,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Criar embed de aviso
 */
export function createWarningEmbed(
  title: string,
  description: string,
  fields?: DiscordEmbed['fields']
): DiscordEmbed {
  return {
    title: `⚠️ ${title}`,
    description,
    color: DiscordColors.WARNING,
    fields,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Criar embed de informação
 */
export function createInfoEmbed(
  title: string,
  description: string,
  fields?: DiscordEmbed['fields']
): DiscordEmbed {
  return {
    title: `ℹ️ ${title}`,
    description,
    color: DiscordColors.INFO,
    fields,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Formatar valor monetário para Discord
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formatar percentual para Discord
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Truncar texto para caber no Discord (limite de 1024 caracteres por field)
 */
export function truncateText(text: string, maxLength: number = 1024): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}
