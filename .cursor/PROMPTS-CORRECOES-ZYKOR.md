# PROMPTS DE CORREÇÃO E MELHORIA - ZYKOR

**Data**: 04/04/2026
**Status**: 🔴 EXECUTAR EM ORDEM DE PRIORIDADE
**Gerado por**: Análise completa do sistema (frontend, backend, banco, docs)

> Execute cada prompt em um chat separado no Cursor.
> Siga a ordem: P0 (crítico) → P1 (alto) → P2 (médio) → P3 (melhoria).
> Após cada prompt, faça commit com a mensagem sugerida.

---

## 🔴 P0 - CRÍTICO (Segurança)

---

### PROMPT P0.1 - Reabilitar JWT nas Edge Functions

```
Leia `.cursor/zykor-context.md` e `.cursor/REGRAS-DE-NEGOCIO-COMPLETAS.md` para contexto.

PROBLEMA: O arquivo `backend/supabase/functions/deno.json` tem `"verify_jwt": false`, o que significa que QUALQUER pessoa com a URL da Edge Function pode chamá-la sem autenticação. Isso é uma falha crítica de segurança.

TAREFA:
1. Abra `backend/supabase/functions/deno.json`
2. Mude `"verify_jwt": false` para `"verify_jwt": true`
3. Identifique TODAS as Edge Functions que são chamadas por cron jobs do Supabase (via pg_cron/pg_net). Essas funções precisam continuar acessíveis sem JWT porque o pg_cron chama via HTTP interno. Para essas, crie um mecanismo de autenticação alternativo:
   - Adicione um header customizado `x-cron-secret` com um valor que será uma env var `CRON_SECRET`
   - No início de cada função chamada por cron, valide: ou o JWT é válido OU o `x-cron-secret` bate com a env var
4. Funções chamadas por cron (baseado no mapeamento):
   - `agente-dispatcher`
   - `alertas-dispatcher`
   - `contahub-sync-automatico` (ou `contahub-sync`)
   - `contahub-stockout-sync`
   - `google-sheets-sync`
   - `google-reviews-apify-sync`
   - `checklist-auto-scheduler`
   - `recalcular-desempenho-v2` (ou `recalcular-desempenho-auto`)
   - `cmv-semanal-auto`
   - `nibo-sync`
   - `getin-sync-continuous`
   - `sync-dispatcher`
   - `integracao-dispatcher`
   - `discord-dispatcher`
   - `webhook-dispatcher`
   - `unified-dispatcher`
   - `cron-watchdog`
5. Funções chamadas via webhook externo (Apify, Inter, Umbler) devem validar seus próprios secrets nos headers
6. Crie um módulo compartilhado `_shared/auth-guard.ts` com:
   ```typescript
   export function validateCronOrJWT(req: Request): boolean {
     const cronSecret = req.headers.get('x-cron-secret');
     const envSecret = Deno.env.get('CRON_SECRET');
     if (cronSecret && envSecret && cronSecret === envSecret) return true;
     // Se não é cron, o JWT já foi validado pelo Supabase (verify_jwt: true)
     return true;
   }
   ```
7. Atualize as chamadas SQL dos cron jobs para incluir o header `x-cron-secret`. Exemplo:
   ```sql
   SELECT net.http_post(
     url := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/nome-funcao',
     headers := jsonb_build_object(
       'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
       'Content-Type', 'application/json',
       'x-cron-secret', current_setting('app.settings.cron_secret')
     ),
     body := '{}'::jsonb
   );
   ```

NÃO crie arquivos .md. Faça as alterações diretamente no código.

COMMIT: "security: reabilitar JWT nas Edge Functions e adicionar auth-guard para crons"
```

---

### PROMPT P0.2 - Remover Credenciais Hardcoded do Frontend

```
Leia `.cursor/zykor-context.md` para contexto.

PROBLEMA: O arquivo `frontend/src/lib/supabase.ts` tem a URL e a anon key do Supabase hardcoded no código. Se o repositório for público (ou vazar), qualquer pessoa tem acesso.

TAREFA:
1. Abra `frontend/src/lib/supabase.ts`
2. Remova QUALQUER URL ou chave hardcoded
3. Use APENAS variáveis de ambiente:
   ```typescript
   const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
   const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

   if (!supabaseUrl || !supabaseAnonKey) {
     throw new Error('Variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórias');
   }
   ```
4. Verifique se o `.env.local` do frontend já tem essas variáveis. Se não, crie um `.env.example` (sem valores reais) com todas as env vars necessárias
5. Garanta que `.env.local` está no `.gitignore`
6. Faça o mesmo para `frontend/src/lib/supabase-admin.ts` se houver service_role_key hardcoded
7. Busque por QUALQUER outro arquivo no frontend que tenha URLs ou chaves hardcoded:
   - Procure por `uqtgsvujwcbymjmvkjhy` (project ID do Supabase)
   - Procure por `eyJ` (início de JWTs/chaves base64)
   - Procure por `sb-` (prefixo de chaves Supabase)
8. Substitua TODAS as ocorrências por variáveis de ambiente

NÃO crie arquivos .md.

COMMIT: "security: remover credenciais hardcoded e usar variáveis de ambiente"
```

