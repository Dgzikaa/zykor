-- 2026-05-04: fix etl_gold_desempenho_mensal — reservas_*_pessoas inflado
--
-- Bug: o ETL populava reservas_totais e reservas_totais_pessoas com
--   p.reservas_totais (= SUM(gold.planejamento.res_tot))
-- mas gold.planejamento.res_tot esta inflado em ~3.5x (bug de ETL upstream).
--
-- Exemplo jan/2026 Ord:
--   bronze.bronze_getin_reservations.SUM(people) = 4933 pessoas (verdade)
--   gold.planejamento.SUM(res_tot)               = 17290 (INFLADO)
--   gold.desempenho mensal.reservas_totais       = 17290 (propagado errado)
--
-- Fix: trocar a fonte das 4 colunas de reservas pra rg.* (fase_reservas_getin),
-- que ja le direto de bronze.bronze_getin_reservations (mesmo padrao do ETL semanal).
--
-- Mudancas no INSERT/UPDATE do gold.desempenho:
--   reservas_totais          : p.reservas_totais        -> rg.reservas_totais_pes
--   reservas_presentes       : p.reservas_presentes     -> rg.reservas_presentes_pes
--   reservas_totais_pessoas  : p.reservas_totais        -> rg.reservas_totais_pes
--   reservas_presentes_pessoas: p.reservas_presentes    -> rg.reservas_presentes_pes
--
-- (reservas_totais_quantidade e reservas_presentes_quantidade ja vinham de rg — ok)
--
-- Pos-migration: re-rodar etl_gold_desempenho_mensal pra todos meses 2026 dos 2 bares.

