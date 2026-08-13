-- =====================================================================
-- Pesquisa da Felicidade — corrige o modelo de dados (2026-08-13)
-- =====================================================================
-- Dois furos no que existia:
--
-- 1) As 5 dimensões eram INTEGER porque o sync convertia o percentual da
--    planilha para uma escala 1-5 (`Math.ceil(pct/100*5)`, com piso 1).
--    Isso destruía o dado. Exemplo real, BAR do Ordinário em 29/07/2026:
--    a planilha diz Engajamento -16,67% e Resultado -6,67%; o banco tinha
--    engajamento=1 e resultado_percentual=28%. Percentual negativo existe
--    (é escala tipo eNPS: %favorável - %desfavorável) e o `<= 0 → 1` do
--    parser jogava tudo no mesmo balde.
--    → viram NUMERIC e passam a guardar o percentual REAL da planilha.
--
-- 2) `funcionario_nome` sempre valia a constante 'Equipe': a pesquisa é
--    ANÔNIMA e agregada por setor, nunca por pessoa. A coluna só servia
--    para inflar a chave única. Sai, e a chave passa a ser
--    (bar_id, data_pesquisa, setor) — que é a granularidade de verdade.
--
-- `media_geral` (0-5) e `resultado_percentual` (%) continuam existindo e
-- passam a receber as colunas "Média" e "Resultado" da planilha sem
-- recálculo — antes eram derivadas das dimensões já corrompidas.
--
-- Os dados atuais são descartados: além de distorcidos, estão replicados
-- (os 399 registros do Ordinário foram gravados igualzinho nos bar_id
-- 3,4,5,6,7 porque o sync usava um file_id default para todos os bares).
-- O sync corrigido reimporta tudo da planilha de cada bar.
-- =====================================================================

BEGIN;

-- ── 1. Semanal (aba "Pesquisa da Felicidade") ────────────────────────
TRUNCATE TABLE hr.pesquisa_felicidade;

ALTER TABLE hr.pesquisa_felicidade
  DROP CONSTRAINT IF EXISTS pesquisa_felicidade_bar_id_data_pesquisa_funcionario_nome_s_key;

ALTER TABLE hr.pesquisa_felicidade
  DROP COLUMN IF EXISTS funcionario_nome;

-- Os CHECKs originais travavam cada dimensão em [1,5] — o range da escala
-- inventada pelo sync. Com percentual real (que pode ser negativo) eles
-- rejeitariam a carga inteira.
ALTER TABLE hr.pesquisa_felicidade
  DROP CONSTRAINT IF EXISTS pesquisa_felicidade_eu_comigo_engajamento_check,
  DROP CONSTRAINT IF EXISTS pesquisa_felicidade_eu_com_empresa_pertencimento_check,
  DROP CONSTRAINT IF EXISTS pesquisa_felicidade_eu_com_colega_relacionamento_check,
  DROP CONSTRAINT IF EXISTS pesquisa_felicidade_eu_com_gestor_lideranca_check,
  DROP CONSTRAINT IF EXISTS pesquisa_felicidade_justica_reconhecimento_check;

ALTER TABLE hr.pesquisa_felicidade
  ALTER COLUMN eu_comigo_engajamento        TYPE NUMERIC(6,2),
  ALTER COLUMN eu_com_empresa_pertencimento TYPE NUMERIC(6,2),
  ALTER COLUMN eu_com_colega_relacionamento TYPE NUMERIC(6,2),
  ALTER COLUMN eu_com_gestor_lideranca      TYPE NUMERIC(6,2),
  ALTER COLUMN justica_reconhecimento       TYPE NUMERIC(6,2);

ALTER TABLE hr.pesquisa_felicidade
  ADD CONSTRAINT pesquisa_felicidade_bar_data_setor_key
  UNIQUE (bar_id, data_pesquisa, setor);

