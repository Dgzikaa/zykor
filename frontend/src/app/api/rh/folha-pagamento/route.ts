import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * Funções de cálculo da folha de pagamento
 * Baseadas nas fórmulas da planilha CMO
 */

interface DadosFuncionario {
  id: number;
  nome: string;
  tipo_contratacao: 'CLT' | 'PJ';
  salario_base: number;
  vale_transporte_diaria: number;
  area: {
    adicional_noturno: number;
  } | null;
}

interface CalculoFolha {
  dias_trabalhados: number;
  salario_bruto: number;
  estimativa: number;
  adicional_noturno: number;
  drs_noturno: number;
  tempo_casa: number;
  produtividade: number;
  desc_vale_transporte: number;
  inss: number;
  ir: number;
  salario_liquido: number;
  inss_empresa: number;
  fgts: number;
  vale_transporte: number;
  provisao_certa: number;
  mensalidade_sindical: number;
  adicionais: number;
  aviso_previo: number;
  custo_empresa: number;
}

function calcularFolhaFuncionario(
  funcionario: DadosFuncionario,
  diasTrabalhados: number = 30,
  estimativa: number = 0,
  tempoCasa: number = 0,
  adicionais: number = 0,
  avisoPrevio: number = 0,
  mensalidadeSindical: number = 0
): CalculoFolha {
  const diasMes = 30;
  const salarioBruto = funcionario.salario_base;
  
  // 1. Salário Bruto + Estimativa
  const salarioBrutoEstimativa = salarioBruto + estimativa;
  
  // 2. Adicional Noturno (lookup por área)
  const adicionalNoturno = funcionario.area?.adicional_noturno || 0;
  
  // 3. DRS Sobre Ads Noturno = 0,2 * adicional noturno
  const drsNoturno = adicionalNoturno * 0.2;
  
  // 4. Produtividade = salário bruto * 0,05
  const produtividade = salarioBruto * 0.05;
  
  // 5. Desc Vale Transporte = salário bruto * -0,06
  const descValeTransporte = salarioBruto * -0.06;
  
  // 6. Base para INSS
  const baseINSS = salarioBrutoEstimativa + adicionalNoturno + drsNoturno + tempoCasa + produtividade;
  
  // 7. INSS = base * -0,08
  const inss = baseINSS * -0.08;
  
  // 8. IR = fórmula progressiva
  let ir = 0;
  const baseIR = (salarioBruto - 528) * 0.075 - 158.4;
  if (baseIR > 0) {
    ir = baseIR * -1; // Negativo porque é desconto
  }
  
  // 9. Salário Líquido
  const salarioLiquido = salarioBruto + adicionalNoturno + drsNoturno + 
                         tempoCasa + produtividade + descValeTransporte + inss + ir;
  
  // 10. INSS Empresa (mesmo valor absoluto)
  const inssEmpresa = Math.abs(inss);
  
  // 11. FGTS = 8% da base
  const fgts = baseINSS * 0.08;
  
  // 12. Vale Transporte (custo empresa)
  const valeTransporte = funcionario.vale_transporte_diaria * diasTrabalhados;
  
  // 13. Provisão Certa = 27% da base (férias, 13º, aviso, multa FGTS)
  const provisaoCerta = baseINSS * 0.27;
  
  // 14. CUSTO-EMPRESA
  let custoEmpresa = 0;
  
  if (funcionario.tipo_contratacao === 'CLT') {
    // CLT: (soma dos encargos / 30 * dias trabalhados) + aviso prévio + adicionais
    const somaEncargos = inssEmpresa + fgts + Math.abs(descValeTransporte) + provisaoCerta + mensalidadeSindical;
    custoEmpresa = (somaEncargos / diasMes * diasTrabalhados) + avisoPrevio + adicionais;
  } else {
    // PJ: soma / 30 * dias trabalhados
    const somaPJ = salarioBruto + tempoCasa + valeTransporte + adicionais + avisoPrevio;
    custoEmpresa = (somaPJ / diasMes) * diasTrabalhados;
  }
  
  return {
    dias_trabalhados: diasTrabalhados,
    salario_bruto: salarioBruto,
    estimativa,
    adicional_noturno: adicionalNoturno,
    drs_noturno: drsNoturno,
    tempo_casa: tempoCasa,
    produtividade,
    desc_vale_transporte: descValeTransporte,
    inss,
    ir,
    salario_liquido: salarioLiquido,
    inss_empresa: inssEmpresa,
    fgts,
    vale_transporte: valeTransporte,
    provisao_certa: provisaoCerta,
    mensalidade_sindical: mensalidadeSindical,
    adicionais,
    aviso_previo: avisoPrevio,
    custo_empresa: custoEmpresa
  };
}

