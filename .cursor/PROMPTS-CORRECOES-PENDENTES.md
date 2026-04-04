# PROMPTS COMPLEMENTARES - CORREÇÕES PENDENTES

**Data**: 04/04/2026
**Status**: 🔴 EXECUTAR AGORA - São 4 correções que ficaram parciais nos 15 prompts anteriores
**Referência**: Validação feita sobre os 15 prompts de PROMPTS-CORRECOES-ZYKOR.md

> Execute cada prompt em um chat separado no Cursor.

---

## FIX-1 — Migrar 12 Edge Functions para CORS restrito (P0.3 pendente)

```
Leia `.cursor/zykor-context.md` para contexto.

PROBLEMA: O módulo `backend/supabase/functions/_shared/cors.ts` já foi atualizado com whitelist de origens (ALLOWED_ORIGINS + getCorsHeaders), porém 12 Edge Functions ainda têm `'Access-Control-Allow-Origin': '*'` hardcoded e NÃO usam o módulo atualizado.

LISTA EXATA DAS 12 FUNÇÕES QUE PRECISAM SER MIGRADAS:
1. backend/supabase/functions/checklist-auto-scheduler/index.ts
2. backend/supabase/functions/cmv-semanal-auto/index-full.ts
3. backend/supabase/functions/cmv-semanal-auto/index-minimal.ts
4. backend/supabase/functions/getin-sync-continuous/index.ts
5. backend/supabase/functions/google-reviews-apify-sync/index.ts
6. backend/supabase/functions/google-reviews-retroativo/index.ts
7. backend/supabase/functions/monitor-concorrencia/index.ts
8. backend/supabase/functions/relatorio-pdf/index.ts
9. backend/supabase/functions/sync-cmv-mensal/index.ts
10. backend/supabase/functions/sync-cmv-sheets/index.ts
11. backend/supabase/functions/sync-contagem-sheets/index.ts
12. backend/supabase/functions/umbler-sync-incremental/index.ts

TAREFA PARA CADA UMA DAS 12 FUNÇÕES:
1. Abra o arquivo index.ts da função
2. Procure por qualquer ocorrência de `'Access-Control-Allow-Origin': '*'` ou objetos de headers CORS hardcoded
3. Substitua por import do módulo compartilhado:
   ```typescript
   import { getCorsHeaders } from '../_shared/cors.ts';
   ```
4. No handler OPTIONS (preflight), use:
   ```typescript
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: getCorsHeaders(req) });
   }
   ```
5. Nas respostas normais, use:
   ```typescript
   return new Response(JSON.stringify(result), {
     headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
     status: 200
   });
   ```
6. Remova qualquer objeto `corsHeaders` local que tinha o `'*'`

TAMBÉM verifique `backend/supabase/functions/_shared/auth-guard.ts` — se tiver `'*'` nas respostas de fallback, substitua por getCorsHeaders.

IMPORTANTE: Algumas dessas funções são chamadas por cron (checklist-auto-scheduler, getin-sync-continuous, google-reviews-apify-sync). O módulo cors.ts já trata o caso de origin vazio para crons com x-cron-secret válido — então não precisa de tratamento especial.

VALIDAÇÃO: Após as alterações, faça uma busca global por `Allow-Origin.*\*` no diretório backend/supabase/functions/ e confirme que retorna ZERO resultados.

NÃO crie arquivos .md.

COMMIT: "security: migrar 12 Edge Functions restantes para CORS restrito via getCorsHeaders"
```

---

## FIX-2 — Arquivar relatorio-pdf (P1.2 pendente)

