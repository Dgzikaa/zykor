-- Salário: faixa no CARGO, override na CADEIRA.
--
-- O Gonza decidiu que contratar passa a ser um ato sobre a CADEIRA VAGA — "adicionar aonde, em que
-- cadeira?" — e que a cadeira já entrega função, área, chefe e SALÁRIO prontos. O furo é que nem
-- hr.cargos nem hr.cadeiras tinham salário: o único lugar com valor era hr.funcionarios.salario_base,
-- que é o salário de UMA pessoa, não da posição — some quando ela sai, e some junto a referência de
-- quanto custa a vaga.
--
-- Modelo escolhido (Rodrigo, 15/08/2026): os dois.
--  · CARGO carrega a FAIXA (min/max) — é o padrão, cadastrado uma vez para os ~16 cargos;
--  · CADEIRA carrega o OVERRIDE (salario_referencia) — para a exceção real: CUMIN 1 pode valer
--    diferente de CUMIN 7, e o Escritório Central paga diferente do bar para o mesmo cargo.
-- Quem contrata vê `cadeira.salario_referencia ?? cargo.salario_min`, e pode digitar por cima.
--
-- Tudo nulo por padrão: nenhum cargo/cadeira tem valor até o RH preencher, e a tela trata nulo como
-- "sem referência" em vez de sugerir R$ 0,00 — sugerir zero seria pior do que não sugerir nada.

alter table hr.cargos
  add column if not exists salario_min numeric(12,2),
  add column if not exists salario_max numeric(12,2);

alter table hr.cadeiras
  add column if not exists salario_referencia numeric(12,2);

comment on column hr.cargos.salario_min is
  'Piso da faixa do cargo. É a sugestão padrão ao contratar numa cadeira sem override.';
comment on column hr.cargos.salario_max is
  'Teto da faixa do cargo. Serve de alerta na contratação e na promoção, não trava.';
comment on column hr.cadeiras.salario_referencia is
  'Salário desta cadeira específica. Sobrepõe a faixa do cargo; nulo = usa hr.cargos.salario_min.';

-- Valor negativo é sempre erro de digitação (vírgula/sinal), e um piso negativo contaminaria a
-- sugestão de toda contratação daquele cargo.
alter table hr.cargos
  drop constraint if exists cargos_salario_faixa_valida;
alter table hr.cargos
  add constraint cargos_salario_faixa_valida check (
    coalesce(salario_min, 0) >= 0
    and coalesce(salario_max, 0) >= 0
    and (salario_min is null or salario_max is null or salario_max >= salario_min)
  );

alter table hr.cadeiras
  drop constraint if exists cadeiras_salario_referencia_positivo;
alter table hr.cadeiras
  add constraint cadeiras_salario_referencia_positivo check (
    coalesce(salario_referencia, 0) >= 0
  );
