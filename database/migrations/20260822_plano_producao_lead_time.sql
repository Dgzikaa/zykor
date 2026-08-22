-- Lead time no Plano de Produção: dias entre a CONTAGEM e a PRODUÇÃO (22/08/2026, Mafê).
--
-- Mafê, depois de seguir o plano à risca por duas semanas pra isolar o problema: "tenho a hipótese
-- que a planilha calcula de segunda a domingo, mas o cronograma de produção do bar inicia na quarta
-- e vai até a terça seguinte, e isso pode estar dando números irreais". Está certa.
--
-- `fn_plano_producao` usa como estoque a contagem da SEGUNDA, e o PR responde "quanto preciso ter
-- para a semana". Isso embute lead time ZERO — só fecha se a produção acontecer no dia da contagem.
-- O bar produz quarta, quinta ou sexta; não existe UMA produção na segunda ou terça em todo o
-- histórico do pd0026. Os dias entre a contagem e a produção consomem o estoque que o plano contou
-- como disponível.
--
-- PROVA (bar 3, PD0026, semana de 10/08/2026, snapshot do próprio plano):
--   média6 18,83 · desvpad 3,84 · PR 25,15 · estoque contado (seg 10/08) 17,80
--   sugestão 6 receitas = 8,28 L · decidido 6 · seguiu_sugestao = TRUE
--   dia_producao 14/08 — uma SEXTA, 4 dias depois da contagem
--   consumo real da semana 26,20 L → estoque na segunda seguinte: 0,40 L (zerou)
-- Em 4 dias já tinham gasto ~12 L dos 17,80. A folga de segurança do PR (3,84 × 1,645 = 6,3 L) é
-- MENOR que a defasagem. Some antes de a semana começar — por isso falta mesmo seguindo o plano.
--
-- A conta certa cobre da produção até a produção seguinte:
--   PR = média_semanal × (7 + dias_ate_produzir)/7 + desvpad × z
-- Com lead 4 naquela semana: 18,83 × 11/7 + 6,32 = 35,9 L → 14 receitas. Fecha.
--
-- O desvio padrão NÃO é escalado pelo lead (a rigor seria × sqrt((7+L)/7)). Fica a folga semanal
-- crua: é conservador na direção certa e continua explicável pra quem produz, que é o que faz o
-- plano ser seguido. Trocar por sqrt depois é uma linha.

alter table operations.producao_plano_config
  add column if not exists dias_ate_produzir smallint not null default 0;

do $$ begin
  alter table operations.producao_plano_config add constraint producao_plano_config_lead_ck
    check (dias_ate_produzir >= 0 and dias_ate_produzir <= 14);
exception when duplicate_object then null; end $$;

comment on column operations.producao_plano_config.dias_ate_produzir is
  'Dias entre a contagem (segunda) e o dia em que a producao acontece de fato. PR = media x (7+dias)/7 + desvpad x z.';

-- Semana encerrada congela o lead usado, igual às outras colunas de snapshot.
alter table operations.producao_plano_item
  add column if not exists dias_ate_produzir smallint;
