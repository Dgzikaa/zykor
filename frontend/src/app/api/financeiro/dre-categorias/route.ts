import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Mapeamento de categoria individual → macro-categoria DRE
function getCategoriaMacro(categoriaNome: string): string | null {
  const nome = categoriaNome?.trim();
  if (!nome) return null;

  if (['Stone', 'Stone Pix', 'Stone Crédito', 'Stone Débito', 'Dinheiro',
    'Pix Direto na Conta', 'ADICIONAIS', 'Receita de Eventos', 'Receitas de Eventos',
    'Receitas de Serviços', 'Outras Receitas', 'RECEITA DEBOCHE PRODUÇÕES',
    'DEBOCHE PRODUÇÕES', 'Descontos Recebidos', 'Transf. de entrada', 'Estorno', 'Ifood'
  ].includes(nome)) return 'Receita';

  if (['Custo Bebidas', 'CUSTO BEBIDAS', 'Custo Bebidas (Excluído)',
    'Custo Comida', 'CUSTO COMIDA', 'CUSTO COMIDAS',
    'Custo Drinks', 'CUSTO DRINKS',
    'Custo Outros', 'CUSTO OUTROS', 'Materiais para Revenda'
  ].includes(nome)) return 'Custo insumos (CMV)';

  if (['TAXA MAQUININHA', 'Imposto', 'IMPOSTO', 'Descontos Concedidos'
  ].includes(nome)) return 'Custos Variáveis';

  if (['FREELA ATENDIMENTO', 'FREELA BAR', 'FREELA COZINHA', 'FREELA LIMPEZA', 'FREELA SEGURANÇA',
    'SALÁRIO FUNCIONÁRIOS', 'SALARIO FUNCIONARIOS',
    'VALE TRANSPORTE', 'Alimentação', 'ALIMENTAÇÃO', 'Plano de Saúde',
    'PRO LABORE', 'PROVISÃO EVENTUAL', 'PROVISÃO TRABALHISTA',
    'Recursos Humanos', 'RECURSOS HUMANOS', 'SEGURANÇA', 'COMISSÃO 10%'
  ].includes(nome)) return 'Mão-de-Obra';

  if (['Atrações Programação', 'Atrações/Eventos', 'Produção Eventos',
    'Marketing', 'Marketing e Publicidade'
  ].includes(nome)) return 'Despesas Comerciais';

  if (['Adm', 'Administrativo Deboche', 'Administrativo Ordinário',
    'Consultoria', 'Escritório Central', 'Repasse Noruh', 'Despesas Grupo Bizu'
  ].includes(nome)) return 'Despesas Administrativas';

  if (['Contratos', 'Contratos Anuais', 'Manutenção', 'MANUTENÇÃO',
    'Materiais de Limpeza e Descartáveis', 'Materiais Operação',
    'Outras despesas', 'Outros Operação', 'OUTROS OPERAÇÃO',
    'UTENSILIOS', 'Utensílios'
  ].includes(nome)) return 'Despesas Operacionais';

  if (['ÁGUA', 'ALUGUEL/CONDOMÍNIO/IPTU', 'Energia Elétrica', 'GÁS', 'INTERNET', 'LUZ'
  ].includes(nome)) return 'Despesas de Ocupação (Contas)';

  if (['[Investimento] Equipamentos', '[Investimento] Equipamentos R',
    '[Investimento] Obras', '[Investimento] Outros Investimentos',
    'Contratos Investimento', 'Equipamentos', 'Obras',
    'Outros Investimentos', 'Provisões Investimentos', 'Investimento Escritório Central'
  ].includes(nome)) return 'Investimentos';

  if (['Aporte de capital', 'Dividendos', 'DIVIDENDOS', 'Empréstimos de Sócios', 'Outros Sócios'
  ].includes(nome)) return 'Sócios';

  if (['CDB/CDI', 'Despesas Financeiras', 'DESPESAS FINANCEIRAS',
    'Juros pagos', 'Juros recebidos', 'Multas pagas', 'Multas recebidas', 'Rendimentos'
  ].includes(nome)) return 'Não Operacionais';

  // Transferências internas — excluir da DRE
  if (['Transf. de Saida', 'Pix (Excluído)'].includes(nome)) return null;

  return 'Outras Despesas';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const ano = searchParams.get('ano');
    const mes = searchParams.get('mes');

    let query = supabase
      .schema('bronze' as any)
      .from('bronze_contaazul_lancamentos')
      .select('categoria_nome, valor_bruto, bar_id')
      .is('excluido_em', null);

    if (barId) query = query.eq('bar_id', parseInt(barId));
    if (ano && mes) {
      const anoN = parseInt(ano);
      const mesN = parseInt(mes);
      const inicioMes = `${anoN}-${String(mesN).padStart(2, '0')}-01`;
      const fimMes = mesN === 12
        ? `${anoN + 1}-01-01`
        : `${anoN}-${String(mesN + 1).padStart(2, '0')}-01`;
      query = query.gte('data_competencia', inicioMes).lt('data_competencia', fimMes);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Agregar por categoria_nome com totais
    const agregado = new Map<string, { macro: string; entradas: number; saidas: number }>();

    for (const row of data || []) {
      const nome = row.categoria_nome?.trim();
      if (!nome) continue;
      const macro = getCategoriaMacro(nome);
      if (!macro) continue;

      const valor = parseFloat(row.valor_bruto) || 0;
      if (!agregado.has(nome)) {
        agregado.set(nome, { macro, entradas: 0, saidas: 0 });
      }
      const entry = agregado.get(nome)!;
      if (valor >= 0) {
        entry.entradas += valor;
      } else {
        entry.saidas += Math.abs(valor);
      }
    }

    // Organizar por macro-categoria
    const categoriasPorMacro: Record<string, Array<{ categoria_nome: string; entradas: number; saidas: number }>> = {};

    for (const [nome, { macro, entradas, saidas }] of agregado.entries()) {
      if (!categoriasPorMacro[macro]) categoriasPorMacro[macro] = [];
      categoriasPorMacro[macro].push({ categoria_nome: nome, entradas, saidas });
    }

    // Ordenar subcategorias por valor total decrescente
    for (const macro of Object.keys(categoriasPorMacro)) {
      categoriasPorMacro[macro].sort((a, b) => (b.entradas + b.saidas) - (a.entradas + a.saidas));
    }

    return NextResponse.json({ success: true, categorias_por_macro: categoriasPorMacro });
  } catch (error: any) {
    console.error('[DRE-CATEGORIAS] Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
