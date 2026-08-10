-- =============================================================================
-- Alerta interno do Zykor: Discord no banco + WhatsApp pela rota Next
-- Aplicado em produção em 10/08/2026, logo após 20260810_contahub_watchdog_buracos.sql
-- =============================================================================
--
-- POR QUE O WHATSAPP NÃO SAI DAQUI. Ao validar o alerta do vigia, o WhatsApp não chegou
-- — apesar de o briefing diário chegar todo dia no mesmo número, com o mesmo template
-- (`zykor_alerta`, akvdZtIp0v4fiRGQ) e o mesmo canal (+5561998584761).
--
-- A diferença é o TOKEN:
--   FUNCIONA      process.env.UMBLER_API_TOKEN (Vercel) — usado por whatsapp-send.ts
--   FALHA CALADO  integrations.umbler_account.id=1 — GET /api/v1/members/me/ com esse
--                 token devolve o membro Diogo Lombardi com `allowedTemplates: false`.
--                 Sem permissão de template: a API aceita (HTTP 200, messageState
--                 'Processing') e a mensagem morre depois em 'Failed'.
--
-- ⚠️ HTTP 200 na Umbler NÃO é prova de entrega. Para saber se chegou:
--    GET /api/v1/messages/{id}/?organizationId=... e olhar `messageState`.
--
-- Por isso o alerta do vigia migrou para /api/cron/contahub-watchdog (cron da Vercel),
-- que usa dispatchNotification — o caminho comprovado. `enviar_whatsapp_alerta` fica
-- aqui como utilitário: só volta a servir se um dia gravarmos em umbler_account um token
-- de membro com allowedTemplates=true.
--
-- O Discord (canal alertas_criticos) entrega direto do banco (webhook_status 204) e vale
-- como rede de segurança.
-- =============================================================================

create or replace function public.enviar_alerta_zykor(
  p_titulo  text,
  p_detalhe text,
  p_emails  text[] default array['rodrigo@grupomenosemais.com.br','pedrogonzaapsm@gmail.com']
) returns jsonb
language plpgsql
security definer
set search_path = public, net, extensions
as $$
declare
  v_wpp integer := 0;
  v_dc  boolean := false;
begin
  -- WhatsApp: best-effort. HOJE não entrega a partir do banco (ver cabeçalho).
  begin
    v_wpp := public.enviar_whatsapp_alerta(p_titulo, p_detalhe, p_emails);
  exception when others then
    raise warning '[alerta_zykor] whatsapp falhou: %', sqlerrm;
  end;

  -- Discord (canal alertas_criticos) — entrega confirmada (webhook_status 204)
  begin
    perform net.http_post(
      url     := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/discord-dispatcher',
      headers := jsonb_build_object('Content-Type','application/json',
                                    'Authorization','Bearer ' || public.get_service_role_key()),
      body    := jsonb_build_object('action','notification', 'canal','alertas_criticos',
                                    'title', p_titulo, 'custom_message', p_detalhe),
      timeout_milliseconds := 20000);
    v_dc := true;
  exception when others then
    raise warning '[alerta_zykor] discord falhou: %', sqlerrm;
  end;

  -- ATENÇÃO: whatsapp_tentados conta TENTATIVAS, não entregas.
  return jsonb_build_object('whatsapp_tentados', v_wpp, 'discord', v_dc);
end;
$$;

comment on function public.enviar_alerta_zykor(text, text, text[]) is
  'Alerta interno por Discord (confiavel) + WhatsApp (best-effort; do banco NAO entrega - token sem allowedTemplates). Quem avisa por WhatsApp e a rota /api/cron/contahub-watchdog.';


-- Buracos pendentes expostos ao PostgREST (o schema `system` não vai ao PostgREST),
-- para a rota Next montar e disparar o alerta.
create or replace function public.contahub_watchdog_pendentes()
returns table (bar_id integer, bar_nome text, dia date, tentativas integer)
language sql
security definer
set search_path = public, system, operations
as $$
  select b.bar_id, b2.nome::text, b.dia, b.tentativas
    from system.contahub_watchdog_buracos b
    join operations.bares b2 on b2.id = b.bar_id
   where b.tipo = 'ingestao'
     and b.resolvido_em is null
     and b.alertado_em is null
     and b.tentativas >= 2
   order by b.bar_id, b.dia;
$$;

create or replace function public.contahub_watchdog_marcar_alertado()
returns integer
language plpgsql
security definer
set search_path = public, system
as $$
declare v_n integer;
begin
  update system.contahub_watchdog_buracos
     set alertado_em = now()
   where tipo = 'ingestao' and resolvido_em is null
     and alertado_em is null and tentativas >= 2;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- O cron do banco continua detectando, dando retry e curando a cadeia, mas NÃO alerta:
-- quem alerta é /api/cron/contahub-watchdog (agendada em frontend/vercel.json).
select cron.alter_job(611,
  command => 'SET statement_timeout = ''10min''; SELECT public.contahub_watchdog(10, false);');
