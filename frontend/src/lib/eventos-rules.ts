// =====================================================
// ONDA 1/2B: Cache de metas por bar (banco)
// SEM FALLBACKS: Se banco não retornar, logar erro e retornar zeros
// =====================================================

interface MetasDia {
  meta_m1: number
  te_plan: number
  tb_plan: number
}

type MetasPorDia = Record<number, MetasDia>
type CacheMetasBar = Record<number, MetasPorDia>

let cacheMetasBar: CacheMetasBar = {}
let cacheTimestamp: Record<number, number> = {}
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutos

// Metas zeradas para retornar quando não há configuração (não crashar o pipeline)
const METAS_ZERADAS: MetasPorDia = {
  0: { meta_m1: 0, te_plan: 0, tb_plan: 0 },
  1: { meta_m1: 0, te_plan: 0, tb_plan: 0 },
  2: { meta_m1: 0, te_plan: 0, tb_plan: 0 },
  3: { meta_m1: 0, te_plan: 0, tb_plan: 0 },
  4: { meta_m1: 0, te_plan: 0, tb_plan: 0 },
  5: { meta_m1: 0, te_plan: 0, tb_plan: 0 },
  6: { meta_m1: 0, te_plan: 0, tb_plan: 0 }
}

/**
 * Busca metas do banco para um bar (com cache) - versão CLIENT-SIDE via fetch
 * SEM FALLBACK: Se não encontrar, logar erro e retornar zeros
 */
export async function fetchMetasBar(barId: number): Promise<MetasPorDia> {
  const agora = Date.now()
  
  // Se cache válido, usar
  if (cacheMetasBar[barId] && (agora - (cacheTimestamp[barId] || 0)) < CACHE_TTL_MS) {
    return cacheMetasBar[barId]
  }
  
  try {
    const response = await fetch(`/api/config/bar/${barId}/metas`)
    if (response.ok) {
      const data = await response.json()
      if (Array.isArray(data) && data.length > 0) {
        const metas: MetasPorDia = {}
        for (const m of data) {
          metas[m.dia_semana] = {
            meta_m1: m.meta_m1 || 0,
            te_plan: m.te_plan || 0,
            tb_plan: m.tb_plan || 0
          }
        }
        cacheMetasBar[barId] = metas
        cacheTimestamp[barId] = agora
        console.log(`📊 [eventos-rules] Metas bar ${barId} carregadas do banco`)
        return metas
      }
    }
    console.error(`❌ [ERRO CONFIG] Metas não encontradas para bar ${barId}. Configure bar_metas_periodo.`)
  } catch (error) {
    console.error(`❌ [ERRO CONFIG] Falha ao buscar metas para bar ${barId}. Configure bar_metas_periodo.`, error)
  }
  
  return METAS_ZERADAS
}

/**
 * ONDA 2B: Busca metas diretamente do banco - versão SERVER-SIDE com supabase client
 * SEM FALLBACK: Se não encontrar, logar erro e retornar zeros
 */
export async function fetchMetasBarServer(supabase: any, barId: number): Promise<MetasPorDia> {
  const agora = Date.now()
  
  // Se cache válido, usar
  if (cacheMetasBar[barId] && (agora - (cacheTimestamp[barId] || 0)) < CACHE_TTL_MS) {
    return cacheMetasBar[barId]
  }
  
  try {
    const { data, error } = await supabase
      .from('bar_metas_periodo')
      .select('dia_semana, meta_m1, te_plan, tb_plan')
      .eq('bar_id', barId)
      .order('dia_semana', { ascending: true })
    
    if (error || !data || data.length === 0) {
      console.error(`❌ [ERRO CONFIG] Metas não encontradas para bar ${barId}. Configure bar_metas_periodo.`)
      return METAS_ZERADAS
    }
    
    const metas: MetasPorDia = {}
    for (const m of data) {
      metas[m.dia_semana] = {
        meta_m1: parseFloat(String(m.meta_m1)) || 0,
        te_plan: parseFloat(String(m.te_plan)) || 0,
        tb_plan: parseFloat(String(m.tb_plan)) || 0
      }
    }
    
    cacheMetasBar[barId] = metas
    cacheTimestamp[barId] = agora
    console.log(`📊 [eventos-rules] Metas bar ${barId} carregadas do banco (server)`)
    return metas
  } catch (err) {
    console.error(`❌ [ERRO CONFIG] Erro ao buscar metas para bar ${barId}. Configure bar_metas_periodo.`, err)
    return METAS_ZERADAS
  }
}

