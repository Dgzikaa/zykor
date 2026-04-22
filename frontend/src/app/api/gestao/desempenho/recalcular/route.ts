import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * REFATORADO - Recálculo via Gold ETL
 * 
 * Substitui recálculo em JavaScript (500 linhas) por chamada direta
 * ao ETL gold.desempenho (function: etl_gold_desempenho_semanal).
 * 
 * Performance: ETL ~200ms/semana vs ~5s JS
 * Consistência: Usa mesma lógica do cron diário (09:00 BRT)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { semana_id, recalcular_todas = false } = body;
    
    const barIdHeader = request.headers.get('x-selected-bar-id');
    const barId = barIdHeader ? parseInt(barIdHeader, 10) : null;

    if (!barId) {
      return NextResponse.json(
        { success: false, error: 'Bar não selecionado' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Erro ao conectar ao banco' },
        { status: 500 }
      );
    }

    let semanasParaRecalcular: { ano: number; numero_semana: number }[] = [];

    if (recalcular_todas) {
      // Buscar todas as semanas do bar de gold.desempenho
      const { data: semanas, error } = await (supabase as any)
        .schema('gold')
        .from('desempenho')
        .select('ano, numero_semana')
        .eq('bar_id', barId)
        .eq('granularidade', 'semanal')
        .order('ano', { ascending: true })
        .order('numero_semana', { ascending: true });

      if (error) {
        console.error('Erro ao buscar semanas:', error);
        return NextResponse.json(
          { success: false, error: 'Erro ao buscar semanas' },
          { status: 500 }
        );
      }

      semanasParaRecalcular = semanas || [];
    } else if (semana_id) {
      // Buscar apenas a semana específica
      const { data: semana, error } = await (supabase as any)
        .schema('gold')
        .from('desempenho')
        .select('ano, numero_semana')
        .eq('bar_id', barId)
        .eq('granularidade', 'semanal')
        .eq('id', semana_id)
        .single();

      if (error) {
        console.error('Erro ao buscar semana:', error);
        return NextResponse.json(
          { success: false, error: 'Semana não encontrada' },
          { status: 404 }
        );
      }

      semanasParaRecalcular = [semana];
    } else {
      return NextResponse.json(
        { success: false, error: 'Informe semana_id ou recalcular_todas=true' },
        { status: 400 }
      );
    }

    // Recalcular cada semana via ETL Gold
    const resultados: Array<{
      semana: number;
      ano: number;
      sucesso: boolean;
      duracao_ms?: number;
      erro?: string;
    }> = [];
    for (const semana of semanasParaRecalcular) {
      try {
        const { data, error } = await supabase.rpc('etl_gold_desempenho_semanal', {
          p_bar_id: barId,
          p_ano: semana.ano,
          p_semana: semana.numero_semana
        });

        if (error) {
          console.error(`Erro ao recalcular S${semana.numero_semana}/${semana.ano}:`, error);
          resultados.push({
            semana: semana.numero_semana,
            ano: semana.ano,
            sucesso: false,
            erro: error.message
          });
        } else {
          resultados.push({
            semana: semana.numero_semana,
            ano: semana.ano,
            sucesso: true,
            duracao_ms: data?.[0]?.duracao_ms || 0
          });
        }
      } catch (err) {
        console.error(`Erro ao recalcular S${semana.numero_semana}/${semana.ano}:`, err);
        resultados.push({
          semana: semana.numero_semana,
          ano: semana.ano,
          sucesso: false,
          erro: err instanceof Error ? err.message : 'Erro desconhecido'
        });
      }
    }

    const sucessos = resultados.filter(r => r.sucesso).length;
    const falhas = resultados.filter(r => !r.sucesso).length;

    return NextResponse.json({
      success: falhas === 0,
      message: `${sucessos} semana(s) recalculada(s) via Gold ETL${falhas > 0 ? `, ${falhas} falha(s)` : ''}`,
      recalculadas: sucessos,
      falhas: falhas,
      detalhes: resultados
    });

  } catch (error) {
    console.error('❌ Erro na API de recalcular:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}
