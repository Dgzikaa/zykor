# Alterações Pendentes - Aguardando Aprovação

Este documento lista todas as alterações solicitadas, com detalhamento técnico da situação atual e proposta.

---

## Status das Alterações

| ID | Descrição | Prioridade | Bar | Status |
|----|-----------|------------|-----|--------|
| D1 | Reservas manuais Planejamento Comercial | Alta | Deboche | ✅ Concluído |
| D2 | TER+QUA+QUI e SEX+SÁB incorretos | Alta | Deboche | ✅ Concluído |
| D3 | QUI+SÁB+DOM incorreto | Alta | Ordinário | ✅ Concluído |
| A1 | Threshold Atrasão Drinks | Média | Ambos | ✅ Concluído |
| A2 | Threshold Atrasão Comida | Média | Ambos | ✅ Já estava correto |
| A3 | Threshold Atrasinho Drinks | Média | Ambos | ✅ Já estava correto |
| A4 | Threshold Atrasinho Comida | Média | Ambos | ✅ Já estava correto |
| A5 | Congelar 4 colunas Planejamento | Média | Ambos | ✅ Concluído |
| A6 | Melhorar highlight linha + coluna | Baixa | Ambos | ✅ Concluído |
| A7 | Meta por semana = Soma M1 | Alta | Ambos | ✅ Concluído |
| O1 | Conta Assinada valor estranho | Média | Ordinário | ✅ Investigado - Dados OK |

---

## D1 - Reservas Manuais no Planejamento Comercial (Deboche)

### Situação Atual

```
Tabela: eventos_base
Colunas: res_tot, res_p
Origem Ordinário: GetIn API (automático via sync)
Origem Deboche: Não tem API - valores ficam zerados
```

**Arquivo:** `PlanejamentoClient.tsx` linha ~800
```tsx
// Modal de edição JÁ permite editar res_tot e res_p
// Porém precisa abrir o modal para cada evento individualmente
```

### Proposta de Alteração

**Opção A (Recomendada):** Adicionar colunas editáveis diretamente na tabela para `bar_id = 4`

```tsx
// Para Deboche, transformar as colunas Reservas em campos editáveis
{barId === 4 && (
  <Input 
    type="number"
    value={evento.res_tot}
    onChange={(e) => handleQuickEdit(evento.id, 'res_tot', e.target.value)}
  />
)}
```

**Opção B:** Botão de edição rápida ao lado dos valores zerados

### Arquivos a Alterar

1. `frontend/src/app/estrategico/planejamento-comercial/components/PlanejamentoClient.tsx`
   - Adicionar renderização condicional para campos editáveis
   - Adicionar função `handleQuickEdit` para salvar alterações inline

---

## D2 - TER+QUA+QUI e SEX+SÁB Incorretos (Deboche)

### Situação Atual

**Fonte de dados ATUAL:**
```
Tabela: contahub_analitico
Coluna: valorfinal
Filtro: trn_dtgerencial BETWEEN start AND end
```

**Código atual** (`recalcular-desempenho-auto/index.ts` linha 381-411):
```typescript
const { data: fatDiasRows } = await supabase
  .from('contahub_analitico')
  .select('trn_dtgerencial, valorfinal')
  .eq('bar_id', barId)
  .gte('trn_dtgerencial', startDate)
  .lte('trn_dtgerencial', endDate)

for (const row of fatDiasRows || []) {
  const d = new Date(row.trn_dtgerencial + 'T12:00:00Z')
  const dia = d.getUTCDay()
  const valor = parseFloat(row.valorfinal) || 0
  
  if (dia === 2 || dia === 3 || dia === 4) terQuaQui += valor  // Ter, Qua, Qui
  if (dia === 5 || dia === 6) sexSab += valor                   // Sex, Sab
}
```

### Problema Identificado

O `contahub_analitico` contém **múltiplos registros por transação** (cada item vendido). O campo `valorfinal` representa o valor de cada item, não o faturamento total do dia.

**Isso causa:**
- Semana 11: Sex+Sab mostrando R$1.641 quando deveria ser ~R$43k
- Semana 11: Ter+Qua+Qui mostrando R$10.640 quando deveria ser ~R$12k

### Proposta de Alteração

**Trocar fonte de dados para `eventos_base.real_r`** (mesma fonte do Faturamento Total):

```typescript
// NOVO código proposto:
const { data: eventosComDia } = await supabase
  .from('eventos_base')
  .select('data_evento, real_r')
  .eq('bar_id', barId)
  .gte('data_evento', startDate)
  .lte('data_evento', endDate)
  .eq('ativo', true)

for (const evento of eventosComDia || []) {
  const d = new Date(evento.data_evento + 'T12:00:00Z')
  const dia = d.getUTCDay()
  const valor = parseFloat(evento.real_r) || 0
  
  // Deboche: Ter(2), Qua(3), Qui(4)
  if (dia === 2 || dia === 3 || dia === 4) terQuaQui += valor
  // Deboche: Sex(5), Sab(6)
  if (dia === 5 || dia === 6) sexSab += valor
  // Ordinário: Qui(4), Sab(6), Dom(0)
  if (dia === 4 || dia === 6 || dia === 0) quiSabDom += valor
}
```

