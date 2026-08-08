-- Cron mensal do "Ajuste Receita Virada do Mês" — tira a etapa manual do fechamento.
--
-- CONTEXTO: o ajuste é um PAR que soma zero (+receita no último dia do mês, −estorno no dia 01
-- do mês seguinte) que põe a madrugada da última noite no mês a que ela pertence. A ferramenta
-- (/api/financeiro/fechamento/ajuste-virada) existe e calcula o valor sozinho pela Stone, mas
-- financial.lancamento_manual_ca_log estava VAZIO no ano inteiro: o financeiro fazia o par À MÃO
-- direto no Conta Azul, todo mês. Em jul/2026 esqueceu — e como cada mês recebe o "+" do seu
-- ajuste E o "−" do mês anterior, julho ficou SÓ com o negativo: a Receita da DRE do bar 3 ficou
-- R$ 58.955,92 abaixo do real e a DRE ficou MENOR que o Planejamento Comercial (o inverso do
-- normal, já que a DRE tem o faturamento do bar MAIS receitas que não passam pelo evento).
-- Bar 4 tinha esquecido junho E julho.
--
-- DIA 4 (não dia 1): o valor vem da Stone da madrugada do dia 01, e o arquivo de conciliação
-- desse dia só é baixado/parseado pelo stone-sync-diario/stone-parse-diario nos dias seguintes.
-- No dia 4 às 15:00 UTC (12:00 BRT) o sync das 10:00 UTC e o parse das 10:24 UTC já rodaram.
-- pg_cron roda em UTC (conferido: stone-sync-diario às 16 UTC grava synced_at 13:00 BRT).
--
-- Idempotente pelo log da própria rota. ATENÇÃO: os pares de jan–jun/2026 foram feitos à mão e
-- NÃO estão nesse log — disparar um mês desses manualmente DUPLICARIA.

select cron.schedule(
  'ajuste-virada-mensal',
  '0 15 4 * *',
  $cmd$
  select net.http_post(
    url := 'https://zykor.com.br/api/financeiro/fechamento/ajuste-virada',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||public.get_service_role_key()),
    body := jsonb_build_object(
      'bar_id', b.bar_id,
      'ano', extract(year from (current_date - interval '1 month'))::int,
      'mes', extract(month from (current_date - interval '1 month'))::int),
    timeout_milliseconds := 110000)
  from (values (3),(4)) b(bar_id);
$cmd$);

-- Conferido que o "mês anterior" resolve certo inclusive na virada de ano:
--   4/set/2026 -> 2026/8 · 4/jan/2027 -> 2026/12 · 4/mar/2026 -> 2026/2
