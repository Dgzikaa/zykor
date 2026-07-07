import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFinanceiro } from '@/lib/auth/financeiro-guard';
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
interface Tributo { sigla: string; nome: string; valor: number; vencimento: string; periodicidade: 'mensal' | 'trimestral'; }

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

async function getBase(barId: number, ano: number, mes: number): Promise<BaseImpostos> {
  const supabase = getLancadorAdmin();
  const { data } = await (supabase as any).rpc('fn_impostos_base_mensal', { p_bar: barId, p_ano: ano, p_mes: mes });
  const r = (data as any[])?.[0] || {};
  return {
    faturamento_nf: Number(r.faturamento_nf || 0), faturamento_stone: Number(r.faturamento_stone || 0),
    couvert: Number(r.couvert || 0), gorjeta: Number(r.gorjeta || 0), bebidas_frias: Number(r.bebidas_frias || 0),
  };
}

/** Executa (idempotente) os 5 impostos do mês. `chaves` (opcional) limita a tributos específicos (siglas). Sem auth — quem chama garante. */
export async function executarImpostos(barId: number, ano: number, mes: number, criadoPor: string | null, chaves?: string[]): Promise<{ status: number; body: any }> {
  const supabase = getLancadorAdmin();
  const competencia = ultimoDiaMes(ano, mes);
  const base = await getBase(barId, ano, mes);
  const { tributos } = calcularTributos(base, ano, mes);

  const log = () => (supabase.schema('financial' as any) as any).from('lancamento_manual_ca_log');
  const { data: jaLogs } = await log().select('chave').eq('bar_id', barId).eq('tipo', TIPO).eq('competencia', competencia);
  const feitos = new Set(((jaLogs as any[]) || []).map((r) => r.chave));

  const filtro = chaves?.length ? new Set(chaves) : null;
  const pendentes = tributos.filter((t) => t.valor >= 0.01 && !feitos.has(t.sigla) && (!filtro || filtro.has(t.sigla)));
  if (pendentes.length === 0) {
    return { status: 200, body: { bar_id: barId, ano, mes, competencia, skipped: true, motivo: feitos.size ? 'já lançado' : 'sem base no mês', tributos } };
  }

  const tokenResult = await getCAToken(barId);
  if ('error' in tokenResult) return { status: tokenResult.status, body: { error: tokenResult.error } };
  const token = tokenResult.token;
  const cat = await resolveCategoriaId(barId, CAT_NOME, 'DESPESA');
  if (!cat) return { status: 400, body: { error: `Categoria "IMPOSTO" (DESPESA) não existe no Conta Azul deste bar — crie e sincronize.` } };
  const conta = await resolveContaPadrao(barId);
  if (!conta) return { status: 400, body: { error: 'Nenhuma conta financeira ativa no Conta Azul' } };

  const resultados: any[] = [];
  for (const t of pendentes) {
    const descricao = `Imposto ${t.sigla} ${MES_LABEL[mes]}/${ano} (simulado)`;
    const r = await criarLancamentoCA({
      token, sinal: 'DESPESA', competencia, vencimento: t.vencimento, valor: t.valor,
      descricao, observacao: `Imposto ${t.sigla} simulado (placeholder) ${MES_LABEL[mes]}/${ano} via Zykor`,
      categoriaId: cat.id, contaId: conta.id,
    });
    if (r.ok) {
      await log().insert({
        bar_id: barId, tipo: TIPO, competencia, chave: t.sigla, sinal: 'DESPESA', valor: t.valor,
        descricao, categoria_id: cat.id, categoria_nome: cat.nome, conta_id: conta.id, data_vencimento: t.vencimento,
        ca_protocol_id: r.protocolId, ca_status: r.status, baixado: false, criado_por: criadoPor,
      });
    }
    resultados.push({ sigla: t.sigla, valor: t.valor, vencimento: t.vencimento, ok: r.ok, erro: r.erro, protocolId: r.protocolId });
  }
  const algumErro = resultados.some((r) => !r.ok);
  return { status: algumErro ? 207 : 200, body: { bar_id: barId, ano, mes, competencia, ok: !algumErro, resultados, tributos } };
}

/** GET: preview do mês — não escreve. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFinanceiro(user)) return permissionErrorResponse('Sem permissão');
  const url = new URL(request.url);
  const barId = Number(url.searchParams.get('bar_id')) || Number(user.bar_id);
  const ano = Number(url.searchParams.get('ano'));
  const mes = Number(url.searchParams.get('mes'));
  const alvo = (Number.isFinite(ano) && Number.isFinite(mes) && mes >= 1 && mes <= 12) ? { ano, mes } : mesAnteriorBRT();
  const competencia = ultimoDiaMes(alvo.ano, alvo.mes);

  const base = await getBase(barId, alvo.ano, alvo.mes);
  const calc = calcularTributos(base, alvo.ano, alvo.mes);
  const supabase = getLancadorAdmin();
  const { data: logs } = await (supabase.schema('financial' as any) as any)
    .from('lancamento_manual_ca_log').select('chave, valor').eq('bar_id', barId).eq('tipo', TIPO).eq('competencia', competencia);
  const feitos: Record<string, any> = {};
  for (const r of ((logs as any[]) || [])) feitos[r.chave] = r;

  return NextResponse.json({
    bar_id: barId, ano: alvo.ano, mes: alvo.mes, competencia,
    base: { ...base, faturamento: calc.faturamento, base_lucro: calc.baseLucro, base_monofasica: calc.baseMonofasica },
    tributos: calc.tributos.map((t) => ({ ...t, ja_lancado: t.sigla in feitos, valor_lancado: feitos[t.sigla]?.valor ?? null })),
  });
}

/** POST: cria os lançamentos que faltam (admin/financeiro). Body: { bar_id?, ano?, mes? }. */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFinanceiro(user)) return permissionErrorResponse('Sem permissão para criar lançamentos');
  const body = await request.json().catch(() => ({} as any));
  const barId = Number(body?.bar_id) || Number(user.bar_id);
  const { ano, mes } = (Number.isFinite(Number(body?.ano)) && Number.isFinite(Number(body?.mes)))
    ? { ano: Number(body.ano), mes: Number(body.mes) } : mesAnteriorBRT();
  const r = await executarImpostos(barId, ano, mes, user.email ?? user.nome ?? null, parseChaves(body));
  return NextResponse.json(r.body, { status: r.status });
}
