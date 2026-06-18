-- 2026-06-18 — Protege conciliado de ser sobrescrito pelo sync do Conta Azul (GRAVE).
-- O contaazul-sync gravava `conciliado = item.conciliado || false` no upsert; como o
-- endpoint de LISTA não traz conciliação, vinha sempre false e ZERAVA o que a função
-- contaazul-conciliacao preenche (a conciliação real, via /parcelas/{id}). A cada sync
-- o backfill de conciliação era apagado silenciosamente.
--
-- Correções:
-- 1) Trigger BEFORE UPDATE bronze.fn_preserva_conciliado: se o UPDATE não mexeu no
--    conciliado_checado_em (=> é sync, não a fn de conciliação que bumpa o carimbo),
--    preserva conciliado/conciliado_checado_em. Só a conciliação altera de verdade.
-- 2) contaazul-sync (edge) deixou de enviar `conciliado` no payload (defesa em profundidade).
-- 3) Auditoria (fn_log_contaazul_lancamento_change) passa a registrar mudança de conciliado
--    (evento 'CONCILIADO' quando é só isso) — não-conciliado -> conciliado fica rastreado.

CREATE OR REPLACE FUNCTION bronze.fn_preserva_conciliado()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.conciliado_checado_em IS NOT DISTINCT FROM OLD.conciliado_checado_em THEN
    NEW.conciliado := OLD.conciliado;
    NEW.conciliado_checado_em := OLD.conciliado_checado_em;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_preserva_conciliado ON bronze.bronze_contaazul_lancamentos;
CREATE TRIGGER trg_preserva_conciliado
BEFORE UPDATE ON bronze.bronze_contaazul_lancamentos
FOR EACH ROW EXECUTE FUNCTION bronze.fn_preserva_conciliado();

-- (fn_log_contaazul_lancamento_change atualizada em prod p/ incluir conciliado — ver
--  20260618_auditoria_fase1_historico_contaazul.sql + esta nota.)
