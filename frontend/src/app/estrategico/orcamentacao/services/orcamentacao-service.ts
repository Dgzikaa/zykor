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
  // Como o PROJETADO do bloco é determinado:
  //   'soma'       -> soma do projetado das subcategorias (R$, default)
  //   'm1'         -> Receita: vem do Empilhamento M1 (Σ eventos_base.m1_r)
  //   'percentual' -> Custos Variáveis / CMV: % × Receita projetada (M1)
  projecaoTipo?: 'soma' | 'm1' | 'percentual';
  projecaoValor?: number;        // projetado do bloco em R$ (já calculado)
  projecaoPercentual?: number;   // só p/ blocos 'percentual': o % editável
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
  const allData: T[] = [];
  let offset = 0;
  let hasMore = true;
  let pages = 0;
  const MAX_PAGES = 100; // hard cap pra evitar loop infinito (100k registros)

  // Resolver schema da tabela (post-migração medallion).
  const schema = schemaOf(table);
  const fromBase = (supabase as unknown as { schema: (s: string) => SupabaseClient }).schema(schema);

  while (hasMore && pages < MAX_PAGES) {
    let query = fromBase.from(table).select(select);
    for (const filter of filters) {
      if (filter.operator === 'eq') query = query.eq(filter.column, filter.value);
      else if (filter.operator === 'gte') query = query.gte(filter.column, filter.value);
      else if (filter.operator === 'lte') query = query.lte(filter.column, filter.value);
      else if (filter.operator === 'in') query = query.in(filter.column, filter.value);
      else if (filter.operator === 'is') query = query.is(filter.column, filter.value);
    }
    // ORDER BY estavel eh CRITICO pra paginacao sem perder/duplicar rows.
    // Sem isso, com 15k+ registros, o Supabase pode retornar a mesma row em
    // paginas diferentes (perdendo outras), causando totais ~50% do esperado.
    // contaazul_id eh unique e existe em todas as queries que usam essa funcao.
    const { data, error } = await query
      .order('contaazul_id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) {
      // Antes era 'break' silencioso. Agora throw pra UI saber que dado eh incompleto.
      console.error(`[fetchAllPaginated] Erro ao buscar ${table} pagina ${pages}:`, error);
      throw new Error(`Erro paginando ${table}: ${error.message}`);
    }
    if (data && data.length > 0) {
      allData.push(...(data as T[]));
      offset += pageSize;
      hasMore = data.length === pageSize;
      pages++;
    } else {
      hasMore = false;
    }
  }
  if (pages >= MAX_PAGES) {
    console.warn(`[fetchAllPaginated] ${table}: atingiu MAX_PAGES (${MAX_PAGES * pageSize} rows). Possivelmente truncou.`);
  }
  console.log(`[fetchAllPaginated] ${table}: ${allData.length} rows em ${pages} paginas`);
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

  // MEDALLION: realizado agora vem de gold.orcamento_realizado_mensal (pre-agregado)
  // em vez de varrer ~15k rows do bronze toda vez. Refresh do gold via
  // gold.fn_refresh_orcamento_periodo (rodado pos-sync CA + cron diario).
  //
  // Antes: 2x fetchAllPaginated em bronze + processamento de tipo/categoria/net em
  // memoria (frágil, ja causou bug de paginacao que retornava ~50% dos valores).
  // Agora: 1 query simples ao gold (~50 rows total).
  const [planilhaResult, goldResult, manuaisResult, eventosResult] = await Promise.all([
    supabase
      .from('orcamento_planilha')
      .select('ano, mes, categoria_nome, valor_planejado, valor_projetado')
      .eq('bar_id', barId)
      .in('ano', anosUnicos),
    (supabase as unknown as { schema: (s: string) => SupabaseClient }).schema('gold')
      .from('orcamento_realizado_mensal')
      .select('ano, mes, categoria_zykor, net, receita_total, despesa_total')
      .eq('bar_id', barId)
      .in('ano', anosUnicos),
    // dre_manual: ajustes manuais que o socio faz fora do CA (ex: Consumo Artistas,
    // Consumo Beneficios). Somado ao gold no realizado por (bar, ano, mes, categoria).
    (supabase.schema('financial' as never) as any)
      .from('dre_manual')
      .select('categoria, categoria_macro, valor, data_competencia, descricao')
      .eq('bar_id', barId)
      .gte('data_competencia', dataInicio).lte('data_competencia', dataFim),
    tbl(supabase, 'eventos_base').select('real_r, sympla_liquido, yuzer_liquido, m1_r, data_evento')
      .eq('bar_id', barId).gte('data_evento', dataInicio).lte('data_evento', dataFim).eq('ativo', true)
  ]);

  const dadosPlanilha = (planilhaResult.data || []) as OrcamentoPlanilhaRow[];
  const dadosGold = (goldResult.data || []) as Array<{ ano: number; mes: number; categoria_zykor: string; net: number | string }>;
  const dadosManuais = manuaisResult.data || [];
  const eventosBase = eventosResult.data || [];

  // Index gold por (ano, mes, categoria_zykor) -> net (ja calculado: despesa - receita ou vice-versa)
  const goldMap = new Map<string, number>();
  dadosGold.forEach(g => {
    goldMap.set(`${g.ano}-${g.mes}-${g.categoria_zykor}`, Number(g.net) || 0);
  });

  // Index dre_manual por (ano, mes, categoria) -> soma de ajustes manuais.
  // Categoria deve ser o nome canonical Zykor (ex: 'Marketing', 'Produção Eventos').
  // Sera somado ao gold no realizado final.
  const manualMap = new Map<string, number>();
  for (const m of dadosManuais as Array<{ categoria: string; valor: number | string; data_competencia: string }>) {
    if (!m.data_competencia || !m.categoria) continue;
    const [ano, mes] = m.data_competencia.split('-');
    const key = `${parseInt(ano)}-${parseInt(mes)}-${m.categoria}`;
    manualMap.set(key, (manualMap.get(key) || 0) + (Number(m.valor) || 0));
  }

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
    // Lookup helper: pega planilha pra esta categoria neste mes
    const getPlanilha = (sub: string): OrcamentoPlanilhaRow | undefined =>
      planilhaMap.get(`${ano}-${mes}-${sub}`);

    const fatReal = faturamentoRealMap.get(`${ano}-${mes}`) || { realizado: 0, meta: 0 };

    // Receita projetada do mes = Empilhamento M1 (Σ eventos_base.m1_r). Base pro
    // calculo do projetado de Custos Variaveis e CMV (que sao % dessa receita).
    const receitaProjM1 = fatReal.meta;
    // % projetado dos blocos variaveis: digitado na planilha sob o nome do bloco
    // (categoria_nome = 'Custos Variáveis' / 'Custo insumos (CMV)'), em valor_projetado.
    const pctVarProj = Number(getPlanilha('Custos Variáveis')?.valor_projetado || 0);
    const pctCmvProj = Number(getPlanilha('Custo insumos (CMV)')?.valor_projetado || 0);

    // Blocos cujo PROJETADO eh no nivel do bloco (nao na subcategoria):
    //   Receita -> M1 ; Custos Variaveis / CMV -> % da receita projetada.
    const projBlocoEspecial = (nome: string): boolean =>
      nome === 'Receita' || BLOCOS_VARIAVEIS.has(nome);

    const categorias: CategoriaOrcamento[] = ESTRUTURA_CATEGORIAS.map(cat => {
      const subcategorias = cat.subcategorias.map(sub => {
        const planRow = getPlanilha(sub);

        // PLANEJADO = sempre da planilha (meta.orcamento_planilha)
        const plan = Number(planRow?.valor_planejado || 0);
        // PROJETADO da subcategoria = planilha, EXCETO nos blocos especiais
        // (Receita/Variaveis/CMV), onde o projetado vive no nivel do bloco.
        const proj = projBlocoEspecial(cat.nome) ? 0 : Number(planRow?.valor_projetado || 0);

        // REALIZADO = gold.net (do CA) + soma de financial.dre_manual da mesma
        // categoria. dre_manual eh pra ajustes que o socio faz fora do CA
        // (ex: Consumo Artistas -> Producao Eventos, cashback Ambev -> CONTRATOS,
        // rendimentos -> Receitas Financeiras, ajuste receita ultimo dia -> Outras
        // Receitas).
        const goldVal = goldMap.get(`${ano}-${mes}-${sub}`) || 0;
        const manualVal = manualMap.get(`${ano}-${mes}-${sub}`) || 0;
        const real = goldVal + manualVal;

        return { nome: sub, planejado: plan, projecao: proj, realizado: real, isPercentage: false };
      });

      // Projetado no nivel do bloco
      let projecaoTipo: 'soma' | 'm1' | 'percentual' = 'soma';
      let projecaoValor = subcategorias.reduce((s, x) => s + x.projecao, 0);
      let projecaoPercentual: number | undefined;
      if (cat.nome === 'Receita') {
        projecaoTipo = 'm1';
        projecaoValor = receitaProjM1;
      } else if (cat.nome === 'Custos Variáveis') {
        projecaoTipo = 'percentual';
        projecaoPercentual = pctVarProj;
        projecaoValor = (pctVarProj / 100) * receitaProjM1;
      } else if (cat.nome === 'Custo insumos (CMV)') {
        projecaoTipo = 'percentual';
        projecaoPercentual = pctCmvProj;
        projecaoValor = (pctCmvProj / 100) * receitaProjM1;
      }

      return { nome: cat.nome, cor: cat.cor, tipo: cat.tipo, subcategorias, projecaoTipo, projecaoValor, projecaoPercentual };
    });

    // Totais. Distinguir Receita OPERACIONAL (bloco 'Receita') vs Nao Operacionais
    // (Contratos). Calculos de % CONTRIB / BreakEven / EBITDA usam SO a receita
    // operacional como base — Contratos entra como bonus no EBITDA.
    let recPlanTot = 0, recProjTot = 0, recRealTot = 0; // total receitas (incl. Nao Op)
    let recOpPlan = 0, recOpProj = 0, recOpReal = 0;     // somente bloco 'Receita'
    let desPlanTot = 0, desProjTot = 0, desRealTot = 0;
    let realFixoPlan = 0, realFixoProj = 0, realFixoReal = 0;
    let varPlanTot = 0, varProjTot = 0, varRealTot = 0; // custos variaveis (impostos + CMV)

    categorias.forEach(cat => {
      // PROJETADO eh por BLOCO (cat.projecaoValor ja resolve M1/% /soma das subs).
      // PLANEJADO e REALIZADO continuam vindo das subcategorias.
      const projBloco = cat.projecaoValor || 0;
      if (cat.tipo === 'receita') {
        recProjTot += projBloco;
        if (cat.nome === 'Receita') recOpProj += projBloco;
      } else {
        desProjTot += projBloco;
        if (BLOCOS_REAL_FIXO.has(cat.nome)) realFixoProj += projBloco;
        else if (BLOCOS_VARIAVEIS.has(cat.nome)) varProjTot += projBloco;
      }

      cat.subcategorias.forEach(sub => {
        if (cat.tipo === 'receita') {
          recPlanTot += sub.planejado;
          recRealTot += sub.realizado;
          if (cat.nome === 'Receita') {
            recOpPlan += sub.planejado;
            recOpReal += sub.realizado;
          }
        } else {
          desPlanTot += sub.planejado;
          desRealTot += sub.realizado;
          if (BLOCOS_REAL_FIXO.has(cat.nome)) {
            realFixoPlan += sub.planejado;
            realFixoReal += sub.realizado;
          } else if (BLOCOS_VARIAVEIS.has(cat.nome)) {
            varPlanTot += sub.planejado;
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