---

### PROMPT P0.3 - Restringir CORS nas Edge Functions

```
Leia `.cursor/zykor-context.md` para contexto.

PROBLEMA: Todas as Edge Functions usam `Access-Control-Allow-Origin: '*'`, permitindo que qualquer site chame as APIs. Isso facilita ataques CSRF e abuso.

TAREFA:
1. Abra `backend/supabase/functions/_shared/cors.ts`
2. Substitua o CORS aberto por uma lista de origens permitidas:
   ```typescript
   const ALLOWED_ORIGINS = [
     Deno.env.get('FRONTEND_URL') || 'https://zykor.vercel.app',
     'https://zykor.com.br', // se houver domínio customizado
     'http://localhost:3001', // dev
     'http://localhost:3000', // dev
   ];

   export function getCorsHeaders(req: Request): Record<string, string> {
     const origin = req.headers.get('Origin') || '';
     const isAllowed = ALLOWED_ORIGINS.some(allowed => origin === allowed);

     return {
       'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
       'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-selected-bar-id, x-user-id',
       'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
       'Access-Control-Max-Age': '86400',
     };
   }
   ```
3. Atualize TODAS as Edge Functions que importam de `cors.ts` para usar a nova função `getCorsHeaders(req)` em vez de um objeto estático
4. Para funções chamadas por webhooks externos (Apify, Inter, Umbler), mantenha origin flexível MAS valide o secret/token do webhook
5. Para funções chamadas por cron (pg_net), o origin será vazio — trate esse caso como permitido se tiver o `x-cron-secret` correto

NÃO crie arquivos .md.

COMMIT: "security: restringir CORS para origens permitidas nas Edge Functions"
```

---

### PROMPT P0.4 - Habilitar ESLint no Build

```
PROBLEMA: O `next.config.js` tem `eslint: { ignoreDuringBuilds: true }`, o que significa que erros de lint não bloqueiam o deploy. Bugs passam silenciosamente para produção.

TAREFA:
1. Abra `frontend/next.config.js` (ou `.mjs`/`.ts`)
2. Mude `ignoreDuringBuilds: true` para `ignoreDuringBuilds: false`
3. Rode `cd frontend && npx next lint` para ver todos os erros atuais
4. Corrija APENAS os erros (não warnings) que impedem o build:
   - `@typescript-eslint/no-unused-vars` → remova variáveis não usadas
   - `react-hooks/exhaustive-deps` → adicione dependências faltantes ou ignore com comentário justificado
   - `@next/next/no-img-element` → troque `<img>` por `<Image>` do Next.js
   - `no-explicit-any` → se houver muitos, mantenha como warning por enquanto
5. Para warnings que não são urgentes, adicione regras no `.eslintrc.json` para classificá-los como "warn" em vez de "error":
   ```json
   {
     "rules": {
       "@typescript-eslint/no-explicit-any": "warn",
       "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
     }
   }
   ```
6. Garanta que o build passa com `npm run build` após as correções

NÃO crie arquivos .md.

COMMIT: "quality: habilitar ESLint no build e corrigir erros críticos"
```

---

## 🟠 P1 - ALTO IMPACTO (Confiabilidade)

---

### PROMPT P1.1 - Escalonar Cron Jobs e Remover Fantasmas

```
Leia `.cursor/MAPEAMENTO-COMPLETO-ARQUITETURA-ATUAL.md` para contexto.

PROBLEMA 1: Às 11h BRT, 4 jobs pesados rodam simultaneamente causando race conditions:
- desempenho-auto-diario
- cmv-semanal-auto-ambos
- contahub-update-eventos-ambos
- eventos_cache_refresh_mes_atual

PROBLEMA 2: Os cron jobs "contahub-processor-diario-ordinario" e "contahub-processor-diario-deboche" chamam uma Edge Function `contahub-processor` que NÃO EXISTE mais.

PROBLEMA 3: `processar_alertas_discord` roda a cada 30 minutos — excessivo.

TAREFA:
1. Crie uma migration SQL no Supabase para reorganizar os horários dos cron jobs:

   CADEIA DE DADOS (respeitar dependências):
   - 10:00 → contahub-sync (busca dados do dia anterior)
   - 10:30 → contahub-update-eventos-ambos (atualiza eventos_base com dados do ContaHub)
   - 11:00 → auto-recalculo-eventos-pos-contahub (recalcula eventos pendentes)
   - 11:30 → desempenho-auto-diario (calcula desempenho semanal)
   - 12:00 → cmv-semanal-auto-ambos (calcula CMV)
   - 12:30 → eventos_cache_refresh_mes_atual (refresh cache)

2. REMOVA os cron jobs que chamam funções inexistentes:
   ```sql
   SELECT cron.unschedule('contahub-processor-diario-ordinario');
   SELECT cron.unschedule('contahub-processor-diario-deboche');
   ```

3. Reduza a frequência do `processar_alertas_discord` de 30min para 2h:
   ```sql
   SELECT cron.unschedule('processar_alertas_discord');
   SELECT cron.schedule('processar_alertas_discord', '0 */2 * * *', ...);
   ```

4. Reduza `getin-sync-continuo` de 2h para 4h (ou 3x/dia: 10h, 16h, 22h)

5. Crie o arquivo de migration em `database/migrations/` seguindo o padrão existente

NÃO crie arquivos .md.

COMMIT: "fix: escalonar cron jobs para evitar race conditions e remover jobs fantasma"
```

