# Script para sincronizar ContaHub de março e abril 2026

$url = "https://jqcxlxhqbvvfxuhtvyfa.supabase.co/functions/v1/sync-dispatcher"
$key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxY3hseGhxYnZ2Znh1aHR2eWZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTU3MjY0MCwiZXhwIjoyMDUxMTQ4NjQwfQ.s7wZKH_kqmkp-LkQvNNlqWfJhECOdJQYEkHPjXx3LJQ"

Write-Host "🔄 Sincronizando ContaHub - Março 2026..." -ForegroundColor Cyan

$body = @{
    source = "contahub"
    bar_id = 3
    date_from = "2026-03-01"
    date_to = "2026-03-31"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri $url -Method Post -Headers @{
    "Authorization" = "Bearer $key"
    "Content-Type" = "application/json"
} -Body $body

Write-Host "✅ Março concluído!" -ForegroundColor Green
$response | ConvertTo-Json

Start-Sleep -Seconds 5

Write-Host "`n🔄 Sincronizando ContaHub - Abril 2026..." -ForegroundColor Cyan

$body = @{
    source = "contahub"
    bar_id = 3
    date_from = "2026-04-01"
    date_to = "2026-04-30"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri $url -Method Post -Headers @{
    "Authorization" = "Bearer $key"
    "Content-Type" = "application/json"
} -Body $body

Write-Host "✅ Abril concluído!" -ForegroundColor Green
$response | ConvertTo-Json

Write-Host "`n✅ Sincronização completa!" -ForegroundColor Green
