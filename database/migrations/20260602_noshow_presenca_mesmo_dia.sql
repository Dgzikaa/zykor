-- 20260602_noshow_presenca_mesmo_dia.sql
--
-- Feature: na pagina /analitico/clientes/no-show ("No-shows do mes"), adicionar
-- coluna "Foi ao bar?" — cruza o telefone normalizado da reserva marcada como
-- no-show (bronze.bronze_getin_reservations) com silver.cliente_visitas na MESMA
-- data. Se houve consumo, e provavel erro de operacao (reserva nao marcada como
-- comparecida, mas o cliente foi ao bar). Tambem retorna o valor consumido no dia.
--
-- Validacao (bar 3, mai/2026): 79 no-shows, 32 (40%) com consumo no mesmo dia.

CREATE OR REPLACE FUNCTION public.noshow_lista_com_presenca(
  p_bar_id integer,
  p_inicio date,
  p_fim date
) RETURNS TABLE (
  reservation_date date,
  reservation_time text,
  customer_name text,
  customer_phone text,
  customer_email text,
  people integer,
  status text,
  compareceu boolean,
  valor_dia numeric
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT
    r.reservation_date::date AS reservation_date,
    r.reservation_time,
    r.customer_name,
    r.customer_phone,
    r.customer_email,
    r.people,
    r.status,
    (v.fone IS NOT NULL) AS compareceu,
    v.valor_dia
  FROM bronze.bronze_getin_reservations r
  LEFT JOIN LATERAL (
    SELECT cv.cliente_fone_norm AS fone, sum(cv.valor_pagamentos) AS valor_dia
    FROM silver.cliente_visitas cv
    WHERE cv.bar_id = r.bar_id
      AND public.normalizar_telefone(r.customer_phone) <> ''
      AND cv.cliente_fone_norm = public.normalizar_telefone(r.customer_phone)
      AND cv.data_visita = r.reservation_date::date
    GROUP BY cv.cliente_fone_norm
  ) v ON true
  WHERE r.bar_id = p_bar_id
    AND r.status = 'no-show'
    AND r.reservation_date::date >= p_inicio
    AND r.reservation_date::date <= p_fim
  ORDER BY r.reservation_date::date DESC, r.reservation_time ASC;
$$;

GRANT EXECUTE ON FUNCTION public.noshow_lista_com_presenca(integer, date, date) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
