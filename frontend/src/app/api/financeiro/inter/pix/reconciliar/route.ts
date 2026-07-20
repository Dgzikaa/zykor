import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { getInterAccessToken, clearInterTokenCache } from '@/lib/inter/getAccessToken';
import { resolveInterCredential } from '@/lib/inter/resolveCredential';
import { consultarPixInter, mapStatusPixParaPedido } from '@/lib/inter/pixConsulta';
import { authenticateUser, permissionErrorResponse } from '@/middleware/auth';
import { podeFerramentaFinanceira, FERRAMENTA_FINANCEIRA } from '@/lib/auth/financeiro-guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const supabase = createServiceRoleClient();
const fin = () => (supabase.schema('financial' as any) as any);

// Nunca regride um terminal; a cadeia principal só AVANÇA (aguardando_socio → agendado → pago).
const TERMINAIS = ['pago', 'rejeitado', 'reprovado', 'cancelado'];
const RANK: Record<string, number> = { aguardando_socio: 1, agendado: 2, pago: 3 };

function podeAplicar(atual: string, alvo: string): boolean {
  if (!alvo || atual === alvo) return false;
  if (TERMINAIS.includes(atual)) return false;
  if (alvo === 'pago' || alvo === 'reprovado' || alvo === 'cancelado') return true; // finais
  if (alvo === 'erro_inter') return atual !== 'erro_inter';
  // cadeia aguardando_socio → agendado: só avança (nunca volta com status stale do banco)
  if (RANK[alvo] && RANK[atual]) return RANK[alvo] > RANK[atual];
  return false;
}

const MSG: Record<string, string> = {
  pago: 'Pagamento confirmado pelo Inter (reconciliação PIX).',
  agendado: 'Aprovado pelo sócio no Inter — agendado, aguardando a data (reconciliação PIX).',
  reprovado: 'Recusado pelo sócio no app do Inter (reconciliação PIX).',
  cancelado: 'PIX cancelado no Inter (reconciliação PIX).',
  erro_inter: 'PIX falhou/expirou no Inter — corrija e agende de novo (reconciliação PIX).',
};

