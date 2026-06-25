-- =============================================================================
-- Planejado vs Realizado — histórico de "fotos" do plano por evento
-- =============================================================================
-- Objetivo: registrar o que foi PLANEJADO e o que de fato ACONTECEU em cada
-- evento, de forma imutável, pra depois avaliar onde a equipe errou no plano.
--
-- 3 tipos de foto (snapshot):
--   inicial : 1ª vez que o evento ganha previsão de custo (logo após ter meta).
--   revisao : quando a meta de faturamento (m1_r) muda no meio do caminho.
--   final   : o que realmente foi pago/faturado (Conta Azul) — upsert, converge.
--
-- Captura via trigger único em operations.eventos_base (pega TODAS as origens:
-- a função de projeção, o auto-sync de meta e a edição manual de valores reais).
-- =============================================================================

-- 1) Tabela de snapshots ------------------------------------------------------
CREATE TABLE IF NOT EXISTS operations.evento_plano_snapshots (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  evento_id     bigint  NOT NULL,
  bar_id        integer NOT NULL,
  data_evento   date    NOT NULL,
  tipo          text    NOT NULL CHECK (tipo IN ('inicial','revisao','final')),
  versao        integer NOT NULL DEFAULT 1,
  faturamento   numeric,           -- plano: m1_r ; final: real_r
  c_art         numeric,           -- plano: c_art_projecao ; final: c_art real
  c_prod        numeric,           -- plano: c_prod_projecao ; final: c_prod real
  pct_art_fat   numeric,           -- 100 * c_art / faturamento
  pct_prod_fat  numeric,           -- 100 * c_prod / faturamento
  fonte         text    NOT NULL,  -- 'projecao' | 'real'
  criado_em     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE operations.evento_plano_snapshots IS
  'Histórico imutável de fotos do plano por evento (inicial/revisao/final) para análise Planejado vs Realizado.';

-- Uma única foto "inicial" e uma única "final" por evento; "revisao" pode repetir.
CREATE UNIQUE INDEX IF NOT EXISTS ux_eps_inicial ON operations.evento_plano_snapshots (evento_id) WHERE tipo = 'inicial';
CREATE UNIQUE INDEX IF NOT EXISTS ux_eps_final   ON operations.evento_plano_snapshots (evento_id) WHERE tipo = 'final';
CREATE INDEX IF NOT EXISTS ix_eps_evento ON operations.evento_plano_snapshots (evento_id, tipo);
CREATE INDEX IF NOT EXISTS ix_eps_bar_data ON operations.evento_plano_snapshots (bar_id, data_evento);

-- Grants espelhando operations.eventos_base (acesso real via service_role no server).
GRANT SELECT ON operations.evento_plano_snapshots TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON operations.evento_plano_snapshots TO service_role;

-- 2) Trigger de captura -------------------------------------------------------
CREATE OR REPLACE FUNCTION operations.fn_snapshot_evento_plano()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'operations','public','pg_temp'
AS $$
DECLARE
  v_plan_exists boolean;
  v_real_exists boolean;
  v_has_plan    boolean;
  v_versao      integer;
  v_fat numeric; v_art numeric; v_prod numeric;
