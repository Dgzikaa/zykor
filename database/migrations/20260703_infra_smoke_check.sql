-- Smoke-check de INFRA (existência/config), não de dados: pega o furo silencioso do tipo
-- "bucket/tabela não existe", "schema não exposto no PostgREST", "cron morto".
-- Exposta na tela Configurações → Saúde dos Dados → aba Infra (via /api/saude-dados/smoke).
-- Aplicada via MCP em 2026-07-03.
create or replace function system.fn_infra_smoke_check()
returns jsonb
language plpgsql
security definer
set search_path = system, public
as $$
declare
  res jsonb := '[]'::jsonb;
  r record;
  ok boolean;
  db_schemas text;
  cron_total int := 0;
  cron_falhando int := 0;
  cron_nomes text := '';
begin
  for r in select unnest(array['uploads','rh-documentos']) as nome loop
    ok := exists(select 1 from storage.buckets where name = r.nome);
    res := res || jsonb_build_array(jsonb_build_object(
      'grupo','Storage', 'titulo', 'Bucket: '||r.nome,
      'status', case when ok then 'ok' else 'falha' end,
      'detalhe', case when ok then 'existe' else 'NÃO existe — uploads quebram' end));
  end loop;

  for r in select * from (values
      ('public','checklist_anexos','metadados de uploads'),
      ('system','user_token_cutoff','corte de sessão por usuário'),
      ('system','auth_policy','corte de sessão global'),
      ('operations','bares','cadastro de bares'),
      ('operations','eventos_base','eventos/agenda'),
      ('gold','desempenho','KPIs (home/desempenho)'),
      ('public','usuarios','usuários')
    ) as t(sch, tbl, desc_) loop
    ok := exists(select 1 from information_schema.tables where table_schema=r.sch and table_name=r.tbl);
    res := res || jsonb_build_array(jsonb_build_object(
      'grupo','Tabelas', 'titulo', r.sch||'.'||r.tbl,
      'status', case when ok then 'ok' else 'falha' end,
      'detalhe', case when ok then r.desc_ else 'NÃO existe ('||r.desc_||')' end));
  end loop;

  select array_to_string(rolconfig, ' ') into db_schemas from pg_roles where rolname='authenticator';
  for r in select unnest(array['gold','operations','system','financial','auth_custom']) as sch loop
    ok := coalesce(db_schemas,'') like '%'||r.sch||'%';
    res := res || jsonb_build_array(jsonb_build_object(
      'grupo','PostgREST', 'titulo', 'Schema exposto: '||r.sch,
      'status', case when ok then 'ok' else 'falha' end,
      'detalhe', case when ok then 'exposto' else 'NÃO exposto — REST 404/406' end));
  end loop;

  begin
    select count(*) into cron_total from cron.job where active;
    with ultimo as (
      select jobid, status, row_number() over (partition by jobid order by start_time desc) rn
      from cron.job_run_details
    )
    select count(*), coalesce(string_agg(j.jobname, ', '), '')
      into cron_falhando, cron_nomes
    from ultimo u join cron.job j on j.jobid = u.jobid
    where u.rn = 1 and u.status = 'failed' and j.active;
  exception when others then
    cron_total := -1;
  end;
  res := res || jsonb_build_array(jsonb_build_object(
    'grupo','Crons',
    'titulo', 'pg_cron ('||greatest(cron_total,0)||' ativos)',
    'status', case when cron_total < 0 then 'alerta' when cron_falhando > 0 then 'alerta' else 'ok' end,
    'detalhe', case
      when cron_total < 0 then 'não consegui ler cron.job'
      when cron_falhando > 0 then cron_falhando||' com última falha: '||cron_nomes
      else 'todos com última execução ok' end));

  return res;
end;
$$;

grant execute on function system.fn_infra_smoke_check() to service_role;
