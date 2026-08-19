-- =============================================================================
-- Lentidão do Zykor — 19/08/2026
--
-- Queixa do Gonza: "to sentindo o Zykor bem mais devagar hoje. Pra incluir insumo,
-- fazer alteração de FT, parece que tá ficando mais pesado".
--
-- MEDIDO (não é impressão): leitura de disco por dia, de system.supabase_metrics_historico —
--   14/08: 12,9M blocos · 15/08: 13,5M · 16/08: 13,3M · 17/08: 16,3M · 18/08: 18,0M
--   19/08: 18,1M (dia ainda aberto) → ~140 GB/dia lidos do disco numa base de 4,3 GB.
--
-- CAUSA: bronze.bronze_contahub_avendas_porproduto_analitico (242 MB, 1,15M linhas) levou
-- 1.652 varreduras completas em 8 dias = ~391 GB, com 69% das leituras vindo do disco. Quem
-- varre são 5 matviews que cobrem o HISTÓRICO INTEIRO e eram refeitas do zero a cada 10 min
-- (cmv-depara-refresh) + de hora em hora (silver-vendas-produto-dia) — ~168 execuções/dia.
-- Cada varredura despeja o cache do Postgres, então as consultas das telas iam pro disco.
--
-- E os dados de venda entram no bronze UMA VEZ POR DIA (conferido: 17/08 11h, 18/08 7h,
-- 19/08 7h). ~167 das 168 execuções refaziam exatamente o mesmo resultado.
--
-- Custo medido de um refresh completo (cache quente): vendas_produto_dia 7,5s +
-- vendas_consolidada_dia 8,5s + consumo_teorico_insumo_dia 2,8s + consumo_producao_dia 1,0s +
-- cmv_teorico_dia 0,7s = 20s. Com cache frio, nos crons, dava 20 a 44s.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) cmv-depara-refresh: desativado.
--
-- silver.fn_refresh_vendas_depara() refresca 3 matviews que são SUBCONJUNTO das 5 que
-- silver.fn_refresh_consumo_teorico() já refresca de hora em hora. Rodava a cada 10 minutos
-- fazendo trabalho 100% duplicado. Job mantido inativo com o schedule preservado.
-- -----------------------------------------------------------------------------
select cron.alter_job(612, schedule => '22 * * * *');
select cron.alter_job(612, active => false);

-- -----------------------------------------------------------------------------
-- 2) Refresh do consumo teórico só quando a fonte muda.
--
-- Guarda uma assinatura das tabelas-FONTE (contadores de escrita do pg_stat_user_tables) e
-- pula o refresh quando nada mudou. Rede de segurança: refresca de qualquer jeito se o último
-- refresh de verdade foi há mais de 12h, pra nenhuma fonte esquecida deixar matview velha.
--
-- Testado em produção: 1ª chamada "refrescou em 18961 ms"; 2ª e 3ª "pulou: nenhuma fonte
-- mudou"; forçada "refrescou em 17986 ms"; e após tocar uma fonte (update desfeito por
-- rollback, que mantém o contador) voltou a "refrescou em 18455 ms".
--
-- NÃO converti as matviews em tabelas incrementais (a ideia inicial): a cadeia é linear
-- (analitico -> vendas_produto_dia -> vendas_consolidada_dia -> as 3 folhas), então converter
-- a base obriga a derrubar e recriar as 4 de cima — e com a fonte mudando 1x/dia o ganho não
-- paga esse risco. Se um dia a carga diária sozinha ficar lenta, aí vale.
-- -----------------------------------------------------------------------------
create table if not exists silver.refresh_marcador (
  chave text primary key,
  assinatura text not null,
  ultimo_refresh_em timestamptz not null default now(),
  refreshes bigint not null default 0,
  pulos bigint not null default 0
);
comment on table silver.refresh_marcador is
  'Assinatura das tabelas-fonte por rotina de refresh, pra pular refresh que nao mudaria nada. Ver silver.fn_refresh_consumo_teorico.';

create or replace function silver.fn_assinatura_fontes_consumo_teorico()
 returns text language sql stable security definer set search_path to 'pg_catalog','public'
as $function$
  select coalesce(string_agg(schemaname||'.'||relname||':'||(n_tup_ins+n_tup_upd+n_tup_del)::text,
                             '|' order by schemaname, relname), '')
  from pg_stat_user_tables
  where (schemaname='bronze'     and relname = 'bronze_contahub_avendas_porproduto_analitico')
     or (schemaname='public'     and relname in ('produto_contahub_map','produto_yuzer_map',
                                                 'producao_ficha_item','producao_base','produto_cardapio'))
     or (schemaname='operations' and relname in ('eventos_base','insumos'))
     or (schemaname='silver'     and relname = 'yuzer_produtos_evento');
$function$;

drop function if exists silver.fn_refresh_consumo_teorico();

create or replace function silver.fn_refresh_consumo_teorico(p_forcar boolean default false)
 returns text
 language plpgsql
 security definer
 set search_path to 'silver', 'public', 'operations', 'bronze', 'gold'
as $function$
declare
  v_assin  text := silver.fn_assinatura_fontes_consumo_teorico();
  v_ant    text;
  v_ultimo timestamptz;
  v_t      timestamptz := clock_timestamp();
