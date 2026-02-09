import { SupabaseClient } from '@supabase/supabase-js';

// ==================== TIPOS ====================

export interface SubcategoriaOrcamento {
  nome: string;
  planejado: number;
  projecao: number;
  realizado: number;
  isPercentage?: boolean;
}

export interface CategoriaOrcamento {
  nome: string;
  cor: string;
  tipo: string;
  subcategorias: SubcategoriaOrcamento[];
}

export interface TotaisMes {
  receita_planejado: number;
  receita_projecao: number;
  receita_realizado: number;
  despesas_planejado: number;
  despesas_projecao: number;
  despesas_realizado: number;
  lucro_planejado: number;
  lucro_projecao: number;
  lucro_realizado: number;
  margem_planejado: number;
  margem_projecao: number;
  margem_realizado: number;
}

export interface MesOrcamento {
  mes: number;
  ano: number;
  label: string;
  isAtual: boolean;
  categorias: CategoriaOrcamento[];
  totais: TotaisMes;
}

// ==================== CONFIGURAÇÃO ====================

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

const CATEGORIAS_MAP = new Map([
  ['IMPOSTO/TX MAQ/COMISSAO', 'IMPOSTO/TX MAQ/COMISSAO'],
  ['IMPOSTO', 'IMPOSTO/TX MAQ/COMISSAO'],
  ['TAXA MAQUININHA', 'IMPOSTO/TX MAQ/COMISSAO'],
  ['COMISSÃO', 'IMPOSTO/TX MAQ/COMISSAO'],
  ['COMISSAO', 'IMPOSTO/TX MAQ/COMISSAO'],
  ['COMISSÃO 10%', 'IMPOSTO/TX MAQ/COMISSAO'],
  ['Custo Comida', 'CMV'],
  ['Custo Drinks', 'CMV'],
  ['Custo Bebidas', 'CMV'],
  ['CUSTO COMIDA', 'CMV'],
  ['CUSTO DRINKS', 'CMV'],
  ['CUSTO BEBIDAS', 'CMV'],
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
  ['RECURSOS HUMANOS', 'RECURSOS HUMANOS'],
  ['Administrativo Ordinário', 'Administrativo Ordinário'],
  ['ADMINISTRATIVO', 'Administrativo Ordinário'],
  ['Escritório Central', 'Escritório Central'],
  ['ESCRITÓRIO CENTRAL', 'Escritório Central'],
  ['ALUGUEL/CONDOMÍNIO/IPTU', 'ALUGUEL/CONDOMÍNIO/IPTU'],
  ['ALUGUEL', 'ALUGUEL/CONDOMÍNIO/IPTU'],
  ['LUZ', 'LUZ'],
  ['ÁGUA', 'ÁGUA'],
  ['AGUA', 'ÁGUA'],
  ['GÁS', 'GÁS'],
  ['GAS', 'GÁS'],
  ['INTERNET', 'INTERNET'],
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
  ['Marketing', 'Marketing'],
  ['MARKETING', 'Marketing'],
  ['Produção Eventos', 'Produção Eventos'],
  ['PRODUÇÃO EVENTOS', 'Produção Eventos'],
  ['Atrações Programação', 'Atrações Programação'],
  ['ATRAÇÕES PROGRAMAÇÃO', 'Atrações Programação'],
  ['ATRAÇÕES', 'Atrações Programação'],
  ['RECEITA BRUTA', 'RECEITA BRUTA'],
  ['RECEITA', 'RECEITA BRUTA'],
  ['FATURAMENTO', 'RECEITA BRUTA'],
  ['VENDAS', 'RECEITA BRUTA'],
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

const CATEGORIAS_PERCENTUAIS = ['IMPOSTO/TX MAQ/COMISSAO', 'CMV'];
const MESES_NOMES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ==================== HELPERS ====================

async function fetchAllPaginated<T>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  filters: { column: string; operator: string; value: any }[],
  pageSize: number = 1000
): Promise<T[]> {
  let allData: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from(table).select(select);
    for (const filter of filters) {
      if (filter.operator === 'eq') query = query.eq(filter.column, filter.value);
      else if (filter.operator === 'gte') query = query.gte(filter.column, filter.value);
      else if (filter.operator === 'lte') query = query.lte(filter.column, filter.value);
      else if (filter.operator === 'in') query = query.in(filter.column, filter.value);
    }
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) { console.error(`Erro ao buscar ${table}:`, error); break; }
    if (data && data.length > 0) {
      allData = allData.concat(data as T[]);
      offset += pageSize;
      hasMore = data.length === pageSize;
    } else hasMore = false;
  }
  return allData;
}

