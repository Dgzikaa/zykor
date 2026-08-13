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
-- SAO DUAS CONSTANTES INDEPENDENTES, nao uma derivada da outra:
--   RESUMO SEMANAL -> R$  59.000
--   RESUMO MENSAL  -> R$ 172.000
-- 172/59 = 2,9 — nao sao 4,3 semanas. Derivar uma da outra daria percentual errado nas
-- duas visoes. O mensal confere com a meta do Cadu na home ("CMO Fixo R$ 160.000").
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
  'Folha CLT do MES. Independente do semanal — a planilha mantem os dois separados.';

update operations.operacao_parametro
   set cmo_fixo_semanal = coalesce(cmo_fixo_semanal,  59000.00),
       cmo_fixo_mensal  = coalesce(cmo_fixo_mensal,  172000.00)
 where bar_id = 3;
