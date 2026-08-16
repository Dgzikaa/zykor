-- O ponto parou de entrar em 08/08/2026 e ninguém foi avisado.
--
-- Sintoma: `bronze.bronze_tangerino_punch` fresquíssimo (sync de hoje 05:20) e
-- `hr.ponto_registro` parado no dia 13/08 — com 78 de 80 marcações do dia 14 marcadas como NÃO
-- parseadas. Oito dias de ponto faltando, com escala normal registrada nos mesmos dias.
--
-- Causa: `/api/rh/tangerino/sync` pagina TODAS as marcações da janela (7 dias, ~200 por página) e só
-- DEPOIS de terminar chama `hr.fn_tangerino_punch_to_ponto()`. O upsert do bronze acontece página a
-- página, então o bronze enche mesmo quando a função da Vercel morre no meio; a ETL, que roda uma
-- vez no fim, simplesmente nunca era alcançada. Rodada à mão, a função processou 11.034 dias sem
-- erro nenhum — o problema nunca foi ela.
--
-- Piorado por dois silêncios:
--   · a rota faz `const { data: etl } = await supabase.rpc(...)` e **descarta o erro**, devolvendo
--     `success: true` mesmo sem ter transformado nada;
--   · o pg_cron marca `succeeded` porque o `net.http_post` só enfileira (ver
--     feedback_silent_pg_cron_succeeded) — ninguém tinha como perceber.
--
-- Correção: a transformação bronze -> hr.ponto_registro deixa de depender de uma requisição HTTP
-- sobreviver. Roda no próprio banco, 15 min depois da sync do ponto (que é 08:20 UTC), onde não há
-- timeout de função nem paginação para atravessar. A chamada dentro da rota continua — quando ela
-- termina, o ponto aparece na hora — só que agora ela é o caminho rápido, não o único.
--
-- A função é idempotente: `ON CONFLICT (funcionario_id, data) DO UPDATE`. Rodar duas vezes no mesmo
-- dia não duplica nada.

select cron.schedule(
  'tangerino-punch-to-ponto',
  '35 8 * * *',
  $$ select hr.fn_tangerino_punch_to_ponto(); $$
);
