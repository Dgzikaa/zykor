-- 2026-06-20 — Cartão "gerar fatura" (Opção A: rateio por categoria, paga 1x).
-- O pedido ganha 'rateio' (jsonb) com o split por categoria. /cartao/gerar agrega as linhas
-- da fatura por categoria -> 1 pedido (tipo 'cartao', valor=total, rateio). Na aprovação,
-- /contaazul/lancamentos cria 1 conta a pagar com rateio multi-categoria (cada categoria no
-- DRE), paga 1x. Não dobra. tipo 'cartao' adicionado em TIPOS_VALIDOS (lib).
ALTER TABLE financial.pedidos_pagamento ADD COLUMN IF NOT EXISTS rateio jsonb;
