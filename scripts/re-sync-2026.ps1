# Script para re-sincronizar dados de 2026 do ContaHub
# Executa a coleta retroativa para todos os meses de 2026

$baseUrl = "http://localhost:3001"
$apiUrl = "$baseUrl/api/contahub/coletar-retroativo"

Write-Host "🔄 Iniciando re-sincronização de dados 2026..." -ForegroundColor Cyan

# Janeiro 2026
Write-Host "`n📅 Coletando Janeiro 2026..." -ForegroundColor Yellow
$body = @{
    start_date = "2026-01-01"
    end_date = "2026-01-31"
    bar_id = 3
    force_recollect = $true
    data_types = @("periodo", "pagamentos", "analitico", "fatporhora", "tempo")
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri $apiUrl -Method POST -Body $body -ContentType "application/json"
Write-Host "✅ Janeiro: $($response.success_count) sucessos, $($response.error_count) erros" -ForegroundColor Green

# Fevereiro 2026
Write-Host "`n📅 Coletando Fevereiro 2026..." -ForegroundColor Yellow
$body = @{
    start_date = "2026-02-01"
    end_date = "2026-02-28"
    bar_id = 3
    force_recollect = $true
    data_types = @("periodo", "pagamentos", "analitico", "fatporhora", "tempo")
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri $apiUrl -Method POST -Body $body -ContentType "application/json"
Write-Host "✅ Fevereiro: $($response.success_count) sucessos, $($response.error_count) erros" -ForegroundColor Green

# Março 2026
Write-Host "`n📅 Coletando Março 2026..." -ForegroundColor Yellow
$body = @{
    start_date = "2026-03-01"
    end_date = "2026-03-31"
    bar_id = 3
    force_recollect = $true
    data_types = @("periodo", "pagamentos", "analitico", "fatporhora", "tempo")
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri $apiUrl -Method POST -Body $body -ContentType "application/json"
Write-Host "✅ Março: $($response.success_count) sucessos, $($response.error_count) erros" -ForegroundColor Green

# Abril 2026 (até dia 09)
Write-Host "`n📅 Coletando Abril 2026..." -ForegroundColor Yellow
$body = @{
    start_date = "2026-04-01"
    end_date = "2026-04-09"
    bar_id = 3
    force_recollect = $true
    data_types = @("periodo", "pagamentos", "analitico", "fatporhora", "tempo")
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri $apiUrl -Method POST -Body $body -ContentType "application/json"
Write-Host "✅ Abril: $($response.success_count) sucessos, $($response.error_count) erros" -ForegroundColor Green

Write-Host "`n🎉 Re-sincronização concluída!" -ForegroundColor Cyan
Write-Host "📝 Próximo passo: Processar os dados raw" -ForegroundColor Yellow
