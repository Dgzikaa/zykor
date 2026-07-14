-- #12 (backlog reunião 13/07): CNPJs no Simples Nacional calculam DAS (não os 5 tributos
-- do Lucro Presumido). Aplicado via MCP em 2026-07-14. Fonte da verdade no repo.
--
-- 1) Regime por CNPJ + marca os do Simples (dono confirmou):
--    bar3 OrdiBar/ORDI BAR LTDA (cnpj_indice 2), bar4 DSCBR (cnpj_indice 3).
alter table financial.nf_cnpj_labels
  add column if not exists regime text not null default 'presumido';

update financial.nf_cnpj_labels set regime = 'simples' where bar_id = 3 and cnpj_indice = 2;
update financial.nf_cnpj_labels set regime = 'simples' where bar_id = 4 and cnpj_indice = 3;

-- 2) RBT12 por CNPJ = soma do faturamento (max entre NF e Stone) dos 12 meses ANTERIORES
--    ao mês de competência. Mesma fonte de faturamento do fn_impostos_base_mensal_cnpj.
--    A alíquota efetiva sai da tabela Anexo I no código (fechamento/impostos/route.ts):
--    efetiva = (RBT12*aliq_nominal - deduzir)/RBT12 ; DAS = efetiva * faturamento_do_mes.
create or replace function public.fn_impostos_rbt12_cnpj(p_bar integer, p_ano integer, p_mes integer)
returns table(cnpj_indice integer, rbt12 numeric)
language sql stable security definer
set search_path to 'public','gold','silver','bronze','financial','extensions'
as $function$
  with lim as (
    select (make_date(p_ano,p_mes,1) - interval '12 months')::date d0,
           make_date(p_ano,p_mes,1)::date d1
  ),
  meses as (
    select generate_series(date_trunc('month',(select d0 from lim)),
                           date_trunc('month',(select d1 from lim)) - interval '1 month',
                           interval '1 month')::date as m0
  ),
  labels as (
    select l.cnpj_indice, coalesce(l.stone_empresas,'{}') as stone_empresas
    from financial.nf_cnpj_labels l where l.bar_id = p_bar
  ),
  nf as (
    select ms.m0, lb.cnpj_indice,
      coalesce(
        (select r.faturamento from financial.nfce_cnpj_resumo r
          where r.bar_id=p_bar and r.cnpj_indice=lb.cnpj_indice and make_date(r.ano,r.mes,1)=ms.m0),
        (select sum(s.total_autorizado) from gold.notas_fiscais_diaria s
          where s.bar_id=p_bar and s.cnpj_indice=lb.cnpj_indice
            and s.data>=ms.m0 and s.data < (ms.m0+interval '1 month')),
        0)::numeric as v
    from meses ms cross join labels lb
  ),
  st as (
    select ms.m0, lb.cnpj_indice,
      coalesce((select sum(t.gross_amount) from silver.stone_transacoes t
        where t.bar_id=p_bar and t.empresa_nome = any(lb.stone_empresas)
          and t.capture_local_dt is not null
          and (t.capture_local_dt - interval '6 hours')::date >= ms.m0
          and (t.capture_local_dt - interval '6 hours')::date <  (ms.m0+interval '1 month')),0)::numeric as v
    from meses ms cross join labels lb
  )
  select nf.cnpj_indice, round(sum(greatest(coalesce(nf.v,0), coalesce(st.v,0))),2) as rbt12
  from nf join st on st.m0=nf.m0 and st.cnpj_indice=nf.cnpj_indice
  group by nf.cnpj_indice;
$function$;

grant execute on function public.fn_impostos_rbt12_cnpj(integer,integer,integer) to service_role;