---

### PROMPT P1.2 - Eliminar Edge Functions Duplicadas

```
Leia `.cursor/MAPEAMENTO-COMPLETO-ARQUITETURA-ATUAL.md` para contexto.

PROBLEMA: Existem Edge Functions que parecem duplicadas ou obsoletas:
- `contahub-sync` vs `contahub-sync-automatico` — parecem fazer a mesma coisa
- `recalcular-desempenho-auto` vs `recalcular-desempenho-v2` — qual é o ativo?
- `relatorio-pdf` — marcado como "NÃO USADO"

TAREFA:
1. Compare `backend/supabase/functions/contahub-sync/index.ts` com `backend/supabase/functions/contahub-sync-automatico/index.ts`:
   - Identifique qual é chamado pelos cron jobs ativos
   - Se um é obsoleto, mova para uma pasta `backend/supabase/functions/_archived/`
   - Atualize qualquer referência ao nome antigo

2. Compare `recalcular-desempenho-auto` com `recalcular-desempenho-v2`:
   - Identifique qual é chamado pelo cron `desempenho-auto-diario`
   - O v2 deveria substituir o auto? Se sim, atualize o cron para apontar pro v2 e archive o auto
   - Se o v2 ainda é experimental (tem flag `ENABLE_V2_WRITE`), documente isso em um comentário no topo do index.ts

3. Para `relatorio-pdf`: se não é usado por nenhum cron nem chamado por nenhuma rota do frontend, mova para `_archived/`

4. Busque por OUTRAS funções potencialmente duplicadas comparando nomes similares na pasta `backend/supabase/functions/`

5. Após mover para _archived, atualize o `.gitignore` se necessário para NÃO ignorar a pasta _archived (queremos manter o histórico)

NÃO crie arquivos .md.

COMMIT: "refactor: consolidar Edge Functions duplicadas e arquivar obsoletas"
```

---

### PROMPT P1.3 - Implementar Soft Delete no ContaHub Processor

```
Leia `.cursor/REGRAS-DE-NEGOCIO-COMPLETAS.md` para contexto.

PROBLEMA: O `contahub-processor` (ou função equivalente de processamento) faz DELETE de todos os registros do dia e depois INSERT novamente. Se algo der errado no meio, dados são perdidos sem possibilidade de recuperação.

TAREFA:
1. Localize a função que processa dados do ContaHub e faz delete+insert. Deve estar em uma dessas:
   - `backend/supabase/functions/contahub-sync-automatico/index.ts`
   - `backend/supabase/functions/contahub-processor/index.ts`
   - Ou em uma função SQL chamada pelo cron `contahub-update-eventos-ambos`

2. Substitua o padrão DELETE + INSERT por UPSERT:
   ```typescript
   // ❌ ANTES (perigoso):
   await supabase.from('contahub_analitico').delete().eq('bar_id', barId).eq('trn_dtgerencial', dataDate);
   await supabase.from('contahub_analitico').insert(novosRegistros);

   // ✅ DEPOIS (seguro):
   await supabase.from('contahub_analitico').upsert(novosRegistros, {
     onConflict: 'bar_id,trn_dtgerencial,cod_prod,loc_desc',
     ignoreDuplicates: false
   });
   ```

3. Se a tabela `contahub_analitico` não tem uma constraint UNIQUE adequada para upsert, crie uma migration:
   ```sql
   ALTER TABLE contahub_analitico
   ADD CONSTRAINT contahub_analitico_unique
   UNIQUE (bar_id, trn_dtgerencial, cod_prod, loc_desc, hora);
   ```

4. Repita para TODAS as tabelas ContaHub que usam delete+insert:
   - `contahub_pagamentos`
   - `contahub_tempo`
   - `contahub_fatporhora`
   - `contahub_periodo`
   - `contahub_cancelamentos`

5. Se o upsert não for viável (por causa de registros que precisam ser removidos quando não vêm mais da API), use uma transação:
   ```typescript
   // Dentro de uma RPC:
   BEGIN;
   DELETE FROM contahub_analitico WHERE bar_id = $1 AND trn_dtgerencial = $2;
   INSERT INTO contahub_analitico VALUES (...);
   COMMIT;
   ```
   E crie uma função SQL `rpc` que encapsule isso numa transação atômica.

NÃO crie arquivos .md.

COMMIT: "fix: substituir delete+insert por upsert/transação no processamento ContaHub"
```

