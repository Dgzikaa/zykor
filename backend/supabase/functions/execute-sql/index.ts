/**
 * 🔧 EXECUTE SQL - Executa queries SQL no banco
 * Usado para criar cron jobs e outras operações administrativas
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

interface SQLRequest {
  sql: string
  params?: any[]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    const body: SQLRequest = await req.json()
    const { sql, params = [] } = body

    console.log('🔧 Executando SQL:', sql.substring(0, 100) + '...')

    // Executar SQL usando rpc
    const { data, error } = await supabase.rpc('exec_sql', { 
      query: sql 
    })

    if (error) {
      console.error('❌ Erro ao executar SQL:', error)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message,
          details: error 
        }),
        { 
          status: 500, 
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ SQL executado com sucesso')

    return new Response(
      JSON.stringify({
        success: true,
        data: data,
        message: 'SQL executado com sucesso'
      }),
      { 
        status: 200, 
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: any) {
    console.error('❌ Erro:', error.message)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } 
      }
    )
  }
})
