/**
 * 📊 Eventos Data - Busca de Dados de Eventos
 * 
 * Módulo compartilhado para buscar dados de eventos do banco.
 * Usado por agentes IA e funções de análise.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface EventoBase {
  evento_id: number;
  bar_id: number;
  data_evento: string;
  nome_evento?: string;
  tipo_evento?: string;
  cl_real?: number;
  real_r?: number;
  te_real?: number;
  tb_real?: number;
  t_medio?: number;
  cmv?: number;
  cmv_percentual?: number;
  yuzer_liquido?: number;
  sympla_liquido?: number;
  contahub_receita_bar?: number;
  contahub_receita_couvert?: number;
  [key: string]: any;
}

export interface EventoDetalhado extends EventoBase {
  yuzer_produtos?: any[];
  sympla_pedidos?: any[];
  contahub_pagamentos?: any[];
  contahub_periodo?: any[];
}

/**
 * Buscar eventos de um período
 */
export async function buscarEventosPeriodo(
  supabase: SupabaseClient,
  barId: number,
  dataInicio: string,
  dataFim: string
): Promise<EventoBase[]> {
  const { data, error } = await supabase
    .from('eventos_base')
    .select('*')
    .eq('bar_id', barId)
    .gte('data_evento', dataInicio)
    .lte('data_evento', dataFim)
    .order('data_evento', { ascending: true });
  
  if (error) {
    console.error('❌ Erro ao buscar eventos:', error);
    throw new Error(`Erro ao buscar eventos: ${error.message}`);
  }
  
  return (data || []) as EventoBase[];
}

/**
 * Buscar evento por ID
 */
export async function buscarEventoPorId(
  supabase: SupabaseClient,
  eventoId: number
): Promise<EventoBase | null> {
  const { data, error } = await supabase
    .from('eventos_base')
    .select('*')
    .eq('evento_id', eventoId)
    .single();
  
  if (error) {
    console.error('❌ Erro ao buscar evento:', error);
    return null;
  }
  
  return data as EventoBase;
}

/**
 * Buscar evento por data
 */
export async function buscarEventoPorData(
  supabase: SupabaseClient,
  barId: number,
  dataEvento: string
): Promise<EventoBase | null> {
  const { data, error } = await supabase
    .from('eventos_base')
    .select('*')
    .eq('bar_id', barId)
    .eq('data_evento', dataEvento)
    .single();
  
  if (error) {
    console.error('❌ Erro ao buscar evento:', error);
    return null;
  }
  
  return data as EventoBase;
}

/**
 * Buscar eventos da semana
 */
export async function buscarEventosSemana(
  supabase: SupabaseClient,
  barId: number,
  semana: number,
  ano: number
): Promise<EventoBase[]> {
  const { data, error } = await supabase
    .from('eventos_base')
    .select('*')
    .eq('bar_id', barId)
    .eq('semana', semana)
    .eq('ano', ano)
    .order('data_evento', { ascending: true });
  
  if (error) {
    console.error('❌ Erro ao buscar eventos da semana:', error);
    throw new Error(`Erro ao buscar eventos: ${error.message}`);
  }
  
  return (data || []) as EventoBase[];
}

/**
 * Buscar eventos do mês
 */
export async function buscarEventosMes(
  supabase: SupabaseClient,
  barId: number,
  mes: number,
  ano: number
): Promise<EventoBase[]> {
  const { data, error } = await supabase
    .from('eventos_base')
    .select('*')
    .eq('bar_id', barId)
    .eq('mes', mes)
    .eq('ano', ano)
    .order('data_evento', { ascending: true });
  
  if (error) {
    console.error('❌ Erro ao buscar eventos do mês:', error);
    throw new Error(`Erro ao buscar eventos: ${error.message}`);
  }
  
  return (data || []) as EventoBase[];
}

/**
 * Buscar evento detalhado com dados relacionados
 */
