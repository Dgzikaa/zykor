-- Fix ETL gold desempenho semanal v3
-- 1. Adiciona perc_faturamento_apos_22h (CTE + INSERT + ON CONFLICT)
-- 2. ON CONFLICT atualiza TODOS os campos (antes so ~20 de ~90)
-- 3. versao_etl = 3

-- Funcao recriada via CREATE OR REPLACE diretamente no banco (ver pg_get_functiondef)
-- Backup do estado anterior: meta.desempenho_manual_backup_20260422_v2

-- DROP Onda 1 (2 campos sem referencia):
-- ano_sistema, couvert_atracoes_perc

-- DROP Onda 2 (27 campos auto validados contra gold):
-- tempo_saida_cozinha, tempo_saida_bar, qtde_itens_cozinha, qtde_itens_bar,
-- faturamento_total, faturamento_bar, faturamento_entrada, faturamento_cmovivel,
-- clientes_atendidos, tm_bar, tm_entrada, cancelamentos,
-- perc_bebidas, perc_drinks, perc_comida, perc_happy_hour, perc_faturamento_ate_19h,
-- atrasos_cozinha, atrasos_cozinha_perc, atrasos_bar, atrasos_bar_perc,
-- atrasinhos_bar, atrasinhos_cozinha, atrasinhos_bar_perc, atrasinhos_cozinha_perc,
-- cmv_limpo, cmv_global_real

-- MANTIDO: perc_faturamento_apos_22h (gold so tem 8 de 138, historico vive no meta)
-- meta.desempenho_manual: 143 -> 114 colunas
