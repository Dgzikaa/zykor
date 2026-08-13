-- =============================================================================
-- Operacao: regua unica de CMO, seguranca de volta na escala e faturamento do M1
-- 13/08/2026
-- =============================================================================
--
-- Tres decisoes do Cadu fecharam o que estava travado no modulo:
--
--   1. "e pra ser igual. sempre 20%"           -> uma regua so, semanal e mensal
--   2. "o cmo fixo deve estar errado no semanal, pq ele e colocado manualmente"
--   3. "seguranca temos 2 fixos na casa"       -> nao virou terceirizada
--
-- =============================================================================
-- 1. CMO FIXO: UM VALOR SO, RATEADO POR DIA
-- -----------------------------------------------------------------------------
-- Ate aqui existiam DUAS constantes digitadas e independentes: 59.000 na semana e
-- 172.000 no mes. 172/59 = 2,9 — nao sao 4,3 semanas, entao as duas visoes mediam
-- reguas diferentes e a semana estourava enquanto o mes passava:
--
--            semana        com 59.000    com o mensal rateado por dia
--            03-09/08         27,2%              19,2%
--            10-16/08         28,3%              20,2%
--            17-23/08         25,6%              18,1%
--            24-30/08         25,7%              18,3%
--            agosto           19,0%              19,0%
--
-- Rateado bate nos 20% que o Cadu pediu, nas duas visoes. Entao o semanal MORRE
-- (era 59.000) e sobra a folha do mes, rateada por dia:
--
--   fixo_do_periodo = folha_mensal / dias_do_mes * dias_do_periodo
--
-- Isso tambem resolve de graca a semana que atravessa o mes (27/07-02/08 entra em
-- agosto com 2 dias), que hoje tem um rateio de 7 dias na mao dentro da rota.
-- =============================================================================

alter table operations.operacao_parametro
  drop column if exists cmo_fixo_semanal;

alter table operations.operacao_parametro
  add column if not exists limite_cmo_pct numeric(5,2) not null default 20;

comment on column operations.operacao_parametro.cmo_fixo_mensal is
  'Folha CLT do MES. E a UNICA constante de CMO fixo: semana e mes saem dela rateada '
  'por dia (folha / dias_do_mes * dias_do_periodo). Ate 13/08/2026 existia tambem um '
  'cmo_fixo_semanal digitado (59.000) que media outra regua e fazia toda semana estourar.';

comment on column operations.operacao_parametro.limite_cmo_pct is
  'Teto de CMO% da operacao. Era 21 fixo no codigo; o Cadu fechou em 20 para semana e mes.';

-- =============================================================================
-- 2. SEGURANCA: 2 FIXOS NA CASA + FREELA POR CONTRATO DE EQUIPE
-- -----------------------------------------------------------------------------
-- A escala tinha DANIEL e MARCWS e parou de registrar em 02/08. Nao virou
-- terceirizada: pararam de lancar. A prova esta no proprio FIXOS da planilha, que
-- continua alternando 1 e 2 exatamente como a folga dos dois (seg e ter um deles
-- folga = 1 na casa; qua a dom = 2; sabado os dois entram no turno da noite).
--
-- O custo do freela de seguranca, porem, NAO e diaria por cabeca: os R$ 3.040 pagos
-- na semana de 03/08 dariam R$ 760 por "diaria" contra os R$ 190 do parametro. E
-- contrato de equipe. custo_fechado_dia existe pra isso: quando preenchido, o dia
-- que precisa de reforco custa o valor fechado, nao freelas x diaria.
--
-- Fica NULO ate o financeiro confirmar o valor do contrato — com nulo o calculo
-- segue como sempre foi. Inventar o valor aqui seria pior do que deixar visivel.
-- =============================================================================

alter table operations.operacao_parametro_funcao
  add column if not exists custo_fechado_dia numeric(12,2);

comment on column operations.operacao_parametro_funcao.custo_fechado_dia is
  'Valor fechado por dia quando a funcao e contratada como EQUIPE (seguranca), nao por '
  'cabeca. Preenchido: custo do dia = este valor sempre que faltar gente. Nulo: '
  'custo = freelas x diaria, o padrao.';

-- --- os dois seguranca de volta na escala, de 03/08 ate 13/09 -----------------
-- Replica a semana 27/07-02/08 (a ultima completa) dia da semana a dia da semana.
-- Nao ha unique em escala_dia — o guard e o not exists, para poder rodar de novo.
insert into operations.escala_dia
  (bar_id, data, funcao_id, pessoa_nome, slot, entra, sai, horas, marcador, turno, origem)
select e.bar_id, e.data + (7 * g.n), e.funcao_id, e.pessoa_nome, e.slot,
       e.entra, e.sai, e.horas, e.marcador, e.turno, 'zykor'
  from operations.escala_dia e
  join operations.operacao_funcao f on f.id = e.funcao_id
 cross join generate_series(1, 6) as g(n)
 where e.bar_id = 3
   and f.codigo = 'seguranca'
   and e.data between date '2026-07-27' and date '2026-08-02'
   and not exists (
     select 1 from operations.escala_dia x
      where x.bar_id = e.bar_id
        and x.data = e.data + (7 * g.n)
        and x.funcao_id = e.funcao_id
        and x.slot = e.slot
   );

-- --- refaz o fixos_escala dos dias afetados ----------------------------------
update operations.operacao_dia_funcao df
   set fixos_escala = coalesce(cnt.n, 0),
       atualizado_em = now()
  from operations.operacao_dia d
  join operations.operacao_funcao f on f.bar_id = d.bar_id and f.codigo = 'seguranca'
  left join lateral (
    select count(*) as n
      from operations.escala_dia e
     where e.bar_id = d.bar_id
       and e.data = d.data
       and e.funcao_id = f.id
       and e.entra is not null
       and (d.turno = 'unico' or e.turno = d.turno)
  ) cnt on true
 where df.operacao_dia_id = d.id
   and df.funcao_id = f.id
   and d.bar_id = 3
   and d.data between date '2026-08-03' and date '2026-09-13';

