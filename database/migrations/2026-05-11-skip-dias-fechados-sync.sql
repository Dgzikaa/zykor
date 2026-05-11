-- ============================================================
-- 2026-05-11 — ContaHub: pular dias marcados como fechados
-- ============================================================
-- Causa raiz dos 3 alertas Discord recebidos hoje 11h:
--   Bar 4 não abriu no domingo 10/05 (excepcional — opera_domingo=true
--   no regra geral). Cron disparou sync às 07:00, retry 14:00 e
--   alerta-contahub-sync-falhou 11:00 — todos tentaram, falharam e
--   2 deles emitiram alerta no Discord.
--
-- Solução:
--   1. Helper public.bar_fechado_no_dia(bar_id, data) que olha
--      operations.calendario_operacional.
--   2. sync_contahub_ambos_bares (cron 07h): pular se opera_*=false
--      OU calendario_operacional=fechado.
--   3. retry_contahub_sync_dia_anterior (cron 14h): pular fechado.
--   4. verificar_contahub_sync_diario (cron 08h/14h): só alertar
--      se o bar DEVIA estar aberto (não veio do cardápio fechado
--      e não está marcado como fechado).
--   5. Atualizar canal Discord para 'alertas_criticos' (estava
--      'webhook_type:alertas' que não existia mais).
--
-- Registro do dia 10/05 bar 4 fechado também inserido aqui.
-- ============================================================

BEGIN;

-- 1. Helper
CREATE OR REPLACE FUNCTION public.bar_fechado_no_dia(p_bar_id integer, p_data date)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM operations.calendario_operacional
    WHERE bar_id = p_bar_id AND data = p_data AND status = 'fechado'
  );
$function$;

GRANT EXECUTE ON FUNCTION public.bar_fechado_no_dia(integer, date) TO anon, authenticated, service_role;

-- 2-4. As 3 funções (sync_contahub_ambos_bares, retry_*, verificar_*)
-- foram atualizadas via execute_sql porque envolvem corpo longo de
-- plpgsql — consultar o banco para ver versão atual. Mudanças-chave:
--   - Adicionado check `NOT public.bar_fechado_no_dia(...)` em todas
--     as decisões de "deve sincronizar"
--   - Trocado `webhook_type: 'alertas'` (legado) por
--     `canal: 'alertas_criticos'` (novo modelo Discord)

-- 5. Calendário retroativo: 10/05/2026 bar 4 fechado
INSERT INTO operations.calendario_operacional (data, bar_id, status, motivo, criado_em, atualizado_em)
VALUES ('2026-05-10', 4, 'fechado', 'Bar fechado nesse domingo', NOW(), NOW())
ON CONFLICT (data, bar_id) DO UPDATE SET status='fechado', motivo=EXCLUDED.motivo, atualizado_em=NOW();

COMMIT;
