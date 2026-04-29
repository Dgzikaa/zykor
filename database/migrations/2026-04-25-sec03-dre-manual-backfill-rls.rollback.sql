-- Rollback de 2026-04-25-sec03-dre-manual-backfill-rls.sql.
--
-- ⚠️⚠️⚠️ ATENÇÃO ⚠️⚠️⚠️
-- ESTE ROLLBACK RE-ABRE 2 BURACOS:
--   1. RLS volta pra qual aberta auth.uid() IS NOT NULL — qualquer
--      authenticated pode ler/escrever em dre_manual sem filtro de bar.
--   2. CHECK constraint removida — INSERT com bar_id=NULL volta a passar
--      mesmo após o cutoff de 2025-09-08, contaminando o histórico com
--      mais rows legacy NULL.
--
-- Combinado: re-abre o vazamento cross-tenant + permite criar novas rows
-- "globais" sem bar (que apareceriam pra todos via OR da policy original
-- pre-sec/02, mas agora a policy de dre_manual já tinha sido tornada
-- estrita em sec/02 via auth.uid() IS NOT NULL — então o estado pré-sec/03
-- é menos permissivo que o pré-sec/02).
--
-- Reverte para o estado imediatamente posterior ao sec/02 (PR #15) e
-- anterior ao sec/03.
--
-- SÓ EXECUTAR ESTE ROLLBACK SE:
--   1. A migration forward causou regressão funcional confirmada por
--      smoke-test, E
--   2. Existe plano de re-fix imediato (horas, não dias).

-- ============================================
-- Reverter Layer 2: drop CHECK constraint
-- ============================================
ALTER TABLE financial.dre_manual
  DROP CONSTRAINT IF EXISTS dre_manual_bar_id_required_after_cutoff;

-- ============================================
-- Reverter Layer 1: ALTER POLICY de volta pro estado pre-sec/03.
-- Estado original confirmado em pg_policies (2026-04-25):
--   cmd=ALL, roles={public}
--   qual = (((SELECT (SELECT auth.uid() AS uid) AS uid) IS NOT NULL))
--   with_check = NULL (Postgres usa USING como WITH CHECK por default)
--
-- Sec/02 (PR #15) NAO tocou em dre_manual — estado original = pos-sec/02.
--
-- NOTA: o with_check abaixo e setado explicitamente com a mesma expressao
-- do USING. Funcionalmente identico ao estado original (with_check NULL
-- + cmd=ALL faz Postgres usar USING como check em INSERT/UPDATE), mas
-- visualmente pg_policies vai mostrar with_check com expressao em vez de
-- NULL. Diferenca cosmetica — comportamento e equivalente.
-- ============================================
ALTER POLICY "dre_manual_policy" ON "financial"."dre_manual"
  USING (((select auth.uid()) IS NOT NULL))
  WITH CHECK (((select auth.uid()) IS NOT NULL));
