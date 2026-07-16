import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFerramentaFinanceira, FERRAMENTA_FINANCEIRA } from '@/lib/auth/financeiro-guard';
import { getFatorCmv } from '@/lib/config/getFatorCmv';
import {
  getLancadorAdmin, getCAToken, resolveCategoriaId, resolveContaPadrao, criarLancamentoCA,
  baixarEventoCA, PREFIXO, round2, brDate, ontemBRT, parseChaves, type SinalLanc,
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
// A CAIXA é o SINAL: DESPESA vai na categoria MISTA/minúscula; RECEITA na MAIÚSCULA.
// Par intencional [[feedback_consumacao_ajuste_cmv_caixa_sinal]] — nunca fundir/lower().
const CAT_AJUSTE_RECEITA = '[CONSUMAÇÃO] AJUSTE CMV'; // MAIÚSCULA = contrapartida (RECEITA)

// key (retorno da função) -> categoria DESPESA no Conta Azul (todas mistas/minúsculas).
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
  ajuste_cmv: '[Consumação] Ajuste CMV', // motivo "Ajuste CMV" real → DESPESA na categoria MISTA
};
const KEY_LABEL: Record<string, string> = {
  socios: 'Sócios', relacionamento: 'Relacionamento', funcionarios_escritorio: 'Funcionários Escritório',
  funcionarios_operacao: 'Funcionários Operação', artistas: 'Artistas', influencer: 'Influencers',
  beneficio_cliente: 'Benefício Clientes', aniversario: 'Aniversários', programa_pontos: 'Programa de Pontos',
  ajuste_cmv: 'Ajuste CMV',
};

interface ItemConsumacao { chave: string; label: string; categoria: string; sinal: SinalLanc; valor: number; }

/** Monta os itens (despesas + Ajuste CMV receita) de um dia. Fonte: get_consumos_9_custo_semana (custo da ficha). */
export async function montarConsumacaoDia(barId: number, dia: string, fatorPre?: number): Promise<{ itens: ItemConsumacao[]; ignorado: number; totalDespesas: number }> {
  const supabase = getLancadorAdmin();
  const fator = fatorPre ?? await getFatorCmv(supabase, barId).catch(() => 0.35);
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
    // contrapartida RECEITA na categoria MAIÚSCULA (chave própria p/ não colidir com a despesa ajuste_cmv)
    itens.push({ chave: 'ajuste_cmv_receita', label: 'Ajuste CMV (contrapartida)', categoria: CAT_AJUSTE_RECEITA, sinal: 'RECEITA', valor: totalDespesas });
  }
  // Só 'outros' fica de fora (sem categoria própria). 'Ajuste CMV' real agora entra como despesa.
  const ignorado = round2(custoPorKey['outros'] || 0);
  return { itens, ignorado, totalDespesas };
}

/** Executa (idempotente) os lançamentos de consumação de um dia. `chaves` (opcional) limita a categorias específicas. Sem auth — quem chama garante. */
export async function executarConsumacaoDia(barId: number, dia: string, criadoPor: string | null, chaves?: string[]): Promise<{ status: number; body: any }> {
  const supabase = getLancadorAdmin();
  const { itens, ignorado, totalDespesas } = await montarConsumacaoDia(barId, dia);

  const log = () => (supabase.schema('financial' as any) as any).from('lancamento_manual_ca_log');
  const { data: jaLogs } = await log().select('chave').eq('bar_id', barId).eq('tipo', TIPO).eq('competencia', dia);
  const feitos = new Set(((jaLogs as any[]) || []).map((r) => r.chave));

  const filtro = chaves?.length ? new Set(chaves) : null;
  const pendentes = itens.filter((i) => !feitos.has(i.chave) && (!filtro || filtro.has(i.chave)));
  if (pendentes.length === 0) {
    return { status: 200, body: { bar_id: barId, dia, skipped: true, motivo: feitos.size ? 'já lançado' : 'sem consumação no dia', itens, ignorado, totalDespesas } };
  }

  const tokenResult = await getCAToken(barId);
  if ('error' in tokenResult) return { status: tokenResult.status, body: { error: tokenResult.error } };
  const token = tokenResult.token;
  const conta = await resolveContaPadrao(barId);
  if (!conta) return { status: 400, body: { error: 'Nenhuma conta financeira ativa no Conta Azul' } };

  // Garante a contrapartida RECEITA ANTES de postar qualquer despesa — senão as despesas entram
  // sem a receita e quebram a soma-zero. A RECEITA precisa da categoria "[CONSUMAÇÃO] AJUSTE CMV"
  // (MAIÚSCULA) existir no CA como RECEITA. [[feedback_consumacao_ajuste_cmv_caixa_sinal]]
  const receitaPend = pendentes.find((i) => i.sinal === 'RECEITA');
  if (receitaPend && !(await resolveCategoriaId(barId, receitaPend.categoria, 'RECEITA'))) {
    return {
      status: 400,
      body: {
        error: `Categoria RECEITA "${receitaPend.categoria}" não existe no Conta Azul deste bar. Crie-a como RECEITA e re-sincronize as categorias ANTES de lançar (senão as despesas entrariam sem a contrapartida e quebrariam a soma-zero).`,
        itens, ignorado, totalDespesas,
      },
    };
  }

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

/**
 * Reconciliação de BAIXA das consumações: quita no CA os lançamentos já sincronizados que ainda
 * não têm baixa (dos DOIS lados — despesa E receita — mantendo o caixa neutro). Idempotente.
 * Roda pelo cron; os que ainda não sincronizaram (nao_sincronizado) ficam pro próximo passo.
 */
export async function reconciliarBaixasConsumacao(barId: number, de: string, ate: string): Promise<{ baixados: number; pendentes: number; erros: number }> {
  const supabase = getLancadorAdmin();
  const log = () => (supabase.schema('financial' as any) as any).from('lancamento_manual_ca_log');
  const { data: logs } = await log()
    .select('id, competencia, sinal, valor, descricao')
    .eq('bar_id', barId).eq('tipo', TIPO).eq('baixado', false)
    .gte('competencia', de).lte('competencia', ate);
  const rows = (logs as any[]) || [];
  if (!rows.length) return { baixados: 0, pendentes: 0, erros: 0 };

  const tokenResult = await getCAToken(barId);
  if ('error' in tokenResult) return { baixados: 0, pendentes: rows.length, erros: 0 };
  const conta = await resolveContaPadrao(barId);
  if (!conta) return { baixados: 0, pendentes: rows.length, erros: 0 };

  let baixados = 0, pendentes = 0, erros = 0;
  for (const r of rows) {
    const competencia = String(r.competencia).slice(0, 10);
    const res = await baixarEventoCA({
      token: tokenResult.token, barId, sinal: r.sinal as SinalLanc, competencia,
      valor: Number(r.valor), descricao: `${PREFIXO}${r.descricao}`, contaId: conta.id, dataPagamento: competencia,
    });
    if (res.ok) { await log().update({ baixado: true }).eq('id', r.id); baixados++; }
    else if (res.nao_sincronizado) pendentes++;
    else erros++;
  }
  return { baixados, pendentes, erros };
}

function enumerarDias(de: string, ate: string): string[] {
  const out: string[] = [];
  const d = new Date(`${de}T00:00:00Z`);
  const fim = new Date(`${ate}T00:00:00Z`);
  let guard = 0;
  while (d <= fim && guard < 400) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); guard++; }
  return out;
}

