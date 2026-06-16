-- 2026-06-16 — Imobilizado: cadastro de ativos + motor de depreciação linear.
-- Alimenta as linhas Imobilizado Inicial/Líq do Balanço (antes manuais).
--
-- Regra: cada ativo entra com valor cheio no mês de aquisição e deprecia um valor
-- FIXO/mês (juros simples) = valor * taxa_anual/1200. Depreciação começa no mês
-- SEGUINTE à compra (meses decorridos = 0 no mês da compra). Dura 1200/taxa_anual
-- meses (120 p/ 10% a.a.); valor contábil tem piso 0. Cada ativo é independente.
-- tipo='inicial' = base de abertura (Imobilizado Inicial);
-- tipo='reinvestimento' = compras novas (Imobilizado Líq).

CREATE TABLE IF NOT EXISTS financial.imobilizado_ativos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bar_id integer NOT NULL,
  descricao text NOT NULL,
  valor numeric NOT NULL,
  data_aquisicao date NOT NULL,
  tipo text NOT NULL DEFAULT 'reinvestimento' CHECK (tipo IN ('inicial','reinvestimento')),
  taxa_anual numeric NOT NULL DEFAULT 10,
  ativo boolean NOT NULL DEFAULT true,
  observacao text,
  criado_em timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_imobilizado_bar ON financial.imobilizado_ativos (bar_id, ativo);
GRANT SELECT, INSERT, UPDATE, DELETE ON financial.imobilizado_ativos TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_imobilizado(p_bar_id integer, p_ano integer, p_mes integer)
RETURNS TABLE(imob_inicial numeric, imob_liq numeric)
LANGUAGE sql STABLE SET search_path TO 'public','financial' AS $$
  WITH calc AS (
    SELECT
      a.tipo,
      ((p_ano*12 + p_mes) - (EXTRACT(YEAR FROM a.data_aquisicao)::int*12 + EXTRACT(MONTH FROM a.data_aquisicao)::int)) AS meses,
      a.valor,
      (a.valor * a.taxa_anual / 1200.0) AS dep_mensal,
      ROUND(1200.0 / NULLIF(a.taxa_anual,0)) AS meses_total
    FROM financial.imobilizado_ativos a
    WHERE a.bar_id = p_bar_id AND a.ativo
  )
  SELECT
    COALESCE(SUM(GREATEST(valor - dep_mensal * LEAST(GREATEST(meses,0), meses_total), 0)) FILTER (WHERE tipo='inicial' AND meses >= 0), 0),
    COALESCE(SUM(GREATEST(valor - dep_mensal * LEAST(GREATEST(meses,0), meses_total), 0)) FILTER (WHERE tipo='reinvestimento' AND meses >= 0), 0)
  FROM calc;
$$;
GRANT EXECUTE ON FUNCTION public.get_imobilizado(integer,integer,integer) TO authenticated, service_role, anon;
