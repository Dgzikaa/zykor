# PROMPTS — LIMPEZA COMPLETA NIBO → CONTA AZUL

**Data**: 04/04/2026
**Status**: 🔴 EXECUTAR AGORA — 5 prompts que eliminam TODAS as referências ao NIBO
**Contexto**: O NIBO foi substituído pelo Conta Azul. Os dados financeiros já fluem via `contaazul_lancamentos` → VIEW `lancamentos_financeiros`. Todas as referências ao NIBO são código morto.

> Execute cada prompt em um chat separado no Cursor.
> **ORDEM**: NIBO-CLEAN-1 → NIBO-CLEAN-2 → NIBO-CLEAN-3 → NIBO-CLEAN-4 → NIBO-CLEAN-5

---

## NIBO-CLEAN-1 — Deletar todas as rotas API do NIBO

```
Leia `.cursor/zykor-context.md` para contexto.

TAREFA: Deletar TODAS as rotas API que são exclusivamente do NIBO. O NIBO foi 100% substituído pelo Conta Azul. Esses endpoints são código morto — ninguém os chama mais.

DELETE os seguintes diretórios e arquivos INTEIROS:

1. DELETAR DIRETÓRIO INTEIRO: `frontend/src/app/api/financeiro/nibo/` (e todo seu conteúdo)
   - categorias/route.ts
   - categorias/sync/route.ts
   - centros-custo/route.ts
   - consultas/lancamentos-retroativos/route.ts
   - dre-monthly-2025/route.ts
   - dre-monthly-detailed/route.ts
   - dre-yearly-detailed/route.ts
   - employees/route.ts
   - export-excel/route.ts
   - schedules/route.ts
   - stakeholders/route.ts
   - stakeholders/[id]/route.ts

2. DELETAR ARQUIVOS:
   - `frontend/src/app/api/configuracoes/credenciais/nibo-connect/route.ts`
   - `frontend/src/app/api/configuracoes/credenciais/nibo-status/route.ts`
   - `frontend/src/app/api/configuracoes/credenciais/nibo-sync/route.ts`
   - `frontend/src/app/api/configuracoes/credenciais/nibo-sync-simple/route.ts`
   - `frontend/src/app/api/nibo/sync/route.ts` (e o diretório `nibo/` se ficar vazio)
   - `frontend/src/app/api/financeiro/nibo-categorias/route.ts`
   - `frontend/src/app/api/agendamento/agendar-nibo/route.ts`

3. DELETAR COMPONENTE:
   - `frontend/src/components/configuracoes/NiboIntegrationCard.tsx`

APÓS DELETAR, verifique se algum import quebrou:
```bash
cd frontend && npx tsc --noEmit 2>&1 | head -50
```

Se houver erros de import referenciando arquivos deletados:
- Remova o import
- Se o componente era renderizado em alguma página (ex: `<NiboIntegrationCard />`), remova a renderização também
- Se a página de configurações listava NIBO como integração, remova da lista

NÃO crie arquivos .md.

COMMIT: "refactor: deletar todas as rotas API e componentes exclusivos do NIBO"
```

---

## NIBO-CLEAN-2 — Limpar referências NIBO no módulo de Agendamento

