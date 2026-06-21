import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { getInterAccessToken, clearInterTokenCache } from '@/lib/inter/getAccessToken';
import { consultarSaldoInter } from '@/lib/inter/saldo';
import { resolveInterCredential } from '@/lib/inter/resolveCredential';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

const supabase = createServiceRoleClient();

/** GET /api/financeiro/inter/saldo — saldo disponível da conta Inter do bar (scope extrato.read). */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const bar_id = user.bar_id;
  if (!bar_id) return NextResponse.json({ success: false, error: 'Usuário sem bar' }, { status: 400 });

  // credencial Inter: usa o padrão do bar se configurado, senão a ativa
  const { data: cfg } = await (supabase.schema('financial' as any) as any)
    .from('pagamento_config_bar').select('inter_credencial_id').eq('bar_id', bar_id).maybeSingle();
  let credQ = supabase.from('api_credentials').select('*').eq('bar_id', bar_id)
    .in('sistema', ['inter', 'banco_inter']).eq('ativo', true);
  credQ = cfg?.inter_credencial_id ? credQ.eq('id', cfg.inter_credencial_id) : credQ.order('id', { ascending: true }).limit(1);
  const { data: creds } = await credQ;
  const credencial = creds?.[0];
  if (!credencial) return NextResponse.json({ success: false, error: 'Credencial Inter não configurada' }, { status: 404 });

  let resolved;
  try { resolved = await resolveInterCredential(credencial); }
  catch (e: any) { return NextResponse.json({ success: false, error: e?.message || 'Falha ao resolver credencial' }, { status: 400 }); }
  const { clientId, clientSecret, contaCorrente, mtls } = resolved;
  if (!clientId || !clientSecret || !contaCorrente) return NextResponse.json({ success: false, error: 'Credencial Inter incompleta' }, { status: 400 });

  try {
    let token = await getInterAccessToken(clientId, clientSecret, 'extrato.read', mtls || undefined);
    let res = await consultarSaldoInter({ token, contaCorrente, mtlsCredentials: mtls || undefined });
    if (!res.success && /not bound to a valid|recognized certificate/i.test(res.error || '')) {
      clearInterTokenCache();
      token = await getInterAccessToken(clientId, clientSecret, 'extrato.read', mtls || undefined);
      res = await consultarSaldoInter({ token, contaCorrente, mtlsCredentials: mtls || undefined });
    }
    if (!res.success) {
      const scopeErr = /scope|escopo|forbidden|403/i.test(res.error || '');
      return NextResponse.json({ success: false, error: res.error, hint: scopeErr ? 'Habilite o escopo "extrato.read" na aplicação do Inter (portal do desenvolvedor).' : undefined }, { status: 400 });
    }
    return NextResponse.json({ success: true, saldo: res.saldo, conta: resolved.empresaNome || contaCorrente });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erro ao consultar saldo' }, { status: 500 });
  }
}
