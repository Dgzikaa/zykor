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
}

export interface CategoriaOrcamento {
  nome: string;
  cor: string;
  tipo: string;            // 'receita' | 'despesa'
  subcategorias: SubcategoriaOrcamento[];
  // Blocos % (Custos Variáveis / CMV): renderizados como 1 linha de %.
  modoPercentual?: boolean;
  percentual?: { plan: number; proj: number; real: number };
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
  // Faturamento Meta: plan = planilha; proj = M1 (eventos_base.m1_r);
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
  // Realizado SÓ da orçamentação (orcamento_planilha.valor_realizado_manual),
  // editável inline. NÃO vai pra DRE. Pra linhas que não existem no Conta Azul
  // (MKT Disparos/Pontos/Benefícios, Produção Mensal Fixo).
  orcOnly?: boolean;
  // Realizado = soma mensal da Consumação Artistas (silver.consumacao_artistas).
  consumacaoArtistas?: boolean;
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
      { nome: 'CUSTO-EMPRESA FUNCIONÁRIOS', gold: ['SALARIO FUNCIONARIOS', 'PROVISÃO TRABALHISTA', 'VALE TRANSPORTE'] },
      { nome: 'ADICIONAIS', gold: ['ADICIONAIS'] },
      { nome: 'ALIMENTAÇÃO', gold: ['ALIMENTAÇÃO'] },
      { nome: 'FREELA ATENDIMENTO', gold: ['FREELA ATENDIMENTO'] },
      { nome: 'FREELA BAR', gold: ['FREELA BAR'] },
      { nome: 'FREELA COZINHA', gold: ['FREELA COZINHA'] },
      { nome: 'FREELA LIMPEZA', gold: ['FREELA LIMPEZA'] },
      { nome: 'FREELA BRIGADISTA', gold: ['FREELA BRIGADISTA'] },
      { nome: 'FREELA SEGURANÇA', gold: ['FREELA SEGURANÇA'] },
      { nome: 'PRO LABORE', gold: ['PRO LABORE'] },
    ]
  },
  {
    nome: 'Despesas Comerciais', tipo: 'despesa', cor: COR.comercial, modo: 'fixo', subs: [
      // Sem "Marketing" solto (igual à planilha): o CA 'Marketing' + consumo cai em
      // 'Marketing Mídia' (via gold + manualKey) p/ não perder realizado. Rever depois.
      { nome: 'Marketing Mídia', gold: ['Marketing'], manualKey: 'Marketing' },
      { nome: 'MKT Disparos', orcOnly: true },
      { nome: 'MKT Programa de Pontos', orcOnly: true },
      { nome: 'MKT Beneficios', orcOnly: true },
      { nome: 'Atrações Programação', gold: ['Atrações Programação'] },
      { nome: 'Produção Mensal Fixo', orcOnly: true },
      { nome: 'Produção Eventos', gold: ['Produção Eventos'] },
      { nome: 'Consumação Artistas', consumacaoArtistas: true },
    ]
  },
  {
    nome: 'Despesas Administrativas', tipo: 'despesa', cor: COR.adm, modo: 'fixo', subs: [
      { nome: 'Escritório Central', gold: ['Escritório Central'] },
      { nome: 'Administrativo Ordinário', gold: ['Administrativo Ordinário'] },
      { nome: 'RECURSOS HUMANOS', gold: ['RECURSOS HUMANOS'] },
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
      // Só Contratos. Realizado vem do financial.dre_manual (categoria 'Contratos').
      { nome: 'Contratos' },
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

  const [planilhaResult, goldResult, eventosResult, manuaisResult, consumacaoResult] = await Promise.all([
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
      .select('real_r, m1_r, data_evento')
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
  ]);

  const dadosPlanilha = (planilhaResult.data || []) as OrcamentoPlanilhaRow[];
  const dadosGold = (goldResult.data || []) as Array<{ ano: number; mes: number; categoria_zykor: string; bloco_dre: string | null; net: number | string }>;
  const eventosBase = (eventosResult.data || []) as Array<{ m1_r: number | null; real_r: number | null; data_evento: string }>;
  const dadosManuais = ((manuaisResult as { data?: unknown }).data || []) as Array<{ valor: number | string; categoria: string | null; categoria_macro: string | null; data_competencia: string }>;
  const dadosConsumacao = ((consumacaoResult as { data?: unknown }).data || []) as Array<{ data: string; valor: number | string }>;

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
  const goldCatMap = new Map<string, number>();
  const goldBlocoMap = new Map<string, number>();
  dadosGold.forEach(g => {
    const net = num(g.net);
    goldCatMap.set(`${g.ano}-${g.mes}-${g.categoria_zykor}`, (goldCatMap.get(`${g.ano}-${g.mes}-${g.categoria_zykor}`) || 0) + net);
    if (g.bloco_dre) {
      const bk = `${g.ano}-${g.mes}-${g.bloco_dre}`;
      goldBlocoMap.set(bk, (goldBlocoMap.get(bk) || 0) + net);
    }
  });

  // Por mês, a partir do planejamento comercial / eventos_base:
  //  - realRMap: Σ real_r (faturamento real ContaHub)
  //  - projMap:  PROJEÇÃO = realizado dos dias já passados (< hoje) + M1 dos dias que faltam
  //              (>= hoje). Mesma lógica da planilha do sócio. Para mês fechado => Σ real;
  //              mês futuro => Σ M1; mês corrente => blend.
  const hojeStr = new Date().toISOString().split('T')[0];
  const realRMap = new Map<string, number>();
  const projMap = new Map<string, number>();
  mesesParaBuscar.forEach(({ mes, ano }) => {
    const mm = String(mes).padStart(2, '0');
    const ini = `${ano}-${mm}-01`;
    const fim = `${ano}-${mm}-${new Date(ano, mes, 0).getDate()}`;
    const doMes = eventosBase.filter(e => e.data_evento >= ini && e.data_evento <= fim);
    realRMap.set(`${ano}-${mes}`, doMes.reduce((s, e) => s + (e.real_r || 0), 0));
    projMap.set(`${ano}-${mes}`, doMes.reduce(
      (s, e) => s + (e.data_evento < hojeStr ? (e.real_r || 0) : (e.m1_r || 0)), 0));
  });

  return mesesParaBuscar.map(({ mes, ano }) => {
    const planilha = (cat: string) => planilhaMap.get(`${ano}-${mes}-${cat}`);
    const goldCat = (cat: string) => goldCatMap.get(`${ano}-${mes}-${cat}`) || 0;
    const manualCat = (cat: string) => manualCatMap.get(`${ano}-${mes}-${cat}`) || 0;
    const manualMacro = (macro: string) => manualMacroMap.get(`${ano}-${mes}-${macro}`) || 0;

    // Faturamento Meta.
    // Real = TODA a receita do Conta Azul no mês (bloco 'Receita': Stone Créd/Déb/Pix
    // + Pix Direto + Dinheiro + Receita de Eventos + Outras Receitas) + ajustes manuais
    // de receita (DRE Manual). É a base de receita que a DRE usa pros % de Var/CMV.
    const fatPlan = num(planilha('FATURAMENTO META')?.valor_planejado);
    // Projetado: usa o valor digitado na planilha (revisão semanal); se não houver,
    // cai no Empilhamento M1 (Σ eventos_base.m1_r).
    const fatProjManual = num(planilha('FATURAMENTO META')?.valor_projetado);
    const fatProj = fatProjManual > 0 ? fatProjManual : (projMap.get(`${ano}-${mes}`) || 0);
    // Realizado: meses fechados = Conta Azul (oficial). Mês corrente = ContaHub (Σ real_r),
    // porque no Conta Azul o cartão de crédito só entra na liquidação (atrasado) e o mês
    // corrente subreportava o faturamento. (decisão sócio jun/2026)
    const fatRealCA = (goldBlocoMap.get(`${ano}-${mes}-Receita`) || 0) + manualMacro('Receita');
    const ehMesAtual = new Date().getMonth() + 1 === mes && new Date().getFullYear() === ano;
    const fatRealContahub = realRMap.get(`${ano}-${mes}`) || 0;
    const fatReal = ehMesAtual && fatRealContahub > fatRealCA ? fatRealContahub : fatRealCA;

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
        };
      }
      const subcategorias = bloco.subs.map(s => {
        const prow = planilha(s.nome);
        const plan = num(prow?.valor_planejado);
        const proj = num(prow?.valor_projetado);
        // Realizado:
        //   orcOnly -> digitado na tela (valor_realizado_manual); só na orçamentação, não vai pra DRE.
        //   demais  -> Conta Azul (gold) + ajustes da DRE Manual. dre_manual usa sinal de
        //              impacto no lucro: receita soma; despesa subtrai.
        let real: number;
        if (s.consumacaoArtistas) {
          real = consumacaoMesMap.get(`${ano}-${mes}`) || 0;
        } else if (s.orcOnly) {
          real = num(prow?.valor_realizado_manual);
        } else {
          const goldVal = (s.gold || []).reduce((sum, g) => sum + goldCat(g), 0);
          const manualVal = manualCat(s.manualKey || s.nome);
          real = bloco.tipo === 'receita' ? goldVal + manualVal : goldVal - manualVal;
        }
        return { nome: s.nome, planejado: plan, projecao: proj, realizado: real, isPercentage: false, manual: !!s.orcOnly };
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
