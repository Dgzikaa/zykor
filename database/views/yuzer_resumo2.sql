-- View: yuzer_resumo2
CREATE OR REPLACE VIEW public.yuzer_resumo2 AS
 SELECT yp.data_evento, yp.evento_id, yp.faturamento_bruto, yp.valor_liquido, yp.quantidade_pedidos, ye.nome_evento, ye.status AS status_evento
   FROM (yuzer_pagamento yp LEFT JOIN yuzer_eventos ye ON (yp.evento_id = ye.id));
