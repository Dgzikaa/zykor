# 📊 Resumo: Como a Tabela `desempenho_semanal` é Construída

## 🔄 **FLUXO AUTOMÁTICO**

### 1. **Cron Jobs (pg_cron)**
Dois crons chamam a função PostgreSQL `executar_recalculo_desempenho_auto()`:
- **desempenho-auto-diario**: Roda às 11h todo dia (`0 11 * * *`)
- **desempenho-auto-segunda**: Roda às 12h toda segunda (`0 12 * * 1`)

### 2. **Função PostgreSQL → Edge Function**
A função `executar_recalculo_desempenho_auto()` chama a Edge Function:
- URL: `https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/recalcular-desempenho-auto`
- Path: `backend/supabase/functions/recalcular-desempenho-auto/index.ts`

### 3. **Edge Function: Recálculo Automático**
Atualiza apenas as **últimas 4 semanas** de cada bar (Ordinário e Deboche).

---

## ✅ **O QUE ESTÁ SENDO CALCULADO** (linhas 205-223)

### Faturamento e Clientes
- ✅ `faturamento_total` - Soma de `eventos_base.real_r` menos conta assinada
- ✅ `clientes_atendidos` - Soma de `eventos_base.cl_real`
- ✅ `ticket_medio` - Faturamento / Clientes

### Metas e Reservas
- ✅ `meta_semanal` - Soma de `eventos_base.m1_r`
- ✅ `mesas_totais` - Soma de `eventos_base.num_mesas_tot`
- ✅ `mesas_presentes` - Soma de `eventos_base.num_mesas_presentes`
- ✅ `reservas_totais` - Soma de `eventos_base.res_tot` (pessoas)
- ✅ `reservas_presentes` - Soma de `eventos_base.res_p` (pessoas)

### Stockout
- ✅ `stockout_drinks_perc` - % de drinks sem venda (contahub_stockout)
- ✅ `stockout_comidas_perc` - % de comidas sem venda (contahub_stockout)

### Mix de Produtos (Média Ponderada pelo Faturamento)
- ✅ `perc_bebidas` - % bebidas (de eventos_base.percent_b)
- ✅ `perc_drinks` - % drinks (de eventos_base.percent_d)
- ✅ `perc_comida` - % comida (de eventos_base.percent_c)
- ✅ `perc_happy_hour` - % happy hour (de eventos_base.percent_happy_hour)

---

## ❌ **O QUE ESTÁ FALTANDO / ERRADO**

### Dados de Tempo (Não calculados)
- ❌ `tempo_saida_bar` - Tempo médio drinks
- ❌ `tempo_saida_cozinha` - Tempo médio comida  
- ❌ `qtde_itens_bar` - Quantidade de itens bar
- ❌ `qtde_itens_cozinha` - Quantidade de itens cozinha

### Atrasos (NÃO CALCULADOS!)
- ❌ `atrasinhos_bar` - Drinks entre 4-8 min
- ❌ `atrasinhos_cozinha` - Comida entre 15-20 min
- ❌ `atraso_bar` - Drinks entre 8-10 min
- ❌ `atraso_cozinha` - Comida entre 20-30 min
- ❌ `atrasos_bar` - Drinks > 20 min (atrasão)
- ❌ `atrasos_cozinha` - Comida > 30 min (atrasão)
- ❌ `atrasos_bar_perc` - % atrasão drinks
- ❌ `atrasos_cozinha_perc` - % atrasão comida

### Outros Campos Importantes
- ❌ `faturamento_entrada` - Faturamento couvert
- ❌ `faturamento_bar` - Faturamento bar
- ❌ `faturamento_cmovivel` - Faturamento CMVível
- ❌ `cmv_rs` - CMV em R$
- ❌ `cmv_limpo` - CMV limpo %
- ❌ `cmv_global_real` - CMV global %
- ❌ `cmv_teorico` - CMV teórico
- ❌ `cmo` - CMO %
- ❌ `custo_atracao_faturamento` - Custo atração %
- ❌ `retencao_1m` - Retenção 1 mês
- ❌ `retencao_2m` - Retenção 2 meses
- ❌ `perc_clientes_novos` - % clientes novos
- ❌ `clientes_ativos` - Clientes ativos (2+ visitas)
- ❌ `quebra_reservas` - % quebra de reservas
- ❌ E muitos outros...

---

## 🔍 **PROBLEMA IDENTIFICADO: ATRASOS**

### Como DEVERIA ser calculado (de contahub_tempo):

