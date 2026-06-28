-- Sessão de planejamento separada por área (Cozinha × Bar): iniciar/encerrar de
-- uma área não mexe na outra. Aplicada em prod via MCP em 2026-06-28
-- (migration plano_producao_sessao_por_area). Antes era 1 sessão por (bar, semana).
alter table operations.producao_plano add column if not exists area text not null default 'Cozinha';

alter table operations.producao_plano drop constraint if exists producao_plano_bar_id_semana_ini_key;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'producao_plano_bar_semana_area_key') then
    alter table operations.producao_plano add constraint producao_plano_bar_semana_area_key unique (bar_id, semana_ini, area);
  end if;
end $$;

notify pgrst, 'reload schema';
