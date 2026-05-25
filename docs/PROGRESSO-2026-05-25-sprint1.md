# Progresso Sprint 1 — 2026-05-25

Sessão autônoma de 2h: aplicar correções críticas + iniciar Sprint 2/3.
Tudo abaixo está **aplicado em produção** (banco/repo).

## Bugs críticos corrigidos

### 1. Clientes ativos (RPC inflada)
- **Bug:** `get_count_base_ativa` usava `HAVING COUNT(*) >= 2` (2+ comandas). Cliente que ia 1 vez mas abria 2 comandas entrava como ativo.
- **Fix:** trocado por `HAVING COUNT(DISTINCT data_visita) >= 2` (2+ dias distintos), conforme definição validada com sócio.
- **Migration:** `database/migrations/2026-05-25-fix-clientes-ativos-2-dias-distintos.sql`
- **Impacto hoje (bar 3, 90 dias):** 5559 → **5395** ativos (-164 = -3%). Diferença pequena hoje porque 98.9% dos clientes têm 1 comanda/dia, mas conceitualmente está correto agora.
- **Status:** aplicado em prod via `apply_migration`.

### 2. Stockout — 10 dias órfãos (14/05 a 23/05)
- **Bug descoberto:** silver de 14/05 a 23/05 estava todo vazio. Bronze existia (coletado D+1 às 17h por algum mecanismo). O cron de retry de processamento rodava 1h ANTES da coleta tardia, criando race condition.
- **Backfill:** rodei `stockout-processar` para cada par (bar, data) órfão. Hoje todos os 10 dias têm silver populado.
- **Reestruturação dos crons (migration `2026-05-25-stockout-orquestrador-unificado.sql`):**
  - **Removidos:** stockout-processar-auto-ordinario, stockout-processar-auto-deboche, stockout-sync-diario-correto-v2, stockout-sync-diario-deboche, stockout-retry-d-1-ambos-v2, stockout-retry-d-1-tarde (6 crons antigos).
  - **Criados:**
    - `stockout-completo-ordinario` 19:00 BRT todo dia
    - `stockout-completo-deboche` 19:10 BRT dom/ter-sáb (bar 4 não opera segunda)
    - `stockout-retry-ordinario` 22:00 BRT todo dia (se silver vazio, refaz)
    - `stockout-retry-deboche` 22:10 BRT dom/ter-sáb
  - Tudo no mesmo dia (`CURRENT_DATE`), sem dependência de D-1.
  - Função única `stockout_executar_completo(bar, data)` orquestra sync + processar + log.
- **Nova tabela:** `silver.stockout_execucao_log` — registra cada execução (sucesso, bronze, silver, tempo, erros). Permanente.
- **Alerta:** `alerta-stockout-faltante-ontem` movido para 09:00 BRT (era 07:40), depois do retry da noite.

### 3. Email forgot-password
- **Bugs:**
  1. Em dev forçava envio pra `rodrigo@grupomenosemais.com.br` (linha 29 de `password-reset/route.ts`).
  2. Falha silenciosa: se Resend cair, usuário via "sucesso" mesmo sem email enviado.
  3. Sem alerta quando falhava.
- **Fixes:**
  - Sempre envia para o email real (removida lógica `NODE_ENV === 'development'`).
  - Quando email falha: retorna **502** ao caller + dispara alerta Discord via `DISCORD_WEBHOOK_URL` (função `notifyResendFailure` em `forgot-password/route.ts`).
- **Subject:** removido `[DEV]` prefix.

## Limpeza Vercel cron jobs

- **Removidos do `frontend/vercel.json`:**
  - `nibo-sync-simple` (NIBO descontinuado em 2026-03)
  - `falae-reconciliacao` (sem função edge correspondente)
  - `stockout-sync` (duplicado de pg_cron `stockout-completo-*`)
- **Mantidos:** automacao-semanal, sync-diario, processar-automatico, recalculo-diario.

## Menu lateral

- **Voz do Cliente** oculto temporariamente (rota continua acessível). Comentado em 4 arquivos: `menu-config.ts`, `ModernSidebarOptimized.tsx`, `BottomNavigation.tsx`, `MinimalSidebar.tsx`.
- **Business Plan** adicionado em Estratégico → `/estrategico/bp`.
- **Orçamentação v2** adicionado em Estratégico → `/estrategico/orcamentacao-v2`.

## Novas tabelas/migrations

