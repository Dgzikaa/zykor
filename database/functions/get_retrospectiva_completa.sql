CREATE OR REPLACE FUNCTION public.get_retrospectiva_completa(p_bar_id integer DEFAULT 3)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'recordes', json_build_object(
      'maiorFaturamentoDia', (
        SELECT json_build_object('valor', faturamento_liquido, 'evento', nome_evento, 'data', data_evento)
        FROM eventos WHERE bar_id = p_bar_id AND EXTRACT(YEAR FROM data_evento) = 2025 AND faturamento_liquido IS NOT NULL
        ORDER BY faturamento_liquido DESC LIMIT 1
      ),
      'maiorPublico', (
        SELECT json_build_object('pessoas', publico_real, 'evento', nome_evento, 'data', data_evento)
        FROM eventos WHERE bar_id = p_bar_id AND EXTRACT(YEAR FROM data_evento) = 2025 AND publico_real IS NOT NULL
        ORDER BY publico_real DESC LIMIT 1
      ),
      'melhorTicket', (
        SELECT json_build_object('valor', t_medio, 'evento', nome_evento, 'data', data_evento)
        FROM eventos WHERE bar_id = p_bar_id AND EXTRACT(YEAR FROM data_evento) = 2025 AND t_medio IS NOT NULL
        ORDER BY t_medio DESC LIMIT 1
      ),
      'horarioPico', json_build_object('horario', '21:00-23:00', 'faturamento', 0)
    ),
    'topClientesGasto', (
      SELECT json_agg(json_build_object('cliente', COALESCE(NULLIF(cliente_nome, ''), 'Cliente sem nome'), 'gasto', total_gasto) ORDER BY total_gasto DESC)
      FROM (
        SELECT cliente_nome, SUM(valor_produtos + COALESCE(valor_couvert, 0)) as total_gasto
        FROM visitas WHERE bar_id = p_bar_id AND EXTRACT(YEAR FROM data_visita) = 2025 AND cliente_nome IS NOT NULL
        GROUP BY cliente_nome ORDER BY total_gasto DESC LIMIT 10
      ) sub
    ),
    'clientesMaisFieis', (
      SELECT json_agg(json_build_object('cliente', COALESCE(NULLIF(cliente_nome, ''), 'Cliente sem nome'), 'visitas', total_visitas) ORDER BY total_visitas DESC)
      FROM (
        SELECT cliente_nome, COUNT(*) as total_visitas
        FROM visitas WHERE bar_id = p_bar_id AND EXTRACT(YEAR FROM data_visita) = 2025 AND cliente_nome IS NOT NULL
        GROUP BY cliente_nome ORDER BY total_visitas DESC LIMIT 10
      ) sub
    ),
    'topEventos', (
      SELECT json_agg(json_build_object('evento', COALESCE(nome_evento, 'Evento sem nome'), 'faturamento', faturamento_liquido, 'data', data_evento) ORDER BY faturamento_liquido DESC NULLS LAST)
      FROM (
        SELECT nome_evento, faturamento_liquido, data_evento
        FROM eventos WHERE bar_id = p_bar_id AND EXTRACT(YEAR FROM data_evento) = 2025 AND faturamento_liquido > 0
        ORDER BY faturamento_liquido DESC LIMIT 10
      ) sub
    ),
    'performanceDiaSemana', (
      SELECT json_agg(json_build_object('dia', dia_semana, 'faturamento', faturamento_medio) ORDER BY dia_semana)
      FROM (
        SELECT CASE EXTRACT(DOW FROM data_evento)
          WHEN 0 THEN 'Domingo' WHEN 1 THEN 'Segunda' WHEN 2 THEN 'Terca' WHEN 3 THEN 'Quarta'
          WHEN 4 THEN 'Quinta' WHEN 5 THEN 'Sexta' WHEN 6 THEN 'Sabado'
        END as dia_semana, AVG(faturamento_liquido) as faturamento_medio
        FROM eventos WHERE bar_id = p_bar_id AND EXTRACT(YEAR FROM data_evento) = 2025 AND faturamento_liquido IS NOT NULL
        GROUP BY EXTRACT(DOW FROM data_evento)
      ) sub
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
