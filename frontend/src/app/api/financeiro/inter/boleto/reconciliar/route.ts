import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { getInterAccessToken, clearInterTokenCache } from '@/lib/inter/getAccessToken';
import { resolveInterCredential } from '@/lib/inter/resolveCredential';
import { consultarPagamentosBoletoInter, normalizarPagamentosInter, mapStatusPagamentoInter } from '@/lib/inter/boletoConsulta';
import { authenticateUser, permissionErrorResponse } from '@/middleware/auth';
import { podeFerramentaFinanceira, FERRAMENTA_FINANCEIRA } from '@/lib/auth/financeiro-guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const supabase = createServiceRoleClient();
const fin = () => (supabase.schema('financial' as any) as any);

function ymdSP(offsetDias = 0): string {
  const d = new Date(Date.now() + offsetDias * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

// Não regride terminais; só avança um boleto ainda em aberto.
const TERMINAIS = ['pago', 'rejeitado', 'cancelado'];

/**
 * Reconciliação de BOLETOS pagos pelo Inter — GET /banking/v2/pagamento (scope pagamento-boleto.read).
 * Pagamento de boleto NÃO dispara o webhook de PIX; então consultamos o status por período e
 * viramos o pedido agendado → pago/cancelado. Casa pelo codigoTransacao (boletos novos, que já
 * guardam o código real) ou pela linha digitável + valor (boletos antigos com código fallback BOL_).
 *
 * Auth: Bearer CRON_SECRET (cron) OU usuário financeiro (disparo manual — só o próprio bar).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const isCron = !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  let baresAlvo: number[] = [];

  if (isCron) {
    const { data } = await supabase.from('api_credentials').select('bar_id')
      .in('sistema', ['inter', 'banco_inter']).eq('ativo', true);
    baresAlvo = Array.from(new Set((data || []).map((r: any) => Number(r.bar_id)).filter(Boolean)));
  } else {
    const user = await authenticateUser(request);
    if (!user || !podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.agendamentos, 'inserir')) {
      return permissionErrorResponse('Sem permissão');
    }
    if (user.bar_id) baresAlvo = [user.bar_id];
  }
  if (!baresAlvo.length) return NextResponse.json({ success: true, aviso: 'Nenhum bar com Inter ativo', resultados: [] });

  const sp = new URL(request.url).searchParams;
  const dataInicio = sp.get('dataInicio') || ymdSP(-45);
  const dataFim = sp.get('dataFim') || ymdSP(2);
  const resultados: any[] = [];

  for (const barId of baresAlvo) {
    const res: any = { bar_id: barId, pagos: 0, cancelados: 0, sem_match: 0, status_vistos: [] as string[] };
    try {
      const { data: cred } = await supabase.from('api_credentials').select('*').eq('bar_id', barId)
        .in('sistema', ['inter', 'banco_inter']).eq('ativo', true).order('id', { ascending: true }).limit(1);
      if (!cred?.[0]) { res.erro = 'sem credencial'; resultados.push(res); continue; }
      const resolved = await resolveInterCredential(cred[0]);
      const { clientId, clientSecret, contaCorrente, mtls } = resolved;
      if (!clientId || !clientSecret || !contaCorrente) { res.erro = 'credencial incompleta'; resultados.push(res); continue; }

      let token = await getInterAccessToken(clientId, clientSecret, 'pagamento-boleto.read', mtls || undefined);
      let consulta = await consultarPagamentosBoletoInter({ token, contaCorrente, dataInicio, dataFim, mtlsCredentials: mtls || undefined });
      if (!consulta.success && /not bound to a valid|recognized certificate/i.test(consulta.error || '')) {
        clearInterTokenCache();
        token = await getInterAccessToken(clientId, clientSecret, 'pagamento-boleto.read', mtls || undefined);
        consulta = await consultarPagamentosBoletoInter({ token, contaCorrente, dataInicio, dataFim, mtlsCredentials: mtls || undefined });
      }
      if (!consulta.success) { res.erro = consulta.error; resultados.push(res); continue; }

      const pagamentos = normalizarPagamentosInter(consulta.data);
      res.status_vistos = Array.from(new Set(pagamentos.map(p => p.status).filter(Boolean)));

      // Boletos locais ainda em aberto (pix_enviados) → mapas de match por código real e por linha digitável.
      // (filtro de tipo=BOLETO feito em JS pra não depender do operador jsonb no PostgREST)
      const { data: rowsRaw } = await fin().from('pix_enviados')
        .select('id, inter_codigo_solicitacao, txid, valor, status, beneficiario, pagamento_zykor_id')
        .eq('bar_id', barId)
        .not('status', 'in', '(pago,cancelado)')
        .limit(3000);
      const rows = (rowsRaw || []).filter((r: any) =>
        r.beneficiario?.tipo === 'BOLETO'
        || String(r.inter_codigo_solicitacao || '').startsWith('BOL_')
        || !!r.beneficiario?.linha_digitavel);
      const porCodigo = new Map<string, any>();
      const porLinha = new Map<string, any[]>();
      for (const r of (rows || [])) {
        if (r.inter_codigo_solicitacao && !String(r.inter_codigo_solicitacao).startsWith('BOL_')) porCodigo.set(String(r.inter_codigo_solicitacao), r);
        const linha = String(r.beneficiario?.linha_digitavel || '').replace(/\D/g, '');
        if (linha) { const a = porLinha.get(linha) || []; a.push(r); porLinha.set(linha, a); }
      }

      for (const p of pagamentos) {
        const estado = mapStatusPagamentoInter(p.status);
        if (estado !== 'pago' && estado !== 'cancelado') continue; // só age no que fechou
        // acha o boleto local: 1º pelo código real; senão pela linha digitável (+ valor de desempate)
        let row = p.codigoTransacao ? porCodigo.get(String(p.codigoTransacao)) : null;
        if (!row && p.linhaDigitavel) {
          const cand = porLinha.get(p.linhaDigitavel) || [];
          row = cand.find((c: any) => p.valor == null || Math.abs(Number(c.valor) - p.valor) < 0.01) || cand[0] || null;
        }
        if (!row) { res.sem_match++; continue; }

        // atualiza o registro de rastreio (pix_enviados)
        await fin().from('pix_enviados').update({
          status: estado, inter_status: p.status, last_webhook_at: new Date().toISOString(),
        }).eq('id', row.id);

        // propaga pro PEDIDO (se ainda em aberto)
        if (row.pagamento_zykor_id) {
          const { data: ped } = await fin().from('pedidos_pagamento')
            .select('id, bar_id, status').eq('id', row.pagamento_zykor_id).maybeSingle();
          const alvo = estado === 'pago' ? 'pago' : 'cancelado';
          const podeAtualizar = ped && ped.status !== alvo && !TERMINAIS.includes(ped.status);
          if (podeAtualizar) {
            await fin().from('pedidos_pagamento').update({
              status: alvo, ...(alvo === 'pago' ? { pago_em: new Date().toISOString() } : {}),
            }).eq('id', ped.id);
            await fin().from('pedidos_pagamento_comentarios').insert({
              pedido_id: ped.id, bar_id: ped.bar_id, autor_id: null, autor_nome: 'Sistema',
              mensagem: alvo === 'pago'
                ? `Boleto confirmado como PAGO pelo Inter (consulta de pagamentos, status ${p.status}).`
                : `Boleto ${p.status} no Inter (consulta de pagamentos).`,
              tipo: 'sistema',
            });
            await fin().from('pedidos_pagamento_historico').insert({
              pedido_id: ped.id, bar_id: ped.bar_id, autor_id: null, autor_nome: 'Inter (reconciliação boleto)',
              campo: 'status', valor_anterior: ped.status, valor_novo: alvo,
            });
          }
        }
        if (estado === 'pago') res.pagos++; else res.cancelados++;
      }
    } catch (e: any) {
      res.erro = e?.message || String(e);
    }
    resultados.push(res);
  }

  return NextResponse.json({ success: true, periodo: { dataInicio, dataFim }, resultados });
}
