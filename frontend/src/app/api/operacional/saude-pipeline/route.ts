/**
 * Saúde do Pipeline — endpoint de consumo.
 *
 * Lê de `gold.v_pipeline_health_completo` (view que une):
 *   - matview gold.v_pipeline_health (edge functions com heartbeat)
 *   - watchdog universal de data freshness por tabela bronze
 *     (criado 2026-05-11 — cobre Apify, Umbler, Sympla, Yuzer, Inter,
 *     que não tinham heartbeat e ficavam silenciosamente quebrados)
 *
 * Ver docs/domains/observability.md.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export type Camada = 'bronze' | 'silver' | 'gold' | 'consumo' | 'ops';
export type HealthColor = 'green' | 'yellow' | 'red' | 'gray';

export interface PipelineJobHealth {
  camada: Camada;
  kind: string;
  job_name: string;
  bar_id: number | null;
  ultima_execucao: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  status: string | null;
  records_affected: number | null;
  error_message: string | null;
  idade: string | null;
  health_color: HealthColor;
  descricao: string | null;
}

export interface CamadaResumo {
  camada: Camada;
  total: number;
  verde: number;
  amarelo: number;
  vermelho: number;
  cinza: number;
  health_color: HealthColor;
  ultima_execucao: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barIdRaw = searchParams.get('bar_id');

    if (!barIdRaw) {
      return NextResponse.json(
        { success: false, error: 'Parâmetro bar_id é obrigatório' },
        { status: 400 }
      );
    }

    const barId = Number(barIdRaw);
    if (!Number.isFinite(barId) || barId <= 0) {
      return NextResponse.json(
        { success: false, error: 'bar_id inválido' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Lê a view materializada. Um job sem bar_id (bar_id IS NULL) é
    // compartilhado entre bares — mostra para todos.
    const { data, error } = await supabase
      .from('v_pipeline_health_completo')
      .select('*')
      .or(`bar_id.is.null,bar_id.eq.${barId}`)
      .order('camada', { ascending: true })
      .order('ultima_execucao', { ascending: false });

    if (error) {
      console.error('❌ Erro ao ler gold.v_pipeline_health:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Erro ao carregar saúde do pipeline',
          details: error.message,
        },
        { status: 500 }
      );
    }

    const jobs = (data ?? []) as PipelineJobHealth[];

    // Agregação por camada pros cards grandes do topo.
    const ordemCamadas: Camada[] = ['bronze', 'silver', 'gold', 'consumo', 'ops'];
    const resumoPorCamada: CamadaResumo[] = ordemCamadas.map((camada) => {
      const doCamada = jobs.filter((j) => j.camada === camada);
      const verde = doCamada.filter((j) => j.health_color === 'green').length;
      const amarelo = doCamada.filter((j) => j.health_color === 'yellow').length;
      const vermelho = doCamada.filter((j) => j.health_color === 'red').length;
      const cinza = doCamada.filter((j) => j.health_color === 'gray').length;

      // A cor agregada é a pior das cores presentes.
      const healthColor: HealthColor =
        vermelho > 0 ? 'red'
        : amarelo > 0 ? 'yellow'
        : verde > 0 ? 'green'
        : 'gray';

      const ultimaExecucao = doCamada
        .map((j) => j.ultima_execucao)
        .filter((v): v is string => Boolean(v))
        .sort()
        .reverse()[0] ?? null;

      return {
        camada,
        total: doCamada.length,
        verde,
        amarelo,
        vermelho,
        cinza,
        health_color: healthColor,
        ultima_execucao: ultimaExecucao,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        resumo: resumoPorCamada,
        jobs,
        refreshed_at: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    console.error('❌ Erro na API saude-pipeline:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
        details: err instanceof Error ? err.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/operacional/saude-pipeline — força refresh da materialized view.
 * Restrito via SERVICE_ROLE_KEY do server. Só admins deveriam bater aqui
 * (o middleware de auth cuida). Uso esperado: botão "Atualizar agora" na tela.
 */
export async function POST() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // REFRESH MATERIALIZED VIEW CONCURRENTLY precisa de unique index,
    // que já existe (uq_v_pipeline_health).
    const { error } = await supabase.rpc('refresh_v_pipeline_health');

    if (error) {
      // RPC pode não existir ainda — tentar fallback via SQL direto não é
      // possível pelo client. Retorna aviso para usuário.
      return NextResponse.json({
        success: false,
        error: 'Refresh manual requer função refresh_v_pipeline_health. Aguarde próximo ciclo do cron (*/5min).',
        details: error.message,
      }, { status: 501 });
    }

    return NextResponse.json({ success: true, refreshed_at: new Date().toISOString() });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: 'Erro no refresh',
        details: err instanceof Error ? err.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
