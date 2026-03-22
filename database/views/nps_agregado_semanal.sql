-- View: nps_agregado_semanal
-- Exportado de produção em: 2026-03-19
-- Descrição: NPS agregado por semana (geral, ambiente, atendimento, limpeza, música, comida, drink, preço, reservas)
-- Usado por: recalcular-desempenho-auto

CREATE OR REPLACE VIEW public.nps_agregado_semanal AS
WITH nps_base AS (
  SELECT 
    EXTRACT(week FROM nps.data_pesquisa) AS numero_semana,
    EXTRACT(year FROM nps.data_pesquisa) AS ano,
    nps.bar_id,
    min(nps.data_pesquisa) AS data_inicio,
    max(nps.data_pesquisa) AS data_fim,
    count(*) AS total_respostas,
    round(
      count(*) FILTER (WHERE nps.nps_geral > 8::numeric)::numeric / 
      NULLIF(count(*) FILTER (WHERE nps.nps_geral > 0::numeric), 0)::numeric * 100::numeric - 
      count(*) FILTER (WHERE nps.nps_geral < 7::numeric AND nps.nps_geral > 0::numeric)::numeric / 
      NULLIF(count(*) FILTER (WHERE nps.nps_geral > 0::numeric), 0)::numeric * 100::numeric
    ) AS nps_geral,
    round(
      count(*) FILTER (WHERE nps.nps_ambiente > 8::numeric)::numeric / 
      NULLIF(count(*) FILTER (WHERE nps.nps_ambiente > 0::numeric), 0)::numeric * 100::numeric - 
      count(*) FILTER (WHERE nps.nps_ambiente < 7::numeric AND nps.nps_ambiente > 0::numeric)::numeric / 
      NULLIF(count(*) FILTER (WHERE nps.nps_ambiente > 0::numeric), 0)::numeric * 100::numeric
    ) AS nps_ambiente,
    round(
      count(*) FILTER (WHERE nps.nps_atendimento > 8::numeric)::numeric / 
      NULLIF(count(*) FILTER (WHERE nps.nps_atendimento > 0::numeric), 0)::numeric * 100::numeric - 
      count(*) FILTER (WHERE nps.nps_atendimento < 7::numeric AND nps.nps_atendimento > 0::numeric)::numeric / 
      NULLIF(count(*) FILTER (WHERE nps.nps_atendimento > 0::numeric), 0)::numeric * 100::numeric
    ) AS nps_atendimento,
    round(
      count(*) FILTER (WHERE nps.nps_limpeza > 8::numeric)::numeric / 
      NULLIF(count(*) FILTER (WHERE nps.nps_limpeza > 0::numeric), 0)::numeric * 100::numeric - 
      count(*) FILTER (WHERE nps.nps_limpeza < 7::numeric AND nps.nps_limpeza > 0::numeric)::numeric / 
      NULLIF(count(*) FILTER (WHERE nps.nps_limpeza > 0::numeric), 0)::numeric * 100::numeric
    ) AS nps_limpeza,
    round(
      count(*) FILTER (WHERE nps.nps_musica > 8::numeric)::numeric / 
      NULLIF(count(*) FILTER (WHERE nps.nps_musica > 0::numeric), 0)::numeric * 100::numeric - 
      count(*) FILTER (WHERE nps.nps_musica < 7::numeric AND nps.nps_musica > 0::numeric)::numeric / 
      NULLIF(count(*) FILTER (WHERE nps.nps_musica > 0::numeric), 0)::numeric * 100::numeric
    ) AS nps_musica,
    round(
      count(*) FILTER (WHERE nps.nps_comida > 8::numeric)::numeric / 
      NULLIF(count(*) FILTER (WHERE nps.nps_comida > 0::numeric), 0)::numeric * 100::numeric - 
      count(*) FILTER (WHERE nps.nps_comida < 7::numeric AND nps.nps_comida > 0::numeric)::numeric / 
      NULLIF(count(*) FILTER (WHERE nps.nps_comida > 0::numeric), 0)::numeric * 100::numeric
    ) AS nps_comida,
    round(
      count(*) FILTER (WHERE nps.nps_drink > 8::numeric)::numeric / 
      NULLIF(count(*) FILTER (WHERE nps.nps_drink > 0::numeric), 0)::numeric * 100::numeric - 
      count(*) FILTER (WHERE nps.nps_drink < 7::numeric AND nps.nps_drink > 0::numeric)::numeric / 
      NULLIF(count(*) FILTER (WHERE nps.nps_drink > 0::numeric), 0)::numeric * 100::numeric
    ) AS nps_drink,
    round(
      count(*) FILTER (WHERE nps.nps_preco > 8::numeric)::numeric / 
      NULLIF(count(*) FILTER (WHERE nps.nps_preco > 0::numeric), 0)::numeric * 100::numeric - 
      count(*) FILTER (WHERE nps.nps_preco < 7::numeric AND nps.nps_preco > 0::numeric)::numeric / 
      NULLIF(count(*) FILTER (WHERE nps.nps_preco > 0::numeric), 0)::numeric * 100::numeric
    ) AS nps_preco,
    array_agg(nps.comentarios) FILTER (
      WHERE nps.comentarios IS NOT NULL 
        AND nps.comentarios <> ''::text 
        AND nps.comentarios <> 'Não'::text
    ) AS comentarios_array
  FROM nps
  GROUP BY 
    EXTRACT(week FROM nps.data_pesquisa), 
    EXTRACT(year FROM nps.data_pesquisa), 
    nps.bar_id
), 
reservas_agregadas AS (
  SELECT 
    EXTRACT(week FROM nps_reservas.data_pesquisa) AS numero_semana,
    EXTRACT(year FROM nps_reservas.data_pesquisa) AS ano,
    nps_reservas.bar_id,
    round(
      (count(*) FILTER (WHERE nps_reservas.nota >= 6::numeric)::numeric - 
       count(*) FILTER (WHERE nps_reservas.nota <= 5::numeric)::numeric) / 
      NULLIF(count(*)::numeric, 0::numeric) * 100::numeric
    ) AS nps_reservas,
    array_agg(nps_reservas.comentarios) FILTER (
      WHERE nps_reservas.comentarios IS NOT NULL 
        AND nps_reservas.comentarios <> ''::text
    ) AS comentarios_reservas_array
  FROM nps_reservas
  GROUP BY 
    EXTRACT(week FROM nps_reservas.data_pesquisa), 
    EXTRACT(year FROM nps_reservas.data_pesquisa), 
    nps_reservas.bar_id
)
SELECT 
  n.numero_semana,
  n.ano,
  n.bar_id,
  n.data_inicio,
  n.data_fim,
  n.total_respostas,
  n.nps_geral,
  n.nps_ambiente,
  n.nps_atendimento,
  n.nps_limpeza,
  n.nps_musica,
  n.nps_comida,
  n.nps_drink,
  n.nps_preco,
  n.comentarios_array,
  COALESCE(r.nps_reservas, 0::numeric) AS nps_reservas,
  r.comentarios_reservas_array
FROM nps_base n
LEFT JOIN reservas_agregadas r 
  ON n.numero_semana = r.numero_semana 
  AND n.ano = r.ano 
  AND n.bar_id = r.bar_id;
