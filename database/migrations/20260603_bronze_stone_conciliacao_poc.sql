-- 2026-06-03 — Stone (Cliente Stone / conciliação) — PoC de ingestão.
-- Tabela bronze de staging do arquivo de conciliação diário (1 arquivo por
-- bar_id + stone_code + data + layout). PoC guarda o XML cru descompactado em
-- xml_raw; a tipagem (parse do XML p/ linhas de transação) vem na fase seguinte.

CREATE SCHEMA IF NOT EXISTS bronze;

CREATE TABLE IF NOT EXISTS bronze.bronze_stone_conciliacao (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bar_id         integer NOT NULL,
  stone_code     text    NOT NULL,                 -- affiliationCode (StoneCode)
  reference_date date    NOT NULL,                 -- data de referência do arquivo
  layout         text    NOT NULL DEFAULT 'XML2_2',-- XML2_2 (padrão) ou XML2_4
  http_status    integer,
  bytes          integer,
  xml_raw        text,                             -- conteúdo descompactado (gunzip)
  erro           text,
  synced_at      timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bar_id, stone_code, reference_date, layout)
);

CREATE INDEX IF NOT EXISTS idx_bronze_stone_concil_bar_data
  ON bronze.bronze_stone_conciliacao (bar_id, reference_date DESC);
