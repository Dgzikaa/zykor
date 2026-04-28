/**
 * Mapeamento centralizado: nome da tabela -> schema no banco
 *
 * Use este mapa como fonte unica da verdade. Cada tabela vive em
 * exatamente um schema (sem tabelas em public, exceto auth do Supabase).
 *
 * @example
 *   import { schemaOf } from '@/lib/supabase/table-schemas';
 *
 *   await supabase
 *     .schema(schemaOf('notificacoes'))
 *     .from('notificacoes')
 *     .select('*');
 */

export const TABLE_SCHEMAS = {
  // ============================================
  // AUTH_CUSTOM - Autenticacao customizada
  // ============================================
  usuarios: 'auth_custom',
  usuarios_bares: 'auth_custom',
  empresas: 'auth_custom',
  empresa_usuarios: 'auth_custom',
  pessoas_responsaveis: 'auth_custom',
  grupos: 'auth_custom',
  template_tags: 'auth_custom',

  // ============================================
  // OPERATIONS - Operacoes do bar
  // ============================================
  bares: 'operations',
  bares_config: 'operations',
  bar_artistas: 'operations',
  bar_categorias_custo: 'operations',
  bar_local_mapeamento: 'operations',
  bar_metas_periodo: 'operations',
  bar_notification_configs: 'operations',
  bar_regras_negocio: 'operations',
  calendario_operacional: 'operations',
  checklist_agendamentos: 'operations',
  checklist_auto_executions: 'operations',
  checklist_automation_logs: 'operations',
  contagem_estoque_insumos: 'operations',
  eventos: 'operations',
  eventos_base: 'operations',
  eventos_base_auditoria: 'operations',
  eventos_concorrencia: 'operations',
  faturamento_hora: 'operations',
  faturamento_pagamentos: 'operations',
  grupos_produto: 'operations',
  insumos: 'operations',
  produtos: 'operations',
  tempos_producao: 'operations',
  vendas_item: 'operations',

  // ============================================
  // FINANCIAL - Financeiro
  // ============================================
  caixa_impostos_movimentos: 'financial',
  caixa_investimentos_movimentos: 'financial',
  caixa_recebimentos_futuros: 'financial',
  caixa_valores_terceiros: 'financial',
  cmv_mensal: 'financial',
  cmv_semanal: 'financial',
  custos_mensais_diluidos: 'financial',
  dre_manual: 'financial',
  formas_pagamento: 'financial',
  fp_categorias_template: 'financial',
  fp_contas: 'financial',
  lancamentos_financeiros: 'financial',
  orcamentacao: 'financial',
  pix_enviados: 'financial',
  simulacoes_cmo: 'financial',
  view_dre: 'financial',

  // ============================================
  // HR - Recursos Humanos
  // ============================================
  areas: 'hr',
  cargos: 'hr',
  contratos_funcionario: 'hr',
  folha_pagamento: 'hr',
  funcionarios: 'hr',
  pesquisa_felicidade: 'hr',
  provisoes_trabalhistas: 'hr',

  // ============================================
  // CRM - Relacionamento com cliente
  // ============================================
  cliente_perfil_consumo: 'crm',
  crm_segmentacao: 'crm',
  crm_templates: 'crm',
  nps: 'crm',
  nps_agregado_semanal: 'crm',
  nps_falae_diario: 'crm',
  nps_falae_diario_pesquisa: 'crm',
  nps_reservas: 'crm',
  voz_cliente: 'crm',

  // ============================================
  // META - Metas e estrategia
  // ============================================
  desempenho_manual: 'meta',
  marketing_mensal: 'meta',
  marketing_semanal: 'meta',
  metas_anuais: 'meta',
  metas_desempenho: 'meta',
  metas_desempenho_historico: 'meta',
  organizador_okrs: 'meta',
  organizador_visao: 'meta',
  semanas_referencia: 'meta',

  // ============================================
  // AGENT_AI - Agente de IA
  // ============================================
  agent_insights_v2: 'agent_ai',
  agente_alertas: 'agent_ai',
  agente_aprendizado: 'agent_ai',
  agente_configuracoes: 'agent_ai',
  agente_conversas: 'agent_ai',
  agente_feedbacks: 'agent_ai',
  agente_historico: 'agent_ai',
  agente_ia_metricas: 'agent_ai',
  agente_insights: 'agent_ai',
  agente_memoria_vetorial: 'agent_ai',
  agente_metricas: 'agent_ai',
  agente_padroes_detectados: 'agent_ai',
  agente_regras_dinamicas: 'agent_ai',
  agente_scans: 'agent_ai',
  agente_uso: 'agent_ai',
  agente_uso_dashboard: 'agent_ai',
  agente_uso_por_hora: 'agent_ai',

  // ============================================
  // SYSTEM - Sistema, logs, controle
  // ============================================
  _sync_chunk_progress: 'system',
  alertas_enviados: 'system',
  audit_trail: 'system',
  automation_logs: 'system',
  cron_heartbeats: 'system',
  dados_bloqueados: 'system',
  discord_webhooks: 'system',
  execucoes_automaticas: 'system',
  insight_events: 'system',
  notificacoes: 'system',
  recalculo_eventos_log: 'system',
  security_events: 'system',
  sistema_alertas: 'system',
  sync_contagem_historico: 'system',
  sync_metadata: 'system',
  system_config: 'system',
  system_logs: 'system',
  uploads: 'system',
  validacao_dados: 'system',
  validacao_dados_diaria: 'system',
  validacoes_cruzadas: 'system',

  // ============================================
  // INTEGRATIONS - APIs externas
  // ============================================
  api_credentials: 'integrations',
  bar_api_configs: 'integrations',
  contaazul_categorias: 'integrations',
  contaazul_centros_custo: 'integrations',
  contaazul_contas_financeiras: 'integrations',
  contaazul_lancamentos: 'integrations',
  contaazul_logs_sincronizacao: 'integrations',
  contaazul_pessoas: 'integrations',
  falae_config: 'integrations',
  falae_respostas: 'integrations',
  getin_reservas: 'integrations',
  getin_reservations: 'integrations',
  getin_sync_logs: 'integrations',
  getin_units: 'integrations',
  google_oauth_tokens: 'integrations',
  google_reviews: 'integrations',
  google_reviews_imports: 'integrations',
  sympla_bilheteria: 'integrations',
  sympla_eventos: 'integrations',
  sympla_participantes: 'integrations',
  sympla_pedidos: 'integrations',
  umbler_config: 'integrations',
  umbler_conversas: 'integrations',
  umbler_mensagens: 'integrations',
  umbler_webhook_logs: 'integrations',
  yuzer_eventos: 'integrations',
  yuzer_fatporhora: 'integrations',
  yuzer_pagamento: 'integrations',
  yuzer_produtos: 'integrations',

  // ============================================
  // BRONZE - Dados brutos (camada de ingestao)
  // ============================================
  bronze_contahub_avendas_porproduto_analitico: 'bronze',
  bronze_contahub_avendas_cancelamentos: 'bronze',
  bronze_contahub_avendas_vendasperiodo: 'bronze',
  bronze_contahub_avendas_vendasdiahoraanalitico: 'bronze',
  bronze_contahub_financeiro_pagamentosrecebidos: 'bronze',
  bronze_contahub_produtos_temposproducao: 'bronze',
  bronze_contahub_operacional_stockout_raw: 'bronze',
  bronze_contahub_raw_data: 'bronze',
  bronze_processing_control: 'bronze',
  bronze_contaazul_categorias: 'bronze',
  bronze_contaazul_centros_custo: 'bronze',
  bronze_contaazul_contas_financeiras: 'bronze',
  bronze_contaazul_lancamentos: 'bronze',
  bronze_contaazul_sync_log: 'bronze',
  bronze_falae_respostas: 'bronze',
  bronze_getin_reservations: 'bronze',
  bronze_getin_units: 'bronze',
  bronze_google_reviews: 'bronze',
  bronze_sympla_eventos: 'bronze',
  bronze_sympla_participantes: 'bronze',
  bronze_sympla_pedidos: 'bronze',
  bronze_sympla_sync_log: 'bronze',
  bronze_umbler_campanha_destinatarios: 'bronze',
  bronze_umbler_campanhas: 'bronze',
  bronze_umbler_config: 'bronze',
  bronze_umbler_conversas: 'bronze',
  bronze_umbler_mensagens: 'bronze',
  bronze_yuzer_estatisticas_evento: 'bronze',
  bronze_yuzer_eventos: 'bronze',
  bronze_yuzer_fatporhora: 'bronze',
  bronze_yuzer_pagamentos_evento: 'bronze',
  bronze_yuzer_produtos_evento: 'bronze',
  bronze_yuzer_sync_log: 'bronze',

  // ============================================
  // SILVER - Dados processados
  // ============================================
  silver_contahub_financeiro_pagamentosrecebidos: 'silver',
  silver_contahub_operacional_stockout_processado: 'silver',

  // ============================================
  // GOLD - Dados analiticos
  // ============================================
  desempenho: 'gold',
  planejamento: 'gold',
  gold_contahub_avendas_porproduto_analitico: 'gold',
  gold_contahub_avendas_vendasperiodo: 'gold',
  gold_contahub_produtos_temposproducao: 'gold',
  gold_contahub_financeiro_pagamentosrecebidos_resumo: 'gold',
  gold_contahub_operacional_stockout: 'gold',
  gold_contahub_operacional_stockout_filtrado: 'gold',
  gold_contahub_operacional_stockout_por_categoria: 'gold',
} as const;

