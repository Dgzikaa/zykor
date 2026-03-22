import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * API de Recálculo Diário de Desempenho
 * 
 * Esta API deve ser chamada diariamente após as sincronizações de dados (~08h)
 * para atualizar os indicadores de desempenho com os dados mais recentes.
 * 
 * Recalcula a semana atual e a anterior para garantir dados atualizados.
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl) {
      throw new Error('URL do Supabase não configurada');
    }

    // Chamar a Edge Function de automação semanal (que agora pode ser usada diariamente)
    const response = await fetch(
      `${supabaseUrl}/functions/v1/desempenho-semanal-auto`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trigger_source: 'recalculo_diario',
          timestamp: new Date().toISOString(),
        }),
      }
    );

    const resultados: {
      desempenho?: any;
      falae_reconciliacao?: {
        total_bares: number;
        sucesso: number;
        resultados: Array<{ bar_id: number; success: boolean; status?: number; error?: string }>;
      };
    } = {};

    if (response.ok) {
      const result = await response.json();
      resultados.desempenho = result;

      // Etapa extra: reconciliar Falaê (hoje até D-7) para garantir consistência além do webhook
      try {
        const supabase = await getAdminClient();
        const { data: barsRows, error: barsError } = await supabase
          .from('api_credentials')
          .select('bar_id')
          .eq('sistema', 'falae')
          .eq('ativo', true)
          .not('bar_id', 'is', null);

        if (barsError) {
          resultados.falae_reconciliacao = { total_bares: 0, sucesso: 0, resultados: [] };
        } else {
          const barIds = Array.from(
            new Set((barsRows || []).map((row: any) => Number(row.bar_id)).filter((id) => Number.isFinite(id) && id > 0))
          );
          const falaeResultados: Array<{ bar_id: number; success: boolean; status?: number; error?: string }> = [];

          for (const barId of barIds) {
            try {
              const syncResp = await fetch(`${request.nextUrl.origin}/api/falae/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bar_id: barId, days_back: 7 }),
                cache: 'no-store',
              });
              const payload = await syncResp.json().catch(() => ({}));
              falaeResultados.push({
                bar_id: barId,
                success: syncResp.ok,
                status: syncResp.status,
                error: syncResp.ok ? undefined : (payload?.error || 'Erro no sync Falaê'),
              });
            } catch (err) {
              falaeResultados.push({
                bar_id: barId,
                success: false,
                error: err instanceof Error ? err.message : 'Erro desconhecido',
              });
            }
          }

          resultados.falae_reconciliacao = {
            total_bares: barIds.length,
            sucesso: falaeResultados.filter((r) => r.success).length,
            resultados: falaeResultados,
          };
        }
      } catch {
      }

      return NextResponse.json({
        success: true,
        message: 'Recálculo diário de desempenho concluído',
        result: resultados,
        timestamp: new Date().toISOString(),
      });
    } else {
      const errorText = await response.text();
      console.error('❌ Erro no recálculo diário:', response.status, errorText);

      return NextResponse.json(
        {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
          timestamp: new Date().toISOString(),
        },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('❌ Erro no recálculo diário:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
