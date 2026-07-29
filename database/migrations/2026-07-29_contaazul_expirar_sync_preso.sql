-- 2026-07-29 — Logs de sync do Conta Azul presos em 'iniciado'
--
-- Sintoma: a tela /configuracoes/administracao/integracoes/conta-azul mostrava
-- "Último sync: 31/12/1969, 21:00 — 0 registros - iniciado". A data era `new Date(null)`
-- (epoch em GMT-3) porque a rota pegava o log mais recente por data_inicio e exibia data_fim,
-- que fica NULL quando o log nunca é fechado.
--
-- Causa: a edge function contaazul-sync fecha o log no sucesso E no catch, mas quando o processo
-- é MORTO por timeout da plataforma nenhum dos dois roda — o log fica 'iniciado' pra sempre.
-- Nenhum `finally` resolve isso (o runtime não devolve o controle). Por isso a correção é
-- externa: um job que expira o que ficou órfão.
--
-- Escala do problema em 29/07/2026: 712 logs presos, o mais antigo de 04/04. Os `alteracao_full_ano`
-- eram quase metade (87 de 182) — é o modo mais pesado, o que reforça o diagnóstico de timeout.

CREATE OR REPLACE FUNCTION integrations.fn_expirar_syncs_presos(p_minutos integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'integrations', 'public'
AS $function$
DECLARE
  v_afetados integer;
BEGIN
  -- 30 min de folga é deliberadamente generoso: a edge function tem maxDuration de 300s (5 min)
  -- e o cron do orquestrador usa timeout de 380s. Nada legítimo passa de 30 min, então não há
  -- risco de expirar execução que ainda está viva.
  UPDATE integrations.contaazul_logs_sincronizacao
     SET status = 'timeout',
         data_fim = now(),
         duracao_segundos = EXTRACT(EPOCH FROM (now() - data_inicio))::integer,
         mensagem_erro = COALESCE(
           mensagem_erro,
           'Log expirado automaticamente: iniciou e nunca registrou conclusão (processo provavelmente morto por timeout).'
         )
   WHERE status = 'iniciado'
     AND data_inicio < now() - make_interval(mins => p_minutos);

  GET DIAGNOSTICS v_afetados = ROW_COUNT;
  RETURN v_afetados;
END;
$function$;

COMMENT ON FUNCTION integrations.fn_expirar_syncs_presos(integer) IS
  'Fecha logs de sync do Conta Azul que ficaram em ''iniciado'' (processo morto por timeout). '
  'Sem isso o "último sync" da tela cai num log sem data_fim e vira 31/12/1969.';

REVOKE ALL ON FUNCTION integrations.fn_expirar_syncs_presos(integer) FROM anon, authenticated;

-- Limpeza do passivo acumulado (712 logs em 29/07/2026).
SELECT integrations.fn_expirar_syncs_presos(30);

-- A cada 15 min: um log preso fica no máximo ~45 min sem ser fechado.
SELECT cron.schedule(
  'contaazul-expirar-sync-preso',
  '*/15 * * * *',
  $$SELECT integrations.fn_expirar_syncs_presos(30);$$
);
