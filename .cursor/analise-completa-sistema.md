# 🔍 Análise Completa do Sistema Zykor

**Data:** 25/02/2026

---

## 📊 EDGE FUNCTIONS - MAPEAMENTO COMPLETO

### ✅ USADAS (Frontend + Cron)

#### Sincronizações Core
1. **sympla-sync** ✅
   - Cron: Job 197 (semanal)
   - Frontend: `/api/integracoes/sympla/route.ts`
   
2. **yuzer-sync** ✅
   - Cron: Job 198 (semanal)
   - Frontend: Não encontrado (apenas cron)

3. **contahub-sync** ✅
   - Frontend: `/api/contahub/sync-manual/route.ts`
   - Frontend: `/api/contahub/sync-diario/route.ts`

4. **contahub-sync-automatico** ✅
   - Cron: Jobs 157, 188 (diário)
   - Frontend: `/api/configuracoes/contahub/setup-pgcron/route.ts`

5. **contahub-sync-retroativo** ✅
   - Cron: Jobs 223, 224 (semanal)
   - Frontend: `/api/contahub/sync-retroativo/route.ts`

6. **contahub-stockout-sync** ✅
   - Cron: Jobs 160, 191 (diário)
   - Frontend: `/api/contahub/stockout-sync/route.ts`

7. **nibo-sync** ✅
   - Cron: Jobs 156, 192 (diário)
   - Frontend: `/api/configuracoes/credenciais/nibo-sync/route.ts`
   - Frontend: `/api/nibo/sync/route.ts`

8. **getin-sync-continuous** ✅
   - Cron: Job 146 (a cada 2h)
   - Frontend: `/api/getin/sync-retroativo/route.ts`
   - Frontend: `/api/trigger-getin-sync/route.ts`

#### CMV e Desempenho
9. **cmv-semanal-auto** ✅
   - Cron: Jobs 186, 189 (diário)
   - Frontend: `/ferramentas/cmv-semanal/page.tsx`
   - Frontend: `/api/cmv-semanal/sync-retroativo/route.ts`
   - Frontend: `/estrategico/desempenho/components/DesempenhoClient.tsx`

10. **cmv-semanal-cron** ✅
    - Frontend: `/api/cron/cmv-semanal/route.ts`

11. **desempenho-semanal-auto** ✅
    - Cron: Jobs 187, 190, 225 (diário/semanal)
    - Frontend: `/api/configuracoes/desempenho/automacao-semanal/route.ts`
    - Frontend: `/api/configuracoes/desempenho/recalcular-todas/route.ts`
    - Frontend: `/api/configuracoes/desempenho/recalcular-semana/route.ts`
    - Frontend: `/api/configuracoes/desempenho/recalculo-diario/route.ts`
    - Frontend: `/api/configuracoes/cron/sgb-orchestrator-daily/route.ts`

#### Google Sheets / NPS
12. **google-sheets-sync** ✅
    - Cron: Jobs 229, 230, 231, 232 (diário/semanal)
    - Frontend: `/api/ferramentas/nps/sync-manual/route.ts`
    - Frontend: `/api/nps/sync/route.ts`
    - Frontend: `/api/nps/sync-reservas/route.ts`

13. **sync-cmv-sheets** ✅
    - Frontend: `/api/cmv-semanal/sync-sheets/route.ts`

14. **sync-contagem-sheets** ✅
    - Cron: Jobs 165, 193 (diário)
    - Frontend: `/api/ferramentas/contagem-estoque/sync/route.ts`

15. **sync-contagem-retroativo** ✅
    - Frontend: `/api/ferramentas/contagem-estoque/sync-retroativo/route.ts`

#### Agentes IA
16. **agente-sql-expert** ✅
    - Frontend: `/api/agente/sql-expert/route.ts`
    - Frontend: `/api/agente/route.ts`

17. **agente-comparacao** ✅
    - Frontend: `/api/agente/comparacao/route.ts`

