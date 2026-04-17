/**
 * Referências centralizadas de tabelas por schema
 * 
 * Use essas funções helper para acessar tabelas com o schema correto:
 * 
 * @example
 * // ANTES (errado - usa view de compatibilidade)
 * await supabase.from('contahub_analitico').select('*');
 * 
 * // DEPOIS (correto - usa schema explícito)
 * await bronze(supabase, 'avendas_porproduto_analitico').select('*');
 */

export type SupabaseClient = any;

// ============================================
// BRONZE - Dados Brutos (Ingestão)
// ============================================

export const BRONZE_TABLES = {
  // Vendas
  avendas_porproduto_analitico: 'bronze_contahub_avendas_porproduto_analitico',
  avendas_cancelamentos: 'bronze_contahub_avendas_cancelamentos',
  avendas_vendasperiodo: 'bronze_contahub_avendas_vendasperiodo',
  avendas_vendasdiahoraanalitico: 'bronze_contahub_avendas_vendasdiahoraanalitico',
  
  // Financeiro
  financeiro_pagamentosrecebidos: 'bronze_contahub_financeiro_pagamentosrecebidos',
  
  // Produtos
  produtos_temposproducao: 'bronze_contahub_produtos_temposproducao',
  
  // Operacional
  operacional_stockout_raw: 'bronze_contahub_operacional_stockout_raw',
  
  // Outros
  raw_data: 'bronze_contahub_raw_data',
  processing_control: 'bronze_processing_control',
} as const;

export function bronze(supabase: SupabaseClient, table: keyof typeof BRONZE_TABLES) {
  return supabase.schema('bronze').from(BRONZE_TABLES[table]);
}

// ============================================
// SILVER - Dados Processados
// ============================================

export const SILVER_TABLES = {
  financeiro_pagamentosrecebidos: 'silver_contahub_financeiro_pagamentosrecebidos',
  operacional_stockout_processado: 'silver_contahub_operacional_stockout_processado',
} as const;

export function silver(supabase: SupabaseClient, table: keyof typeof SILVER_TABLES) {
  return supabase.schema('silver').from(SILVER_TABLES[table]);
}

// ============================================
// GOLD - Dados Analíticos
// ============================================

export const GOLD_TABLES = {
  avendas_porproduto_analitico: 'gold_contahub_avendas_porproduto_analitico',
  avendas_vendasperiodo: 'gold_contahub_avendas_vendasperiodo',
  produtos_temposproducao: 'gold_contahub_produtos_temposproducao',
  financeiro_pagamentosrecebidos_resumo: 'gold_contahub_financeiro_pagamentosrecebidos_resumo',
  operacional_stockout: 'gold_contahub_operacional_stockout',
  operacional_stockout_filtrado: 'gold_contahub_operacional_stockout_filtrado',
  operacional_stockout_por_categoria: 'gold_contahub_operacional_stockout_por_categoria',
} as const;

export function gold(supabase: SupabaseClient, table: keyof typeof GOLD_TABLES) {
  return supabase.schema('gold').from(GOLD_TABLES[table]);
}

// ============================================
// OPERATIONS - Operações do Bar
// ============================================

export const OPERATIONS_TABLES = {
  bares: 'bares',
  bares_config: 'bares_config',
  eventos: 'eventos',
  eventos_base: 'eventos_base',
  eventos_base_auditoria: 'eventos_base_auditoria',
  produtos: 'produtos',
  vendas_item: 'vendas_item',
  // ... adicionar conforme necessário
} as const;

export function operations(supabase: SupabaseClient, table: keyof typeof OPERATIONS_TABLES) {
  return supabase.schema('operations').from(OPERATIONS_TABLES[table]);
}

// ============================================
// SYSTEM - Sistema e Logs
// ============================================

export const SYSTEM_TABLES = {
  system_config: 'system_config',
  system_logs: 'system_logs',
  sync_metadata: 'sync_metadata',
  // ... adicionar conforme necessário
} as const;

export function system(supabase: SupabaseClient, table: keyof typeof SYSTEM_TABLES) {
  return supabase.schema('system').from(SYSTEM_TABLES[table]);
}

// ============================================
// Mapeamento de tipos de dados ContaHub -> Tabelas Bronze
// ============================================

export const CONTAHUB_DATA_TYPE_MAP: Record<string, {
  table: keyof typeof BRONZE_TABLES;
  dateColumn: string;
}> = {
  'periodo': { table: 'avendas_vendasperiodo', dateColumn: 'dt_gerencial' },
  'pagamentos': { table: 'financeiro_pagamentosrecebidos', dateColumn: 'dt_gerencial' },
  'analitico': { table: 'avendas_porproduto_analitico', dateColumn: 'trn_dtgerencial' },
  'fatporhora': { table: 'avendas_vendasdiahoraanalitico', dateColumn: 'vd_dtgerencial' },
  'tempo': { table: 'produtos_temposproducao', dateColumn: 'data' },
  'cancelamentos': { table: 'avendas_cancelamentos', dateColumn: 'data' },
};

// ============================================
// Helper para deletar dados por tipo
// ============================================

export async function deleteContaHubData(
  supabase: SupabaseClient,
  dataType: string,
  dataDate: string,
  barId: number
): Promise<{ success: boolean; error?: string }> {
  const config = CONTAHUB_DATA_TYPE_MAP[dataType];
  
  if (!config) {
    return { success: false, error: `Tipo ${dataType} não mapeado` };
  }
  
  const { error } = await bronze(supabase, config.table)
    .delete()
    .eq('bar_id', barId)
    .eq(config.dateColumn, dataDate);
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true };
}
