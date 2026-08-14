-- Histórico de freelas (ata de RH de 13/08/2026): "quantas vezes no ano, quanto já pagamos e
-- quantas semanas foi mais de 2x" — o indicador de risco trabalhista.
--
-- A fonte NÃO é hr.freela_convocacao (0 linhas, a tela de convocação por dia nunca foi usada):
-- quem realmente registra o freela é o fluxo de pagamento — financial.pedidos_pagamento
-- (tipo='freela') com uma competência por diária. Contar de lá é contar o que de fato aconteceu.
--
-- Identidade da pessoa = chave_pix. É o único campo 100% preenchido: cpf_cnpj está nulo em ~40%
-- dos pedidos e o nome vem digitado (aparece com e sem acento, abreviado etc.).
--
-- Já aplicada no banco em 14/08/2026.

create or replace function hr.fn_freelas_historico(p_bar_id integer, p_ano integer)
returns table (
  chave_pix        text,
  nome             text,
  funcoes          text,
  eh_empresa       boolean,
  diarias          integer,
  total_pago       numeric,
  total_previsto   numeric,
  semanas          integer,
  semanas_risco    integer,
  max_na_semana    integer,
  primeira         date,
  ultima           date
)
language sql
stable
security definer
set search_path = public, hr, financial, extensions
as $$
  with diaria as (
    select p.chave_pix,
           upper(btrim(p.beneficiario_nome))                      as nome,
           p.status,
           coalesce(c.data_competencia, p.data_competencia)       as dia,
           coalesce(c.valor, p.valor)                             as valor,
           nullif(btrim(coalesce(c.descricao, '')), '')           as funcao
    from financial.pedidos_pagamento p
    left join financial.pedidos_pagamento_competencias c on c.pedido_id = p.id
    where p.bar_id = p_bar_id
      and p.tipo = 'freela'
      -- rascunho ainda não foi enviado ao financeiro; cancelado/rejeitado não aconteceu
      and p.status in ('aguardando_aprovacao', 'aprovado', 'agendado', 'pago')
      and extract(year from coalesce(c.data_competencia, p.data_competencia)) = p_ano
  ),
  -- a semana do freela é segunda→domingo, igual à do fechamento em /operacional/freelas
  por_semana as (
    select chave_pix, date_trunc('week', dia)::date as semana, count(*)::int as n
    from diaria group by 1, 2
  ),
  agg as (
    select d.chave_pix,
           max(d.nome)                                                  as nome,
           count(*)::int                                                as diarias,
           sum(d.valor) filter (where d.status = 'pago')                as total_pago,
           sum(d.valor) filter (where d.status <> 'pago')               as total_previsto,
           min(d.dia)                                                   as primeira,
           max(d.dia)                                                   as ultima,
           string_agg(distinct d.funcao, ', ')                          as funcoes
    from diaria d group by d.chave_pix
  )
  select a.chave_pix,
         coalesce(b.nome, a.nome)                                       as nome,
         coalesce(nullif(b.funcao, ''), a.funcoes)                      as funcoes,
         -- PJ não gera vínculo: empresa de segurança 5x por semana não é risco trabalhista
         coalesce(b.tipo_chave = 'cnpj', false)                         as eh_empresa,
         a.diarias,
         coalesce(a.total_pago, 0)                                      as total_pago,
         coalesce(a.total_previsto, 0)                                  as total_previsto,
         (select count(*)::int from por_semana s where s.chave_pix = a.chave_pix)              as semanas,
         (select count(*)::int from por_semana s where s.chave_pix = a.chave_pix and s.n > 2)  as semanas_risco,
         coalesce((select max(s.n) from por_semana s where s.chave_pix = a.chave_pix), 0)      as max_na_semana,
         a.primeira,
         a.ultima
  from agg a
  left join lateral (
    select nome, funcao, tipo_chave from financial.beneficiarios
    where bar_id = p_bar_id and tipo = 'freela' and chave_pix = a.chave_pix
    order by updated_at desc nulls last limit 1
  ) b on true
  order by a.diarias desc, a.ultima desc;
$$;

comment on function hr.fn_freelas_historico(integer, integer) is
  'Histórico anual de freelas a partir do fluxo de pagamento (financial.pedidos_pagamento tipo=freela). semanas_risco = semanas com mais de 2 diárias — o indicador de risco de vínculo.';

grant execute on function hr.fn_freelas_historico(integer, integer) to authenticated, service_role;
