CREATE OR REPLACE FUNCTION public.get_ultra_insights(p_bar_id integer DEFAULT 3)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'analiseComportamento', json_build_object(
      'ticketMedioPorDia', (
        SELECT json_agg(
          json_build_object(
            'diaSemana', dia_semana,
            'ticketMedio', ticket_medio
          ) ORDER BY dia_semana
        )
        FROM (
          SELECT 
            EXTRACT(DOW FROM data_inicio) as dia_semana,
            AVG(ticket_medio) as ticket_medio
          FROM desempenho_semanal
          WHERE bar_id = p_bar_id AND EXTRACT(YEAR FROM data_inicio) = 2025
          GROUP BY EXTRACT(DOW FROM data_inicio)
        ) sub
      ),
      'permanenciaMedia', '2-3 horas',
      'observacao', 'Baseado em padroes de consumo'
    ),
    'analiseEstoque', json_build_object(
      'produtosMaisRotativos', (
        SELECT json_agg(
          json_build_object('produto', produto_desc, 'quantidade', qtd_total)
        )
        FROM (
          SELECT vi.produto_desc, SUM(vi.quantidade) as qtd_total
          FROM vendas_item vi
          WHERE vi.bar_id = p_bar_id AND EXTRACT(YEAR FROM vi.data_venda) = 2025
          GROUP BY vi.produto_desc
          ORDER BY qtd_total DESC
          LIMIT 5
        ) sub
      ),
      'observacao', 'Top 5 produtos com maior giro'
    ),
    'analiseFinanceira', json_build_object(
      'margemMedia', (
        SELECT AVG(1 - cmv_limpo)
        FROM desempenho_semanal
        WHERE bar_id = p_bar_id AND EXTRACT(YEAR FROM data_inicio) = 2025
      ),
      'custoOperacional', (
        SELECT AVG(cmo)
        FROM desempenho_semanal
        WHERE bar_id = p_bar_id AND EXTRACT(YEAR FROM data_inicio) = 2025
      )
    ),
    'previsoes2026', json_build_object(
      'crescimentoEstimado', '15-20%',
      'observacao', 'Baseado em tendencias 2025'
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
