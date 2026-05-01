-- 2026-05-01: Auto-classificacao de consumos (5 categorias) com tabela editavel
--
-- Substitui regex hardcoded em get_consumos_classificados_semana por lookup
-- na tabela financial.consumos_keywords (editavel pela equipe RH/Financeiro
-- via UI sem precisar de migration). Adiciona funcao classificar_consumo()
-- e get_consumos_sem_categoria_semana() para suportar UI de pendencias.
--
-- Categorias: socios, artistas, funcionarios_operacao, funcionarios_escritorio, clientes
-- (mais '_descartado' para erro abertura, arredondamento, etc.)
--
-- Cobertura abril/2026 Ord apos seed: 97.8% itens / 97.4% R$
--   (vs 94% no regex hardcoded — ganho R$ 3.483/mes)
--
-- Validacao S17 Ord:
--   socios:    R$ 39.95   (bateu manual)
--   artistas:  R$ 13207
--   clientes:  R$ 2427
--   op:        R$ 2344
--   escrit:    R$ 15

CREATE TABLE IF NOT EXISTS financial.consumos_keywords (
  id            SERIAL PRIMARY KEY,
  pattern       TEXT NOT NULL,
  categoria     TEXT NOT NULL,
  prioridade    INT NOT NULL DEFAULT 100,
  bar_id        INT NULL,
  descricao     TEXT,
  exemplo       TEXT,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (categoria IN ('socios','artistas','funcionarios_operacao','funcionarios_escritorio','clientes','_descartado'))
);

CREATE INDEX IF NOT EXISTS idx_consumos_keywords_lookup
  ON financial.consumos_keywords (prioridade, categoria) WHERE ativo;

COMMENT ON TABLE financial.consumos_keywords IS
  'Keywords pra classificar consumos do ContaHub. Padrao POSIX regex, comparado contra unaccent(lower(mesa || motivo)). Menor prioridade = avaliada primeiro. bar_id NULL = vale pra todos.';

-- Funcao de classificacao (lookup na tabela)
CREATE OR REPLACE FUNCTION public.classificar_consumo(
  p_mesa TEXT, p_motivo TEXT, p_bar_id INT
)
RETURNS TEXT
LANGUAGE sql STABLE AS $$
  SELECT k.categoria
  FROM financial.consumos_keywords k
  WHERE k.ativo
    AND (k.bar_id IS NULL OR k.bar_id = p_bar_id)
    AND unaccent(LOWER(p_mesa || ' ' || COALESCE(p_motivo, ''))) ~ k.pattern
  ORDER BY k.prioridade, k.id
  LIMIT 1;
$$;

-- Refatorar get_consumos_classificados_semana pra usar lookup table
CREATE OR REPLACE FUNCTION public.get_consumos_classificados_semana(
  input_bar_id integer, input_data_inicio date, input_data_fim date
)
RETURNS TABLE(categoria text, total numeric)
LANGUAGE plpgsql AS $function$
BEGIN
  RETURN QUERY
  WITH periodo_com_motivo AS (
    SELECT DISTINCT ON (vd_mesadesc) vd_mesadesc as mesa_p, vd_motivodesconto as motivo_p
    FROM bronze.bronze_contahub_avendas_vendasperiodo
    WHERE bar_id = input_bar_id
      AND vd_dtgerencial >= input_data_inicio
      AND vd_dtgerencial <= input_data_fim
      AND vd_motivodesconto IS NOT NULL AND vd_motivodesconto != ''
    ORDER BY vd_mesadesc, vd_dtgerencial DESC
  ),
  consumos_com_categoria AS (
    SELECT
      ca.desconto,
      public.classificar_consumo(ca.vd_mesadesc, p.motivo_p, input_bar_id) AS cat
    FROM bronze.bronze_contahub_avendas_porproduto_analitico ca
    LEFT JOIN periodo_com_motivo p ON ca.vd_mesadesc = p.mesa_p
    WHERE ca.bar_id = input_bar_id
      AND ca.trn_dtgerencial >= input_data_inicio
      AND ca.trn_dtgerencial <= input_data_fim
      AND ca.valorfinal = 0 AND ca.desconto > 0
  )
  SELECT cat, ROUND(SUM(desconto)::numeric, 2)
  FROM consumos_com_categoria
  WHERE cat IS NOT NULL AND cat != '_descartado'
  GROUP BY cat ORDER BY cat;
