# Script para executar sync manual do ContaHub
# Uso: .\hotfix-sync-manual.ps1

# Verificar se a variável de ambiente existe
if (-not $env:SUPABASE_SERVICE_ROLE_KEY) {
    Write-Host "❌ ERRO: Variável SUPABASE_SERVICE_ROLE_KEY não encontrada" -ForegroundColor Red
    Write-Host ""
    Write-Host "Configure a variável de ambiente com:" -ForegroundColor Yellow
    Write-Host '  $env:SUPABASE_SERVICE_ROLE_KEY = "sua-chave-aqui"' -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Ou obtenha a chave em:" -ForegroundColor Yellow
    Write-Host "  https://supabase.com/dashboard/project/uqtgsvujwcbymjmvkjhy/settings/api" -ForegroundColor Cyan
    exit 1
}

$url = "https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-sync-automatico"
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $env:SUPABASE_SERVICE_ROLE_KEY"
}

# Sync Bar 3
Write-Host "🔄 Executando sync para Bar 3 (data: 2026-04-04)..." -ForegroundColor Cyan
$body3 = @{
    bar_id = 3
    data_date = "2026-04-04"
    source = "hotfix-manual"
} | ConvertTo-Json

try {
    $response3 = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body3
    Write-Host "✅ Bar 3: Sync concluído" -ForegroundColor Green
    Write-Host ($response3 | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "❌ Bar 3: Erro no sync" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

Write-Host ""
Write-Host "⏳ Aguardando 30 segundos antes do próximo sync..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Sync Bar 4
Write-Host "🔄 Executando sync para Bar 4 (data: 2026-04-04)..." -ForegroundColor Cyan
$body4 = @{
    bar_id = 4
    data_date = "2026-04-04"
    source = "hotfix-manual"
} | ConvertTo-Json

try {
    $response4 = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body4
    Write-Host "✅ Bar 4: Sync concluído" -ForegroundColor Green
    Write-Host ($response4 | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "❌ Bar 4: Erro no sync" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

Write-Host ""
Write-Host "✅ Processo concluído!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Para validar os dados, execute no Supabase SQL Editor:" -ForegroundColor Yellow
Write-Host @"
SELECT bar_id, dt_gerencial::date as data, count(*) as comandas, sum(vr_pagamentos) as faturamento
FROM contahub_periodo
WHERE dt_gerencial::date = '2026-04-04'
GROUP BY bar_id, dt_gerencial::date;
"@ -ForegroundColor Cyan
