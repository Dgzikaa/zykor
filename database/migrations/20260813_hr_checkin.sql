-- Check-in do dia: quem realmente veio
--
-- Ata de 13/08/2026: "saber quem foi em cada dia, pelo ponto não resolve 100%, poderia seguir ele +
-- manual, pq as vezes a pessoa não bate ponto... pessoa PJ n bate ponto, pq precisamos registrar os
-- lideres + pjs que não batem ponto... ai vai ter a escalas que vai puxar da operação e vai mostrar
-- as pessoas que tavam escaladas, ai o líder de cada área entraria no zykor e daria o check...
-- as opções: ok, ok atraso, escala errada ou falta. ai ja fazer a ocorrência pra cada pessoa
-- automaticamente qnd marcado falta".
--
-- O ponto (Tangerino) continua sendo a fonte automática e vira a SUGESTÃO; o check do líder é a
-- palavra final, porque é ele que cobre quem não bate ponto.

create table if not exists hr.checkin (
  id uuid primary key default gen_random_uuid(),
  bar_id integer not null,
  funcionario_id integer not null references hr.funcionarios(id) on delete cascade,
  data date not null,
  status text not null check (status in ('ok', 'ok_atraso', 'escala_errada', 'falta')),
  observacao text,
  -- ocorrência criada automaticamente quando o líder marca FALTA; guardada aqui para poder ser
  -- desfeita se ele corrigir a marcação (senão a falta ficaria no histórico da pessoa para sempre)
  ocorrencia_id uuid references hr.funcionario_ocorrencias(id) on delete set null,
  registrado_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (funcionario_id, data)
);

create index if not exists idx_checkin_dia on hr.checkin (bar_id, data);

comment on table hr.checkin is
  'Presenca confirmada pelo lider. Cobre quem nao bate ponto (PJ e lideranca); o ponto entra como sugestao.';
comment on column hr.checkin.status is
  'ok | ok_atraso | escala_errada | falta. Falta gera ocorrencia automatica (ver ocorrencia_id).';

grant select, insert, update, delete on hr.checkin to service_role;

/**
 * Painel do dia: quem estava escalado, o que o ponto diz e o que o líder marcou.
 *
 * Sai da ESCALA (não do ponto), porque a pergunta é "quem deveria estar aqui" — quem não bate ponto
 * some se a lista vier do ponto, que é justamente o buraco que a ata aponta.
 */
create or replace view hr.v_checkin_dia as
select
  e.bar_id,
  e.data,
  e.funcionario_id,
  f.nome,
  f.tipo_contratacao,
  a.nome as area_nome,
  e.turno,
  e.hora_inicio,
  e.hora_fim,
  p.entrada,
  p.saida,
  esp.situacao as ponto_situacao,
  esp.atraso_min,
  c.status as checkin_status,
  c.observacao as checkin_observacao,
  c.registrado_por
from hr.escalas e
join hr.funcionarios f on f.id = e.funcionario_id
left join hr.areas a on a.id = coalesce(e.area_id, f.area_id)
left join hr.ponto_registro p on p.funcionario_id = e.funcionario_id and p.data = e.data
left join hr.v_espelho_ponto esp on esp.funcionario_id = e.funcionario_id and esp.data = e.data
left join hr.checkin c on c.funcionario_id = e.funcionario_id and c.data = e.data;

comment on view hr.v_checkin_dia is
  'Escalados do dia com o que o ponto diz e o que o lider marcou. Base da aba Check-ins.';

grant select on hr.v_checkin_dia to service_role;