/**
 * Reconciliação de PIX AGENDADOS — GET /banking/v2/pix/{codigo} (scope pagamento-pix.read).
 *
 * PROBLEMA: o webhook do Inter NÃO dispara quando o sócio APROVA um PIX agendado (só quando
 * efetiva, na data). Os pedidos ficam presos em "aguardando_socio" mesmo com o sócio já tendo
 * aprovado no app — foi o caso dos freelas do Deboche (agendados p/ o dia seguinte). Aqui a gente
 * varre os pedidos ainda em aberto (aguardando_socio/agendado) e lê o status REAL no banco,
 * promovendo aguardando_socio → agendado → pago (ou reprovado/cancelado/erro).
 *
 * Auth: Bearer CRON_SECRET (cron) OU usuário financeiro (disparo manual — só o próprio bar).
 * Query: ?bar_id=N (manual), ?dry=1 (diagnóstico: consulta e reporta sem gravar), ?limite=N.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const isCron = !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const sp = new URL(request.url).searchParams;
  const dry = sp.get('dry') === '1' || sp.get('dry') === 'true';
  const limite = Math.min(Number(sp.get('limite')) || 150, 400);
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
    const barParam = Number(sp.get('bar_id'));
    if (Number.isFinite(barParam) && barParam > 0) baresAlvo = [barParam];
    else if (user.bar_id) baresAlvo = [user.bar_id];
  }
  if (!baresAlvo.length) return NextResponse.json({ success: true, aviso: 'Nenhum bar com Inter ativo', resultados: [] });

  const resultados: any[] = [];

  for (const barId of baresAlvo) {
    const res: any = {
      bar_id: barId, consultados: 0, promovidos: 0, pagos: 0, agendados: 0,
      reprovados: 0, cancelados: 0, erros: 0, sem_status: 0, status_vistos: {} as Record<string, number>,
      amostras: [] as any[],
    };
    try {
      const { data: cred } = await supabase.from('api_credentials').select('*').eq('bar_id', barId)
        .in('sistema', ['inter', 'banco_inter']).eq('ativo', true).order('id', { ascending: true }).limit(1);
      if (!cred?.[0]) { res.erro = 'sem credencial'; resultados.push(res); continue; }
      const resolved = await resolveInterCredential(cred[0]);
      const { clientId, clientSecret, contaCorrente, mtls } = resolved;
      if (!clientId || !clientSecret || !contaCorrente) { res.erro = 'credencial incompleta'; resultados.push(res); continue; }

      // Pedidos ainda em aberto: aguardando o sócio ou agendados aguardando a data. Só PIX
      // (tem inter_codigo_solicitacao; copia-e-cola/boleto ficam de fora).
      const { data: pedidos } = await fin().from('pedidos_pagamento')
        .select('id, status, inter_codigo_solicitacao, inter_credencial_id, beneficiario_nome')
        .eq('bar_id', barId)
        .in('status', ['aguardando_socio', 'agendado'])
        .not('inter_codigo_solicitacao', 'is', null)
        .order('updated_at', { ascending: true })
        .limit(limite);
      if (!pedidos?.length) { res.aviso = 'nada em aberto'; resultados.push(res); continue; }

      let token = await getInterAccessToken(clientId, clientSecret, 'pagamento-pix.read', mtls || undefined);
      let tokenLimpo = false;

      for (const ped of pedidos) {
        const codigo = String(ped.inter_codigo_solicitacao);
        let consulta = await consultarPixInter({ token, contaCorrente, codigo, mtlsCredentials: mtls || undefined });
        // Retry de cert antigo (após rotação cert+key) — mesma proteção do boleto/pix.
        if (!consulta.success && !tokenLimpo && /not bound to a valid|recognized certificate/i.test(consulta.error || '')) {
          clearInterTokenCache();
          token = await getInterAccessToken(clientId, clientSecret, 'pagamento-pix.read', mtls || undefined);
          tokenLimpo = true;
          consulta = await consultarPixInter({ token, contaCorrente, codigo, mtlsCredentials: mtls || undefined });
        }
        res.consultados++;
        if (!consulta.success) { res.erros++; continue; }

        const statusRaw = consulta.status || '(sem status)';
        res.status_vistos[statusRaw] = (res.status_vistos[statusRaw] || 0) + 1;
        const alvo = mapStatusPixParaPedido(consulta.status);
        if (res.amostras.length < 8) res.amostras.push({ nome: ped.beneficiario_nome, de: ped.status, inter: statusRaw, alvo });
        if (!alvo) { res.sem_status++; continue; }
        if (!podeAplicar(ped.status, alvo)) continue;

        if (dry) { res.promovidos++; continue; }

        // Atualiza o pedido (advance-only) + rastreio + trilha.
        await fin().from('pedidos_pagamento').update({
          status: alvo,
          ...(alvo === 'pago' ? { pago_em: new Date().toISOString() } : {}),
          ...(alvo === 'erro_inter' ? { erro_mensagem: `Inter: ${statusRaw}` } : {}),
        }).eq('id', ped.id);
        await fin().from('pix_enviados').update({
          inter_status: statusRaw,
          ...(alvo === 'pago' ? { status: 'pago' } : alvo === 'agendado' ? { status: 'agendado' } : {}),
          last_webhook_at: new Date().toISOString(),
        }).eq('inter_codigo_solicitacao', codigo);
        await fin().from('pedidos_pagamento_comentarios').insert({
          pedido_id: ped.id, bar_id: barId, autor_id: null, autor_nome: 'Sistema',
          mensagem: MSG[alvo] || `Status atualizado pelo Inter: ${alvo} (${statusRaw}).`, tipo: 'sistema',
        });
        await fin().from('pedidos_pagamento_historico').insert({
          pedido_id: ped.id, bar_id: barId, autor_id: null, autor_nome: 'Inter (reconciliação PIX)',
          campo: 'status', valor_anterior: ped.status, valor_novo: alvo,
        });

        res.promovidos++;
        if (alvo === 'pago') res.pagos++;
        else if (alvo === 'agendado') res.agendados++;
        else if (alvo === 'reprovado') res.reprovados++;
        else if (alvo === 'cancelado') res.cancelados++;
      }
    } catch (e: any) {
      res.erro = e?.message || String(e);
    }
    resultados.push(res);
  }

  return NextResponse.json({ success: true, dry, resultados });
}
