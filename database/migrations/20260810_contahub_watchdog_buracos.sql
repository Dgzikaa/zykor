-- =============================================================================
-- Vigia de buracos do ContaHub + alerta WhatsApp
-- Aplicado em produção em 10/08/2026.
-- =============================================================================
--
-- MOTIVAÇÃO. A terça 04/08/2026 do Deboche apareceu zerada nas telas por 5 dias.
-- O que aconteceu, em ordem:
--   1. 05/08 07:00 — o ContaHub devolveu VAZIO para o bar 4 no dia 04/08
--      ("Dia pode não ter fechado ainda"). Falhou 3x (07:00, 07:00:53, 14:00),
--      status 'parcial' em system.sync_logs_contahub. O bar 3 do mesmo dia veio 100%.
--   2. Ninguém tentou de novo — o cron diário só busca D-1 — e nenhum alerta disparou.
--   3. 10/08 — o resync semanal finalmente trouxe o bronze (R$ 1.518,79 / 31 clientes).
--   4. Tarde demais: o ETL silver rodava com janela de 3 DIAS, então o dia 04 já
--      estava fora. silver.vendas_diarias nunca ganhou a linha -> gold.planejamento
--      gravou 0,00 (ele lê do silver, não de operations.eventos) -> gold.desempenho
--      perdeu a terça inteira da semana S32.
--
-- O QUE ESTA MIGRATION FAZ:
--   a) public.enviar_whatsapp_alerta(...) — alerta WhatsApp direto do banco, via
--      Umbler (template `zykor_alerta`), para uso de crons/watchdogs.
--   b) system.contahub_watchdog_buracos — registro dos dias furados, com dedupe.
--   c) public.contahub_watchdog(...) — detecta, tenta consertar e só então alerta.
--   d) janela do ETL silver 3 -> 8 dias (o backfill semanal passa a ser absorvido).
--   e) cron do vigia 2x/dia.
--
-- Ver também: docs/regras-negocio.md e a memória
-- feedback_contahub_dia_vazio_orfao_janela_silver.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- (a) Alerta WhatsApp a partir do banco
-- -----------------------------------------------------------------------------
-- Espelha frontend/src/lib/notifications/whatsapp-send.ts: template `zykor_alerta`
-- ({{1}}=titulo, {{2}}=detalhe) no endpoint /template-messages/simplified/, que é
-- business-initiated (não depende da janela de 24h do WhatsApp).
-- Destinatários por EMAIL (auth_custom.usuarios) — sem telefone hardcoded.
-- Best-effort: nunca levanta exceção, para não derrubar o cron que a chamou.
create or replace function public.enviar_whatsapp_alerta(
  p_titulo   text,
  p_detalhe  text,
  p_emails   text[]
) returns integer
language plpgsql
security definer
set search_path = public, auth_custom, integrations, net, extensions
as $$
declare
  v_token   text;
  v_org     text;
  v_from    text := '5561998584761';       -- canal "Zykor Notificações"
  v_tpl     text := 'akvdZtIp0v4fiRGQ';    -- template zykor_alerta
  v_tel     text;
  v_rec     record;
  v_enviados integer := 0;
  -- Meta rejeita quebra de linha / >4 espaços dentro de variável de template
  v_t text := left(regexp_replace(coalesce(p_titulo,''), '\s+', ' ', 'g'), 900);
  v_d text := left(regexp_replace(coalesce(p_detalhe,''), '\s+', ' ', 'g'), 900);
begin
  select api_token, organization_id into v_token, v_org
  from integrations.umbler_account where id = 1;

  if v_token is null or v_org is null then
    raise warning '[whatsapp_alerta] credenciais Umbler ausentes';
    return 0;
  end if;

  for v_rec in
    select u.nome, u.telefone
    from auth_custom.usuarios u
    where u.ativo = true
      and lower(u.email) = any (select lower(x) from unnest(p_emails) x)
      and coalesce(u.telefone,'') <> ''
  loop
    -- normaliza pra E.164 sem "+": 10/11 dígitos ganham DDI 55
    v_tel := regexp_replace(v_rec.telefone, '\D', '', 'g');
    if length(v_tel) in (10, 11) then
      v_tel := '55' || v_tel;
    end if;
    if length(v_tel) not between 12 and 13 then
      raise warning '[whatsapp_alerta] telefone invalido para %: %', v_rec.nome, v_rec.telefone;
      continue;
    end if;

    begin
      perform net.http_post(
        url := 'https://app-utalk.umbler.com/api/v1/template-messages/simplified/',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_token),
        body := jsonb_build_object(
          'ToPhone', v_tel,
          'FromPhone', v_from,
          'OrganizationId', v_org,
          'TemplateId', v_tpl,
          'Params', jsonb_build_array(v_t, v_d)),
        timeout_milliseconds := 15000);
      v_enviados := v_enviados + 1;
    exception when others then
      raise warning '[whatsapp_alerta] falha ao enviar para %: %', v_rec.nome, sqlerrm;
    end;
  end loop;

  return v_enviados;
