RATE LIMITER - Documentação Técnica
====================================

ARQUIVOS:
---------
- rate-limiter.ts: Implementação core do rate limiter em memória
- rate-limiter-middleware.ts: Helper para aplicar rate limiting em API routes

COMO USAR:
----------
1. Importar o wrapper:
   import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limiter-middleware';

2. Aplicar na route:
   async function handleLogin(request: NextRequest) {
     // sua lógica aqui
   }
   
   export const POST = withRateLimit(handleLogin, RATE_LIMIT_PRESETS.AUTH);

PRESETS DISPONÍVEIS:
--------------------
- AUTH: 10 req/min (rotas de autenticação - previne brute force)
- AI: 20 req/min (rotas de IA/Agente - previne abuso)
- INTEGRATION: 30 req/min (rotas de integração como ContaHub)
- PUBLIC: 60 req/min (rotas públicas)
- ADMIN: 100 req/min (rotas administrativas)

ROTAS PROTEGIDAS:
-----------------
✅ /api/auth/login (AUTH)
✅ /api/auth/forgot-password (AUTH)
✅ /api/auth/refresh (AUTH)
✅ /api/agente/chat (AI)
✅ /api/agente/* (AI)
✅ /api/contahub/sync-manual (INTEGRATION)
✅ /api/contahub/stockout-sync (INTEGRATION)

RESPOSTA HTTP 429:
------------------
{
  "error": "Rate limit exceeded",
  "message": "Muitas requisições. Tente novamente em alguns instantes.",
  "retryAfter": 45
}

Headers:
- Retry-After: segundos até reset
- X-RateLimit-Limit: limite máximo
- X-RateLimit-Remaining: requisições restantes
- X-RateLimit-Reset: timestamp do reset (Unix)

LIMITAÇÕES:
-----------
- Rate limiter em MEMÓRIA (funciona para instância única)
- Para produção com múltiplas instâncias, migrar para Redis/Upstash
- Identificação por IP (x-forwarded-for > x-real-ip > fallback)

PRÓXIMOS PASSOS:
----------------
- [ ] Migrar para Redis/Upstash em produção
- [ ] Adicionar rate limiting por usuário (além de IP)
- [ ] Dashboard de monitoramento de rate limits
- [ ] Alertas para IPs com muitos bloqueios