END;
$function$;

-- Funcao auxiliar pra UI: lista descontos SEM categoria (pra RH classificar)
CREATE OR REPLACE FUNCTION public.get_consumos_sem_categoria_semana(
  input_bar_id integer, input_data_inicio date, input_data_fim date
)
RETURNS TABLE(mesa text, motivo text, qtd_itens bigint, total_desconto numeric)
LANGUAGE plpgsql AS $function$
BEGIN
  RETURN QUERY
  WITH periodo_com_motivo AS (
    SELECT DISTINCT ON (vd_mesadesc) vd_mesadesc as mesa_p, vd_motivodesconto as motivo_p
    FROM bronze.bronze_contahub_avendas_vendasperiodo
    WHERE bar_id = input_bar_id
      AND vd_dtgerencial >= input_data_inicio
      AND vd_dtgerencial <= input_data_fim
      AND vd_motivodesconto IS NOT NULL AND vd_motivodesconto != ''
    ORDER BY vd_mesadesc, vd_dtgerencial DESC
  )
  SELECT
    ca.vd_mesadesc::text,
    COALESCE(p.motivo_p, '(sem motivo)')::text,
    COUNT(*),
    ROUND(SUM(ca.desconto)::numeric, 2)
  FROM bronze.bronze_contahub_avendas_porproduto_analitico ca
  LEFT JOIN periodo_com_motivo p ON ca.vd_mesadesc = p.mesa_p
  WHERE ca.bar_id = input_bar_id
    AND ca.trn_dtgerencial >= input_data_inicio
    AND ca.trn_dtgerencial <= input_data_fim
    AND ca.valorfinal = 0 AND ca.desconto > 0
    AND public.classificar_consumo(ca.vd_mesadesc, p.motivo_p, input_bar_id) IS NULL
  GROUP BY 1, 2
  ORDER BY 4 DESC;
END;
$function$;

