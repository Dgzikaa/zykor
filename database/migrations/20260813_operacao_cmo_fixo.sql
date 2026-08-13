-- =============================================================================
-- CMO Fixo (folha CLT) no parametro do plano operacional — 13/08/2026
-- =============================================================================
--
-- Estava no bloco RESUMO da planilha e eu tinha dito ao Rodrigo que nao sabia de onde
-- sairia a folha CLT. Sai daqui. E o que fecha o CMO de verdade:
--
--   CMO% Proj = (Custo de Freelas + CMO Fixo) / Fat Proj
--
-- Sem o fixo o percentual mostrava so o freela (~4%) e o teto de 21% nunca disparava.
-- Com ele, a semana 03-09/08 fecha 27,15%.
--
-- DOIS CAMPOS SEPARADOS, e nao um derivado do outro:
--   RESUMO SEMANAL -> R$  59.000  (constante)
--   RESUMO MENSAL  -> R$ 172.000  (na planilha: SUM(4 semanas) - 64000)
-- O -64.000 e ajuste manual sem regra nenhuma. Derivar o mensal do semanal reproduziria um
-- numero magico que ninguem sabe explicar, entao cada visao tem o seu campo. O mensal
-- confere com a meta do Cadu na home ("CMO Fixo R$ 160.000").
--
-- Fica no parametro versionado por vigencia (e nao constante no codigo) porque a folha muda
-- com contratacao, dissidio e mudanca de quadro — e o passado nao pode ser reescrito.
-- =============================================================================

alter table operations.operacao_parametro
  add column if not exists cmo_fixo_semanal numeric(12,2),
  add column if not exists cmo_fixo_mensal  numeric(12,2);

comment on column operations.operacao_parametro.cmo_fixo_semanal is
  'Folha CLT da operacao por SEMANA. Entra no CMO% junto com o custo de freela.';
comment on column operations.operacao_parametro.cmo_fixo_mensal is
  'Folha CLT do MES. Na planilha era SUM(4 semanas) - 64000; o -64.000 e ajuste manual sem '
  'regra, entao aqui e campo proprio em vez de derivado.';

update operations.operacao_parametro
   set cmo_fixo_semanal = coalesce(cmo_fixo_semanal,  59000.00),
       cmo_fixo_mensal  = coalesce(cmo_fixo_mensal,  172000.00)
 where bar_id = 3;
