# 🔍 Resumo: Inconsistências Identificadas na API do Falaê

**Data da Análise:** 07/04/2026  
**Total de Respostas Analisadas:** 181  
**Status Geral:** ⚠️ 7 Atenções, 0 Erros Críticos

---

## 📊 Resultado da Validação

| Status | Quantidade | Descrição |
|--------|-----------|-----------|
| ✅ OK | 3 checks | Funcionando corretamente |
| ⚠️ Warning | 7 checks | Requer atenção |
| ❌ Erro | 0 checks | Nenhum erro crítico |

---

## ⚠️ Principais Inconsistências Identificadas

### 1. 🔴 **CRÍTICO: Campos de Cliente 87% Nulos**

**Problema:**
- `client_name`: 158/181 nulos (87%)
- `client_email`: 158/181 nulos (87%)
- `client_phone`: 158/181 nulos (87%)

**Impacto:**
- Impossível rastrear clientes específicos
- Não é possível fazer análise por perfil de cliente
- Perda de oportunidade de follow-up com detratores

**Possíveis Causas:**
1. Pesquisa configurada como anônima no painel do Falaê
2. Integração não está capturando dados de cliente
3. Clientes não estão fornecendo informações

**Ação Recomendada:**
🔧 **URGENTE:** Verificar configuração da pesquisa no painel do Falaê
- URL: https://plataforma.falae.app/rede/integracao/webhook
- Verificar se campos de cliente estão habilitados
- Considerar tornar campos obrigatórios (se aplicável)

---

### 2. 🟡 **IMPORTANTE: Data de Visita 55% Nula**

**Problema:**
- `data_visita`: 100/181 nulos (55%)

**Impacto:**
- Sistema usa `created_at` como fallback
- Pode causar distorção em análises temporais
- Respostas tardias aparecem na data errada

**Exemplo:**
- Cliente visita em 28/03, responde em 31/03
- Se `data_visita` for null, aparece como 31/03 nas métricas

**Causa Identificada:**
O campo `data_visita` é extraído de um critério específico:
```json
{
  "name": "2026-03-28",
  "nick": "Data do pedido",
  "type": "Data"
}
```

Se esse critério não existe ou não está preenchido, `data_visita` fica null.

**Ação Recomendada:**
🔧 Verificar se o critério "Data do pedido" está:
1. Configurado em todas as pesquisas
2. Sendo preenchido pelos clientes
3. Com nome exato "Data do pedido" (case-insensitive)

---

### 3. 🟡 **IMPORTANTE: Divergência created_at vs data_visita (43%)**

**Problema:**
- 78/181 registros (43%) têm `created_at` diferente de `data_visita`

**Impacto:**
- Isso é **ESPERADO** e **NORMAL**
- Clientes respondem dias depois da visita
- Sistema está funcionando corretamente ao capturar ambas as datas

**Exemplo Real:**
| Visita (data_visita) | Resposta (created_at) | Diferença |
|---------------------|----------------------|-----------|
| 28/03/2026 | 31/03/2026 | 3 dias |
| 25/03/2026 | 30/03/2026 | 5 dias |

**Validação:**
✅ Sistema está usando `data_visita` como prioridade nas agregações
✅ Fallback para `created_at` quando `data_visita` é null

**Ação:**
✔️ Nenhuma ação necessária - comportamento correto

---

### 4. 🔴 **CRÍTICO: Inconsistência nas Agregações (21% de diferença)**

**Problema:**
- Total de respostas brutas: 170
- Total agregado em `nps_falae_diario`: 135
- **Diferença: 35 respostas (21%)**

**Impacto:**
- Dashboards podem mostrar números inconsistentes
- Relatórios não refletem a realidade completa
- Perda de 21% dos dados nas análises agregadas

**Possíveis Causas:**
1. Agregações não foram recalculadas após sync recente
2. Algumas respostas têm `data_visita` null e `created_at` fora do período
3. Falha no processo de recálculo automático

**Ação Recomendada:**
🔧 **URGENTE:** Recalcular agregações manualmente

```bash
# Opção 1: Via API
curl -X POST https://zykor.vercel.app/api/falae/sync \
  -H "Content-Type: application/json" \
  -d '{"bar_id": 3, "days_back": 30}'

# Opção 2: Via SQL
SELECT recalcular_nps_diario(3, '2026-03-01', '2026-04-07');
SELECT recalcular_nps_diario_pesquisa(3, '2026-03-01', '2026-04-07');
```

---

### 5. 🟡 **Comentários 56% Nulos**

**Problema:**
- `discursive_question`: 101/181 nulos (56%)

**Impacto:**
- Menos insights qualitativos
- Dificulta identificar problemas específicos
- Perda de feedback valioso

**Análise:**
- 44% de taxa de comentários é **razoável**
- Clientes promotores tendem a não comentar
- Detratores geralmente comentam mais

**Ação Recomendada:**
📊 Analisar distribuição de comentários por tipo:
- Detratores: % com comentário
- Neutros: % com comentário
- Promotores: % com comentário

