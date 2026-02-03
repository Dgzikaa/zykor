import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'

// Estrutura base das categorias
const ESTRUTURA_CATEGORIAS = [
  {
    nome: 'Receitas',
    cor: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    tipo: 'receita',
    subcategorias: ['RECEITA BRUTA', 'CONTRATOS']
  },
  {
    nome: 'Despesas Variáveis (%)',
    cor: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
    tipo: 'despesa',
    subcategorias: ['IMPOSTO/TX MAQ/COMISSAO']
  },
  {
    nome: 'CMV (%)',
    cor: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
    tipo: 'despesa',
    subcategorias: ['CMV']
  },
  {
    nome: 'Pessoal',
    cor: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
    tipo: 'despesa',
    subcategorias: [
      'CUSTO-EMPRESA FUNCIONÁRIOS',
      'ADICIONAIS',
      'FREELA ATENDIMENTO',
      'FREELA BAR',
      'FREELA COZINHA',
      'FREELA LIMPEZA',
      'FREELA SEGURANÇA',
      'PRO LABORE'
    ]
  },
  {
    nome: 'Administrativas',
    cor: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
    tipo: 'despesa',
    subcategorias: ['Escritório Central', 'Administrativo Ordinário', 'RECURSOS HUMANOS', 'VALE TRANSPORTE']
  },
  {
    nome: 'Marketing e Eventos',
    cor: 'bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300',
    tipo: 'despesa',
    subcategorias: ['Marketing', 'Atrações Programação', 'Produção Eventos']
  },
  {
    nome: 'Operacionais',
    cor: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300',
    tipo: 'despesa',
    subcategorias: [
      'Materiais Operação',
      'Estorno',
      'Equipamentos Operação',
      'Materiais de Limpeza e Descartáveis',
      'Utensílios'
    ]
  },
  {
    nome: 'Ocupação',
    cor: 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300',
    tipo: 'despesa',
    subcategorias: ['ALUGUEL/CONDOMÍNIO/IPTU', 'ÁGUA', 'GÁS', 'INTERNET', 'Manutenção', 'LUZ']
  }
];

