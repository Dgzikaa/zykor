/**
 * 📊 DISPATCHER - SINCRONIZAÇÃO CONTAHUB
 * 
 * Edge Function unificada para todas as operações ContaHub.
 * Este dispatcher roteia para a action correta e mantém compatibilidade
 * com os crons existentes.
 * 
 * Actions disponíveis:
 * - sync: Sincronização diária automática (antes: contahub-sync-automatico)
 * - process: Processamento de dados raw (antes: contahub-processor)
 * - stockout: Sincronização de rupturas (antes: contahub-stockout-sync)
 * - prodporhora: Produtividade por hora (antes: contahub-prodporhora)
 * - retroativo: Sincronização retroativa (antes: contahub-sync-retroativo)
 * 
 * NOTA: Este é um DISPATCHER que importa e chama as funções existentes.
 * Mantém a separação de código por complexidade e facilidade de manutenção.
 * 
 * @version 2.0.0
 * @date 2026-02-10
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleCorsOptions, jsonResponse, errorResponse } from '../_shared/cors.ts'

// Mapeamento de actions para URLs das funções originais
// Isso permite migração gradual - podemos mover a lógica para cá depois
const ACTION_URLS: Record<string, string> = {
  'sync': '/functions/v1/contahub-sync-automatico',
  'process': '/functions/v1/contahub-processor',
  'stockout': '/functions/v1/contahub-stockout-sync',
  'prodporhora': '/functions/v1/contahub-prodporhora',
  'retroativo': '/functions/v1/contahub-sync-retroativo'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsOptions()
  }
  
  try {
    const body = await req.json().catch(() => ({}))
    const { action, ...params } = body
    
    console.log(`📊 ContaHub Sync Dispatcher - Action: ${action || 'não especificada'}`)
    
    if (!action || !ACTION_URLS[action]) {
      return errorResponse(
        `Action inválida: ${action}. Use: sync, process, stockout, prodporhora, retroativo`,
        null,
        400
      )
    }
    
    // Redirecionar para a função original via HTTP interno
    // Isso mantém compatibilidade enquanto consolida os endpoints
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    
    const targetUrl = `${supabaseUrl}${ACTION_URLS[action]}`
    
    console.log(`🔄 Redirecionando para: ${targetUrl}`)
    
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`
      },
      body: JSON.stringify(params)
    })
    
    const result = await response.json()
    
    return jsonResponse({
      success: response.ok,
      action,
      dispatched_to: ACTION_URLS[action],
      result,
      timestamp: new Date().toISOString()
    }, response.status)
    
  } catch (error: any) {
    console.error('❌ Erro no dispatcher:', error)
    return errorResponse(error.message, error)
  }
})
