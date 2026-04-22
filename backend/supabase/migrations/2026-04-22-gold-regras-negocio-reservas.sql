-- =====================================================
-- GOLD: Regras de Neg\u00f3cio - Reservas Getin
-- =====================================================
--
-- REGRAS DE NEGOCIO DEFINIDAS:
--
-- PRESENTES (compareceram):
--   - seated: confirmou presen\u00e7a no sistema
--   - pending: veio mas esqueceu de dar OK
--   - confirmed: veio mas esqueceu de dar OK
--
-- NAO PRESENTES (n\u00e3o compareceram):
--   - no-show: faltou
--   - canceled-user: cliente cancelou
--   - canceled-agent: casa cancelou
--
-- F\u00d3RMULAS:
--   presentes_qtd = seated + pending + confirmed
--   nao_presentes_qtd = no-show + canceled-user + canceled-agent
--   taxa_quebra = (nao_presentes / total) * 100
--   taxa_comparecimento = (presentes / total) * 100
--

-- Atualizar dados S16 com regras corretas (exemplo/teste)
-- Resultado: 88 reservas, 80 presentes (90.91%), 8 n\u00e3o presentes (9.09% quebra)

COMMENT ON COLUMN gold.desempenho.reservas_presentes_quantidade IS 
'Reservas PRESENTES = seated + pending + confirmed (regra de neg\u00f3cio: pending/confirmed s\u00e3o considerados presentes)';

COMMENT ON COLUMN gold.desempenho.reservas_quebra_pct IS 
'Taxa de quebra = (no-show + canceladas) / total * 100';