// Mapeamento de categorias NIBO para categorias do orçamento
const CATEGORIAS_MAP = new Map([
  // Despesas Variáveis
  ['IMPOSTO/TX MAQ/COMISSAO', 'IMPOSTO/TX MAQ/COMISSAO'],
  ['IMPOSTO', 'IMPOSTO/TX MAQ/COMISSAO'],
  ['TAXA MAQUININHA', 'IMPOSTO/TX MAQ/COMISSAO'],
  ['COMISSÃO', 'IMPOSTO/TX MAQ/COMISSAO'],
  ['COMISSAO', 'IMPOSTO/TX MAQ/COMISSAO'],
  ['COMISSÃO 10%', 'IMPOSTO/TX MAQ/COMISSAO'],
  
  // CMV
  ['Custo Comida', 'CMV'],
  ['Custo Drinks', 'CMV'],
  ['Custo Bebidas', 'CMV'],
  ['CUSTO COMIDA', 'CMV'],
  ['CUSTO DRINKS', 'CMV'],
  ['CUSTO BEBIDAS', 'CMV'],
  
  // Pessoal
  ['CUSTO-EMPRESA FUNCIONÁRIOS', 'CUSTO-EMPRESA FUNCIONÁRIOS'],
  ['CUSTO-EMPRESA FUNCIONARIOS', 'CUSTO-EMPRESA FUNCIONÁRIOS'],
  ['SALARIO FUNCIONARIOS', 'CUSTO-EMPRESA FUNCIONÁRIOS'],
  ['SALÁRIO FUNCIONÁRIOS', 'CUSTO-EMPRESA FUNCIONÁRIOS'],
  ['PROVISÃO TRABALHISTA', 'CUSTO-EMPRESA FUNCIONÁRIOS'],
  ['PROVISAO TRABALHISTA', 'CUSTO-EMPRESA FUNCIONÁRIOS'],
  ['FREELA SEGURANÇA', 'FREELA SEGURANÇA'],
  ['FREELA SEGURANCA', 'FREELA SEGURANÇA'],
  ['FREELA ATENDIMENTO', 'FREELA ATENDIMENTO'],
  ['FREELA COZINHA', 'FREELA COZINHA'],
  ['FREELA BAR', 'FREELA BAR'],
  ['FREELA LIMPEZA', 'FREELA LIMPEZA'],
  ['ADICIONAIS', 'ADICIONAIS'],
  ['PRO LABORE', 'PRO LABORE'],
  ['VALE TRANSPORTE', 'VALE TRANSPORTE'],
  
  // Administrativas
  ['RECURSOS HUMANOS', 'RECURSOS HUMANOS'],
  ['Administrativo Ordinário', 'Administrativo Ordinário'],
  ['ADMINISTRATIVO', 'Administrativo Ordinário'],
  ['Escritório Central', 'Escritório Central'],
  ['ESCRITÓRIO CENTRAL', 'Escritório Central'],
  
  // Ocupação
  ['ALUGUEL/CONDOMÍNIO/IPTU', 'ALUGUEL/CONDOMÍNIO/IPTU'],
  ['ALUGUEL', 'ALUGUEL/CONDOMÍNIO/IPTU'],
  ['LUZ', 'LUZ'],
  ['ÁGUA', 'ÁGUA'],
  ['AGUA', 'ÁGUA'],
  ['GÁS', 'GÁS'],
  ['GAS', 'GÁS'],
  ['INTERNET', 'INTERNET'],
  
  // Operacionais
  ['Manutenção', 'Manutenção'],
  ['MANUTENÇÃO', 'Manutenção'],
  ['Materiais de Limpeza e Descartáveis', 'Materiais de Limpeza e Descartáveis'],
  ['MATERIAIS DE LIMPEZA E DESCARTÁVEIS', 'Materiais de Limpeza e Descartáveis'],
  ['Materiais Operação', 'Materiais Operação'],
  ['MATERIAIS OPERAÇÃO', 'Materiais Operação'],
  ['Equipamentos Operação', 'Equipamentos Operação'],
  ['EQUIPAMENTOS OPERAÇÃO', 'Equipamentos Operação'],
  ['Utensílios', 'Utensílios'],
  ['UTENSÍLIOS', 'Utensílios'],
  ['Estorno', 'Estorno'],
  ['ESTORNO', 'Estorno'],
  
  // Marketing e Eventos
  ['Marketing', 'Marketing'],
  ['MARKETING', 'Marketing'],
  ['Produção Eventos', 'Produção Eventos'],
  ['PRODUÇÃO EVENTOS', 'Produção Eventos'],
  ['Atrações Programação', 'Atrações Programação'],
  ['ATRAÇÕES PROGRAMAÇÃO', 'Atrações Programação'],
  ['ATRAÇÕES', 'Atrações Programação'],
  
  // Receitas
  ['RECEITA BRUTA', 'RECEITA BRUTA'],
  ['RECEITA', 'RECEITA BRUTA'],
  ['FATURAMENTO', 'RECEITA BRUTA'],
  ['VENDAS', 'RECEITA BRUTA'],
  
  // Contratos
  ['CONTRATOS', 'CONTRATOS'],
  ['CONTRATO', 'CONTRATOS'],
  ['Contratos', 'CONTRATOS'],
  ['OUTRAS RECEITAS', 'CONTRATOS'],
  ['Outras Receitas', 'CONTRATOS'],
  ['Ambev Bonificações Contrato Anual', 'CONTRATOS'],
  ['Ambev Bonificação Contrato Cash-back Março', 'CONTRATOS'],
  ['Ambev Bonificação Contrato Cash-back Fevereiro', 'CONTRATOS'],
  ['Ambev Bonificação Contrato Cash-back Junho', 'CONTRATOS'],
  ['Ambev Bonificação Contrato Cash-back Julho', 'CONTRATOS'],
]);