---

## ✅ Pontos Positivos

### 1. **Credenciais Configuradas Corretamente**
- 2 credenciais ativas
- 0 credenciais inativas
- Sistema de autenticação funcionando

### 2. **Critérios Sendo Capturados**
- 181 respostas com critérios
- 17 tipos únicos de critérios
- 1.446 avaliações Rating
- 81 datas capturadas
- 177 atendentes mencionados

### 3. **Cálculo de NPS Correto**
- Fórmula validada: `((Promotores - Detratores) / Total) * 100`
- Classificação correta:
  - Promotores (9-10): 121 (67%)
  - Neutros (7-8): 46 (25%)
  - Detratores (0-6): 14 (8%)
- **NPS Score: 59** (Excelente!)

---

## 🎯 Plano de Ação Prioritário

### Prioridade 1 (Urgente - Hoje)
1. ✅ **Recalcular agregações** para corrigir diferença de 21%
2. ✅ **Verificar configuração de campos de cliente** no painel Falaê

### Prioridade 2 (Esta Semana)
3. 🔍 **Investigar por que 55% das respostas não têm data_visita**
4. 📊 **Analisar distribuição de comentários por tipo de cliente**

### Prioridade 3 (Próximas 2 Semanas)
5. 🔔 **Implementar alertas automáticos** para inconsistências
6. 📈 **Dashboard de monitoramento** de qualidade dos dados
7. 📝 **Documentar variações de estrutura** da API do Falaê

---

## 🔧 Scripts de Correção

### Recalcular Agregações (SQL)

```sql
-- Recalcular NPS diário para todos os bares
DO $$
DECLARE
  bar_record RECORD;
BEGIN
  FOR bar_record IN 
    SELECT DISTINCT bar_id FROM falae_respostas
  LOOP
    PERFORM recalcular_nps_diario(
      bar_record.bar_id, 
      '2026-01-01', 
      CURRENT_DATE::text
    );
    
    PERFORM recalcular_nps_diario_pesquisa(
      bar_record.bar_id, 
      '2026-01-01', 
      CURRENT_DATE::text
    );
    
    RAISE NOTICE 'Recalculado bar_id: %', bar_record.bar_id;
  END LOOP;
END $$;
```

### Verificar Respostas Sem Agregação

```sql
-- Encontrar respostas que não estão nas agregações
WITH respostas_por_dia AS (
  SELECT 
    bar_id,
    COALESCE(data_visita, created_at::date) as data_ref,
    COUNT(*) as total_respostas
  FROM falae_respostas
  WHERE created_at >= '2026-03-01'
  GROUP BY bar_id, data_ref
),
agregado_por_dia AS (
  SELECT 
    bar_id,
    data_referencia,
    respostas_total
  FROM nps_falae_diario
  WHERE data_referencia >= '2026-03-01'
)
SELECT 
  r.bar_id,
  r.data_ref,
  r.total_respostas as respostas_brutas,
  COALESCE(a.respostas_total, 0) as respostas_agregadas,
  r.total_respostas - COALESCE(a.respostas_total, 0) as diferenca
FROM respostas_por_dia r
LEFT JOIN agregado_por_dia a 
  ON r.bar_id = a.bar_id 
  AND r.data_ref = a.data_referencia
WHERE r.total_respostas != COALESCE(a.respostas_total, 0)
ORDER BY r.bar_id, r.data_ref;
```

---

## 📈 Métricas de Qualidade dos Dados

| Métrica | Valor Atual | Meta | Status |
|---------|------------|------|--------|
| Campos cliente preenchidos | 13% | 80% | 🔴 Crítico |
| Data visita preenchida | 45% | 90% | 🟡 Atenção |
| Comentários preenchidos | 44% | 40% | ✅ OK |
| Consistência agregações | 79% | 95% | 🟡 Atenção |
| NPS Score | 59 | 50+ | ✅ Excelente |

---

## 📞 Próximos Passos

1. **Executar recálculo de agregações**
   ```bash
   npx tsx scripts/recalcular-agregacoes-falae.ts
   ```

2. **Validar resultados**
   ```bash
   npx tsx scripts/validar-falae-inconsistencias.ts
   ```

3. **Verificar painel do Falaê**
   - Login: https://plataforma.falae.app/
   - Verificar configuração de campos
   - Validar webhook ativo

4. **Monitorar próximas respostas**
   - Verificar se campos de cliente são preenchidos
   - Validar data_visita em novas respostas

---

## 📚 Documentos Relacionados

- 📄 [Diagnóstico Completo da API Falaê](.cursor/DIAGNOSTICO-API-FALAE.md)
- 🔧 [Script de Validação](../scripts/validar-falae-inconsistencias.ts)
- 📊 [Resultados JSON](.cursor/falae-validation-results.json)

---

**Última Atualização:** 07/04/2026  
**Próxima Validação:** 14/04/2026  
**Responsável:** Sistema Zykor
