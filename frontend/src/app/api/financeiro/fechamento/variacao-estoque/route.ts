import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFerramentaFinanceira, FERRAMENTA_FINANCEIRA } from '@/lib/auth/financeiro-guard';
import {
  getLancadorAdmin, getCAToken, resolveCategoriaId, resolveContaPadrao, criarLancamentoCA,
  round2, ultimoDiaMes, mesAnteriorBRT, parseChaves, type SinalLanc,
} from '@/lib/financeiro/contaazul-lancador';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * VARIAÇÃO DE ESTOQUE (fechamento mensal) → Conta Azul.
 * Estoque Final − Estoque Inicial por categoria (Bebidas, Comidas, Drinks), no fechamento do mês.
 * Fonte: financial.cmv_semanal (mesmas semanas-fronteira que a tela "Gestão CMV mensal" usa).
 *   inicial = estoque_inicial_* da semana que contém o dia 01 do mês
 *   final   = estoque_final_*   da semana que contém o dia 01 do mês seguinte
 * Sinal (convenção contábil): variação > 0 (estoque cresceu) reduz o CMV → RECEITA
 *   ("VARIAÇÃO DE ESTOQUE"); variação < 0 → DESPESA ("Variação de Estoque"). Sem baixa (competência).
 * Idempotente por financial.lancamento_manual_ca_log (tipo='variacao_estoque', chave=categoria).
 *
 *  - GET  : preview do mês (não escreve).
 *  - POST : cria os lançamentos que faltam (admin/financeiro).
 */

const TIPO = 'variacao_estoque';
const CAT_NOME = 'Variação de Estoque'; // resolvido por nome (case/acento-insensível): despesa e receita
const MES_LABEL = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

type CatKey = 'bebida' | 'comida' | 'drink';
const CATS: { key: CatKey; label: string; colIni: string; colFim: string }[] = [
  { key: 'bebida', label: 'Bebidas', colIni: 'estoque_inicial_bebidas', colFim: 'estoque_final_bebidas' },
  { key: 'comida', label: 'Comidas', colIni: 'estoque_inicial_cozinha', colFim: 'estoque_final_cozinha' },
  { key: 'drink',  label: 'Drinks',  colIni: 'estoque_inicial_drinks',  colFim: 'estoque_final_drinks' },
];

/** ISO week (idêntico ao getWeekAndYear da tela de CMV mensal). */
function getWeekAndYear(date: Date): { semana: number; ano: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { semana, ano: d.getUTCFullYear() };
}

export interface LinhaVariacao { key: CatKey; label: string; inicial: number; final: number; variacao: number; sinal: SinalLanc; }

/** Lê as semanas-fronteira do cmv_semanal e devolve variação por categoria. */
export async function calcularVariacao(barId: number, ano: number, mes: number): Promise<{ linhas: LinhaVariacao[]; semanaIni: string; semanaFim: string }> {
  const supabase = getLancadorAdmin();
  const wi = getWeekAndYear(new Date(ano, mes - 1, 1));
  const wf = getWeekAndYear(new Date(ano, mes, 1)); // dia 01 do mês seguinte

  const cols = CATS.map((c) => `${c.colIni}, ${c.colFim}`).join(', ');
  const fetchSemana = async (a: number, s: number) => {
    const { data } = await (supabase.schema('financial' as any) as any)
      .from('cmv_semanal').select(cols).eq('bar_id', barId).eq('ano', a).eq('semana', s).maybeSingle();
    return (data as any) || {};
  };
  const [rowIni, rowFim] = await Promise.all([fetchSemana(wi.ano, wi.semana), fetchSemana(wf.ano, wf.semana)]);

  const linhas: LinhaVariacao[] = CATS.map((c) => {
    const inicial = round2(Number(rowIni[c.colIni] || 0));
    const final = round2(Number(rowFim[c.colFim] || 0));
    const variacao = round2(final - inicial);
    return { key: c.key, label: c.label, inicial, final, variacao, sinal: variacao >= 0 ? 'RECEITA' : 'DESPESA' };
  });
  return { linhas, semanaIni: `${wi.ano}-S${wi.semana}`, semanaFim: `${wf.ano}-S${wf.semana}` };
}