/**
 * Obtém metas de forma síncrona (usa cache ou zeros)
 * AVISO: Retorna zeros se cache não populado - use fetchMetasBar para garantir dados
 */
function getMetasSincronas(barId: number): MetasPorDia {
  const cached = cacheMetasBar[barId]
  if (!cached) {
    console.warn(`⚠️ [eventos-rules] Cache vazio para bar ${barId}. Use fetchMetasBar para popular.`)
    return METAS_ZERADAS
  }
  return cached
}

// =====================================================
// REGRAS DE NEGÓCIO LEGADAS (compatibilidade)
// Uso: EVENTOS_RULES.MEDIA_M1_POR_DIA[diaSemana]
// Mantido para não quebrar código existente
// TODO: Migrar consumidores para usar getMetasBar()
// =====================================================
export const EVENTOS_RULES = {
  // Médias M1 por dia da semana (segunda = 0, domingo = 6)
  // LEGADO: usar getMetaM1Async para valores do banco
  MEDIA_M1_POR_DIA: {
    0: 0,         // Segunda - Fechado
    1: 0,         // Terça - Fechado
    2: 28000,     // Quarta
    3: 50000,     // Quinta
    4: 70000,     // Sexta
    5: 75000,     // Sábado
    6: 0          // Domingo - Fechado
  },

  // Ticket médio planejado por dia da semana
  // LEGADO: usar getTePlanAsync para valores do banco
  TE_PLAN_POR_DIA: {
    0: 0,         // Segunda
    1: 0,         // Terça
    2: 20.00,     // Quarta
    3: 21.00,     // Quinta
    4: 25.00,     // Sexta
    5: 28.00,     // Sábado
    6: 0          // Domingo
  },

  // Ticket bebida planejado por dia da semana
  // LEGADO: usar getTbPlanAsync para valores do banco
  TB_PLAN_POR_DIA: {
    0: 0,         // Segunda
    1: 0,         // Terça
    2: 75.00,     // Quarta
    3: 80.00,     // Quinta
    4: 85.00,     // Sexta
    5: 90.00,     // Sábado
    6: 0          // Domingo
  },

  // Categorias Nibo para custos
  // LEGADO: usar bar_categorias_custo para valores do banco
  NIBO_CATEGORIAS: {
    PRODUCAO_EVENTOS: 'Produção Eventos',
    ATRACOES_PROGRAMACAO: 'Atrações Programação'
  },

  // Padrões de data para busca na descrição
  DATA_PATTERNS: [
    /(\d{1,2})\/(\d{1,2})/,  // 13/07
    /(\d{1,2})\.(\d{1,2})/   // 13.07
  ]
}

// Função para obter dia da semana (0 = segunda, 6 = domingo)
export function getDiaSemana(data: Date): number {
  const dia = data.getDay()
  return dia === 0 ? 6 : dia - 1 // Converte domingo de 0 para 6
}

// =====================================================
// FUNÇÕES SÍNCRONAS (legado - usam fallback/cache)
// =====================================================

// Função para obter média M1 baseada na data (síncrona - usa fallback)
// ONDA 2B: barId agora é OBRIGATÓRIO para evitar uso implícito
export function getMediaM1(data: Date, barId: number): number {
  const diaSemana = getDiaSemana(data)
  const metas = getMetasSincronas(barId)
  return metas[diaSemana]?.meta_m1 || 0
}

// Função para obter ticket médio planejado baseado na data (síncrona)
// ONDA 2B: barId agora é OBRIGATÓRIO para evitar uso implícito
export function getTePlan(data: Date, barId: number): number {
  const diaSemana = getDiaSemana(data)
  const metas = getMetasSincronas(barId)
  return metas[diaSemana]?.te_plan || 0
}

// Função para obter ticket bebida planejado baseado na data (síncrona)
// ONDA 2B: barId agora é OBRIGATÓRIO para evitar uso implícito
export function getTbPlan(data: Date, barId: number): number {
  const diaSemana = getDiaSemana(data)
  const metas = getMetasSincronas(barId)
  return metas[diaSemana]?.tb_plan || 0
}

// =====================================================
// FUNÇÕES ASSÍNCRONAS (Onda 1 - buscam do banco)
// =====================================================

// Função para obter média M1 baseada na data (assíncrona - busca do banco)
export async function getMetaM1Async(data: Date, barId: number): Promise<number> {
  const diaSemana = getDiaSemana(data)
  const metas = await fetchMetasBar(barId)
  return metas[diaSemana]?.meta_m1 || 0
}

