-- Invariante nº 8: cadeia de estoque do CMV mensal quebrada (11/08/2026).
--
-- REGRA (Rodrigo): "estoque final de junho é para ser o estoque inicial de julho".
-- Como cmv_real = estoque_inicial + compras - estoque_final - consumo + bonificações,
-- estoque solto na fronteira entre dois meses distorce o CMV do mês inteiro sem
-- disparar nada. Foi assim que passou despercebido por meses:
--
--   * Deboche julho — est_ini 92.533,25 (o correto era 56.644,81, o final de junho) E
--     est_fim 51.050,14 (o correto era 68.864,74, o inicial de agosto). Errado nas DUAS
--     pontas, ambas empurrando para cima: 48,78% num mês cujos vizinhos deram 31,93% e
--     26,92%. Foi o que o Isaías viu: "estoque inicial de julho tá dando 92 mil, mas o
--     estoque do dia 01/07 contabiliza 55 mil".
--   * Ordinário maio — est_fim 72.041,81 acima da contagem de 01/06: CMV 29,92% (real 36,46%).
--   * Ordinário julho — est_ini 51.500,39 abaixo do final de junho: CMV 32,03% (real 36,53%).
--   * Ordinário agosto — est_ini 25.250,33 abaixo e est_fim ZERADO: CMV 65,81% na tela.
--
-- O detalhe que torna isso permanente sem um check: agregar_cmv_mensal_auto tem
--   v_estoque_manual := (fonte IN ('planilha','manual') AND (estoque_inicial > 0 OR estoque_final > 0));
-- e nesse caso PRESERVA o estoque digitado, recalculando só o resto. É proposital — mas
-- significa que valor errado fica congelado indefinidamente, sem autocorreção.
--
-- Âncora de verdade para conferir: contagem `tipo_contagem='mensal'` do dia 1º em
-- silver.estoque_contagem, filtrando `classe='insumo'` (o recorte que a planilha usa;
-- com `classe='producao'` junto o total fica 2-4% acima).
--
-- Janela de 12 meses, só meses fechados e com os dois lados preenchidos (os meses futuros
-- nascem zerados e o histórico de 2025 tem zeros alternados — ambos gerariam ruído).
-- Tolerância de R$ 5 mil: as quebras reais encontradas foram de 17 a 72 mil, e o ruído
-- normal entre planilha e contagem fica abaixo de 3,4 mil.

insert into integridade.invariantes_dados (nome, descricao, sql_conta, limite, ativo)
select
  'cmv_mensal_cadeia_estoque',
  'Estoque inicial de um mês diferente do estoque final do mês anterior (>R$ 5 mil) em financial.cmv_mensal. Como cmv_real = estoque_inicial + compras - estoque_final - consumo + bonificações, isso distorce o CMV do mês inteiro em silêncio, e o agregador automático NÃO corrige quando fonte é planilha/manual (preserva o valor digitado por design). Ex. 11/08/2026: Deboche julho com est_ini 92.533,25 no lugar de 56.644,81 dava CMV 48,78% (real 32,87%); Ordinário maio e julho apareciam como os melhores meses do ano (29,92% e 32,03%) quando o real era 36,46% e 36,53%. Conferir contra a contagem mensal do dia 1º em silver.estoque_contagem com classe=insumo.',
  'with m as (select bar_id, make_date(ano,mes,1) ref, estoque_inicial ei, lag(estoque_final) over (partition by bar_id order by ano, mes) ef_ant from financial.cmv_mensal where make_date(ano,mes,1) >= (date_trunc(''month'', current_date) - interval ''12 months'')::date and make_date(ano,mes,1) < date_trunc(''month'', current_date)::date) select count(*) from m where ef_ant is not null and ei > 0 and ef_ant > 0 and abs(ei - ef_ant) > 5000',
  0,
  true
where not exists (select 1 from integridade.invariantes_dados where nome = 'cmv_mensal_cadeia_estoque');
