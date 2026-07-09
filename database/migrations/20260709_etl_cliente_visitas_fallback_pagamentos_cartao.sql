-- CRM/clientes ativos + API do parceiro (silver.cliente_visitas → cliente_estatisticas):
-- o telefone/nome do cliente sempre veio do relatório de PERÍODO (vendasperiodo.cli_fone/cli_nome).
-- Desde 06/07/2026 (modelo CARTÃO) esses campos vêm VAZIOS no período — o cliente passou a vir só
-- no relatório de PAGAMENTOS, nos campos cht_fonea/cht_nome (que o contahub-processor já normaliza
-- para cli_fone/cliente). Como o período não tem cht_fonea, ~95% dos clientes deixaram de ser
-- contabilizados (25 chegavam ao visitas vs. 457 transações com telefone no pagamentos).
--
-- Fix: o CTE estadia_cli (que já junta pagamentos por vd/trn só pelo cli/id) passa a trazer também
-- telefone/nome/cpf do pagamentos, e o SELECT usa isso como FALLBACK quando o período vem vazio.
-- Assim o telefone do modelo cartão entra no CRM sem mudar nenhum consumidor a jusante.
CREATE OR REPLACE FUNCTION public.etl_silver_cliente_visitas_dia(p_bar_id integer, p_data date)
 RETURNS TABLE(linhas_processadas integer, linhas_inseridas integer, linhas_atualizadas integer, duracao_ms integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'silver', 'bronze', 'operations'
AS $function$
DECLARE
  v_start         timestamptz := clock_timestamp();
  v_total_antes   bigint;
  v_total_depois  bigint;
  v_processadas   integer;
  v_inseridas     integer;
  v_atualizadas   integer;
BEGIN
  IF p_bar_id IS NULL OR p_data IS NULL THEN
    RAISE EXCEPTION 'p_bar_id e p_data sao obrigatorios';
  END IF;

  IF p_data < '2024-01-01' OR p_data > CURRENT_DATE + 1 THEN
    RAISE EXCEPTION 'p_data fora do range valido (2024-01-01..hoje+1): %', p_data;
  END IF;

  SELECT COUNT(*) INTO v_total_antes
  FROM silver.cliente_visitas
  WHERE bar_id = p_bar_id AND data_visita = p_data;

  WITH
  estadia_real AS (
    -- v3 2026-05-05: prioriza vd_hrabertura/vd_hrsaida do PDV (autoritativo).
    -- Fallback pra calculo via tempos_producao quando ausente.
    SELECT vp.bar_id, vp.vd::int AS vd, vp.trn::int AS trn,
      COALESCE(
        (vp.vd_hrabertura::text || '-03:00')::timestamptz,
        MIN(tp.t0_lancamento AT TIME ZONE 'America/Sao_Paulo')
      ) AS abertura,
      COALESCE(
        (vp.vd_hrsaida::text || '-03:00')::timestamptz,
        MAX(COALESCE(tp.t3_entrega, tp.t2_prodfim, tp.t0_lancamento) AT TIME ZONE 'America/Sao_Paulo')
      ) AS fechamento
    FROM bronze.bronze_contahub_avendas_vendasperiodo vp
    LEFT JOIN bronze.bronze_contahub_produtos_temposproducao tp
      ON tp.bar_id = vp.bar_id AND tp.dia = vp.vd_dtgerencial AND tp.vd_mesadesc = vp.vd_mesadesc
      AND tp.t0_lancamento IS NOT NULL
    WHERE vp.bar_id = p_bar_id AND vp.vd_dtgerencial = p_data
      AND vp.vd_mesadesc IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM bronze.bronze_contahub_avendas_vendasperiodo vp2
        WHERE vp2.bar_id = vp.bar_id AND vp2.vd_dtgerencial = vp.vd_dtgerencial
          AND vp2.vd_mesadesc = vp.vd_mesadesc AND vp2.vd <> vp.vd
      )
    GROUP BY vp.bar_id, vp.vd::int, vp.trn::int, vp.vd_hrabertura, vp.vd_hrsaida
  ),
  estadia_cli AS (
    -- Além do id do cliente (cli), traz telefone/nome/cpf do PAGAMENTOS como fallback do período:
    -- no modelo cartão (06/07/2026+) o período vem sem telefone, e o cliente só existe aqui
    -- (cli_fone/cliente já normalizados a partir de cht_fonea/cht_nome pelo contahub-processor).
    SELECT vd::int AS vd, trn::int AS trn, MAX(cli) AS cli_id_contahub,
      MAX(cli_fone) FILTER (WHERE cli_fone IS NOT NULL AND TRIM(cli_fone) <> '') AS cli_fone_pag,
      MAX(cliente)  FILTER (WHERE cliente  IS NOT NULL AND TRIM(cliente)  <> '') AS cli_nome_pag,
      MAX(cli_cpf)  FILTER (WHERE cli_cpf  IS NOT NULL AND TRIM(cli_cpf)  <> '') AS cli_cpf_pag
    FROM bronze.bronze_contahub_financeiro_pagamentosrecebidos
    WHERE bar_id = p_bar_id AND dt_gerencial = p_data AND hr_lancamento IS NOT NULL
    GROUP BY vd::int, trn::int
  ),
  meios_agregados AS (
    SELECT vd::int AS vd, trn::int AS trn, meio, SUM(valor)::numeric(14,2) AS valor_meio
    FROM bronze.bronze_contahub_financeiro_pagamentosrecebidos
    WHERE bar_id = p_bar_id AND dt_gerencial = p_data AND meio IS NOT NULL
    GROUP BY vd::int, trn::int, meio
  ),
  meio_principal AS (
    SELECT DISTINCT ON (vd, trn) vd, trn, meio AS meio_principal
    FROM meios_agregados ORDER BY vd, trn, valor_meio DESC NULLS LAST, meio ASC
  ),
  meios_jsonb AS (
    SELECT vd, trn, jsonb_object_agg(meio, valor_meio) AS pagamentos_por_meio
    FROM meios_agregados GROUP BY vd, trn
  ),
  mix_por_venda AS (
    SELECT pa.vd_mesadesc, pa.trn::int AS trn,
      COALESCE(SUM(pa.valorfinal) FILTER (WHERE pcm.categoria='BEBIDA'),0)::numeric(14,2) AS vr_bebida,
      COALESCE(SUM(pa.valorfinal) FILTER (WHERE pcm.categoria='COMIDA'),0)::numeric(14,2) AS vr_comida,
      COALESCE(SUM(pa.valorfinal) FILTER (WHERE pcm.categoria='DRINK' ),0)::numeric(14,2) AS vr_drink,
      COALESCE(SUM(pa.qtd) FILTER (WHERE pcm.categoria='BEBIDA'),0)::numeric(14,3) AS qtd_bebida,
      COALESCE(SUM(pa.qtd) FILTER (WHERE pcm.categoria='COMIDA'),0)::numeric(14,3) AS qtd_comida,
      COALESCE(SUM(pa.qtd) FILTER (WHERE pcm.categoria='DRINK' ),0)::numeric(14,3) AS qtd_drink
    FROM bronze.bronze_contahub_avendas_porproduto_analitico pa
    LEFT JOIN operations.produto_categoria_mix pcm ON pcm.bar_id=pa.bar_id AND pcm.loc_desc=pa.loc_desc
    WHERE pa.bar_id=p_bar_id AND pa.trn_dtgerencial=p_data
      AND pa.vd_mesadesc IS NOT NULL AND pa.vd_mesadesc<>'Insumo' AND pa.loc_desc IS NOT NULL
    GROUP BY pa.vd_mesadesc, pa.trn::int
  ),
  produtos_ranqueados AS (
    SELECT pa.vd_mesadesc, pa.trn::int AS trn, pa.prd_desc,
      SUM(pa.qtd)::numeric(14,3) AS qtd_total, SUM(pa.valorfinal)::numeric(14,2) AS valor_total,
      ROW_NUMBER() OVER (PARTITION BY pa.vd_mesadesc, pa.trn::int
        ORDER BY SUM(pa.valorfinal) DESC NULLS LAST, pa.prd_desc) AS rn
    FROM bronze.bronze_contahub_avendas_porproduto_analitico pa
    WHERE pa.bar_id=p_bar_id AND pa.trn_dtgerencial=p_data
      AND pa.vd_mesadesc IS NOT NULL AND pa.vd_mesadesc<>'Insumo' AND pa.prd_desc IS NOT NULL
    GROUP BY pa.vd_mesadesc, pa.trn::int, pa.prd_desc
  ),
  top5_produtos AS (
    SELECT vd_mesadesc, trn,
      jsonb_object_agg(prd_desc, jsonb_build_object('qtd', qtd_total, 'valor', valor_total)) AS produtos_consumidos
    FROM produtos_ranqueados WHERE rn <= 5 GROUP BY vd_mesadesc, trn
  ),
  cancelamentos AS (
    SELECT DISTINCT vd FROM bronze.bronze_contahub_avendas_cancelamentos
    WHERE bar_id=p_bar_id AND dt_gerencial=p_data
  )
  INSERT INTO silver.cliente_visitas AS cv (
    id, bar_id, data_visita, vd, trn,
    cliente_fone, cliente_fone_norm, cli_id_contahub, cliente_nome, cliente_cpf,
    valor_pagamentos, valor_produtos, valor_couvert, valor_desconto, valor_repique,
    valor_consumo, pessoas, qtd_itens,
    mesa_desc, tipo_venda, localizacao, motivo_desconto, usuario_abriu,
    hora_abertura, hora_fechamento, tempo_estadia_minutos, dia_semana, hora_chegada,
    vr_bebida, vr_comida, vr_drink, qtd_bebida, qtd_comida, qtd_drink,
    categoria_predominante, produtos_consumidos,
    meio_pagamento_principal, pagamentos_por_meio, teve_cancelamento,
    tem_telefone, tem_cli_id_contahub, tem_cpf, tem_nome,
    tem_estadia_calculada, tem_pagamento_registrado,
    calculado_em, versao_etl
  )
  SELECT v.id, v.bar_id, v.vd_dtgerencial, v.vd, v.trn,
    -- telefone/nome/cpf: período (autoritativo) com fallback pro pagamentos (modelo cartão)
    COALESCE(NULLIF(TRIM(v.cli_fone), ''), ec.cli_fone_pag),
    public.normalizar_telefone_br(COALESCE(NULLIF(TRIM(v.cli_fone), ''), ec.cli_fone_pag)),
    ec.cli_id_contahub,
    COALESCE(NULLIF(TRIM(v.cli_nome), ''), NULLIF(TRIM(ec.cli_nome_pag), '')),
    COALESCE(NULLIF(TRIM(v.cpf), ''), NULLIF(TRIM(ec.cli_cpf_pag), '')),
    COALESCE(v.vd_vrpagamentos,0), COALESCE(v.vd_vrprodutos,0),
    COALESCE(v.vd_vrcouvert,0), COALESCE(v.vd_vrdescontos,0), COALESCE(v.vd_vrrepique,0),
    COALESCE(v.vd_vrpagamentos,0) - COALESCE(v.vd_vrcouvert,0),
    COALESCE(v.vd_pessoas,0), COALESCE(v.vd_qtditens,0),
    NULLIF(v.vd_mesadesc,''), NULLIF(v.tipovenda,''), NULLIF(v.vd_localizacao,''),
    NULLIF(v.vd_motivodesconto,''), NULLIF(v.usrabriu,''),
    er.abertura, er.fechamento,
    CASE WHEN er.abertura IS NOT NULL AND er.fechamento IS NOT NULL
          AND er.fechamento > er.abertura
          AND (er.fechamento - er.abertura) < INTERVAL '24 hours'
      THEN (EXTRACT(EPOCH FROM (er.fechamento - er.abertura))/60)::int
      ELSE NULL END,
    EXTRACT(DOW FROM v.vd_dtgerencial)::smallint,
    CASE WHEN er.abertura IS NOT NULL
      THEN EXTRACT(HOUR FROM (er.abertura AT TIME ZONE 'America/Sao_Paulo'))::smallint
      ELSE NULL END,
    COALESCE(m.vr_bebida,0), COALESCE(m.vr_comida,0), COALESCE(m.vr_drink,0),
    COALESCE(m.qtd_bebida,0), COALESCE(m.qtd_comida,0), COALESCE(m.qtd_drink,0),
    CASE
      WHEN COALESCE(m.vr_bebida,0)+COALESCE(m.vr_comida,0)+COALESCE(m.vr_drink,0)=0 THEN NULL
      WHEN COALESCE(m.vr_bebida,0)>=COALESCE(m.vr_comida,0) AND COALESCE(m.vr_bebida,0)>=COALESCE(m.vr_drink,0) THEN 'BEBIDA'
      WHEN COALESCE(m.vr_comida,0)>=COALESCE(m.vr_drink,0) THEN 'COMIDA'
      ELSE 'DRINK' END,
    COALESCE(t5.produtos_consumidos, '{}'::jsonb),
    mp.meio_principal, COALESCE(mj.pagamentos_por_meio, '{}'::jsonb),
    (c.vd IS NOT NULL),
    -- flags recalculadas sobre o valor COALESCED (período + fallback pagamentos)
    (COALESCE(NULLIF(TRIM(v.cli_fone), ''), ec.cli_fone_pag) IS NOT NULL
      AND LENGTH(REGEXP_REPLACE(COALESCE(NULLIF(TRIM(v.cli_fone), ''), ec.cli_fone_pag), '\D', '', 'g')) >= 10),
    (ec.cli_id_contahub IS NOT NULL),
    (COALESCE(NULLIF(TRIM(v.cpf), ''), NULLIF(TRIM(ec.cli_cpf_pag), '')) IS NOT NULL),
    (COALESCE(NULLIF(TRIM(v.cli_nome), ''), NULLIF(TRIM(ec.cli_nome_pag), '')) IS NOT NULL),
    (er.abertura IS NOT NULL AND er.fechamento IS NOT NULL AND er.fechamento > er.abertura),
    (mj.pagamentos_por_meio IS NOT NULL AND mj.pagamentos_por_meio <> '{}'::jsonb),
    NOW(), 3
  FROM bronze.bronze_contahub_avendas_vendasperiodo v
  LEFT JOIN estadia_real   er ON er.vd = v.vd AND er.trn = v.trn
  LEFT JOIN estadia_cli    ec ON ec.vd = v.vd AND ec.trn = v.trn
  LEFT JOIN mix_por_venda  m  ON m.vd_mesadesc = v.vd_mesadesc AND m.trn = v.trn
  LEFT JOIN top5_produtos  t5 ON t5.vd_mesadesc = v.vd_mesadesc AND t5.trn = v.trn
  LEFT JOIN meio_principal mp ON mp.vd = v.vd AND mp.trn = v.trn
  LEFT JOIN meios_jsonb    mj ON mj.vd = v.vd AND mj.trn = v.trn
  LEFT JOIN cancelamentos  c  ON c.vd = v.vd
  WHERE v.bar_id = p_bar_id AND v.vd_dtgerencial = p_data
  ON CONFLICT (id) DO UPDATE SET
    bar_id=EXCLUDED.bar_id, data_visita=EXCLUDED.data_visita, vd=EXCLUDED.vd, trn=EXCLUDED.trn,
    cliente_fone=EXCLUDED.cliente_fone, cliente_fone_norm=EXCLUDED.cliente_fone_norm,
    cli_id_contahub=EXCLUDED.cli_id_contahub, cliente_nome=EXCLUDED.cliente_nome,
    cliente_cpf=EXCLUDED.cliente_cpf,
    valor_pagamentos=EXCLUDED.valor_pagamentos, valor_produtos=EXCLUDED.valor_produtos,
    valor_couvert=EXCLUDED.valor_couvert, valor_desconto=EXCLUDED.valor_desconto,
    valor_repique=EXCLUDED.valor_repique, valor_consumo=EXCLUDED.valor_consumo,
    pessoas=EXCLUDED.pessoas, qtd_itens=EXCLUDED.qtd_itens,
    mesa_desc=EXCLUDED.mesa_desc, tipo_venda=EXCLUDED.tipo_venda,
    localizacao=EXCLUDED.localizacao, motivo_desconto=EXCLUDED.motivo_desconto,
    usuario_abriu=EXCLUDED.usuario_abriu,
    hora_abertura=EXCLUDED.hora_abertura, hora_fechamento=EXCLUDED.hora_fechamento,
    tempo_estadia_minutos=EXCLUDED.tempo_estadia_minutos,
    dia_semana=EXCLUDED.dia_semana, hora_chegada=EXCLUDED.hora_chegada,
    vr_bebida=EXCLUDED.vr_bebida, vr_comida=EXCLUDED.vr_comida, vr_drink=EXCLUDED.vr_drink,
    qtd_bebida=EXCLUDED.qtd_bebida, qtd_comida=EXCLUDED.qtd_comida, qtd_drink=EXCLUDED.qtd_drink,
    categoria_predominante=EXCLUDED.categoria_predominante,
    produtos_consumidos=EXCLUDED.produtos_consumidos,
    meio_pagamento_principal=EXCLUDED.meio_pagamento_principal,
    pagamentos_por_meio=EXCLUDED.pagamentos_por_meio,
    teve_cancelamento=EXCLUDED.teve_cancelamento,
    tem_telefone=EXCLUDED.tem_telefone, tem_cli_id_contahub=EXCLUDED.tem_cli_id_contahub,
    tem_cpf=EXCLUDED.tem_cpf, tem_nome=EXCLUDED.tem_nome,
    tem_estadia_calculada=EXCLUDED.tem_estadia_calculada,
    tem_pagamento_registrado=EXCLUDED.tem_pagamento_registrado,
    calculado_em=NOW(), versao_etl=EXCLUDED.versao_etl;

  GET DIAGNOSTICS v_processadas = ROW_COUNT;

  SELECT COUNT(*) INTO v_total_depois
  FROM silver.cliente_visitas WHERE bar_id = p_bar_id AND data_visita = p_data;

  v_inseridas := GREATEST(v_total_depois - v_total_antes, 0)::int;
  v_atualizadas := (v_processadas - v_inseridas)::int;

  RETURN QUERY SELECT v_processadas, v_inseridas, v_atualizadas,
    ((EXTRACT(EPOCH FROM (clock_timestamp() - v_start)) * 1000))::int;
END;
$function$;
