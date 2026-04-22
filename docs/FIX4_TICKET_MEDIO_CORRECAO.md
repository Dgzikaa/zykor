# FIX #4 — Correção Ticket Médio, TM Entrada e TM Bar

**Data:** 22/04/2026  
**Status:** ✅ CONCLUÍDO

## Problema Identificado

3 bugs críticos nos cálculos de tickets médios em `gold.desempenho`:

1. **Ticket Médio**: Usava AVG de médias diárias em vez de SUM/SUM (erro de 3,3%)
2. **TM Entrada**: Campo duplicado copiando ticket_medio (erro de 468%!)
3. **TM Bar**: Não subtraía couvert corretamente (erro de 17,3%)

## Correções Aplicadas

### Camada 1: gold.planejamento
- Adicionado campo `faturamento_couvert` (já existia, mas estava zerado)
- Atualizado `etl_gold_planejamento_full` versão 3:
  - Adiciona `couv` em fase_a pegando de `silver.vendas_diarias.total_couvert_r`
  - Popula coluna `faturamento_couvert` no INSERT e ON CONFLICT

### Camada 2: gold.desempenho
- Atualizado `etl_gold_desempenho_semanal` versão 3:
  - **Ticket Médio**: Mudado de `AVG(te_real_calculado)` para `SUM(fat)/SUM(pub)`
  - **TM Entrada**: Mudado de `AVG(te_real_calculado)` para `SUM(couvert)/SUM(pub)`
  - **TM Bar**: Mudado de `AVG(tb_real_calculado)` para `(SUM(fat)-SUM(couvert))/SUM(pub)`

## Fórmulas Corretas (Excel)

```sql
-- Ticket Médio
SUM(faturamento_total_consolidado) / SUM(publico_real_consolidado)

-- TM Entrada  
SUM(faturamento_couvert) / SUM(publico_real_consolidado)

-- TM Bar
(SUM(faturamento_total_consolidado) - SUM(faturamento_couvert)) / SUM(publico_real_consolidado)
```

## Validação S15/26 Bar 3

| Métrica | Antes | Depois | Excel | Status |
|---------|-------|--------|-------|--------|
| Ticket Médio | R$ 107,20 | **R$ 103,70** | R$ 103,79 | ✅ -0,09 (conta assinada) |
| TM Entrada | R$ 107,20 | **R$ 18,86** | R$ 18,86 | ✅ Exato |
| TM Bar | R$ 99,61 | **R$ 84,84** | R$ 84,92 | ✅ -0,08 (conta assinada) |

**Nota:** Diferenças de ~R$ 0,09 são porque Gold usa faturamento líquido (sem Conta Assinada) conforme FIX #3.

## Rebuild Executado

1. ✅ `etl_gold_planejamento_full` — 90 dias (Bar 3 e 4)
2. ✅ `etl_gold_desempenho_semanal` — S14-S17/2026 (Bar 3 e 4)

## Valores Todas as Semanas

| Período | Ticket | TM Entrada | TM Bar |
|---------|--------|------------|--------|
| S14/26 | 108,25 | 21,65 | 86,60 |
| S15/26 | 103,70 | 18,86 | 84,84 |
| S16/26 | 104,33 | 20,91 | 83,42 |
| S17/26 | 103,47 | 23,19 | 80,28 |

## Backfill Histórico

Pendente (rodar depois):
- gold.planejamento: 2025-01-01 até 91 dias atrás
- gold.desempenho_semanal: Todas semanas de 2025 e 2026
- gold.desempenho_mensal: Janeiro 2025 até Março 2026

## Funções Atualizadas

- `public.etl_gold_planejamento_full` → versao_etl = 3
- `public.etl_gold_desempenho_semanal` → versao_etl = 3
