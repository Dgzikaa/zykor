-- =============================================================================
-- Ordinario 2026: reancorar a cadeia de estoque do CMV mensal — 11/08/2026
-- =============================================================================
--
-- Mesma classe de erro corrigida no Deboche/julho no mesmo dia, porem espalhada por
-- varios meses: financial.cmv_mensal tinha estoque solto da cadeia, e como
-- cmv_real = estoque_inicial + compras - estoque_final - consumo + bonificacoes,
-- cada valor solto joga o CMV do mes inteiro para cima ou para baixo sem alarme nenhum.
--
-- REGRA (Rodrigo): o estoque final de um mes E o estoque inicial do seguinte. Cada
-- fronteira mes/mes passa a ter UM valor so: a contagem `tipo_contagem='mensal'` do dia 1o
-- em silver.estoque_contagem, filtrando `classe='insumo'` (o mesmo recorte que a planilha
-- usa e que a tela de estoque mostra; com `classe='producao'` o total fica 2-4% acima).
--
-- ANCORAS (contagem mensal do dia 1o, classe insumo):
--   01/04  194.112,70    01/05  233.300,40    01/06  165.198,69
--   01/07  169.677,26    01/08  162.240,18
--
-- O QUE ESTAVA SOLTO:
--   mai est_fim  237.240,50 -> 165.198,69   (+72.041,81 de estoque que nao existia)
--   jul est_ini  118.176,87 -> 169.677,26   (-51.500,39 de estoque que sumiu)
--   ago est_ini  136.989,85 -> 162.240,18   (-25.250,33)
--   ago est_fim         0,00 -> 140.411,07  (mes em curso, estava zerado -> CMV 65,81% falso)
-- Os demais ajustes sao ruido (<2%) e entram so para a cadeia fechar exata.
--
-- VALIDACAO DA ANCORA — a queda de 233 mil (01/05) para 165 mil (01/06) e REAL, nao
-- contagem incompleta: as QUANTIDADES cairam junto com os valores (Corona 330 1.869->504 un,
-- Original 600 1.593->817, Coxao Mole 43,6->5,7 kg, Gin Tanqueray 36->9,3). Dos 401 itens de
-- maio, apenas 1 sumiu da contagem de junho (Stella Artois 600ml, R$ 3.947,58). Maio queimou
-- estoque acumulado de verdade — por isso o CMV alto e que e o verdadeiro.
--
-- RESULTADO: mar 38,13% · abr 37,25% · mai 36,46% · jun 36,97% · jul 36,53% · ago 30,69% (parcial).
-- Maio saiu de 29,92% e julho de 32,03%. Os quatro meses fechados convergem para 36,5-37%, e
-- essa convergencia e a evidencia de que a ancora esta certa: antes, maio e julho apareciam
-- como os dois melhores meses do ano e sao exatamente os dois que tinham estoque solto — a
-- "melhora" era o furo.
--
-- ⚠️ Contra o CMV teorico auditado em 10-11/08 (~29,9%), isso abre ~6,5 pontos de desvio
-- real x teorico. E o que as telas de desvio existem para explicar — nao e erro de conta.
--
-- ⚠️ AGOSTO e mes em curso: est_fim vem da contagem semanal de 10/08 e fica congelado
-- (fonte='planilha' faz agregar_cmv_mensal_auto preservar o estoque digitado). Ao virar o
-- mes, reancorar em 01/09.
--
-- Rodar depois: select public.agregar_cmv_mensal_auto(3, 2026, m) from generate_series(3,8) m;
-- =============================================================================

create table if not exists system.bkp_cmv_mensal_ordi_20260811 as
select *, now() as capturado_em
from financial.cmv_mensal
where bar_id = 3 and ano = 2026 and mes between 3 and 8;

-- fronteira 01/04
update financial.cmv_mensal set estoque_final = 194112.70, updated_at = now()
 where bar_id=3 and ano=2026 and mes=3;
update financial.cmv_mensal set estoque_inicial = 194112.70, estoque_final = 233300.40, updated_at = now()
 where bar_id=3 and ano=2026 and mes=4;
-- fronteira 01/06 — o buraco de +72 mil
update financial.cmv_mensal set estoque_inicial = 233300.40, estoque_final = 165198.69, updated_at = now()
 where bar_id=3 and ano=2026 and mes=5;
update financial.cmv_mensal set estoque_inicial = 165198.69, estoque_final = 169677.26, updated_at = now()
 where bar_id=3 and ano=2026 and mes=6;
-- fronteira 01/07 — o buraco de -51,5 mil
update financial.cmv_mensal set estoque_inicial = 169677.26, estoque_final = 162240.18, updated_at = now()
 where bar_id=3 and ano=2026 and mes=7;
-- agosto: inicial ancorado em 01/08; final = contagem semanal de 10/08 (mes em curso)
update financial.cmv_mensal set estoque_inicial = 162240.18, estoque_final = 140411.07, updated_at = now()
 where bar_id=3 and ano=2026 and mes=8;
