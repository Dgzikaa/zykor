# Guia de Testes - Implementações 27/02/2026

## 🎯 Objetivo

Validar todas as 9 implementações realizadas hoje e garantir que estão funcionando corretamente.

---

## ⚡ AÇÕES OBRIGATÓRIAS ANTES DE TESTAR

### 1. Executar Migration SQL (OBRIGATÓRIO)

**Arquivo:** `migration_cmo_historico.sql`

**Passos:**
1. Abra o Supabase Dashboard
2. Vá em SQL Editor
3. Copie TODO o conteúdo do arquivo `migration_cmo_historico.sql`
4. Cole no editor
5. Clique em "Run"
6. Aguarde confirmação de sucesso

**Validar:**
```sql
-- Verificar se tabela foi criada
SELECT * FROM cmo_semanal_historico LIMIT 1;

-- Verificar se trigger existe
SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_salvar_versao_cmo';

-- Verificar se view foi criada
SELECT * FROM vw_cmo_historico_completo LIMIT 1;
```

### 2. Recalcular TODOS os CMVs (OBRIGATÓRIO)

**Por que:** A fórmula de bonificações estava errada. Todos os CMVs históricos estão incorretos.

**Passos:**
1. Acesse: `http://localhost:3000/ferramentas/cmv-semanal/recalcular`
2. Selecione o bar (Ordinário)
3. Clique em "Recalcular Todos os CMVs"
4. Aguarde processamento (pode levar 2-5 minutos)
5. Verifique o relatório:
   - Total de CMVs recalculados
   - Diferenças encontradas
   - Erros (se houver)

**Validar:**
- Escolha 3 semanas aleatórias
- Compare CMV R$ com a planilha oficial do Excel
- Diferença deve ser < R$ 100 ou < 0,5%

---

## 📋 CHECKLIST DE TESTES

### ✅ Teste 1: CMV - Bonificações Somando

**Objetivo:** Validar que bonificações agora SOMAM ao invés de subtrair

**Passos:**
1. Acesse: `/ferramentas/cmv-semanal`
2. Selecione uma semana qualquer
3. Insira valores de teste:
   - Estoque Inicial: R$ 10.000
   - Compras: R$ 50.000
   - Estoque Final: R$ 12.000
   - Consumações: R$ 5.000
   - Bonificações: R$ 2.000
4. Clique em "Calcular CMV"

**Resultado esperado:**
```
CMV Real = 10.000 + 50.000 - 12.000 - 5.000 + 2.000 = R$ 45.000
```

**Validar:**
- [ ] CMV Real = R$ 45.000
- [ ] Tooltip mostra "(+) Bonificações: R$ 2.000"
- [ ] Label da seção é "(+) Bonificações" (não "(-)")

---

### ✅ Teste 2: Auditoria de CMV

**Objetivo:** Verificar se alterações em CMV são registradas

**Passos:**
1. Edite qualquer CMV semanal
2. Altere um valor (ex: bonificação)
3. Salve
4. Acesse o Supabase
5. Execute:
```sql
SELECT * FROM audit_logs 
WHERE table_name = 'cmv_semanal' 
ORDER BY created_at DESC 
LIMIT 5;
```

**Resultado esperado:**
- [ ] Registro criado em `audit_logs`
- [ ] `operation` = 'UPDATE_CMV' ou 'UPDATE_CMV_FIELDS'
- [ ] `old_values` contém valores antigos
- [ ] `new_values` contém valores novos
- [ ] `category` = 'financial'
- [ ] `severity` = 'info'

---

### ✅ Teste 3: Auditoria de CMO

**Objetivo:** Verificar se alterações em CMO são registradas

**Passos:**
1. Acesse: `/ferramentas/cmo-semanal`
2. Crie ou edite uma simulação
3. Adicione/remova funcionários
4. Salve
5. Execute no Supabase:
```sql
SELECT * FROM audit_logs 
WHERE table_name = 'cmo_semanal' 
ORDER BY created_at DESC 
LIMIT 5;
```

**Resultado esperado:**
- [ ] Registro criado em `audit_logs`
- [ ] `operation` = 'CREATE_CMO' ou 'UPDATE_CMO'
- [ ] `metadata` contém `total_funcionarios`
- [ ] Valores antigos e novos salvos

---

### ✅ Teste 4: Versionamento de CMO

