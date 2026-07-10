-- Impostos por CNPJ via XML das NFC-e (reunião Gonza 09/07).
--
-- PROBLEMA: a simulação de impostos rodava numa base ÚNICA por bar, somando os 2 CNPJs
-- do Ordinário (ORDINARIO 57.960.083 + ORDI BAR 59.085.920). Isso distorce o IRPJ — o
-- adicional de 0,8% tem teto de R$ 250k POR CNPJ; somado, cobra adicional sobre base inflada.
-- Cada CNPJ é PJ separada e declara sozinho.
--
-- SOLUÇÃO: 1x/mês sobe-se o XML das NFC-e (o mesmo que vai pra contabilidade). Cada nota tem
-- o CNPJ do emitente (na chave/emit) + NCM/CST por item. Daí sai, POR CNPJ e de verdade:
--   • faturamento NF (soma das notas do CNPJ)
--   • bebida fria (monofásico) = itens com CST de PIS/COFINS ∈ {04,05,06} (revenda monofásica
--     / alíquota zero — cerveja, refri, água, vinho, energético). Melhor que o chute BEBIDA/DRINK.
-- Couvert/gorjeta saem por CNPJ da chave (bronze vendasperiodo) e o Stone por empresa_nome.
-- O parse do XML é no navegador; aqui guardamos só os AGREGADOS (por CNPJ e por NCM).

-- 1) Mapa Stone empresa_nome → CNPJ (pra separar o faturamento Stone por CNPJ)
alter table financial.nf_cnpj_labels add column if not exists stone_empresas text[];

update financial.nf_cnpj_labels set stone_empresas = '{"Ordinário Bar"}'      where bar_id=3 and cnpj_indice=1;
update financial.nf_cnpj_labels set stone_empresas = '{"Ordibar"}'            where bar_id=3 and cnpj_indice=2;
update financial.nf_cnpj_labels set stone_empresas = '{"Deboche (Descubra)"}' where bar_id=4 and cnpj_indice=1;
update financial.nf_cnpj_labels set stone_empresas = '{"DSCBR"}'              where bar_id=4 and cnpj_indice=3;

-- 2) Lote de importação (1 por bar+mês; re-subir SUBSTITUI via delete+insert na API)
create table if not exists financial.nfce_import (
  id uuid primary key default gen_random_uuid(),
  bar_id            integer  not null,
  ano               smallint not null,
  mes               smallint not null,
  competencia       date     not null,           -- último dia do mês (competência)
  arquivo_nome      text,                          -- nome do zip/arquivo enviado
  qtd_notas         integer  not null default 0,
  qtd_canceladas    integer  not null default 0,
  qtd_sem_cnpj      integer  not null default 0,   -- notas cujo CNPJ não bateu em nf_cnpj_labels
  valor_total       numeric(14,2) not null default 0,
  valor_monofasico  numeric(14,2) not null default 0,
  criado_por        text,
  created_at        timestamptz not null default now(),
  unique (bar_id, ano, mes)
);

-- 3) Resumo por CNPJ (o que a base de imposto consome)
create table if not exists financial.nfce_cnpj_resumo (
  id uuid primary key default gen_random_uuid(),
  import_id         uuid not null references financial.nfce_import(id) on delete cascade,
  bar_id            integer  not null,
  ano               smallint not null,
  mes               smallint not null,
  cnpj              text     not null,             -- 14 dígitos (do emitente da nota)
  cnpj_indice       integer,                        -- resolvido via nf_cnpj_labels (null = desconhecido)
  cnpj_label        text,
  faturamento       numeric(14,2) not null default 0,
  valor_monofasico  numeric(14,2) not null default 0,
  qtd_notas         integer  not null default 0
);

-- 4) Resumo por CNPJ×NCM (auditoria/print da contabilidade — quais NCM entraram como bebida fria)
create table if not exists financial.nfce_ncm_resumo (
  id uuid primary key default gen_random_uuid(),
  import_id     uuid not null references financial.nfce_import(id) on delete cascade,
  bar_id        integer  not null,
  ano           smallint not null,
  mes           smallint not null,
  cnpj_indice   integer,
  ncm           text,
  cst_cofins    text,
  monofasico    boolean  not null default false,
  valor         numeric(14,2) not null default 0,
  qtd_itens     integer  not null default 0
);

