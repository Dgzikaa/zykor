-- Invariante nº 7: contagem com valor absurdo (04/08/2026).
--
-- Motivo: investigando 3 semanas de CMV fora da faixa, apareceram 3 contagens com quantidade
-- digitada na UNIDADE ERRADA, que entraram caladas e torceram CMV/Estoque/Desvios:
--   * Deboche 15/02 — Tilápia 10.570 g x R$ 40/kg = R$ 422.800 (o certo: 10,57 kg = R$ 422,80).
--     Mesmo erro em cheddar, mussarela, carne moída e recheio de pastel: R$ 1,16 mi num dia.
--     Era contagem diária → o CMV semanal escapou, mas Estoque/Desvios do dia ficaram poluídos.
--   * Ordinário 20/04 — Café em grãos 520 kg (o item vive entre 0,69 e 1,56 kg) = R$ 32.500.
--     Essa era SEMANAL: derrubou o CMV da S16 pra 23,85% e subiu o da S17 pra 50,97%.
--     Corrigido: S16 = 33,47% e S17 = 39,03%.
--   * Ordinário 25/02 — descartáveis contados em UNIDADE num campo de pacote c/ 50
--     (colher 900 → 18 pacotes). Caiu numa quarta, não fecha semana: não mexeu no CMV.
--
-- As 9 linhas foram corrigidas na origem (operations.contagem_estoque_insumos) e na
-- silver.estoque_contagem, com backup em system.bkp_contagem_erro_unidade_20260804.
--
-- O check roda na janela de 90 dias (~1s) contra a mediana de 400 dias do próprio item.

insert into integridade.invariantes_dados (nome, descricao, sql_conta, limite, ativo)
select
  'contagem_valor_absurdo',
  'Item contado com valor >50x a mediana histórica dele (e > R$ 5 mil): é quantidade digitada na unidade errada (g num campo de kg, unidade num campo de pacote). Entra calado e torce CMV/Estoque/Desvios — ex. 04/08/2026: Tilápia 10.570 g x R$ 40/kg = R$ 422.800 no Deboche, e Café 520 kg (normal 0,8) = R$ 32.500 no Ordinário, que derrubou o CMV da S16 pra 23,85% e subiu o da S17 pra 50,97%.',
  'with med as (select bar_id, insumo_codigo, (percentile_cont(0.5) within group (order by valor))::numeric m from silver.estoque_contagem where valor > 0 and data_contagem >= current_date - 400 group by 1,2 having count(*) >= 5) select count(*) from silver.estoque_contagem e join med on med.bar_id = e.bar_id and med.insumo_codigo = e.insumo_codigo where e.data_contagem >= current_date - 90 and e.valor > med.m * 50 and e.valor > 5000',
  0,
  true
where not exists (select 1 from integridade.invariantes_dados where nome = 'contagem_valor_absurdo');
