/**
 * 📊 OBSERVABILITY — Wrapper medallion-aware sobre _shared/heartbeat.ts
 *
 * Objetivo: padronizar instrumentação de edge functions para que
 * `gold.v_pipeline_health` consiga categorizar execuções por camada
 * medallion (bronze/silver/gold/consumo/ops).
 *
 * Design:
 *   - NÃO substitui heartbeat.ts — usa por baixo dos panos.
 *   - Adiciona `camada` como metadata em `response_summary` (JSONB)
 *     para cross-reference com `ops.job_camada_mapping`.
 *   - Não-bloqueante: falha de observability nunca quebra a função de negócio.
 *
 * Migração: `database/migrations/2026-04-23-observability-mapping.sql`
 * Docs: `docs/domains/observability.md`
 *
 * Uso típico:
 *
 *     import { trackRun } from '../_shared/observability.ts';
 *
 *     Deno.serve(async (req) => {
 *       const supabase = createClient(...);
 *       const { bar_id } = await req.json();
 *
 *       return await trackRun(supabase, {
 *         camada: 'bronze',
 *         jobName: 'contahub-sync-automatico',
 *         barId: bar_id,
 *       }, async () => {
 *         const rows = await doSync();
 *         return {
 *           rowsAffected: rows.length,
 *           response: new Response(JSON.stringify({ ok: true })),
 *         };
 *       });
 *     });
 *
 * @version 1.0.0
 * @date 2026-04-23
 */

import {
  heartbeatStart,
  heartbeatEnd,
  heartbeatError,
} from './heartbeat.ts';

export type Camada = 'bronze' | 'silver' | 'gold' | 'consumo' | 'ops';

export interface TrackRunOptions {
  /** Camada medallion da execução. Usada pelo health check. */
  camada: Camada;
  /** Nome canônico do job. Deve existir em `ops.job_camada_mapping`. */
  jobName: string;
  /** Bar sendo processado (obrigatório quando aplicável). */
  barId?: number | null;
  /** Ação específica (ex: `sync`, `backfill`, `recalculo`). */
  action?: string;
  /** Origem da execução. */
  triggeredBy?: 'pgcron' | 'manual' | 'api' | 'webhook';
  /** Metadata extra para `response_summary`. */
  metadata?: Record<string, unknown>;
}

export interface TrackRunResult<T> {
  /** Resultado da função de negócio. */
  result: T;
  /** Quantidade de registros afetados (alimenta `records_affected`). */
  rowsAffected?: number;
  /** Dados extras para o heartbeat. */
  summary?: Record<string, unknown>;
}

/**
 * Envelopa uma execução de edge function, registrando heartbeat start/end
 * com semântica medallion (`camada`). Re-lança erros após registrar.
 *
 * Observability é best-effort: se heartbeat falhar, a função de negócio
 * continua. Isso é por design.
 */
export async function trackRun<T>(
  supabase: any,
  options: TrackRunOptions,
  fn: () => Promise<TrackRunResult<T>>
): Promise<T> {
  const { camada, jobName, barId, action, triggeredBy, metadata } = options;

  const hb = await heartbeatStart(
    supabase,
    jobName,
    barId ?? null,
    action ?? null,
    triggeredBy ?? 'pgcron'
  );

  try {
    const { result, rowsAffected, summary } = await fn();

    await heartbeatEnd(
      supabase,
      hb.heartbeatId,
      'success',
      hb.startTime,
      rowsAffected ?? 0,
      {
        camada,
        ...(metadata ?? {}),
        ...(summary ?? {}),
      },
      undefined,
      jobName,
      barId ?? null
    );

    return result;
  } catch (err: any) {
    await heartbeatError(
      supabase,
      hb.heartbeatId,
      hb.startTime,
      err instanceof Error ? err : new Error(String(err)),
      {
        camada,
        ...(metadata ?? {}),
      },
      jobName,
      barId ?? null
    );
    throw err;
  }
}

/**
 * Variante para funções que retornam `Response` diretamente.
 * Uso quando o retorno da função de negócio JÁ é o Response.
 */
export async function trackResponse(
  supabase: any,
  options: TrackRunOptions,
  fn: () => Promise<{ response: Response; rowsAffected?: number; summary?: Record<string, unknown> }>
): Promise<Response> {
  return trackRun(supabase, options, async () => {
    const { response, rowsAffected, summary } = await fn();
    return { result: response, rowsAffected, summary };
  });
}
