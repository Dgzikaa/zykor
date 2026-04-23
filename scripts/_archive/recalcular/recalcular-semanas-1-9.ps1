# Recalcular semanas 1-9 de 2026 apos correcao retroativa
$env:SUPABASE_SERVICE_ROLE_KEY = (Get-Content "$PSScriptRoot\..\frontend\.env.local" | Select-String "SUPABASE_SERVICE_ROLE_KEY" | ForEach-Object { $_ -replace ".*=", "" })

$semanas = 1..9

foreach ($semana in $semanas) {
    Write-Host "Recalculando semana $semana..." -ForegroundColor Cyan
    
    $body = @{
        bar_id = 3
        ano = 2026
        numero_semana = $semana
        mode = "write"
    } | ConvertTo-Json
    
    try {
        $response = Invoke-WebRequest `
            -Uri "https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/recalcular-desempenho-v2" `
            -Method POST `
            -Headers @{
                "Authorization" = "Bearer $env:SUPABASE_SERVICE_ROLE_KEY"
                "Content-Type" = "application/json"
            } `
            -Body $body `
            -UseBasicParsing
        
        $result = $response.Content | ConvertFrom-Json
        
        if ($result.success) {
            Write-Host "OK Semana $semana" -ForegroundColor Green
        } else {
            Write-Host "ERRO semana $semana" -ForegroundColor Red
        }
    } catch {
        Write-Host "FALHA semana $semana : $_" -ForegroundColor Red
    }
    
    Start-Sleep -Milliseconds 500
}

Write-Host "Concluido!" -ForegroundColor Green
