-- 2026-06-18 — Alerta de conciliação pendente (Ordinário). Rede de segurança.
-- verificar_conciliacao_pendente(): flaga lançamentos de MÉTODO BANCÁRIO baixados há
-- +10 dias que continuam NÃO conciliados (conciliado=false). Exclui o que é esperado
-- ficar sem conciliar: grupo AJUSTE (consumação/estoque/ajustes) e a categoria
-- "Dinheiro" (recebimento em espécie). Só considera parcelas já verificadas
-- (conciliado_checado_em IS NOT NULL) e só alerta acima de R$ 5.000 — baixo ruído,
-- dispara quando algo de cartão/transferência/pix ficou preso sem conciliar.
-- Posta no Discord (dedup/dia). Cron semanal seg 09:00 BRT:
--   SELECT cron.schedule('alerta-conciliacao-pendente','0 12 * * 1', $$ SELECT public.verificar_conciliacao_pendente(); $$);

CREATE OR REPLACE FUNCTION public.verificar_conciliacao_pendente()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','meta','bronze','extensions','pg_temp'
AS $fn$
DECLARE
  v_bar int := 3; v_data text := current_date::text; v_corte date := current_date - 10;
  v_n int; v_total numeric; v_lista text := ''; r record;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(COALESCE(NULLIF(l.valor_pago,0),l.valor_bruto)),0) INTO v_n, v_total
  FROM bronze.bronze_contaazul_lancamentos l
  JOIN meta.categoria_dfc_map m ON upper(btrim(m.categoria_ca))=upper(btrim(l.categoria_nome))
  WHERE l.bar_id=v_bar AND l.excluido_em IS NULL AND l.conciliado=false AND l.conciliado_checado_em IS NOT NULL
    AND l.data_pagamento IS NOT NULL AND l.data_pagamento <= v_corte
    AND m.grupo_dfc <> 'AJUSTE' AND l.categoria_nome NOT ILIKE 'Dinheiro';
  IF v_total < 5000 THEN RETURN 'OK_SEM_ALERTA'; END IF;
  FOR r IN
    SELECT l.categoria_nome, COUNT(*) n, ROUND(SUM(COALESCE(NULLIF(l.valor_pago,0),l.valor_bruto))::numeric,0) valor
    FROM bronze.bronze_contaazul_lancamentos l
    JOIN meta.categoria_dfc_map m ON upper(btrim(m.categoria_ca))=upper(btrim(l.categoria_nome))
    WHERE l.bar_id=v_bar AND l.excluido_em IS NULL AND l.conciliado=false AND l.conciliado_checado_em IS NOT NULL
      AND l.data_pagamento IS NOT NULL AND l.data_pagamento <= v_corte
      AND m.grupo_dfc <> 'AJUSTE' AND l.categoria_nome NOT ILIKE 'Dinheiro'
    GROUP BY l.categoria_nome ORDER BY valor DESC LIMIT 10
  LOOP
    v_lista := v_lista || format('• %s: %s lanç., R$ %s'||E'\n', r.categoria_nome, r.n, to_char(r.valor,'FM999G999G990'));
  END LOOP;
  RETURN public.enviar_alerta_discord_sistema_dedup(v_bar,'alerta','conciliacao_pendente',
    '🏦 Conciliação pendente (Ordinário) — '||v_data,
    format('**%s** lançamentos (método bancário) baixados há +10 dias ainda **não conciliados** (R$ %s) — vale conciliar:'||E'\n', v_n, to_char(v_total,'FM999G999G990'))||v_lista,
    15844367, 'concil_pend_'||v_data);
END;
$fn$;
