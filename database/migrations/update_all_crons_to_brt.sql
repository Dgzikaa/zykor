-- =====================================================
-- ATUALIZAR TODOS OS CRON JOBS PARA USAR BRT_TO_UTC_CRON
-- =====================================================
-- Converte todos os horários para usar a função helper
-- que facilita a conversão BRT -> UTC
-- =====================================================

-- Limpeza de logs (2h BRT = 5h UTC)
SELECT cron.alter_job(196, schedule := brt_to_utc_cron(2, 0));

-- Monitor concorrência (6h BRT = 9h UTC)
SELECT cron.alter_job(212, schedule := brt_to_utc_cron(6, 0));

-- Sympla/Yuzer semanal (7h BRT segunda = 10h UTC)
SELECT cron.alter_job(236, schedule := '0 ' || (7+3)::text || ' * * 1');
SELECT cron.alter_job(244, schedule := '0 ' || (5+3)::text || ' * * 1');
SELECT cron.alter_job(245, schedule := '0 ' || (5+3)::text || ' * * 1');

-- ContaHub sync diário (7h e 7h15 BRT = 10h e 10h15 UTC)
SELECT cron.alter_job(238, schedule := brt_to_utc_cron(7, 0));
SELECT cron.alter_job(239, schedule := brt_to_utc_cron(7, 15));

-- ContaHub processor (7h10 e 7h25 BRT = 10h10 e 10h25 UTC)
SELECT cron.alter_job(262, schedule := brt_to_utc_cron(7, 10));
SELECT cron.alter_job(263, schedule := brt_to_utc_cron(7, 25));

-- ContaHub update eventos (7h15 e 7h30 BRT = 10h15 e 10h30 UTC)
SELECT cron.alter_job(264, schedule := brt_to_utc_cron(7, 15));
SELECT cron.alter_job(265, schedule := brt_to_utc_cron(7, 30));

-- ContaHub weekly resync (6h segunda BRT = 9h UTC)
SELECT cron.alter_job(240, schedule := '0 ' || (6+3)::text || ' * * 1');
SELECT cron.alter_job(241, schedule := '30 ' || (6+3)::text || ' * * 1');

-- Stockout (19h e 19h05 BRT = 22h e 22h05 UTC) - JÁ CONFIGURADO
-- SELECT cron.alter_job(242, schedule := brt_to_utc_cron(19, 0));
-- SELECT cron.alter_job(243, schedule := brt_to_utc_cron(19, 5));

-- Nibo sync (10h e 10h15 BRT = 13h e 13h15 UTC)
SELECT cron.alter_job(246, schedule := brt_to_utc_cron(10, 0));
SELECT cron.alter_job(247, schedule := brt_to_utc_cron(10, 15));

-- Alertas proativos (6h e 12h BRT = 9h e 15h UTC)
SELECT cron.alter_job(248, schedule := brt_to_utc_cron(6, 0));
SELECT cron.alter_job(249, schedule := brt_to_utc_cron(12, 0));

-- Relatório matinal Discord (5h BRT = 8h UTC)
SELECT cron.alter_job(250, schedule := brt_to_utc_cron(5, 0));

-- Processar alertas Discord (a cada 30min - não precisa alterar)
-- SELECT cron.alter_job(251, schedule := '*/30 * * * *');

-- Relatório metas semanal (7h segunda BRT = 10h UTC)
SELECT cron.alter_job(252, schedule := '0 ' || (7+3)::text || ' * * 1');

-- Agente análises (6h, 7h segunda, 7h dia 1 BRT)
SELECT cron.alter_job(253, schedule := brt_to_utc_cron(6, 0));
SELECT cron.alter_job(254, schedule := '0 ' || (7+3)::text || ' * * 1');
SELECT cron.alter_job(255, schedule := '0 ' || (7+3)::text || ' 1 * *');

-- Marketing Meta (9h BRT = 12h UTC)
SELECT cron.alter_job(256, schedule := brt_to_utc_cron(9, 0));

-- Sync conhecimento (6h BRT = 9h UTC)
SELECT cron.alter_job(257, schedule := brt_to_utc_cron(6, 0));

-- Sync eventos (7h30 BRT = 10h30 UTC)
SELECT cron.alter_job(258, schedule := brt_to_utc_cron(7, 30));

-- GetIn contínuo (a cada 2h - não precisa alterar)
-- SELECT cron.alter_job(259, schedule := '0 */2 * * *');

-- Sync cliente estatísticas (6h BRT = 9h UTC)
SELECT cron.alter_job(260, schedule := brt_to_utc_cron(6, 0));

-- Google Sheets sync (5h BRT = 8h UTC)
SELECT cron.alter_job(261, schedule := brt_to_utc_cron(5, 0));

-- Agente exploração (6h, 7h segunda, 8h dia 1 BRT)
SELECT cron.alter_job(266, schedule := brt_to_utc_cron(6, 0));
SELECT cron.alter_job(267, schedule := '0 ' || (7+3)::text || ' * * 1');
SELECT cron.alter_job(268, schedule := '0 ' || (8+3)::text || ' 1 * *');

-- CMV semanal auto (8h e 8h15 BRT = 11h e 11h15 UTC)
SELECT cron.alter_job(269, schedule := brt_to_utc_cron(8, 0));
SELECT cron.alter_job(270, schedule := brt_to_utc_cron(8, 15));

-- Recalcular desempenho (3h segunda e 6h diário BRT)
SELECT cron.alter_job(273, schedule := '0 ' || (3+3)::text || ' * * 1');
SELECT cron.alter_job(279, schedule := brt_to_utc_cron(6, 0));

-- Refresh views (0h BRT = 3h UTC)
SELECT cron.alter_job(274, schedule := brt_to_utc_cron(0, 0));
SELECT cron.alter_job(275, schedule := brt_to_utc_cron(0, 0));

-- ContaHub daily sync (5h BRT = 8h UTC)
SELECT cron.alter_job(280, schedule := brt_to_utc_cron(5, 0));

-- GetIn continuous (5h15 BRT = 8h15 UTC)
SELECT cron.alter_job(281, schedule := brt_to_utc_cron(5, 15));

-- Eventos cache refresh (5h30 BRT = 8h30 UTC)
SELECT cron.alter_job(282, schedule := brt_to_utc_cron(5, 30));

-- Eventos cache mês atual (8h, 14h, 20h BRT = 11h, 17h, 23h UTC)
SELECT cron.alter_job(284, schedule := '0 ' || (8+3)::text || ',' || (14+3)::text || ',' || (20+3)::text || ' * * *');

-- Google reviews (9h BRT = 12h UTC)
SELECT cron.alter_job(286, schedule := brt_to_utc_cron(9, 0));

-- =====================================================
-- VERIFICAR RESULTADO
-- =====================================================
SELECT jobid, jobname, schedule FROM cron.job ORDER BY jobid;
