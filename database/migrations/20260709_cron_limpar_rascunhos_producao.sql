-- Limpeza automática de rascunhos de produção órfãos (a cada 30 min).
--
-- Sintoma: a lista "N produções em andamento em outro aparelho" enchia de lixo (produções
-- concluídas que ainda apareciam, 0s pausadas sem dono, timers travados). Causa: rascunho de
-- autosave (operations.producao_execucao_rascunho) não era apagado de forma confiável ao
-- finalizar (corrida com o autosave) e produções iniciadas e não finalizadas deixavam órfãos.
--
-- Este cron remove: (1) rascunhos com execução FINALIZADA de mesma idempotencia_key;
-- (2) MORTOS — sem toque há 12h (inclui timer travado); (3) VAZIOS — 0s parados há 3h+.
SELECT cron.schedule('limpar-rascunhos-producao', '*/30 * * * *', $$
  DELETE FROM operations.producao_execucao_rascunho r
  WHERE r.id IN (
    SELECT r2.id FROM operations.producao_execucao_rascunho r2
    JOIN operations.producao_execucao e ON e.bar_id = r2.bar_id AND e.idempotencia_key = r2.idempotencia_key
    WHERE r2.idempotencia_key IS NOT NULL
  )
  OR r.atualizado_em < now() - interval '12 hours'
  OR (COALESCE(r.duracao_seg,0) = 0 AND NOT r.rodando AND r.atualizado_em < now() - interval '3 hours');
$$);
