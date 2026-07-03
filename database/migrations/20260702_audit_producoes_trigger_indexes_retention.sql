-- Auditoria — 3 ajustes finais:
-- (1) Produções entram no trigger genérico (o caminho do header está confirmado ao vivo) e o
--     gancho app-level em /api/operacional/producoes/execucao é removido (evita duplo log).
-- (2) Índices pros filtros/ordenação do painel (ordena sempre por timestamp desc).
-- (3) Retenção: mantém 12 meses; limpeza mensal via pg_cron.

-- (1)
drop trigger if exists trg_audit on operations.producao_execucao;
create trigger trg_audit after insert or update or delete on operations.producao_execucao
  for each row execute function system.fn_audit();
drop trigger if exists trg_audit on operations.producao_execucao_insumo;
create trigger trg_audit after insert or update or delete on operations.producao_execucao_insumo
  for each row execute function system.fn_audit();

-- (2)
create index if not exists idx_audit_trail_timestamp on system.audit_trail (timestamp desc);
create index if not exists idx_audit_trail_table_ts on system.audit_trail (table_name, timestamp desc);
create index if not exists idx_audit_trail_user_ts on system.audit_trail (user_email, timestamp desc);

-- (3) 12 meses de retenção; ajustar o intervalo aqui se precisar.
select cron.schedule('audit_trail_retention', '0 4 1 * *',
  $$delete from system.audit_trail where timestamp < now() - interval '12 months'$$);
