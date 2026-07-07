import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFinanceiro } from '@/lib/auth/financeiro-guard';
import {
  getLancadorAdmin, getCAToken, resolveCategoriaId, resolveContaPadrao, criarLancamentoCA,
  round2, brDate, ultimoDiaMes, primeiroDiaMes, mesAnteriorBRT, mesSeguinte, parseChaves, type SinalLanc,
} from '@/lib/financeiro/contaazul-lancador';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * AJUSTE RECEITA VIRADA DO MÊS (fechamento mensal) → Conta Azul.
 * A operação da última NOITE do mês vai até ~06:00 do dia 01 do mês seguinte (corte 6h), mas
 * essa madrugada é lançada no CA no dia civil 01 (mês seguinte). Corrige-se assim:
 *   + RECEITA (valor) na competência do ÚLTIMO DIA do mês que fechou
 *   − DESPESA (mesmo valor) na competência do DIA 01 do mês seguinte
 * Ambos na categoria "Ajuste Receita Virada do Mês". Sem baixa. Soma total = 0.
 * Fonte do valor: Stone bruto 00:00-06:00 da MADRUGADA do dia 01 do mês seguinte
 * (fn_stone_bruto_intervalo, hora local real; soma todas as empresas do bar — ex. Ordibar + Ordinário Bar).
 * Idempotente por financial.lancamento_manual_ca_log (tipo='ajuste_virada', chave='receita'|'despesa').
 *
 *  - GET  : preview do mês (não escreve).
 *  - POST : cria os lançamentos que faltam (admin/financeiro).
 */

const TIPO = 'ajuste_virada';
// Candidatos de nome (o bar 4 tem "[Manual] Ajuste Receita Virada do Mês"; alguns bares só "Ajuste Receita Virada do Mês").
const CAT_NOME = ['Ajuste Receita Virada do Mês', '[Manual] Ajuste Receita Virada do Mês'];
const MES_LABEL = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Faturamento bruto Stone da MADRUGADA (00:00-06:00) do dia 01 do mês seguinte = última noite operacional do mês. */
export async function getFaturamentoMadrugada(barId: number, ano: number, mes: number): Promise<{ valor: number; madrugadaDia: string }> {
  const supabase = getLancadorAdmin();
  const seg = mesSeguinte(ano, mes);
  const madrugadaDia = primeiroDiaMes(seg.ano, seg.mes); // dia 01 do mês seguinte
  const { data } = await (supabase as any).rpc('fn_stone_bruto_intervalo', {
    p_bar: barId, p_ini: `${madrugadaDia} 00:00:00`, p_fim: `${madrugadaDia} 06:00:00`,
  });
  return { valor: round2(Number(data || 0)), madrugadaDia };
}

interface PernaVirada { chave: 'receita' | 'despesa'; sinal: SinalLanc; competencia: string; label: string; }

function pernas(ano: number, mes: number): PernaVirada[] {
  const ultimoDia = ultimoDiaMes(ano, mes);
  const seg = mesSeguinte(ano, mes);
  const dia01Seguinte = primeiroDiaMes(seg.ano, seg.mes);
  return [
    { chave: 'receita', sinal: 'RECEITA', competencia: ultimoDia, label: `Receita no mês (${brDate(ultimoDia)})` },
    { chave: 'despesa', sinal: 'DESPESA', competencia: dia01Seguinte, label: `Estorno no mês seguinte (${brDate(dia01Seguinte)})` },
  ];
}

