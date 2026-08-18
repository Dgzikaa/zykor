-- OVT: detalhamento por Bizu e por Singularidade, + Principais Concorrentes.
-- Pedidos do Gonza em 18/08/2026, na tela /estrategico/organizador/[id].
--
-- Os detalhes ficam ALINHADOS POR ÍNDICE com os arrays que já existem (`valores_centrais` e
-- `singularidades`), não casados por nome. A tela edita 7 posições fixas de Bizu e 3 de
-- singularidade, e o texto do Bizu é editável — casar por nome perderia o detalhe no instante em
-- que alguém corrigisse uma vírgula no título.
--
-- Por que jsonb e não colunas soltas: são 7 Bizus × 3 textos + 3 singularidades = 24 campos. Em
-- coluna viraria uma tabela larguíssima e cada Bizu novo pediria migration.
--
-- A API (/api/organizador) NÃO precisou mudar: o POST e o PUT já fazem `...dados` sobre o corpo,
-- então coluna nova passa direto. Diferente dos OKRs, que são mapeados campo a campo — lá, campo
-- novo sem mapeamento some no save.

alter table meta.organizador_visao
  add column if not exists valores_centrais_detalhe jsonb not null default '[]'::jsonb,
  add column if not exists singularidades_detalhe   jsonb not null default '[]'::jsonb,
  add column if not exists principais_concorrentes  text;

comment on column meta.organizador_visao.valores_centrais_detalhe is
  'Detalhe de cada Bizu, ALINHADO POR INDICE com valores_centrais: [{detalhamento, o_que_e, o_que_nao_e}]. Indice porque a tela edita 7 posicoes fixas; casar por nome quebraria ao renomear o Bizu.';
comment on column meta.organizador_visao.singularidades_detalhe is
  'Detalhe de cada singularidade, alinhado por indice com singularidades: [{detalhamento}].';
comment on column meta.organizador_visao.principais_concorrentes is
  'Campo proprio do Foco Central, abaixo de Missao e Nicho (pedido do Gonza, 18/08/2026).';
