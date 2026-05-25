-- ============================================================================
-- Medallion architecture pra orcamentacao
-- ============================================================================
-- Substitui o "varre 15k rows do bronze toda vez" da pagina /estrategico/orcamentacao
-- por consultas a gold.orcamento_realizado_mensal (~50 rows pre-agregadas).
--
-- Camadas:
--   bronze.bronze_contaazul_lancamentos  (raw, ja existe)
--          ↓ fn_refresh_silver_orcamento
--   silver.lancamento_classificado       (1 row por lancamento, mapeado/flagueado)
--          ↓ fn_refresh_gold_orcamento
--   gold.orcamento_realizado_mensal      (agregado por bar+ano+mes+categoria)
--
-- Mapeamento ContaAzul -> Zykor vem de meta.categoria_zykor_map (substitui
-- CATEGORIAS_MAP hardcoded em orcamentacao-service.ts).
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS meta;
CREATE SCHEMA IF NOT EXISTS silver;
CREATE SCHEMA IF NOT EXISTS gold;

-- ============================================================================
-- 1. meta.categoria_zykor_map
-- ============================================================================
CREATE TABLE IF NOT EXISTS meta.categoria_zykor_map (
  id                SERIAL PRIMARY KEY,
  categoria_ca      TEXT UNIQUE NOT NULL,         -- nome no ContaAzul (categoria_nome)
  categoria_zykor   TEXT NOT NULL,                -- nome canonical Zykor
  bloco_dre         TEXT,                         -- 'Receita', 'Custos Variaveis', etc
  tipo_zykor        TEXT CHECK (tipo_zykor IN ('receita', 'despesa')),
  ignorar           BOOLEAN NOT NULL DEFAULT FALSE,
  observacao        TEXT,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cat_zykor_map_zykor ON meta.categoria_zykor_map(categoria_zykor);
CREATE INDEX IF NOT EXISTS idx_cat_zykor_map_bloco ON meta.categoria_zykor_map(bloco_dre);

-- ============================================================================
-- 2. silver.lancamento_classificado
-- ============================================================================
CREATE TABLE IF NOT EXISTS silver.lancamento_classificado (
  contaazul_id            UUID PRIMARY KEY,
  bar_id                  INTEGER NOT NULL,
  data_competencia        DATE NOT NULL,
  data_pagamento          DATE,
  tipo_ca                 TEXT NOT NULL,           -- 'RECEITA' | 'DESPESA' do CA
  status                  TEXT NOT NULL,           -- ACQUITTED/OVERDUE/PENDING/PARTIAL
  categoria_ca            TEXT,
  categoria_zykor         TEXT,
  bloco_dre               TEXT,
  tipo_zykor              TEXT,                    -- receita/despesa (do map)
  valor_bruto             NUMERIC(15,2) NOT NULL,
  descricao               TEXT,
  pessoa_nome             TEXT,
  is_antecipacao_stone    BOOLEAN NOT NULL DEFAULT FALSE,
  is_ignorado             BOOLEAN NOT NULL DEFAULT FALSE,
  sync_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_silver_lanc_bar_data ON silver.lancamento_classificado(bar_id, data_competencia);
CREATE INDEX IF NOT EXISTS idx_silver_lanc_cat ON silver.lancamento_classificado(categoria_zykor);
CREATE INDEX IF NOT EXISTS idx_silver_lanc_bloco ON silver.lancamento_classificado(bloco_dre);

-- ============================================================================
-- 3. gold.orcamento_realizado_mensal
-- ============================================================================
CREATE TABLE IF NOT EXISTS gold.orcamento_realizado_mensal (
  bar_id            INTEGER NOT NULL,
  ano               INTEGER NOT NULL,
  mes               INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  categoria_zykor   TEXT NOT NULL,
  bloco_dre         TEXT,
  tipo_zykor        TEXT NOT NULL,                 -- 'receita' | 'despesa'
  receita_total     NUMERIC(15,2) NOT NULL DEFAULT 0,  -- soma tipo_ca='RECEITA'
  despesa_total     NUMERIC(15,2) NOT NULL DEFAULT 0,  -- soma tipo_ca='DESPESA'
  net               NUMERIC(15,2) NOT NULL DEFAULT 0,  -- net signed pra categoria
  qtd_lancamentos   INTEGER NOT NULL DEFAULT 0,
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bar_id, ano, mes, categoria_zykor)
);
CREATE INDEX IF NOT EXISTS idx_gold_orca_bar_periodo ON gold.orcamento_realizado_mensal(bar_id, ano, mes);
CREATE INDEX IF NOT EXISTS idx_gold_orca_bloco ON gold.orcamento_realizado_mensal(bloco_dre);

-- ============================================================================
-- 4. fn_refresh_silver_orcamento
-- ============================================================================
-- Popula silver.lancamento_classificado a partir do bronze, aplicando
-- mapeamento (meta.categoria_zykor_map), flag de antecipacao Stone e ignorados.
-- ============================================================================
CREATE OR REPLACE FUNCTION silver.fn_refresh_silver_orcamento(
  p_bar_id        INTEGER,
  p_data_inicio   DATE,
  p_data_fim      DATE
) RETURNS INTEGER AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  -- Remove silver antigo no range
  DELETE FROM silver.lancamento_classificado
  WHERE bar_id = p_bar_id
    AND data_competencia BETWEEN p_data_inicio AND p_data_fim;

  -- Repopula com bronze atual + mapping
  INSERT INTO silver.lancamento_classificado (
    contaazul_id, bar_id, data_competencia, data_pagamento,
    tipo_ca, status, categoria_ca, categoria_zykor, bloco_dre, tipo_zykor,
    valor_bruto, descricao, pessoa_nome,
    is_antecipacao_stone, is_ignorado
  )
  SELECT
    b.contaazul_id::uuid,
    b.bar_id,
    b.data_competencia,
    b.data_pagamento,
    b.tipo,
    COALESCE(b.status, 'UNKNOWN'),
    b.categoria_nome,
    COALESCE(m.categoria_zykor, b.categoria_nome),
    m.bloco_dre,
    m.tipo_zykor,
    ABS(b.valor_bruto::numeric),
    b.descricao,
    b.pessoa_nome,
    (b.descricao ~* 'STONE\s+PAGAMENTO\s+ANTECIPAC'),
    COALESCE(m.ignorar, FALSE)
  FROM bronze.bronze_contaazul_lancamentos b
  LEFT JOIN meta.categoria_zykor_map m ON m.categoria_ca = b.categoria_nome
  WHERE b.bar_id = p_bar_id
    AND b.data_competencia BETWEEN p_data_inicio AND p_data_fim
    AND b.excluido_em IS NULL
  ON CONFLICT (contaazul_id) DO UPDATE SET
    bar_id = EXCLUDED.bar_id,
    data_competencia = EXCLUDED.data_competencia,
    data_pagamento = EXCLUDED.data_pagamento,
    tipo_ca = EXCLUDED.tipo_ca,
    status = EXCLUDED.status,
    categoria_ca = EXCLUDED.categoria_ca,
    categoria_zykor = EXCLUDED.categoria_zykor,
    bloco_dre = EXCLUDED.bloco_dre,
    tipo_zykor = EXCLUDED.tipo_zykor,
    valor_bruto = EXCLUDED.valor_bruto,
    descricao = EXCLUDED.descricao,
    pessoa_nome = EXCLUDED.pessoa_nome,
    is_antecipacao_stone = EXCLUDED.is_antecipacao_stone,
    is_ignorado = EXCLUDED.is_ignorado,
    sync_at = NOW();

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. fn_refresh_gold_orcamento
-- ============================================================================
-- Agrega silver em gold por (bar_id, ano, mes, categoria_zykor).
-- Aplica filtros: exclui antecipacoes Stone e categorias ignoradas (CAPEX/Div).
-- ============================================================================
CREATE OR REPLACE FUNCTION gold.fn_refresh_gold_orcamento(
  p_bar_id  INTEGER,
  p_ano     INTEGER,
  p_mes     INTEGER
) RETURNS INTEGER AS $$
DECLARE
  v_rows           INTEGER;
  v_data_inicio    DATE;
  v_data_fim       DATE;
BEGIN
  v_data_inicio := MAKE_DATE(p_ano, p_mes, 1);
  v_data_fim := (v_data_inicio + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  -- Remove gold antigo
  DELETE FROM gold.orcamento_realizado_mensal
  WHERE bar_id = p_bar_id AND ano = p_ano AND mes = p_mes;

  -- Insere agregado novo
  INSERT INTO gold.orcamento_realizado_mensal (
    bar_id, ano, mes, categoria_zykor, bloco_dre, tipo_zykor,
    receita_total, despesa_total, net, qtd_lancamentos
  )
  SELECT
    p_bar_id, p_ano, p_mes,
    categoria_zykor,
    MAX(bloco_dre) AS bloco_dre,
    COALESCE(MAX(tipo_zykor), 'despesa') AS tipo_zykor,
    ROUND(SUM(CASE WHEN tipo_ca='RECEITA' THEN valor_bruto ELSE 0 END)::numeric, 2) AS receita_total,
    ROUND(SUM(CASE WHEN tipo_ca='DESPESA' THEN valor_bruto ELSE 0 END)::numeric, 2) AS despesa_total,
    -- net por tipo zykor:
    --   tipo_zykor='receita' -> net = receita - despesa (estornos abatem)
    --   tipo_zykor='despesa' -> net = despesa - receita (devolucoes abatem)
    ROUND(CASE
      WHEN MAX(tipo_zykor) = 'receita'
        THEN SUM(CASE WHEN tipo_ca='RECEITA' THEN valor_bruto ELSE -valor_bruto END)
      ELSE SUM(CASE WHEN tipo_ca='DESPESA' THEN valor_bruto ELSE -valor_bruto END)
    END::numeric, 2) AS net,
    COUNT(*) AS qtd_lancamentos
  FROM silver.lancamento_classificado
  WHERE bar_id = p_bar_id
    AND data_competencia BETWEEN v_data_inicio AND v_data_fim
    AND is_antecipacao_stone = FALSE
    AND is_ignorado = FALSE
  GROUP BY categoria_zykor;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. fn_refresh_orcamento_periodo: orquestrador (silver + gold pra um range)
-- ============================================================================
CREATE OR REPLACE FUNCTION gold.fn_refresh_orcamento_periodo(
  p_bar_id        INTEGER,
  p_data_inicio   DATE,
  p_data_fim      DATE
) RETURNS JSONB AS $$
DECLARE
  v_silver_rows INTEGER;
  v_gold_total  INTEGER := 0;
  v_mes_atual   DATE;
  v_gold_rows   INTEGER;
BEGIN
  -- Step 1: refresh silver pro range inteiro
  v_silver_rows := silver.fn_refresh_silver_orcamento(p_bar_id, p_data_inicio, p_data_fim);

  -- Step 2: refresh gold mes a mes
  v_mes_atual := DATE_TRUNC('month', p_data_inicio)::DATE;
  WHILE v_mes_atual <= p_data_fim LOOP
    v_gold_rows := gold.fn_refresh_gold_orcamento(
      p_bar_id,
      EXTRACT(YEAR FROM v_mes_atual)::INTEGER,
      EXTRACT(MONTH FROM v_mes_atual)::INTEGER
    );
    v_gold_total := v_gold_total + v_gold_rows;
    v_mes_atual := (v_mes_atual + INTERVAL '1 month')::DATE;
  END LOOP;

  RETURN jsonb_build_object(
    'silver_rows', v_silver_rows,
    'gold_rows', v_gold_total,
    'bar_id', p_bar_id,
    'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