```
PROBLEMA: A Edge Function `relatorio-pdf` foi marcada como "NÃO USADO" no mapeamento da arquitetura, mas não foi movida para a pasta _archived durante o prompt P1.2.

TAREFA:
1. Primeiro, confirme que `relatorio-pdf` realmente não é usado:
   - Busque por `relatorio-pdf` em TODOS os cron jobs (migrations SQL)
   - Busque por `relatorio-pdf` em TODAS as API routes do frontend (frontend/src/app/api/)
   - Busque por `relatorio-pdf` em TODOS os dispatchers do backend
   - Se encontrar QUALQUER referência ativa, NÃO archive — apenas adicione um comentário no topo do index.ts explicando onde é usado

2. Se NENHUMA referência for encontrada:
   - Mova a pasta inteira `backend/supabase/functions/relatorio-pdf/` para `backend/supabase/functions/_archived/relatorio-pdf/`
   - Adicione um comentário no topo do index.ts:
     ```typescript
     // [ARCHIVED 2026-04-04] Função sem uso ativo. Mantida para referência histórica.
     // Último uso conhecido: nunca confirmado em produção.
     // Para reativar: mova de volta para backend/supabase/functions/
     ```

3. Verifique se existem OUTRAS funções candidatas a arquivamento que passaram despercebidas:
   - `monitor-concorrencia` — marcado como "POUCO USADO"
   - `atualizar-fichas-tecnicas` — marcado como "POUCO USADO"
   - Para essas, NÃO archive — apenas adicione um comentário no topo indicando baixo uso

NÃO crie arquivos .md.

COMMIT: "refactor: arquivar relatorio-pdf e documentar funções de baixo uso"
```

---

## FIX-3 — Substituir hard delete no contahub-stockout-sync (P1.3 pendente)

```
PROBLEMA: O arquivo `backend/supabase/functions/contahub-stockout-sync/index.ts` ainda faz DELETE + INSERT para processar dados de stockout. Especificamente na linha ~453-457:

```typescript
const { error: deleteError } = await supabase
  .from('contahub_stockout')
  .delete()
  .eq('bar_id', bar_id)
  .eq('data_consulta', data_date);
```

Isso é perigoso porque se o INSERT subsequente falhar, os dados do dia são perdidos.

TAREFA:
1. Abra `backend/supabase/functions/contahub-stockout-sync/index.ts`
2. Localize TODOS os pontos onde `.delete()` é usado nas tabelas:
   - `contahub_stockout`
   - `contahub_stockout_raw`
   - `contahub_stockout_processado`

3. Para cada caso, substitua por UPSERT:
   ```typescript
   // ❌ ANTES:
   await supabase.from('contahub_stockout').delete().eq('bar_id', bar_id).eq('data_consulta', data_date);
   await supabase.from('contahub_stockout').insert(registros);

   // ✅ DEPOIS:
   const { error } = await supabase.from('contahub_stockout').upsert(registros, {
     onConflict: 'bar_id,data_consulta,cod_prod',
     ignoreDuplicates: false
   });
   ```

4. Se a tabela `contahub_stockout` não tem uma UNIQUE constraint adequada, verifique a estrutura:
   - Abra as migrations e veja se já existe um constraint UNIQUE
   - Se não existir, crie um em uma nova migration:
     ```sql
     -- Adicionar constraint UNIQUE para permitir upsert
     ALTER TABLE contahub_stockout
     ADD CONSTRAINT contahub_stockout_unique_daily
     UNIQUE (bar_id, data_consulta, cod_prod);
     ```
   - Faça o mesmo para `contahub_stockout_raw` e `contahub_stockout_processado` se necessário

5. Se o upsert não funcionar porque existem registros que precisam ser REMOVIDOS (produtos que voltaram ao estoque), use uma abordagem transacional via RPC:
   ```sql
   CREATE OR REPLACE FUNCTION sync_stockout_atomico(
     p_bar_id INT,
     p_data_consulta DATE,
     p_registros JSONB
   ) RETURNS VOID AS $$
   BEGIN
     DELETE FROM contahub_stockout WHERE bar_id = p_bar_id AND data_consulta = p_data_consulta;
     INSERT INTO contahub_stockout SELECT * FROM jsonb_populate_recordset(null::contahub_stockout, p_registros);
   END;
   $$ LANGUAGE plpgsql;
   ```
   Isso garante que DELETE + INSERT acontecem na mesma transação (tudo ou nada).

6. Aplique a mesma lógica para `contahub_stockout_raw` e `contahub_stockout_processado` se também usarem delete+insert

NÃO crie arquivos .md.

COMMIT: "fix: substituir hard delete por upsert/transação no contahub-stockout-sync"
```

