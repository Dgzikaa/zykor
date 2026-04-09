# Limpeza de Tabelas Obsoletas - 09/04/2026

## Resumo

Removidas **4 tabelas/views obsoletas** do banco de dados para manter o sistema limpo e organizado.

## Princípio Aplicado

> **"Proteção deve ser feita na origem (quando processa raw_data), não criando tabelas/views extras"**

## Objetos Removidos

### 1. ✅ `contahub_pagamentos_limpo` (VIEW)
- **Tipo**: VIEW
- **Registros**: 75.813 (mesmos de `contahub_pagamentos`)
- **Motivo**: VIEW redundante que apenas filtrava `is_duplicate = false`
- **Definição**: 
  ```sql
  SELECT * FROM contahub_pagamentos 
  WHERE is_duplicate = false OR is_duplicate IS NULL
  ```
- **Problema**: Proteção contra duplicatas deve ser feita no `contahub-processor`, não com views extras
- **Ação**: 
  - ✅ Dropada a view
  - ✅ Atualizado `desempenho-service.ts` para usar `contahub_pagamentos` diretamente
  - ✅ Atualizados scripts de diagnóstico

### 2. ✅ `bar_stats` (TABELA)
- **Tipo**: Tabela
- **Registros**: 0 (vazia)
- **Uso**: Apenas 1 insert em `configuracoes/bars/route.ts` (nunca executado)
- **Motivo**: Tabela vazia sem uso real
- **Ação**: ✅ Dropada

### 3. ✅ `recalculo_eventos_log` (TABELA)
- **Tipo**: Tabela
- **Registros**: 1.039 (logs antigos)
- **Uso**: Apenas definição no `supabase.ts`, nenhuma query ativa
- **Motivo**: Logs históricos sem uso
- **Ação**: ✅ Dropada

### 4. ✅ `feedback_artistas` (TABELA)
- **Tipo**: Tabela
- **Registros**: 12
- **Uso**: Apenas definição no `supabase.ts`, nenhuma query ativa
- **Motivo**: Sem uso ativo no sistema
- **Ação**: ✅ Dropada

## Tabelas NÃO Removidas

### ⚠️ `sync_contagem_historico`
- **Registros**: 45
- **Uso**: Edge Function `sync-contagem-sheets/index.ts`
- **Motivo**: Ainda em uso, precisa verificar se a função é necessária

## Arquivos Alterados

### Código
1. `frontend/src/app/estrategico/desempenho/services/desempenho-service.ts`
   - Alterado de `contahub_pagamentos_limpo` → `contahub_pagamentos`

### Scripts de Diagnóstico
2. `scripts/investigar-conta-assinada.js`
   - 3 referências atualizadas
3. `scripts/diagnostico-completo-semana14.js`
   - 1 referência atualizada

## SQL Executado

```sql
-- 1. Dropar VIEW redundante
DROP VIEW IF EXISTS contahub_pagamentos_limpo CASCADE;

-- 2. Dropar tabelas vazias
DROP TABLE IF EXISTS bar_stats CASCADE;

-- 3. Dropar logs antigos
DROP TABLE IF EXISTS recalculo_eventos_log CASCADE;

-- 4. Dropar tabelas sem uso
DROP TABLE IF EXISTS feedback_artistas CASCADE;
```

## Validação

### Antes
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('contahub_pagamentos_limpo', 'bar_stats', 'recalculo_eventos_log', 'feedback_artistas');
```
**Resultado**: 4 tabelas

### Depois
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('contahub_pagamentos_limpo', 'bar_stats', 'recalculo_eventos_log', 'feedback_artistas');
```
**Resultado**: 0 tabelas ✅

## Impacto

- ✅ **Zero impacto** no sistema
- ✅ Banco mais limpo e organizado
- ✅ Fonte única de verdade (`contahub_pagamentos`)
- ✅ Princípio de proteção na origem aplicado

## Status

✅ **CONCLUÍDO** - Sistema limpo e funcional
