-- ============================================================================
-- Sinal do construtor de alertas: última contagem por insumo (curva A)
-- ----------------------------------------------------------------------------
-- Usada pelo motor (sinal 'insumo_sem_contagem'): distinct-on por insumo pra
-- pegar a contagem mais recente (evita o cap de 1000 linhas do PostgREST) e
-- calcular há quantos dias foi. Aplicada em prod em 06/jul/2026.
-- ============================================================================

create or replace function gold.fn_insumos_ultima_contagem(p_bar integer)
returns table (insumo_codigo text, insumo_nome text, ultima_contagem date, dias integer)
language sql
stable
security definer
set search_path = public, operations, silver
as $$
  select distinct on (ec.insumo_codigo)
    ec.insumo_codigo,
    ec.insumo_nome,
    ec.data_contagem::date as ultima_contagem,
    (current_date - ec.data_contagem::date) as dias
  from silver.estoque_contagem ec
  where ec.bar_id = p_bar and ec.curva_a = true
  order by ec.insumo_codigo, ec.data_contagem desc;
$$;

grant execute on function gold.fn_insumos_ultima_contagem(integer) to service_role;