---

## FIX-4 — Migrar referências sgb_user para auth unificada (P2.1 pendente)

```
Leia `frontend/AUTHENTICATION_STRATEGY.md` para entender a estratégia de auth unificada que já foi implementada.

PROBLEMA: Existem 35 referências ao cookie legado `sgb_user` espalhadas em 14 arquivos do frontend. O novo helper unificado `frontend/src/lib/auth/get-user.ts` já existe e usa JWT via `auth_token` como primário. Agora precisamos migrar os pontos que ainda leem diretamente o `sgb_user`.

LISTA DOS 14 ARQUIVOS COM REFERÊNCIAS:
1. frontend/src/hooks/useUserInfo.ts (3 refs)
2. frontend/src/contexts/UserContext.tsx (8 refs)
3. frontend/src/contexts/BarContext.tsx (3 refs)
4. frontend/src/middleware.ts (1 ref)
5. frontend/src/middleware/auth.ts (1 ref)
6. frontend/src/hooks/usePermissions.ts (4 refs)
7. frontend/src/hooks/useAuth.ts (3 refs)
8. frontend/src/lib/cookies.ts (2 refs)
9. frontend/src/lib/auth-server.ts (1 ref)
10. frontend/src/lib/auth-helper.ts (1 ref)
11. frontend/src/app/api/auth/logout/route.ts (1 ref)
12. frontend/src/app/api/auth/login/route.ts (2 refs)
13. + 2 arquivos adicionais

TAREFA:
1. Para CADA arquivo, analise o uso do `sgb_user`:
   - Se está LENDO o cookie para obter dados do usuário → substitua pelo helper `getAuthenticatedUser()` (server-side) ou pelo `useAuth()` hook (client-side)
   - Se está ESCREVENDO o cookie no login → MANTENHA temporariamente como fallback, mas garanta que `auth_token` JWT é o cookie PRIMÁRIO escrito
   - Se está DELETANDO o cookie no logout → mantenha a deleção de AMBOS os cookies (auth_token + sgb_user) para limpar legado

2. Nos HOOKS client-side (useUserInfo, useAuth, usePermissions):
   - Troque a leitura do cookie `sgb_user` por uma chamada a uma API `/api/auth/me` que usa o JWT
   - Ou use o contexto UserContext que já deve ter os dados do JWT

3. Nos CONTEXTS (UserContext, BarContext):
   - Se leem `sgb_user` para hidratar o estado inicial, migre para ler do JWT (`auth_token`)
   - O cookie `sgb_user` contém dados do usuário em JSON. O JWT também contém esses dados no payload

4. No MIDDLEWARE:
   - A validação primária deve ser via `auth_token` (JWT)
   - Se `auth_token` não existir mas `sgb_user` existir, trate como sessão legada e redirecione para re-login (ou extraia os dados mas marque como deprecated)

5. No LOGIN route:
   - Garanta que AMBOS os cookies são setados: `auth_token` (primário) e `sgb_user` (compatibilidade)
   - Adicione um comentário: `// TODO(rodrigo/2026-05): Remover sgb_user quando migração estiver completa`

6. No LOGOUT route:
   - Delete AMBOS: `auth_token` e `sgb_user`

7. APÓS todas as mudanças, busque por `sgb_user` em todo o frontend — as únicas referências restantes devem ser:
   - Login (escrita de compatibilidade)
   - Logout (deleção)
   - Middleware (fallback com log de warning)

NÃO crie arquivos .md.

COMMIT: "refactor: migrar 35 referências sgb_user para auth unificada via JWT"
```

---

## ORDEM DE EXECUÇÃO

```
1. FIX-1 (CORS) → Mais crítico - segurança
2. FIX-3 (Stockout) → Integridade de dados
3. FIX-2 (Arquivo) → Limpeza simples
4. FIX-4 (Auth) → Mais complexo - fazer por último
```
