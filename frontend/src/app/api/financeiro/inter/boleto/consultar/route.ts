import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { getInterAccessToken, clearInterTokenCache } from '@/lib/inter/getAccessToken';
import { resolveInterCredential } from '@/lib/inter/resolveCredential';
import { consultarPagamentosBoletoInter, normalizarPagamentosInter } from '@/lib/inter/boletoConsulta';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFerramentaFinanceira, FERRAMENTA_FINANCEIRA } from '@/lib/auth/financeiro-guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createServiceRoleClient();

function ymdSP(offsetDias = 0): string {
  const d = new Date(Date.now() + offsetDias * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

async function getInterCredentials(barId: number, credentialId?: number) {
  let query = supabase.from('api_credentials').select('*').eq('bar_id', barId)
    .in('sistema', ['inter', 'banco_inter']).eq('ativo', true);
  query = credentialId ? query.eq('id', credentialId) : query.order('id', { ascending: true }).limit(1);
  const { data } = await query;
  return data?.[0] || null;
}

/**
 * GET /api/financeiro/inter/boleto/consultar?bar_id&dataInicio&dataFim
 *
 * Rota de INSPEÇÃO: consulta o Inter (GET /banking/v2/pagamento, scope pagamento-boleto.read)
 * e devolve o retorno CRU + a normalização, pra confirmar (a) que o scope de leitura está
 * liberado e (b) o nome exato dos campos/status antes de ligar a reconciliação automática.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.agendamentos, 'inserir')) return permissionErrorResponse('Sem permissão');

  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });
  const dataInicio = sp.get('dataInicio') || ymdSP(-30);
  const dataFim = sp.get('dataFim') || ymdSP(0);

  const credenciais = await getInterCredentials(barId, Number(sp.get('inter_credencial_id')) || undefined);
  if (!credenciais) return NextResponse.json({ success: false, error: 'Credenciais Inter não configuradas' }, { status: 400 });

  let resolved;
  try { resolved = await resolveInterCredential(credenciais); }
  catch (e: any) { return NextResponse.json({ success: false, error: e?.message || 'Falha ao resolver credencial Inter' }, { status: 400 }); }
  const { clientId, clientSecret, contaCorrente, mtls } = resolved;
  if (!clientId || !clientSecret || !contaCorrente) return NextResponse.json({ success: false, error: 'Credenciais Inter incompletas' }, { status: 400 });

  let token = await getInterAccessToken(clientId, clientSecret, 'pagamento-boleto.read', mtls || undefined);
  let r = await consultarPagamentosBoletoInter({ token, contaCorrente, dataInicio, dataFim, mtlsCredentials: mtls || undefined });
  if (!r.success && /not bound to a valid|recognized certificate/i.test(r.error || '')) {
    clearInterTokenCache();
    token = await getInterAccessToken(clientId, clientSecret, 'pagamento-boleto.read', mtls || undefined);
    r = await consultarPagamentosBoletoInter({ token, contaCorrente, dataInicio, dataFim, mtlsCredentials: mtls || undefined });
  }
  if (!r.success) return NextResponse.json({ success: false, error: r.error, dica: 'Se for erro de scope, habilite pagamento-boleto.read na aplicação do Inter.' }, { status: 400 });

  const normalizados = normalizarPagamentosInter(r.data);
  const statusVistos = Array.from(new Set(normalizados.map(p => p.status).filter(Boolean)));
  return NextResponse.json({
    success: true, bar_id: barId, periodo: { dataInicio, dataFim },
    total: normalizados.length, status_vistos: statusVistos,
    normalizados, raw: r.data,
  });
}