COMMENT ON TABLE hr.pesquisa_felicidade IS
  'Pesquisa da Felicidade semanal, agregada por setor (anônima). Fonte: aba "Pesquisa da Felicidade" da planilha Indicadores - RH de cada bar.';
COMMENT ON COLUMN hr.pesquisa_felicidade.eu_comigo_engajamento IS
  'Percentual favorável da dimensão, como na planilha. Pode ser negativo (escala tipo eNPS).';
COMMENT ON COLUMN hr.pesquisa_felicidade.media_geral IS 'Coluna "Média" da planilha (0-5).';
COMMENT ON COLUMN hr.pesquisa_felicidade.resultado_percentual IS 'Coluna "Resultado" da planilha (%). Pode ser negativo.';

-- ── 2. Mensal (aba "Pesq. da Felicidade (MENSAL)") ───────────────────
-- Não é a média das semanas: a planilha consolida o mês com peso próprio
-- (quórum), então é uma série independente e vem importada como tal.
CREATE TABLE IF NOT EXISTS hr.pesquisa_felicidade_mensal (
  id                            SERIAL PRIMARY KEY,
  bar_id                        INTEGER NOT NULL,
  ano                           INTEGER NOT NULL,
  mes                           INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  setor                         TEXT    NOT NULL,
  eu_comigo_engajamento         NUMERIC(6,2),
  eu_com_empresa_pertencimento  NUMERIC(6,2),
  eu_com_colega_relacionamento  NUMERIC(6,2),
  eu_com_gestor_lideranca       NUMERIC(6,2),
  justica_reconhecimento        NUMERIC(6,2),
  media_geral                   NUMERIC(5,2),
  resultado_percentual          NUMERIC(6,2),
  created_at                    TIMESTAMP DEFAULT NOW(),
  updated_at                    TIMESTAMP DEFAULT NOW(),
  CONSTRAINT pesquisa_felicidade_mensal_bar_ano_mes_setor_key
    UNIQUE (bar_id, ano, mes, setor)
);
CREATE INDEX IF NOT EXISTS idx_pesq_felic_mensal_bar_periodo
  ON hr.pesquisa_felicidade_mensal (bar_id, ano DESC, mes DESC);

COMMENT ON TABLE hr.pesquisa_felicidade_mensal IS
  'Consolidado mensal da Pesquisa da Felicidade por setor. Fonte: aba "Pesq. da Felicidade (MENSAL)".';

-- ── 3. Marca Empregadora (aba homônima) ──────────────────────────────
CREATE TABLE IF NOT EXISTS hr.marca_empregadora (
  id                    SERIAL PRIMARY KEY,
  bar_id                INTEGER NOT NULL,
  ano                   INTEGER NOT NULL,
  mes                   INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  quorum                INTEGER,
  resultado_percentual  NUMERIC(6,2),
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW(),
  CONSTRAINT marca_empregadora_bar_ano_mes_key UNIQUE (bar_id, ano, mes)
);
CREATE INDEX IF NOT EXISTS idx_marca_empregadora_bar_periodo
  ON hr.marca_empregadora (bar_id, ano DESC, mes DESC);

COMMENT ON TABLE hr.marca_empregadora IS
  'NPS de Marca Empregadora mensal. Fonte: aba "Marca Empregadora". Pode ser negativo.';

-- ── 4. RLS + grants (mesmo padrão das outras tabelas do hr:
--       nada de anon/authenticated; leitura sempre via service role) ──
ALTER TABLE hr.pesquisa_felicidade_mensal ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.marca_empregadora          ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON hr.pesquisa_felicidade_mensal FROM anon, authenticated;
REVOKE ALL ON hr.marca_empregadora          FROM anon, authenticated;

GRANT ALL ON hr.pesquisa_felicidade_mensal TO service_role;
GRANT ALL ON hr.marca_empregadora          TO service_role;
GRANT USAGE, SELECT ON SEQUENCE hr.pesquisa_felicidade_mensal_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE hr.marca_empregadora_id_seq          TO service_role;

COMMIT;
