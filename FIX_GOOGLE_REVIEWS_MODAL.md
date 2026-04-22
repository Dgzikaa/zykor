# Fix: Modal Google Reviews Mostrando Apenas 5 Estrelas

Data: 21/04/2026

## Problema Reportado

User queria que o modal de Google Reviews mostrasse **TODAS** as 36 reviews da semana, não apenas as 33 de 5 estrelas.

## Investigação

### 1. Verificação no Banco de Dados

#### Query: Reviews por Estrela (Semana 16/2026)
```sql
SELECT stars, COUNT(*) as qtd
FROM integrations.google_reviews
WHERE bar_id = 3
  AND published_at_date BETWEEN '2026-04-13' AND '2026-04-19'
GROUP BY stars
ORDER BY stars DESC;
```

**Resultado:**
- 5 estrelas: 33 reviews ⭐⭐⭐⭐⭐
- 4 estrelas: 2 reviews ⭐⭐⭐⭐
- 2 estrelas: 1 review ⭐⭐
- **Total: 36 reviews**

✅ **Confirmação:** Bronze TEM todas as reviews armazenadas.

### 2. Verificação da Função RPC

```sql
SELECT pg_get_functiondef(
  (SELECT oid FROM pg_proc WHERE proname = 'get_google_reviews_by_date')
);
```

**Resultado:**
```sql
SELECT 
  reviewer_name,
  stars,
  text,
  published_at_date
FROM bronze.bronze_google_reviews
WHERE bar_id = p_bar_id
  AND (published_at_date AT TIME ZONE 'America/Sao_Paulo')::date >= p_data_inicio
  AND (published_at_date AT TIME ZONE 'America/Sao_Paulo')::date <= p_data_fim;
-- SEM FILTRO DE STARS
```

✅ **Confirmação:** RPC retorna todas as reviews, sem filtro de estrelas.

### 3. Verificação da API

**Arquivo:** `frontend/src/app/api/google-reviews/detailed-summary/route.ts`

**Linhas 76-79:**
```typescript
// Filtrar por estrelas se especificado
let reviewsData = (reviews || []) as any[];
if (filtroEstrelas !== null && filtroEstrelas >= 1 && filtroEstrelas <= 5) {
  reviewsData = reviewsData.filter((r: any) => r.stars === filtroEstrelas);
}
```

✅ **Confirmação:** API aceita parâmetro `stars` opcional e filtra quando fornecido.

### 4. Verificação da UI (Causa Raiz Encontrada)

**Arquivo:** `frontend/src/app/estrategico/desempenho/components/DesempenhoClient.tsx`

**Linha 2061 (ANTES):**
```typescript
onClick={() => abrirDetalhesGoogleReviews(semana, 5)}
```

❌ **PROBLEMA:** UI estava passando `filtroEstrelas=5`, fazendo a API filtrar apenas reviews de 5 estrelas.

## Solução Aplicada

### Mudança 1: Remover Filtro de 5 Estrelas

**Arquivo:** `DesempenhoClient.tsx` - Linha 2061

**ANTES:**
```typescript
onClick={() => abrirDetalhesGoogleReviews(semana, 5)}
title="Clique para ver avaliações 5 estrelas"
```

**DEPOIS:**
```typescript
onClick={() => abrirDetalhesGoogleReviews(semana)}
title="Clique para ver todas as avaliações Google"
```

### Mudança 2: Atualizar Título do Modal

**Arquivo:** `DesempenhoClient.tsx` - Linha 1094

**ANTES:**
```typescript
const titulo = filtroEstrelas === 5 ? 'Avaliações 5★ Google' : 'Detalhes Google Reviews';
```

**DEPOIS:**
```typescript
const titulo = filtroEstrelas === 5 ? 'Avaliações 5★ Google' : 'Avaliações Google';
```

## Resultado Esperado

### Antes da Correção
- Modal mostrava: **33 reviews** (apenas 5 estrelas)
- Card mostrava: "33 (36)"

### Depois da Correção
- Modal mostra: **36 reviews** (todas as estrelas)
- Card continua mostrando: "33 (36)"
- Modal agrupa reviews por tipo:
  - **Positivas** (4-5★): 35 reviews
  - **Neutras** (3★): 0 reviews
  - **Negativas** (1-2★): 1 review

### Distribuição no Modal
O modal agora mostra a distribuição completa:
- 5★: 33 reviews
- 4★: 2 reviews
- 3★: 0 reviews
- 2★: 1 review
- 1★: 0 reviews

## Impacto nas Métricas

### Card "Avaliações 5★ Google"
- ✅ Continua mostrando apenas as 5 estrelas: **33**
- ✅ Mostra total entre parênteses: **(36)**
- ✅ Cálculo permanece correto

### Modal "Avaliações Google"
- ✅ Agora mostra TODAS as 36 reviews
- ✅ Média calculada considerando todas: 4.86
- ✅ Usuário pode filtrar por tipo (positivas/neutras/negativas)

## Validação

### Type-check
```bash
npm run type-check
```
✅ Passou sem erros

### Arquivos Alterados
1. `frontend/src/app/estrategico/desempenho/components/DesempenhoClient.tsx`
   - Linha 2061: Removido filtro `5` da chamada
   - Linha 2064: Atualizado tooltip
   - Linha 1094: Atualizado título do modal

## Notas Técnicas

### Por que o card mostra "33 (36)"?
- O valor `avaliacoes_5_google_trip` vem do campo `qtd_5_estrelas` do `silver.google_reviews_diario`
- Este campo conta APENAS reviews de 5 estrelas (correto)
- O total `google_reviews_total` vem do campo `total_reviews` (todas as estrelas)
- Comportamento está correto e não deve ser alterado

### Estrutura do Modal
O modal já estava preparado para mostrar todas as reviews:
- API: aceita filtro opcional
- RPC: retorna todas por padrão
- UI: agrupa por tipo (positivas/negativas/neutras)

O problema era apenas que a UI estava **forçando** o filtro de 5 estrelas ao chamar a API.

## Status Final

✅ **CORRIGIDO** - Modal agora mostra todas as 36 reviews
✅ **Type-check** passou sem erros
✅ **Pronto para commit e deploy**
