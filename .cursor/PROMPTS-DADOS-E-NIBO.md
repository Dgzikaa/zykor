# PROMPTS DE CORREÇÃO — DADOS + MIGRAÇÃO NIBO → CONTA AZUL

**Data**: 04/04/2026
**Status**: 🔴 EXECUTAR AGORA — São 8 prompts que corrigem problemas críticos de dados e eliminam NIBO
**Referência**: Auditoria profunda feita sobre as 6 páginas críticas, cron jobs, e qualidade de dados

> Execute cada prompt em um chat separado no Cursor.
> **ORDEM OBRIGATÓRIA**: DATA-1 → DATA-2 → DATA-3 → DATA-4 → NIBO-1 → NIBO-2 → NIBO-3 → NIBO-4

---

## DATA-1 — Corrigir custototal = 0 nos Cancelamentos (BUG CRÍTICO)

```
Leia `.cursor/zykor-context.md` para contexto.

PROBLEMA CRÍTICO: A tabela `contahub_cancelamentos` tem `custototal = 0.00` em TODOS os registros (2025 e 2026). O motivo é que o `contahub-processor` (linha ~582) tenta ler `item.custototal` do registro raw, mas o ContaHub retorna os cancelamentos como uma LISTA de itens dentro de cada registro, onde cada item tem `itm_vrcheio` (valor cheio) e `itm_qtd` (quantidade). O campo `custototal` NÃO existe no raw data.

DADOS REAIS CONFIRMADOS: A coluna `raw_data` de `contahub_cancelamentos` contém JSON com arrays de itens. Exemplo real da semana 13/2026 para bar_id=3: o valor correto seria ~R$16.937 (soma de itm_vrcheio * itm_qtd de cada item).

TAREFA:
1. Abra `backend/supabase/functions/contahub-processor/index.ts`

2. Localize o case 'cancelamentos' (linha ~577-602). O código atual é:
   ```typescript
   const custototal = parseFloat(item.custototal || item.custo_total || item.custo || 0) || 0;
   ```

3. Substitua pela lógica correta. Primeiro, entenda a estrutura do raw_data:
   - Cada registro do ContaHub é um "evento de cancelamento" (uma comanda/mesa)
   - Dentro de `item` (que é o registro raw), pode haver um campo com a lista de itens cancelados
   - Os campos possíveis para os itens são: `itens`, `items`, `produtos`, ou o próprio item pode ser flat

4. Implemente a extração correta:
   ```typescript
   case 'cancelamentos':
     console.log(`🔄 Processando registros cancelamentos com UPSERT para ${dataDate}...`);

     const cancelamentosRecords = records.map((item: any) => {
       // Calcular custototal a partir dos itens individuais
       let custototal = 0;

       // Tentar extrair itens do registro raw
       const itens = item.itens || item.items || item.produtos || [];

       if (Array.isArray(itens) && itens.length > 0) {
         // Somar itm_vrcheio * itm_qtd de cada item
         custototal = itens.reduce((sum: number, subItem: any) => {
           const valor = parseFloat(subItem.itm_vrcheio || subItem.valor_cheio || subItem.valor || 0) || 0;
           const qtd = parseFloat(subItem.itm_qtd || subItem.quantidade || subItem.qtd || 1) || 1;
           return sum + (valor * qtd);
         }, 0);
       } else {
         // Fallback: tentar ler campos diretos do item
         custototal = parseFloat(item.custototal || item.custo_total || item.vlr_total || item.valor_total || 0) || 0;

         // Se ainda 0, tentar calcular de campos individuais
         if (custototal === 0) {
           const valor = parseFloat(item.itm_vrcheio || item.valor_cheio || 0) || 0;
           const qtd = parseFloat(item.itm_qtd || item.quantidade || 1) || 1;
           if (valor > 0) {
             custototal = valor * qtd;
           }
         }
       }

       const itemData = item.data || item.dt_gerencial || item.data_gerencial || dataDate;
       const dataFinal = typeof itemData === 'string' ? itemData.split('T')[0].split(' ')[0] : dataDate;

       return {
         bar_id: barId,
         data: dataFinal,
         custototal,
         raw_data: item,
         created_at: new Date().toISOString(),
         updated_at: new Date().toISOString()
       };
     }).filter((r: any) => r.data);
     // ... rest stays the same
   ```

5. IMPORTANTE: Antes de implementar, faça um SELECT no banco para inspecionar a estrutura REAL do raw_data:
   ```sql
   SELECT raw_data FROM contahub_cancelamentos
   WHERE bar_id = 3 AND data >= '2026-03-24'
   LIMIT 3;
   ```
   Use os nomes de campos EXATOS que encontrar no JSON. Adapte o código acima com os nomes corretos.

6. Após corrigir o processor, crie uma função de BACKFILL para recalcular todos os custototal históricos:
   ```typescript
   // Adicione uma rota/modo 'recalculate-cancelamentos' no contahub-processor
   // Que lê TODOS os registros de contahub_cancelamentos, recalcula custototal a partir do raw_data, e faz UPDATE
   ```

   OU crie uma migration SQL:
   ```sql
   -- Recalcular custototal de todos os cancelamentos a partir do raw_data
   -- ADAPTE os nomes dos campos conforme a estrutura real do JSON
   UPDATE contahub_cancelamentos
   SET custototal = (
     SELECT COALESCE(SUM(
       (item->>'itm_vrcheio')::numeric * COALESCE((item->>'itm_qtd')::numeric, 1)
     ), 0)
     FROM jsonb_array_elements(
       CASE
         WHEN raw_data->'itens' IS NOT NULL THEN raw_data->'itens'
         WHEN raw_data->'items' IS NOT NULL THEN raw_data->'items'
         WHEN raw_data->'produtos' IS NOT NULL THEN raw_data->'produtos'
         ELSE '[]'::jsonb
       END
     ) AS item
   ),
   updated_at = NOW()
   WHERE custototal = 0 OR custototal IS NULL;
   ```

7. VALIDAÇÃO: Após o backfill, confirme:
   ```sql
   -- Deve retornar 0 registros (exceto datas que realmente não tiveram cancelamentos)
   SELECT COUNT(*) FROM contahub_cancelamentos
   WHERE custototal = 0 AND raw_data IS NOT NULL
   AND jsonb_typeof(raw_data) = 'object';

   -- Verificar semana 13 bar_id=3 (deve ser ~R$16.937)
   SELECT SUM(custototal) FROM contahub_cancelamentos
   WHERE bar_id = 3 AND data BETWEEN '2026-03-24' AND '2026-03-30';
   ```

NÃO crie arquivos .md.

COMMIT: "fix(critical): corrigir cálculo custototal cancelamentos no contahub-processor + backfill histórico"
```

