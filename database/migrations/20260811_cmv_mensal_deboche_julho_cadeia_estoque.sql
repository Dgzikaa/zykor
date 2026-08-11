-- =============================================================================
-- Deboche julho/2026: estoque inicial e final fora da cadeia — 11/08/2026
-- =============================================================================
--
-- Sintoma (Isaias): "estoque inicial de julho na aba de gestao de CMV ta dando 92 mil,
-- mas puxei no estoque do dia 01/07 e contabiliza 55 mil".
--
-- REGRA (Rodrigo): estoque final de um mes E o estoque inicial do mes seguinte.
--
-- O que estava gravado em financial.cmv_mensal (bar 4, 2026):
--   junho  est_fim  56.644,81   <- confere com a contagem mensal de 01/07 (so insumo: 56.316,10)
--   julho  est_ini  92.533,25   <- QUEBRA de +35.888,44 contra o final de junho
--   julho  est_fim  51.050,14   <- QUEBRA de -17.814,60 contra o inicial de agosto
--   agosto est_ini  68.864,74   <- confere com a contagem mensal de 01/08 (so insumo: 69.734,85)
--
-- Julho estava errado nas DUAS pontas, e os dois erros empurram o CMV para cima: entra
-- estoque demais e sai de menos. Resultado: 48,78% num mes que os vizinhos fecharam em
-- 31,93% (jun) e 26,92% (ago).
--
-- O "55 mil" do Isaias e a contagem de 01/07 filtrando classe='insumo' (56.316,10);
-- o total com os preparos de producao da 58.728,86.
--
-- Por que o automatico nunca corrigiu: agregar_cmv_mensal_auto respeita estoque digitado
--   v_estoque_manual := (fonte IN ('planilha','manual') AND estoque > 0)
-- e julho estava com fonte='manual'. O valor errado ficava congelado por design.
--
-- CORRECAO: reancorar julho na cadeia, sem tocar em junho nem em agosto.
--   est_ini 92.533,25 -> 56.644,81 (= est_fim de junho)
--   est_fim 51.050,14 -> 68.864,74 (= est_ini de agosto)
--
-- Resultado: CMV de julho 48,78% -> 32,87%. Formula conferida ao centavo contra o valor
-- gravado antes de aplicar:
--   antes:  92.533,25 + 125.552,47 - 51.050,14 - 7.374,47 + 2.519,52 = 162.180,63
--
-- Rodar depois: select public.agregar_cmv_mensal_auto(4, 2026, 7);
-- =============================================================================

create table if not exists system.bkp_cmv_mensal_deboche_jul_20260811 as
select *, now() as capturado_em
from financial.cmv_mensal
where bar_id = 4 and ano = 2026 and mes = 7;

update financial.cmv_mensal
   set estoque_inicial = 56644.81,   -- = estoque final de junho
       estoque_final   = 68864.74,   -- = estoque inicial de agosto
       updated_at      = now()
 where bar_id = 4 and ano = 2026 and mes = 7;
