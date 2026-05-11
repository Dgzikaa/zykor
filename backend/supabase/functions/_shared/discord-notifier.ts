/**
 * Discord Notifier — Envio padronizado de notificações.
 *
 * Fonte do webhook: tabela system.discord_webhooks (via RPC
 * public.get_discord_webhook). Sem fallback em env var.
 *
 * Canais disponíveis (tipo na tabela):
 *   - alertas_criticos: erros de pipeline, falhas de sync
 *   - relatorios_ia:    análises IA (diária/semanal/mensal)
 *   - insights:         alertas proativos, relatório matinal
 *   - sync_logs:        logs informativos de sync (silenciável)
 */

export type DiscordCanal = 'alertas_criticos' | 'relatorios_ia' | 'insights' | 'sync_logs';

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string; icon_url?: string };
  timestamp?: string;
  thumbnail?: { url: string };
  image?: { url: string };
}

export interface DiscordMessage {
  content?: string;
  embeds?: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}

export const DiscordColors = {
  SUCCESS: 0x00ff00,
  ERROR:   0xff0000,
  WARNING: 0xffaa00,
  INFO:    0x0099ff,
  NEUTRAL: 0x95a5a6,
  PURPLE:  0x9b59b6,
  GOLD:    0xf1c40f,
} as const;

/**
 * Busca o webhook de um canal via RPC (tabela system.discord_webhooks).
 * Retorna null se não houver webhook cadastrado para o canal.
 */
export async function getDiscordWebhookFromDb(
  supabase: any,
  canal: DiscordCanal
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('get_discord_webhook', { p_tipo: canal });
    if (error) {
      console.error(`[discord] erro ao buscar webhook ${canal}:`, error);
      return null;
    }
    return (data as string | null) || null;
  } catch (err) {
    console.error(`[discord] exceção ao buscar webhook ${canal}:`, err);
    return null;
  }
}

/**
 * Envia mensagem de texto simples ao Discord.
 */
export async function sendDiscordMessage(
  supabase: any,
  canal: DiscordCanal,
  content: string,
): Promise<boolean> {
  const webhookUrl = await getDiscordWebhookFromDb(supabase, canal);
  if (!webhookUrl) {
    console.warn(`[discord] sem webhook para canal ${canal} — mensagem ignorada`);
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!response.ok) {
      console.error(`[discord] envio falhou (${canal}): ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[discord] exceção no envio (${canal}):`, error);
    return false;
  }
}

/**
 * Envia embed rico ao Discord.
 */
export async function sendDiscordEmbed(
  supabase: any,
  canal: DiscordCanal,
  embed: DiscordEmbed,
  content?: string,
): Promise<boolean> {
  const webhookUrl = await getDiscordWebhookFromDb(supabase, canal);
  if (!webhookUrl) {
    console.warn(`[discord] sem webhook para canal ${canal} — embed ignorado`);
    return false;
  }

  const message: DiscordMessage = { embeds: [embed] };
  if (content) message.content = content;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    if (!response.ok) {
      console.error(`[discord] embed falhou (${canal}): ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[discord] exceção no embed (${canal}):`, error);
    return false;
  }
}

/**
 * Envia múltiplos embeds ao Discord.
 */
export async function sendDiscordEmbeds(
  supabase: any,
  canal: DiscordCanal,
  embeds: DiscordEmbed[],
  content?: string,
): Promise<boolean> {
  const webhookUrl = await getDiscordWebhookFromDb(supabase, canal);
  if (!webhookUrl) {
    console.warn(`[discord] sem webhook para canal ${canal} — embeds ignorados`);
    return false;
  }

  const message: DiscordMessage = { embeds };
  if (content) message.content = content;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    if (!response.ok) {
      console.error(`[discord] embeds falhou (${canal}): ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[discord] exceção nos embeds (${canal}):`, error);
    return false;
  }
}

export function createSuccessEmbed(title: string, description: string, fields?: DiscordEmbed['fields']): DiscordEmbed {
  return { title: `✅ ${title}`, description, color: DiscordColors.SUCCESS, fields, timestamp: new Date().toISOString() };
}

export function createErrorEmbed(title: string, description: string, error?: Error | string): DiscordEmbed {
  const fields: DiscordEmbed['fields'] = [];
  if (error) {
    fields.push({ name: '❌ Erro', value: typeof error === 'string' ? error : error.message, inline: false });
  }
  return { title: `❌ ${title}`, description, color: DiscordColors.ERROR, fields, timestamp: new Date().toISOString() };
}

export function createWarningEmbed(title: string, description: string, fields?: DiscordEmbed['fields']): DiscordEmbed {
  return { title: `⚠️ ${title}`, description, color: DiscordColors.WARNING, fields, timestamp: new Date().toISOString() };
}

export function createInfoEmbed(title: string, description: string, fields?: DiscordEmbed['fields']): DiscordEmbed {
  return { title: `ℹ️ ${title}`, description, color: DiscordColors.INFO, fields, timestamp: new Date().toISOString() };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function truncateText(text: string, maxLength: number = 1024): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
