-- Conciliação Stone: status em 3 níveis em vez de ok/verificar binário.
--   bate      = |dif| <= R$0,50 (bate ao centavo)
--   leve      = |dif| <= MAIOR(R$50 ; 2% do ContaHub) (pequena defasagem, tolerável)
--   verificar = acima disso (investigar)
-- Antes, dif de -220 num dia de R$20k caía em 'ok' (dentro de 2%) e parecia que batia.

create or replace view gold.stone_conciliacao_diaria as
 WITH stone AS (
         SELECT stone_transacoes.bar_id,
            (stone_transacoes.capture_local_dt - '06:00:00'::interval)::date AS data,
            sum(stone_transacoes.gross_amount) AS stone_bruto,
            sum(stone_transacoes.net_amount) AS stone_liquido,
            sum(stone_transacoes.fee_amount) AS stone_taxa,
            count(DISTINCT stone_transacoes.acquirer_transaction_key) AS stone_transacoes,
            string_agg(DISTINCT stone_transacoes.empresa_nome, ', '::text) AS stone_cnpjs
           FROM silver.stone_transacoes
          WHERE stone_transacoes.capture_local_dt IS NOT NULL
          GROUP BY stone_transacoes.bar_id, ((stone_transacoes.capture_local_dt - '06:00:00'::interval)::date)
        ), ch AS (
         SELECT faturamento_pagamentos.bar_id,
            faturamento_pagamentos.data_pagamento AS data,
            sum(faturamento_pagamentos.valor_bruto) FILTER (WHERE faturamento_pagamentos.tipo = ANY (ARRAY['Cred'::text, 'Deb'::text])) AS ch_cartao,
            sum(faturamento_pagamentos.valor_bruto) FILTER (WHERE faturamento_pagamentos.tipo = 'Cred'::text) AS ch_credito,
            sum(faturamento_pagamentos.valor_bruto) FILTER (WHERE faturamento_pagamentos.tipo = 'Deb'::text) AS ch_debito
           FROM silver.faturamento_pagamentos
          WHERE faturamento_pagamentos.data_pagamento >= (( SELECT min((stone_transacoes.capture_local_dt - '06:00:00'::interval)::date) AS min
                   FROM silver.stone_transacoes))
          GROUP BY faturamento_pagamentos.bar_id, faturamento_pagamentos.data_pagamento
        )
 SELECT COALESCE(s.bar_id, c.bar_id) AS bar_id,
    COALESCE(s.data, c.data) AS data,
    s.stone_cnpjs,
    round(COALESCE(c.ch_cartao, 0::numeric), 2) AS contahub_cartao,
    round(COALESCE(s.stone_bruto, 0::numeric), 2) AS stone_bruto,
    round(COALESCE(c.ch_cartao, 0::numeric) - COALESCE(s.stone_bruto, 0::numeric), 2) AS diferenca,
    round(COALESCE(s.stone_taxa, 0::numeric), 2) AS stone_taxa,
    round(COALESCE(s.stone_liquido, 0::numeric), 2) AS stone_liquido,
    s.stone_transacoes,
    round(COALESCE(c.ch_credito, 0::numeric), 2) AS ch_credito,
    round(COALESCE(c.ch_debito, 0::numeric), 2) AS ch_debito,
        CASE
            WHEN abs(COALESCE(c.ch_cartao, 0::numeric) - COALESCE(s.stone_bruto, 0::numeric)) <= 0.50 THEN 'ok'::text
            WHEN abs(COALESCE(c.ch_cartao, 0::numeric) - COALESCE(s.stone_bruto, 0::numeric)) <= GREATEST(50::numeric, 0.02 * COALESCE(c.ch_cartao, 0::numeric)) THEN 'leve'::text
            ELSE 'verificar'::text
        END AS status
   FROM stone s
     FULL JOIN ch c ON c.bar_id = s.bar_id AND c.data = s.data
  WHERE COALESCE(s.stone_bruto, 0::numeric) > 0::numeric OR COALESCE(c.ch_cartao, 0::numeric) > 0::numeric;