---

## DATA-2 — Adicionar Descontos ao desempenho_semanal

```
Leia `.cursor/zykor-context.md` para contexto.

PROBLEMA: A tabela `contahub_analitico` tem dados reais de desconto no campo `desconto` (ex: R$6.443 na semana 13/2026), mas esses dados NUNCA são gravados em `desempenho_semanal`. Não existe coluna de desconto em `desempenho_semanal`, e nenhum calculador busca esses dados.

DADOS CONFIRMADOS:
- `contahub_analitico` tem campo `desconto` com valores reais
- Semana 13 bar_id=3: ~R$6.443 em descontos
- `desempenho_semanal` NÃO tem colunas de desconto

TAREFA:

1. Adicione colunas de desconto em `desempenho_semanal` via nova migration:
   ```sql
   ALTER TABLE desempenho_semanal
   ADD COLUMN IF NOT EXISTS desconto_total NUMERIC DEFAULT 0,
   ADD COLUMN IF NOT EXISTS desconto_percentual NUMERIC DEFAULT 0;

   COMMENT ON COLUMN desempenho_semanal.desconto_total IS 'Total de descontos em R$ (soma de contahub_analitico.desconto)';
   COMMENT ON COLUMN desempenho_semanal.desconto_percentual IS 'Descontos como % do faturamento bruto';
   ```

2. Adicione o cálculo de descontos no calculador correto.
   Abra `backend/supabase/functions/_shared/calculators/calc-custos.ts` (ou `calc-faturamento.ts` — verifique qual faz mais sentido semântico).

   Adicione a query:
   ```typescript
   // Buscar descontos do período
   const { data: descontosData, error: descontosError } = await supabase
     .from('contahub_analitico')
     .select('desconto')
     .eq('bar_id', barId)
     .gte('data', startDate)
     .lte('data', endDate);

   const descontoTotal = (descontosData || []).reduce(
     (sum, row) => sum + (parseFloat(row.desconto) || 0), 0
   );

   // Calcular percentual sobre faturamento bruto
   const descontoPercentual = faturamentoBruto > 0
     ? (descontoTotal / faturamentoBruto) * 100
     : 0;
   ```

3. Retorne os novos campos no resultado do calculador:
   ```typescript
   return {
     ...existingResults,
     desconto_total: descontoTotal,
     desconto_percentual: Math.round(descontoPercentual * 100) / 100,
   };
   ```

4. Atualize o FIELD_MAPPING em `recalcular-desempenho-v2/index.ts` (~linha 105-167):
   ```typescript
   // Adicione ao FIELD_MAPPING:
   'desconto_total': 'desconto_total',
   'desconto_percentual': 'desconto_percentual',
   ```

5. Verifique se `contahub_analitico` tem campo `data` ou `dt_gerencial`:
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'contahub_analitico' ORDER BY ordinal_position;
   ```
   Adapte o nome do campo de data na query.