### Validação SQL Recomendada

Antes de implementar, rodar query para validar:
```sql
SELECT 
  data_evento,
  EXTRACT(DOW FROM data_evento::date) as dia_semana,
  real_r
FROM eventos_base
WHERE bar_id = 4
  AND data_evento >= '2026-03-09'
  AND data_evento <= '2026-03-15'
  AND ativo = true
ORDER BY data_evento;
```

### Arquivos a Alterar

1. `backend/supabase/functions/recalcular-desempenho-auto/index.ts` (linhas 381-411)

---

## D3 - QUI+SÁB+DOM Incorreto (Ordinário)

### Situação Atual

Mesmo problema do D2 - usando `contahub_analitico.valorfinal` em vez de `eventos_base.real_r`.

### Proposta de Alteração

Mesma correção do D2 - será resolvido junto.

---

## A1 - Threshold Atrasão Drinks

### Situação Atual

**Stored Procedure:** `calcular_atrasos_tempo`

```sql
-- Ordinário: t0_t3 > 1200 segundos (20 minutos)
-- Deboche: t0_t2 > 600 segundos (10 minutos)
```

**Código na SP:**
```sql
COUNT(*) FILTER (
  WHERE (p_bar_id = 3 AND loc_desc IN (...) AND t0_t3 > 1200)
     OR (p_bar_id = 4 AND loc_desc = 'Bar' AND categoria = 'bebida' AND t0_t2 > 600)
)::INTEGER as atrasos_bar
```

### Proposta de Alteração

**Solicitado:** Atrasão Drinks > 10 min para ambos

```sql
-- NOVO threshold: 600 segundos (10 min) para AMBOS
COUNT(*) FILTER (
  WHERE (p_bar_id = 3 AND loc_desc IN (...) AND t0_t3 > 600)
     OR (p_bar_id = 4 AND loc_desc = 'Bar' AND categoria = 'bebida' AND t0_t2 > 600)
)::INTEGER as atrasos_bar
```

### Arquivos a Alterar

1. **Banco de dados:** Stored Procedure `calcular_atrasos_tempo`
2. **Frontend:** `DesempenhoClient.tsx` - atualizar descrição do indicador

---

## A2 - Threshold Atrasão Comida

### Situação Atual

```sql
-- Ambos os bares: t0_t2 > 1200 segundos (20 minutos)
```

### Proposta de Alteração

**Solicitado:** Manter > 20 min (já está correto)

✅ **NENHUMA ALTERAÇÃO NECESSÁRIA**

---

## A3 - Threshold Atrasinho Drinks

### Situação Atual

**Definido no cálculo do evento (não na SP):**
```
ATUAL: t0_t3 > 4 min e < 8 min
```

### Proposta de Alteração

**Solicitado:** Atrasinho Drinks > 5 min (sem limite superior)

```
NOVO: t0_t3 > 5 min (300 segundos)
```

### Arquivos a Alterar

1. Localizar onde `atrasinho_bar` é calculado em `eventos_base`
2. Alterar threshold de 240s para 300s
3. Remover limite superior

---

## A4 - Threshold Atrasinho Comida

### Situação Atual

```
ATUAL: t0_t2 > 15 min e < 20 min
```

### Proposta de Alteração

**Solicitado:** Atrasinho Comida > 15 min (sem limite superior)

```
NOVO: t0_t2 > 15 min (900 segundos) - SEM limite superior
```

### Arquivos a Alterar

1. Localizar onde `atrasinho_cozinha` é calculado em `eventos_base`
2. Remover limite superior (manter apenas > 15 min)

---

## A5 - Congelar 4 Colunas no Planejamento Comercial

### Situação Atual

**Colunas sticky atuais:**
```tsx
// Data
className="sticky left-0 z-20"

// Dia  
className="sticky left-[48px] z-20"

// Artista
className="sticky left-[86px] z-20"
```

**Colunas NÃO sticky:**
- Receita Real
- Meta M1

### Proposta de Alteração

Adicionar sticky às colunas faltantes:

```tsx
// Receita Real (4ª coluna)
className="sticky left-[180px] z-20"

// Meta M1 (5ª coluna) - OPCIONAL
className="sticky left-[280px] z-20"
```

**Cálculo de posições:**
- Data: 48px
- Dia: 38px
- Artista: 94px
- Receita Real: ~100px
- Meta M1: ~100px

