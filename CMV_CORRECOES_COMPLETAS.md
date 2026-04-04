# Correções Completas: CMV Semanal - Propagação de Estoque

**Data:** 2026-04-02  
**Status:** ✅ Implementado (aguardando deploy)

---

## 🎯 Problemas Corrigidos

### 1. Estoque Inicial não batia com Final da semana anterior

**Sintoma:**
- Semana 9: Estoque Final = R$ 110.453,96
- Semana 10: Estoque Inicial = valor diferente
- Problema nas semanas 4-10 (e outras)

**Causa:**
- Sistema só propagava quando inicial estava em **zero**
- Se planilha tinha valor, não sobrescrevia
- Quebrava regra contábil básica

**Solução:**
- Propagação **sempre** aplicada (removida condição "só se zero")
- Segunda passagem após loop principal
- Propagação imediata ao atualizar estoque final

### 2. CMA (Alimentação) do Deboche com valor errado

**Sintoma:**
- Semana 13: Estoque Inicial (F) deveria ser R$ 137,36
- Sistema não puxava o valor correto da planilha

**Causa:**
- Deboche tem bloco CMA **2 linhas acima** do Ordinário
- Sistema usava mapeamento do Ordinário (fallback)
- Lia linha 68 em vez de linha 66

**Solução:**
- Criado `row_map_cmv_semanal` específico para Deboche
- Corrigidos índices do CMA:
  - Estoque Inicial (F): linha 66 (índice 65)
  - Compras Alimentação: linha 67 (índice 66)
  - Estoque Final (F): linha 68 (índice 67)

---

## 🛠️ Implementação

### Arquivos Modificados

#### Backend (Edge Functions)
1. **`cmv-semanal-auto/index.ts`**
   - Removida condição "só se zero"
   - Adicionada propagação de CMA
   - Segunda passagem após loop principal (automática)

2. **`sync-cmv-sheets/index.ts`**
   - Propagação após importar planilha (automática)
   - Criação automática do row_map do Deboche no primeiro sync
   - Inclui CMV + CMA
   - Verifica semanas sequenciais

3. **`sync-contagem-sheets/index.ts`**
   - Propaga para próxima semana imediatamente (automática)
   - Inclui CMV + CMA

#### Novas Edge Functions
4. **`cmv-propagar-estoque/index.ts`** (novo)
   - Função para corrigir histórico (rodar UMA VEZ via script)
   - Processa todos os bares ou um específico
   - Valida semanas sequenciais

#### Scripts e Docs
5. **`scripts/test-cmv-propagacao.ps1`** (novo)
6. **`scripts/README-CMV-PROPAGACAO.md`** (novo)
7. **`CMV_ESTOQUE_PROPAGACAO_FIX.md`**
8. **`CMV_CORRECOES_COMPLETAS.md`** (este arquivo)
9. **`GUIA_RAPIDO_CMV_PROPAGACAO.md`** (novo)

---

## 🚀 Como Usar

### Primeira Vez (Corrigir Histórico)

Rode o script **UMA VEZ** para corrigir as semanas 4-10:

```powershell
# Ordinário
.\scripts\test-cmv-propagacao.ps1 -BarId 3 -Ano 2026

# Deboche
.\scripts\test-cmv-propagacao.ps1 -BarId 4 -Ano 2026
```

Ou aguarde o próximo sync automático (vai corrigir sozinho).

### Manutenção (Automática)

A partir de agora, **não precisa fazer nada**:
- ✅ Jobs automáticos propagam os estoques
- ✅ Sincronizações mantêm consistência
- ✅ Regra contábil sempre aplicada
- ✅ Row map do Deboche criado automaticamente

---

## ✅ Validação

### Checklist Ordinário
- [ ] Semana 4: inicial = final semana 3
- [ ] Semana 5: inicial = final semana 4
- [ ] Semana 6: inicial = final semana 5
- [ ] Semana 7: inicial = final semana 6
- [ ] Semana 8: inicial = final semana 7
- [ ] Semana 9: inicial = final semana 8
- [ ] **Semana 10: inicial = R$ 110.453,96** ✅
- [ ] Semana 11: inicial = final semana 10
- [ ] CMA propagando corretamente

### Checklist Deboche
- [ ] Row map salvo no banco
- [ ] Semana 13: CMA inicial = R$ 137,36
- [ ] Todas as semanas CMV alinhadas
- [ ] Todas as semanas CMA alinhadas

### Script de Teste
```powershell
# Validar Ordinário
.\scripts\test-cmv-propagacao.ps1 -BarId 3 -Ano 2026

# Validar Deboche
.\scripts\test-cmv-propagacao.ps1 -BarId 4 -Ano 2026
```

---

## 📋 Regras Aplicadas

### Regra Contábil Obrigatória
```
Estoque Inicial[N] = Estoque Final[N-1]
```

Aplica-se a:
- ✅ Estoque Total (CMV)
- ✅ Estoque Cozinha
- ✅ Estoque Bebidas
- ✅ Estoque Drinks
- ✅ Estoque Funcionários (CMA)

### Precedência
1. **Estoque Final** (sempre calculado ou da planilha)
2. **Propagação** (estoque inicial = final anterior)
3. **Planilha** (valores manuais **não** sobrescrevem propagação)

### Exceções
- Primeira semana do ano: não propaga (não tem semana anterior)
- Semanas não sequenciais: não propaga (gap no histórico)

---

## 🔍 Como Funciona

### Fluxo Normal (Automático)

```
1. Job roda cmv-semanal-auto
   ↓
2. Calcula estoque final (contagem)
   ↓
3. Propaga para próxima semana
   ↓
4. Segunda passagem (garantia)
   ↓
5. Todas as semanas consistentes ✅
```

### Fluxo com Planilha

```
1. Usuário atualiza planilha Google Sheets
   ↓
2. Roda sync-cmv-sheets
   ↓
3. Importa dados da planilha
   ↓
4. Propaga estoques iniciais
   ↓
5. Sobrescreve valores da planilha ✅
```

### Correção Manual

```
1. Usuário clica "Propagar Estoque"
   ↓
2. Se Deboche: ajusta row_map
   ↓
3. Busca todas as semanas
   ↓
4. Propaga sequencialmente
   ↓
5. Valida consistência ✅
```

---

## 📊 Impacto

### Antes
- ❌ Estoque inicial manual (planilha)
- ❌ Inconsistências entre semanas
- ❌ CMV calculado errado
- ❌ CMA do Deboche errado

### Depois
- ✅ Estoque inicial automático (propagado)
- ✅ Consistência garantida
- ✅ CMV calculado correto
- ✅ CMA do Deboche correto
- ✅ Regra contábil sempre aplicada

---

## 🎓 Aprendizados

1. **Regras contábeis devem ser código, não processo manual**
2. **Propagação deve ser obrigatória, não condicional**
3. **Cada bar pode ter layout diferente na planilha**
4. **Validação estrutural é essencial**
5. **Segunda passagem garante consistência**

---

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs das Edge Functions
2. Rode o script de teste
3. Consulte este documento
4. Verifique o row_map no banco (se Deboche)
