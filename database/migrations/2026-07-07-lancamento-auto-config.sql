-- Liga/desliga o lançamento AUTOMÁTICO (cron) por (bar, tipo de aba) no Conta Azul.
-- O botão MANUAL não depende disto. `cutoff` = a partir de quando o automático atua (só os novos;
-- o histórico segue manual). Sem linha = desligado (default off).
create table if not exists financial.lancamento_auto_config (
  bar_id      integer     not null,
  tipo        text        not null,   -- stone|sympla|entrada_dinheiro|variacao_estoque|consumacao|imposto|ajuste_virada
  ativo       boolean     not null default false,
  cutoff      timestamptz,
  updated_by  text,
  updated_at  timestamptz not null default now(),
  primary key (bar_id, tipo)
);

comment on table financial.lancamento_auto_config is
  'Liga/desliga o lançamento automático (cron) por (bar, tipo). cutoff = a partir de quando o automático atua (só os novos). O botão manual sempre funciona, independente disto.';

-- Seed: o que JÁ roda hoje entra LIGADO, sem corte (mantém o comportamento atual).
insert into financial.lancamento_auto_config (bar_id, tipo, ativo, cutoff, updated_by)
select b.bar_id, t.tipo, true, null, 'seed inicial'
from (values (3),(4)) b(bar_id)
cross join (values ('stone'),('sympla'),('entrada_dinheiro')) t(tipo)
on conflict (bar_id, tipo) do nothing;
