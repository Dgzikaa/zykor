-- Função: get_insights_oportunidades
CREATE OR REPLACE FUNCTION public.get_insights_oportunidades(p_bar_id integer DEFAULT 3) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_result JSON;
BEGIN
  SELECT json_build_object(
    'oportunidades', json_build_array(json_build_object('titulo', 'Otimizar horários de pico', 'descricao', 'Aumentar equipe nos horários de maior movimento', 'impacto', 'alto', 'esforco', 'medio'), json_build_object('titulo', 'Expandir categorias mais lucrativas', 'descricao', 'Investir em produtos com melhor margem', 'impacto', 'alto', 'esforco', 'baixo')),
    'acoes2026', json_build_array('Aumentar mix de produtos premium', 'Otimizar gestão de estoque', 'Melhorar experiência do cliente')
  ) INTO v_result;
  RETURN v_result;
END;
$$;
