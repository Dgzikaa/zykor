-- Fator de perda por produção no Plano de Produção (22/08/2026, Rodrigo).
--
-- O plano dimensiona pela demanda TEÓRICA (vendas × ficha explodida). Quando um preparo tem perda
-- sistemática, o Ponto de Ressuprimento fica curto TODA semana e o bar fica sem — não importa
-- quantas vezes a ficha seja conferida.
--
-- Caso que originou (Xarope de Gengibre, bar 3, pd0026): 4 semanas de 20/07 a 17/08 deram
-- teórico 80,75 L × real 109,50 L (estoque inicial + produzido − estoque final) = **36% a mais**,
-- com desvio negativo nas 4 semanas seguidas. A operação confirmou que a ficha está CERTA (dose de
-- 30 ml; sifão rende 20-25 espumas e a ficha usa 20, o cenário conservador) — ou seja, os 36% são
-- perda real: over-pour, espuma refeita quando a consistência não dá, sobra de sifão descartada.
-- Em 17/08 o estoque fechou em 0,40 L: zerou.
--
-- POR QUE NÃO usar o Nível de Serviço pra absorver isso: o NS existe pra cobrir VARIABILIDADE
-- (semana que sai mais). Perda sistemática é VIÉS, não variância — enfiar no NS faz o número certo
-- pelo motivo errado e ESCONDE a perda, que é justamente o que o Desvio precisa continuar cobrando.
-- Com campo próprio, a tela mostra "teórico 22,8 + perda 36% = 31 L" e a perda segue visível.

alter table operations.producao_plano_config
  add column if not exists fator_perda_pct numeric not null default 0;

do $$ begin
  alter table operations.producao_plano_config add constraint producao_plano_config_perda_ck
    check (fator_perda_pct >= 0 and fator_perda_pct <= 300);
exception when duplicate_object then null; end $$;

comment on column operations.producao_plano_config.fator_perda_pct is
  '% de perda sistemática sobre a demanda teórica. PR = (media6 + desvpad × z) × (1 + pct/100).';

-- O snapshot da semana encerrada tem que congelar o fator usado, senão uma semana fechada muda de
-- número quando alguém ajustar a perda depois (o mesmo motivo de todas as outras colunas de snapshot).
alter table operations.producao_plano_item
  add column if not exists fator_perda_pct numeric;
