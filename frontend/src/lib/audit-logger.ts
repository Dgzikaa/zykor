// Sistema centralizado de logging para audit trail e eventos de segurança
import { createClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/lib/supabase-admin';

export interface AuditLogParams {
  // Obrigatórios
  operation: string;
  description: string;

  // Contexto do usuário
  barId?: number;
  userId?: string;
  userEmail?: string;
  userRole?: string;

  // Informações da requisição
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;

  // Dados da operação
  tableName?: string;
  recordId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;

  // Classificação
  severity?: 'info' | 'warning' | 'critical';
  category?:
    | 'auth'
    | 'data'
    | 'admin'
    | 'financial'
    | 'security'
    | 'system'
    | 'backup';

  // Contexto adicional
  sessionId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface SecurityEventParams {
  // Obrigatórios
  level: 'info' | 'warning' | 'critical';
  category:
    | 'auth'
    | 'access'
    | 'data'
    | 'injection'
    | 'rate_limit'
    | 'api_abuse'
    | 'backup'
    | 'system';
  eventType: string;

  // Contexto
  barId?: number;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;

  // Detalhes
  details: Record<string, any>;
  riskScore?: number;
}

interface AuditLogData {
  bar_id: number | null;
  operation: string;
  table_name: string | null;
  record_id: string | null;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  ip_address: string | null;
  user_agent: string | null;
  description: string;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  severity: string;
  category: string | null;
  session_id: string | null;
  request_id: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

interface SecurityEventData {
  bar_id: number | null;
  level: string;
  category: string;
  event_type: string;
  user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  endpoint: string | null;
  details: Record<string, any>;
  risk_score: number | null;
  created_at: string;
}

class AuditLogger {
  private static instance: AuditLogger;
  private discordWebhook =
    'https://discord.com/api/webhooks/1393646423748116602/3zUhIrSKFHmq0zNRLf5AzrkSZNzTj7oYk6f45Tpj2LZWChtmGTKKTHxhfaNZigyLXN4y';

  private constructor() {}

  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  // Logging de audit trail
  async logAuditEvent(params: AuditLogParams): Promise<void> {
    try {
      const supabase = await getAdminClient();

      const auditData: AuditLogData = {
        bar_id: params.barId || null,
        operation: params.operation,
        table_name: params.tableName || null,
        record_id: params.recordId || null,
        user_id: params.userId || null,
        user_email: params.userEmail || null,
        user_role: params.userRole || null,
        ip_address: params.ipAddress || null,
        user_agent: params.userAgent || null,
        description: params.description,
        old_values: params.oldValues || null,
        new_values: params.newValues || null,
        severity: params.severity || 'info',
        category: params.category || 'system', // audit_trail.category é NOT NULL
        session_id: params.sessionId || null,
        request_id: params.requestId || null,
        metadata: params.metadata || null,
        created_at: new Date().toISOString(),
      };

      // Inserir no banco (system.audit_trail — a mesma trilha do painel de Auditoria)
      const { error } = await (supabase as any)
        .schema('system')
        .from('audit_trail')
        .insert(auditData);

      if (error) {
        console.error('Erro ao inserir audit log:', error);
      }

      // Notificar Discord para eventos críticos
      if (params.severity === 'critical') {
        await this.notifyDiscordAudit(params);
      }
    } catch (error) {
      console.error('Erro no audit logger:', error);
    }
  }

  // Logging de eventos de segurança
  async logSecurityEvent(params: SecurityEventParams): Promise<void> {
    try {
      const supabase = await getAdminClient();

      const eventData: SecurityEventData & { event_id: string; timestamp: string } = {
        event_id: (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.round(Math.random() * 1e9)}`),
        timestamp: new Date().toISOString(),
        bar_id: params.barId || null,
        level: params.level,
        category: params.category,
        event_type: params.eventType,
        user_id: params.userId || null,
        ip_address: params.ipAddress || null,
        user_agent: params.userAgent || null,
        endpoint: params.endpoint || null,
        details: params.details,
        risk_score: params.riskScore || null,
        created_at: new Date().toISOString(),
      };

      // Inserir no banco (system.security_events)
      const { error } = await (supabase as any)
        .schema('system')
        .from('security_events')
        .insert(eventData);

      if (error) {
        console.error('Erro ao inserir security event:', error);
      }

      // Notificar Discord para eventos críticos
      if (params.level === 'critical') {
        await this.notifyDiscordSecurity(params);
      }
    } catch (error) {
      console.error('Erro no security logger:', error);
    }
  }

  // Logs específicos para autenticação
  async logLoginSuccess(params: {
    userId: string;
    userEmail: string;
    userName: string;
    userRole: string;
    barId: number;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  }): Promise<void> {
    // Log no audit trail
    await this.logAuditEvent({
      operation: 'LOGIN_SUCCESS',
      description: `Login bem-sucedido para ${params.userName}`,
      barId: params.barId,
      userId: params.userId,
      userEmail: params.userEmail,
      userRole: params.userRole,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      sessionId: params.sessionId,
      endpoint: '/api/auth/login',
      method: 'POST',
      severity: 'info',
      category: 'auth',
      metadata: {
        login_type: 'password',
        timestamp: new Date().toISOString(),
      },
    });

    // Log no security events
    await this.logSecurityEvent({
      level: 'info',
      category: 'auth',
      eventType: 'successful_login',
      barId: params.barId,
      userId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      endpoint: '/api/auth/login',
      details: {
        user_email: params.userEmail,
        user_name: params.userName,
        user_role: params.userRole,
        login_method: 'password',
      },
      riskScore: 10, // Baixo risco para login normal
    });
  }

  async logLoginFailure(params: {
    email: string;
    reason: string;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  }): Promise<void> {
    // Log no audit trail
    await this.logAuditEvent({
      operation: 'LOGIN_FAILURE',
      description: `Tentativa de login falhou para ${params.email}: ${params.reason}`,
      userEmail: params.email,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      sessionId: params.sessionId,
      endpoint: '/api/auth/login',
      method: 'POST',
      severity: 'warning',
      category: 'auth',
      metadata: {
        failure_reason: params.reason,
        timestamp: new Date().toISOString(),
      },
    });

    // Log no security events
    await this.logSecurityEvent({
      level: 'warning',
      category: 'auth',
      eventType: 'failed_login',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      endpoint: '/api/auth/login',
      details: {
        email: params.email,
        failure_reason: params.reason,
        timestamp: new Date().toISOString(),
      },
      riskScore: 40, // Risco médio para tentativas falhas
    });
  }

  async logLogout(params: {
    userId?: string;
    userEmail?: string;
    userName?: string;
    barId?: number;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  }): Promise<void> {
    await this.logAuditEvent({
      operation: 'LOGOUT',
      description: `Logout realizado${params.userName ? ` para ${params.userName}` : ''}`,
      barId: params.barId,
      userId: params.userId,
      userEmail: params.userEmail,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      sessionId: params.sessionId,
      endpoint: '/api/auth/logout',
      method: 'POST',
      severity: 'info',
      category: 'auth',
      metadata: {
        logout_timestamp: new Date().toISOString(),
      },
    });
  }

  // Métodos auxiliares
  private calculateChanges(
    oldValues?: Record<string, unknown>,
    newValues?: Record<string, unknown>
  ): Record<string, unknown> | null {
    if (!oldValues || !newValues) return null;

    const changes: Record<string, unknown> = {};

    for (const [key, newValue] of Object.entries(newValues)) {
      if (oldValues[key] !== newValue) {
        changes[key] = {
          old: oldValues[key],
          new: newValue,
        };
      }
    }

    return Object.keys(changes).length > 0 ? changes : null;
  }

  private async notifyDiscordAudit(auditData: AuditLogParams): Promise<void> {
    try {
      const message = {
        embeds: [
          {
            title: '🔍 Critical Audit Event',
            description: auditData.description,
            color: 0xff9900,
            fields: [
              {
                name: 'User',
                value: auditData.userEmail || 'System',
                inline: true,
              },
              {
                name: 'Operation',
                value: auditData.operation,
                inline: true,
              },
              {
                name: 'IP Address',
                value: auditData.ipAddress || 'Unknown',
                inline: true,
              },
              {
                name: 'Table',
                value: auditData.tableName || 'N/A',
                inline: true,
              },
              {
                name: 'Record ID',
                value: auditData.recordId || 'N/A',
                inline: true,
              },
              {
                name: 'Endpoint',
                value: auditData.endpoint || 'N/A',
                inline: true,
              },
            ],
            timestamp: new Date().toISOString(),
            footer: {
              text: '🏢 SGB - Audit System',
            },
          },
        ],
      };

      await fetch(this.discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
    } catch (error) {
      console.error('❌ Erro ao notificar Discord audit:', error);
    }
  }

  private async notifyDiscordSecurity(eventData: SecurityEventParams): Promise<void> {
    try {
      const message = {
        embeds: [
          {
            title: '🚨 Critical Security Event',
            description: `${eventData.eventType} detected`,
            color: 0xff0000,
            fields: [
              {
                name: 'Event Type',
                value: eventData.eventType,
                inline: true,
              },
              {
                name: 'Risk Score',
                value: `${eventData.riskScore || 0}/100`,
                inline: true,
              },
              {
                name: 'IP Address',
                value: eventData.ipAddress || 'Unknown',
                inline: true,
              },
              {
                name: 'Endpoint',
                value: eventData.endpoint || 'N/A',
                inline: true,
              },
              {
                name: 'Details',
                value: JSON.stringify(eventData.details, null, 2).substring(
                  0,
                  500
                ),
                inline: false,
              },
            ],
            timestamp: new Date().toISOString(),
            footer: {
              text: '🏢 SGB - Security System',
            },
          },
        ],
      };

      await fetch(this.discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
    } catch (error) {
      console.error('❌ Erro ao notificar Discord security:', error);
    }
  }
}

// Export singleton
export const auditLogger = AuditLogger.getInstance();

// Helper functions
export async function logLoginSuccess(
  params: Parameters<typeof auditLogger.logLoginSuccess>[0]
) {
  return auditLogger.logLoginSuccess(params);
}

export async function logLoginFailure(
  params: Parameters<typeof auditLogger.logLoginFailure>[0]
) {
  return auditLogger.logLoginFailure(params);
}

export async function logLogout(
  params: Parameters<typeof auditLogger.logLogout>[0]
) {
  return auditLogger.logLogout(params);
}

export async function logAuditEvent(params: AuditLogParams) {
  return auditLogger.logAuditEvent(params);
}

export async function logSecurityEvent(params: SecurityEventParams) {
  return auditLogger.logSecurityEvent(params);
}