export type ZykorTable = keyof typeof TABLE_SCHEMAS;
export type ZykorSchema = (typeof TABLE_SCHEMAS)[ZykorTable];

/**
 * Retorna o schema de uma tabela. Se a tabela nao estiver no mapa,
 * loga warning em desenvolvimento e retorna 'public' (fallback para
 * evitar que rotas legadas quebrem em producao).
 */
export function schemaOf(table: string): string {
  const schema = (TABLE_SCHEMAS as Record<string, string>)[table];
  if (!schema) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(
        `[table-schemas] Tabela "${table}" nao mapeada. Adicione em TABLE_SCHEMAS.`
      );
    }
    return 'public';
  }
  return schema;
}

/**
 * Helper conveniente para chamadas Supabase: retorna um cliente ja com
 * o schema correto setado para a tabela informada.
 *
 * @example
 *   const { data } = await tbl(supabase, 'notificacoes')
 *     .select('*')
 *     .eq('bar_id', barId);
 */
// Tipos genéricos do PostgREST/Supabase JS (sem importar o SDK aqui).
// O retorno é `any` porque os call-sites encadeiam `.select()/.eq()/.insert()`
// etc. — sem `any`, o TS bate TS2571 ("Object is of type 'unknown'").
// A regra `@typescript-eslint/no-explicit-any` não está configurada no projeto,
// então não precisa de eslint-disable.
type SupabaseLike = { schema: (s: string) => { from: (t: string) => any } };

export function tbl<T extends ZykorTable>(
  supabase: SupabaseLike,
  table: T
): any {
  return supabase.schema(schemaOf(table)).from(table);
}
