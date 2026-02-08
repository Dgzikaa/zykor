import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rh/funcionarios/[id]/contratos
 * Lista histórico de contratos de um funcionário
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'id do funcionário é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();

    const { data, error } = await supabase
      .from('contratos_funcionario')
      .select(`
        *,
        cargo:cargos(id, nome),
        area:areas(id, nome)
      `)
      .eq('funcionario_id', parseInt(id))
      .order('vigencia_inicio', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Erro ao listar contratos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
