# Investigação: financial.dre_manual — 82 rows legacy com bar_id NULL

**Data:** 2026-04-26
**Origin:** follow-up #45

## Contexto

Durante `sec/03` (defesa em camadas pra `dre_manual`), 82 rows com `bar_id IS NULL` foram preservadas (pré-CHECK constraint cutoff). A política aceita `bar_id NULL` apenas pro histórico legado. Pergunta: deve-se backfillar essas 82 rows com bar_id inferido, ou manter NULL?

## Queries rodadas

### Distribuição temporal

```sql
SELECT date_trunc('month', criado_em)::date AS mes, COUNT(*)
FROM financial.dre_manual WHERE bar_id IS NULL
GROUP BY 1 ORDER BY 1;
```

| mes | rows |
|-----|------|
| 2025-09-01 | 82 |

→ **Todas as 82 rows criadas em 2025-09 (bulk import único).**

### Totais

```sql
SELECT COUNT(*) AS total,
  COUNT(*) FILTER (WHERE bar_id IS NULL) AS null_bar,
  COUNT(*) FILTER (WHERE bar_id = 3) AS bar_3,
  COUNT(*) FILTER (WHERE bar_id = 4) AS bar_4,
  MIN(data_competencia), MAX(data_competencia)
FROM financial.dre_manual;
```

| total | null_bar | bar_3 | bar_4 | min_data | max_data |
|-------|----------|-------|-------|----------|----------|
| 82 | **82** | 0 | 0 | 2025-02-01 | 2025-09-15 |

→ **A tabela inteira é só legacy NULL.** Não existem rows com bar_id atribuído. Isso muda completamente o panorama: não é "82 rows legadas no meio de N mais novas" — é a totalidade da tabela.

### Padrões nas 82 rows

| categoria_macro | categoria | rows | min_data | max_data |
|-----------------|-----------|------|----------|----------|
| Custo insumos (CMV) | Custo Bebidas | 17 | 2025-02 | 2025-09 |
| Custo insumos (CMV) | Custo Comida | 14 | 2025-02 | 2025-08 |
| Não Operacionais | Contratos | 13 | 2025-02 | 2025-08 |
| Custo insumos (CMV) | Custo Drinks | 8 | 2025-02 | 2025-08 |
| Despesas Comerciais | Produção Eventos | 7 | 2025-02 | 2025-08 |
| Despesas Comerciais | Marketing | 7 | 2025-02 | 2025-08 |
| Sócios | Outros Sócios | 6 | 2025-02 | 2025-08 |
| Despesas Administrativas | Recursos Humanos | 5 | 2025-04 | 2025-08 |
| Despesas Administrativas | Escritório Central | 2 | 2025-02 | 2025-03 |
| Despesas de Ocupação | LUZ | 3 | 2025-05 | 2025-07 |

### Contexto: bares no sistema

| id | nome | criado_em |
|----|------|-----------|
| 3 | Ordinário Bar | 2025-07-01 |
| 4 | Deboche Bar | 2025-07-01 |

→ **Bares foram criados em 2025-07-01.** Os dados de `dre_manual` começam em **2025-02-01** — 5 meses **ANTES** dos bares existirem na plataforma Zykor.

## Findings

1. **Dados são pre-Zykor.** 82 rows cobrem competência 2025-02 a 2025-09. Os bares foram cadastrados na plataforma só em 2025-07-01. Logo:
   - Período 2025-02 a 2025-06 (~50 rows): dados de operação ANTES da plataforma — provavelmente do **Ordinário Bar** (que existia antes de Zykor).
   - Período 2025-07 a 2025-09 (~32 rows): dados pós-criação dos bares, mas ainda no formato legacy de bulk import.

2. **Bulk import único em 2025-09-07** — todas criadas no mesmo dia/momento, sugere migração inicial de planilha histórica.

3. **Não é possível inferir bar_id com certeza** sem contexto manual:
   - Categorias como "Custo Bebidas" / "Marketing" / "LUZ" aparecem em ambos os bares
   - Sem campo `descricao_origem`, `centro_custo`, ou `unidade` que indique
   - **Despesas Administrativas → Escritório Central** sugere centralizado (não específico de bar) — não é atribuível.

4. **Sem CRM/contábil de origem visível** que permitiria backfill automatizado.

## Recomendação

**KEEP NULL com flag explícita** — não inferir, não arquivar. Marcar como legacy histórico.

### Próximas ações

1. **Adicionar coluna flag** (migration leve):
   ```sql
   ALTER TABLE financial.dre_manual
     ADD COLUMN IF NOT EXISTS legacy_pre_multi_tenant boolean
     GENERATED ALWAYS AS (bar_id IS NULL AND data_competencia < '2025-10-01') STORED;
   ```
   Coluna gerada — sem manutenção.

2. **Atualizar UI** (frontend):
   - Filtros em `/dre` devem distinguir "Histórico legado" de "Por bar"
   - Quando `bar_id IS NULL` e `legacy_pre_multi_tenant=true`: exibir badge "📜 Legado pré-multi-tenant"
   - Cálculos consolidados (soma total) podem opcionalmente incluir/excluir legados

3. **NÃO backfill automatizado** — ROI ~zero, risco de atribuir errado a um bar (auditoria contábil futura sofre).

4. **Reabrir #45 em 6 meses** se surgir contexto novo (planilhas originais, pessoas que lembrem da divisão, etc).

### Alternativa rejeitada: arquivar em `financial.dre_manual_archive`

Não vale a pena — relatórios consolidados perdem visibilidade do histórico, e tabela `dre_manual` fica vazia até que comecem a ter inputs novos com bar_id.

**Verdict #45: KEEP NULL + flag GENERATED + UI badge. Sem backfill. Reabrir só se surgir contexto manual confiável.**
