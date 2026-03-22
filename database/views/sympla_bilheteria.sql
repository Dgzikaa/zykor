-- View: sympla_bilheteria
CREATE OR REPLACE VIEW public.sympla_bilheteria AS
 SELECT id, pedido_sympla_id, evento_sympla_id, data_pedido, status_pedido, tipo_transacao, nome_comprador, email_comprador, dados_utm, dados_comprador, raw_data, created_at, updated_at, valor_liquido, valor_bruto, taxa_sympla, bar_id
   FROM sympla_pedidos;
