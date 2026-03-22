-- View: analitico
-- Alias para contahub_analitico
-- Dados analíticos de vendas

CREATE OR REPLACE VIEW public.analitico AS
SELECT id,
    vd_mesadesc,
    vd_localizacao,
    itm,
    trn,
    trn_desc,
    prefixo,
    tipo,
    tipovenda,
    ano,
    mes,
    trn_dtgerencial,
    usr_lancou,
    prd,
    prd_desc,
    grp_desc,
    loc_desc,
    qtd,
    desconto,
    valorfinal,
    custo,
    itm_obs,
    comandaorigem,
    itemorigem,
    bar_id,
    created_at,
    updated_at,
    idempotency_key,
    valorfinal AS itm_valorfinal,
    qtd AS itm_qtd
FROM contahub_analitico;
