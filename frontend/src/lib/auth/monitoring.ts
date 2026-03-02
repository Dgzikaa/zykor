/**
 * Sistema de monitoramento e alertas de segurança
 */

import { getAdminClient } from '@/lib/supabase-admin';

export interface SecurityAlert {
  type: 'UNAUTHORIZED_ACCESS' | 'PERMISSION_CHANGE' | 'SENSITIVE_DATA_ACCESS' | 'MULTIPLE_FAILED_LOGINS';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  user_id?: number;
  ip_address?: string;
  description: string;
  metadata?: any;
}

/**
 * Registrar alerta de segurança
 */
export async function logSecurityAlert(alert: SecurityAlert): Promise<void> {
  try {
    const supabase = await getAdminClient();
    
    // Salvar no banco
    await supabase.from('security_alerts').insert({
      type: alert.type,
      severity: alert.severity,
      user_id: alert.user_id,
      ip_address: alert.ip_address,
      description: alert.description,
      metadata: alert.metadata,
      created_at: new Date().toISOString(),
    });

    // Log no console para monitoramento imediato
    const emoji = {
      LOW: '🟢',
      MEDIUM: '🟡',
      HIGH: '🟠',
      CRITICAL: '🔴',
    }[alert.severity];

    console.warn(
      `${emoji} ALERTA DE SEGURANÇA [${alert.severity}]: ${alert.type}`,
      alert.description,
      alert.metadata
    );

    // Se for crítico, enviar notificação (implementar webhook/email)
    if (alert.severity === 'CRITICAL') {
      await sendCriticalAlert(alert);
    }
  } catch (error) {
    console.error('Erro ao registrar alerta de segurança:', error);
  }
}

/**
 * Enviar alerta crítico para administradores
 */
async function sendCriticalAlert(alert: SecurityAlert): Promise<void> {
  try {
    // TODO: Implementar envio de email/SMS/webhook
    console.error('🚨 ALERTA CRÍTICO:', alert);
    
    // Exemplo: enviar para webhook do Slack/Discord
    if (process.env.SECURITY_WEBHOOK_URL) {
      await fetch(process.env.SECURITY_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 ALERTA CRÍTICO DE SEGURANÇA`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Tipo:* ${alert.type}\n*Descrição:* ${alert.description}`,
              },
            },
          ],
        }),
      });
    }
  } catch (error) {
    console.error('Erro ao enviar alerta crítico:', error);
  }
}

/**
 * Verificar tentativas de login falhadas
 */
export async function checkFailedLogins(ip_address: string): Promise<void> {
  try {
    const supabase = await getAdminClient();
    
    // Buscar tentativas falhadas nas últimas 1 hora
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: failedAttempts } = await supabase
      .from('audit_log')
      .select('*')
      .eq('action', 'LOGIN_FAILED')
      .eq('ip_address', ip_address)
      .gte('created_at', oneHourAgo);

    const count = failedAttempts?.length || 0;

    if (count >= 10) {
      await logSecurityAlert({
        type: 'MULTIPLE_FAILED_LOGINS',
        severity: 'HIGH',
        ip_address,
        description: `${count} tentativas de login falhadas do IP ${ip_address} na última hora`,
        metadata: { count, time_window: '1h' },
      });
    } else if (count >= 5) {
      await logSecurityAlert({
        type: 'MULTIPLE_FAILED_LOGINS',
        severity: 'MEDIUM',
        ip_address,
        description: `${count} tentativas de login falhadas do IP ${ip_address} na última hora`,
        metadata: { count, time_window: '1h' },
      });
    }
  } catch (error) {
    console.error('Erro ao verificar logins falhados:', error);
  }
}

/**
 * Verificar tentativas de acesso não autorizado
 */
export async function checkUnauthorizedAccess(
  user_id: number,
  resource: string,
  ip_address?: string
): Promise<void> {
  try {
    const supabase = await getAdminClient();
    
    // Buscar tentativas não autorizadas nas últimas 5 minutos
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: attempts } = await supabase
      .from('audit_log')
      .select('*')
      .eq('user_id', user_id)
      .eq('action', 'UNAUTHORIZED_ACCESS')
      .gte('created_at', fiveMinutesAgo);

    const count = attempts?.length || 0;

    if (count >= 5) {
      await logSecurityAlert({
        type: 'UNAUTHORIZED_ACCESS',
        severity: 'HIGH',
        user_id,
        ip_address,
        description: `Usuário ${user_id} tentou acessar recursos não autorizados ${count} vezes em 5 minutos`,
        metadata: { count, resource, time_window: '5m' },
      });
    }
  } catch (error) {
    console.error('Erro ao verificar acessos não autorizados:', error);
  }
}

