-- 2026-06-23 — Override manual da projeção de Custo de Produção (c_prod_plan).
--
-- Contexto: no /estrategico/planejamento-comercial o usuário podia alterar a
-- previsão de custo artístico (c_artistico_plan, fica amarelo/⚠️ e o real do
-- Conta Azul substitui quando chega), mas NÃO a de produção — e, pior, o edit do
-- bloco REALIZADO gravava no c_art/c_prod REAL, marcando como realizado em vez de
-- projeção. Esta migration cria o espelho de produção e expõe as colunas de
-- projeção na view pública pra o modal ler o valor efetivo.
--
-- Prioridade de exibição (inalterada na lógica, agora também p/ produção):
--   real do Conta Azul (c_art/c_prod) > override manual (c_artistico_plan/c_prod_plan)
--   > projeção automática (c_art_projecao/c_prod_projecao, média 4 semanas).
-- O cron projetar_custos_pre_lancado só mexe nas *_projecao; o override manual
-- sobrevive e o real do CA sempre ganha.

alter table operations.eventos_base
  add column if not exists c_prod_plan numeric;

comment on column operations.eventos_base.c_prod_plan is
  'Override manual da projeção de custo de produção (previsão). Fica abaixo do real (c_prod) e acima da projeção automática (c_prod_projecao). Editável no planejamento comercial.';

-- Recria a view pública adicionando c_prod_plan + as projeções no FINAL da lista
-- (CREATE OR REPLACE VIEW exige manter as colunas existentes na mesma ordem e só
-- permite acrescentar novas ao fim).
create or replace view public.eventos_base as
 SELECT id,
    data_evento,
    dia_semana,
    semana,
    nome,
    artista,
    genero,
    bar_id,
    ativo,
    m1_r,
    cl_plan,
    res_p,
    lot_max,
    te_plan,
    tb_plan,
    c_artistico_plan,
    criado_em,
    atualizado_em,
    real_r,
    cl_real,
    res_tot,
    te_real,
    tb_real,
    t_medio,
    c_art,
    c_prod,
    percent_art_fat,
    percent_b,
    percent_d,
    percent_c,
    t_coz,
    t_bar,
    fat_19h,
    observacoes,
    fat_19h_percent,
    sympla_liquido,
    sympla_checkins,
    yuzer_liquido,
    yuzer_ingressos,
    calculado_em,
    precisa_recalculo,
    versao_calculo,
    faturamento_couvert_manual,
    faturamento_bar_manual,
    faturamento_couvert,
    faturamento_bar,
    te_real_calculado,
    tb_real_calculado,
    nome_evento,
    publico_real,
    faturamento_liquido,
    capacidade_estimada,
    percent_stockout,
    faturamento_entrada_yuzer,
    faturamento_bar_yuzer,
    num_mesas_tot,
    num_mesas_presentes,
    percent_happy_hour,
    atrasinho_cozinha,
    atrasinho_bar,
    atrasao_cozinha,
    atrasao_bar,
    cancelamentos,
    descontos,
    conta_assinada,
    usa_yuzer,
    usa_sympla,
    faturamento_entrada,
    stockout_bebidas_perc,
    stockout_comidas_perc,
    stockout_drinks_perc,
    couvert_vr_contahub,
    c_prod_plan,
    c_art_projecao,
    c_prod_projecao
   FROM operations.eventos_base;
