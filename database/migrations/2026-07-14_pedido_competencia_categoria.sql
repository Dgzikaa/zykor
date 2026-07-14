-- #21 (backlog reunião 13/07): dividir 1 pedido/boleto em 2+ categorias (rateio).
-- Cada linha de competência pode ter a sua própria categoria; NULL = usa a do pedido.
-- No agendamento cada linha vira 1 lançamento no Conta Azul (já idempotente por linha).
-- Aplicado via MCP em 2026-07-14.
alter table financial.pedidos_pagamento_competencias
  add column if not exists categoria_id text,
  add column if not exists categoria_nome text;
