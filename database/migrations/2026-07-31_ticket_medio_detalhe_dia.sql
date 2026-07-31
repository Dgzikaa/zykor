-- Decomposição do TICKET MÉDIO por dia — alimenta o popup da linha "Ticket Médio" em
-- /estrategico/desempenho.
--
-- Origem (31/07/2026): a semana S31 mostrou R$ 76,37 e a conferência manual dia a dia deu
-- R$ 80,47, o que parecia erro. Não era: 80,47 é a média SIMPLES dos 4 dias e 76,37 é o
-- ponderado (faturamento ÷ pessoas). A Quarta de Bamba sozinha tinha 50,3% do público da
-- semana com o MENOR ticket (65,30), então puxa o número real para baixo enquanto a média
-- simples dá à segunda-feira de 94 pessoas o mesmo peso.
--
-- A função devolve, por dia, os dois tickets lado a lado e o que explica a diferença entre
-- eles, para a conferência não precisar mais de planilha:
--   * ticket_contahub  = pagamentos ÷ TODAS as pessoas do headline do ContaHub;
--   * ticket           = faturamento Zykor ÷ pessoas contadas (régua v34: pagante OU cartão
--                        vazio com pessoa — a "conta juntada" do cartão individual);
--   * cortesias        = pessoas do headline que o Zykor NÃO conta (consumo sem pagamento);
--   * conta_assinada   = o que o Zykor tira do faturamento e o ContaHub mantém;
--   * outras_fontes    = Yuzer + Sympla, que entram no Zykor e não existem no ContaHub.
--
-- A soma dos dias fecha com a linha semanal do gold.desempenho (conferido nas semanas
-- S27..S31/2026, faturamento e público idênticos) — o popup não pode contradizer a tabela.
CREATE OR REPLACE FUNCTION public.get_ticket_medio_detalhe(
  p_bar_id integer,
  p_ini date,
  p_fim date
)
RETURNS TABLE(
  data date,
  evento text,
  faturamento numeric,
  pessoas integer,
  ticket numeric,
  pagamentos_contahub numeric,
  pessoas_contahub integer,
  ticket_contahub numeric,
  cortesias integer,
  conta_assinada numeric,
  outras_fontes numeric,
  ingressos integer
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'gold', 'bronze', 'pg_catalog'
AS $function$
  WITH ch AS (
    SELECT v.vd_dtgerencial::date AS d,
           SUM(v.vd_pessoas)::integer AS pessoas_headline,
           -- régua v34 (a mesma de calculate_evento_metrics): pagante OU cartão 100% vazio
           -- com pessoa (conta juntada em outro cartão). Cortesia (sem pagamento, MAS com
           -- item/desconto) fica de fora.
           SUM(CASE WHEN v.vd_vrpagamentos > 0
                      OR (COALESCE(v.vd_qtditens,0) = 0 AND COALESCE(v.vd_vrdescontos,0) = 0 AND v.vd_pessoas > 0)
                    THEN v.vd_pessoas ELSE 0 END)::integer AS pessoas_contadas,
           SUM(v.vd_vrpagamentos) AS pagamentos
      FROM bronze.bronze_contahub_avendas_vendasperiodo v
     WHERE v.bar_id = p_bar_id
       AND v.vd_dtgerencial::date BETWEEN p_ini AND p_fim
     GROUP BY 1
  )
  SELECT p.data_evento AS data,
         COALESCE(NULLIF(p.nome,''), '—') AS evento,
         p.faturamento_total_consolidado AS faturamento,
         p.publico_real_consolidado::integer AS pessoas,
         ROUND(p.faturamento_total_consolidado / NULLIF(p.publico_real_consolidado,0), 2) AS ticket,
         ch.pagamentos AS pagamentos_contahub,
         ch.pessoas_headline AS pessoas_contahub,
         ROUND(ch.pagamentos / NULLIF(ch.pessoas_headline,0), 2) AS ticket_contahub,
         GREATEST(COALESCE(ch.pessoas_headline,0) - COALESCE(ch.pessoas_contadas,0), 0)::integer AS cortesias,
         COALESCE(p.conta_assinada, 0) AS conta_assinada,
         COALESCE(p.yuzer_liquido,0) + COALESCE(p.sympla_liquido,0) AS outras_fontes,
         (COALESCE(p.yuzer_ingressos,0) + COALESCE(p.sympla_checkins,0))::integer AS ingressos
    FROM gold.planejamento p
    LEFT JOIN ch ON ch.d = p.data_evento
   WHERE p.bar_id = p_bar_id
     AND p.data_evento BETWEEN p_ini AND p_fim
     AND p.ativo = true
     -- dia sem movimento nenhum não entra: linha de zeros só polui a leitura
     AND (COALESCE(p.faturamento_total_consolidado,0) > 0 OR COALESCE(p.publico_real_consolidado,0) > 0)
   ORDER BY p.data_evento;
$function$;

COMMENT ON FUNCTION public.get_ticket_medio_detalhe(integer, date, date) IS
  'Decomposição diária do ticket médio (Zykor x ContaHub, cortesias, conta assinada, Yuzer/Sympla). Popup da linha Ticket Médio em /estrategico/desempenho.';

REVOKE ALL ON FUNCTION public.get_ticket_medio_detalhe(integer, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ticket_medio_detalhe(integer, date, date) TO authenticated, service_role;
