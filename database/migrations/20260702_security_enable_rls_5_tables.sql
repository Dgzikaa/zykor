-- Advisor de segurança "RLS Disabled in Public": 5 tabelas que entraram depois do hardening de
-- jun/2026 ([[project_seguranca_anon_grants_hardening_2026_06]]) sem RLS. Deny-by-default (sem
-- policy → anon/authenticated não leem; o app usa service_role, que bypassa RLS). Confirmado que
-- só rotas de API server-side (service_role) tocam essas tabelas.
alter table operations.artista_ca_pessoa      enable row level security;
alter table operations.evento_artistas        enable row level security;
alter table operations.artista_dup_ignorar    enable row level security;
alter table operations.ca_atracao_override    enable row level security;
alter table financial.stone_ca_lancamento_log enable row level security;
