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
-- O NÚMERO CERTO É 768. Confirmado pelo Isaías (11/08/2026): a caixa tem **32 PACOTES**
-- e cada pacote traz **24 massas** — 32 × 24 = 768. O "24" que estava cadastrado era o
-- conteúdo do PACOTE, não da caixa: quem preencheu usou o divisor de um nível acima.
--   206,40 / 768 = R$ 0,2688 por massa (era R$ 8,60 — 32x mais caro).
--
-- Varredura feita: são os ÚNICOS 2 insumos dos bares 3 e 4 em que a embalagem manual
-- contradiz o número escrito no nome.
--
-- Efeito no CMV teórico do bar 4:
--   junho 32,55 → 28,99 · julho 32,85 → 28,67 · agosto 34,07 → 27,57
-- E a família pastel saiu de "acima de 100%" para a faixa real (11% a 37%).
--
-- ⚠️ O nome do insumo continua enganoso ("cx com 32 un" para 768 massas) — foi ele que
-- induziu o erro. Renomear para algo como "Pastel Grande - cx 32 pct x 24 un" evitaria
-- a repetição. Não renomeado aqui porque o nome casa com o de-para do VMarket.
-- =============================================================================

create table if not exists system.bkp_insumo_unidade_pastel_20260811 as
select iu.*, now() as capturado_em
from public.insumo_unidade iu
where iu.bar_id=4 and iu.id_prod in (select -i.id from operations.insumos i where i.bar_id=4 and i.codigo in ('i0259','i0368'));

update public.insumo_unidade iu
   set embalagem = 768   -- 32 pacotes x 24 massas
  from operations.insumos i
 where i.bar_id=4 and i.codigo in ('i0259','i0368')
   and iu.bar_id=4 and iu.id_prod = -i.id;

-- Recalcular depois de aplicar:
--   select gold.fn_cmv_teorico(4);
--   select gold.fn_rebuild_produto_cmv_historico(4, '2026-06-01', current_date);
--   select silver.fn_refresh_vendas_depara();
