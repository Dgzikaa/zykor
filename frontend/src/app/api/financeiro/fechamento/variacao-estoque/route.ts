import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFerramentaFinanceira, FERRAMENTA_FINANCEIRA } from '@/lib/auth/financeiro-guard';
import {
  getLancadorAdmin, getCAToken, resolveCategoriaId, resolveContaPadrao, criarLancamentoCA,
  round2, ultimoDiaMes, mesAnteriorBRT, parseChaves, type SinalLanc,
} from '@/lib/financeiro/contaazul-lancador';
import { estoqueMensalPorCategoria } from '@/lib/financeiro/estoque-categoria';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * VARIAÇÃO DE ESTOQUE (fechamento mensal) → Conta Azul.
 * Estoque Final − Estoque Inicial por categoria (Bebidas, Comidas, Drinks), no fechamento do mês.
 *
 * Fonte: as CONTAGENS MENSAIS do dia 1º (silver.estoque_contagem), via
 * `estoqueMensalPorCategoria` — inicial = contagem de 01/<mês>, final = contagem de 01/<mês+1>.
 *
 * ⚠️ ANTES lia financial.cmv_semanal pegando a semana ISO que contém o dia 1º, e isso estava
 * errado: a semana que contém 01/07/2026 começa em 29/06, e a que contém 01/08 termina com a
 * contagem de 03/08. A janela virava 29/06 → 03/08 em vez de 01/07 → 01/08, incluindo um fim de
 * semana inteiro de vendas na ponta final. No Ordinário/julho isso lançou −R$ 37.891,16 de
 * variação quando o real era −R$ 8.275,04 (Gonza, 11/08/2026). Além de errado, divergia da
 * tela "Gestão CMV mensal", que fecha a cadeia mês a mês nas contagens do dia 1º
 * [[feedback_cmv_mensal_cadeia_estoque_final_igual_inicial]].
 *
 * Se faltar a contagem mensal de qualquer uma das duas pontas, a rota ACUSA em vez de lançar:
 * cair numa contagem diária/semanal (que cobre ~80 dos ~415 itens) seria repetir o mesmo erro.
 *
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
const CATS: { key: CatKey; label: string; bucket: 'bebidas' | 'cozinha' | 'drinks' }[] = [
  { key: 'bebida', label: 'Bebidas', bucket: 'bebidas' },
  { key: 'comida', label: 'Comidas', bucket: 'cozinha' },
  { key: 'drink',  label: 'Drinks',  bucket: 'drinks'  },
];

/** Dia 1º do mês, em ISO. */
function primeiroDia(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}-01`;
}

export interface LinhaVariacao { key: CatKey; label: string; inicial: number; final: number; variacao: number; sinal: SinalLanc; }

/**
 * Variação por categoria entre as contagens mensais que fecham o mês.
 * `erro` vem preenchido (e as linhas zeradas) quando falta uma das contagens — nunca cai
 * numa contagem parcial, que é o que produzia os números errados.
 */
export async function calcularVariacao(barId: number, ano: number, mes: number): Promise<{
  linhas: LinhaVariacao[]; dataIni: string | null; dataFim: string | null; erro?: string;
}> {
  const supabase = getLancadorAdmin();
  const dia1Ini = primeiroDia(ano, mes);
  const dia1Fim = mes === 12 ? primeiroDia(ano + 1, 1) : primeiroDia(ano, mes + 1);

  const [ini, fim] = await Promise.all([
    estoqueMensalPorCategoria(supabase, barId, dia1Ini),
    estoqueMensalPorCategoria(supabase, barId, dia1Fim),
  ]);

  if (!ini || !fim) {
    const faltando = [!ini ? dia1Ini : null, !fim ? dia1Fim : null].filter(Boolean).join(' e ');
    return {
      linhas: CATS.map((c) => ({ key: c.key, label: c.label, inicial: 0, final: 0, variacao: 0, sinal: 'DESPESA' as SinalLanc })),
      dataIni: ini?.data ?? null, dataFim: fim?.data ?? null,
      erro: `Sem contagem mensal para ${faltando}. Faça a contagem mensal da virada antes de lançar — usar uma contagem diária/semanal no lugar dela distorce a variação.`,
    };
  }

  const linhas: LinhaVariacao[] = CATS.map((c) => {
    const inicial = round2(ini[c.bucket]);
    const final = round2(fim[c.bucket]);
    const variacao = round2(final - inicial);
    return { key: c.key, label: c.label, inicial, final, variacao, sinal: variacao >= 0 ? 'RECEITA' : 'DESPESA' };
  });
  return { linhas, dataIni: ini.data, dataFim: fim.data };
}

/** Executa (idempotente) os lançamentos de variação do mês. `chaves` (opcional) limita a linhas específicas. Sem auth — quem chama garante. */
export async function executarVariacaoEstoque(barId: number, ano: number, mes: number, criadoPor: string | null, chaves?: string[]): Promise<{ status: number; body: any }> {
  const supabase = getLancadorAdmin();
  const competencia = ultimoDiaMes(ano, mes);
  const { linhas, erro } = await calcularVariacao(barId, ano, mes);
  // Sem as duas contagens mensais não há variação confiável — não lança nada.
  if (erro) return { status: 400, body: { bar_id: barId, ano, mes, competencia, error: erro, linhas } };

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

  const { linhas, dataIni, dataFim, erro } = await calcularVariacao(barId, ano, mes);
  const supabase = getLancadorAdmin();
  const { data: logs } = await (supabase.schema('financial' as any) as any)
    .from('lancamento_manual_ca_log').select('chave, valor, sinal, ca_status').eq('bar_id', barId).eq('tipo', TIPO).eq('competencia', competencia);
  const lancados: Record<string, any> = {};
  for (const r of ((logs as any[]) || [])) lancados[r.chave] = r;

  return NextResponse.json({
    bar_id: barId, ano, mes, competencia, dataIni, dataFim, erro: erro ?? null,
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