---

### PROMPT P1.4 - Implementar Retry com Backoff

```
PROBLEMA: Quando uma operação de sync falha (Google Sheets, ContaHub, NIBO), o erro é logado mas nunca reprocessado. Falhas intermitentes (timeout, rate limit) viram dados faltantes.

TAREFA:
1. Crie um módulo compartilhado `backend/supabase/functions/_shared/retry.ts`:
   ```typescript
   export async function withRetry<T>(
     fn: () => Promise<T>,
     options: {
       maxRetries?: number;
       baseDelayMs?: number;
       maxDelayMs?: number;
       retryOn?: (error: any) => boolean;
     } = {}
   ): Promise<T> {
     const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 30000, retryOn } = options;

     for (let attempt = 0; attempt <= maxRetries; attempt++) {
       try {
         return await fn();
       } catch (error) {
         if (attempt === maxRetries) throw error;
         if (retryOn && !retryOn(error)) throw error;

         const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
         const jitter = delay * 0.1 * Math.random();
         await new Promise(r => setTimeout(r, delay + jitter));
       }
     }
     throw new Error('Unreachable');
   }
   ```

2. Aplique o `withRetry` nos pontos críticos:
   - `contahub-sync-automatico`: chamadas à API do ContaHub (login e fetch de dados)
   - `google-sheets-sync`: chamadas ao Google Drive/Sheets API
   - `nibo-sync`: chamadas à API do NIBO
   - `google-reviews-apify-sync`: chamadas ao Apify

3. Use `retryOn` para filtrar erros retriáveis:
   ```typescript
   const isRetriable = (error: any) => {
     const status = error?.status || error?.statusCode;
     return status === 429 || status === 502 || status === 503 || status === 504 ||
            error?.message?.includes('timeout') || error?.message?.includes('ECONNRESET');
   };
   ```

4. NÃO faça retry em erros 400, 401, 403 (esses são erros de lógica, não transientes)

5. Integre com o heartbeat: se todas as retries falharem, o heartbeatError já vai notificar no Discord

NÃO crie arquivos .md.

COMMIT: "feat: implementar retry com exponential backoff para integrações externas"
```

---

### PROMPT P1.5 - Implementar Advisory Locks para Evitar Duplicação

```
PROBLEMA: Múltiplos cron jobs podem rodar a mesma operação simultaneamente (ex: dois recálculos de desempenho, dois syncs do ContaHub). Sem locking, isso causa dados duplicados ou corrompidos.

TAREFA:
1. Crie uma função SQL para advisory lock:
   ```sql
   CREATE OR REPLACE FUNCTION acquire_job_lock(job_name TEXT, timeout_minutes INT DEFAULT 30)
   RETURNS BOOLEAN AS $$
   DECLARE
     lock_id BIGINT;
     existing_lock RECORD;
   BEGIN
     -- Gera um ID numérico consistente a partir do nome do job
     lock_id := hashtext(job_name);

     -- Verifica se já tem um lock ativo (proteção contra locks órfãos)
     SELECT * INTO existing_lock FROM cron_heartbeats
     WHERE job_name = acquire_job_lock.job_name
     AND status = 'running'
     AND started_at > NOW() - (timeout_minutes || ' minutes')::INTERVAL;

     IF FOUND THEN
       RETURN FALSE; -- Já tem execução em andamento
     END IF;

     -- Tenta adquirir advisory lock (não bloqueante)
     RETURN pg_try_advisory_lock(lock_id);
   END;
   $$ LANGUAGE plpgsql;

   CREATE OR REPLACE FUNCTION release_job_lock(job_name TEXT)
   RETURNS VOID AS $$
   BEGIN
     PERFORM pg_advisory_unlock(hashtext(job_name));
   END;
   $$ LANGUAGE plpgsql;
   ```

2. No módulo `_shared/heartbeat.ts`, integre o lock:
   - No `heartbeatStart`: chame `acquire_job_lock` via RPC. Se retornar false, aborte a execução graciosamente
   - No `heartbeatEnd`: chame `release_job_lock` via RPC

3. Aplique nos jobs mais críticos:
   - `recalcular-desempenho-v2`
   - `contahub-sync-automatico`
   - `cmv-semanal-auto`
   - `sync-dispatcher` (ação eventos)

4. Crie a migration SQL em `database/migrations/`

NÃO crie arquivos .md.

COMMIT: "feat: implementar advisory locks para evitar execuções simultâneas de jobs"
```

---

## 🟡 P2 - MÉDIO IMPACTO (Qualidade)

---

### PROMPT P2.1 - Unificar Estratégias de Autenticação no Frontend

