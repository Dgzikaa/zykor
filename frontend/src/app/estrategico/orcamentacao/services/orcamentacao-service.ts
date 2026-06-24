import { SupabaseClient } from '@supabase/supabase-js';
import { tbl } from '@/lib/supabase/table-schemas';

// ============================================================================
// ORÇAMENTAÇÃO — visão ENXUTA de planejamento/acompanhamento semanal.
//
// Diferente da DRE (que tem o resultado 100% detalhado), aqui:
//   - Receita = uma única linha "Faturamento Meta" (sem quebra por meio de
//     recebimento — isso fica só na DRE).
//   - Custos Variáveis e CMV entram SÓ como % (sem subcategorias). Plan% e Proj%
//     são editáveis; o Real% vem da DRE (realizado do Conta Azul ÷ faturamento).
//   - Despesas fixas em R$ por linha (Plan/Proj editáveis, Real automático do CA).
//   - Linhas que não existem no Conta Azul (MKT Mídia, Produção Mensal Fixo, etc.)
//     são 100% manuais.
//
// Realizado do CA vem de gold.orcamento_realizado_mensal (já tem TODAS as
// categorias do CA — mapeadas pelo nome zykor, ou cru quando não mapeadas). A
// agregação p/ as linhas da orçamentação é feita aqui (não no banco), então não
// mexemos no de-para nem quebramos outros consumidores do gold.
// ============================================================================

// ==================== TIPOS ====================

export interface SubcategoriaOrcamento {
  nome: string;
  planejado: number;
  projecao: number;
  realizado: number;
  isPercentage?: boolean;
  manual?: boolean;        // realizado digitado na tela (não vem do CA)
  // Proveniência do realizado p/ o drill-down (popup de lançamentos):
  //   'ca'         -> lançamentos do Conta Azul (silver.lancamento_classificado) das goldCategorias
  //   'manual'     -> digitado na tela (orcamento_planilha) — sem lançamentos
  //   'consumacao' -> silver.consumacao_artistas — sem detalhe por lançamento (por ora)
  realizadoFonte?: 'ca' | 'manual' | 'consumacao';
  goldCategorias?: string[];  // categoria_zykor que compõem o realizado (fonte 'ca')
  // Linha % do faturamento (ex.: Escritório Central): célula mostra/edita o %;
  // planejado/projecao já vêm em R$ (=%×fat) pros totais. Quando presente, a UI
  // renderiza a célula como % editável.
  pctFatPlan?: number;
  pctFatProj?: number;
  pctFatReal?: number;
  // Linhas-filhas (ex.: CMO Fixo -> CUSTO-EMPRESA, Adicionais, ...). Quando presente,
  // o pai é a soma dos filhos e a UI permite expandir/recolher pra ver o detalhe.
  filhos?: SubcategoriaOrcamento[];
}

export interface CategoriaOrcamento {
  nome: string;
  cor: string;
  tipo: string;            // 'receita' | 'despesa'
  subcategorias: SubcategoriaOrcamento[];
  // Blocos % (Custos Variáveis / CMV): renderizados como 1 linha de %.
  modoPercentual?: boolean;
  percentual?: { plan: number; proj: number; real: number };
  blocoGold?: string;      // bloco_dre que compõe o realizado do bloco % (drill-down)
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