BEGIN
  -- Plano "pronto" = tem meta E já passou pela projeção (1ª projeção = lançamento).
  v_plan_exists := COALESCE(NEW.m1_r, 0) > 0 AND NEW.c_art_projecao IS NOT NULL;
  -- Realizado existe quando há faturamento real ou custo real lançado.
  v_real_exists := COALESCE(NEW.real_r, 0) > 0 OR COALESCE(NEW.c_art, 0) > 0 OR COALESCE(NEW.c_prod, 0) > 0;

  -- ---- FINAL (realizado): upsert, converge conforme o Conta Azul liquida ----
  IF v_real_exists THEN
    v_fat  := COALESCE(NEW.real_r, 0);
    v_art  := COALESCE(NEW.c_art, 0);
    v_prod := COALESCE(NEW.c_prod, 0);
    INSERT INTO operations.evento_plano_snapshots
      (evento_id, bar_id, data_evento, tipo, versao, faturamento, c_art, c_prod, pct_art_fat, pct_prod_fat, fonte)
    VALUES
      (NEW.id, NEW.bar_id, NEW.data_evento, 'final', 1, v_fat, v_art, v_prod,
       CASE WHEN v_fat > 0 THEN ROUND(100 * v_art  / v_fat, 2) END,
       CASE WHEN v_fat > 0 THEN ROUND(100 * v_prod / v_fat, 2) END,
       'real')
    ON CONFLICT (evento_id) WHERE tipo = 'final'
    DO UPDATE SET
       faturamento = EXCLUDED.faturamento, c_art = EXCLUDED.c_art, c_prod = EXCLUDED.c_prod,
       pct_art_fat = EXCLUDED.pct_art_fat, pct_prod_fat = EXCLUDED.pct_prod_fat,
       criado_em = now()
    WHERE operations.evento_plano_snapshots.faturamento IS DISTINCT FROM EXCLUDED.faturamento
       OR operations.evento_plano_snapshots.c_art       IS DISTINCT FROM EXCLUDED.c_art
       OR operations.evento_plano_snapshots.c_prod      IS DISTINCT FROM EXCLUDED.c_prod;
  END IF;

  -- ---- PLANO (inicial / revisao) ----
  IF v_plan_exists THEN
    SELECT EXISTS(
      SELECT 1 FROM operations.evento_plano_snapshots s
      WHERE s.evento_id = NEW.id AND s.tipo IN ('inicial','revisao')
    ) INTO v_has_plan;

    v_fat  := COALESCE(NEW.m1_r, 0);
    v_art  := COALESCE(NEW.c_art_projecao, 0);
    v_prod := COALESCE(NEW.c_prod_projecao, 0);

    IF NOT v_has_plan THEN
      -- Primeira foto do plano (lançamento).
      INSERT INTO operations.evento_plano_snapshots
        (evento_id, bar_id, data_evento, tipo, versao, faturamento, c_art, c_prod, pct_art_fat, pct_prod_fat, fonte)
      VALUES
        (NEW.id, NEW.bar_id, NEW.data_evento, 'inicial', 1, v_fat, v_art, v_prod,
         CASE WHEN v_fat > 0 THEN ROUND(100 * v_art  / v_fat, 2) END,
         CASE WHEN v_fat > 0 THEN ROUND(100 * v_prod / v_fat, 2) END,
         'projecao')
      ON CONFLICT (evento_id) WHERE tipo = 'inicial' DO NOTHING;

    ELSIF TG_OP = 'UPDATE' AND NEW.m1_r IS DISTINCT FROM OLD.m1_r THEN
      -- Replanejamento humano: a meta de faturamento mudou -> nova revisão.
      SELECT COALESCE(MAX(versao), 1) INTO v_versao
      FROM operations.evento_plano_snapshots
      WHERE evento_id = NEW.id AND tipo IN ('inicial','revisao');

      INSERT INTO operations.evento_plano_snapshots
        (evento_id, bar_id, data_evento, tipo, versao, faturamento, c_art, c_prod, pct_art_fat, pct_prod_fat, fonte)
      VALUES
        (NEW.id, NEW.bar_id, NEW.data_evento, 'revisao', v_versao + 1, v_fat, v_art, v_prod,
         CASE WHEN v_fat > 0 THEN ROUND(100 * v_art  / v_fat, 2) END,
         CASE WHEN v_fat > 0 THEN ROUND(100 * v_prod / v_fat, 2) END,
         'projecao');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_evento_plano ON operations.eventos_base;
CREATE TRIGGER trg_snapshot_evento_plano
AFTER INSERT OR UPDATE OF m1_r, c_art_projecao, c_prod_projecao, real_r, c_art, c_prod
ON operations.eventos_base
FOR EACH ROW EXECUTE FUNCTION operations.fn_snapshot_evento_plano();