**Objetivo:** Verificar se versões são salvas automaticamente

**Passos:**
1. Acesse: `/ferramentas/cmo-semanal`
2. Crie uma simulação para Semana 9/2026
3. Salve (Versão 1)
4. Edite a simulação (mude um valor)
5. Salve novamente (Versão 2)
6. Trave a simulação (Versão 3)
7. Execute no Supabase:
```sql
SELECT 
  versao, 
  tipo_mudanca, 
  cmo_total, 
  mudancas_detectadas,
  created_at
FROM vw_cmo_historico_completo 
WHERE ano = 2026 AND semana = 9
ORDER BY versao DESC;
```

**Resultado esperado:**
- [ ] 3 versões criadas
- [ ] Versão 1: tipo_mudanca = 'CREATE'
- [ ] Versão 2: tipo_mudanca = 'UPDATE', mudancas_detectadas preenchido
- [ ] Versão 3: tipo_mudanca = 'TRAVAR'
- [ ] Funcionários salvos em JSONB
- [ ] Diferenças calculadas entre versões

---

### ✅ Teste 5: CMO na Tabela de Desempenho

**Objetivo:** Validar integração automática do CMO

**Passos:**
1. Crie uma simulação CMO para uma semana
2. Trave a simulação
3. Acesse: `/estrategico/desempenho/tabela`
4. Localize a semana
5. Clique em "Recalcular" (botão de refresh)
6. Aguarde recálculo

**Resultado esperado:**
- [ ] CMO aparece na tabela
- [ ] Valor = CMO Total da simulação travada
- [ ] Status do CMO = "automático" (não "não confiável")
- [ ] Tooltip mostra: "Fonte: Simulação CMO Travada"
- [ ] CMO % calculado corretamente

**Validar cálculo:**
```
CMO % = (CMO Total / Faturamento Total) × 100
```

---

### ✅ Teste 6: Formatação Condicional de Meta

**Objetivo:** Verificar cores verde/vermelho baseado na meta

**Passos:**
1. Acesse: `/estrategico/desempenho/tabela`
2. Edite uma semana
3. Insira uma meta (ex: R$ 50.000)
4. Salve
5. Observe a coluna "Faturamento"

**Resultado esperado:**
- [ ] Se faturamento >= meta: texto VERDE
- [ ] Se faturamento < meta: texto VERMELHO
- [ ] Se sem meta: texto PRETO (padrão)

**Teste com dados:**
- Meta: R$ 50.000, Faturamento: R$ 55.000 → 🟢 VERDE
- Meta: R$ 50.000, Faturamento: R$ 45.000 → 🔴 VERMELHO
- Meta: R$ 0, Faturamento: R$ 45.000 → ⚪ PRETO

---

### ✅ Teste 7: Cabeçalhos Expandidos - Tabela Comercial

**Objetivo:** Verificar se cabeçalhos estão por extenso

**Passos:**
1. Acesse: `/estrategico/planejamento-comercial`
2. Clique em "Expandir Todos"
3. Observe os cabeçalhos das colunas

**Resultado esperado:**
- [ ] "Clientes Presentes" (não "Presentes")
- [ ] "Clientes Reais" (não "Reais")
- [ ] "Reservas Presentes" (não "Reservas Pres.")
- [ ] "Lotação Máxima" (não "Lotação Máx.")
- [ ] "Entrada Planejado" (não "Entrada Plan.")
- [ ] "Bar Planejado" (não "Bar Plan.")
- [ ] "Ticket Médio" (não "Médio")

---

### ✅ Teste 8: Separadores entre Semanas

**Objetivo:** Verificar linhas mais grossas separando semanas

**Passos:**
1. Acesse: `/estrategico/planejamento-comercial`
2. Visualize dados de pelo menos 2 semanas
3. Observe as linhas entre os dias

**Resultado esperado:**
- [ ] Linha mais grossa e escura quando muda de semana
- [ ] Visual: `border-t-4` (4px) vs `border-t` (1px) normal
- [ ] Cor: cinza escuro (`border-gray-600`)
- [ ] Facilita identificar onde começa cada semana

**Exemplo visual:**
```
Sábado 22/02  |  Dados...
Domingo 23/02 |  Dados...
━━━━━━━━━━━━━━━━━━━━━━━━━━  ← Linha grossa (nova semana)
Segunda 24/02 |  Dados...
Terça 25/02   |  Dados...
```

