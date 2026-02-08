import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Cache por 2 minutos, revalidar em background por até 10 minutos
export const revalidate = 120;

// ==================== HELPERS CMV MENSAL ====================

// Obter número da semana ISO e o ano ISO
function getWeekAndYear(date: Date): { semana: number; ano: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const ano = d.getUTCFullYear();
  return { semana, ano };
}

// Calcular semanas com proporção de dias no mês
function calcularSemanasComProporcao(mes: number, ano: number): { semana: number; anoISO: number; proporcao: number; diasNoMes: number }[] {
  const primeiroDia = new Date(ano, mes - 1, 1);
  const ultimoDia = new Date(ano, mes, 0);
  
  const contagemDias = new Map<string, { semana: number; anoISO: number; diasNoMes: number }>();
  
  for (let d = new Date(primeiroDia); d <= ultimoDia; d.setDate(d.getDate() + 1)) {
    const { semana, ano: anoISO } = getWeekAndYear(new Date(d));
    const key = `${anoISO}-${semana}`;
    
    if (!contagemDias.has(key)) {
      contagemDias.set(key, { semana, anoISO, diasNoMes: 0 });
    }
    contagemDias.get(key)!.diasNoMes++;
  }
  
  return Array.from(contagemDias.values()).map(s => ({
    ...s,
    proporcao: s.diasNoMes / 7
  }));
}

