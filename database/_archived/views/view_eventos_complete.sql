-- VIEW_EVENTOS COMPLETA - SGB_V3
-- =====================================================
-- TODAS AS REGRAS DE NEGÓCIO DOCUMENTADAS
-- =====================================================

-- REGRAS PRINCIPAIS:
-- 1. CLIENTES REAIS (publico_real):
--    - Domingos + 09/08: yuzer_ingressos + sympla_checkins + contahub_pessoas
--    - Outros dias: contahub_pessoas com vr_pagamentos > 0
--
-- 2. REAL RECEITA (real_r):
--    - Domingos + 09/08: ContaHub + Yuzer
--    - Outros dias: Apenas ContaHub
--
-- 3. T.COZ e T.BAR:
--    - Domingos + 09/08: Zerados
--    - Outros dias: valor_categoria / pessoas_pagantes
--
-- 4. CUSTOS NIBO:
--    - C.Art: categoria 'Atrações Programação'
--    - C.Prod: categoria 'Produção Eventos'
--
-- 5. PERCENTUAIS:
--    - Domingos + 09/08: percent_bebidas/drinks/comidas (do Yuzer)
--    - Outros dias: calculado do contahub_analitico por loc_desc
--      * %B: 'Chopp','Baldes','Pegue e Pague','PP','Venda Volante','Bar'
--      * %C: 'Cozinha','Cozinha 1','Cozinha 2'  
--      * %D: 'Preshh','Drinks','Drinks Autorais','Mexido','Shot e Dose','Batidos'
--    CAMPO: trn_dtgerencial (não vd_dtgerencial)
--
-- 6. TICKET MÉDIO REAL (te_real):
--    - Domingos + 09/08: (ch_periodo.vr_couvert + sympla_checkins + yuzer_ingressos) / cl_real
--    - Outros dias: ch_periodo.vr_couvert / cl_real
--
-- 7. TICKET BAR REAL (tb_real):
--    - Domingos + 09/08: (ch_periodo.vr_pagamentos + (yuzer_liquido - yuzer_ingressos)) / cl_real
--    - Outros dias: (ch_periodo.vr_pagamentos - te_real) / cl_real
--
-- 8. LOTAÇÃO MÁXIMA (lot_max):
--    - Sempre: cl_plan / 1.3
--
-- 9. FAT.19H (fat_19h_percent):
--    - Domingos + 09/08: yuzer_fatporhora faturamento 14:00-18:00 / total faturamento
--    - Outros dias: contahub_fatporhora soma valor hora < 19 / real_r
--
-- 10. %ART/FAT (percent_art_fat):
--    - Sempre: (c_art + c_prod) / real_r * 100

DROP VIEW IF EXISTS view_eventos;

