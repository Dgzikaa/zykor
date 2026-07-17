-- Desperdício: adiciona coluna `area` no item pra separar onde ocorreu a perda.
-- Requisitado pelo Diogo (2026-07-17): mostrar desperdício em R$ por dia e agrupado
-- por área na página /operacional/desperdicio.
--
-- Áreas:
--   CozinhaFin  — cozinha, na finalização (prato pronto que caiu)
--   CozinhaProd — cozinha, na produção (errou receita, perdeu recheio/molho)
--   BarFin      — bar, na finalização (drink pronto)
--   BarProd     — bar, na produção (erro no preparo do drink)
--   Salao       — perda no salão (garrafa quebrada, taça, etc.)
-- Nullable pra compat retroativa — registros antigos ficam sem área definida
-- (a UI mostra "sem área" no resumo).

ALTER TABLE operations.desperdicio_registro_item
  ADD COLUMN IF NOT EXISTS area text
    CHECK (area IS NULL OR area IN ('CozinhaFin','CozinhaProd','BarFin','BarProd','Salao'));

COMMENT ON COLUMN operations.desperdicio_registro_item.area IS
  'Área onde o desperdício ocorreu: CozinhaFin (na finalização/prato pronto), CozinhaProd (na produção da cozinha), BarFin (no bar/finalização), BarProd (no bar/produção), Salao. Nullable pra compat retroativa.';
