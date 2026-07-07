import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFinanceiro } from '@/lib/auth/financeiro-guard';
import { getFatorCmv } from '@/lib/config/getFatorCmv';
import {
  getLancadorAdmin, getCAToken, resolveCategoriaId, resolveContaPadrao, criarLancamentoCA,
  round2, brDate, ontemBRT, type SinalLanc,
} from '@/lib/financeiro/contaazul-lancador';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * CONSUMAÇÕES (fechamento diário) → Conta Azul. Soma-ZERO por dia.
 * As consumações/cortesias do dia (custo da ficha técnica, get_consumos_9_custo_semana) entram como
 * DESPESA em cada categoria "[Consumação] X"; o total entra como RECEITA em "[Consumação] Ajuste CMV".
 * Despesas − Receita(Ajuste) = 0. Competência = o dia. Sem baixa.
 * Idempotente por financial.lancamento_manual_ca_log (tipo='consumacao', chave=categoria_key).
 *
 *  - GET  : preview do dia (não escreve).
 *  - POST : cria os lançamentos que faltam (admin/financeiro).
 */

const TIPO = 'consumacao';
const CAT_AJUSTE = '[Consumação] Ajuste CMV';

// key (retorno da função) -> categoria DESPESA no Conta Azul.
const KEY_CAT: Record<string, string> = {
  socios: '[Consumação] Sócios',
  relacionamento: '[Consumação] Relacionamento',
  funcionarios_escritorio: '[Consumação] Funcionários Escritório',
  funcionarios_operacao: '[Consumação] Funcionários Operação',
  artistas: '[Consumação] Artistas',
  influencer: '[Consumação] Influencers',
  beneficio_cliente: '[Consumação] Benefício Clientes',
  aniversario: '[Consumação] Aniversários',
  programa_pontos: '[Consumação] Programa de Pontos',
};
const KEY_LABEL: Record<string, string> = {
  socios: 'Sócios', relacionamento: 'Relacionamento', funcionarios_escritorio: 'Funcionários Escritório',
  funcionarios_operacao: 'Funcionários Operação', artistas: 'Artistas', influencer: 'Influencers',
  beneficio_cliente: 'Benefício Clientes', aniversario: 'Aniversários', programa_pontos: 'Programa de Pontos',
};

interface ItemConsumacao { chave: string; label: string; categoria: string; sinal: SinalLanc; valor: number; }

/** Monta os itens (despesas + Ajuste CMV receita) de um dia. Fonte: get_consumos_9_custo_semana (custo da ficha). */
export async function montarConsumacaoDia(barId: number, dia: string): Promise<{ itens: ItemConsumacao[]; ignorado: number; totalDespesas: number }> {
  const supabase = getLancadorAdmin();
  const fator = await getFatorCmv(supabase, barId).catch(() => 0.35);
  const { data } = await (supabase as any).rpc('get_consumos_9_custo_semana', {
    input_bar_id: barId, input_data_inicio: dia, input_data_fim: dia, p_fator: fator,
  });
  const rows: any[] = (data as any[]) || [];
  const custoPorKey: Record<string, number> = {};
  for (const r of rows) custoPorKey[String(r.categoria)] = round2(Number(r.custo_real || 0));

  const itens: ItemConsumacao[] = [];
  let totalDespesas = 0;
  for (const key of Object.keys(KEY_CAT)) {
    const valor = custoPorKey[key] || 0;
    if (valor >= 0.01) {
      itens.push({ chave: key, label: KEY_LABEL[key], categoria: KEY_CAT[key], sinal: 'DESPESA', valor });
      totalDespesas = round2(totalDespesas + valor);
    }
  }
  if (totalDespesas >= 0.01) {
    itens.push({ chave: 'ajuste_cmv', label: 'Ajuste CMV (contrapartida)', categoria: CAT_AJUSTE, sinal: 'RECEITA', valor: totalDespesas });
  }
  // Valor que NÃO entra (motivo 'Ajuste CMV' real e 'outros' não têm categoria de despesa própria).
  const ignorado = round2((custoPorKey['ajuste_cmv'] || 0) + (custoPorKey['outros'] || 0));
  return { itens, ignorado, totalDespesas };
}