/** Executa (idempotente) as 2 pernas da virada. `chaves` (opcional) limita a 'receita'/'despesa'. Sem auth — quem chama garante. */
export async function executarAjusteVirada(barId: number, ano: number, mes: number, criadoPor: string | null, chaves?: string[]): Promise<{ status: number; body: any }> {
  const supabase = getLancadorAdmin();
  const competenciaRef = ultimoDiaMes(ano, mes); // chave de agrupamento no log
  const { valor, madrugadaDia } = await getFaturamentoMadrugada(barId, ano, mes);
  const ps = pernas(ano, mes);

  const log = () => (supabase.schema('financial' as any) as any).from('lancamento_manual_ca_log');
  const { data: jaLogs } = await log().select('chave').eq('bar_id', barId).eq('tipo', TIPO).eq('competencia', competenciaRef);
  const feitos = new Set(((jaLogs as any[]) || []).map((r) => r.chave));

  if (!(valor > 0)) return { status: 200, body: { bar_id: barId, ano, mes, competencia: competenciaRef, skipped: true, motivo: 'sem faturamento na madrugada do último dia', valor: 0 } };
  const filtro = chaves?.length ? new Set(chaves) : null;
  const pendentes = ps.filter((p) => !feitos.has(p.chave) && (!filtro || filtro.has(p.chave)));
  if (pendentes.length === 0) return { status: 200, body: { bar_id: barId, ano, mes, competencia: competenciaRef, skipped: true, motivo: 'já lançado', valor } };

  const tokenResult = await getCAToken(barId);
  if ('error' in tokenResult) return { status: tokenResult.status, body: { error: tokenResult.error } };
  const token = tokenResult.token;
  const conta = await resolveContaPadrao(barId);
  if (!conta) return { status: 400, body: { error: 'Nenhuma conta financeira ativa no Conta Azul' } };

  const resultados: any[] = [];
  for (const p of pendentes) {
    const cat = await resolveCategoriaId(barId, CAT_NOME, p.sinal);
    if (!cat) {
      resultados.push({ perna: p.chave, ok: false, erro: `Categoria "Ajuste Receita Virada do Mês" (${p.sinal}) não existe no Conta Azul deste bar — crie e sincronize.` });
      continue;
    }
    const descricao = `Ajuste Receita Virada do Mês ${MES_LABEL[mes]}/${ano}`;
    const r = await criarLancamentoCA({
      token, sinal: p.sinal, competencia: p.competencia, vencimento: p.competencia, valor,
      descricao, observacao: `Ajuste receita virada do mês (${p.sinal === 'RECEITA' ? 'receita mês' : 'estorno mês seguinte'}) — Stone 00h-06h de ${brDate(madrugadaDia)} via Zykor`,
      categoriaId: cat.id, contaId: conta.id,
    });
    if (r.ok) {
      await log().insert({
        bar_id: barId, tipo: TIPO, competencia: competenciaRef, chave: p.chave, sinal: p.sinal, valor,
        descricao, categoria_id: cat.id, categoria_nome: cat.nome, conta_id: conta.id, data_vencimento: p.competencia,
        ca_protocol_id: r.protocolId, ca_status: r.status, baixado: false, criado_por: criadoPor,
      });
    }
    resultados.push({ perna: p.chave, sinal: p.sinal, competencia: p.competencia, valor, ok: r.ok, erro: r.erro, protocolId: r.protocolId });
  }
  const algumErro = resultados.some((r) => !r.ok);
  return { status: algumErro ? 207 : 200, body: { bar_id: barId, ano, mes, competencia: competenciaRef, ok: !algumErro, valor, resultados } };
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
  const competenciaRef = ultimoDiaMes(alvo.ano, alvo.mes);

  const { valor, madrugadaDia } = await getFaturamentoMadrugada(barId, alvo.ano, alvo.mes);
  const ps = pernas(alvo.ano, alvo.mes);
  const supabase = getLancadorAdmin();
  const { data: logs } = await (supabase.schema('financial' as any) as any)
    .from('lancamento_manual_ca_log').select('chave').eq('bar_id', barId).eq('tipo', TIPO).eq('competencia', competenciaRef);
  const feitos = new Set(((logs as any[]) || []).map((r) => r.chave));

  return NextResponse.json({
    bar_id: barId, ano: alvo.ano, mes: alvo.mes, competencia: competenciaRef, valor, madrugadaDia,
    pernas: ps.map((p) => ({ chave: p.chave, sinal: p.sinal, competencia: p.competencia, label: p.label, valor, ja_lancado: feitos.has(p.chave) })),
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
  const r = await executarAjusteVirada(barId, ano, mes, user.email ?? user.nome ?? null, parseChaves(body));
  return NextResponse.json(r.body, { status: r.status });
}
