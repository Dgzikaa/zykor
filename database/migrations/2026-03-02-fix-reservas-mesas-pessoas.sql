-- =====================================================
-- CORREÇÃO: Separar contagem de MESAS e PESSOAS nas reservas
-- Data: 02/03/2026
-- =====================================================

-- 1. Adicionar colunas para armazenar mesas e pessoas separadamente
ALTER TABLE eventos_base 
ADD COLUMN IF NOT EXISTS num_mesas_tot INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS num_mesas_presentes INTEGER DEFAULT 0;

COMMENT ON COLUMN eventos_base.num_mesas_tot IS 'Número de mesas/reservas totais (COUNT de reservas)';
COMMENT ON COLUMN eventos_base.num_mesas_presentes IS 'Número de mesas/reservas presentes - apenas seated (COUNT de reservas seated)';
COMMENT ON COLUMN eventos_base.res_tot IS 'Número de PESSOAS nas reservas totais (SUM de people)';
COMMENT ON COLUMN eventos_base.res_p IS 'Número de PESSOAS nas reservas presentes - apenas seated (SUM de people seated)';