/** Executa (idempotente) os lançamentos de variação do mês. `chaves` (opcional) limita a linhas específicas. Sem auth — quem chama garante. */
export async function executarVariacaoEstoque(barId: number, ano: number, mes: number, criadoPor: string | null, chaves?: string[]): Promise<{ status: number; body: any }> {
  const supabase = getLancadorAdmin();
  const competencia = ultimoDiaMes(ano, mes);
  const { linhas } = await calcularVariacao(barId, ano, mes);

  const log = () => (supabase.schema('financial' as any) as any).from('lancamento_manual_ca_log');
  const { data: jaLogs } = await log().select('chave, valor, sinal, baixado').eq('bar_id', barId).eq('tipo', TIPO).eq('competencia', competencia);
  const feitos = new Set(((jaLogs as any[]) || []).map((r) => r.chave));

  const filtro = chaves?.length ? new Set(chaves) : null;
  const pendentes = linhas.filter((l) => Math.abs(l.variacao) >= 0.01 && !feitos.has(l.key) && (!filtro || filtro.has(l.key)));
  if (pendentes.length === 0) {
    return { status: 200, body: { bar_id: barId, ano, mes, competencia, skipped: true, motivo: feitos.size ? 'já lançado' : 'sem variação no mês', linhas } };
  }

  const tokenResult = await getCAToken(barId);
  if ('error' in tokenResult) return { status: tokenResult.status, body: { error: tokenResult.error } };
  const token = tokenResult.token;
  const conta = await resolveContaPadrao(barId);
  if (!conta) return { status: 400, body: { error: 'Nenhuma conta financeira ativa no Conta Azul' } };

  const resultados: any[] = [];
  for (const l of pendentes) {
    const valor = Math.abs(l.variacao);
    const cat = await resolveCategoriaId(barId, CAT_NOME, l.sinal);
    if (!cat) {
      resultados.push({ categoria: l.label, ok: false, erro: `Categoria "${CAT_NOME}" (${l.sinal}) não existe no Conta Azul deste bar — crie e sincronize.` });
      continue;
    }
    const descricao = `Variação Estoque ${l.label} ${MES_LABEL[mes]}/${ano}`;
    const r = await criarLancamentoCA({
      token, sinal: l.sinal, competencia, vencimento: competencia, valor,
      descricao, observacao: `Variação de estoque (${l.label}) ${MES_LABEL[mes]}/${ano} via Zykor`,
      categoriaId: cat.id, contaId: conta.id,
    });
    if (r.ok) {
      await log().insert({
        bar_id: barId, tipo: TIPO, competencia, chave: l.key, sinal: l.sinal, valor,
        descricao, categoria_id: cat.id, categoria_nome: cat.nome, conta_id: conta.id, data_vencimento: competencia,
        ca_protocol_id: r.protocolId, ca_status: r.status, baixado: false, criado_por: criadoPor,
      });
    }
    resultados.push({ categoria: l.label, sinal: l.sinal, valor, ok: r.ok, erro: r.erro, protocolId: r.protocolId });
  }
  const algumErro = resultados.some((r) => !r.ok);
  return { status: algumErro ? 207 : 200, body: { bar_id: barId, ano, mes, competencia, ok: !algumErro, resultados, linhas } };
}

function parseAnoMes(url: URL): { ano: number; mes: number } {
  const ano = Number(url.searchParams.get('ano'));
  const mes = Number(url.searchParams.get('mes'));
  if (Number.isFinite(ano) && Number.isFinite(mes) && mes >= 1 && mes <= 12) return { ano, mes };
  return mesAnteriorBRT();
}

/** GET: preview do mês — não escreve. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.despesas, 'ver')) return permissionErrorResponse('Sem permissão');
  const url = new URL(request.url);
  const barId = Number(url.searchParams.get('bar_id')) || Number(user.bar_id);
  const { ano, mes } = parseAnoMes(url);
  const competencia = ultimoDiaMes(ano, mes);

  const { linhas, semanaIni, semanaFim } = await calcularVariacao(barId, ano, mes);
  const supabase = getLancadorAdmin();
  const { data: logs } = await (supabase.schema('financial' as any) as any)
    .from('lancamento_manual_ca_log').select('chave, valor, sinal, ca_status').eq('bar_id', barId).eq('tipo', TIPO).eq('competencia', competencia);
  const lancados: Record<string, any> = {};
  for (const r of ((logs as any[]) || [])) lancados[r.chave] = r;

  return NextResponse.json({
    bar_id: barId, ano, mes, competencia, semanaIni, semanaFim,
    linhas: linhas.map((l) => ({ ...l, ja_lancado: l.key in lancados, valor_lancado: lancados[l.key]?.valor ?? null })),
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
  const chaves = parseChaves(body);
  const r = await executarVariacaoEstoque(barId, ano, mes, user.email ?? user.nome ?? null, chaves);
  return NextResponse.json(r.body, { status: r.status });
}
