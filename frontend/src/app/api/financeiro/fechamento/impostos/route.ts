import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFerramentaFinanceira, FERRAMENTA_FINANCEIRA } from '@/lib/auth/financeiro-guard';
import {
  getLancadorAdmin, getCAToken, resolveCategoriaId, resolveContaPadrao, criarLancamentoCA,
  round2, ultimoDiaMes, mesAnteriorBRT, mesSeguinte, vencimentoTrimestral, parseChaves,
} from '@/lib/financeiro/contaazul-lancador';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * IMPOSTOS SIMULADOS (fechamento mensal) → Conta Azul. 5 lançamentos DESPESA "placeholder"
 * (IRPJ, CSLL, ICMS, COFINS, PIS) na categoria "IMPOSTO", competência do mês fechado, sem baixa.
 * Substituídos manualmente pelo valor oficial quando sair (CA não tem DELETE).
 *
 * Fórmula (planilha "Simulador Tributos"), por mês. base = Faturamento − Gorjeta − Couvert.
 *   Faturamento = MAIOR entre NF ContaHub emitidas e Stone bruto.
 *   IRPJ   = base*1.2% + max(0,(base−250000)*0.8%)   [trimestral: venc dia 30 do mês seguinte ao tri]
 *   CSLL   = base*1.08%                               [trimestral]
 *   ICMS   = Faturamento*2%                           [mensal: venc dia 20]
 *   COFINS = (Faturamento − Gorjeta − Couvert − BebidasFrias)*3%   [bebidas frias = monofásico, saem]
 *   PIS    = (Faturamento − Gorjeta − Couvert − BebidasFrias)*0.65%
 * Idempotente por financial.lancamento_manual_ca_log (tipo='imposto', chave=sigla).
 *
 *  - GET  : preview do mês (não escreve).
 *  - POST : cria os lançamentos que faltam (admin/financeiro).
 */

const TIPO = 'imposto';
const CAT_NOME = ['IMPOSTO', 'Imposto']; // resolvido por nome (case/acento-insensível)
const MES_LABEL = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface BaseImpostos { faturamento_nf: number; faturamento_stone: number; couvert: number; gorjeta: number; bebidas_frias: number; }
interface BaseCnpj extends BaseImpostos { cnpj_indice: number | null; cnpj_label: string; cnpj_documento: string | null; origem_xml: boolean; regime?: string; rbt12?: number; }
interface Tributo { sigla: string; nome: string; valor: number; vencimento: string; periodicidade: 'mensal' | 'trimestral'; }

/** Chave do log por tributo. Com CNPJ (Ordinário/Deboche têm 2) fica "SIGLA#indice"; sem, só "SIGLA". */
const chaveLog = (sigla: string, cnpjIndice: number | null) => cnpjIndice == null ? sigla : `${sigla}#${cnpjIndice}`;

/** Vencimento dia 20 do mês seguinte à competência. */
function venc20MesSeguinte(ano: number, mes: number): string {
  const s = mesSeguinte(ano, mes);
  return `${s.ano}-${String(s.mes).padStart(2, '0')}-20`;
}

