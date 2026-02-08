import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * Funções de cálculo de provisões trabalhistas
 * Baseadas nas fórmulas da planilha PROVISÕES
 */

interface DadosProvisao {
  salario_bruto_produtividade: number;
  comissao_bonus: number;
  dias_ferias_vencidos: number;
}

function calcularProvisoes(dados: DadosProvisao) {
  const { salario_bruto_produtividade, comissao_bonus, dias_ferias_vencidos } = dados;
  
  // Base total
  const baseTotal = salario_bruto_produtividade + comissao_bonus;
  
  // 13º = 1/12 do salário (mensal)
  const decimoTerceiro = baseTotal / 12;
  
  // Férias = 1/12 do salário (mensal)
  const ferias = baseTotal / 12;
  
  // Férias vencidas = (dias / 30) * salário
  const feriasVencidas = dias_ferias_vencidos > 0 
    ? (dias_ferias_vencidos / 30) * salario_bruto_produtividade 
    : 0;
  
  // 1/3 de férias
  const tercoFerias = (ferias + feriasVencidas) / 3;
  
  // INSS sobre provisões (12%)
  const inssProvisao = (decimoTerceiro + ferias + tercoFerias) * 0.12;
  
  // FGTS sobre provisões (8%)
  const fgtsProvisao = (decimoTerceiro + ferias + tercoFerias) * 0.08;
  
  // Multa FGTS (40% do FGTS acumulado estimado)
  // Estimativa: 8% * 12 meses = ~1 salário de FGTS por ano
  const multaFgts = fgtsProvisao * 0.4;
  
  // Provisão Certa = 13º + Férias + 1/3 + INSS + FGTS
  const provisaoCerta = decimoTerceiro + ferias + tercoFerias + inssProvisao + fgtsProvisao;
  
  // Provisão Eventual = Multa FGTS + Aviso Prévio estimado
  const provisaoEventual = multaFgts + (salario_bruto_produtividade / 12);
  
  // Percentual sobre salário
  const percentualSalario = salario_bruto_produtividade > 0 
    ? ((provisaoCerta / salario_bruto_produtividade) * 100)
    : 0;
  
  return {
    decimo_terceiro: decimoTerceiro,
    ferias,
    dias_ferias_vencidos,
    ferias_vencidas: feriasVencidas,
    terco_ferias: tercoFerias,
    inss_provisao: inssProvisao,
    fgts_provisao: fgtsProvisao,
    multa_fgts: multaFgts,
    provisao_certa: provisaoCerta,
    provisao_eventual: provisaoEventual,
    percentual_salario: percentualSalario
  };
}