18. **agente-auditor** ✅
    - Frontend: `/api/agente/auditor/route.ts`

19. **agente-custos** ✅
    - Frontend: `/api/agente/custos/route.ts`

20. **agente-planejamento** ✅
    - Frontend: `/api/agente/planejamento/route.ts`

21. **agente-treinamento** ✅
    - Frontend: `/api/agente/treinamento/route.ts`

22. **agente-padroes-detector** ✅
    - Frontend: `/api/agente/insights/route.ts`

23. **agente-metas** ✅
    - Cron: Job 211 (semanal)

#### Outros
24. **sync-cliente-estatisticas** ✅
    - Cron: Job 194 (diário)
    - Frontend: `/api/analitico/clientes/sync/route.ts`
    - Frontend: `/api/analitico/clientes/route.ts`

25. **sync-insumos-receitas** ✅
    - Cron: Job 171 (diário)

26. **sync-fichas-tecnicas** ✅
    - Cron: Job 172 (diário)

27. **atualizar-fichas-tecnicas** ✅
    - Frontend: `/api/fichas-tecnicas/atualizar/route.ts`

28. **alertas-discord** ✅
    - Cron: Jobs 204, 206 (diário/15min)

29. **alertas-proativos** ✅
    - Cron: Jobs 209, 210 (manhã/tarde)

30. **alertas-inteligentes** ✅
    - Frontend: `/api/alertas-inteligentes/route.ts`

31. **sync-marketing-meta** ✅
    - Cron: Job 217 (diário)

32. **umbler-sync-incremental** ✅
    - Cron: Job 218 (diário)

33. **sync-conhecimento** ✅
    - Cron: Job 208 (diário)

34. **monitor-concorrencia** ✅
    - Cron: Job 212 (diário)

35. **google-reviews-apify-sync** ✅
    - Cron: Job 228 (diário)

36. **sync-orcamentacao-sheets** ✅
    - Cron: Job 226 (diário)

37. **relatorio-pdf** ✅
    - Frontend: `/api/relatorio/route.ts`

38. **discord-commands** ✅
    - Frontend: `/api/discord/commands/route.ts`

39. **falae-nps-sync** ✅
    - Frontend: `/api/falae/sync/route.ts`

40. **contahub-processor** ✅
    - Frontend: `/api/contahub/processar-raw/route.ts`

41. **contahub-prodporhora** ✅
    - Frontend: `/api/ferramentas/sync-prodporhora/route.ts`

---

### ❓ EDGE FUNCTIONS SEM USO APARENTE

#### Agentes (Não encontrados no frontend)
1. **agente-analise-diaria** - Cron: Job 213
2. **agente-analise-semanal** - Cron: Job 214
3. **agente-analise-mensal** - Cron: Job 215
4. **agente-analise-periodos** - Não encontrado
5. **agente-analyzer** - Não encontrado
6. **agente-feedback** - Não encontrado
7. **agente-ia-analyzer** - Não encontrado
8. **agente-mapeador-tabelas** - Não encontrado
9. **agente-orchestrator** - Não encontrado
10. **agente-scanner** - Não encontrado
11. **agente-supervisor** - Não encontrado
12. **agente-test-setup** - Não encontrado

#### Syncs (Não encontrados)
13. **sync-eventos** - Não encontrado
14. **sync-eventos-automatico** - Cron: Job 158
15. **sync-marketing-auto** - Não encontrado
16. **sync-marketing-google** - Não encontrado
17. **sync-nps** - Não encontrado
18. **sync-nps-reservas** - Não encontrado
19. **sync-pesquisa-felicidade** - Não encontrado
20. **sync-voz-cliente** - Não encontrado

