/**
 * @camada gold
 * @jobName sync-faturamento-hora
 * @descricao Popula gold.faturamento_hora
 *
 * Classificacao medallion mantida em ops.job_camada_mapping (ver
 * database/migrations/2026-04-23-observability-mapping.sql). Observability
 * via _shared/heartbeat.ts ou _shared/observability.ts.
 */
/**
 * Edge Function: sync-faturamento-hora
 * 
 * Sincroniza dados de bronze_contahub_operacional_fatporhora para a tabela de domínio faturamento_hora
 * 
 * Problema resolvido: Dados de faturamento por hora estavam incorretos (concentrados na hora 0)
 * Solução: Sincronizar periodicamente de bronze_contahub_operacional_fatporhora
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { trackResponse } from '../_shared/observability.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  bar_id?: number;
  data_inicio?: string;
  data_fim?: string;
  force?: boolean; // Se true, deleta e reinsere tudo
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: SyncRequest = await req.json().catch(() => ({}));
    const { bar_id, data_inicio, data_fim, force = false } = body;

    console.log('🔄 Iniciando sincronização de faturamento_hora', {
      bar_id,
      data_inicio,
      data_fim,
      force
    });

    // 📊 Observability — camada='gold' (popula gold.faturamento_hora)
    return await trackResponse(supabase, {
      camada: 'gold',
      jobName: 'sync-faturamento-hora',
      barId: bar_id ?? null,
      action: force ? 'full_refresh' : 'incremental_sync',
      triggeredBy: req.headers.get('x-triggered-by') === 'pgcron' ? 'pgcron' : 'api',
      metadata: { data_inicio, data_fim, force },
    }, async () => {

    // Se não especificar datas, usar últimos 7 dias
    const dataFimDefault = new Date().toISOString().split('T')[0];
    const dataInicioDefault = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const dataInicioFinal = data_inicio || dataInicioDefault;
    const dataFimFinal = data_fim || dataFimDefault;

    // Construir filtros
    let whereClause = `vd_dtgerencial BETWEEN '${dataInicioFinal}' AND '${dataFimFinal}'`;
    if (bar_id) {
      whereClause += ` AND bar_id = ${bar_id}`;
    }

    // 1. Se force=true, deletar dados existentes
    if (force) {
      console.log('🗑️  Deletando dados existentes...');
      let deleteQuery = `data_venda BETWEEN '${dataInicioFinal}' AND '${dataFimFinal}'`;
      if (bar_id) {
        deleteQuery += ` AND bar_id = ${bar_id}`;
      }

      const { error: deleteError } = await supabase
        .from('faturamento_hora')
        .delete()
        .or(deleteQuery);

      if (deleteError) {
        throw new Error(`Erro ao deletar: ${deleteError.message}`);
      }
      console.log('✅ Dados deletados');
    }

    // 2. Buscar dados de bronze_contahub_avendas_vendasdiahoraanalitico
    console.log('📊 Buscando dados de bronze_contahub_avendas_vendasdiahoraanalitico...');
    
    const { data: dadosContaHub, error: errorContaHub } = await supabase
      .schema('bronze')
      .from('bronze_contahub_avendas_vendasdiahoraanalitico')
      .select('bar_id, vd_dtgerencial, hora, valor')
      .gte('vd_dtgerencial', dataInicioFinal)
      .lte('vd_dtgerencial', dataFimFinal)
      .order('vd_dtgerencial', { ascending: true })
      .order('hora', { ascending: true });

    if (errorContaHub) {
      throw new Error(`Erro ao buscar dados: ${errorContaHub.message}`);
    }

    if (!dadosContaHub || dadosContaHub.length === 0) {
      const emptyResponse = new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum dado encontrado para sincronizar',
          periodo: { data_inicio: dataInicioFinal, data_fim: dataFimFinal }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      return { response: emptyResponse, rowsAffected: 0, summary: { empty: true } };
    }

    console.log(`📊 Encontrados ${dadosContaHub.length} registros`);

    // 3. Agrupar por bar_id, data_venda e hora
    const dadosAgrupados = new Map<string, {
      bar_id: number;
      data_venda: string;
      hora: number;
      valor: number;
      quantidade: number;
    }>();

    for (const row of dadosContaHub) {
      const key = `${row.bar_id}-${row.vd_dtgerencial}-${row.hora}`;
      
      if (!dadosAgrupados.has(key)) {
        dadosAgrupados.set(key, {
          bar_id: row.bar_id,
          data_venda: row.vd_dtgerencial,
          hora: row.hora,
          valor: 0,
          quantidade: 0
        });
      }

      const item = dadosAgrupados.get(key)!;
      item.valor += parseFloat(String(row.valor || 0));
      item.quantidade += 1;
    }

    const dadosParaInserir = Array.from(dadosAgrupados.values());
    console.log(`📊 Total de registros agrupados: ${dadosParaInserir.length}`);

    // 4. Inserir ou atualizar em lotes
    const batchSize = 1000;
    let totalInserido = 0;
    let totalErros = 0;

    for (let i = 0; i < dadosParaInserir.length; i += batchSize) {
      const batch = dadosParaInserir.slice(i, i + batchSize);
      
      // Usar upsert para evitar duplicatas
      const { error: errorInsert } = await supabase
        .from('faturamento_hora')
        .upsert(batch, {
          onConflict: 'bar_id,data_venda,hora',
          ignoreDuplicates: false
        });

      if (errorInsert) {
        console.error(`❌ Erro no lote ${Math.floor(i / batchSize) + 1}:`, errorInsert);
        totalErros++;
      } else {
        totalInserido += batch.length;
        console.log(`✅ Lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(dadosParaInserir.length / batchSize)} inserido`);
      }
    }

    const successResponse = new Response(
      JSON.stringify({
        success: true,
        message: `Sincronização concluída: ${totalInserido} registros inseridos/atualizados`,
        periodo: {
          data_inicio: dataInicioFinal,
          data_fim: dataFimFinal
        },
        estatisticas: {
          total_registros_origem: dadosContaHub.length,
          total_agrupado: dadosParaInserir.length,
          total_inserido: totalInserido,
          total_erros: totalErros
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

    return {
      response: successResponse,
      rowsAffected: totalInserido,
      summary: {
        total_registros_origem: dadosContaHub.length,
        total_agrupado: dadosParaInserir.length,
        total_erros: totalErros,
      },
    };
    }); // fim trackResponse

  } catch (error) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