```
Leia `.cursor/zykor-context.md` para contexto.

CONTEXTO: O módulo de agendamento de pagamentos foi originalmente construído sobre a API do NIBO. Agora o NIBO não existe mais. O agendamento precisa continuar funcionando, mas usando dados locais (tabelas Supabase) em vez de chamadas à API NIBO.

TAREFA: Limpar referências ao NIBO nos arquivos de agendamento. Para cada arquivo, abra-o, entenda o que ele faz, e faça as correções:

1. `frontend/src/app/api/agendamento/buscar-stakeholder/route.ts`
   - Se busca stakeholders da API NIBO → Substituir por query na tabela `contaazul_lancamentos` buscando fornecedores únicos (campo `descricao` ou similar)
   - Se a funcionalidade não faz sentido sem NIBO → Deletar o arquivo

2. `frontend/src/app/api/agendamento/criar-supplier/route.ts`
   - Se cria fornecedor na API NIBO → Deletar (não precisamos criar fornecedores no Conta Azul via API)

3. `frontend/src/app/api/agendamento/processar-automatico/route.ts`
   - Verificar se referencia NIBO. Se sim, remover a referência. Se a lógica inteira depende de NIBO, deletar.

4. `frontend/src/app/ferramentas/agendamento/page.tsx`
   - Remover qualquer UI que mostre "NIBO", "Conectar NIBO", status de conexão NIBO
   - Se a página inteira depende de NIBO para funcionar, adicionar um banner: "Módulo em migração para Conta Azul"

5. `frontend/src/app/ferramentas/agendamento/components/AgendamentoCredenciais.tsx`
   - Remover seção de credenciais NIBO

6. `frontend/src/app/ferramentas/agendamento/components/NovoPagamentoForm.tsx`
   - Se o form envia dados para a API NIBO → Substituir por insert na tabela local `nibo_agendamentos` (que será renomeada depois)

7. `frontend/src/app/ferramentas/agendamento/components/ImportarFolhaModal.tsx`
   - Se importa folha via API NIBO → Remover funcionalidade ou adaptar

8. `frontend/src/app/ferramentas/agendamento/services/agendamento-service.ts`
   - Remover TODAS as chamadas fetch para `/api/financeiro/nibo/*` e `/api/agendamento/agendar-nibo`
   - Substituir por chamadas diretas ao Supabase ou a rotas que não dependem de NIBO

9. `frontend/src/app/ferramentas/agendamento/types.ts`
   - Remover campos `nibo_id`, `sincronizado_nibo` e qualquer tipo com "nibo" no nome
   - Manter os campos úteis (valor, data, fornecedor, status, etc.)

PRINCÍPIO: Se algo quebrar e não tiver substituto claro, é melhor DESABILITAR a funcionalidade (com mensagem "Em migração") do que deixar código morto referenciando NIBO.

VALIDAÇÃO:
```bash
grep -ri "nibo" frontend/src/app/ferramentas/agendamento/ --include="*.ts" --include="*.tsx"
grep -ri "nibo" frontend/src/app/api/agendamento/ --include="*.ts"
# Ambos devem retornar ZERO resultados
```

NÃO crie arquivos .md.

COMMIT: "refactor: migrar módulo de agendamento removendo dependência do NIBO"
```

---

## NIBO-CLEAN-3 — Limpar referências NIBO em services, hooks, libs, tipos e páginas diversas

```
Leia `.cursor/zykor-context.md` para contexto.

TAREFA: Limpar referências ao NIBO nos seguintes arquivos. Para cada um, abra o arquivo, localize TODAS as ocorrências de "nibo" (case insensitive), e remova/substitua:

### LIBS E HOOKS:

1. `frontend/src/lib/api-credentials.ts`
   - Remover qualquer função/tipo/constante relacionada a credenciais NIBO
   - Manter funções de credenciais de outros sistemas (ContaHub, Conta Azul, etc.)

2. `frontend/src/lib/discord-service.ts`
   - Se menciona NIBO em mensagens de alerta/log, substituir por "Conta Azul" ou remover

3. `frontend/src/hooks/usePermissions.ts`
   - Remover verificação de permissão "nibo" (ex: `canAccessNibo`, `niboConectado`, etc.)

4. `frontend/src/middleware/auth.ts`
   - Remover rotas NIBO de qualquer whitelist/blacklist de autenticação

### PÁGINAS DIVERSAS:

5. `frontend/src/app/ferramentas/cmv-semanal/page.tsx`
   - Buscar "nibo" e remover/substituir por referência ao Conta Azul

6. `frontend/src/app/ferramentas/cmv-semanal/tabela/page.tsx`
   - Mesmo tratamento

7. `frontend/src/app/ferramentas/simulacao-cmo/page.tsx`
   - Mesmo tratamento

8. `frontend/src/app/ferramentas/consultas/page.tsx`
   - Se tem opção de "consultar NIBO", remover ou substituir por consulta local

9. `frontend/src/app/configuracoes/monitoramento/page.tsx`
   - Remover monitoramento/status do NIBO da dashboard

10. `frontend/src/app/estrategico/desempenho/components/DesempenhoClient.tsx`
    - Remover qualquer referência NIBO (provavelmente um label ou tooltip)

### DRE:

11. `frontend/src/app/ferramentas/dre/page.tsx`
    - Substituir chamadas a `/api/financeiro/nibo/dre-*` por `/api/financeiro/dre-simples` (que já existe e usa dados locais)
    - Remover lógica de consolidação NIBO

12. `frontend/src/app/operacional/dre/page.tsx`
    - Mesmo tratamento que o item 11

13. `frontend/src/components/dre/DreManualModal.tsx`
    - Remover referências NIBO se existirem

### API ROUTES DIVERSAS:

14. `frontend/src/app/api/financeiro/verificar-credenciais/route.ts`
    - Remover verificação de credenciais NIBO

15. `frontend/src/app/api/financeiro/inter/pix/route.ts`
    - Se referencia `nibo_agendamentos` para atualizar status de pagamento PIX, trocar por query direta sem mencionar "nibo" no código (a tabela ainda existe por agora)

16. `frontend/src/app/api/configuracoes/integracoes/status/route.ts`
    - Remover NIBO da lista de integrações monitoradas

17. `frontend/src/app/api/configuracoes/administracao/integracoes/route.ts`
    - Remover NIBO da lista de integrações administráveis

18. `frontend/src/app/api/saude-dados/route.ts`
    - Remover checks de saúde do NIBO

19. `frontend/src/app/api/saude-dados/syncs/route.ts`
    - Remover sync status do NIBO

20. `frontend/src/app/api/saude-dados/resumo/route.ts`
    - Remover NIBO do resumo de saúde de dados

21. `frontend/src/app/api/estrategico/orcamentacao/analise-detalhada/route.ts`
    - Substituir referência NIBO por Conta Azul

22. `frontend/src/app/api/estrategico/orcamentacao/todos-meses/route.ts`
    - Mesmo tratamento

23. `frontend/src/app/estrategico/orcamentacao/services/orcamentacao-service.ts`
    - Remover chamadas/referências NIBO

24. `frontend/src/app/api/rh/cmo-comparativo/route.ts`
    - Substituir referência NIBO por dados locais

25. `frontend/src/app/api/health/route.ts`
    - Remover health check do NIBO

REGRA GERAL para cada arquivo:
- Se é apenas um LABEL/STRING "NIBO" → substituir por "Conta Azul" ou remover
- Se é uma CHAMADA a rota `/api/financeiro/nibo/*` → a rota foi deletada no NIBO-CLEAN-1, então remova a chamada
- Se é uma QUERY a tabela `nibo_*` → manter a query por agora (as tabelas ainda existem), mas remover a palavra "nibo" de variáveis e comentários onde possível
- Se é uma verificação `if (niboConectado)` → substituir por `true` ou remover o condicional

VALIDAÇÃO:
```bash
grep -ri "nibo" frontend/src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules" | grep -v "/api/financeiro/nibo/" | grep -v "/api/nibo/" | grep -v "/nibo-" | grep -v "NiboIntegration"
# Deve retornar ZERO (os arquivos do grep -v já foram deletados no NIBO-CLEAN-1)

# Validação mais simples — deve retornar ZERO:
grep -ri "nibo" frontend/src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules" | wc -l
```

NÃO crie arquivos .md.

COMMIT: "refactor: remover todas as referências NIBO restantes do frontend"
```

---

## NIBO-CLEAN-4 — Limpar tipos TypeScript (supabase.ts)

```
Leia `.cursor/zykor-context.md` para contexto.

TAREFA: O arquivo `frontend/src/types/supabase.ts` é auto-gerado pelo Supabase CLI e contém definições de tipo para tabelas `nibo_*`. Como as tabelas ainda existem no banco (dados históricos), os tipos vão voltar se regenerar o arquivo. Mas precisamos garantir que NENHUM código IMPORTE ou USE esses tipos.

1. Abra `frontend/src/types/supabase.ts`

2. NÃO delete os tipos das tabelas nibo_* do arquivo (eles são auto-gerados e voltariam).
   Em vez disso, adicione um comentário no topo do arquivo:
   ```typescript
   // NOTA: Tabelas nibo_* são legado (deprecated desde 04/2026).
   // Dados financeiros agora vêm via Conta Azul (contaazul_lancamentos).
   // As tabelas nibo_* mantidas apenas para dados históricos. Não usar em código novo.
   ```

3. Busque em TODO o frontend por imports que referenciam tipos nibo:
   ```bash
   grep -ri "nibo_agendamentos\|nibo_categorias\|nibo_stakeholders\|nibo_centros_custo\|nibo_raw_data\|nibo_logs\|nibo_background\|nibo_temp\|NiboIntegration" frontend/src/ --include="*.ts" --include="*.tsx" | grep -v "supabase.ts" | grep -v "node_modules"
   ```

4. Para cada arquivo encontrado:
   - Se importa um tipo `nibo_*` → remover o import e substituir pelo tipo equivalente ou `any`
   - Se usa `Tables<'nibo_agendamentos'>` → verificar se pode ser substituído por um tipo local

5. VALIDAÇÃO:
   ```bash
   # Nenhum código (exceto supabase.ts) deve referenciar tipos nibo
   grep -ri "nibo" frontend/src/ --include="*.ts" --include="*.tsx" | grep -v "supabase.ts" | grep -v "node_modules"
   # Deve retornar ZERO
   ```

NÃO crie arquivos .md.

COMMIT: "refactor: limpar uso de tipos nibo_* no frontend"
```

---

## NIBO-CLEAN-5 — Limpar backend (Edge Functions, SQL, banco)

```
Leia `.cursor/zykor-context.md` para contexto.

TAREFA: Limpar todas as referências ao NIBO no backend e banco de dados.

### EDGE FUNCTIONS:

1. DELETAR INTEIRO: `backend/supabase/functions/nibo-sync/` (Edge Function completa)
   - Esta função sincronizava dados da API NIBO. Não é mais usada.

2. `backend/supabase/functions/unified-dispatcher/index.ts`
   - Remover a entrada `'nibo': '/functions/v1/nibo-sync'` do mapeamento de rotas
   - Remover comentários que mencionam NIBO

3. `backend/supabase/functions/integracao-dispatcher/index.ts`
   - Mesmo tratamento: remover `'nibo': '/functions/v1/nibo-sync'` e comentários

4. `backend/supabase/functions/inter-pix-webhook/index.ts`
   - Linhas que referenciam `nibo_agendamentos`: a tabela ainda existe, então a lógica de atualizar status de PIX pode continuar.
   - MAS renomeie comentários de "Tentar atualizar em nibo_agendamentos" para "Atualizar status em agendamentos"
   - Se possível, abstraia o nome da tabela para uma constante:
     ```typescript
     const AGENDAMENTOS_TABLE = 'nibo_agendamentos'; // TODO: renomear tabela para 'agendamentos'
     ```

5. `backend/supabase/functions/_shared/env-validator.ts`
   - Se valida variáveis como NIBO_API_KEY, NIBO_TOKEN, NIBO_COMPANY_ID → remover essas validações

### SQL FUNCTIONS:

6. DELETAR: `database/functions/executar_nibo_sync_ambos_bares.sql`
   - Função morta com placeholder `[SERVICE_ROLE_KEY]`

7. `database/functions/calculate_evento_metrics.sql`
   - Se referencia `nibo_agendamentos` ou `nibo_custos`:
     - Se a query é para buscar custos de atração → substituir por query em `lancamentos_financeiros` com categoria 'atracao'
     - Se é apenas um LEFT JOIN opcional → remover o JOIN e os campos relacionados

### BANCO DE DADOS (via Supabase MCP ou migration):

8. NÃO deletar as tabelas nibo_* (têm dados históricos)
   Mas adicionar comentários:
   ```sql
   COMMENT ON TABLE nibo_agendamentos IS '[DEPRECATED 2026-04-04] Legado NIBO. Tabela mantida para dados históricos e webhook PIX. Migração futura para tabela "agendamentos".';
   COMMENT ON TABLE nibo_categorias IS '[DEPRECATED 2026-04-04] Substituída por bar_categorias_custo.';
   COMMENT ON TABLE nibo_stakeholders IS '[DEPRECATED 2026-04-04] Legado NIBO.';
   COMMENT ON TABLE nibo_centros_custo IS '[DEPRECATED 2026-04-04] Legado NIBO.';
   COMMENT ON TABLE nibo_raw_data IS '[DEPRECATED 2026-04-04] Legado NIBO.';
   COMMENT ON TABLE nibo_logs_sincronizacao IS '[DEPRECATED 2026-04-04] Legado NIBO.';
   COMMENT ON TABLE nibo_background_jobs IS '[DEPRECATED 2026-04-04] Legado NIBO.';
   COMMENT ON TABLE nibo_temp_agendamentos IS '[DEPRECATED 2026-04-04] Legado NIBO.';
   ```

9. Verificar cron jobs ativos que chamam NIBO:
   ```sql
   SELECT jobname, schedule, command FROM cron.job WHERE command ILIKE '%nibo%';
   ```
   Se encontrar algum → desativar com `SELECT cron.unschedule('nome');`

### DOCUMENTATION (não deletar, apenas atualizar):

10. `backend/supabase/SECURITY-JWT-MIGRATION.md`
    - Marcar `nibo-sync` como "[DELETED]" na lista

VALIDAÇÃO:
```bash
# Backend: deve retornar ZERO
grep -ri "nibo" backend/supabase/functions/ --include="*.ts" | grep -v "node_modules" | grep -v "_archived"
# Database functions: deve retornar ZERO
grep -ri "nibo" database/functions/ --include="*.sql"
```

NÃO crie arquivos .md (exceto atualizar os existentes conforme indicado).

COMMIT: "refactor: deletar nibo-sync edge function e limpar referências NIBO do backend"
```

---

## ORDEM DE EXECUÇÃO

```
NIBO-CLEAN-1 → Deletar rotas API (remove 19 arquivos + 1 componente)
NIBO-CLEAN-2 → Limpar módulo agendamento (8 arquivos)
NIBO-CLEAN-3 → Limpar services, hooks, páginas (25 arquivos)
NIBO-CLEAN-4 → Limpar tipos TypeScript
NIBO-CLEAN-5 → Limpar backend + banco

APÓS EXECUTAR TODOS:
1. Rodar no terminal: grep -ri "nibo" frontend/src/ backend/supabase/functions/ database/functions/ --include="*.ts" --include="*.tsx" --include="*.sql" | grep -v node_modules | grep -v supabase.ts | wc -l
   → Deve retornar 0 (ou muito próximo, com exceções apenas em supabase.ts)

2. Rodar: cd frontend && npx tsc --noEmit
   → Deve compilar sem erros

3. Testar as páginas no navegador:
   - /ferramentas/dre
   - /operacional/dre
   - /ferramentas/agendamento
   - /configuracoes/monitoramento
   - /estrategico/desempenho
```
