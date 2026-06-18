-- 2026-06-18 — Auditoria Fase 2: snapshot diário da DRE e da DFC (foto no tempo).
-- A DRE/DFC são calculadas ao vivo; sem foto, não dá pra responder "era 12k, virou 5k".
-- snapshot_dre_dfc() grava 1 foto/dia (por ON CONFLICT, re-rodar no mesmo dia atualiza)
-- de cada linha (DRE por competência + DFC por caixa) do bar. Cron diário 11:00 BRT.

CREATE TABLE IF NOT EXISTS financial.dre_dfc_snapshot (
  snapshot_date date NOT NULL,
  tipo          text NOT NULL,            -- 'DRE' | 'DFC'
  bar_id        integer NOT NULL,
  ano           integer NOT NULL,
  mes           date NOT NULL,
  grupo         text NOT NULL,            -- categoria_macro (DRE) / grupo_dfc (DFC)
  categoria     text NOT NULL,
  valor         numeric(14,2) NOT NULL,
  PRIMARY KEY (snapshot_date, tipo, bar_id, mes, grupo, categoria)
);
CREATE INDEX IF NOT EXISTS idx_dredfc_snap_lookup ON financial.dre_dfc_snapshot(bar_id, tipo, mes, categoria, snapshot_date);

CREATE OR REPLACE FUNCTION public.snapshot_dre_dfc(p_bar_id integer DEFAULT 3, p_ano integer DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','financial','pg_catalog'
AS $fn$
DECLARE v_ano int := COALESCE(p_ano, EXTRACT(year FROM current_date)::int); v_n int;
BEGIN
  INSERT INTO financial.dre_dfc_snapshot(snapshot_date,tipo,bar_id,ano,mes,grupo,categoria,valor)
  SELECT current_date,'DRE',p_bar_id,v_ano,mes,COALESCE(categoria_macro,'Não Mapeado'),categoria,valor_com_sinal
  FROM public.get_dre_por_ano(p_bar_id, v_ano)
  ON CONFLICT (snapshot_date,tipo,bar_id,mes,grupo,categoria) DO UPDATE SET valor=EXCLUDED.valor;

  INSERT INTO financial.dre_dfc_snapshot(snapshot_date,tipo,bar_id,ano,mes,grupo,categoria,valor)
  SELECT current_date,'DFC',p_bar_id,v_ano,mes,grupo_dfc,categoria,net
  FROM public.get_dfc_por_ano(p_bar_id, v_ano)
  ON CONFLICT (snapshot_date,tipo,bar_id,mes,grupo,categoria) DO UPDATE SET valor=EXCLUDED.valor;

  SELECT COUNT(*) INTO v_n FROM financial.dre_dfc_snapshot WHERE snapshot_date=current_date AND bar_id=p_bar_id;
  RETURN v_n;
END;
$fn$;

-- Cron diário (já aplicado): SELECT cron.schedule('snapshot-dre-dfc-diario','0 14 * * *', $$ SELECT public.snapshot_dre_dfc(3); $$);
