-- Corte ALMOÇO × NOITE do faturamento — pedido do Rodrigo (04/08/2026):
--   "no sábado, quanto de faturamento foi feijuca e quanto foi a noite?"
--
-- O dado por hora já existia (silver.faturamento_hora, ContaHub, desde out/2024), mas os blocos
-- prontos da curva horária começam às 17h — o almoço não tinha bloco nenhum. Aqui o dia é partido
-- por uma JANELA DE ALMOÇO parametrizável e devolvido por data.
--
-- JANELA (correção de 04/08/2026): almoço = [p_ini_almoco, p_corte), padrão 11h–18h. A 1ª versão
-- usava 6h como início e isso fazia a ABERTURA DA CASA virar "almoço" nos dias em que não há almoço:
-- domingo só tinha venda às 16h/17h (R$ 2.539/dia às 17h) e aparecia como almoço, quinta idem
-- (R$ 369 às 17h). Só o sábado tem almoço de verdade no Ordinário — 12h às 17h, R$ 900 a 3.200/hora.
-- O que sobra antes de p_ini_almoco vai para `fat_fora` (não some da conta: dá pra somar e bater
-- com o faturamento do dia).
--
-- `fat_almoco_cedo` (p_ini_almoco → 15h) é o detector de "esse dia teve almoço mesmo?", sem chumbar
-- sábado na regra: dia com almoço vende no miolo do almoço (sáb 02/08 vende de 12h em diante); dia
-- que só abre à tarde, não (dom 02/08 tem 1ª venda às 16h; qui 30/07 às 17h). A tela usa isso pra
-- não chamar de "almoço" o que é abertura da casa.
--
-- noite = hora >= p_corte OU hora < 6 — a madrugada pertence ao dia gerencial anterior e é noite,
-- não almoço do dia seguinte. `hora` pode vir > 23 no ContaHub (24/25/26 = madrugada), daí o mod 24.
--
-- FONTES: faturamento (silver.faturamento_hora, hora do LANÇAMENTO do item — comanda aberta 14h que
-- fecha 22h fica distribuída certo); pessoas/comandas (bronze avendas vendasperiodo, pela hora de
-- ABERTURA da comanda — a mesa é creditada ao turno em que sentou); produto âncora do almoço
-- (p_produto, ILIKE em prd_desc) pra separar "feijoada" do resto do almoço.
--
-- RESSALVA: só ContaHub. Evento com bilheteria/venda Yuzer ou Sympla não entra no faturamento_hora.

-- A assinatura mudou (ganhou p_ini_almoco) — DROP antes do CREATE pra não deixar sobrecarga velha.
DROP FUNCTION IF EXISTS operations.fn_dia_noite(int, date, date, int, text);
DROP FUNCTION IF EXISTS operations.fn_dia_noite(int, date, date, int, text, int);

CREATE OR REPLACE FUNCTION operations.fn_dia_noite(
  p_bar_id     int,
  p_ini        date,
  p_fim        date,
  p_corte      int  DEFAULT 18,
  p_produto    text DEFAULT NULL,
  p_ini_almoco int  DEFAULT 11
)
RETURNS TABLE (
  data             date,
  fat_dia          numeric,
  fat_noite        numeric,
  fat_fora         numeric,
  fat_almoco_cedo  numeric,
  pessoas_dia      numeric,
  pessoas_noite    numeric,
  comandas_dia     bigint,
  comandas_noite   bigint,
  prod_qtd         numeric,
  prod_valor       numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH fat AS (
    SELECT
      f.data_venda AS d,
      SUM(f.valor) FILTER (
        WHERE mod(f.hora::int, 24) >= p_ini_almoco AND mod(f.hora::int, 24) < p_corte
      ) AS f_dia,
      SUM(f.valor) FILTER (
        WHERE mod(f.hora::int, 24) >= p_corte OR mod(f.hora::int, 24) < 6
      ) AS f_noite,
      SUM(f.valor) FILTER (
        WHERE mod(f.hora::int, 24) >= 6 AND mod(f.hora::int, 24) < p_ini_almoco
      ) AS f_fora,
      SUM(f.valor) FILTER (
        WHERE mod(f.hora::int, 24) >= p_ini_almoco AND mod(f.hora::int, 24) < 15
      ) AS f_almoco_cedo
    FROM silver.faturamento_hora f
    WHERE f.bar_id = p_bar_id
      AND f.data_venda BETWEEN p_ini AND p_fim
    GROUP BY 1
  ),
  pes AS (
    SELECT
      v.vd_dtgerencial AS d,
      SUM(v.vd_pessoas) FILTER (WHERE EXTRACT(HOUR FROM v.vd_hrabertura) >= p_ini_almoco AND EXTRACT(HOUR FROM v.vd_hrabertura) < p_corte) AS p_dia,
      SUM(v.vd_pessoas) FILTER (WHERE EXTRACT(HOUR FROM v.vd_hrabertura) >= p_corte OR EXTRACT(HOUR FROM v.vd_hrabertura) < 6)              AS p_noite,
      COUNT(*)          FILTER (WHERE EXTRACT(HOUR FROM v.vd_hrabertura) >= p_ini_almoco AND EXTRACT(HOUR FROM v.vd_hrabertura) < p_corte) AS c_dia,
      COUNT(*)          FILTER (WHERE EXTRACT(HOUR FROM v.vd_hrabertura) >= p_corte OR EXTRACT(HOUR FROM v.vd_hrabertura) < 6)              AS c_noite
    FROM bronze.bronze_contahub_avendas_vendasperiodo v
    WHERE v.bar_id = p_bar_id
      AND v.vd_dtgerencial BETWEEN p_ini AND p_fim
      AND v.vd_hrabertura IS NOT NULL
    GROUP BY 1
  ),
  prod AS (
    SELECT
      a.trn_dtgerencial::date AS d,
      SUM(a.qtd)        AS qtd,
      SUM(a.valorfinal) AS valor
    FROM bronze.bronze_contahub_avendas_porproduto_analitico a
    WHERE p_produto IS NOT NULL
      AND a.bar_id = p_bar_id
      AND a.trn_dtgerencial::date BETWEEN p_ini AND p_fim
      AND a.prd_desc ILIKE '%' || p_produto || '%'
    GROUP BY 1
  )
  SELECT
    COALESCE(fat.d, pes.d, prod.d)      AS data,
    COALESCE(fat.f_dia, 0)              AS fat_dia,
    COALESCE(fat.f_noite, 0)            AS fat_noite,
    COALESCE(fat.f_fora, 0)             AS fat_fora,
    COALESCE(fat.f_almoco_cedo, 0)      AS fat_almoco_cedo,
    COALESCE(pes.p_dia, 0)              AS pessoas_dia,
    COALESCE(pes.p_noite, 0)            AS pessoas_noite,
    COALESCE(pes.c_dia, 0)              AS comandas_dia,
    COALESCE(pes.c_noite, 0)            AS comandas_noite,
    COALESCE(prod.qtd, 0)               AS prod_qtd,
    COALESCE(prod.valor, 0)             AS prod_valor
  FROM fat
  FULL JOIN pes  ON pes.d  = fat.d
  FULL JOIN prod ON prod.d = COALESCE(fat.d, pes.d)
  ORDER BY 1;
$$;

REVOKE ALL ON FUNCTION operations.fn_dia_noite(int, date, date, int, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION operations.fn_dia_noite(int, date, date, int, text, int) TO service_role;
