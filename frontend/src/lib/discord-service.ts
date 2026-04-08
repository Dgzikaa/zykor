// ========================================
// 🎮 DISCORD WEBHOOK SERVICE - SGB
// ========================================
// Service completo para notificações via Discord
// Integração com agente IA para relatórios automáticos

export interface DiscordWebhookConfig {
  webhook_url: string;
  username?: string;
  avatar_url?: string;
  enabled: boolean;
}

export interface DiscordMessage {
  content?: string;
  embeds?: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: DiscordField[];
  footer?: {
    text: string;
    icon_url?: string;
  };
  timestamp?: string;
  thumbnail?: {
    url: string;
  };
}

export interface DiscordField {
  name: string;
  value: string;
  inline?: boolean;
}

interface DiscordNotificationData {
  title: string;
  description: string;
  color?: number;
  fields?: {
    name: string;
    value: string;
    inline?: boolean;
  }[];
  footer?: {
    text: string;
  };
  bar_id: string;
  webhook_type?:
    | 'sistema'
    | 'contaazul'
    | 'checklists'
    | 'contahub'
    | 'vendas'
    | 'reservas';
}

interface AIAnomaly {
  tipo_anomalia: string;
  subtipo: string;
  severidade: string;
  titulo: string;
  descricao: string;
  objeto_id?: number;
  objeto_tipo?: string;
  objeto_nome?: string;
  valor_esperado: number;
  valor_observado: number;
  desvio_percentual: number;
  confianca_deteccao: number;
  possivel_causa: string;
  impacto_estimado: string;
  acoes_sugeridas: string[];
  metricas_anomalia: Record<string, unknown>;
  periodo_deteccao: string;
  status: string;
}

// Interfaces para tipagem adequada
interface DashboardData {
  bar_id?: string;
  metricas_count?: number;
  anomalias_count?: number;
  insights_count?: number;
  score_geral?: number;
}

// ========================================
// 🎮 DISCORD SERVICE CLASS
// ========================================
export class DiscordService {
  static async sendNotification(data: DiscordNotificationData) {
    try {
      const response = await fetch('/api/configuracoes/edge-functions/discord-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Erro ao enviar notificação Discord:', error);
      return false;
    }
  }

  static async testarConexao(): Promise<boolean> {
    try {
      const testData: DiscordNotificationData = {
        title: '🔧 Teste de Conexão SGB',
        description: 'Se você recebeu esta mensagem, a integração Discord está funcionando!',
        color: 0x00ff00,
        bar_id: 'test',
        webhook_type: 'sistema',
      };

      return await this.sendNotification(testData);
    } catch (error) {
      console.error('Erro no teste de conexão Discord:', error);
      return false;
    }
  }

  static async enviarAlertaAnomalia(anomalia: AIAnomaly): Promise<boolean> {
    try {
      const color = this.getSeverityColor(anomalia.severidade);
      const fields: DiscordField[] = [
        {
          name: '🔍 Tipo de Anomalia',
          value: anomalia.tipo_anomalia,
          inline: true,
        },
        {
          name: '📊 Subtipo',
          value: anomalia.subtipo,
          inline: true,
        },
        {
          name: '⚠️ Severidade',
          value: anomalia.severidade.toUpperCase(),
          inline: true,
        },
        {
          name: '📈 Valor Esperado',
          value: anomalia.valor_esperado.toString(),
          inline: true,
        },
        {
          name: '📉 Valor Observado',
          value: anomalia.valor_observado.toString(),
          inline: true,
        },
        {
          name: '📊 Desvio',
          value: `${anomalia.desvio_percentual.toFixed(2)}%`,
          inline: true,
        },
        {
          name: '🎯 Confiança',
          value: `${anomalia.confianca_deteccao}%`,
          inline: true,
        },
        {
          name: '🔍 Possível Causa',
          value: anomalia.possivel_causa,
          inline: false,
        },
        {
          name: '💡 Ações Sugeridas',
          value: anomalia.acoes_sugeridas.join('\n• '),
          inline: false,
        },
      ];

      const notificationData: DiscordNotificationData = {
        title: `🚨 Alerta de Anomalia: ${anomalia.titulo}`,
        description: anomalia.descricao,
        color,
        fields,
        footer: {
          text: `SGB Analytics • ${anomalia.periodo_deteccao}`,
        },
        bar_id: 'unknown',
        webhook_type: 'sistema',
      };

      return await this.sendNotification(notificationData);
    } catch (error) {
      console.error('Erro ao enviar alerta de anomalia:', error);
      return false;
    }
  }