```
Leia `.cursor/zykor-context.md` para contexto.

PROBLEMA: O frontend tem 3 estratégias de autenticação coexistindo sem hierarquia clara:
- Cookie `sgb_user` (legado)
- JWT via `auth_token`
- Header `x-user-id` / `x-selected-bar-id`
Isso gera inconsistências e falhas silenciosas de auth.

TAREFA:
1. Mapeie TODOS os pontos de autenticação no frontend:
   - `frontend/src/lib/auth-server.ts`
   - `frontend/src/lib/auth/server.ts`
   - `frontend/src/lib/auth/jwt.ts`
   - `frontend/src/lib/api-client.ts`
   - `frontend/src/middleware.ts`
   - `frontend/src/lib/cookies.ts`

2. Defina uma hierarquia única:
   ```
   Auth Flow:
   1. Login → gera JWT + salva em cookie httpOnly `auth_token`
   2. Middleware → valida cookie `auth_token` a cada request
   3. API Routes → extraem user do JWT via helper
   4. Client → envia `x-selected-bar-id` como header para multi-tenancy
   ```

3. Crie um helper unificado `frontend/src/lib/auth/get-user.ts`:
   ```typescript
   export async function getAuthenticatedUser(request: NextRequest) {
     const token = request.cookies.get('auth_token')?.value;
     if (!token) return null;

     try {
       const decoded = await validateToken(token);
       return {
         id: decoded.userId,
         barId: request.headers.get('x-selected-bar-id') || decoded.defaultBarId,
         role: decoded.role
       };
     } catch {
       return null;
     }
   }
   ```

4. Remova referências ao cookie legado `sgb_user` gradualmente — busque por `sgb_user` em todo o frontend e substitua pelo novo helper

5. Garanta que TODAS as API routes (380) que precisam de auth usem o mesmo helper. Foque nas rotas em `/api/` que fazem operações de escrita (POST, PUT, DELETE)

NÃO crie arquivos .md.

COMMIT: "refactor: unificar estratégia de autenticação no frontend"
```

---

### PROMPT P2.2 - Habilitar Strict Mode no TypeScript Gradualmente

```
PROBLEMA: O `tsconfig.json` tem `strict: false` e `noImplicitAny: false`. Isso permite que bugs de tipo passem despercebidos em 380+ API routes.

TAREFA:
1. NÃO ative `strict: true` de uma vez (vai quebrar tudo)
2. Ative flag por flag no `frontend/tsconfig.json`, começando pelas menos disruptivas:

   Fase 1 (agora):
   ```json
   {
     "compilerOptions": {
       "strictNullChecks": true,     // ← já está true
       "strictFunctionTypes": true,   // ← adicionar
       "strictBindCallApply": true,   // ← adicionar
       "noImplicitThis": true         // ← adicionar
     }
   }
   ```

3. Rode `npx tsc --noEmit` e corrija os erros que aparecerem
4. Os erros mais comuns serão:
   - `this` implícito em callbacks → use arrow functions
   - Tipos de função incompatíveis → ajuste as assinaturas
5. Após corrigir, faça o build: `npm run build`
6. Se o build passar, deixe `noImplicitAny` e `strictPropertyInitialization` para uma fase futura (anotar como TODO no tsconfig)

NÃO crie arquivos .md.

COMMIT: "quality: ativar flags de strict mode parcial no TypeScript"
```

---

### PROMPT P2.3 - Limpar Tabelas Vazias e Features Abandonadas

```
PROBLEMA: O banco tem 15+ tabelas com 0 registros que parecem features planejadas mas nunca implementadas. Isso polui o schema e confunde.

Tabelas com 0 registros:
- bares (a config real está em bares_config)
- bar_api_configs, bar_notification_configs, bar_stats
- semanas_referencia
- dre_manual, custos_mensais_diluidos
- marketing_mensal, crm_segmentacao
- notificacoes
- getin_units
- uploads
- pessoas_responsaveis, contratos_funcionario
- agente_scans, agente_insights, agente_metricas, agente_memoria_vetorial, agente_conversas, agente_feedbacks, agente_regras_dinamicas, agente_padroes_detectados, agente_ia_metricas
- insight_events, agent_insights_v2
- validacoes_cruzadas
- umbler_campanhas, umbler_campanha_destinatarios
- nibo_stakeholders, contaazul_pessoas

TAREFA:
1. NÃO delete nenhuma tabela. Em vez disso, crie um inventário:
2. Para cada tabela com 0 registros, verifique:
   a. Existe alguma API route no frontend que faz INSERT nela? (busque pelo nome da tabela nos arquivos do frontend)
   b. Existe alguma Edge Function que faz INSERT nela?
   c. Existe alguma função SQL/trigger que popula ela?
3. Classifique cada tabela como:
   - "ATIVO_SEM_DADOS" → existe código que usa, mas ainda não teve dados reais
   - "ABANDONADO" → nenhum código referencia esta tabela
   - "PLANEJADO" → existe código parcial/comentado
4. Para as tabelas "ABANDONADO", adicione um comentário SQL:
   ```sql
   COMMENT ON TABLE nome_tabela IS '[DEPRECATED] Tabela sem uso ativo desde 04/2026. Candidata para remoção.';
   ```
5. Para as tabelas de agentes V1 (agente_scans, agente_insights, etc.) — se o V2 (insight_events, agent_insights_v2) é o caminho novo, marque as V1 como deprecated

Crie uma migration SQL com os comentários.

NÃO crie arquivos .md (use comentários SQL).

COMMIT: "chore: auditar e marcar tabelas sem uso como deprecated"
```

