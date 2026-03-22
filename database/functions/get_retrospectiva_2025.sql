CREATE OR REPLACE FUNCTION public.get_retrospectiva_2025(p_bar_id integer DEFAULT 3)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'financeiro', json_build_object(
      'faturamentoTotal', COALESCE(SUM(ds.faturamento_total), 0),
      'ticketMedio', COALESCE(AVG(ds.ticket_medio), 0),
      'totalClientes', COALESCE((
        SELECT COUNT(DISTINCT cliente_nome)
        FROM visitas
        WHERE bar_id = p_bar_id AND EXTRACT(YEAR FROM data_visita) = 2025
      ), 0),
      'cmvMedio', COALESCE(AVG(ds.cmv_limpo), 0),
      'cmoMedio', COALESCE(AVG(ds.cmo), 0),
      'artisticaMedio', COALESCE(AVG(ds.custo_atracao_faturamento), 0)
    ),
    'operacional', json_build_object(
      'totalSemanas', COUNT(DISTINCT ds.id),
      'totalEventos', COALESCE((
        SELECT COUNT(*)
        FROM eventos
        WHERE bar_id = p_bar_id AND EXTRACT(YEAR FROM data_evento) = 2025
      ), 0),
      'totalIngressos', COALESCE((
        SELECT SUM(COALESCE(sympla_checkins, 0) + COALESCE(yuzer_ingressos, 0))
        FROM eventos
        WHERE bar_id = p_bar_id AND EXTRACT(YEAR FROM data_evento) = 2025
      ), 0)
    ),
    'pessoasCultura', json_build_object(
      'npsMedia', COALESCE((SELECT AVG(nps_geral) FROM nps WHERE bar_id = p_bar_id AND EXTRACT(YEAR FROM data_pesquisa) = 2025), 0),
      'felicidadeMedia', COALESCE((SELECT AVG(media_geral) FROM pesquisa_felicidade WHERE bar_id = p_bar_id AND EXTRACT(YEAR FROM data_pesquisa) = 2025), 0),
      'totalRespostasNPS', COALESCE((SELECT COUNT(*) FROM nps WHERE bar_id = p_bar_id AND EXTRACT(YEAR FROM data_pesquisa) = 2025), 0),
      'totalRespostasFelicidade', COALESCE((SELECT COUNT(*) FROM pesquisa_felicidade WHERE bar_id = p_bar_id AND EXTRACT(YEAR FROM data_pesquisa) = 2025), 0)
    ),
    'marketing', json_build_object(
      'crescimentoInstagram', 0,
      'seguidoresInicio', 0,
      'seguidoresFinal', 0
    ),
    '_meta', json_build_object(
      'barId', p_bar_id,
      'ano', 2025,
      'geradoEm', NOW()
    )
  ) INTO v_result
  FROM desempenho_semanal ds
  WHERE ds.bar_id = p_bar_id
    AND EXTRACT(YEAR FROM ds.data_inicio) = 2025;

  RETURN v_result;
END;
$function$;
