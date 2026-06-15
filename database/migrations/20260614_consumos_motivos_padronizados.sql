-- 2026-06-14 — Consumação: motivos padronizados do ContaHub como match EXATO prioritário.
-- O sócio padronizou os motivos de consumação no ContaHub. Adicionamos cada um como
-- regra de prioridade máxima (1) em financial.consumos_keywords, ganhando de todas as
-- regras fuzzy existentes (prioridade >= 5). O fuzzy CONTINUA como fallback pro histórico
-- de texto livre (não perde classificação antiga).
--
-- De-para (motivo padrão -> categoria CMV):
--   Sócios -> socios | Funcionário Operação -> funcionarios_operacao
--   Funcionário Escritório -> funcionarios_escritorio | Artistas -> artistas
--   Aniversário / Programa de Pontos / Benefício Cliente / Influencer / Relacionamento -> clientes
--
-- Patterns em minúsculo/sem acento (o classificador faz unaccent+lower dos 2 lados).
-- Após aplicar: get_consumos_classificados_semana classifica os 5 grupos e o "sem
-- categoria" de jun/2026 caiu p/ ~R$240 (bar3) / R$784 (bar4). CMV mensal recalculado.

INSERT INTO financial.consumos_keywords (bar_id, categoria, pattern, prioridade, ativo) VALUES
(NULL,'socios','socios',1,true),
(NULL,'funcionarios_operacao','funcionario operacao',1,true),
(NULL,'funcionarios_escritorio','funcionario escritorio',1,true),
(NULL,'artistas','artistas',1,true),
(NULL,'clientes','aniversario',1,true),
(NULL,'clientes','programa de pontos',1,true),
(NULL,'clientes','beneficio cliente',1,true),
(NULL,'clientes','influencer',1,true),
(NULL,'clientes','relacionamento',1,true);
