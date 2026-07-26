-- A view-alias public.instagram_oauth_states nao expunha erro/erro_em, que existem na tabela
-- real (integrations.instagram_oauth_states). O callback do Instagram grava o motivo da falha
-- justamente nessas colunas ("Deixa o motivo da falha gravado no state"), mas escreve pelo
-- client padrao (schema public) -> o UPDATE falhava, era engolido pelo catch, e o diagnostico
-- se perdia. Resultado pratico: 2 tentativas do Deboche (22/07 e 26/07) sem NENHUM registro do
-- que a Meta respondeu. Recria a view com as duas colunas.
create or replace view public.instagram_oauth_states as
  select state, bar_id, iniciado_em, expires_at, consumido_em, erro, erro_em
  from integrations.instagram_oauth_states;