begin
  select assinatura, ultimo_refresh_em into v_ant, v_ultimo
  from silver.refresh_marcador where chave = 'consumo_teorico';

  if not p_forcar
     and v_ant is not distinct from v_assin
     and v_ultimo > now() - interval '12 hours' then
    update silver.refresh_marcador set pulos = pulos + 1 where chave = 'consumo_teorico';
    return 'pulou: nenhuma fonte mudou';
  end if;

  refresh materialized view concurrently silver.vendas_produto_dia;
  refresh materialized view concurrently silver.vendas_consolidada_dia;
  refresh materialized view concurrently silver.consumo_teorico_insumo_dia;
  refresh materialized view concurrently silver.consumo_producao_dia;
  refresh materialized view concurrently gold.cmv_teorico_dia;

  -- reconsulta a assinatura DEPOIS do refresh: assim uma carga que entre durante o refresh
  -- nao e dada como ja processada.
  insert into silver.refresh_marcador (chave, assinatura, ultimo_refresh_em, refreshes)
  values ('consumo_teorico', silver.fn_assinatura_fontes_consumo_teorico(), now(), 1)
  on conflict (chave) do update
    set assinatura = excluded.assinatura,
        ultimo_refresh_em = excluded.ultimo_refresh_em,
        refreshes = silver.refresh_marcador.refreshes + 1;

  return 'refrescou em ' || round(extract(epoch from (clock_timestamp() - v_t))*1000)::text || ' ms';
end;
$function$;

grant execute on function silver.fn_refresh_consumo_teorico(boolean) to service_role;
grant execute on function silver.fn_assinatura_fontes_consumo_teorico() to service_role;

-- -----------------------------------------------------------------------------
-- 3) ContaAzul full-ano: parava o agendador inteiro, 2x por dia.
--
-- public.sync_contaazul_alteracao_full_ano() usava a extensão `http` — SÍNCRONA e bloqueante —
-- com CURLOPT_TIMEOUT_MS = 400000, num loop sobre os 5 bares com credencial. O worker do
-- pg_cron ficava PARADO esperando resposta HTTP. Com max_worker_processes = 6, isso estourava
-- o orçamento de workers e o pg_cron parava de despachar TUDO:
--   07:45:00 -> 07:50:10  e  19:45:00 -> 19:50:09
-- Nenhum cron rodou nesses intervalos e cinco dispararam juntos no segundo em que liberou
-- (capturar-metricas-db, de minuto em minuto, perdeu quatro execuções seguidas).
--
-- Agora net.http_post (assíncrono, o padrão de todos os outros crons). Medido: 5 ms de
-- resposta contra os 5 minutos de antes. O retorno da chamada antiga só alimentava
-- RAISE NOTICE/WARNING — nada dependia dele.
--
-- Um bar por chamada, agendados com defasagem, pra manter a série que existia (o loop era
-- sequencial; net.http_post dentro do loop dispararia os 5 juntos).
--
-- ACHADO DE QUEBRA: nos logs do edge function, o job antigo de 19:45 mostrou dois 504
-- "IDLE_TIMEOUT (150s)" e três 200 de 2-3s — 150+150+8 = os 308s exatos. DOIS dos cinco bares
-- nunca completavam o full-ano, todo dia, e o erro morria num RAISE WARNING. Agora fica em
-- net._http_response e dá pra monitorar.
-- -----------------------------------------------------------------------------
create or replace function public.sync_contaazul_full_ano_bar(p_bar_id integer)
 returns bigint
 language plpgsql
 set search_path to 'public', 'extensions'
as $function$
declare v_req bigint;
begin
  if not exists (
    select 1 from public.api_credentials
    where sistema = 'conta_azul' and bar_id = p_bar_id and access_token is not null
  ) then
    raise notice 'CA full_ano: bar % sem credencial ativa, nada a fazer', p_bar_id;
    return null;
  end if;

  select net.http_post(
    url := get_supabase_url() || '/functions/v1/contaazul-sync',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || get_service_role_key(),
      'Content-Type', 'application/json'),
    body := jsonb_build_object('bar_id', p_bar_id, 'sync_mode', 'alteracao_full_ano'),
    timeout_milliseconds := 400000
  ) into v_req;

  return v_req;
end;
$function$;

-- horários em UTC: 7,19 UTC = 04:45 e 16:45 BRT, fora do horário de operação
select cron.unschedule(529);
select cron.schedule('contaazul-full-ano-bar3', '45 7,19 * * *', $$select public.sync_contaazul_full_ano_bar(3)$$);
select cron.schedule('contaazul-full-ano-bar4', '51 7,19 * * *', $$select public.sync_contaazul_full_ano_bar(4)$$);
select cron.schedule('contaazul-full-ano-bar5', '57 7,19 * * *', $$select public.sync_contaazul_full_ano_bar(5)$$);
select cron.schedule('contaazul-full-ano-bar6', '3 8,20 * * *',  $$select public.sync_contaazul_full_ano_bar(6)$$);
select cron.schedule('contaazul-full-ano-bar7', '9 8,20 * * *',  $$select public.sync_contaazul_full_ano_bar(7)$$);