---

### PROMPT P2.4 - Corrigir TODOs e Código Hardcoded

```
PROBLEMA: Existem TODOs espalhados pelo código que indicam features incompletas ou workarounds temporários que ficaram permanentes.

TAREFA:
1. Busque por TODO, FIXME, HACK, WORKAROUND, HARDCODED em todo o projeto (excluindo node_modules e .git):
   ```
   Procure em: backend/supabase/functions/**/*.ts
   Procure em: frontend/src/**/*.ts
   Procure em: frontend/src/**/*.tsx
   ```

2. Para cada TODO encontrado, classifique e resolva:

   a. `checklist-auto-scheduler` → "TODO: buscar nome do bar" (hardcoded 'Bar Principal')
      - Corrija: busque o nome do bar na tabela `bares_config` usando o `bar_id`

   b. `cmv-semanal-auto` → "TODO: Investigar performance e reabilitar"
      - Avalie o código comentado. Se é código antigo substituído pelo v2, remova. Se é funcionalidade faltante, abra um TODO mais descritivo

   c. Frontend TODOs de JWT no WhatsApp config (4 instâncias)
      - Se a auth unificada do prompt P2.1 já foi feita, resolva esses TODOs usando o helper unificado

3. Para TODOs que NÃO podem ser resolvidos agora, padronize o formato:
   ```typescript
   // TODO(rodrigo/2026-04): Descrição clara do que falta fazer
   // Contexto: Por que não foi feito agora
   // Issue: #123 (se houver)
   ```

4. Remova qualquer `console.log` de debug que tenha ficado (exceto em catch blocks de erro)

NÃO crie arquivos .md.

COMMIT: "fix: resolver TODOs críticos e padronizar pendências restantes"
```

---

### PROMPT P2.5 - Reduzir Sample Rate do Sentry e Otimizar Logging

```
PROBLEMA: O Sentry está configurado com tracing a 100% e replay a 10%, o que gera custo alto. Além disso, `removeConsole` está apenas removendo logs exceto 'error', mas o sistema tem um controle de logs via env var que pode conflitar.

TAREFA:
1. Abra `frontend/sentry.client.config.ts` (ou equivalente):
   - Mude `tracesSampleRate` de `1.0` para `0.1` (10%)
   - Mantenha `replaysOnErrorSampleRate` em `1.0` (100% dos erros)
   - Mude `replaysSessionSampleRate` de `0.1` para `0.01` (1%)

2. Abra `frontend/sentry.server.config.ts`:
   - Mude `tracesSampleRate` para `0.1`

3. Abra `frontend/instrumentation.ts` (se existir):
   - Verifique se não há duplicação de configuração

4. No `next.config.js`, confirme que `removeConsole` está configurado corretamente:
   ```javascript
   compiler: {
     removeConsole: process.env.NODE_ENV === 'production'
       ? { exclude: ['error', 'warn'] }
       : false
   }
   ```

5. Verifique `frontend/src/lib/logger.ts`:
   - Garanta que em produção, apenas logs de erro e warning vão para o Sentry
   - Logs de info/debug devem ser suprimidos

NÃO crie arquivos .md.

COMMIT: "perf: otimizar sample rate do Sentry e limpeza de logging"
```

---

## 🟢 P3 - MELHORIAS (Arquitetura)

---

### PROMPT P3.1 - Adicionar Validação de Env Vars nas Edge Functions

```
PROBLEMA: Edge Functions usam env vars sem validar se existem. Se uma var estiver faltando, a função crashea no meio da execução sem mensagem clara.

TAREFA:
1. Crie `backend/supabase/functions/_shared/env-validator.ts`:
   ```typescript
   export function requireEnv(name: string): string {
     const value = Deno.env.get(name);
     if (!value) {
       throw new Error(`[ENV] Variável de ambiente obrigatória não configurada: ${name}`);
     }
     return value;
   }

   export function requireJsonEnv(name: string): Record<string, unknown> {
     const raw = requireEnv(name);
     try {
       return JSON.parse(raw);
     } catch {
       throw new Error(`[ENV] Variável ${name} não é um JSON válido`);
     }
   }

   export function validateFunctionEnv(functionName: string, requiredVars: string[]): void {
     const missing = requiredVars.filter(v => !Deno.env.get(v));
     if (missing.length > 0) {
       throw new Error(
         `[${functionName}] Variáveis de ambiente faltando: ${missing.join(', ')}`
       );
     }
   }
   ```

2. Aplique no início de cada Edge Function principal:
   - `contahub-sync-automatico`: requer SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CONTAHUB_USER, CONTAHUB_PASS
   - `google-sheets-sync`: requer SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_SERVICE_ACCOUNT_KEY
   - `agente-dispatcher`: requer SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY
   - `discord-dispatcher`: requer SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
   - `nibo-sync`: requer SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

3. A validação deve rodar NO INÍCIO da função, antes de qualquer lógica de negócio
4. Se faltar env var, retorne HTTP 500 com mensagem clara (sem expor o valor esperado)

NÃO crie arquivos .md.

COMMIT: "feat: adicionar validação de variáveis de ambiente nas Edge Functions"
```

