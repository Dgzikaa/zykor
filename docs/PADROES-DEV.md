# Padrões de Desenvolvimento — Zykor (OBRIGATÓRIO)

> Toda ferramenta/página/API/função nova **DEVE** seguir estes padrões. O objetivo é
> velocidade + consistência: não reinventar, não trazer biblioteca nova, não fugir do
> modelo. Se algo aqui não couber, alinhar ANTES de divergir — não criar um segundo jeito.
>
> Regra de ouro: **já existe um jeito canônico pra quase tudo abaixo. Use-o.**

## 1. Gráficos — SÓ ECharts do hub

- **SEMPRE** usar os componentes de `frontend/src/components/graficos/Charts.tsx`
  (`GraficoLinha`, `GraficoBarra`, `GraficoBarrasAgrupadas`, `GraficoBarraH`, `GraficoDonut`, …).
- Tema/paleta/dark-mode/tooltip vêm de `GraficoBase.tsx` (`useGraficoTheme`, `SERIES_LIGHT/DARK`).
- **PROIBIDO** adicionar recharts, chart.js, react-chartjs-2 ou qualquer outra lib de gráfico.
  Já removemos todas — o bundle tem **uma** lib (ECharts). Caso raro de gráfico bespoke:
  usar `echarts-for-react` (dynamic) + `useGraficoTheme`, nunca outra dependência.

## 2. Busca de dados no cliente — SEMPRE `useApiSWR`

- Usar `frontend/src/hooks/useApiSWR.ts`: `const { data, isLoading, mutate } = useApiSWR<T>(endpoint | null)`.
- A chave **já inclui o bar selecionado** (multi-tenant). Trocar de bar re-busca sozinho.
- **NUNCA** `useState + useEffect(fetch)` novo para GET. Isso re-busca a cada navegação (lento).
- Após POST/PUT/DELETE, atualizar com `mutate()` (não refazer fetch manual).
- **CUIDADO com o shape**: `data` é o corpo CRU do JSON. Ler a chave que a rota REALMENTE
  retorna (`data.lancamentos`, `data.categorias`…), não assumir `data.data`. Conferir a rota.
- Endpoint condicional: passar `null` enquanto não estiver pronto (`useApiSWR(pronto ? '/api/x' : null)`).

## 3. Rota de API (`app/api/**/route.ts`)

- **SEMPRE filtrar por `bar_id`** (regra nº1 do CLAUDE.md). Nunca assumir um bar.
- Auth: `authenticateUser(request)` para rotas que escrevem/são sensíveis; ver `middleware/auth`.
- Service role (bypassa RLS) via `createServiceRoleClient()` / `getSupabaseAdmin()` — rotas
  leem via service role; **client components nunca leem tabela direto**.
- **>1000 linhas**: usar `lib/supabase/paginate.ts` (`paginate`) — Supabase corta em 1000 silenciosamente.
- Schema não-public: `.schema('bronze'|'silver'|'gold'|'financial'|…)`.
- Resposta: objeto com chave **nomeada** e clara (`{ lancamentos, total, totalizadores }`), consistente
  com o que o cliente lê. Erro: `NextResponse.json({ error }, { status })`.
- Lógica pesada de agregação: extrair para um `data.ts` ao lado do route (reutilizável por RSC — ver §6).

## 4. Página nova — CHECKLIST obrigatório

1. Adicionar ao menu: `frontend/src/lib/navigation/menu.ts` (fonte única) com `permission`.
2. Permissão: usar o resolver único (`can(MODULO, acao)` / `hasPermission`), módulo por `categoria_nome`.
3. Título: `usePageTitle().setPageTitle('…')` no mount (não hardcode no header).
4. Layout: `PageShell` / padrão das telas existentes.
5. Dados: `useApiSWR` (§2). Dashboard? Gráficos do hub (§1).
6. Build tem que passar com ESLint (sem `autoFocus`, aspas escapadas). Validar `tsc` local do projeto.

## 5. Banco / SQL

- Arquitetura **medallion**: bronze → silver → gold → operations/financial. Sempre criar camada
  (não misturar). Prefixos de tabela por domínio (`contahub_`, `nibo_`, `cmv_`…); ver `database/CONVENTIONS.md`.
- Views novas: prefixo `v_`; materializadas `mv_`. RPC exposta ao PostgREST precisa grant + schema exposto.
- Função nova: `SET search_path` explícito (incluir `extensions` se usar http/unaccent) e
  `statement_timeout` no NÍVEL DA FUNÇÃO quando longa. RLS + grants revisados (anon nunca executa).
- Nunca deletar dados ContaHub. UPDATE em massa: por período + snapshot.

## 6. Performance — o que faz o sistema voar (aplicar por padrão)

- **Cache (feito p/ ~37 telas)**: `useApiSWR` já dá cache+dedupe+`keepPreviousData` — revisitar é instantâneo.
- **Prefetch**: buscar dados no hover do menu/link (SWR preload) — navegação parece instantânea. [padrão a consolidar]
- **API rápida**: query lenta? Índice/expressão, ou **materializar** (matview + cron refresh) — ver
  `reference_matview_saida_funcao_pattern`. Trabalho pesado = job de fundo (cron), nunca no request.
- **RSC (piloto `painel-executivo`)**: página read-heavy vira Server Component que lê o bar do cookie
  (`sgb_bar_id`), busca no servidor (`data.ts` compartilhada com a rota) e passa como `fallbackData`
  do SWR na ilha client. Degrada seguro. **Limite atual**: bar é per-aba (sessionStorage), então o ganho
  RSC é capado até o bar virar cookie-first — decisão de produto pendente.

## 7. Idioma

- Código (variáveis, funções, tipos): **inglês**. UI, docs, regras de negócio, commits: **pt-BR**.

---

**Enforcement:** este doc é referenciado pelo `CLAUDE.md` (instrução seguida obrigatoriamente).
Ao criar algo novo, seguir o jeito canônico acima; divergência exige alinhamento explícito antes.
