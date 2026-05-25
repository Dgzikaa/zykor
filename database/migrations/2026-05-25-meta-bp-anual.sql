-- Tabela meta.bp_linha: armazena o Business Plan anual (planilha mestre)
-- ============================================================================
-- Popula com os dados de "2026 Ajustado 3 (Mai26)" extraídos da planilha
-- "BP Ordinário.xlsx" via MCP Google Drive em 2026-05-25.
-- Usada por /estrategico/bp e como "planejado" em /estrategico/orcamentacao.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS meta.bp_linha (
  id              BIGSERIAL PRIMARY KEY,
  bar_id          INTEGER NOT NULL,
  ano             INTEGER NOT NULL,
  versao          TEXT NOT NULL,
  bloco           TEXT NOT NULL,
  linha           TEXT NOT NULL,
  ordem           INTEGER NOT NULL,
  tipo            TEXT NOT NULL,
  valor_mensal    NUMERIC(14,2),
  percentual_receita NUMERIC(6,2),
  por_dia_semana  JSONB,
  observacao      TEXT,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bar_id, ano, versao, bloco, linha)
);

CREATE INDEX IF NOT EXISTS idx_bp_linha_bar_ano_versao
  ON meta.bp_linha (bar_id, ano, versao) WHERE ativo;

CREATE TABLE IF NOT EXISTS meta.bp_indicador (
  id              BIGSERIAL PRIMARY KEY,
  bar_id          INTEGER NOT NULL,
  ano             INTEGER NOT NULL,
  versao          TEXT NOT NULL,
  indicador       TEXT NOT NULL,
  valor           NUMERIC(14,2),
  unidade         TEXT,
  observacao      TEXT,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bar_id, ano, versao, indicador)
);

COMMENT ON TABLE meta.bp_linha IS
  'Business Plan: 1 linha por subcategoria do orcamento. Valor mensal medio + distribuicao por dia da semana. Source: planilha BP Ordinario aba 2026 Ajustado 3 (Mai26).';
COMMENT ON TABLE meta.bp_indicador IS
  'Indicadores macro do BP: BreakEven, Custo Fixo, Margem Contribuicao, N Pessoas, Tkt Medio, CMV alvo, Margem Liquida.';

CREATE OR REPLACE VIEW public.bp_linha AS SELECT * FROM meta.bp_linha;
CREATE OR REPLACE VIEW public.bp_indicador AS SELECT * FROM meta.bp_indicador;

-- ----------------------------------------------------------------------------
-- Seed BP Ordinario 2026 Ajustado 3 (Mai26) - bar_id=3
-- ----------------------------------------------------------------------------
INSERT INTO meta.bp_linha (bar_id, ano, versao, bloco, linha, ordem, tipo, valor_mensal, percentual_receita, por_dia_semana, observacao) VALUES
-- RECEITAS
(3, 2026, 'Mai26', 'Receitas', 'Faturamento Bar', 10, 'receita', 1373420.00, NULL,
  '{"seg":10200,"ter":16600,"qua":38180,"qui":20750,"sex":85000,"sab":103020,"dom":45650}',
  'Vendas do bar.'),
(3, 2026, 'Mai26', 'Receitas', 'Faturamento Couvert', 11, 'receita', 350948.80, 20.4,
  '{"seg":2160,"ter":3600,"qua":10580,"qui":4500,"sex":23000,"sab":27876,"dom":9900}',
  'Bilheteria/entrada.'),
(3, 2026, 'Mai26', 'Receitas', 'Faturamento Buteco', 12, 'receita', 0, 0, NULL, 'Reservado pra iniciativa Buteco.'),
-- DESPESAS VARIAVEIS
(3, 2026, 'Mai26', 'Despesas Variaveis', 'IMPOSTO', 20, 'despesa', -94840.28, 5.5, NULL, NULL),
(3, 2026, 'Mai26', 'Despesas Variaveis', 'Comissao', 21, 'despesa', -119487.54, 6.9, NULL, NULL),
(3, 2026, 'Mai26', 'Despesas Variaveis', 'Tx Maquininha', 22, 'despesa', -36211.74, 2.1, NULL, NULL),
-- CMV
(3, 2026, 'Mai26', 'CMV', 'CMV Bar', 30, 'despesa', -446361.50, 25.9, NULL, 'Alvo: 32% do bar (ou 25.9% da receita total).'),
-- MAO DE OBRA
(3, 2026, 'Mai26', 'Mao-de-Obra', 'CMO Fixo', 40, 'despesa', -170000.00, 9.9, NULL, NULL),
(3, 2026, 'Mai26', 'Mao-de-Obra', 'Freela', 41, 'despesa', -100000.00, 5.8, NULL, NULL),
(3, 2026, 'Mai26', 'Mao-de-Obra', 'PRO LABORE', 42, 'despesa', -64000.00, 3.7, NULL, NULL),
-- COMERCIAIS
(3, 2026, 'Mai26', 'Despesas Comerciais', 'Programacao Artistica', 50, 'despesa', -310460.00, 18.0,
  '{"seg":2000,"ter":4000,"qua":6000,"qui":4000,"sex":22200,"sab":20000,"dom":14000}',
  'Cache total por dia. Solucao: achar 6k por semana de cache.'),
