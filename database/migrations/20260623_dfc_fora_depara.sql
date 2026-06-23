-- Aba "Fora do de-para" do DFC: lista categorias do Conta Azul com movimento que
-- NÃO estão no de-para da DRE (financial.dre_categoria_macro) — somem dos relatórios.
-- na_orcamentacao = se também falta no de-para da Orçamentação (meta.categoria_zykor_map).
-- Aplicado em produção 2026-06-23 via MCP.
create or replace function financial.get_dfc_fora_depara(p_bar_id integer, p_ano integer)
returns table(categoria text, qtd bigint, total numeric, na_orcamentacao boolean, primeiro date, ultimo date)
language sql stable security definer
set search_path = public, financial, meta, bronze
as $$
  select l.categoria_nome::text as categoria,
    count(*) as qtd,
    round(sum(coalesce(nullif(l.valor_bruto,0), l.valor_pago))::numeric, 2) as total,
    exists(select 1 from meta.categoria_zykor_map m
           where lower(trim(m.categoria_ca)) = lower(trim(l.categoria_nome))) as na_orcamentacao,
    min(l.data_competencia) as primeiro,
    max(l.data_competencia) as ultimo
  from bronze.bronze_contaazul_lancamentos l
  where l.bar_id = p_bar_id
    and l.excluido_em is null
    and extract(year from l.data_competencia) = p_ano
    and l.categoria_nome is not null and trim(l.categoria_nome) <> ''
    and not exists (select 1 from financial.dre_categoria_macro d
                    where lower(trim(d.categoria_nome)) = lower(trim(l.categoria_nome)))
  group by l.categoria_nome
  order by abs(sum(coalesce(nullif(l.valor_bruto,0), l.valor_pago))) desc;
$$;
grant execute on function financial.get_dfc_fora_depara(integer, integer) to authenticated, anon, service_role;
