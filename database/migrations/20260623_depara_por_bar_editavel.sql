-- De-para POR BAR + classificador self-service (aba "Fora do de-para" do DFC).
-- Aplicado em produção 2026-06-23 via MCP. Arquivo p/ registro.

-- 1) Fundação: bar_id nullable nos 3 de-paras. NULL = padrão global; bar_id = exceção.
--    Unique vira (categoria, coalesce(bar_id,0)) pra global + override coexistirem.
alter table meta.categoria_dfc_map add column if not exists bar_id integer;
alter table meta.categoria_dfc_map drop constraint if exists categoria_dfc_map_pkey;
create unique index if not exists ux_categoria_dfc_map_cat_bar on meta.categoria_dfc_map (categoria_ca, coalesce(bar_id, 0));
alter table meta.categoria_zykor_map add column if not exists bar_id integer;
alter table meta.categoria_zykor_map drop constraint if exists categoria_zykor_map_categoria_ca_key;
create unique index if not exists ux_categoria_zykor_map_cat_bar on meta.categoria_zykor_map (categoria_ca, coalesce(bar_id, 0));
alter table financial.dre_categoria_macro add column if not exists bar_id integer;
alter table financial.dre_categoria_macro drop constraint if exists dre_categoria_macro_categoria_nome_key;
create unique index if not exists ux_dre_categoria_macro_cat_bar on financial.dre_categoria_macro (categoria_nome, coalesce(bar_id, 0));

-- 2) Detecção: categorias com movimento no bar/ano que NÃO resolvem no de-para do DFC
--    (com override por bar). Flags na_dre/na_orcamentacao avisam dos outros relatórios.
drop function if exists financial.get_dfc_fora_depara(integer, integer);
create function financial.get_dfc_fora_depara(p_bar_id integer, p_ano integer)
returns table(categoria text, qtd bigint, total numeric, na_dre boolean, na_orcamentacao boolean, primeiro date, ultimo date)
language sql stable security definer set search_path = public, financial, meta, bronze
as $$
  select l.categoria_nome::text, count(*),
    round(sum(coalesce(nullif(l.valor_bruto,0), l.valor_pago))::numeric, 2),
    exists(select 1 from financial.dre_categoria_macro d where public.normcat(d.categoria_nome)=public.normcat(l.categoria_nome) and (d.bar_id=p_bar_id or d.bar_id is null)),
    exists(select 1 from meta.categoria_zykor_map m where public.normcat(m.categoria_ca)=public.normcat(l.categoria_nome) and (m.bar_id=p_bar_id or m.bar_id is null)),
    min(l.data_competencia), max(l.data_competencia)
  from bronze.bronze_contaazul_lancamentos l
  where l.bar_id=p_bar_id and l.excluido_em is null and extract(year from l.data_competencia)=p_ano
    and l.categoria_nome is not null and trim(l.categoria_nome)<>''
    and not exists (select 1 from meta.categoria_dfc_map dd where public.normcat(dd.categoria_ca)=public.normcat(l.categoria_nome) and (dd.bar_id=p_bar_id or dd.bar_id is null))
  group by l.categoria_nome
  order by abs(sum(coalesce(nullif(l.valor_bruto,0), l.valor_pago))) desc;
$$;
grant execute on function financial.get_dfc_fora_depara(integer, integer) to authenticated, anon, service_role;

-- 3) Gravação self-service: cria/atualiza grupo_dfc COMO EXCEÇÃO DAQUELE BAR.
create or replace function meta.set_categoria_dfc(p_bar_id integer, p_categoria text, p_grupo text)
returns void language plpgsql security definer set search_path = meta, public as $$
begin
  if p_grupo is null or btrim(p_grupo)='' then return; end if;
  if exists (select 1 from meta.categoria_dfc_map where upper(btrim(categoria_ca))=upper(btrim(p_categoria)) and bar_id=p_bar_id) then
    update meta.categoria_dfc_map set grupo_dfc=p_grupo where upper(btrim(categoria_ca))=upper(btrim(p_categoria)) and bar_id=p_bar_id;
  else
    insert into meta.categoria_dfc_map (categoria_ca, grupo_dfc, bar_id) values (btrim(p_categoria), p_grupo, p_bar_id);
  end if;
end; $$;
grant execute on function meta.set_categoria_dfc(integer, text, text) to authenticated, anon, service_role;
