import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * Endpoint para recalcular uma semana específica usando a Edge Function recalcular-desempenho-v2
 * 
 * Query params:
 * - semana: número da semana (ex: 12)
 * - ano: ano (ex: 2026)
 * - mode: 'shadow' (apenas compara) ou 'write' (atualiza banco)
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const semana = parseInt(searchParams.get('semana') || '12');
    const ano = parseInt(searchParams.get('ano') || '2026');
    const mode = searchParams.get('mode') || 'write';
    
    const barIdHeader = request.headers.get('x-selected-bar-id');
    const barId = barIdHeader ? parseInt(barIdHeader, 10) : null;
    
    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    console.log(`🔄 Recalculando semana ${semana}/${ano} - mode=${mode}`);

    // Chamar a Edge Function recalcular-desempenho-v2
    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/recalcular-desempenho-v2`;
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        bar_id: barId,
        ano: ano,
        numero_semana: semana,
        mode: mode,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ 
        error: `Edge Function retornou erro: ${response.status}`,
        details: errorText 
      }, { status: 500 });
    }

    const result = await response.json();

    // Buscar dados atualizados
    const supabase = await getAdminClient();
    const { data: semanaAtualizada } = await supabase
      .from('desempenho_semanal')
      .select('perc_bebidas, perc_drinks, perc_comida, perc_happy_hour, atualizado_em')
      .eq('bar_id', barId)
      .eq('ano', ano)
      .eq('numero_semana', semana)
      .single();

    return NextResponse.json({
      success: true,
      recalculo: result,
      dados_atualizados: semanaAtualizada,
      resumo: {
        semana: semana,
        ano: ano,
        mode: mode,
        write_executed: result.write_executed,
        mix_novo: semanaAtualizada ? {
          bebidas: semanaAtualizada.perc_bebidas,
          drinks: semanaAtualizada.perc_drinks,
          comida: semanaAtualizada.perc_comida,
          happy_hour: semanaAtualizada.perc_happy_hour,
        } : null,
      }
    });

  } catch (error) {
    console.error('Erro ao recalcular semana:', error);
    return NextResponse.json(
      { error: 'Erro interno', details: String(error) },
      { status: 500 }
    );
  }
}