| Tabela | Propósito |
|--------|-----------|
| `silver.stockout_execucao_log` | Log permanente de cada execução stockout. |
| `meta.orcamento_subcategoria_map` | Mapeamento ContaAzul→linha de orçamento. Substitui CATEGORIAS_MAP hardcoded. 22 linhas pré-populadas com base na planilha Mai26. |
| `meta.bp_linha` | Business Plan: valores mensais + distribuição por dia da semana. 22 linhas seed do BP Mai26. |
| `meta.bp_indicador` | Indicadores macro do BP (BreakEven, Custo Fixo, Margem Contribuição, EBITDA, etc). 11 indicadores. |

Funções:
- `public.stockout_executar_completo(bar, data, triggered_by)` — orquestrador unificado
- `public.stockout_retry_se_vazio(bar)` — retry noturno

## Páginas novas

### `/estrategico/bp` — Business Plan
- Indicadores top: Receita Total, BreakEven, EBITDA Projetado, Margem Contribuição
- Mini-cards: Tkt Bar, Tkt Entrada, Pessoas/mês, CMV alvo
- Gráfico de barras: projeção por dia da semana (receita + cachê)
- Tabela DRE completa por bloco com %receita
- Notas e direcionamentos do BP
- Selector de versão (Mai26 hoje, futuras versões via insert em `meta.bp_linha`)

### `/estrategico/orcamentacao-v2` — Orçamentação reescrita
- Service novo (`orcamentacao-v2-service.ts`) que cruza:
  - `meta.bp_linha` (planejado)
  - `bronze_contaazul_lancamentos` (realizado + projetado)
  - `eventos_base.real_r` (receita real do ContaHub)
- KPIs no topo com delta vs BP
- Tabela DRE: Planejado/Realizado/Projetado/Variação/Var %/%Receita
- Card "Categorias não mapeadas" — lista lançamentos ContaAzul cuja categoria_nome não bate com nenhum mapping (botão de aviso). Permite identificar gaps no mapeamento.
- Comparativo mês-a-mês (7 meses): clica em qualquer mês → muda visualização.

### `/ferramentas/stockout/auditoria-v2` — Auditoria reescrita
- Date picker para navegar qualquer dia
- Cards: total produtos / incluídos / inativos / sem venda / % stockout real
- Card "Última execução" mostrando status, hora, bronze, silver, tempo, regras
- **Tabela completa de produtos** (650+ por dia): código, descrição, local, categoria, ativo, venda, estoque, preço, incluído, motivo
- Filtros: busca por nome, local, incluído/excluído, ativo/inativo
- Histórico de execuções (últimas 30): permite navegar para qualquer data clicando

### `/ferramentas/agendamento-v2` — UX reescrita
- **Estado 1 (setup centralizado):** card único no meio da tela com 2 selects:
  1. Credencial Inter (de onde sai o PIX)
  2. Conta financeira CA (registro do lançamento)
- **Estado 2 (operação):** após "Começar"
  - Header compacto com 2 badges mostrando setup atual + botão "Trocar conta"
  - Sidebar compacta (só métricas + botão "Pagar todos")
  - Tabs principais: Manual / Folha / Lista
- Persiste setup por bar em localStorage
- Componentes (NovoPagamentoForm, ImportarFolhaForm, PagamentosList) reutilizados de `/agendamento`.

## Validação anti-duplicado ContaAzul

- Em `POST /api/financeiro/contaazul/lancamentos`: antes de criar lançamento, busca em `bronze_contaazul_lancamentos` por dups com mesmo `bar_id + data_competencia + categoria_id + valor + descricao_normalizada + stakeholder`.
- Se encontrar: retorna **409 Conflict** com payload `{ duplicado: {...} }`. Usuário precisa alterar algum campo ou aceitar que é proposital.
- Critério "tudo igual" vem da regra do sócio: 2 pagamentos com valores DIFERENTES pra mesma pessoa no mesmo dia é OK, mas tudo igual quase certamente é repeat-click acidental.

## Tasks ainda pendentes (próxima sprint)

(Todas as 13 tasks de Sprint 1 estão completed agora.)

### Adicional: Integrações falsamente desconectadas (task #16 — CONCLUÍDO)

**Causa raiz:** o `catalog.ts` referenciava colunas que NÃO EXISTEM nas tabelas bronze. A query falhava silenciosa (retornava 0) e a UI mostrava "Sem atividade".

| Integração | Coluna antiga (errada) | Coluna correta |
|-----------|------------------------|----------------|
| ContaHub | `criado_em` | `created_at` |
| ContaAzul | `data_competencia` (data antiga sempre) | `synced_at` |
| GetIn | `criado_em` | `synced_at` |
| Sympla | `criado_em` | `synced_at` |
| Yuzer | `criado_em` | `synced_at` |
| Falaê | `criado_em` | `synced_at` |
| Google Reviews | `scraped_at` (já estava certo) | mantido |
| Inter | `recebido_em` (já estava certo) | mantido |
| Umbler | `created_at` (já estava certo) | mantido |