/** Resumo por DIA de um período (pra navegação Semana/Mês). Só dias com movimento. */
async function resumoPeriodo(barId: number, de: string, ate: string) {
  const supabase = getLancadorAdmin();
  const fator = await getFatorCmv(supabase, barId).catch(() => 0.35);
  const { data: logs } = await (supabase.schema('financial' as any) as any)
    .from('lancamento_manual_ca_log').select('competencia, chave').eq('bar_id', barId).eq('tipo', TIPO).gte('competencia', de).lte('competencia', ate);
  const feitosPorDia: Record<string, Set<string>> = {};
  for (const r of ((logs as any[]) || [])) { const d = String(r.competencia).slice(0, 10); (feitosPorDia[d] ||= new Set()).add((r as any).chave); }

  const dias = enumerarDias(de, ate);
  const resumos = await Promise.all(dias.map(async (d) => {
    const { itens, totalDespesas } = await montarConsumacaoDia(barId, d, fator);
    const feitos = feitosPorDia[d] || new Set<string>();
    const nPend = itens.filter((i) => !feitos.has(i.chave)).length;
    return { dia: d, total: round2(totalDespesas), n_itens: itens.length, n_lancados: itens.length - nPend, n_pendentes: nPend };
  }));
  return resumos.filter((r) => r.n_itens > 0);
}

/** GET: preview do dia (data=) OU resumo por dia de um período (de=&ate=). Não escreve. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.despesas, 'ver')) return permissionErrorResponse('Sem permissão');
  const url = new URL(request.url);
  const barId = Number(url.searchParams.get('bar_id')) || Number(user.bar_id);
  const de = url.searchParams.get('de');
  const ate = url.searchParams.get('ate');
  if (de && ate) {
    const dias = await resumoPeriodo(barId, de, ate);
    const total = dias.reduce((s, d) => s + d.total, 0);
    const pendentes = dias.filter((d) => d.n_pendentes > 0).map((d) => d.dia);
    return NextResponse.json({ modo: 'periodo', bar_id: barId, de, ate, total: round2(total), dias, dias_pendentes: pendentes });
  }
  const dia = url.searchParams.get('data') || ontemBRT();

  const { itens, ignorado, totalDespesas } = await montarConsumacaoDia(barId, dia);
  const supabase = getLancadorAdmin();
  const { data: logs } = await (supabase.schema('financial' as any) as any)
    .from('lancamento_manual_ca_log').select('chave, valor').eq('bar_id', barId).eq('tipo', TIPO).eq('competencia', dia);
  const feitos = new Set(((logs as any[]) || []).map((r) => r.chave));

  return NextResponse.json({
    modo: 'dia', bar_id: barId, dia, totalDespesas, ignorado,
    soma_zero: round2(totalDespesas - (itens.find((i) => i.chave === 'ajuste_cmv_receita')?.valor || 0)),
    itens: itens.map((i) => ({ ...i, ja_lancado: feitos.has(i.chave) })),
  });
}

/** POST: cria os lançamentos que faltam (admin/financeiro). Body: { bar_id?, data? }. */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.despesas, 'inserir')) return permissionErrorResponse('Sem permissão para criar lançamentos');
  const body = await request.json().catch(() => ({} as any));
  const barId = Number(body?.bar_id) || Number(user.bar_id);
  const dia: string = body?.data || ontemBRT();
  const r = await executarConsumacaoDia(barId, dia, user.email ?? user.nome ?? null, parseChaves(body));
  return NextResponse.json(r.body, { status: r.status });
}
