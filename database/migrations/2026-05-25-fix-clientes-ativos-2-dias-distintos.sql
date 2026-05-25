-- Fix: cliente ativo = 2+ DIAS DISTINTOS nos últimos 90 dias (não 2+ comandas)
-- ============================================================================
-- Contexto:
-- Definição confirmada pelo sócio (Rodrigo, 2026-05-25):
--   - Visita = cada comanda aberta (1 comanda = 1 visita)
--   - Cliente ativo = telefone normalizado com 2+ DIAS DISTINTOS nos últimos 90 dias
--   - Se abrir 2 comandas no mesmo dia, NÃO conta como ativo (raro, mas precisa ignorar)
--
-- Bug atual:
-- `database/functions/get_count_base_ativa.sql:21` usa HAVING COUNT(*) >= 2 (2+ comandas)
-- em vez de HAVING COUNT(DISTINCT data_visita) >= 2 (2+ dias distintos).
--
-- Impacto medido em 24/05/2026 (bar 3, 90 dias):
--   - 5559 ativos pela regra atual
--   - 5395 ativos pela regra correta (diferença de 164 clientes = 3%)
--   - 164 clientes vinham só 1 dia mas abriam 2+ comandas naquela visita
--
-- Em abril/2026 o número chegou a 32809 (diagnóstico S14). A tabela visitas
-- tinha 233K registros vs 45K atual em 90 dias. Algum reset/fix mudou cardinalidade,
-- vale investigar separadamente.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_count_base_ativa(p_bar_id integer, p_data_inicio date, p_data_fim date)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT COUNT(DISTINCT cliente_fone)
  INTO v_count
  FROM (
    SELECT cliente_fone, COUNT(DISTINCT data_visita) as dias_distintos
    FROM public.visitas
    WHERE bar_id = p_bar_id
      AND data_visita >= p_data_inicio
      AND data_visita <= p_data_fim
      AND cliente_fone IS NOT NULL
      AND LENGTH(cliente_fone) >= 8
    GROUP BY cliente_fone
    HAVING COUNT(DISTINCT data_visita) >= 2
  ) AS clientes_ativos;

  RETURN COALESCE(v_count, 0);
END;
$function$;

COMMENT ON FUNCTION public.get_count_base_ativa(integer, date, date) IS
  'Conta clientes ativos no período: telefones com visitas em 2+ dias distintos. Fix 2026-05-25: antes contava 2+ comandas (HAVING COUNT(*)), agora conta 2+ dias distintos (HAVING COUNT(DISTINCT data_visita)). Definição validada com sócio.';
