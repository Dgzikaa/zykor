import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFinanceiro } from '@/lib/auth/financeiro-guard';
import {
  getLancadorAdmin, getCAToken, resolveCategoriaId, resolveContaPadrao, criarLancamentoCA, round2,
} from '@/lib/financeiro/contaazul-lancador';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Lança 1 bonificação (do cadastro financial.bonificacoes) no Conta Azul: DESPESA na categoria
 * "Ajuste Bonificações", competência da bonificação, sem baixa. Idempotente (não relança se já lançada).
 * Body: { id, bar_id? }.
 */
const CAT_NOME = 'Ajuste Bonificações';
const MES_LABEL = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFinanceiro(user)) return permissionErrorResponse('Sem permissão para lançar');
  const body = await request.json().catch(() => ({} as any));
  const id = Number(body?.id);
  const barId = Number(body?.bar_id) || Number(user.bar_id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

  const supabase = getLancadorAdmin();
  const bonif = () => (supabase.schema('financial' as any) as any).from('bonificacoes');
  const { data: b } = await bonif()
    .select('id, bar_id, fornecedor, referente, valor, competencia, ca_lancado')
    .eq('id', id).eq('bar_id', barId).maybeSingle();
  if (!b) return NextResponse.json({ error: 'Bonificação não encontrada' }, { status: 404 });
  if ((b as any).ca_lancado) return NextResponse.json({ ok: true, skipped: true, motivo: 'já lançada' });

  const valor = round2(Number((b as any).valor));
  if (!(valor > 0)) return NextResponse.json({ error: 'valor inválido' }, { status: 400 });
  const competencia = String((b as any).competencia); // 'YYYY-MM-01'
  const mes = Number(competencia.slice(5, 7));
  const ano = Number(competencia.slice(0, 4));

  const tokenResult = await getCAToken(barId);
  if ('error' in tokenResult) return NextResponse.json({ error: tokenResult.error }, { status: tokenResult.status });
  const cat = await resolveCategoriaId(barId, CAT_NOME, 'DESPESA');
  if (!cat) return NextResponse.json({ error: `Categoria "${CAT_NOME}" (DESPESA) não existe no Conta Azul deste bar.` }, { status: 400 });
  const conta = await resolveContaPadrao(barId);
  if (!conta) return NextResponse.json({ error: 'Nenhuma conta financeira ativa no Conta Azul' }, { status: 400 });

  const forn = String((b as any).fornecedor || '').trim();
  const ref = (b as any).referente ? ` - ${String((b as any).referente).trim()}` : '';
  const descricao = `Bonificação ${forn}${ref} ${MES_LABEL[mes]}/${ano}`;
  const r = await criarLancamentoCA({
    token: tokenResult.token, sinal: 'DESPESA', competencia, vencimento: competencia, valor,
    descricao, observacao: `Bonificação ${forn} (${MES_LABEL[mes]}/${ano}) via Zykor`,
    categoriaId: cat.id, contaId: conta.id,
  });
  if (!r.ok) return NextResponse.json({ ok: false, erro: r.erro }, { status: 502 });

  await bonif().update({
    ca_lancado: true, ca_protocol_id: r.protocolId, ca_status: r.status, ca_categoria_id: cat.id,
    lancado_em: new Date().toISOString(), lancado_por: user.email ?? user.nome ?? null, updated_at: new Date().toISOString(),
  }).eq('id', id).eq('bar_id', barId);

  return NextResponse.json({ ok: true, id, valor, protocolId: r.protocolId });
}
