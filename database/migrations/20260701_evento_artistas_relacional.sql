-- 20260701 — Frente 3 (Fase 1): artistas por evento (1 evento -> N artistas) com janela de horário.
-- Modelo relacional (não JSONB) para permitir filtros/relatórios por artista.
-- Referencia o cadastro operations.bar_artistas; artista_nome é denormalizado (fallback livre).
-- Escrita via API service_role (sem grants a anon/authenticated — alinhado ao hardening).

CREATE TABLE IF NOT EXISTS operations.evento_artistas (
  id             bigserial PRIMARY KEY,
  evento_id      integer NOT NULL REFERENCES operations.eventos_base(id) ON DELETE CASCADE,
  bar_id         integer NOT NULL REFERENCES operations.bares_config(bar_id),
  artista_id     integer REFERENCES operations.bar_artistas(id),
  artista_nome   text NOT NULL,
  ordem          smallint NOT NULL DEFAULT 1,
  horario_inicio time,
  horario_fim    time,
  c_art          numeric,
  observacoes    text,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evento_artistas_evento ON operations.evento_artistas(evento_id);
CREATE INDEX IF NOT EXISTS idx_evento_artistas_bar_artista ON operations.evento_artistas(bar_id, artista_id);

COMMENT ON TABLE operations.evento_artistas IS 'Artistas que tocaram em cada evento (N por evento) com janela de horário, para análises por artista. Escrita via API service_role.';
