-- OVT: North Star Metric por área.
--
-- Pedido do Gonza (18/08/2026): "cada área tem uma North Star Metric (NSM), que é a principal meta
-- estratégica da área, e alguns OKR, que são as outras métricas — dá pra deixar destacado qual
-- dessas métricas é a NSM".
--
-- O índice parcial garante UMA por área, por organizador. Sem ele a tela deixaria marcar duas e
-- ninguém saberia qual é "a" métrica — que é exatamente o que uma North Star deveria resolver.
-- A tela também desmarca as irmãs ao marcar uma, então o índice é a segunda trava, não a primeira.
--
-- ATENÇÃO ao mexer em OKR: /api/organizador monta o OKR CAMPO A CAMPO no POST e no PUT (diferente
-- do organizador, que usa `...dados`). Campo novo que não entrar nos DOIS mapeamentos some no save,
-- sem erro nenhum. `is_nsm` foi adicionado nos dois.

alter table meta.organizador_okrs
  add column if not exists is_nsm boolean not null default false;

comment on column meta.organizador_okrs.is_nsm is
  'North Star Metric: a metrica principal daquela area. Uma por area (indice parcial abaixo); as demais linhas sao OKRs de apoio.';

create unique index if not exists organizador_okrs_uma_nsm_por_area
  on meta.organizador_okrs (organizador_id, area) where is_nsm;

-- O ACOMPANHAMENTO (realizado ao lado da meta) não precisou de tabela nova: a rota
-- /api/estrategico/organizador/acompanhamento só agrega `gold.desempenho` (mesma base da tela
-- Desempenho) e `getOrcamentacaoCompleta` (mesmo serviço da Orçamentação). Recalcular por fora
-- criaria uma terceira fonte para os mesmos números.
