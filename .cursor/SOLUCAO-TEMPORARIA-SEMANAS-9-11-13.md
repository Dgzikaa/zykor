# Solução Temporária: Semanas 9, 11 e 13

## Problema Identificado

As semanas 9, 11 e 13 têm **faturamento total incorreto** no banco `desempenho_semanal`, o que faz com que o percentual de Atração/Fat também fique errado.

## Tentativas Realizadas

1. ✅ Recálculo via `recalcular-desempenho-v2` - **Não funcionou** (0 divergências detectadas)
2. ✅ Deletar + Recriar + Recalcular - **Não funcionou** (valores antigos retornaram)

## Causa Provável

O `recalcular-desempenho-v2` está comparando os valores calculados com os valores no banco e considerando-os "próximos o suficiente" (dentro da tolerância de 1%), mesmo quando há divergências grandes.

Ou há algum cache/problema de sincronização que faz os valores antigos retornarem.

## Solução Recomendada

**Usar a API de recálculo legada** que força atualização:

```bash
POST /api/gestao/desempenho/recalcular
```

Esta API tem lógica diferente e pode forçar a atualização mesmo quando há divergências.

## Solução Manual (SQL Direto)

Se a API não funcionar, executar SQL direto no banco:

```sql
-- Semana 9: Corrigir para valores reais dos eventos
UPDATE desempenho_semanal 
SET 
  faturamento_total = 294045.20,
  faturamento_entrada = 57974.00,
  faturamento_bar = 236071.20,
  custo_atracao_faturamento = 10.46,
  atracoes_eventos = 30751.41,
  ticket_medio = 294045.20 / 2223.0,  -- Ajustar conforme clientes reais
  updated_at = NOW()
WHERE bar_id = 3 AND ano = 2025 AND numero_semana = 9;

-- Semana 11
UPDATE desempenho_semanal 
SET 
  faturamento_total = 275510.21,
  faturamento_entrada = 49331.66,
  faturamento_bar = 226178.55,
  custo_atracao_faturamento = 16.86,
  atracoes_eventos = 46459.65,
  updated_at = NOW()
WHERE bar_id = 3 AND ano = 2025 AND numero_semana = 11;

-- Semana 13
UPDATE desempenho_semanal 
SET 
  faturamento_total = 278161.25,
  faturamento_entrada = 46366.24,
  faturamento_bar = 231795.01,
  custo_atracao_faturamento = 17.06,
  atracoes_eventos = 47450.38,
  updated_at = NOW()
WHERE bar_id = 3 AND ano = 2025 AND numero_semana = 13;
```

## Status

⚠️ **Problema Não Resolvido** - Requer intervenção manual ou investigação mais profunda do sistema de recálculo.

## Próximos Passos

1. Tentar API `/api/gestao/desempenho/recalcular`
2. Se não funcionar, executar SQL manual
3. Investigar por que `recalcular-desempenho-v2` não está detectando as divergências
4. Verificar se há outras semanas com o mesmo problema
