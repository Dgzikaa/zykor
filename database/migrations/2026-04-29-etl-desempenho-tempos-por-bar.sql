-- 2026-04-29 v7: Tempos por bar conforme planilha Excel do socio.
--
-- Socio enviou as formulas do Excel (planilha IMPORTRANGES) que filtram
-- por loc_desc específico e usam coluna de tempo diferente por bar:
--
-- Bar 3 (Ord):
--   tempo_drinks = AVG(t0_t3) WHERE loc_desc IN
--     ('Montados','Shot e Dose','Batidos','Mexido','Preshh') AND t0_t3>0
--   tempo_cozinha = AVG(t0_t2) WHERE loc_desc IN ('Cozinha 1','Cozinha 2') AND t0_t2>0
--
-- Bar 4 (Deb):
--   tempo_drinks = AVG(t0_t3) WHERE loc_desc='Bar' AND t0_t3>0
--   tempo_cozinha = AVG(t0_t3) WHERE loc_desc IN ('Cozinha','Cozinha 2') AND t0_t3>0
--
-- Diferenca entre os bares:
--   1. loc_desc: Ord tem estações Montados/Shot/etc, Deb usa loc='Bar' pra drinks
--   2. coluna cozinha: Ord usa t0_t2 (operador bate fim-prod), Deb usa t0_t3
--      (operador nao bate fim-prod, t0_t2 quase sempre 0)
--
-- Validacao final vs Excel (todas exatas ou off by 0.1 = arredondamento):
--   Ord S16 drk 3.5/3.5 ✓  coz 11.3/11.3 ✓
--   Ord S17 drk 3.0/3.0 ✓  coz 9.2/9.2 ✓
--   Deb S16 drk 4.9/5.0 ≈  coz 8.1/8.1 ✓
--   Deb S17 drk 6.3/6.3 ✓  coz 8.5/8.5 ✓
--
-- Atrasinho/atrasao seguem mesma regra de seleção. versao_etl 6 → 7.

