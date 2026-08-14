-- Desligamento estruturado + promoção x mudança de área
--
-- Ata de 13/08/2026: "adicionar a opção 'demitir pessoa' ali em editar dados... como é a demissão:
-- Pelo funcionário (sem aviso prévio / com aviso prévio -> -2h/dia ou -7 dias) ou Pela Empresa
-- (com justa causa / sem justa causa -> mesma coisa do item anterior). pelo funcionário: conseguir
-- anexar a carta de demissão. pq dai vamos ter no aviso diário: avisos prévio trabalhado".
--
-- Hoje só existem os campos soltos data_demissao/tipo_desligamento/motivo_desligamento em
-- hr.funcionarios, preenchidos pela importação da planilha. Não dá para saber se houve aviso
-- prévio, de que tipo, nem quando ele termina — que é justamente o bloco "Avisos Prévio Trabalhado"
-- da mensagem de segunda (Jheydi 29/07 -> 29/08 com 2h a menos; Alexandre 29/07 -> 22/08 com 7 dias).

create table if not exists hr.desligamentos (
  id uuid primary key default gen_random_uuid(),
  bar_id integer not null,
  funcionario_id integer not null references hr.funcionarios(id) on delete cascade,

  -- de quem partiu
  iniciativa text not null check (iniciativa in ('funcionario', 'empresa')),
  justa_causa boolean not null default false,

  -- aviso prévio
  aviso_previo text not null check (aviso_previo in ('sem', 'trabalhado')),
  -- redução da jornada durante o aviso trabalhado; nulo quando não há aviso
  modalidade text check (modalidade in ('2h_dia', '7_dias')),

  data_comunicacao date not null,
  -- último dia. Padrão = comunicação + 1 mês, menos 7 dias quando a escolha for '7_dias'.
  -- Confere com os dois casos reais da ata (29/07 -> 29/08 e 29/07 -> 22/08).
  data_desligamento date not null,

  documento_id uuid references hr.documentos_funcionario(id) on delete set null,  -- carta
  motivo text,
  observacao text,
  registrado_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  -- justa causa é decisão da empresa; e sem justa causa não existe "demitido por justa causa"
  constraint desligamento_justa_causa_so_empresa
    check (not justa_causa or iniciativa = 'empresa'),
  -- justa causa não tem aviso prévio
  constraint desligamento_justa_causa_sem_aviso
    check (not justa_causa or aviso_previo = 'sem'),
  -- a modalidade só faz sentido no aviso trabalhado, e lá é obrigatória
  constraint desligamento_modalidade_coerente
    check ((aviso_previo = 'trabalhado' and modalidade is not null)
        or (aviso_previo = 'sem' and modalidade is null)),
  constraint desligamento_datas check (data_desligamento >= data_comunicacao)
);

-- Um desligamento aberto por pessoa. Recontratação depois vira outro registro, com o anterior
-- já fechado pela data.
create index if not exists idx_desligamentos_func on hr.desligamentos (funcionario_id, data_desligamento desc);
create index if not exists idx_desligamentos_bar on hr.desligamentos (bar_id, data_desligamento desc);

comment on table hr.desligamentos is
  'Desligamento com iniciativa, justa causa e aviso previo. Aviso trabalhado em aberto alimenta o bloco "Avisos Previo Trabalhado" da ata semanal.';
comment on column hr.desligamentos.modalidade is
  '2h_dia = reducao de 2 horas por dia; 7_dias = sai 7 dias antes (a data_desligamento ja vem descontada).';

grant select, insert, update, delete on hr.desligamentos to service_role;

-- ── Promoção x mudança de área ──────────────────────────────────────────────────────────────
-- A ata: "quando tiver alteração de mudança de area, se a pessoa só mudou de área, ou se a pessoa
-- foi promovida... precisamos registrar se foi só mudança ou se foi promoção e o novo cargo e novo
-- salário, pra gnt manter o histórico todo".
--
-- hr.contratos_funcionario JÁ fecha a vigência e abre outra quando muda salário/cargo/área (ver
-- api/rh/funcionarios/[id]/route.ts). O que falta é dizer O QUE foi a mudança — hoje todo mundo
-- entra como 'Alteração contratual', então o histórico não distingue promoção de realocação.
alter table hr.contratos_funcionario add column if not exists tipo_alteracao text;

comment on column hr.contratos_funcionario.tipo_alteracao is
  'promocao | mudanca_area | reajuste | admissao | outro — o motivo_alteracao segue livre para o texto.';

-- Classifica o que já existe pelo que dá para deduzir com segurança; o resto fica nulo em vez de
-- receber um palpite (promoção mal marcada mancha o histórico que a ata quer preservar).
update hr.contratos_funcionario c
   set tipo_alteracao = case
         when c.motivo_alteracao ilike '%admiss%' then 'admissao'
         when c.motivo_alteracao ilike '%promo%'  then 'promocao'
         when c.motivo_alteracao ilike '%reajust%' or c.motivo_alteracao ilike '%aument%' then 'reajuste'
       end
 where c.tipo_alteracao is null;