  // Real Fixo = soma das despesas fixas (Mão-de-Obra + Comerciais + Adm +
  // Operacionais + Ocupação). NÃO inclui Variáveis, CMV nem Não Operacionais.
  real_fixo_plan: number;
  real_fixo_proj: number;
  real_fixo_real: number;
  // Faturamento Meta: plan = Σ M1 dos eventos do mês (empilhamento da meta; fallback
  // planilha 'FATURAMENTO META'); proj = empilhamento do realizado (dias fechados);
  // real = entradas do Conta Azul (Stone + Pix + Dinheiro).
  faturamento_meta_plan: number;
  faturamento_meta_proj: number;
  faturamento_meta_real: number;
  // % Contribuição (MC) = 1 - (Var% + CMV%), em %.
  perc_contrib_plan: number;
  perc_contrib_proj: number;
  perc_contrib_real: number;
  // BreakEven = Real Fixo / MC.
  breakeven_plan: number;
  breakeven_proj: number;
  breakeven_real: number;
  // Lucro Líquido = Faturamento + Não Operacionais - Variáveis - CMV - Real Fixo.
  // (mantém o nome ebitda_* por compat com o client)
  ebitda_plan: number;
  ebitda_proj: number;
  ebitda_real: number;
  // Margem = Lucro Líquido / Faturamento.
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

type SubFixa = {
  nome: string;
  gold?: string[];   // categorias_zykor do gold que somam nessa linha
  manualKey?: string; // categoria do dre_manual a somar (quando difere do nome da linha)
  nomePorBar?: Record<number, string>; // nome/identidade da linha por bar (caso isolado: Deboche usa 'Administrativo Local')
  // Realizado SÓ da orçamentação (orcamento_planilha.valor_realizado_manual),
  // editável inline. NÃO vai pra DRE. Pra linhas que não existem no Conta Azul
  // (MKT Disparos/Pontos/Benefícios, Produção Mensal Fixo).
  orcOnly?: boolean;
  // Realizado = soma mensal da Consumação Artistas (silver.consumacao_artistas).
  consumacaoArtistas?: boolean;
  // Sublinhas: o pai vira a soma delas (ex.: CMO Fixo -> CUSTO-EMPRESA, Adicionais...).
  filhos?: SubFixa[];
};

type BlocoDef =
  | { nome: string; tipo: 'despesa'; cor: string; modo: 'percentual'; blocoGold: string }
  | { nome: string; tipo: 'receita' | 'despesa'; cor: string; modo: 'fixo'; subs: SubFixa[] };

const COR = {
  variaveis: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
  cmv: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
  pessoal: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  comercial: 'bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300',
  adm: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
  oper: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300',
  ocupacao: 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300',
  naoOp: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300',
};

// Estrutura da Orçamentação (espelha a planilha do sócio).
const ESTRUTURA: BlocoDef[] = [
  { nome: 'Custos Variáveis', tipo: 'despesa', cor: COR.variaveis, modo: 'percentual', blocoGold: 'Custos Variáveis' },
  { nome: 'Custo insumos (CMV)', tipo: 'despesa', cor: COR.cmv, modo: 'percentual', blocoGold: 'Custo insumos (CMV)' },
  {
    nome: 'Mão-de-Obra', tipo: 'despesa', cor: COR.pessoal, modo: 'fixo', subs: [
      // 2 linhas-pai (CMO Fixo / CMO Freela), cada uma com filhos expansíveis.
      // O pai é a soma dos filhos (realizado do CA + plan/proj da planilha de cada filho).
      {
        nome: 'CMO Fixo', filhos: [
          { nome: 'CUSTO-EMPRESA FUNCIONÁRIOS', gold: ['SALARIO FUNCIONARIOS', 'PROVISÃO TRABALHISTA', 'VALE TRANSPORTE'] },
          { nome: 'ADICIONAIS', gold: ['ADICIONAIS'] },
          { nome: 'ALIMENTAÇÃO', gold: ['ALIMENTAÇÃO'] },
          { nome: 'PRO LABORE', gold: ['PRO LABORE'] },
        ]
      },
      {
        nome: 'CMO Freela', filhos: [
          { nome: 'FREELA ATENDIMENTO', gold: ['FREELA ATENDIMENTO'] },
          { nome: 'FREELA BAR', gold: ['FREELA BAR'] },
          { nome: 'FREELA COZINHA', gold: ['FREELA COZINHA'] },
          { nome: 'FREELA LIMPEZA', gold: ['FREELA LIMPEZA'] },
          { nome: 'FREELA BRIGADISTA', gold: ['FREELA BRIGADISTA'] },
          { nome: 'FREELA SEGURANÇA', gold: ['FREELA SEGURANÇA'] },
        ]
      },
    ]
  },
  {
    nome: 'Despesas Comerciais', tipo: 'despesa', cor: COR.comercial, modo: 'fixo', subs: [
      // 4 categorias intermediárias (linhas-pai expansíveis), cada uma soma seus filhos —
      // mesmo esquema da Mão-de-Obra. Atrações/Produção mantêm a projeção do planejamento
      // comercial (montarSub roda em cada filho).
      {
        nome: 'Marketing', filhos: [
          { nome: 'Marketing Disparos', gold: ['Marketing Disparos'] },
          // 'Marketing Mídia' também puxa o legado 'Marketing' (bar 4 não re-categorizado no CA).
          { nome: 'Marketing Mídia', gold: ['Marketing Mídia', 'Marketing'] },
          { nome: 'Marketing Produção', gold: ['Marketing Produção'] },
        ]
      },
      {
        nome: 'Consumações Mkt', filhos: [
          { nome: '[Consumação] Benefício Clientes', gold: ['[Consumação] Benefício Clientes'] },
          { nome: '[Consumação] Aniversários', gold: ['[Consumação] Aniversários'] },
          { nome: '[Consumação] Influencers', gold: ['[Consumação] Influencers'] },
          { nome: '[Consumação] Programa de Pontos', gold: ['[Consumação] Programa de Pontos'] },
        ]
      },
      {
        nome: 'Artístico', filhos: [
          { nome: 'Atrações Programação', gold: ['Atrações Programação'] },
          { nome: '[Consumação] Artistas', gold: ['[Consumação] Artistas'] },
        ]
      },
      {
        nome: 'Produção', filhos: [
          { nome: 'Produção Eventos', gold: ['Produção Eventos'] },
          { nome: 'Produção Mensal Fixo', gold: ['Produção Mensal Fixo'] },
        ]
      },
    ]
  },
  {
    nome: 'Despesas Administrativas', tipo: 'despesa', cor: COR.adm, modo: 'fixo', subs: [
      { nome: 'Escritório Central', gold: ['Escritório Central'] },
      { nome: 'Administrativo Ordinário', gold: ['Administrativo Ordinário', 'Administrativo Local'], nomePorBar: { 4: 'Administrativo Deboche' } },
      { nome: 'RECURSOS HUMANOS', gold: ['RECURSOS HUMANOS'] },
      // Consumações de funcionários (realizado vem do Conta Azul; gold usa nome abreviado).
      { nome: '[Consumação] Funcionários Escritório', gold: ['Consumação Func Escritorio'] },
      { nome: '[Consumação] Funcionários Operação', gold: ['Consumação Func Operação'] },
    ]
  },
  {
    nome: 'Despesas Operacionais', tipo: 'despesa', cor: COR.oper, modo: 'fixo', subs: [
      { nome: 'Materiais Operação', gold: ['Materiais Operação'] },
      { nome: 'Acessórios Salão', gold: ['ACESSORIOS SALAO'] },
      { nome: 'Equipamentos Operação', gold: ['EQUIPAMENTOS OPERACAO'] },
      { nome: 'Locações Operação', gold: ['LOCACOES OPERACAO'] },
      { nome: 'Estorno', gold: ['Estorno'] },
      { nome: 'Materiais de Limpeza e Descartáveis', gold: ['Materiais de Limpeza e Descartáveis'] },
      { nome: 'Utensílios', gold: ['Utensílios'] },
      { nome: 'Outros Operação', gold: ['Outros Operação'] },
    ]
  },
  {
    nome: 'Despesas de Ocupação', tipo: 'despesa', cor: COR.ocupacao, modo: 'fixo', subs: [
      { nome: 'ALUGUEL/CONDOMÍNIO/IPTU', gold: ['ALUGUEL/CONDOMÍNIO/IPTU'] },
      { nome: 'ÁGUA', gold: ['ÁGUA'] },
      { nome: 'GÁS', gold: ['GÁS'] },
      { nome: 'INTERNET', gold: ['INTERNET'] },
      // Sem "TENDA" solto (igual à planilha): CA 'TENDA' cai em Manutenção. Rever depois.
      { nome: 'Manutenção', gold: ['Manutenção', 'TENDA'] },
      { nome: 'LUZ', gold: ['LUZ'] },
    ]
  },
  {
    nome: 'Não Operacionais', tipo: 'receita', cor: COR.naoOp, modo: 'fixo', subs: [
      // Contratos Cashback Mensal: realizado vem do Conta Azul (gold, categoria_zykor
      // 'CONTRATOS' = SÓ cashback mensal Ambev) + ajustes manuais. Contratos Anuais
      // NÃO entra na orçamentação (é projeção da DRE; anual vai pra Investimentos na
      // DRE) — re-mapeado p/ 'CONTRATOS ANUAIS' em meta.categoria_zykor_map.
      { nome: 'Contratos Cashback Mensal', gold: ['CONTRATOS'], manualKey: 'Contratos' },
    ]
  },
];

// Blocos de despesa fixa que compõem o Real Fixo.
const BLOCOS_FIXOS = new Set([
  'Mão-de-Obra', 'Despesas Comerciais', 'Despesas Administrativas',
  'Despesas Operacionais', 'Despesas de Ocupação',
]);

const MESES_NOMES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface OrcamentoPlanilhaRow {
  ano: number;
  mes: number;
  categoria_nome: string;
  valor_planejado: number | string | null;
  valor_projetado: number | string | null;
  valor_realizado_manual: number | string | null;
}

const num = (v: number | string | null | undefined): number => Number(v ?? 0) || 0;

// ==================== SERVICE ====================

export async function getOrcamentacaoCompleta(
  supabase: SupabaseClient,
  barId: number,
  ano: number,
  mesInicio: number,
  quantidade: number = 12
): Promise<MesOrcamento[]> {
  const mesesParaBuscar: { mes: number; ano: number }[] = [];
  for (let i = 0; i < quantidade; i++) {
    let m = mesInicio + i, a = ano;
    if (m > 12) { m -= 12; a += 1; }
    mesesParaBuscar.push({ mes: m, ano: a });
  }

  const anosUnicos = [...new Set(mesesParaBuscar.map(m => m.ano))];
  const primeiro = mesesParaBuscar[0];
  const ultimo = mesesParaBuscar[mesesParaBuscar.length - 1];
  const ultimoDia = new Date(ultimo.ano, ultimo.mes, 0).getDate();
  const dataInicio = `${primeiro.ano}-${String(primeiro.mes).padStart(2, '0')}-01`;
  const dataFim = `${ultimo.ano}-${String(ultimo.mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

  const [planilhaResult, goldResult, eventosResult, manuaisResult, consumacaoResult, planComResult] = await Promise.all([
    supabase
      .from('orcamento_planilha')
      .select('ano, mes, categoria_nome, valor_planejado, valor_projetado, valor_realizado_manual')
      .eq('bar_id', barId)
      .in('ano', anosUnicos),
    (supabase as unknown as { schema: (s: string) => SupabaseClient }).schema('gold')
      .from('orcamento_realizado_mensal')
      .select('ano, mes, categoria_zykor, bloco_dre, net')
      .eq('bar_id', barId)
      .in('ano', anosUnicos),
    tbl(supabase, 'eventos_base')
      .select('real_r, m1_r, data_evento, c_art, c_prod, c_artistico_plan, c_prod_plan, c_art_projecao, c_prod_projecao')
      .eq('bar_id', barId).gte('data_evento', dataInicio).lte('data_evento', dataFim).eq('ativo', true),
    // Ajustes manuais da aba "DRE Manual" (consumo de estoque, bonificações, etc.)
    // que somam ao realizado do Conta Azul por categoria/macro.
    (supabase.schema('financial' as never) as any)
      .from('dre_manual')
      .select('valor, categoria, categoria_macro, data_competencia')
      .eq('bar_id', barId)
      .gte('data_competencia', dataInicio).lte('data_competencia', dataFim),
    // Consumação Artistas (comp do ContaHub) por dia — soma mensal vira linha na orçamentação.
    (supabase as unknown as { schema: (s: string) => SupabaseClient }).schema('silver')
      .from('consumacao_artistas')
      .select('data, valor')
      .eq('bar_id', barId)
      .gte('data', dataInicio).lte('data', dataFim),
    // Faturamento Meta: MESMA fonte do /planejamento-comercial (gold.planejamento),
    // pra Planejado/Projetado/Realizado baterem com a tela. eventos_base.real_r não
    // inclui Yuzer/Sympla (bar 4 ficava ~60k menor); o consolidado do gold inclui.
    (supabase as unknown as { schema: (s: string) => SupabaseClient }).schema('gold')
      .from('planejamento')
      .select('data_evento, m1_r, faturamento_total_consolidado')
      .eq('bar_id', barId)
      .gte('data_evento', dataInicio).lte('data_evento', dataFim).eq('ativo', true),
  ]);

  const dadosPlanilha = (planilhaResult.data || []) as OrcamentoPlanilhaRow[];
  const dadosGold = (goldResult.data || []) as Array<{ ano: number; mes: number; categoria_zykor: string; bloco_dre: string | null; net: number | string }>;
  const eventosBase = (eventosResult.data || []) as Array<{ m1_r: number | null; real_r: number | null; data_evento: string; c_art: number | null; c_prod: number | null; c_artistico_plan: number | null; c_prod_plan: number | null; c_art_projecao: number | null; c_prod_projecao: number | null }>;
  const dadosManuais = ((manuaisResult as { data?: unknown }).data || []) as Array<{ valor: number | string; categoria: string | null; categoria_macro: string | null; data_competencia: string }>;
  const dadosConsumacao = ((consumacaoResult as { data?: unknown }).data || []) as Array<{ data: string; valor: number | string }>;
  const planComercial = ((planComResult as { data?: unknown }).data || []) as Array<{ data_evento: string; m1_r: number | null; faturamento_total_consolidado: number | null }>;

  // Consumação Artistas: soma mensal por (ano-mes).
  const consumacaoMesMap = new Map<string, number>();
  dadosConsumacao.forEach(c => {
    if (!c.data) return;
    const [a, mm] = c.data.split('-');
    const k = `${parseInt(a)}-${parseInt(mm)}`;
    consumacaoMesMap.set(k, (consumacaoMesMap.get(k) || 0) + num(c.valor));
  });

  // Index planilha por (ano, mes, categoria_nome)
  const planilhaMap = new Map<string, OrcamentoPlanilhaRow>();
  dadosPlanilha.forEach(p => planilhaMap.set(`${p.ano}-${p.mes}-${p.categoria_nome}`, p));

  // Index dre_manual por (ano-mes-categoria) e (ano-mes-macro).
  const manualCatMap = new Map<string, number>();
  const manualMacroMap = new Map<string, number>();
  dadosManuais.forEach(m => {
    if (!m.data_competencia) return;
    const [a, mm] = m.data_competencia.split('-');
    const ymp = `${parseInt(a)}-${parseInt(mm)}`;
    const v = num(m.valor);
    if (m.categoria) manualCatMap.set(`${ymp}-${m.categoria}`, (manualCatMap.get(`${ymp}-${m.categoria}`) || 0) + v);
    if (m.categoria_macro) manualMacroMap.set(`${ymp}-${m.categoria_macro}`, (manualMacroMap.get(`${ymp}-${m.categoria_macro}`) || 0) + v);
  });

  // Index gold por (ano, mes, categoria_zykor) -> net e soma por bloco_dre.
  // Match case/acento-insensitive: a ESTRUTURA referencia em MAIÚSCULO mas o de-para
  // às vezes grava em Título (ex: 'LOCACOES OPERACAO' vs 'Locações Operação') → não
  // casava e mostrava 0. Normaliza dos 2 lados (vale pros 2 bares).
  const normKey = (s: string) => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().trim();
  const goldCatMap = new Map<string, number>();
  const goldBlocoMap = new Map<string, number>();
  dadosGold.forEach(g => {
    const net = num(g.net);
    const ck = `${g.ano}-${g.mes}-${normKey(g.categoria_zykor)}`;
    goldCatMap.set(ck, (goldCatMap.get(ck) || 0) + net);
    if (g.bloco_dre) {
      const bk = `${g.ano}-${g.mes}-${g.bloco_dre}`;
      goldBlocoMap.set(bk, (goldBlocoMap.get(bk) || 0) + net);
    }
  });

  // Por mês, a partir do planejamento comercial / eventos_base:
  //  - realRMap: Σ real_r (faturamento real ContaHub)
  //  - projMap (Empilhamento): SÓ realizado dos dias já FECHADOS (< hoje = até ontem).
  //              Hoje e futuro NÃO entram (esperam o real do ContaHub cair). Assim o
  //              dia em andamento / evento futuro não distorce com M1 baixo
  //              (ex: jogo do Brasil — real >> M1). Decisão do sócio jun/2026.
  // hoje em America/Sao_Paulo — igual ao /planejamento-comercial (evita off-by-3h do UTC).
  const hojeStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  // M1 AO VIVO: o gold.planejamento só é reconstruído 1x/dia (cron etl_gold_planejamento,
  // 08:50 BRT). A edição de M1/empilhamento no /planejamento-comercial grava em
  // eventos_base na hora. Por isso fazemos o MESMO overlay da tela de planejamento
  // (manual?.m1_r ?? gold.m1_r) — senão a meta de receita só atualizava no dia seguinte.
  const liveM1ByDate = new Map<string, number | null>();
  eventosBase.forEach(e => { if (e.data_evento) liveM1ByDate.set(e.data_evento, e.m1_r); });
  const m1Vivo = (e: { data_evento: string; m1_r: number | null }) =>
    (liveM1ByDate.get(e.data_evento) ?? e.m1_r) || 0;
  const realRMap = new Map<string, number>();    // Σ faturamento consolidado = Realizado da tela de planejamento
  const projMap = new Map<string, number>();      // Empilhamento M1: dia fechado usa o realizado; hoje/futuro usa M1
  const m1Map = new Map<string, number>();        // Σ M1 dos eventos por mês = Meta M1 (Planejado)
  const cArtMesMap = new Map<string, number>();   // Σ artístico do planejamento (real do dia fechado / projeção do futuro)
  const cProdMesMap = new Map<string, number>();  // Σ produção idem
  mesesParaBuscar.forEach(({ mes, ano }) => {
    const mm = String(mes).padStart(2, '0');
    const ini = `${ano}-${mm}-01`;
    const fim = `${ano}-${mm}-${new Date(ano, mes, 0).getDate()}`;
    const k = `${ano}-${mes}`;
    // Faturamento Meta: mesma fonte/fórmula do /planejamento-comercial (gold.planejamento).
    const planDoMes = planComercial.filter(e => e.data_evento >= ini && e.data_evento <= fim);
    m1Map.set(k, planDoMes.reduce((s, e) => s + m1Vivo(e), 0));
    realRMap.set(k, planDoMes.reduce((s, e) => s + (e.faturamento_total_consolidado || 0), 0));
    projMap.set(k, planDoMes.reduce(
      (s, e) => s + (e.data_evento < hojeStr && (e.faturamento_total_consolidado || 0) > 0
        ? (e.faturamento_total_consolidado || 0) : m1Vivo(e)), 0));
    // Custo artístico/produção (projeção de Atrações/Produção) seguem do eventos_base.
    const doMes = eventosBase.filter(e => e.data_evento >= ini && e.data_evento <= fim);
    // Prioridade igual ao planejamento-comercial: real c_art > override manual
    // (c_artistico_plan) > projeção auto (c_art_projecao). Antes pulava o plan e
    // ia direto pra projeção auto (inflava ex.: 29/06 Deboche = 24.792 em vez de 2.000).
    cArtMesMap.set(k, doMes.reduce((s, e) => s + ((e.c_art || 0) > 0 ? (e.c_art || 0) : (e.c_artistico_plan || 0) > 0 ? (e.c_artistico_plan || 0) : (e.c_art_projecao || 0)), 0));
    cProdMesMap.set(k, doMes.reduce((s, e) => s + ((e.c_prod || 0) > 0 ? (e.c_prod || 0) : (e.c_prod_plan || 0) > 0 ? (e.c_prod_plan || 0) : (e.c_prod_projecao || 0)), 0));
  });

  return mesesParaBuscar.map(({ mes, ano }) => {
    const planilha = (cat: string) => planilhaMap.get(`${ano}-${mes}-${cat}`);
    const goldCat = (cat: string) => goldCatMap.get(`${ano}-${mes}-${normKey(cat)}`) || 0;
    const manualCat = (cat: string) => manualCatMap.get(`${ano}-${mes}-${cat}`) || 0;
    const manualMacro = (macro: string) => manualMacroMap.get(`${ano}-${mes}-${macro}`) || 0;

    // Faturamento Meta.
    // Real = TODA a receita do Conta Azul no mês (bloco 'Receita': Stone Créd/Déb/Pix
    // + Pix Direto + Dinheiro + Receita de Eventos + Outras Receitas) + ajustes manuais
    // de receita (DRE Manual). É a base de receita que a DRE usa pros % de Var/CMV.
    // Planejado = MANUAL (planilha 'FATURAMENTO META' — o sócio preenche).
    // Espelha o /planejamento-comercial (decisão do sócio jun/2026):
    //   Planejado = Meta M1 (Σ M1)  ·  Projetado = Empilhamento  ·  Realizado = Σ consolidado.
    const fatPlan = m1Map.get(`${ano}-${mes}`) || 0;
    const fatProj = projMap.get(`${ano}-${mes}`) || 0;
    const fatReal = realRMap.get(`${ano}-${mes}`) || 0;

    const categorias: CategoriaOrcamento[] = ESTRUTURA.map(bloco => {
      if (bloco.modo === 'percentual') {
        const planPct = num(planilha(bloco.nome)?.valor_planejado);
        const projPct = num(planilha(bloco.nome)?.valor_projetado);
        // Realizado R$ = Conta Azul (gold) − ajustes manuais (DRE Manual).
        // dre_manual usa sinal de "impacto no lucro": positivo reduz despesa, negativo aumenta.
        const realR = (goldBlocoMap.get(`${ano}-${mes}-${bloco.blocoGold}`) || 0) - manualMacro(bloco.blocoGold);
        const realPct = fatReal > 0 ? (realR / fatReal) * 100 : 0;
        return {
          nome: bloco.nome, cor: bloco.cor, tipo: 'despesa',
          subcategorias: [],
          modoPercentual: true,
          percentual: { plan: planPct, proj: projPct, real: realPct },
          blocoGold: bloco.blocoGold,
        };
      }
      // Monta uma subcategoria-folha (sem filhos) a partir da definição.
      //   orcOnly -> digitado na tela (valor_realizado_manual); só na orçamentação, não vai pra DRE.
      //   demais  -> Conta Azul (gold) + ajustes da DRE Manual (receita soma; despesa subtrai).
      const montarSub = (s: SubFixa): SubcategoriaOrcamento => {
        const nomeBar = s.nomePorBar?.[barId] ?? s.nome; // caso isolado por bar (ex: Deboche -> Administrativo Local)
        const prow = planilha(nomeBar);
        let plan = num(prow?.valor_planejado);
        let proj = num(prow?.valor_projetado);
        // Linhas que são % do faturamento (ex.: Escritório Central): a célula mostra/edita
        // o %, mas planejado/projecao seguem em R$ (=%×fat) pros totais/Real Fixo.
        let pctFatPlan: number | undefined;
        let pctFatProj: number | undefined;
        let pctFatReal: number | undefined;
        // Item 4: Atrações Programação / Produção Eventos -> projeção = somatório do
        // planejamento comercial (Σ c_art / c_prod; real do dia fechado + projeção do futuro).
        if (s.nome === 'Atrações Programação') proj = cArtMesMap.get(`${ano}-${mes}`) ?? proj;
        else if (s.nome === 'Produção Eventos') proj = cProdMesMap.get(`${ano}-${mes}`) ?? proj;
        // Item 3: Escritório Central = % do Faturamento (igual CMV), nos 2 bares. A
        // planilha guarda o % (default 4%); a célula mostra/edita o %, mas o R$
        // (=%×faturamento) é o que entra no Real Fixo e nos totais. Guard: valor>100
        // = R$ legado da época do override -> cai no 4% até o sócio digitar o % novo.
        if (s.nome === 'Escritório Central') {
          const ppPlan = num(prow?.valor_planejado);
          const ppProj = num(prow?.valor_projetado);
          const pctPlan = (ppPlan > 0 && ppPlan <= 100) ? ppPlan : 4;
          const pctProj = (ppProj > 0 && ppProj <= 100) ? ppProj : 4;
          plan = (pctPlan / 100) * fatPlan;
          proj = (pctProj / 100) * fatProj;
          pctFatPlan = pctPlan;
          pctFatProj = pctProj;
        }
        let real: number;
        let realizadoFonte: SubcategoriaOrcamento['realizadoFonte'];
        let goldCategorias: string[] | undefined;
        if (s.consumacaoArtistas) {
          real = consumacaoMesMap.get(`${ano}-${mes}`) || 0;
          realizadoFonte = 'consumacao';
        } else if (s.orcOnly) {
          real = num(prow?.valor_realizado_manual);
          realizadoFonte = 'manual';
        } else {
          const goldVal = (s.gold || []).reduce((sum, g) => sum + goldCat(g), 0);
          const manualVal = manualCat(s.manualKey || nomeBar);
          real = bloco.tipo === 'receita' ? goldVal + manualVal : goldVal - manualVal;
          realizadoFonte = 'ca';
          goldCategorias = s.gold;
        }
        // Linha % do faturamento: realizado também vira % (R$ realizado / faturamento realizado).
        if (pctFatPlan !== undefined) pctFatReal = fatReal > 0 ? (real / fatReal) * 100 : 0;
        return { nome: nomeBar, planejado: plan, projecao: proj, realizado: real, isPercentage: false, manual: !!s.orcOnly, realizadoFonte, goldCategorias, pctFatPlan, pctFatProj, pctFatReal };
      };
      const subcategorias = bloco.subs.map(s => {
        // Linha-pai com filhos (ex.: CMO Fixo): soma dos filhos; UI expande pra ver o detalhe.
        if (s.filhos && s.filhos.length) {
          const filhos = s.filhos.map(montarSub);
          return {
            nome: s.nome,
            planejado: filhos.reduce((a, f) => a + f.planejado, 0),
            projecao: filhos.reduce((a, f) => a + f.projecao, 0),
            realizado: filhos.reduce((a, f) => a + f.realizado, 0),
            isPercentage: false,
            realizadoFonte: 'ca' as const,
            goldCategorias: filhos.flatMap(f => f.goldCategorias || []),
            filhos,
          };
        }
        return montarSub(s);
      });
      return { nome: bloco.nome, cor: bloco.cor, tipo: bloco.tipo, subcategorias };
    });

    // ---- Totais ----
    const findPct = (nome: string) => categorias.find(c => c.nome === nome)!.percentual!;
    const varPct = findPct('Custos Variáveis');
    const cmvPct = findPct('Custo insumos (CMV)');

    // Custos variáveis e CMV em R$ por coluna. Plan/Proj = % × faturamento da coluna;
    // Real = Conta Azul (gold) + ajustes manuais do macro (DRE Manual).
    const varPlanR = (varPct.plan / 100) * fatPlan;
    const varProjR = (varPct.proj / 100) * fatProj;
    const varRealR = (goldBlocoMap.get(`${ano}-${mes}-Custos Variáveis`) || 0) - manualMacro('Custos Variáveis');
    const cmvPlanR = (cmvPct.plan / 100) * fatPlan;
    const cmvProjR = (cmvPct.proj / 100) * fatProj;
    const cmvRealR = (goldBlocoMap.get(`${ano}-${mes}-Custo insumos (CMV)`) || 0) - manualMacro('Custo insumos (CMV)');

    // Real Fixo (soma das despesas fixas)
    let rfPlan = 0, rfProj = 0, rfReal = 0;
    // Não Operacionais (net = soma das subs, todas receita aqui)
    let naoOpPlan = 0, naoOpProj = 0, naoOpReal = 0;
    categorias.forEach(cat => {
      if (BLOCOS_FIXOS.has(cat.nome)) {
        cat.subcategorias.forEach(s => { rfPlan += s.planejado; rfProj += s.projecao; rfReal += s.realizado; });
      } else if (cat.nome === 'Não Operacionais') {
        cat.subcategorias.forEach(s => { naoOpPlan += s.planejado; naoOpProj += s.projecao; naoOpReal += s.realizado; });
      }
    });

    // % Contribuição (MC) = 1 - (Var% + CMV%)
    const mcPlan = 1 - (varPct.plan + cmvPct.plan) / 100;
    const mcProj = 1 - (varPct.proj + cmvPct.proj) / 100;
    const mcReal = 1 - (varPct.real + cmvPct.real) / 100;

    // BreakEven = Real Fixo / MC
    const bePlan = mcPlan > 0 ? rfPlan / mcPlan : 0;
    const beProj = mcProj > 0 ? rfProj / mcProj : 0;
    const beReal = mcReal > 0 ? rfReal / mcReal : 0;

    // Lucro Líquido = (Faturamento − BreakEven) × %Contrib + Contratos (Não Op)
    // Fórmula do Excel do sócio (BF47): =(BF2-BF4)*BF5+BF45
    const llPlan = (fatPlan - bePlan) * mcPlan + naoOpPlan;
    const llProj = (fatProj - beProj) * mcProj + naoOpProj;
    const llReal = (fatReal - beReal) * mcReal + naoOpReal;

    const despPlan = varPlanR + cmvPlanR + rfPlan;
    const despProj = varProjR + cmvProjR + rfProj;
    const despReal = varRealR + cmvRealR + rfReal;

    return {
      mes, ano, label: `${MESES_NOMES[mes]}/${String(ano).slice(-2)}`,
      isAtual: new Date().getMonth() + 1 === mes && new Date().getFullYear() === ano,
      categorias,
      totais: {
        receita_planejado: fatPlan, receita_projecao: fatProj, receita_realizado: fatReal,
        despesas_planejado: despPlan, despesas_projecao: despProj, despesas_realizado: despReal,
        lucro_planejado: llPlan, lucro_projecao: llProj, lucro_realizado: llReal,
        margem_planejado: fatPlan > 0 ? (llPlan / fatPlan) * 100 : 0,
        margem_projecao: fatProj > 0 ? (llProj / fatProj) * 100 : 0,
        margem_realizado: fatReal > 0 ? (llReal / fatReal) * 100 : 0,
        real_fixo_plan: rfPlan, real_fixo_proj: rfProj, real_fixo_real: rfReal,
        faturamento_meta_plan: fatPlan, faturamento_meta_proj: fatProj, faturamento_meta_real: fatReal,
        perc_contrib_plan: mcPlan * 100, perc_contrib_proj: mcProj * 100, perc_contrib_real: mcReal * 100,
        breakeven_plan: bePlan, breakeven_proj: beProj, breakeven_real: beReal,
        ebitda_plan: llPlan, ebitda_proj: llProj, ebitda_real: llReal,
        margem_ebitda_plan: fatPlan > 0 ? (llPlan / fatPlan) * 100 : 0,
        margem_ebitda_proj: fatProj > 0 ? (llProj / fatProj) * 100 : 0,
        margem_ebitda_real: fatReal > 0 ? (llReal / fatReal) * 100 : 0,
      }
    };
  });
}
