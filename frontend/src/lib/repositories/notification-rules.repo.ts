/**
 * Repository de Regras de Notificação (system.notification_rules).
 *
 * Regra = roteamento por bar: evento do catálogo → cargos/usuários alvo → canais.
 * Configurado pelo admin na Central de Notificações (aba Regras).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { RepositoryError } from '@/lib/errors';

export type NotificationRuleRow = {
  id: string;
  bar_id: number;
  event_key: string;
  ativo: boolean;
  target_roles: string[];
  target_user_ids: string[];
  canais: string[];
  config: Record<string, unknown>;
  criada_em: string;
  atualizada_em: string;
};

const COLS =
  'id, bar_id, event_key, ativo, target_roles, target_user_ids, canais, config, criada_em, atualizada_em';

export class NotificationRulesRepository {
  constructor(private client: SupabaseClient) {}

  private tbl() {
    return this.client.schema('system').from('notification_rules');
  }

  /** Todas as regras de um bar (indexadas por event_key na camada de serviço). */
  async listarDoBar(barId: number): Promise<NotificationRuleRow[]> {
    const { data, error } = await this.tbl().select(COLS).eq('bar_id', barId);
    if (error) throw new RepositoryError('notificationRules.listarDoBar', error);
    return (data ?? []) as NotificationRuleRow[];
  }

  async buscar(barId: number, eventKey: string): Promise<NotificationRuleRow | null> {
    const { data, error } = await this.tbl()
      .select(COLS)
      .eq('bar_id', barId)
      .eq('event_key', eventKey)
      .maybeSingle();
    if (error) throw new RepositoryError('notificationRules.buscar', error);
    return (data as NotificationRuleRow | null) ?? null;
  }

  /** Cria ou atualiza a regra de um evento (upsert por bar_id+event_key). */
  async upsert(input: {
    barId: number;
    eventKey: string;
    ativo: boolean;
    targetRoles: string[];
    targetUserIds: string[];
    canais: string[];
    config?: Record<string, unknown>;
  }): Promise<NotificationRuleRow> {
    const { data, error } = await this.tbl()
      .upsert(
        {
          bar_id: input.barId,
          event_key: input.eventKey,
          ativo: input.ativo,
          target_roles: input.targetRoles,
          target_user_ids: input.targetUserIds,
          canais: input.canais,
          config: input.config ?? {},
          atualizada_em: new Date().toISOString(),
        },
        { onConflict: 'bar_id,event_key' }
      )
      .select(COLS)
      .single();
    if (error) throw new RepositoryError('notificationRules.upsert', error);
    return data as NotificationRuleRow;
  }
}