#### Outros
21. **alertas-unified** - Não encontrado
22. **analise-diaria-automatica** - Não encontrado
23. **api-clientes-externa** - Não encontrado
24. **checklist-auto-scheduler** - Não encontrado
25. **detectar-anomalias-preco** - Não encontrado
26. **discord-notification** - Não encontrado
27. **google-reviews-auth** - Não encontrado
28. **google-reviews-callback** - Não encontrado
29. **google-reviews-sync** - Não encontrado (substituído por apify-sync?)
30. **nibo-sync-cron** - Cron: Jobs 219, 220 (DUPLICADO!)
31. **sgb-orchestrator-final** - Frontend: `/api/configuracoes/cron/sgb-orchestrator-daily/route.ts`
32. **sgb-orchestrator-realtime-secure** - Frontend: `/api/configuracoes/cron/sgb-orchestrator-secure/route.ts`
33. **umbler-send** - Não encontrado
34. **umbler-webhook** - Não encontrado
35. **inter-webhook** - Frontend: `/configuracoes/webhooks/page.tsx`
36. **inter-pix-webhook** - Frontend: `/api/financeiro/inter/webhook/route.ts`
37. **sync-orcamentacao-cron** - Não encontrado

---

## 🚨 PROBLEMAS IDENTIFICADOS

### 1. Jobs de Nibo Duplicados
- **Jobs 156, 192** (nibo-sync) - Específicos por bar ✅ MANTER
- **Jobs 219, 220** (nibo-sync-cron) - Genéricos ❌ DELETAR

### 2. Edge Functions Órfãs (27 funções)
Funções que não têm cron job nem são chamadas pelo frontend:
- 12 agentes não utilizados
- 8 syncs não utilizados
- 7 outras funções não utilizadas

### 3. Funções Possivelmente Substituídas
- `google-reviews-sync` → substituído por `google-reviews-apify-sync`?
- `discord-notification` → substituído por `alertas-discord`?

---

## 🎯 RECOMENDAÇÕES

### ❌ DELETAR IMEDIATAMENTE

#### Cron Jobs
- **Job 219**: `nibo-sync-morning` (duplicado)
- **Job 220**: `nibo-sync-evening` (duplicado)

#### Edge Functions (27 funções órfãs)
**Agentes não utilizados:**
1. agente-analise-periodos
2. agente-analyzer
3. agente-feedback
4. agente-ia-analyzer
5. agente-mapeador-tabelas
6. agente-orchestrator
7. agente-scanner
8. agente-supervisor
9. agente-test-setup

**Syncs não utilizados:**
10. sync-eventos (substituído por sync-eventos-automatico?)
11. sync-marketing-auto
12. sync-marketing-google
13. sync-nps (substituído por google-sheets-sync?)
14. sync-nps-reservas (substituído por google-sheets-sync?)
15. sync-pesquisa-felicidade (substituído por google-sheets-sync?)
16. sync-voz-cliente (substituído por google-sheets-sync?)
17. sync-orcamentacao-cron (substituído por sync-orcamentacao-sheets?)

**Outros:**
18. alertas-unified
19. analise-diaria-automatica
20. api-clientes-externa
21. checklist-auto-scheduler
22. detectar-anomalias-preco
23. discord-notification
24. google-reviews-auth
25. google-reviews-callback
26. google-reviews-sync
27. umbler-send
28. umbler-webhook

### ⚠️ REVISAR (Podem estar sendo usados indiretamente)

1. **agente-analise-diaria** (Job 213) - Verificar se é útil
2. **agente-analise-semanal** (Job 214) - Verificar se é útil
3. **agente-analise-mensal** (Job 215) - Verificar se é útil
4. **sync-eventos-automatico** (Job 158) - O que faz?
5. **nibo-sync-cron** - Edge function existe mas não deveria (jobs 219/220 usam ela)

---

## 📝 PRÓXIMA AÇÃO

Vou começar deletando os **jobs duplicados de Nibo (219, 220)** e depois as **Edge Functions órfãs**.

**Posso prosseguir?**
