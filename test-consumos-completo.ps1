# Análise completa de consumos - Semana 13
$SUPABASE_URL = "https://uqtgsvujwcbymjmvkjhy.supabase.co"
$SUPABASE_KEY = $env:SUPABASE_SERVICE_ROLE_KEY

$headers = @{
    "apikey" = $SUPABASE_KEY
    "Authorization" = "Bearer $SUPABASE_KEY"
    "Prefer" = "count=exact"
}

Write-Host "`n=== ANÁLISE COMPLETA - SEMANA 13 ===" -ForegroundColor Cyan

# Contar total
$countUrl = "$SUPABASE_URL/rest/v1/visitas?bar_id=eq.3&data_visita=gte.2026-03-23&data_visita=lte.2026-03-29&motivo_desconto=not.is.null&select=id"
$countResponse = Invoke-WebRequest -Uri $countUrl -Headers $headers -Method Get
$totalCount = [int]($countResponse.Headers['Content-Range'] -split '/')[-1]
Write-Host "Total de registros com motivo_desconto: $totalCount`n" -ForegroundColor Yellow

# Buscar todos com paginação
$allVisitas = @()
$pageSize = 1000
$offset = 0

while ($allVisitas.Count -lt $totalCount) {
    $url = "$SUPABASE_URL/rest/v1/visitas?bar_id=eq.3&data_visita=gte.2026-03-23&data_visita=lte.2026-03-29&motivo_desconto=not.is.null&select=motivo_desconto,valor_desconto,valor_produtos,valor_consumo&limit=$pageSize&offset=$offset"
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    $allVisitas += $response
    $offset += $pageSize
    Write-Host "Carregados: $($allVisitas.Count)" -ForegroundColor Gray
    if ($response.Count -lt $pageSize) { break }
}

Write-Host "Total carregado: $($allVisitas.Count)`n" -ForegroundColor Green

# Definir padrões
$PADROES_SOCIOS = @('sócios', 'socios', 'socio', 'sócio', 'x-socio', 'x-sócio', 'gonza', 'corbal', 'diogo', 'cadu', 'augusto', 'rodrigo', 'digao', 'vinicius', 'vini', 'bueno', 'kaizen', 'caisen', 'joão pedro', 'joao pedro', 'jp', '3v', 'cantucci')
$PADROES_CLIENTES = @('aniver', 'anivers', 'aniversário', 'aniversario', 'aniversariante', 'niver', 'voucher', 'benefício', 'beneficio', 'mesa mágica', 'mágica', 'influencer', 'influ', 'influencia', 'influência', 'club', 'clube', 'midia', 'mídia', 'social', 'insta', 'digital', 'cliente', 'ambev', 'promoção', 'chegadeira')
$PADROES_ARTISTAS = @('musico', 'músicos', 'dj', 'banda', 'artista', 'breno', 'benza', 'stz', 'zelia', 'tia', 'samba', 'sambadona', 'doze', 'boca', 'boka', 'pé', 'chão', 'segunda', 'resenha', 'pagode', 'roda', 'reconvexa', 'rodie', 'roudier', 'roudi', 'som', 'técnico', 'tecnico', 'pv', 'paulo victor', 'prod')
$PADROES_FUNCIONARIOS = @('funcionários', 'funcionario', 'rh', 'financeiro', 'fin', 'mkt', 'marketing', 'slu', 'adm', 'administrativo', 'prêmio', 'confra')