---

### ✅ Teste 9: Recálculo de CMVs em Massa

**Objetivo:** Validar que script de recálculo funciona

**Passos:**
1. Acesse: `/ferramentas/cmv-semanal/recalcular`
2. Leia o aviso sobre a correção
3. Clique em "Recalcular Todos os CMVs"
4. Aguarde conclusão
5. Analise o relatório

**Resultado esperado:**
- [ ] Processamento completa sem erros
- [ ] Relatório mostra:
  - Total de CMVs processados
  - Quantidade recalculada
  - Primeiros 10 com diferenças
  - Erros (deve ser 0)
- [ ] Diferenças são positivas (CMV aumentou com bonificações somando)

**Validação adicional:**
```sql
-- Comparar CMV antes e depois (se tiver backup)
SELECT 
  ano, semana,
  cmv_real,
  ajuste_bonificacoes,
  (cmv_real - ajuste_bonificacoes * 2) as cmv_antes_correcao
FROM cmv_semanal
WHERE ajuste_bonificacoes > 0
ORDER BY ano DESC, semana DESC
LIMIT 10;
```

---

## 🔍 VALIDAÇÕES AVANÇADAS

### Validação 1: CMV linha a linha

**Escolha 1 semana fechada e valide:**

| Métrica | Sistema | Planilha | Diferença | Status |
|---------|---------|----------|-----------|--------|
| Estoque Inicial | R$ | R$ | R$ | ⚪ |
| Compras | R$ | R$ | R$ | ⚪ |
| Estoque Final | R$ | R$ | R$ | ⚪ |
| Consumações | R$ | R$ | R$ | ⚪ |
| Bonificações | R$ | R$ | R$ | ⚪ |
| **CMV Real** | R$ | R$ | R$ | ⚪ |
| **CMV %** | % | % | % | ⚪ |

**Critério de sucesso:** Diferença < 0,5%

---

### Validação 2: CMO linha a linha

**Escolha 1 semana com simulação travada:**

| Componente | Sistema | Planilha | Diferença | Status |
|------------|---------|----------|-----------|--------|
| Freelas | R$ | R$ | R$ | ⚪ |
| Fixos | R$ | R$ | R$ | ⚪ |
| Alimentação (CMA) | R$ | R$ | R$ | ⚪ |
| Pro Labore | R$ | R$ | R$ | ⚪ |
| **CMO Total** | R$ | R$ | R$ | ⚪ |
| **CMO %** | % | % | % | ⚪ |

**Critério de sucesso:** Diferença < 0,5%

---

### Validação 3: Visão Mensal

**Escolha 1 mês com semanas quebradas (ex: Janeiro/2026):**

| Métrica | Sistema | Planilha | Diferença | Status |
|---------|---------|----------|-----------|--------|
| Faturamento Total | R$ | R$ | R$ | ⚪ |
| CMV R$ | R$ | R$ | R$ | ⚪ |
| CMV % | % | % | % | ⚪ |
| CMO R$ | R$ | R$ | R$ | ⚪ |
| CMO % | % | % | % | ⚪ |
| Clientes | # | # | # | ⚪ |
| Ticket Médio | R$ | R$ | R$ | ⚪ |

**Critério de sucesso:** Diferença < 0,5%

---

## 🐛 TROUBLESHOOTING

### Problema: CMV não mudou após recálculo
**Solução:**
1. Verifique se o recálculo completou sem erros
2. Limpe cache do navegador (Ctrl+Shift+R)
3. Verifique no banco se valores foram atualizados:
```sql
SELECT id, ano, semana, cmv_real, ajuste_bonificacoes, updated_at
FROM cmv_semanal
ORDER BY updated_at DESC
LIMIT 10;
```

### Problema: CMO não aparece na Tabela de Desempenho
**Solução:**
1. Verifique se a simulação está travada:
```sql
SELECT * FROM cmo_semanal WHERE ano = X AND semana = Y;
-- simulacao_salva deve ser TRUE
```
2. Recalcule o desempenho da semana
3. Verifique se CMO foi atualizado:
```sql
SELECT cmo, cmo_custo FROM desempenho_semanal WHERE ano = X AND numero_semana = Y;
```

