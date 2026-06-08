-- 2026-06-08 — Reconstrução da DESCOBERTA de eventos da Sympla (vivia na edge
-- function removida; por isso a ingestão parou em abr/2026). Tudo via função de
-- banco chamando a API Sympla com http() (auth: api_credentials sympla -> s_token).
-- Fluxo: descobre eventos do organizador -> sincroniza pedidos+participantes dos
-- eventos ATIVOS. Cron sympla-sync-diario a cada 6h (always-on; no-op quando não
-- há evento ativo). Só bar 3 (Ordinário) tem credencial Sympla.
-- Aplicado em prod via MCP nesta data. (sympla_sync_pedidos_evento /
-- sympla_sync_participantes_evento já existiam; não repetidas aqui.)

CREATE OR REPLACE FUNCTION public.sympla_get_eventos(p_bar_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'operations', 'financial', 'system', 'integrations', 'bronze', 'silver', 'gold', 'crm', 'ops', 'pg_catalog'
AS $function$
DECLARE
  v_token text;
  v_response record;
  v_all jsonb := '[]'::jsonb;
  v_page int := 1;
  v_has_next boolean := true;
BEGIN
  PERFORM set_config('http.timeout_msec','45000',true);

  SELECT api_token INTO v_token FROM public.api_credentials
  WHERE bar_id = p_bar_id AND sistema = 'sympla' AND ativo = true;
  IF v_token IS NULL THEN
    RAISE WARNING 'Sympla: bar % sem credencial ativa', p_bar_id;
    RETURN v_all;
  END IF;

  WHILE v_has_next LOOP
    SELECT * INTO v_response FROM http((
      'GET',
      'https://api.sympla.com.br/public/v3/events?page=' || v_page || '&page_size=100',
      ARRAY[http_header('s_token', v_token)],
      NULL, NULL
    )::http_request);

    IF v_response.status != 200 THEN
      RAISE WARNING 'Sympla events bar % status %: %', p_bar_id, v_response.status, substring(v_response.content,1,200);
      RETURN v_all;
    END IF;

    v_all := v_all || COALESCE((v_response.content::jsonb)->'data', '[]'::jsonb);
    v_has_next := COALESCE(((v_response.content::jsonb)->'pagination'->>'has_next')::boolean, false);
    v_page := v_page + 1;
    EXIT WHEN v_page > 100;
  END LOOP;

  RETURN v_all;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sympla_sync_eventos(p_bar_id integer)
 RETURNS TABLE(total_api integer, inseridos integer, atualizados integer, duracao numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'operations', 'financial', 'system', 'integrations', 'bronze', 'silver', 'gold', 'crm', 'ops', 'pg_catalog'
AS $function$
DECLARE
  v_evs jsonb;
  v_e jsonb;
  v_ins int := 0; v_upd int := 0; v_api int;
  v_inicio timestamptz := clock_timestamp();
  v_was_update boolean;
BEGIN
  v_evs := public.sympla_get_eventos(p_bar_id);
  v_api := jsonb_array_length(v_evs);

  FOR v_e IN SELECT * FROM jsonb_array_elements(v_evs) LOOP
    WITH upsert AS (
      INSERT INTO bronze.bronze_sympla_eventos (
        bar_id, event_id, name, detail, url, image, start_date, end_date,
        published, cancelled, private_event, host, address, category_prim, category_sec, raw_data, synced_at
      ) VALUES (
        p_bar_id,
        (v_e->>'id')::int,
        v_e->>'name', v_e->>'detail', v_e->>'url', v_e->>'image',
        NULLIF(v_e->>'start_date','')::timestamp,
        NULLIF(v_e->>'end_date','')::timestamp,
        NULLIF(v_e->>'published','')::smallint,
        NULLIF(v_e->>'cancelled','')::smallint,
        NULLIF(v_e->>'private_event','')::smallint,
        v_e->'host', v_e->'address', v_e->'category_prim', v_e->'category_sec',
        v_e, NOW()
      )
      ON CONFLICT (bar_id, event_id) DO UPDATE SET
        name = EXCLUDED.name, detail = EXCLUDED.detail, url = EXCLUDED.url, image = EXCLUDED.image,
        start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
        published = EXCLUDED.published, cancelled = EXCLUDED.cancelled, private_event = EXCLUDED.private_event,
        host = EXCLUDED.host, address = EXCLUDED.address,
        category_prim = EXCLUDED.category_prim, category_sec = EXCLUDED.category_sec,
        raw_data = EXCLUDED.raw_data, synced_at = NOW()
      RETURNING (xmax != 0) AS was_update
    )
    SELECT was_update INTO v_was_update FROM upsert;
    IF v_was_update THEN v_upd := v_upd + 1; ELSE v_ins := v_ins + 1; END IF;
  END LOOP;

  RETURN QUERY SELECT v_api, v_ins, v_upd, EXTRACT(EPOCH FROM (clock_timestamp() - v_inicio))::numeric;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sympla_sync_diario(p_bar_id integer DEFAULT 3)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'operations', 'financial', 'system', 'integrations', 'bronze', 'silver', 'gold', 'crm', 'ops', 'pg_catalog'
AS $function$
DECLARE
  v_disc record;
  v_ev integer;
  v_sincronizados int := 0;
  v_erros int := 0;
BEGIN
  SELECT * INTO v_disc FROM public.sympla_sync_eventos(p_bar_id);

  FOR v_ev IN
    SELECT event_id FROM bronze.bronze_sympla_eventos
    WHERE bar_id = p_bar_id
      AND COALESCE(cancelled, 0) <> 1
      AND COALESCE(end_date, start_date) >= (now() - interval '2 days')
    ORDER BY start_date
  LOOP
    BEGIN
      PERFORM public.sympla_sync_pedidos_evento(p_bar_id, v_ev);
      PERFORM public.sympla_sync_participantes_evento(p_bar_id, v_ev);
      v_sincronizados := v_sincronizados + 1;
    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros + 1;
      RAISE WARNING 'Sympla sync evento % falhou: %', v_ev, SQLERRM;
    END;
  END LOOP;

  RETURN format('Sympla bar %s: descobertos %s (novos %s), eventos ativos sincronizados %s, erros %s',
    p_bar_id, v_disc.total_api, v_disc.inseridos, v_sincronizados, v_erros);
END;
$function$;

-- Cron always-on, a cada 6h (statement_timeout na statement do comando).
SELECT cron.schedule(
  'sympla-sync-diario',
  '0 */6 * * *',
  $cron$SET statement_timeout = '600000'; SELECT public.sympla_sync_diario(3);$cron$
);
