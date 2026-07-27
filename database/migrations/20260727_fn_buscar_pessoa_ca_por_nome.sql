-- Anti-duplicata de fornecedor por NOME, ignorando acento e caixa.
-- O cadastro de pessoa no CA só evitava duplicata quando havia CPF/CNPJ. Sem documento
-- (freela com chave PIX aleatória, por ex.) ele criava de novo a cada digitação do mesmo nome.
-- Comparar no app com ilike não resolve: "Jose" não casa com "José". Aqui o unaccent faz isso.
-- search_path inclui extensions de propósito — sem isso a função quebra silenciosamente
-- quando chamada por outro papel (unaccent hoje vive em public, mas não custa cobrir).
create or replace function public.buscar_pessoa_ca_por_nome(p_bar_id int, p_nome text)
returns table (contaazul_id text, nome text, perfil text)
language sql
stable
security definer
set search_path = public, bronze, extensions
as $$
  select p.contaazul_id, p.nome, p.perfil
  from bronze.bronze_contaazul_pessoas p
  where p.bar_id = p_bar_id
    and p.ativo
    and lower(unaccent(btrim(regexp_replace(p.nome, '\s+', ' ', 'g'))))
      = lower(unaccent(btrim(regexp_replace(p_nome, '\s+', ' ', 'g'))))
  order by p.perfil asc   -- FORNECEDOR antes de CLIENTE (alfabético), igual à busca por documento
  limit 1;
$$;

revoke all on function public.buscar_pessoa_ca_por_nome(int, text) from public;
grant execute on function public.buscar_pessoa_ca_por_nome(int, text) to service_role;
