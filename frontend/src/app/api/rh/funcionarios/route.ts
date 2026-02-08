import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rh/funcionarios
 * Lista todos os funcionários de um bar com filtros
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const ativo = searchParams.get('ativo');
    const areaId = searchParams.get('area_id');
    const cargoId = searchParams.get('cargo_id');
    const tipoContratacao = searchParams.get('tipo_contratacao');
    const busca = searchParams.get('busca');

    if (!barId) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();
    
    let query = supabase
      .from('funcionarios')
      .select(`
        *,
        area:areas(id, nome, cor, adicional_noturno),
        cargo:cargos(id, nome, nivel)
      `)
      .eq('bar_id', parseInt(barId))
      .order('nome');

    // Filtros opcionais
    if (ativo !== null && ativo !== undefined) {
      query = query.eq('ativo', ativo === 'true');
    }

    if (areaId) {
      query = query.eq('area_id', parseInt(areaId));
    }

    if (cargoId) {
      query = query.eq('cargo_id', parseInt(cargoId));
    }

    if (tipoContratacao) {
      query = query.eq('tipo_contratacao', tipoContratacao);
    }

    if (busca) {
      query = query.ilike('nome', `%${busca}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Erro ao listar funcionários:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rh/funcionarios
 * Cria um novo funcionário
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      bar_id,
      nome,
      cpf,
      telefone,
      email,
      data_admissao,
      cargo_id,
      area_id,
      tipo_contratacao,
      salario_base,
      vale_transporte_diaria,
      dias_trabalho_semana,
      observacoes
    } = body;

    if (!bar_id || !nome) {
      return NextResponse.json(
        { error: 'bar_id e nome são obrigatórios' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();

    // Criar funcionário
    const { data: funcionario, error: funcError } = await supabase
      .from('funcionarios')
      .insert({
        bar_id,
        nome: nome.trim(),
        cpf: cpf || null,
        telefone: telefone || null,
        email: email || null,
        data_admissao: data_admissao || null,
        cargo_id: cargo_id || null,
        area_id: area_id || null,
        tipo_contratacao: tipo_contratacao || 'CLT',
        salario_base: salario_base || 0,
        vale_transporte_diaria: vale_transporte_diaria || 0,
        dias_trabalho_semana: dias_trabalho_semana || 6,
        observacoes: observacoes || null,
        ativo: true
      })
      .select(`
        *,
        area:areas(id, nome, cor, adicional_noturno),
        cargo:cargos(id, nome, nivel)
      `)
      .single();

    if (funcError) throw funcError;

    // Criar registro inicial de contrato
    if (funcionario && (salario_base || vale_transporte_diaria)) {
      await supabase
        .from('contratos_funcionario')
        .insert({
          funcionario_id: funcionario.id,
          salario_base: salario_base || 0,
          vale_transporte_diaria: vale_transporte_diaria || 0,
          tipo_contratacao: tipo_contratacao || 'CLT',
          cargo_id: cargo_id || null,
          area_id: area_id || null,
          vigencia_inicio: data_admissao || new Date().toISOString().split('T')[0],
          motivo_alteracao: 'Admissão'
        });
    }

    return NextResponse.json({
      success: true,
      message: 'Funcionário cadastrado com sucesso',
      data: funcionario
    });

  } catch (error) {
    console.error('Erro ao criar funcionário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/rh/funcionarios
 * Atualiza um funcionário existente
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      nome,
      cpf,
      telefone,
      email,
      data_admissao,
      data_demissao,
      cargo_id,
      area_id,
      tipo_contratacao,
      salario_base,
      vale_transporte_diaria,
      dias_trabalho_semana,
      observacoes,
      ativo,
      registrar_alteracao_contrato
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'id é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();

    // Buscar dados atuais para comparar
    const { data: funcionarioAtual } = await supabase
      .from('funcionarios')
      .select('*')
      .eq('id', id)
      .single();

    const updateData: Record<string, unknown> = {
      atualizado_em: new Date().toISOString()
    };

    if (nome !== undefined) updateData.nome = nome.trim();
    if (cpf !== undefined) updateData.cpf = cpf;
    if (telefone !== undefined) updateData.telefone = telefone;
    if (email !== undefined) updateData.email = email;
    if (data_admissao !== undefined) updateData.data_admissao = data_admissao;
    if (data_demissao !== undefined) updateData.data_demissao = data_demissao;
    if (cargo_id !== undefined) updateData.cargo_id = cargo_id;
    if (area_id !== undefined) updateData.area_id = area_id;
    if (tipo_contratacao !== undefined) updateData.tipo_contratacao = tipo_contratacao;
    if (salario_base !== undefined) updateData.salario_base = salario_base;
    if (vale_transporte_diaria !== undefined) updateData.vale_transporte_diaria = vale_transporte_diaria;
    if (dias_trabalho_semana !== undefined) updateData.dias_trabalho_semana = dias_trabalho_semana;
    if (observacoes !== undefined) updateData.observacoes = observacoes;
    if (ativo !== undefined) updateData.ativo = ativo;

    // Se demitido, marcar como inativo
    if (data_demissao) {
      updateData.ativo = false;
    }

    const { data, error } = await supabase
      .from('funcionarios')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        area:areas(id, nome, cor, adicional_noturno),
        cargo:cargos(id, nome, nivel)
      `)
      .single();

    if (error) throw error;

    // Registrar alteração de contrato se houve mudança salarial ou de cargo
    if (registrar_alteracao_contrato && funcionarioAtual) {
      const houveMudancaContrato = 
        (salario_base !== undefined && salario_base !== funcionarioAtual.salario_base) ||
        (cargo_id !== undefined && cargo_id !== funcionarioAtual.cargo_id) ||
        (area_id !== undefined && area_id !== funcionarioAtual.area_id) ||
        (tipo_contratacao !== undefined && tipo_contratacao !== funcionarioAtual.tipo_contratacao);

      if (houveMudancaContrato) {
        // Fechar contrato anterior
        await supabase
          .from('contratos_funcionario')
          .update({ vigencia_fim: new Date().toISOString().split('T')[0] })
          .eq('funcionario_id', id)
          .is('vigencia_fim', null);

        // Criar novo contrato
        await supabase
          .from('contratos_funcionario')
          .insert({
            funcionario_id: id,
            salario_base: salario_base ?? funcionarioAtual.salario_base,
            vale_transporte_diaria: vale_transporte_diaria ?? funcionarioAtual.vale_transporte_diaria,
            tipo_contratacao: tipo_contratacao ?? funcionarioAtual.tipo_contratacao,
            cargo_id: cargo_id ?? funcionarioAtual.cargo_id,
            area_id: area_id ?? funcionarioAtual.area_id,
            vigencia_inicio: new Date().toISOString().split('T')[0],
            motivo_alteracao: body.motivo_alteracao || 'Alteração contratual'
          });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Funcionário atualizado com sucesso',
      data
    });

  } catch (error) {
    console.error('Erro ao atualizar funcionário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/rh/funcionarios
 * Remove um funcionário (soft delete - marca como inativo)
 */
export async function DELETE(request: NextRequest) {
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

    // Soft delete
    const { error } = await supabase
      .from('funcionarios')
      .update({ 
        ativo: false, 
        data_demissao: new Date().toISOString().split('T')[0],
        atualizado_em: new Date().toISOString() 
      })
      .eq('id', parseInt(id));

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Funcionário desativado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao remover funcionário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
