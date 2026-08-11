-- =============================================================================
-- Dose dupla saindo 1x do estoque — corrigido em 11/08/2026
-- =============================================================================
--
-- Reportado pelo Isaías: "esses drinks que vendeu são dose dupla, e está dando desvio
-- maior porque vendeu mas não considerou a saída do insumo que sai 2x".
--
-- Ele está certo. silver.insumo_por_produto multiplica a ficha por
-- produto_cardapio.multiplicador:
--     sum(quantidade / fator_correcao * COALESCE(pc.multiplicador, 1))
-- Produto de dose dupla com multiplicador 1 debita METADE do insumo que realmente saiu,
-- e a diferença vira desvio.
--
-- Estado encontrado: no bar 3, dos 43 produtos "[DD]", 37 já estavam com 2 e 6 com 1 —
-- inclusive os DOIS criados naquela manhã pela própria tela de CMV teórico
-- ([DD] Mistura de Candango 10:20 e [DD] Arlequim 10:23). A ação 'cadastrar_depara'
-- insere o produto sem multiplicador, então todo produto novo nasce 1.
--
-- ⚠️ O bar 4 NÃO usa o prefixo "[DD]" — escreve "Dose Dupla" no nome (e há registros com
-- "Dose Dulpa", digitado errado). Filtrar só por "[DD]%" deixa o Deboche de fora.
--
-- Corrigidos (10 produtos, snapshot em system.bkp_multiplicador_dd_20260811):
--   bar 3: b0174, b0247, d0137, d0356, d0375, d0382
--   bar 4: d0147, d0149, d0150, d0152
--
-- PENDENTE (decisão de negócio, não mexido): no bar 3 há 3 produtos "[50%]" com
-- multiplicador 2 — d0138 [50%] Arlequim, d0144 [50%] Bees Knees, d0171 [50%] Pingado.
-- Se "[50%]" é desconto de PREÇO e não dose dobrada, eles estão debitando o dobro do
-- insumo e mascarando desvio no sentido contrário.
-- =============================================================================

create table if not exists system.bkp_multiplicador_dd_20260811 as
select id, bar_id, codigo, nome, multiplicador, now() as capturado_em
from public.produto_cardapio
where bar_id in (3,4)
  and (nome ilike '[DD]%' or nome ilike '%dose dupla%' or nome ilike '%dose dulpa%' or nome ilike '%dobrad%')
  and coalesce(multiplicador,1) <> 2;

update public.produto_cardapio pc
   set multiplicador = 2
  from system.bkp_multiplicador_dd_20260811 b
 where pc.id = b.id;

-- Reverter, se necessário:
--   update public.produto_cardapio pc set multiplicador = b.multiplicador
--     from system.bkp_multiplicador_dd_20260811 b where pc.id = b.id;
