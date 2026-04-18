/**
 * Repository de Bares.
 *
 * Encapsula acesso a operations.bares e operations.bares_config.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { RepositoryError } from '@/lib/errors';
import type { Bar, BarConfigOperacao } from '@/lib/domain/bar.types';

export class BaresRepository {
  constructor(private client: SupabaseClient) {}

  /** Busca dados basicos de um bar. */
  async findById(id: number): Promise<Bar | null> {
    const { data, error } = await this.client
      .schema('operations')
      .from('bares')
      .select('id, nome, ativo')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new RepositoryError('bares.findById', error);
    return (data as Bar | null) ?? null;
  }

  /** Lista bares ativos por ids. */
  async findActiveByIds(ids: number[]): Promise<Bar[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.client
      .schema('operations')
      .from('bares')
      .select('id, nome, ativo')
      .in('id', ids)
      .eq('ativo', true);

    if (error) throw new RepositoryError('bares.findActiveByIds', error);
    return (data ?? []) as Bar[];
  }

  /** Configuracao de dias de operacao do bar. */
  async getConfigOperacao(barId: number): Promise<BarConfigOperacao | null> {
    const { data, error } = await this.client
      .schema('operations')
      .from('bares_config')
      .select(
        'opera_segunda, opera_terca, opera_quarta, opera_quinta, opera_sexta, opera_sabado, opera_domingo'
      )
      .eq('bar_id', barId)
      .maybeSingle();

    if (error) throw new RepositoryError('bares.getConfigOperacao', error);
    return (data as BarConfigOperacao | null) ?? null;
  }
}