/** Calcula os 5 tributos do mês a partir da base agregada (fn_impostos_base_mensal). */
export function calcularTributos(base: BaseImpostos, ano: number, mes: number): { faturamento: number; baseLucro: number; baseMonofasica: number; tributos: Tributo[] } {
  const faturamento = round2(Math.max(Number(base.faturamento_nf || 0), Number(base.faturamento_stone || 0)));
  const couvert = round2(Number(base.couvert || 0));
  const gorjeta = round2(Number(base.gorjeta || 0));
  const bebidas = round2(Number(base.bebidas_frias || 0));
  const baseLucro = round2(faturamento - gorjeta - couvert);
  const baseMonofasica = round2(faturamento - gorjeta - couvert - bebidas);

  const irpj = round2(baseLucro * 0.012 + Math.max(0, (baseLucro - 250000) * 0.008));
  const csll = round2(baseLucro * 0.0108);
  const icms = round2(faturamento * 0.02);
  const cofins = round2(baseMonofasica * 0.03);
  const pis = round2(baseMonofasica * 0.0065);

  const vTri = vencimentoTrimestral(ano, mes);
  const v20 = venc20MesSeguinte(ano, mes);
  const tributos: Tributo[] = [
    { sigla: 'IRPJ', nome: 'IRPJ', valor: irpj, vencimento: vTri, periodicidade: 'trimestral' },
    { sigla: 'CSLL', nome: 'CSLL', valor: csll, vencimento: vTri, periodicidade: 'trimestral' },
    { sigla: 'ICMS', nome: 'ICMS', valor: icms, vencimento: v20, periodicidade: 'mensal' },
    { sigla: 'COFINS', nome: 'COFINS', valor: cofins, vencimento: v20, periodicidade: 'mensal' },
    { sigla: 'PIS', nome: 'PIS', valor: pis, vencimento: v20, periodicidade: 'mensal' },
  ];
  return { faturamento, baseLucro, baseMonofasica, tributos };
}

// #12 — Simples Nacional (Anexo I / Comércio), da planilha do dono. Alíquota efetiva varia
// pelo RBT12 (receita bruta dos 12 meses anteriores): efetiva = (RBT12*nominal − deduzir)/RBT12.
const SIMPLES_ANEXO_I = [
  { max: 180000, aliq: 0.04, deduzir: 0 },
  { max: 360000, aliq: 0.073, deduzir: 5940 },
  { max: 720000, aliq: 0.095, deduzir: 13860 },
  { max: 1800000, aliq: 0.107, deduzir: 22500 },
  { max: 3600000, aliq: 0.143, deduzir: 87300 },
  { max: 4800000, aliq: 0.19, deduzir: 378000 },
];
function aliquotaEfetivaSimples(rbt12: number): number {
  if (rbt12 <= 0) return SIMPLES_ANEXO_I[0].aliq; // sem histórico → 1ª faixa
  const f = SIMPLES_ANEXO_I.find((x) => rbt12 <= x.max) ?? SIMPLES_ANEXO_I[SIMPLES_ANEXO_I.length - 1];
  return Math.max(0, (rbt12 * f.aliq - f.deduzir) / rbt12);
}
/** CNPJ no Simples: 1 DAS = alíquota efetiva (por RBT12) × faturamento do mês. */
export function calcularDAS(base: BaseImpostos, ano: number, mes: number, rbt12: number): { faturamento: number; baseLucro: number; baseMonofasica: number; tributos: Tributo[] } {
  const faturamento = round2(Math.max(Number(base.faturamento_nf || 0), Number(base.faturamento_stone || 0)));
  const aliq = aliquotaEfetivaSimples(rbt12);
  const das = round2(faturamento * aliq);
  return {
    faturamento, baseLucro: faturamento, baseMonofasica: faturamento,
    tributos: [{ sigla: 'DAS', nome: `DAS Simples (${(aliq * 100).toFixed(2)}%)`, valor: das, vencimento: venc20MesSeguinte(ano, mes), periodicidade: 'mensal' }],
  };
}
/** Escolhe o cálculo pelo regime do CNPJ: Simples → DAS; senão os 5 tributos do Presumido. */
function calcularImpostosCnpj(base: BaseCnpj, ano: number, mes: number) {
  return base.regime === 'simples' ? calcularDAS(base, ano, mes, Number(base.rbt12 || 0)) : calcularTributos(base, ano, mes);
}

/**
 * Base POR CNPJ. Bares com CNPJs cadastrados (Ordinário=2, Deboche=2) vêm de
 * fn_impostos_base_mensal_cnpj (faturamento/bebida fria do XML importado; couvert/gorjeta da chave;
 * Stone por empresa). Bar sem CNPJ cadastrado cai no legado (1 base agregada, cnpj_indice=null).
 */
