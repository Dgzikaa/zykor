# Script para testar classificação de consumos - Semana 13 (23/03 a 29/03)
$SUPABASE_URL = "https://uqtgsvujwcbymjmvkjhy.supabase.co"
$SUPABASE_KEY = $env:SUPABASE_SERVICE_ROLE_KEY

$headers = @{
    "apikey" = $SUPABASE_KEY
    "Authorization" = "Bearer $SUPABASE_KEY"
    "Content-Type" = "application/json"
}

Write-Host "`n=== TESTE DE CONSUMOS - SEMANA 13 (23/03 a 29/03) ===" -ForegroundColor Cyan
Write-Host "Bar: Ordinário (ID 3)" -ForegroundColor Yellow

# Buscar todas as visitas com desconto/consumo na semana 13
$url = "$SUPABASE_URL/rest/v1/visitas?bar_id=eq.3&data_visita=gte.2026-03-23&data_visita=lte.2026-03-29&motivo_desconto=not.is.null&select=data_visita,motivo_desconto,valor_desconto,valor_produtos"

Write-Host "`nBuscando visitas com consumo..." -ForegroundColor Gray
$response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get

Write-Host "`nTotal de registros encontrados: $($response.Count)" -ForegroundColor Green

# Definir padrões (mesmos do código)
$PADROES_SOCIOS = @('sócios', 'socios', 'socio', 'sócio', 'x-socio', 'x-sócio', 'gonza', 'corbal', 'diogo', 'cadu', 'augusto', 'rodrigo', 'digao', 'vinicius', 'vini', 'bueno', 'kaizen', 'caisen', 'joão pedro', 'joao pedro', 'jp', '3v', 'cantucci')
$PADROES_CLIENTES = @('aniver', 'anivers', 'aniversário', 'aniversario', 'aniversariante', 'niver', 'voucher', 'benefício', 'beneficio', 'mesa mágica', 'mágica', 'influencer', 'influ', 'influencia', 'influência', 'club', 'clube', 'midia', 'mídia', 'social', 'insta', 'digital', 'cliente', 'ambev', 'promoção', 'chegadeira')
$PADROES_ARTISTAS = @('musico', 'músicos', 'dj', 'banda', 'artista', 'breno', 'benza', 'stz', 'zelia', 'tia', 'samba', 'sambadona', 'doze', 'boca', 'boka', 'pé', 'chão', 'segunda', 'resenha', 'pagode', 'roda', 'reconvexa', 'rodie', 'roudier', 'roudi', 'som', 'técnico', 'tecnico', 'pv', 'paulo victor', 'prod')
$PADROES_FUNCIONARIOS = @('funcionários', 'funcionario', 'rh', 'financeiro', 'fin', 'mkt', 'marketing', 'slu', 'adm', 'administrativo', 'prêmio', 'confra')

function Classificar-Motivo {
    param($motivo)
    $m = $motivo.ToLower()
    
    foreach ($p in $PADROES_SOCIOS) {
        if ($m -like "*$($p.ToLower())*") { return "SOCIOS" }
    }
    foreach ($p in $PADROES_ARTISTAS) {
        if ($m -like "*$($p.ToLower())*") { return "ARTISTAS" }
    }
    foreach ($p in $PADROES_FUNCIONARIOS) {
        if ($m -like "*$($p.ToLower())*") { return "FUNCIONARIOS" }
    }
    foreach ($p in $PADROES_CLIENTES) {
        if ($m -like "*$($p.ToLower())*") { return "CLIENTES" }
    }
    return "NAO_CLASSIFICADO"
}

# Classificar e somar
$totais = @{
    SOCIOS = 0
    CLIENTES = 0
    ARTISTAS = 0
    FUNCIONARIOS = 0
    NAO_CLASSIFICADO = 0
}

$detalhes = @{
    SOCIOS = @()
    CLIENTES = @()
    ARTISTAS = @()
    FUNCIONARIOS = @()
    NAO_CLASSIFICADO = @()
}

foreach ($visita in $response) {
    $categoria = Classificar-Motivo -motivo $visita.motivo_desconto
    $valor = [decimal]$visita.valor_desconto + [decimal]$visita.valor_produtos
    $totais[$categoria] += $valor
    $detalhes[$categoria] += [PSCustomObject]@{
        Data = $visita.data_visita
        Motivo = $visita.motivo_desconto
        Valor = $valor
    }
}

Write-Host "`n=== RESUMO POR CATEGORIA ===" -ForegroundColor Cyan
Write-Host "Consumo Sócios:       R$ $($totais.SOCIOS.ToString('N2'))" -ForegroundColor $(if ($totais.SOCIOS -gt 0) { "Green" } else { "Red" })
Write-Host "Consumo Clientes:     R$ $($totais.CLIENTES.ToString('N2'))" -ForegroundColor $(if ($totais.CLIENTES -gt 0) { "Green" } else { "Red" })
Write-Host "Consumo Artistas:     R$ $($totais.ARTISTAS.ToString('N2'))" -ForegroundColor $(if ($totais.ARTISTAS -gt 0) { "Green" } else { "Red" })
Write-Host "Consumo Funcionários: R$ $($totais.FUNCIONARIOS.ToString('N2'))" -ForegroundColor $(if ($totais.FUNCIONARIOS -gt 0) { "Green" } else { "Red" })
Write-Host "Não Classificados:    R$ $($totais.NAO_CLASSIFICADO.ToString('N2'))" -ForegroundColor $(if ($totais.NAO_CLASSIFICADO -gt 0) { "Yellow" } else { "Gray" })

Write-Host "`n=== VALORES ESPERADOS (PLANILHA) ===" -ForegroundColor Cyan
Write-Host "Consumo Sócios:       R$ 3.099,47" -ForegroundColor White
Write-Host "Consumo Benefícios:   R$ 4.323,80" -ForegroundColor White
Write-Host "Consumo Artista:      R$ 10.970,80" -ForegroundColor White
Write-Host "Consumo RH Operação:  R$ 846,38" -ForegroundColor White

# Mostrar detalhes dos não classificados
if ($totais.NAO_CLASSIFICADO -gt 0) {
    Write-Host "`n=== DETALHES - NÃO CLASSIFICADOS ===" -ForegroundColor Yellow
    $detalhes.NAO_CLASSIFICADO | Format-Table -AutoSize
}

# Mostrar alguns exemplos de cada categoria
Write-Host "`n=== EXEMPLOS DE CLASSIFICAÇÃO ===" -ForegroundColor Cyan
foreach ($cat in @('SOCIOS', 'CLIENTES', 'ARTISTAS', 'FUNCIONARIOS')) {
    if ($detalhes[$cat].Count -gt 0) {
        Write-Host "`n$cat (primeiros 5):" -ForegroundColor Yellow
        $detalhes[$cat] | Select-Object -First 5 | Format-Table -AutoSize
    }
}