6. Faça um BACKFILL via SQL para preencher descontos históricos:
   ```sql
   -- Preencher descontos para todas as semanas existentes
   WITH descontos_semanais AS (
     SELECT
       a.bar_id,
       d.numero_semana,
       d.ano,
       SUM(a.desconto) as desconto_total,
       CASE WHEN SUM(COALESCE(a.faturamento, a.liquido, 0)) > 0
        THEN (SUM(a.desconto) / SUM(COALESCE(a.faturamento, a.liquido, 0))) * 100
        ELSE 0
       END as desconto_percentual
     FROM contahub_analitico a
     JOIN desempenho_semanal d ON d.bar_id = a.bar_id
       AND a.data BETWEEN d.data_inicio AND d.data_fim
     WHERE a.desconto > 0
     GROUP BY a.bar_id, d.numero_semana, d.ano
   )
   UPDATE desempenho_semanal ds
   SET
     desconto_total = dsc.desconto_total,
     desconto_percentual = ROUND(dsc.desconto_percentual::numeric, 2)
   FROM descontos_semanais dsc
   WHERE ds.bar_id = dsc.bar_id
     AND ds.numero_semana = dsc.numero_semana
     AND ds.ano = dsc.ano;
   ```
   NOTA: Adapte os nomes de colunas (`data`, `faturamento`, etc.) conforme a estrutura real da tabela. Consulte information_schema primeiro.

7. VALIDAÇÃO:
   ```sql
   -- Semana 13 bar_id=3 deve mostrar ~R$6.443
   SELECT desconto_total, desconto_percentual
   FROM desempenho_semanal
   WHERE bar_id = 3 AND numero_semana = 13 AND ano = 2026;

   -- Semanas 11 e 12 também devem ter valores > 0
   SELECT numero_semana, desconto_total, desconto_percentual
   FROM desempenho_semanal
   WHERE bar_id = 3 AND ano = 2026 AND numero_semana BETWEEN 10 AND 14
   ORDER BY numero_semana;
   ```

NÃO crie arquivos .md.

COMMIT: "feat: adicionar tracking de descontos ao desempenho_semanal + backfill histórico"
```

---

## DATA-3 — Corrigir c_art (custo atração) em eventos_base

```
Leia `.cursor/zykor-context.md` para contexto.

PROBLEMA: Na tabela `eventos_base`, o campo `c_art` (custo de atração) é 0.00 para TODOS os dias da semana 13/2026. Isso faz com que o cálculo de atração/faturamento fique dependente APENAS dos dados de `lancamentos_financeiros` via `bar_categorias_custo`. O campo `c_art` deveria refletir os custos de atração por dia.

CONTEXTO:
- `calc-custos.ts` calcula `custo_atracao_faturamento` usando `lancamentos_financeiros` filtrado por categorias tipo 'atracao' em `bar_categorias_custo`
- `eventos_base` tem campo `c_art` que deveria ser preenchido com o custo de atração DO DIA
- Os dados de atração vêm do Conta Azul (via `contaazul_lancamentos` / `lancamentos_financeiros` VIEW)
- Semana 13 bar_id=3: apenas 2 lançamentos (Telão R$20K + Caixa de Som R$3K = R$23K), resultando em 5.4%

TAREFA:
1. Descubra como `eventos_base.c_art` é populado atualmente:
   - Busque por `c_art` em todo o backend: `grep -r "c_art" backend/`
   - Busque em `sync-eventos-automatico`: como ele preenche c_art?
   - Busque no `recalcular-desempenho-v2` e calculadores

2. Se `c_art` é populado por `sync-eventos-automatico`:
   - Verifique se essa função busca dados do Conta Azul para preencher c_art
   - Se não busca, adicione a lógica para:
     a. Consultar `lancamentos_financeiros` com categorias de tipo 'atracao' (via `bar_categorias_custo`)
     b. Agrupar por data
     c. Distribuir o custo proporcionalmente entre os dias

3. Se `c_art` NÃO é populado por nenhuma função:
   - Adicione a lógica no sync de eventos ou no recalcular-desempenho
   - O cálculo deve ser:
     ```typescript
     // Para cada dia do período
     const { data: atracaoLanc } = await supabase
       .from('lancamentos_financeiros')
       .select('valor, data_pagamento, data_competencia, categoria')
       .eq('bar_id', barId)
       .gte('data_competencia', startDate)
       .lte('data_competencia', endDate)
       .in('categoria', categoriasAtracao); // categorias do tipo 'atracao' em bar_categorias_custo

     // Distribuir por dia usando data_competencia
     ```

4. IMPORTANTE sobre o dado específico da semana 13:
   - A semana 13 (24-30/03/2026) realmente tem poucos lançamentos de atração no Conta Azul
   - Isso PODE ser um problema de dados incompletos no Conta Azul (lançamentos ainda não feitos), NÃO necessariamente um bug de código
   - O código deve garantir que os dados DISPONÍVEIS sejam calculados corretamente
   - Adicione um LOG quando o custo de atração de uma semana for < 3% do faturamento (threshold de alerta):
     ```typescript
     if (custoAtracaoPercentual < 3) {
       console.warn(`⚠️ Atração muito baixa: ${custoAtracaoPercentual.toFixed(1)}% na semana ${numeroSemana} bar_id=${barId}. Verificar lançamentos no Conta Azul.`);
     }
     ```

