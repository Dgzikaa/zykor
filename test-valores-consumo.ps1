# Script para entender estrutura dos valores
$SUPABASE_URL = "https://uqtgsvujwcbymjmvkjhy.supabase.co"
$SUPABASE_KEY = $env:SUPABASE_SERVICE_ROLE_KEY

$headers = @{
    "apikey" = $SUPABASE_KEY
    "Authorization" = "Bearer $SUPABASE_KEY"
}

Write-Host "`n=== ANÁLISE DE VALORES - SEMANA 13 ===" -ForegroundColor Cyan

# Buscar registros com motivo preenchido
$url = "$SUPABASE_URL/rest/v1/visitas?bar_id=eq.3&data_visita=gte.2026-03-23&data_visita=lte.2026-03-29&motivo_desconto=not.is.null&select=motivo_desconto,valor_desconto,valor_produtos&limit=50"
$response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get

Write-Host "`nPrimeiros 50 registros com motivo_desconto preenchido:`n" -ForegroundColor Yellow

foreach ($v in $response) {
    $motivo = if ([string]::IsNullOrWhiteSpace($v.motivo_desconto)) { "(vazio)" } else { $v.motivo_desconto }
    $desconto = [decimal]$v.valor_desconto
    $produtos = [decimal]$v.valor_produtos
    $total = $desconto + $produtos
    
    Write-Host "Motivo: $motivo" -ForegroundColor White
    Write-Host "  valor_desconto: R$ $($desconto.ToString('N2'))" -ForegroundColor Gray
    Write-Host "  valor_produtos: R$ $($produtos.ToString('N2'))" -ForegroundColor Gray
    Write-Host "  TOTAL: R$ $($total.ToString('N2'))" -ForegroundColor $(if ($total -gt 0) { "Green" } else { "Red" })
    Write-Host ""
}

# Estatísticas
Write-Host "`n=== ESTATÍSTICAS ===" -ForegroundColor Cyan
$comDesconto = ($response | Where-Object { [decimal]$_.valor_desconto -gt 0 }).Count
$comProdutos = ($response | Where-Object { [decimal]$_.valor_produtos -gt 0 }).Count
$comAmbos = ($response | Where-Object { [decimal]$_.valor_desconto -gt 0 -and [decimal]$_.valor_produtos -gt 0 }).Count
$semValor = ($response | Where-Object { ([decimal]$_.valor_desconto + [decimal]$_.valor_produtos) -eq 0 }).Count

Write-Host "Registros com valor_desconto > 0: $comDesconto" -ForegroundColor White
Write-Host "Registros com valor_produtos > 0: $comProdutos" -ForegroundColor White
Write-Host "Registros com ambos > 0: $comAmbos" -ForegroundColor White
Write-Host "Registros com valor ZERO: $semValor" -ForegroundColor Red