**Para BAR (categoria = 'drink', campo t0_t3 em segundos):**
```sql
-- Atrasinho: 4-8 min (240-480 segundos)
COUNT(*) WHERE t0_t3 > 240 AND t0_t3 <= 480

-- Atraso: 8-10 min (480-600 segundos)
COUNT(*) WHERE t0_t3 > 480 AND t0_t3 <= 600

-- Atrasão: > 20 min (>1200 segundos)
COUNT(*) WHERE t0_t3 > 1200
```

**Para COZINHA (categoria = 'comida', campo t1_t2 em segundos):**
```sql
-- Atrasinho: 15-20 min (900-1200 segundos)
COUNT(*) WHERE t1_t2 > 900 AND t1_t2 <= 1200

-- Atraso: 20-30 min (1200-1800 segundos)
COUNT(*) WHERE t1_t2 > 1200 AND t1_t2 <= 1800

-- Atrasão: > 30 min (>1800 segundos)
COUNT(*) WHERE t1_t2 > 1800
```

### Exemplo Real (Semana 9 Ordinário):
**Calculado do banco agora:**
- Bar: 366 atrasinhos, 25 atrasos, 12 atrasões
- Cozinha: 51 atrasinhos, 14 atrasos, 1 atrasão

**O que está salvo (ERRADO!):**
- Bar: 10 atrasinhos, 2 atrasos, 0 atrasões ❌
- Cozinha: 7 atrasinhos, 0 atrasos, 0 atrasões ❌

---

## 🚨 **OUTROS PROBLEMAS**

### 1. **Dados dos Eventos (eventos_base)**
Os percentuais de mix dependem de `eventos_base.percent_b/percent_d/percent_c`:
- Se esses dados estiverem errados nos eventos, o semanal fica errado
- Exemplo: Semana 7 teve 77.44% comida no dia 14/02 (Carnaval) - precisa validar se está correto

### 2. **Tempos Médios**
Não estão sendo calculados, mas deveriam vir de `contahub_tempo`:
```sql
-- Tempo médio bar (converter segundos para minutos)
AVG(t0_t3) / 60.0 WHERE categoria = 'drink'

-- Tempo médio cozinha
AVG(t1_t2) / 60.0 WHERE categoria = 'comida'
```

### 3. **Quantidade de Itens**
Não está sendo calculada, deveria vir de `contahub_analitico`:
```sql
-- Itens bar
SUM(qtd) WHERE grp_desc IN ('Cerveja', 'Bebida', 'Drinks', 'Happy Hour', etc)

-- Itens cozinha
SUM(qtd) WHERE grp_desc IN ('Pratos', 'Sanduíches', 'Sobremesas', 'Combos')
```

---

## 💡 **SOLUÇÃO PROPOSTA**

### Opção 1: Expandir a Edge Function Atual
Adicionar na `recalcular-desempenho-auto/index.ts` (após linha 202):

```typescript
// Calcular tempos e atrasos de contahub_tempo
const { data: tempoData } = await supabase
  .from('contahub_tempo')
  .select('categoria, t0_t3, t1_t2')
  .eq('bar_id', barId)
  .gte('data', startDate)
  .lte('data', endDate)

// Tempos médios (converter para minutos)
const tempoDrinks = tempoData?.filter(t => t.categoria === 'drink')
const tempoComida = tempoData?.filter(t => t.categoria === 'comida')

const tempoMedioBar = tempoDrinks?.length 
  ? tempoDrinks.reduce((sum, t) => sum + parseFloat(t.t0_t3), 0) / tempoDrinks.length / 60.0
  : 0

const tempoMedioCozinha = tempoComida?.length
  ? tempoComida.reduce((sum, t) => sum + parseFloat(t.t1_t2), 0) / tempoComida.length / 60.0
  : 0

// Atrasos BAR (em segundos)
const atrasinhosBar = tempoDrinks?.filter(t => parseFloat(t.t0_t3) > 240 && parseFloat(t.t0_t3) <= 480).length || 0
const atrasoBar = tempoDrinks?.filter(t => parseFloat(t.t0_t3) > 480 && parseFloat(t.t0_t3) <= 600).length || 0
const atrasoesBar = tempoDrinks?.filter(t => parseFloat(t.t0_t3) > 1200).length || 0
const atrasoesBarPerc = tempoDrinks?.length ? (atrasoesBar / tempoDrinks.length) * 100 : 0

// Atrasos COZINHA (em segundos)
const atrasinhosCozinha = tempoComida?.filter(t => parseFloat(t.t1_t2) > 900 && parseFloat(t.t1_t2) <= 1200).length || 0
const atrasoCozinha = tempoComida?.filter(t => parseFloat(t.t1_t2) > 1200 && parseFloat(t.t1_t2) <= 1800).length || 0
const atrasoesCozinha = tempoComida?.filter(t => parseFloat(t.t1_t2) > 1800).length || 0
const atrasoesCozinhaPerc = tempoComida?.length ? (atrasoesCozinha / tempoComida.length) * 100 : 0

// Quantidade de itens
const qtdeItensBar = tempoDrinks?.length || 0
const qtdeItensCozinha = tempoComida?.length || 0

// Adicionar no UPDATE (linha 207):
.update({
  // ... campos existentes ...
  tempo_saida_bar: tempoMedioBar,
  tempo_saida_cozinha: tempoMedioCozinha,
  qtde_itens_bar: qtdeItensBar,
  qtde_itens_cozinha: qtdeItensCozinha,
  atrasinhos_bar: atrasinhosBar,
  atrasinhos_cozinha: atrasinhosCozinha,
  atraso_bar: atrasoBar,
  atraso_cozinha: atrasoCozinha,
  atrasos_bar: atrasoesBar,
  atrasos_cozinha: atrasoesCozinha,
  atrasos_bar_perc: atrasoesBarPerc,
  atrasos_cozinha_perc: atrasoesCozinhaPerc,
})
```

