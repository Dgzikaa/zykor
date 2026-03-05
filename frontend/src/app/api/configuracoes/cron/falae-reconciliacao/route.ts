import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

type SyncResult = {
  bar_id: number;
  success: boolean;
  status?: number;
  error?: string;
  payload?: unknown;
};

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await getAdminClient();
    const { data: barsRows, error: barsError } = await supabase
      .from('api_credentials')
      .select('bar_id')
      .eq('sistema', 'falae')
      .eq('ativo', true)
      .not('bar_id', 'is', null);

    if (barsError) {
      return NextResponse.json(
        { success: false, error: 'Erro ao buscar bares com Falaê ativo', details: barsError.message },
        { status: 500 }
      );
    }

    const barIds = Array.from(
      new Set((barsRows || []).map((row: any) => Number(row.bar_id)).filter((id) => Number.isFinite(id) && id > 0))
    );

    if (barIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum bar com credencial Falaê ativa para reconciliar',
        total_bares: 0,
        resultados: [],
      });
    }

    const origin = request.nextUrl.origin;
    const resultados: SyncResult[] = [];

    for (const barId of barIds) {
      try {
        const response = await fetch(`${origin}/api/falae/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bar_id: barId,
            days_back: 7,
          }),
          cache: 'no-store',
        });

        const payload = await response.json().catch(() => ({}));
        resultados.push({
          bar_id: barId,
          success: response.ok,
          status: response.status,
          error: response.ok ? undefined : (payload?.error || 'Erro no sync'),
          payload,
        });
      } catch (err) {
        resultados.push({
          bar_id: barId,
          success: false,
          error: err instanceof Error ? err.message : 'Erro desconhecido',
        });
      }
    }

    const sucesso = resultados.filter((r) => r.success).length;

    return NextResponse.json({
      success: sucesso > 0,
      message: `Reconciliação Falaê concluída (${sucesso}/${barIds.length} bares)`,
      periodo: 'hoje até D-7',
      total_bares: barIds.length,
      resultados,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

