import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET - Buscar CMO de uma semana específica
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bar_id = searchParams.get('bar_id');
    const ano = searchParams.get('ano');
    const semana = searchParams.get('semana');

    if (!bar_id || !ano || !semana) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos' },
        { status: 400 }
      );
    }

    // Buscar CMO
    const { data: cmo, error: cmoError } = await supabase
      .from('cmo_semanal')
      .select('*')
      .eq('bar_id', bar_id)
      .eq('ano', ano)
      .eq('semana', semana)
      .single();

    if (cmoError && cmoError.code !== 'PGRST116') {
      throw cmoError;
    }

    // Buscar funcionários da simulação
    let funcionarios: any[] = [];
    if (cmo?.id) {
      const { data: funcs } = await supabase
        .from('cmo_simulacao_funcionarios')
        .select('*')
        .eq('cmo_semanal_id', cmo.id)
        .order('created_at', { ascending: true });

      funcionarios = (funcs || []) as any[];
    }

    return NextResponse.json({
      success: true,
      data: {
        cmo: cmo || null,
        funcionarios,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar CMO:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST - Criar novo CMO
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cmo, funcionarios } = body;

    if (!cmo || !cmo.bar_id || !cmo.ano || !cmo.semana) {
      return NextResponse.json(
        { error: 'Dados inválidos' },
        { status: 400 }
      );
    }

    // Pegar user_id do header (se disponível)
    const userId = request.headers.get('x-user-id');
    const userIdInt = userId ? parseInt(userId) : null;

    // Criar CMO
    const { data: novoCmo, error: cmoError } = await supabase
      .from('cmo_semanal')
      .insert({
        bar_id: cmo.bar_id,
        ano: cmo.ano,
        semana: cmo.semana,
        data_inicio: cmo.data_inicio,
        data_fim: cmo.data_fim,
        freelas: cmo.freelas || 0,
        fixos_total: cmo.fixos_total || 0,
        cma_alimentacao: cmo.cma_alimentacao || 0,
        pro_labore_mensal: cmo.pro_labore_mensal || 0,
        pro_labore_semanal: cmo.pro_labore_semanal || 0,
        cmo_total: cmo.cmo_total || 0,
        simulacao_salva: false,
        observacoes: cmo.observacoes,
        created_by: userIdInt,
      })
      .select()
      .single();

    if (cmoError) throw cmoError;

    // Criar funcionários com cálculos
    if (funcionarios && funcionarios.length > 0 && novoCmo?.id) {
      // Importar cálculos
      const { calcularCustoFuncionario } = await import('@/lib/calculos-folha');
      
      const funcsParaInserir = funcionarios.map((func: any) => {
        const resultado = calcularCustoFuncionario(func);
        
        return {
          cmo_semanal_id: novoCmo.id,
          funcionario_nome: func.nome,
          tipo_contratacao: func.tipo_contratacao,
          area: func.area,
          vale_transporte: func.vale_transporte || 0,
          salario_bruto: func.salario_bruto,
          adicional: func.adicional || 0,
          adicional_aviso_previo: func.adicional_aviso_previo || 0,
          dias_trabalhados: func.dias_trabalhados || 7,
          // Valores calculados
          salario_liquido: resultado.salario_liquido,
          adicionais_total: resultado.adicionais_total,
          aviso_previo: resultado.aviso_previo,
          custo_empresa: resultado.custo_empresa,
          custo_total: resultado.custo_total,
          custo_semanal: resultado.custo_semanal,
          calculo_detalhado: resultado.detalhamento,
        };
      });

      const { error: funcsError } = await supabase
        .from('cmo_simulacao_funcionarios')
        .insert(funcsParaInserir);

      if (funcsError) throw funcsError;
    }

    return NextResponse.json({
      success: true,
      data: novoCmo,
      message: 'CMO criado com sucesso',
    });
  } catch (error) {
    console.error('Erro ao criar CMO:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Atualizar CMO existente
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { cmo, funcionarios } = body;

    if (!cmo || !cmo.id) {
      return NextResponse.json(
        { error: 'ID do CMO é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se está travado
    const { data: cmoExistente } = await supabase
      .from('cmo_semanal')
      .select('simulacao_salva')
      .eq('id', cmo.id)
      .single();

    if (cmoExistente?.simulacao_salva) {
      return NextResponse.json(
        { error: 'Simulação travada. Destrave antes de editar.' },
        { status: 403 }
      );
    }

    // Pegar user_id do header (se disponível)
    const userId = request.headers.get('x-user-id');
    const userIdInt = userId ? parseInt(userId) : null;

    // Atualizar CMO
    const { data: cmoAtualizado, error: cmoError } = await supabase
      .from('cmo_semanal')
      .update({
        freelas: cmo.freelas || 0,
        fixos_total: cmo.fixos_total || 0,
        cma_alimentacao: cmo.cma_alimentacao || 0,
        pro_labore_mensal: cmo.pro_labore_mensal || 0,
        pro_labore_semanal: cmo.pro_labore_semanal || 0,
        cmo_total: cmo.cmo_total || 0,
        observacoes: cmo.observacoes,
        updated_at: new Date().toISOString(),
        updated_by: userIdInt,
      })
      .eq('id', cmo.id)
      .select()
      .single();

    if (cmoError) throw cmoError;

    // Deletar funcionários antigos
    await supabase
      .from('cmo_simulacao_funcionarios')
      .delete()
      .eq('cmo_semanal_id', cmo.id);

    // Inserir novos funcionários com cálculos
    if (funcionarios && funcionarios.length > 0) {
      // Importar cálculos
      const { calcularCustoFuncionario } = await import('@/lib/calculos-folha');
      
      const funcsParaInserir = funcionarios.map((func: any) => {
        const resultado = calcularCustoFuncionario(func);
        
        return {
          cmo_semanal_id: cmo.id,
          funcionario_nome: func.nome,
          tipo_contratacao: func.tipo_contratacao,
          area: func.area,
          vale_transporte: func.vale_transporte || 0,
          salario_bruto: func.salario_bruto,
          adicional: func.adicional || 0,
          adicional_aviso_previo: func.adicional_aviso_previo || 0,
          dias_trabalhados: func.dias_trabalhados || 7,
          // Valores calculados
          salario_liquido: resultado.salario_liquido,
          adicionais_total: resultado.adicionais_total,
          aviso_previo: resultado.aviso_previo,
          custo_empresa: resultado.custo_empresa,
          custo_total: resultado.custo_total,
          custo_semanal: resultado.custo_semanal,
          calculo_detalhado: resultado.detalhamento,
        };
      });

      const { error: funcsError } = await supabase
        .from('cmo_simulacao_funcionarios')
        .insert(funcsParaInserir);

      if (funcsError) throw funcsError;
    }

    return NextResponse.json({
      success: true,
      data: cmoAtualizado,
      message: 'CMO atualizado com sucesso',
    });
  } catch (error) {
    console.error('Erro ao atualizar CMO:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
