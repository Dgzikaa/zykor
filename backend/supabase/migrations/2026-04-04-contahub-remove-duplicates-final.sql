-- Migration: Remover duplicatas e adicionar constraints UNIQUE para UPSERT seguro
-- Data: 2026-04-04
-- Objetivo: Limpar duplicatas existentes e prevenir novas duplicatas
-- IMPORTANTE: Desabilita temporariamente triggers de proteção para limpeza única

-- ============================================
-- DESABILITAR TRIGGERS DE PROTEÇÃO
-- ============================================
ALTER TABLE contahub_analitico DISABLE TRIGGER proteger_delete;
ALTER TABLE contahub_pagamentos DISABLE TRIGGER proteger_delete;
ALTER TABLE contahub_tempo DISABLE TRIGGER proteger_delete;
ALTER TABLE contahub_fatporhora DISABLE TRIGGER proteger_delete;
ALTER TABLE contahub_periodo DISABLE TRIGGER proteger_delete;
ALTER TABLE contahub_prodporhora DISABLE TRIGGER proteger_delete;
ALTER TABLE contahub_cancelamentos DISABLE TRIGGER proteger_delete;

-- ============================================
-- 1. CONTAHUB_ANALITICO
-- ============================================
DELETE FROM contahub_analitico a
USING contahub_analitico b
WHERE a.id < b.id
  AND a.bar_id = b.bar_id
  AND a.trn_dtgerencial = b.trn_dtgerencial
  AND a.trn = b.trn
  AND a.itm = b.itm;

ALTER TABLE contahub_analitico
ADD CONSTRAINT contahub_analitico_unique
UNIQUE (bar_id, trn_dtgerencial, trn, itm);

-- ============================================
-- 2. CONTAHUB_PAGAMENTOS
-- ============================================
DELETE FROM contahub_pagamentos a
USING contahub_pagamentos b
WHERE a.id < b.id
  AND a.bar_id = b.bar_id
  AND a.dt_gerencial = b.dt_gerencial
  AND a.trn = b.trn
  AND a.vd = b.vd
  AND a.pag = b.pag;

ALTER TABLE contahub_pagamentos
ADD CONSTRAINT contahub_pagamentos_unique
UNIQUE (bar_id, dt_gerencial, trn, vd, pag);

-- ============================================
-- 3. CONTAHUB_TEMPO
-- ============================================
DELETE FROM contahub_tempo a
USING contahub_tempo b
WHERE a.id < b.id
  AND a.bar_id = b.bar_id
  AND a.data = b.data
  AND a.itm = b.itm;

ALTER TABLE contahub_tempo
ADD CONSTRAINT contahub_tempo_unique
UNIQUE (bar_id, data, itm);

-- ============================================
-- 4. CONTAHUB_FATPORHORA
-- ============================================
DELETE FROM contahub_fatporhora a
USING contahub_fatporhora b
WHERE a.id < b.id
  AND a.bar_id = b.bar_id
  AND a.vd_dtgerencial = b.vd_dtgerencial
  AND a.hora = b.hora;

ALTER TABLE contahub_fatporhora
ADD CONSTRAINT contahub_fatporhora_unique
UNIQUE (bar_id, vd_dtgerencial, hora);

-- ============================================
-- 5. CONTAHUB_PERIODO
-- ============================================
DELETE FROM contahub_periodo a
USING contahub_periodo b
WHERE a.id < b.id
  AND a.bar_id = b.bar_id
  AND a.dt_gerencial = b.dt_gerencial
  AND a.vd_mesadesc = b.vd_mesadesc
  AND a.tipovenda = b.tipovenda;

ALTER TABLE contahub_periodo
ADD CONSTRAINT contahub_periodo_unique
UNIQUE (bar_id, dt_gerencial, vd_mesadesc, tipovenda);

-- ============================================
-- 6. CONTAHUB_PRODPORHORA
-- ============================================
DELETE FROM contahub_prodporhora a
USING contahub_prodporhora b
WHERE a.id < b.id
  AND a.bar_id = b.bar_id
  AND a.data_gerencial = b.data_gerencial
  AND a.hora = b.hora
  AND a.produto_id = b.produto_id;

ALTER TABLE contahub_prodporhora
ADD CONSTRAINT contahub_prodporhora_unique
UNIQUE (bar_id, data_gerencial, hora, produto_id);

-- ============================================
-- 7. CONTAHUB_CANCELAMENTOS
-- ============================================
DELETE FROM contahub_cancelamentos a
USING contahub_cancelamentos b
WHERE a.id < b.id
  AND a.bar_id = b.bar_id
  AND a.data = b.data
  AND a.custototal = b.custototal
  AND a.created_at = b.created_at;

ALTER TABLE contahub_cancelamentos
ADD CONSTRAINT contahub_cancelamentos_unique
UNIQUE (bar_id, data, custototal, created_at);

-- ============================================
-- REABILITAR TRIGGERS DE PROTEÇÃO
-- ============================================
ALTER TABLE contahub_analitico ENABLE TRIGGER proteger_delete;
ALTER TABLE contahub_pagamentos ENABLE TRIGGER proteger_delete;
ALTER TABLE contahub_tempo ENABLE TRIGGER proteger_delete;
ALTER TABLE contahub_fatporhora ENABLE TRIGGER proteger_delete;
ALTER TABLE contahub_periodo ENABLE TRIGGER proteger_delete;
ALTER TABLE contahub_prodporhora ENABLE TRIGGER proteger_delete;
ALTER TABLE contahub_cancelamentos ENABLE TRIGGER proteger_delete;
