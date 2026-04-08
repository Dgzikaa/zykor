# Reprocessar semanas 3, 4, 7 e 8 de 2026
$env:SUPABASE_SERVICE_ROLE_KEY = (Get-Content "$PSScriptRoot\..\frontend\.env.local" | Select-String "SUPABASE_SERVICE_ROLE_KEY" | ForEach-Object { $_ -replace ".*=", "" })

$periodos = @(
    @{ inicio = "2026-01-12"; fim = "2026-01-18"; semana = 3 },
    @{ inicio = "2026-01-19"; fim = "2026-01-25"; semana = 4 },
    @{ inicio = "2026-02-09"; fim = "2026-02-15"; semana = 7 },
    @{ inicio = "2026-02-16"; fim = "2026-02-22"; semana = 8 }
)

foreach ($periodo in $periodos) {
    Write-Host "Processando semana $($periodo.semana) ($($periodo.inicio) a $($periodo.fim))..." -ForegroundColor Cyan
    
    $dataInicio = [DateTime]::Parse($periodo.inicio)
    $dataFim = [DateTime]::Parse($periodo.fim)
    
    for ($data = $dataInicio; $data -le $dataFim; $data = $data.AddDays(1)) {
        $dataStr = $data.ToString("yyyy-MM-dd")
        Write-Host "  Processando $dataStr..." -ForegroundColor Gray
        
        $body = @{
            data_date = $dataStr
        } | ConvertTo-Json
        
        try {
            $response = Invoke-WebRequest `
                -Uri "https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-processor" `
                -Method POST `
                -Headers @{
                    "Authorization" = "Bearer $env:SUPABASE_SERVICE_ROLE_KEY"
                    "Content-Type" = "application/json"
                } `
                -Body $body `
                -UseBasicParsing
            
            Write-Host "    OK" -ForegroundColor Green
        } catch {
            Write-Host "    ERRO: $_" -ForegroundColor Red
        }
        
        Start-Sleep -Milliseconds 300
    }
    
    Write-Host "  Recalculando desempenho semana $($periodo.semana)..." -ForegroundColor Yellow
    
    $bodyDesempenho = @{
        bar_id = 3
        ano = 2026
        numero_semana = $periodo.semana
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
            -Body $bodyDesempenho `
            -UseBasicParsing
        
        Write-Host "  Semana $($periodo.semana) recalculada!" -ForegroundColor Green
    } catch {
        Write-Host "  ERRO ao recalcular semana $($periodo.semana): $_" -ForegroundColor Red
    }
    
    Write-Host ""
}

Write-Host "Reprocessamento completo!" -ForegroundColor Green
