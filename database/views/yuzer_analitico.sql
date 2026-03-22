-- View: yuzer_analitico
CREATE OR REPLACE VIEW public.yuzer_analitico AS
 SELECT id, bar_id, evento_id, data_evento, hora, hora_formatada, faturamento, vendas, raw_data, created_at, updated_at
   FROM yuzer_fatporhora;
