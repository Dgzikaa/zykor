import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser , permissionErrorResponse } from '@/middleware/auth';
import { podeRH } from '@/lib/auth/rh-guard';

export const dynamic = 'force-dynamic';

/**
 * ATENÇÃO: as tabelas vivem no schema `hr`, não em `public`. Esta rota chamava `.from('areas')` sem
 * schema e batia em public.areas, que não existe — as quatro operações respondiam 500 calado. Foi o
 * mesmo defeito da rota de cargos, achado em 15/08/2026, e ele reapareceu aqui porque o organograma
 * passou a criar área na hora (a Gabriela precisava de "Segurança", que não existia).
 * Ver feedback_supabase_from_sem_schema_falha_calada.
 */
const hrDe = (supabase: any) => (t: string) => supabase.schema('hr').from(t);

/**
 * GET /api/rh/areas
 * Lista todas as áreas de um bar
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const ativo = searchParams.get('ativo');

    if (!barId) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();
    
    let query = hrDe(supabase)('areas')
      .select('*')
      .eq('bar_id', parseInt(barId))
      .order('nome');

    if (ativo !== null && ativo !== undefined) {
      query = query.eq('ativo', ativo === 'true');
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Erro ao listar áreas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rh/areas
 * Cria uma nova área
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!podeRH(user)) return permissionErrorResponse('Sem permissão no módulo de RH');
  try {
    const body = await request.json();
    const { bar_id, nome, adicional_noturno, cor } = body;

    if (!bar_id || !nome) {
      return NextResponse.json(
        { error: 'bar_id e nome são obrigatórios' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();

    const { data, error } = await hrDe(supabase)('areas')
      .insert({
        bar_id,
        nome: nome.trim(),
        adicional_noturno: adicional_noturno || 0,
        cor: cor || '#6366f1',
        ativo: true
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Já existe uma área com este nome' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Área criada com sucesso',
      data
    });

  } catch (error) {
    console.error('Erro ao criar área:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/rh/areas
 * Atualiza uma área existente
 */
export async function PUT(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!podeRH(user)) return permissionErrorResponse('Sem permissão no módulo de RH');
  try {
    const body = await request.json();
    const { id, nome, adicional_noturno, cor, ativo } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'id é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();

    const updateData: Record<string, unknown> = {
      atualizado_em: new Date().toISOString()
    };

    if (nome !== undefined) updateData.nome = nome.trim();
    if (adicional_noturno !== undefined) updateData.adicional_noturno = adicional_noturno;
    if (cor !== undefined) updateData.cor = cor;
    if (ativo !== undefined) updateData.ativo = ativo;

    const { data, error } = await hrDe(supabase)('areas')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Já existe uma área com este nome' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Área atualizada com sucesso',
      data
    });

  } catch (error) {
    console.error('Erro ao atualizar área:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/rh/areas
 * Remove uma área (soft delete - marca como inativo)
 */
export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!podeRH(user)) return permissionErrorResponse('Sem permissão no módulo de RH');
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();

    // Verificar se há funcionários usando esta área
    const { count } = await hrDe(supabase)('funcionarios')
      .select('*', { count: 'exact', head: true })
      .eq('area_id', parseInt(id))
      .eq('ativo', true);

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir. Existem ${count} funcionário(s) nesta área.` },
        { status: 409 }
      );
    }

    // Soft delete
    const { error } = await hrDe(supabase)('areas')
      .update({ ativo: false, atualizado_em: new Date().toISOString() })
      .eq('id', parseInt(id));

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Área removida com sucesso'
    });

  } catch (error) {
    console.error('Erro ao remover área:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
