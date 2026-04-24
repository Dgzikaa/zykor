/**
 * Gold layer — dados calculados e agregados, prontos pra dashboards.
 *
 * Esta é a camada que dashboards devem consumir. Se uma tela precisa
 * calcular métrica em cima de `silver`, é sinal que o cálculo deveria
 * estar no banco (função SQL + view gold).
 *
 * Exemplos: `gold.desempenho_semanal`, `gold.planejamento`, `gold.faturamento_hora`.
 */
import { getAdminClient } from '@/lib/supabase-admin';

export async function gold() {
  const client = await getAdminClient();
  return client.schema('gold' as never);
}

/**
 * Para queries analíticas pesadas — schema `analytics`.
 */
export async function analytics() {
  const client = await getAdminClient();
  return client.schema('analytics' as never);
}
