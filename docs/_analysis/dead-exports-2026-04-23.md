# Dead exports / unused deps — análise 2026-04-23

Parte do Prompt 04 (Etapa 3 T2). Análise automática de dead code no `frontend/`.

## Ferramentas

| Ferramenta | Status | Saída |
|------------|--------|-------|
| `npx ts-prune` | ✅ rodou | 513 exports flagged (ver `dead-exports-2026-04-23.raw.txt`) |
| `npx depcheck` | ❌ falhou | erro `ETARGET: No matching version found for postcss@^8.5.10` ao resolver dependências — não bloqueante; precisa reroll do lockfile ou registry antes de rodar |

## Falsos-positivos conhecidos de `ts-prune` no Next.js

- **Convention files**: `instrumentation.ts`, `middleware.ts`, `tailwind.config.ts`, `src/app/**/layout.tsx|page.tsx|loading.tsx|global-error.tsx`, `*.d.ts` — Next.js lê esses por convenção, não por import. Já filtrados no `.raw.txt`.
- **Default exports de componentes**: 97 entradas flagged como `default` — alto risco de falso-positivo porque Next.js usa `dynamic()` e `React.lazy()`, que ts-prune nem sempre detecta.
- **Barrel re-exports**: arquivos re-exportados via `index.ts` às vezes aparecem como dead.

## Distribuição por pasta (513 total)

| Pasta | Count | Observação |
|---|---|---|
| `src/components/` | 273 | alto FP (dynamic imports) |
| `src/lib/` | 114 | revisar caso a caso |
| `src/hooks/` | 52 | menor risco de FP (hooks não são dynamically imported) |
| `src/utils/` | 10 | alvo mais seguro |
| outros | ~64 | convention files + misc |

## Shortlist de alta confiança (T5 — 4 deletados nesta sessão)

Hooks com **1 único export** e **zero callers externos** (verificado via `grep` repo-wide):

| Arquivo | Export | Callers externos |
|---------|--------|-------------------|
| `frontend/src/hooks/useBarLogo.ts` | `useBarLogo` | 0 |
| `frontend/src/hooks/useEventosSync.ts` | `useEventosSync` | 0 |
| `frontend/src/hooks/useFavicon.ts` | `useFavicon` | 0 |
| `frontend/src/hooks/useMenuBadges.ts` | `useMenuBadges` | 0 |

**Gate aplicado:** `npm run type-check` — delta 0 novos erros (apenas 1 erro pré-existente em `src/app/operacional/saude-pipeline/page.tsx:67` — `Cannot find namespace 'JSX'`, não relacionado).

**`npm run build` não rodado nesta sessão** — o erro pré-existente do type-check já faz o build falhar; reparar esse erro é out-of-scope do Prompt 04.

## Shortlist adicional pra revisão humana (não executada)

Candidatos com bom sinal mas que merecem verificação manual (possíveis FPs por dynamic import, uso em server actions, etc.):

### Hooks com múltiplos exports dead
Arquivos onde o hook principal segue usado mas 2+ named exports não. Editar arquivo em vez de deletar:
- `src/hooks/useAssignments.ts` — 8 exports dead (`useAssignments` principal pode estar em uso)
- `src/hooks/useReports.ts` — 5 exports dead
- `src/hooks/useInsightsV2.ts` — 3 exports dead
- `src/hooks/useDataCache.ts` — 5 exports dead

### Hooks simples candidatos a deleção
- `src/hooks/useChecklistBadge.ts`
- `src/hooks/useConfettiClick.ts` (2 exports)
- `src/hooks/useNewYearDetector.ts` (2 exports)
- `src/hooks/usePageLoading.ts` (3 exports dead além do principal)
- `src/hooks/useSGBAssistant.ts`
- `src/hooks/useStableCallback.ts` (2 exports)
- `src/hooks/useTemplates.ts` (3 exports)
- `src/hooks/useBulkSelection.ts`
- `src/hooks/useChecklistEditor.ts`
- `src/hooks/useChecklistExecution.ts` (2 exports)

### PWA & Error handling
Possíveis falsos-positivos — revisar se são registrados em service workers ou error boundaries:
- `src/components/PWAInstallBanner.tsx`, `PWAInstaller.tsx`, `PWAManager.tsx`, `PWAStatus.tsx`
- `src/components/ErrorBoundary.tsx` — `useErrorHandler`, `LoadingError`
- `src/components/LazyLoader.tsx` — `createLazyComponent`, `useLazyLoad`

## Ações recomendadas (fora desta sessão)

1. **Consertar erro TS pré-existente** em `saude-pipeline/page.tsx:67` pra destravar `npm run build` como gate.
2. **Refazer `depcheck`** após investigação do `postcss` resolution issue.
3. **Auditoria manual** dos 114 items em `src/lib/` (maior concentração de dead code real provável).
4. **Auditoria de PWA** — confirmar se os componentes de PWA são referenciados via `manifest.json` ou service worker antes de deletar.
5. **Revisão da shortlist adicional acima** — cada arquivo requer 1 grep repo-wide + 1 revisão de barrel index.

## Arquivos nesta pasta

- `dead-exports-2026-04-23.raw.txt` — saída crua de `ts-prune`, 513 linhas.
- `dead-exports-2026-04-23.md` — este arquivo.
