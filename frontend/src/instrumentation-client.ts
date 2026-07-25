// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // O Replay NAO entra aqui de proposito — ver o lazyLoad no fim do arquivo.
  integrations: [
    Sentry.browserTracingIntegration(),
  ],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 0.1, // 10% das transações (reduzido de 100%)
  
  // Enable logs to be sent to Sentry
  enableLogs: process.env.NODE_ENV === 'development',

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.01, // 1% das sessões (reduzido de 10%)

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0, // 100% dos erros (mantido)

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.NODE_ENV === 'development',
  
  // Environment
  environment: process.env.NODE_ENV,
  
  // Error Filtering
  beforeSend(event) {
    // Filter out known harmless errors
    if (event.exception) {
      const error = event.exception.values?.[0];
      if (error?.value?.includes('Non-Error promise rejection captured')) {
        return null;
      }
      if (error?.value?.includes('ResizeObserver loop limit exceeded')) {
        return null;
      }
    }
    return event;
  },
  
  // Tags adicionais
  initialScope: {
    tags: {
      component: "frontend",
      version: process.env.NEXT_PUBLIC_APP_VERSION || "2.0.0",
      platform: "zykor"
    },
  },
});

// Session Replay sob demanda.
//
// Medido no build de 25/07/2026: o chunk do Sentry pesava 171 kB dos 400 kB que TODA pagina
// carrega — 43% do custo fixo do app, e a maior fatia disso e' o Replay. Como so 1% das
// sessoes sao gravadas (replaysSessionSampleRate abaixo), 99% dos carregamentos baixavam
// esse codigo pra nunca usar.
//
// Com lazyLoadIntegration o Replay sai do bundle inicial e e' buscado depois do load. O que
// muda na pratica: a gravacao comeca alguns instantes apos a abertura da pagina, entao os
// primeiros segundos podem ficar de fora da sessao amostrada. Captura de ERRO continua
// valendo (replaysOnErrorSampleRate = 1.0) — o buffer do Replay cobre o retroativo do erro.
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const carregar = () =>
    Sentry.lazyLoadIntegration('replayIntegration')
      .then((replayIntegration) => {
        Sentry.addIntegration(replayIntegration({ maskAllText: false, blockAllMedia: false }));
      })
      .catch(() => { /* sem replay nao e' erro: o resto do Sentry segue funcionando */ });

  // espera o navegador ficar ocioso pra nao disputar banda com o carregamento da pagina
  if ('requestIdleCallback' in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(carregar);
  } else {
    setTimeout(carregar, 3000);
  }
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;