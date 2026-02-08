/**
 * Edge Function: Cron Job para Sincronizar Orçamentação
 * 
 * Roda diariamente às 6h da manhã (horário de Brasília)
 * Chama a função sync-orcamentacao-sheets para atualizar os dados
 * 
 * Configurar no Supabase Dashboard:
 * Schedule: 0 9 * * * (9h UTC = 6h BRT)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const inicio = Date.now();
  console.log(`🕐 Cron Sync Orçamentação iniciando em ${new Date().toISOString()}`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Determinar ano atual
    const anoAtual = new Date().getFullYear();

    // Chamar a função de sync via HTTP
    const syncUrl = `${supabaseUrl}/functions/v1/sync-orcamentacao-sheets`;
    
    console.log(`📡 Chamando sync-orcamentacao-sheets...`);
    
    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ano: anoAtual
      })
    });

    const resultado = await response.json();
    
    const duracao = Date.now() - inicio;
    console.log(`✅ Sync concluído em ${duracao}ms`);

    // Registrar execução do cron
    await supabase
      .from('cron_executions')
      .insert({
        function_name: 'sync-orcamentacao-cron',
        status: resultado.success ? 'success' : 'error',
        duration_ms: duracao,
        details: resultado,
        executed_at: new Date().toISOString()
      })
      .catch(() => {}); // Ignora erro se tabela não existir

    // Enviar notificação Discord se houver erros
    if (resultado.resultados_por_bar) {
      const erros = resultado.resultados_por_bar.filter((r: any) => !r.success);
      if (erros.length > 0) {
        console.log(`⚠️ ${erros.length} bar(es) com erro no sync`);
        
        // Tentar enviar alerta via Discord
        try {
          const discordUrl = `${supabaseUrl}/functions/v1/discord-notification`;
          await fetch(discordUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              channel: 'alertas',
              message: `⚠️ **Sync Orçamentação** - ${erros.length} bar(es) com erro:\n${erros.map((e: any) => `• ${e.bar_nome}: ${e.error}`).join('\n')}`
            })
          }).catch(() => {});
        } catch (e) {
          // Ignora erro de Discord
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cron sync orçamentação executado',
        duracao_ms: duracao,
        resultado
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro no cron:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        duracao_ms: Date.now() - inicio
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