end;
$$;

comment on function public.enviar_whatsapp_alerta(text, text, text[]) is
  'Alerta WhatsApp via Umbler (template zykor_alerta) para os usuários cujos emails forem passados. Best-effort.';


-- -----------------------------------------------------------------------------
-- (b) Registro dos buracos
-- -----------------------------------------------------------------------------
create table if not exists system.contahub_watchdog_buracos (
  bar_id            integer     not null,
  dia               date        not null,
  tipo              text        not null check (tipo in ('ingestao','cadeia')),
  primeira_deteccao timestamptz not null default now(),
  tentativas        integer     not null default 0,
  ultima_tentativa  timestamptz,
  alertado_em       timestamptz,
  resolvido_em      timestamptz,
  detalhe           jsonb,
  primary key (bar_id, dia, tipo)
);

comment on table system.contahub_watchdog_buracos is
  'Dias em que o ContaHub ficou sem dado (ingestao) ou em que a cadeia silver/gold nao consolidou (cadeia). Alimentada por public.contahub_watchdog().';

create index if not exists ix_watchdog_buracos_abertos
  on system.contahub_watchdog_buracos (bar_id, dia) where resolvido_em is null;


-- -----------------------------------------------------------------------------
-- (c) O vigia
-- -----------------------------------------------------------------------------
-- Duas checagens:
--   INGESTÃO — a Stone tem venda no dia mas o ContaHub não tem pagamento nenhum.
--              A Stone é fonte independente: se ela viu venda, o bar operou.
--              Ação: retry do sync. Se persistir entre execuções, alerta WhatsApp.
--   CADEIA   — o bronze tem pagamento mas silver.vendas_diarias não tem a linha.
--              Ação: reprocessa silver -> planejamento -> desempenho (auto-cura).
--
-- Dia em que o bar não opera NÃO gera falso positivo: sem operação a Stone não tem
-- linha nenhuma (conferido nas segundas-feiras do Deboche).
create or replace function public.contahub_watchdog(
  p_dias    integer default 10,
  p_alertar boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = public, system, bronze, silver, operations, net, extensions
as $$
declare
  v_ini date := current_date - p_dias;
  v_fim date := current_date - 1;   -- o dia de hoje ainda não fechou
  v_url text := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-sync-automatico';
  v_key text;
  r record;
  v_ingestao   integer := 0;
  v_retries    integer := 0;
  v_cadeia     integer := 0;
  v_consertou  boolean := false;
  v_resolvidos integer := 0;
  v_msg        text := '';
  v_alertas    integer := 0;
  v_emails     text[] := array['rodrigo@grupomenosemais.com.br','pedrogonzaapsm@gmail.com'];
begin
  ---------------------------------------------------------------------------
  -- 0. Fecha buracos que já se resolveram (sozinhos ou pelo retry anterior)
  ---------------------------------------------------------------------------
  update system.contahub_watchdog_buracos b
     set resolvido_em = now()
   where b.resolvido_em is null
     and (
       (b.tipo = 'ingestao' and exists (
          select 1 from bronze.bronze_contahub_financeiro_pagamentosrecebidos p
           where p.bar_id = b.bar_id and p.dt_gerencial = b.dia))
       or
       (b.tipo = 'cadeia' and exists (
          select 1 from silver.vendas_diarias v
           where v.bar_id = b.bar_id and v.dt_gerencial = b.dia))
     );
  get diagnostics v_resolvidos = row_count;

  ---------------------------------------------------------------------------
  -- 1. INGESTÃO: Stone viu venda, ContaHub não trouxe nada
  ---------------------------------------------------------------------------
  for r in
    with operou as (
      select s.bar_id, s.dt_gerencial as dia, count(*) as trans
        from silver.stone_transacoes s
       where s.dt_gerencial between v_ini and v_fim
       group by 1, 2
      having count(*) >= 5          -- corta ruído de transação avulsa
    )
    select o.bar_id, o.dia, o.trans
      from operou o
     where not exists (
       select 1 from bronze.bronze_contahub_financeiro_pagamentosrecebidos p
        where p.bar_id = o.bar_id and p.dt_gerencial = o.dia)
     order by o.bar_id, o.dia
  loop
    v_ingestao := v_ingestao + 1;

    insert into system.contahub_watchdog_buracos (bar_id, dia, tipo, tentativas, ultima_tentativa, detalhe)
    values (r.bar_id, r.dia, 'ingestao', 1, now(), jsonb_build_object('stone_transacoes', r.trans))
    on conflict (bar_id, dia, tipo) do update
      set tentativas       = system.contahub_watchdog_buracos.tentativas + 1,
          ultima_tentativa = now(),
          resolvido_em     = null,
          detalhe          = jsonb_build_object('stone_transacoes', r.trans);

    -- retry do sync (assíncrono; o resultado aparece na próxima execução)
    begin
      select public.get_service_role_key() into v_key;
      perform net.http_post(
        url     := v_url,
        headers := jsonb_build_object('Content-Type','application/json',
                                      'Authorization','Bearer ' || v_key),
        body    := jsonb_build_object('bar_id', r.bar_id, 'data_date', r.dia::text),
        timeout_milliseconds := 60000);
      v_retries := v_retries + 1;
    exception when others then
      raise warning '[contahub_watchdog] retry falhou bar % dia %: %', r.bar_id, r.dia, sqlerrm;
    end;
  end loop;

  ---------------------------------------------------------------------------
  -- 2. CADEIA: bronze tem pagamento, silver.vendas_diarias não tem a linha
  ---------------------------------------------------------------------------
  for r in
    select distinct p.bar_id, p.dt_gerencial as dia
      from bronze.bronze_contahub_financeiro_pagamentosrecebidos p
     where p.dt_gerencial between v_ini and v_fim
       and not exists (
         select 1 from silver.vendas_diarias v
          where v.bar_id = p.bar_id and v.dt_gerencial = p.dt_gerencial)
     order by 1, 2
  loop
    v_cadeia := v_cadeia + 1;

    insert into system.contahub_watchdog_buracos (bar_id, dia, tipo, tentativas, ultima_tentativa)
    values (r.bar_id, r.dia, 'cadeia', 1, now())
    on conflict (bar_id, dia, tipo) do update
      set tentativas       = system.contahub_watchdog_buracos.tentativas + 1,
          ultima_tentativa = now(),
          resolvido_em     = null;

    -- auto-cura: reprocessa o dia de baixo para cima
    begin
      perform public.etl_silver_vendas_diarias_intervalo(r.bar_id, r.dia, r.dia);
      perform public.etl_gold_planejamento_full(r.bar_id, r.dia, r.dia);
      v_consertou := true;
    exception when others then
      raise warning '[contahub_watchdog] auto-cura falhou bar % dia %: %', r.bar_id, r.dia, sqlerrm;
    end;
  end loop;

  if v_consertou then
    perform public.etl_gold_desempenho_all_bars(greatest(p_dias, 14));
  end if;

  ---------------------------------------------------------------------------
  -- 3. Alerta: só para buraco de ingestão que o retry NÃO resolveu
  --    (>= 2 tentativas), uma vez por buraco.
  ---------------------------------------------------------------------------
  if p_alertar then
    select string_agg(
             format('%s em %s', b2.nome, to_char(b.dia, 'DD/MM')),
             '; ' order by b.dia)
      into v_msg
      from system.contahub_watchdog_buracos b
      join operations.bares b2 on b2.id = b.bar_id
     where b.tipo = 'ingestao'
       and b.resolvido_em is null
       and b.alertado_em is null
       and b.tentativas >= 2;

    if v_msg is not null and v_msg <> '' then
      v_alertas := public.enviar_whatsapp_alerta(
        'ContaHub sem dados',
        format('O ContaHub nao entregou o faturamento de: %s. O retry automatico ja tentou %s vezes e nao resolveu - o dia esta zerado nas telas. Confira a integracao.',
               v_msg, 2),
        v_emails);

      update system.contahub_watchdog_buracos
         set alertado_em = now()
       where tipo = 'ingestao' and resolvido_em is null
         and alertado_em is null and tentativas >= 2;
    end if;
  end if;

  return jsonb_build_object(
    'janela',              format('%s a %s', v_ini, v_fim),
    'buracos_ingestao',    v_ingestao,
    'retries_disparados',  v_retries,
    'dias_cadeia_curados', v_cadeia,
    'buracos_resolvidos',  v_resolvidos,
    'alertas_whatsapp',    v_alertas);
end;
$$;

comment on function public.contahub_watchdog(integer, boolean) is
  'Vigia dos dados do ContaHub: detecta dia sem ingestao (cruzando com a Stone) e dispara retry; conserta sozinho o dia que ficou orfao na cadeia silver/gold; avisa Rodrigo e Gonza no WhatsApp quando o retry nao resolve.';


-- -----------------------------------------------------------------------------
-- (d) Janela do ETL silver: 3 -> 8 dias
-- -----------------------------------------------------------------------------
-- Com 3 dias, qualquer dia recuperado pelo resync semanal (que roda às segundas e
-- pode trazer D-6) ficava órfão para sempre. 8 dias cobre o resync e ainda dá folga
-- sobre a janela do gold_planejamento (CURRENT_DATE - 7). Custo medido: ~160ms
-- para todos os bares.
select cron.alter_job(445,
  command => 'SET statement_timeout = ''10min''; SELECT public.etl_silver_vendas_diarias_all_bars(8);');


-- -----------------------------------------------------------------------------
-- (e) Cron do vigia — 2x/dia, depois da cadeia diária
-- -----------------------------------------------------------------------------
-- 12:40 e 18:00 UTC = 09:40 e 15:00 BRT. A cadeia diária termina 09:00 BRT.
select cron.schedule('contahub-watchdog-buracos', '40 12,18 * * *',
  'SET statement_timeout = ''10min''; SELECT public.contahub_watchdog(10, true);');
