import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFinanceiro } from '@/lib/auth/financeiro-guard';
import {
  getLancadorAdmin, getCAToken, resolveCategoriaId, resolveContaPadrao, criarLancamentoCA,
  round2, ultimoDiaMes, mesAnteriorBRT,
} from '@/lib/financeiro/contaazul-lancador';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * BONIFICAÇÕES (fechamento mensal) → Conta Azul.
 * 1 despesa/mês na categoria "Ajuste Bonificações" = total preenchido em Gestão CMV mensal
 * (financial.cmv_mensal.bonificacoes) do mês anterior. Competência = mês anterior. Sem baixa.
 * Idempotente por financial.lancamento_manual_ca_log (tipo='bonificacao', chave='').
 *
 *  - GET  : preview do mês (não escreve).
 *  - POST : cria o lançamento se faltar (admin/financeiro).
 */

const TIPO = 'bonificacao';
const CAT_NOME = 'Ajuste Bonificações';
const MES_LABEL = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Total de bonificações preenchido na Gestão CMV mensal (com fallback pro esquema legado). */
export async function getBonificacaoMes(barId: number, ano: number, mes: number): Promise<number> {
  const supabase = getLancadorAdmin();
  const { data } = await (supabase.schema('financial' as any) as any)
    .from('cmv_mensal')
    .select('bonificacoes, bonificacao_contrato_anual, bonificacao_cashback_mensal')
    .eq('bar_id', barId).eq('ano', ano).eq('mes', mes).maybeSingle();
  if (!data) return 0;
  const unificado = data.bonificacoes;
  if (unificado != null) return round2(Number(unificado));
  return round2(Number(data.bonificacao_contrato_anual || 0) + Number(data.bonificacao_cashback_mensal || 0));
}

/** Executa (idempotente) o lançamento de bonificação do mês. Sem auth — quem chama garante. */
export async function executarBonificacao(barId: number, ano: number, mes: number, criadoPor: string | null): Promise<{ status: number; body: any }> {
  const supabase = getLancadorAdmin();
  const competencia = ultimoDiaMes(ano, mes);
  const valor = await getBonificacaoMes(barId, ano, mes);

  const log = () => (supabase.schema('financial' as any) as any).from('lancamento_manual_ca_log');
  const { data: jaLog } = await log().select('id, valor, ca_status').eq('bar_id', barId).eq('tipo', TIPO).eq('competencia', competencia).eq('chave', '').maybeSingle();
  if (jaLog) return { status: 200, body: { bar_id: barId, ano, mes, competencia, skipped: true, motivo: 'já lançado', valor: jaLog.valor } };
  if (!(valor > 0)) return { status: 200, body: { bar_id: barId, ano, mes, competencia, skipped: true, motivo: 'sem bonificação preenchida no mês', valor: 0 } };

  const tokenResult = await getCAToken(barId);
  if ('error' in tokenResult) return { status: tokenResult.status, body: { error: tokenResult.error } };
  const token = tokenResult.token;
  const cat = await resolveCategoriaId(barId, CAT_NOME, 'DESPESA');
  if (!cat) return { status: 400, body: { error: `Categoria "${CAT_NOME}" (DESPESA) não existe no Conta Azul deste bar — crie e sincronize.` } };
  const conta = await resolveContaPadrao(barId);
  if (!conta) return { status: 400, body: { error: 'Nenhuma conta financeira ativa no Conta Azul' } };

  const descricao = `Bonificações ${MES_LABEL[mes]}/${ano}`;
  const r = await criarLancamentoCA({
    token, sinal: 'DESPESA', competencia, vencimento: competencia, valor,
    descricao, observacao: `Bonificações ${MES_LABEL[mes]}/${ano} (Gestão CMV mensal) via Zykor`,
    categoriaId: cat.id, contaId: conta.id,
  });
  if (!r.ok) return { status: 502, body: { bar_id: barId, ano, mes, competencia, ok: false, erro: r.erro, valor } };

  await log().insert({
    bar_id: barId, tipo: TIPO, competencia, chave: '', sinal: 'DESPESA', valor,
    descricao, categoria_id: cat.id, categoria_nome: cat.nome, conta_id: conta.id, data_vencimento: competencia,
    ca_protocol_id: r.protocolId, ca_status: r.status, baixado: false, criado_por: criadoPor,
  });
  return { status: 200, body: { bar_id: barId, ano, mes, competencia, ok: true, valor, protocolId: r.protocolId } };
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

  const valor = await getBonificacaoMes(barId, alvo.ano, alvo.mes);
  const supabase = getLancadorAdmin();
  const { data: log } = await (supabase.schema('financial' as any) as any)
    .from('lancamento_manual_ca_log').select('valor, ca_status').eq('bar_id', barId).eq('tipo', TIPO).eq('competencia', competencia).eq('chave', '').maybeSingle();
  return NextResponse.json({
    bar_id: barId, ano: alvo.ano, mes: alvo.mes, competencia,
    categoria: CAT_NOME, descricao: `Bonificações ${MES_LABEL[alvo.mes]}/${alvo.ano}`,
    valor, ja_lancado: !!log, valor_lancado: log?.valor ?? null,
  });
}

/** POST: cria o lançamento se faltar (admin/financeiro). Body: { bar_id?, ano?, mes? }. */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFinanceiro(user)) return permissionErrorResponse('Sem permissão para criar lançamentos');
  const body = await request.json().catch(() => ({} as any));
  const barId = Number(body?.bar_id) || Number(user.bar_id);
  const { ano, mes } = (Number.isFinite(Number(body?.ano)) && Number.isFinite(Number(body?.mes)))
    ? { ano: Number(body.ano), mes: Number(body.mes) } : mesAnteriorBRT();
  const r = await executarBonificacao(barId, ano, mes, user.email ?? user.nome ?? null);
  return NextResponse.json(r.body, { status: r.status });
}