### Problema: Auditoria não está registrando
**Solução:**
1. Verifique se `audit-logger.ts` está importado
2. Verifique logs do console (F12)
3. Verifique permissões da tabela `audit_logs`
4. Teste manualmente:
```typescript
await logAuditEvent({
  operation: 'TEST',
  description: 'Teste de auditoria',
  severity: 'info',
  category: 'system'
});
```

### Problema: Versionamento não está funcionando
**Solução:**
1. Verifique se migration SQL foi executada
2. Verifique se trigger está ativo:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'trigger_salvar_versao_cmo';
```
3. Teste manualmente alterando um CMO
4. Verifique histórico:
```sql
SELECT * FROM cmo_semanal_historico ORDER BY created_at DESC LIMIT 5;
```

### Problema: Separadores de semana não aparecem
**Solução:**
1. Verifique se há dados de múltiplas semanas
2. Limpe cache (Ctrl+Shift+R)
3. Inspecione elemento (F12) e veja se classe `border-t-4` está aplicada
4. Verifique console por erros JavaScript

---

## 📊 RELATÓRIO DE TESTES

### Template para preencher:

```markdown
## Relatório de Testes - [DATA]

### Teste 1: CMV - Bonificações
- Status: ⚪ Não testado / 🟢 Passou / 🔴 Falhou
- Observações:

### Teste 2: Auditoria CMV
- Status: ⚪ Não testado / 🟢 Passou / 🔴 Falhou
- Observações:

### Teste 3: Auditoria CMO
- Status: ⚪ Não testado / 🟢 Passou / 🔴 Falhou
- Observações:

### Teste 4: Versionamento CMO
- Status: ⚪ Não testado / 🟢 Passou / 🔴 Falhou
- Observações:

### Teste 5: CMO na Tabela de Desempenho
- Status: ⚪ Não testado / 🟢 Passou / 🔴 Falhou
- Observações:

### Teste 6: Formatação de Meta
- Status: ⚪ Não testado / 🟢 Passou / 🔴 Falhou
- Observações:

### Teste 7: Cabeçalhos Expandidos
- Status: ⚪ Não testado / 🟢 Passou / 🔴 Falhou
- Observações:

### Teste 8: Separadores de Semana
- Status: ⚪ Não testado / 🟢 Passou / 🔴 Falhou
- Observações:

### Teste 9: Recálculo em Massa
- Status: ⚪ Não testado / 🟢 Passou / 🔴 Falhou
- Total CMVs: 
- Recalculados:
- Erros:
- Observações:

### Validação 1: CMV vs Planilha
- Semana testada:
- Diferença: %
- Status: ⚪ Não testado / 🟢 < 0,5% / 🔴 > 0,5%

### Validação 2: CMO vs Planilha
- Semana testada:
- Diferença: %
- Status: ⚪ Não testado / 🟢 < 0,5% / 🔴 > 0,5%

### Validação 3: Mensal vs Planilha
- Mês testado:
- Diferença: %
- Status: ⚪ Não testado / 🟢 < 0,5% / 🔴 > 0,5%

---

## Resumo Final
- Total de testes: 9
- Passou: 
- Falhou:
- Não testado:

## Problemas Encontrados
1. 
2.
3.

## Ações Necessárias
1.
2.
3.
```

---

## 🎯 ORDEM RECOMENDADA DE TESTES

1. **PRIMEIRO:** Executar migration SQL
2. **SEGUNDO:** Recalcular todos os CMVs
3. **TERCEIRO:** Validar CMV com planilha (3 semanas)
4. **QUARTO:** Testar auditoria (CMV e CMO)
5. **QUINTO:** Testar versionamento (criar, editar, travar)
6. **SEXTO:** Testar CMO na Tabela de Desempenho
7. **SÉTIMO:** Validar formatação de meta
8. **OITAVO:** Verificar cabeçalhos e separadores
9. **NONO:** Validação completa (mensal vs planilha)

---

## 📞 SUPORTE

Se encontrar problemas:
1. Verifique console do navegador (F12)
2. Verifique logs do servidor
3. Consulte documentação em `docs/revisao-tarefas-socio-2026-02-27.md`
4. Consulte implementações em `docs/IMPLEMENTACOES-27-02-2026.md`

---

**Documento criado em:** 27/02/2026  
**Última atualização:** 27/02/2026  
**Status:** Pronto para testes
