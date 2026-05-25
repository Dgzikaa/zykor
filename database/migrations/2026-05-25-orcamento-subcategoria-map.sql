-- Tabela meta.orcamento_subcategoria_map: mapeamento ContaAzul -> linha de orçamento Zykor
-- ============================================================================
-- Substitui o CATEGORIAS_MAP hardcoded em
-- frontend/src/app/estrategico/orcamentacao/services/orcamentacao-service.ts:113-187
--
-- Estrutura baseada na planilha BP Ordinário "2026 Ajustado 3 (Mai26)" extraída
-- via MCP Google Drive em 2026-05-25 e documentada em
-- docs/orcamentacao-mestre-mai26-mapeamento.md
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS meta;

CREATE TABLE IF NOT EXISTS meta.orcamento_subcategoria_map (
  id               BIGSERIAL PRIMARY KEY,
  bar_id           INTEGER NOT NULL,
  ordem            INTEGER NOT NULL,
  bloco            TEXT NOT NULL,
  linha            TEXT NOT NULL,
  tipo             TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa', 'contrato', 'percentual_calc')),
  eh_percentual    BOOLEAN NOT NULL DEFAULT false,
  contaazul_categorias TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  observacao       TEXT,
  ativo            BOOLEAN NOT NULL DEFAULT true,
  atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_por   TEXT,
  UNIQUE (bar_id, bloco, linha)
);

CREATE INDEX IF NOT EXISTS idx_orcamento_map_bar_ordem
  ON meta.orcamento_subcategoria_map (bar_id, ordem)
  WHERE ativo;

CREATE INDEX IF NOT EXISTS idx_orcamento_map_categorias
  ON meta.orcamento_subcategoria_map USING gin (contaazul_categorias);

COMMENT ON TABLE meta.orcamento_subcategoria_map IS
  'Mapeamento das linhas do orcamento (BP Mai26) -> categorias ContaAzul que somam ali. Source of truth para a pagina /estrategico/orcamentacao. Substitui CATEGORIAS_MAP hardcoded.';
COMMENT ON COLUMN meta.orcamento_subcategoria_map.contaazul_categorias IS
  'Array de categoria_nome do ContaAzul. Lancamentos com qualquer dessas categorias somam nesta linha.';
COMMENT ON COLUMN meta.orcamento_subcategoria_map.eh_percentual IS
  'Se true, a linha eh exibida como % da receita total (ex: IMPOSTO, Comissao, CMV). Se false, valor absoluto.';

CREATE OR REPLACE VIEW public.orcamento_subcategoria_map AS
  SELECT * FROM meta.orcamento_subcategoria_map;

