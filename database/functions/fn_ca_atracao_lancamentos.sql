-- operations.fn_ca_atracao_lancamentos
-- Linhas de custo de atração (cachê) do Conta Azul, por competência.
-- Usada pela tela de tagging (/analitico/atracoes/tagging) p/ derivar o
-- artista principal (maior cachê da noite) e o % que ele representa do faturamento.
-- Categoria filtrada com ILIKE 'Atra%Programa%' p/ ser robusto a acento/variação
-- de nome de categoria entre bares (ver feedback contaazul-categorias-acentuacao).
create or replace function operations.fn_ca_atracao_lancamentos(
  p_bar_id integer, p_ini date, p_fim date
)
returns table(data_competencia date, pessoa_nome text, descricao text, valor numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.data_competencia::date,
    coalesce(l.pessoa_nome, '')::text,
    coalesce(l.descricao, '')::text,
    sum(coalesce(l.valor_liquido, 0))::numeric
  from bronze.bronze_contaazul_lancamentos l
  where l.bar_id = p_bar_id
    and l.categoria_nome ilike 'Atra%Programa%'
    and l.data_competencia >= p_ini
    and l.data_competencia <= p_fim
    and l.excluido_em is null
  group by 1, 2, 3
  having sum(coalesce(l.valor_liquido, 0)) <> 0;
$$;

revoke all on function operations.fn_ca_atracao_lancamentos(integer, date, date) from public, anon;
grant execute on function operations.fn_ca_atracao_lancamentos(integer, date, date) to service_role;