CREATE VIEW view_eventos AS
SELECT 
    e.id,
    e.bar_id,
    e.nome,
    e.data_evento,
    e.dia_semana,
    e.casa_show,
    e.artista,
    e.promoter,
    e.status,
    e.tipo_evento,
    e.receita_garantida,
    e.receita_bar,
    e.receita_total,
    e.custo_producao,
    e.lucro_bruto,
    e.margem_bruto,
    e.despesas_operacionais,
    e.lucro_liquido,
    e.margem_liquido,
    e.publico_esperado,
    
    -- =================================================
    -- LOTAÇÃO MÁXIMA (LOT_MAX) - REGRA CALCULADA
    -- =================================================
    CASE 
        WHEN COALESCE(e.cl_plan, 0) > 0 
        THEN e.cl_plan / 1.3
        ELSE 0
    END AS lot_max,
    e.observacoes,
    e.criado_em,
    e.atualizado_em,
    e.c_art,
    
    -- =================================================
    -- CLIENTES REAIS (REGRA ESPECÍFICA)
    -- =================================================
    CASE
        WHEN upper(e.dia_semana::text) = 'DOMINGO'::text OR e.data_evento = '2025-08-09'::date 
        THEN COALESCE(y.quantidade_ingressos, 0) + COALESCE(sp.sympla_checkins, 0) + COALESCE(ch_periodo.total_pessoas, 0)
        ELSE COALESCE(ch_periodo.total_pessoas_pagantes, 0)
    END AS publico_real,
    
    -- =================================================
    -- TICKET MÉDIO (baseado no público real)
    -- =================================================
    CASE 
        WHEN (CASE
            WHEN upper(e.dia_semana::text) = 'DOMINGO'::text OR e.data_evento = '2025-08-09'::date 
            THEN COALESCE(y.quantidade_ingressos, 0) + COALESCE(sp.sympla_checkins, 0) + COALESCE(ch_periodo.total_pessoas, 0)
            ELSE COALESCE(ch_periodo.total_pessoas_pagantes, 0)
        END) > 0 
        THEN COALESCE(pag.total_liquido, 0) / (CASE
            WHEN upper(e.dia_semana::text) = 'DOMINGO'::text OR e.data_evento = '2025-08-09'::date 
            THEN COALESCE(y.quantidade_ingressos, 0) + COALESCE(sp.sympla_checkins, 0) + COALESCE(ch_periodo.total_pessoas, 0)
            ELSE COALESCE(ch_periodo.total_pessoas_pagantes, 0)
        END)
        ELSE 0
    END AS ticket_medio,
    
    -- =================================================
    -- DADOS CONTAHUB
    -- =================================================
    pag.total_liquido AS cont_liquido,
    pag.total_liquido AS liquido_real,
    
    -- =================================================
    -- DADOS YUZER (CORRIGIDOS - SEM DUPLICAÇÃO)
    -- =================================================
    y.faturamento_bruto AS yuzer_bruto,
    y.faturamento_liquido AS yuzer_liquido,
    y.receita_ingressos AS yuzer_ingressos,
    y.quantidade_ingressos AS yuzer_qtd_ingressos,
    y.credito AS yuzer_credito,
    y.debito AS yuzer_debito,
    y.pix AS yuzer_pix,
    y.dinheiro AS yuzer_dinheiro,
    y.faturamento_liquido AS faturamento_liquido_yuz,
    
    -- =================================================
    -- PERCENTUAIS (%B, %D, %C) - REGRA ESPECÍFICA
    -- =================================================
    CASE
        WHEN upper(e.dia_semana::text) = 'DOMINGO'::text OR e.data_evento = '2025-08-09'::date 
        THEN y.percent_bebidas
        ELSE COALESCE(ch_analitico.percent_bebidas, 0)
    END AS percent_b,
    
    CASE
        WHEN upper(e.dia_semana::text) = 'DOMINGO'::text OR e.data_evento = '2025-08-09'::date 
        THEN y.percent_drinks  
        ELSE COALESCE(ch_analitico.percent_drinks, 0)
    END AS percent_d,
    
    CASE
        WHEN upper(e.dia_semana::text) = 'DOMINGO'::text OR e.data_evento = '2025-08-09'::date 
        THEN y.percent_comidas
        ELSE COALESCE(ch_analitico.percent_comidas, 0)
    END AS percent_c,
    
    -- =================================================
    -- T.COZ E T.BAR (ZERADOS PARA DOMINGO)
    -- =================================================
    CASE
        WHEN upper(e.dia_semana::text) = 'DOMINGO'::text OR e.data_evento = '2025-08-09'::date 
        THEN 0::numeric
        ELSE CASE 
            WHEN COALESCE(ch_periodo.total_pessoas_pagantes, 0) > 0 
            THEN COALESCE(y.valor_comidas, 0) / ch_periodo.total_pessoas_pagantes
            ELSE 0
        END
    END AS t_coz,
    
    CASE
        WHEN upper(e.dia_semana::text) = 'DOMINGO'::text OR e.data_evento = '2025-08-09'::date 
        THEN 0::numeric
        ELSE CASE 
            WHEN COALESCE(ch_periodo.total_pessoas_pagantes, 0) > 0 
            THEN COALESCE(y.valor_bebidas, 0) / ch_periodo.total_pessoas_pagantes
            ELSE 0
        END
    END AS t_bar,
    
    -- =================================================
    -- FAT.19H VALOR
    -- =================================================
    y.fat_ate_19h_valor AS fat_19h,
    
    -- =================================================
    -- FAT.19H PERCENTUAL - REGRA ESPECÍFICA
    -- =================================================
    CASE
        WHEN upper(e.dia_semana::text) = 'DOMINGO'::text OR e.data_evento = '2025-08-09'::date 
        THEN 
            CASE 
                WHEN (COALESCE(pag.total_liquido, 0::numeric) + COALESCE(y.faturamento_liquido, 0::numeric)) > 0 
                THEN (COALESCE(yuzer_fatporhora.fat_14_18h, 0) / COALESCE(yuzer_fatporhora.fat_total, 1)) * 100
                ELSE 0
            END
        ELSE 
            CASE 
                WHEN COALESCE(pag.total_liquido, 0::numeric) > 0 
                THEN (COALESCE(ch_fatporhora.fat_ate_19h, 0) / pag.total_liquido) * 100
                ELSE 0
            END
    END AS fat_19h_percent,
    
    -- =================================================
    -- %ART/FAT - REGRA ESPECÍFICA
    -- =================================================
    CASE 
        WHEN (CASE
            WHEN upper(e.dia_semana::text) = 'DOMINGO'::text OR e.data_evento = '2025-08-09'::date 
            THEN COALESCE(pag.total_liquido, 0::numeric) + COALESCE(y.faturamento_liquido, 0::numeric)
            ELSE COALESCE(pag.total_liquido, 0::numeric)
        END) > 0 
        THEN ((COALESCE(nibo_custos.custo_artistico, 0) + COALESCE(nibo_custos.custo_producao, 0)) / (CASE
            WHEN upper(e.dia_semana::text) = 'DOMINGO'::text OR e.data_evento = '2025-08-09'::date 
            THEN COALESCE(pag.total_liquido, 0::numeric) + COALESCE(y.faturamento_liquido, 0::numeric)
            ELSE COALESCE(pag.total_liquido, 0::numeric)
        END)) * 100
        ELSE 0
    END AS percent_art_fat,
    
    -- =================================================
    -- TICKET MÉDIO REAL (TE_REAL) - REGRA ESPECÍFICA
    -- =================================================
    CASE
        WHEN upper(e.dia_semana::text) = 'DOMINGO'::text OR e.data_evento = '2025-08-09'::date 
        THEN 
            CASE 
                WHEN (CASE
                    WHEN upper(e.dia_semana::text) = 'DOMINGO'::text OR e.data_evento = '2025-08-09'::date 
                    THEN COALESCE(y.quantidade_ingressos, 0) + COALESCE(sp.sympla_checkins, 0) + COALESCE(ch_periodo.total_pessoas, 0)
                    ELSE COALESCE(ch_periodo.total_pessoas_pagantes, 0)
                END) > 0 
                THEN (COALESCE(ch_periodo.total_couvert, 0) + COALESCE(sp.sympla_checkins, 0) + COALESCE(y.receita_ingressos, 0)) / (CASE
                    WHEN upper(e.dia_semana::text) = 'DOMINGO'::text OR e.data_evento = '2025-08-09'::date 
                    THEN COALESCE(y.quantidade_ingressos, 0) + COALESCE(sp.sympla_checkins, 0) + COALESCE(ch_periodo.total_pessoas, 0)
                    ELSE COALESCE(ch_periodo.total_pessoas_pagantes, 0)
                END)
                ELSE 0
            END
        ELSE 
            CASE 
                WHEN COALESCE(ch_periodo.total_pessoas_pagantes, 0) > 0 
                THEN COALESCE(ch_periodo.total_couvert, 0) / ch_periodo.total_pessoas_pagantes
                ELSE 0
            END
    END AS te_real,
    
    -- =================================================
    -- TICKET BAR REAL (TB_REAL) - REGRA ESPECÍFICA
    -- =================================================
    CASE
        WHEN upper(e.dia_semana::text) = 'DOMINGO'::text OR e.data_evento = '2025-08-09'::date 
        THEN 
            CASE 
                WHEN (CASE
                    WHEN upper(e.dia_semana::text) = 'DOMINGO'::text OR e.data_evento = '2025-08-09'::date 
                    THEN COALESCE(y.quantidade_ingressos, 0) + COALESCE(sp.sympla_checkins, 0) + COALESCE(ch_periodo.total_pessoas, 0)
                    ELSE COALESCE(ch_periodo.total_pessoas_pagantes, 0)
                END) > 0 
                THEN (COALESCE(ch_periodo.total_pagamentos, 0) + (COALESCE(y.faturamento_liquido, 0) - COALESCE(y.receita_ingressos, 0))) / (CASE
                    WHEN upper(e.dia_semana::text) = 'DOMINGO'::text OR e.data_evento = '2025-08-09'::date 
                    THEN COALESCE(y.quantidade_ingressos, 0) + COALESCE(sp.sympla_checkins, 0) + COALESCE(ch_periodo.total_pessoas, 0)
                    ELSE COALESCE(ch_periodo.total_pessoas_pagantes, 0)
                END)
                ELSE 0
            END
        ELSE 
            CASE 
                WHEN COALESCE(ch_periodo.total_pessoas_pagantes, 0) > 0 
                THEN (COALESCE(ch_periodo.total_pagamentos, 0) - CASE 
                    WHEN COALESCE(ch_periodo.total_pessoas_pagantes, 0) > 0 
                    THEN COALESCE(ch_periodo.total_couvert, 0) / ch_periodo.total_pessoas_pagantes
                    ELSE 0
                END) / ch_periodo.total_pessoas_pagantes
                ELSE 0
            END
    END AS tb_real,
    
    -- =================================================
    -- CUSTOS NIBO (C.ART E C.PROD)
    -- =================================================
    nibo_custos.custo_artistico AS c_art_real,
    nibo_custos.custo_producao AS c_prod,
    
    -- =================================================
    -- DADOS SYMPLA
    -- =================================================
    sp.sympla_liquido,
    sp.sympla_total_pedidos,
    sp.sympla_participantes,
    sp.sympla_checkins,
    
    -- =================================================
    -- REAL RECEITA (REGRA ORIGINAL)
    -- Domingos + 09/08: ContaHub + Yuzer
    -- Outros dias: Apenas ContaHub
    -- =================================================
    CASE
        WHEN upper(e.dia_semana::text) = 'DOMINGO'::text OR e.data_evento = '2025-08-09'::date 
        THEN COALESCE(pag.total_liquido, 0::numeric) + COALESCE(y.faturamento_liquido, 0::numeric)
        ELSE COALESCE(pag.total_liquido, 0::numeric)
    END AS real_r

