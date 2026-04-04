// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Add optional integrations for additional features
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
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

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;