-- 2026-07-14 — Planejamento de Compras: ajuste manual do histórico de saída por semana +
-- "ignorar semana" na média (pedido Gonza).
--
-- A média ponderada das 6 semanas define o PR/sugestão. Às vezes uma semana é atípica (evento,
-- ruptura, contagem errada) e distorce. Agora dá pra:
--   - EDITAR o valor de uma semana na mão (fica registrado quem/quando alterou), OU
--   - IGNORAR a semana (sai do cálculo da média e do desvio padrão).
-- Guardado em unidade-base (ml/g/un), mesma dos `saidas` do fn_plano_compras.
CREATE TABLE IF NOT EXISTS operations.compras_plano_saida_ajuste (
  bar_id         integer     NOT NULL,
  insumo_codigo  text        NOT NULL,
  semana_ini     date        NOT NULL,
  valor_manual   numeric,                          -- unidade-base; NULL = mantém o calculado
  ignorar        boolean     NOT NULL DEFAULT false,
  usuario        text,                             -- quem alterou (auditoria)
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bar_id, insumo_codigo, semana_ini)
);

COMMENT ON TABLE operations.compras_plano_saida_ajuste IS
  'Ajuste manual do Planejamento de Compras: override do uso-direto por semana e/ou ignorar a semana da média. Unidade-base.';
