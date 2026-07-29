-- 2026-07-29 — Rastro e alerta para a planilha de contagem
--
-- INCIDENTE QUE MOTIVOU: o Isaías ordenou de A a Z os nomes na planilha de contagem do Deboche
-- sem levar a coluna de quantidade junto. Nome e quantidade se desalinharam, e o cron das 17:35
-- gravou por cima em silêncio. A "Vodka Ketel One" (I0476) apareceu com 7,00 — que era o estoque
-- do "Whisky Old Parr 750 ml" (I0471), o código vizinho.
--
-- Duas coisas faltaram, e são o que este arquivo entrega:
--
--   1. RASTRO. public.bronze_contagem_sheet guarda só o estado atual — cada sync sobrescreve.
--      Quando fomos procurar "o que tinha antes", não existia mais. A recuperação dependeu de a
--      própria pessoa lembrar de desfazer no histórico de versões do Google Sheets.
--
--   2. AVISO. Ninguém soube que 78 itens de uma data já fechada tinham mudado. Se ele não tivesse
--      desfeito por conta própria, o erro apareceria dias depois como CMV estranho — e aí sem
--      referência do que era certo.
--
-- O QUE ISTO NÃO FAZ: não impede a escrita. Alteração no dia corrente segue livre (é a contagem
-- sendo feita) e desalinhamento que afete poucos itens passa sob o limiar. É rede de detecção,
-- não trava — a trava de verdade é proteger o intervalo na planilha (ou tirar a contagem do Sheets).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Histórico append-only das ingestões
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bronze.contagem_sheet_historico (
  id                       bigserial PRIMARY KEY,
  ingerido_em              timestamptz NOT NULL DEFAULT now(),
  operacao                 text NOT NULL,            -- 'insert' | 'update'
  bar_id                   integer NOT NULL,
  data_contagem            date NOT NULL,
  insumo_codigo            text NOT NULL,
  insumo_nome              text,
  fechado_antes            numeric,
  flutuante_antes          numeric,
  fechado_depois           numeric,
  flutuante_depois         numeric
);

CREATE INDEX IF NOT EXISTS idx_contagem_hist_bar_data
  ON bronze.contagem_sheet_historico (bar_id, data_contagem, ingerido_em DESC);
CREATE INDEX IF NOT EXISTS idx_contagem_hist_ingerido
  ON bronze.contagem_sheet_historico (ingerido_em DESC);

ALTER TABLE bronze.contagem_sheet_historico ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bronze.contagem_sheet_historico FROM anon, authenticated;
GRANT ALL ON bronze.contagem_sheet_historico TO service_role;
GRANT USAGE, SELECT ON SEQUENCE bronze.contagem_sheet_historico_id_seq TO service_role;

-- Grava SÓ quando o valor muda de fato. O sync roda de hora em hora nos 2 bares (~350-900 linhas
-- cada); registrar toda passagem encheria a tabela com milhares de linhas idênticas por dia.
-- Tolerância de 0.001 evita ruído de arredondamento (0.065 vs 0.07 já apareceu na comparação).
CREATE OR REPLACE FUNCTION bronze.fn_contagem_sheet_historico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'bronze', 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF abs(COALESCE(NEW.estoque_fechado,0)   - COALESCE(OLD.estoque_fechado,0))   < 0.001
   AND abs(COALESCE(NEW.estoque_flutuante,0) - COALESCE(OLD.estoque_flutuante,0)) < 0.001 THEN
      RETURN NEW;
    END IF;

    INSERT INTO bronze.contagem_sheet_historico
      (operacao, bar_id, data_contagem, insumo_codigo, insumo_nome,
       fechado_antes, flutuante_antes, fechado_depois, flutuante_depois)
    VALUES ('update', NEW.bar_id, NEW.data_contagem, NEW.insumo_codigo, NEW.insumo_nome,
            OLD.estoque_fechado, OLD.estoque_flutuante, NEW.estoque_fechado, NEW.estoque_flutuante);
  ELSE
    INSERT INTO bronze.contagem_sheet_historico
      (operacao, bar_id, data_contagem, insumo_codigo, insumo_nome,
       fechado_antes, flutuante_antes, fechado_depois, flutuante_depois)
    VALUES ('insert', NEW.bar_id, NEW.data_contagem, NEW.insumo_codigo, NEW.insumo_nome,
            NULL, NULL, NEW.estoque_fechado, NEW.estoque_flutuante);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_contagem_sheet_historico ON public.bronze_contagem_sheet;
CREATE TRIGGER trg_contagem_sheet_historico
  AFTER INSERT OR UPDATE ON public.bronze_contagem_sheet
  FOR EACH ROW EXECUTE FUNCTION bronze.fn_contagem_sheet_historico();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Alerta: contagem de dia PASSADO mudou em bloco
-- ─────────────────────────────────────────────────────────────────────────────
-- Mexer no dia corrente é rotina. O que não é normal é data já fechada mudar em massa.
-- No incidente de 29/07 isto teria disparado: 78 itens de 28/07 alterados às 17:35.
CREATE OR REPLACE FUNCTION bronze.fn_alerta_contagem_alteracao_massiva(
  p_minutos integer DEFAULT 90,
  p_min_itens integer DEFAULT 15
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'bronze', 'public'
AS $function$
DECLARE
  r record;
  v_msg text := '';
  v_alertas int := 0;
BEGIN
  FOR r IN
    SELECT h.bar_id, h.data_contagem, COUNT(*) AS itens_alterados, MAX(h.ingerido_em) AS ultima
      FROM bronze.contagem_sheet_historico h
     WHERE h.operacao = 'update'
       AND h.ingerido_em > now() - make_interval(mins => p_minutos)
       AND h.data_contagem < current_date
     GROUP BY h.bar_id, h.data_contagem
    HAVING COUNT(*) >= p_min_itens
     ORDER BY COUNT(*) DESC
  LOOP
    v_alertas := v_alertas + 1;
    v_msg := v_msg || format(
      '• **Bar %s** — contagem de %s: %s itens alterados (última escrita %s)' || E'\n',
      r.bar_id, TO_CHAR(r.data_contagem, 'DD/MM'), r.itens_alterados, TO_CHAR(r.ultima, 'DD/MM HH24:MI')
    );
  END LOOP;

  IF v_alertas = 0 THEN
    RETURN 'OK_SEM_ALERTA';
  END IF;

  RETURN public.enviar_alerta_discord_sistema_dedup(
    3, 'alerta', 'contagem_alterada',
    '📋 Contagem de dia passado mudou em bloco',
    'O sync da planilha reescreveu contagens já fechadas:' || E'\n\n' || v_msg
      || E'\nSe ninguém mexeu de propósito, confira a planilha (ordenação/colagem pode ter '
      || 'desalinhado nome x quantidade). O antes/depois de cada item está em '
      || 'bronze.contagem_sheet_historico.',
    16776960,
    'contagem_alterada_' || current_date::text
  );
END;
$function$;

REVOKE ALL ON FUNCTION bronze.fn_alerta_contagem_alteracao_massiva(integer, integer) FROM anon, authenticated;

-- Roda aos :45, depois dos syncs de contagem (:30 Ordinário, :35 Deboche).
-- SELECT cron.schedule('alerta-contagem-alteracao-massiva', '45 * * * *',
--   $$SELECT bronze.fn_alerta_contagem_alteracao_massiva(90, 15);$$);
