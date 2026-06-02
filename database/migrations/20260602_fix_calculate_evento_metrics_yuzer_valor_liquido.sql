-- 20260602_fix_calculate_evento_metrics_yuzer_valor_liquido.sql
--
-- BUG (regressao silenciosa, meses): public.calculate_evento_metrics referenciava
-- integrations.yuzer_pagamento.valor_pago / valor_bruto — colunas que NAO existem
-- (a tabela tem valor_liquido). A query do Yuzer roda para TODO evento (o WHERE so
-- filtra por data/bar), entao a coluna inexistente quebrava o recalculo de QUALQUER
-- evento — mesmo sem evento Yuzer (que e raro; o padrao e tudo ContaHub).
--
-- Efeito: auto_recalculo_eventos_pendentes (cron 300, 11:30 diario) chamava
-- calculate_evento_metrics dentro de BEGIN/EXCEPTION WHEN OTHERS -> erro engolido,
-- precisa_recalculo ficava TRUE pra sempre e c_art / real_r / etc. nao atualizavam.
-- Backlog encontrado: bar 3 desde 25/05, bar 4 desde 02/02. Sintoma reportado:
-- custo de atracao (c_art, vindo do Conta Azul) nao refletia no /estrategico/desempenho.
--
-- FIX: usar valor_liquido (valor liquido do Yuzer) nos 2 SELECTs. Aplicado in-place
-- sobre a definicao deployada (versao 27 -> 28) para evitar drift, ja que a versao
-- viva nao correspondia a nenhum arquivo do repo.

DO $do$
DECLARE src text;
BEGIN
  SELECT pg_get_functiondef('public.calculate_evento_metrics(integer)'::regprocedure) INTO src;
  IF position('COALESCE(SUM(COALESCE(NULLIF(valor_pago,0), valor_bruto)), 0)' IN src) = 0 THEN
    RAISE NOTICE 'anchor do yuzer nao encontrado (ja corrigido?) — nada a fazer';
    RETURN;
  END IF;
  src := replace(src,
    'COALESCE(SUM(COALESCE(NULLIF(valor_pago,0), valor_bruto)), 0)',
    'COALESCE(SUM(valor_liquido), 0)');
  src := replace(src, 'versao_calculo = 27', 'versao_calculo = 28');
  EXECUTE src;
END $do$;

-- Limpa o backlog acumulado (recalcula todos os eventos pendentes):
SELECT * FROM public.auto_recalculo_eventos_pendentes('migration-fix-yuzer');

-- Propaga para a tabela agregada que a tela /estrategico/desempenho consome:
SELECT executar_recalculo_desempenho_v2();
