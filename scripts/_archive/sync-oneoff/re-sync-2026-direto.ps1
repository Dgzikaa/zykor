# Script para re-sincronizar dados de 2026 do ContaHub
# Chama a edge function contahub-sync-automatico diretamente

$supabaseUrl = "https://uqtgsvujwcbymjmvkjhy.supabase.co"
$edgeFunctionUrl = "$supabaseUrl/functions/v1/contahub-sync-automatico"

# Ler service role key do .env
$envPath = "c:\Projects\zykor\frontend\.env.local"
$serviceKey = (Get-Content $envPath | Where-Object { $_ -match "SUPABASE_SERVICE_ROLE_KEY=" }) -replace "SUPABASE_SERVICE_ROLE_KEY=", ""

Write-Host "Re-sincronizacao de dados 2026 do ContaHub" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Gerar lista de datas de 01/01/2026 a 09/04/2026
$startDate = Get-Date "2026-01-01"
$endDate = Get-Date "2026-04-09"
$currentDate = $startDate
$totalDias = ($endDate - $startDate).Days + 1
$contador = 0
$sucessos = 0
$erros = 0

Write-Host "Total de dias a processar: $totalDias" -ForegroundColor Yellow
Write-Host ""

while ($currentDate -le $endDate) {
    $contador++
    $dataStr = $currentDate.ToString("yyyy-MM-dd")
    $percentual = [math]::Round(($contador / $totalDias) * 100, 1)
    
    Write-Host "[$contador/$totalDias - $percentual%] Processando $dataStr..." -ForegroundColor Cyan
    
    try {
        $body = @{
            bar_id = 3
            data_date = $dataStr
            automated = $false
            source = "manual-resync-2026"
        } | ConvertTo-Json
        
        $headers = @{
            "Authorization" = "Bearer $serviceKey"
            "Content-Type" = "application/json"
        }
        
        $response = Invoke-RestMethod -Uri $edgeFunctionUrl -Method POST -Body $body -Headers $headers -TimeoutSec 120
        
        if ($response.success) {
            Write-Host "  OK - $($response.total_records_collected) registros coletados" -ForegroundColor Green
            $sucessos++
        } else {
            Write-Host "  ERRO - $($response.error)" -ForegroundColor Red
            $erros++
        }
    }
    catch {
        Write-Host "  ERRO - $($_.Exception.Message)" -ForegroundColor Red
        $erros++
    }
    
    # Aguardar 5 segundos entre requisicoes (evitar rate limit)
    Start-Sleep -Seconds 5
    
    $currentDate = $currentDate.AddDays(1)
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Re-sincronizacao concluida!" -ForegroundColor Cyan
Write-Host "Sucessos: $sucessos" -ForegroundColor Green
Write-Host "Erros: $erros" -ForegroundColor Red
Write-Host ""
Write-Host "Proximo passo: Processar os dados raw" -ForegroundColor Yellow