// Função para obter ticket entrada planejado (assíncrona)
export async function getTePlanAsync(data: Date, barId: number): Promise<number> {
  const diaSemana = getDiaSemana(data)
  const metas = await fetchMetasBar(barId)
  return metas[diaSemana]?.te_plan || 0
}

// Função para obter ticket bebida planejado (assíncrona)
export async function getTbPlanAsync(data: Date, barId: number): Promise<number> {
  const diaSemana = getDiaSemana(data)
  const metas = await fetchMetasBar(barId)
  return metas[diaSemana]?.tb_plan || 0
}

// Função para obter todas as metas de um dia (assíncrona)
export async function getMetasDiaAsync(data: Date, barId: number): Promise<MetasDia> {
  const diaSemana = getDiaSemana(data)
  const metas = await fetchMetasBar(barId)
  return metas[diaSemana] || { meta_m1: 0, te_plan: 0, tb_plan: 0 }
}

// =====================================================
// ONDA 2B: FUNÇÕES SERVER-SIDE (recebem supabase client)
// =====================================================

// Função para obter média M1 server-side (busca do banco via supabase)
export async function getMetaM1Server(supabase: any, data: Date, barId: number): Promise<number> {
  const diaSemana = getDiaSemana(data)
  const metas = await fetchMetasBarServer(supabase, barId)
  return metas[diaSemana]?.meta_m1 || 0
}

// Função para obter ticket entrada server-side
export async function getTePlanServer(supabase: any, data: Date, barId: number): Promise<number> {
  const diaSemana = getDiaSemana(data)
  const metas = await fetchMetasBarServer(supabase, barId)
  return metas[diaSemana]?.te_plan || 0
}

// Função para obter ticket bebida server-side
export async function getTbPlanServer(supabase: any, data: Date, barId: number): Promise<number> {
  const diaSemana = getDiaSemana(data)
  const metas = await fetchMetasBarServer(supabase, barId)
  return metas[diaSemana]?.tb_plan || 0
}

// Função para obter todas as metas de um dia server-side
export async function getMetasDiaServer(supabase: any, data: Date, barId: number): Promise<MetasDia> {
  const diaSemana = getDiaSemana(data)
  const metas = await fetchMetasBarServer(supabase, barId)
  return metas[diaSemana] || { meta_m1: 0, te_plan: 0, tb_plan: 0 }
}

// Função para extrair data da descrição
export function extrairDataDaDescricao(descricao: string): Date | null {
  for (const pattern of EVENTOS_RULES.DATA_PATTERNS) {
    const match = descricao.match(pattern)
    if (match) {
      const dia = parseInt(match[1])
      const mes = parseInt(match[2])
      
      // Assumindo ano atual
      const ano = new Date().getFullYear()
      const data = new Date(ano, mes - 1, dia)
      
      // Se a data já passou, assume próximo ano
      if (data < new Date()) {
        data.setFullYear(ano + 1)
      }
      
      return data
    }
  }
  return null
}

// Função para calcular percentual artista sobre faturamento
export function calcularPercentArtFat(custoArtistico: number, custoProducao: number, faturamentoReal: number): number {
  if (faturamentoReal <= 0) return 0
  
  // CORREÇÃO: Considerar apenas custo artístico (não produção) para o percentual
  // A produção faz parte dos custos operacionais, não do custo do artista sobre faturamento
  return (custoArtistico / faturamentoReal) * 100
}

// Interface para dados de custos do Nibo
export interface CustosNibo {
  custoArtistico: number
  custoProducao: number
}

// Função para buscar custos no Nibo
export async function buscarCustosNibo(dataEvento: Date, barId: number): Promise<CustosNibo> {
  // CORREÇÃO: Usar data_competencia em vez de buscar na descrição
  const dataCompetencia = dataEvento.toISOString().split('T')[0] // YYYY-MM-DD
  
  // Buscar custos de produção
  const custoProducao = await buscarCustosPorDataCompetencia(
    EVENTOS_RULES.NIBO_CATEGORIAS.PRODUCAO_EVENTOS,
    dataCompetencia,
    barId
  )
  
  // Buscar custos artísticos
  const custoArtistico = await buscarCustosPorDataCompetencia(
    EVENTOS_RULES.NIBO_CATEGORIAS.ATRACOES_PROGRAMACAO,
    dataCompetencia,
    barId
  )
  
  return {
    custoArtistico,
    custoProducao
  }
}

// Função auxiliar para buscar custos por data de competência
async function buscarCustosPorDataCompetencia(categoria: string, dataCompetencia: string, barId: number): Promise<number> {
  // Esta função será implementada na Edge Function
  // Por enquanto retorna 0
  return 0
} 