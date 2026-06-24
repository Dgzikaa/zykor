-- Botão "Atualizar" da Orçamentação passa a reprocessar o ANO exibido (silver+gold),
-- não só os últimos 6 meses do cron diário — cobre alterações antigas do Conta Azul
-- quando o sócio precisar. Wrapper público sobre gold.fn_refresh_orcamento_periodo.
CREATE OR REPLACE FUNCTION public.refresh_orcamentacao_ano(p_bar_id integer, p_ano integer)
 RETURNS jsonb
 LANGUAGE sql SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT gold.fn_refresh_orcamento_periodo(
    p_bar_id,
    pg_catalog.make_date(p_ano, 1, 1),
    pg_catalog.make_date(p_ano, 12, 31)
  );
$function$;

grant execute on function public.refresh_orcamentacao_ano(integer,integer) to authenticated, service_role;