function getWeekAndYear(date: Date): { semana: number; ano: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const ano = d.getUTCFullYear();
  return { semana, ano };
}

function calcularSemanasComProporcao(mes: number, ano: number) {
  const primeiroDia = new Date(ano, mes - 1, 1);
  const ultimoDia = new Date(ano, mes, 0);
  const contagemDias = new Map<string, { semana: number; anoISO: number; diasNoMes: number }>();
  for (let d = new Date(primeiroDia); d <= ultimoDia; d.setDate(d.getDate() + 1)) {
    const { semana, ano: anoISO } = getWeekAndYear(new Date(d));
    const key = `${anoISO}-${semana}`;
    if (!contagemDias.has(key)) contagemDias.set(key, { semana, anoISO, diasNoMes: 0 });
    contagemDias.get(key)!.diasNoMes++;
  }
  return Array.from(contagemDias.values()).map(s => ({ ...s, proporcao: s.diasNoMes / 7 }));
}

async function calcularCMVMensal(supabase: SupabaseClient, barId: number, mes: number, ano: number) {
  const semanasComProporcao = calcularSemanasComProporcao(mes, ano);
  const semanasPorAno: Record<number, number[]> = {};
  for (const s of semanasComProporcao) {
    if (!semanasPorAno[s.anoISO]) semanasPorAno[s.anoISO] = [];
    if (!semanasPorAno[s.anoISO].includes(s.semana)) semanasPorAno[s.anoISO].push(s.semana);
  }
  const cmvPromises = Object.entries(semanasPorAno).map(([anoISO, semanas]) =>
    supabase.from('cmv_semanal').select('semana, ano, cmv_limpo_percentual, cmv_real, faturamento_cmvivel')
      .eq('bar_id', barId).eq('ano', parseInt(anoISO)).in('semana', semanas)
  );
  const cmvResults = await Promise.all(cmvPromises);
  const cmvData = cmvResults.flatMap(r => r.data || []);
  const cmvMap = new Map<string, any>();
  for (const c of cmvData) cmvMap.set(`${c.ano}-${c.semana}`, c);

  let somaCmvPercent = 0, somaCmvValor = 0, somaFaturamento = 0, pesoTotal = 0;
  for (const s of semanasComProporcao) {
    const dados = cmvMap.get(`${s.anoISO}-${s.semana}`);
    if (dados) {
      somaCmvPercent += (parseFloat(dados.cmv_limpo_percentual) || 0) * s.proporcao;
      somaCmvValor += (parseFloat(dados.cmv_real) || 0) * s.proporcao;
      somaFaturamento += (parseFloat(dados.faturamento_cmvivel) || 0) * s.proporcao;
      pesoTotal += s.proporcao;
    }
  }
  return { 
    cmvPercentual: pesoTotal > 0 ? somaCmvPercent / pesoTotal : 0, 
    cmvValor: somaCmvValor, 
    faturamentoCmvivel: somaFaturamento 
  };
}

// ==================== SERVICE ====================

