-- ============================================================================
-- MIGRACAO: Adicionar campos de tempo de estadia na tabela visitas
-- Data: 2026-03-20
-- Objetivo: Permitir descontinuar contahub_vendas movendo campos para visitas
-- ============================================================================

-- PARTE 1: Adicionar novas colunas a tabela visitas

ALTER TABLE visitas ADD COLUMN IF NOT EXISTS hora_abertura TIMESTAMPTZ;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS hora_saida TIMESTAMPTZ;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS tempo_estadia_minutos INTEGER;

-- Indice para consultas de tempo de estadia
CREATE INDEX IF NOT EXISTS idx_visitas_tempo_estadia 
ON visitas (bar_id, tempo_estadia_minutos) 
WHERE tempo_estadia_minutos IS NOT NULL AND tempo_estadia_minutos > 0;

-- Comentarios para documentacao
COMMENT ON COLUMN visitas.hora_abertura IS 'Hora de abertura da comanda (migrado de contahub_vendas.vd_hrabertura)';
COMMENT ON COLUMN visitas.hora_saida IS 'Hora de fechamento da comanda (migrado de contahub_vendas.vd_hrsaida)';
COMMENT ON COLUMN visitas.tempo_estadia_minutos IS 'Tempo de permanencia em minutos (calculado de hora_saida - hora_abertura)';


-- PARTE 2: Backfill de dados existentes de contahub_vendas

UPDATE visitas v
SET 
  hora_abertura = cv.vd_hrabertura::timestamptz,
  hora_saida = cv.vd_hrsaida::timestamptz,
  tempo_estadia_minutos = cv.tempo_estadia_minutos
FROM contahub_vendas cv
WHERE 
  v.bar_id = cv.bar_id
  AND v.data_visita = cv.dt_gerencial
  AND v.tempo_estadia_minutos IS NULL
  AND cv.tempo_estadia_minutos IS NOT NULL
  AND cv.tempo_estadia_minutos > 0
  AND cv.tempo_estadia_minutos < 720
  AND (
    regexp_replace(v.cliente_fone, '\D', '', 'g') = regexp_replace(cv.cli_fone, '\D', '', 'g')
    OR
    regexp_replace(v.cliente_fone, '\D', '', 'g') = 
      CASE 
        WHEN length(regexp_replace(cv.cli_fone, '\D', '', 'g')) = 10 THEN
          substring(regexp_replace(cv.cli_fone, '\D', '', 'g') from 1 for 2) || '9' || 
          substring(regexp_replace(cv.cli_fone, '\D', '', 'g') from 3)
        ELSE regexp_replace(cv.cli_fone, '\D', '', 'g')
      END
  );