/**
 * Monitorar mudanças de permissões
 */
export async function monitorPermissionChange(
  admin_user_id: number,
  target_user_id: number,
  old_permissions: any,
  new_permissions: any
): Promise<void> {
  try {
    // Verificar se houve mudança de role para admin
    if (old_permissions.role !== 'admin' && new_permissions.role === 'admin') {
      await logSecurityAlert({
        type: 'PERMISSION_CHANGE',
        severity: 'CRITICAL',
        user_id: admin_user_id,
        description: `Usuário ${admin_user_id} promoveu usuário ${target_user_id} para admin`,
        metadata: {
          target_user_id,
          old_role: old_permissions.role,
          new_role: new_permissions.role,
        },
      });
    }

    // Verificar se houve adição de módulos sensíveis
    const sensitiveModules = ['admin', 'todos', 'financeiro'];
    const addedModules = new_permissions.modulos_permitidos?.filter(
      (m: string) => !old_permissions.modulos_permitidos?.includes(m)
    ) || [];

    const addedSensitive = addedModules.filter((m: string) =>
      sensitiveModules.includes(m)
    );

    if (addedSensitive.length > 0) {
      await logSecurityAlert({
        type: 'PERMISSION_CHANGE',
        severity: 'HIGH',
        user_id: admin_user_id,
        description: `Usuário ${admin_user_id} adicionou módulos sensíveis para usuário ${target_user_id}`,
        metadata: {
          target_user_id,
          added_modules: addedSensitive,
        },
      });
    }
  } catch (error) {
    console.error('Erro ao monitorar mudança de permissões:', error);
  }
}

/**
 * Monitorar acesso a dados sensíveis
 */
export async function monitorSensitiveDataAccess(
  user_id: number,
  resource: string,
  action: string
): Promise<void> {
  try {
    const sensitiveResources = [
      'usuarios',
      'api_credentials',
      'contas_bancarias',
      'folha_pagamento',
    ];

    if (sensitiveResources.includes(resource)) {
      await logSecurityAlert({
        type: 'SENSITIVE_DATA_ACCESS',
        severity: action === 'DELETE' ? 'HIGH' : 'MEDIUM',
        user_id,
        description: `Usuário ${user_id} executou ${action} em ${resource}`,
        metadata: { resource, action },
      });
    }
  } catch (error) {
    console.error('Erro ao monitorar acesso a dados sensíveis:', error);
  }
}

/**
 * Obter resumo de alertas
 */
export async function getSecurityAlertsSummary(hours: number = 24): Promise<any> {
  try {
    const supabase = await getAdminClient();
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data: alerts } = await supabase
      .from('security_alerts')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    const summary = {
      total: alerts?.length || 0,
      by_severity: {
        CRITICAL: alerts?.filter(a => a.severity === 'CRITICAL').length || 0,
        HIGH: alerts?.filter(a => a.severity === 'HIGH').length || 0,
        MEDIUM: alerts?.filter(a => a.severity === 'MEDIUM').length || 0,
        LOW: alerts?.filter(a => a.severity === 'LOW').length || 0,
      },
      by_type: {
        UNAUTHORIZED_ACCESS: alerts?.filter(a => a.type === 'UNAUTHORIZED_ACCESS').length || 0,
        PERMISSION_CHANGE: alerts?.filter(a => a.type === 'PERMISSION_CHANGE').length || 0,
        SENSITIVE_DATA_ACCESS: alerts?.filter(a => a.type === 'SENSITIVE_DATA_ACCESS').length || 0,
        MULTIPLE_FAILED_LOGINS: alerts?.filter(a => a.type === 'MULTIPLE_FAILED_LOGINS').length || 0,
      },
      recent_critical: alerts?.filter(a => a.severity === 'CRITICAL').slice(0, 5) || [],
    };

    return summary;
  } catch (error) {
    console.error('Erro ao obter resumo de alertas:', error);
    return null;
  }
}
