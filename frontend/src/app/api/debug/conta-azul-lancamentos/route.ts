import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const supabase = await getAdminClient();
    
    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '4');
    const dataInicio = searchParams.get('data_inicio') || '2026-03-30';
    const dataFim = searchParams.get('data_fim') || '2026-04-05';
    
    const { data, error } = await supabase
      .from('contaazul_lancamentos')
      .select('categoria_nome, valor_bruto, tipo, descricao, data_competencia')
      .eq('bar_id', barId)
      .gte('data_competencia', dataInicio)
      .lte('data_competencia', dataFim)
      .order('data_competencia', { ascending: true });
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({
      bar_id: barId,
      periodo: { dataInicio, dataFim },
      total: data?.length || 0,
      lancamentos: data || []
    });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