FROM eventos e
-- =================================================
-- JOINS OTIMIZADOS
-- =================================================
LEFT JOIN yuzer_resumo2 y ON e.data_evento = y.data_evento AND e.bar_id = y.bar_id
LEFT JOIN (
    -- Yuzer faturamento por hora - fat.19h para domingo (14:00-18:00)
    SELECT 
        data_evento,
        SUM(CASE 
            WHEN SUBSTRING(hora_formatada FROM '\d{2}:\d{2}') BETWEEN '14:00' AND '18:00' 
            THEN faturamento 
            ELSE 0 
        END) as fat_14_18h,
        SUM(faturamento) as fat_total
    FROM yuzer_fatporhora
    WHERE bar_id = 3
    GROUP BY data_evento
) yuzer_fatporhora ON e.data_evento = yuzer_fatporhora.data_evento
LEFT JOIN (
    -- ContaHub pagamentos agregados
    SELECT 
        dt_gerencial as data_evento,
        bar_id,
        SUM(liquido) as total_liquido
    FROM contahub_pagamentos
    WHERE bar_id = 3
    GROUP BY dt_gerencial, bar_id
) pag ON e.data_evento = pag.data_evento AND e.bar_id = pag.bar_id
LEFT JOIN (
    -- ContaHub período - pessoas, couvert e pagamentos
    SELECT 
        dt_gerencial as data_evento,
        bar_id,
        SUM(pessoas) as total_pessoas,
        SUM(CASE WHEN vr_pagamentos > 0 THEN pessoas ELSE 0 END) as total_pessoas_pagantes,
        SUM(vr_couvert) as total_couvert,
        SUM(vr_pagamentos) as total_pagamentos
    FROM contahub_periodo
    WHERE bar_id = 3
    GROUP BY dt_gerencial, bar_id
) ch_periodo ON e.data_evento = ch_periodo.data_evento AND e.bar_id = ch_periodo.bar_id
LEFT JOIN (
    -- Nibo custos por categoria
    SELECT 
        data_competencia as data_evento,
        SUM(CASE WHEN categoria_nome = 'Atrações Programação' THEN valor ELSE 0 END) as custo_artistico,
        SUM(CASE WHEN categoria_nome = 'Produção Eventos' THEN valor ELSE 0 END) as custo_producao
    FROM nibo_agendamentos
    GROUP BY data_competencia
) nibo_custos ON e.data_evento = nibo_custos.data_evento
LEFT JOIN (
    -- ContaHub faturamento por hora - fat.19h
    SELECT 
        vd_dtgerencial as data_evento,
        bar_id,
        SUM(CASE WHEN hora < 19 THEN valor ELSE 0 END) as fat_ate_19h,
        SUM(valor) as fat_total
    FROM contahub_fatporhora
    WHERE bar_id = 3
    GROUP BY vd_dtgerencial, bar_id
) ch_fatporhora ON e.data_evento = ch_fatporhora.data_evento AND e.bar_id = ch_fatporhora.bar_id
LEFT JOIN (
    -- ContaHub analítico - percentuais por loc_desc
    SELECT 
        trn_dtgerencial as data_evento,
        bar_id,
        -- %B - Bebidas
        CASE 
            WHEN SUM(valorfinal) > 0 
            THEN (SUM(CASE WHEN loc_desc IN ('Chopp','Baldes','Pegue e Pague','PP','Venda Volante','Bar') THEN valorfinal ELSE 0 END) / SUM(valorfinal)) * 100
            ELSE 0 
        END AS percent_bebidas,
        -- %C - Comidas  
        CASE 
            WHEN SUM(valorfinal) > 0 
            THEN (SUM(CASE WHEN loc_desc IN ('Cozinha','Cozinha 1','Cozinha 2') THEN valorfinal ELSE 0 END) / SUM(valorfinal)) * 100
            ELSE 0 
        END AS percent_comidas,
        -- %D - Drinks
        CASE 
            WHEN SUM(valorfinal) > 0 
            THEN (SUM(CASE WHEN loc_desc IN ('Preshh','Drinks','Drinks Autorais','Mexido','Shot e Dose','Batidos') THEN valorfinal ELSE 0 END) / SUM(valorfinal)) * 100
            ELSE 0 
        END AS percent_drinks
    FROM contahub_analitico
    WHERE bar_id = 3
    GROUP BY trn_dtgerencial, bar_id
) ch_analitico ON e.data_evento = ch_analitico.data_evento AND e.bar_id = ch_analitico.bar_id
LEFT JOIN (
    -- Sympla dados agregados (otimizado)
    SELECT 
        CAST(SUBSTRING(sp_ped.evento_sympla_id FROM '[0-9]+') AS INTEGER) as evento_num,
        SUM(sp_ped.valor_liquido) AS sympla_liquido,
        COUNT(DISTINCT sp_ped.pedido_sympla_id) AS sympla_total_pedidos,
        COUNT(DISTINCT sp_part.participante_sympla_id) AS sympla_participantes,
        SUM(CASE WHEN sp_part.fez_checkin = true THEN 1 ELSE 0 END) AS sympla_checkins
    FROM sympla_pedidos sp_ped
    LEFT JOIN sympla_participantes sp_part ON sp_ped.evento_sympla_id = sp_part.evento_sympla_id
    GROUP BY CAST(SUBSTRING(sp_ped.evento_sympla_id FROM '[0-9]+') AS INTEGER)
) sp ON CAST(SUBSTRING(e.nome FROM '[0-9]+') AS INTEGER) = sp.evento_num;

-- =================================================
-- COMENTÁRIOS PARA FUTURAS ALTERAÇÕES:
-- =================================================
-- 1. Para adicionar nova regra de data especial:
--    Alterar condições: OR e.data_evento = 'YYYY-MM-DD'::date
--
-- 2. Para modificar percentuais:
--    - Domingos: alterar mapeamento y.percent_xxx 
--    - Outros dias: alterar loc_desc na subquery ch_analitico
--
-- 3. Para ajustar custos Nibo:
--    Alterar nomes das categorias na subquery nibo_custos
--
-- 4. Para modificar TE_REAL e TB_REAL:
--    Ajustar cálculos nas seções específicas (domingos vs outros dias)
--
-- 5. Para alterar LOT_MAX:
--    Modificar divisor na fórmula: cl_plan / 1.3
--
-- 6. Para otimizar performance:
--    Adicionar índices em: data_evento, bar_id, evento_sympla_id
-- =================================================