---

### PROMPT P3.2 - Adicionar Testes para Regras de Negócio Críticas

```
Leia `.cursor/REGRAS-DE-NEGOCIO-COMPLETAS.md` para contexto.

PROBLEMA: O projeto não tem NENHUM teste automatizado. As regras de negócio (cálculo de CMV, desempenho, stockout, atrasos) são complexas e específicas por bar, o que torna bugs difíceis de detectar.

TAREFA:
1. Configure Vitest no frontend:
   ```bash
   cd frontend
   npm install -D vitest @testing-library/react @testing-library/jest-dom
   ```

2. Crie `frontend/vitest.config.ts`:
   ```typescript
   import { defineConfig } from 'vitest/config';
   import path from 'path';

   export default defineConfig({
     test: {
       globals: true,
       environment: 'node',
     },
     resolve: {
       alias: {
         '@': path.resolve(__dirname, './src'),
       },
     },
   });
   ```

3. Adicione script no package.json: `"test": "vitest run"`, `"test:watch": "vitest"`

4. Crie testes para as regras de negócio mais críticas:

   a. `frontend/src/lib/__tests__/calculos-desempenho.test.ts`:
   - Teste que o cálculo de ticket médio = faturamento / clientes
   - Teste que % meta = faturamento / meta * 100
   - Teste com valores zero (divisão por zero)

   b. `frontend/src/lib/__tests__/regras-por-bar.test.ts`:
   - Teste que Ordinário (bar_id=3) usa t0_t3 para atrasos de bar
   - Teste que Deboche (bar_id=4) usa t0_t2 para atrasos de bar
   - Teste os limites: atrasinho > 5min (300s), atrasão > 10min (600s)
   - Teste limites cozinha: atrasinho > 15min (900s), atrasão > 20min (1200s)

   c. `frontend/src/lib/__tests__/stockout.test.ts`:
   - Teste que produtos [HH], [DD], [IN] são excluídos
   - Teste cálculo de % stockout

   d. `frontend/src/lib/__tests__/formatters.test.ts`:
   - Teste formatação de moeda (R$)
   - Teste formatação de porcentagem
   - Teste formatação de datas

5. Rode os testes: `npm test`

NÃO crie arquivos .md.

COMMIT: "test: adicionar testes para regras de negócio críticas"
```

---

### PROMPT P3.3 - Implementar Rate Limiting Real

