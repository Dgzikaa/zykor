-- HC-3: Mover horasmedia para bar_regras_negocio
-- Antes: hardcoded 2.5 em get_clientes_fieis_ano.sql
-- Depois: coluna horas_media_visita em bar_regras_negocio

-- PASSO 1: Adicionar coluna
ALTER TABLE bar_regras_negocio 
ADD COLUMN IF NOT EXISTS horas_media_visita NUMERIC DEFAULT 2.5;

-- PASSO 2: Setar valores para cada bar
UPDATE bar_regras_negocio SET horas_media_visita = 2.5 WHERE bar_id = 3;
UPDATE bar_regras_negocio SET horas_media_visita = 2.5 WHERE bar_id = 4;
