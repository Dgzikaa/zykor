import { NextResponse } from 'next/server';

/**
 * Trava das rotas /api/emails/*.
 *
 * Essas rotas estão no PREFIXO_ABERTO da allowlist (api-open-routes.ts) porque são chamadas
 * servidor-a-servidor por outras rotas — `fetch(baseUrl + '/api/emails/...')` não carrega
 * cookie, então exigir sessão as quebraria. Só que "sem sessão" virou "sem nada": elas montam
 * o e-mail inteiro a partir do body (destinatário, nome, link, senha temporária) e disparam
 * pelo domínio do Zykor. Aberto assim, qualquer um na internet mandava e-mail com a nossa cara
 * pra qualquer endereço — phishing com remetente legítimo, além de queimar a reputação do domínio.
 *
 * Então a autenticação delas é o CRON_SECRET (mesmo segredo interno que os crons do
 * vercel.json já usam). Quem chama tem que mandar `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Falha FECHADA de propósito: sem CRON_SECRET configurado ninguém envia. Um e-mail que
 * não sai aparece em log e alguém conserta; um relay aberto não aparece em lugar nenhum.
 *
 * NÃO usar essas rotas a partir de tela. Pra enviar e-mail no fluxo de uma rota de API,
 * chame a lib direto (ex.: `enviarEmailBoasVindas` de @/lib/emails/user-welcome), que é o
 * que /api/configuracoes/usuarios faz — sem HTTP no meio.
 */
export function negarSeNaoInterno(request: Request): NextResponse | null {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    console.error('[emails] CRON_SECRET não configurada — envio bloqueado');
    return NextResponse.json(
      { error: 'Serviço de email não configurado' },
      { status: 503 },
    );
  }
  if (request.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

/** Header que as chamadas internas devem mandar. Use junto com Content-Type. */
export function headersInternos(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.CRON_SECRET || ''}`,
  };
}
