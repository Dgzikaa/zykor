# HOTFIX COMPLETO — DESEMPENHO S14
## 8 Prompts Prioritários para Cursor IDE
**Data:** 06 de Abril 2026 | **Status:** Crítico

---

## ÍNDICE
- [PROMPT 1](#prompt-1--corrigir-recalcular-desempenho-v2-edge-function-503) — Corrigir `recalcular-desempenho-v2` (503)
- [PROMPT 2](#prompt-2--corrigir-calculate_evento_metrics-nibo_agendamentos) — Corrigir `calculate_evento_metrics` (nibo_agendamentos)
- [PROMPT 3](#prompt-3--corrigir-get_count_base_ativa-clientes-ativos-inflados) — Corrigir `get_count_base_ativa` (inflado 33K → 5K)
- [PROMPT 4](#prompt-4--corrigir-processar_raw_data_pendente-campos-prefix) — Corrigir `processar_raw_data_pendente` ($-fields)
- [PROMPT 5](#prompt-5--corrigir-lista-quente-0-clientes-retornados) — Corrigir Lista Quente (0 clientes)
- [PROMPT 6](#prompt-6--zerar-cmo-campos-manuais-s14) — Zerar CMO manual S14
- [PROMPT 7](#prompt-7--recalcular-desempenho-s14-após-prompts-1-3) — Recalcular S14 completo
- [PROMPT 8](#prompt-8--stockout-revisar-catálogo-de-produtos) — Revisar catálogo stockout

---

## CONTEXTO GERAL

### Situação Atual
- **Desempenho S14** (30/03 a 05/04) parado em R$87.456 (deveria ser ~R$367.977)
- **Edge function `recalcular-desempenho-v2`** retornando 503 desde ~03/04
- **Eventos S14** com `mix` zerado (percent_b/c/d = 0) devido erro em `calculate_evento_metrics`
- **Clientes Ativos** mostrando 32.960 ao invés de 5.000-6.000
- **Lista Quente** retornando 0 clientes quando deveria retornar 2.935

### O Que Já Foi Corrigido (06/04 até agora)
- ✅ Lock functions (`acquire_job_lock`, `release_job_lock`) criadas
- ✅ ContaHub 05/04 sincronizado (bar 3: 362 registros, bar 4: 61 registros)
- ✅ Evento 1005 (Sab) financeiros corrigidos
- ✅ Eventos S14 marcados com `precisa_recalculo = true`

### Supabase Project
- **Project ID:** `uqtgsvujwcbymjmvkjhy`
- **URL:** `https://uqtgsvujwcbymjmvkjhy.supabase.co`

---

## PROMPT 1 — Corrigir `recalcular-desempenho-v2` (Edge Function 503)

### Contexto Crítico
A edge function `recalcular-desempenho-v2` está retornando **HTTP 503 (Service Unavailable)** desde aproximadamente 03/04.

**Evidência temporal:**
- v14 funcionava até 02/04 12:26 (heartbeat confirmado com "calculators_success: 6")
- Atualmente está na v16, ambas versões retornam 503
- Tempo de execução: 86-247ms → sugere **crash no boot/import**, NÃO timeout
- Código da função em si está correto (analisado todos os 12 arquivos)

**Possíveis causas:**
1. Import quebrado no bundle (versão incompatível de dependência)
2. Runtime issue no Deno (módulo _shared incompatível)
3. Variável de ambiente faltando (`ENABLE_V2_WRITE`)

### Estrutura de Arquivos (12 arquivos no bundle)

```
functions/
├── recalcular-desempenho-v2/
│   └── index.ts (21.107 chars)
└── _shared/
    ├── heartbeat.ts (12.240 chars)
    ├── date-helpers.ts (4.252 chars)
    ├── week-manager.ts (6.035 chars)
    └── calculators/
        ├── index.ts (507 chars)
        ├── types.ts (2.442 chars)
        ├── calc-faturamento.ts (3.981 chars)
        ├── calc-custos.ts (5.610 chars)
        ├── calc-operacional.ts (10.907 chars)
        ├── calc-satisfacao.ts (3.839 chars)
        ├── calc-distribuicao.ts (3.417 chars)
        └── calc-clientes.ts (3.268 chars)
```

### Imports Críticos (index.ts)

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { heartbeatStart, heartbeatEnd, heartbeatError } from "../_shared/heartbeat.ts";
import { getWeekDateRange, getISOWeek, getISOYear } from "../_shared/date-helpers.ts";
import { ACTIVE_BAR_IDS } from "../_shared/week-manager.ts";
import {
  calcFaturamento, calcCustos, calcOperacional, calcSatisfacao,
  calcDistribuicao, calcClientes,
  CalculatorInput, CalculatorResult, FaturamentoResult, CustosResult,
  OperacionalResult, SatisfacaoResult, DistribuicaoResult, ClientesResult
} from "../_shared/calculators/index.ts";
```

### Passos de Correção

#### 1. Verificar Imports e Versões

```bash
# No repositório backend
cd supabase/functions

# Verificar se há deno.json com pinned versions
cat deno.json

# Verificar imports específicos
grep -r "deno.land\|esm.sh" recalcular-desempenho-v2/
grep -r "deno.land\|esm.sh" _shared/
```

#### 2. Verificar Sintaxe TypeScript

```bash
# Executar type check (se disponível)
deno check supabase/functions/recalcular-desempenho-v2/index.ts
```

#### 3. Adicionar Tratamento de Erros no Boot

O serve() pode estar crashando silenciosamente. Adicionar try/catch wrapper:

```typescript
// Adicionar logo no início de index.ts, dentro de serve()
serve(async (req: Request) => {
  try {
    // ... resto do código
  } catch (bootError) {
    const errorMsg = bootError instanceof Error
      ? bootError.message
      : String(bootError);

    console.error("BOOT ERROR:", errorMsg);
    await heartbeatError("recalcular-desempenho-v2", errorMsg);

    return new Response(
      JSON.stringify({ error: "Boot error", details: errorMsg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
```

#### 4. Verificar Variável de Ambiente

```bash
# No Supabase Dashboard: Settings → Edge Functions → Environment Variables
# Verificar se ENABLE_V2_WRITE está setada
# Esperado: "true" ou não estar setada (usa default)
```

#### 5. Fazer Deploy

```bash
# Via Supabase CLI (recomendado)
npx supabase functions deploy recalcular-desempenho-v2 --project-ref uqtgsvujwcbymjmvkjhy

# OU via Cursor: executar na UI do Supabase Dashboard
# - Ir em: Edge Functions → recalcular-desempenho-v2
# - Copiar arquivo index.ts
# - Salvar em backend/supabase/functions/recalcular-desempenho-v2/index.ts
# - Fazer deploy via CLI
```

### Validação

**Teste 1: Chamada via curl**

```bash
curl -X POST https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/recalcular-desempenho-v2 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "bar_id": 3,
    "ano": 2026,
    "numero_semana": 14,
    "mode": "shadow"
  }'
```

**Resposta esperada (200 OK):**
```json
{
  "success": true,
  "calculators_success": 6,
  "bar_id": 3,
  "ano": 2026,
  "numero_semana": 14
}
```

**Teste 2: Verificar logs**

```bash
# No Supabase Dashboard: Functions → recalcular-desempenho-v2 → Logs
# Procurar por erros de import ou mensagens de boot error
```

**Teste 3: Verificar SE (Service Key)**

```bash
# Verificar se get_service_role_key() retorna uma chave válida
SELECT get_service_role_key();
```

---

## PROMPT 2 — Corrigir `calculate_evento_metrics` (nibo_agendamentos)

### Contexto Crítico
A stored procedure `calculate_evento_metrics` referencia a tabela **`nibo_agendamentos`** que **NÃO existe** no banco de dados.

**Impacto:**
- `auto_recalculo_eventos_pendentes()` falha em 100% dos eventos
- Erro: `"relation "nibo_agendamentos" does not exist"`
- Eventos 1005, 1006, 1097 permanecem com `percent_b/d/c = 0`
- Desempenho semanal não pode ser recalculado com dados corretos

**Evidência:**
```sql
SELECT id, data_evento, percent_b, percent_d, percent_c
FROM eventos_base
WHERE id IN (1005, 1006, 1097);
```

Resultado esperado AGORA: `percent_b/d/c = 0` (bug)
Resultado esperado APÓS correção: `percent_b/d/c > 0` (calculado corretamente)

### Passos de Correção

#### 1. Examinar Código Atual

```sql
-- Ler a definição completa da função
SELECT prosrc FROM pg_proc WHERE proname = 'calculate_evento_metrics';
```

Procurar por:
- Quais colunas são lidas de `nibo_agendamentos`
- Como a tabela é joinada com `eventos_base`
- Se há agregações baseadas nessa tabela

#### 2. Alternativa A: Remover Dependência (RECOMENDADO)

Se `nibo_agendamentos` é para dados de **custo artístico** (c_art), usar `lancamentos_financeiros` ou remover se não aplicável:

```sql
CREATE OR REPLACE FUNCTION public.calculate_evento_metrics(p_evento_id INTEGER)
RETURNS TABLE (
  id INT,
  percent_b NUMERIC,
  percent_d NUMERIC,
  percent_c NUMERIC,
  -- outras colunas
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Remover referência a nibo_agendamentos
  -- Se precisa de custo artístico, usar:
  -- SELECT COALESCE(SUM(...), 0) FROM lancamentos_financeiros
  --   WHERE evento_id = p_evento_id AND tipo_lancamento = 'artistico'

  -- Exemplo de query corrigida:
  SELECT
    e.id,
    COALESCE(ROUND((
      SELECT COALESCE(SUM(ca.valor), 0)
      FROM contahub_analitico ca
      WHERE ca.evento_id = p_evento_id AND ca.tipo = 'bebida'
    ) / NULLIF(total_cat_sum, 0) * 100, 2), 0) as percent_b,
    -- ... continuar para D e C
  FROM eventos_base e
  WHERE e.id = p_evento_id;
END;
$$;
```

#### 3. Alternativa B: Criar Tabela (se Nibo é necessário)

Se há plano de integração com Nibo, criar tabela placeholder:

```sql
CREATE TABLE IF NOT EXISTS public.nibo_agendamentos (
  id BIGSERIAL PRIMARY KEY,
  evento_id INTEGER NOT NULL REFERENCES public.eventos_base(id) ON DELETE CASCADE,
  c_art NUMERIC(10,2) DEFAULT 0,
  artista_nome TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_nibo_agendamentos_evento ON nibo_agendamentos(evento_id);
```

#### 4. Fazer Deploy da Correção

**Se usando SQL puro (via migration):**

```bash
# Criar arquivo de migration
cat > supabase/migrations/fix_calculate_evento_metrics.sql <<'EOF'
CREATE OR REPLACE FUNCTION public.calculate_evento_metrics(p_evento_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_total_fat NUMERIC;
  v_fat_bebida NUMERIC;
  v_fat_drinks NUMERIC;
  v_fat_comida NUMERIC;
  v_percent_b NUMERIC;
  v_percent_d NUMERIC;
  v_percent_c NUMERIC;
BEGIN
  -- Calcular total e categorias do contahub_analitico
  SELECT
    COALESCE(SUM(CASE WHEN tipo IN ('bebida','agua','suco','refrigerante','cerveja','vinho','chopp','destilado','espumante','coquetel') THEN valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo = 'bebida' THEN valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo IN ('drink','coquetel') THEN valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo IN ('comida','entrada','prato','sobremesa','cafe') THEN valor ELSE 0 END), 0),
    COALESCE(SUM(valor), 0)
  INTO v_fat_bebida, v_fat_bebida, v_fat_drinks, v_fat_comida, v_total_fat
  FROM contahub_analitico
  WHERE evento_id = p_evento_id;

  -- Calcular percentuais
  v_percent_b := CASE WHEN v_total_fat > 0 THEN ROUND((v_fat_bebida / v_total_fat) * 100, 2) ELSE 0 END;
  v_percent_d := CASE WHEN v_total_fat > 0 THEN ROUND((v_fat_drinks / v_total_fat) * 100, 2) ELSE 0 END;
  v_percent_c := CASE WHEN v_total_fat > 0 THEN ROUND((v_fat_comida / v_total_fat) * 100, 2) ELSE 0 END;

  -- Atualizar eventos_base
  UPDATE eventos_base
  SET
    percent_b = v_percent_b,
    percent_d = v_percent_d,
    percent_c = v_percent_c,
    updated_at = now()
  WHERE id = p_evento_id;
END;
$$;
EOF

# Executar via supabase CLI
npx supabase migration up --project-ref uqtgsvujwcbymjmvkjhy
```

### Validação

**Teste 1: Função sem erro**

```sql
SELECT calculate_evento_metrics(1005);
-- Esperado: sem erro
```

**Teste 2: Eventos com mix correto**

```sql
-- Recalcular eventos problemáticos
UPDATE eventos_base SET precisa_recalculo = true WHERE id IN (1005, 1006, 1097);
SELECT * FROM auto_recalculo_eventos_pendentes('hotfix-nibo-fix');

-- Verificar resultado
SELECT id, data_evento, percent_b, percent_d, percent_c
FROM eventos_base
WHERE id IN (1005, 1006, 1097);
```

Esperado: `percent_b + percent_d + percent_c ≈ 100` (ou próximo, dependendo de outras categorias)

**Teste 3: Auto-recálculo sem erro**

```sql
-- Deve executar sem erro
SELECT COUNT(*) FROM auto_recalculo_eventos_pendentes('teste-nibo-fix');
```

---

## PROMPT 3 — Corrigir `get_count_base_ativa` (Clientes Ativos Inflados)

### Contexto Crítico
A RPC `get_count_base_ativa()` está **inflando massivamente** a contagem de clientes ativos.

**Evidência:**
- Chamada: `SELECT get_count_base_ativa(3, '2026-01-06', '2026-04-05');`
- Resultado ATUAL: **32.960 clientes**
- Esperado (baseado em S13): **5.000-6.000 clientes**
- S13 tinha 5.260 clientes ativos

**Análise da tabela `visitas`:**
- Total de registros: 233.250
- Telefones únicos (90 dias): 34.514
- Problema: cada comanda do ContaHub gera uma "visita" (não um dia único)

### O Problema

Código atual da RPC:

```sql
SELECT COUNT(DISTINCT cliente_fone) INTO v_count
FROM (
  SELECT cliente_fone, COUNT(*) as visitas
  FROM public.visitas
  WHERE bar_id = p_bar_id
    AND data_visita >= p_data_inicio AND data_visita <= p_data_fim
    AND cliente_fone IS NOT NULL AND LENGTH(cliente_fone) >= 8
  GROUP BY cliente_fone
  HAVING COUNT(*) >= 2
) AS clientes_ativos;
```

**O erro:** A função conta `COUNT(*) >= 2`, que significa **2+ comandas**, não 2+ dias distintos.

Com 233K comandas em 90 dias, praticamente todo telefone aparece 2+ vezes → 33K clientes "ativos".

**A definição correta:** "Cliente ativo" = telefone que aparece em **2+ DIAS DISTINTOS** nos últimos 90 dias.

### Correção

Modificar HAVING para contar dias distintos ao invés de comandas:

```sql
CREATE OR REPLACE FUNCTION public.get_count_base_ativa(
  p_bar_id int,
  p_data_inicio date,
  p_data_fim date
)
RETURNS bigint
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT COUNT(DISTINCT cliente_fone) INTO v_count
  FROM (
    SELECT
      cliente_fone,
      COUNT(DISTINCT DATE(data_visita)) as dias_ativos
    FROM public.visitas
    WHERE bar_id = p_bar_id
      AND data_visita >= p_data_inicio AND data_visita <= p_data_fim
      AND cliente_fone IS NOT NULL AND LENGTH(cliente_fone) >= 8
    GROUP BY cliente_fone
    HAVING COUNT(DISTINCT DATE(data_visita)) >= 2
  ) AS clientes_ativos;

  RETURN COALESCE(v_count, 0);
END;
$$;
```

**Alterações:**
1. `COUNT(*) as visitas` → `COUNT(DISTINCT DATE(data_visita)) as dias_ativos`
2. `HAVING COUNT(*) >= 2` → `HAVING COUNT(DISTINCT DATE(data_visita)) >= 2`

### Validação

**Teste 1: Contagem corrigida**

```sql
SELECT get_count_base_ativa(3, '2026-01-06', '2026-04-05');
```

Esperado: valor entre **3.000 e 8.000**, não 33K.

**Teste 2: Comparar com S13**

```sql
-- Se houver registro de S13 com data de S13
SELECT clientes_ativos FROM desempenho_semanal
WHERE numero_semana = 13 AND ano = 2026 AND bar_id = 3;

-- Chamar com datas de S13 (23/03 a 29/03)
SELECT get_count_base_ativa(3, '2026-03-23', '2026-03-29');
```

Deveriam ser próximos ou iguais (5.000-5.500 range).

**Teste 3: Verificar distribuição**

```sql
-- Ver quantos dias cada telefone aparece
SELECT
  COUNT(DISTINCT cliente_fone) as clientes_unicos,
  COUNT(*) as total_visitas,
  ROUND(COUNT(*) / NULLIF(COUNT(DISTINCT cliente_fone), 0), 1) as media_comandas_por_cliente,
  COUNT(DISTINCT DATE(data_visita)) as dias_operacao
FROM public.visitas
WHERE bar_id = 3
  AND data_visita >= '2026-01-06' AND data_visita <= '2026-04-05'
  AND cliente_fone IS NOT NULL AND LENGTH(cliente_fone) >= 8;
```

Esperado:
- `clientes_unicos` ≈ 34.000
- `total_visitas` ≈ 233.000
- `media_comandas_por_cliente` ≈ 6.8 (233K / 34K)
- `dias_operacao` ≈ 90

---

## PROMPT 4 — Corrigir `processar_raw_data_pendente` (Campos $-prefix)

### Contexto Crítico
A stored procedure `processar_raw_data_pendente()` não mapeia corretamente campos com prefixo `$` do JSON bruto do ContaHub.

**Impacto:**
- Registros processados ficam com `vr_pagamentos = 0.00`
- Outros campos financeiros também zerados
- Dados de 05/04 foram corrigidos via SQL direto, mas a função precisa correção permanente

**JSON raw do ContaHub tem:**
```json
{
  "$vr_pagamentos": "34258.55",
  "$vr_produtos": "28045.60",
  "$vr_couvert": "2850.00",
  "$vr_desconto": "500.00",
  "$vr_repique": "150.00"
}
```

**Erro atual:** função busca `vr_pagamentos` (sem `$`), encontra null, usa fallback 0.

### Erros Conhecidos no Schema

Além do mapeamento de `$`, há 2 bugs de schema que precisam correção:

1. **`contahub_pagamentos`: coluna `bandeira` não existe**
   - Erro ao tentar INSERT/UPDATE
   - Solução: criar coluna

2. **`contahub_tempo`: coluna `dia` tipo incompatível**
   - Campo `dia` é `date`, mas função passa `text`
   - Erro: "column dia is of type date but expression is of type text"
   - Solução: fazer cast correto

### Passos de Correção

#### 1. Examinar Função Atual

```sql
SELECT prosrc FROM pg_proc WHERE proname = 'processar_raw_data_pendente';
```

Procurar por:
- Todas as referências a `->>'vr_pagamentos'`, `->>'vr_produtos'`, etc.
- Seção de INSERT em `contahub_pagamentos` (procurar por coluna `bandeira`)
- Seção de INSERT em `contahub_tempo` (procurar por cast de `dia`)

#### 2. Corrigir Mapeamento de Campos

Substituir cada mapeamento:

```sql
-- DE:
(item->>'vr_pagamentos')::numeric

-- PARA:
COALESCE(
  (item->>'$vr_pagamentos')::numeric,
  (item->>'vr_pagamentos')::numeric,
  0
)::numeric

-- Repetir para: vr_produtos, vr_couvert, vr_desconto, vr_repique
```

#### 3. Adicionar Coluna `bandeira` em `contahub_pagamentos`

```sql
ALTER TABLE public.contahub_pagamentos
ADD COLUMN IF NOT EXISTS bandeira TEXT;
```

#### 4. Corrigir Cast de `dia` em `contahub_tempo`

```sql
-- Onde está (procurar na função):
INSERT INTO contahub_tempo (..., dia, ...)
VALUES (..., (item->>'dia')::date, ...);

-- Se der erro tipo text->date, tentar:
(item->>'dia')::timestamp with time zone AT TIME ZONE 'America/Sao_Paulo'
-- OU simplesmente:
LEFT(item->>'dia', 10)::date  -- pega "YYYY-MM-DD" da string
```

#### 5. Deploy da Correção

```bash
# Via migration SQL
cat > supabase/migrations/fix_processar_raw_data_pendente.sql <<'EOF'
-- 1. Adicionar coluna bandeira
ALTER TABLE public.contahub_pagamentos
ADD COLUMN IF NOT EXISTS bandeira TEXT;

-- 2. Recriar função com mapeamento de $-prefix
CREATE OR REPLACE FUNCTION public.processar_raw_data_pendente()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_raw_data JSONB;
  v_item JSONB;
  v_bar_id INT;
BEGIN
  FOR v_raw_data IN
    SELECT raw_data
    FROM contahub_raw_data
    WHERE processed = false
    LIMIT 100
  LOOP
    FOR v_item IN SELECT jsonb_array_elements(v_raw_data->'items')
    LOOP
      -- Inserir em contahub_periodo com $-prefix mapping
      INSERT INTO contahub_periodo (
        bar_id, vr_pagamentos, vr_produtos, vr_couvert, vr_desconto, vr_repique, ...
      ) VALUES (
        (v_raw_data->>'bar_id')::int,
        COALESCE((v_item->>'$vr_pagamentos')::numeric, (v_item->>'vr_pagamentos')::numeric, 0),
        COALESCE((v_item->>'$vr_produtos')::numeric, (v_item->>'vr_produtos')::numeric, 0),
        COALESCE((v_item->>'$vr_couvert')::numeric, (v_item->>'vr_couvert')::numeric, 0),
        COALESCE((v_item->>'$vr_desconto')::numeric, (v_item->>'vr_desconto')::numeric, 0),
        COALESCE((v_item->>'$vr_repique')::numeric, (v_item->>'vr_repique')::numeric, 0),
        ...
      );
    END LOOP;
  END LOOP;

  -- Marcar como processado
  UPDATE contahub_raw_data SET processed = true WHERE processed = false;
END;
$$;
EOF

npx supabase migration up --project-ref uqtgsvujwcbymjmvkjhy
```

### Validação

**Teste 1: Schema sem erro**

```sql
-- Coluna existe
SELECT column_name FROM information_schema.columns
WHERE table_name = 'contahub_pagamentos' AND column_name = 'bandeira';

-- Esperado: 1 linha com "bandeira"
```

**Teste 2: Reprocessar dados de 05/04**

```sql
-- Marcar como não processados
UPDATE contahub_raw_data
SET processed = false
WHERE data_date = '2026-04-05';

-- Rodar função
SELECT processar_raw_data_pendente();

-- Verificar financeiros
SELECT
  bar_id,
  SUM(vr_pagamentos) as total_vr_pagamentos,
  SUM(vr_produtos) as total_vr_produtos,
  SUM(vr_couvert) as total_vr_couvert
FROM contahub_periodo
WHERE DATE(dt_gerencial) = '2026-04-05'
GROUP BY bar_id;
```

Esperado (bar 3): `vr_pagamentos > 0` (era ~R$34.258 em 05/04)

**Teste 3: Inserção em `contahub_tempo` sem erro**

```sql
-- Se houver função que insere em contahub_tempo, testar
SELECT COUNT(*) FROM contahub_tempo WHERE data_dia = '2026-04-05';
```

Esperado: sem erro de type mismatch.

---

## PROMPT 5 — Corrigir Lista Quente (0 Clientes Retornados)

### Contexto Crítico
A página **Clientes → Lista Quente** retorna **0 clientes** quando filtrada por "últimas visitas 1-7 dias".

**Evidência:**
- Query direta no banco: `SELECT ... FROM cliente_estatisticas WHERE ... HAVING COUNT(*) >= 2` = **2.935 clientes**
- Frontend retorna: **0 clientes**
- Então o problema está no código do route handler

**Filtro aplicado:**
- Última visita entre 1-7 dias atrás
- 1+ visitas nos últimos 90 dias
- Está em `cliente_estatisticas` ou similar

### Localização do Bug

**Arquivo:** `frontend/src/app/api/crm/lista-quente/route.ts` (linhas 439-457)

**Código problemático:**
```typescript
if (criterios.ultimaVisitaMinDias !== undefined) {
  const hojeBrasiliaCorte = getHojeBrasilia();
  hojeBrasiliaCorte.setHours(0, 0, 0, 0);
  const dataCorte = new Date(hojeBrasiliaCorte);
  dataCorte.setDate(dataCorte.getDate() - criterios.ultimaVisitaMinDias);
  clientesFiltrados = clientesFiltrados.filter(c => c.ultimaVisita && c.ultimaVisita < dataCorte);
}
```

**O problema:**
- `c.ultimaVisita` provavelmente é **string ISO** (do banco de dados)
- Comparação `string < Date` não funciona (type incompatibility)
- Resultado: nenhum cliente passa no filtro → 0 retornado

### Passos de Correção

#### 1. Identificar Tipo de `ultimaVisita`

```typescript
// Adicionar log temporário para debug
const firstClient = clientesFiltrados[0];
console.log("ultimaVisita type:", typeof firstClient?.ultimaVisita);
console.log("ultimaVisita value:", firstClient?.ultimaVisita);
console.log("ultimaVisita instanceof Date:", firstClient?.ultimaVisita instanceof Date);
```

**Esperado:** `type: "string"`, `value: "2026-04-05T14:23:00Z"` ou similar

#### 2. Corrigir Comparação de Datas

Substituir a seção de filtro (linhas 439-457):

```typescript
if (criterios.ultimaVisitaMinDias !== undefined) {
  const hojeBrasiliaCorte = getHojeBrasilia();
  hojeBrasiliaCorte.setHours(0, 0, 0, 0);
  const dataCorte = new Date(hojeBrasiliaCorte);
  dataCorte.setDate(dataCorte.getDate() - criterios.ultimaVisitaMinDias);

  clientesFiltrados = clientesFiltrados.filter(c => {
    if (!c.ultimaVisita) return false;

    // Converter string para Date se necessário
    const ultimaVisitaDate = typeof c.ultimaVisita === 'string'
      ? new Date(c.ultimaVisita)
      : c.ultimaVisita;

    return ultimaVisitaDate < dataCorte;
  });
}

if (criterios.ultimaVisitaMaxDias !== undefined) {
  const hojeBrasiliaCorte = getHojeBrasilia();
  hojeBrasiliaCorte.setHours(0, 0, 0, 0);
  const dataCorte = new Date(hojeBrasiliaCorte);
  dataCorte.setDate(dataCorte.getDate() - criterios.ultimaVisitaMaxDias);

  clientesFiltrados = clientesFiltrados.filter(c => {
    if (!c.ultimaVisita) return false;

    // Converter string para Date se necessário
    const ultimaVisitaDate = typeof c.ultimaVisita === 'string'
      ? new Date(c.ultimaVisita)
      : c.ultimaVisita;

    return ultimaVisitaDate >= dataCorte;
  });
}
```

#### 3. Considerar Timezone (Brasília UTC-3)

Se houver problemas de timezone:

```typescript
// Função helper para comparar datas ignorando timezone
function parseToLocalDate(dateString: string | Date): Date {
  const date = new Date(dateString);
  // Se veio como string ISO, já está em UTC; não ajustar
  // Se precisa converter para Brasília, subtrair 3 horas
  // Normalmente Supabase já retorna em UTC, então not needed
  return date;
}

// Usar:
const ultimaVisitaDate = parseToLocalDate(c.ultimaVisita);
```

#### 4. Deploy

```bash
# Via git push (se em repo com CI/CD)
git add frontend/src/app/api/crm/lista-quente/route.ts
git commit -m "fix: corrigir comparação de datas em lista-quente"
git push

# OU fazer deploy no Vercel diretamente se tiver acesso
```

### Validação

**Teste 1: Verificar log**

Abrir DevTools do navegador (F12) → Console → filtrar por "ultimaVisita type" → confirmar que é "string".

**Teste 2: Teste manual**

1. Navegar para Clientes → Lista Quente
2. Aplicar filtro "Últimas visitas: 1-7 dias"
3. Resultado esperado: 100-500 clientes (não 0)

**Teste 3: Comparar com query direta**

```sql
SELECT
  COUNT(DISTINCT cliente_fone) as total,
  COUNT(DISTINCT CASE WHEN ultima_visita >= NOW() - INTERVAL '7 days' AND ultima_visita < NOW() THEN cliente_fone END) as ultimas_7_dias
FROM cliente_estatisticas
WHERE bar_id = 3;
```

Esperado para "ultimas_7_dias": 100-1000 (aproximadamente)

---

## PROMPT 6 — Zerar CMO (Campos Manuais S14)

### Contexto Crítico
O campo **CMO% na S14** (bar 3) está em **-85.74**, mas deveria estar em **0** (é campo manual, não calculado).

**Evidência:**
- `desempenho_semanal.id = 671` (S14, bar 3)
- `cmo = -85.74` (ERRADO)
- `cmo_custo = não calculado`

**O problema:**
- Campo `cmo` **NÃO é calculado** pela edge function `recalcular-desempenho-v2`
- Não está no `FIELD_MAPPING` da função
- O valor foi pré-populado quando o registro foi criado (possivelmente um default errado)
- A edge function nunca toca nesse campo, então permanece -85.74

**Solução:** Simplesmente zerar manualmente.

### Correção (SQL Direto)

```sql
UPDATE desempenho_semanal
SET cmo = 0, cmo_custo = 0
WHERE id = 671;

-- Verificar resultado
SELECT id, numero_semana, ano, bar_id, cmo, cmo_custo
FROM desempenho_semanal
WHERE id = 671;
```

**Esperado:** `cmo = 0`, `cmo_custo = 0`

### Observação

Se esse padrão repetir em outras semanas/bares, executar:

```sql
-- Zerar todos os CMO com valores negativos ou zeros (que não são calculados)
UPDATE desempenho_semanal
SET cmo = 0, cmo_custo = 0
WHERE cmo < 0;

-- Verificar quantos foram afetados
SELECT COUNT(*) FROM desempenho_semanal WHERE cmo = 0;
```

---

## PROMPT 7 — Recalcular Desempenho S14 (Após Prompts 1-3)

### Pré-requisitos
Certifique-se que os seguintes prompts foram executados com sucesso:
- ✅ PROMPT 1: `recalcular-desempenho-v2` retornando 200 OK
- ✅ PROMPT 2: `calculate_evento_metrics` sem erro de `nibo_agendamentos`
- ✅ PROMPT 3: `get_count_base_ativa` retornando valor correto (~5K-6K)
- ✅ PROMPT 4: `processar_raw_data_pendente` com $-prefix correto
- ✅ PROMPT 6: CMO zerado

### Passos de Recálculo

#### 1. Recalcular Eventos com Mix Zerado

```sql
-- Marcar eventos que falharam anteriormente
UPDATE eventos_base
SET precisa_recalculo = true
WHERE id IN (1005, 1006, 1097);

-- Executar auto-recálculo
SELECT * FROM auto_recalculo_eventos_pendentes('hotfix-mix-abril-06');

-- Verificar resultado
SELECT
  id, data_evento, percent_b, percent_d, percent_c,
  real_r, cl_real, te_real, tb_real
FROM eventos_base
WHERE id IN (1005, 1006, 1097)
ORDER BY id;
```

**Esperado após auto-recálculo:**
- `percent_b + percent_d + percent_c` ≈ 100
- `real_r > 0` para cada evento
- `cl_real, te_real, tb_real` com valores reais

#### 2. Disparar Recálculo do Desempenho Semanal

```sql
-- Via função SQL
SELECT executar_recalculo_desempenho_v2();

-- OU via HTTP direto (se preferir)
-- curl -X POST ... recalcular-desempenho-v2 com ano=2026, numero_semana=14, bar_id=3
```

Aguardar resposta (deve retornar 200 OK em menos de 5 segundos).

#### 3. Verificar Resultado Completo

```sql
SELECT
  numero_semana,
  ano,
  bar_id,
  faturamento_total,
  clientes_atendidos,
  clientes_ativos,
  qui_sab_dom,
  perc_faturamento_ate_19h,
  cmo,
  stockout_comidas_perc,
  stockout_bar_perc,
  perc_bebidas,
  perc_drinks,
  perc_comida,
  atrasinhos_bar,
  atrasinhos_cozinha,
  reservas_totais,
  updated_at
FROM desempenho_semanal
WHERE numero_semana = 14 AND ano = 2026 AND bar_id = 3;
```

### Valores Esperados Após Recálculo

| Indicador | Valor Esperado | Tolerância |
|-----------|----------------|-----------|
| `faturamento_total` | ~R$367.977 | ±R$5.000 |
| `clientes_atendidos` | ~3.398 | ±200 |
| `reservas_totais` | ~1.201 | ±100 |
| `qui_sab_dom` | ~R$197.863 | ±R$3.000 |
| `perc_faturamento_ate_19h` | ~71% | ±5% |
| `cmo` | 0 | (manual, deve ser 0) |
| `clientes_ativos` | 5.000-6.000 | (após PROMPT 3) |
| `stockout_comidas_perc` | 30-40% | (depende de dados reais) |
| `stockout_bar_perc` | 40-60% | (depende de dados reais) |

### Detalhamento de Qui+Sab+Dom

Composição esperada:
- **Quinta (02/04):** R$64.601
- **Sábado (04/04):** R$98.325 (após evento 1005 corrigido)
- **Domingo (05/04):** R$34.956 (ContaHub 05/04 sincronizado)
- **TOTAL:** ~R$197.882 (pequeninhas variações são normais)

Se diferir significativamente, verificar:
1. Se eventos 1005, 1006 foram atualizados com valores corretos
2. Se ContaHub 05/04 foi sincronizado
3. Se `contahub_periodo` de 05/04 tem valores > 0

### Rollback (se necessário)

Se o recálculo produzir valores muito diferentes do esperado:

```sql
-- Ver valor anterior
SELECT * FROM desempenho_semanal
WHERE numero_semana = 14 AND ano = 2026 AND bar_id = 3
LIMIT 1;

-- Investigar o que mudou
-- Reexecutar PROMPT 1-3 para verificar se houve erro
```

---

## PROMPT 8 — Stockout: Revisar Catálogo de Produtos

### Contexto Crítico
A tabela `contahub_stockout_filtrado` (bar 3) mostra:
- Categoria **"Bar":** apenas 13 produtos
- Desses 13: **7 ficam em stockout permanente** (~54%)
- Resultado: `stockout_bar_perc = 56%` (parece absurdo)

**Evidência:**

```sql
SELECT
  categoria_local,
  COUNT(DISTINCT prd_desc) as total_produtos,
  COUNT(DISTINCT CASE WHEN estoque_atual = 0 THEN prd_desc END) as em_stockout
FROM contahub_stockout_filtrado
WHERE bar_id = 3
GROUP BY categoria_local;
```

Esperado para "Bar": 50-150 produtos, não 13.

### Possíveis Causas

1. **Produtos descontinuados** ainda aparecendo no catálogo
2. **Categorias mal configuradas** — produtos "Bar" estão marcados como outra categoria
3. **Filtro de visibilidade** — alguns produtos estão marcados como ocultos/inativos
4. **Importação incompleta** do catálogo ContaHub

### Passos de Investigação

#### 1. Listar Produtos "Bar" Atuais

```sql
SELECT DISTINCT
  prd_desc,
  COUNT(*) as dias_em_stockout,
  MAX(estoque_atual) as max_estoque_registrado
FROM contahub_stockout_filtrado
WHERE bar_id = 3 AND categoria_local = 'Bar'
GROUP BY prd_desc
ORDER BY dias_em_stockout DESC;
```

Verificar se os 7 produtos em stockout permanente fazem sentido (ex: bebidas sazonais).

#### 2. Verificar Produto Ativo vs Inativo

```sql
-- Se houver tabela de cadastro de produtos
SELECT
  codigo,
  descricao,
  categoria,
  ativo,
  estoque_minimo,
  estoque_maximo
FROM produtos_cadastro
WHERE bar_id = 3 AND categoria = 'Bar'
ORDER BY descricao;
```

Se "ativo = false", esses produtos devem ser excluídos da tabela `contahub_stockout_filtrado`.

#### 3. Verificar Fonte de Dados (contahub_stockout_filtrado)

```sql
-- Ver como contahub_stockout_filtrado é preenchida
SELECT
  prosrc
FROM pg_proc
WHERE proname ILIKE '%stockout%'
LIMIT 5;
```

Verificar se a query de filtragem exclui produtos inativos.

#### 4. Comparar com Outras Categorias

```sql
SELECT
  categoria_local,
  COUNT(DISTINCT prd_desc) as total_produtos,
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN estoque_atual = 0 THEN prd_desc END)
    / NULLIF(COUNT(DISTINCT prd_desc), 0),
    1
  ) as perc_stockout
FROM contahub_stockout_filtrado
WHERE bar_id = 3 AND DATE(data_stockout) >= NOW() - INTERVAL '7 days'
GROUP BY categoria_local
ORDER BY perc_stockout DESC;
```

Comparar "Bar" com "Comida", "Bebida", etc. para contextualizar.

### Possível Correção

Se a causa for **produtos descontinuados**:

#### Opção A: Adicionar coluna "ativo" em contahub_stockout_filtrado

```sql
ALTER TABLE contahub_stockout_filtrado
ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;

-- Desativar produtos conhecidos como inativos
UPDATE contahub_stockout_filtrado
SET ativo = false
WHERE prd_desc IN ('Produto Descontinuado 1', 'Produto Descontinuado 2');
```

#### Opção B: Atualizar query de preenchimento

Se `contahub_stockout_filtrado` é preenchida por função, adicionar filtro:

```sql
-- Na função que popula contahub_stockout_filtrado, adicionar:
AND p.ativo = true
AND p.categoria = 'Bar'
```

#### Opção C: Revisar manualmente catálogo ContaHub

```bash
# Exportar lista de produtos para revisão
SELECT
  prd_desc,
  COUNT(*) as occurrences,
  MIN(estoque_atual) as min_stock,
  MAX(estoque_atual) as max_stock,
  COUNT(DISTINCT DATE(data_stockout)) as dias_registrado
FROM contahub_stockout_filtrado
WHERE bar_id = 3 AND categoria_local = 'Bar'
GROUP BY prd_desc
ORDER BY occurrences DESC;
```

### Validação

**Após correção:**

```sql
SELECT
  categoria_local,
  COUNT(DISTINCT prd_desc) as total_produtos,
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN estoque_atual = 0 THEN prd_desc END)
    / NULLIF(COUNT(DISTINCT prd_desc), 0),
    1
  ) as perc_stockout
FROM contahub_stockout_filtrado
WHERE bar_id = 3 AND ativo = true
GROUP BY categoria_local;
```

Esperado para "Bar": 50-150 produtos com `perc_stockout` entre 20-40%.

---

## ORDEM DE EXECUÇÃO RECOMENDADA

### Fase 1: Correção de Infraestrutura (URGENTE)

1. **PROMPT 1** — Corrigir `recalcular-desempenho-v2` (503)
   - Depuradores problemas de import/deploy
   - Validar que edge function retorna 200 OK
   - **Tempo estimado:** 30-45 min

2. **PROMPT 2** — Corrigir `calculate_evento_metrics` (nibo_agendamentos)
   - Remover ou criar dependência
   - Redeploar função SQL
   - **Tempo estimado:** 20-30 min

3. **PROMPT 3** — Corrigir `get_count_base_ativa` (inflado)
   - Mudar HAVING para contar dias distintos
   - Validar que retorna ~5K-6K
   - **Tempo estimado:** 15-20 min

4. **PROMPT 4** — Corrigir `processar_raw_data_pendente` ($-prefix)
   - Adicionar $-prefix mapping
   - Corrigir schema (`bandeira`, `dia`)
   - **Tempo estimado:** 25-35 min

### Fase 2: Recálculo Completo (PÓS-CORREÇÕES)

5. **PROMPT 6** — Zerar CMO manual
   - Executar UPDATE simples
   - **Tempo estimado:** 2-3 min

6. **PROMPT 7** — Recalcular Desempenho S14
   - Executar após Prompts 1-3
   - Validar valores finais
   - **Tempo estimado:** 10-15 min

### Fase 3: Investigação e Ajustes

7. **PROMPT 5** — Corrigir Lista Quente (0 clientes)
   - Depurar tipo de dados
   - Corrigir comparação de datas
   - **Tempo estimado:** 15-25 min

8. **PROMPT 8** — Revisar Catálogo Stockout
   - Investigar produtos Bar
   - Possível limpeza de inativos
   - **Tempo estimado:** 20-30 min

### Timeline Total
- **Fase 1 (Crítica):** 1h 20min - 2h 10min
- **Fase 2 (Recálculo):** 15-20 min
- **Fase 3 (Opcional):** 40-60 min
- **TOTAL:** 2h 20min - 3h 30min (dependendo de debugging necessário)

---

## CHECKLIST FINAL DE VALIDAÇÃO

Após executar TODOS os prompts, rodar:

```sql
-- 1. Verificar que funções não têm erro
SELECT 'calculate_evento_metrics' as test,
       CASE WHEN calculate_evento_metrics(1005) IS NOT NULL THEN 'OK' ELSE 'FAIL' END;

SELECT 'get_count_base_ativa' as test,
       CASE WHEN get_count_base_ativa(3, '2026-01-06', '2026-04-05') > 1000
            AND get_count_base_ativa(3, '2026-01-06', '2026-04-05') < 15000
            THEN 'OK' ELSE 'FAIL' END;

-- 2. Verificar eventos recalculados
SELECT
  id, percent_b, percent_d, percent_c,
  CASE WHEN percent_b + percent_d + percent_c > 90 AND percent_b + percent_d + percent_c < 110
       THEN 'OK' ELSE 'FAIL' END as percentual_mix
FROM eventos_base
WHERE id IN (1005, 1006, 1097);

-- 3. Verificar desempenho_semanal recalculado
SELECT
  numero_semana, faturamento_total, clientes_ativos, cmo,
  CASE WHEN faturamento_total > 350000 AND faturamento_total < 380000 THEN 'OK' ELSE 'FAIL' END as faturamento_ok,
  CASE WHEN clientes_ativos > 4000 AND clientes_ativos < 8000 THEN 'OK' ELSE 'FAIL' END as clientes_ok,
  CASE WHEN cmo = 0 THEN 'OK' ELSE 'FAIL' END as cmo_ok
FROM desempenho_semanal
WHERE numero_semana = 14 AND ano = 2026 AND bar_id = 3;

-- 4. Verificar edge function
-- Via curl (manualmente):
-- curl https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/recalcular-desempenho-v2 \
--   -H "Authorization: Bearer SERVICE_KEY" \
--   -d '{"bar_id":3,"numero_semana":14,"ano":2026}'
-- Esperado: 200 OK com "calculators_success": 6
```

---

## REFERÊNCIA RÁPIDA: COMANDOS SQL ESSENCIAIS

### Verificações Rápidas

```sql
-- Status da edge function (logs)
SELECT * FROM pg_cron.job_run_details
WHERE jobname = 'desempenho-v2-diario'
ORDER BY start_time DESC LIMIT 5;

-- Eventos atuais de S14
SELECT id, data_evento, real_r, percent_b, percent_d, percent_c, precisa_recalculo
FROM eventos_base
WHERE EXTRACT(WEEK FROM data_evento) = 14
  AND EXTRACT(YEAR FROM data_evento) = 2026
  AND bar_id = 3
ORDER BY data_evento;

-- Desempenho atual
SELECT * FROM desempenho_semanal
WHERE numero_semana = 14 AND ano = 2026 AND bar_id = 3;

-- Clientes no banco
SELECT get_count_base_ativa(3, '2026-01-06', '2026-04-05');

-- Lista Quente (diretamente)
SELECT COUNT(DISTINCT cliente_fone) FROM cliente_estatisticas
WHERE bar_id = 3
  AND ultima_visita >= NOW() - INTERVAL '7 days'
  AND ultima_visita < NOW();
```

### Operações de Correção

```sql
-- Forçar recalcular evento específico
UPDATE eventos_base SET precisa_recalculo = true WHERE id = 1005;
SELECT * FROM auto_recalculo_eventos_pendentes('hotfix-manual');

-- Forçar recalcular desempenho
SELECT executar_recalculo_desempenho_v2();

-- Limpar heartbeats órfãos
DELETE FROM heartbeat_log
WHERE status = 'running' AND created_at < NOW() - INTERVAL '24 hours';

-- Zerar campo manual
UPDATE desempenho_semanal SET cmo = 0, cmo_custo = 0 WHERE id = 671;
```

---

## REFERÊNCIAS EXTERNAS

- **Supabase Dashboard:** https://app.supabase.com/project/uqtgsvujwcbymjmvkjhy/
- **Logs de Edge Functions:** Dashboard → Functions → recalcular-desempenho-v2 → Logs
- **Database Editor:** Dashboard → SQL Editor
- **Documentação Supabase:** https://supabase.com/docs

---

**Documento criado:** 06 de Abril 2026 | **Versão:** 1.0
**Próxima atualização:** Após execução de PROMPT 1-3
