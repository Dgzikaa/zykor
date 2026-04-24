# Script para sincronizar ORDINÁRIO (bar_id=3) completo
# De 01/03/2025 até 09/04/2026

$serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0"
$url = "https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-sync-automatico"
$barId = 3

# Datas: 01/03/2025 a 09/04/2026
$startDate = Get-Date "2025-03-01"
$endDate = Get-Date "2026-04-09"

$totalDays = ($endDate - $startDate).Days + 1
$currentDay = 0
$successCount = 0
$errorCount = 0

Write-Host "🚀 Iniciando sincronização ORDINÁRIO (bar_id=$barId)" -ForegroundColor Cyan
Write-Host "📅 Período: $($startDate.ToString('dd/MM/yyyy')) a $($endDate.ToString('dd/MM/yyyy'))" -ForegroundColor Cyan
Write-Host "📊 Total de dias: $totalDays" -ForegroundColor Cyan
Write-Host ""

$currentDate = $startDate
while ($currentDate -le $endDate) {
    $currentDay++
    $dateStr = $currentDate.ToString("yyyy-MM-dd")
    $progress = [math]::Round(($currentDay / $totalDays) * 100, 1)
    
    Write-Host "[$currentDay/$totalDays - $progress%] Sincronizando $dateStr..." -NoNewline
    
    try {
        $body = @{
            bar_id = $barId
            data_date = $dateStr
        } | ConvertTo-Json
        
        $headers = @{
            "Content-Type" = "application/json"
            "Authorization" = "Bearer $serviceKey"
        }
        
        $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body -ErrorAction Stop
        
        Write-Host " ✅ OK" -ForegroundColor Green
        $successCount++
    }
    catch {
        Write-Host " ❌ ERRO: $($_.Exception.Message)" -ForegroundColor Red
        $errorCount++
    }
    
    # Próximo dia
    $currentDate = $currentDate.AddDays(1)
    
    # Delay de 5 segundos entre requisições (tempo para processar)
    Start-Sleep -Seconds 5
    
    # A cada 10 dias, mostrar resumo
    if ($currentDay % 10 -eq 0) {
        Write-Host ""
        Write-Host "📈 Progresso: $successCount sucessos, $errorCount erros" -ForegroundColor Yellow
        Write-Host ""
    }
}

Write-Host ""
Write-Host "✨ Sincronização concluída!" -ForegroundColor Green
Write-Host "✅ Sucessos: $successCount" -ForegroundColor Green
Write-Host "❌ Erros: $errorCount" -ForegroundColor Red
Write-Host "📊 Total: $totalDays dias" -ForegroundColor Cyan
