-- Duração combinada do show (contrato), em minutos, por artista no evento.
-- O horário real vem de horario_inicio/horario_fim (já existentes, tipo time).
-- Preenchido na tela de tagging; alimenta rankings de pontualidade/duração.
-- Aplicado no banco via MCP; versionado aqui p/ o source control refletir o schema.
alter table operations.evento_artistas add column if not exists duracao_combinada_min smallint;
comment on column operations.evento_artistas.duracao_combinada_min is 'Duração combinada do show em minutos (contrato). Real = horario_fim - horario_inicio.';
