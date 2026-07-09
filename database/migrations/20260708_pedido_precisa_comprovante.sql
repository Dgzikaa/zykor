-- ============================================================================
-- Pedidos de Pagamento — flag "Precisa de comprovante?"
--
-- O banco (Inter) NÃO devolve o comprovante do PIX por transação (a API Banking v2
-- só retorna codigoSolicitacao/status; o único PDF é o extrato inteiro por período).
-- Por isso o solicitante marca no pedido quando aquele pagamento vai exigir um
-- comprovante anexado manualmente depois — e o financeiro consegue filtrar a lista
-- por "precisa de comprovante".
-- ============================================================================

ALTER TABLE financial.pedidos_pagamento
  ADD COLUMN IF NOT EXISTS precisa_comprovante boolean NOT NULL DEFAULT false;

-- Recarrega o cache de schema do PostgREST pra expor a coluna nova de imediato.
NOTIFY pgrst, 'reload schema';
