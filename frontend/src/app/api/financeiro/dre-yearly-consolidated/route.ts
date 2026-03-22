import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Ordem das macro-categorias
const ORDEM_MACRO = [
  'Receita',
  'Custos Variáveis',
  'Custo insumos (CMV)',
  'Mão-de-Obra',
  'Despesas Comerciais',
  'Despesas Administrativas',
  'Despesas Operacionais',
  'Despesas de Ocupação (Contas)',
  'Não Operacionais',
  'Investimentos',
  'Sócios',
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ano = searchParams.get('year') || new Date().getFullYear().toString();
    const barId = searchParams.get('bar_id');

    // Buscar dados da view_dre para o ano inteiro
    const { data: dreData, error: dreError } = await supabase
      .from('view_dre')
      .select('*')
      .eq('ano', parseInt(ano));

    if (dreError) {
      console.error('Erro ao buscar view_dre:', dreError);
      return NextResponse.json(
        { error: 'Erro ao buscar dados da DRE' },
        { status: 500 }
      );
    }

    // Buscar lançamentos manuais do ano
    const { data: lancamentosManuais, error: manuaisError } = await supabase
      .from('dre_manual')
      .select('*')
      .gte('data_competencia', `${ano}-01-01`)
      .lt('data_competencia', `${parseInt(ano) + 1}-01-01`);

    if (manuaisError) {
      console.error('Erro ao buscar lançamentos manuais:', manuaisError);
    }

    // Consolidar dados por macro-categoria
    const totaisPorMacro: Record<string, { total_entradas: number; total_saidas: number; categorias: Record<string, number> }> = {};

    // Inicializar todas as macro-categorias
    ORDEM_MACRO.forEach(macro => {
      totaisPorMacro[macro] = { total_entradas: 0, total_saidas: 0, categorias: {} };
    });

    // Processar dados da view_dre
    dreData?.forEach(item => {
      const macro = item.categoria_macro;
      const valor = parseFloat(item.total_valor) || 0;
      
      if (totaisPorMacro[macro]) {
        if (macro === 'Receita' || macro === 'Não Operacionais') {
          totaisPorMacro[macro].total_entradas += valor;
        } else {
          totaisPorMacro[macro].total_saidas += valor;
        }
      }
    });

    // Adicionar lançamentos manuais
    lancamentosManuais?.forEach(item => {
      const macro = item.categoria_macro;
      const valor = parseFloat(item.valor) || 0;
      
      if (totaisPorMacro[macro]) {
        if (valor > 0) {
          totaisPorMacro[macro].total_entradas += valor;
        } else {
          totaisPorMacro[macro].total_saidas += Math.abs(valor);
        }
        
        // Adicionar à subcategoria
        if (!totaisPorMacro[macro].categorias[item.categoria]) {
          totaisPorMacro[macro].categorias[item.categoria] = 0;
        }
        totaisPorMacro[macro].categorias[item.categoria] += Math.abs(valor);
      }
    });

    // Converter para formato esperado pela página
    const macroCategorias = ORDEM_MACRO.map(macroNome => {
      const dados = totaisPorMacro[macroNome];
      return {
        nome: macroNome,
        tipo: macroNome === 'Receita' || macroNome === 'Não Operacionais' ? 'entrada' : 'saida',
        total_entradas: dados.total_entradas,
        total_saidas: dados.total_saidas,
        categorias: Object.entries(dados.categorias).map(([nome, valor]) => ({
          nome,
          entradas: macroNome === 'Receita' || macroNome === 'Não Operacionais' ? valor : 0,
          saidas: macroNome === 'Receita' || macroNome === 'Não Operacionais' ? 0 : valor,
        })),
      };
    }).filter(macro => macro.total_entradas > 0 || macro.total_saidas > 0);

    // Calcular totais
    const entradasTotais = macroCategorias
      .filter(m => m.tipo === 'entrada')
      .reduce((sum, m) => sum + m.total_entradas, 0);

    const saidasTotais = macroCategorias
      .filter(m => m.tipo === 'saida')
      .reduce((sum, m) => sum + m.total_saidas, 0);

    const ebitda = entradasTotais - saidasTotais + 
      (totaisPorMacro['Investimentos']?.total_saidas || 0) + 
      (totaisPorMacro['Sócios']?.total_saidas || 0);

    return NextResponse.json({
      success: true,
      macroCategorias,
      entradasTotais,
      saidasTotais,
      saldo: entradasTotais - saidasTotais,
      ebitda,
      periodo: { ano: parseInt(ano) },
      estatisticas: {
        total_categorias: macroCategorias.length,
        categorias_com_manual: lancamentosManuais?.length || 0,
        total_lancamentos_manuais: lancamentosManuais?.length || 0,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar DRE consolidada:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
