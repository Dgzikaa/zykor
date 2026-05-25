import { SupabaseClient } from '@supabase/supabase-js';
import { schemaOf, tbl } from '@/lib/supabase/table-schemas';

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

  // Indicadores agregados (estilo BP):
  // Real Fixo = soma de Pessoal + Adm + Marketing + Operacionais + Ocupacao
  //             (NAO inclui IMPOSTO, CMV, CONTRATOS, RECEITA BRUTA)
  real_fixo_plan: number;
  real_fixo_proj: number;
  real_fixo_real: number;
  // Faturamento Meta:
  //   plan: meta.orcamento_planilha categoria='FATURAMENTO META'
  //   proj: soma M1 do planejamento_comercial (eventos_base.m1_r)
  //   real: real_r dos eventos
  faturamento_meta_plan: number;
  faturamento_meta_proj: number;
  faturamento_meta_real: number;
  // % CONTRIB = 1 - (IMPOSTO + CMV) (em decimal)
  perc_contrib_plan: number;
  perc_contrib_proj: number;
  perc_contrib_real: number;
  // BreakEven = Real Fixo / % CONTRIB
  breakeven_plan: number;
  breakeven_proj: number;
  breakeven_real: number;
  // EBITDA = Faturamento Meta - despesas_variaveis (IMPOSTO+CMV em valor) - Real Fixo
  ebitda_plan: number;
  ebitda_proj: number;
  ebitda_real: number;
  // Margem = EBITDA / Faturamento Meta
  margem_ebitda_plan: number;
  margem_ebitda_proj: number;
  margem_ebitda_real: number;
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

// Estrutura DRE (espelha exatamente o ContaAzul). Todas as categorias sao valor absoluto.
const ESTRUTURA_CATEGORIAS = [
  {
    nome: 'Receita',
    cor: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    tipo: 'receita',
    subcategorias: [
      'Stone Crédito',
      'Stone Débito',
      'Stone Pix',
      'Pix Direto na Conta',
      'Dinheiro',
      'Receita de Eventos',
      'Outras Receitas',
    ]
  },
  {
    nome: 'Custos Variáveis',
    cor: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
    tipo: 'despesa',
    subcategorias: ['IMPOSTO', 'PROVISÃO FISCAL', 'COMISSÃO 10%', 'TAXA MAQUININHA']
  },
  {
    nome: 'Custo insumos (CMV)',
    cor: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
    tipo: 'despesa',
    subcategorias: ['Custo Drinks', 'Custo Bebidas', 'Custo Comida', 'Custo Outros']
  },
  {
    nome: 'Mão-de-Obra',
    cor: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
    tipo: 'despesa',
    subcategorias: [
      'SALARIO FUNCIONARIOS',
      'PROVISÃO TRABALHISTA',
      'VALE TRANSPORTE',
      'ALIMENTAÇÃO',
      'ADICIONAIS',
      'FREELA ATENDIMENTO',
      'FREELA BAR',
      'FREELA COZINHA',
      'FREELA LIMPEZA',
      'FREELA SEGURANÇA',
      'FREELA BRIGADISTA',
      'PRO LABORE',
    ]
  },
  {
    nome: 'Despesas Comerciais',
    cor: 'bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300',
    tipo: 'despesa',
    subcategorias: ['Marketing', 'Atrações Programação', 'Produção Eventos']
  },
  {
    nome: 'Despesas Administrativas',
    cor: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
    tipo: 'despesa',
    subcategorias: ['Administrativo Ordinário', 'Escritório Central', 'RECURSOS HUMANOS']
  },
  {
    nome: 'Despesas Operacionais',
    cor: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300',
    tipo: 'despesa',
    subcategorias: [
      'Materiais Operação',
      'Materiais de Limpeza e Descartáveis',
      'Utensílios',
      'Estorno',
      'Outros Operação',
    ]
  },
  {
    nome: 'Despesas de Ocupação',
    cor: 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300',
    tipo: 'despesa',
    subcategorias: ['ALUGUEL/CONDOMÍNIO/IPTU', 'ÁGUA', 'Manutenção', 'TENDA', 'INTERNET', 'GÁS', 'LUZ']
  },
  {
    nome: 'Não Operacionais',
    cor: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300',
    tipo: 'receita',
    subcategorias: ['Receitas Financeiras', 'CONTRATOS']
  }
];

