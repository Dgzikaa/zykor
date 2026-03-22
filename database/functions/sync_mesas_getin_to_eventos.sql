-- Function: sync_mesas_getin_to_eventos
-- Exportado de produção em: 2026-03-19
-- Descrição: Sincroniza dados de mesas/reservas do GetIn para eventos_base
-- Usado por: getin-sync, recálculos manuais

CREATE OR REPLACE FUNCTION public.sync_mesas_getin_to_eventos()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE eventos_base e
  SET 
    num_mesas_tot = COALESCE(g.total_mesas, 0),
    num_mesas_presentes = COALESCE(g.mesas_presentes, 0),
    res_tot = COALESCE(g.total_pessoas, 0),
    res_p = COALESCE(g.pessoas_presentes, 0)
  FROM (
    SELECT 
      bar_id,
      reservation_date,
      COUNT(*) as total_mesas,
      COUNT(*) FILTER (
        WHERE status NOT IN ('canceled-user', 'canceled-restaurant', 'canceled-agent', 'no-show')
        AND (no_show IS NULL OR no_show = false)
      ) as mesas_presentes,
      SUM(people) as total_pessoas,
      SUM(people) FILTER (
        WHERE status NOT IN ('canceled-user', 'canceled-restaurant', 'canceled-agent', 'no-show')
        AND (no_show IS NULL OR no_show = false)
      ) as pessoas_presentes
    FROM getin_reservations
    GROUP BY bar_id, reservation_date
  ) g
  WHERE e.bar_id = g.bar_id
    AND e.data_evento = g.reservation_date;
END;
$function$;
