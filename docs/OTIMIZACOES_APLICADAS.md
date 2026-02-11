# Otimizações de Performance Aplicadas - Zykor
**Data:** 2026-02-10
**Atualização:** Varredura completa do sistema (2026-02-10)

---

## 1. Layout principal (app/layout.tsx)

- **CommandPaletteWrapper** – dynamic import com `ssr: false` (carrega após hydration)
- **AuthSync** – dynamic import com `ssr: false`
- **VersionChecker** – dynamic import com `ssr: false`
- Componentes acima passam a ser carregados após a primeira renderização, reduzindo o bundle inicial

## 2. Loading states – COBERTURA COMPLETA

### Raiz e seções principais
- **app/loading.tsx** – skeleton em vez de spinner
- **app/estrategico/loading.tsx** – `VisaoGeralSkeleton`
- **app/ferramentas/loading.tsx** – `OperacoesSkeleton`
- **app/analitico/loading.tsx** – `RelatorioSkeleton`
- **app/configuracoes/loading.tsx** – `ConfiguracoesSkeleton`
- **app/crm/loading.tsx** – `DashboardSkeleton`
- **app/home/loading.tsx** – `DashboardSkeleton`
- **app/retrospectiva-2025/loading.tsx** – `RelatorioSkeleton`
- **app/visao-geral/loading.tsx** – `VisaoGeralSkeleton`
- **app/relatorios/loading.tsx** – `RelatorioSkeleton`

### Seções adicionais (varredura completa)
- **app/suporte/loading.tsx** – `RelatorioSkeleton`
- **app/operacional/loading.tsx** – `OperacoesSkeleton`
- **app/operacoes/loading.tsx** – `OperacoesSkeleton`
- **app/fp/loading.tsx** – `DashboardSkeleton`
- **app/gestao/loading.tsx** – `OperacoesSkeleton`
- **app/alertas/loading.tsx** – `DashboardSkeleton`
- **app/checklists/loading.tsx** – `ChecklistSkeleton`
- **app/notificacoes/loading.tsx** – `RelatorioSkeleton`
- **app/guia-funcionalidades/loading.tsx** – `ConfiguracoesSkeleton`
- **app/assistente/loading.tsx** – `RelatorioSkeleton`
- **app/debug/loading.tsx** – skeleton simples
- **app/minha-conta/loading.tsx** – `ConfiguracoesSkeleton`
- **app/login/loading.tsx** – skeleton formulário
- **app/auth/loading.tsx** – skeleton formulário
- **app/usuarios/loading.tsx** – `ConfiguracoesSkeleton`

## 3. Dynamic imports em páginas

- **AgenteDashboard** (home) – dynamic import com `ssr: false` e loading placeholder
- Páginas com gráficos recharts já estão cobertas por `optimizePackageImports` no Next.js

## 4. next.config.js

- Inclusão de `chart.js`, `react-chartjs-2` e `react-big-calendar` em `optimizePackageImports`
- Já configurados: lucide-react, radix-ui, framer-motion, date-fns, recharts, supabase

## 5. Utilitário de cache (lib/fetch-cache.ts)

- `fetchCached()` – cache em memória com TTL configurável
- `invalidateCache()` – invalidação por prefixo de URL
- Uso opcional em chamadas de API que não precisam de dados em tempo real

## 6. Estrutura existente mantida

- ** DarkSidebarLayout** – já tinha skeleton durante hidratação
- **optimizePackageImports** – tree-shaking para pacotes pesados
- **compress: true** – gzip para respostas
- **Cache-Control** – headers para `_next/static` e fontes
- **removeConsole** – em produção (exceto `error`)

---

## 7. Varredura completa do sistema

### Áreas verificadas
- **135 páginas** (page.tsx) – loading cobrem segmentos pai
- **17 layouts** – com loading em todos os segmentos de rota
- **Imagens** – nenhum `<img>` nativo; uso de `next/image`
- **Recharts** – tree-shaking via optimizePackageImports em ~15 arquivos
- **Error boundaries** – layout raiz, DarkSidebarLayout, DashboardLayout
- **Libs** – api-cache, useDataCache, fetch-cache, lazy-components disponíveis
- **APIs** – revalidate em rotas estratégicas (60–300s)

### Estrutura existente mantida
- `lib/lazy-components.tsx` – LazyRechartsWrapper, LazyCalendar, LazyModernSidebar
- `lib/api-cache.ts` – CACHE_TIMES e createCacheHeaders
- `hooks/useDataCache.ts` – cache client-side com TTL
- `lib/fetch-cache.ts` – cache para fetch (novo)

---

## Uso do fetch com cache

```typescript
import { fetchCached, invalidateCache } from '@/lib/fetch-cache';

// GET com cache de 2 minutos
const res = await fetchCached('/api/dados', undefined, 2 * 60 * 1000);
const data = await res.json();

// Após mutation
invalidateCache('/api/dados');
```
