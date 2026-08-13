-- financial.fn_parcelas_no_ca — parcelas dessa compra que JA existem no Conta Azul
--
-- A tabela cartao_compra_parcelada so conhece o que passou pelo fluxo do Zykor. Parcela lancada na
-- MAO direto no Conta Azul (o jeito antigo: "as vezes nao sou eu que faco, e a Catrine") nao aparece
-- la, e nao da pra reconstruir a chave a partir do CA — ele nao guarda cartao nem data da compra.
--
-- Caso real: o Mini Lousa do Deboche tem as 6 parcelas lancadas na mao, todas em competencia 24/06.
-- Sem esta checagem, a fatura de setembro traria a "Parcela 3 de 6" e ela seria lancada por cima.
--
-- Casa por numero da parcela dentro do texto (aceita "3/6", "03/06" e "Parcela 3 de 6") + valor com
-- tolerancia de centavos, porque as parcelas variam entre si (38,42 / 38,37 / 38,41). Rodado contra
-- toda a base, achou 4 linhas ainda por lancar que estavam prestes a virar duplicata, sem nenhum
-- falso positivo. Ainda assim a rota NAO bloqueia sozinha: devolve a evidencia pra tela decidir.
create or replace function financial.fn_parcelas_no_ca(p_bar integer, p_total integer, p_valor numeric)
returns table (n integer, descricao text, data_competencia date, data_vencimento date, valor_bruto numeric, contaazul_id uuid)
language sql
stable
security definer
set search_path to 'financial', 'bronze', 'public'
as $function$
  select
    (m[1])::int as n,
    l.descricao, l.data_competencia, l.data_vencimento, l.valor_bruto, l.contaazul_id
  from bronze.bronze_contaazul_lancamentos l
  cross join lateral regexp_match(
    l.descricao,
    '(?:^|[^0-9])0*([0-9]{1,2})\s*(?:/|\s+de\s+)\s*0*' || p_total || '(?:[^0-9]|$)'
  ) m
  where l.bar_id = p_bar
    and l.excluido_em is null
    and m is not null
    and abs(l.valor_bruto - p_valor) <= 0.10
    and (m[1])::int between 1 and p_total;
$function$;

comment on function financial.fn_parcelas_no_ca(integer, integer, numeric) is
  'Parcelas dessa compra que JA existem no Conta Azul (inclusive lancadas na mao, fora do Zykor). Casa por numero da parcela no texto + valor com tolerancia de centavos.';

grant execute on function financial.fn_parcelas_no_ca(integer, integer, numeric) to service_role;