-- ----------------------------------------------------------------------------
-- Seed inicial baseado na planilha Mai26 (bar_id=3 Ordinario)
-- ----------------------------------------------------------------------------
INSERT INTO meta.orcamento_subcategoria_map (bar_id, ordem, bloco, linha, tipo, eh_percentual, contaazul_categorias, observacao) VALUES
-- RECEITAS
(3, 10, 'Receitas', 'Faturamento Bar', 'receita', false, ARRAY['RECEITA BRUTA','Stone Credito','Stone Debito','Stone Pix','Dinheiro','Pix Direto na Conta','FATURAMENTO','VENDAS'], 'Total de vendas do bar (consumacao). Hoje vem de eventos_base.real_r para garantir consistencia com ContaHub.'),
(3, 11, 'Receitas', 'Faturamento Couvert', 'receita', false, ARRAY['Faturamento Couvert','RECEITA COUVERT','Receita Bilheteria'], 'Bilheteria/entrada/couvert.'),
(3, 12, 'Receitas', 'Faturamento Buteco', 'receita', false, ARRAY['Receita Buteco'], 'Reservado para iniciativa "Buteco" - vazio por enquanto.'),
-- DESPESAS VARIAVEIS
(3, 20, 'Despesas Variaveis', 'IMPOSTO', 'despesa', true, ARRAY['IMPOSTO','SIMPLES NACIONAL','DAS','ICMS','ISS','PIS','COFINS'], 'Impostos sobre faturamento.'),
(3, 21, 'Despesas Variaveis', 'Comissao', 'despesa', true, ARRAY['COMISSAO','COMISSÃO','Comissoes','Comissões','COMISSÃO 10%','Comissões 10%'], 'Comissao paga ao time.'),
(3, 22, 'Despesas Variaveis', 'Tx Maquininha', 'despesa', true, ARRAY['TAXA MAQUININHA','Taxa Maquininha','Stone Taxa','TX MAQ','TAXAS CARTAO'], 'Taxa Stone/cartao.'),
-- CMV
(3, 30, 'CMV', 'CMV Bar', 'despesa', true, ARRAY['CUSTO BEBIDAS','Custo Bebidas','CUSTO COMIDA','Custo Comida','CUSTO DRINKS','Custo Drinks','CUSTO OUTROS','Custo Outros','CMV','CMV Bar'], 'Custo Mercadoria Vendida (bebida + comida + drinks + outros). Alimentado por cmv-semanal.'),
-- MAO DE OBRA
(3, 40, 'Mao-de-Obra', 'CMO Fixo', 'despesa', false, ARRAY['CUSTO-EMPRESA FUNCIONARIOS','Salario','SALÁRIO','ADICIONAIS','Adicional','VALE TRANSPORTE','RECURSOS HUMANOS','CMO Fixo'], 'Folha de pagamento fixa (CLT).'),
(3, 41, 'Mao-de-Obra', 'Freela', 'despesa', false, ARRAY['Freela','FREELA','Freela Atendimento','Freela Bar','Freela Cozinha','Freela Limpeza','Freela Seguranca','Freela Segurança'], 'Freelas/temporarios consolidados.'),
(3, 42, 'Mao-de-Obra', 'PRO LABORE', 'despesa', false, ARRAY['PRO LABORE','PROLABORE','Pro Labore'], 'Retirada socios.'),
-- COMERCIAIS
(3, 50, 'Despesas Comerciais', 'Programacao Artistica', 'despesa', false, ARRAY['Programacao','PROGRAMAÇÃO','Atracoes Programacao','Atrações Programação','Programacao Artistica','Programação Artística','Cache Artistico','Cachê'], 'Cache artistico fixo + variavel da programacao.'),
(3, 51, 'Despesas Comerciais', 'Custos de evento variavel', 'despesa', false, ARRAY['Eventos','Producao Eventos','Produção Eventos','Custo Producao','Custo Producao Evento'], 'Custos variaveis por evento (estrutura, palco, producao).'),
(3, 52, 'Despesas Comerciais', 'Marketing', 'despesa', false, ARRAY['Marketing','MARKETING','Midia','Publicidade'], 'Marketing total.'),
-- ADMINISTRATIVAS
(3, 60, 'Despesas Administrativas', 'Administrativo', 'despesa', false, ARRAY['Escritorio Central','Administrativo Ordinario','RECURSOS HUMANOS','Escritorio','Honorarios','Contador','Software','Impostos Adm','Administrativo'], 'Despesas administrativas consolidadas.'),
-- OPERACIONAIS
(3, 70, 'Despesas Operacionais', 'Materiais Utens Limp', 'despesa', false, ARRAY['Materiais Operacao','Materiais Operação','Estorno','Equipamentos Operacao','Equipamentos Operação','Materiais Limpeza','Materiais de Limpeza e Descartaveis','Utensilios','Utensílios','Material Descartavel'], 'Material operacional consolidado: limpeza, descartavel, utensilios.'),
-- OCUPACAO
(3, 80, 'Despesas Ocupacao', 'ALUGUEL/COND/IPTU', 'despesa', false, ARRAY['ALUGUEL/CONDOMINIO/IPTU','Aluguel','Condominio','IPTU','ALUGUEL'], 'Aluguel + condominio + IPTU.'),
(3, 81, 'Despesas Ocupacao', 'Manutencao', 'despesa', false, ARRAY['Manutencao','Manutenção','MANUTENCAO','MAnutenção'], 'Manutencao predial e equipamentos.'),
(3, 82, 'Despesas Ocupacao', 'AGUA', 'despesa', false, ARRAY['AGUA','ÁGUA','Agua'], 'Conta de agua.'),
(3, 83, 'Despesas Ocupacao', 'GAS', 'despesa', false, ARRAY['GAS','GÁS','Gas'], 'Conta de gas.'),
(3, 84, 'Despesas Ocupacao', 'INTERNET', 'despesa', false, ARRAY['INTERNET','Internet'], 'Internet/telefonia.'),
(3, 85, 'Despesas Ocupacao', 'LUZ', 'despesa', false, ARRAY['LUZ','Energia','ENERGIA','Eletrica','Elétrica'], 'Energia eletrica.'),
-- CONTRATOS (entrada que abate custos)
(3, 90, 'Contratos', 'Contratos', 'contrato', false, ARRAY['Contrato Ambev','CONTRATO','Cashback Ambev','Bonificacao','Bonificação','Contrato Anual'], 'Contrato com fornecedores (entra positivo, abate despesas).')
ON CONFLICT (bar_id, bloco, linha) DO NOTHING;

-- Seed inicial para bar_id=4 (Deboche) - mesma estrutura
INSERT INTO meta.orcamento_subcategoria_map (bar_id, ordem, bloco, linha, tipo, eh_percentual, contaazul_categorias, observacao)
SELECT 4, ordem, bloco, linha, tipo, eh_percentual, contaazul_categorias, observacao
FROM meta.orcamento_subcategoria_map WHERE bar_id = 3
ON CONFLICT (bar_id, bloco, linha) DO NOTHING;

COMMIT;
