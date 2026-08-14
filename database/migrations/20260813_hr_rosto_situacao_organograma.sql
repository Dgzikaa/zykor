-- Rosto e selos do organograma (ata de 13/08/2026)
-- "no organograma tbm exibir os cartões de cada um como badge... tbm exibir badge se tiver de férias
--  ou atestado... eu coloquei o diego galdino la, pq ele n pega a foto e coloca no quadradinho?"

-- FOTO: ninguém tem foto_url preenchida no cadastro — nenhum dos 57 ativos do Ordinário. Mas o
-- Tangerino guarda a selfie de cada batida (o Diego Galdino tem 265). O dossiê já caía nessa selfie;
-- o organograma não, e por isso as caixas apareciam todas com as iniciais.
create or replace view hr.v_funcionario_rosto as
select distinct on (p.funcionario_id)
  p.funcionario_id, p.bar_id, p.foto_in_url as foto_url, p.data
from hr.ponto_registro p
where p.foto_in_url is not null
order by p.funcionario_id, p.data desc;

comment on view hr.v_funcionario_rosto is
  'Última selfie do ponto por pessoa — usada como rosto quando não há foto cadastrada.';

-- SELOS: férias e atestado são JANELA (valem de data_inicio até data_fim), então o selo aparece e
-- some sozinho. Cartão é histórico acumulado.
create or replace view hr.v_funcionario_situacao as
select
  f.id as funcionario_id,
  f.bar_id,
  exists (
    select 1 from hr.funcionario_ocorrencias o
    where o.funcionario_id = f.id and o.tipo = 'ferias'
      and current_date between o.data_inicio and coalesce(o.data_fim, o.data_inicio)
  ) as de_ferias,
  exists (
    select 1 from hr.funcionario_ocorrencias o
    where o.funcionario_id = f.id and o.tipo = 'atestado'
      and current_date between o.data_inicio and coalesce(o.data_fim, o.data_inicio)
  ) as com_atestado,
  (select count(*) from hr.funcionario_ocorrencias o
    where o.funcionario_id = f.id and o.cartao = 'amarelo')::int as cartoes_amarelos,
  (select count(*) from hr.funcionario_ocorrencias o
    where o.funcionario_id = f.id and o.cartao = 'vermelho')::int as cartoes_vermelhos
from hr.funcionarios f;

comment on view hr.v_funcionario_situacao is
  'Férias/atestado vigentes hoje e total de cartões — selos do organograma.';

grant select on hr.v_funcionario_rosto to service_role;
grant select on hr.v_funcionario_situacao to service_role;

-- Augusto Berto como sócio executivo. Área ainda não definida.
insert into hr.cadeiras (bar_id, codigo, escopo, cargo_id, ocupante_nome, ordem)
select 3, 'SÓCIO AUGUSTO', 'administrativo',
       (select id from hr.cargos where bar_id=3 and lower(nome)='sócio executivo' limit 1),
       'Augusto Berto', 6
where not exists (select 1 from hr.cadeiras c where c.bar_id=3 and c.codigo='SÓCIO AUGUSTO');
