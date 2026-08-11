-- =============================================================================
-- CMV do Deboche inflado pela embalagem da massa de pastel — 11/08/2026
-- =============================================================================
--
-- Investigando o CMV alto do Deboche (34,52% em agosto), a família pastel/pastelaço
-- aparecia inteira com CMV acima de 100%:
--   Mix Pastelaço                 custo R$ 43,12 / preço R$ 39,95 → 107,9%
--   [HH]Pastelaço de carne        custo R$ 44,44 / preço R$ 29,95 → 148,4%
--   Pastel de Linguiça Toscana    custo R$ 36,73 / preço R$ 29,95 → 122,6%
--   ... e mais 6 produtos no mesmo padrão
--
-- NÃO era a ficha (o rendimento 1 está certo: a receita faz 1 pastel). Era o custo do
-- insumo: gold.insumo_custo_un divide o preço de compra pela `embalagem` de
-- public.insumo_unidade, e o cadastro se contradizia:
--
--   nome do insumo ............ "Pastel Grande - cx com 32 un"
--   embalagem MANUAL cadastrada  24     (id_prod = -insumo.id, sobrepõe a do VMarket)
--   preço da caixa ............ R$ 206,40
--   custo unitário ............ 206,40 / 24 = R$ 8,60  ← uma massa de pastel a R$ 8,60
--
-- Corrigido para 32, que é o que o próprio nome do insumo afirma: R$ 6,45/un.
-- Varredura feita: são os ÚNICOS 2 insumos dos bares 3 e 4 em que a embalagem manual
-- contradiz o número escrito no nome.
--
-- Efeito no CMV teórico do bar 4: junho 32,55→31,63 · julho 32,85→31,78 · agosto 34,07→32,39
--
-- ⚠️ AINDA PARECE ALTO — confirmar com a operação quantos discos vêm na caixa.
-- Um prato de 4 pastéis a R$ 29,95 fica com R$ 25,80 só de massa. Se a "cx com 32 un"
-- forem 32 PACOTES (e não 32 discos), o divisor real é ~320 e o CMV de agosto cai para
-- 28,32%. Medido com 541 massas vendidas em agosto:
--   embalagem  24 (era) → 34,52%  |  32 (agora) → 32,84%  |  320 → 28,32%
-- =============================================================================

create table if not exists system.bkp_insumo_unidade_pastel_20260811 as
select iu.*, now() as capturado_em
from public.insumo_unidade iu
where iu.bar_id=4 and iu.id_prod in (select -i.id from operations.insumos i where i.bar_id=4 and i.codigo in ('i0259','i0368'));

update public.insumo_unidade iu
   set embalagem = 32
  from operations.insumos i
 where i.bar_id=4 and i.codigo in ('i0259','i0368')
   and iu.bar_id=4 and iu.id_prod = -i.id;

-- Recalcular depois de aplicar:
--   select gold.fn_cmv_teorico(4);
--   select gold.fn_rebuild_produto_cmv_historico(4, '2026-06-01', current_date);
--   select silver.fn_refresh_vendas_depara();
