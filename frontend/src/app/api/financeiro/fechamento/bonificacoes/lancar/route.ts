import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFerramentaFinanceira, FERRAMENTA_FINANCEIRA } from '@/lib/auth/financeiro-guard';
import {
  getLancadorAdmin, getCAToken, resolveCategoriaId, resolveContaPadrao, criarLancamentoCA, round2,
} from '@/lib/financeiro/contaazul-lancador';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Lança 1 bonificação como PAR soma-zero no Conta Azul: 1 RECEITA (competencia_receita,
 * categoria_receita) + 1 DESPESA (competencia_despesa, categoria_despesa), mesmo valor, sem baixa.
 * Idempotente por perna (guarda o protocolo de cada uma; não recria a que já foi). Body: { id, bar_id? }.
 */
const MES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const rotulo = (comp: string) => `${MES[Number(comp.slice(5, 7))]}/${comp.slice(0, 4)}`;

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.despesas, 'inserir')) return permissionErrorResponse('Sem permissão para lançar');
  const body = await request.json().catch(() => ({} as any));
  const id = Number(body?.id);
  const barId = Number(body?.bar_id) || Number(user.bar_id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

  const supabase = getLancadorAdmin();
  const bonif = () => (supabase.schema('financial' as any) as any).from('bonificacoes');
  const { data: b } = await bonif()
    .select('id, bar_id, fornecedor, referente, valor, competencia_receita, competencia_despesa, categoria_receita, categoria_despesa, ca_lancado, ca_receita_protocol_id, ca_despesa_protocol_id')
    .eq('id', id).eq('bar_id', barId).maybeSingle();
  if (!b) return NextResponse.json({ error: 'Bonificação não encontrada' }, { status: 404 });
  if ((b as any).ca_lancado) return NextResponse.json({ ok: true, skipped: true, motivo: 'já lançada' });

  const valor = round2(Number((b as any).valor));
  if (!(valor > 0)) return NextResponse.json({ error: 'valor inválido' }, { status: 400 });

  const tokenResult = await getCAToken(barId);
  if ('error' in tokenResult) return NextResponse.json({ error: tokenResult.error }, { status: tokenResult.status });
  const token = tokenResult.token;
  const conta = await resolveContaPadrao(barId);
  if (!conta) return NextResponse.json({ error: 'Nenhuma conta financeira ativa no Conta Azul' }, { status: 400 });

  const catRec = await resolveCategoriaId(barId, String((b as any).categoria_receita), 'RECEITA');
  const catDes = await resolveCategoriaId(barId, String((b as any).categoria_despesa), 'DESPESA');
  if (!catRec) return NextResponse.json({ error: `Categoria de RECEITA "${(b as any).categoria_receita}" não existe no Conta Azul deste bar.` }, { status: 400 });
  if (!catDes) return NextResponse.json({ error: `Categoria de DESPESA "${(b as any).categoria_despesa}" não existe no Conta Azul deste bar.` }, { status: 400 });

  const forn = String((b as any).fornecedor || '').trim();
  const ref = (b as any).referente ? ` - ${String((b as any).referente).trim()}` : '';
  const compRec = String((b as any).competencia_receita);
  const compDes = String((b as any).competencia_despesa);

  const upd: Record<string, any> = { updated_at: new Date().toISOString() };
  const resultados: any[] = [];

  // Perna RECEITA (só se ainda não lançada)
  if (!(b as any).ca_receita_protocol_id) {
    const r = await criarLancamentoCA({
      token, sinal: 'RECEITA', competencia: compRec, vencimento: compRec, valor,
      descricao: `Bonificação ${forn}${ref} ${rotulo(compRec)}`,
      observacao: `Bonificação ${forn} (receita) via Zykor`, categoriaId: catRec.id, contaId: conta.id,
    });
    resultados.push({ perna: 'receita', ok: r.ok, erro: r.erro });
    if (r.ok) { upd.ca_receita_protocol_id = r.protocolId; upd.ca_receita_status = r.status; upd.ca_receita_categoria_id = catRec.id; }
  }
  // Perna DESPESA (só se ainda não lançada)
  if (!(b as any).ca_despesa_protocol_id) {
    const r = await criarLancamentoCA({
      token, sinal: 'DESPESA', competencia: compDes, vencimento: compDes, valor,
      descricao: `Bonificação ${forn}${ref} ${rotulo(compDes)}`,
      observacao: `Bonificação ${forn} (despesa/estorno) via Zykor`, categoriaId: catDes.id, contaId: conta.id,
    });
    resultados.push({ perna: 'despesa', ok: r.ok, erro: r.erro });
    if (r.ok) { upd.ca_despesa_protocol_id = r.protocolId; upd.ca_despesa_status = r.status; upd.ca_despesa_categoria_id = catDes.id; }
  }

  const receitaOk = (b as any).ca_receita_protocol_id || upd.ca_receita_protocol_id;
  const despesaOk = (b as any).ca_despesa_protocol_id || upd.ca_despesa_protocol_id;
  if (receitaOk && despesaOk) { upd.ca_lancado = true; upd.lancado_em = new Date().toISOString(); upd.lancado_por = user.email ?? user.nome ?? null; }
  await bonif().update(upd).eq('id', id).eq('bar_id', barId);

  const algumErro = resultados.some((r) => !r.ok);
  return NextResponse.json({ ok: !algumErro, id, valor, lancado: !!upd.ca_lancado, resultados }, { status: algumErro ? 502 : 200 });
}