5. VALIDAÇÃO:
   ```sql
   -- Verificar c_art em eventos_base
   SELECT data, c_art, real_r FROM eventos_base
   WHERE bar_id = 3 AND data BETWEEN '2026-03-24' AND '2026-03-30'
   ORDER BY data;

   -- Comparar com lancamentos_financeiros
   SELECT data_competencia, categoria, valor FROM lancamentos_financeiros
   WHERE bar_id = 3 AND data_competencia BETWEEN '2026-03-24' AND '2026-03-30'
   AND categoria IN (SELECT categoria_nome FROM bar_categorias_custo WHERE tipo_custo = 'atracao');
   ```

NÃO crie arquivos .md.

COMMIT: "fix: garantir preenchimento de c_art em eventos_base a partir de lancamentos do Conta Azul"
```

---

## DATA-4 — Validar e documentar stockout da semana 13

```
Leia `.cursor/zykor-context.md` para contexto.

PROBLEMA: O stockout da semana 13 bateu 26.48% que parece alto. Investigação confirmou que os dados são REAIS — dia 26/03 teve 31/42 comidas em stockout (73%!), e dia 29/03 teve apenas 13 produtos BEBIDA ativos (normalmente ~50). A view `contahub_stockout_filtrado` está filtrando corretamente.

O PROBLEMA REAL pode ser:
a) Dados reais do bar (stock problems genuínos nessa semana)
b) ContaHub não coletou todos os produtos em alguns dias (dados incompletos)
c) A view filtra demais, excluindo produtos que deveriam contar

TAREFA:
1. Adicione validação de dados no cálculo de stockout para detectar anomalias:

   Abra `backend/supabase/functions/_shared/calculators/calc-operacional.ts`

   Após o RPC `calcular_stockout_semanal`, adicione validações:
   ```typescript
   // Validação: detectar dias com dados anômalos
   const { data: dailyCheck } = await supabase
     .from('contahub_stockout_filtrado')
     .select('data, categoria_local, prd_venda')
     .eq('bar_id', barId)
     .gte('data', startDate)
     .lte('data', endDate);

   if (dailyCheck) {
     // Agrupar por dia e categoria
     const dailyStats = new Map<string, { total: number, stockout: number }>();
     for (const row of dailyCheck) {
       const key = `${row.data}`;
       if (!dailyStats.has(key)) dailyStats.set(key, { total: 0, stockout: 0 });
       const stat = dailyStats.get(key)!;
       stat.total++;
       if (row.prd_venda === 'N') stat.stockout++;
     }

     // Alertar se algum dia tem:
     // - Menos de 20 produtos totais (possível coleta incompleta)
     // - Mais de 50% stockout (possível anomalia)
     for (const [day, stat] of dailyStats) {
       if (stat.total < 20) {
         console.warn(`⚠️ STOCKOUT ANOMALIA: ${day} tem apenas ${stat.total} produtos (esperado ~80+). Coleta pode estar incompleta.`);
       }
       const pct = (stat.stockout / stat.total) * 100;
       if (pct > 50) {
         console.warn(`⚠️ STOCKOUT ALTO: ${day} tem ${pct.toFixed(1)}% stockout (${stat.stockout}/${stat.total}). Verificar dados.`);
       }
     }
   }
   ```

2. Adicione um campo de metadata no desempenho_semanal para marcar semanas com dados suspeitos:
   ```sql
   ALTER TABLE desempenho_semanal
   ADD COLUMN IF NOT EXISTS alertas_dados JSONB DEFAULT '[]'::jsonb;

   COMMENT ON COLUMN desempenho_semanal.alertas_dados IS 'Array de alertas automáticos sobre qualidade de dados da semana';
   ```

3. No calculador, popule os alertas:
   ```typescript
   const alertas: string[] = [];

   // ... após as validações acima
   if (diasComPoucoProduto > 0) {
     alertas.push(`${diasComPoucoProduto} dia(s) com possível coleta incompleta de stockout`);
   }
   if (stockoutPercentual > 25) {
     alertas.push(`Stockout ${stockoutPercentual.toFixed(1)}% acima do normal (média: ~15%)`);
   }

   return {
     ...existingResults,
     alertas_dados: alertas,
   };
   ```

4. Na RPC `calcular_stockout_semanal`, adicione um filtro para excluir dias com dados claramente incompletos (opcional, com flag):
   ```sql
   -- Não altere o cálculo padrão, mas adicione uma versão "limpa":
   CREATE OR REPLACE FUNCTION calcular_stockout_semanal_limpo(
     p_bar_id integer,
     p_data_inicio date,
     p_data_fim date,
     p_min_produtos integer DEFAULT 20
   ) RETURNS TABLE(...) AS $$
   -- Mesmo que calcular_stockout_semanal, mas excluindo dias
   -- onde total_produtos_dia < p_min_produtos
   $$;
   ```