/** Executa (idempotente) os lançamentos de consumação de um dia. Sem auth — quem chama garante. */
export async function executarConsumacaoDia(barId: number, dia: string, criadoPor: string | null): Promise<{ status: number; body: any }> {
  const supabase = getLancadorAdmin();
  const { itens, ignorado, totalDespesas } = await montarConsumacaoDia(barId, dia);

  const log = () => (supabase.schema('financial' as any) as any).from('lancamento_manual_ca_log');
  const { data: jaLogs } = await log().select('chave').eq('bar_id', barId).eq('tipo', TIPO).eq('competencia', dia);
  const feitos = new Set(((jaLogs as any[]) || []).map((r) => r.chave));

  const pendentes = itens.filter((i) => !feitos.has(i.chave));
  if (pendentes.length === 0) {
    return { status: 200, body: { bar_id: barId, dia, skipped: true, motivo: feitos.size ? 'já lançado' : 'sem consumação no dia', itens, ignorado, totalDespesas } };
  }

  const tokenResult = await getCAToken(barId);
  if ('error' in tokenResult) return { status: tokenResult.status, body: { error: tokenResult.error } };
  const token = tokenResult.token;
  const conta = await resolveContaPadrao(barId);
  if (!conta) return { status: 400, body: { error: 'Nenhuma conta financeira ativa no Conta Azul' } };

  const resultados: any[] = [];
  for (const i of pendentes) {
    const cat = await resolveCategoriaId(barId, i.categoria, i.sinal);
    if (!cat) {
      resultados.push({ categoria: i.categoria, ok: false, erro: `Categoria "${i.categoria}" (${i.sinal}) não existe no Conta Azul deste bar.` });
      continue;
    }
    const descricao = `Consumação ${i.label} ${brDate(dia)}`;
    const r = await criarLancamentoCA({
      token, sinal: i.sinal, competencia: dia, vencimento: dia, valor: i.valor,
      descricao, observacao: `Consumação (${i.label}) ${brDate(dia)} via Zykor`,
      categoriaId: cat.id, contaId: conta.id,
    });
    if (r.ok) {
      await log().insert({
        bar_id: barId, tipo: TIPO, competencia: dia, chave: i.chave, sinal: i.sinal, valor: i.valor,
        descricao, categoria_id: cat.id, categoria_nome: cat.nome, conta_id: conta.id, data_vencimento: dia,
        ca_protocol_id: r.protocolId, ca_status: r.status, baixado: false, criado_por: criadoPor,
      });
    }
    resultados.push({ categoria: i.categoria, sinal: i.sinal, valor: i.valor, ok: r.ok, erro: r.erro, protocolId: r.protocolId });
  }
  const algumErro = resultados.some((r) => !r.ok);
  return { status: algumErro ? 207 : 200, body: { bar_id: barId, dia, ok: !algumErro, resultados, ignorado, totalDespesas } };
}

/** GET: preview do dia — não escreve. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFinanceiro(user)) return permissionErrorResponse('Sem permissão');
  const url = new URL(request.url);
  const barId = Number(url.searchParams.get('bar_id')) || Number(user.bar_id);
  const dia = url.searchParams.get('data') || ontemBRT();

  const { itens, ignorado, totalDespesas } = await montarConsumacaoDia(barId, dia);
  const supabase = getLancadorAdmin();
  const { data: logs } = await (supabase.schema('financial' as any) as any)
    .from('lancamento_manual_ca_log').select('chave, valor').eq('bar_id', barId).eq('tipo', TIPO).eq('competencia', dia);
  const feitos = new Set(((logs as any[]) || []).map((r) => r.chave));

  return NextResponse.json({
    bar_id: barId, dia, totalDespesas, ignorado,
    soma_zero: round2(totalDespesas - (itens.find((i) => i.chave === 'ajuste_cmv')?.valor || 0)),
    itens: itens.map((i) => ({ ...i, ja_lancado: feitos.has(i.chave) })),
  });
}

/** POST: cria os lançamentos que faltam (admin/financeiro). Body: { bar_id?, data? }. */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFinanceiro(user)) return permissionErrorResponse('Sem permissão para criar lançamentos');
  const body = await request.json().catch(() => ({} as any));
  const barId = Number(body?.bar_id) || Number(user.bar_id);
  const dia: string = body?.data || ontemBRT();
  const r = await executarConsumacaoDia(barId, dia, user.email ?? user.nome ?? null);
  return NextResponse.json(r.body, { status: r.status });
}