### Opção 2: Criar Script Separado
Criar um script para recalcular TUDO (atrasos, tempos, quantidades) para todas as semanas do ano.

---

## 📋 **PRÓXIMOS PASSOS**

1. ✅ Identificar problema (FEITO)
2. ⏳ Corrigir Edge Function para incluir atrasos e tempos
3. ⏳ Rodar recálculo manual para todas as semanas de 2026
4. ⏳ Validar dados no frontend
5. ⏳ Verificar se eventos_base tem dados corretos

---

## 🚀 **MELHORIAS FUTURAS (TODO)**

### 1. **Modal de Dias da Semana + Controle de Dias Ativos**

#### Funcionalidade:
- Ao clicar na semana (ex: S07/26), abrir um modal exibindo os 7 dias que compõem aquela semana
- Cada dia terá um checkbox "Ativo S/N" para incluir/excluir do cálculo

#### Banco de Dados:
```sql
-- Nova tabela: semana_dias_ativos
CREATE TABLE semana_dias_ativos (
  id SERIAL PRIMARY KEY,
  bar_id INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  numero_semana INTEGER NOT NULL,
  data_evento DATE NOT NULL,
  ativo BOOLEAN DEFAULT true,
  motivo_inativo TEXT, -- Ex: "Carnaval", "Evento especial", etc
  desativado_por INTEGER, -- user_id
  desativado_em TIMESTAMP,
  FOREIGN KEY (bar_id) REFERENCES bares(id),
  UNIQUE(bar_id, data_evento)
);

-- Padrão: Todos os dias ativos, EXCETO segundas para Deboche (bar_id = 4)
```

#### Regras de Cálculo:
Quando um dia está INATIVO:
- ✅ **Considerar**: Faturamento, Clientes, Ticket Médio, Reservas, Mesas
- ❌ **Desconsiderar**: 
  - % Stockout (drinks e comidas)
  - Mix % (bebidas, drinks, comida, happy hour)
  - Tempos (saída bar e cozinha)
  - Atrasos (atrasinhos, atrasos, atrasões)

#### Caso de Uso:
- **Carnaval 2026**: Dias 13, 14, 15, 16, 17 de fevereiro
  - Comportamento atípico de consumo
  - Mix de produtos diferente (mais comida que drinks)
  - Desmarcar esses dias para não poluir as métricas operacionais
  - Manter faturamento e clientes para análise de receita

#### Implementação:
1. **Frontend**: Modal com lista de dias + checkboxes
2. **Backend**: API para salvar/atualizar dias ativos
3. **Edge Function**: Modificar lógica de agregação para filtrar `WHERE ativo = true`

---

### 2. **Modal de Detalhes do Indicador + Edição de Metas**

#### Funcionalidade:
- Ao clicar em qualquer indicador (ex: "Visitas", "Faturamento", "Ticket Médio")
- Abrir modal com informações detalhadas:
  - Nome completo do indicador
  - Descrição/definição
  - Última atualização (timestamp)
  - Meta semanal atual
  - Meta mensal atual
  - Fonte dos dados
  - Fórmula de cálculo
  - Histórico de alterações de meta

#### Banco de Dados Atual:
```sql
-- Onde as metas estão hoje:
desempenho_semanal.meta_semanal -- Meta de faturamento semanal (soma de eventos_base.m1_r)

-- Problema: Não há histórico de alterações!
```