**Adicionado `inferirPorAtividade: true`** em ContaAzul e GetIn (que já tinham atividade real mas a credencial está em `api_credentials` — agora mostra "conectada" se houver atividade recente, mesmo se a credencial expirou).

**Vercel:** adicionados envs `VERCEL`, `VERCEL_URL`, `NEXT_PUBLIC_VERCEL_URL` (sempre presentes quando rodando na Vercel) além do `NEXT_PUBLIC_SITE_URL` que pode não estar definido.

**Volumes 7d validados (24/05/2026, bar 3):**
- ContaHub: 94 ✓
- ContaAzul: 9561 ✓
- Google Reviews: 675 ✓
- GetIn: 553 ✓
- Falaê: 49 ✓
- Sympla/Yuzer: 0 (sem eventos ativos no período — comportamento esperado)
- Inter: 0 (webhook só dispara quando há PIX)
- Umbler: 0 (verificar separado — pode ser config)

## Coisas a validar quando voltar

1. **`/estrategico/bp`** abrir e ver se carrega os números do Mai26.
2. **`/estrategico/orcamentacao-v2`** abrir e comparar com a planilha mestre (escolha 1 mês recente, valida cada linha BP vs Realizado).
3. **`/ferramentas/stockout/auditoria-v2`** abrir, ver auditoria de hoje, navegar para qualquer dia entre 14/05-23/05 → deve mostrar produtos.
4. **`/ferramentas/agendamento-v2`** testar fluxo end-to-end com 1 pagamento real (bar 3 e bar 4).
5. **Crons stockout** rodam hoje 19:00/19:10 BRT. Validar amanhã que silver de 25/05 existe.
6. **Resend** deveria estar funcional. Testar `/auth/forgot-password` com algum email real (de teste) e confirmar que chega.
7. **Voz do Cliente** sumiu do menu lateral mas rota continua acessível direto.
8. **Categorias não mapeadas** na orçamentação v2: se aparecerem categorias do ContaAzul que deveriam estar mapeadas, é só editar `meta.orcamento_subcategoria_map` adicionando ao array `contaazul_categorias` da linha certa.

## Arquivos novos criados

```
database/migrations/
  2026-05-25-fix-clientes-ativos-2-dias-distintos.sql
  2026-05-25-stockout-orquestrador-unificado.sql
  2026-05-25-orcamento-subcategoria-map.sql
  2026-05-25-meta-bp-anual.sql

frontend/src/app/estrategico/bp/
  page.tsx, types.ts, BpClient.tsx

frontend/src/app/estrategico/orcamentacao-v2/
  page.tsx, types.ts, OrcamentacaoV2Client.tsx
  services/orcamentacao-v2-service.ts

frontend/src/app/ferramentas/stockout/auditoria-v2/
  page.tsx, AuditoriaV2Client.tsx

frontend/src/app/ferramentas/agendamento-v2/
  page.tsx

docs/
  orcamentacao-mestre-mai26-mapeamento.md
  PROGRESSO-2026-05-25-sprint1.md (este arquivo)
```

## Arquivos modificados

```
frontend/vercel.json  (removidos 3 crons obsoletos)
frontend/src/lib/menu-config.ts  (voz-cliente oculto, BP + orcamentacao-v2 adicionadas)
frontend/src/lib/route-permissions.ts  (4 novas rotas)
frontend/src/components/layouts/ModernSidebarOptimized.tsx  (voz-cliente oculto, BP adicionada)
frontend/src/components/layouts/MinimalSidebar.tsx  (voz-cliente oculto, BP adicionada)
frontend/src/components/layouts/BottomNavigation.tsx  (voz-cliente oculto)
frontend/src/app/api/auth/forgot-password/route.ts  (sem dev redirect, alerta Discord)
frontend/src/app/api/emails/password-reset/route.ts  (sem dev redirect)
frontend/src/app/api/financeiro/contaazul/lancamentos/route.ts  (validação anti-duplicado)
```

## Notas

- **Páginas v2 vs original**: não removi as páginas antigas (`/estrategico/orcamentacao`, `/ferramentas/stockout/auditoria`, `/ferramentas/agendamento`). Você compara e me diz quais ficam — aí renomeio v2→default e remove a antiga.
- **Mobile**: a orçamentação-v2, BP e auditoria-v2 são responsivas (hidden md:/lg: nas colunas secundárias). Agendamento-v2 também. Não testei explicitamente em viewport mobile, vale conferir.
- **Permissões**: as 4 novas rotas estão liberadas para qualquer usuário com módulo `home`/`dashboard`/`estrategico`/`gestao`/`ferramentas`. Se quiser restringir, editar `route-permissions.ts`.
