-- Migration: Adicionar constraints UNIQUE para permitir UPSERT seguro nas tabelas ContaHub
-- Data: 2026-04-04
-- Objetivo: Substituir DELETE+INSERT por UPSERT para evitar perda de dados

-- ============================================
-- 1. CONTAHUB_ANALITICO
-- ============================================
ALTER TABLE contahub_analitico
ADD CONSTRAINT contahub_analitico_unique
UNIQUE (bar_id, trn_dtgerencial, trn, itm);

-- ============================================
-- 2. CONTAHUB_PAGAMENTOS
-- ============================================
ALTER TABLE contahub_pagamentos
ADD CONSTRAINT contahub_pagamentos_unique
UNIQUE (bar_id, dt_gerencial, trn, vd, pag);

-- ============================================
-- 3. CONTAHUB_TEMPO
-- ============================================
ALTER TABLE contahub_tempo
ADD CONSTRAINT contahub_tempo_unique
UNIQUE (bar_id, data, itm);

-- ============================================
-- 4. CONTAHUB_FATPORHORA
-- ============================================
ALTER TABLE contahub_fatporhora
ADD CONSTRAINT contahub_fatporhora_unique
UNIQUE (bar_id, vd_dtgerencial, hora);

-- ============================================
-- 5. CONTAHUB_PERIODO
-- ============================================
ALTER TABLE contahub_periodo
ADD CONSTRAINT contahub_periodo_unique
UNIQUE (bar_id, dt_gerencial, vd_mesadesc, tipovenda);

-- ============================================
-- 6. CONTAHUB_PRODPORHORA
-- ============================================
ALTER TABLE contahub_prodporhora
ADD CONSTRAINT contahub_prodporhora_unique
UNIQUE (bar_id, data_gerencial, hora, produto_id);

-- ============================================
-- 7. CONTAHUB_CANCELAMENTOS
-- ============================================
ALTER TABLE contahub_cancelamentos
ADD CONSTRAINT contahub_cancelamentos_unique
UNIQUE (bar_id, data, custototal, created_at);