/**
 * GET /api/rh/provisoes
 * Lista provisões trabalhistas com filtros
 * Se auto_calcular=true e não existir dados, calcula automaticamente
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const mes = searchParams.get('mes');
    const ano = searchParams.get('ano');
    const funcionarioId = searchParams.get('funcionario_id');
    const acumulado = searchParams.get('acumulado'); // Se true, retorna view acumulada
    const autoCalcular = searchParams.get('auto_calcular') === 'true';

    if (!barId) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();

    if (acumulado === 'true') {
      // Retornar provisões acumuladas por funcionário
      const { data, error } = await supabase
        .from('vw_provisoes_acumuladas')
        .select('*')
        .eq('bar_id', parseInt(barId));

      if (error) throw error;

      return NextResponse.json({
        success: true,
        data: data || []
      });
    }
    
    let query = supabase
      .from('provisoes_trabalhistas')
      .select(`
        *,
        funcionario:funcionarios(id, nome)
      `)
      .eq('bar_id', parseInt(barId))
      .order('ano', { ascending: false })
      .order('mes', { ascending: false });

    if (mes) query = query.eq('mes', parseInt(mes));
    if (ano) query = query.eq('ano', parseInt(ano));
    if (funcionarioId) query = query.eq('funcionario_id', parseInt(funcionarioId));

    let { data, error } = await query;

    if (error) throw error;

    // Se não tem dados e auto_calcular=true, calcular automaticamente
    if ((!data || data.length === 0) && autoCalcular && mes && ano) {
      // Buscar funcionários ativos
      const { data: funcionarios, error: funcError } = await supabase
        .from('funcionarios')
        .select('id, nome, salario_base, tipo_contratacao')
        .eq('bar_id', parseInt(barId))
        .eq('ativo', true);

      if (!funcError && funcionarios && funcionarios.length > 0) {
        // Calcular provisões para cada funcionário
        const provisoesCalculadas = funcionarios.map(func => {
          const calculo = calcularProvisoes({
            salario_bruto_produtividade: func.salario_base,
            comissao_bonus: 0,
            dias_ferias_vencidos: 0
          });

          return {
            bar_id: parseInt(barId),
            funcionario_id: func.id,
            funcionario_nome: func.nome,
            mes: parseInt(mes),
            ano: parseInt(ano),
            salario_bruto_produtividade: func.salario_base,
            comissao_bonus: 0,
            ...calculo
          };
        });

        // Salvar automaticamente
        const { data: provisoesSalvas, error: saveError } = await supabase
          .from('provisoes_trabalhistas')
          .upsert(provisoesCalculadas, {
            onConflict: 'bar_id,funcionario_id,mes,ano',
            ignoreDuplicates: false
          })
          .select(`
            *,
            funcionario:funcionarios(id, nome)
          `);

        if (!saveError) {
          data = provisoesSalvas;
        }
      }
    }

    // Calcular totais
    const totais = {
      total_provisao_certa: 0,
      total_provisao_eventual: 0,
      total_decimo_terceiro: 0,
      total_ferias: 0,
      total_fgts: 0
    };

    data?.forEach(prov => {
      totais.total_provisao_certa += Number(prov.provisao_certa) || 0;
      totais.total_provisao_eventual += Number(prov.provisao_eventual) || 0;
      totais.total_decimo_terceiro += Number(prov.decimo_terceiro) || 0;
      totais.total_ferias += Number(prov.ferias) || 0;
      totais.total_fgts += Number(prov.fgts_provisao) || 0;
    });

    return NextResponse.json({
      success: true,
      data: data || [],
      totais
    });

  } catch (error) {
    console.error('Erro ao listar provisões:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rh/provisoes
 * Calcula e salva provisões para um mês
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bar_id, mes, ano, funcionarios_dados } = body;

    if (!bar_id || !mes || !ano) {
      return NextResponse.json(
        { error: 'bar_id, mes e ano são obrigatórios' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();

    // Buscar funcionários ativos do bar
    const { data: funcionarios, error: funcError } = await supabase
      .from('funcionarios')
      .select('id, nome, salario_base, tipo_contratacao')
      .eq('bar_id', bar_id)
      .eq('ativo', true);

    if (funcError) throw funcError;

    if (!funcionarios || funcionarios.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum funcionário ativo encontrado' },
        { status: 404 }
      );
    }

    // Dados extras por funcionário (opcional)
    const dadosExtras = funcionarios_dados || {};

    // Calcular provisões para cada funcionário
    const provisoesCalculadas = funcionarios.map(func => {
      const dados = dadosExtras[func.id] || {};
      
      const calculo = calcularProvisoes({
        salario_bruto_produtividade: dados.salario_bruto_produtividade || func.salario_base,
        comissao_bonus: dados.comissao_bonus || 0,
        dias_ferias_vencidos: dados.dias_ferias_vencidos || 0
      });

      return {
        bar_id,
        funcionario_id: func.id,
        funcionario_nome: func.nome,
        mes,
        ano,
        salario_bruto_produtividade: dados.salario_bruto_produtividade || func.salario_base,
        comissao_bonus: dados.comissao_bonus || 0,
        ...calculo
      };
    });

    // Inserir (não upsert para manter histórico)
    // Primeiro, deletar provisões existentes do mês
    await supabase
      .from('provisoes_trabalhistas')
      .delete()
      .eq('bar_id', bar_id)
      .eq('mes', mes)
      .eq('ano', ano);

    const { data: provisoesSalvas, error: saveError } = await supabase
      .from('provisoes_trabalhistas')
      .insert(provisoesCalculadas)
      .select();

    if (saveError) throw saveError;

    // Calcular totais
    const totais = {
      total_provisao_certa: 0,
      total_provisao_eventual: 0
    };

    provisoesSalvas?.forEach(prov => {
      totais.total_provisao_certa += Number(prov.provisao_certa) || 0;
      totais.total_provisao_eventual += Number(prov.provisao_eventual) || 0;
    });

    return NextResponse.json({
      success: true,
      message: `Provisões de ${mes}/${ano} calculadas com sucesso`,
      data: provisoesSalvas,
      totais
    });

  } catch (error) {
    console.error('Erro ao calcular provisões:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/rh/provisoes
 * Atualiza provisão específica
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateFields } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'id é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();

    const { data, error } = await supabase
      .from('provisoes_trabalhistas')
      .update({
        ...updateFields,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Provisão atualizada com sucesso',
      data
    });

  } catch (error) {
    console.error('Erro ao atualizar provisão:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/rh/provisoes
 * Remove provisões
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

    const { error } = await supabase
      .from('provisoes_trabalhistas')
      .delete()
      .eq('id', parseInt(id));

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Provisão removida com sucesso'
    });

  } catch (error) {
    console.error('Erro ao remover provisão:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
