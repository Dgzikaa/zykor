-- =============================================================================
-- 3 itens de revenda do Ordinário com custo ~zero — corrigido em 11/08/2026
-- =============================================================================
--
-- Achados na auditoria do CMV. Custo quase zero em revenda é sempre erro (e é o erro
-- MAIS silencioso, porque puxa o CMV para baixo e passa sensação de margem melhor):
--   Isqueiro Bic Pequeno .... custo R$ 0,0035 / preço R$  8,95 → CMV 0,04%
--   [PP] Guaraná zero 350ml . custo R$ 0,0079 / preço R$  7,95 → CMV 0,10%
--   Souza Paiol Carteira .... custo R$ 0,1212 / preço R$ 24,95 → CMV 0,49%
--
-- CAUSAS DIFERENTES em cada um:
--
-- 1) ISQUEIRO (i0592): cadastrado com `unidade_medida = 'g'`. A regra de custo divide por
--    1000 quando a unidade é de massa/volume → R$ 3,45 virava R$ 0,00345 "por grama".
--    Isqueiro não se mede em gramas. → unidade_medida = 'unid'.
--
-- 2) CIGARRO (i0456 "Paiol Souza - Carteira"): mesmo problema de unidade ('g'), MAIS a
--    embalagem faltando. O insumo É a carteira (R$ 10,10) e ela tem 12 unidades.
--    ⚠️ AS FICHAS JÁ ESTAVAM CERTAS e não foram tocadas: o0004 "Souza Paiol Un" pede 1
--    (uma unidade avulsa) e o0005 "Souza Paiol Carteira" pede 12 (uma carteira). Faltava o
--    cadastro dizer que a carteira tem 12. → unidade_medida = 'unid' + embalagem 12.
--
-- 3) GUARANÁ ZERO (ficha do b0185): pedia quantidade "1" de um insumo medido em ml. Os
--    produtos irmãos (b0022, b0117, b0118) pedem em ml (350, 350, 269). Erro da FICHA,
--    não do insumo. → quantidade 1 → 350.
--
-- CONFERIDO ANTES DE APLICAR: os 3 insumos entram na contagem de estoque, mas a contagem
-- valoriza pelo `insumos.custo_unitario` CHEIO (30 carteiras × R$ 10,10 = R$ 303,00 na
-- contagem de 10/08), e não pelo custo derivado da view. Mudar a unidade_medida corrige a
-- ficha sem alterar a valorização do estoque. Confirmado depois: preço na última contagem
-- segue R$ 10,10 e R$ 3,45.
--
-- Resultado:
--   Isqueiro 0,04% → 38,6% · Guaraná zero 0,10% → 34,6%
--   Souza Paiol Un 0,3% → 28,1% · Souza Paiol Carteira 0,5% → 40,5%
-- Efeito no CMV do bar 3 (itens de baixo volume): agosto 30,46% → 29,89%.
-- =============================================================================

create table if not exists system.bkp_revenda_unidade_20260811 as
select 'insumo' origem, i.id::text ref, i.codigo, i.nome, i.unidade_medida::text valor_antigo, now() capturado_em
from operations.insumos i where i.bar_id=3 and i.codigo in ('i0592','i0456')
union all
select 'ficha_item', fi.id::text, 'b0185', 'qtd guarana zero', fi.quantidade::text, now()
from public.producao_ficha_item fi where fi.id = 12792;

-- 1) Isqueiro: 1 isqueiro é 1 UNIDADE, não 1 grama
update operations.insumos set unidade_medida='unid' where bar_id=3 and codigo='i0592';

-- 2) Cigarro: o insumo é a CARTEIRA (R$ 10,10) e ela tem 12 unidades
update operations.insumos set unidade_medida='unid' where bar_id=3 and codigo='i0456';
insert into public.insumo_unidade (bar_id, id_prod, embalagem)
select 3, -i.id, 12 from operations.insumos i where i.bar_id=3 and i.codigo='i0456'
on conflict (bar_id, id_prod) do update set embalagem = 12;

-- 3) Guaraná zero: ficha pedia "1" onde os irmãos pedem em ml
update public.producao_ficha_item set quantidade = 350 where id = 12792;

-- Recalcular depois:
--   select gold.fn_cmv_teorico(3);
--   select gold.fn_rebuild_produto_cmv_historico(3, '2026-06-01', current_date);
--   select silver.fn_refresh_vendas_depara();