// Nomes dos meses
const MESES_NOMES = [
  '', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

// Categorias percentuais (calculadas como % da receita)
const CATEGORIAS_PERCENTUAIS = ['IMPOSTO/TX MAQ/COMISSAO', 'CMV'];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const ano = searchParams.get('ano');
    const mesInicio = searchParams.get('mes_inicio') || '1';
    const quantidade = parseInt(searchParams.get('quantidade') || '6');

    if (!barId || !ano) {
      return NextResponse.json(
        { success: false, error: 'Parâmetros obrigatórios não fornecidos' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const anoNum = parseInt(ano);
    const mesInicioNum = parseInt(mesInicio);
    
    // Calcular meses a buscar (pode cruzar anos)
    const mesesParaBuscar: { mes: number; ano: number }[] = [];
    for (let i = 0; i < quantidade; i++) {
      let mesAtual = mesInicioNum + i;
      let anoAtual = anoNum;
      
      if (mesAtual > 12) {
        mesAtual = mesAtual - 12;
        anoAtual = anoNum + 1;
      }
      
      mesesParaBuscar.push({ mes: mesAtual, ano: anoAtual });
    }

    // Buscar dados planejados de todos os meses de uma vez
    const anosUnicos = [...new Set(mesesParaBuscar.map(m => m.ano))];
    
    const { data: dadosPlanejados, error: errorPlanejado } = await supabase
      .from('orcamentacao')
      .select('*')
      .eq('bar_id', parseInt(barId))
      .in('ano', anosUnicos);

    if (errorPlanejado) {
      console.error('Erro ao buscar dados planejados:', errorPlanejado);
    }

    // Calcular range de datas para buscar NIBO
    const mesMin = Math.min(...mesesParaBuscar.map(m => m.mes));
    const mesMax = Math.max(...mesesParaBuscar.map(m => m.mes));
    const anoMin = Math.min(...anosUnicos);
    const anoMax = Math.max(...anosUnicos);

    // Calcular último dia do mês corretamente
    const ultimoDiaMes = new Date(anoMax, mesMax, 0).getDate();
    
    const dataInicio = `${anoMin}-${String(mesMin).padStart(2, '0')}-01`;
    const dataFim = `${anoMax}-${String(mesMax).padStart(2, '0')}-${String(ultimoDiaMes).padStart(2, '0')}`;

    // Buscar TODOS os lançamentos do NIBO (para projeção)
    const { data: dadosNiboTodos, error: errorNiboTodos } = await supabase
      .from('nibo_agendamentos')
      .select('categoria_nome, status, valor, data_competencia')
      .eq('bar_id', parseInt(barId))
      .gte('data_competencia', dataInicio)
      .lte('data_competencia', dataFim);

    if (errorNiboTodos) {
      console.error('Erro ao buscar dados NIBO (todos):', errorNiboTodos);
    }

    // Buscar lançamentos PAGOS do NIBO (para realizado)
    const { data: dadosNiboPagos, error: errorNiboPagos } = await supabase
      .from('nibo_agendamentos')
      .select('categoria_nome, status, valor, data_competencia')
      .eq('bar_id', parseInt(barId))
      .eq('status', 'Pago')
      .gte('data_competencia', dataInicio)
      .lte('data_competencia', dataFim);

    if (errorNiboPagos) {
      console.error('Erro ao buscar dados NIBO (pagos):', errorNiboPagos);
    }

    console.log('📊 NIBO Debug:', {
      dataInicio,
      dataFim,
      totalNiboTodos: dadosNiboTodos?.length || 0,
      totalNiboPagos: dadosNiboPagos?.length || 0,
      amostraPagos: dadosNiboPagos?.slice(0, 5)
    });

    // Buscar lançamentos manuais da DRE
    const { data: dadosManuais, error: errorManuais } = await supabase
      .from('dre_manual')
      .select('categoria, categoria_macro, valor, data_competencia, descricao')
      .gte('data_competencia', dataInicio)
      .lte('data_competencia', dataFim);

    if (errorManuais) {
      console.error('Erro ao buscar lançamentos manuais:', errorManuais);
    }

    // Processar dados para cada mês
    const mesesProcessados = mesesParaBuscar.map(({ mes, ano }) => {
      const mesFormatado = String(mes).padStart(2, '0');
      const ultimoDia = new Date(ano, mes, 0).getDate();
      const dataInicioMes = `${ano}-${mesFormatado}-01`;
      const dataFimMes = `${ano}-${mesFormatado}-${String(ultimoDia).padStart(2, '0')}`;

      // Filtrar dados do NIBO para este mês (TODOS - para projeção)
      const niboTodosMes = dadosNiboTodos?.filter(item => {
        if (!item.data_competencia) return false;
        return item.data_competencia >= dataInicioMes && item.data_competencia <= dataFimMes;
      }) || [];

      // Filtrar dados do NIBO para este mês (PAGOS - para realizado)
      const niboPagosMes = dadosNiboPagos?.filter(item => {
        if (!item.data_competencia) return false;
        return item.data_competencia >= dataInicioMes && item.data_competencia <= dataFimMes;
      }) || [];

      // Filtrar dados manuais para este mês
      const manuaisMes = dadosManuais?.filter(item => {
        if (!item.data_competencia) return false;
        return item.data_competencia >= dataInicioMes && item.data_competencia <= dataFimMes;
      }) || [];

      // Filtrar dados planejados para este mês
      const planejadosMes = dadosPlanejados?.filter(item => 
        item.ano === ano && item.mes === mes
      ) || [];

      // Calcular receita total para percentuais (usando todos os lançamentos)
      let receitaTotalProjecao = 0;
      let receitaTotalRealizado = 0;

      niboTodosMes.forEach(item => {
        if (!item.categoria_nome) return;
        const valor = Math.abs(parseFloat(item.valor) || 0);
        if (['Receita de Eventos', 'Stone Crédito', 'Stone Débito', 'Stone Pix', 'Dinheiro', 'Pix Direto na Conta', 'RECEITA BRUTA'].includes(item.categoria_nome)) {
          receitaTotalProjecao += valor;
        }
      });

      niboPagosMes.forEach(item => {
        if (!item.categoria_nome) return;
        const valor = Math.abs(parseFloat(item.valor) || 0);
        if (['Receita de Eventos', 'Stone Crédito', 'Stone Débito', 'Stone Pix', 'Dinheiro', 'Pix Direto na Conta', 'RECEITA BRUTA'].includes(item.categoria_nome)) {
          receitaTotalRealizado += valor;
        }
      });

      manuaisMes.forEach(item => {
        if (item.categoria_macro === 'Receita') {
          const valor = Math.abs(parseFloat(item.valor) || 0);
          receitaTotalProjecao += valor;
          receitaTotalRealizado += valor;
        }
      });

      // Calcular valores por categoria - PROJEÇÃO (todos os lançamentos)
      const valoresProjecao = new Map<string, number>();
      niboTodosMes.forEach(item => {
        if (!item.categoria_nome) return;
        const valor = Math.abs(parseFloat(item.valor) || 0);
        const categoriaNormalizada = CATEGORIAS_MAP.get(item.categoria_nome) || item.categoria_nome;
        
        if (!valoresProjecao.has(categoriaNormalizada)) {
          valoresProjecao.set(categoriaNormalizada, 0);
        }
        valoresProjecao.set(categoriaNormalizada, valoresProjecao.get(categoriaNormalizada)! + valor);
      });

      // Calcular valores por categoria - REALIZADO (apenas pagos)
      const valoresRealizado = new Map<string, number>();
      niboPagosMes.forEach(item => {
        if (!item.categoria_nome) return;
        const valor = Math.abs(parseFloat(item.valor) || 0);
        const categoriaNormalizada = CATEGORIAS_MAP.get(item.categoria_nome) || item.categoria_nome;
        
        if (!valoresRealizado.has(categoriaNormalizada)) {
          valoresRealizado.set(categoriaNormalizada, 0);
        }
        valoresRealizado.set(categoriaNormalizada, valoresRealizado.get(categoriaNormalizada)! + valor);
      });

      // Adicionar manuais a ambos
      manuaisMes.forEach(item => {
        if (!item.categoria) return;
        const valor = Math.abs(parseFloat(item.valor) || 0);
        let categoriaNormalizada = item.categoria;
        
        if (!CATEGORIAS_MAP.has(item.categoria) && item.categoria_macro) {
          categoriaNormalizada = CATEGORIAS_MAP.get(item.categoria_macro) || item.categoria_macro;
        }
        
        if (!valoresProjecao.has(categoriaNormalizada)) {
          valoresProjecao.set(categoriaNormalizada, 0);
        }
        valoresProjecao.set(categoriaNormalizada, valoresProjecao.get(categoriaNormalizada)! + valor);

        if (!valoresRealizado.has(categoriaNormalizada)) {
          valoresRealizado.set(categoriaNormalizada, 0);
        }
        valoresRealizado.set(categoriaNormalizada, valoresRealizado.get(categoriaNormalizada)! + valor);
      });

      // Converter para percentuais onde necessário
      CATEGORIAS_PERCENTUAIS.forEach(categoria => {
        if (valoresProjecao.has(categoria) && receitaTotalProjecao > 0) {
          const valorAbsoluto = valoresProjecao.get(categoria)!;
          const porcentagem = (valorAbsoluto / receitaTotalProjecao) * 100;
          valoresProjecao.set(categoria, porcentagem);
        }
        if (valoresRealizado.has(categoria) && receitaTotalRealizado > 0) {
          const valorAbsoluto = valoresRealizado.get(categoria)!;
          const porcentagem = (valorAbsoluto / receitaTotalRealizado) * 100;
          valoresRealizado.set(categoria, porcentagem);
        }
      });

      // Montar estrutura de categorias com valores
      const categorias = ESTRUTURA_CATEGORIAS.map(cat => ({
        nome: cat.nome,
        cor: cat.cor,
        tipo: cat.tipo,
        subcategorias: cat.subcategorias.map(subNome => {
          const planejado = planejadosMes.find(p => p.categoria_nome === subNome);
          const projecao = valoresProjecao.get(subNome) || 0;
          const realizado = valoresRealizado.get(subNome) || 0;
          const isPercentage = CATEGORIAS_PERCENTUAIS.includes(subNome);

          return {
            nome: subNome,
            planejado: Number(planejado?.valor_planejado) || 0,
            projecao: projecao,
            realizado: realizado,
            isPercentage: isPercentage
          };
        })
      }));

      // Calcular totais
      let receita_planejado = 0;
      let receita_projecao = 0;
      let receita_realizado = 0;
      let despesas_planejado = 0;
      let despesas_projecao = 0;
      let despesas_realizado = 0;

      // Buscar receita planejada
      const receitaPlanejada = planejadosMes.find(p => p.categoria_nome === 'RECEITA BRUTA');
      receita_planejado = Number(receitaPlanejada?.valor_planejado) || 0;

      categorias.forEach(cat => {
        cat.subcategorias.forEach(sub => {
          if (cat.tipo === 'receita') {
            receita_planejado += sub.nome === 'RECEITA BRUTA' ? 0 : sub.planejado; // Evitar duplicar
            receita_projecao += sub.projecao;
            receita_realizado += sub.realizado;
          } else {
            if (sub.isPercentage) {
              // Para percentuais, calcular o valor em R$ baseado na receita
              const planejadoRs = (sub.planejado / 100) * receita_planejado;
              const projecaoRs = (sub.projecao / 100) * receita_projecao;
              const realizadoRs = (sub.realizado / 100) * receita_realizado;
              despesas_planejado += planejadoRs;
              despesas_projecao += projecaoRs;
              despesas_realizado += realizadoRs;
            } else {
              despesas_planejado += sub.planejado;
              despesas_projecao += sub.projecao;
              despesas_realizado += sub.realizado;
            }
          }
        });
      });

      return {
        mes,
        ano,
        label: `${MESES_NOMES[mes]}/${String(ano).slice(-2)}`,
        isAtual: new Date().getMonth() + 1 === mes && new Date().getFullYear() === ano,
        categorias,
        totais: {
          receita_planejado,
          receita_projecao,
          receita_realizado,
          despesas_planejado,
          despesas_projecao,
          despesas_realizado,
          lucro_planejado: receita_planejado - despesas_planejado,
          lucro_projecao: receita_projecao - despesas_projecao,
          lucro_realizado: receita_realizado - despesas_realizado,
          margem_planejado: receita_planejado > 0 ? ((receita_planejado - despesas_planejado) / receita_planejado) * 100 : 0,
          margem_projecao: receita_projecao > 0 ? ((receita_projecao - despesas_projecao) / receita_projecao) * 100 : 0,
          margem_realizado: receita_realizado > 0 ? ((receita_realizado - despesas_realizado) / receita_realizado) * 100 : 0
        }
      };
    });

    return NextResponse.json({
      success: true,
      data: mesesProcessados
    });

  } catch (error) {
    console.error('Erro na API de orçamento todos-meses:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
