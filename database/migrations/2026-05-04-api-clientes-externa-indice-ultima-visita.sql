-- 2026-05-04: indice em silver.cliente_estatisticas pra api-clientes-externa
--
-- Problema: parceiro GoBar reportou erro 500 em api-clientes-externa
-- pra sabado 02/05 (sex/dom OK). Causa: tabela tinha 23360 paginas (180MB) e
-- nenhum indice em ultima_visita. Filtro `WHERE bar_id=X AND ultima_visita=Y`
-- fazia full scan em 8s+ e estourava timeout do parceiro em dias com muitos
-- clientes (sabado: 764 clientes, sex: 395, dom: 516).
--
-- Fix: indice composto (bar_id, ultima_visita DESC NULLS LAST). Ja aplicado
-- direto no banco em 2026-05-04 — esta migration formaliza pra reprodutibilidade.
--
-- Apos indice: query passou de ~8s pra <0.4s.

CREATE INDEX IF NOT EXISTS idx_cliente_estatisticas_bar_ultvisita
  ON silver.cliente_estatisticas (bar_id, ultima_visita DESC NULLS LAST);
