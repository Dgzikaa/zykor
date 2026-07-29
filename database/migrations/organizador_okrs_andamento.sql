-- Coluna "Andamento": texto livre de progresso, como a planilha usa a coluna Status.
-- O campo `status` continua sendo o semaforo (verde/amarelo/vermelho/cinza).
-- Aplicada em 2026-07-29.

alter table meta.organizador_okrs
  add column if not exists andamento text;

comment on column meta.organizador_okrs.andamento is
  'Texto livre de progresso do OKR (equivalente a coluna Status da planilha). O semaforo continua em status.';
