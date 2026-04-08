import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'

// Função para buscar dados com paginação (contorna limite de 1000 do Supabase)
async function fetchAllData(supabase: any, tableName: string, columns: string, filters: any = {}) {
  let allData: any[] = [];
  let from = 0;
  const limit = 1000;
  
  const MAX_ITERATIONS = 1000;
  let iterations = 0;
  while (iterations < MAX_ITERATIONS) {
    iterations++;
    let query = supabase
      .from(tableName)
      .select(columns)
      .range(from, from + limit - 1);
    
    // Aplicar filtros
    Object.entries(filters).forEach(([key, value]) => {
      if (key.includes('gte_')) {
        query = query.gte(key.replace('gte_', ''), value);
      } else if (key.includes('lte_')) {
        query = query.lte(key.replace('lte_', ''), value);
      } else if (key.includes('eq_')) {
        query = query.eq(key.replace('eq_', ''), value);
      } else if (key.includes('in_')) {
        query = query.in(key.replace('in_', ''), value);
      }
    });
    
    const { data, error } = await query;
    
    if (error) {
      console.error(`❌ Erro ao buscar ${tableName}:`, error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    allData.push(...data);
    
    if (data.length < limit) break; // Última página
    
    from += limit;
  }
  
  return allData;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const ano = searchParams.get('ano') || '2025';
    const mes = searchParams.get('mes'); // Se não especificado, busca o ano todo

    if (!barId) {
      return NextResponse.json(
        { success: false, error: 'Bar ID é obrigatório' },
        { status: 400 }
      );
    }

    // Usar service_role para dados administrativos (bypass RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Definir período de busca
    let startDate: string;
    let endDate: string;

    if (mes) {
      // Buscar apenas o mês específico
      const mesNum = parseInt(mes);
      startDate = `${ano}-${mesNum.toString().padStart(2, '0')}-01`;
      const ultimoDia = new Date(parseInt(ano), mesNum, 0).getDate();
      endDate = `${ano}-${mesNum.toString().padStart(2, '0')}-${ultimoDia}`;
    } else {
      // Buscar o ano todo
      startDate = `${ano}-01-01`;
      endDate = `${ano}-12-31`;
    }

    // Buscar lan�amentos do Conta Azul para o período
    const lancamentosData = await fetchAllData(supabase, 'contaazul_lancamentos', 'categoria_nome, status, valor_bruto, data_competencia, data_pagamento', {
      'eq_bar_id': parseInt(barId),
      'gte_data_competencia': startDate,
      'lte_data_competencia': endDate
    });

    // Mapa de categorias problemáticas que o usuário mencionou
    const categoriasProblematicas = [
      'CUSTO-EMPRESA FUNCIONÁRIOS',
      'FUNCIONÁRIOS', 
      'SALÁRIOS',
      'IMPOSTO/TX MAQ/COMISSÃO',
      'CMV',
      'PRO LABORE',
      'ESCRITÓRIO CENTRAL',
      'ALUGUEL/CONDOMÍNIO/IPTU',
      'CONTRATOS'
    ];

    // Agrupar categorias disponíveis
    const categoriasDisponiveis = new Map<string, any>();
    const categoriasNaoEncontradas: string[] = [];

    // Análise das categorias disponíveis no banco
    lancamentosData?.forEach(item => {
      if (!item.categoria_nome) return;
      
      const categoria = item.categoria_nome;
      if (!categoriasDisponiveis.has(categoria)) {
        categoriasDisponiveis.set(categoria, {
          nome: categoria,
          total_registros: 0,
          total_valor: 0,
          registros_pagos: 0,
          valor_pago: 0,
          subcategorias: new Set()
        });
      }
      
      const cat = categoriasDisponiveis.get(categoria);
      cat.total_registros++;
      cat.total_valor += Math.abs(parseFloat(item.valor_bruto) || 0);
      
      if (item.status === 'PAGO' || item.status === 'LIQUIDADO') {
        cat.registros_pagos++;
        cat.valor_pago += Math.abs(parseFloat(item.valor_bruto) || 0);
      }
    });

    // Verificar quais categorias problemáticas não foram encontradas
    categoriasProblematicas.forEach(catProblematica => {
      let encontrada = false;
      
      // Busca exata
      if (categoriasDisponiveis.has(catProblematica)) {
        encontrada = true;
      }
      
      // Busca parcial/similar
      if (!encontrada) {
        for (const [categoria] of categoriasDisponiveis) {
          const catUpper = categoria.toUpperCase();
          const problematicaUpper = catProblematica.toUpperCase();
          
          // Verificar se contém parte do nome
          if (catUpper.includes(problematicaUpper) || 
              problematicaUpper.includes(catUpper) ||
              // Verificações específicas
              (problematicaUpper.includes('FUNCIONÁRIOS') && catUpper.includes('FUNCIONARIO')) ||
              (problematicaUpper.includes('SALÁRIOS') && catUpper.includes('SALARIO')) ||
              (problematicaUpper.includes('CMV') && (catUpper.includes('CUSTO') && (catUpper.includes('BEBIDA') || catUpper.includes('COMIDA') || catUpper.includes('DRINK')))) ||
              (problematicaUpper.includes('IMPOSTO') && catUpper.includes('IMPOSTO')) ||
              (problematicaUpper.includes('ALUGUEL') && catUpper.includes('ALUGUEL'))
          ) {
            encontrada = true;
            break;
          }
        }
      }
      
      if (!encontrada) {
        categoriasNaoEncontradas.push(catProblematica);
      }
    });

    // Converter Map para Array para retorno
    const categoriasArray = Array.from(categoriasDisponiveis.entries()).map(([nome, dados]) => ({
      nome,
      total_registros: dados.total_registros,
      total_valor: dados.total_valor,
      registros_pagos: dados.registros_pagos,
      valor_pago: dados.valor_pago,
      subcategorias: Array.from(dados.subcategorias),
      percentual_pago: dados.total_valor > 0 ? (dados.valor_pago / dados.total_valor * 100) : 0
    })).sort((a, b) => b.total_valor - a.total_valor);

    // Análise de mapeamento para categorias similares
    const sugestoesMapeamento: any[] = [];
    
    categoriasNaoEncontradas.forEach(catNaoEncontrada => {
      const sugestoes: any[] = [];
      
      categoriasArray.forEach(catDisponivel => {
        const score = calcularSimilaridade(catNaoEncontrada, catDisponivel.nome);
        if (score > 30) { // Threshold de similaridade
          sugestoes.push({
            categoria_disponivel: catDisponivel.nome,
            score_similaridade: score,
            total_valor: catDisponivel.total_valor
          });
        }
      });
      
      sugestoesMapeamento.push({
        categoria_nao_encontrada: catNaoEncontrada,
        sugestoes: sugestoes.sort((a, b) => b.score_similaridade - a.score_similaridade).slice(0, 3)
      });
    });

    return NextResponse.json({
      success: true,
      periodo: { inicio: startDate, fim: endDate },
      total_registros: lancamentosData?.length || 0,
      categorias_disponiveis: categoriasArray,
      categorias_nao_encontradas: categoriasNaoEncontradas,
      sugestoes_mapeamento: sugestoesMapeamento,
      resumo: {
        total_categorias: categoriasArray.length,
        total_valor_periodo: categoriasArray.reduce((sum, cat) => sum + cat.total_valor, 0),
        total_valor_pago: categoriasArray.reduce((sum, cat) => sum + cat.valor_pago, 0),
        categorias_problematicas_encontradas: categoriasProblematicas.length - categoriasNaoEncontradas.length,
        categorias_problematicas_total: categoriasProblematicas.length
      }
    });

  } catch (error) {
    console.error('❌ Erro na análise detalhada:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Função para calcular similaridade entre strings
function calcularSimilaridade(str1: string, str2: string): number {
  const s1 = str1.toUpperCase();
  const s2 = str2.toUpperCase();
  
  // Verificações específicas
  if (s1.includes('FUNCIONÁRIOS') && s2.includes('FUNCIONARIO')) return 90;
  if (s1.includes('SALÁRIOS') && s2.includes('SALARIO')) return 90;
  if (s1.includes('IMPOSTO') && s2.includes('IMPOSTO')) return 95;
  if (s1.includes('ALUGUEL') && s2.includes('ALUGUEL')) return 95;
  if (s1.includes('CMV') && s2.includes('CUSTO')) return 70;
  if (s1.includes('PRO LABORE') && s2.includes('PRO LABORE')) return 95;
  
  // Similaridade básica por caracteres comuns
  const commonChars = s1.split('').filter(char => s2.includes(char)).length;
  const maxLength = Math.max(s1.length, s2.length);
  
  return (commonChars / maxLength) * 100;
}

