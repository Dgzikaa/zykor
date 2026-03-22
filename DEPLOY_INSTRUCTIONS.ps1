# ═══════════════════════════════════════════════════════════════════════════════
# DEPLOY SCRIPT - ZYKOR CAMADAS 1-5
# Execute este script passo a passo
# ═══════════════════════════════════════════════════════════════════════════════

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "PASSO 1: Verificando estrutura de arquivos..." -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

# Verificar migrations
$migrations = @(
    "database\migrations\add_tempo_limite_columns.sql",
    "database\migrations\20260321_hc2_stockout_exclusions_config.sql",
    "database\migrations\20260321_hc3_horas_media_visita.sql",
    "database\migrations\20260321_hc4_bar_artistas.sql",
    "database\migrations\20260321_add_cron_analise_diaria_v2.sql"
)

foreach ($m in $migrations) {
    if (Test-Path $m) {
        Write-Host "[OK] $m" -ForegroundColor Green
    } else {
        Write-Host "[FALTA] $m" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "PASSO 2: Edge Functions a deployar..." -ForegroundColor Cyan  
Write-Host "===============================================" -ForegroundColor Cyan

$functions = @(
    "backend\supabase\functions\agente-dispatcher",
    "backend\supabase\functions\recalcular-desempenho-v2",
    "backend\supabase\functions\alertas-dispatcher",
    "backend\supabase\functions\cmv-semanal-auto"
)

foreach ($f in $functions) {
    if (Test-Path $f) {
        Write-Host "[OK] $f" -ForegroundColor Green
    } else {
        Write-Host "[FALTA] $f" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Yellow
Write-Host "COMANDOS PARA EXECUTAR NO SUPABASE SQL EDITOR:" -ForegroundColor Yellow
Write-Host "===============================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Executar migrations na ordem:" -ForegroundColor White
Write-Host "   - add_tempo_limite_columns.sql" -ForegroundColor Gray
Write-Host "   - 20260321_hc2_stockout_exclusions_config.sql" -ForegroundColor Gray
Write-Host "   - 20260321_hc3_horas_media_visita.sql" -ForegroundColor Gray
Write-Host "   - 20260321_hc4_bar_artistas.sql" -ForegroundColor Gray
Write-Host "   - 20260321_add_cron_analise_diaria_v2.sql" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Executar functions SQL:" -ForegroundColor White
Write-Host "   - calcular_atrasos_tempo.sql" -ForegroundColor Gray
Write-Host "   - calcular_tempo_saida.sql" -ForegroundColor Gray
Write-Host "   - calculate_evento_metrics.sql" -ForegroundColor Gray
Write-Host "   - calcular_real_r.sql" -ForegroundColor Gray
Write-Host "   - get_clientes_fieis_ano.sql" -ForegroundColor Gray
Write-Host "   - update_eventos_base_from_contahub_batch.sql" -ForegroundColor Gray
Write-Host "   - processar_eventos_mes.sql" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Executar views SQL:" -ForegroundColor White
Write-Host "   - view_visao_geral_trimestral.sql" -ForegroundColor Gray
Write-Host "   - view_visao_geral_anual.sql" -ForegroundColor Gray
Write-Host "   - view_top_produtos.sql" -ForegroundColor Gray
Write-Host "   - cliente_visitas.sql" -ForegroundColor Gray
Write-Host ""

Write-Host "===============================================" -ForegroundColor Yellow
Write-Host "COMANDOS PARA DEPLOY EDGE FUNCTIONS:" -ForegroundColor Yellow
Write-Host "===============================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "cd backend\supabase" -ForegroundColor White
Write-Host "npx supabase functions deploy agente-dispatcher --no-verify-jwt" -ForegroundColor White
Write-Host "npx supabase functions deploy recalcular-desempenho-v2 --no-verify-jwt" -ForegroundColor White
Write-Host "npx supabase functions deploy alertas-dispatcher --no-verify-jwt" -ForegroundColor White
Write-Host "npx supabase functions deploy cmv-semanal-auto --no-verify-jwt" -ForegroundColor White
Write-Host ""

Write-Host "===============================================" -ForegroundColor Yellow
Write-Host "VALIDACAO SQL (executar no Supabase):" -ForegroundColor Yellow
Write-Host "===============================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "-- Verificar tabela bar_artistas" -ForegroundColor Gray
Write-Host "SELECT table_name FROM information_schema.tables WHERE table_name = 'bar_artistas';" -ForegroundColor White
Write-Host ""
Write-Host "-- Verificar colunas tempo_limite" -ForegroundColor Gray
Write-Host "SELECT column_name FROM information_schema.columns WHERE table_name = 'bar_regras_negocio' AND column_name LIKE 'tempo_limite%';" -ForegroundColor White
Write-Host ""
Write-Host "-- Verificar cron jobs" -ForegroundColor Gray
Write-Host "SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'analise-diaria%';" -ForegroundColor White
Write-Host ""