// Mapping ContaAzul categoria -> subcategoria Zykor (1:1 com a estrutura DRE).
// Variacoes (uppercase/sem acento/alias) levam ao mesmo destino canonico.
const CATEGORIAS_MAP = new Map<string, string>([
  // Receita
  ['Stone Crédito', 'Stone Crédito'],
  ['Stone Credito', 'Stone Crédito'],
  ['STONE CRÉDITO', 'Stone Crédito'],
  ['Stone Débito', 'Stone Débito'],
  ['Stone Debito', 'Stone Débito'],
  ['STONE DÉBITO', 'Stone Débito'],
  ['Stone Pix', 'Stone Pix'],
  ['STONE PIX', 'Stone Pix'],
  ['Pix Direto na Conta', 'Pix Direto na Conta'],
  ['PIX DIRETO NA CONTA', 'Pix Direto na Conta'],
  ['Dinheiro', 'Dinheiro'],
  ['DINHEIRO', 'Dinheiro'],
  ['Receita de Eventos', 'Receita de Eventos'],
  ['RECEITA DE EVENTOS', 'Receita de Eventos'],
  ['Outras Receitas', 'Outras Receitas'],
  ['OUTRAS RECEITAS', 'Outras Receitas'],

  // Custos Variáveis
  ['IMPOSTO', 'IMPOSTO'],
  ['Imposto', 'IMPOSTO'],
  ['PROVISÃO FISCAL', 'PROVISÃO FISCAL'],
  ['PROVISAO FISCAL', 'PROVISÃO FISCAL'],
  ['Provisão Fiscal', 'PROVISÃO FISCAL'],
  ['COMISSÃO 10%', 'COMISSÃO 10%'],
  ['COMISSAO 10%', 'COMISSÃO 10%'],
  ['Comissão 10%', 'COMISSÃO 10%'],
  ['COMISSÃO', 'COMISSÃO 10%'],
  ['TAXA MAQUININHA', 'TAXA MAQUININHA'],
  ['Taxa Maquininha', 'TAXA MAQUININHA'],

  // Custo insumos (CMV)
  ['Custo Drinks', 'Custo Drinks'],
  ['CUSTO DRINKS', 'Custo Drinks'],
  ['Custo Bebidas', 'Custo Bebidas'],
  ['CUSTO BEBIDAS', 'Custo Bebidas'],
  ['Custo Comida', 'Custo Comida'],
  ['CUSTO COMIDA', 'Custo Comida'],
  ['Custo Outros', 'Custo Outros'],
  ['CUSTO OUTROS', 'Custo Outros'],

  // Mão-de-Obra
  ['SALARIO FUNCIONARIOS', 'SALARIO FUNCIONARIOS'],
  ['SALÁRIO FUNCIONÁRIOS', 'SALARIO FUNCIONARIOS'],
  ['Salário Funcionários', 'SALARIO FUNCIONARIOS'],
  ['PROVISÃO TRABALHISTA', 'PROVISÃO TRABALHISTA'],
  ['PROVISAO TRABALHISTA', 'PROVISÃO TRABALHISTA'],
  ['Provisão Trabalhista', 'PROVISÃO TRABALHISTA'],
  ['VALE TRANSPORTE', 'VALE TRANSPORTE'],
  ['Vale Transporte', 'VALE TRANSPORTE'],
  ['ALIMENTAÇÃO', 'ALIMENTAÇÃO'],
  ['ALIMENTACAO', 'ALIMENTAÇÃO'],
  ['Alimentação', 'ALIMENTAÇÃO'],
  ['ADICIONAIS', 'ADICIONAIS'],
  ['Adicionais', 'ADICIONAIS'],
  ['FREELA ATENDIMENTO', 'FREELA ATENDIMENTO'],
  ['FREELA BAR', 'FREELA BAR'],
  ['FREELA COZINHA', 'FREELA COZINHA'],
  ['FREELA LIMPEZA', 'FREELA LIMPEZA'],
  ['FREELA SEGURANÇA', 'FREELA SEGURANÇA'],
  ['FREELA SEGURANCA', 'FREELA SEGURANÇA'],
  ['FREELA BRIGADISTA', 'FREELA BRIGADISTA'],
  ['PRO LABORE', 'PRO LABORE'],
  ['Pro Labore', 'PRO LABORE'],

  // Despesas Comerciais
  ['Marketing', 'Marketing'],
  ['MARKETING', 'Marketing'],
  ['Atrações Programação', 'Atrações Programação'],
  ['ATRAÇÕES PROGRAMAÇÃO', 'Atrações Programação'],
  ['ATRAÇÕES', 'Atrações Programação'],
  ['Produção Eventos', 'Produção Eventos'],
  ['PRODUÇÃO EVENTOS', 'Produção Eventos'],

  // Despesas Administrativas
  ['Administrativo Ordinário', 'Administrativo Ordinário'],
  ['ADMINISTRATIVO ORDINÁRIO', 'Administrativo Ordinário'],
  ['ADMINISTRATIVO', 'Administrativo Ordinário'],
  ['Escritório Central', 'Escritório Central'],
  ['ESCRITÓRIO CENTRAL', 'Escritório Central'],
  ['Recursos Humanos', 'RECURSOS HUMANOS'],
  ['RECURSOS HUMANOS', 'RECURSOS HUMANOS'],

  // Despesas Operacionais
  ['Materiais Operação', 'Materiais Operação'],
  ['MATERIAIS OPERAÇÃO', 'Materiais Operação'],
  ['Materiais de Limpeza e Descartáveis', 'Materiais de Limpeza e Descartáveis'],
  ['MATERIAIS DE LIMPEZA E DESCARTÁVEIS', 'Materiais de Limpeza e Descartáveis'],
  ['Utensílios', 'Utensílios'],
  ['UTENSÍLIOS', 'Utensílios'],
  ['Estorno', 'Estorno'],
  ['ESTORNO', 'Estorno'],
  ['Outros Operação', 'Outros Operação'],
  ['OUTROS OPERAÇÃO', 'Outros Operação'],

  // Despesas de Ocupação
  ['ALUGUEL/CONDOMÍNIO/IPTU', 'ALUGUEL/CONDOMÍNIO/IPTU'],
  ['ALUGUEL', 'ALUGUEL/CONDOMÍNIO/IPTU'],
  ['ÁGUA', 'ÁGUA'],
  ['AGUA', 'ÁGUA'],
  ['Água', 'ÁGUA'],
  ['MANUTENÇÃO', 'Manutenção'],
  ['MANUTENCAO', 'Manutenção'],
  ['Manutenção', 'Manutenção'],
  ['TENDA', 'TENDA'],
  ['Tenda', 'TENDA'],
  ['INTERNET', 'INTERNET'],
  ['Internet', 'INTERNET'],
  ['GÁS', 'GÁS'],
  ['GAS', 'GÁS'],
  ['Gás', 'GÁS'],
  ['LUZ', 'LUZ'],
  ['Luz', 'LUZ'],

  // Não Operacionais
  ['Receitas Financeiras', 'Receitas Financeiras'],
  ['RECEITAS FINANCEIRAS', 'Receitas Financeiras'],
  ['Contratos', 'CONTRATOS'],
  ['CONTRATOS', 'CONTRATOS'],
  ['Contratos Anuais', 'CONTRATOS'],
  ['Ambev Bonificações Contrato Anual', 'CONTRATOS'],
  ['Ambev Bonificação Contrato Cash-back Março', 'CONTRATOS'],
  ['Ambev Bonificação Contrato Cash-back Fevereiro', 'CONTRATOS'],
  ['Ambev Bonificação Contrato Cash-back Junho', 'CONTRATOS'],
  ['Ambev Bonificação Contrato Cash-back Julho', 'CONTRATOS'],
]);