5. VALIDAÇÃO:
   ```sql
   -- Verificar produtos por dia na semana 13
   SELECT data, COUNT(*) as total,
     COUNT(*) FILTER (WHERE prd_venda = 'N') as stockout,
     ROUND(COUNT(*) FILTER (WHERE prd_venda = 'N') * 100.0 / COUNT(*), 1) as pct
   FROM contahub_stockout_filtrado
   WHERE bar_id = 3 AND data BETWEEN '2026-03-24' AND '2026-03-30'
   GROUP BY data ORDER BY data;
   ```

NÃO crie arquivos .md.

COMMIT: "feat: adicionar validação de anomalias no cálculo de stockout + alertas automáticos"
```

---

## NIBO-1 — Migrar DRE para usar Conta Azul (página mais crítica)

```
Leia `.cursor/zykor-context.md` para contexto.

PROBLEMA: A página DRE (Demonstrativo de Resultado do Exercício) é a ÚNICA página que ainda depende diretamente da API do NIBO. Ela busca dados via rotas `/api/financeiro/nibo/dre-monthly-detailed`, `/api/financeiro/nibo/dre-yearly-detailed`, e usa a tabela `nibo_categorias` para mapear categorias.

MAS: Os dados financeiros JÁ estão no Conta Azul, acessíveis via:
- `contaazul_lancamentos` (tabela base com 71,524+ registros)
- `lancamentos_financeiros` (VIEW sobre contaazul_lancamentos com campos renomeados)
- `bar_categorias_custo` (mapeia categorias para tipos de custo)

TAREFA:
1. Crie novas API routes para DRE usando dados do Conta Azul:

   a. `frontend/src/app/api/financeiro/dre/mensal/route.ts` — DRE mensal:
   ```typescript
   // Query lancamentos_financeiros agrupado por mês e categoria
   // Estrutura de retorno deve seguir a mesma hierarquia do DRE:
   // Receita > Custos Variáveis > CMV > Mão-de-Obra > Despesas...

   const { data } = await supabase
     .from('lancamentos_financeiros')
     .select('valor, categoria, tipo, data_competencia')
     .eq('bar_id', barId)
     .gte('data_competencia', `${ano}-${mes}-01`)
     .lt('data_competencia', `${ano}-${mesProximo}-01`);

   // Agrupar por macro-categoria usando bar_categorias_custo
   // Retornar no formato: { categorias: [{ nome, tipo, subtotal, itens: [...] }] }
   ```

   b. `frontend/src/app/api/financeiro/dre/anual/route.ts` — DRE anual:
   ```typescript
   // Mesmo conceito, agrupado por mês dentro do ano
   ```

2. Verifique a VIEW `view_dre` — se ela já existe e consolida os dados do Conta Azul:
   ```sql
   SELECT * FROM information_schema.views WHERE table_name = 'view_dre';
   -- Se existir, use-a como base. Se não, crie.
   ```

3. Crie um mapeamento de categorias Conta Azul → categorias DRE:
   - Verifique `bar_categorias_custo` — ela já tem `tipo_custo` que pode ser mapeado
   - As macro-categorias do DRE são:
     1. Receita (faturamento)
     2. Custos Variáveis (comissões, impostos, taxas)
     3. CMV (custo de insumos - comida/bebida)
     4. Mão-de-Obra (salários, encargos, benefícios)
     5. Despesas Comerciais (marketing, atração)
     6. Despesas Administrativas (contabilidade, software, etc)
     7. Despesas Operacionais (manutenção, limpeza, etc)
     8. Despesas de Ocupação (aluguel, energia, água, IPTU)
     9. Não Operacionais (multas, juros)
     10. Investimentos
     11. Sócios (pró-labore, dividendos)

   Se `bar_categorias_custo` NÃO tem mapeamento suficiente, crie uma nova tabela:
   ```sql
   CREATE TABLE IF NOT EXISTS dre_categorias_mapeamento (
     id SERIAL PRIMARY KEY,
     categoria_contaazul TEXT NOT NULL,
     macro_categoria_dre TEXT NOT NULL,
     sub_categoria_dre TEXT,
     tipo TEXT CHECK (tipo IN ('receita', 'despesa')),
     bar_id INTEGER REFERENCES bares(id),
     ativo BOOLEAN DEFAULT true
   );
   ```

4. Atualize as duas páginas DRE para usar as novas rotas:
   - `frontend/src/app/ferramentas/dre/page.tsx`
   - `frontend/src/app/operacional/dre/page.tsx`

   Substitua as chamadas a `/api/financeiro/nibo/dre-*` pelas novas `/api/financeiro/dre/*`

5. Mantenha as rotas NIBO do DRE por enquanto, mas adicione no topo de cada uma:
   ```typescript
   // [DEPRECATED 2026-04-04] Esta rota usa API NIBO que foi descontinuada.
   // Substituída por /api/financeiro/dre/mensal e /api/financeiro/dre/anual
   // TODO(rodrigo/2026-05): Remover após confirmar migração completa
   ```

6. VALIDAÇÃO:
   - A nova rota DRE mensal deve retornar dados equivalentes ao NIBO para meses que têm dados em ambos
   - Compare o total de receitas e despesas de um mês (ex: janeiro/2026) entre a rota nova e a antiga

