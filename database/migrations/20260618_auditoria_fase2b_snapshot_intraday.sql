-- 2026-06-18 — Auditoria Fase 2b: snapshot DRE/DFC intraday (atrelado ao refresh do CA).
-- Antes era 1 foto/dia (chave por data, sobrescrevia). O CA sincroniza de hora em hora
-- (contaazul-alteracao-1h) + baixas a cada 10min, e pode haver várias mudanças no mesmo
-- dia. Agora a tabela aceita VÁRIAS fotos/dia (chave por snapshot_at timestamptz) e a
-- foto sai DE HORA EM HORA aos :15 (logo após o sync das :00), mas SÓ se houve mudança
-- no CA desde a última foto (cruza com contaazul_lancamentos_historico) — evita fotos
-- idênticas. Assim o "o que mudou e quando" fica preciso ao longo do dia.

ALTER TABLE financial.dre_dfc_snapshot ADD COLUMN IF NOT EXISTS snapshot_at timestamptz;
UPDATE financial.dre_dfc_snapshot SET snapshot_at = snapshot_date::timestamptz WHERE snapshot_at IS NULL;
ALTER TABLE financial.dre_dfc_snapshot ALTER COLUMN snapshot_at SET NOT NULL;
ALTER TABLE financial.dre_dfc_snapshot DROP CONSTRAINT IF EXISTS dre_dfc_snapshot_pkey;
ALTER TABLE financial.dre_dfc_snapshot ADD PRIMARY KEY (snapshot_at, tipo, bar_id, mes, grupo, categoria);
CREATE INDEX IF NOT EXISTS idx_dredfc_snap_at ON financial.dre_dfc_snapshot(bar_id, tipo, mes, categoria, snapshot_at);

DROP FUNCTION IF EXISTS public.snapshot_dre_dfc(integer, integer);
CREATE OR REPLACE FUNCTION public.snapshot_dre_dfc(p_bar_id integer DEFAULT 3, p_ano integer DEFAULT NULL, p_force boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','financial','bronze','pg_catalog'
AS $fn$
DECLARE v_ano int := COALESCE(p_ano, EXTRACT(year FROM current_date)::int);
        v_last timestamptz; v_now timestamptz := now(); v_changed boolean; v_n int;
BEGIN
  SELECT max(snapshot_at) INTO v_last FROM financial.dre_dfc_snapshot WHERE bar_id=p_bar_id;
  v_changed := EXISTS (SELECT 1 FROM bronze.contaazul_lancamentos_historico
                       WHERE bar_id=p_bar_id AND alterado_em > COALESCE(v_last, '-infinity'::timestamptz));
  IF NOT p_force AND v_last IS NOT NULL AND NOT v_changed THEN
    RETURN 'SEM_MUDANCA';
  END IF;
  INSERT INTO financial.dre_dfc_snapshot(snapshot_at,snapshot_date,tipo,bar_id,ano,mes,grupo,categoria,valor)
  SELECT v_now, v_now::date,'DRE',p_bar_id,v_ano,mes,COALESCE(categoria_macro,'Não Mapeado'),categoria,valor_com_sinal
  FROM public.get_dre_por_ano(p_bar_id, v_ano);
  INSERT INTO financial.dre_dfc_snapshot(snapshot_at,snapshot_date,tipo,bar_id,ano,mes,grupo,categoria,valor)
  SELECT v_now, v_now::date,'DFC',p_bar_id,v_ano,mes,grupo_dfc,categoria,net
  FROM public.get_dfc_por_ano(p_bar_id, v_ano);
  SELECT COUNT(*) INTO v_n FROM financial.dre_dfc_snapshot WHERE snapshot_at=v_now AND bar_id=p_bar_id;
  RETURN 'OK '||v_n||' linhas @ '||v_now::text;
END;
$fn$;

-- Cron horário (substitui o diário):
--   SELECT cron.unschedule('snapshot-dre-dfc-diario');
--   SELECT cron.schedule('snapshot-dre-dfc-horario','15 * * * *', $$ SELECT public.snapshot_dre_dfc(3); $$);
-- O detector verificar_preenchimento_ca passou a comparar snapshot_at (mais recente vs >=12h antes).
