-- Entradas de caixa em DINHEIRO (ContaHub pagamentos recebidos, meio='Dinheiro')
-- Alimenta a aba "Entradas de Caixa" do Fluxo Dinheiro + o lançamento automático
-- de contas-a-receber no Conta Azul.

create or replace view silver.contahub_entrada_caixa_dinheiro as
select
  p.bar_id,
  p.dt_gerencial,
  nullif(p.trn,'')::int as trn,
  count(*)                         as qtd_pagamentos,
  sum(p.liquido)::numeric(14,2)    as total_liquido,
  sum(p.valor)::numeric(14,2)      as total_bruto
from bronze.bronze_contahub_financeiro_pagamentosrecebidos p
where p.meio = 'Dinheiro'
group by p.bar_id, p.dt_gerencial, nullif(p.trn,'')::int;

comment on view silver.contahub_entrada_caixa_dinheiro is
  'Entradas de caixa em dinheiro por turno (ContaHub pagamentos, meio=Dinheiro). total_liquido = dinheiro recebido no turno.';

create or replace view silver.contahub_entrada_caixa_dinheiro_dia as
select
  p.bar_id,
  p.dt_gerencial,
  count(*)                      as qtd_pagamentos,
  sum(p.liquido)::numeric(14,2) as total_liquido
from bronze.bronze_contahub_financeiro_pagamentosrecebidos p
where p.meio = 'Dinheiro'
group by p.bar_id, p.dt_gerencial;

comment on view silver.contahub_entrada_caixa_dinheiro_dia is
  'Entradas de caixa em dinheiro agregadas por dia — base do lançamento automático contas-a-receber no Conta Azul.';