-- Atualizar agregar_cmv_mensal_auto: 5 categorias (op + esc separados)
CREATE OR REPLACE FUNCTION public.agregar_cmv_mensal_auto(p_bar_id integer, p_ano integer, p_mes integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_data_inicio date := make_date(p_ano, p_mes, 1);
  v_data_fim date := (make_date(p_ano, p_mes, 1) + INTERVAL '1 month' - INTERVAL '1 day')::date;
  v_compras_comida numeric := 0; v_compras_bebidas numeric := 0;
  v_compras_drinks numeric := 0; v_compras_outros numeric := 0;
  v_compras_alim numeric := 0; v_compras_total numeric := 0;
  v_faturamento numeric := 0; v_comissao numeric := 0; v_couvert numeric := 0;
  v_fat_cmvivel numeric := 0;
  v_consumo_socios numeric := 0; v_consumo_clientes numeric := 0;
  v_consumo_artistas numeric := 0;
  v_consumo_op numeric := 0; v_consumo_esc numeric := 0;
  v_consumo_total numeric := 0; v_fator numeric := 1;
  v_estoque_inicial numeric := 0; v_estoque_final numeric := 0;
  v_estoque_inicial_func numeric := 0; v_estoque_final_func numeric := 0;
  v_cmv_real numeric := 0; v_cmv_pct numeric := 0; v_cma_total numeric := 0;
BEGIN
  SELECT cmv_fator_consumo::numeric INTO v_fator
  FROM operations.bar_regras_negocio WHERE bar_id = p_bar_id LIMIT 1;
  v_fator := COALESCE(v_fator, 1);

  SELECT
    COALESCE(SUM(valor_bruto) FILTER (WHERE categoria_nome ILIKE '%custo comida%'), 0),
    COALESCE(SUM(valor_bruto) FILTER (WHERE categoria_nome ILIKE '%custo bebida%'), 0),
    COALESCE(SUM(valor_bruto) FILTER (WHERE categoria_nome ILIKE '%custo drink%'), 0),
    COALESCE(SUM(valor_bruto) FILTER (WHERE categoria_nome ILIKE '%custo outros%'), 0),
    COALESCE(SUM(valor_bruto) FILTER (WHERE categoria_nome ILIKE '%alimenta%'), 0)
  INTO v_compras_comida, v_compras_bebidas, v_compras_drinks, v_compras_outros, v_compras_alim
  FROM silver.contaazul_lancamentos_diarios
  WHERE bar_id = p_bar_id
    AND data_competencia BETWEEN v_data_inicio AND v_data_fim
    AND tipo = 'DESPESA';

  v_compras_total := v_compras_comida + v_compras_bebidas + v_compras_drinks + v_compras_outros;

  SELECT COALESCE(SUM(faturamento_total_consolidado), 0) INTO v_faturamento
  FROM gold.planejamento WHERE bar_id = p_bar_id AND data_evento BETWEEN v_data_inicio AND v_data_fim;

  SELECT comissao, couvert INTO v_comissao, v_couvert
  FROM public.get_comissao_couvert_periodo(p_bar_id, v_data_inicio, v_data_fim);

  v_fat_cmvivel := v_faturamento - COALESCE(v_comissao, 0) - COALESCE(v_couvert, 0);

  SELECT
    COALESCE(SUM(total) FILTER (WHERE categoria='socios'), 0) * v_fator,
    COALESCE(SUM(total) FILTER (WHERE categoria='clientes'), 0) * v_fator,
    COALESCE(SUM(total) FILTER (WHERE categoria='artistas'), 0) * v_fator,
    COALESCE(SUM(total) FILTER (WHERE categoria='funcionarios_operacao'), 0) * v_fator,
    COALESCE(SUM(total) FILTER (WHERE categoria='funcionarios_escritorio'), 0) * v_fator
  INTO v_consumo_socios, v_consumo_clientes, v_consumo_artistas, v_consumo_op, v_consumo_esc
  FROM public.get_consumos_classificados_semana(p_bar_id, v_data_inicio, v_data_fim);

  v_consumo_total := v_consumo_socios + v_consumo_clientes + v_consumo_artistas + v_consumo_op + v_consumo_esc;

  SELECT estoque_inicial, estoque_inicial_funcionarios
  INTO v_estoque_inicial, v_estoque_inicial_func
  FROM financial.cmv_semanal
  WHERE bar_id = p_bar_id
    AND EXTRACT(month FROM (date_trunc('week', make_date(ano, 1, 4)) + ((semana-1)*INTERVAL '1 week') + INTERVAL '3 days')::date) = p_mes
    AND EXTRACT(year FROM (date_trunc('week', make_date(ano, 1, 4)) + ((semana-1)*INTERVAL '1 week') + INTERVAL '3 days')::date) = p_ano
  ORDER BY ano ASC, semana ASC LIMIT 1;

  SELECT estoque_final, estoque_final_funcionarios
  INTO v_estoque_final, v_estoque_final_func
  FROM financial.cmv_semanal
  WHERE bar_id = p_bar_id
    AND EXTRACT(month FROM (date_trunc('week', make_date(ano, 1, 4)) + ((semana-1)*INTERVAL '1 week') + INTERVAL '3 days')::date) = p_mes
    AND EXTRACT(year FROM (date_trunc('week', make_date(ano, 1, 4)) + ((semana-1)*INTERVAL '1 week') + INTERVAL '3 days')::date) = p_ano
    AND estoque_final > 0
  ORDER BY ano DESC, semana DESC LIMIT 1;

  v_estoque_inicial := COALESCE(v_estoque_inicial, 0);
  v_estoque_final := COALESCE(v_estoque_final, 0);
  v_estoque_inicial_func := COALESCE(v_estoque_inicial_func, 0);
  v_estoque_final_func := COALESCE(v_estoque_final_func, 0);

  v_cmv_real := v_estoque_inicial + v_compras_total - v_estoque_final - v_consumo_total;
  v_cmv_pct := CASE WHEN v_fat_cmvivel > 0 THEN (v_cmv_real / v_fat_cmvivel * 100) ELSE 0 END;
  v_cma_total := v_compras_alim + v_estoque_inicial_func - v_estoque_final_func;

  INSERT INTO financial.cmv_mensal (
    bar_id, ano, mes, data_inicio, data_fim,
    estoque_inicial, estoque_final,
    compras, compras_alimentacao,
    consumo_socios, consumo_beneficios, consumo_rh_operacao, consumo_rh_escritorio, consumo_artista,
    cmv_real, faturamento_cmvivel, cmv_real_percentual, cmv_limpo_percentual,
    faturamento_total,
    estoque_inicial_funcionarios, estoque_final_funcionarios, cma_total,
    fonte, updated_at, created_at
  ) VALUES (
    p_bar_id, p_ano, p_mes, v_data_inicio, v_data_fim,
    v_estoque_inicial, v_estoque_final,
    v_compras_total, v_compras_alim,
    v_consumo_socios, v_consumo_clientes, v_consumo_op, v_consumo_esc, v_consumo_artistas,
    v_cmv_real, v_fat_cmvivel, v_cmv_pct, v_cmv_pct,
    v_faturamento,
    v_estoque_inicial_func, v_estoque_final_func, v_cma_total,
    'auto-agregado', NOW(), NOW()
  )
  ON CONFLICT (bar_id, ano, mes) DO UPDATE SET
    data_inicio = EXCLUDED.data_inicio,
    data_fim = EXCLUDED.data_fim,
    estoque_inicial = EXCLUDED.estoque_inicial,
    estoque_final = EXCLUDED.estoque_final,
    compras = EXCLUDED.compras,
    compras_alimentacao = EXCLUDED.compras_alimentacao,
    consumo_socios = EXCLUDED.consumo_socios,
    consumo_beneficios = EXCLUDED.consumo_beneficios,
    consumo_rh_operacao = EXCLUDED.consumo_rh_operacao,
    consumo_rh_escritorio = EXCLUDED.consumo_rh_escritorio,
    consumo_artista = EXCLUDED.consumo_artista,
    cmv_real = EXCLUDED.cmv_real,
    faturamento_cmvivel = EXCLUDED.faturamento_cmvivel,
    cmv_real_percentual = EXCLUDED.cmv_real_percentual,
    cmv_limpo_percentual = EXCLUDED.cmv_limpo_percentual,
    faturamento_total = EXCLUDED.faturamento_total,
    estoque_inicial_funcionarios = EXCLUDED.estoque_inicial_funcionarios,
    estoque_final_funcionarios = EXCLUDED.estoque_final_funcionarios,
    cma_total = EXCLUDED.cma_total,
    fonte = EXCLUDED.fonte,
    updated_at = NOW();
END;
$function$;

-- Seed inicial: 109 keywords (consolidando regex hardcoded + novos padroes
-- encontrados na auditoria abril/2026 — Reconvexa, Pagode da Gigi, Permuta
-- bistro, Isaias, despedida solteiro, social midia sem acento, etc).
-- Aplicado direto via UI/MCP — apply_migration. Ver historico em
-- consumos_keywords_seed_v1.sql se precisar replicar em outro ambiente.