### Arquivos a Alterar

1. `frontend/src/app/estrategico/planejamento-comercial/components/PlanejamentoClient.tsx`

---

## A6 - Melhorar Highlight de Linha Selecionada

### Situação Atual

```tsx
// Linha 624-627 do PlanejamentoClient.tsx
className={cn(
  "cursor-pointer transition-colors hover:bg-[hsl(var(--muted))]",
  selectedEventoId === evento.id && "bg-[hsl(var(--muted))]"
)}
```

**Problema:** Cor muito clara, difícil distinguir linha selecionada

### Proposta de Alteração

```tsx
// Aumentar contraste e destacar coluna
className={cn(
  "cursor-pointer transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20",
  selectedEventoId === evento.id && "bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-500/30"
)}

// Para células da coluna selecionada
{selectedColumn === coluna.key && (
  <div className="absolute inset-0 bg-blue-200/30 dark:bg-blue-800/30 pointer-events-none" />
)}
```

### Arquivos a Alterar

1. `frontend/src/app/estrategico/planejamento-comercial/components/PlanejamentoClient.tsx`
   - Adicionar state `selectedColumn`
   - Alterar classes CSS de highlight
   - Adicionar overlay de coluna

---

## A7 - Meta por Semana = Soma M1 do Planejamento

### Situação Atual

**Meta atual:** Valor fixo por semana (definido manualmente em `desempenho_semanal.meta_semanal`)

**Já existe cálculo parcial:**
```typescript
// recalcular-desempenho-auto/index.ts linha 160
const metaSemanal = (eventosData || []).reduce(
  (sum, item) => sum + (parseFloat(item.m1_r) || 0), 
  0
)
```

**Problema:** O campo `m1_r` precisa estar preenchido em `eventos_base`

### Proposta de Alteração

**1. Garantir que a meta seja calculada corretamente:**
- Verificar se `m1_r` está sendo sincronizado corretamente do Planejamento Comercial

**2. Adicionar indicador visual de % atingido:**

```tsx
// Em DesempenhoClient.tsx, no indicador de Faturamento
const percentualMeta = metaSemanal > 0 
  ? (faturamentoTotal / metaSemanal * 100).toFixed(0) 
  : 0

{percentualMeta >= 100 ? (
  <span className="text-green-500 ml-2">
    ↑ {percentualMeta}%
  </span>
) : (
  <span className="text-red-500 ml-2">
    ↓ {percentualMeta}%
  </span>
)}
```

**3. Opções de exibição (escolher uma):**

| Opção | Descrição | Prós | Contras |
|-------|-----------|------|---------|
| A | Badge ao lado do faturamento | Simples, sempre visível | Pode poluir |
| B | Tooltip ao passar o mouse | Limpo | Menos descobrível |
| C | Coluna extra "% Meta" | Padronizado | Ocupa espaço |
| D | Popup ao clicar na semana | Detalhado | Requer clique |

### Arquivos a Alterar

1. `frontend/src/app/estrategico/desempenho/components/DesempenhoClient.tsx`
2. Possivelmente `backend/supabase/functions/recalcular-desempenho-auto/index.ts`

---

## O1 - Conta Assinada Valor Estranho (Ordinário)

### Situação Atual

**Fonte:** `contahub_pagamentos`
**Coluna:** `liquido`
**Filtro:** `meio = 'Conta Assinada'`

### Investigação Necessária

```sql
SELECT 
  data,
  SUM(liquido) as total_liquido
FROM contahub_pagamentos
WHERE bar_id = 3
  AND meio = 'Conta Assinada'
  AND data >= '2026-03-09'
  AND data <= '2026-03-15'
GROUP BY data
ORDER BY data;
```

### Próximo Passo

Executar query acima e comparar com valor esperado.

---

# ORDEM DE IMPLEMENTAÇÃO SUGERIDA

1. **D2/D3** - Correção TER+QUA+QUI, SEX+SÁB e QUI+SÁB+DOM (crítico - dados incorretos)
2. **D1** - Reservas manuais para Deboche (alta prioridade - usabilidade)
3. **A7** - Meta por semana (alta prioridade - visibilidade de performance)
4. **A1/A3/A4** - Thresholds de atrasos (média prioridade)
5. **A5** - Congelar colunas (média prioridade - UX)
6. **A6** - Melhorar highlight (baixa prioridade - UX)
7. **O1** - Investigar Conta Assinada (investigação)

---

# CHECKLIST PRÉ-IMPLEMENTAÇÃO

- [ ] Validar queries SQL antes de alterar código
- [ ] Rodar `npm run type-check` antes de cada commit
- [ ] Testar em ambiente local com dados reais
- [ ] Documentar alterações neste arquivo
- [ ] Atualizar REGRAS-POR-BAR.md após implementação
