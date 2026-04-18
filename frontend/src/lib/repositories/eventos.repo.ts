/**
 * Repository de Eventos.
 *
 * Encapsula TODO acesso a operations.eventos_base (e tabelas
 * relacionadas). E o unico lugar do codigo que conhece colunas
 * e schema dessa entidade.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { RepositoryError } from '@/lib/errors';
import type { EventoBasePlanejamento } from '@/lib/domain/evento.types';

const COLUNAS_PLANEJAMENTO = `
  id,
  data_evento,
  nome,
  dia_semana,
  bar_id,
  m1_r,
  cl_plan,
  te_plan,
  tb_plan,
  c_artistico_plan,
  observacoes,
  real_r,
  cl_real,
  lot_max,
  te_real,
  tb_real,
  t_medio,
  c_art,
  c_prod,
  percent_art_fat,
  percent_b,
  percent_d,
  percent_c,
  percent_stockout,
  t_coz,
  t_bar,
  fat_19h_percent,
  sympla_liquido,
  sympla_checkins,
  yuzer_liquido,
  yuzer_ingressos,
  res_tot,
  res_p,
  faturamento_couvert_manual,
  faturamento_bar_manual,
  faturamento_couvert,
  couvert_vr_contahub,
  calculado_em,
  precisa_recalculo,
  versao_calculo,
  ativo
` as const;

export class EventosRepository {
  constructor(private client: SupabaseClient) {}

  /** Lista eventos ativos de um bar dentro de um mes. */
  async listarDoMes(barId: number, mes: number, ano: number): Promise<EventoBasePlanejamento[]> {
    const { inicio, fim } = mesPeriodo(mes, ano);

    const { data, error } = await this.client
      .schema('operations')
      .from('eventos_base')
      .select(COLUNAS_PLANEJAMENTO)
      .eq('bar_id', barId)
      .eq('ativo', true)
      .gte('data_evento', inicio)
      .lt('data_evento', fim)
      .order('data_evento', { ascending: true });

    if (error) throw new RepositoryError('eventos.listarDoMes', error);
    return (data ?? []) as unknown as EventoBasePlanejamento[];
  }

  /** Busca um evento por id. */
  async findById(id: number): Promise<EventoBasePlanejamento | null> {
    const { data, error } = await this.client
      .schema('operations')
      .from('eventos_base')
      .select(COLUNAS_PLANEJAMENTO)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new RepositoryError('eventos.findById', error);
    return (data as unknown as EventoBasePlanejamento) ?? null;
  }

  /** Dispara recalculo das metricas (real_r, cl_real, te_real, tb_real, etc). */
  async recalcularMetricas(eventoId: number): Promise<void> {
    const { error } = await this.client.rpc('calculate_evento_metrics', {
      evento_id: eventoId,
    });
    if (error) throw new RepositoryError('eventos.recalcularMetricas', error);
  }

  /** Calcula metricas de clientes (novos vs retornantes) para uma data. */
  async calcularMetricasClientes(input: {
    barId: number;
    dataAtual: string;
    dataAnterior: string;
  }) {
    const { data, error } = await this.client.rpc('calcular_metricas_clientes', {
      p_bar_id: input.barId,
      p_data_inicio_atual: input.dataAtual,
      p_data_fim_atual: input.dataAtual,
      p_data_inicio_anterior: input.dataAnterior,
      p_data_fim_anterior: input.dataAnterior,
    });
    if (error) throw new RepositoryError('eventos.calcularMetricasClientes', error);
    return data as Array<{ total_atual: number; novos_atual: number }> | null;
  }

  /** Conta clientes ativos (2+ visitas em N dias). */
  async contarClientesAtivos(input: {
    barId: number;
    dataInicio: string;
    dataFim: string;
  }): Promise<number | null> {
    const { data, error } = await this.client.rpc('get_count_base_ativa', {
      p_bar_id: input.barId,
      p_data_inicio: input.dataInicio,
      p_data_fim: input.dataFim,
    });
    if (error) throw new RepositoryError('eventos.contarClientesAtivos', error);
    return data === null || data === undefined ? null : Number(data);
  }
}

// =============== helpers ===============
function mesPeriodo(mes: number, ano: number) {
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const fim = mes === 12
    ? `${ano + 1}-01-01`
    : `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
  return { inicio, fim };
}
