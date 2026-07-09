/**
 * Envia um PIX pelo Inter usando a credencial de um bar ESPECÍFICO (o pagador),
 * server-side, sem depender do bar do usuário logado.
 *
 * A rota /api/financeiro/inter/pix amarra o pagamento ao bar do usuário autenticado —
 * não serve pra Troca entre bares, onde quem paga é a CONTRAPARTE (não o bar logado).
 * Aqui resolvemos a credencial do bar pagador e disparamos direto.
 *
 * Idempotência: `seedIdempotencia` gera uma chave estável enviada ao Inter (o banco
 * deduplica o reenvio). O chamador ainda deve guardar o código e só chamar 1x.
 */
import crypto from 'crypto';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { getInterAccessToken } from '@/lib/inter/getAccessToken';
import { realizarPagamentoPixInter } from '@/lib/inter/pixPayment';
import { resolveInterCredential } from '@/lib/inter/resolveCredential';

function idempotenciaDeterministica(seed: string): string {
  const h = crypto.createHash('sha256').update(seed).digest('hex');
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export async function enviarPixDireto(params: {
  barId: number;              // bar PAGADOR
  credencialId: number;       // api_credentials.id (Inter) do bar pagador
  chave: string;              // chave PIX de destino
  valor: number;
  descricao: string;
  destinatario?: string;
  dataPagamento?: string;     // YYYY-MM-DD (futuro = agenda; hoje/passado = imediato)
  seedIdempotencia: string;   // chave de idempotência do banco (muda por tentativa p/ re-enviar)
  refPagamento?: string;      // id estável do pagamento p/ rastreio (ex.: `troca:<id>`)
}): Promise<{ codigoSolicitacao: string }> {
  const { barId, credencialId, chave, valor, descricao, destinatario, dataPagamento, seedIdempotencia } = params;
  const refPagamento = params.refPagamento || seedIdempotencia;
  const supabase = createServiceRoleClient();

  // Credencial DEVE pertencer ao bar pagador (nunca usa credencial de outro bar).
  const { data: cred } = await supabase
    .from('api_credentials')
    .select('*')
    .eq('bar_id', barId)
    .in('sistema', ['inter', 'banco_inter'])
    .eq('ativo', true)
    .eq('id', credencialId)
    .limit(1)
    .maybeSingle();
  if (!cred) throw new Error(`Credencial Inter ${credencialId} não encontrada/ativa no bar ${barId}`);

  const resolved = await resolveInterCredential(cred);
  const { clientId, clientSecret, contaCorrente, mtls } = resolved as any;
  if (!clientId || !clientSecret || !contaCorrente) throw new Error('Credencial Inter incompleta');

  const cents = Math.round(valor * 100);
  const idempotencyKey = idempotenciaDeterministica(`${seedIdempotencia}:${cents}:${chave}`);

  const token = await getInterAccessToken(clientId, clientSecret, 'pagamento-pix.write', mtls || undefined);
  const r = await realizarPagamentoPixInter({
    token, contaCorrente, valor, descricao, chave,
    dataPagamento, mtlsCredentials: mtls || undefined, idempotencyKey,
  });
  if (!r.success) throw new Error(r.error || 'Falha no PIX do Inter');

  const codigoSolicitacao = r.data?.codigoSolicitacao || r.data?.endToEndId || `PIX_${Date.now()}`;
  const dpIso = dataPagamento && /^\d{4}-\d{2}-\d{2}/.test(dataPagamento) ? dataPagamento.slice(0, 10) : null;
  const isAgendado = !!dpIso && dpIso > new Date().toISOString().slice(0, 10);

  await (supabase.schema('financial' as any) as any).from('pix_enviados').insert({
    txid: codigoSolicitacao,
    bar_id: barId,
    valor,
    inter_credencial_id: (resolved as any).id ?? credencialId,
    inter_codigo_solicitacao: codigoSolicitacao,
    inter_status: isAgendado ? 'AGENDADO' : 'ENVIADO',
    data_pagamento: dpIso,
    pagamento_zykor_id: refPagamento,
    beneficiario: { nome: destinatario || 'Troca entre bares', chave, descricao },
    data_envio: new Date().toISOString(),
    status: isAgendado ? 'agendado' : 'enviado',
  });

  return { codigoSolicitacao };
}