create index if not exists idx_nfce_cnpj_resumo_bar_comp on financial.nfce_cnpj_resumo(bar_id, ano, mes);
create index if not exists idx_nfce_ncm_resumo_bar_comp  on financial.nfce_ncm_resumo(bar_id, ano, mes);

-- 5) Base de imposto POR CNPJ. Uma linha por CNPJ do bar (de nf_cnpj_labels).
--    faturamento_nf / bebidas_frias: do XML importado (autoritativo); se não houver XML do mês,
--    faturamento_nf cai pro agregado ContaHub por cnpj_indice e bebidas_frias fica 0 (origem_xml=false).
--    couvert/gorjeta: por CNPJ, da chave em bronze vendasperiodo.
--    faturamento_stone: por empresa_nome (nf_cnpj_labels.stone_empresas).
create or replace function public.fn_impostos_base_mensal_cnpj(p_bar integer, p_ano integer, p_mes integer)
returns table(
  cnpj_indice integer, cnpj_label text, cnpj_documento text,
  faturamento_nf numeric, faturamento_stone numeric,
  couvert numeric, gorjeta numeric, bebidas_frias numeric,
  origem_xml boolean
)
language sql stable security definer
set search_path to public, gold, silver, bronze, financial, extensions
as $function$
  with lim as (
    select make_date(p_ano,p_mes,1) d0, (make_date(p_ano,p_mes,1)+interval '1 month')::date d1
  ),
  labels as (
    select l.cnpj_indice, l.label, l.documento,
           regexp_replace(l.documento, '\D', '', 'g') as cnpj14,
           coalesce(l.stone_empresas, '{}') as stone_empresas
    from financial.nf_cnpj_labels l
    where l.bar_id = p_bar
  ),
  nf_ch as (  -- NF agregada por cnpj_indice (fallback quando não há XML)
    select s.cnpj_indice, sum(s.total_autorizado) as v
    from gold.notas_fiscais_diaria s, lim
    where s.bar_id = p_bar and s.data >= lim.d0 and s.data < lim.d1
    group by s.cnpj_indice
  ),
  xml_r as (  -- XML importado (autoritativo)
    select r.cnpj_indice, r.faturamento, r.valor_monofasico
    from financial.nfce_cnpj_resumo r
    where r.bar_id = p_bar and r.ano = p_ano and r.mes = p_mes and r.cnpj_indice is not null
  ),
  cg as (     -- couvert/gorjeta por CNPJ (extraídos da chave)
    select l.cnpj_indice, sum(vp.vd_vrcouvert) as couvert, sum(vp.vd_vrrepique) as gorjeta
    from bronze.bronze_contahub_avendas_vendasperiodo vp
    join lim on true
    join labels l on l.cnpj14 = substring(vp.nf_chaveacesso from 7 for 14)
    where vp.bar_id = p_bar
      and vp.vd_dtgerencial >= lim.d0 and vp.vd_dtgerencial < lim.d1
      and vp.nf_chaveacesso is not null and length(vp.nf_chaveacesso) >= 44
    group by l.cnpj_indice
  ),
  st as (     -- Stone por empresa_nome → cnpj_indice
    select l.cnpj_indice, sum(t.gross_amount) as v
    from silver.stone_transacoes t
    join lim on true
    join labels l on t.empresa_nome = any(l.stone_empresas)
    where t.bar_id = p_bar and t.capture_local_dt is not null
      and (t.capture_local_dt - interval '6 hours')::date >= lim.d0
      and (t.capture_local_dt - interval '6 hours')::date <  lim.d1
    group by l.cnpj_indice
  )
  select
    lb.cnpj_indice, lb.label, lb.documento,
    coalesce(x.faturamento, nf.v, 0)::numeric  as faturamento_nf,
    coalesce(st.v, 0)::numeric                 as faturamento_stone,
    coalesce(cg.couvert, 0)::numeric           as couvert,
    coalesce(cg.gorjeta, 0)::numeric           as gorjeta,
    coalesce(x.valor_monofasico, 0)::numeric   as bebidas_frias,
    (x.cnpj_indice is not null)                as origem_xml
  from labels lb
  left join xml_r x on x.cnpj_indice = lb.cnpj_indice
  left join nf_ch nf on nf.cnpj_indice = lb.cnpj_indice
  left join cg on cg.cnpj_indice = lb.cnpj_indice
  left join st on st.cnpj_indice = lb.cnpj_indice
  order by lb.cnpj_indice;
$function$;