const MESES_NOMES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Set das subcategorias que sao RECEITA (pra filtrar quando agregamos CA).
// Tudo que NAO esta aqui eh despesa.
const SUBCAT_RECEITAS = new Set<string>(
  ESTRUTURA_CATEGORIAS.filter(c => c.tipo === 'receita').flatMap(c => c.subcategorias)
);

// Set dos blocos que compoem o Real Fixo (custos operacionais NAO variaveis).
const BLOCOS_REAL_FIXO = new Set([
  'Mão-de-Obra',
  'Despesas Comerciais',
  'Despesas Administrativas',
  'Despesas Operacionais',
  'Despesas de Ocupação',
]);

// Set dos blocos que compoem os custos VARIAVEIS (entram no calculo de % CONTRIB).
const BLOCOS_VARIAVEIS = new Set(['Custos Variáveis', 'Custo insumos (CMV)']);

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

  // Resolver schema da tabela (post-migração medallion).
  const schema = schemaOf(table);
  const fromBase = (supabase as unknown as { schema: (s: string) => SupabaseClient }).schema(schema);

  while (hasMore) {
    let query = fromBase.from(table).select(select);
    for (const filter of filters) {
      if (filter.operator === 'eq') query = query.eq(filter.column, filter.value);
      else if (filter.operator === 'gte') query = query.gte(filter.column, filter.value);
      else if (filter.operator === 'lte') query = query.lte(filter.column, filter.value);
      else if (filter.operator === 'in') query = query.in(filter.column, filter.value);
      else if (filter.operator === 'is') query = query.is(filter.column, filter.value);
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
    tbl(supabase, 'cmv_semanal').select('semana, ano, cmv_limpo_percentual, cmv_real, faturamento_cmvivel')
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

// ==================== CATEGORIAS MANUAIS ====================
// Realizado dessas categorias eh editado MANUAL na tela (nao vem do CA).
//   CONTRATOS: cashback Ambev — calculo manual fora do CA pelo socio.
//   Receitas Financeiras: tambem nao bate com o CA — socio preenche manual.
const CATEGORIAS_REALIZADO_MANUAL = new Set<string>(['CONTRATOS', 'Receitas Financeiras']);

// Categorias do CA que NAO entram na DRE operacional. Filtradas antes de agregar.
// - Dividendos: distribuicao de lucro, nao OPEX
// - [Investimento] Equipamentos/Obras: CAPEX
// - Consultoria: registro extra-DRE
const CATEGORIAS_IGNORADAS = new Set<string>([
  'Dividendos',
  '[Investimento] Equipamentos',
  '[Investimento] Obras',
  'Consultoria',
]);

interface OrcamentoPlanilhaRow {
  ano: number;
  mes: number;
  categoria_nome: string;
  valor_planejado: number | string | null;
  valor_projetado: number | string | null;
  valor_realizado_manual: number | string | null;
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

  const [planilhaResult, dadosNiboTodos, dadosNiboPagos, manuaisResult, eventosResult] = await Promise.all([
    supabase
      .from('orcamento_planilha')
      .select('ano, mes, categoria_nome, valor_planejado, valor_projetado, valor_realizado_manual')
      .eq('bar_id', barId)
      .in('ano', anosUnicos),
    fetchAllPaginated<any>(supabase, 'bronze_contaazul_lancamentos', 'categoria_nome, tipo, status, valor_bruto, data_competencia, descricao', [
      { column: 'bar_id', operator: 'eq', value: barId },
      { column: 'excluido_em', operator: 'is', value: null },
      { column: 'data_competencia', operator: 'gte', value: dataInicio },
      { column: 'data_competencia', operator: 'lte', value: dataFim }
    ]),
    // Realizado: TODOS os lancamentos por competencia (ACQUITTED + OVERDUE +
    // PENDING). Antes filtrava so ACQUITTED mas a planilha do DRE no CA mostra
    // por competencia, independente de pago. Ex: PROVISAO TRABALHISTA tem R$ 27k
    // OVERDUE em Jan/26 que precisa aparecer; TAXA MAQUININHA R$ 36k OVERDUE; etc.
    // Excluidos (excluido_em) e antecipacoes Stone ainda sao filtrados.
    fetchAllPaginated<any>(supabase, 'bronze_contaazul_lancamentos', 'categoria_nome, tipo, status, valor_bruto, data_competencia, descricao', [
      { column: 'bar_id', operator: 'eq', value: barId },
      { column: 'excluido_em', operator: 'is', value: null },
      { column: 'data_competencia', operator: 'gte', value: dataInicio },
      { column: 'data_competencia', operator: 'lte', value: dataFim }
    ]),
    supabase.from('dre_manual').select('categoria, categoria_macro, valor, data_competencia, descricao')
      .gte('data_competencia', dataInicio).lte('data_competencia', dataFim),
    tbl(supabase, 'eventos_base').select('real_r, sympla_liquido, yuzer_liquido, m1_r, data_evento')
      .eq('bar_id', barId).gte('data_evento', dataInicio).lte('data_evento', dataFim).eq('ativo', true)
  ]);

  const dadosPlanilha = (planilhaResult.data || []) as OrcamentoPlanilhaRow[];
  const dadosManuais = manuaisResult.data || [];
  const eventosBase = eventosResult.data || [];

  // Index planilha por (ano, mes, categoria) -> { plan, proj, real_manual }
  const planilhaMap = new Map<string, OrcamentoPlanilhaRow>();
  dadosPlanilha.forEach(p => {
    planilhaMap.set(`${p.ano}-${p.mes}-${p.categoria_nome}`, p);
  });

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
    // real_r JÁ INCLUI ContaHub + Sympla + Yuzer (calculado pela função calculate_evento_metrics)
    const totalRealizado = eventosDoMes.reduce((sum, e) => sum + (e.real_r || 0), 0);
    const totalMeta = eventosDoMes.reduce((sum, e) => sum + (e.m1_r || 0), 0);
    faturamentoRealMap.set(`${ano}-${mes}`, { realizado: totalRealizado, meta: totalMeta });
  });

  return mesesParaBuscar.map(({ mes, ano }) => {
    const mesFormatado = String(mes).padStart(2, '0');
    const dataInicioMes = `${ano}-${mesFormatado}-01`;
    const dataFimMes = `${ano}-${mesFormatado}-${new Date(ano, mes, 0).getDate()}`;
    const cmvMensal = cmvMensalMap.get(`${ano}-${mes}`) || { cmvPercentual: 0, cmvValor: 0, faturamentoCmvivel: 0 };
    const lancTodosMes = dadosNiboTodos.filter(item => item.data_competencia >= dataInicioMes && item.data_competencia <= dataFimMes);
    // ContaAzul v2: data_pagamento eh sempre NULL. Filtrar por data_competencia.
    const lancPagosMes = dadosNiboPagos.filter(item => item.data_competencia >= dataInicioMes && item.data_competencia <= dataFimMes);
    const manuaisMes = dadosManuais.filter(item => item.data_competencia >= dataInicioMes && item.data_competencia <= dataFimMes);
    // Lookup helper: pega planilha pra esta categoria neste mes
    const getPlanilha = (sub: string): OrcamentoPlanilhaRow | undefined =>
      planilhaMap.get(`${ano}-${mes}-${sub}`);

    // Agrega ContaAzul por categoria + tipo. Lancamento com tipo=RECEITA e
    // categoria_nome de despesa (ex: 'Custo Bebidas' RECEITA = devolucao Ambev)
    // SUBTRAI da despesa: net = despesa_total - receita_da_mesma_categoria.
    //
    // Filtros:
    // - Antecipacoes Stone (descricao 'STONE PAGAMENTO ANTECIPAC...') — R$474k em
    //   Jan/26 que sao adiantamentos de parcelas futuras, nao venda do mes.
    // - CATEGORIAS_IGNORADAS (Dividendos, [Investimento]*, Consultoria) — nao OPEX.
    type CatBucket = { receita: number; despesa: number };
    const valProj = new Map<string, CatBucket>(), valReal = new Map<string, CatBucket>();
    const ehAntecipacaoStone = (it: any) =>
      typeof it.descricao === 'string' &&
      /STONE\s+PAGAMENTO\s+ANTECIPAC/i.test(it.descricao);
    const process = (it: any, target: Map<string, CatBucket>) => {
      if (!it.categoria_nome) return;
      if (ehAntecipacaoStone(it)) return;
      if (CATEGORIAS_IGNORADAS.has(it.categoria_nome)) return;
      const cat = CATEGORIAS_MAP.get(it.categoria_nome) || it.categoria_nome;
      const valor = Math.abs(parseFloat(it.valor_bruto) || 0);
      const bucket = target.get(cat) || { receita: 0, despesa: 0 };
      if (it.tipo === 'RECEITA') bucket.receita += valor;
      else bucket.despesa += valor;
      target.set(cat, bucket);
    };
    lancTodosMes.forEach(it => process(it, valProj));
    lancPagosMes.forEach(it => process(it, valReal));
    manuaisMes.forEach(it => {
      let cat = it.categoria;
      if (!CATEGORIAS_MAP.has(cat) && it.categoria_macro) cat = CATEGORIAS_MAP.get(it.categoria_macro) || it.categoria_macro;
      if (CATEGORIAS_IGNORADAS.has(cat)) return;
      const val = Math.abs(parseFloat(it.valor) || 0);
      const isRec = it.categoria_macro === 'Receita';
      const bp = valProj.get(cat) || { receita: 0, despesa: 0 };
      const br = valReal.get(cat) || { receita: 0, despesa: 0 };
      if (isRec) { bp.receita += val; br.receita += val; }
      else { bp.despesa += val; br.despesa += val; }
      valProj.set(cat, bp);
      valReal.set(cat, br);
    });

    // Net por subcategoria: pra cat Zykor de receita, net = receita - despesa (estorno).
    // Pra cat Zykor de despesa, net = despesa - receita (devolucao abate).
    const netReceita = (b: CatBucket | undefined) => (b?.receita ?? 0) - (b?.despesa ?? 0);
    const netDespesa = (b: CatBucket | undefined) => (b?.despesa ?? 0) - (b?.receita ?? 0);

    const fatReal = faturamentoRealMap.get(`${ano}-${mes}`) || { realizado: 0, meta: 0 };

    const categorias = ESTRUTURA_CATEGORIAS.map(cat => ({
      nome: cat.nome, cor: cat.cor, tipo: cat.tipo,
      subcategorias: cat.subcategorias.map(sub => {
        const planRow = getPlanilha(sub);

        // PLANEJADO e PROJETADO = sempre da planilha (meta.orcamento_planilha)
        const plan = Number(planRow?.valor_planejado || 0);
        const proj = Number(planRow?.valor_projetado || 0);

        // REALIZADO:
        //   - Subcategorias em CATEGORIAS_REALIZADO_MANUAL (CONTRATOS): valor_realizado_manual
        //     da planilha (user edita na tela; calculo nao vem do CA).
        //   - Receitas: net = receitas - estornos (de valReal, todos status).
        //   - Despesas: net = despesas - devolucoes (de valReal, todos status).
        const isRec = SUBCAT_RECEITAS.has(sub);
        let real: number;
        if (CATEGORIAS_REALIZADO_MANUAL.has(sub)) {
          real = Number(planRow?.valor_realizado_manual || 0);
        } else if (isRec) {
          real = netReceita(valReal.get(sub));
        } else {
          real = netDespesa(valReal.get(sub));
        }

        return { nome: sub, planejado: plan, projecao: proj, realizado: real, isPercentage: false };
      })
    }));

    // Totais. Distinguir Receita OPERACIONAL (bloco 'Receita') vs Nao Operacionais
    // (Contratos). Calculos de % CONTRIB / BreakEven / EBITDA usam SO a receita
    // operacional como base — Contratos entra como bonus no EBITDA.
    let recPlanTot = 0, recProjTot = 0, recRealTot = 0; // total receitas (incl. Nao Op)
    let recOpPlan = 0, recOpProj = 0, recOpReal = 0;     // somente bloco 'Receita'
    let desPlanTot = 0, desProjTot = 0, desRealTot = 0;
    let realFixoPlan = 0, realFixoProj = 0, realFixoReal = 0;
    let varPlanTot = 0, varProjTot = 0, varRealTot = 0; // custos variaveis (impostos + CMV)

    categorias.forEach(cat => {
      cat.subcategorias.forEach(sub => {
        if (cat.tipo === 'receita') {
          recPlanTot += sub.planejado;
          recProjTot += sub.projecao;
          recRealTot += sub.realizado;
          if (cat.nome === 'Receita') {
            recOpPlan += sub.planejado;
            recOpProj += sub.projecao;
            recOpReal += sub.realizado;
          }
        } else {
          desPlanTot += sub.planejado;
          desProjTot += sub.projecao;
          desRealTot += sub.realizado;
          if (BLOCOS_REAL_FIXO.has(cat.nome)) {
            realFixoPlan += sub.planejado;
            realFixoProj += sub.projecao;
            realFixoReal += sub.realizado;
          } else if (BLOCOS_VARIAVEIS.has(cat.nome)) {
            varPlanTot += sub.planejado;
            varProjTot += sub.projecao;
            varRealTot += sub.realizado;
          }
        }
      });
    });

    // Faturamento Meta (referencia separada da soma da Receita do DRE):
    //   plan: meta.orcamento_planilha categoria='FATURAMENTO META' (digitado)
    //   proj: soma M1 do planejamento comercial (eventos_base.m1_r)
    //   real: soma receita real do planejamento comercial (eventos_base.real_r)
    const fatMetaRow = getPlanilha('FATURAMENTO META');
    const fatMetaPlan = Number(fatMetaRow?.valor_planejado || 0);
    const fatMetaProj = fatReal.meta;
    const fatMetaReal = fatReal.realizado;

    // Contratos = bloco "Nao Operacionais" (somente Contratos pra EBITDA).
    const subContratos = categorias.flatMap(c => c.subcategorias).find(s => s.nome === 'CONTRATOS');
    const contratosPlan = Number(subContratos?.planejado || 0);
    const contratosProj = Number(subContratos?.projecao || 0);
    const contratosReal = Number(subContratos?.realizado || 0);

    // % CONTRIB = 1 - (custos_variaveis / receita_operacional)
    // Base = bloco 'Receita' (Stone/Pix/Dinheiro/Eventos/Outras). NAO inclui
    // Nao Operacionais (Contratos) — eles entram como bonus no EBITDA.
    // Equivalente a formula da planilha =1-SOMA(imposto_pct + cmv_pct).
    const percContribPlan = recOpPlan > 0 ? 1 - varPlanTot / recOpPlan : 0;
    const percContribProj = recOpProj > 0 ? 1 - varProjTot / recOpProj : 0;
    const percContribReal = recOpReal > 0 ? 1 - varRealTot / recOpReal : 0;

    // BreakEven = Real Fixo / % CONTRIB
    const breakEvenPlan = percContribPlan > 0 ? realFixoPlan / percContribPlan : 0;
    const breakEvenProj = percContribProj > 0 ? realFixoProj / percContribProj : 0;
    const breakEvenReal = percContribReal > 0 ? realFixoReal / percContribReal : 0;

    // EBITDA = Receita Operacional + Nao Operacionais - todas despesas
    // (soma direta de todas as linhas com sinal — receitas positivas, despesas negativas).
    // Conferencia com user Jan/26: 1.800.088 + 39.786 - 1.724.599 = 115.275 ✓
    const naoOpPlan = recPlanTot - recOpPlan;
    const naoOpProj = recProjTot - recOpProj;
    const naoOpReal = recRealTot - recOpReal;
    const ebitdaPlan = recOpPlan + naoOpPlan - desPlanTot;
    const ebitdaProj = recOpProj + naoOpProj - desProjTot;
    const ebitdaReal = recOpReal + naoOpReal - desRealTot;

    // Margem EBITDA = EBITDA / Receita Operacional (DRE convencional).
    const margemEbitdaPlan = recOpPlan > 0 ? (ebitdaPlan / recOpPlan) * 100 : 0;
    const margemEbitdaProj = recOpProj > 0 ? (ebitdaProj / recOpProj) * 100 : 0;
    const margemEbitdaReal = recOpReal > 0 ? (ebitdaReal / recOpReal) * 100 : 0;

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
        margem_realizado: recRealTot > 0 ? ((recRealTot - desRealTot) / recRealTot) * 100 : 0,
        // Indicadores agregados (BP)
        real_fixo_plan: realFixoPlan,
        real_fixo_proj: realFixoProj,
        real_fixo_real: realFixoReal,
        faturamento_meta_plan: fatMetaPlan,
        faturamento_meta_proj: fatMetaProj,
        faturamento_meta_real: fatMetaReal,
        perc_contrib_plan: percContribPlan * 100,
        perc_contrib_proj: percContribProj * 100,
        perc_contrib_real: percContribReal * 100,
        breakeven_plan: breakEvenPlan,
        breakeven_proj: breakEvenProj,
        breakeven_real: breakEvenReal,
        ebitda_plan: ebitdaPlan,
        ebitda_proj: ebitdaProj,
        ebitda_real: ebitdaReal,
        margem_ebitda_plan: margemEbitdaPlan,
        margem_ebitda_proj: margemEbitdaProj,
        margem_ebitda_real: margemEbitdaReal,
      }
    };
  });
}
