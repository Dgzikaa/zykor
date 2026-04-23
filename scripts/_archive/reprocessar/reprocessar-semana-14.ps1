$env:SUPABASE_SERVICE_ROLE_KEY = (Get-Content frontend\.env.local | Select-String "SUPABASE_SERVICE_ROLE_KEY" | ForEach-Object { $_ -replace ".*=", "" })

$datas = @("2026-03-30", "2026-03-31", "2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04", "2026-04-05")

Write-Host "Reprocessando semana 14..."

foreach ($data in $datas) {
    Write-Host "Processando $data..."
    
    $response = Invoke-WebRequest `
        -Uri "https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-processor" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $env:SUPABASE_SERVICE_ROLE_KEY"
            "Content-Type" = "application/json"
        } `
        -Body "{`"data_date`": `"$data`", `"bar_id`": 3, `"data_types`": [`"tempo`"]}" `
        -TimeoutSec 120 `
        -UseBasicParsing
    
    Write-Host "OK $data"
    Start-Sleep -Milliseconds 500
}

Write-Host "`nConcluido!"
