-- Função: calcular_visao_geral_anual
CREATE OR REPLACE FUNCTION public.calcular_visao_geral_anual(p_bar_id integer, p_ano integer)
 RETURNS TABLE(faturamento_contahub numeric, faturamento_yuzer numeric, faturamento_sympla numeric, faturamento_total numeric, pessoas_contahub numeric, pessoas_yuzer numeric, pessoas_sympla numeric, pessoas_total numeric, reputacao_media numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$ BEGIN RETURN QUERY SELECT v.faturamento_contahub, v.faturamento_yuzer, v.faturamento_sympla, v.faturamento_total, v.pessoas_contahub, v.pessoas_yuzer, v.pessoas_sympla, v.pessoas_total, v.reputacao_media FROM public.view_visao_geral_anual v WHERE v.bar_id = p_bar_id AND v.ano = p_ano; END; $$;
