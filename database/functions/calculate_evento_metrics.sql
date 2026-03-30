CREATE OR REPLACE FUNCTION public.calculate_evento_metrics(evento_id integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  evento_record RECORD;
  is_evento_especial BOOLEAN;
  v_opera BOOLEAN;

  v_contahub_liquido NUMERIC := 0;
  v_conta_assinada NUMERIC := 0;
  v_yuzer_liquido_total NUMERIC := 0;
  v_yuzer_ingressos_valor NUMERIC := 0;
  v_yuzer_ingressos_qtd INTEGER := 0;
  v_yuzer_bar_valor NUMERIC := 0;
  v_sympla_liquido NUMERIC := 0;
  v_sympla_checkins INTEGER := 0;

  contahub_per RECORD;
  contahub_fat RECORD;
  contahub_ana RECORD;
  contahub_tempo_data RECORD;
  nibo_custos RECORD;
  getin_reservas RECORD;

  calculated_cl_real INTEGER := 0;
  calculated_real_r NUMERIC := 0;
  calculated_faturamento_entrada NUMERIC := 0;
  calculated_faturamento_bar NUMERIC := 0;
  calculated_te_real NUMERIC := 0;
  calculated_tb_real NUMERIC := 0;
  calculated_t_medio NUMERIC := 0;
  calculated_lot_max NUMERIC := 0;
  calculated_percent_b NUMERIC := 0;
  calculated_percent_c NUMERIC := 0;
  calculated_percent_d NUMERIC := 0;
  calculated_percent_happy_hour NUMERIC := 0;
  calculated_t_coz NUMERIC := 0;
  calculated_t_bar NUMERIC := 0;
  calculated_atrasinho_cozinha INTEGER := 0;
  calculated_atrasinho_bar INTEGER := 0;
  calculated_atrasao_cozinha INTEGER := 0;
  calculated_atrasao_bar INTEGER := 0;
  calculated_fat_19h NUMERIC := 0;
  calculated_fat_19h_percent NUMERIC := 0;
  calculated_c_art NUMERIC := 0;
  calculated_c_prod NUMERIC := 0;
  calculated_percent_art_fat NUMERIC := 0;
  calculated_res_tot INTEGER := 0;
  calculated_res_p INTEGER := 0;
  calculated_num_mesas_tot INTEGER := 0;
  calculated_num_mesas_presentes INTEGER := 0;
  calculated_percent_stockout NUMERIC := 0;
  calculated_stockout_bebidas_perc NUMERIC := 0;
  calculated_stockout_comidas_perc NUMERIC := 0;
  calculated_stockout_drinks_perc NUMERIC := 0;

  locais_bebidas TEXT[];
  locais_comidas TEXT[];
  locais_drinks TEXT[];
  locais_bar_drinks TEXT[];
  
  v_categorias_atracao TEXT[];
  v_tempo_metrica VARCHAR(10);
BEGIN
  SELECT * INTO evento_record FROM eventos_base WHERE id = evento_id;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT CASE EXTRACT(dow FROM evento_record.data_evento)
    WHEN 0 THEN opera_domingo WHEN 1 THEN opera_segunda WHEN 2 THEN opera_terca
    WHEN 3 THEN opera_quarta WHEN 4 THEN opera_quinta WHEN 5 THEN opera_sexta WHEN 6 THEN opera_sabado
  END INTO v_opera FROM bares_config WHERE bar_id = evento_record.bar_id;

  IF v_opera = false THEN RETURN; END IF;

  is_evento_especial := COALESCE(evento_record.usa_yuzer, false) OR COALESCE(evento_record.usa_sympla, false);

  SELECT COALESCE(locais, ARRAY['Chopp','Bar','Pegue e Pague','Venda Volante','Baldes','PP']) INTO locais_bebidas
  FROM bar_local_mapeamento WHERE bar_id = evento_record.bar_id AND categoria = 'bebidas' AND ativo = true;
  
  SELECT COALESCE(locais, ARRAY['Cozinha 1','Cozinha 2','Cozinha']) INTO locais_comidas
  FROM bar_local_mapeamento WHERE bar_id = evento_record.bar_id AND categoria = 'comidas' AND ativo = true;
  
  SELECT COALESCE(locais, ARRAY['Preshh','Montados','Mexido','Drinks','Drinks Autorais','Shot e Dose','Batidos']) INTO locais_drinks
  FROM bar_local_mapeamento WHERE bar_id = evento_record.bar_id AND categoria = 'drinks' AND ativo = true;
  
  locais_bar_drinks := COALESCE(locais_bebidas, ARRAY[]::TEXT[]) || COALESCE(locais_drinks, ARRAY[]::TEXT[]);
  
  IF locais_bebidas IS NULL THEN locais_bebidas := ARRAY['Chopp','Bar','Pegue e Pague','Venda Volante','Baldes','PP']; END IF;
  IF locais_comidas IS NULL THEN locais_comidas := ARRAY['Cozinha 1','Cozinha 2','Cozinha']; END IF;
  IF locais_drinks IS NULL THEN locais_drinks := ARRAY['Preshh','Montados','Mexido','Drinks','Drinks Autorais','Shot e Dose','Batidos']; END IF;
  IF locais_bar_drinks IS NULL OR array_length(locais_bar_drinks, 1) IS NULL THEN locais_bar_drinks := locais_bebidas || locais_drinks; END IF;

  SELECT COALESCE(brn.tempo_metrica_bar, 't0_t3') INTO v_tempo_metrica FROM bar_regras_negocio brn WHERE brn.bar_id = evento_record.bar_id;
  IF v_tempo_metrica IS NULL THEN v_tempo_metrica := 't0_t3'; END IF;

  SELECT ARRAY_AGG(nome_categoria) INTO v_categorias_atracao FROM bar_categorias_custo
  WHERE bar_id = evento_record.bar_id AND tipo = 'atracao' AND ativo = true;
  IF v_categorias_atracao IS NULL OR array_length(v_categorias_atracao, 1) IS NULL THEN
    RAISE WARNING 'Config ausente: bar_categorias_custo tipo=atracao para bar_id=%. Usando array vazio.', evento_record.bar_id;
    v_categorias_atracao := ARRAY[]::TEXT[];
  END IF;

  -- Leitura de faturamento_pagamentos (domain table)
  SELECT COALESCE(SUM(CASE WHEN meio <> 'Conta Assinada' THEN valor_liquido ELSE 0 END), 0)::NUMERIC,
         COALESCE(SUM(CASE WHEN meio = 'Conta Assinada' THEN valor_bruto ELSE 0 END), 0)::NUMERIC
  INTO v_contahub_liquido, v_conta_assinada FROM faturamento_pagamentos
  WHERE data_pagamento = evento_record.data_evento AND bar_id = evento_record.bar_id;

  -- Leitura de visitas (domain table)
  SELECT COALESCE(SUM(CASE WHEN valor_pagamentos > 0 THEN pessoas ELSE 0 END), 0)::INTEGER AS total_pessoas_pagantes,`n         COALESCE(SUM(valor_couvert), 0)::NUMERIC AS total_couvert`n  INTO contahub_per FROM visitas WHERE data_visita = evento_record.data_evento AND bar_id = evento_record.bar_id;

  -- Leitura de faturamento_hora (domain table)
  SELECT COALESCE(SUM(CASE WHEN hora < 19 THEN valor ELSE 0 END), 0)::NUMERIC AS fat_ate_19h INTO contahub_fat
  FROM faturamento_hora WHERE data_venda = evento_record.data_evento AND bar_id = evento_record.bar_id;

  SELECT COALESCE(SUM(valor_liquido), 0)::NUMERIC INTO v_yuzer_liquido_total FROM yuzer_pagamento
  WHERE data_evento = evento_record.data_evento AND bar_id = evento_record.bar_id;

  SELECT COALESCE(SUM(valor_total), 0)::NUMERIC, COALESCE(SUM(quantidade), 0)::INTEGER
  INTO v_yuzer_ingressos_valor, v_yuzer_ingressos_qtd FROM yuzer_produtos
  WHERE data_evento = evento_record.data_evento AND bar_id = evento_record.bar_id AND LOWER(produto_nome) LIKE '%ingresso%';

  v_yuzer_bar_valor := COALESCE(v_yuzer_liquido_total, 0) - COALESCE(v_yuzer_ingressos_valor, 0);

  SELECT COALESCE(SUM(valor_liquido), 0)::NUMERIC INTO v_sympla_liquido FROM sympla_pedidos
  WHERE data_pedido::date = evento_record.data_evento AND bar_id = evento_record.bar_id AND status_pedido = 'APPROVED';

  SELECT COALESCE(COUNT(DISTINCT participante_sympla_id), 0)::INTEGER INTO v_sympla_checkins FROM sympla_participantes
  WHERE bar_id = evento_record.bar_id AND fez_checkin = true AND status_pedido = 'APPROVED' AND data_checkin::date = evento_record.data_evento;

  SELECT COALESCE(SUM(CASE WHEN status IN ('seated','pending','no-show','canceled-user','canceled-agent') THEN people ELSE 0 END), 0)::INTEGER AS total_reservas,
         COALESCE(SUM(CASE WHEN status IN ('seated','pending') THEN people ELSE 0 END), 0)::INTEGER AS reservas_presentes,
         COALESCE(COUNT(*) FILTER (WHERE status IN ('seated','pending','no-show','canceled-user','canceled-agent')), 0)::INTEGER AS total_mesas,
         COALESCE(COUNT(*) FILTER (WHERE status IN ('seated','pending')), 0)::INTEGER AS mesas_presentes
  INTO getin_reservas FROM getin_reservations WHERE reservation_date = evento_record.data_evento AND bar_id = evento_record.bar_id;

  SELECT COALESCE(SUM(CASE WHEN categoria_nome = ANY(v_categorias_atracao) AND (categoria_nome ILIKE '%programa%' OR categoria_nome ILIKE '%atra%') AND categoria_nome NOT ILIKE '%produ%' THEN valor ELSE 0 END), 0)::NUMERIC AS custo_artistico,
         COALESCE(SUM(CASE WHEN categoria_nome = ANY(v_categorias_atracao) AND categoria_nome ILIKE '%produ%' THEN valor ELSE 0 END), 0)::NUMERIC AS custo_producao
  INTO nibo_custos FROM nibo_agendamentos WHERE data_competencia = evento_record.data_evento AND bar_id = evento_record.bar_id;

  IF nibo_custos.custo_artistico = 0 AND nibo_custos.custo_producao = 0 THEN
    SELECT COALESCE(SUM(CASE WHEN categoria_nome = ANY(v_categorias_atracao) THEN valor ELSE 0 END), 0)::NUMERIC AS custo_artistico, 0::NUMERIC AS custo_producao
    INTO nibo_custos FROM nibo_agendamentos WHERE data_competencia = evento_record.data_evento AND bar_id = evento_record.bar_id;
  END IF;

  IF NOT is_evento_especial THEN
    -- Leitura de vendas_item (domain table)
    SELECT COALESCE(SUM(vi.valor), 0)::NUMERIC, COALESCE(SUM(CASE WHEN vi.categoria_mix = 'BEBIDA' THEN vi.valor ELSE 0 END), 0)::NUMERIC,
           COALESCE(SUM(CASE WHEN vi.categoria_mix = 'COMIDA' THEN vi.valor ELSE 0 END), 0)::NUMERIC,
           COALESCE(SUM(CASE WHEN vi.categoria_mix = 'DRINK' THEN vi.valor ELSE 0 END), 0)::NUMERIC,
           COALESCE(SUM(CASE WHEN vi.grupo_desc = 'Happy Hour' THEN vi.valor ELSE 0 END), 0)::NUMERIC
    INTO contahub_ana FROM vendas_item vi
    WHERE vi.data_venda = evento_record.data_evento AND vi.bar_id = evento_record.bar_id
      AND vi.tipo_transacao IN ('venda integral', 'com desconto', '100% desconto') AND vi.categoria_mix IS NOT NULL;

    IF COALESCE(contahub_ana.total_valorfinal, 0) > 0 THEN
      calculated_percent_b := (COALESCE(contahub_ana.valor_bebidas, 0) / contahub_ana.total_valorfinal) * 100;
      calculated_percent_c := (COALESCE(contahub_ana.valor_comidas, 0) / contahub_ana.total_valorfinal) * 100;
      calculated_percent_d := (COALESCE(contahub_ana.valor_drinks, 0) / contahub_ana.total_valorfinal) * 100;
      calculated_percent_happy_hour := (COALESCE(contahub_ana.valor_happy_hour, 0) / contahub_ana.total_valorfinal) * 100;
    END IF;
  END IF;

  calculated_cl_real := COALESCE(contahub_per.total_pessoas_pagantes, 0) + COALESCE(v_yuzer_ingressos_qtd, 0) + COALESCE(v_sympla_checkins, 0);
  calculated_real_r := COALESCE(v_contahub_liquido, 0) + COALESCE(v_yuzer_liquido_total, 0) + COALESCE(v_sympla_liquido, 0);
  calculated_faturamento_entrada := COALESCE(contahub_per.total_couvert, 0) + COALESCE(v_yuzer_ingressos_valor, 0) + COALESCE(v_sympla_liquido, 0);
  calculated_faturamento_bar := (COALESCE(v_contahub_liquido, 0) - COALESCE(contahub_per.total_couvert, 0)) + COALESCE(v_yuzer_bar_valor, 0);

  IF calculated_cl_real > 0 THEN
    calculated_te_real := calculated_faturamento_entrada / calculated_cl_real::NUMERIC;
    calculated_tb_real := calculated_faturamento_bar / calculated_cl_real::NUMERIC;
  END IF;
  calculated_t_medio := calculated_te_real + calculated_tb_real;

  IF COALESCE(evento_record.cl_plan, 0) > 0 THEN calculated_lot_max := evento_record.cl_plan / 1.3; END IF;

  calculated_fat_19h := COALESCE(contahub_fat.fat_ate_19h, 0);
  IF calculated_real_r > 0 THEN calculated_fat_19h_percent := (calculated_fat_19h / calculated_real_r) * 100; END IF;

  calculated_c_art := COALESCE(nibo_custos.custo_artistico, 0);
  calculated_c_prod := COALESCE(nibo_custos.custo_producao, 0);
  IF calculated_real_r > 0 THEN calculated_percent_art_fat := ((calculated_c_art + calculated_c_prod) / calculated_real_r) * 100; END IF;

  calculated_res_tot := COALESCE(getin_reservas.total_reservas, evento_record.res_tot, 0);
  calculated_res_p := COALESCE(getin_reservas.reservas_presentes, evento_record.res_p, 0);
  calculated_num_mesas_tot := COALESCE(getin_reservas.total_mesas, evento_record.num_mesas_tot, 0);
  calculated_num_mesas_presentes := COALESCE(getin_reservas.mesas_presentes, evento_record.num_mesas_presentes, 0);

  UPDATE eventos_base SET
    cl_real = calculated_cl_real, real_r = calculated_real_r, faturamento_entrada = calculated_faturamento_entrada,
    te_real = calculated_te_real, tb_real = calculated_tb_real, t_medio = calculated_t_medio, lot_max = calculated_lot_max,
    percent_b = calculated_percent_b, percent_c = calculated_percent_c, percent_d = calculated_percent_d,
    percent_happy_hour = calculated_percent_happy_hour, t_coz = calculated_t_coz, t_bar = calculated_t_bar,
    atrasinho_cozinha = calculated_atrasinho_cozinha, atrasinho_bar = calculated_atrasinho_bar,
    atrasao_cozinha = calculated_atrasao_cozinha, atrasao_bar = calculated_atrasao_bar,
    fat_19h = calculated_fat_19h, fat_19h_percent = calculated_fat_19h_percent,
    c_art = calculated_c_art, c_prod = calculated_c_prod, percent_art_fat = calculated_percent_art_fat,
    res_tot = calculated_res_tot, res_p = calculated_res_p, num_mesas_tot = calculated_num_mesas_tot,
    num_mesas_presentes = calculated_num_mesas_presentes, conta_assinada = COALESCE(v_conta_assinada, 0),
    stockout_bebidas_perc = calculated_stockout_bebidas_perc, stockout_comidas_perc = calculated_stockout_comidas_perc,
    stockout_drinks_perc = calculated_stockout_drinks_perc, percent_stockout = calculated_percent_stockout,
    sympla_liquido = COALESCE(v_sympla_liquido, 0), sympla_checkins = COALESCE(v_sympla_checkins, 0),
    yuzer_liquido = COALESCE(v_yuzer_liquido_total, 0), yuzer_ingressos = COALESCE(v_yuzer_ingressos_qtd, 0)::NUMERIC,
    calculado_em = NOW(), precisa_recalculo = FALSE, atualizado_em = NOW(), versao_calculo = 7
  WHERE id = evento_id;
END;
$function$;