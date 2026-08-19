-- Painel de ajustes pendentes no Conta Azul, para as Consumações.
--
-- O PROBLEMA (levantado pelo Rodrigo em 19/08/2026). O lançamento da consumação é idempotente por
-- CHAVE e ignora o VALOR. Então, quando alguém reclassifica um consumo depois do dia já ter sido
-- lançado — "isso não foi benefício cliente, foi funcionário" — ou marca "ignorar":
--
--   · a categoria antiga some da lista de itens e NINGUÉM a estorna: fica no Conta Azul;
--   · a nova aparece como pendente e, se lançada, SOMA por cima em vez de substituir;
--   · e o `montarComplemento` percebe o desequilíbrio e cria uma receita de ajuste que faz o
--     TOTAL do dia fechar.
--
-- Ou seja: o total sempre bate e o erro fica escondido DENTRO da categoria. É pior do que dar erro,
-- porque não aparece em relatório nenhum. Medido nos 45 dias anteriores (bar 3): 31 linhas onde a
-- categoria simplesmente sumiu, somando R$ 2.114 que estão no CA e não deveriam estar.
--
-- Esta função só ENXERGA. Corrigir sozinho exigiria estornar uma despesa, e no Conta Azul cada
-- `[Consumação] X` existe apenas como DESPESA (só o Ajuste CMV tem o par de RECEITA), enquanto a
-- API do CA é read-only para categorias — criar as espelho é trabalho manual na tela deles.
-- Enquanto essa decisão não é tomada, o painel tira de quem opera a obrigação de LEMBRAR.
--
-- `no_ca` soma DESPESA menos RECEITA da mesma chave: assim, quando o estorno for feito pelo Zykor
-- um dia, a linha some sozinha da lista em vez de precisar de um "resolvido" manual.

create or replace function financial.fn_consumacao_pendencias(
  p_bar_id integer, p_ini date, p_fim date, p_fator numeric default 0.35
)
returns table(
  dia date, chave text, no_ca numeric, agora numeric, delta numeric, situacao text
)
language sql
stable
security definer
set search_path to 'financial', 'public', 'pg_catalog'
as $function$
  with dias as (
    select generate_series(p_ini, p_fim, interval '1 day')::date as d
  ),
  lancado as (
    select l.competencia as dia, l.chave,
           round(sum(case when l.sinal = 'DESPESA' then l.valor else -l.valor end), 2) as no_ca
    from financial.lancamento_manual_ca_log l
    where l.tipo = 'consumacao' and l.bar_id = p_bar_id
      and l.competencia between p_ini and p_fim
      and l.chave not like 'ajuste_cmv%'   -- contrapartida e complemento nao sao categoria de consumo
    group by 1, 2
  ),
  atual as (
    select d.d as dia, r.categoria::text as chave, round(r.custo_real, 2) as agora
    from dias d
    cross join lateral public.get_consumos_9_custo_semana(p_bar_id, d.d, d.d, p_fator) r
    where r.categoria <> 'outros'
  )
  select coalesce(l.dia, a.dia) as dia,
         coalesce(l.chave, a.chave) as chave,
         coalesce(l.no_ca, 0) as no_ca,
         coalesce(a.agora, 0) as agora,
         round(coalesce(a.agora, 0) - coalesce(l.no_ca, 0), 2) as delta,
         case
           when l.chave is null then 'novo'
           when coalesce(a.agora, 0) = 0 then 'sumiu'
           when coalesce(a.agora, 0) > coalesce(l.no_ca, 0) then 'aumentou'
           else 'diminuiu'
         end as situacao
  from lancado l
  full join atual a on a.dia = l.dia and a.chave = l.chave
  -- so dia JA lancado: dia inteiro pendente ja aparece no fluxo normal da tela
  where exists (select 1 from lancado x where x.dia = coalesce(l.dia, a.dia))
    and abs(coalesce(a.agora, 0) - coalesce(l.no_ca, 0)) >= 0.01
  order by 1, 2;
$function$;

comment on function financial.fn_consumacao_pendencias(integer, date, date, numeric) is
  'Divergencia entre o Conta Azul e a classificacao de consumo atual, por dia e categoria. Alimenta o painel de ajustes pendentes das Consumacoes.';
