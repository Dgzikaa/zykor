-- Hierarquia + DRE nativa do Conta Azul nas categorias.
-- Descoberta (24/06): o sync lia o campo errado do pai (`item.id_pai`, inexistente);
-- o correto é `item.categoria_pai` (UUID). Por isso categoria_pai_id vinha tudo null.
-- A API tb expõe entrada_dre e considera_custo_dre. Os nós-PAI não são retornados
-- pela API (404 no GET, fora da listagem), só referenciados pelo UUID nos filhos —
-- então o NOME do grupo-pai é definido pelo usuário na Central de Categorias.
-- A árvore do CA espelha as macros da DRE (CMV / Mão-de-Obra / Ocupação / etc).

alter table bronze.bronze_contaazul_categorias add column if not exists entrada_dre text;
alter table bronze.bronze_contaazul_categorias add column if not exists considera_custo_dre boolean;

-- Backfill do categoria_pai/entrada_dre/considera_custo_dre foi feito via API
-- (extensions.http) na data da migration; o sync corrigido mantém daqui pra frente.