# Teste local da lógica de consumos atualizada
$SUPABASE_URL = "https://uqtgsvujwcbymjmvkjhy.supabase.co"
$SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0"

$headers = @{
    "apikey" = $SERVICE_KEY
    "Authorization" = "Bearer $SERVICE_KEY"
    "Content-Type" = "application/json"
}

Write-Host "`n=== TESTE: Buscar contahub_analitico ===" -ForegroundColor Cyan

$uri = "$SUPABASE_URL/rest/v1/contahub_analitico?bar_id=eq.3&trn_dtgerencial=gte.2026-03-23&trn_dtgerencial=lte.2026-03-29&desconto=gt.0&select=vd_mesadesc,desconto&limit=5"

try {
    $response = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get
    Write-Host "✅ Sucesso! Registros encontrados: $($response.Count)" -ForegroundColor Green
    $response | Format-Table -AutoSize
} catch {
    Write-Host "❌ Erro: $_" -ForegroundColor Red
}

Write-Host "`n=== TESTE: Buscar contahub_periodo ===" -ForegroundColor Cyan

$uri2 = "$SUPABASE_URL/rest/v1/contahub_periodo?bar_id=eq.3&dt_gerencial=gte.2026-03-23&dt_gerencial=lte.2026-03-29&motivo=not.is.null&select=vd_mesadesc,motivo&limit=5"

try {
    $response2 = Invoke-RestMethod -Uri $uri2 -Headers $headers -Method Get
    Write-Host "✅ Sucesso! Registros encontrados: $($response2.Count)" -ForegroundColor Green
    $response2 | Format-Table -AutoSize
} catch {
    Write-Host "❌ Erro: $_" -ForegroundColor Red
}
