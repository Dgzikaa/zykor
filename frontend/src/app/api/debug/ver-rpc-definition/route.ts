import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * Busca a definição da stored procedure calcular_mix_vendas
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getAdminClient();

    // Buscar definição da função
    const { data, error } = await supabase
      .rpc('execute_sql', {
        sql_query: `
          SELECT 
            routine_name,
            routine_definition
          FROM information_schema.routines
          WHERE routine_name = 'calcular_mix_vendas'
            AND routine_schema = 'public';
        `
      });

    if (error) {
      console.error('Erro ao buscar definição:', error);
      
      // Tentar método alternativo
      const { data: pgProc, error: pgError } = await supabase
        .from('pg_proc')
        .select('proname, prosrc')
        .eq('proname', 'calcular_mix_vendas')
        .single();

      if (pgError) {
        return NextResponse.json({ 
          error: 'Não foi possível buscar a definição da função',
          tentativa1: error,
          tentativa2: pgError,
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        metodo: 'pg_proc',
        funcao: pgProc,
      });
    }

    return NextResponse.json({
      success: true,
      metodo: 'information_schema',
      funcao: data,
    });

  } catch (error) {
    console.error('Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno', details: String(error) },
      { status: 500 }
    );
  }
}
