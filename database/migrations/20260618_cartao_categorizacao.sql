-- 2026-06-18 — Cartão de crédito (Fase 4): leitura da fatura + categorização que aprende.
-- A IA lê as linhas da fatura e sugere categoria; a sugestão usa (1) de-para aprendido e
-- (2) a IA escolhendo entre as categorias que o bar REALMENTE usa. Ao confirmar, o sistema
-- aprende (keyword do estabelecimento -> categoria), e a próxima fatura vem melhor.
-- (Geração de lançamentos/pagamento da fatura = próximo passo.)

CREATE TABLE IF NOT EXISTS financial.cartao_categoria_map (
  bar_id         integer NOT NULL,
  keyword        text NOT NULL,            -- token normalizado do estabelecimento (ex.: 'ifood')
  categoria_id   text,
  categoria_nome text,
  hits           integer NOT NULL DEFAULT 1,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bar_id, keyword)
);

-- categorias de despesa que o bar realmente usa (pra sugerir só do que existe)
CREATE OR REPLACE VIEW financial.categorias_despesa_usadas AS
SELECT bar_id, categoria_id, categoria_nome, count(*) AS n
FROM bronze.bronze_contaazul_lancamentos
WHERE tipo='DESPESA' AND categoria_nome IS NOT NULL AND btrim(categoria_nome) <> ''
GROUP BY bar_id, categoria_id, categoria_nome;