-- 3) Backfill -----------------------------------------------------------------
-- Foto inicial dos eventos que já têm plano (meta + projeção) e ainda não têm foto.
-- (Para o passado é o melhor possível: a projeção pode já ter derivado; daqui pra
--  frente a foto é tirada ao vivo no momento certo.)
INSERT INTO operations.evento_plano_snapshots
  (evento_id, bar_id, data_evento, tipo, versao, faturamento, c_art, c_prod, pct_art_fat, pct_prod_fat, fonte)
SELECT e.id, e.bar_id, e.data_evento, 'inicial', 1,
       COALESCE(e.m1_r,0), COALESCE(e.c_art_projecao,0), COALESCE(e.c_prod_projecao,0),
       CASE WHEN COALESCE(e.m1_r,0) > 0 THEN ROUND(100*COALESCE(e.c_art_projecao,0)/e.m1_r,2) END,
       CASE WHEN COALESCE(e.m1_r,0) > 0 THEN ROUND(100*COALESCE(e.c_prod_projecao,0)/e.m1_r,2) END,
       'projecao'
FROM operations.eventos_base e
WHERE COALESCE(e.m1_r,0) > 0 AND e.c_art_projecao IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM operations.evento_plano_snapshots s
                  WHERE s.evento_id = e.id AND s.tipo IN ('inicial','revisao'));

-- Foto final dos eventos que já têm realizado.
INSERT INTO operations.evento_plano_snapshots
  (evento_id, bar_id, data_evento, tipo, versao, faturamento, c_art, c_prod, pct_art_fat, pct_prod_fat, fonte)
SELECT e.id, e.bar_id, e.data_evento, 'final', 1,
       COALESCE(e.real_r,0), COALESCE(e.c_art,0), COALESCE(e.c_prod,0),
       CASE WHEN COALESCE(e.real_r,0) > 0 THEN ROUND(100*COALESCE(e.c_art,0)/e.real_r,2) END,
       CASE WHEN COALESCE(e.real_r,0) > 0 THEN ROUND(100*COALESCE(e.c_prod,0)/e.real_r,2) END,
       'real'
FROM operations.eventos_base e
WHERE (COALESCE(e.real_r,0) > 0 OR COALESCE(e.c_art,0) > 0 OR COALESCE(e.c_prod,0) > 0)
  AND NOT EXISTS (SELECT 1 FROM operations.evento_plano_snapshots s
                  WHERE s.evento_id = e.id AND s.tipo = 'final');

-- 4) View de leitura Planejado vs Realizado por evento ------------------------
CREATE OR REPLACE VIEW operations.v_evento_plano_vs_real AS
SELECT
  e.id   AS evento_id,
  e.bar_id,
  e.data_evento,
  e.nome,
  ini.faturamento AS fat_planejado,
  ini.c_art       AS c_art_planejado,
  ini.c_prod      AS c_prod_planejado,
  ini.pct_art_fat AS pct_art_planejado,
  fin.faturamento AS fat_realizado,
  fin.c_art       AS c_art_realizado,
  fin.c_prod      AS c_prod_realizado,
  fin.pct_art_fat AS pct_art_realizado,
  (fin.faturamento - ini.faturamento)                              AS delta_fat,
  CASE WHEN COALESCE(ini.faturamento,0) > 0
       THEN ROUND(100*(fin.faturamento - ini.faturamento)/ini.faturamento, 1) END AS delta_fat_pct,
  (fin.c_art - ini.c_art)                                          AS delta_c_art,
  (fin.c_prod - ini.c_prod)                                        AS delta_c_prod,
  (SELECT count(*) FROM operations.evento_plano_snapshots r
     WHERE r.evento_id = e.id AND r.tipo = 'revisao')             AS n_revisoes
FROM operations.eventos_base e
LEFT JOIN LATERAL (
  SELECT * FROM operations.evento_plano_snapshots s
  WHERE s.evento_id = e.id AND s.tipo = 'inicial' LIMIT 1
) ini ON true
LEFT JOIN LATERAL (
  SELECT * FROM operations.evento_plano_snapshots s
  WHERE s.evento_id = e.id AND s.tipo = 'final' LIMIT 1
) fin ON true
WHERE e.ativo;

GRANT SELECT ON operations.v_evento_plano_vs_real TO authenticated, service_role;
