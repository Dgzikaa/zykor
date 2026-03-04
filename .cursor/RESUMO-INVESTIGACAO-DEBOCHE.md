# RESUMO DA INVESTIGAÇÃO - DEBOCHE (bar_id=4)

**Data**: 03/03/2026  
**Status**: ✅ **INVESTIGAÇÃO COMPLETA + CORREÇÕES FRONTEND APLICADAS**

---

## 📊 PROBLEMAS IDENTIFICADOS E SOLUÇÕES

### ✅ 1. FRONTEND - Stockout (CORRIGIDO)
**Problema**: 3º card mostrava "Bar" ao invés de "Drinks" para o Deboche.

**Solução Aplicada**: 
- Arquivo: `frontend/src/app/ferramentas/stockout/page.tsx`
- Criado mapeamento dinâmico por `bar_id`:
  - **Ordinário (3)**: Bebidas, Comidas, Drinks (com 'Bar' em Drinks)
  - **Deboche (4)**: Bebidas (Salão), Comidas (Cozinha 1/2), Drinks (Bar)

**Status**: ✅ **IMPLEMENTADO**

---

### ✅ 2. FRONTEND - Desempenho (CORRIGIDO)
**Problema**: Tabela de desempenho tinha indicadores errados para o Deboche.

**Solução Aplicada**:
- Arquivo: `frontend/src/app/estrategico/desempenho/components/DesempenhoClient.tsx`
- Criado lógica condicional por `bar_id`:
  - **Ordinário (3)**: QUI+SÁB+DOM
  - **Deboche (4)**: TER+QUA+QUI e SEX+SÁB

**Status**: ✅ **IMPLEMENTADO**

---

### ⚠️ 3. BANCO DE DADOS - Mapeamento de Locais (PENDENTE)
**Problema**: Função `calculate_evento_metrics` usa mapeamento hardcoded do Ordinário, causando:
- %drinks sempre vazio
- %bebidas sempre vazio  
- %comidas sempre vazio
- %stockout sempre vazio

**Causa Raiz**:
```sql
-- Mapeamento ATUAL (hardcoded para Ordinário):
SUM(CASE WHEN loc_desc IN ('Chopp','Baldes','PP','Bar') THEN valorfinal ELSE 0 END) as valor_bebidas
SUM(CASE WHEN loc_desc IN ('Cozinha','Cozinha 1','Cozinha 2') THEN valorfinal ELSE 0 END) as valor_comidas
SUM(CASE WHEN loc_desc IN ('Preshh','Drinks','Mexido','Batidos') THEN valorfinal ELSE 0 END) as valor_drinks
```

**Mapeamento Correto por Bar**:

| Categoria | Ordinário (bar_id=3) | Deboche (bar_id=4) |
|-----------|----------------------|--------------------|
| **Bebidas** | Chopp, Baldes, PP, Venda Volante | **Salão** |
| **Comidas** | Cozinha, Cozinha 1, Cozinha 2 | Cozinha 1, Cozinha 2 |
| **Drinks** | Preshh, Drinks, Mexido, Batidos, **Bar** | **Bar** ⚠️ |

⚠️ **ATENÇÃO**: No Deboche, 'Bar' = Drinks (não Bebidas!)

**Solução Proposta**:
1. Criar tabela `bar_local_mapeamento` com configuração por bar
2. Criar função `get_locais_por_categoria(bar_id, categoria)`
3. Atualizar `calculate_evento_metrics` para usar mapeamento dinâmico

**Arquivos Criados**:
- `.cursor/DEBOCHE-FIXES-NECESSARIAS.md` (documentação completa)
- Migration SQL pronta (precisa ser aplicada no banco)

**Status**: ⚠️ **PENDENTE - REQUER APLICAÇÃO NO BANCO**

---

### ⚠️ 4. INTEGRAÇÕES - NIBO e ContaHub (PENDENTE VERIFICAÇÃO)
**Problema**: Custo artístico e de produção podem estar incorretos.

**Possíveis Causas**:
1. NIBO sync não está sincronizando dados do Deboche (bar_id=4)
2. Categorias NIBO estão mapeadas incorretamente
3. ContaHub sync não está coletando dados do Deboche

**Ações Necessárias**:
```sql
-- Verificar se há dados do Deboche
SELECT COUNT(*), MIN(trn_dtgerencial), MAX(trn_dtgerencial)
FROM contahub_analitico
WHERE bar_id = 4;

-- Verificar configuração NIBO
SELECT * FROM nibo_config WHERE bar_id = 4;

-- Verificar últimos syncs
SELECT * FROM sync_logs 
WHERE bar_id = 4 
ORDER BY created_at DESC 
LIMIT 10;
```

**Status**: ⚠️ **PENDENTE VERIFICAÇÃO**

---

## 🎯 PLANO DE AÇÃO FINAL

