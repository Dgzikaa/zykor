import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { getInterAccessToken } from '@/lib/inter/getAccessToken';
import { cancelarAgendamentoPixInter } from '@/lib/inter/pixPayment';
import { resolveInterCredential } from '@/lib/inter/resolveCredential';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFerramentaFinanceira, FERRAMENTA_FINANCEIRA } from '@/lib/auth/financeiro-guard';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';

const supabase = createServiceRoleClient();

/**
 * POST — cancela um agendamento PIX no Inter (antes de efetivar).
 * Body: { codigo: string, inter_credencial_id?: number }
 * Usado ao EXCLUIR um pedido/freela que já foi subido ao Inter (aguardando o sócio ou
 * agendado). Não mexe no Conta Azul (o CA não tem API de exclusão) — quem chama trata isso.
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.agendamentos, 'inserir')) {
    return permissionErrorResponse('Sem permissão para cancelar PIX');
  }
  const bar_id = user.bar_id;
  if (!bar_id) return NextResponse.json({ success: false, error: 'Usuário sem bar associado' }, { status: 400 });

  let body: any = {};
  try { body = await request.json(); } catch { body = {}; }
  const codigo = String(body.codigo || '').trim();
  if (!codigo) return NextResponse.json({ success: false, error: 'codigo (solicitação Inter) obrigatório' }, { status: 400 });
  const credencialIdPedido = Number.isFinite(Number(body.inter_credencial_id)) ? Number(body.inter_credencial_id) : undefined;

  // Credencial Inter do bar (a pedida quando pertence ao bar; senão a ativa do bar).
  let credRow: any = null;
  if (credencialIdPedido) {
    const { data } = await supabase.from('api_credentials').select('*')
      .eq('bar_id', bar_id).in('sistema', ['inter', 'banco_inter']).eq('ativo', true).eq('id', credencialIdPedido).limit(1);
    credRow = data?.[0] || null;
  }
  if (!credRow) {
    const { data } = await supabase.from('api_credentials').select('*')
      .eq('bar_id', bar_id).in('sistema', ['inter', 'banco_inter']).eq('ativo', true).order('id', { ascending: true }).limit(1);
    credRow = data?.[0] || null;
  }
  if (!credRow) return NextResponse.json({ success: false, error: 'Credenciais Inter não configuradas para este bar' }, { status: 400 });

  let resolved;
  try { resolved = await resolveInterCredential(credRow); }
  catch (e: any) { return NextResponse.json({ success: false, error: e?.message || 'Falha ao resolver credencial Inter' }, { status: 400 }); }

  const { clientId, clientSecret, contaCorrente, mtls } = resolved;
  if (!clientId || !clientSecret || !contaCorrente) {
    return NextResponse.json({ success: false, error: 'Credenciais Inter incompletas' }, { status: 400 });
  }

  try {
    const token = await getInterAccessToken(clientId, clientSecret, 'pagamento-pix.write', mtls || undefined);
    const res = await cancelarAgendamentoPixInter({ token, contaCorrente, codigoSolicitacao: codigo, mtlsCredentials: mtls || undefined });
    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error || 'Inter recusou o cancelamento' }, { status: 400 });
    }
    // Reflete no espelho local (best-effort).
    await (supabase.schema('financial' as any) as any)
      .from('pix_enviados')
      .update({ status: 'cancelado', inter_status: 'CANCELADO', last_webhook_at: new Date().toISOString() })
      .or(`inter_codigo_solicitacao.eq.${codigo},txid.eq.${codigo}`);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erro ao cancelar no Inter' }, { status: 500 });
  }
}