-- --- do dia de hoje pra frente, a escala manda -------------------------------
-- O passado continua sendo registro (fixos_manual da planilha). Daqui pra frente o
-- override sai da frente e a contagem da escala vale. Nao muda numero nenhum: o
-- fixos_escala reposto acima bate com o fixos_manual dia a dia — essa igualdade e
-- justamente a prova de que a reposicao esta certa.
update operations.operacao_dia_funcao df
   set fixos_manual = null,
       atualizado_em = now()
  from operations.operacao_dia d
  join operations.operacao_funcao f on f.bar_id = d.bar_id and f.codigo = 'seguranca'
 where df.operacao_dia_id = d.id
   and df.funcao_id = f.id
   and d.bar_id = 3
   and d.data >= date '2026-08-13'
   and df.fixos_manual is not null;

-- =============================================================================
-- 3. FATURAMENTO VINDO DO M1 DO PLANEJAMENTO COMERCIAL
-- -----------------------------------------------------------------------------
-- Era 100% digitado. O M1 ja existe por dia em eventos_base.m1_r e e o numero que o
-- comercial planejou — digitar de novo no plano operacional e retrabalho e fonte de
-- divergencia (a semana de 03/08 tem 255.000 digitados contra 293.547 de M1).
--
-- Mesmo par calculado x manual do resto da tela: o M1 entra sozinho, o digitado
-- ganha quando existe, e apagar a celula volta pro M1.
--
--   faturamento_previsto = coalesce(faturamento_manual, faturamento_m1)
--
-- Coluna GERADA de proposito: toda leitura que ja existe (resumo, comparativo,
-- plano) continua lendo faturamento_previsto sem saber de nada.
-- =============================================================================

-- o rename so acontece enquanto faturamento_previsto ainda for a coluna digitada
-- (depois ela existe de novo, gerada) — assim a migration pode rodar duas vezes
do $$ begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'operations' and table_name = 'operacao_dia'
       and column_name = 'faturamento_previsto' and is_generated = 'NEVER'
  ) then
    alter table operations.operacao_dia rename column faturamento_previsto to faturamento_manual;
  end if;
end $$;

alter table operations.operacao_dia
  add column if not exists faturamento_m1 numeric(12,2);

alter table operations.operacao_dia
  add column if not exists faturamento_previsto numeric(12,2)
  generated always as (coalesce(faturamento_manual, faturamento_m1)) stored;

comment on column operations.operacao_dia.faturamento_manual is
  'Faturamento digitado na tela. Ganha do M1 quando preenchido; apagar volta pro M1.';
comment on column operations.operacao_dia.faturamento_m1 is
  'M1 do planejamento comercial (eventos_base.m1_r) do dia. No sabado partido, rateado '
  'entre dia e noite na proporcao do que ja estava planejado.';
comment on column operations.operacao_dia.faturamento_previsto is
  'Derivado: coalesce(manual, m1). E o que a cadeia de calculo consome.';

-- =============================================================================
-- 4. A VIEW, com o custo fechado de equipe
-- =============================================================================
create or replace view operations.v_operacao_dia_funcao as
select
  df.id,
  d.bar_id,
  d.data,
  d.turno,
  d.id as operacao_dia_id,
  f.id as funcao_id,
  f.codigo as funcao_codigo,
  f.nome as funcao_nome,
  f.entra_no_custo,
  f.ordem as funcao_ordem,
  df.total_calculado,
  df.total_manual,
  coalesce(df.total_manual, df.total_calculado, 0) as total,
  df.fixos_escala,
  df.fixos_manual,
  coalesce(df.fixos_manual, df.fixos_escala, 0) as fixos,
  greatest(coalesce(df.total_manual, df.total_calculado, 0)
           - coalesce(df.fixos_manual, df.fixos_escala, 0), 0) as freelas,
  pf.diaria,
  case
    when not f.entra_no_custo then 0::numeric
    -- contrato de equipe: precisou de reforco, custa o valor fechado do dia
    when pf.custo_fechado_dia is not null then
      case when greatest(coalesce(df.total_manual, df.total_calculado, 0)
                         - coalesce(df.fixos_manual, df.fixos_escala, 0), 0) > 0
           then pf.custo_fechado_dia else 0::numeric end
    else greatest(coalesce(df.total_manual, df.total_calculado, 0)
                  - coalesce(df.fixos_manual, df.fixos_escala, 0), 0)::numeric
         * coalesce(pf.diaria, 0::numeric)
  end as custo,
  case
    when df.total_manual is not null and df.total_calculado is not null then 'amarelo'
    when df.total_calculado is not null then 'verde'
    else 'branco'
  end as total_origem,
  -- no fim da lista de proposito: create or replace view so aceita coluna nova no fim
  pf.custo_fechado_dia
from operations.operacao_dia_funcao df
join operations.operacao_dia d on d.id = df.operacao_dia_id
join operations.operacao_funcao f on f.id = df.funcao_id
left join lateral (
  select pf_1.diaria, pf_1.custo_fechado_dia
    from operations.operacao_parametro p
    join operations.operacao_parametro_funcao pf_1
      on pf_1.parametro_id = p.id and pf_1.funcao_id = f.id
   where p.bar_id = d.bar_id
     and p.vigencia_inicio <= d.data
     and (p.vigencia_fim is null or p.vigencia_fim >= d.data)
   order by p.vigencia_inicio desc
   limit 1
) pf on true;
