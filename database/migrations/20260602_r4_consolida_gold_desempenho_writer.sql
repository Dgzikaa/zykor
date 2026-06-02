-- 20260602_r4_consolida_gold_desempenho_writer.sql
--
-- R4: gold.desempenho (semanal) tinha DOIS escritores concorrentes as 12:00:
--   - etl_gold_desempenho_semanal (SQL, cron 462) — escreve ~95 colunas (TUDO: faturamento,
--     NPS, CMV, custos completos, operacional, Google, Instagram, marketing).
--   - recalcular-desempenho-v2 (edge, cron 334 -> executar_recalculo_desempenho_v2, mode=write)
--     — escreve ~30 colunas, TODAS subconjunto do etl_gold (migracao v2 modular incompleta).
-- A sobreposicao gerava last-writer-wins / flicker (foi onde a atracao divergiu).
--
-- DECISAO: etl_gold e o canonico (superset). v2 deixa de escrever:
--   1. cron 334 (desempenho-v2-diario) desativado (active=false).
--   2. env ENABLE_V2_WRITE=false (trava: v2 nunca escreve, de nenhum caminho).
--   3. Botoes on-demand repontados pro etl_gold (recalcular-semana, recalcular-todas).
-- v2 segue existindo so como auditoria read-only (comparar-v2, modo != write).
--
-- recalculo-diario (Vercel cron) chamava v2 SEM mode=write -> nao escrevia (so faz sync Falae);
-- mantido. Reversivel: cron.alter_job(334, active:=true) + ENABLE_V2_WRITE=true.

SELECT cron.alter_job(job_id := 334, active := false);

-- (env) supabase secrets set ENABLE_V2_WRITE=false  -- aplicado via CLI, fora desta migration
