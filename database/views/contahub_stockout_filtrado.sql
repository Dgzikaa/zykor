-- View: contahub_stockout_filtrado
-- Filtra produtos ativos e relevantes para cálculo de stockout
-- Exclui: Happy Hour, Baldes, Dose Dupla, Insumos, Adicional, Embalagem, etc.

CREATE OR REPLACE VIEW public.contahub_stockout_filtrado AS
SELECT id,
    bar_id,
    data_consulta,
    hora_consulta,
    emp,
    prd,
    loc,
    prd_desc,
    prd_venda,
    prd_ativo,
    prd_produzido,
    prd_unid,
    prd_precovenda,
    prd_estoque,
    prd_controlaestoque,
    prd_validaestoquevenda,
    prd_opcoes,
    prd_venda7,
    prd_venda30,
    prd_venda180,
    prd_nfencm,
    prd_nfeorigem,
    prd_nfecsosn,
    prd_nfecstpiscofins,
    prd_nfepis,
    prd_nfecofins,
    prd_nfeicms,
    prd_qtddouble,
    prd_disponivelonline,
    prd_cardapioonline,
    prd_semcustoestoque,
    prd_balanca,
    prd_delivery,
    prd_entregaimediata,
    prd_semrepique,
    prd_naoimprimeproducao,
    prd_agrupaimpressao,
    prd_contagemehperda,
    prd_naodesmembra,
    prd_naoimprimeficha,
    prd_servico,
    prd_zeraestoquenacompra,
    loc_desc,
    loc_inativo,
    loc_statusimpressao,
    raw_data,
    created_at,
    updated_at,
    categoria_mix,
    CASE
        WHEN categoria_mix = 'COMIDA'::text THEN 'Comidas'::text
        WHEN categoria_mix = 'DRINK'::text THEN 'Drinks'::text
        WHEN categoria_mix = 'BEBIDA'::text THEN 'Bar'::text
        ELSE COALESCE(loc_desc, 'Outro'::text)
    END AS categoria_local
FROM contahub_stockout cs
WHERE prd_ativo = 'S'::text
  AND loc_desc IS NOT NULL
  AND loc_desc <> 'Pegue e Pague'::text
  AND loc_desc <> 'Venda Volante'::text
  AND loc_desc <> 'Baldes'::text
  AND prd_desc !~~* '%[HH]%'::text
  AND prd_desc !~~* '%[PP]%'::text
  AND prd_desc !~~* '%[DD]%'::text
  AND prd_desc !~~* '%[IN]%'::text
  AND prd_desc !~~* '%Happy Hour%'::text
  AND prd_desc !~~* '%HappyHour%'::text
  AND prd_desc !~~* '%Happy-Hour%'::text
  AND prd_desc !~~* '% HH'::text
  AND prd_desc !~~* '% HH %'::text
  AND (COALESCE(raw_data ->> 'grp_desc'::text, ''::text) <> ALL (ARRAY[
    'Baldes'::text, 'Happy Hour'::text, 'Chegadeira'::text,
    'Dose dupla'::text, 'Dose Dupla'::text, 'Dose dupla!'::text, 'Dose Dupla!'::text,
    'Dose dupla sem álcool'::text, 'Dose Dupla sem álcool'::text,
    'Grupo adicional'::text, 'Grupo Adicional'::text, 'Insumos'::text,
    'Promo chivas'::text, 'Promo Chivas'::text,
    'Uso interno'::text, 'Uso Interno'::text, 'Pegue e Pague'::text
  ]))
  AND prd_desc !~~* '%Dose Dupla%'::text
  AND prd_desc !~~* '%Dose Dulpa%'::text
  AND prd_desc !~~* '%Balde%'::text
  AND prd_desc !~~* '%Garrafa%'::text
  AND prd_desc !~~* 'Combo %'::text
  AND prd_desc !~~* '%Adicional%'::text
  AND prd_desc !~~* '%Embalagem%'::text;