```
PROBLEMA: O frontend tem um `security-monitor.ts` que MONITORA rate limiting mas não BLOQUEIA. Não existe rate limiter real nas API routes.

TAREFA:
1. Crie `frontend/src/lib/rate-limiter.ts`:
   ```typescript
   // Rate limiter em memória (funciona para instância única)
   // Para múltiplas instâncias, usar Redis/Upstash

   interface RateLimitEntry {
     count: number;
     resetAt: number;
   }

   const store = new Map<string, RateLimitEntry>();

   export function rateLimit(
     key: string,
     options: { maxRequests: number; windowMs: number }
   ): { success: boolean; remaining: number; resetAt: number } {
     const now = Date.now();
     const entry = store.get(key);

     if (!entry || now > entry.resetAt) {
       store.set(key, { count: 1, resetAt: now + options.windowMs });
       return { success: true, remaining: options.maxRequests - 1, resetAt: now + options.windowMs };
     }

     if (entry.count >= options.maxRequests) {
       return { success: false, remaining: 0, resetAt: entry.resetAt };
     }

     entry.count++;
     return { success: true, remaining: options.maxRequests - entry.count, resetAt: entry.resetAt };
   }

   // Limpar entradas expiradas a cada 5 minutos
   setInterval(() => {
     const now = Date.now();
     for (const [key, entry] of store.entries()) {
       if (now > entry.resetAt) store.delete(key);
     }
   }, 5 * 60 * 1000);
   ```

2. Aplique nas rotas mais sensíveis via middleware ou wrapper:
   - `/api/auth/*` → 10 requests/minuto por IP (previne brute force)
   - `/api/agente/*` → 20 requests/minuto por usuário (previne abuso de IA)
   - `/api/contahub/*` → 30 requests/minuto por usuário

3. Crie um helper para usar nas routes:
   ```typescript
   export function withRateLimit(
     handler: (req: NextRequest) => Promise<NextResponse>,
     options: { maxRequests: number; windowMs: number }
   ) {
     return async (req: NextRequest) => {
       const ip = req.headers.get('x-forwarded-for') || req.ip || 'unknown';
       const result = rateLimit(ip, options);

       if (!result.success) {
         return NextResponse.json(
           { error: 'Rate limit exceeded' },
           { status: 429, headers: { 'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)) } }
         );
       }

       return handler(req);
     };
   }
   ```

NÃO crie arquivos .md.

COMMIT: "feat: implementar rate limiting nas API routes sensíveis"
```

---

### PROMPT P3.4 - Adicionar Paginação nas Queries Grandes

```
PROBLEMA: Várias queries no backend e frontend buscam TODOS os registros sem limite. Com tabelas de 450k+ registros (contahub_analitico) e 850k (vendas_item), isso pode causar timeouts e uso excessivo de memória.

TAREFA:
1. Identifique as queries que fazem SELECT sem LIMIT em:
   - `backend/supabase/functions/_shared/agent-tools.ts` (ferramentas do agente IA)
   - `backend/supabase/functions/_shared/calculators/*.ts`
   - `frontend/src/app/api/*/route.ts` (API routes que buscam dados históricos)

2. Para queries de listagem, adicione paginação padrão:
   ```typescript
   const page = parseInt(searchParams.get('page') || '1');
   const pageSize = parseInt(searchParams.get('page_size') || '100');
   const offset = (page - 1) * pageSize;

   const { data, count } = await supabase
     .from('tabela')
     .select('*', { count: 'exact' })
     .eq('bar_id', barId)
     .range(offset, offset + pageSize - 1)
     .order('data', { ascending: false });

   return NextResponse.json({
     data,
     pagination: {
       page,
       page_size: pageSize,
       total: count,
       total_pages: Math.ceil((count || 0) / pageSize)
     }
   });
   ```

3. Para queries de agregação (usadas por calculators/agentes), NÃO pagine — mas adicione filtros de data obrigatórios:
   ```typescript
   // SEMPRE filtrar por período
   .gte('data', dataInicio)
   .lte('data', dataFim)
   ```

4. Limite máximo de pageSize em 500 para evitar abuso:
   ```typescript
   const pageSize = Math.min(parseInt(searchParams.get('page_size') || '100'), 500);
   ```

5. Nas ferramentas do agente IA (`agent-tools.ts`), garanta que consultas têm LIMIT:
   - `consultar_faturamento` → limite de 90 dias
   - `consultar_produtos_top` → LIMIT 20
   - `consultar_desempenho_semanal` → últimas 12 semanas max

NÃO crie arquivos .md.

COMMIT: "perf: adicionar paginação e limites nas queries grandes"
```

---

### PROMPT P3.5 - Melhorar Tratamento de Timezone

```
Leia `.cursor/REGRAS-DE-NEGOCIO-COMPLETAS.md` para contexto sobre timezones.

PROBLEMA: O timezone está hardcoded como `-0300` (BRT) em vários lugares. O Brasil NÃO tem horário de verão desde 2019, então BRT é sempre UTC-3, mas o código deveria ser mais robusto e centralizado.

TAREFA:
1. Verifique o módulo existente `backend/supabase/functions/_shared/timezone.ts` e `frontend/src/lib/timezone.ts`

2. Centralize a constante de timezone:
   ```typescript
   // _shared/timezone.ts
   export const TIMEZONE = 'America/Sao_Paulo';
   export const UTC_OFFSET = -3;

   export function toBRT(date: Date): Date {
     return new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }));
   }

   export function formatDateBRT(date: Date): string {
     return date.toLocaleDateString('pt-BR', { timeZone: TIMEZONE });
   }

   export function nowBRT(): Date {
     return toBRT(new Date());
   }

   export function todayBRT(): string {
     return nowBRT().toISOString().split('T')[0];
   }
   ```

3. Busque por todas as ocorrências hardcoded de:
   - `-0300` ou `-03:00`
   - `new Date().toLocaleString('pt-BR')` sem timezone
   - `getTimezoneOffset()`
   - Cálculos manuais de offset (`- 3 * 60 * 60 * 1000`)

4. Substitua por chamadas ao módulo centralizado

5. No `contahub-sync-automatico`, onde timestamps são gerados para a API do ContaHub, use:
   ```typescript
   import { todayBRT, TIMEZONE } from '../_shared/timezone.ts';
   ```

NÃO crie arquivos .md.

COMMIT: "refactor: centralizar e padronizar tratamento de timezone"
```

---

## ORDEM DE EXECUÇÃO RECOMENDADA

```
Semana 1 - Segurança (P0):
  → P0.1 (JWT) → P0.2 (credenciais) → P0.3 (CORS) → P0.4 (ESLint)

Semana 2 - Confiabilidade (P1):
  → P1.1 (cron jobs) → P1.2 (duplicatas) → P1.3 (soft delete) → P1.4 (retry) → P1.5 (locks)

Semana 3 - Qualidade (P2):
  → P2.1 (auth unificada) → P2.2 (TypeScript strict) → P2.3 (tabelas) → P2.4 (TODOs) → P2.5 (Sentry)

Semana 4 - Melhorias (P3):
  → P3.1 (env vars) → P3.2 (testes) → P3.3 (rate limit) → P3.4 (paginação) → P3.5 (timezone)
```
