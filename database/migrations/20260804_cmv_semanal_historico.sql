-- Histórico de alterações do CMV Semanal (pedido do Isaías, 04/08/2026):
-- "Será que não tem como ter um histórico igual nas planilhas? pra se acontecer isso a gente
--  conseguir ver o que mudou?"
--
-- Por que uma tabela nova e não a system.audit_trail: o trigger system.fn_audit só grava quando
-- a request traz o header x-audit-email (ação da TELA). O recálculo em massa (edge cmv-semanal-auto,
-- cron ou chamada na mão) não passa por lá — foi por isso que a reescrita das 52 semanas de
-- 04/08 11:30 não deixou rastro nenhum. Este trigger grava SEMPRE.

create table if not exists financial.cmv_semanal_historico (
  id           bigserial primary key,
  bar_id       integer not null,
  ano          integer not null,
  semana       integer not null,
  alterado_em  timestamptz not null default now(),
  origem       text    not null,          -- 'manual' (veio da tela) | 'automatico' (edge/cron/SQL)
  autor        text,                      -- e-mail de quem editou, quando veio da tela
  mudancas     jsonb   not null           -- { campo: { "de": x, "para": y } }
);

comment on table financial.cmv_semanal_historico is
  'Diff campo a campo de cada UPDATE em financial.cmv_semanal — inclusive recálculo automático.';

create index if not exists idx_cmv_sem_hist_semana
  on financial.cmv_semanal_historico (bar_id, ano, semana, alterado_em desc);
create index if not exists idx_cmv_sem_hist_data
  on financial.cmv_semanal_historico (alterado_em desc);

-- anon/authenticated NÃO leem (dado financeiro); a tela lê via rota com service role.
alter table financial.cmv_semanal_historico enable row level security;
revoke all on financial.cmv_semanal_historico from anon, authenticated;

create or replace function financial.fn_cmv_semanal_historico()
returns trigger
language plpgsql
security definer
set search_path to 'financial', 'public'
as $function$
declare
  v_old jsonb := to_jsonb(OLD);
  v_new jsonb := to_jsonb(NEW);
  v_diff jsonb := '{}'::jsonb;
  v_key text;
  -- chave e carimbo de tempo não são "mudança de número"
  v_ignorar text[] := array['id','created_at','updated_at','bar_id','ano','semana','data_inicio','data_fim'];
  v_headers text := current_setting('request.headers', true);
  v_email text;
begin
  for v_key in select jsonb_object_keys(v_new) loop
    if v_key = any(v_ignorar) then continue; end if;
    if v_old -> v_key is distinct from v_new -> v_key then
      -- diferença de centavo é ruído de arredondamento do recálculo: não vira linha de histórico
      if jsonb_typeof(v_new -> v_key) = 'number' and jsonb_typeof(v_old -> v_key) = 'number'
         and abs(coalesce((v_new ->> v_key)::numeric, 0) - coalesce((v_old ->> v_key)::numeric, 0)) < 0.01 then
        continue;
      end if;
      v_diff := v_diff || jsonb_build_object(v_key, jsonb_build_object('de', v_old -> v_key, 'para', v_new -> v_key));
    end if;
  end loop;

  if v_diff = '{}'::jsonb then return NEW; end if;

  if v_headers is not null then
    begin v_email := (v_headers::json ->> 'x-audit-email'); exception when others then v_email := null; end;
  end if;

  insert into financial.cmv_semanal_historico (bar_id, ano, semana, origem, autor, mudancas)
  values (NEW.bar_id, NEW.ano, NEW.semana,
          case when coalesce(v_email,'') <> '' then 'manual' else 'automatico' end,
          nullif(v_email,''), v_diff);

  return NEW;
exception when others then
  -- histórico NUNCA pode derrubar o recálculo do CMV
  return NEW;
end
$function$;

drop trigger if exists trg_cmv_semanal_historico on financial.cmv_semanal;
create trigger trg_cmv_semanal_historico
  after update on financial.cmv_semanal
  for each row execute function financial.fn_cmv_semanal_historico();
