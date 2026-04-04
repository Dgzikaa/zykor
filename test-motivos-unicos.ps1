# Script simples para ver motivos únicos
$SUPABASE_URL = "https://uqtgsvujwcbymjmvkjhy.supabase.co"
$SUPABASE_KEY = $env:SUPABASE_SERVICE_ROLE_KEY

$headers = @{
    "apikey" = $SUPABASE_KEY
    "Authorization" = "Bearer $SUPABASE_KEY"
}

Write-Host "`n=== MOTIVOS ÚNICOS - SEMANA 13 ===" -ForegroundColor Cyan

# Buscar amostra de 1000 registros
$url = "$SUPABASE_URL/rest/v1/visitas?bar_id=eq.3&data_visita=gte.2026-03-23&data_visita=lte.2026-03-29&motivo_desconto=not.is.null&select=motivo_desconto,valor_desconto,valor_produtos&limit=1000"
$response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get

Write-Host "Amostra de $($response.Count) registros`n" -ForegroundColor Yellow

# Agrupar por motivo
$grupos = $response | Group-Object -Property motivo_desconto | Sort-Object Count -Descending

Write-Host "Top 30 motivos mais frequentes:" -ForegroundColor Green
$grupos | Select-Object -First 30 | ForEach-Object {
    $valorTotal = ($_.Group | ForEach-Object { [decimal]$_.valor_desconto + [decimal]$_.valor_produtos } | Measure-Object -Sum).Sum
    $motivo = if ([string]::IsNullOrWhiteSpace($_.Name)) { "(VAZIO)" } else { $_.Name }
    Write-Host "$($_.Count) registros - '$motivo' = R$ $($valorTotal.ToString('N2'))"
}