export async function buscarEventoDetalhado(
  supabase: SupabaseClient,
  eventoId: number
): Promise<EventoDetalhado | null> {
  const evento = await buscarEventoPorId(supabase, eventoId);
  
  if (!evento) {
    return null;
  }
  
  const [yuzerProdutos, symplaPedidos, contahubPagamentos, contahubPeriodo] = await Promise.all([
    buscarYuzerProdutos(supabase, evento.bar_id, evento.data_evento),
    buscarSymplaPedidos(supabase, evento.bar_id, evento.data_evento),
    buscarContaHubPagamentos(supabase, evento.bar_id, evento.data_evento),
    buscarContaHubPeriodo(supabase, evento.bar_id, evento.data_evento),
  ]);
  
  return {
    ...evento,
    yuzer_produtos: yuzerProdutos,
    sympla_pedidos: symplaPedidos,
    contahub_pagamentos: contahubPagamentos,
    contahub_periodo: contahubPeriodo,
  };
}

/**
 * Buscar produtos Yuzer do evento
 */
async function buscarYuzerProdutos(
  supabase: SupabaseClient,
  barId: number,
  dataEvento: string
): Promise<any[]> {
  const { data } = await supabase
    .from('yuzer_produtos')
    .select('*')
    .eq('bar_id', barId)
    .eq('data_evento', dataEvento);
  
  return data || [];
}

/**
 * Buscar pedidos Sympla do evento
 */
async function buscarSymplaPedidos(
  supabase: SupabaseClient,
  barId: number,
  dataEvento: string
): Promise<any[]> {
  const { data } = await supabase
    .from('sympla_pedidos')
    .select('*')
    .eq('bar_id', barId)
    .eq('data_evento', dataEvento);
  
  return data || [];
}

/**
 * Buscar pagamentos ContaHub do evento
 */
async function buscarContaHubPagamentos(
  supabase: SupabaseClient,
  barId: number,
  dataEvento: string
): Promise<any[]> {
  const { data } = await supabase
    .from('contahub_pagamentos')
    .select('*')
    .eq('bar_id', barId)
    .eq('data', dataEvento);
  
  return data || [];
}

/**
 * Buscar período ContaHub do evento
 */
async function buscarContaHubPeriodo(
  supabase: SupabaseClient,
  barId: number,
  dataEvento: string
): Promise<any[]> {
  const { data } = await supabase
    .from('contahub_periodo')
    .select('*')
    .eq('bar_id', barId)
    .eq('data', dataEvento);
  
  return data || [];
}

/**
 * Calcular métricas agregadas de múltiplos eventos
 */
export function calcularMetricasAgregadas(eventos: EventoBase[]): {
  totalEventos: number;
  totalClientes: number;
  totalReceita: number;
  ticketMedio: number;
  receitaMedia: number;
  cmvMedio: number;
} {
  const totalEventos = eventos.length;
  const totalClientes = eventos.reduce((sum, e) => sum + (e.cl_real || 0), 0);
  const totalReceita = eventos.reduce((sum, e) => sum + (e.real_r || 0), 0);
  const ticketMedio = totalClientes > 0 ? totalReceita / totalClientes : 0;
  const receitaMedia = totalEventos > 0 ? totalReceita / totalEventos : 0;
  const cmvMedio = totalEventos > 0 
    ? eventos.reduce((sum, e) => sum + (e.cmv_percentual || 0), 0) / totalEventos 
    : 0;
  
  return {
    totalEventos,
    totalClientes,
    totalReceita,
    ticketMedio,
    receitaMedia,
    cmvMedio,
  };
}

/**
 * Comparar evento com média do período
 */
export function compararComMedia(
  evento: EventoBase,
  eventos: EventoBase[]
): {
  receitaVsMedia: number;
  clientesVsMedia: number;
  ticketMedioVsMedia: number;
  cmvVsMedia: number;
} {
  const metricas = calcularMetricasAgregadas(eventos);
  
  return {
    receitaVsMedia: metricas.receitaMedia > 0 
      ? ((evento.real_r || 0) / metricas.receitaMedia - 1) * 100 
      : 0,
    clientesVsMedia: metricas.totalClientes > 0 
      ? ((evento.cl_real || 0) / (metricas.totalClientes / eventos.length) - 1) * 100 
      : 0,
    ticketMedioVsMedia: metricas.ticketMedio > 0 
      ? ((evento.t_medio || 0) / metricas.ticketMedio - 1) * 100 
      : 0,
    cmvVsMedia: metricas.cmvMedio > 0 
      ? ((evento.cmv_percentual || 0) / metricas.cmvMedio - 1) * 100 
      : 0,
  };
}
