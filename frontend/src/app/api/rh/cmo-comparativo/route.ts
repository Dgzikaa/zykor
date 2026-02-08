import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// Categorias NIBO relacionadas a CMO (normalizado para maiúsculas sem acentos)
const CATEGORIAS_CMO = [
  'SALÁRIO FUNCIONÁRIOS',
  'SALARIO FUNCIONARIOS',
  'VALE TRANSPORTE',
  'FREELA ATENDIMENTO',
  'FREELA BAR',
  'FREELA COZINHA',
  'FREELA LIMPEZA',
  'FREELA SEGURANÇA',
  'PROVISÃO TRABALHISTA',
  'PROVISAO TRABALHISTA',
  'PROVISÃO EVENTUAL',
  'PROVISAO EVENTUAL',
  'PRO LABORE'
];

interface ComparativoCMO {
  categoria: string;
  valor_nibo: number;
  valor_simulado: number;
  diferenca: number;
  percentual_diferenca: number;
}

interface ResumoComparativo {
  mes: number;
  ano: number;
  total_nibo: number;
  total_simulado: number;
  diferenca_total: number;
  percentual_diferenca: number;
  status: 'ok' | 'alerta' | 'critico';
  detalhes: ComparativoCMO[];
}

// Normaliza categoria para comparação (remove acentos, uppercase)
function normalizarCategoria(cat: string): string {
  return cat.toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * GET /api/rh/cmo-comparativo
 * Compara CMO simulado vs realizado do NIBO
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const mes = searchParams.get('mes');
    const ano = searchParams.get('ano');

    if (!barId || !mes || !ano) {
      return NextResponse.json(
        { error: 'bar_id, mes e ano são obrigatórios' },
        { status: 400 }
      );
    }

    const supabase = await getAdminClient();

    // 1. Buscar dados do NIBO via dre_manual (tabela real com lançamentos)
    const { data: dadosNibo, error: niboError } = await supabase
      .from('dre_manual')
      .select('categoria, valor')
      .gte('data_competencia', `${ano}-${String(mes).padStart(2, '0')}-01`)
      .lt('data_competencia', parseInt(mes) === 12 
        ? `${parseInt(ano) + 1}-01-01` 
        : `${ano}-${String(parseInt(mes) + 1).padStart(2, '0')}-01`);

    if (niboError) {
      console.error('Erro ao buscar dados NIBO:', niboError);
    }

    // Agrupar valores NIBO por categoria (normalizando)
    const valoresNibo = new Map<string, number>();
    dadosNibo?.forEach(item => {
      if (!item.categoria) return;
      const catNorm = normalizarCategoria(item.categoria);
      // Verificar se é categoria de CMO
      const isCMO = CATEGORIAS_CMO.some(c => normalizarCategoria(c) === catNorm);
      if (isCMO) {
        const atual = valoresNibo.get(item.categoria) || 0;
        valoresNibo.set(item.categoria, atual + Math.abs(Number(item.valor) || 0));
      }
    });

    // 2. Buscar folha de pagamento calculada
    const { data: folhaData, error: folhaError } = await supabase
      .from('folha_pagamento')
      .select(`
        salario_liquido,
        vale_transporte,
        inss_empresa,
        fgts,
        provisao_certa,
        custo_empresa,
        funcionario:funcionarios(tipo_contratacao, area:areas(nome))
      `)
      .eq('bar_id', parseInt(barId))
      .eq('mes', parseInt(mes))
      .eq('ano', parseInt(ano));

    if (folhaError) {
      console.error('Erro ao buscar folha:', folhaError);
    }

    // Agregar valores simulados por categoria
    const valoresSimulados = new Map<string, number>();
    valoresSimulados.set('SALÁRIO FUNCIONÁRIOS', 0);
    valoresSimulados.set('VALE TRANSPORTE', 0);
    valoresSimulados.set('PROVISÃO TRABALHISTA', 0);
    valoresSimulados.set('FREELA ATENDIMENTO', 0);
    valoresSimulados.set('FREELA BAR', 0);
    valoresSimulados.set('FREELA COZINHA', 0);
    valoresSimulados.set('FREELA SEGURANÇA', 0);
    valoresSimulados.set('FREELA LIMPEZA', 0);

    folhaData?.forEach((folha: any) => {
      // O Supabase retorna funcionario como array quando é join
      const funcionario = Array.isArray(folha.funcionario) ? folha.funcionario[0] : folha.funcionario;
      const tipoContrato = funcionario?.tipo_contratacao;
      const area = Array.isArray(funcionario?.area) ? funcionario?.area[0] : funcionario?.area;
      const areaNome = (area?.nome || '').toLowerCase();

      if (tipoContrato === 'PJ') {
        // PJ vai para freelas
        if (areaNome.includes('salão') || areaNome.includes('atendimento')) {
          valoresSimulados.set('FREELA ATENDIMENTO', 
            (valoresSimulados.get('FREELA ATENDIMENTO') || 0) + folha.salario_liquido);
        } else if (areaNome.includes('bar')) {
          valoresSimulados.set('FREELA BAR', 
            (valoresSimulados.get('FREELA BAR') || 0) + folha.salario_liquido);
        } else if (areaNome.includes('cozinha')) {
          valoresSimulados.set('FREELA COZINHA', 
            (valoresSimulados.get('FREELA COZINHA') || 0) + folha.salario_liquido);
        } else if (areaNome.includes('limpeza')) {
          valoresSimulados.set('FREELA LIMPEZA', 
            (valoresSimulados.get('FREELA LIMPEZA') || 0) + folha.salario_liquido);
        } else if (areaNome.includes('segurança')) {
          valoresSimulados.set('FREELA SEGURANÇA', 
            (valoresSimulados.get('FREELA SEGURANÇA') || 0) + folha.salario_liquido);
        } else {
          valoresSimulados.set('FREELA ATENDIMENTO', 
            (valoresSimulados.get('FREELA ATENDIMENTO') || 0) + folha.salario_liquido);
        }
      } else {
        // CLT vai para salários
        valoresSimulados.set('SALÁRIO FUNCIONÁRIOS', 
          (valoresSimulados.get('SALÁRIO FUNCIONÁRIOS') || 0) + folha.salario_liquido);
      }

      // Vale transporte para todos
      valoresSimulados.set('VALE TRANSPORTE', 
        (valoresSimulados.get('VALE TRANSPORTE') || 0) + folha.vale_transporte);

      // Provisões
      valoresSimulados.set('PROVISÃO TRABALHISTA', 
        (valoresSimulados.get('PROVISÃO TRABALHISTA') || 0) + folha.provisao_certa);
    });

    // 3. Montar comparativo
    const detalhes: ComparativoCMO[] = CATEGORIAS_CMO.map(categoria => {
      const valorNibo = Math.abs(valoresNibo.get(categoria) || 0);
      const valorSimulado = valoresSimulados.get(categoria) || 0;
      const diferenca = valorSimulado - valorNibo;
      const percentualDiferenca = valorNibo > 0 
        ? ((diferenca / valorNibo) * 100)
        : (valorSimulado > 0 ? 100 : 0);

      return {
        categoria,
        valor_nibo: valorNibo,
        valor_simulado: valorSimulado,
        diferenca,
        percentual_diferenca: percentualDiferenca
      };
    }).filter(d => d.valor_nibo > 0 || d.valor_simulado > 0);

    // 4. Calcular totais
    const totalNibo = detalhes.reduce((acc, d) => acc + d.valor_nibo, 0);
    const totalSimulado = detalhes.reduce((acc, d) => acc + d.valor_simulado, 0);
    const diferencaTotal = totalSimulado - totalNibo;
    const percentualDiferenca = totalNibo > 0 
      ? ((diferencaTotal / totalNibo) * 100) 
      : 0;

    // Determinar status
    let status: 'ok' | 'alerta' | 'critico' = 'ok';
    if (Math.abs(percentualDiferenca) > 20) {
      status = 'critico';
    } else if (Math.abs(percentualDiferenca) > 10) {
      status = 'alerta';
    }

    const resultado: ResumoComparativo = {
      mes: parseInt(mes),
      ano: parseInt(ano),
      total_nibo: totalNibo,
      total_simulado: totalSimulado,
      diferenca_total: diferencaTotal,
      percentual_diferenca: percentualDiferenca,
      status,
      detalhes
    };

    return NextResponse.json({
      success: true,
      data: resultado
    });

  } catch (error) {
    console.error('Erro ao comparar CMO:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
