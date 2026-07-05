/**
 * Repository de Notificacoes (Central de Notificações).
 *
 * Encapsula acesso a system.notificacoes — o inbox in-app do Zykor.
 * Schema novo (2026-07-05): colunas reais (event_key, categoria, severidade,
 * titulo, mensagem, url, dados jsonb, canais[], lida). Ver migration
 * database/migrations/20260705_central_notificacoes.sql.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { RepositoryError } from '@/lib/errors';

export type Severidade = 'info' | 'sucesso' | 'alerta' | 'critico';

export type NotificacaoRow = {
  id: string;
  bar_id: number;
  usuario_id: string;
  event_key: string;
  categoria: string;
  severidade: Severidade;
  titulo: string;
  mensagem: string;
  url: string | null;
  dados: Record<string, unknown>;
  canais: string[];
  lida: boolean;
  lida_em: string | null;
  criada_em: string;
};

export type NovaNotificacao = {
  barId: number;
  usuarioId: string;
  eventKey: string;
  categoria: string;
  severidade: Severidade;
  titulo: string;
  mensagem: string;
  url?: string | null;
  dados?: Record<string, unknown>;
  canais: string[];
};

export type ListarFiltros = {
  barId: number;
  usuarioId: string;
  apenasNaoLidas?: boolean;
  categoria?: string;
  page: number;
  limit: number;
};

const COLS =
  'id, bar_id, usuario_id, event_key, categoria, severidade, titulo, mensagem, url, dados, canais, lida, lida_em, criada_em';

export class NotificacoesRepository {
  constructor(private client: SupabaseClient) {}

  private tbl() {
    return this.client.schema('system').from('notificacoes');
  }

  /** Insere várias notificações de uma vez (usado pelo dispatcher). */
  async criarMuitas(rows: NovaNotificacao[]): Promise<NotificacaoRow[]> {
    if (!rows.length) return [];
    const payload = rows.map((r) => ({
      bar_id: r.barId,
      usuario_id: r.usuarioId,
      event_key: r.eventKey,
      categoria: r.categoria,
      severidade: r.severidade,
      titulo: r.titulo,
      mensagem: r.mensagem,
      url: r.url ?? null,
      dados: r.dados ?? {},
      canais: r.canais,
    }));
    const { data, error } = await this.tbl().insert(payload).select(COLS);
    if (error) throw new RepositoryError('notificacoes.criarMuitas', error);
    return (data ?? []) as NotificacaoRow[];
  }

  /** Lista paginada das notificações DE UM USUÁRIO. */
  async listarDoUsuario(f: ListarFiltros): Promise<{ data: NotificacaoRow[]; total: number }> {
    let q = this.tbl()
      .select(COLS, { count: 'exact' })
      .eq('bar_id', f.barId)
      .eq('usuario_id', f.usuarioId);

    if (f.apenasNaoLidas) q = q.eq('lida', false);
    if (f.categoria) q = q.eq('categoria', f.categoria);

    const offset = (f.page - 1) * f.limit;
    const { data, error, count } = await q
      .order('criada_em', { ascending: false })
      .range(offset, offset + f.limit - 1);
    if (error) throw new RepositoryError('notificacoes.listarDoUsuario', error);
    return { data: (data ?? []) as NotificacaoRow[], total: count ?? 0 };
  }

  /** Lista paginada de TODAS as notificações do bar (histórico admin). */
  async listarDoBar(input: {
    barId: number;
    categoria?: string;
    eventKey?: string;
    page: number;
    limit: number;
  }): Promise<{ data: NotificacaoRow[]; total: number }> {
    let q = this.tbl().select(COLS, { count: 'exact' }).eq('bar_id', input.barId);
    if (input.categoria) q = q.eq('categoria', input.categoria);
    if (input.eventKey) q = q.eq('event_key', input.eventKey);

    const offset = (input.page - 1) * input.limit;
    const { data, error, count } = await q
      .order('criada_em', { ascending: false })
      .range(offset, offset + input.limit - 1);
    if (error) throw new RepositoryError('notificacoes.listarDoBar', error);
    return { data: (data ?? []) as NotificacaoRow[], total: count ?? 0 };
  }

  async contarNaoLidas(barId: number, usuarioId: string): Promise<number> {
    const { count, error } = await this.tbl()
      .select('id', { count: 'exact', head: true })
      .eq('bar_id', barId)
      .eq('usuario_id', usuarioId)
      .eq('lida', false);
    if (error) throw new RepositoryError('notificacoes.contarNaoLidas', error);
    return count ?? 0;
  }

  async findById(id: string): Promise<NotificacaoRow | null> {
    const { data, error } = await this.tbl().select(COLS).eq('id', id).maybeSingle();
    if (error) throw new RepositoryError('notificacoes.findById', error);
    return (data as NotificacaoRow | null) ?? null;
  }

  /** Marca uma notificação como lida (escopada ao dono). */
  async marcarLida(id: string, usuarioId: string): Promise<void> {
    const { error } = await this.tbl()
      .update({ lida: true, lida_em: new Date().toISOString() })
      .eq('id', id)
      .eq('usuario_id', usuarioId);
    if (error) throw new RepositoryError('notificacoes.marcarLida', error);
  }

  /** Marca todas as não lidas do usuário como lidas. Retorna quantas. */
  async marcarTodasLidas(barId: number, usuarioId: string): Promise<number> {
    const { data, error } = await this.tbl()
      .update({ lida: true, lida_em: new Date().toISOString() })
      .eq('bar_id', barId)
      .eq('usuario_id', usuarioId)
      .eq('lida', false)
      .select('id');
    if (error) throw new RepositoryError('notificacoes.marcarTodasLidas', error);
    return (data ?? []).length;
  }

  /** Exclui uma notificação (escopada ao dono). */
  async excluir(id: string, usuarioId: string): Promise<void> {
    const { error } = await this.tbl().delete().eq('id', id).eq('usuario_id', usuarioId);
    if (error) throw new RepositoryError('notificacoes.excluir', error);
  }

  /** Estatísticas dos últimos N dias do usuário: total, não lidas, por categoria, por severidade. */
  async estatisticasUsuario(
    barId: number,
    usuarioId: string,
    dias = 7
  ): Promise<{
    total: number;
    naoLidas: number;
    porCategoria: Record<string, number>;
    porSeveridade: Record<string, number>;
  }> {
    const desde = new Date(Date.now() - dias * 86400_000).toISOString();
    const { data, error } = await this.tbl()
      .select('lida, categoria, severidade')
      .eq('bar_id', barId)
      .eq('usuario_id', usuarioId)
      .gte('criada_em', desde);
    if (error) throw new RepositoryError('notificacoes.estatisticasUsuario', error);

    const rows = (data ?? []) as Array<{ lida: boolean; categoria: string; severidade: string }>;
    const porCategoria: Record<string, number> = {};
    const porSeveridade: Record<string, number> = {};
    let naoLidas = 0;
    for (const r of rows) {
      if (!r.lida) naoLidas++;
      porCategoria[r.categoria] = (porCategoria[r.categoria] ?? 0) + 1;
      porSeveridade[r.severidade] = (porSeveridade[r.severidade] ?? 0) + 1;
    }
    return { total: rows.length, naoLidas, porCategoria, porSeveridade };
  }
}
