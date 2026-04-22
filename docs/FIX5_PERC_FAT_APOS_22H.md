# FIX #5 — % Faturamento Após 22h

**Data:** 22/04/2026  
**Status:** ✅ CONCLUÍDO

## Problema

Faltava métrica de % Faturamento Após 22h para complementar o split horário iniciado anteriormente (já existia % até 19h).

## Solução Implementada

### Fórmula Excel
```
% Fat Após 22h = SUM(valor WHERE hora IN (22:00, 23:00, 00:00-04:00)) / SUM(valor total)
```

**Observação:** O bronze usa formato "22:00", "23:00", "24:00", "25:00", "26:00", "27:00", "28:00" para madrugada.

### Alterações

1. **gold.planejamento** - Adicionadas colunas:
   - `fat_apos_22h` numeric(14,2)
   - `fat_apos_22h_percent` numeric(5,2)

2. **gold.desempenho** - Coluna já existia:
   - `perc_faturamento_apos_22h` numeric(5,2)

3. **etl_gold_planejamento_full** - versão 4:
   - Fase `fase_fat_hora` atualizada:
     ```sql
     SUM(valor) FILTER (WHERE hora IN ('22:00', '23:00', '24:00', '25:00', '26:00', '27:00', '28:00')) 
       as fat_apos_22h
     ```
   - Cálculo de percentual adicionado no INSERT

4. **etl_gold_desempenho_semanal** - versão 4:
   - Fase `fase_planejamento` atualizada:
     ```sql
     AVG(fat_apos_22h_percent) FILTER (WHERE fat_apos_22h_percent > 0) 
       as perc_fat_apos_22h
     ```
   - Campo propagado no INSERT e ON CONFLICT

## Validação

### Semanas 14-17/2026 (Bar 3)

| Período | % até 19h | % após 22h | Clientes |
|---------|-----------|------------|----------|
| S14/26 | 8,21% | 34,11% | 3.401 |
| S15/26 | 9,52% | 37,31% | 3.691 |
| S16/26 | 11,30% | 35,28% | 4.513 |
| S17/26 | 3,25% | 49,09% | 566 |

✅ **Valores consistentes:** 34-49% após 22h é esperado para bares, sendo a maior concentração de faturamento.

## Rebuild Executado

- ✅ `etl_gold_planejamento_full` — 28 dias (30/03-26/04) Bar 3 e 4
- ✅ `etl_gold_desempenho_semanal` — S14-S17/2026 Bar 3 e 4

## Funções Atualizadas

- `public.etl_gold_planejamento_full` → versao_etl = 4
- `public.etl_gold_desempenho_semanal` → versao_etl = 4

## Observações

- Função mensal precisa ser atualizada manualmente ou será atualizada no próximo deploy
- Backfill histórico pendente (rodar quando necessário)
