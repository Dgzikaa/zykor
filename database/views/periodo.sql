-- View: periodo
-- Alias para contahub_periodo com campos calculados
-- Dados de período/comandas

CREATE OR REPLACE VIEW public.periodo AS
SELECT id,
    dt_gerencial,
    tipovenda,
    vd_mesadesc,
    vd_localizacao,
    cht_nome,
    cli_nome,
    cli_dtnasc,
    cli_email,
    cli_fone,
    usr_abriu,
    pessoas,
    qtd_itens,
    vr_pagamentos,
    vr_produtos,
    vr_repique,
    vr_couvert,
    vr_desconto,
    motivo,
    dt_contabil,
    ultimo_pedido,
    vd_dtcontabil,
    created_at,
    updated_at,
    bar_id,
    semana,
    idempotency_key,
    COALESCE(vr_pagamentos * 0.03, 0::numeric) AS vr_taxa,
    0::numeric AS vr_acrescimo,
    COALESCE(vr_pagamentos, 0::numeric) + COALESCE(vr_couvert, 0::numeric) AS vr_total
FROM contahub_periodo;
