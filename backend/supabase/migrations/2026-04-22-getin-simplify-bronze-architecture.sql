-- =====================================================
-- GETIN: Simplificar Arquitetura Bronze
-- =====================================================
-- 
-- ANTES: API -> integrations.getin_reservations -> bronze_sync -> bronze.bronze_getin_reservations
-- DEPOIS: API -> bronze.bronze_getin_reservations (direto)

-- Criar view bronze.getin_reservas para compatibilidade
CREATE OR REPLACE VIEW bronze.getin_reservas AS
SELECT 
  reservation_id AS id,
  reservation_id,
  unit_id,
  sector_id,
  sector_name,
  bar_id,
  customer_name,
  customer_name AS name,
  customer_email,
  customer_email AS email,
  customer_phone,
  customer_phone AS phone,
  customer_phone AS telefone_normalizado,
  reservation_date,
  reservation_date::text AS date,
  reservation_date AS data,
  reservation_time,
  reservation_time AS time,
  people,
  people AS numero_convidados,
  status,
  discount,
  info,
  no_show,
  no_show_tax,
  no_show_hours,
  no_show_eligible,
  confirmation_sent,
  nps_answered,
  nps_url,
  custom_fields,
  monetize,
  raw_data,
  synced_at,
  synced_at AS created_at,
  synced_at AS updated_at
FROM bronze.bronze_getin_reservations;

-- DROP view antiga
DROP VIEW IF EXISTS integrations.getin_reservas CASCADE;