### FASE 1: Aplicar Correções no Banco (CRÍTICO) 🔴
```sql
-- 1. Criar tabela de mapeamento
CREATE TABLE bar_local_mapeamento (...);

-- 2. Inserir mapeamentos
INSERT INTO bar_local_mapeamento (bar_id, categoria, locais) VALUES
  (3, 'bebidas', ARRAY['Chopp','Baldes','PP','Venda Volante']),
  (3, 'comidas', ARRAY['Cozinha','Cozinha 1','Cozinha 2']),
  (3, 'drinks', ARRAY['Preshh','Drinks','Mexido','Batidos','Bar']),
  (4, 'bebidas', ARRAY['Salão']),
  (4, 'comidas', ARRAY['Cozinha 1','Cozinha 2']),
  (4, 'drinks', ARRAY['Bar']);

-- 3. Criar função helper
CREATE FUNCTION get_locais_por_categoria(p_bar_id INTEGER, p_categoria VARCHAR) ...;

-- 4. Atualizar calculate_evento_metrics
-- Substituir hardcoded por: loc_desc = ANY(get_locais_por_categoria(bar_id, 'bebidas'))

-- 5. Recalcular TODOS os eventos do Deboche
SELECT calculate_evento_metrics(id) 
FROM eventos_base 
WHERE bar_id = 4;
```

**Tempo Estimado**: 30-60 minutos  
**Impacto**: ALTO - Resolve %drinks, %bebidas, %comidas, %stockout

---

### FASE 2: Verificar Integrações 🟡
1. Verificar se há dados em `contahub_analitico` para bar_id=4
2. Verificar se NIBO sync está funcionando para o Deboche
3. Verificar se categorias NIBO estão corretas
4. Testar sync manual se necessário

**Tempo Estimado**: 15-30 minutos  
**Impacto**: MÉDIO - Garante dados corretos de custos

---

### FASE 3: Validação Final ✅
1. Acessar Planejamento Comercial do Deboche
2. Verificar se %drinks, %bebidas, %comidas aparecem
3. Verificar se %stockout aparece
4. Verificar se custos artístico/produção estão corretos
5. Verificar se Desempenho tem TER+QUA+QUI e SEX+SÁB
6. Verificar se Stockout mostra "Drinks" ao invés de "Bar"

**Tempo Estimado**: 10 minutos  
**Impacto**: Confirmação de que tudo está funcionando

---

## 📁 ARQUIVOS MODIFICADOS

### Frontend (✅ Aplicados)
1. `frontend/src/app/ferramentas/stockout/page.tsx` - Mapeamento dinâmico
2. `frontend/src/app/estrategico/desempenho/components/DesempenhoClient.tsx` - Indicadores por bar

### Documentação (✅ Criados)
3. `.cursor/DEBOCHE-FIXES-NECESSARIAS.md` - Documentação técnica completa
4. `.cursor/RESUMO-INVESTIGACAO-DEBOCHE.md` - Este arquivo

### Banco de Dados (⚠️ Pendente)
5. Migration SQL para criar `bar_local_mapeamento` (pronta, não aplicada)
6. Atualização de `calculate_evento_metrics` (código pronto, não aplicado)

---

## 🚨 COMANDOS ÚTEIS

### Verificar Dados do Deboche
```sql
-- Eventos recentes
SELECT data_evento, nome, percent_b, percent_d, percent_c, percent_stockout, real_r
FROM eventos_base
WHERE bar_id = 4
ORDER BY data_evento DESC
LIMIT 10;

-- Locais únicos no ContaHub
SELECT DISTINCT loc_desc, COUNT(*) as total
FROM contahub_analitico
WHERE bar_id = 4
GROUP BY loc_desc
ORDER BY total DESC;

-- Verificar se mapeamento foi criado
SELECT * FROM bar_local_mapeamento WHERE bar_id = 4;
```

### Recalcular Eventos
```sql
-- Recalcular evento específico
SELECT calculate_evento_metrics(12345);

-- Recalcular todos do Deboche
SELECT calculate_evento_metrics(id) 
FROM eventos_base 
WHERE bar_id = 4;
```

---

## 📝 NOTAS IMPORTANTES

1. **Backup Obrigatório**: Fazer backup da função `calculate_evento_metrics` antes de modificar
2. **Recálculo Necessário**: Após aplicar correções, TODOS os eventos do Deboche precisam ser recalculados
3. **Performance**: A função `get_locais_por_categoria` será chamada muitas vezes - monitorar performance
4. **Teste em Staging**: Se possível, testar em ambiente de staging primeiro

---

## ✅ CHECKLIST FINAL

### Frontend
- [x] Corrigir nomenclatura no Stockout (Bar → Drinks)
- [x] Adaptar indicadores de Desempenho (TER+QUA+QUI e SEX+SÁB)

### Banco de Dados
- [ ] Aplicar migration `bar_local_mapeamento`
- [ ] Atualizar função `calculate_evento_metrics`
- [ ] Recalcular eventos do Deboche

### Integrações
- [ ] Verificar NIBO sync para bar_id=4
- [ ] Verificar ContaHub sync para bar_id=4
- [ ] Verificar dados em `contahub_analitico`

### Validação
- [ ] Testar Planejamento Comercial do Deboche
- [ ] Testar Desempenho do Deboche
- [ ] Testar Stockout do Deboche
- [ ] Verificar custos artístico/produção

---

**Próximos Passos**: Aplicar migration no banco e recalcular eventos do Deboche.

**Tempo Total Estimado**: 1-2 horas (incluindo testes)

**Prioridade**: 🔴 **ALTA** - Sistema não está funcionando corretamente para o Deboche
