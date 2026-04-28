/**
 * Módulo centralizado para obter o fator CMV de consumo por bar
 * 
 * ONDA 2B: Centralização completa - todas as implementações locais
 * devem usar este módulo único.
 * 
 * Fonte: bar_regras_negocio.cmv_fator_consumo
 * SEM FALLBACK: Se não configurado, throw Error
 */

// Cache in-memory por barId com TTL
interface CacheEntry {
  valor: number
  timestamp: number
}

const cache: Record<number, CacheEntry> = {}
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutos

/**
 * Obtém o fator CMV de consumo para um bar específico
 * 
 * @param supabase - Cliente Supabase (service role ou admin)
 * @param barId - ID do bar
 * @returns Fator CMV (ex: 0.35 = 35%)
 * @throws Error se fator não encontrado ou inválido (configuração ausente)
 * 
 * Comportamento:
 * 1. Verifica cache (TTL 5 min)
 * 2. Busca do banco bar_regras_negocio
 * 3. Valida se fator > 0
 * 4. ERRO se não encontrado - configurar bar_regras_negocio
 */
export async function getFatorCmv(supabase: any, barId: number): Promise<number> {
  const agora = Date.now()
  
  // Cache hit válido
  const cached = cache[barId]
  if (cached && (agora - cached.timestamp) < CACHE_TTL_MS) {
    return cached.valor
  }
  
  // bar_regras_negocio vive em `operations` após a migração medallion.
  // PostgREST não respeita search_path, então é obrigatório passar `.schema()`.
  const { data, error } = await supabase
    .schema('operations')
    .from('bar_regras_negocio')
    .select('cmv_fator_consumo')
    .eq('bar_id', barId)
    .single()
  
  if (error || !data) {
    console.error(`❌ [ERRO CONFIG] cmv_fator_consumo não encontrado para bar ${barId}. Configure bar_regras_negocio.`)
    throw new Error(`Configuração ausente: cmv_fator_consumo para bar ${barId}. Configure bar_regras_negocio.`)
  }
  
  const fatorBruto = parseFloat(String(data.cmv_fator_consumo))
  
  // Guard: não cachear nem retornar fator inválido (<=0)
  if (fatorBruto <= 0 || isNaN(fatorBruto)) {
    console.error(`❌ [ERRO CONFIG] cmv_fator_consumo inválido (${fatorBruto}) para bar ${barId}. Corrija bar_regras_negocio.`)
    throw new Error(`Configuração inválida: cmv_fator_consumo=${fatorBruto} para bar ${barId}. Corrija bar_regras_negocio.`)
  }
  
  console.log(`📊 [CMV] Fator consumo bar ${barId}: ${fatorBruto} (banco)`)
  cache[barId] = { valor: fatorBruto, timestamp: agora }
  return fatorBruto
}

/**
 * Divisão segura usando o fator CMV
 * Protege contra divisão por zero - retorna 0 se divisor inválido
 * 
 * @param valor - Valor a dividir
 * @param divisor - Divisor (fator CMV)
 * @returns Resultado da divisão ou 0 se divisor <= 0
 */
export function safeDivideCmv(
  valor: number, 
  divisor: number
): number {
  if (divisor <= 0) {
    console.warn(`⚠️ [CMV] safeDivideCmv: divisor inválido (${divisor}), retornando 0`)
    return 0
  }
  return valor / divisor
}

/**
 * Limpa o cache (útil para testes)
 */
export function clearFatorCmvCache(): void {
  Object.keys(cache).forEach(key => delete cache[Number(key)])
}
