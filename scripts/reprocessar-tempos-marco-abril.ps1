# Script para reprocessar dados de tempo de março e abril 2026
# Chama o contahub-processor para cada dia

$env:SUPABASE_SERVICE_ROLE_KEY = (Get-Content frontend\.env.local | Select-String "SUPABASE_SERVICE_ROLE_KEY" | ForEach-Object { $_ -replace ".*=", "" })

$dataInicio = Get-Date "2026-03-01"
$dataFim = Get-Date "2026-04-07"
$currentDate = $dataInicio

Write-Host "Reprocessando tempos de $($dataInicio.ToString('yyyy-MM-dd')) a $($dataFim.ToString('yyyy-MM-dd'))"

$sucessos = 0
$erros = 0

while ($currentDate -le $dataFim) {
    $dateStr = $currentDate.ToString("yyyy-MM-dd")
    
    Write-Host "`nProcessando $dateStr..." -ForegroundColor Cyan
    
    try {
        $response = Invoke-WebRequest `
            -Uri "https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-processor" `
            -Method POST `
            -Headers @{
                "Authorization" = "Bearer $env:SUPABASE_SERVICE_ROLE_KEY"
                "Content-Type" = "application/json"
            } `
            -Body "{`"data_date`": `"$dateStr`", `"bar_id`": 3, `"data_types`": [`"tempo`"]}" `
            -TimeoutSec 120 `
            -UseBasicParsing
        
        $result = $response.Content | ConvertFrom-Json
        
        if ($result.success) {
            Write-Host "OK $dateStr processado com sucesso" -ForegroundColor Green
            $sucessos++
        } else {
            Write-Host "AVISO $dateStr processado com avisos" -ForegroundColor Yellow
            $erros++
        }
        
        # Pequeno delay para não sobrecarregar
        Start-Sleep -Milliseconds 500
        
    } catch {
        Write-Host "ERRO ao processar $dateStr : $_" -ForegroundColor Red
        $erros++
    }
    
    $currentDate = $currentDate.AddDays(1)
}

Write-Host "`nResumo:"
Write-Host "Sucessos: $sucessos"
Write-Host "Erros: $erros"
Write-Host "Total: $($sucessos + $erros) dias"