  static async enviarRelatorioMatinal(
    dashboardData: DashboardData
  ): Promise<boolean> {
    try {
      const fields: DiscordField[] = [
        {
          name: '📊 Métricas Calculadas',
          value: dashboardData.metricas_count?.toString() || '0',
          inline: true,
        },
        {
          name: '🚨 Anomalias Detectadas',
          value: dashboardData.anomalias_count?.toString() || '0',
          inline: true,
        },
        {
          name: '💡 Insights Gerados',
          value: dashboardData.insights_count?.toString() || '0',
          inline: true,
        },
        {
          name: '🎯 Score Geral',
          value: dashboardData.score_geral?.toString() || 'N/A',
          inline: true,
        },
      ];

      const notificationData: DiscordNotificationData = {
        title: '🌅 Relatório Matinal SGB',
        description: 'Resumo das análises automáticas realizadas durante a noite.',
        color: 0x0099ff,
        fields,
        footer: {
          text: `SGB Analytics • ${new Date().toLocaleDateString('pt-BR')}`,
        },
        bar_id: dashboardData.bar_id || 'unknown',
        webhook_type: 'sistema',
      };

      return await this.sendNotification(notificationData);
    } catch (error) {
      console.error('Erro ao enviar relatório matinal:', error);
      return false;
    }
  }

  static async sendSystemNotification(
    barId: string,
    title: string,
    description: string,
    fields?: DiscordField[]
  ) {
    const notificationData: DiscordNotificationData = {
      title,
      description,
      color: 0x0099ff,
      fields,
      bar_id: barId,
      webhook_type: 'sistema',
    };

    return await this.sendNotification(notificationData);
  }

  static async sendChecklistNotification(
    barId: string,
    title: string,
    description: string,
    fields?: DiscordField[]
  ) {
    const notificationData: DiscordNotificationData = {
      title,
      description,
      color: 0x00ff00,
      fields,
      bar_id: barId,
      webhook_type: 'checklists',
    };

    return await this.sendNotification(notificationData);
  }

  static async sendSalesNotification(
    barId: string,
    title: string,
    description: string,
    fields?: DiscordField[]
  ) {
    const notificationData: DiscordNotificationData = {
      title,
      description,
      color: 0x00cc00,
      fields,
      bar_id: barId,
      webhook_type: 'vendas',
    };

    return await this.sendNotification(notificationData);
  }

  static async sendReservationNotification(
    barId: string,
    title: string,
    description: string,
    fields?: DiscordField[]
  ) {
    const notificationData: DiscordNotificationData = {
      title,
      description,
      color: 0x9933ff,
      fields,
      bar_id: barId,
      webhook_type: 'reservas',
    };

    return await this.sendNotification(notificationData);
  }

  /**
   * @deprecated NIBO foi substituído pelo Conta Azul em 04/2026
   */
  static async sendNiboNotification(
    barId: string,
    title: string,
    description: string,
    fields?: DiscordField[]
  ) {
    console.warn('⚠️ sendNiboNotification() está deprecated. NIBO foi substituído pelo Conta Azul.');
    return false;
  }

  static async sendEmbed(embed: DiscordEmbed): Promise<boolean> {
    try {
      const message: DiscordMessage = {
        embeds: [embed],
      };

      const response = await fetch('/api/configuracoes/edge-functions/discord-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Erro ao enviar embed Discord:', error);
      return false;
    }
  }

  static async sendMessage(message: string): Promise<boolean> {
    try {
      const discordMessage: DiscordMessage = {
        content: message,
      };

      const response = await fetch('/api/configuracoes/edge-functions/discord-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(discordMessage),
      });

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Erro ao enviar mensagem Discord:', error);
      return false;
    }
  }

  private static getSeverityColor(severidade: string): number {
    switch (severidade.toLowerCase()) {
      case 'critica':
        return 0xff0000; // Vermelho
      case 'alta':
        return 0xff6600; // Laranja
      case 'media':
        return 0xffff00; // Amarelo
      case 'baixa':
        return 0x00ff00; // Verde
      default:
        return 0x999999; // Cinza
    }
  }
}

// ========================================
// 🚀 INSTÂNCIA GLOBAL
// ========================================
export const sgbDiscordService = new DiscordService();

// ========================================
// ⏰ FUNÇÕES DE HORÁRIO
// ========================================

export function isHorarioRelatorioMatinal(): boolean {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();

  // Relatório matinal entre 6h e 7h
  return hour === 6 && minute >= 0 && minute < 60;
}

export function calcularProximoRelatorioMatinal(): Date {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(6, 0, 0, 0);

  return tomorrow;
}

export function minutosAteProximoRelatorio(): number {
  const proximo = calcularProximoRelatorioMatinal();
  const agora = new Date();
  const diffMs = proximo.getTime() - agora.getTime();
  return Math.ceil(diffMs / (1000 * 60));
}
