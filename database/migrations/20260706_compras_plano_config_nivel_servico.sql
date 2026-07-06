-- Config por insumo do Planejamento de Compras: nível de serviço (z do Ponto de Ressuprimento),
-- espelhando operations.producao_plano_config (que é por produção). Sem config = 95% (default).
-- O FatorServiço (z) é aplicado no route (igual produção); a rota lê esta tabela e o POST
-- action:'config' grava. Aplicada em prod via MCP em 2026-07-06.
create table if not exists operations.compras_plano_config (
  bar_id integer not null,
  insumo_codigo text not null,
  nivel_servico integer not null default 95,
  atualizado_em timestamptz not null default now(),
  primary key (bar_id, insumo_codigo)
);
grant select, insert, update, delete on operations.compras_plano_config to authenticated, service_role;
