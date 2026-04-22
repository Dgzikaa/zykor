-- =====================================================
-- GETIN: Limpeza Final - Remover Tabelas Antigas
-- =====================================================
--
-- Remover tabelas integrations.getin_* que foram substituídas por bronze.*
-- CRON job 'bronze-sync-from-integrations' já foi removido
--

-- Remover tabelas antigas (já marcadas como DEPRECATED)
DROP TABLE IF EXISTS integrations.getin_reservations CASCADE;
DROP TABLE IF EXISTS integrations.getin_units CASCADE;

-- Logs de sync ainda podem ser úteis, manter por enquanto
-- DROP TABLE IF EXISTS integrations.getin_sync_logs CASCADE;
