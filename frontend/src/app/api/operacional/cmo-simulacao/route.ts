import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

const supabase = createServiceRoleClient();

// Interface para funcionário
interface Funcionario {
  nome: string;
  tipo_contratacao: 'CLT' | 'PJ';
  area: string;
  diaria: number;
  vale: number;
  salario_bruto: number;
  adicionais: number;
  aviso_previo: number;
  estimativa: number;
  tempo_casa: number;
  mensalidade_sindical: number;
  dias_trabalhados: number;
}

// Interface para simulação
interface SimulacaoCMO {
  id?: number;
  bar_id: number;
  mes: number;
  ano: number;
  funcionarios: Funcionario[];
  total_folha?: number;
  total_encargos?: number;
  total_geral?: number;
  observacoes?: string;
  criado_por?: string;
}

// Lookup de adicional noturno por área
function obterAdicionalNoturno(area: string): number {
  const adicionalPorArea: Record<string, number> = {
    'Salão': 125,
    'Bar': 125,
    'Cozinha': 115,
    'Liderança': 0,
  };
  return adicionalPorArea[area] || 0;
}

// Calcular todos os valores de um funcionário
function calcularValoresFuncionario(func: Funcionario) {
  const diasMes = 30;
  
  // 1. Salário Bruto + Estimativa
  const salarioBrutoEstimativa = func.salario_bruto + func.estimativa;
  
  // 2. Adicional Noturno (lookup por área)
  const adicionalNoturno = obterAdicionalNoturno(func.area);
  
  // 3. DRS Sobre Ads Noturno = 0,2 * adicional noturno
  const drsSobreAdsNoturno = adicionalNoturno * 0.2;
  
  // 4. Produtividade = salário bruto * 0,05
  const produtividade = func.salario_bruto * 0.05;
  
  // 5. Desc Vale Transporte = salário bruto * -0,06
  const descValeTransporte = func.salario_bruto * -0.06;
  
  // 6. INSS = soma * -0,08
  const baseINSS = salarioBrutoEstimativa + adicionalNoturno + drsSobreAdsNoturno + func.tempo_casa + produtividade;
  const inss = baseINSS * -0.08;
  
  // 7. IR = fórmula progressiva
  let ir = 0;
  const baseIR = (func.salario_bruto - 528) * 0.075 - 158.4;
  if (baseIR > 0) {
    ir = baseIR * -1; // Negativo porque é desconto
  }
  
  // 8. Salário Líquido
  const salarioLiquido = func.salario_bruto + adicionalNoturno + drsSobreAdsNoturno + 
                         func.tempo_casa + produtividade + descValeTransporte + inss + ir;
  
  // 9. Provisão Certa = soma * 0,27
  const baseProvisao = func.salario_bruto + adicionalNoturno + drsSobreAdsNoturno + func.tempo_casa + produtividade;
  const provisaoCerta = baseProvisao * 0.27;
  
  // 10. FGTS = mesmo valor absoluto do INSS
  const fgts = Math.abs(inss);
  
  // 11. CUSTO-EMPRESA
  let custoEmpresa = 0;
  
  if (func.tipo_contratacao === 'CLT') {
    // CLT: (soma dos encargos / 30 * dias trabalhados) + aviso prévio + adicionais
    const somaEncargos = Math.abs(inss) + fgts + Math.abs(descValeTransporte) + provisaoCerta + func.mensalidade_sindical;
    custoEmpresa = (somaEncargos / diasMes * func.dias_trabalhados) + func.aviso_previo + func.adicionais;
  } else {
    // PJ: soma / 30 * dias trabalhados
    const somaPJ = func.salario_bruto + func.tempo_casa + func.vale + func.adicionais + func.aviso_previo;
    custoEmpresa = (somaPJ / diasMes) * func.dias_trabalhados;
  }
  
  return {
    salarioBrutoEstimativa,
    adicionalNoturno,
    drsSobreAdsNoturno,
    produtividade,
    descValeTransporte,
    inss,
    ir,
    salarioLiquido,
    provisaoCerta,
    fgts,
    custoEmpresa
  };
}

// Calcular totais de uma simulação
function calcularTotais(funcionarios: Funcionario[]) {
  let totalSalarioLiquido = 0;
  let totalCustoEmpresa = 0;
  
  funcionarios.forEach(func => {
    const valores = calcularValoresFuncionario(func);
    totalSalarioLiquido += valores.salarioLiquido;
    totalCustoEmpresa += valores.custoEmpresa;
  });
  
  return {
    total_folha: totalSalarioLiquido,
    total_encargos: totalCustoEmpresa - totalSalarioLiquido,
    total_geral: totalCustoEmpresa
  };
}

// GET - Buscar simulações
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bar_id = searchParams.get('bar_id');
    const mes = searchParams.get('mes');
    const ano = searchParams.get('ano');
    const id = searchParams.get('id');

    // Buscar simulação específica por ID
    if (id) {
      const { data, error } = await supabase
        .from('simulacoes_cmo')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        data
      });
    }

    // Buscar simulações por bar_id
    if (!bar_id) {
      return NextResponse.json(
        { success: false, error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('simulacoes_cmo')
      .select('*')
      .eq('bar_id', bar_id)
      .order('ano', { ascending: false })
      .order('mes', { ascending: false });

    if (mes) query = query.eq('mes', mes);
    if (ano) query = query.eq('ano', ano);

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Erro ao buscar simulações CMO:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar simulações' },
      { status: 500 }
    );
  }
}

// POST - Criar ou atualizar simulação
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bar_id, mes, ano, funcionarios, observacoes, criado_por } = body as SimulacaoCMO;

    if (!bar_id || !mes || !ano || !funcionarios) {
      return NextResponse.json(
        { success: false, error: 'Campos obrigatórios: bar_id, mes, ano, funcionarios' },
        { status: 400 }
      );
    }

    // Calcular totais
    const totais = calcularTotais(funcionarios);

    const registro = {
      bar_id,
      mes,
      ano,
      funcionarios,
      total_folha: totais.total_folha,
      total_encargos: totais.total_encargos,
      total_geral: totais.total_geral,
      observacoes,
      criado_por,
      atualizado_em: new Date().toISOString()
    };

    // Verificar se já existe simulação para este bar/mes/ano
    const { data: existente } = await supabase
      .from('simulacoes_cmo')
      .select('id')
      .eq('bar_id', bar_id)
      .eq('mes', mes)
      .eq('ano', ano)
      .single();

    let result;

    if (existente) {
      // Atualizar existente
      result = await supabase
        .from('simulacoes_cmo')
        .update(registro)
        .eq('id', existente.id)
        .select()
        .single();
    } else {
      // Criar novo
      result = await supabase
        .from('simulacoes_cmo')
        .insert(registro)
        .select()
        .single();
    }

    if (result.error) throw result.error;

    return NextResponse.json({
      success: true,
      data: result.data,
      message: existente ? 'Simulação atualizada com sucesso' : 'Simulação criada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao salvar simulação CMO:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao salvar simulação' },
      { status: 500 }
    );
  }
}

// DELETE - Excluir simulação
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID é obrigatório' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('simulacoes_cmo')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Simulação excluída com sucesso'
    });

  } catch (error) {
    console.error('Erro ao excluir simulação CMO:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao excluir simulação' },
      { status: 500 }
    );
  }
}

