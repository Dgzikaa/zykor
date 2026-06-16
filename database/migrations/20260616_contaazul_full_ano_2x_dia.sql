-- 2026-06-16 — Conta Azul: full_ano 2x/dia (pega re-categorização).
--
-- Problema: mudar SÓ a categoria de um lançamento no CA muitas vezes NÃO bumpa o
-- data_alteracao. O sync incremental (cursor por data_alteracao) então nunca pega
-- a re-categorização — e o botão "Atualizar" não refletia a troca de categoria.
--
-- Correção:
--  - Botões "Atualizar" (DRE e Orçamentação) passam a usar alteracao_full_ano
--    (re-puxa o ano todo -> traz a categoria atual). (mudança no frontend)
--  - Cron full_ano deixa de ser semanal e roda 2x/dia (07:45 e 19:45 BRT),
--    ~30min antes do refresh do gold da orçamentação.
SELECT cron.unschedule('contaazul-alteracao-full-ano-semanal');
SELECT cron.schedule(
  'contaazul-full-ano-2x-dia',
  '45 10,22 * * *',
  $$ SELECT public.sync_contaazul_alteracao_full_ano(); $$
);
