# CORREÇÕES NECESSÁRIAS PARA O DEBOCHE (bar_id=4)

Data: 03/03/2026
Status: **INVESTIGAÇÃO COMPLETA - AGUARDANDO IMPLEMENTAÇÃO**

---

## 🔍 PROBLEMAS IDENTIFICADOS

### 1. %drinks, %bebidas, %comidas SEMPRE VAZIOS ❌
**Causa Raiz**: A função `calculate_evento_metrics` usa mapeamento hardcoded do Ordinário Bar.

**Mapeamento Atual (Ordinário - bar_id=3)**:
- **Bebidas**: `'Chopp','Baldes','Pegue e Pague','PP','Venda Volante','Bar'`
- **Comidas**: `'Cozinha','Cozinha 1','Cozinha 2'`
- **Drinks**: `'Preshh','Drinks','Drinks Autorais','Mexido','Shot e Dose','Batidos'`

**Mapeamento Correto (Deboche - bar_id=4)**:
- **Bebidas**: `'Salão'`
- **Comidas**: `'Cozinha 1','Cozinha 2'`
- **Drinks**: `'Bar'` ⚠️ **ATENÇÃO: No Deboche, 'Bar' = Drinks, não Bebidas!**

**Arquivos Afetados**:
- `database/functions/calculate_evento_metrics.sql` (linhas 121-142)
- `database/functions/calculate_evento_metrics_fixed.sql` (linhas 112-133)

---

### 2. %stockout SEMPRE VAZIO ❌
**Causa Provável**: Mesmo problema de mapeamento. A função de stockout também deve estar usando os locais errados.

**Arquivos a Verificar**:
- `backend/supabase/functions/contahub-stockout-sync/index.ts`
- Verificar se está filtrando por `bar_id=4` corretamente

---

### 3. Custo Artístico e de Produção INCORRETOS ❌
**Causa Provável**: Integração NIBO não está buscando dados do Deboche ou categorias estão mapeadas errado.

**Arquivos a Verificar**:
- `backend/supabase/functions/nibo-sync/index.ts`
- Verificar se está sincronizando para `bar_id=4`
- Verificar mapeamento de categorias NIBO → Deboche

---

### 4. Tabela de Desempenho COM INDICADORES ERRADOS ❌
**Problema**: A tabela de desempenho semanal tem indicadores diferentes entre os bares:

**Ordinário (bar_id=3)**:
- QUI+SÁB+DOM (fim de semana)

**Deboche (bar_id=4)**:
- TER+QUA+QUI (meio de semana)
- SEX+SÁB (fim de semana)

**Solução**: Criar lógica condicional por `bar_id` na página de desempenho.

**Arquivo a Modificar**:
- `frontend/src/app/estrategico/desempenho/page.tsx`

---

### 5. Nomenclatura Errada no Stockout ❌
**Problema**: 3º card mostra "Bar" mas deveria mostrar "Drinks" (para o Deboche).

**Arquivo a Modificar**:
- `frontend/src/app/ferramentas/stockout/page.tsx`

---

## ✅ SOLUÇÕES PROPOSTAS

### SOLUÇÃO 1: Criar Tabela de Mapeamento Dinâmico

```sql
-- Criar tabela de configuração
CREATE TABLE bar_local_mapeamento (
  id SERIAL PRIMARY KEY,
  bar_id INTEGER REFERENCES bars(id),
  categoria VARCHAR(20) CHECK (categoria IN ('bebidas', 'comidas', 'drinks')),
  locais TEXT[] NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  UNIQUE(bar_id, categoria)
);

-- Inserir mapeamentos
INSERT INTO bar_local_mapeamento (bar_id, categoria, locais) VALUES
  -- Ordinário
  (3, 'bebidas', ARRAY['Chopp','Baldes','Pegue e Pague','PP','Venda Volante']),
  (3, 'comidas', ARRAY['Cozinha','Cozinha 1','Cozinha 2']),
  (3, 'drinks', ARRAY['Preshh','Drinks','Drinks Autorais','Mexido','Shot e Dose','Batidos','Bar']),
  -- Deboche
  (4, 'bebidas', ARRAY['Salão']),
  (4, 'comidas', ARRAY['Cozinha 1','Cozinha 2']),
  (4, 'drinks', ARRAY['Bar']);

-- Criar função helper
CREATE OR REPLACE FUNCTION get_locais_por_categoria(p_bar_id INTEGER, p_categoria VARCHAR)
RETURNS TEXT[] AS $$
  SELECT locais FROM bar_local_mapeamento
  WHERE bar_id = p_bar_id AND categoria = p_categoria AND ativo = TRUE;
$$ LANGUAGE sql STABLE;
```

### SOLUÇÃO 2: Atualizar função `calculate_evento_metrics`

Substituir as linhas hardcoded por:

