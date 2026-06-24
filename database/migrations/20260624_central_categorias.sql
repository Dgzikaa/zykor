-- Central de Categorias: mapeia o GRUPO-PAI do Conta Azul (categoria_pai_id) -> macro
-- da DRE; os filhos herdam, e categoria nova criada sob um pai já mapeado entra
-- automática. O usuário nomeia o grupo (a API do CA não expõe o nome do nó-pai).
-- Ver project_contaazul_categorias_hierarquia_api.

create table if not exists meta.categoria_grupo (
  bar_id integer not null,
  categoria_pai_id uuid not null,
  nome_grupo text not null,
  dre_macro text,
  dre_ordem_macro integer,
  updated_at timestamptz not null default now(),
  primary key (bar_id, categoria_pai_id)
);

-- Expande pai->filhos no de-para da DRE (por nome, como casa hoje). Só insere filhos
-- ainda não mapeados (mapeamento manual direto sempre vence). Roda após sync de
-- categorias e ao salvar um grupo. Retorna quantos filhos novos foram classificados.
create or replace function meta.aplicar_grupos_dre(p_bar integer)
returns integer
language plpgsql
set search_path to 'public','meta','financial','bronze','pg_catalog'
as $function$
declare v_count integer;
begin
  with novos as (
    insert into financial.dre_categoria_macro (bar_id, categoria_nome, categoria_macro, ordem_macro, ordem_sub)
    select c.bar_id, c.nome, g.dre_macro, coalesce(g.dre_ordem_macro, 50), 99
    from bronze.bronze_contaazul_categorias c
    join meta.categoria_grupo g on g.bar_id = c.bar_id and g.categoria_pai_id = c.categoria_pai_id
    where c.bar_id = p_bar and c.ativo and g.dre_macro is not null and nullif(trim(c.nome),'') is not null
      and public.normcat(c.nome) not in (
        select public.normcat(d.categoria_nome) from financial.dre_categoria_macro d
        where d.bar_id = c.bar_id or d.bar_id is null
      )
    on conflict do nothing
    returning 1
  )
  select count(*) into v_count from novos;
  return v_count;
end
$function$;

-- Leitura da árvore (categorias agrupadas por pai) p/ a Central: grupo + macro atual + totais + cobertura.
create or replace function meta.get_categorias_arvore(p_bar integer, p_ano integer)
returns table(
  categoria_pai_id uuid, nome_grupo text, grupo_dre_macro text, grupo_dre_ordem integer,
  contaazul_id uuid, categoria text, tipo text, total numeric,
  dre_macro_atual text, na_dre boolean, na_orcamentacao boolean, na_dfc boolean
)
language sql stable
set search_path to 'public','meta','financial','bronze','pg_catalog'
as $function$
  with mov as (
    select categoria_id, round(sum(coalesce(nullif(valor_bruto,0),valor_pago)),2) total
    from bronze.bronze_contaazul_lancamentos
    where bar_id=p_bar and excluido_em is null and extract(year from data_competencia)=p_ano
    group by categoria_id
  )
  select c.categoria_pai_id, g.nome_grupo, g.dre_macro, g.dre_ordem_macro,
    c.contaazul_id, c.nome, c.tipo, coalesce(m.total,0),
    (select d.categoria_macro from financial.dre_categoria_macro d
      where public.normcat(d.categoria_nome)=public.normcat(c.nome) and (d.bar_id=c.bar_id or d.bar_id is null)
      order by d.bar_id nulls last limit 1),
    exists(select 1 from financial.dre_categoria_macro d where public.normcat(d.categoria_nome)=public.normcat(c.nome) and (d.bar_id=c.bar_id or d.bar_id is null)),
    exists(select 1 from meta.categoria_zykor_map z where public.normcat(z.categoria_ca)=public.normcat(c.nome) and (z.bar_id=c.bar_id or z.bar_id is null)),
    exists(select 1 from meta.categoria_dfc_map f where public.normcat(f.categoria_ca)=public.normcat(c.nome) and (f.bar_id=c.bar_id or f.bar_id is null))
  from bronze.bronze_contaazul_categorias c
  left join meta.categoria_grupo g on g.bar_id=c.bar_id and g.categoria_pai_id=c.categoria_pai_id
  left join mov m on m.categoria_id=c.contaazul_id
  where c.bar_id=p_bar and c.ativo
  order by g.nome_grupo nulls last, c.nome;
$function$;

-- Salva o grupo-pai (nome + macro) e expande pros filhos.
create or replace function meta.set_categoria_grupo(p_bar integer, p_pai uuid, p_nome text, p_macro text)
returns integer
language plpgsql
set search_path to 'public','meta','financial','pg_catalog'
as $function$
declare v_ordem integer; v_aplicados integer;
begin
  select min(ordem_macro) into v_ordem from financial.dre_categoria_macro where categoria_macro = nullif(p_macro,'');
  insert into meta.categoria_grupo (bar_id, categoria_pai_id, nome_grupo, dre_macro, dre_ordem_macro, updated_at)
  values (p_bar, p_pai, coalesce(nullif(trim(p_nome),''),'Grupo'), nullif(p_macro,''), v_ordem, now())
  on conflict (bar_id, categoria_pai_id) do update
    set nome_grupo = excluded.nome_grupo, dre_macro = excluded.dre_macro,
        dre_ordem_macro = excluded.dre_ordem_macro, updated_at = now();
  select meta.aplicar_grupos_dre(p_bar) into v_aplicados;
  return coalesce(v_aplicados,0);
end
$function$;

grant execute on function meta.get_categorias_arvore(integer,integer) to authenticated, service_role, anon;
grant execute on function meta.set_categoria_grupo(integer,uuid,text,text) to authenticated, service_role;
grant execute on function meta.aplicar_grupos_dre(integer) to authenticated, service_role;