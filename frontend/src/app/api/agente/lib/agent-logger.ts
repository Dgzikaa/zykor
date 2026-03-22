import { SupabaseClient } from '@supabase/supabase-js';

export async function registrarMetrica(
  supabase: SupabaseClient,
  dados: {
    bar_id: number;
    session_id?: string;
    agent_name: string;
    intent: string;
    query: string;
    response_time_ms: number;
    success: boolean;
    cache_hit: boolean;
    error_message?: string;
  }
): Promise<void> {
  try {
    await supabase.from('agente_uso').insert({
      bar_id: dados.bar_id,
      session_id: dados.session_id || null,
      agent_name: dados.agent_name,
      intent: dados.intent,
      query: dados.query,
      response_time_ms: dados.response_time_ms,
      success: dados.success,
      cache_hit: dados.cache_hit,
      error_message: dados.error_message || null
    });
  } catch (e) {
    console.error('Erro ao registrar métrica:', e);
  }
}

export async function salvarHistorico(
  supabase: SupabaseClient,
  dados: {
    bar_id: number;
    session_id: string;
    role: 'user' | 'assistant';
    content: string;
    agent_used?: string;
    metrics?: unknown;
    suggestions?: string[];
    deep_links?: unknown;
    chart_data?: unknown;
  }
): Promise<void> {
  try {
    await supabase.from('agente_historico').insert({
      bar_id: dados.bar_id,
      session_id: dados.session_id,
      role: dados.role,
      content: dados.content,
      agent_used: dados.agent_used || null,
      metrics: dados.metrics || null,
      suggestions: dados.suggestions || null,
      deep_links: dados.deep_links || null,
      chart_data: dados.chart_data || null
    });
  } catch (e) {
    console.error('Erro ao salvar histórico:', e);
  }
}
