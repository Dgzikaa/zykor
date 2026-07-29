-- 2026-07-29 — Apagar registro de desperdício não corrigia o desvio
--
-- Descoberto ao limpar 12 registros duplicados (ids 38-49, criados 00:59→01:00 por cliques
-- repetidos no Salvar): os itens sumiram, mas operations.desvio_desperdicio_manual continuou
-- com o total inflado — 78 un onde eram 6.
--
-- DUAS FALHAS somadas em operations.fn_sync_desperdicio_para_desvio (trigger do ITEM):
--
--   1. `if v_bar_id is null then return old; end if;  -- cascade, nada a fazer`
--      Ao apagar o REGISTRO, o cascade apaga os itens e o trigger roda — mas o pai já sumiu,
--      então ele desiste. Só que HÁ o que fazer: a soma do (bar, data, insumo) mudou. O item
--      sozinho não sabe mais de que bar/data era, então a correção precisa vir do REGISTRO.
--
--   2. O DELETE de limpeza filtrava `usuario = 'desperdicio-beta'`, que NUNCA casa: o trigger
--      grava em `usuario` o e-mail de quem registrou (o fallback só entra se criado_por é null).
--
-- Impacto real do reparo: 23 linhas corrigidas, e não só do dia da duplicação — 24, 25 e 26/07
-- também estavam dessincronizadas, ou seja, o problema era anterior.
--
-- Cuidado que motivou BEFORE (e não AFTER) DELETE: a tabela desvio_desperdicio_manual também
-- recebe edição manual pelo lápis da tela /operacional/desvios. Em BEFORE os itens ainda
-- existem, então dá pra calcular exatamente o que vai sobrar em vez de adivinhar depois — e só
-- apagamos a linha do insumo que estava no registro sendo apagado.

CREATE OR REPLACE FUNCTION operations.fn_desperdicio_registro_before_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'operations', 'public'
AS $function$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT i.insumo_codigo,
           COALESCE((
             SELECT SUM(i2.qtd)
               FROM operations.desperdicio_registro_item i2
               JOIN operations.desperdicio_registro reg ON reg.id = i2.registro_id
              WHERE reg.bar_id = OLD.bar_id
                AND reg.data   = OLD.data
                AND i2.insumo_codigo = i.insumo_codigo
                AND i2.registro_id <> OLD.id          -- exclui o registro que está sendo apagado
           ), 0) AS qtd_restante
      FROM operations.desperdicio_registro_item i
     WHERE i.registro_id = OLD.id
     GROUP BY i.insumo_codigo
  LOOP
    IF r.qtd_restante > 0 THEN
      UPDATE operations.desvio_desperdicio_manual
         SET qtd = r.qtd_restante, atualizado_em = now()
       WHERE bar_id = OLD.bar_id AND data = OLD.data AND insumo_codigo = r.insumo_codigo;
    ELSE
      DELETE FROM operations.desvio_desperdicio_manual
       WHERE bar_id = OLD.bar_id AND data = OLD.data AND insumo_codigo = r.insumo_codigo;
    END IF;
  END LOOP;

  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_desperdicio_registro_before_delete ON operations.desperdicio_registro;
CREATE TRIGGER trg_desperdicio_registro_before_delete
  BEFORE DELETE ON operations.desperdicio_registro
  FOR EACH ROW EXECUTE FUNCTION operations.fn_desperdicio_registro_before_delete();

-- Reparo do passivo (já executado em 29/07): onde ainda existem itens, a soma deles manda.
-- Mesmo comportamento que o trigger de item já aplica no insert/update.
-- with correto as (
--   select r.bar_id, r.data, i.insumo_codigo, sum(i.qtd) as qtd
--     from operations.desperdicio_registro_item i
--     join operations.desperdicio_registro r on r.id = i.registro_id
--    group by r.bar_id, r.data, i.insumo_codigo
-- )
-- update operations.desvio_desperdicio_manual d
--    set qtd = c.qtd, atualizado_em = now()
--   from correto c
--  where d.bar_id=c.bar_id and d.data=c.data and d.insumo_codigo=c.insumo_codigo and d.qtd <> c.qtd;
