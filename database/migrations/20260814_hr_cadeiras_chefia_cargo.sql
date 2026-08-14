-- Amarra as cadeiras de chefia ao cargo correspondente.
--
-- As cadeiras "CHEFE DE ..." e "GERENTE OPERACIONAL" foram criadas na mão pelo organograma e
-- ficaram com cargo_id nulo. Os cargos existiam (Chefe de Atendimento, Chefe de Bar, Chefe de
-- Cumins, Chefe de Fila, Chefe de Cozinha, Chefe de Limpeza/Infra) — só não estavam ligados.
--
-- Sem cargo, o recrutamento por cadeira não sabe a que quadro a cadeira pertence, e justamente a
-- vaga que o dono cita como exemplo ("como sei que tem 1 cadeira vaga que é a chefe de
-- atendimento?") ficava de fora do processo seletivo.
--
-- Já aplicada no banco em 14/08/2026 (bar 3).

update hr.cadeiras c
set cargo_id = g.id,
    area_id = coalesce(c.area_id, g.area_id),
    atualizado_em = now()
from hr.cargos g
where c.cargo_id is null
  and g.bar_id = c.bar_id
  and g.ativo
  and upper(g.nome) = upper(c.codigo);
