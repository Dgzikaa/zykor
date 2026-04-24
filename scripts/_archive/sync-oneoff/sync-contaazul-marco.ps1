$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTQ1Mjg3OSwiZXhwIjoyMDQ3MDI4ODc5fQ.JwIXa7tMPOZwKWWcTb-HhFPPHvGvZyRTcWvlpRGqvs8"
}

$body = @{
    bar_id = 3
    sync_mode = "custom"
    date_from = "2026-03-01"
    date_to = "2026-03-31"
} | ConvertTo-Json

Write-Host "Iniciando sincronizacao Conta Azul para marco 2026..."
Write-Host ""

try {
    $response = Invoke-RestMethod `
        -Uri "https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contaazul-sync" `
        -Method Post `
        -Headers $headers `
        -Body $body `
        -TimeoutSec 120

    Write-Host "Sincronizacao concluida com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Resultados:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 5 | Write-Host
} catch {
    Write-Host "Erro na sincronizacao:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.ErrorDetails) {
        Write-Host $_.ErrorDetails.Message
    }
}
