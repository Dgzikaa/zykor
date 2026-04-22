-- Fix triggers em meta.desempenho_manual que referenciavam campos dropados
-- Bug: UPDATE/INSERT falhava com 'record "new" has no field "clientes_atendidos"'

-- Trigger 1: calculate_ticket_medio
-- Referenciava NEW.clientes_atendidos e NEW.faturamento_total (dropados)
-- Fix: removido calculo de ticket_medio (agora vem do Gold)
-- Mantido: atingimento zerado (faturamento_total nao existe mais no meta)

-- Trigger 2: validar_ano_desempenho
-- Referenciava NEW.ano_sistema (dropado na Onda 1)
-- Fix: removida linha NEW.ano_sistema := ano_atual
-- Mantido: validacao de ano/semana/bar_regras_negocio

-- Testado: UPDATE meta.desempenho_manual SET cmo = 5.5 WHERE bar_id=3 AND ano=2026 AND numero_semana=16
-- Resultado: sucesso (id=673)
