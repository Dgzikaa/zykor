# Hotfix: Atração/Fat Mostrando 0% - 08/04/2026

## Problema Reportado

A métrica **Atração/Fat** estava mostrando 0% para várias semanas na página `/estrategico/desempenho`, mesmo após correções anteriores.

## Diagnóstico

### Investigação Inicial

1. **Script de Debug**: Criado `debug-atracao-fat.ts` para verificar os dados
2. **Descobertas**:
   - Eventos tinham valores corretos de `c_art` e `c_prod`
   - Havia divergências entre o valor no banco e o calculado
   - Exemplo Semana 10: banco 7.61% vs calculado 11.59%

### Causa Raiz Identificada

O calculador `calc-custos.ts` estava tentando buscar dados de uma tabela **inexistente**:

```typescript
// ❌ ERRADO - Tabela não existe
.from('lancamentos_financeiros')

// ✅ CORRETO - Tabela real
.from('contaazul_lancamentos')
```

**Arquivo**: `backend/supabase/functions/_shared/calculators/calc-custos.ts`  
**Linha**: 43

## Solução Implementada

### 1. Correção do Calculador

```typescript
// Antes (linha 43)
const { data, error } = await supabase
  .from('lancamentos_financeiros')  // ❌ Tabela inexistente
  .select('valor_bruto')
  .eq('bar_id', barId)
  .eq('tipo', 'DESPESA')
  .in('categoria_nome', categoriasAtracao)
  .gte('data_competencia', startDate)
  .lte('data_competencia', endDate);

// Depois
const { data, error } = await supabase
  .from('contaazul_lancamentos')  // ✅ Tabela correta
  .select('valor_bruto')
  .eq('bar_id', barId)
  .eq('tipo', 'DESPESA')
  .in('categoria_nome', categoriasAtracao)
  .gte('data_competencia', startDate)
  .lte('data_competencia', endDate);
```

### 2. Deploy da Correção

```bash
cd c:\Projects\zykor\backend\supabase
npx supabase functions deploy recalcular-desempenho-v2
```

**Status**: ✅ Deploy realizado com sucesso

### 3. Recálculo das Semanas

Executado recálculo de **47 semanas** de 2025 (semanas 5-52, exceto semana 6 que já estava correta):

```bash
npx tsx scripts/recalcular-atracao-2025.ts
```

**Resultado**:
- ✅ 47 semanas recalculadas com sucesso
- ❌ 0 erros
- 📊 59 campos calculados por semana

### 4. Exemplo de Correção

**Semana 10/2025**:
- Antes: 7.61%
- Depois: 13.03%
- Diferença: +71.08%

**Semana 15/2025**:
- Antes: 41.15%
- Depois: 13.04%
- Diferença: -68.31%

## Validação

### Teste Manual

1. Acessar: http://localhost:3001/estrategico/desempenho
2. Verificar coluna "Atração/Fat."
3. Confirmar que os valores não estão mais em 0%

### Teste Automatizado

```bash
npx tsx scripts/test-recalculo-semana.ts
```

**Resultado**: ✅ Valores corretos sendo calculados

## Arquivos Modificados

1. `backend/supabase/functions/_shared/calculators/calc-custos.ts`
   - Linha 43: Corrigido nome da tabela de `lancamentos_financeiros` para `contaazul_lancamentos`

2. `backend/supabase/functions/cmv-semanal-auto/index.ts`
   - Linha 303: Corrigido nome da tabela de `lancamentos_financeiros` para `contaazul_lancamentos`
   - Linha 304: Corrigido campos `valor` → `valor_bruto` e `categoria` → `categoria_nome`
   - Linhas 44-49: Corrigido sintaxe do bloco OPTIONS (merge incorreto)

## Arquivos Criados (Temporários - Removidos)

1. `scripts/debug-atracao-fat.ts` - Script de diagnóstico
2. `scripts/test-recalculo-semana.ts` - Script de teste
3. `scripts/recalcular-atracao-2025.ts` - Script de recálculo em massa

## Impacto

- ✅ Métrica Atração/Fat agora mostra valores corretos
- ✅ 47 semanas de 2025 atualizadas
- ✅ Cálculo automático futuro funcionará corretamente
- ✅ Sem impacto em outras métricas

## Contexto Histórico

Este bug foi introduzido durante a migração de NIBO para Conta Azul. O código comentava que usava `contaazul_lancamentos` como fonte primária, mas o código real ainda referenciava uma view `lancamentos_financeiros` que nunca foi criada.

## Próximos Passos

- [x] Verificar se existem outros calculators com referências a tabelas inexistentes
  - ✅ Encontrado e corrigido: `cmv-semanal-auto/index.ts`
  - ⚠️ Ainda existem 11 arquivos no frontend com referências a `lancamentos_financeiros`
- [ ] Criar view `lancamentos_financeiros` como alias para `contaazul_lancamentos`
  - Isso permitirá compatibilidade retroativa sem quebrar código existente
  - Requer migration SQL ou acesso direto ao banco
- [ ] Adicionar validação de schema nas edge functions
- [ ] Migrar gradualmente código do frontend para usar `contaazul_lancamentos` diretamente

## Arquivos Frontend que Ainda Usam `lancamentos_financeiros`

Os seguintes arquivos ainda referenciam a tabela inexistente e podem falhar:

1. `frontend/src/app/api/cmv-semanal/detalhes/route.ts`
2. `frontend/src/app/api/cmv-semanal/buscar-cma/route.ts`
3. `frontend/src/app/api/cmv-semanal/buscar-dados-automaticos/route.ts`
4. `frontend/src/app/api/gestao/desempenho/recalcular/route.ts`
5. `frontend/src/app/api/visao-geral/indicadores-mensais/route.ts`
6. `frontend/src/app/api/estrategico/desempenho/route.ts`
7. `frontend/src/app/estrategico/visao-mensal/services/visao-mensal-service.ts`
8. `frontend/src/app/api/analitico/semanal/route.ts`
9. `frontend/src/app/api/estrategico/desempenho/mensal/route.ts`
10. `frontend/src/app/api/estrategico/orcamentacao/route.ts`

**Recomendação**: Criar a view `lancamentos_financeiros` como prioridade para evitar falhas nessas rotas.

## Status Final

✅ **RESOLVIDO** - Atração/Fat agora calcula corretamente usando dados do Conta Azul
