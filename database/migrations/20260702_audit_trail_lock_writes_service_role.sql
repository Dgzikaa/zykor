-- Auditoria confiável: só o service_role (API server-side) pode escrever em system.audit_trail
-- e system.security_events. anon/authenticated tinham INSERT/UPDATE/DELETE — um log de auditoria
-- que qualquer portador da anon key pode forjar/apagar não serve pra nada. A API grava via
-- service role (getAdminClient), então anon/authenticated não precisam de escrita.

revoke insert, update, delete, truncate on system.audit_trail from anon, authenticated;
revoke insert, update, delete, truncate on system.security_events from anon, authenticated;
