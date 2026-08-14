-- Liga o usuário do Zykor ao funcionário, para o check-in mostrar só a equipe do líder
--
-- Ata de 13/08/2026: "chefe de fila luan tem que dar check só nas pessoas abaixo dele, meio que tem
-- que ter isso de acordo com o usuario logado... adicionar essa condição de chefe de fila, tbm ao
-- usuario do zykor, pq ai qnd ele entrar em checkins, só vai aparecer as pessoas que ele coordena".
--
-- O usuário do Zykor e o cadastro de RH eram dois mundos sem ponte: não havia como saber que a
-- pessoa logada é a que ocupa a cadeira CHEFE DE FILA.
alter table public.usuarios add column if not exists funcionario_id integer references hr.funcionarios(id) on delete set null;

comment on column public.usuarios.funcionario_id is
  'Quem está logado, no cadastro de RH. Define a equipe que ele vê no check-in (as cadeiras abaixo da dele).';

create index if not exists idx_usuarios_funcionario on public.usuarios (funcionario_id);

-- Casa por e-mail o que der. ⚠️ Só 3 de todos os usuários casaram — o resto precisa de vínculo
-- manual, porque nem todo funcionário tem login e o e-mail do login costuma ser pessoal.
update public.usuarios u
   set funcionario_id = f.id
  from hr.funcionarios f
 where u.funcionario_id is null
   and f.email is not null and u.email is not null
   and lower(trim(f.email)) = lower(trim(u.email));

/**
 * Equipe abaixo de uma pessoa: desce a árvore de CADEIRAS a partir da cadeira que ela ocupa e
 * devolve quem está sentado em cada uma. Inclui a própria pessoa, porque o líder também é escalado.
 *
 * Percorre CADEIRA e não pessoa — é o que faz a equipe continuar certa quando alguém troca de lugar.
 */
create or replace function hr.fn_equipe_do_funcionario(p_funcionario_id integer)
returns table (funcionario_id integer)
language sql
stable
security definer
set search_path to 'hr', 'public'
as $function$
  with recursive minha as (
    select o.cadeira_id from hr.cadeira_ocupacao o
    where o.funcionario_id = p_funcionario_id and o.fim is null
  ),
  abaixo as (
    select c.id from hr.cadeiras c join minha m on c.id = m.cadeira_id
    union all
    select f.id from hr.cadeiras f join abaixo a on f.cadeira_chefe_id = a.id where f.ativa
  )
  select distinct o.funcionario_id
  from abaixo a
  join hr.cadeira_ocupacao o on o.cadeira_id = a.id and o.fim is null;
$function$;

comment on function hr.fn_equipe_do_funcionario(integer) is
  'Funcionários nas cadeiras abaixo (e na própria) de quem ocupa a cadeira dessa pessoa.';

grant execute on function hr.fn_equipe_do_funcionario(integer) to service_role;