export async function getOrcamentacaoCompleta(supabase: SupabaseClient, barId: number, ano: number, mesInicio: number, quantidade: number = 7): Promise<MesOrcamento[]> {
  const mesesParaBuscar: { mes: number; ano: number }[] = [];
  for (let i = 0; i < quantidade; i++) {
    let mesAtual = mesInicio + i, anoAtual = ano;
    if (mesAtual > 12) { mesAtual -= 12; anoAtual += 1; }
    mesesParaBuscar.push({ mes: mesAtual, ano: anoAtual });
  }

  const anosUnicos = [...new Set(mesesParaBuscar.map(m => m.ano))];
  const primeiroMesPeriodo = mesesParaBuscar[0];
  const ultimoMesPeriodo = mesesParaBuscar[mesesParaBuscar.length - 1];
  const ultimoDiaMes = new Date(ultimoMesPeriodo.ano, ultimoMesPeriodo.mes, 0).getDate();
  const dataInicio = `${primeiroMesPeriodo.ano}-${String(primeiroMesPeriodo.mes).padStart(2, '0')}-01`;
  const dataFim = `${ultimoMesPeriodo.ano}-${String(ultimoMesPeriodo.mes).padStart(2, '0')}-${String(ultimoDiaMes).padStart(2, '0')}`;

  const [planejadosResult, dadosNiboTodos, dadosNiboPagos, manuaisResult, eventosResult] = await Promise.all([
    supabase.from('orcamentacao').select('*').eq('bar_id', barId).in('ano', anosUnicos),
    fetchAllPaginated<any>(supabase, 'nibo_agendamentos', 'categoria_nome, status, valor, data_competencia', [
      { column: 'bar_id', operator: 'eq', value: barId },
      { column: 'data_competencia', operator: 'gte', value: dataInicio },
      { column: 'data_competencia', operator: 'lte', value: dataFim }
    ]),
    fetchAllPaginated<any>(supabase, 'nibo_agendamentos', 'categoria_nome, status, valor, data_pagamento', [
      { column: 'bar_id', operator: 'eq', value: barId },
      { column: 'status', operator: 'eq', value: 'Pago' },
      { column: 'data_pagamento', operator: 'gte', value: dataInicio },
      { column: 'data_pagamento', operator: 'lte', value: dataFim }
    ]),
    supabase.from('dre_manual').select('categoria, categoria_macro, valor, data_competencia, descricao')
      .gte('data_competencia', dataInicio).lte('data_competencia', dataFim),
    supabase.from('eventos_base').select('real_r, sympla_liquido, yuzer_liquido, m1_r, data_evento')
      .eq('bar_id', barId).gte('data_evento', dataInicio).lte('data_evento', dataFim).eq('ativo', true)
  ]);

  const dadosPlanejados = planejadosResult.data || [];
  const dadosManuais = manuaisResult.data || [];
  const eventosBase = eventosResult.data || [];

  const cmvResults = await Promise.all(mesesParaBuscar.map(async ({ mes, ano }) => {
    const data = await calcularCMVMensal(supabase, barId, mes, ano);
    return { key: `${ano}-${mes}`, data };
  }));
  const cmvMensalMap = new Map(cmvResults.map(r => [r.key, r.data]));

  const faturamentoRealMap = new Map<string, { realizado: number; meta: number }>();
  mesesParaBuscar.forEach(({ mes, ano }) => {
    const mesFormatado = String(mes).padStart(2, '0');
    const dataInicioMes = `${ano}-${mesFormatado}-01`;
    const dataFimMes = `${ano}-${mesFormatado}-${new Date(ano, mes, 0).getDate()}`;
    const eventosDoMes = eventosBase.filter(e => e.data_evento >= dataInicioMes && e.data_evento <= dataFimMes);
    const totalRealizado = eventosDoMes.reduce((sum, e) => sum + (e.real_r || 0) + (e.sympla_liquido || 0) + (e.yuzer_liquido || 0), 0);
    const totalMeta = eventosDoMes.reduce((sum, e) => sum + (e.m1_r || 0), 0);
    faturamentoRealMap.set(`${ano}-${mes}`, { realizado: totalRealizado, meta: totalMeta });
  });

  return mesesParaBuscar.map(({ mes, ano }) => {
    const mesFormatado = String(mes).padStart(2, '0');
    const dataInicioMes = `${ano}-${mesFormatado}-01`;
    const dataFimMes = `${ano}-${mesFormatado}-${new Date(ano, mes, 0).getDate()}`;
    const cmvMensal = cmvMensalMap.get(`${ano}-${mes}`) || { cmvPercentual: 0, cmvValor: 0, faturamentoCmvivel: 0 };
    const niboTodosMes = dadosNiboTodos.filter(item => item.data_competencia >= dataInicioMes && item.data_competencia <= dataFimMes);
    const niboPagosMes = dadosNiboPagos.filter(item => item.data_pagamento >= dataInicioMes && item.data_pagamento <= dataFimMes);
    const manuaisMes = dadosManuais.filter(item => item.data_competencia >= dataInicioMes && item.data_competencia <= dataFimMes);
    const planejadosMes = dadosPlanejados.filter(item => Number(item.ano) === Number(ano) && Number(item.mes) === Number(mes));

    let recProj = 0, recReal = 0;
    niboTodosMes.forEach(it => { if (['Receita de Eventos', 'Stone Crédito', 'Stone Débito', 'Stone Pix', 'Dinheiro', 'Pix Direto na Conta', 'RECEITA BRUTA'].includes(it.categoria_nome)) recProj += Math.abs(parseFloat(it.valor) || 0); });
    niboPagosMes.forEach(it => { if (['Receita de Eventos', 'Stone Crédito', 'Stone Débito', 'Stone Pix', 'Dinheiro', 'Pix Direto na Conta', 'RECEITA BRUTA'].includes(it.categoria_nome)) recReal += Math.abs(parseFloat(it.valor) || 0); });
    manuaisMes.forEach(it => { if (it.categoria_macro === 'Receita') { const val = Math.abs(parseFloat(it.valor) || 0); recProj += val; recReal += val; }});

    const valProj = new Map<string, number>(), valReal = new Map<string, number>();
    const process = (it: any, target: Map<string, number>) => {
      if (!it.categoria_nome) return;
      const cat = CATEGORIAS_MAP.get(it.categoria_nome) || it.categoria_nome;
      target.set(cat, (target.get(cat) || 0) + Math.abs(parseFloat(it.valor) || 0));
    };
    niboTodosMes.forEach(it => process(it, valProj));
    niboPagosMes.forEach(it => process(it, valReal));
    manuaisMes.forEach(it => {
      let cat = it.categoria;
      if (!CATEGORIAS_MAP.has(cat) && it.categoria_macro) cat = CATEGORIAS_MAP.get(it.categoria_macro) || it.categoria_macro;
      const val = Math.abs(parseFloat(it.valor) || 0);
      valProj.set(cat, (valProj.get(cat) || 0) + val);
      valReal.set(cat, (valReal.get(cat) || 0) + val);
    });

    const fatReal = faturamentoRealMap.get(`${ano}-${mes}`) || { realizado: 0, meta: 0 };
    const recBasePer = fatReal.realizado > 0 ? fatReal.realizado : recReal;

    CATEGORIAS_PERCENTUAIS.forEach(c => {
      if (c === 'CMV') return;
      if (valProj.has(c) && recProj > 0) valProj.set(c, (valProj.get(c)! / recProj) * 100);
      if (valReal.has(c) && recBasePer > 0) valReal.set(c, (valReal.get(c)! / recBasePer) * 100);
    });
    valProj.set('CMV', cmvMensal.cmvPercentual); valReal.set('CMV', cmvMensal.cmvPercentual);
    valProj.set('RECEITA BRUTA', recProj); valReal.set('RECEITA BRUTA', recReal);

    const categorias = ESTRUTURA_CATEGORIAS.map(cat => ({
      nome: cat.nome, cor: cat.cor, tipo: cat.tipo,
      subcategorias: cat.subcategorias.map(sub => {
        const planObj = planejadosMes.find(p => p.categoria_nome === sub);
        let plan = Number(planObj?.valor_planejado) || 0;
        let proj = valProj.get(sub) || 0, real = valReal.get(sub) || 0;
        if (sub === 'RECEITA BRUTA') {
          real = fatReal.realizado;
          if (plan === 0 && fatReal.meta > 0) plan = fatReal.meta;
        }
        return { nome: sub, planejado: plan, projecao: proj, realizado: real, isPercentage: CATEGORIAS_PERCENTUAIS.includes(sub) };
      })
    }));

    const receitaPlanejadaDb = planejadosMes.find(p => p.categoria_nome === 'RECEITA BRUTA');
    let recPlanTot = Number(receitaPlanejadaDb?.valor_planejado) || 0;
    if (recPlanTot === 0 && fatReal.meta > 0) recPlanTot = fatReal.meta;

    let recProjTot = 0, recRealTot = 0, desPlanTot = 0, desProjTot = 0, desRealTot = 0;
    categorias.forEach(cat => {
      cat.subcategorias.forEach(sub => {
        if (cat.tipo === 'receita') {
          recPlanTot += sub.nome === 'RECEITA BRUTA' ? 0 : sub.planejado;
          recProjTot += sub.projecao; recRealTot += sub.realizado;
        } else {
          if (sub.isPercentage) {
            desPlanTot += (sub.planejado / 100) * recPlanTot;
            desProjTot += (sub.projecao / 100) * recProjTot;
            desRealTot += (sub.realizado / 100) * recRealTot;
          } else {
            desPlanTot += sub.planejado; desProjTot += sub.projecao; desRealTot += sub.realizado;
          }
        }
      });
    });

    return {
      mes, ano, label: `${MESES_NOMES[mes]}/${String(ano).slice(-2)}`,
      isAtual: new Date().getMonth() + 1 === mes && new Date().getFullYear() === ano,
      categorias,
      totais: {
        receita_planejado: recPlanTot, receita_projecao: recProjTot, receita_realizado: recRealTot,
        despesas_planejado: desPlanTot, despesas_projecao: desProjTot, despesas_realizado: desRealTot,
        lucro_planejado: recPlanTot - desPlanTot, lucro_projecao: recProjTot - desProjTot, lucro_realizado: recRealTot - desRealTot,
        margem_planejado: recPlanTot > 0 ? ((recPlanTot - desPlanTot) / recPlanTot) * 100 : 0,
        margem_projecao: recProjTot > 0 ? ((recProjTot - desProjTot) / recProjTot) * 100 : 0,
        margem_realizado: recRealTot > 0 ? ((recRealTot - desRealTot) / recRealTot) * 100 : 0
      }
    };
  });
}