NÃO crie arquivos .md.

COMMIT: "feat: migrar DRE para dados do Conta Azul, deprecar rotas NIBO/DRE"
```

---

## NIBO-2 — Migrar Agendamento e demais funcionalidades NIBO

```
Leia `.cursor/zykor-context.md` para contexto.

PROBLEMA: Além do DRE, existem outras funcionalidades que dependem da API do NIBO:
- Agendamento de pagamentos (schedules)
- Stakeholders (fornecedores)
- Employees (funcionários)
- Categorias NIBO
- Centros de custo
- Exportação Excel

Estas funcionalidades precisam ser migradas para usar o Conta Azul OU removidas se não são mais necessárias.

LISTA DE ARQUIVOS A MIGRAR/REMOVER:

A) ROTAS NIBO DO API (12 arquivos):
   1. frontend/src/app/api/financeiro/nibo/categorias/route.ts
   2. frontend/src/app/api/financeiro/nibo/categorias/sync/route.ts
   3. frontend/src/app/api/financeiro/nibo/centros-custo/route.ts
   4. frontend/src/app/api/financeiro/nibo/consultas/lancamentos-retroativos/route.ts
   5. frontend/src/app/api/financeiro/nibo/dre-monthly-2025/route.ts
   6. frontend/src/app/api/financeiro/nibo/dre-monthly-detailed/route.ts
   7. frontend/src/app/api/financeiro/nibo/dre-yearly-detailed/route.ts
   8. frontend/src/app/api/financeiro/nibo/employees/route.ts
   9. frontend/src/app/api/financeiro/nibo/export-excel/route.ts
   10. frontend/src/app/api/financeiro/nibo/schedules/route.ts
   11. frontend/src/app/api/financeiro/nibo/stakeholders/route.ts
   12. frontend/src/app/api/financeiro/nibo/stakeholders/[id]/route.ts

B) ROTAS DE CREDENCIAIS NIBO (4 arquivos):
   1. frontend/src/app/api/configuracoes/credenciais/nibo-connect/route.ts
   2. frontend/src/app/api/configuracoes/credenciais/nibo-status/route.ts
   3. frontend/src/app/api/configuracoes/credenciais/nibo-sync/route.ts
   4. frontend/src/app/api/configuracoes/credenciais/nibo-sync-simple/route.ts

TAREFA:
1. Para CADA rota NIBO, determine se a funcionalidade é necessária:
   - schedules (agendamento de pagamentos) → Verificar se o módulo de agendamento usa. Se sim, redirecionar para Conta Azul. Se não, marcar como deprecated.
   - stakeholders (fornecedores) → Verificar se o agendamento usa para buscar fornecedores
   - employees → Verificar se alguma página de RH/CMO usa
   - categorias → JÁ temos `bar_categorias_custo` — deprecated
   - centros-custo → Verificar se é usado em algum lugar ativo
   - export-excel → Migrar para usar dados do Conta Azul
   - consultas/lancamentos-retroativos → Migrar para `lancamentos_financeiros`

2. Para funcionalidades NECESSÁRIAS, crie equivalentes usando Conta Azul:
   - Agendamento: Se usa API NIBO para agendar pagamentos, criar uma rota que use a API do Conta Azul
   - Fornecedores: Se são necessários, buscar de `contaazul_lancamentos` (campo fornecedor/stakeholder)

3. Para funcionalidades NÃO NECESSÁRIAS, mova para _deprecated:
   ```
   Mova toda a pasta frontend/src/app/api/financeiro/nibo/
   para frontend/src/app/api/financeiro/_deprecated_nibo/
   ```
   Adicione no topo de cada arquivo:
   ```typescript
   // [DEPRECATED 2026-04-04] Rota NIBO descontinuada.
   // Dados financeiros agora vêm do Conta Azul via lancamentos_financeiros.
   // TODO(rodrigo/2026-05): Remover completamente
   ```

4. Mova as rotas de credenciais NIBO:
   ```
   Mova frontend/src/app/api/configuracoes/credenciais/nibo-*
   para frontend/src/app/api/configuracoes/credenciais/_deprecated_nibo/
   ```

5. VALIDAÇÃO: Busque por imports que referenciam as rotas movidas e corrija-os ou remova-os:
   ```bash
   grep -r "financeiro/nibo" frontend/src/ --include="*.ts" --include="*.tsx" | grep -v "_deprecated"
   ```
   Deve retornar ZERO resultados.

NÃO crie arquivos .md.

COMMIT: "refactor: deprecar rotas NIBO e migrar funcionalidades ativas para Conta Azul"
```

---

## NIBO-3 — Limpar referências NIBO nos componentes e páginas

```
Leia `.cursor/zykor-context.md` para contexto.

PROBLEMA: Existem ~40 referências ao NIBO espalhadas em componentes, páginas, services, hooks e tipos do frontend. Mesmo com as rotas API depreciadas (NIBO-2), o frontend ainda pode tentar chamar essas rotas ou exibir UI relacionada ao NIBO.

