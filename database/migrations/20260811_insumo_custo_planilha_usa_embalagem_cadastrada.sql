-- =============================================================================
-- Ramo "planilha" do custo do insumo passa a respeitar a embalagem cadastrada
-- Aplicado em 11/08/2026 (auditoria do CMV do Deboche)
-- =============================================================================
--
-- gold.insumo_custo_un tem dois ramos:
--   vmarket  → preço / COALESCE(embalagem manual, embalagem vmarket)  ← já respeitava o cadastro
--   planilha → custo_unitario / <embalagem ADIVINHADA por regex no nome>  ← ignorava o cadastro
--
-- Quando o regex não encontrava a gramatura no nome, o divisor virava 1 e o custo do insumo
-- passava a ser o preço da CAIXA inteira — mesmo com a embalagem corretamente cadastrada em
-- public.insumo_unidade.
--
-- Achados (todos no bar 4):
--   Halls Cereja (cx) ............ emb 21   R$ 18,99 (uma bala!)  → R$ 0,9043
--   Pão de Forma (saco com 14) ... emb 14   R$ 12,49              → R$ 0,8921
--   Chá Frutas Vermelhas (caixa) . emb 10   R$  9,99              → R$ 0,9990
--   Chá de Morango (caixa) ....... emb 10   R$  9,99              → R$ 0,9990
--   Pacote 120 filtros (uni) ..... emb 120  R$  3,00              → R$ 0,0250
--
-- Efeito nos pratos: "Melted" (2 pães) R$ 32,59 → R$ 9,40 (CMV 93,3% → 26,9%);
-- "Halls" R$ 18,99 → R$ 0,90 (CMV 379,8% → 18,1%).
-- CMV do bar 4: junho 29,13 → 29,04 · julho 28,67 → 28,32 · agosto 27,57 → 27,21.
--
-- ⚠️ A REGRA NÃO É "PREFERIR SEMPRE O CADASTRO". Para insumo cujo NOME já traz a gramatura
-- (ex.: "Whisky Jameson 750ml", "Carvão Rateio 552g"), o regex JÁ dividiu — aplicar a
-- embalagem cadastrada de novo dividiria DUAS vezes e jogaria o custo para perto de zero.
-- Simulei antes de aplicar: seria esse o efeito em ~180 insumos, quase todos destilados.
-- Por isso o cadastro entra apenas onde o regex não achou nada (o antigo `ELSE 1`).
--
-- Conferido antes de aplicar: NÃO existe insumo com embalagem cadastrada = 1 e gramatura no
-- nome, então essa ordem de precedência não gera regressão.
-- Validado depois: os 5 acima caíram; Jameson (0,1239), Chivas (0,1287), Double Black
-- (0,2059) e Carvão (1,2953) ficaram idênticos.
-- =============================================================================

create or replace view gold.insumo_custo_un as
 SELECT DISTINCT ON (bar_id, codigo) bar_id, codigo, custo_un, fonte
   FROM ( SELECT b.bar_id,
            b.codigo_planilha AS codigo,
            gp.preco_atual / NULLIF(COALESCE(man.embalagem, iu.embalagem), 0::numeric) AS custo_un,
            'vmarket'::text AS fonte,
            gp.data_atual AS ord
           FROM bronze_vmarket_produtos b
             JOIN gold.vmarket_insumo_preco gp ON gp.bar_id = b.bar_id AND gp.id_prod = b.id_produto_sisfood_cotacao
             LEFT JOIN insumo_unidade iu ON iu.bar_id = b.bar_id AND iu.id_prod = b.id_produto_sisfood_cotacao
             LEFT JOIN operations.insumos i ON i.bar_id = b.bar_id AND i.codigo::text = b.codigo_planilha
             LEFT JOIN insumo_unidade man ON man.bar_id = b.bar_id AND man.id_prod = (- i.id)
          WHERE b.codigo_planilha IS NOT NULL AND gp.preco_atual > 0::numeric AND COALESCE(man.embalagem, iu.embalagem) > 0::numeric
        UNION ALL
         SELECT i.bar_id,
            i.codigo,
            i.custo_unitario / NULLIF(emb.e, 0::numeric) AS custo_un,
            'planilha'::text AS fonte,
            NULL::timestamp without time zone AS ord
           FROM operations.insumos i
             -- embalagem cadastrada à mão (chave negativa), usada só como ÚLTIMO recurso
             LEFT JOIN insumo_unidade man ON man.bar_id = i.bar_id AND man.id_prod = (- i.id)
             CROSS JOIN LATERAL ( SELECT regexp_match(i.nome::text, '(\d+[.,]?\d*)\s*(kg|kilo|litro|lt|ml|gr|grama|l|g)'::text, 'i'::text) AS m) r
             CROSS JOIN LATERAL ( SELECT
                        CASE
                            WHEN r.m IS NULL THEN NULL::numeric
                            ELSE replace(replace(r.m[1], '.'::text, ''::text), ','::text, '.'::text)::numeric
                        END AS v,
                    lower(COALESCE(r.m[2], ''::text)) AS u) mm
             CROSS JOIN LATERAL ( SELECT (regexp_match(i.nome::text, 'c/\s*(\d+)'::text))[1] AS cc,
                    (regexp_match(i.nome::text, '(\d+)\s*(und|unid|cx|caixa)'::text, 'i'::text))[1] AS cu) cx
             CROSS JOIN LATERAL ( SELECT
                        CASE
                            WHEN mm.v IS NOT NULL AND (mm.u = ANY (ARRAY['kg'::text, 'kilo'::text])) THEN mm.v * 1000::numeric
                            WHEN mm.v IS NOT NULL AND (mm.u = ANY (ARRAY['l'::text, 'lt'::text, 'litro'::text])) THEN mm.v * 1000::numeric
                            WHEN mm.v IS NOT NULL AND mm.u = 'ml'::text THEN mm.v
                            WHEN mm.v IS NOT NULL AND (mm.u = ANY (ARRAY['g'::text, 'gr'::text, 'grama'::text])) THEN mm.v
                            WHEN cx.cc IS NOT NULL THEN cx.cc::numeric
                            WHEN cx.cu IS NOT NULL THEN cx.cu::numeric
                            WHEN i.nome::text ~* '(^|\s)v\.|vinho|espumante|frisante|moscatel|prosecco|sparkling'::text THEN 750::numeric
                            WHEN i.nome::text ~* 'whisky|vodka|tequila|cacha|licor|conhaque|brandy|aperol|campari|cynar|vermouth|jager|bitter|absinto|steinha|amarula|cointreau|frangelico|limoncello|domecq|netuno|presidente|bananinha|jambu|\ygin\y|\yrum\y'::text THEN 1000::numeric
                            WHEN lower(i.unidade_medida::text) = ANY (ARRAY['ml'::text, 'l'::text, 'litro'::text, 'kg'::text, 'g'::text, 'grama'::text]) THEN 1000::numeric
                            -- ÚLTIMO recurso: a embalagem cadastrada à mão. Só chega aqui quando
                            -- o nome não diz nada — nos outros casos a divisão já foi feita acima.
                            WHEN COALESCE(man.embalagem, 0::numeric) > 1::numeric THEN man.embalagem
                            ELSE 1::numeric
                        END AS e) emb
          WHERE i.codigo::text ~ '^i'::text AND i.custo_unitario > 0::numeric) z
  ORDER BY bar_id, codigo, (fonte = 'vmarket'::text) DESC, ord DESC NULLS LAST;
