CREATE OR REPLACE FUNCTION public.purgar_staging_antigo()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_limite DATE := CURRENT_DATE - INTERVAL '90 days';
  v_deleted INTEGER;
BEGIN
  DELETE FROM contahub_analitico WHERE trn_dtgerencial < v_limite;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'contahub_analitico: % registros purgados', v_deleted;

  DELETE FROM contahub_periodo WHERE dt_gerencial < v_limite;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'contahub_periodo: % registros purgados', v_deleted;

  DELETE FROM contahub_tempo WHERE data < v_limite;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'contahub_tempo: % registros purgados', v_deleted;

  DELETE FROM contahub_fatporhora WHERE vd_dtgerencial < v_limite;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'contahub_fatporhora: % registros purgados', v_deleted;

  DELETE FROM contahub_pagamentos WHERE dt_gerencial < v_limite;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'contahub_pagamentos: % registros purgados', v_deleted;

  DELETE FROM contahub_raw_data WHERE data_date < v_limite;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'contahub_raw_data: % registros purgados', v_deleted;
END; $function$;