async function getBasesCnpj(barId: number, ano: number, mes: number): Promise<BaseCnpj[]> {
  const supabase = getLancadorAdmin();
  const { data } = await (supabase as any).rpc('fn_impostos_base_mensal_cnpj', { p_bar: barId, p_ano: ano, p_mes: mes });
  const rows = (data as any[]) || [];
  if (rows.length > 0) {
    // #12 — regime por CNPJ (nf_cnpj_labels) + RBT12 (12 meses anteriores) p/ o cálculo do Simples.
    const { data: regs } = await (supabase.schema('financial' as any) as any).from('nf_cnpj_labels').select('cnpj_indice, regime').eq('bar_id', barId);
    const regimeDe = new Map<number, string>(((regs as any[]) || []).map((r) => [Number(r.cnpj_indice), String(r.regime || 'presumido')]));
    const { data: rbt } = await (supabase as any).rpc('fn_impostos_rbt12_cnpj', { p_bar: barId, p_ano: ano, p_mes: mes });
    const rbt12De = new Map<number, number>(((rbt as any[]) || []).map((r) => [Number(r.cnpj_indice), Number(r.rbt12 || 0)]));
    return rows.map((r) => ({
      cnpj_indice: r.cnpj_indice ?? null, cnpj_label: r.cnpj_label || `CNPJ ${r.cnpj_indice}`, cnpj_documento: r.cnpj_documento ?? null,
      faturamento_nf: Number(r.faturamento_nf || 0), faturamento_stone: Number(r.faturamento_stone || 0),
      couvert: Number(r.couvert || 0), gorjeta: Number(r.gorjeta || 0), bebidas_frias: Number(r.bebidas_frias || 0),
      origem_xml: !!r.origem_xml,
      regime: r.cnpj_indice != null ? (regimeDe.get(Number(r.cnpj_indice)) || 'presumido') : 'presumido',
      rbt12: r.cnpj_indice != null ? (rbt12De.get(Number(r.cnpj_indice)) || 0) : 0,
    }));
  }
  // legado (bar sem CNPJ cadastrado): 1 base agregada
  const { data: legacy } = await (supabase as any).rpc('fn_impostos_base_mensal', { p_bar: barId, p_ano: ano, p_mes: mes });
  const r = (legacy as any[])?.[0] || {};
  return [{
    cnpj_indice: null, cnpj_label: `Bar ${barId}`, cnpj_documento: null, origem_xml: false,
    faturamento_nf: Number(r.faturamento_nf || 0), faturamento_stone: Number(r.faturamento_stone || 0),
    couvert: Number(r.couvert || 0), gorjeta: Number(r.gorjeta || 0), bebidas_frias: Number(r.bebidas_frias || 0),
  }];
}

/**
 * Executa (idempotente) os impostos do mês, UM CONJUNTO POR CNPJ (Ordinário/Deboche = 2 → até 10
 * lançamentos no MESMO Conta Azul). `chaves` (opcional) limita: aceita "SIGLA" (todos os CNPJs)
 * ou "SIGLA#indice" (um CNPJ). Idempotente por chave "SIGLA#indice" no log. Sem auth — quem chama garante.
 */
