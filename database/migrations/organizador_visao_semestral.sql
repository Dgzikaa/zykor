-- Organizador de Visao passa a ser SEMESTRAL e ganha o bloco de metas do semestre
-- (planilha "ORGANIZADOR VISAO - TRACAO - 2 SEM 2026").
-- Aplicada em 2026-07-29.

alter table meta.organizador_visao
  add column if not exists semestre integer,
  add column if not exists tema_semestre text,        -- ex: "Segurar Gastos e Ver Dinheiro"
  add column if not exists meta_faturamento numeric,  -- Faturamento do semestre (R$)
  add column if not exists meta_cmo_fixo numeric,     -- CMO Fixo do semestre (R$)
  add column if not exists artistico_meta numeric;    -- (Atracoes+Producao)/Fat da Imagem de 1 Ano (%)

-- "Ebitda" virou "Lucro Liquido" na Imagem de 1 Ano.
alter table meta.organizador_visao rename column ebitda_meta to lucro_liquido_meta;

alter table meta.organizador_visao
  drop constraint if exists organizador_visao_semestre_chk;
alter table meta.organizador_visao
  add constraint organizador_visao_semestre_chk check (semestre is null or semestre in (1, 2));

-- Unicidade do periodo passa a considerar semestre (trimestre fica para registros legados).
alter table meta.organizador_visao
  drop constraint if exists organizador_visao_bar_id_ano_trimestre_key;
create unique index if not exists organizador_visao_bar_periodo_key
  on meta.organizador_visao (bar_id, ano, coalesce(trimestre, 0), coalesce(semestre, 0));

comment on column meta.organizador_visao.semestre is '1 ou 2. Periodo padrao do organizador; trimestre so existe em registros legados.';
comment on column meta.organizador_visao.tema_semestre is 'Tema/lema do semestre, ex: "Segurar Gastos e Ver Dinheiro".';
comment on column meta.organizador_visao.meta_faturamento is 'Meta de faturamento DO SEMESTRE (R$). Nao confundir com faturamento_meta, que e a Imagem de 1 Ano.';
comment on column meta.organizador_visao.meta_cmo_fixo is 'Meta de CMO Fixo do semestre em R$ (meta_cmo continua sendo o CMO em %).';
comment on column meta.organizador_visao.artistico_meta is '(Atracoes+Producao)/Fat da Imagem de 1 Ano, em %. meta_artistica e o equivalente do semestre.';
