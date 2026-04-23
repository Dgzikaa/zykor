-- NPS rebuild historico apos correcoes

-- Problema: 1 resposta S16 bar 3 com search_name NULL no bronze.
-- API Falae direta retorna 17 respostas NPS Digital (todas classificadas).
-- Sync pos-migracao bronze atualizou search_name corretamente.
-- Historico limpo (so 1 NULL em abril = registro teste).

-- Rebuild: silver nps_diario + gold desempenho
-- 2025 S48-S52 + 2026 S1-S17 (semanal) + mensal Nov/25-Abr/26

-- Resultado S16 bar 3: nps_digital = 76.47 / 17 respostas
-- Falae web seg-dom = 76.5 / 17 respostas = MATCH
