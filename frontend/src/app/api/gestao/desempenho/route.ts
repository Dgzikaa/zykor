import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Erro ao conectar' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '3');
    const semana = parseInt(searchParams.get('semana') || '16');
    const ano = parseInt(searchParams.get('ano') || '2026');

    // Buscar dados direto do gold.desempenho
    const { data: goldData, error: goldError } = await supabase
      .from('desempenho')
      .select('*')
      .eq('bar_id', barId)
      .eq('ano', ano)
      .eq('numero_semana', semana)
      .eq('granularidade', 'semanal')
      .single();

    if (goldError) {
      console.error('Erro gold:', goldError);
    }

    // Buscar dados direto dos eventos_base
    const { data: eventos, error: eventosError } = await supabase
      .from('eventos_base')
      .select('data_evento, res_tot, res_p, num_mesas_tot, num_mesas_presentes, versao_calculo')
      .eq('bar_id', barId)
      .gte('data_evento', `${ano}-04-13`)
      .lte('data_evento', `${ano}-04-19`)
      .order('data_evento');

    if (eventosError) {
      console.error('Erro eventos:', eventosError);
    }

    const eventosSoma = (eventos || []).reduce((acc, e) => ({
      total_pessoas: acc.total_pessoas + (e.res_tot || 0),
      pessoas_presentes: acc.pessoas_presentes + (e.res_p || 0),
      mesas_total: acc.mesas_total + (e.num_mesas_tot || 0),
      mesas_presentes: acc.mesas_presentes + (e.num_mesas_presentes || 0)
    }), { total_pessoas: 0, pessoas_presentes: 0, mesas_total: 0, mesas_presentes: 0 });

    return NextResponse.json({
      success: true,
      debug: {
        parametros: { barId, semana, ano },
        gold_desempenho: {
          reservas_totais_OLD: goldData?.reservas_totais,
          reservas_presentes_OLD: goldData?.reservas_presentes,
          reservas_totais_quantidade_NEW: goldData?.reservas_totais_quantidade,
          reservas_totais_pessoas_NEW: goldData?.reservas_totais_pessoas,
          reservas_presentes_quantidade_NEW: goldData?.reservas_presentes_quantidade,
          reservas_presentes_pessoas_NEW: goldData?.reservas_presentes_pessoas,
          reservas_quebra_pct: goldData?.reservas_quebra_pct,
          calculado_em: goldData?.calculado_em
        },
        eventos_base_agregado: eventosSoma,
        eventos_individuais: eventos,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
