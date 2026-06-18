-- 2026-06-18 — Boleto: guarda a linha digitável no pedido (pra pagamento via Inter depois).
-- A aba Boleto lê foto/PDF com IA de visão (valor, vencimento, beneficiário, linha digitável),
-- o humano confere e cria o pedido (vai pra aprovação como os demais).
ALTER TABLE financial.pedidos_pagamento ADD COLUMN IF NOT EXISTS linha_digitavel text;