function Classificar {
    param($motivo)
    if ([string]::IsNullOrWhiteSpace($motivo)) { return "VAZIO" }
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

# Testar 3 cenários diferentes
Write-Host "=== CENÁRIO 1: valor_desconto + valor_produtos ===" -ForegroundColor Cyan
$totais1 = @{ SOCIOS = 0; CLIENTES = 0; ARTISTAS = 0; FUNCIONARIOS = 0; VAZIO = 0; NAO_CLASSIFICADO = 0 }
foreach ($v in $allVisitas) {
    $cat = Classificar -motivo $v.motivo_desconto
    $valor = [decimal]$v.valor_desconto + [decimal]$v.valor_produtos
    $totais1[$cat] += $valor
}
Write-Host "Sócios:       R$ $($totais1.SOCIOS.ToString('N2'))" -ForegroundColor White
Write-Host "Clientes:     R$ $($totais1.CLIENTES.ToString('N2'))" -ForegroundColor White
Write-Host "Artistas:     R$ $($totais1.ARTISTAS.ToString('N2'))" -ForegroundColor White
Write-Host "Funcionários: R$ $($totais1.FUNCIONARIOS.ToString('N2'))" -ForegroundColor White
Write-Host "Vazios:       R$ $($totais1.VAZIO.ToString('N2'))" -ForegroundColor Magenta
Write-Host "Não Class.:   R$ $($totais1.NAO_CLASSIFICADO.ToString('N2'))" -ForegroundColor Yellow

Write-Host "`n=== CENÁRIO 2: valor_consumo ===" -ForegroundColor Cyan
$totais2 = @{ SOCIOS = 0; CLIENTES = 0; ARTISTAS = 0; FUNCIONARIOS = 0; VAZIO = 0; NAO_CLASSIFICADO = 0 }
foreach ($v in $allVisitas) {
    $cat = Classificar -motivo $v.motivo_desconto
    $valor = [decimal]$v.valor_consumo
    $totais2[$cat] += $valor
}
Write-Host "Sócios:       R$ $($totais2.SOCIOS.ToString('N2'))" -ForegroundColor White
Write-Host "Clientes:     R$ $($totais2.CLIENTES.ToString('N2'))" -ForegroundColor White
Write-Host "Artistas:     R$ $($totais2.ARTISTAS.ToString('N2'))" -ForegroundColor White
Write-Host "Funcionários: R$ $($totais2.FUNCIONARIOS.ToString('N2'))" -ForegroundColor White
Write-Host "Vazios:       R$ $($totais2.VAZIO.ToString('N2'))" -ForegroundColor Magenta
Write-Host "Não Class.:   R$ $($totais2.NAO_CLASSIFICADO.ToString('N2'))" -ForegroundColor Yellow

Write-Host "`n=== CENÁRIO 3: valor_consumo * 0.35 (fator CMV) ===" -ForegroundColor Cyan
$totais3 = @{ SOCIOS = 0; CLIENTES = 0; ARTISTAS = 0; FUNCIONARIOS = 0; VAZIO = 0; NAO_CLASSIFICADO = 0 }
foreach ($v in $allVisitas) {
    $cat = Classificar -motivo $v.motivo_desconto
    $valor = [decimal]$v.valor_consumo * 0.35
    $totais3[$cat] += $valor
}
Write-Host "Sócios:       R$ $($totais3.SOCIOS.ToString('N2'))" -ForegroundColor White
Write-Host "Clientes:     R$ $($totais3.CLIENTES.ToString('N2'))" -ForegroundColor White
Write-Host "Artistas:     R$ $($totais3.ARTISTAS.ToString('N2'))" -ForegroundColor White
Write-Host "Funcionários: R$ $($totais3.FUNCIONARIOS.ToString('N2'))" -ForegroundColor White
Write-Host "Vazios:       R$ $($totais3.VAZIO.ToString('N2'))" -ForegroundColor Magenta
Write-Host "Não Class.:   R$ $($totais3.NAO_CLASSIFICADO.ToString('N2'))" -ForegroundColor Yellow

Write-Host "`n=== VALORES ESPERADOS (PLANILHA) ===" -ForegroundColor Cyan
Write-Host "Consumo Sócios:       R$ 3.099,47" -ForegroundColor Green
Write-Host "Consumo Benefícios:   R$ 4.323,80" -ForegroundColor Green
Write-Host "Consumo Artista:      R$ 10.970,80" -ForegroundColor Green
Write-Host "Consumo RH Operação:  R$ 846,38" -ForegroundColor Green