CREATE OR REPLACE FUNCTION public.etl_gold_desempenho_mensal(p_bar_id integer, p_ano integer, p_mes integer)
 RETURNS TABLE(bar_processado integer, periodo_processado text, linhas_inseridas integer, duracao_ms integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'operations', 'financial', 'system', 'integrations', 'bronze', 'silver', 'gold', 'crm', 'ops', 'pg_catalog'
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
  IF p_bar_id IS NULL OR p_ano IS NULL OR p_mes IS NULL THEN
    RAISE EXCEPTION 'Parametros obrigatorios';
  END IF;

  IF p_bar_id = 3 THEN
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

  v_data_inicio := make_date(p_ano, p_mes, 1);
  v_data_fim := (v_data_inicio + INTERVAL '1 month' - INTERVAL '1 day')::date;
  v_periodo := p_ano::text || '-' || LPAD(p_mes::text, 2, '0');

  WITH fase_planejamento AS (
    SELECT
      COALESCE(SUM(faturamento_total_consolidado), 0) as faturamento_total,
      COALESCE(SUM(faturamento_entrada_yuzer), 0) as faturamento_entrada,
      COALESCE(SUM(real_r), 0) as faturamento_bar,
      COALESCE(SUM(res_tot), 0) as reservas_totais,
      COALESCE(SUM(res_p), 0) as reservas_presentes,
      COALESCE(SUM(faturamento_couvert), 0) as couvert_atracoes,
      COALESCE(SUM(publico_real_consolidado), 0) as clientes_atendidos,
      (COALESCE(SUM(faturamento_total_consolidado), 0)::numeric / NULLIF(SUM(publico_real_consolidado), 0))::numeric(10,2) as ticket_medio,
      (COALESCE(SUM(faturamento_couvert), 0)::numeric / NULLIF(SUM(publico_real_consolidado), 0))::numeric(10,2) as tm_entrada,
      ((COALESCE(SUM(faturamento_total_consolidado), 0) - COALESCE(SUM(faturamento_couvert), 0))::numeric / NULLIF(SUM(publico_real_consolidado), 0))::numeric(10,2) as tm_bar,
      COALESCE(SUM(descontos), 0)::numeric(14,2) as desconto_total,
      CASE WHEN SUM(faturamento_total_consolidado) > 0
        THEN (SUM(descontos)::numeric / SUM(faturamento_total_consolidado) * 100)::numeric(5,2)
        ELSE 0 END as desconto_percentual,
      AVG(fat_19h_percent) FILTER (WHERE fat_19h_percent > 0)::numeric(5,2) as perc_fat_ate_19h,
      AVG(fat_apos_22h_percent) FILTER (WHERE fat_apos_22h_percent > 0)::numeric(5,2) as perc_fat_apos_22h,
      (COALESCE(AVG(faturamento_total_consolidado) FILTER (WHERE EXTRACT(dow FROM data_evento)=4), 0) + COALESCE(AVG(faturamento_total_consolidado) FILTER (WHERE EXTRACT(dow FROM data_evento)=6), 0) + COALESCE(AVG(faturamento_total_consolidado) FILTER (WHERE EXTRACT(dow FROM data_evento)=0), 0))::numeric(14,2) as qui_sab_dom,
      (COALESCE(AVG(faturamento_total_consolidado) FILTER (WHERE EXTRACT(dow FROM data_evento)=2), 0) + COALESCE(AVG(faturamento_total_consolidado) FILTER (WHERE EXTRACT(dow FROM data_evento)=3), 0) + COALESCE(AVG(faturamento_total_consolidado) FILTER (WHERE EXTRACT(dow FROM data_evento)=4), 0))::numeric(14,2) as ter_qua_qui,
      (COALESCE(AVG(faturamento_total_consolidado) FILTER (WHERE EXTRACT(dow FROM data_evento)=5), 0) + COALESCE(AVG(faturamento_total_consolidado) FILTER (WHERE EXTRACT(dow FROM data_evento)=6), 0))::numeric(14,2) as sex_sab
    FROM gold.planejamento
    WHERE planejamento.bar_id = p_bar_id
      AND data_evento BETWEEN v_data_inicio AND v_data_fim
  ),
  -- Reservas direto do bronze Getin (igual semanal). gold.planejamento.res_tot esta
  -- inflado em ~3.5x (bug de ETL upstream), entao usamos rg.* no INSERT abaixo.
  fase_reservas_getin AS (
    SELECT
      COUNT(*)::integer as reservas_totais_qtd,
      COUNT(*) FILTER (WHERE status NOT IN ('canceled-user','canceled-restaurant','canceled-agent','no-show') AND (no_show IS NULL OR no_show = false))::integer as reservas_presentes_qtd,
      COALESCE(SUM(people), 0)::integer as reservas_totais_pes,
      COALESCE(SUM(people) FILTER (WHERE status NOT IN ('canceled-user','canceled-restaurant','canceled-agent','no-show') AND (no_show IS NULL OR no_show = false)), 0)::integer as reservas_presentes_pes,
      CASE WHEN SUM(people) > 0 THEN
        ROUND(((SUM(people) - SUM(people) FILTER (WHERE status NOT IN ('canceled-user','canceled-restaurant','canceled-agent','no-show') AND (no_show IS NULL OR no_show = false)))::numeric / SUM(people) * 100), 2)
      END as reservas_quebra
    FROM bronze.bronze_getin_reservations
    WHERE bar_id = p_bar_id AND reservation_date BETWEEN v_data_inicio AND v_data_fim
  ),
  fase_clientes AS (
    SELECT
      COALESCE((SELECT total_ativos FROM gold.clientes_diario cd
        WHERE cd.bar_id = p_bar_id AND cd.data_referencia <= v_data_fim
        ORDER BY cd.data_referencia DESC LIMIT 1), 0) as clientes_ativos,
      (SELECT CASE WHEN SUM(total_clientes_unicos_dia) > 0
        THEN (SUM(novos_clientes_dia)::numeric / SUM(total_clientes_unicos_dia) * 100)::numeric(5,2)
        END
        FROM gold.clientes_diario cd2
        WHERE cd2.bar_id = p_bar_id AND cd2.data_referencia BETWEEN v_data_inicio AND v_data_fim
      ) as perc_clientes_novos
  ),
  fase_cmv AS (
    SELECT SUM(compras_periodo) as compras_periodo, SUM(faturamento_cmvivel) as faturamento_cmvivel,
      SUM(COALESCE(compras_periodo, 0) - COALESCE(vr_repique, 0)) as cmv_limpo_calc,
      CASE WHEN SUM(faturamento_cmvivel) > 0 THEN ((SUM(COALESCE(compras_periodo, 0) - COALESCE(vr_repique, 0)) / SUM(faturamento_cmvivel)) * 100)::numeric(6,2) END as cmv_percentual_calc
    FROM gold.cmv WHERE cmv.bar_id = p_bar_id AND cmv.data_inicio >= v_data_inicio AND cmv.data_fim <= v_data_fim
  ),
  fase_nps_geral AS (
    SELECT CASE WHEN COUNT(*) > 0 THEN ((COUNT(*) FILTER (WHERE nps >= 9) - COUNT(*) FILTER (WHERE nps <= 6)) * 100.0 / COUNT(*))::numeric(6,2) END as nps_geral,
      COUNT(*)::integer as nps_respostas
    FROM bronze.bronze_falae_respostas
    WHERE bar_id = p_bar_id AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_data_inicio AND v_data_fim
  ),
  fase_nps_digital AS (
    SELECT CASE WHEN COUNT(*) > 0 THEN ((COUNT(*) FILTER (WHERE nps >= 9) - COUNT(*) FILTER (WHERE nps <= 6)) * 100.0 / COUNT(*))::numeric(6,2) END as nps_digital,
      COUNT(*)::integer as nps_digital_respostas
    FROM bronze.bronze_falae_respostas
    WHERE bar_id = p_bar_id AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_data_inicio AND v_data_fim AND search_name = 'NPS Digital'
  ),
  fase_nps_salao AS (
    SELECT CASE WHEN COUNT(*) > 0 THEN ((COUNT(*) FILTER (WHERE nps >= 9) - COUNT(*) FILTER (WHERE nps <= 6)) * 100.0 / COUNT(*))::numeric(6,2) END as nps_salao,
      COUNT(*)::integer as nps_salao_respostas
    FROM bronze.bronze_falae_respostas
    WHERE bar_id = p_bar_id AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_data_inicio AND v_data_fim AND search_name = 'Salão'
  ),
  fase_nps_reservas AS (
    SELECT
      CASE WHEN SUM((respostas_por_pesquisa->'(reserva getin)'->>'total')::integer) > 0
        THEN (SUM((respostas_por_pesquisa->'(reserva getin)'->>'total')::integer * (respostas_por_pesquisa->'(reserva getin)'->>'nps_medio')::numeric)
             / SUM((respostas_por_pesquisa->'(reserva getin)'->>'total')::integer))::numeric(5,2)
      END as nps_reservas,
      COALESCE(SUM((respostas_por_pesquisa->'(reserva getin)'->>'total')::integer), 0) as nps_reservas_respostas
    FROM silver.nps_diario
    WHERE bar_id = p_bar_id AND data_referencia BETWEEN v_data_inicio AND v_data_fim AND respostas_por_pesquisa ? '(reserva getin)'
  ),
  fase_nps_criterios AS (
    SELECT
      AVG((criterios_medios->>'Atendimento')::numeric)::numeric(5,2) as nps_atendimento,
      AVG((criterios_medios->>'Ambiente')::numeric)::numeric(5,2) as nps_ambiente,
      AVG((criterios_medios->>'Drinks')::numeric)::numeric(5,2) as nps_drink,
      AVG((criterios_medios->>'Qualidade do Produto')::numeric)::numeric(5,2) as nps_comida,
      AVG((criterios_medios->>'Limpeza')::numeric)::numeric(5,2) as nps_limpeza,
      AVG((criterios_medios->>'Custo benefício')::numeric)::numeric(5,2) as nps_preco,
      AVG((criterios_medios->>'MÚSICA')::numeric)::numeric(5,2) as nps_musica
    FROM silver.nps_diario nps
    WHERE nps.bar_id = p_bar_id AND nps.data_referencia BETWEEN v_data_inicio AND v_data_fim AND nps.criterios_medios IS NOT NULL
  ),
  fase_tempos_agg AS (
    SELECT
      CASE WHEN COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_drinks) AND t0_t3 BETWEEN 1 AND 3600) > 0
        THEN AVG(t0_t3) FILTER (WHERE local_desc = ANY(v_locs_drinks) AND t0_t3 BETWEEN 1 AND 3600)::numeric(8,2)
      END as tempo_drinks,
      CASE WHEN COUNT(*) FILTER (WHERE categoria = 'bebida' AND t0_t3 > 0) > 0
        THEN AVG(t0_t3) FILTER (WHERE categoria = 'bebida' AND t0_t3 > 0)::numeric(8,2)
      END as tempo_bebidas,
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
    SELECT SUM(valor) as total,
      SUM(valor) FILTER (WHERE categoria_mix = 'BEBIDA') as fat_bebida,
      SUM(valor) FILTER (WHERE categoria_mix = 'DRINK') as fat_drink,
      SUM(valor) FILTER (WHERE categoria_mix = 'COMIDA') as fat_comida
    FROM silver.vendas_item WHERE bar_id = p_bar_id AND data_venda BETWEEN v_data_inicio AND v_data_fim
  ),
  fase_stockout_dia AS (
    SELECT data_consulta, categoria_local,
      COUNT(DISTINCT prd) as total,
      COUNT(DISTINCT prd) FILTER (WHERE prd_venda = 'N') as stockout
    FROM silver.silver_contahub_operacional_stockout_processado
    WHERE bar_id = p_bar_id AND data_consulta BETWEEN v_data_inicio AND v_data_fim AND incluido = true
    GROUP BY data_consulta, categoria_local
  ),
  fase_stockout AS (
    SELECT
      AVG(stockout::numeric / NULLIF(total, 0) * 100) FILTER (WHERE categoria_local = 'Drinks')::numeric(5,2) as stockout_drinks_perc,
      AVG(stockout::numeric / NULLIF(total, 0) * 100) FILTER (WHERE categoria_local = 'Bar')::numeric(5,2) as stockout_bar_perc,
      AVG(stockout::numeric / NULLIF(total, 0) * 100) FILTER (WHERE categoria_local = 'Comidas')::numeric(5,2) as stockout_comidas_perc,
      AVG(stockout::numeric / NULLIF(total, 0) * 100)::numeric(5,2) as stockout_total_perc
    FROM fase_stockout_dia
  ),
  fase_google AS (
    SELECT
      COALESCE(SUM(qtd_5_estrelas), 0)::integer as avaliacoes_5_google_trip,
      (SUM(stars_medio * total_reviews)::numeric / NULLIF(SUM(total_reviews), 0))::numeric(4,2) as media_avaliacoes_google,
      COALESCE(SUM(total_reviews), 0)::integer as google_reviews_total
    FROM silver.google_reviews_diario WHERE bar_id = p_bar_id AND data_referencia BETWEEN v_data_inicio AND v_data_fim
  ),
  fase_custos AS (
    SELECT
      COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%atra%' OR categoria_nome ILIKE '%produ%evento%'), 0)::numeric(14,2) as atracoes_eventos,
      COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%freela%'), 0)::numeric(14,2) as freelas,
      COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%material%' OR categoria_nome ILIKE '%limpeza%'), 0)::numeric(14,2) as materiais,
      COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%comiss%'), 0)::numeric(14,2) as comissao,
      COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%sal%rio%' OR categoria_nome ILIKE '%vale%transp%'), 0)::numeric(14,2) as cmo,
      COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%pro%labore%'), 0)::numeric(14,2) as pro_labore,
      COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%aluguel%' OR categoria_nome ILIKE '%iptu%' OR categoria_nome ILIKE '%condom%' OR categoria_nome ILIKE '%%gua%' OR categoria_nome ILIKE '%luz%'), 0)::numeric(14,2) as ocupacao_custo,
      COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%imposto%'), 0)::numeric(14,2) as imposto,
      COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%escrit%central%'), 0)::numeric(14,2) as escritorio_central,
      COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%marketing%'), 0)::numeric(14,2) as marketing_fixo,
      COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%taxa%maquin%'), 0)::numeric(14,2) as adm_fixo,
      COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%manuten%'), 0)::numeric(14,2) as manutencao,
      COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%utens%'), 0)::numeric(14,2) as utensilios,
      COALESCE(SUM(valor_liquido) FILTER (WHERE categoria_nome ILIKE '%alimenta%'), 0)::numeric(14,2) as alimentacao
    FROM silver.contaazul_lancamentos_diarios
    WHERE bar_id = p_bar_id AND data_competencia BETWEEN v_data_inicio AND v_data_fim AND tipo = 'DESPESA'
  ),
  fase_cancelamentos AS (
    SELECT COALESCE(SUM(custototal), 0)::numeric(14,2) as cancelamentos_total, COUNT(*)::integer as cancelamentos_qtd
    FROM bronze.bronze_contahub_avendas_cancelamentos
    WHERE bar_id = p_bar_id AND dt_gerencial BETWEEN v_data_inicio AND v_data_fim
  ),
  fase_pagamentos AS (
    SELECT COALESCE(SUM(valor_liquido) FILTER (WHERE meio ILIKE '%conta assinada%'), 0)::numeric(14,2) as conta_assinada_valor
    FROM operations.faturamento_pagamentos
    WHERE bar_id = p_bar_id AND data_pagamento BETWEEN v_data_inicio AND v_data_fim
  ),
  fase_marketing_mensal AS (
    SELECT
      SUM(o_num_posts)::integer as o_num_posts,
      SUM(o_num_stories)::integer as o_num_stories,
      SUM(o_alcance)::integer as o_alcance,
      SUM(o_interacao)::integer as o_interacao,
      SUM(o_compartilhamento)::integer as o_compartilhamento,
      AVG(o_engajamento)::numeric(8,4) as o_engajamento,
      SUM(o_visu_stories)::integer as o_visu_stories,
      SUM(m_valor_investido)::numeric(14,2) as m_valor_investido,
      SUM(m_alcance)::integer as m_alcance,
      AVG(m_frequencia)::numeric(8,4) as m_frequencia,
      AVG(m_cpm)::numeric(10,2) as m_cpm,
      SUM(m_cliques)::integer as m_cliques,
      AVG(m_ctr)::numeric(8,4) as m_ctr,
      AVG(m_cpc)::numeric(10,2) as m_cpc,
      SUM(m_conversas_iniciadas)::integer as m_conversas_iniciadas
    FROM meta.marketing_semanal
    WHERE bar_id = p_bar_id
      AND EXTRACT(month FROM (date_trunc('week', make_date(ano, 1, 4)) + ((semana - 1) * INTERVAL '1 week') + INTERVAL '3 days')::date) = p_mes
      AND EXTRACT(year FROM (date_trunc('week', make_date(ano, 1, 4)) + ((semana - 1) * INTERVAL '1 week') + INTERVAL '3 days')::date) = p_ano
  )
  INSERT INTO gold.desempenho (
    bar_id, granularidade, periodo, ano, numero_semana, data_inicio, data_fim,
    faturamento_total, faturamento_entrada, faturamento_bar, couvert_atracoes,
    clientes_atendidos, ticket_medio, tm_entrada, tm_bar,
    reservas_totais, reservas_presentes,
    reservas_totais_quantidade, reservas_presentes_quantidade,
    reservas_totais_pessoas, reservas_presentes_pessoas,
    mesas_totais, mesas_presentes, reservas_quebra_pct,
    desconto_total, desconto_percentual, conta_assinada_valor, conta_assinada_perc,
    qui_sab_dom, ter_qua_qui, sex_sab,
    perc_faturamento_ate_19h, perc_faturamento_apos_22h,
    clientes_ativos, perc_clientes_novos,
    cmv, cmv_limpo, cmv_percentual, faturamento_cmvivel,
    nps_geral, nps_respostas, nps_digital, nps_digital_respostas,
    nps_salao, nps_salao_respostas, nps_reservas, nps_reservas_respostas,
    nps_atendimento, nps_ambiente, nps_drink, nps_comida, nps_limpeza, nps_preco, nps_musica,
    tempo_drinks, tempo_bebidas, tempo_cozinha,
    qtd_drinks_total, qtd_comida_total,
    atrasinho_drinks, atrasao_drinks, atrasinho_cozinha, atrasao_cozinha, atrasao_bar,
    atrasos_drinks_perc, atrasos_comida_perc,
    perc_bebidas, perc_drinks, perc_comida,
    stockout_drinks_perc, stockout_bar_perc, stockout_comidas_perc, stockout_total_perc,
    avaliacoes_5_google_trip, media_avaliacoes_google, google_reviews_total,
    atracoes_eventos, freelas, materiais, comissao, cmo, pro_labore,
    ocupacao_custo, imposto, escritorio_central, marketing_fixo, adm_fixo,
    manutencao, utensilios, alimentacao,
    custos_variaveis, custos_fixos, custos_total, custo_atracao_faturamento,
    cancelamentos_total, cancelamentos_qtd,
    o_num_posts, o_num_stories, o_alcance, o_interacao, o_compartilhamento, o_engajamento, o_visu_stories,
    m_valor_investido, m_alcance, m_frequencia, m_cpm, m_cliques, m_ctr, m_custo_por_clique, m_conversas_iniciadas,
    calculado_em, versao_etl
  )
  SELECT
    p_bar_id, 'mensal', v_periodo, p_ano, NULL, v_data_inicio, v_data_fim,
    p.faturamento_total, p.faturamento_entrada, p.faturamento_bar, p.couvert_atracoes,
    p.clientes_atendidos, p.ticket_medio, p.tm_entrada, p.tm_bar,
    -- Reservas: TODAS de bronze (rg.*) — gold.planejamento.res_tot esta inflado em ~3.5x
    rg.reservas_totais_pes, rg.reservas_presentes_pes,
    rg.reservas_totais_qtd, rg.reservas_presentes_qtd,
    rg.reservas_totais_pes, rg.reservas_presentes_pes,
    rg.reservas_totais_qtd, rg.reservas_presentes_qtd,
    rg.reservas_quebra,
    p.desconto_total, p.desconto_percentual,
    pg.conta_assinada_valor,
    CASE WHEN p.faturamento_total > 0 THEN (pg.conta_assinada_valor / p.faturamento_total * 100)::numeric(5,2) ELSE 0 END,
    p.qui_sab_dom, p.ter_qua_qui, p.sex_sab,
    p.perc_fat_ate_19h, p.perc_fat_apos_22h,
    COALESCE(c.clientes_ativos, 0), c.perc_clientes_novos,
    cmv.compras_periodo, cmv.cmv_limpo_calc, cmv.cmv_percentual_calc, cmv.faturamento_cmvivel,
    ng.nps_geral, COALESCE(ng.nps_respostas, 0),
    nd.nps_digital, COALESCE(nd.nps_digital_respostas, 0),
    ns.nps_salao, COALESCE(ns.nps_salao_respostas, 0),
    nr.nps_reservas, COALESCE(nr.nps_reservas_respostas, 0),
    nc.nps_atendimento, nc.nps_ambiente, nc.nps_drink, nc.nps_comida,
    nc.nps_limpeza, nc.nps_preco, nc.nps_musica,
    t.tempo_drinks, t.tempo_bebidas, t.tempo_cozinha,
    t.qtd_drinks_total, t.qtd_comida_total,
    t.atrasinho_drinks, t.atrasao_drinks, t.atrasinho_cozinha, t.atrasao_cozinha, t.atrasao_bar,
    CASE WHEN t.qtd_drinks_total > 0 THEN (t.atrasao_drinks::numeric / t.qtd_drinks_total * 100)::numeric(5,2) END,
    CASE WHEN t.qtd_comida_total > 0 THEN (t.atrasao_cozinha::numeric / t.qtd_comida_total * 100)::numeric(5,2) END,
    CASE WHEN mx.total > 0 THEN (mx.fat_bebida / mx.total * 100)::numeric(5,2) END,
    CASE WHEN mx.total > 0 THEN (mx.fat_drink / mx.total * 100)::numeric(5,2) END,
    CASE WHEN mx.total > 0 THEN (mx.fat_comida / mx.total * 100)::numeric(5,2) END,
    stk.stockout_drinks_perc, stk.stockout_bar_perc, stk.stockout_comidas_perc, stk.stockout_total_perc,
    g.avaliacoes_5_google_trip, g.media_avaliacoes_google, g.google_reviews_total,
    ca.atracoes_eventos, ca.freelas, ca.materiais, ca.comissao, ca.cmo, ca.pro_labore,
    ca.ocupacao_custo, ca.imposto, ca.escritorio_central, ca.marketing_fixo, ca.adm_fixo,
    ca.manutencao, ca.utensilios, ca.alimentacao,
    (ca.atracoes_eventos + ca.freelas + ca.materiais + ca.manutencao + ca.utensilios + ca.alimentacao),
    (ca.comissao + ca.cmo + ca.pro_labore + ca.ocupacao_custo + ca.imposto + ca.escritorio_central + ca.marketing_fixo + ca.adm_fixo),
    (ca.atracoes_eventos + ca.freelas + ca.materiais + ca.manutencao + ca.utensilios + ca.alimentacao
      + ca.comissao + ca.cmo + ca.pro_labore + ca.ocupacao_custo + ca.imposto + ca.escritorio_central + ca.marketing_fixo + ca.adm_fixo),
    CASE WHEN p.faturamento_total > 0 THEN (ca.atracoes_eventos / p.faturamento_total * 100)::numeric(6,2) END,
    canc.cancelamentos_total, canc.cancelamentos_qtd,
    mk.o_num_posts, mk.o_num_stories, mk.o_alcance, mk.o_interacao, mk.o_compartilhamento, mk.o_engajamento, mk.o_visu_stories,
    mk.m_valor_investido, mk.m_alcance, mk.m_frequencia, mk.m_cpm, mk.m_cliques, mk.m_ctr, mk.m_cpc, mk.m_conversas_iniciadas,
    NOW(), 8
  FROM fase_planejamento p
  CROSS JOIN fase_reservas_getin rg
  CROSS JOIN fase_clientes c
  LEFT JOIN fase_cmv cmv ON true
  CROSS JOIN fase_nps_geral ng
  LEFT JOIN fase_nps_digital nd ON true
  LEFT JOIN fase_nps_salao ns ON true
  LEFT JOIN fase_nps_reservas nr ON true
  CROSS JOIN fase_nps_criterios nc
  CROSS JOIN fase_tempos_agg t
  CROSS JOIN fase_mix mx
  CROSS JOIN fase_stockout stk
  CROSS JOIN fase_google g
  CROSS JOIN fase_custos ca
  CROSS JOIN fase_cancelamentos canc
  CROSS JOIN fase_pagamentos pg
  LEFT JOIN fase_marketing_mensal mk ON true
  ON CONFLICT (bar_id, granularidade, periodo) DO UPDATE SET
    faturamento_total = EXCLUDED.faturamento_total, faturamento_entrada = EXCLUDED.faturamento_entrada,
    faturamento_bar = EXCLUDED.faturamento_bar, couvert_atracoes = EXCLUDED.couvert_atracoes,
    clientes_atendidos = EXCLUDED.clientes_atendidos, ticket_medio = EXCLUDED.ticket_medio,
    tm_entrada = EXCLUDED.tm_entrada, tm_bar = EXCLUDED.tm_bar,
    reservas_totais = EXCLUDED.reservas_totais, reservas_presentes = EXCLUDED.reservas_presentes,
    reservas_totais_quantidade = EXCLUDED.reservas_totais_quantidade,
    reservas_presentes_quantidade = EXCLUDED.reservas_presentes_quantidade,
    reservas_totais_pessoas = EXCLUDED.reservas_totais_pessoas,
    reservas_presentes_pessoas = EXCLUDED.reservas_presentes_pessoas,
    mesas_totais = EXCLUDED.mesas_totais, mesas_presentes = EXCLUDED.mesas_presentes,
    reservas_quebra_pct = EXCLUDED.reservas_quebra_pct,
    desconto_total = EXCLUDED.desconto_total, desconto_percentual = EXCLUDED.desconto_percentual,
    conta_assinada_valor = EXCLUDED.conta_assinada_valor, conta_assinada_perc = EXCLUDED.conta_assinada_perc,
    qui_sab_dom = EXCLUDED.qui_sab_dom, ter_qua_qui = EXCLUDED.ter_qua_qui, sex_sab = EXCLUDED.sex_sab,
    perc_faturamento_ate_19h = EXCLUDED.perc_faturamento_ate_19h,
    perc_faturamento_apos_22h = EXCLUDED.perc_faturamento_apos_22h,
    clientes_ativos = EXCLUDED.clientes_ativos, perc_clientes_novos = EXCLUDED.perc_clientes_novos,
    cmv = EXCLUDED.cmv, cmv_limpo = EXCLUDED.cmv_limpo,
    cmv_percentual = EXCLUDED.cmv_percentual, faturamento_cmvivel = EXCLUDED.faturamento_cmvivel,
    nps_geral = EXCLUDED.nps_geral, nps_respostas = EXCLUDED.nps_respostas,
    nps_digital = EXCLUDED.nps_digital, nps_digital_respostas = EXCLUDED.nps_digital_respostas,
    nps_salao = EXCLUDED.nps_salao, nps_salao_respostas = EXCLUDED.nps_salao_respostas,
    nps_reservas = EXCLUDED.nps_reservas, nps_reservas_respostas = EXCLUDED.nps_reservas_respostas,
    nps_atendimento = EXCLUDED.nps_atendimento, nps_ambiente = EXCLUDED.nps_ambiente,
    nps_drink = EXCLUDED.nps_drink, nps_comida = EXCLUDED.nps_comida,
    nps_limpeza = EXCLUDED.nps_limpeza, nps_preco = EXCLUDED.nps_preco, nps_musica = EXCLUDED.nps_musica,
    tempo_drinks = EXCLUDED.tempo_drinks, tempo_bebidas = EXCLUDED.tempo_bebidas, tempo_cozinha = EXCLUDED.tempo_cozinha,
    qtd_drinks_total = EXCLUDED.qtd_drinks_total, qtd_comida_total = EXCLUDED.qtd_comida_total,
    atrasinho_drinks = EXCLUDED.atrasinho_drinks, atrasao_drinks = EXCLUDED.atrasao_drinks,
    atrasinho_cozinha = EXCLUDED.atrasinho_cozinha, atrasao_cozinha = EXCLUDED.atrasao_cozinha,
    atrasao_bar = EXCLUDED.atrasao_bar,
    atrasos_drinks_perc = EXCLUDED.atrasos_drinks_perc, atrasos_comida_perc = EXCLUDED.atrasos_comida_perc,
    perc_bebidas = EXCLUDED.perc_bebidas, perc_drinks = EXCLUDED.perc_drinks, perc_comida = EXCLUDED.perc_comida,
    stockout_drinks_perc = EXCLUDED.stockout_drinks_perc, stockout_bar_perc = EXCLUDED.stockout_bar_perc,
    stockout_comidas_perc = EXCLUDED.stockout_comidas_perc, stockout_total_perc = EXCLUDED.stockout_total_perc,
    avaliacoes_5_google_trip = EXCLUDED.avaliacoes_5_google_trip,
    media_avaliacoes_google = EXCLUDED.media_avaliacoes_google,
    google_reviews_total = EXCLUDED.google_reviews_total,
    atracoes_eventos = EXCLUDED.atracoes_eventos, freelas = EXCLUDED.freelas, materiais = EXCLUDED.materiais,
    comissao = EXCLUDED.comissao, cmo = EXCLUDED.cmo, pro_labore = EXCLUDED.pro_labore,
    ocupacao_custo = EXCLUDED.ocupacao_custo, imposto = EXCLUDED.imposto,
    escritorio_central = EXCLUDED.escritorio_central, marketing_fixo = EXCLUDED.marketing_fixo,
    adm_fixo = EXCLUDED.adm_fixo, manutencao = EXCLUDED.manutencao,
    utensilios = EXCLUDED.utensilios, alimentacao = EXCLUDED.alimentacao,
    custos_variaveis = EXCLUDED.custos_variaveis, custos_fixos = EXCLUDED.custos_fixos,
    custos_total = EXCLUDED.custos_total, custo_atracao_faturamento = EXCLUDED.custo_atracao_faturamento,
    cancelamentos_total = EXCLUDED.cancelamentos_total, cancelamentos_qtd = EXCLUDED.cancelamentos_qtd,
    o_num_posts = EXCLUDED.o_num_posts, o_num_stories = EXCLUDED.o_num_stories,
    o_alcance = EXCLUDED.o_alcance, o_interacao = EXCLUDED.o_interacao,
    o_compartilhamento = EXCLUDED.o_compartilhamento, o_engajamento = EXCLUDED.o_engajamento,
    o_visu_stories = EXCLUDED.o_visu_stories,
    m_valor_investido = EXCLUDED.m_valor_investido, m_alcance = EXCLUDED.m_alcance,
    m_frequencia = EXCLUDED.m_frequencia, m_cpm = EXCLUDED.m_cpm, m_cliques = EXCLUDED.m_cliques,
    m_ctr = EXCLUDED.m_ctr, m_custo_por_clique = EXCLUDED.m_custo_por_clique,
    m_conversas_iniciadas = EXCLUDED.m_conversas_iniciadas,
    calculado_em = NOW(), versao_etl = 8;

  GET DIAGNOSTICS v_inseridos = ROW_COUNT;

  RETURN QUERY SELECT p_bar_id, v_periodo, v_inseridos, ((EXTRACT(EPOCH FROM (clock_timestamp() - v_start)) * 1000))::int;
END;

$function$;