#### Nova Estrutura Proposta:
```sql
-- Tabela de configuração de metas
CREATE TABLE metas_indicadores (
  id SERIAL PRIMARY KEY,
  bar_id INTEGER NOT NULL,
  indicador VARCHAR(100) NOT NULL, -- 'faturamento', 'visitas', 'ticket_medio', etc
  tipo_periodo VARCHAR(20) NOT NULL, -- 'semanal', 'mensal', 'trimestral'
  valor_meta NUMERIC(15,2) NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE, -- NULL = meta atual/ativa
  criado_por INTEGER, -- user_id
  criado_em TIMESTAMP DEFAULT NOW(),
  motivo_alteracao TEXT,
  FOREIGN KEY (bar_id) REFERENCES bares(id)
);

-- Índice para buscar meta ativa
CREATE INDEX idx_metas_ativas ON metas_indicadores(bar_id, indicador, data_fim) 
WHERE data_fim IS NULL;

-- Exemplo de uso:
-- Meta de visitas semanais mudou em 01/06/2025 de 1.250 para 1.500
INSERT INTO metas_indicadores (bar_id, indicador, tipo_periodo, valor_meta, data_inicio, motivo_alteracao)
VALUES 
  (3, 'visitas', 'semanal', 1250, '2025-01-01', 'Meta inicial 2025'),
  (3, 'visitas', 'semanal', 1500, '2025-06-01', 'Aumento de capacidade');

-- Fechar meta anterior ao criar nova
UPDATE metas_indicadores 
SET data_fim = '2025-05-31' 
WHERE bar_id = 3 AND indicador = 'visitas' AND tipo_periodo = 'semanal' AND data_fim IS NULL;
```

#### Histórico de Alterações:
```sql
-- Tabela de auditoria
CREATE TABLE metas_historico (
  id SERIAL PRIMARY KEY,
  meta_indicador_id INTEGER NOT NULL,
  acao VARCHAR(20) NOT NULL, -- 'criado', 'alterado', 'deletado'
  valor_anterior NUMERIC(15,2),
  valor_novo NUMERIC(15,2),
  alterado_por INTEGER, -- user_id
  alterado_em TIMESTAMP DEFAULT NOW(),
  motivo TEXT,
  FOREIGN KEY (meta_indicador_id) REFERENCES metas_indicadores(id)
);
```

#### Funcionalidades do Modal:
1. **Visualização**:
   - Nome: "Visitas Semanais"
   - Descrição: "Número total de clientes atendidos na semana"
   - Última atualização: "03/03/2026 às 11:00"
   - Meta atual: "1.500 pessoas/semana"
   - Fonte: "eventos_base.cl_real"
   - Fórmula: "SUM(cl_real) WHERE data_evento BETWEEN data_inicio AND data_fim"

2. **Edição de Meta**:
   - Botão "Editar Meta"
   - Input com valor da meta
   - Campo "Motivo da alteração"
   - Salvar → cria novo registro e fecha anterior

3. **Histórico**:
   - Timeline de alterações:
     - "01/01/2025 - 31/05/2025: 1.250 pessoas/semana (por João Silva)"
     - "01/06/2025 - atual: 1.500 pessoas/semana (por Maria Santos)"
     - Motivo: "Aumento de capacidade após reforma"

#### Indicadores com Metas:
- Faturamento Semanal
- Visitas/Clientes Atendidos
- Ticket Médio
- Reservas Presentes
- CMV % (meta máxima)
- Stockout % (meta máxima)
- NPS (meta mínima)
- Tempo Saída Bar (meta máxima)
- Tempo Saída Cozinha (meta máxima)

#### Implementação:
1. **Frontend**: 
   - Modal com tabs: "Info", "Meta Atual", "Histórico"
   - Formulário de edição de meta
2. **Backend**: 
   - API `GET /api/indicadores/:id/info`
   - API `GET /api/indicadores/:id/historico`
   - API `POST /api/indicadores/:id/meta` (criar nova meta)
3. **Banco**: 
   - Migração para criar tabelas
   - Seed com metas atuais

---

## 🎯 **PRIORIZAÇÃO**

### Curto Prazo (Urgente):
1. ✅ Corrigir cálculo de atrasos na Edge Function
2. ✅ Recalcular todas as semanas de 2026
3. ✅ Adicionar tempos e quantidades de itens

### Médio Prazo:
1. Modal de dias da semana + controle de dias ativos
2. Validar eventos_base (% mix diários)

### Longo Prazo:
1. Sistema de metas com histórico
2. Modal de detalhes dos indicadores
3. Cálculo automático dos demais 30+ campos faltantes
