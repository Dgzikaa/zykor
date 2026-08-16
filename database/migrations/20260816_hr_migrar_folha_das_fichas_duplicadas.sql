-- Duplicatas de nome curto: MIGRAR a folha antes de apagar a ficha, nunca só apagar.
--
-- O pedido era "limpar as duplicatas, só não perder dado que exista numa ficha e não na outra".
-- Conferindo antes, a premissa caiu: **100% de `hr.folha_pagamento` do bar 3 estava pendurada nas
-- fichas inativas de nome curto** — 114 linhas, 57 fichas, R$ 206.356,76 de bruto. Nenhuma linha na
-- ficha ativa. As mesmas fichas carregam `provisoes_trabalhistas`. É por isso que
-- `hr.funcionarios.salario_base` está zerado nos 3 bares e mesmo assim o Custo de MO funciona: o
-- dinheiro mora na folha, não no cadastro. Apagar direto teria destruído o histórico salarial.
--
-- Aplicado em 16/08/2026, só nas 18 INEQUÍVOCAS (exatamente um ativo cujo nome começa com o nome
-- curto, no mesmo bar): Ana Clara, Ana Julia, Andréia, Dakota, Edna, Hadassa, Hélio, Jhuly, Kauan,
-- Luan, Lucia, Matheus Lima, Nayara, Paula, Phelipe, Renan, Vivian, Wendel.
--
-- Ordem obrigatória: repontar folha -> repontar provisões -> só então apagar, e apagar APENAS se
-- nada mais sobrou apontando para a ficha curta. O bloco confere a soma da folha no começo e no fim
-- e ABORTA se o total mudar — migração de dinheiro não pode ser verificada no olho.
--
-- Resultado: 114 linhas e R$ 206.356,76 idênticos antes e depois; 36 linhas passaram para ficha
-- ativa; 18 fichas apagadas; 0 folha órfã.
--
-- NÃO cobertas de propósito:
--  · 3 ambíguas — Beatriz (2 candidatos), Matheus (4), Renato (2). Nome não decide, e nenhuma das
--    pontas tem CPF para provar.
--  · 39 sem nenhum ativo correspondente — gente que já saiu E linhas que nem são pessoas
--    ("ASG +1", "Cumim +3", "Chefe de Salão +1"): o import criou uma ficha por LINHA da planilha.
--    Nelas a ficha curta é o único lugar onde a folha existe.

do $$
declare r record; v_apagadas int := 0;
        v_folha_antes numeric; v_folha_depois numeric; v_linhas_antes int; v_linhas_depois int;
begin
  select count(*), coalesce(sum(salario_bruto),0) into v_linhas_antes, v_folha_antes from hr.folha_pagamento;

  for r in
    with curta as (
      select distinct f.id, f.nome, f.bar_id
      from hr.funcionarios f join hr.folha_pagamento fp on fp.funcionario_id = f.id
      where not f.ativo and f.tangerino_employee_id is null
    )
    select c.id as dup_id, c.nome as dup_nome, min(b.id) as real_id
    from curta c
    join hr.funcionarios b on b.bar_id=c.bar_id and b.ativo and b.id<>c.id
         and public.normcat(b.nome) like public.normcat(c.nome) || ' %'
    group by c.id, c.nome
    having count(b.id) = 1
  loop
    update hr.folha_pagamento fp set funcionario_id = r.real_id
     where fp.funcionario_id = r.dup_id
       and not exists (select 1 from hr.folha_pagamento x
                        where x.funcionario_id=r.real_id and x.mes=fp.mes and x.ano=fp.ano);

    update hr.provisoes_trabalhistas pt set funcionario_id = r.real_id
     where pt.funcionario_id = r.dup_id
       and not exists (select 1 from hr.provisoes_trabalhistas x
                        where x.funcionario_id=r.real_id and x.bar_id=pt.bar_id and x.mes=pt.mes and x.ano=pt.ano);

    if not exists (select 1 from hr.folha_pagamento where funcionario_id=r.dup_id)
       and not exists (select 1 from hr.provisoes_trabalhistas where funcionario_id=r.dup_id) then
      delete from hr.funcionarios where id = r.dup_id;
      v_apagadas := v_apagadas + 1;
    else
      raise notice 'ficha % (%): sobrou coisa, NAO apagada', r.dup_nome, r.dup_id;
    end if;
  end loop;

  select count(*), coalesce(sum(salario_bruto),0) into v_linhas_depois, v_folha_depois from hr.folha_pagamento;
  if v_linhas_antes <> v_linhas_depois or v_folha_antes <> v_folha_depois then
    raise exception 'FOLHA MUDOU: linhas %->%, bruto %->%', v_linhas_antes, v_linhas_depois, v_folha_antes, v_folha_depois;
  end if;
  raise notice 'ok: % fichas apagadas, folha intacta (% linhas, R$ %)', v_apagadas, v_linhas_depois, v_folha_depois;
end $$;
