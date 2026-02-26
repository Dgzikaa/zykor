import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET - Buscar histórico de simulações CMO
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bar_id = searchParams.get('bar_id');
    const ano = searchParams.get('ano');

    if (!bar_id) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('vw_cmo_historico')
      .select('*')
      .eq('bar_id', bar_id)
      .order('ano', { ascending: false })
      .order('semana', { ascending: false });

    if (ano) {
      query = query.eq('ano', ano);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Buscar total de funcionários para cada CMO
    const dataComFuncionarios = await Promise.all(
      (data || []).map(async (cmo: any) => {
        const { data: funcs } = await supabase
          .from('cmo_simulacao_funcionarios')
          .select('id')
          .eq('cmo_semanal_id', cmo.id);
        
        return {
          ...cmo,
          total_funcionarios: funcs?.length || 0,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: dataComFuncionarios,
    });
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