/**
 * GET /api/rh/folha-pagamento
 * Lista folhas de pagamento com filtros
 * Se auto_calcular=true e não existir dados, calcula automaticamente
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const mes = searchParams.get('mes');
    const ano = searchParams.get('ano');
    const funcionarioId = searchParams.get('funcionario_id');
    const autoCalcular = searchParams.get('auto_calcular') === 'true';

    if (!barId) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();
    
    let query = supabase
      .from('folha_pagamento')
      .select(`
        *,
        funcionario:funcionarios(
          id, nome, tipo_contratacao,
          area:areas(id, nome, cor),
          cargo:cargos(id, nome)
        )
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
        .select(`
          id, nome, tipo_contratacao, salario_base, vale_transporte_diaria,
          area:areas(id, nome, adicional_noturno)
        `)
        .eq('bar_id', parseInt(barId))
        .eq('ativo', true);

      if (!funcError && funcionarios && funcionarios.length > 0) {
        // Calcular folha para cada funcionário
        const folhasCalculadas = funcionarios.map(func => {
          // O Supabase retorna area como array quando é join
          const areaData = Array.isArray(func.area) ? func.area[0] : func.area;
          const dadosFuncionario: DadosFuncionario = {
            id: func.id,
            nome: func.nome,
            tipo_contratacao: func.tipo_contratacao,
            salario_base: func.salario_base,
            vale_transporte_diaria: func.vale_transporte_diaria,
            area: areaData ? { adicional_noturno: areaData.adicional_noturno || 0 } : null
          };
          
          const calculo = calcularFolhaFuncionario(
            dadosFuncionario,
            30, // dias trabalhados
            0,  // estimativa
            0,  // tempo casa
            0,  // adicionais
            0,  // aviso prévio
            0   // mensalidade sindical
          );

          return {
            bar_id: parseInt(barId),
            funcionario_id: func.id,
            mes: parseInt(mes),
            ano: parseInt(ano),
            ...calculo
          };
        });

        // Salvar automaticamente
        const { data: folhasSalvas, error: saveError } = await supabase
          .from('folha_pagamento')
          .upsert(folhasCalculadas, {
            onConflict: 'funcionario_id,mes,ano',
            ignoreDuplicates: false
          })
          .select(`
            *,
            funcionario:funcionarios(
              id, nome, tipo_contratacao,
              area:areas(id, nome, cor),
              cargo:cargos(id, nome)
            )
          `);

        if (!saveError) {
          data = folhasSalvas;
        }
      }
    }

    // Calcular totais
    const totais = {
      qtd_funcionarios: data?.length || 0,
      total_salario_liquido: 0,
      total_encargos: 0,
      total_custo_empresa: 0
    };

    data?.forEach(folha => {
      totais.total_salario_liquido += Number(folha.salario_liquido) || 0;
      totais.total_encargos += (Number(folha.inss_empresa) || 0) + (Number(folha.fgts) || 0) + (Number(folha.provisao_certa) || 0);
      totais.total_custo_empresa += Number(folha.custo_empresa) || 0;
    });

    return NextResponse.json({
      success: true,
      data: data || [],
      totais
    });

  } catch (error) {
    console.error('Erro ao listar folhas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rh/folha-pagamento
 * Calcula e salva folha de pagamento para um mês
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bar_id, mes, ano, funcionarios_ajustes } = body;

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
      .select(`
        id, nome, tipo_contratacao, salario_base, vale_transporte_diaria,
        area:areas(id, nome, adicional_noturno)
      `)
      .eq('bar_id', bar_id)
      .eq('ativo', true);

    if (funcError) throw funcError;

    if (!funcionarios || funcionarios.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum funcionário ativo encontrado' },
        { status: 404 }
      );
    }

    // Ajustes por funcionário (opcional)
    const ajustes = funcionarios_ajustes || {};

    // Calcular folha para cada funcionário
    const folhasCalculadas = funcionarios.map(func => {
      const ajuste = ajustes[func.id] || {};
      
      // O Supabase retorna area como array quando é join
      const areaData = Array.isArray(func.area) ? func.area[0] : func.area;
      const dadosFuncionario: DadosFuncionario = {
        id: func.id,
        nome: func.nome,
        tipo_contratacao: func.tipo_contratacao,
        salario_base: func.salario_base,
        vale_transporte_diaria: func.vale_transporte_diaria,
        area: areaData ? { adicional_noturno: areaData.adicional_noturno || 0 } : null
      };
      
      const calculo = calcularFolhaFuncionario(
        dadosFuncionario,
        ajuste.dias_trabalhados || 30,
        ajuste.estimativa || 0,
        ajuste.tempo_casa || 0,
        ajuste.adicionais || 0,
        ajuste.aviso_previo || 0,
        ajuste.mensalidade_sindical || 0
      );

      return {
        bar_id,
        funcionario_id: func.id,
        mes,
        ano,
        ...calculo,
        observacoes: ajuste.observacoes || null
      };
    });

    // Upsert (inserir ou atualizar)
    const { data: folhasSalvas, error: saveError } = await supabase
      .from('folha_pagamento')
      .upsert(folhasCalculadas, {
        onConflict: 'funcionario_id,mes,ano',
        ignoreDuplicates: false
      })
      .select(`
        *,
        funcionario:funcionarios(id, nome, tipo_contratacao)
      `);

    if (saveError) throw saveError;

    // Calcular totais
    const totais = {
      qtd_funcionarios: folhasSalvas?.length || 0,
      total_salario_liquido: 0,
      total_encargos: 0,
      total_custo_empresa: 0
    };

    folhasSalvas?.forEach(folha => {
      totais.total_salario_liquido += Number(folha.salario_liquido) || 0;
      totais.total_encargos += (Number(folha.inss_empresa) || 0) + (Number(folha.fgts) || 0) + (Number(folha.provisao_certa) || 0);
      totais.total_custo_empresa += Number(folha.custo_empresa) || 0;
    });

    return NextResponse.json({
      success: true,
      message: `Folha de ${mes}/${ano} calculada com sucesso`,
      data: folhasSalvas,
      totais
    });

  } catch (error) {
    console.error('Erro ao calcular folha:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/rh/folha-pagamento
 * Atualiza folha de um funcionário específico
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

    // Atualizar e recalcular custo empresa se necessário
    const { data: folhaAtual } = await supabase
      .from('folha_pagamento')
      .select('*')
      .eq('id', id)
      .single();

    if (!folhaAtual) {
      return NextResponse.json(
        { error: 'Folha não encontrada' },
        { status: 404 }
      );
    }

    const updateData = {
      ...updateFields,
      atualizado_em: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('folha_pagamento')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        funcionario:funcionarios(id, nome, tipo_contratacao)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Folha atualizada com sucesso',
      data
    });

  } catch (error) {
    console.error('Erro ao atualizar folha:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/rh/folha-pagamento
 * Remove folha de pagamento
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const barId = searchParams.get('bar_id');
    const mes = searchParams.get('mes');
    const ano = searchParams.get('ano');

    const supabase = await getAdminClient();

    if (id) {
      // Deletar por ID específico
      const { error } = await supabase
        .from('folha_pagamento')
        .delete()
        .eq('id', parseInt(id));

      if (error) throw error;
    } else if (barId && mes && ano) {
      // Deletar toda a folha do mês
      const { error } = await supabase
        .from('folha_pagamento')
        .delete()
        .eq('bar_id', parseInt(barId))
        .eq('mes', parseInt(mes))
        .eq('ano', parseInt(ano));

      if (error) throw error;
    } else {
      return NextResponse.json(
        { error: 'Forneça id ou (bar_id, mes, ano)' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Folha removida com sucesso'
    });

  } catch (error) {
    console.error('Erro ao remover folha:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
