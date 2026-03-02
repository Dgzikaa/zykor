/**
 * Sistema de auditoria
 */

import { getAdminClient } from '@/lib/supabase-admin';
import type { AuditEvent } from './types';

/**
 * Logar evento de auditoria
 */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    const supabase = await getAdminClient();
    
    await supabase.from('audit_log').insert({
      user_id: event.user_id,
      action: event.action,
      resource: event.resource,
      resource_id: event.resource_id,
      changes: event.changes,
      ip_address: event.ip_address,
      user_agent: event.user_agent,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Erro ao logar auditoria:', error);
    // Não falhar a operação por causa do log
  }
}

/**
 * Buscar logs de auditoria
 */
export async function getAuditLogs(filters?: {
  user_id?: number;
  action?: string;
  resource?: string;
  limit?: number;
  offset?: number;
}) {
  try {
    const supabase = await getAdminClient();
    
    let query = supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (filters?.user_id) {
      query = query.eq('user_id', filters.user_id);
    }
    
    if (filters?.action) {
      query = query.eq('action', filters.action);
    }
    
    if (filters?.resource) {
      query = query.eq('resource', filters.resource);
    }
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('❌ Erro ao buscar logs de auditoria:', error);
    return [];
  }
}
