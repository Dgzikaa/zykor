-- =====================================================
-- MIGRATION: Versionamento de Simulações CMO
-- Data: 27/02/2026
-- =====================================================

-- 1) CRIAR TABELA DE HISTÓRICO
CREATE TABLE IF NOT EXISTS cmo_semanal_historico (
  id BIGSERIAL PRIMARY KEY,
  cmo_semanal_id BIGINT NOT NULL REFERENCES cmo_semanal(id) ON DELETE CASCADE,
  versao INTEGER NOT NULL,
  
  bar_id BIGINT NOT NULL,
  ano INTEGER NOT NULL,
  semana INTEGER NOT NULL,
  cmo_total NUMERIC(10,2),
  freelas NUMERIC(10,2),
  fixos_total NUMERIC(10,2),
  cma_alimentacao NUMERIC(10,2),
  pro_labore_semanal NUMERIC(10,2),
  simulacao_salva BOOLEAN DEFAULT FALSE,
  
  funcionarios JSONB,
  
  tipo_mudanca VARCHAR(20) CHECK (tipo_mudanca IN ('CREATE', 'UPDATE', 'TRAVAR', 'DESTRAVAR')),
  mudancas_detectadas TEXT[],
  usuario_id BIGINT,
  usuario_email TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_versao_por_cmo UNIQUE (cmo_semanal_id, versao)
);

CREATE INDEX IF NOT EXISTS idx_cmo_historico_cmo_id ON cmo_semanal_historico(cmo_semanal_id);
CREATE INDEX IF NOT EXISTS idx_cmo_historico_bar_ano_semana ON cmo_semanal_historico(bar_id, ano, semana);
CREATE INDEX IF NOT EXISTS idx_cmo_historico_created_at ON cmo_semanal_historico(created_at DESC);

-- 2) CRIAR FUNÇÃO
CREATE OR REPLACE FUNCTION salvar_versao_cmo()
RETURNS TRIGGER AS $$
DECLARE
  v_versao INTEGER;
  v_tipo_mudanca VARCHAR(20);
  v_mudancas TEXT[] := ARRAY[]::TEXT[];
  v_funcionarios JSONB;
BEGIN
  SELECT COALESCE(MAX(versao), 0) + 1 
  INTO v_versao 
  FROM cmo_semanal_historico 
  WHERE cmo_semanal_id = NEW.id;
  
  IF TG_OP = 'INSERT' THEN
    v_tipo_mudanca := 'CREATE';
  ELSIF OLD.simulacao_salva = FALSE AND NEW.simulacao_salva = TRUE THEN
    v_tipo_mudanca := 'TRAVAR';
  ELSIF OLD.simulacao_salva = TRUE AND NEW.simulacao_salva = FALSE THEN
    v_tipo_mudanca := 'DESTRAVAR';
  ELSE
    v_tipo_mudanca := 'UPDATE';
    
    IF OLD.cmo_total IS DISTINCT FROM NEW.cmo_total THEN
      v_mudancas := array_append(v_mudancas, 'cmo_total');
    END IF;
    IF OLD.freelas IS DISTINCT FROM NEW.freelas THEN
      v_mudancas := array_append(v_mudancas, 'freelas');
    END IF;
    IF OLD.fixos_total IS DISTINCT FROM NEW.fixos_total THEN
      v_mudancas := array_append(v_mudancas, 'fixos_total');
    END IF;
    IF OLD.cma_alimentacao IS DISTINCT FROM NEW.cma_alimentacao THEN
      v_mudancas := array_append(v_mudancas, 'cma_alimentacao');
    END IF;
    IF OLD.pro_labore_semanal IS DISTINCT FROM NEW.pro_labore_semanal THEN
      v_mudancas := array_append(v_mudancas, 'pro_labore_semanal');
    END IF;
  END IF;
  
  BEGIN
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', f.id,
        'nome', f.nome,
        'tipo_contrato', f.tipo_contrato,
        'salario_base', f.salario_base,
        'dias_trabalhados', f.dias_trabalhados,
        'custo_total', f.custo_total
      )
    )
    INTO v_funcionarios
    FROM cmo_funcionarios f
    WHERE f.cmo_semanal_id = NEW.id;
  EXCEPTION
    WHEN undefined_table THEN
      v_funcionarios := '[]'::jsonb;
  END;
  
  INSERT INTO cmo_semanal_historico (
    cmo_semanal_id, versao, bar_id, ano, semana,
    cmo_total, freelas, fixos_total, cma_alimentacao, pro_labore_semanal,
    simulacao_salva, funcionarios, tipo_mudanca, mudancas_detectadas, created_at
  ) VALUES (
    NEW.id, v_versao, NEW.bar_id, NEW.ano, NEW.semana,
    NEW.cmo_total, NEW.freelas, NEW.fixos_total, NEW.cma_alimentacao, NEW.pro_labore_semanal,
    NEW.simulacao_salva, COALESCE(v_funcionarios, '[]'::jsonb), v_tipo_mudanca, v_mudancas, NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) CRIAR TRIGGER
DROP TRIGGER IF EXISTS trigger_salvar_versao_cmo ON cmo_semanal;
CREATE TRIGGER trigger_salvar_versao_cmo
  AFTER INSERT OR UPDATE ON cmo_semanal
  FOR EACH ROW
  EXECUTE FUNCTION salvar_versao_cmo();

-- 4) CRIAR VIEW
CREATE OR REPLACE VIEW vw_cmo_historico_completo AS
SELECT 
  h.id, h.cmo_semanal_id, h.versao, h.bar_id, b.nome as bar_nome,
  h.ano, h.semana, h.cmo_total, h.freelas, h.fixos_total,
  h.cma_alimentacao, h.pro_labore_semanal, h.simulacao_salva,
  h.funcionarios, jsonb_array_length(h.funcionarios) as total_funcionarios,
  h.tipo_mudanca, h.mudancas_detectadas, h.created_at,
  LAG(h.cmo_total) OVER (PARTITION BY h.cmo_semanal_id ORDER BY h.versao) as cmo_total_anterior,
  h.cmo_total - LAG(h.cmo_total) OVER (PARTITION BY h.cmo_semanal_id ORDER BY h.versao) as diferenca_cmo_total
FROM cmo_semanal_historico h
LEFT JOIN bares b ON h.bar_id = b.id
ORDER BY h.cmo_semanal_id, h.versao DESC;

-- 5) GRANTS
GRANT SELECT ON cmo_semanal_historico TO authenticated;
GRANT SELECT ON vw_cmo_historico_completo TO authenticated;
GRANT ALL ON cmo_semanal_historico TO service_role;
GRANT ALL ON vw_cmo_historico_completo TO service_role;
