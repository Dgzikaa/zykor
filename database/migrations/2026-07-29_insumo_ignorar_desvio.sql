-- 2026-07-29 — "Olhinho" no desvio: itens que o time NÃO controla
--
-- Pedido do Isaías: em /operacional/desvios, poder marcar um item pra não ser contabilizado,
-- igual ao olho da tela de Controle da Consumação. Exemplo dado: "óleo fritura rateio" — o time
-- não faz controle desse item, e ele só polui a lista e distorce o total.
--
-- Flag no CADASTRO do insumo (não por período): "não controlamos isso" é característica do
-- item, não de uma semana. Marcou uma vez, vale pra todo período.
--
-- A tela mostra por padrão só os ATIVOS (não ignorados) e, como os cards de headline somam a
-- partir da lista visível, sair da lista já tira do Desvio total / Perdas / Sobras. O chip
-- "N fora do desvio" permite revisar e desfazer — a marcação nunca é invisível.
ALTER TABLE operations.insumos
  ADD COLUMN IF NOT EXISTS ignorar_desvio boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN operations.insumos.ignorar_desvio IS
  'true = fora da conta de desvio (a tela esconde e o total não soma). Marcado pelo olhinho em /operacional/desvios.';

-- Índice parcial: a consulta só pergunta por quem está marcado, que é a minoria.
CREATE INDEX IF NOT EXISTS idx_insumos_ignorar_desvio
  ON operations.insumos (bar_id) WHERE ignorar_desvio;
