-- Função: calculate_rolling_stddev
CREATE OR REPLACE FUNCTION public.calculate_rolling_stddev(p_bar_id integer, p_metric_name character varying, p_window_days integer DEFAULT 30) RETURNS numeric LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE result DECIMAL;
BEGIN
    SELECT STDDEV(valor) INTO result FROM ai_metrics WHERE bar_id = p_bar_id AND nome_metrica = p_metric_name AND data_referencia >= CURRENT_DATE - p_window_days;
    RETURN COALESCE(result, 0);
END;
$$;
