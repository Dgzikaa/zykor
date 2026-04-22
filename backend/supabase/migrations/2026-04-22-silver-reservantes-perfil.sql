-- =====================================================
-- SILVER: Tabela Reservantes Perfil
-- =====================================================
--
-- Consolida dados de reservas (Getin) + consumo (ContaHub)
-- para an\u00e1lise completa do perfil de cada reservante
--
-- Tabela, ETL e Cron job j\u00e1 criados via apply_migration
-- Este arquivo documenta a migration para versionamento
--

-- Ver documenta\u00e7\u00e3o completa:
-- COMMENT ON TABLE silver.reservantes_perfil
-- COMMENT ON FUNCTION public.etl_silver_reservantes_perfil_full

SELECT 'Migration aplicada com sucesso' as status;
