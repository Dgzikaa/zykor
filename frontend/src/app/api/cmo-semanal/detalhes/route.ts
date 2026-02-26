import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET - Buscar detalhes completos de um CMO (incluindo funcionários)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar CMO
    const { data: cmo, error: cmoError } = await supabase
      .from('cmo_semanal')
      .select('*')
      .eq('id', id)
      .single();

    if (cmoError) throw cmoError;

    // Buscar funcionários
    const { data: funcionarios, error: funcsError } = await supabase
      .from('cmo_simulacao_funcionarios')
      .select('*')
      .eq('cmo_semanal_id', id)
      .order('funcionario_nome', { ascending: true });

    if (funcsError) throw funcsError;

    return NextResponse.json({
      success: true,
      data: {
        ...cmo,
        funcionarios: funcionarios || [],
      },
    });
  } catch (error) {
    console.error('Erro ao buscar detalhes:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
