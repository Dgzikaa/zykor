-- =============================================================================
-- CMV teórico do Ordinário inflado por UMA ficha — corrigido em 11/08/2026
-- =============================================================================
--
-- Sintoma (Isaías): "o CMV teórico está muito alto, o mais alto que o Ordi ficou foi 31%"
-- — e agosto/2026 marcava 34,03%.
--
-- CAUSA. O preparo pc0018 "Mandioca cozida" estava com `unidade='porção'` e
-- `rendimento=2.83`, mas TODAS as fichas que o consomem escrevem a quantidade em GRAMAS:
--
--   consumidor                              quantidade   virava
--   Cupim com Queijo e Mandioca (c0068)         350       350 porções = R$ 681,55
--   [PP] Cupim com Queijo e Mandioca (c0113)    350       350 porções = R$ 681,55
--   Bolinho escondidinho (pc0020, preparo)      750       750 porções = R$ 1.460,25
--   Cupim C/ Queijo (pc0091, preparo)           300       300 porções = R$ 584,10
--
-- Efeito no que chega na venda:
--   Cupim com Queijo e Mandioca:  custo R$ 759,74 num prato de R$ 109,95 → CMV 691%
--   Bolinho de escondidinho 8un:  custo R$ 254,82 num prato de R$  49,95 → CMV 510%
-- Esses dois venderam só 26 unidades em agosto e responderam por R$ 11.170 de custo —
-- 10,8% do custo do mês inteiro.
--
-- A CONVERSÃO JÁ ESTAVA NO PRÓPRIO CADASTRO: `fator_contagem = 350` (1 porção = 350 g).
-- E o preparo irmão pc0091 "Cupim C/ Queijo" já seguia o formato certo: unidade 'g',
-- rendimento 4580, contagem em porção com fator 400. Esta migration põe a Mandioca no
-- mesmo formato — assim as 4 fichas passam a estar certas sem tocar em nenhuma delas.
--
-- 2,83 porções × 350 g = 990 g, coerente com 1 kg de mandioca crua perdendo ~1% no cozimento.
--
-- ⚠️ pc0018 tem controle_producao = true: o número que a produção vê na tela deixa de ser
-- "2,83 porções" e passa a ser "990 g". Alinhado com o Rodrigo antes de aplicar.
--
-- Efeito medido no CMV teórico do bar 3 (mesmas vendas, só a ficha mudou):
--   maio    33,35% → 30,65%
--   junho   30,81% → 29,14%
--   julho   32,89% → 30,42%
--   agosto  34,03% → 30,52%
--
-- Varredura feita junto: é a ÚNICA ficha do bar 3 nessa situação (preparo com unidade
-- fora de g/ml/kg/l consumido com quantidade alta). Vale repetir a consulta ao suspeitar
-- de custo absurdo:
--   select pb.codigo, pb.nome, pb.unidade, pb.rendimento, fi.quantidade
--     from public.producao_ficha_item fi
--     join public.producao_base pb on pb.id = fi.producao_ref
--    where pb.bar_id = :bar
--      and lower(coalesce(pb.unidade,'')) not in ('g','ml','kg','l')
--      and fi.quantidade > 50;
-- =============================================================================

create table if not exists system.bkp_producao_base_pc0018_20260811 as
select *, now() as capturado_em from public.producao_base where bar_id=3 and codigo='pc0018';

update public.producao_base
   set unidade = 'g', rendimento = 990
 where bar_id=3 and codigo='pc0018';

-- Recalcular o custo do cardápio e as matviews depois de aplicar:
--   select gold.fn_cmv_teorico(3);
--   select silver.fn_refresh_vendas_depara();
