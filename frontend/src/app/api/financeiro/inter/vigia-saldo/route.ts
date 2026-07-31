import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { getInterAccessToken, clearInterTokenCache } from '@/lib/inter/getAccessToken';
import { consultarSaldoInter } from '@/lib/inter/saldo';
import { resolveInterCredential } from '@/lib/inter/resolveCredential';
import { authenticateUser, permissionErrorResponse } from '@/middleware/auth';
import { podeFerramentaFinanceira, FERRAMENTA_FINANCEIRA } from '@/lib/auth/financeiro-guard';
import { dispatchNotification } from '@/lib/notifications/dispatch';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createServiceRoleClient();
const fin = () => (supabase.schema('financial' as any) as any);

/**
 * VIGIA DE SALDO — avisa ANTES de o pagamento agendado falhar por falta de dinheiro.
 *
 * Em 31/07/2026, às 06:04, o Inter processou a fila de PIX agendados do Ordinário e recusou 30
 * pagamentos (R$ 8.206,29) com "Saldo Insuficiente." (60168) — entre eles os 4 cachês do show
 * daquela mesma noite. O Zykor tinha feito tudo certo (PIX emitido, sócio aprovou, agendado);
 * o que faltou foi saldo na conta na hora em que o banco executou. Ninguém foi avisado: o erro
 * só aparecia pra quem abrisse a tela de pedidos.
 *
 * Aqui a conta é feita ANTES: soma o que está agendado pra sair até a data-alvo e compara com o
 * saldo disponível no Inter. Se falta, avisa o financeiro enquanto ainda dá tempo de aportar.
 * Rodando na véspera à tarde, a diferença entre "avisado" e "recusado pelo banco" é uma
 * transferência.
 *
 * Auth: Bearer CRON_SECRET (cron) OU usuário financeiro (conferência manual, só o próprio bar).
 * Query: ?dias=N (janela à frente, default 1 = até amanhã), ?bar_id=N (manual).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const isCron = !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const sp = new URL(request.url).searchParams;
  const dias = Math.min(Math.max(Number(sp.get('dias')) || 1, 0), 30);

  let baresAlvo: number[] = [];
  if (isCron) {
    const { data } = await supabase.from('api_credentials').select('bar_id')
      .in('sistema', ['inter', 'banco_inter']).eq('ativo', true);
    baresAlvo = Array.from(new Set((data || []).map((r: any) => Number(r.bar_id)).filter(Boolean)));
  } else {
    const user = await authenticateUser(request);
    if (!user || !podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.agendamentos, 'ver')) {
      return permissionErrorResponse('Sem permissão');
    }
    const barParam = Number(sp.get('bar_id'));
    baresAlvo = Number.isFinite(barParam) && barParam > 0 ? [barParam] : user.bar_id ? [user.bar_id] : [];
  }
  if (!baresAlvo.length) return NextResponse.json({ success: true, aviso: 'Nenhum bar com Inter ativo', resultados: [] });

  // Janela em BRT: o "amanhã" do financeiro, não o do UTC.
  const hojeBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const limite = new Date(hojeBRT);
  limite.setUTCDate(limite.getUTCDate() + dias);
  const ateISO = limite.toISOString().slice(0, 10);

  const resultados: any[] = [];

  for (const barId of baresAlvo) {
    const res: any = { bar_id: barId, ate: ateISO };
    try {
      // O que o banco vai tentar executar: PIX agendados com data DENTRO da janela (de hoje até
      // a data-alvo). O passado fica de fora de propósito: pix_enviados.status só muda quando
      // chega webhook, e sobraram 414 registros 'agendado' do Ordinário desde maio/2026 que já
      // foram pagos ou morreram — somá-los daria R$ 643 mil de dívida imaginária e o alerta
      // dispararia todo santo dia, que é a maneira mais rápida de ensinar o time a ignorá-lo.
      const hojeISO = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data: agendados } = await fin()
        .from('pix_enviados')
        .select('valor, data_pagamento')
        .eq('bar_id', barId)
        .eq('status', 'agendado')
        .gte('data_pagamento', hojeISO)
        .lte('data_pagamento', ateISO);
      const total = (agendados || []).reduce((s: number, p: any) => s + Number(p.valor || 0), 0);
      res.agendados = (agendados || []).length;
      res.total_a_sair = Math.round(total * 100) / 100;

      if (!agendados?.length) { res.aviso = 'nada agendado na janela'; resultados.push(res); continue; }

      const { data: cred } = await supabase.from('api_credentials').select('*').eq('bar_id', barId)
        .in('sistema', ['inter', 'banco_inter']).eq('ativo', true).order('id', { ascending: true }).limit(1);
      if (!cred?.[0]) { res.erro = 'sem credencial Inter'; resultados.push(res); continue; }
      const { clientId, clientSecret, contaCorrente, mtls } = await resolveInterCredential(cred[0]);
      if (!clientId || !clientSecret || !contaCorrente) { res.erro = 'credencial incompleta'; resultados.push(res); continue; }

      let token = await getInterAccessToken(clientId, clientSecret, 'extrato.read', mtls || undefined);
      let saldoResp = await consultarSaldoInter({ token, contaCorrente, mtlsCredentials: mtls || undefined });
      // Mesma proteção do pagamento: cert rotacionado invalida o token em cache.
      if (!saldoResp.success && /not bound to a valid|recognized certificate/i.test(saldoResp.error || '')) {
        clearInterTokenCache();
        token = await getInterAccessToken(clientId, clientSecret, 'extrato.read', mtls || undefined);
        saldoResp = await consultarSaldoInter({ token, contaCorrente, mtlsCredentials: mtls || undefined });
      }
      if (!saldoResp.success) { res.erro = `saldo: ${saldoResp.error}`; resultados.push(res); continue; }

      const saldo = Number(saldoResp.saldo || 0);
      const falta = Math.round((total - saldo) * 100) / 100;
      res.saldo = saldo;
      res.falta = falta > 0 ? falta : 0;
      res.alerta = falta > 0;

      if (falta > 0) {
        const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        await dispatchNotification({
          barId,
          eventKey: 'saldo_agenda_insuficiente',
          titulo: 'Saldo não cobre os pagamentos agendados',
          mensagem:
            `${agendados.length} pagamento(s) somando ${brl(total)} vão sair até ${ateISO.split('-').reverse().join('/')}, ` +
            `e a conta do Inter tem ${brl(saldo)}. Faltam ${brl(falta)} — sem aporte, o banco recusa por saldo insuficiente.`,
          url: '/financeiro/pedidos-pagamento',
          // Canais explícitos: sem regra cadastrada o dispatcher só faria in_app, e um aviso que
          // depende de alguém abrir o sino não serve pra um prazo que vence de madrugada.
          canais: ['in_app', 'push'],
          destinatarios: { roles: ['financeiro', 'admin'] },
          dados: { total, saldo, falta, ate: ateISO },
        }).catch((e) => console.error('[VIGIA-SALDO] Falha ao notificar:', e));

        // Discord também: o financeiro nem sempre está com o Zykor aberto às 17h. Usa a função
        // SIMPLES de propósito — a _dedup dispara push pro bar INTEIRO, e o push certo (só
        // financeiro/admin) já saiu no dispatchNotification acima.
        await supabase.rpc('enviar_alerta_discord_sistema', {
          p_titulo: '💸 Saldo não cobre os pagamentos agendados',
          p_mensagem:
            `**Bar ${barId}** — até ${ateISO.split('-').reverse().join('/')}:\n` +
            `• A sair: **${brl(total)}** (${agendados.length} pagamentos)\n` +
            `• Saldo Inter: **${brl(saldo)}**\n` +
            `• Falta: **${brl(falta)}**\n\n` +
            'Sem aporte, o Inter recusa na madrugada com "Saldo Insuficiente" e os pagamentos voltam pra fila de erro.',
          p_cor: 16729156,
          p_bar_id: barId,
          p_tipo: 'alertas_criticos',
        }).then(
          ({ error }: any) => { if (error) console.error('[VIGIA-SALDO] Discord:', error.message); },
          () => { /* best-effort: alerta no Discord nunca derruba o vigia */ },
        );
      }
    } catch (e: any) {
      res.erro = e?.message || String(e);
    }
    resultados.push(res);
  }

  return NextResponse.json({ success: true, ate: ateISO, resultados });
}