CREATE OR REPLACE FUNCTION public.etl_gold_desempenho_semanal(p_bar_id integer, p_ano integer, p_semana integer)
 RETURNS TABLE(bar_processado integer, periodo_processado text, linhas_inseridas integer, duracao_ms integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'gold', 'silver', 'bronze', 'meta'
AS $function$
DECLARE
  v_start timestamptz := clock_timestamp();
  v_data_inicio date;
  v_data_fim date;
  v_periodo text;
  v_inseridos integer := 0;
  v_locs_drinks text[];
  v_locs_cozinha text[];
  v_uses_t0t2_cozinha boolean;
BEGIN
  IF p_bar_id IS NULL OR p_ano IS NULL OR p_semana IS NULL THEN
    RAISE EXCEPTION 'Parametros obrigatorios';
  END IF;

  -- Configuracao por bar (espelha de/para da planilha Excel)
  IF p_bar_id = 3 THEN
    -- Ord: DRINK = Preshh+Montados+Mexido+Drinks+Drinks Autorais+Shot e Dose+Batidos
    --      COMIDA = Cozinha+Cozinha 1+Cozinha 2
    v_locs_drinks := ARRAY['Preshh','Montados','Mexido','Drinks','Drinks Autorais','Shot e Dose','Batidos'];
    v_locs_cozinha := ARRAY['Cozinha','Cozinha 1','Cozinha 2'];
    v_uses_t0t2_cozinha := true;
  ELSIF p_bar_id = 4 THEN
    v_locs_drinks := ARRAY['Bar'];
    v_locs_cozinha := ARRAY['Cozinha','Cozinha 2'];
    v_uses_t0t2_cozinha := false;
  ELSE
    v_locs_drinks := NULL;
    v_locs_cozinha := NULL;
    v_uses_t0t2_cozinha := false;
  END IF;

  SELECT
    (date_trunc('week', make_date(p_ano, 1, 4)) + ((p_semana - 1) * INTERVAL '1 week'))::date,
    (date_trunc('week', make_date(p_ano, 1, 4)) + ((p_semana - 1) * INTERVAL '1 week') + INTERVAL '6 days')::date
  INTO v_data_inicio, v_data_fim;

  v_periodo := 'S' || LPAD(p_semana::text, 2, '0') || '/' || RIGHT(p_ano::text, 2);

  WITH fase_planejamento AS (
    SELECT
      COALESCE(SUM(faturamento_total_consolidado), 0) as faturamento_total,
      COALESCE(SUM(faturamento_entrada_yuzer), 0) as faturamento_entrada,
      COALESCE(SUM(real_r), 0) as faturamento_bar,
      COALESCE(SUM(faturamento_couvert), 0) as couvert_atracoes,
      COALESCE(SUM(publico_real_consolidado), 0) as clientes_atendidos,
      (COALESCE(SUM(faturamento_total_consolidado), 0) / NULLIF(SUM(publico_real_consolidado), 0))::numeric(10,2) as ticket_medio,
      (COALESCE(SUM(faturamento_couvert), 0) / NULLIF(SUM(publico_real_consolidado), 0))::numeric(10,2) as tm_entrada,
      ((COALESCE(SUM(faturamento_total_consolidado), 0) - COALESCE(SUM(faturamento_couvert), 0)) / NULLIF(SUM(publico_real_consolidado), 0))::numeric(10,2) as tm_bar,
      COALESCE(SUM(res_tot), 0) as reservas_totais,
      COALESCE(SUM(res_p), 0) as reservas_presentes,
      NULL::numeric(5,2) as perc_fat_ate_19h,
      NULL::numeric(5,2) as perc_fat_apos_22h,
      COALESCE(SUM(faturamento_total_consolidado) FILTER (WHERE EXTRACT(dow FROM data_evento) IN (4, 6, 0)), 0) as qui_sab_dom,
      COALESCE(SUM(faturamento_total_consolidado) FILTER (WHERE EXTRACT(dow FROM data_evento) IN (2, 3, 4)), 0) as ter_qua_qui,
      COALESCE(SUM(faturamento_total_consolidado) FILTER (WHERE EXTRACT(dow FROM data_evento) IN (5, 6)), 0) as sex_sab
    FROM gold.planejamento
    WHERE planejamento.bar_id = p_bar_id
      AND data_evento BETWEEN v_data_inicio AND v_data_fim
  ),
  fase_clientes AS (
    SELECT
      COALESCE((SELECT total_ativos FROM gold.clientes_diario cd WHERE cd.bar_id = p_bar_id AND cd.data_referencia = v_data_fim), 0) as clientes_ativos,
      (SELECT CASE WHEN SUM(total_clientes_unicos_dia) > 0 THEN (SUM(novos_clientes_dia)::numeric / SUM(total_clientes_unicos_dia) * 100)::numeric(5,2) END
       FROM gold.clientes_diario cd2 WHERE cd2.bar_id = p_bar_id AND cd2.data_referencia BETWEEN v_data_inicio AND v_data_fim) as perc_clientes_novos
  ),
  fase_cmv AS (
    SELECT compras_periodo, faturamento_cmvivel,
      COALESCE(compras_periodo - COALESCE(vr_repique, 0), 0) as cmv_limpo_calc,
      CASE WHEN faturamento_cmvivel > 0 THEN ((COALESCE(compras_periodo - vr_repique, compras_periodo) / faturamento_cmvivel) * 100)::numeric(6,2) END as cmv_percentual_calc
    FROM gold.cmv WHERE cmv.bar_id = p_bar_id AND cmv.ano = p_ano AND cmv.semana = p_semana LIMIT 1
  ),
  fase_nps_geral AS (
    SELECT CASE WHEN SUM(total_respostas) > 0 THEN ((SUM(promotores) - SUM(detratores)) * 100.0 / SUM(total_respostas))::numeric(6,2) END as nps_geral,
      COALESCE(SUM(total_respostas), 0) as nps_respostas
    FROM silver.nps_diario
    WHERE bar_id = p_bar_id AND data_referencia BETWEEN v_data_inicio AND v_data_fim
  ),
  fase_nps_digital AS (
    SELECT CASE WHEN COUNT(*) > 0 THEN ((COUNT(*) FILTER (WHERE nps >= 9) - COUNT(*) FILTER (WHERE nps <= 6)) * 100.0 / COUNT(*))::numeric(6,2) END as nps_digital,
      COUNT(*)::integer as nps_digital_respostas
    FROM bronze.bronze_falae_respostas WHERE bar_id = p_bar_id AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_data_inicio AND v_data_fim AND search_name = 'NPS Digital'
  ),
  fase_nps_salao AS (
    SELECT CASE WHEN COUNT(*) > 0 THEN ((COUNT(*) FILTER (WHERE nps >= 9) - COUNT(*) FILTER (WHERE nps <= 6)) * 100.0 / COUNT(*))::numeric(6,2) END as nps_salao,
      COUNT(*)::integer as nps_salao_respostas
    FROM bronze.bronze_falae_respostas WHERE bar_id = p_bar_id AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_data_inicio AND v_data_fim AND search_name = 'Salão'
  ),
  fase_nps_reservas AS (
    SELECT CASE WHEN SUM((respostas_por_pesquisa->'(reserva getin)'->>'total')::integer) > 0 THEN (SUM((respostas_por_pesquisa->'(reserva getin)'->>'total')::integer * (respostas_por_pesquisa->'(reserva getin)'->>'nps_medio')::numeric) / SUM((respostas_por_pesquisa->'(reserva getin)'->>'total')::integer))::numeric(5,2) END as nps_reservas,
      COALESCE(SUM((respostas_por_pesquisa->'(reserva getin)'->>'total')::integer), 0) as nps_reservas_respostas
    FROM silver.nps_diario WHERE bar_id = p_bar_id AND data_referencia BETWEEN v_data_inicio AND v_data_fim AND respostas_por_pesquisa ? '(reserva getin)'
  ),
  fase_nps_criterios AS (
    SELECT AVG((criterios_medios->>'Atendimento')::numeric)::numeric(5,2) as nps_atendimento, AVG((criterios_medios->>'Ambiente')::numeric)::numeric(5,2) as nps_ambiente, AVG((criterios_medios->>'Drinks')::numeric)::numeric(5,2) as nps_drink, AVG((criterios_medios->>'Qualidade do Produto')::numeric)::numeric(5,2) as nps_comida, AVG((criterios_medios->>'Limpeza')::numeric)::numeric(5,2) as nps_limpeza, AVG((criterios_medios->>'Custo benefício')::numeric)::numeric(5,2) as nps_preco, AVG((criterios_medios->>'MÚSICA')::numeric)::numeric(5,2) as nps_musica
    FROM silver.nps_diario nps WHERE nps.bar_id = p_bar_id AND nps.data_referencia BETWEEN v_data_inicio AND v_data_fim AND nps.criterios_medios IS NOT NULL
  ),
  -- FIX 2026-04-29 v7: por loc_desc + coluna especifica por bar (espelha Excel)
  fase_tempos_agg AS (
    SELECT
      CASE WHEN COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_drinks) AND t0_t3 BETWEEN 1 AND 3600) > 0
        THEN AVG(t0_t3) FILTER (WHERE local_desc = ANY(v_locs_drinks) AND t0_t3 BETWEEN 1 AND 3600)::numeric(8,2) END as tempo_drinks,
      CASE WHEN COUNT(*) FILTER (WHERE categoria = 'bebida' AND t0_t3 > 0) > 0
        THEN AVG(t0_t3) FILTER (WHERE categoria = 'bebida' AND t0_t3 > 0)::numeric(8,2) END as tempo_bebidas,
      CASE WHEN v_uses_t0t2_cozinha THEN
        CASE WHEN COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_cozinha) AND t0_t2 BETWEEN 1 AND 3600) > 0
          THEN AVG(t0_t2) FILTER (WHERE local_desc = ANY(v_locs_cozinha) AND t0_t2 BETWEEN 1 AND 3600)::numeric(8,2) END
      ELSE
        CASE WHEN COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_cozinha) AND t0_t3 BETWEEN 1 AND 3600) > 0
          THEN AVG(t0_t3) FILTER (WHERE local_desc = ANY(v_locs_cozinha) AND t0_t3 BETWEEN 1 AND 3600)::numeric(8,2) END
      END as tempo_cozinha,
      COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_drinks) AND t0_t3 BETWEEN 1 AND 3600)::integer as qtd_drinks_total,
      CASE WHEN v_uses_t0t2_cozinha THEN
        COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_cozinha) AND t0_t2 BETWEEN 1 AND 3600)::integer
      ELSE
        COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_cozinha) AND t0_t3 BETWEEN 1 AND 3600)::integer
      END as qtd_comida_total,
      COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_drinks) AND t0_t3 BETWEEN 300 AND 600)::integer as atrasinho_drinks,
      COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_drinks) AND t0_t3 > 600)::integer as atrasao_drinks,
      CASE WHEN v_uses_t0t2_cozinha THEN
        COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_cozinha) AND t0_t2 BETWEEN 900 AND 1200)::integer
      ELSE
        COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_cozinha) AND t0_t3 BETWEEN 900 AND 1200)::integer
      END as atrasinho_cozinha,
      CASE WHEN v_uses_t0t2_cozinha THEN
        COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_cozinha) AND t0_t2 > 1200)::integer
      ELSE
        COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_cozinha) AND t0_t3 > 1200)::integer
      END as atrasao_cozinha,
      COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_drinks) AND t0_t3 > 600)::integer as atrasao_bar
    FROM silver.tempos_producao WHERE bar_id = p_bar_id AND data_producao BETWEEN v_data_inicio AND v_data_fim
  ),
  fase_mix AS (
    SELECT SUM(valor) as total, SUM(valor) FILTER (WHERE categoria_mix = 'BEBIDA') as fat_bebida, SUM(valor) FILTER (WHERE categoria_mix = 'DRINK') as fat_drink, SUM(valor) FILTER (WHERE categoria_mix = 'COMIDA') as fat_comida
    FROM silver.vendas_item WHERE bar_id = p_bar_id AND data_venda BETWEEN v_data_inicio AND v_data_fim
  ),
  fase_stockout_dia AS (
    SELECT data_consulta,
      CASE
        WHEN loc_desc IN ('Preshh','Montados','Mexido','Drinks','Drinks Autorais','Shot e Dose','Batidos') THEN 'Drinks'
        WHEN loc_desc IN ('Cozinha','Cozinha 1','Cozinha 2') THEN 'Comidas'
        WHEN loc_desc IN ('Chopp','Bar') THEN 'Bar'
      END as categoria_local,
      COUNT(DISTINCT prd) as total,
      COUNT(DISTINCT prd) FILTER (WHERE prd_venda = 'N') as stockout
    FROM gold.gold_contahub_operacional_stockout
    WHERE bar_id = p_bar_id AND data_consulta BETWEEN v_data_inicio AND v_data_fim
      AND loc_desc NOT IN ('Pegue e Pague','Venda Volante','Baldes','PP')
    GROUP BY data_consulta, categoria_local
    HAVING CASE WHEN loc_desc IN ('Preshh','Montados','Mexido','Drinks','Drinks Autorais','Shot e Dose','Batidos') THEN 'Drinks' WHEN loc_desc IN ('Cozinha','Cozinha 1','Cozinha 2') THEN 'Comidas' WHEN loc_desc IN ('Chopp','Bar') THEN 'Bar' END IS NOT NULL
  ),
  fase_stockout AS (
    SELECT AVG(stockout::numeric / NULLIF(total, 0) * 100) FILTER (WHERE categoria_local = 'Drinks')::numeric(5,2) as stockout_drinks_perc, AVG(stockout::numeric / NULLIF(total, 0) * 100) FILTER (WHERE categoria_local = 'Bar')::numeric(5,2) as stockout_bar_perc, AVG(stockout::numeric / NULLIF(total, 0) * 100) FILTER (WHERE categoria_local = 'Comidas')::numeric(5,2) as stockout_comidas_perc, AVG(stockout::numeric / NULLIF(total, 0) * 100)::numeric(5,2) as stockout_total_perc
    FROM fase_stockout_dia
  ),
  fase_google AS (
    SELECT COALESCE(SUM(qtd_5_estrelas), 0)::integer as avaliacoes_5_google_trip, AVG(stars_medio) FILTER (WHERE total_reviews > 0)::numeric(4,2) as media_avaliacoes_google, COALESCE(SUM(total_reviews), 0)::integer as google_reviews_total
    FROM silver.google_reviews_diario WHERE bar_id = p_bar_id AND data_referencia BETWEEN v_data_inicio AND v_data_fim
  ),
  fase_custos AS (
    SELECT COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%atra%' OR categoria_nome ILIKE '%produ%evento%'), 0)::numeric(14,2) as atracoes_eventos, COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%freela%'), 0)::numeric(14,2) as freelas, COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%material%' OR categoria_nome ILIKE '%limpeza%'), 0)::numeric(14,2) as materiais, COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%comiss%'), 0)::numeric(14,2) as comissao, COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%sal%rio%' OR categoria_nome ILIKE '%vale%transp%'), 0)::numeric(14,2) as cmo, COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%pro%labore%'), 0)::numeric(14,2) as pro_labore, COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%aluguel%' OR categoria_nome ILIKE '%iptu%' OR categoria_nome ILIKE '%condom%' OR categoria_nome ILIKE '%%gua%' OR categoria_nome ILIKE '%luz%'), 0)::numeric(14,2) as ocupacao_custo, COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%imposto%'), 0)::numeric(14,2) as imposto, COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%escrit%central%'), 0)::numeric(14,2) as escritorio_central, COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%marketing%'), 0)::numeric(14,2) as marketing_fixo, COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%taxa%maquin%'), 0)::numeric(14,2) as adm_fixo, COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%manuten%'), 0)::numeric(14,2) as manutencao, COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%utens%'), 0)::numeric(14,2) as utensilios, COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%alimenta%'), 0)::numeric(14,2) as alimentacao
    FROM silver.contaazul_lancamentos_diarios WHERE bar_id = p_bar_id AND data_competencia BETWEEN v_data_inicio AND v_data_fim AND tipo = 'DESPESA'
  ),
  fase_cancelamentos AS (
    SELECT COALESCE(SUM(custototal), 0)::numeric(14,2) as cancelamentos_total, COUNT(*)::integer as cancelamentos_qtd
    FROM bronze.bronze_contahub_avendas_cancelamentos WHERE bar_id = p_bar_id AND dt_gerencial BETWEEN v_data_inicio AND v_data_fim
  ),
  fase_fat_hora AS (
    SELECT
      SUM(valor)::numeric(14,2) as fat_total_hora,
      SUM(valor) FILTER (WHERE hora IN ('16:00', '17:00', '18:00'))::numeric(14,2) as fat_ate_19h,
      SUM(valor) FILTER (WHERE hora IN ('22:00', '23:00', '24:00', '25:00', '26:00', '27:00', '28:00'))::numeric(14,2) as fat_apos_22h
    FROM bronze.bronze_contahub_avendas_vendasdiahoraanalitico
    WHERE bar_id = p_bar_id
      AND vd_dtgerencial BETWEEN v_data_inicio AND v_data_fim
  ),
  fase_reservas_getin AS (
    SELECT
      COUNT(*) as reservas_totais_qtd,
      COUNT(*) FILTER (WHERE status NOT IN ('canceled-user','canceled-restaurant','canceled-agent','no-show') AND (no_show IS NULL OR no_show = false)) as reservas_presentes_qtd,
      COALESCE(SUM(people), 0) as reservas_totais_pes,
      COALESCE(SUM(people) FILTER (WHERE status NOT IN ('canceled-user','canceled-restaurant','canceled-agent','no-show') AND (no_show IS NULL OR no_show = false)), 0) as reservas_presentes_pes,
      CASE WHEN SUM(people) > 0 THEN
        ROUND(((SUM(people) - SUM(people) FILTER (WHERE status NOT IN ('canceled-user','canceled-restaurant','canceled-agent','no-show') AND (no_show IS NULL OR no_show = false)))::numeric / SUM(people) * 100), 2)
      END as reservas_quebra
    FROM bronze.bronze_getin_reservations
    WHERE bar_id = p_bar_id AND reservation_date BETWEEN v_data_inicio AND v_data_fim
  ),
  fase_marketing AS (
    SELECT * FROM meta.marketing_semanal WHERE bar_id = p_bar_id AND ano = p_ano AND semana = p_semana LIMIT 1
  )
  INSERT INTO gold.desempenho (
    bar_id, granularidade, periodo, ano, numero_semana, data_inicio, data_fim,
    faturamento_total, faturamento_entrada, faturamento_bar, couvert_atracoes, clientes_atendidos, ticket_medio, tm_entrada, tm_bar,
    reservas_totais, reservas_presentes, reservas_totais_quantidade, reservas_presentes_quantidade, reservas_totais_pessoas, reservas_presentes_pessoas, reservas_quebra_pct, qui_sab_dom, ter_qua_qui, sex_sab,
    perc_faturamento_ate_19h, perc_faturamento_apos_22h, clientes_ativos, perc_clientes_novos,
    cmv, cmv_limpo, cmv_percentual, faturamento_cmvivel,
    nps_geral, nps_respostas, nps_digital, nps_digital_respostas, nps_salao, nps_salao_respostas, nps_reservas, nps_reservas_respostas,
    nps_atendimento, nps_ambiente, nps_drink, nps_comida, nps_limpeza, nps_preco, nps_musica,
    tempo_drinks, tempo_bebidas, tempo_cozinha, qtd_drinks_total, qtd_comida_total,
    atrasinho_drinks, atrasao_drinks, atrasinho_cozinha, atrasao_cozinha, atrasao_bar, atrasos_drinks_perc, atrasos_comida_perc,
    perc_bebidas, perc_drinks, perc_comida,
    stockout_drinks_perc, stockout_bar_perc, stockout_comidas_perc, stockout_total_perc,
    avaliacoes_5_google_trip, media_avaliacoes_google, google_reviews_total,
    atracoes_eventos, freelas, materiais, comissao, cmo, pro_labore, ocupacao_custo, imposto, escritorio_central, marketing_fixo, adm_fixo, manutencao, utensilios, alimentacao,
    custos_variaveis, custos_fixos, custos_total, custo_atracao_faturamento, cancelamentos_total, cancelamentos_qtd,
    o_num_posts, o_num_stories, o_alcance, o_interacao, o_compartilhamento, o_engajamento, o_visu_stories,
    m_valor_investido, m_alcance, m_frequencia, m_cpm, m_cliques, m_ctr, m_custo_por_clique, m_conversas_iniciadas,
    calculado_em, versao_etl
  )
  SELECT p_bar_id, 'semanal', v_periodo, p_ano, p_semana, v_data_inicio, v_data_fim,
    p.faturamento_total, p.faturamento_entrada, p.faturamento_bar, p.couvert_atracoes, p.clientes_atendidos, p.ticket_medio, p.tm_entrada, p.tm_bar,
    p.reservas_totais, p.reservas_presentes, rg.reservas_totais_qtd, rg.reservas_presentes_qtd, rg.reservas_totais_pes, rg.reservas_presentes_pes, rg.reservas_quebra, p.qui_sab_dom, p.ter_qua_qui, p.sex_sab,
    CASE WHEN fh.fat_total_hora > 0 THEN (fh.fat_ate_19h / fh.fat_total_hora * 100)::numeric(5,2) END, CASE WHEN fh.fat_total_hora > 0 THEN (fh.fat_apos_22h / fh.fat_total_hora * 100)::numeric(5,2) END, COALESCE(c.clientes_ativos, 0), c.perc_clientes_novos,
    cmv.compras_periodo, cmv.cmv_limpo_calc, cmv.cmv_percentual_calc, cmv.faturamento_cmvivel,
    NULL::numeric(6,2), 0, nd.nps_digital, COALESCE(nd.nps_digital_respostas, 0), ns.nps_salao, COALESCE(ns.nps_salao_respostas, 0), nr.nps_reservas, COALESCE(nr.nps_reservas_respostas, 0),
    nc.nps_atendimento, nc.nps_ambiente, nc.nps_drink, nc.nps_comida, nc.nps_limpeza, nc.nps_preco, nc.nps_musica,
    t.tempo_drinks, t.tempo_bebidas, t.tempo_cozinha, t.qtd_drinks_total, t.qtd_comida_total,
    t.atrasinho_drinks, t.atrasao_drinks, t.atrasinho_cozinha, t.atrasao_cozinha, t.atrasao_bar,
    CASE WHEN t.qtd_drinks_total > 0 THEN (t.atrasao_drinks::numeric / t.qtd_drinks_total * 100)::numeric(5,2) END,
    CASE WHEN t.qtd_comida_total > 0 THEN (t.atrasao_cozinha::numeric / t.qtd_comida_total * 100)::numeric(5,2) END,
    CASE WHEN mx.total > 0 THEN (mx.fat_bebida / mx.total * 100)::numeric(5,2) END,
    CASE WHEN mx.total > 0 THEN (mx.fat_drink / mx.total * 100)::numeric(5,2) END,
    CASE WHEN mx.total > 0 THEN (mx.fat_comida / mx.total * 100)::numeric(5,2) END,
    stk.stockout_drinks_perc, stk.stockout_bar_perc, stk.stockout_comidas_perc, stk.stockout_total_perc,
    g.avaliacoes_5_google_trip, g.media_avaliacoes_google, g.google_reviews_total,
    ca.atracoes_eventos, ca.freelas, ca.materiais, ca.comissao, ca.cmo, ca.pro_labore, ca.ocupacao_custo, ca.imposto, ca.escritorio_central, ca.marketing_fixo, ca.adm_fixo, ca.manutencao, ca.utensilios, ca.alimentacao,
    (ca.atracoes_eventos + ca.freelas + ca.materiais + ca.manutencao + ca.utensilios + ca.alimentacao),
    (ca.comissao + ca.cmo + ca.pro_labore + ca.ocupacao_custo + ca.imposto + ca.escritorio_central + ca.marketing_fixo + ca.adm_fixo),
    (ca.atracoes_eventos + ca.freelas + ca.materiais + ca.manutencao + ca.utensilios + ca.alimentacao + ca.comissao + ca.cmo + ca.pro_labore + ca.ocupacao_custo + ca.imposto + ca.escritorio_central + ca.marketing_fixo + ca.adm_fixo),
    CASE WHEN p.faturamento_total > 0 THEN (ca.atracoes_eventos / p.faturamento_total * 100)::numeric(6,2) END,
    canc.cancelamentos_total, canc.cancelamentos_qtd,
    mk.o_num_posts, mk.o_num_stories, mk.o_alcance, mk.o_interacao, mk.o_compartilhamento, mk.o_engajamento, mk.o_visu_stories,
    mk.m_valor_investido, mk.m_alcance, mk.m_frequencia, mk.m_cpm, mk.m_cliques, mk.m_ctr, mk.m_cpc, mk.m_conversas_iniciadas,
    NOW(), 7
  FROM fase_planejamento p CROSS JOIN fase_clientes c LEFT JOIN fase_cmv cmv ON true CROSS JOIN fase_nps_geral ng LEFT JOIN fase_nps_digital nd ON true LEFT JOIN fase_nps_salao ns ON true LEFT JOIN fase_nps_reservas nr ON true CROSS JOIN fase_nps_criterios nc CROSS JOIN fase_tempos_agg t CROSS JOIN fase_mix mx CROSS JOIN fase_stockout stk CROSS JOIN fase_google g CROSS JOIN fase_custos ca CROSS JOIN fase_cancelamentos canc CROSS JOIN fase_fat_hora fh
  CROSS JOIN fase_reservas_getin rg
  LEFT JOIN fase_marketing mk ON true
  ON CONFLICT (bar_id, granularidade, periodo) DO UPDATE SET
    faturamento_total = EXCLUDED.faturamento_total, faturamento_entrada = EXCLUDED.faturamento_entrada, faturamento_bar = EXCLUDED.faturamento_bar, couvert_atracoes = EXCLUDED.couvert_atracoes,
    clientes_atendidos = EXCLUDED.clientes_atendidos, ticket_medio = EXCLUDED.ticket_medio, tm_entrada = EXCLUDED.tm_entrada, tm_bar = EXCLUDED.tm_bar,
    reservas_totais = EXCLUDED.reservas_totais, reservas_presentes = EXCLUDED.reservas_presentes, reservas_totais_quantidade = EXCLUDED.reservas_totais_quantidade, reservas_presentes_quantidade = EXCLUDED.reservas_presentes_quantidade, reservas_totais_pessoas = EXCLUDED.reservas_totais_pessoas, reservas_presentes_pessoas = EXCLUDED.reservas_presentes_pessoas, reservas_quebra_pct = EXCLUDED.reservas_quebra_pct,
    qui_sab_dom = EXCLUDED.qui_sab_dom, ter_qua_qui = EXCLUDED.ter_qua_qui, sex_sab = EXCLUDED.sex_sab,
    perc_faturamento_ate_19h = EXCLUDED.perc_faturamento_ate_19h, perc_faturamento_apos_22h = EXCLUDED.perc_faturamento_apos_22h,
    clientes_ativos = EXCLUDED.clientes_ativos, perc_clientes_novos = EXCLUDED.perc_clientes_novos,
    cmv = EXCLUDED.cmv, cmv_limpo = EXCLUDED.cmv_limpo, cmv_percentual = EXCLUDED.cmv_percentual, faturamento_cmvivel = EXCLUDED.faturamento_cmvivel,
    nps_geral = EXCLUDED.nps_geral, nps_respostas = EXCLUDED.nps_respostas, nps_digital = EXCLUDED.nps_digital, nps_digital_respostas = EXCLUDED.nps_digital_respostas,
    nps_salao = EXCLUDED.nps_salao, nps_salao_respostas = EXCLUDED.nps_salao_respostas, nps_reservas = EXCLUDED.nps_reservas, nps_reservas_respostas = EXCLUDED.nps_reservas_respostas,
    nps_atendimento = EXCLUDED.nps_atendimento, nps_ambiente = EXCLUDED.nps_ambiente, nps_drink = EXCLUDED.nps_drink, nps_comida = EXCLUDED.nps_comida, nps_limpeza = EXCLUDED.nps_limpeza, nps_preco = EXCLUDED.nps_preco, nps_musica = EXCLUDED.nps_musica,
    tempo_drinks = EXCLUDED.tempo_drinks, tempo_bebidas = EXCLUDED.tempo_bebidas, tempo_cozinha = EXCLUDED.tempo_cozinha,
    qtd_drinks_total = EXCLUDED.qtd_drinks_total, qtd_comida_total = EXCLUDED.qtd_comida_total,
    atrasinho_drinks = EXCLUDED.atrasinho_drinks, atrasao_drinks = EXCLUDED.atrasao_drinks, atrasinho_cozinha = EXCLUDED.atrasinho_cozinha, atrasao_cozinha = EXCLUDED.atrasao_cozinha, atrasao_bar = EXCLUDED.atrasao_bar,
    atrasos_drinks_perc = EXCLUDED.atrasos_drinks_perc, atrasos_comida_perc = EXCLUDED.atrasos_comida_perc,
    perc_bebidas = EXCLUDED.perc_bebidas, perc_drinks = EXCLUDED.perc_drinks, perc_comida = EXCLUDED.perc_comida,
    stockout_drinks_perc = EXCLUDED.stockout_drinks_perc, stockout_bar_perc = EXCLUDED.stockout_bar_perc, stockout_comidas_perc = EXCLUDED.stockout_comidas_perc, stockout_total_perc = EXCLUDED.stockout_total_perc,
    avaliacoes_5_google_trip = EXCLUDED.avaliacoes_5_google_trip, media_avaliacoes_google = EXCLUDED.media_avaliacoes_google, google_reviews_total = EXCLUDED.google_reviews_total,
    atracoes_eventos = EXCLUDED.atracoes_eventos, freelas = EXCLUDED.freelas, materiais = EXCLUDED.materiais, comissao = EXCLUDED.comissao, cmo = EXCLUDED.cmo, pro_labore = EXCLUDED.pro_labore,
    ocupacao_custo = EXCLUDED.ocupacao_custo, imposto = EXCLUDED.imposto, escritorio_central = EXCLUDED.escritorio_central, marketing_fixo = EXCLUDED.marketing_fixo, adm_fixo = EXCLUDED.adm_fixo,
    manutencao = EXCLUDED.manutencao, utensilios = EXCLUDED.utensilios, alimentacao = EXCLUDED.alimentacao,
    custos_variaveis = EXCLUDED.custos_variaveis, custos_fixos = EXCLUDED.custos_fixos, custos_total = EXCLUDED.custos_total,
    custo_atracao_faturamento = EXCLUDED.custo_atracao_faturamento, cancelamentos_total = EXCLUDED.cancelamentos_total, cancelamentos_qtd = EXCLUDED.cancelamentos_qtd,
    o_num_posts = EXCLUDED.o_num_posts, o_num_stories = EXCLUDED.o_num_stories, o_alcance = EXCLUDED.o_alcance, o_interacao = EXCLUDED.o_interacao, o_compartilhamento = EXCLUDED.o_compartilhamento, o_engajamento = EXCLUDED.o_engajamento, o_visu_stories = EXCLUDED.o_visu_stories,
    m_valor_investido = EXCLUDED.m_valor_investido, m_alcance = EXCLUDED.m_alcance, m_frequencia = EXCLUDED.m_frequencia, m_cpm = EXCLUDED.m_cpm, m_cliques = EXCLUDED.m_cliques, m_ctr = EXCLUDED.m_ctr, m_custo_por_clique = EXCLUDED.m_custo_por_clique, m_conversas_iniciadas = EXCLUDED.m_conversas_iniciadas,
    calculado_em = NOW(), versao_etl = 7;

  GET DIAGNOSTICS v_inseridos = ROW_COUNT;
  RETURN QUERY SELECT p_bar_id, v_periodo, v_inseridos, ((EXTRACT(EPOCH FROM (clock_timestamp() - v_start)) * 1000))::int;
END;
$function$;
