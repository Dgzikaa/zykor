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
    const year = searchParams.get('year') || new Date().getFullYear().toString();
    const month = searchParams.get('month') || (new Date().getMonth() + 1).toString();
    const barId = searchParams.get('bar_id');

    // Buscar dados da view_dre para o mês específico
    const { data: dreData, error: dreError } = await supabase
      .from('view_dre')
      .select('*')
      .eq('ano', parseInt(year))
      .eq('mes', parseInt(month));

    if (dreError) {
      console.error('Erro ao buscar view_dre:', dreError);
      return NextResponse.json(
        { error: 'Erro ao buscar dados da DRE' },
        { status: 500 }
      );
    }

    // Buscar categorias para detalhamento
    const { data: categorias, error: catError } = await supabase
      .from('nibo_categorias')
      .select('*')
      .eq('ativo', true);

    if (catError) {
      console.error('Erro ao buscar categorias:', catError);
    }

    // Buscar lançamentos manuais do mês
    const { data: lancamentosManuais, error: manuaisError } = await supabase
      .from('dre_manual')
      .select('*')
      .gte('data_competencia', `${year}-${month.padStart(2, '0')}-01`)
      .lt('data_competencia', month === '12' 
        ? `${parseInt(year) + 1}-01-01` 
        : `${year}-${(parseInt(month) + 1).toString().padStart(2, '0')}-01`);

    if (manuaisError) {
      console.error('Erro ao buscar lançamentos manuais:', manuaisError);
    }

    // Agrupar categorias por macro
    const categoriasPorMacro: Record<string, string[]> = {};
    categorias?.forEach(cat => {
      if (!categoriasPorMacro[cat.categoria_macro]) {
        categoriasPorMacro[cat.categoria_macro] = [];
      }
      categoriasPorMacro[cat.categoria_macro].push(cat.categoria_nome);
    });

    // Consolidar dados por macro-categoria
    const totaisPorMacro: Record<string, { 
      total_entradas: number; 
      total_saidas: number; 
      categorias: Record<string, { entradas: number; saidas: number }> 
    }> = {};

    // Inicializar
    ORDEM_MACRO.forEach(macro => {
      totaisPorMacro[macro] = { 
        total_entradas: 0, 
        total_saidas: 0, 
        categorias: {} 
      };
      // Inicializar subcategorias
      categoriasPorMacro[macro]?.forEach(cat => {
        totaisPorMacro[macro].categorias[cat] = { entradas: 0, saidas: 0 };
      });
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

    // Processar lançamentos manuais com detalhamento de subcategorias
    lancamentosManuais?.forEach(item => {
      const macro = item.categoria_macro;
      const categoria = item.categoria;
      const valor = parseFloat(item.valor) || 0;
      
      if (totaisPorMacro[macro]) {
        if (!totaisPorMacro[macro].categorias[categoria]) {
          totaisPorMacro[macro].categorias[categoria] = { entradas: 0, saidas: 0 };
        }
        
        if (valor > 0) {
          totaisPorMacro[macro].total_entradas += valor;
          totaisPorMacro[macro].categorias[categoria].entradas += valor;
        } else {
          totaisPorMacro[macro].total_saidas += Math.abs(valor);
          totaisPorMacro[macro].categorias[categoria].saidas += Math.abs(valor);
        }
      }
    });

    // Converter para formato esperado
    const macroCategorias = ORDEM_MACRO.map(macroNome => {
      const dados = totaisPorMacro[macroNome];
      return {
        nome: macroNome,
        tipo: macroNome === 'Receita' || macroNome === 'Não Operacionais' ? 'entrada' : 'saida',
        total_entradas: dados.total_entradas,
        total_saidas: dados.total_saidas,
        categorias: Object.entries(dados.categorias)
          .filter(([_, valores]) => valores.entradas > 0 || valores.saidas > 0)
          .map(([nome, valores]) => ({
            nome,
            entradas: valores.entradas,
            saidas: valores.saidas,
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

    return NextResponse.json({
      success: true,
      macroCategorias,
      entradasTotais,
      saidasTotais,
      saldo: entradasTotais - saidasTotais,
      ebitda: entradasTotais - saidasTotais,
      periodo: { year: parseInt(year), month: parseInt(month) },
    });
  } catch (error) {
    console.error('Erro ao buscar DRE mensal detalhada:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
