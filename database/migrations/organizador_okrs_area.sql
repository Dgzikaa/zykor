-- OKRs por área no Organizador de Visão (/estrategico/organizador/[id]).
-- 'GERAL' = OKRs gerais (comportamento anterior); demais valores = módulos por área
-- (FINANCEIRO, OPERACAO, RECEITA, ARTISTICO, RH, PRODUCAO).
-- Aplicada em 2026-07-29.

alter table meta.organizador_okrs
  add column if not exists area text not null default 'GERAL';

create index if not exists idx_organizador_okrs_org_area_ordem
  on meta.organizador_okrs (organizador_id, area, ordem);

comment on column meta.organizador_okrs.area is
  'GERAL para os OKRs gerais; sigla da area (FINANCEIRO, OPERACAO, RECEITA, ARTISTICO, RH, PRODUCAO) para OKRs especificos por area.';
