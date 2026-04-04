---
name: never_delete_contahub_data
description: NUNCA deletar dados das tabelas ContaHub - base de clientes é crítica para o negócio
type: feedback
---

NUNCA executar DELETE em tabelas do ContaHub ou dados de clientes. Todas as tabelas são histórico permanente desde a abertura do bar.

**Why:** Em 2026-03-23, a função `purgar_staging_antigo` (que rodava semanalmente via cron) estava deletando dados com +90 dias do contahub_periodo, destruindo o histórico de clientes. Isso quebrou a Lista Quente e os números de segmentação. A purga foi desabilitada e triggers de proteção foram criados para bloquear DELETEs.

**How to apply:**
- Tabelas protegidas: contahub_periodo, contahub_analitico, contahub_tempo, contahub_pagamentos, contahub_fatporhora, visitas, cliente_estatisticas
- Triggers `proteger_delete` bloqueiam qualquer DELETE nessas tabelas
- Nunca sugerir ou executar DELETE/TRUNCATE nesses dados
- Se precisar "limpar" algo, perguntar ao usuário primeiro — dados de clientes são a base do negócio
