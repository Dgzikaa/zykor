/**
 * @camada gold
 * @jobName sync-cliente-perfil-consumo
 * @descricao Popula gold.cliente_perfil_consumo
 *
 * Classificacao medallion mantida em ops.job_camada_mapping (ver
 * database/migrations/2026-04-23-observability-mapping.sql). Observability
 * via _shared/heartbeat.ts ou _shared/observability.ts.
 */
/**
 * 👤 Sync Cliente Perfil Consumo (thin wrapper)
 *
 * Reconstrói a tabela `cliente_perfil_consumo` com perfis agregados por
 * telefone. A lógica de agregação vive agora em uma SQL function/plpgsql
 * (`public.sync_cliente_perfil_consumo(bar_id, chunk_count, chunk_index)`),
 * que processa em chunks e usa DELETE + INSERT por chunk para contornar
 * o timeout default do Postgres e a escala do bar 3 (~95k telefones
 * distintos × ~600k vendas_item).
 *
 * Esta edge function é apenas um thin wrapper que expõe o RPC via HTTP
 * para quem precisar disparar manualmente (ex. painel admin). O sync
 * diário real é agendado via pg_cron (worker `daily_perfil_consumo_worker`).
 *
 * Request body:
 *   { "bar_id": 3 }                                  // processa todos os chunks para o bar
 *   { "bar_id": 3, "chunk_count": 10, "chunk_index": 0 }  // processa 1 chunk específico
 *   { "all": true }                                  // processa todos os bares ativos
 *
 * @version 2.0.0
 * @date 2026-04-11
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { heartbeatStart, heartbeatEnd, heartbeatError } from '../_shared/heartbeat.ts';
import { requireAuth } from '../_shared/auth-guard.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

interface ChunkResult {
  out_bar_id: number;
  out_chunk_index: number;
  out_chunk_count: number;
  out_clientes_inseridos: number;
  out_tempo_ms: number;
}

interface RequestBody {
  bar_id?: number;
  chunk_count?: number;
  chunk_index?: number;
  all?: boolean;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authError = requireAuth(req);
  if (authError) return authError;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let heartbeatId: number | null = null;
  let startTime: number = Date.now();

  try {
    const body: RequestBody = await req.json().catch(() => ({}));

    const hbResult = await heartbeatStart(
      supabase,
      'sync-cliente-perfil-consumo',
      body.bar_id ?? null,
      body.all ? 'all' : body.chunk_count ? `chunk_${body.chunk_index}/${body.chunk_count}` : 'full',
      'manual',
    );
    heartbeatId = hbResult.heartbeatId;
    startTime = hbResult.startTime;

    // Descobrir lista de bares a processar
    let barIds: number[] = [];
    if (body.all) {
      const { data: bares, error } = await supabase
        .from('bares')
        .select('id')
        .eq('ativo', true)
        .order('id');
      if (error) throw error;
      barIds = (bares ?? []).map((b) => b.id as number);
    } else if (body.bar_id) {
      barIds = [body.bar_id];
    } else {
      await heartbeatEnd(supabase, heartbeatId, 'error', startTime, 0, { error: 'bar_id_obrigatorio' });
      return new Response(
        JSON.stringify({ success: false, error: 'bar_id ou all:true é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const results: ChunkResult[] = [];
    let totalClientes = 0;

    for (const barId of barIds) {
      const chunkCount = body.chunk_count ?? 1;

      if (body.chunk_count !== undefined && body.chunk_index !== undefined) {
        // Processa apenas 1 chunk específico
        const { data, error } = await supabase.rpc('sync_cliente_perfil_consumo', {
          p_bar_id: barId,
          p_chunk_count: chunkCount,
          p_chunk_index: body.chunk_index,
        });
        if (error) throw error;
        const rows = (data ?? []) as ChunkResult[];
        results.push(...rows);
        totalClientes += rows.reduce((acc, r) => acc + (r.out_clientes_inseridos ?? 0), 0);
      } else {
        // Processa todos os chunks do bar (1 única chamada = 1 chunk quando chunk_count=1)
        const { data, error } = await supabase.rpc('sync_cliente_perfil_consumo', {
          p_bar_id: barId,
          p_chunk_count: 1,
          p_chunk_index: 0,
        });
        if (error) throw error;
        const rows = (data ?? []) as ChunkResult[];
        results.push(...rows);
        totalClientes += rows.reduce((acc, r) => acc + (r.out_clientes_inseridos ?? 0), 0);
      }
    }

    await heartbeatEnd(
      supabase,
      heartbeatId,
      'success',
      startTime,
      totalClientes,
      { bares: barIds, results },
    );

    return new Response(
      JSON.stringify({
        success: true,
        total_clientes: totalClientes,
        results,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('❌ Erro em sync-cliente-perfil-consumo:', error);
    await heartbeatError(
      supabase,
      heartbeatId,
      startTime,
      error instanceof Error ? error : String(error),
    );
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
