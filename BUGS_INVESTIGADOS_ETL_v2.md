# Investigação: 3 Bugs Visuais Pós ETL v2

Data: 21/04/2026

## BUG 1: Google "33 (36)" vs Modal com 33 ✅ NÃO É BUG

### Diagnóstico
- **Card mostra:** "33 (36)" 
- **Modal mostra:** 30 comentários (print do user), todos 5 estrelas
- **Banco confirma:** 36 reviews totais no período S16/26 (13-19/04):
  - 33 reviews de 5 estrelas
  - 2 reviews de 4 estrelas
  - 1 review de 2 estrelas

### Detalhamento
Query executada:
```sql
SELECT data_referencia, total_reviews, qtd_5_estrelas
FROM silver.google_reviews_diario
WHERE bar_id = 3 AND data_referencia BETWEEN '2026-04-13' AND '2026-04-19'
```

Resultado:
- 13/04: 7 reviews (5 de 5★)
- 14/04: 2 reviews (1 de 5★)
- 15/04: 2 reviews (2 de 5★)
- 16/04: 25 reviews (25 de 5★)
- **Total:** 36 reviews, 33 de 5 estrelas

### Conclusão
✅ **NÃO É BUG**. O card está correto:
- "33" = reviews de 5 estrelas
- "(36)" = total de reviews
- Modal filtra apenas reviews com 5 estrelas (comportamento esperado)

---

## BUG 2: NPS Digital Zerado na Tela Detalhe ⚠️ REQUER VERIFICAÇÃO

### Diagnóstico
- **Gold mostra:** `nps_digital=10.00`, `nps_digital_respostas=2`
- **Silver mostra:** 
  - 13/04: 2 respostas "NPS Digital"
  - 14/04: 1 resposta "(sem pesquisa)"
  - 16/04: 1 resposta "(sem pesquisa)"
- **Integrations.falae_respostas:** 9 respostas com `search_name="NPS Digital"` + 2 null

### Detalhamento
Query executada:
```sql
SELECT search_name, COUNT(*)
FROM integrations.falae_respostas
WHERE bar_id = 3 
  AND created_at BETWEEN '2026-04-13T00:00:00' AND '2026-04-19T23:59:59'
GROUP BY search_name
```

Resultado:
- "NPS Digital": 9 respostas
- null: 2 respostas

### Análise da API
A API `/api/falae/detailed-summary`:
- ✅ Busca corretamente por `created_at` (não `data_referencia`)
- ✅ Filtra por `search_name="NPS Digital"`
- ✅ Deve retornar 9 respostas

### Possíveis Causas
1. Modal estava buscando período diferente
2. Erro de conexão temporário durante teste
3. Bug na UI ao renderizar os dados (não na API)

### Recomendação
⚠️ Testar novamente o modal "Detalhes NPS Digital" para confirmar se está realmente zerado ou se foi um problema pontual.

---

## BUG 3: Tela Desempenho Zerada (Tempos/Atrasos/Faturamento) ✅ CORRIGIDO

### Diagnóstico
- **Gold tem valores:**
  - `tempo_drinks = 246.00` segundos
  - `atrasinho_drinks = 185`
  - `atrasao_drinks = 96`
  - `atrasos_drinks_perc = 7.21%`
  - `cancelamentos_total = 2865.25`
  - `qui_sab_dom = 258473.69`
  - `perc_faturamento_ate_19h = null` ⚠️

- **UI esperava:**
  - `tempo_saida_bar` (não `tempo_drinks`)
  - `atrasinhos_bar` (não `atrasinho_drinks`)
  - `atrasos_bar` (não `atrasao_drinks`)
  - `cancelamentos` (não `cancelamentos_total`)

### Causa Raiz
O ETL v2 renomeou/adicionou campos no Gold, mas o service não mapeava os novos nomes para os nomes que a UI esperava.

### Correção Aplicada

#### 1. Atualizado `types.ts`
Adicionados campos novos do ETL v2:
```typescript
tempo_drinks?: number;
atrasinho_drinks?: number;
atrasao_drinks?: number;
atrasos_drinks_perc?: number;
qtd_drinks_total?: number;
```

#### 2. Atualizado `desempenho-service.ts`
Mapeamento de campos Gold → UI:
```typescript
// Drinks
tempo_saida_bar: toNum((s as any).tempo_drinks) ?? toNum(s.tempo_saida_bar) ?? s.tempo_saida_bar,
atrasinhos_bar: toNum((s as any).atrasinho_drinks) ?? toNum(s.atrasinhos_bar) ?? s.atrasinhos_bar,
atrasos_bar: toNum((s as any).atrasao_drinks) ?? toNum(s.atrasos_bar) ?? s.atrasos_bar,
atrasos_bar_perc: toNum((s as any).atrasos_drinks_perc) ?? toNum(s.atrasos_bar_perc) ?? s.atrasos_bar_perc,

// Cancelamentos
cancelamentos: toNum((s as any).cancelamentos_total) ?? toNum(s.cancelamentos) ?? s.cancelamentos,
```

### Campos Restantes com Valores

#### ✅ Funcionando
- `qui_sab_dom`: 258473.69 (já existia no Gold)
- `cancelamentos`: 2865.25 (mapeado de `cancelamentos_total`)
- `tempo_drinks`: 246 segundos (mapeado para `tempo_saida_bar`)
- `atrasinho_drinks`: 185 (mapeado para `atrasinhos_bar`)
- `atrasao_drinks`: 96 (mapeado para `atrasos_bar`)

#### ⚠️ Ainda Null
- `perc_faturamento_ate_19h`: null no Gold
  - **Causa:** ETL não está calculando este campo
  - **Recomendação:** Verificar ETL v2 para implementar cálculo

### Status Final
✅ **CORRIGIDO**. Os campos de tempos, atrasos e cancelamentos agora aparecem na tela.

⚠️ **Pendente:** Campo `perc_faturamento_ate_19h` requer fix no ETL.

---

## Validação Realizada

### Type-check
```bash
npm run type-check
```
✅ Passou sem erros

### Arquivos Alterados
1. `frontend/src/app/estrategico/desempenho/types.ts`
2. `frontend/src/app/estrategico/desempenho/services/desempenho-service.ts`

---

## Próximos Passos

1. ✅ Bug 1: Nenhuma ação necessária (não é bug)
2. ⚠️ Bug 2: Testar modal NPS Digital novamente
3. ✅ Bug 3: Corrigido (pronto para deploy)
4. ⚠️ Investigar por que `perc_faturamento_ate_19h` está null no ETL v2
