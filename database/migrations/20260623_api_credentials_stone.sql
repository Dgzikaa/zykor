-- api_credentials: suporte a credenciais Stone (conciliação), 2 CNPJs por bar.
-- Aplicadas em produção em 2026-06-23 via MCP. Arquivo só pra registro/histórico.

-- 1) 'stone' não estava na lista de sistemas permitidos.
alter table public.api_credentials drop constraint api_credentials_sistema_check;
alter table public.api_credentials add constraint api_credentials_sistema_check
  check (sistema::text = any (array[
    'getin','contahub','banco_inter','nibo','checklists','yuzer','sistema',
    'sympla','inter','google_sheets','conta_azul','falae','vercel','supabase','stone'
  ]));

-- 2) A unique (bar,sistema,ambiente,COALESCE(client_id,'')) limitava a 1 credencial
--    sem OAuth por bar. Stone tem 2 CNPJs/bar sem client_id -> diferencia por
--    empresa_nome. Mantém: client_id (Inter, multi-conta) e o '' (contahub/falae, 1/bar).
drop index if exists public.api_credentials_bar_sistema_amb_client_uk;
create unique index api_credentials_bar_sistema_amb_client_uk
  on public.api_credentials (bar_id, sistema, ambiente, coalesce(client_id, empresa_nome, ''));
