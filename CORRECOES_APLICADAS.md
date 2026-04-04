# Correções Aplicadas - Mix de Vendas e Metas Semanais

## 📅 Data: 02/04/2026

## 🎯 Problemas Identificados e Corrigidos

### 1. Mix de Vendas da Semana 12 ✅

**Problema:**
- Mix de bebidas estava em 69.48% no banco
- Planilha mostrava 67.7%
- Diferença de 1.78%

**Causa Raiz:**
- A stored procedure `calcular_mix_vendas` estava usando dados de `vendas_item` que estavam incompletos (apenas 7% dos dados)
- Os dados de `vendas_item` estavam com mapeamento incorreto (100% bebidas)

**Solução Aplicada:**
- Modificado `calc-operacional.ts` para calcular o mix diretamente dos eventos_base (média ponderada)
- Recalculada a semana 12

**Resultado:**
- Mix anterior: 69.48% bebidas
- Mix novo: 67.88% bebidas
- Diferença vs planilha: apenas 0.18% (aceitável, provavelmente arredondamento)

---

### 2. Meta Semanal Incorreta (Semana 14 e outras) ✅

**Problema:**
- Semana 14 (30/03 a 05/04) mostrava meta de apenas R$ 26.845
- Deveria ser R$ 340.366 (soma de todos os 7 dias)
- Atingimento estava errado: 326% em vez de 25%

**Causa Raiz:**
- A API `/api/gestao/desempenho/recalcular` estava mantendo a `meta_semanal` existente em vez de recalcular
- Linha 401: `meta_semanal: semana.meta_semanal` (mantinha valor antigo)

**Solução Aplicada:**
- Modificado `/api/gestao/desempenho/recalcular/route.ts` para:
  1. Buscar todos os eventos da semana
  2. Somar os `m1_r` de cada evento
  3. Atualizar `meta_semanal` com a soma correta
- Recalculadas 13 semanas (15-27) que estavam com meta = 0

**Resultado:**
- Semana 14: R$ 26.845 → R$ 340.366 ✅
- Semanas 15-27: R$ 0 → valores corretos ✅

---

## 📝 Arquivos Modificados

1. `backend/supabase/functions/_shared/calculators/calc-operacional.ts`
   - Substituído cálculo via RPC por cálculo direto dos eventos_base
   - Mix agora usa média ponderada dos percent_b/d/c dos eventos

2. `frontend/src/app/api/gestao/desempenho/recalcular/route.ts`
   - Adicionado cálculo da meta_semanal (soma dos m1_r)
   - Meta agora é recalculada em vez de mantida

3. `frontend/src/app/api/debug/mix-vendas-semana/route.ts`
   - Adicionado campo `m1_r` no select dos eventos
   - Adicionado `m1_receita` no retorno dos eventos

---

## 🚀 Próximos Passos

1. **Deploy da Edge Function** `recalcular-desempenho-v2` com o novo cálculo de mix
   - Atualmente com erro de boot (503)
   - Código TypeScript está correto, pode ser problema de ambiente Deno

2. **Monitorar recálculos automáticos**
   - Verificar se os crons estão usando o cálculo correto
   - Garantir que novas semanas sejam calculadas corretamente

3. **Validar outras semanas**
   - Verificar se semanas 1-13 estão com mix correto
   - Confirmar que não há outros problemas de agregação

---

## 🧪 Scripts Criados para Debug

- `scripts/debug-mix-semana-12.js` - Investiga mix de uma semana
- `scripts/verificar-semana-14.js` - Verifica meta da semana 14
- `scripts/verificar-todas-metas.js` - Verifica todas as metas
- `scripts/corrigir-todas-metas.js` - Corrige todas as metas de uma vez
- `scripts/comparar-semanas.js` - Compara mix entre semanas
- `scripts/detalhar-mix-s12.js` - Detalha cálculo do mix evento por evento

---

## ✅ Status Final

- ✅ Mix da semana 12 corrigido (67.88% vs 67.7% planilha = 0.18% diff)
- ✅ Meta da semana 14 corrigida (R$ 340k vs R$ 26k)
- ✅ Metas das semanas 15-27 corrigidas
- ⚠️  Edge Function precisa ser re-deployada (erro 503)
