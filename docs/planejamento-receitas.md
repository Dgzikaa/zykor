# Planejamento — Nova Área "Receitas"

> Consolidação da reunião de marketing (08/07/2026) + análise dos modelos em `docs/dash/`.
> Objetivo: transformar a apresentação trimestral (o "dioguete") em produto vivo dentro do Zykor,
> unificando **Analítico + Marketing** numa área única de **Receitas**.

## Visão geral

A referência de `docs/dash/` tem **duas camadas**, e o projeto reproduz as duas:

1. **Camada quantitativa** — dashboards interativos com recorte **diário / semanal / mensal**.
2. **Camada narrativa** — os 5 slides "InsightManual" (Problemas, Oportunidades, Reflexões) que hoje
   são montados na mão, gerados por **IA-assistida** (rascunho → sócio edita/aprova).

A área nova **absorve** as rotas de Analítico e Marketing (redirects 308), seguindo o padrão de
`lib/navigation/menu.ts` já usado no menu por áreas.

## Decisões travadas

| Tema | Decisão |
|---|---|
| Capacidade (lotação) | **Configurável por bar** (Ordinário ≠ Deboche). Não hardcodar 650. |
| Menu | Nova **área "Receitas"** absorvendo Analítico + Marketing. |
| Narrativa (Bloco 3) | **IA-assistida**: IA gera rascunho, sócio edita e aprova antes de publicar. |
| Contexto da IA | `eventos_base`/Planejamento **+ campo novo "contexto do período"** preenchido pelos sócios. |
| Dados Meta | Orgânico (alcance/engajamento) **já vem da Graph API** (`integrations.instagram_conta_metricas`, diário). Reportei (`meta.marketing_semanal`) complementa só o **pago** (Meta Ads, Google Ads, GMN). |
| Extras no MVP | **ROAS**, **Novos×Retornantes** e **NPS+benchmark** — todos entram. |

## Bloco 1 — Dashboard de Receitas

Todos os gráficos com toggle **diário/semanal/mensal**. Meses em ano-comercial (últimos 12).

| # | Gráfico | Fórmula | Fonte | Status |
|---|---|---|---|---|
| 1 | **Taxa de Lotação** | (dias abertos × capacidade/dia) vs atendidos; barra + linha % | `gold.desempenho.clientes_atendidos`; dias = `operations.bares.opera_<dia>` | ⚙️ falta config capacidade |
| 2 | **Taxa de Crescimento** | faturamento_total ÷ dias abertos, mês a mês | `gold.desempenho.faturamento_total` | ✅ pronto |
| 2b| **ROAS / gasto comercial** | retorno ÷ (mkt + artistas + produção) | `marketing_semanal` + `c_art` + `c_prod` | ⚙️ novo (dado existe) |
| 3 | **Inputs de crescimento** | reservas/dia · clientes/dia · ticket médio | `gold.desempenho` | ✅ pronto |
| 3b| **Novos × Retornantes** | novos, retornantes, % retorno | RFM (`/analitico/clientes/segmentos`, `retencao`) | ✅ dado existe |
| 4 | **Fat por dia-da-semana × mês** | agrupado por dia da semana; 3 janelas (YoY, mês anterior, tri anterior) | `fn_analise_dia_semana` (nova) | ⚙️ construir |
| 5 | **Clientes Ativos** | evolução base ativa + correlação com fat/dia | `api/clientes-ativos/evolucao` | ✅ pronto |
| 6 | **Satisfação / NPS** | NPS mês a mês + benchmark concorrentes | `silver.nps_diario` (✅) + benchmark (❓ sem fonte) | ⚠️ ver pendência |

**Régua de lotação:** <50% alerta · 50-70% ok · 70-90% boa · +90% excelente.

## Bloco 2 — Comunicação

KPIs (faturamento, reservas, alcance orgânico, engajamento orgânico) com filtro de range
(7/14 dias, mensal, trimestral, semestral, anual + calendário). Orgânico vem da Graph API
(granularidade diária); pago vem do `marketing_semanal`. Reaproveita o merge de `desempenho-service.ts`.

> ⚠️ Orgânico via API só tem histórico desde o início da sync — janelas longas (semestral/anual)
> podem ter buraco. Checar a data do 1º snapshot em `integrations.instagram_conta_metricas`.

## Bloco 3 — Detratores / Promotores (narrativa IA-assistida)

Motor: `gold.fn_analise_dia_semana` — faturamento por dia-da-semana nas 3 janelas de comparação:
1. **YoY** — mesmo mês do ano anterior
2. **MoM** — mês anterior
3. **vs trimestre anterior** — média do tri passado

Alimenta o gráfico do item 4 **e** a narrativa. A IA (Anthropic SDK, já em uso) gera rascunho dos
cards no estilo dos slides InsightManual (Problemas do Tri, Oportunidades do Tri/próximo Tri,
Reflexões), cruzando os deltas com a **camada de contexto** (eventos_base/Planejamento + campo novo
"contexto do período"). Sócio edita e aprova antes de publicar.

## Fase 0 — Fundação (caminho crítico, independe do modelo) — ✅ CONCLUÍDA

- [x] **`<PeriodRangePicker>` compartilhado** — `components/receitas/PeriodRangePicker.tsx` + helper puro
      `lib/receitas/periodo.ts` (granularidade dia/semana/mês + presets 7/14d, mensal, trimestral,
      semestral, anual + calendário custom). TSC limpo.
- [x] **Config de capacidade por bar** — coluna `operations.bares.capacidade_dia` (migration
      `database/migrations/2026-07-08-capacidade-dia-operations-bares.sql`, aplicada em produção).
      Ordinário=650; Deboche/Primo Pobre NULL. Conceito distinto de `eventos_base.capacidade_estimada`
      (por evento, esparso). Falta só a UI de edição em Configurações→Bares (nice-to-have).
- [x] **Área "Receitas" no `menu.ts`** — página `/receitas` (shell do Dashboard) + permissões.
- [x] **Absorção Analítico + Marketing → Receitas** (concluída). Os itens de Analítico (Clientes,
      Eventos, Visão do Artista, Taggear) e Marketing (Instagram, Segmentos RFM, Retenção) viraram
      sub-itens da seção Receitas. **URLs físicas mantidas** (/analitico/*, /marketing/*) — só o
      agrupamento do menu mudou, então **sem redirect e sem link morto**. Retrocompatibilidade de
      permissão via **aliases no resolver** (`analitico_clientes`→`receitas_clientes` etc.) +
      generics da Receita herdando `relatorios`/`analitico`/`gestao` — **zero migração de dados,
      zero regressão** (validado por casos no resolver).

> Nota: se um dia quiserem trocar as URLs para `/receitas/*`, aí sim entram redirects 308 + ajuste
> de links internos — passo cosmético separado, não necessário para a unificação do menu.

## Fases seguintes

- **Fase 1** — Dashboard de Receitas (ordem por esforço): 2 → 3 → 5 → 1 → 4. Extras 2b/3b/6 junto.
- **Fase 2** — Comunicação (KPIs + range).
- **Fase 3** — Ferramenta Detratores/Promotores (`fn_analise_dia_semana` + narrativa IA-assistida + campo de contexto).

## Pendências a resolver antes de codar

1. **Benchmark NPS de concorrentes** (Coco Bambu/Outback/Madero): definir fonte — entrada manual ou provider externo? Sem isso, o card de benchmark fica vazio.
2. **Composição do "gasto comercial"** do ROAS: confirmar que é mkt + artistas + produção e como ratear mensal.
3. **Escopo por bar** do MVP: começar só Ordinário (dono do modelo) ou já os dois bares?
