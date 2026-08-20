-- Cargo e área da pessoa passam a vir SEMPRE da cadeira do organograma (19/08/2026).
--
-- POR QUE: o dossiê tinha um campo de cargo/função editável ao lado da cadeira que a pessoa
-- ocupa. Rodrigo: "o cargo já é a cadeira que ele está, teria que ou estar travado p n mexer
-- e só resolver com transferência, ou nem ter esse campo". Dois lugares dizendo o cargo é
-- garantia de divergir — e divergiram.
--
-- O QUE FOI CORRIGIDO (rodado em produção):
--  1. RAQUEL RODRIGUES DE ARAUJO estava numa 2ª cadeira de "Chefe de Cozinha" (abaixo da Lucia,
--     que é a chefe de verdade). Ela é cozinheira: a cadeira virou Cozinheiro.
--  2. 34 pessoas tinham no cadastro cargo/área diferentes da cadeira. Quase tudo era ÁREA
--     duplicada, de antes do organograma: Garçons->Atendimento, ASG->Limpeza/Infra,
--     Recepção->Fila, Produção->Administrativo. O cadastro passou a espelhar a cadeira.
--
-- As áreas antigas (hr.areas 41 ASG, 42 Recepção, 43 Garçons, 44, 40, 29, 34) ficaram sem
-- ninguém. Não foram apagadas de propósito: histórico antigo ainda aponta pra elas.
--
-- A trava de verdade está no servidor: PUT /api/rh/funcionarios/[id] regrava cargo_id/area_id
-- com os da cadeira e devolve `aviso` quando ignora a mudança. A tela mostra os dois campos em
-- leitura pra quem ocupa cadeira — como já fazia na contratação.

update hr.cadeiras set cargo_id = 7  -- Cozinheiro
 where id = 'eda5d1a7-3049-4cc5-b6cc-401802dd2637' and bar_id = 3;

with atual as (
  select o.funcionario_id, c.cargo_id, c.area_id
  from hr.cadeira_ocupacao o
  join hr.cadeiras c on c.id = o.cadeira_id and c.ativa
  where o.fim is null
)
update hr.funcionarios f
   set cargo_id = a.cargo_id, area_id = a.area_id
  from atual a
 where f.id = a.funcionario_id
   and (f.cargo_id is distinct from a.cargo_id or f.area_id is distinct from a.area_id);
