/**
 * 🔔 DISPATCHER - SISTEMA DE ALERTAS UNIFICADO
 * 
 * Edge Function unificada para todas as operações de alertas e notificações.
 * 
 * Actions disponíveis:
 * - discord: Enviar alerta para Discord (antes: alertas-discord)
 * - proativos: Verificar e enviar alertas proativos (antes: alertas-proativos)
 * - inteligentes: Alertas inteligentes baseados em padrões (antes: alertas-inteligentes)
 * - notification: Notificação simples (antes: discord-notification)
 * 
 * @version 2.0.0
 * @date 2026-02-10
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleCorsOptions, jsonResponse, errorResponse } from '../_shared/cors.ts'

// Mapeamento de actions para URLs das funções originais
const ACTION_URLS: Record<string, string> = {
  'discord': '/functions/v1/alertas-discord',
  'proativos': '/functions/v1/alertas-proativos',
  'inteligentes': '/functions/v1/alertas-inteligentes',
  'notification': '/functions/v1/discord-notification'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsOptions()
  }
  
  try {
    const body = await req.json().catch(() => ({}))
    const { action, ...params } = body
    
    console.log(`🔔 Alertas Unified - Action: ${action || 'não especificada'}`)
    
    if (!action || !ACTION_URLS[action]) {
      return errorResponse(
        `Action inválida: ${action}. Use: discord, proativos, inteligentes, notification`,
        null,
        400
      )
    }
    
    // Redirecionar para a função original
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
