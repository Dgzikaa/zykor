// FONTE ÚNICA das rotas /api que NÃO exigem sessão de usuário.
// A trava central (middleware.ts) exige sessão em TODO /api, EXCETO o que estiver aqui.
// Organizado por motivo. Ao criar uma rota pública/webhook/cron nova, adicionar aqui — senão
// ela passa a responder 401 pra quem chamar (e cron/webhook quebra silenciosamente).
//
// Match:
//  - PREFIXO_ABERTO: entrada terminada em '/' libera a subárvore inteira.
//  - EXATO_ABERTO: libera SÓ aquele pathname exato (evita liberar irmã perigosa —
//    ex.: .../webhook liberado NÃO deve liberar .../webhook/registrar, que é ação de admin).

const PREFIXO_ABERTO = [
  '/api/auth/', // login, logout, refresh, staff/login
  '/api/configuracoes/auth/', // login, logout, forgot-password, google, redefinir-senha
  '/api/emails/', // gatilhos de e-mail (transacional, server-side)
  '/api/portal/', // portal do funcionário por token
  '/api/webhooks/', // receivers externos (instagram, whatsapp-assistente)
];

const EXATO_ABERTO = new Set<string>([
  // --- infra ---
  '/api/health', // health check (monitor externo / uptime)
  '/api/version', // versão do app (checada em toda página, sem sessão garantida)

  // --- público / fluxo sem sessão ---
  // NOTA: /api/configuracoes/usuarios/redefinir-senha (reset ADMIN) REMOVIDO da allowlist
  // — era takeover anônimo (retornava senha temp p/ qualquer email). O 1º acesso usa
  // /api/configuracoes/auth/redefinir-senha (coberto pelo prefixo /api/configuracoes/auth/).
  '/api/nps', // submissão pública de NPS
  '/api/pesquisa-felicidade', // pesquisa pública

  // --- crons do Vercel (vercel.json) protegidos por CRON_SECRET; allowlist redundante
  //     ao bypass de CRON_SECRET no middleware, como cinto-e-suspensório ---
  '/api/configuracoes/desempenho/automacao-semanal',
  '/api/financeiro/stone/cron-diario',

  // --- webhooks (recebem chamada externa; validam assinatura/segredo próprio) ---
  '/api/financeiro/inter/webhook',
  '/api/financeiro/inter/webhook/pix',
  '/api/stone/conciliacao/pix-webhook',
  '/api/falae/webhook',
  '/api/configuracoes/whatsapp/webhook',
  '/api/configuracoes/inter/webhook-inter-banking',
  '/api/integracoes/instagram/data-deletion',
  '/api/integracoes/instagram/deauthorize',
  '/api/discord/commands',
  '/api/financeiro/contaazul/oauth/callback', // retorno OAuth externo (valida `state` próprio; cookie SameSite pode não vir no redirect cross-site)

  // --- cron / sync (pg_cron + Vercel cron; chegam SEM sessão de usuário) ---
  // TODO(seguranca): trocar "aberto" por "exige segredo de cron" (header) — hoje mantido
  // aberto pra não quebrar pipeline; ver project_data_freshness_watchdog.
  '/api/cmo-semanal/buscar-automatico',
  '/api/cmv-mensal/sync-sheets',
  '/api/cmv-semanal/buscar-cma',
  '/api/cmv-semanal/buscar-dados-automaticos',
  '/api/cmv-semanal/recalcular-auto',
  '/api/cmv-semanal/recalcular-todos',
  '/api/cmv-semanal/sync-retroativo',
  '/api/cmv-semanal/sync-sheets',
  '/api/concorrencia/monitorar',
  // '/api/configuracoes/contahub/setup-pgcron' REMOVIDO — vazava SERVICE_ROLE_KEY no corpo
  // da resposta a QUALQUER anônimo (compromisso total do banco). Não é chamado pelo app.
  '/api/configuracoes/contahub/setup-resync-semanal',
  '/api/configuracoes/cron/setup',
  '/api/configuracoes/desempenho/recalcular-semana',
  '/api/configuracoes/desempenho/recalcular-todas',
  '/api/configuracoes/desempenho/recalculo-diario',
  '/api/contaazul/sync',
  '/api/contaazul/sync-manual',
  '/api/contahub/backfill-historico',
  '/api/contahub/coletar-lacunas',
  '/api/contahub/coletar-retroativo',
  '/api/contahub/preencher-direto',
  '/api/contahub/preencher-lacunas',
  '/api/contahub/preencher-sequencial',
  '/api/contahub/processar-automatico',
  '/api/contahub/processar-raw',
  '/api/contahub/resync-semanal-manual',
  '/api/contahub/stockout/recalcular',
  '/api/contahub/sync-diario',
  '/api/contahub/sync-retroativo',
  '/api/contahub/sync-retroativo-real',
  // '/api/eventos/popular-dados' REMOVIDO — write destrutivo anônimo (zerava c_art/c_prod
  // de todos os eventos do bar). Scaffolding morto, não chamado pelo app.
  '/api/eventos/sync-eventos',
  '/api/falae/sync',
  '/api/falae/sync-retroativo',
  '/api/ferramentas/contagem-estoque/anomalias',
  '/api/ferramentas/contagem-estoque/importar-mes',
  '/api/ferramentas/contagem-estoque/sync',
  '/api/ferramentas/contagem-estoque/sync-retroativo',
  '/api/ferramentas/horario-pico',
  '/api/ferramentas/produtos-por-hora',
  '/api/ferramentas/sync-prodporhora',
  '/api/financeiro/contaazul/saldos/snapshot',
  '/api/financeiro/contaazul/sync',
  '/api/gestao/eventos/fix-all',
  '/api/gestao/eventos/fix-names',
  '/api/gestao/eventos/fix-simple',
  '/api/gestao/eventos/sync-performance',
  '/api/gestao/eventos/update-performance',
  '/api/getin/sync-manual',
  '/api/getin/sync-retroativo',
  '/api/nps/sync',
  '/api/nps/sync-reservas',
  '/api/rh/importar-planilha',
  '/api/rh/importar-provisoes',
]);

/** true = rota /api liberada sem sessão (a trava central a ignora). */
export function isApiRotaAberta(pathname: string): boolean {
  if (PREFIXO_ABERTO.some(p => pathname.startsWith(p))) return true;
  return EXATO_ABERTO.has(pathname);
}
