-- 20260602_drop_funcoes_mortas_fidelidade_retrospectiva.sql
--
-- Burn-down do lint (R3): remove funcoes plpgsql mortas que referenciavam tabelas
-- inexistentes (features removidas). Decisao do dono confirmada.
--   - Fidelidade/clube QR (tabelas fidelidade_membros/fidelidade_transacoes nunca existiram)
--   - Retrospectiva 2025 (sazonal, fora de uso; frontend removido junto)
--   - Watchdog duplicado morto (verificar_saude_desempenho_auto; o ativo e o _v2)

-- Fidelidade (QR)
DROP FUNCTION IF EXISTS public.aplicar_desconto_qr(character varying,numeric,uuid,integer);
DROP FUNCTION IF EXISTS public.consultar_qr_fidelidade(character varying,integer,uuid,inet);
DROP FUNCTION IF EXISTS public.creditar_mensalidade_automatica();
DROP FUNCTION IF EXISTS public.processar_pagamento_aprovado(uuid,numeric,numeric);
DROP FUNCTION IF EXISTS public.processar_transacao_fidelidade(uuid,numeric,character varying,text,uuid,integer,character varying);

-- Watchdog duplicado morto (referenciava desempenho_semanal; ativo e verificar_saude_desempenho_v2_alerta_discord)
DROP FUNCTION IF EXISTS public.verificar_saude_desempenho_auto_alerta_discord();

-- Retrospectiva 2025 (frontend removido: app/retrospectiva-2025, app/api/retrospectiva-2025, components/retrospectiva, hooks/useNewYearDetector)
DROP FUNCTION IF EXISTS public.get_retrospectiva_2025(integer);
DROP FUNCTION IF EXISTS public.get_retrospectiva_clientes_mes(integer);
DROP FUNCTION IF EXISTS public.get_retrospectiva_completa(integer);
DROP FUNCTION IF EXISTS public.get_retrospectiva_evolucao_mensal(integer);
DROP FUNCTION IF EXISTS public.get_retrospectiva_top_produtos(integer,integer);
DROP FUNCTION IF EXISTS public.get_retrospectiva_vendas_categoria(integer);

-- Lint baixou de 25 -> 13 funcoes quebradas. Restantes (drift-fixaveis + 2 bugs) no
-- scripts/.db-lint-baseline.json para burn-down incremental.