export async function executarImpostos(barId: number, ano: number, mes: number, criadoPor: string | null, chaves?: string[]): Promise<{ status: number; body: any }> {
  const supabase = getLancadorAdmin();
  const competencia = ultimoDiaMes(ano, mes);
  const bases = await getBasesCnpj(barId, ano, mes);

  const log = () => (supabase.schema('financial' as any) as any).from('lancamento_manual_ca_log');
  const { data: jaLogs } = await log().select('chave').eq('bar_id', barId).eq('tipo', TIPO).eq('competencia', competencia);
  const feitos = new Set(((jaLogs as any[]) || []).map((r) => r.chave));

  const filtro = chaves?.length ? new Set(chaves) : null;
  type Pend = { base: BaseCnpj; t: Tributo; chave: string };
  const pendentes: Pend[] = [];
  for (const base of bases) {
    const { tributos } = calcularImpostosCnpj(base, ano, mes);
    for (const t of tributos) {
      const chave = chaveLog(t.sigla, base.cnpj_indice);
      if (t.valor < 0.01 || feitos.has(chave)) continue;
      if (filtro && !filtro.has(t.sigla) && !filtro.has(chave)) continue;
      pendentes.push({ base, t, chave });
    }
  }
  if (pendentes.length === 0) {
    return { status: 200, body: { bar_id: barId, ano, mes, competencia, skipped: true, motivo: feitos.size ? 'já lançado' : 'sem base no mês' } };
  }

  const tokenResult = await getCAToken(barId);
  if ('error' in tokenResult) return { status: tokenResult.status, body: { error: tokenResult.error } };
  const token = tokenResult.token;
  const cat = await resolveCategoriaId(barId, CAT_NOME, 'DESPESA');
  if (!cat) return { status: 400, body: { error: `Categoria "IMPOSTO" (DESPESA) não existe no Conta Azul deste bar — crie e sincronize.` } };
  const conta = await resolveContaPadrao(barId);
  if (!conta) return { status: 400, body: { error: 'Nenhuma conta financeira ativa no Conta Azul' } };

  const resultados: any[] = [];
  for (const { base, t, chave } of pendentes) {
    const suf = base.cnpj_indice != null ? ` [${base.cnpj_label}]` : '';
    const descricao = `Imposto ${t.sigla}${suf} ${MES_LABEL[mes]}/${ano} (simulado)`;
    const r = await criarLancamentoCA({
      token, sinal: 'DESPESA', competencia, vencimento: t.vencimento, valor: t.valor,
      descricao, observacao: `Imposto ${t.sigla} simulado (placeholder)${suf} ${MES_LABEL[mes]}/${ano} via Zykor`,
      categoriaId: cat.id, contaId: conta.id,
    });
    if (r.ok) {
      await log().insert({
        bar_id: barId, tipo: TIPO, competencia, chave, sinal: 'DESPESA', valor: t.valor,
        descricao, categoria_id: cat.id, categoria_nome: cat.nome, conta_id: conta.id, data_vencimento: t.vencimento,
        ca_protocol_id: r.protocolId, ca_status: r.status, baixado: false, criado_por: criadoPor,
      });
    }
    resultados.push({ sigla: t.sigla, chave, cnpj_indice: base.cnpj_indice, cnpj_label: base.cnpj_label, valor: t.valor, vencimento: t.vencimento, ok: r.ok, erro: r.erro, protocolId: r.protocolId });
  }
  const algumErro = resultados.some((r) => !r.ok);
  return { status: algumErro ? 207 : 200, body: { bar_id: barId, ano, mes, competencia, ok: !algumErro, resultados } };
}