LISTA DOS ARQUIVOS COM REFERÊNCIAS NIBO (exclui os já tratados em NIBO-1 e NIBO-2):

COMPONENTES:
1. frontend/src/components/configuracoes/NiboIntegrationCard.tsx — Cartão de integração NIBO
2. frontend/src/components/dre/DreManualModal.tsx — Modal que pode referenciar NIBO
3. frontend/src/components/financeiro/UpdatePixKeyModal.tsx — Pode ter referência NIBO

PÁGINAS:
4. frontend/src/app/ferramentas/agendamento/page.tsx
5. frontend/src/app/ferramentas/agendamento/components/AgendamentoCredenciais.tsx
6. frontend/src/app/ferramentas/agendamento/components/NovoPagamentoForm.tsx
7. frontend/src/app/ferramentas/agendamento/components/ImportarFolhaModal.tsx
8. frontend/src/app/ferramentas/agendamento/services/agendamento-service.ts
9. frontend/src/app/ferramentas/agendamento/types.ts
10. frontend/src/app/ferramentas/cmv-semanal/page.tsx
11. frontend/src/app/ferramentas/cmv-semanal/tabela/page.tsx
12. frontend/src/app/ferramentas/simulacao-cmo/page.tsx
13. frontend/src/app/ferramentas/consultas/page.tsx
14. frontend/src/app/configuracoes/monitoramento/page.tsx
15. frontend/src/app/estrategico/desempenho/components/DesempenhoClient.tsx

SERVICES/LIBS:
16. frontend/src/lib/discord-service.ts
17. frontend/src/lib/api-credentials.ts
18. frontend/src/hooks/usePermissions.ts
19. frontend/src/types/supabase.ts

API ROUTES (não cobertos por NIBO-2):
20. frontend/src/app/api/agendamento/buscar-stakeholder/route.ts
21. frontend/src/app/api/agendamento/agendar-nibo/route.ts
22. frontend/src/app/api/agendamento/criar-supplier/route.ts
23. frontend/src/app/api/agendamento/processar-automatico/route.ts
24. frontend/src/app/api/saude-dados/route.ts
25. frontend/src/app/api/saude-dados/syncs/route.ts
26. frontend/src/app/api/saude-dados/resumo/route.ts
27. frontend/src/app/api/nibo/sync/route.ts
28. frontend/src/app/api/financeiro/verificar-credenciais/route.ts
29. frontend/src/app/api/financeiro/nibo-categorias/route.ts
30. frontend/src/app/api/financeiro/inter/pix/route.ts
31. frontend/src/app/api/configuracoes/integracoes/status/route.ts
32. frontend/src/app/api/configuracoes/administracao/integracoes/route.ts
33. frontend/src/app/api/estrategico/orcamentacao/analise-detalhada/route.ts
34. frontend/src/app/api/estrategico/orcamentacao/todos-meses/route.ts
35. frontend/src/app/api/rh/cmo-comparativo/route.ts
36. frontend/src/app/api/health/route.ts
37. frontend/src/app/estrategico/orcamentacao/services/orcamentacao-service.ts
38. frontend/src/middleware/auth.ts

TAREFA PARA CADA ARQUIVO:
1. Abra o arquivo e busque por "nibo" (case insensitive)
2. Para cada referência, determine o tipo:
   a. **IMPORT de rota NIBO depreciada** → Remova o import e substitua pela rota Conta Azul equivalente
   b. **String/label "NIBO"** na UI → Substitua por "Conta Azul" onde faz sentido, ou remova
   c. **Lógica condicional** (if niboConectado, etc.) → Substitua pela verificação do Conta Azul
   d. **Tipo TypeScript** com campos NIBO → Remova campos NIBO, adicione Conta Azul se necessário
   e. **Rota API que chama NIBO diretamente** → Se ativa, redirecione para dados locais. Se não usada, deprecie.

3. CASOS ESPECÍFICOS:
   - `NiboIntegrationCard.tsx` → Renomear para `ContaAzulIntegrationCard.tsx` ou remover se já existe equivalente
   - `agendar-nibo/route.ts` → Renomear para usar Conta Azul se o agendamento é ativo, ou depreciar
   - `nibo/sync/route.ts` → Depreciar (sync já é via `contaazul-sync`)
   - `nibo-categorias/route.ts` → Depreciar (usar `bar_categorias_custo`)
   - `usePermissions.ts` → Remover verificação de permissão NIBO
   - `supabase.ts` (types) → Remover tipos de tabelas NIBO se existirem
   - `saude-dados` routes → Remover checks de saúde NIBO, manter apenas Conta Azul/ContaHub

4. VALIDAÇÃO FINAL:
   ```bash
   # Deve retornar ZERO resultados (exceto em _deprecated)
   grep -ri "nibo" frontend/src/ --include="*.ts" --include="*.tsx" | grep -v "_deprecated" | grep -v "node_modules"
   ```

NÃO crie arquivos .md.