(3, 2026, 'Mai26', 'Despesas Comerciais', 'Custos de evento variavel', 51, 'despesa', -80000.00, 4.6, NULL,
  'Explodir categorias e definir budget de cada.'),
(3, 2026, 'Mai26', 'Despesas Comerciais', 'Marketing', 52, 'despesa', -41384.85, 2.4, NULL,
  'Gerir o budget total com consumacoes.'),
-- ADMINISTRATIVAS
(3, 2026, 'Mai26', 'Despesas Administrativas', 'Administrativo', 60, 'despesa', -83974.75, 4.9, NULL, NULL),
-- OPERACIONAIS
(3, 2026, 'Mai26', 'Despesas Operacionais', 'Materiais Utens Limp', 70, 'despesa', -37936.11, 2.2, NULL,
  'Explodir categorias e definir budget de cada.'),
-- OCUPACAO
(3, 2026, 'Mai26', 'Despesas Ocupacao', 'ALUGUEL/COND/IPTU', 80, 'despesa', -37000.00, 2.1, NULL, NULL),
(3, 2026, 'Mai26', 'Despesas Ocupacao', 'Manutencao', 81, 'despesa', -13794.95, 0.8, NULL, NULL),
(3, 2026, 'Mai26', 'Despesas Ocupacao', 'AGUA', 82, 'despesa', -9500.00, 0.6, NULL, NULL),
(3, 2026, 'Mai26', 'Despesas Ocupacao', 'GAS', 83, 'despesa', -3500.00, 0.2, NULL, NULL),
(3, 2026, 'Mai26', 'Despesas Ocupacao', 'INTERNET', 84, 'despesa', -800.00, 0.0, NULL, NULL),
(3, 2026, 'Mai26', 'Despesas Ocupacao', 'LUZ', 85, 'despesa', -7500.00, 0.4, NULL, NULL),
-- CONTRATOS
(3, 2026, 'Mai26', 'Contratos', 'Contratos', 90, 'contrato', 36211.74, -2.1, NULL, NULL)
ON CONFLICT (bar_id, ano, versao, bloco, linha) DO NOTHING;

-- Indicadores macro Mai26
INSERT INTO meta.bp_indicador (bar_id, ano, versao, indicador, valor, unidade, observacao) VALUES
(3, 2026, 'Mai26', 'breakeven_mensal', 1610889.08, 'R$', 'BreakEven mensal'),
(3, 2026, 'Mai26', 'custo_fixo_total', -959850.67, 'R$', 'Custo fixo total mensal'),
(3, 2026, 'Mai26', 'margem_contribuicao_pct', 59.6, '%', 'Margem de contribuicao'),
(3, 2026, 'Mai26', 'receita_total_mensal', 1724368.80, 'R$', 'Receita total mensal projetada'),
(3, 2026, 'Mai26', 'n_pessoas_mes', 16305.6, 'pessoas', 'Numero de pessoas previsto/mes'),
(3, 2026, 'Mai26', 'ticket_medio_bar', 84.23, 'R$', 'Ticket medio bar mensal'),
(3, 2026, 'Mai26', 'ticket_medio_entrada', 21.52, 'R$', 'Ticket medio entrada mensal'),
(3, 2026, 'Mai26', 'cmv_alvo_pct', 32.0, '%', 'CMV alvo sobre bar'),
(3, 2026, 'Mai26', 'margem_liquida_pct', 6.0, '%', 'EBITDA / Receita Total'),
(3, 2026, 'Mai26', 'ebitda_mensal', 103828.81, 'R$', 'EBITDA mensal projetado'),
(3, 2026, 'Mai26', 'vezes_no_mes_dia', 4.3, 'x', 'Frequencia media de cada dia da semana no mes')
ON CONFLICT (bar_id, ano, versao, indicador) DO NOTHING;

COMMIT;