// Calcular CMV mensal a partir das semanas
async function calcularCMVMensal(supabase: any, barId: number, mes: number, ano: number): Promise<{ cmvPercentual: number; cmvValor: number; faturamentoCmvivel: number }> {
  const semanasComProporcao = calcularSemanasComProporcao(mes, ano);
  
  // Agrupar semanas por ano para consulta
  const semanasPorAno: Record<number, number[]> = {};
  for (const s of semanasComProporcao) {
    if (!semanasPorAno[s.anoISO]) semanasPorAno[s.anoISO] = [];
    if (!semanasPorAno[s.anoISO].includes(s.semana)) {
      semanasPorAno[s.anoISO].push(s.semana);
    }
  }

  // Buscar dados CMV de todas as semanas envolvidas
  const cmvPromises = Object.entries(semanasPorAno).map(([anoISO, semanas]) =>
    supabase
      .from('cmv_semanal')
      .select('semana, ano, cmv_limpo_percentual, cmv_real, faturamento_cmvivel')
      .eq('bar_id', barId)
      .eq('ano', parseInt(anoISO))
      .in('semana', semanas)
  );

  const cmvResults = await Promise.all(cmvPromises);
  const cmvData = cmvResults.flatMap(r => r.data || []);

  // Criar mapa de dados por semana
  const cmvMap = new Map<string, any>();
  for (const c of cmvData) {
    cmvMap.set(`${c.ano}-${c.semana}`, c);
  }

  // Calcular CMV percentual (média ponderada) e CMV valor (soma proporcional)
  let somaCmvPercent = 0;
  let somaCmvValor = 0;
  let somaFaturamento = 0;
  let pesoTotal = 0;

  for (const s of semanasComProporcao) {
    const dados = cmvMap.get(`${s.anoISO}-${s.semana}`);
    if (dados) {
      const cmvPercent = parseFloat(dados.cmv_limpo_percentual) || 0;
      const cmvValor = parseFloat(dados.cmv_real) || 0;
      const faturamento = parseFloat(dados.faturamento_cmvivel) || 0;
      
      somaCmvPercent += cmvPercent * s.proporcao;
      somaCmvValor += cmvValor * s.proporcao;
      somaFaturamento += faturamento * s.proporcao;
      pesoTotal += s.proporcao;
    }
  }

  return {
    cmvPercentual: pesoTotal > 0 ? somaCmvPercent / pesoTotal : 0,
    cmvValor: somaCmvValor,
    faturamentoCmvivel: somaFaturamento
  };
}

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
    
    // Calcular range de datas para buscar NIBO
    const mesMin = Math.min(...mesesParaBuscar.map(m => m.mes));
    const mesMax = Math.max(...mesesParaBuscar.map(m => m.mes));
    const anoMin = Math.min(...anosUnicos);
    const anoMax = Math.max(...anosUnicos);

    // Calcular último dia do mês corretamente
    const ultimoDiaMes = new Date(anoMax, mesMax, 0).getDate();
    
    const dataInicio = `${anoMin}-${String(mesMin).padStart(2, '0')}-01`;
    const dataFim = `${anoMax}-${String(mesMax).padStart(2, '0')}-${String(ultimoDiaMes).padStart(2, '0')}`;

    // 🚀 OTIMIZAÇÃO: Executar TODAS as queries em paralelo
    const [
      planejadosResult,
      niboTodosResult,
      niboPagosResult,
      manuaisResult,
      eventosResult
    ] = await Promise.all([
      // Query 1: Dados planejados
      supabase
        .from('orcamentacao')
        .select('*')
        .eq('bar_id', parseInt(barId))
        .in('ano', anosUnicos),
      
      // Query 2: NIBO todos (projeção)
      supabase
        .from('nibo_agendamentos')
        .select('categoria_nome, status, valor, data_competencia')
        .eq('bar_id', parseInt(barId))
        .gte('data_competencia', dataInicio)
        .lte('data_competencia', dataFim),
      
      // Query 3: NIBO pagos (realizado)
      supabase
        .from('nibo_agendamentos')
        .select('categoria_nome, status, valor, data_competencia')
        .eq('bar_id', parseInt(barId))
        .eq('status', 'Pago')
        .gte('data_competencia', dataInicio)
        .lte('data_competencia', dataFim),
      
      // Query 4: Lançamentos manuais DRE
      supabase
        .from('dre_manual')
        .select('categoria, categoria_macro, valor, data_competencia, descricao')
        .gte('data_competencia', dataInicio)
        .lte('data_competencia', dataFim),
      
      // Query 5: Eventos base (faturamento real)
      supabase
        .from('eventos_base')
        .select('real_r, sympla_liquido, yuzer_liquido, m1_r, data_evento')
        .eq('bar_id', parseInt(barId))
        .gte('data_evento', dataInicio)
        .lte('data_evento', dataFim)
        .eq('ativo', true)
    ]);

    const dadosPlanejados = planejadosResult.data;
    const dadosNiboTodos = niboTodosResult.data;
    const dadosNiboPagos = niboPagosResult.data;
    const dadosManuais = manuaisResult.data;
    const eventosBase = eventosResult.data;

    // 🚀 OTIMIZAÇÃO: Calcular CMV de todos os meses em paralelo
    const cmvMensalMap = new Map<string, { cmvPercentual: number; cmvValor: number; faturamentoCmvivel: number }>();
    
    const cmvResults = await Promise.all(
      mesesParaBuscar.map(async ({ mes, ano }) => {
        try {
          const cmvMensal = await calcularCMVMensal(supabase, parseInt(barId), mes, ano);
          return { key: `${ano}-${mes}`, data: cmvMensal };
        } catch (e) {
          return { key: `${ano}-${mes}`, data: { cmvPercentual: 0, cmvValor: 0, faturamentoCmvivel: 0 } };
        }
      })
    );
    
    cmvResults.forEach(({ key, data }) => cmvMensalMap.set(key, data));

    // 🚀 OTIMIZAÇÃO: Processar faturamento real de eventos em memória (já buscamos tudo)
    const faturamentoRealMap = new Map<string, { realizado: number; meta: number }>();
    
    mesesParaBuscar.forEach(({ mes, ano }) => {
      const mesFormatado = String(mes).padStart(2, '0');
      const dataInicioMes = `${ano}-${mesFormatado}-01`;
      const ultimoDia = new Date(ano, mes, 0).getDate();
      const dataFimMes = `${ano}-${mesFormatado}-${String(ultimoDia).padStart(2, '0')}`;

      const eventosDoMes = eventosBase?.filter(e => 
        e.data_evento >= dataInicioMes && e.data_evento <= dataFimMes
      ) || [];

      const totalRealizado = eventosDoMes.reduce((sum, e) => 
        sum + (e.real_r || 0) + (e.sympla_liquido || 0) + (e.yuzer_liquido || 0), 0
      );
      const totalMeta = eventosDoMes.reduce((sum, e) => sum + (e.m1_r || 0), 0);
      faturamentoRealMap.set(`${ano}-${mes}`, { realizado: totalRealizado, meta: totalMeta });
    });

    // Processar dados para cada mês
    const mesesProcessados = mesesParaBuscar.map(({ mes, ano }) => {
      const mesFormatado = String(mes).padStart(2, '0');
      const ultimoDia = new Date(ano, mes, 0).getDate();
      const dataInicioMes = `${ano}-${mesFormatado}-01`;
      const dataFimMes = `${ano}-${mesFormatado}-${String(ultimoDia).padStart(2, '0')}`;

      // Buscar CMV calculado para este mês
      const cmvMensal = cmvMensalMap.get(`${ano}-${mes}`) || { cmvPercentual: 0, cmvValor: 0, faturamentoCmvivel: 0 };

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
        Number(item.ano) === Number(ano) && Number(item.mes) === Number(mes)
      ) || [];

      // Calcular receita total para percentuais (usando todos os lançamentos)
      let receitaTotalProjecao = 0;
      let receitaTotalRealizado = 0;

      niboTodosMes.forEach(item => {
        if (!item.categoria_nome || item.categoria_nome.trim() === '') return;
        const valor = Math.abs(parseFloat(item.valor) || 0);
        if (['Receita de Eventos', 'Stone Crédito', 'Stone Débito', 'Stone Pix', 'Dinheiro', 'Pix Direto na Conta', 'RECEITA BRUTA'].includes(item.categoria_nome)) {
          receitaTotalProjecao += valor;
        }
      });

      niboPagosMes.forEach(item => {
        if (!item.categoria_nome || item.categoria_nome.trim() === '') return;
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
        if (!item.categoria_nome || item.categoria_nome.trim() === '') return;
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
        if (!item.categoria_nome || item.categoria_nome.trim() === '') return;
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

      // Buscar faturamento real do mês (eventos_base) ANTES de converter percentuais
      const faturamentoReal = faturamentoRealMap.get(`${ano}-${mes}`) || { realizado: 0, meta: 0 };
      
      // Usar receita dos eventos para cálculo de percentuais (mais confiável que NIBO)
      const receitaBaseParaPercentuais = faturamentoReal.realizado > 0 
        ? faturamentoReal.realizado 
        : receitaTotalRealizado;

      // Converter para percentuais onde necessário (exceto CMV - usamos o valor calculado)
      CATEGORIAS_PERCENTUAIS.forEach(categoria => {
        // Pular CMV - usamos o valor da tabela cmv_semanal
        if (categoria === 'CMV') return;
        
        if (valoresProjecao.has(categoria) && receitaTotalProjecao > 0) {
          const valorAbsoluto = valoresProjecao.get(categoria)!;
          const porcentagem = (valorAbsoluto / receitaTotalProjecao) * 100;
          valoresProjecao.set(categoria, porcentagem);
        }
        if (valoresRealizado.has(categoria) && receitaBaseParaPercentuais > 0) {
          const valorAbsoluto = valoresRealizado.get(categoria)!;
          const porcentagem = (valorAbsoluto / receitaBaseParaPercentuais) * 100;
          valoresRealizado.set(categoria, porcentagem);
        }
      });

      // Usar CMV da tabela cmv_semanal (valor correto!)
      valoresProjecao.set('CMV', cmvMensal.cmvPercentual);
      valoresRealizado.set('CMV', cmvMensal.cmvPercentual);

      // Atribuir receita total aos mapas para exibição na subcategoria RECEITA BRUTA
      valoresProjecao.set('RECEITA BRUTA', receitaTotalProjecao);
      valoresRealizado.set('RECEITA BRUTA', receitaTotalRealizado);

      // Montar estrutura de categorias com valores
      const categorias = ESTRUTURA_CATEGORIAS.map(cat => ({
        nome: cat.nome,
        cor: cat.cor,
        tipo: cat.tipo,
        subcategorias: cat.subcategorias.map(subNome => {
          const planejado = planejadosMes.find(p => p.categoria_nome === subNome);
          let projecao = valoresProjecao.get(subNome) || 0;
          let realizado = valoresRealizado.get(subNome) || 0;
          const isPercentage = CATEGORIAS_PERCENTUAIS.includes(subNome);

          // Para RECEITA BRUTA, usar dados dos eventos
          let planejadoValor = Number(planejado?.valor_planejado) || 0;
          
          if (subNome === 'RECEITA BRUTA') {
            // Realizado = soma de real_r + sympla + yuzer de todos os eventos do mês
            realizado = faturamentoReal.realizado;
            
            // Planejado = se não houver na tabela orcamentacao, usar Meta M1 dos eventos
            if (planejadoValor === 0 && faturamentoReal.meta > 0) {
              planejadoValor = faturamentoReal.meta;
            }
          }

          return {
            nome: subNome,
            planejado: planejadoValor,
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
