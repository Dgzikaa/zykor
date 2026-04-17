/**
 * Repository de Notificacoes.
 *
 * Encapsula acesso a system.notificacoes.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { RepositoryError } from '@/lib/errors';

export type NotificacaoStatus = 'pendente' | 'enviada' | 'lida' | 'descartada';

export type NotificacaoFiltros = {
  barId: string;
  usuarioId?: string;
  status?: NotificacaoStatus;
  modulo?: string;
  tipo?: string;
  prioridade?: string;
  dataInicio?: string;
  dataFim?: string;
  apenasNaoLidas?: boolean;
  page: number;
  limit: number;
};

const COLUNAS_LISTAGEM = `
  id, usuario_id, tipo, titulo, mensagem, dados,
  status, canais, agendada_para, enviada_em, lida_em, criada_em, bar_id
` as const;

export class NotificacoesRepository {
  constructor(private client: SupabaseClient) {}

  /** Lista paginada de notificacoes para um bar. */
  async listar(filtros: NotificacaoFiltros) {
    let query = this.client
      .schema('system')
      .from('notificacoes')
      .select(COLUNAS_LISTAGEM, { count: 'exact' })
      .eq('bar_id', filtros.barId);

    if (filtros.usuarioId) query = query.eq('usuario_id', filtros.usuarioId);
    if (filtros.status) query = query.eq('status', filtros.status);
    if (filtros.tipo) query = query.eq('tipo', filtros.tipo);
    if (filtros.modulo) query = query.eq('dados->modulo', filtros.modulo);
    if (filtros.prioridade) query = query.eq('dados->prioridade', filtros.prioridade);
    if (filtros.dataInicio) query = query.gte('criada_em', filtros.dataInicio);
    if (filtros.dataFim) query = query.lte('criada_em', filtros.dataFim);
    if (filtros.apenasNaoLidas) query = query.in('status', ['pendente', 'enviada']);

    const offset = (filtros.page - 1) * filtros.limit;
    const { data, error, count } = await query
      .order('criada_em', { ascending: false })
      .range(offset, offset + filtros.limit - 1);

    if (error) throw new RepositoryError('notificacoes.listar', error);
    return { data: data ?? [], total: count ?? 0 };
  }

  async findById(id: string) {
    const { data, error } = await this.client
      .schema('system')
      .from('notificacoes')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new RepositoryError('notificacoes.findById', error);
    return data;
  }

  async criar(notificacao: Record<string, unknown>) {
    const { data, error } = await this.client
      .schema('system')
      .from('notificacoes')
      .insert(notificacao)
      .select()
      .single();
    if (error) throw new RepositoryError('notificacoes.criar', error);
    return data;
  }

  async atualizar(id: string, patch: Record<string, unknown>) {
    const { data, error } = await this.client
      .schema('system')
      .from('notificacoes')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new RepositoryError('notificacoes.atualizar', error);
    return data;
  }

  async excluir(id: string): Promise<void> {
    const { error } = await this.client
      .schema('system')
      .from('notificacoes')
      .delete()
      .eq('id', id);
    if (error) throw new RepositoryError('notificacoes.excluir', error);
  }

  /** Marca notificacao como enviada (usado para canal browser). */
  async marcarEnviada(id: string): Promise<void> {
    const { error } = await this.client
      .schema('system')
      .from('notificacoes')
      .update({ status: 'enviada', enviada_em: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new RepositoryError('notificacoes.marcarEnviada', error);
  }

  /** Marca todas as notificacoes do usuario como lidas. */
  async marcarTodasLidasParaUsuario(input: {
    barId: string;
    authId: string;
    role: string;
    modulo?: string;
  }) {
    let query = this.client
      .schema('system')
      .from('notificacoes')
      .update({ status: 'lida', lida_em: new Date().toISOString() })
      .eq('bar_id', input.barId)
      .in('status', ['pendente', 'enviada'])
      .or(`usuario_id.eq.${input.authId},role_alvo.eq.${input.role}`);

    if (input.modulo) query = query.eq('modulo', input.modulo);

    const { count, error } = await query;
    if (error) throw new RepositoryError('notificacoes.marcarTodasLidasParaUsuario', error);
    return count ?? 0;
  }

  /** Estatisticas rapidas dos ultimos 7 dias. */
  async estatisticasUltimos7Dias(input: { barId: string; authId: string; role: string }) {
    const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.client
      .schema('system')
      .from('notificacoes')
      .select('status, tipo, dados')
      .eq('bar_id', input.barId)
      .or(`usuario_id.eq.${input.authId},dados->>role_alvo.eq.${input.role}`)
      .gte('criada_em', desde);

    if (error) throw new RepositoryError('notificacoes.estatisticasUltimos7Dias', error);
    return data ?? [];
  }
}
