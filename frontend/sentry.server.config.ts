// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring (FREE TIER: reduzir para economizar quota)
  tracesSampleRate: 0.1, // 10% das transações

  // Environment
  environment: process.env.NODE_ENV,

  // Server-side optimizations
  enableLogs: process.env.NODE_ENV === 'development',
  debug: process.env.NODE_ENV === 'development',
  
  // Tags adicionais
  initialScope: {
    tags: {
      component: "backend",
      version: process.env.NEXT_PUBLIC_APP_VERSION || "2.0.0",
      platform: "zykor"
    },
  },
});