/** GET: preview do mês — não escreve. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.despesas, 'ver')) return permissionErrorResponse('Sem permissão');
  const url = new URL(request.url);
  const barId = Number(url.searchParams.get('bar_id')) || Number(user.bar_id);
  const ano = Number(url.searchParams.get('ano'));
  const mes = Number(url.searchParams.get('mes'));
  const alvo = (Number.isFinite(ano) && Number.isFinite(mes) && mes >= 1 && mes <= 12) ? { ano, mes } : mesAnteriorBRT();
  const competencia = ultimoDiaMes(alvo.ano, alvo.mes);

  const bases = await getBasesCnpj(barId, alvo.ano, alvo.mes);
  const supabase = getLancadorAdmin();
  const { data: logs } = await (supabase.schema('financial' as any) as any)
    .from('lancamento_manual_ca_log').select('chave, valor').eq('bar_id', barId).eq('tipo', TIPO).eq('competencia', competencia);
  const feitos: Record<string, any> = {};
  for (const r of ((logs as any[]) || [])) feitos[r.chave] = r;

  // um bloco por CNPJ (base + tributos com status de lançamento)
  const cnpjs = bases.map((base) => {
    const calc = calcularImpostosCnpj(base, alvo.ano, alvo.mes);
    return {
      cnpj_indice: base.cnpj_indice, cnpj_label: base.cnpj_label, cnpj_documento: base.cnpj_documento, origem_xml: base.origem_xml,
      regime: base.regime || 'presumido', rbt12: base.rbt12 || 0,
      base: { faturamento_nf: base.faturamento_nf, faturamento_stone: base.faturamento_stone, faturamento: calc.faturamento,
              couvert: base.couvert, gorjeta: base.gorjeta, bebidas_frias: base.bebidas_frias, base_lucro: calc.baseLucro, base_monofasica: calc.baseMonofasica },
      tributos: calc.tributos.map((t) => {
        const chave = chaveLog(t.sigla, base.cnpj_indice);
        return { ...t, chave, ja_lancado: chave in feitos, valor_lancado: feitos[chave]?.valor ?? null };
      }),
    };
  });

  // total agregado (soma dos CNPJs) — resumo/topo da tela
  const somaBase = (k: keyof BaseImpostos | 'faturamento' | 'base_lucro' | 'base_monofasica') =>
    round2(cnpjs.reduce((s, c) => s + Number((c.base as any)[k] || 0), 0));
  // Siglas presentes (inclui DAS dos CNPJs no Simples), preservando a ordem dos tributos.
  const siglasPresentes = Array.from(new Set(cnpjs.flatMap((c) => c.tributos.map((t) => t.sigla))));
  const totalTributos = siglasPresentes.map((sig) => {
    const linhas = cnpjs.flatMap((c) => c.tributos.filter((t) => t.sigla === sig));
    const base0 = linhas[0];
    return { sigla: sig, nome: base0?.nome || sig, periodicidade: base0?.periodicidade || 'mensal', vencimento: base0?.vencimento || '',
             valor: round2(linhas.reduce((s, t) => s + Number(t.valor || 0), 0)),
             ja_lancado: linhas.length > 0 && linhas.every((t) => t.ja_lancado) };
  });

  return NextResponse.json({
    bar_id: barId, ano: alvo.ano, mes: alvo.mes, competencia,
    origem_xml: cnpjs.some((c) => c.origem_xml),
    por_cnpj: cnpjs,
    // compat/resumo: base e tributos agregados (soma dos CNPJs)
    base: { faturamento_nf: somaBase('faturamento_nf'), faturamento_stone: somaBase('faturamento_stone'), faturamento: somaBase('faturamento'),
            couvert: somaBase('couvert'), gorjeta: somaBase('gorjeta'), bebidas_frias: somaBase('bebidas_frias'),
            base_lucro: somaBase('base_lucro'), base_monofasica: somaBase('base_monofasica') },
    tributos: totalTributos,
  });
}

/** POST: cria os lançamentos que faltam (admin/financeiro). Body: { bar_id?, ano?, mes? }. */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.despesas, 'inserir')) return permissionErrorResponse('Sem permissão para criar lançamentos');
  const body = await request.json().catch(() => ({} as any));
  const barId = Number(body?.bar_id) || Number(user.bar_id);
  const { ano, mes } = (Number.isFinite(Number(body?.ano)) && Number.isFinite(Number(body?.mes)))
    ? { ano: Number(body.ano), mes: Number(body.mes) } : mesAnteriorBRT();
  const r = await executarImpostos(barId, ano, mes, user.email ?? user.nome ?? null, parseChaves(body));
  return NextResponse.json(r.body, { status: r.status });
}
