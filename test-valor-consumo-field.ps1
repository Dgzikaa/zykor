# Testar campo valor_consumo
$SUPABASE_URL = "https://uqtgsvujwcbymjmvkjhy.supabase.co"
$SUPABASE_KEY = $env:SUPABASE_SERVICE_ROLE_KEY

$headers = @{
    "apikey" = $SUPABASE_KEY
    "Authorization" = "Bearer $SUPABASE_KEY"
}

Write-Host "`n=== ANÁLISE DO CAMPO valor_consumo - SEMANA 13 ===" -ForegroundColor Cyan

# Buscar registros com motivo_desconto preenchido
$url = "$SUPABASE_URL/rest/v1/visitas?bar_id=eq.3&data_visita=gte.2026-03-23&data_visita=lte.2026-03-29&motivo_desconto=not.is.null&select=motivo_desconto,valor_desconto,valor_produtos,valor_consumo&limit=100"
$response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get

Write-Host "`nPrimeiros 100 registros com motivo_desconto:`n" -ForegroundColor Yellow

# Agrupar por motivo e somar
$grupos = @{}
foreach ($v in $response) {
    $motivo = if ([string]::IsNullOrWhiteSpace($v.motivo_desconto)) { "(VAZIO)" } else { $v.motivo_desconto }
    
    if (-not $grupos.ContainsKey($motivo)) {
        $grupos[$motivo] = @{
            Count = 0
            ValorDesconto = 0
            ValorProdutos = 0
            ValorConsumo = 0
        }
    }
    
    $grupos[$motivo].Count++
    $grupos[$motivo].ValorDesconto += [decimal]$v.valor_desconto
    $grupos[$motivo].ValorProdutos += [decimal]$v.valor_produtos
    $grupos[$motivo].ValorConsumo += [decimal]$v.valor_consumo
}

# Ordenar por count
$gruposOrdenados = $grupos.GetEnumerator() | Sort-Object { $_.Value.Count } -Descending

Write-Host "MOTIVO | QTD | valor_desconto | valor_produtos | valor_consumo" -ForegroundColor Green
Write-Host "=" * 100 -ForegroundColor Gray

foreach ($g in $gruposOrdenados) {
    $motivo = $g.Key
    $count = $g.Value.Count
    $desc = $g.Value.ValorDesconto
    $prod = $g.Value.ValorProdutos
    $cons = $g.Value.ValorConsumo
    
    Write-Host "$motivo ($count registros)" -ForegroundColor White
    Write-Host "  valor_desconto: R$ $($desc.ToString('N2'))" -ForegroundColor Gray
    Write-Host "  valor_produtos: R$ $($prod.ToString('N2'))" -ForegroundColor Gray
    Write-Host "  valor_consumo:  R$ $($cons.ToString('N2'))" -ForegroundColor Cyan
    Write-Host ""
}

# Totais gerais
$totalDesconto = ($response | ForEach-Object { [decimal]$_.valor_desconto } | Measure-Object -Sum).Sum
$totalProdutos = ($response | ForEach-Object { [decimal]$_.valor_produtos } | Measure-Object -Sum).Sum
$totalConsumo = ($response | ForEach-Object { [decimal]$_.valor_consumo } | Measure-Object -Sum).Sum

Write-Host "`n=== TOTAIS (amostra de 100) ===" -ForegroundColor Cyan
Write-Host "Total valor_desconto: R$ $($totalDesconto.ToString('N2'))" -ForegroundColor White
Write-Host "Total valor_produtos: R$ $($totalProdutos.ToString('N2'))" -ForegroundColor White
Write-Host "Total valor_consumo:  R$ $($totalConsumo.ToString('N2'))" -ForegroundColor Green