COMMIT: "refactor: remover todas as referências NIBO do frontend, substituir por Conta Azul"
```

---

## NIBO-4 — Limpar referências NIBO no backend e banco de dados

```
Leia `.cursor/zykor-context.md` para contexto.

PROBLEMA: Existem referências ao NIBO no backend (Edge Functions, SQL functions, migrations) que precisam ser limpas.

ARQUIVOS DO BACKEND COM NIBO:
1. `database/functions/executar_nibo_sync_ambos_bares.sql` — Função SQL morta com placeholder `[SERVICE_ROLE_KEY]`
2. Possíveis Edge Functions com referência NIBO
3. Possíveis variáveis de ambiente NIBO em `env-validator.ts`

TAREFA:
1. Busque por "nibo" em todo o backend:
   ```bash
   grep -ri "nibo" backend/ --include="*.ts" --include="*.sql" --include="*.json"
   grep -ri "nibo" database/ --include="*.sql"
   ```

2. Para `database/functions/executar_nibo_sync_ambos_bares.sql`:
   - Mova para `database/functions/_archived/executar_nibo_sync_ambos_bares.sql`
   - Adicione comentário no topo:
     ```sql
     -- [ARCHIVED 2026-04-04] Função NIBO descontinuada.
     -- Sistema financeiro migrado para Conta Azul.
     -- Mantida apenas para referência histórica.
     ```

3. Para Edge Functions que referenciam NIBO:
   - Se a função INTEIRA é sobre NIBO → Mova para `backend/supabase/functions/_archived/`
   - Se tem apenas referências parciais → Remova as referências, substitua por Conta Azul

4. Para `env-validator.ts`:
   - Se valida variáveis NIBO_API_KEY, NIBO_TOKEN, etc. → Remova essas validações
   - Garanta que as variáveis do Conta Azul estão sendo validadas

5. Verifique se existem cron jobs ATIVOS que ainda chamam funções NIBO:
   ```sql
   SELECT jobname, schedule, command FROM cron.job WHERE command ILIKE '%nibo%';
   ```
   Se encontrar, desative-os:
   ```sql
   SELECT cron.unschedule('nome-do-job-nibo');
   ```

6. Verifique tabelas NIBO no banco:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name ILIKE '%nibo%';
   ```
   NÃO delete as tabelas (podem ter dados históricos úteis), mas adicione um comentário:
   ```sql
   COMMENT ON TABLE nibo_categorias IS '[DEPRECATED 2026-04-04] Tabela legada do NIBO. Usar bar_categorias_custo. Não deletar - dados históricos.';
   ```

7. VALIDAÇÃO:
   ```bash
   # Backend: deve retornar ZERO (exceto _archived)
   grep -ri "nibo" backend/ --include="*.ts" --include="*.sql" | grep -v "_archived" | grep -v "node_modules"

   # Database functions: deve retornar ZERO (exceto _archived)
   grep -ri "nibo" database/ --include="*.sql" | grep -v "_archived"
   ```

NÃO crie arquivos .md.

COMMIT: "refactor: limpar todas as referências NIBO do backend e banco de dados"
```

---

## ORDEM DE EXECUÇÃO

```
BLOCO 1 — DADOS (CRÍTICO):
  DATA-1 → Cancelamentos custototal = 0 (BUG que afeta dashboard)
  DATA-2 → Descontos não rastreados (FEATURE faltante)
  DATA-3 → c_art em eventos_base (melhoria de dados)
  DATA-4 → Validação stockout (robustez)

BLOCO 2 — NIBO (MIGRAÇÃO):
  NIBO-1 → DRE (página mais afetada)
  NIBO-2 → Rotas API NIBO (depreciar/migrar)
  NIBO-3 → Componentes e páginas (limpar referências)
  NIBO-4 → Backend e banco (limpar tudo)

APÓS EXECUTAR TODOS:
  - Rode `recalcular-desempenho-v2` para ambos os bares (bar_id=3 e bar_id=4)
    para repopular desempenho_semanal com os dados corrigidos
  - Verifique as 6 páginas visualmente no navegador
```

---

## NOTAS IMPORTANTES

### Cron Jobs — Todos OK
- ✅ `processar-alertas-discord` já está em intervalos de 2h (corrigido)
- ✅ Nenhum cron com service_role_key hardcoded (todos usam `current_setting`)
- ⚠️ Inconsistência de nome do setting: `app.supabase_service_role_key` vs `app.settings.service_role_key` — padronizar eventualmente

### Página Desempenho Semanal — Após DATA-1 e DATA-2
- Cancelamentos vai passar a mostrar valores reais (~R$16.937 semana 13)
- Descontos vai aparecer como nova métrica
- Atração % pode continuar baixa se dados do Conta Azul estiverem incompletos (não é bug)
- Stockout vai ter alertas automáticos quando anômalo

### DRE — Após NIBO-1
- Vai usar dados do Conta Azul (lancamentos_financeiros)
- Mapeamento de categorias precisa ser validado com o Rodrigo
- Dados históricos NIBO permanecem nas tabelas para referência
