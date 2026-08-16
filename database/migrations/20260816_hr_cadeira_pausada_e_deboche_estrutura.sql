-- CADEIRA PAUSADA + a estrutura real do Deboche (ditada pelo Rodrigo em 16/08/2026).
--
-- ## 1. `pausada`
--
-- O Deboche tem duas posições que existem na estrutura mas NÃO estão sendo preenchidas agora: o
-- Gerente Operacional e um segundo Garçom. O modelo só sabia dizer "ocupada" ou "VAGA", e vaga
-- alimenta `v_cadeiras_vagas` → bloco "Vagas abertas" da ata semanal e o recrutamento. Sem um
-- terceiro estado, congelar uma posição obrigaria a apagar a cadeira — e aí a estrutura mente por
-- omissão (some do organograma) — ou a deixá-la como vaga, e aí o RH persegue uma contratação que
-- ninguém pediu.
--
-- `pausada` mantém a cadeira desenhada (a estrutura é real) e a tira da conta de vagas. A rota de
-- contratação recusa cadeira pausada: contratar nela desfaria a decisão sem ninguém ver.
--
-- ## 2. Deboche
--
-- Antes: 10 cadeiras soltas, sem nenhuma chefia — o organograma não desenhava nada.
--
--   GERENTE OPERACIONAL (pausada)
--     └─ CHEFE DE SALÃO (vaga — é o Edson Júnior, que ainda não tem cadastro)
--          ├─ CAPITÃO DE BAR — Deivid Costa
--          │    └─ BARTENDER — Bárbara
--          ├─ CAPITÃ DE COZINHA — Milene Rodrigues
--          │    ├─ AUXILIAR DE COZINHA 2 (vaga aberta)
--          │    └─ AUXILIAR DE COZINHA 1 — Manu Gomes
--          ├─ GARÇOM — Wallace Maciel
--          ├─ GARÇONETE — Thaís Hígino
--          ├─ AUXILIAR DE COZINHA 3 — Ester Vitória
--          ├─ AUXILIAR DE SERVIÇOS GERAIS 1 — Camylla
--          ├─ GARÇOM 2 (pausada)
--          ├─ COZINHEIRO 1 — Edoardo Cândido      <- não estava na estrutura passada
--          └─ ASSISTENTE DE PRODUÇÃO 1 — Alan Lisboa  <- não estava na estrutura passada
--
-- Decisões que valem registro:
--
-- · Cargos novos no bar 4: "Chefe de Salão", "Capitão de Bar", "Capitã de Cozinha" — o Deboche tinha
--   só os nomes do Ordinário (Chefe de Atendimento/Bar/Cozinha), que não é como a casa fala.
-- · "Garçonete" virou o NOME DA CADEIRA, não um cargo novo. Cargo move dinheiro (faixa salarial,
--   CMO, folha); dois cargos para a mesma função quebrariam o agrupamento em todo relatório. O card
--   mostra o código da cadeira, então na tela lê-se GARÇONETE do mesmo jeito.
-- · Ester Vitória saiu de Barback e virou Auxiliar de Cozinha — mudou a cadeira E o cargo dela.
-- · Deivid e Milene subiram de cadeira; a ocupação anterior foi FECHADA com motivo
--   'reestruturação Deboche' em vez de sobrescrita, para o histórico de quem sentou onde sobreviver.
-- · BARTENDER 2 e COZINHEIRO 2 ficaram vazias depois das promoções e foram desativadas (`ativa=false`),
--   não apagadas.
-- · Edoardo Cândido e Alan Lisboa NÃO estavam na estrutura descrita. Em vez de sumir com eles,
--   ficaram sob o Chefe de Salão com `observacao` pedindo conferência — perder gente do quadro é
--   pior do que pendurar no lugar provisório.

alter table hr.cadeiras add column if not exists pausada boolean not null default false;

comment on column hr.cadeiras.pausada is
  'Cadeira existe na estrutura mas nao esta sendo preenchida agora. Continua no organograma (a estrutura e real) e NAO conta como vaga aberta em hr.v_cadeiras_vagas nem na ata.';

create or replace view hr.v_cadeiras_vagas as
 SELECT c.id AS cadeira_id, c.bar_id, c.codigo, c.cargo_id, cg.nome AS cargo_nome,
    c.area_id, a.nome AS area_nome, c.escopo, c.cadeira_chefe_id,
    ( SELECT max(o2.fim) FROM hr.cadeira_ocupacao o2 WHERE o2.cadeira_id = c.id) AS vaga_desde,
    v.id AS vaga_id, v.status AS vaga_status
   FROM hr.cadeiras c
     LEFT JOIN hr.cadeira_ocupacao o ON o.cadeira_id = c.id AND o.fim IS NULL
     LEFT JOIN hr.cargos cg ON cg.id = c.cargo_id
     LEFT JOIN hr.areas a ON a.id = c.area_id
     LEFT JOIN hr.vagas v ON v.cadeira_id = c.id AND v.status = 'aberta'::text
  WHERE c.ativa AND NOT c.pausada AND o.id IS NULL
    AND COALESCE(btrim(c.ocupante_nome), ''::text) = ''::text;

-- A montagem da árvore do Deboche foi aplicada em 16/08/2026 por bloco DO idempotente-por-execução
-- (cria cargos com ON CONFLICT DO NOTHING, fecha ocupação anterior antes de abrir a nova).
-- Não repetir cegamente: rodar de novo criaria uma segunda CHEFE DE SALÃO.