```sql
-- ANTES (hardcoded):
SUM(CASE WHEN loc_desc IN ('Chopp','Baldes','PP','Bar') THEN valorfinal ELSE 0 END) as valor_bebidas

-- DEPOIS (dinâmico):
SUM(CASE WHEN loc_desc = ANY(get_locais_por_categoria(evento_record.bar_id, 'bebidas')) 
  THEN valorfinal ELSE 0 END) as valor_bebidas
```

### SOLUÇÃO 3: Adaptar Página de Desempenho

```typescript
// frontend/src/app/estrategico/desempenho/page.tsx

const indicadoresPorBar = {
  3: [ // Ordinário
    { label: 'QUI+SÁB+DOM', dias: ['Quinta', 'Sábado', 'Domingo'] }
  ],
  4: [ // Deboche
    { label: 'TER+QUA+QUI', dias: ['Terça', 'Quarta', 'Quinta'] },
    { label: 'SEX+SÁB', dias: ['Sexta', 'Sábado'] }
  ]
};

const indicadores = indicadoresPorBar[barId] || indicadoresPorBar[3];
```

### SOLUÇÃO 4: Corrigir Nomenclatura no Stockout

```typescript
// frontend/src/app/ferramentas/stockout/page.tsx

const nomeCategorias = {
  3: { // Ordinário
    local1: 'Salão',
    local2: 'Cozinha',
    local3: 'Bar'
  },
  4: { // Deboche
    local1: 'Salão',
    local2: 'Cozinha',
    local3: 'Drinks' // ← MUDANÇA AQUI
  }
};
```

---

## 📋 PLANO DE AÇÃO

### FASE 1: Banco de Dados (CRÍTICO) 🔴
1. [ ] Aplicar migration `fix_deboche_mapeamento_locais.sql`
2. [ ] Atualizar função `calculate_evento_metrics` para usar mapeamento dinâmico
3. [ ] Atualizar função `calculate_evento_metrics_fixed` (se ainda em uso)
4. [ ] Recalcular todos os eventos do Deboche: `SELECT calculate_evento_metrics(id) FROM eventos_base WHERE bar_id=4;`

### FASE 2: Verificar Integrações 🟡
5. [ ] Verificar se NIBO sync está pegando dados do Deboche
6. [ ] Verificar se ContaHub sync está pegando dados do Deboche
7. [ ] Verificar se há dados em `contahub_analitico` para `bar_id=4`

### FASE 3: Frontend 🟢
8. [ ] Adaptar página de Desempenho com indicadores por bar
9. [ ] Corrigir nomenclatura no Stockout
10. [ ] Testar Planejamento Comercial do Deboche

### FASE 4: Validação ✅
11. [ ] Verificar se %drinks aparece no Planejamento Comercial
12. [ ] Verificar se %stockout aparece corretamente
13. [ ] Verificar se custos artístico/produção estão corretos
14. [ ] Verificar se desempenho tem os indicadores certos

---

## 🚨 COMANDOS ÚTEIS PARA INVESTIGAÇÃO

```sql
-- 1. Verificar se há dados do Deboche no ContaHub
SELECT COUNT(*), MIN(trn_dtgerencial), MAX(trn_dtgerencial)
FROM contahub_analitico
WHERE bar_id = 4;

-- 2. Ver locais únicos do Deboche
SELECT DISTINCT loc_desc, COUNT(*) as total
FROM contahub_analitico
WHERE bar_id = 4
GROUP BY loc_desc
ORDER BY total DESC;

-- 3. Ver eventos recentes do Deboche
SELECT data_evento, nome, percent_b, percent_d, percent_c, percent_stockout
FROM eventos_base
WHERE bar_id = 4
ORDER BY data_evento DESC
LIMIT 10;

-- 4. Recalcular um evento específico
SELECT calculate_evento_metrics(12345); -- substituir pelo ID real

-- 5. Verificar configuração NIBO do Deboche
SELECT * FROM nibo_config WHERE bar_id = 4;
```

---

## 📝 NOTAS IMPORTANTES

1. **BACKUP ANTES DE TUDO**: Fazer backup da função `calculate_evento_metrics` antes de modificar
2. **TESTAR EM STAGING**: Se possível, testar em ambiente de staging primeiro
3. **RECALCULAR EVENTOS**: Após aplicar as correções, TODOS os eventos do Deboche precisam ser recalculados
4. **MONITORAR PERFORMANCE**: A função `get_locais_por_categoria` será chamada muitas vezes, verificar performance

---

## 🔗 ARQUIVOS RELACIONADOS

- `database/functions/calculate_evento_metrics.sql`
- `database/functions/calculate_evento_metrics_fixed.sql`
- `frontend/src/app/estrategico/planejamento-comercial/services/planejamento-service.ts`
- `frontend/src/app/estrategico/desempenho/page.tsx`
- `frontend/src/app/ferramentas/stockout/page.tsx`
- `backend/supabase/functions/nibo-sync/index.ts`
- `backend/supabase/functions/contahub-sync/index.ts`

---

**Status Final**: Investigação completa. Aguardando aprovação para implementar as correções.
