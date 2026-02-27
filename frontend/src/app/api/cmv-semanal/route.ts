import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logAuditEvent } from '@/lib/audit-logger';

// Cache por 2 minutos para dados CMV
export const revalidate = 120;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Buscar dados de CMV Semanal
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ano = searchParams.get('ano');
    const semana = searchParams.get('semana');
    const status = searchParams.get('status');
    const barIdParam = searchParams.get('bar_id');
    
    if (!barIdParam) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }
    const barId = parseInt(barIdParam);

    let query = supabase
      .from('cmv_semanal')
      .select('*')
      .eq('bar_id', barId)
      .order('ano', { ascending: false })
      .order('semana', { ascending: false });

    if (ano) {
      query = query.eq('ano', parseInt(ano));
    }
    if (semana) {
      query = query.eq('semana', parseInt(semana));
    }
    if (status && status !== 'TODOS') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar CMV:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar dados de CMV' },
        { status: 500 }
      );
    }

    // Calcular estatísticas
    const totalRegistros = data?.length || 0;
    const cmvMedio = totalRegistros > 0
      ? data!.reduce((sum, item) => sum + ((item as any).cmv_limpo_percentual ?? (item as any).cmv_percentual ?? 0), 0) / totalRegistros
      : 0;
    const vendasTotais = totalRegistros > 0
      ? data!.reduce((sum, item) => sum + (item.vendas_liquidas || 0), 0)
      : 0;

    return NextResponse.json({
      success: true,
      data: data || [],
      meta: {
        total_registros: totalRegistros,
        cmv_medio: parseFloat(cmvMedio.toFixed(2)),
        vendas_totais: parseFloat(vendasTotais.toFixed(2))
      }
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Criar/Atualizar registro de CMV
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bar_id, registro } = body;

    if (!bar_id || !registro) {
      return NextResponse.json(
        { error: 'Dados inválidos' },
        { status: 400 }
      );
    }

    // Validar campos obrigatórios
    if (!registro.ano || !registro.semana || !registro.data_inicio || !registro.data_fim) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: ano, semana, data_inicio, data_fim' },
        { status: 400 }
      );
    }

    // Buscar registro existente para auditoria
    const { data: existente } = await supabase
      .from('cmv_semanal')
      .select('*')
      .eq('bar_id', bar_id)
      .eq('ano', registro.ano)
      .eq('semana', registro.semana)
      .single();

    // Adicionar bar_id ao registro
    const registroCompleto = {
      ...registro,
      bar_id,
      updated_at: new Date().toISOString()
    };

    // Inserir/atualizar registro
    const { data, error } = await supabase
      .from('cmv_semanal')
      .upsert(registroCompleto, {
        onConflict: 'bar_id,ano,semana'
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar CMV:', error);
      return NextResponse.json(
        { error: 'Erro ao salvar dados de CMV', details: error.message },
        { status: 500 }
      );
    }

    // Registrar auditoria
    try {
      await logAuditEvent({
        operation: existente ? 'UPDATE_CMV' : 'CREATE_CMV',
        description: `${existente ? 'Atualização' : 'Criação'} de CMV - Semana ${registro.semana}/${registro.ano}`,
        barId: bar_id,
        tableName: 'cmv_semanal',
        recordId: data.id,
        oldValues: existente || undefined,
        newValues: data,
        severity: 'info',
        category: 'financial',
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        endpoint: '/api/cmv-semanal',
        method: 'POST'
      });
    } catch (auditError) {
      console.error('Erro ao registrar auditoria:', auditError);
      // Não falha a operação se auditoria falhar
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'CMV salvo com sucesso'
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar campos de um registro (status, métricas manuais, etc.)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...campos } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar registro existente para auditoria
    const { data: existente } = await supabase
      .from('cmv_semanal')
      .select('*')
      .eq('id', id)
      .single();

    // Campos permitidos para atualização
    const camposPermitidos = [
      'status', 'observacoes', 'responsavel',
      'bonificacao_contrato_anual', 'bonificacao_cashback_mensal',
      'ajuste_bonificacoes', 'outros_ajustes',
      'consumo_rh', 'cmv_teorico_percentual',
      'estoque_inicial_cozinha', 'estoque_inicial_bebidas', 'estoque_inicial_drinks',
      'estoque_final_cozinha', 'estoque_final_bebidas', 'estoque_final_drinks',
    ];

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    // Copiar apenas campos permitidos
    for (const campo of camposPermitidos) {
      if (campos[campo] !== undefined) {
        updateData[campo] = campos[campo];
      }
    }

    // Se bonificações individuais foram alteradas, recalcular o total
    if (campos.bonificacao_contrato_anual !== undefined || campos.bonificacao_cashback_mensal !== undefined) {
      // Buscar registro atual para pegar valores existentes
      const { data: atual } = await supabase
        .from('cmv_semanal')
        .select('bonificacao_contrato_anual, bonificacao_cashback_mensal')
        .eq('id', id)
        .single();

      const contratoAnual = campos.bonificacao_contrato_anual ?? atual?.bonificacao_contrato_anual ?? 0;
      const cashbackMensal = campos.bonificacao_cashback_mensal ?? atual?.bonificacao_cashback_mensal ?? 0;
      updateData.ajuste_bonificacoes = parseFloat(contratoAnual) + parseFloat(cashbackMensal);
    }

    const { data, error } = await supabase
      .from('cmv_semanal')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar CMV:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar CMV', details: error.message },
        { status: 500 }
      );
    }

    // Registrar auditoria
    try {
      await logAuditEvent({
        operation: 'UPDATE_CMV_FIELDS',
        description: `Atualização de campos do CMV - ID: ${id}`,
        barId: existente?.bar_id,
        tableName: 'cmv_semanal',
        recordId: id,
        oldValues: existente || undefined,
        newValues: data,
        severity: 'info',
        category: 'financial',
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        endpoint: '/api/cmv-semanal',
        method: 'PUT',
        metadata: { campos_alterados: Object.keys(campos) }
      });
    } catch (auditError) {
      console.error('Erro ao registrar auditoria:', auditError);
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'CMV atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Excluir registro
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar registro antes de excluir para auditoria
    const { data: existente } = await supabase
      .from('cmv_semanal')
      .select('*')
      .eq('id', parseInt(id))
      .single();

    const { error } = await supabase
      .from('cmv_semanal')
      .delete()
      .eq('id', parseInt(id));

    if (error) {
      console.error('Erro ao excluir CMV:', error);
      return NextResponse.json(
        { error: 'Erro ao excluir registro', details: error.message },
        { status: 500 }
      );
    }

    // Registrar auditoria
    try {
      await logAuditEvent({
        operation: 'DELETE_CMV',
        description: `Exclusão de CMV - ID: ${id}`,
        barId: existente?.bar_id,
        tableName: 'cmv_semanal',
        recordId: id,
        oldValues: existente || undefined,
        severity: 'warning',
        category: 'financial',
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        endpoint: '/api/cmv-semanal',
        method: 'DELETE'
      });
    } catch (auditError) {
      console.error('Erro ao registrar auditoria:', auditError);
    }

    return NextResponse.json({
      success: true,
      message: 'Registro excluído com sucesso'
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

