// ============================================
// 🤖 ZYKOR AI AGENTS - TYPES & INTERFACES
// Sistema Multi-Agentes para Gestão de Bares
// ============================================

// ============ TIPOS BASE ============

export type AgentType = 
  | 'orchestrator'    // Agente principal - roteia para outros
  | 'sql_query'       // Agente de consultas ao banco
  | 'alerts'          // Agente de alertas e erros
  | 'analytics'       // Agente de análises e insights
  | 'reports'         // Agente de relatórios
  | 'recommendations' // Agente de recomendações

export type AgentStatus = 'idle' | 'processing' | 'success' | 'error'

export type IntentCategory = 
  | 'vendas'          // Faturamento, receitas, vendas
  | 'clientes'        // Clientes, público, visitantes
  | 'eventos'         // Shows, festas, programação
  | 'produtos'        // Produtos, estoque, cardápio
  | 'financeiro'      // Custos, despesas, DRE
  | 'operacional'     // Checklists, processos, equipe
  | 'alertas'         // Erros, anomalias, problemas
  | 'geral'           // Perguntas gerais

export type QueryComplexity = 'simple' | 'medium' | 'complex'

// ============ INTERFACES BASE ============

export interface AgentMessage {
  id: string
  role: 'user' | 'agent' | 'system'
  content: string
  timestamp: Date
  agentType?: AgentType
  metadata?: Record<string, any>
}

export interface AgentContext {
  barId: number
  barName: string
  userId?: string
  userName?: string
  currentDate: Date
  conversationHistory: AgentMessage[]
  availableTables: string[]
  businessContext: BusinessContext
}

export interface BusinessContext {
  tipoNegocio: 'bar' | 'restaurante' | 'casa_noturna' | 'pub'
  diasFuncionamento: string[]
  horarioFuncionamento: { abertura: string; fechamento: string }
  capacidade: number
  principaisProdutos: string[]
  principaisEventos: string[]
  fonteDados: {
    diasNormais: string[]      // bronze_contahub_vendas_periodo, bronze_contahub_vendas_analitico, etc.
    domingosEventos: string[]  // yuzer_produtos, sympla_participantes, etc.
  }
}

// ============ QUERY ANALYSIS ============

export interface QueryAnalysisResult {
  originalQuery: string
  normalizedQuery: string
  intent: IntentCategory
  subIntents: string[]
  entities: ExtractedEntity[]
  timeRange: TimeRange | null
  metrics: string[]
  complexity: QueryComplexity
  confidence: number
  suggestedAgent: AgentType
  requiresData: boolean
  sqlHints: string[]
}

export interface ExtractedEntity {
  type: 'date' | 'metric' | 'product' | 'event' | 'person' | 'number' | 'period'
  value: string
  normalized: any
  confidence: number
}

export interface TimeRange {
  start: Date
  end: Date
  period: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom'
  label: string
  relative: boolean
}

// ============ AGENT RESPONSE ============

export interface AgentResponse {
  success: boolean
  agentType: AgentType
  message: string
  data?: any
  insights?: string[]
  recommendations?: string[]
  chartData?: ChartData
  sqlQuery?: string
  executionTime: number
  confidence: number
  sources: string[]
  nextActions?: string[]
  error?: string
}

export interface ChartData {
  type: 'line' | 'bar' | 'pie' | 'area' | 'composed'
  title: string
  description?: string
  data: any[]
  xAxisKey?: string
  yAxisKey?: string
  colors?: string[]
}

// ============ AGENT TASK ============

export interface AgentTask {
  id: string
  query: string
  context: AgentContext
  analysis: QueryAnalysisResult
  assignedAgent: AgentType
  status: AgentStatus
  startTime: Date
  endTime?: Date
  response?: AgentResponse
  retryCount: number
}

// ============ SQL AGENT TYPES ============

export interface SQLQueryRequest {
  intent: IntentCategory
  entities: ExtractedEntity[]
  timeRange: TimeRange | null
  metrics: string[]
  barId: number
}

export interface SQLQueryResult {
  success: boolean
  query: string
  data: any[]
  rowCount: number
  executionTime: number
  error?: string
}

export interface TableMapping {
  tableName: string
  description: string
  primaryKey: string
  foreignKeys: Record<string, string>
  importantColumns: ColumnInfo[]
  useCases: string[]
  context: 'dias_normais' | 'domingos_eventos' | 'ambos'
}

export interface ColumnInfo {
  name: string
  type: string
  description: string
  examples?: string[]
  aggregations?: ('sum' | 'avg' | 'count' | 'max' | 'min')[]
}

// ============ ALERTS AGENT TYPES ============

export interface Alert {
  id: string
  type: 'error' | 'warning' | 'info' | 'critical'
  category: 'sync' | 'data_quality' | 'performance' | 'anomaly' | 'security'
  title: string
  description: string
  source: string
  timestamp: Date
  resolved: boolean
  metadata?: Record<string, any>
}

export interface AlertCheckResult {
  alertsFound: Alert[]
  checksPerformed: string[]
  healthScore: number
  recommendations: string[]
}

// ============ ANALYTICS AGENT TYPES ============

export interface AnalyticsRequest {
  type: 'trend' | 'comparison' | 'forecast' | 'anomaly' | 'summary'
  metrics: string[]
  timeRange: TimeRange
  groupBy?: string[]
  filters?: Record<string, any>
}

export interface AnalyticsResult {
  type: string
  summary: string
  insights: Insight[]
  metrics: MetricResult[]
  trends: TrendData[]
  comparisons?: ComparisonData[]
  forecasts?: ForecastData[]
}

export interface Insight {
  title: string
  description: string
  impact: 'positive' | 'negative' | 'neutral'
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  recommendation?: string
}

export interface MetricResult {
  name: string
  value: number
  previousValue?: number
  change?: number
  changePercent?: number
  trend: 'up' | 'down' | 'stable'
  unit?: string
}

export interface TrendData {
  metric: string
  direction: 'increasing' | 'decreasing' | 'stable' | 'volatile'
  strength: number
  forecast?: number
}

export interface ComparisonData {
  metric: string
  current: number
  previous: number
  change: number
  changePercent: number
}

export interface ForecastData {
  metric: string
  prediction: number
  confidence: number
  range: { min: number; max: number }
  horizon: string
}

// ============ KNOWLEDGE BASE TYPES ============

export interface KnowledgeEntry {
  id: string
  category: string
  topic: string
  content: string
  examples: string[]
  relatedTables: string[]
  relatedQueries: string[]
  tags: string[]
  priority: number
}

export interface KnowledgeBase {
  entries: KnowledgeEntry[]
  tableMappings: TableMapping[]
  businessRules: BusinessRule[]
  commonQueries: CommonQuery[]
}

export interface BusinessRule {
  id: string
  name: string
  description: string
  condition: string
  action: string
  priority: number
}

export interface CommonQuery {
  id: string
  naturalLanguage: string
  sqlTemplate: string
  parameters: string[]
  category: IntentCategory
  examples: string[]
}

