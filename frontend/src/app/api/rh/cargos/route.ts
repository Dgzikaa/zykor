import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser , permissionErrorResponse } from '@/middleware/auth';
import { podeRH } from '@/lib/auth/rh-guard';

export const dynamic = 'force-dynamic';

/**
 * Cargos do bar — nome, nível, área e a FAIXA SALARIAL (salario_min/salario_max).
 *
 * A faixa entrou em 15/08/2026 junto com "contratar pela cadeira": é dela que sai o salário sugerido
 * quando a cadeira não tem override (hr.cadeiras.salario_referencia). Ver a migration
 * 20260815_hr_salario_cargo_e_cadeira.sql.
 *
 * ATENÇÃO: as tabelas vivem no schema `hr`, não em `public`. Esta rota chamava `.from('cargos')` sem
 * schema e batia em public.cargos, que não existe — todo GET/POST/PUT aqui respondia 500 calado.
 */
const hrDe = (supabase: any) => (t: string) => supabase.schema('hr').from(t);

/**
 * GET /api/rh/cargos
 * Lista todos os cargos de um bar
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

    let query = hrDe(supabase)('cargos')
      .select('*')
      .eq('bar_id', parseInt(barId))
      .order('nivel', { ascending: false })
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
    console.error('Erro ao listar cargos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rh/cargos
 * Cria um novo cargo
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!podeRH(user)) return permissionErrorResponse('Sem permissão no módulo de RH');
  try {
    const body = await request.json();
    const { bar_id, nome, descricao, nivel, area_id, salario_min, salario_max } = body;

    if (!bar_id || !nome) {
      return NextResponse.json(
        { error: 'bar_id e nome são obrigatórios' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();
    const num = (v: unknown) => (v === '' || v == null ? null : Number(v));

    const { data, error } = await hrDe(supabase)('cargos')
      .insert({
        bar_id,
        nome: nome.trim(),
        descricao: descricao || null,
        nivel: nivel || 1,
        area_id: area_id || null,
        salario_min: num(salario_min),
        salario_max: num(salario_max),
        ativo: true
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Já existe um cargo com este nome' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Cargo criado com sucesso',
      data
    });

  } catch (error) {
    console.error('Erro ao criar cargo:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/rh/cargos
 * Atualiza um cargo existente
 */
export async function PUT(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!podeRH(user)) return permissionErrorResponse('Sem permissão no módulo de RH');
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });
  try {
    const body = await request.json();
    const { id, nome, descricao, nivel, ativo, area_id, salario_min, salario_max } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'id é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();
    const num = (v: unknown) => (v === '' || v == null ? null : Number(v));

    const updateData: Record<string, unknown> = {
      atualizado_em: new Date().toISOString()
    };

    if (nome !== undefined) updateData.nome = nome.trim();
    if (descricao !== undefined) updateData.descricao = descricao;
    if (nivel !== undefined) updateData.nivel = nivel;
    if (ativo !== undefined) updateData.ativo = ativo;
    if (area_id !== undefined) updateData.area_id = area_id || null;
    // Faixa: vazio LIMPA (volta a "sem referência"), não vira zero — zero sugeriria R$ 0,00 na
    // contratação, que é pior do que não sugerir nada.
    if (salario_min !== undefined) updateData.salario_min = num(salario_min);
    if (salario_max !== undefined) updateData.salario_max = num(salario_max);

    const { data, error } = await hrDe(supabase)('cargos')
      .update(updateData)
      .eq('id', id)
      // o cargo tem que ser do bar da sessão: sem isso dava pra editar a faixa do Deboche
      // mandando o id na mão a partir do Ordinário
      .eq('bar_id', user.bar_id)
      .select()
      .single();

    if (error) {
      // a constraint cargos_salario_faixa_valida barra teto abaixo do piso e valor negativo
      if (/cargos_salario_faixa_valida/.test(error.message)) {
        return NextResponse.json(
          { error: 'Faixa inválida: o teto não pode ser menor que o piso, e nenhum dos dois pode ser negativo.' },
          { status: 400 }
        );
      }
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Já existe um cargo com este nome' },
          { status: 409 }
        );
      }
      // .single() sem linha = o cargo não é deste bar (ou não existe); 404 é mais honesto que 500
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Cargo não encontrado neste bar' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Cargo atualizado com sucesso',
      data
    });

  } catch (error) {
    console.error('Erro ao atualizar cargo:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/rh/cargos
 * Remove um cargo (soft delete - marca como inativo)
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

    // Verificar se há funcionários usando este cargo
    const { count } = await hrDe(supabase)('funcionarios')
      .select('*', { count: 'exact', head: true })
      .eq('cargo_id', parseInt(id))
      .eq('ativo', true);

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir. Existem ${count} funcionário(s) com este cargo.` },
        { status: 409 }
      );
    }

    // Soft delete
    const { error } = await hrDe(supabase)('cargos')
      .update({ ativo: false, atualizado_em: new Date().toISOString() })
      .eq('id', parseInt(id));

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Cargo removido com sucesso'
    });

  } catch (error) {
    console.error('Erro ao remover cargo:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
