-- Fix reservas: ETL desempenho le direto do bronze Getin

-- Problema: campos _quantidade/_pessoas nao tinham pipeline automatico.
-- ETL SQL calculava reservas_totais/presentes (legado) via gold.planejamento
-- que usava SUM(res_tot) de eventos_base = visitas ContaHub, nao reservas Getin.
-- recalcular-desempenho-v2 (edge function) tambem le de eventos_base.

-- Fix: nova CTE fase_reservas_getin no ETL desempenho_semanal que le
-- direto de bronze.bronze_getin_reservations e calcula:
-- - reservas_totais_quantidade: COUNT(*) de reservas
-- - reservas_presentes_quantidade: COUNT(*) excluindo canceled/no-show
-- - reservas_totais_pessoas: SUM(people)
-- - reservas_presentes_pessoas: SUM(people) excluindo canceled/no-show
-- - reservas_quebra_pct: (total-presentes)/total * 100

-- Tambem: sync_mesas_getin_to_eventos restaurada com schema bronze
-- (referenciava public.getin_reservations que nao existe mais)

-- S16 bar 3: 88/1404 -> 90/1428 (bate com Getin web)
-- Rebuild: 2025 S1-S52 + 2026 S1-S17 (ambos bares)
