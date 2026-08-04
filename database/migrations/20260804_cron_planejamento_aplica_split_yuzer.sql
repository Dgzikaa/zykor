-- O split Yuzer (ingresso × bar) precisa ser reaplicado DEPOIS do ETL (04/08/2026).
--
-- public.etl_gold_planejamento_full grava `faturamento_entrada_yuzer` com o Yuzer INTEIRO e nem
-- inclui `faturamento_bar_yuzer` na lista de colunas do INSERT. A correção certa já existia em
-- public.corrigir_split_yuzer_gold (fix de 18/06), que rateia pelo produto vendido
-- (silver.yuzer_produtos_evento.eh_ingresso) — só que ninguém a chamava depois do ETL, então a
-- coluna "entrada" voltava inflada todo dia às 08:50 BRT.
--
-- Sintoma: quem lê `faturamento_entrada_yuzer` (planejamento, desempenho) via a ENTRADA do evento
-- com o valor do Yuzer inteiro — ex.: 13/06 no Deboche mostrava R$ 62.530 de entrada quando o
-- ingresso foi R$ 10.135 e o resto (R$ 52.112) era consumo de bar. Foi o mesmo dado que estourava
-- o CMV das semanas de evento (ver 20260804 / commit 48604471) — o CMV já parou de usar a coluna;
-- aqui é a correção na origem, pras demais telas.
--
-- 2026 já foi corrigido na mão (corrigir_split_yuzer_gold(bar,'2026-01-01','2026-12-31')):
-- 12 dias no Ordinário e 6 no Deboche. Agora entrada + bar = yuzer_liquido em todos.

select cron.alter_job(
  460,  -- gold-planejamento (50 11 * * * = 08:50 BRT)
  command := $cmd$
  SELECT public.etl_gold_planejamento_all_bars();
  SELECT public.corrigir_split_yuzer_gold(3, current_date - 180, current_date);
  SELECT public.corrigir_split_yuzer_gold(4, current_date - 180, current_date);
  $cmd$
);
