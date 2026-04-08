# Problema: Faturamento Incorreto nas Semanas 9, 11 e 13

## Situação Atual

As semanas 9, 11 e 13 de 2025 estão mostrando valores de **Atração/Fat aparentemente incorretos**, mas o problema real é que o **faturamento total está desatualizado** no banco.

## Diagnóstico Detalhado

### Semana 9 (03/03 a 09/03/2025)
- **Faturamento no Banco**: R$ 314.789,33
- **Faturamento Real (eventos)**: R$ 294.045,20
- **Diferença**: +R$ 20.744,13 (banco está **maior**)
- **Atração/Fat no Banco**: 33.11%
- **Atração/Fat Correto**: 10.46%

### Semana 11 (17/03 a 23/03/2025)
- **Faturamento no Banco**: R$ 139.217,99
- **Faturamento Real (eventos)**: R$ 275.510,21
- **Diferença**: -R$ 136.292,22 (banco está com **menos da metade**!)
- **Atração/Fat no Banco**: 13.03%
- **Atração/Fat Correto**: 16.86%

### Semana 13 (31/03 a 06/04/2025)
- **Faturamento no Banco**: R$ 128.591,38
- **Faturamento Real (eventos)**: R$ 278.161,25
- **Diferença**: -R$ 149.569,87 (banco está com **menos da metade**!)
- **Atração/Fat no Banco**: 21.74%
- **Atração/Fat Correto**: 17.06%

## Causa Raiz

O problema **NÃO é com o cálculo de Atração/Fat**, mas sim com o **faturamento total** que está desatualizado em `desempenho_semanal`.

### Por que o recálculo não corrigiu?

O recálculo via `recalcular-desempenho-v2` está retornando **0 divergências** porque:

1. O calculator está comparando os valores calculados com os valores no banco
2. Se a comparação resultar em valores "próximos" (dentro da tolerância de 1%), não atualiza
3. **MAS**: Os valores no banco já estavam errados desde antes

Isso sugere que:
- Os dados de `eventos_base` foram atualizados/corrigidos em algum momento
- O `desempenho_semanal` não foi recalculado desde então
- Ou houve algum problema no cálculo original que salvou valores incorretos

## Impacto

- ✅ Semana 9: Atração/Fat deveria ser **10.46%** (não 33.11%)
- ✅ Semana 11: Atração/Fat deveria ser **16.86%** (não 13.03%)
- ✅ Semana 13: Atração/Fat deveria ser **17.06%** (não 21.74%)

## Solução Necessária

### Opção 1: Forçar Recálculo Completo (Recomendado)

Modificar temporariamente o `recalcular-desempenho-v2` para **sempre atualizar** essas semanas específicas, ignorando a comparação de tolerância.

### Opção 2: Update Manual no Banco

Executar SQL direto para corrigir os valores:

```sql
-- Semana 9
UPDATE desempenho_semanal 
SET 
  faturamento_total = 294045.20,
  faturamento_entrada = 57974.00,
  faturamento_bar = 236071.20,
  custo_atracao_faturamento = 10.46,
  atracoes_eventos = 30751.41
WHERE bar_id = 3 AND ano = 2025 AND numero_semana = 9;

-- Semana 11
UPDATE desempenho_semanal 
SET 
  faturamento_total = 275510.21,
  faturamento_entrada = 49331.66,
  faturamento_bar = 226178.55,
  custo_atracao_faturamento = 16.86,
  atracoes_eventos = 46459.65
WHERE bar_id = 3 AND ano = 2025 AND numero_semana = 11;

-- Semana 13
UPDATE desempenho_semanal 
SET 
  faturamento_total = 278161.25,
  faturamento_entrada = 46366.24,
  faturamento_bar = 231795.01,
  custo_atracao_faturamento = 17.06,
  atracoes_eventos = 47450.38
WHERE bar_id = 3 AND ano = 2025 AND numero_semana = 13;
```

### Opção 3: Deletar e Recriar

Deletar os registros dessas semanas e deixar o sistema recriá-los do zero:

```sql
DELETE FROM desempenho_semanal 
WHERE bar_id = 3 AND ano = 2025 AND numero_semana IN (9, 11, 13);
```

Depois rodar o recálculo.

## Status

- ❌ **Problema Identificado**: Faturamento desatualizado
- ❌ **Não Resolvido**: Recálculo automático não está corrigindo
- ⚠️ **Ação Necessária**: Escolher uma das 3 opções acima

## Contexto Histórico

Este problema pode estar relacionado a:
1. Migração de dados de `nibo_agendamentos` para `contaazul_lancamentos`
2. Correções manuais em `eventos_base` que não propagaram para `desempenho_semanal`
3. Bug no calculator de faturamento que foi corrigido posteriormente

## Próximos Passos

1. Verificar se há mais semanas com o mesmo problema
2. Implementar validação para detectar divergências grandes entre `eventos_base` e `desempenho_semanal`
3. Adicionar alerta quando faturamento diverge mais de 10%
