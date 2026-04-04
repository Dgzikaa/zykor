# Buscar fonte alternativa de consumos
$SUPABASE_URL = "https://uqtgsvujwcbymjmvkjhy.supabase.co"
$SUPABASE_KEY = $env:SUPABASE_SERVICE_ROLE_KEY

$headers = @{
    "apikey" = $SUPABASE_KEY
    "Authorization" = "Bearer $SUPABASE_KEY"
}

Write-Host "`n=== BUSCANDO FONTES DE CONSUMO ===" -ForegroundColor Cyan

# 1. Verificar se existe tabela de contas especiais
Write-Host "`n1. Verificando tabelas disponíveis..." -ForegroundColor Yellow
$url = "$SUPABASE_URL/rest/v1/?apikey=$SUPABASE_KEY"

# 2. Buscar na tabela contahub_periodo se tem informação de consumo
Write-Host "`n2. Verificando contahub_periodo (semana 13)..." -ForegroundColor Yellow
$url = "$SUPABASE_URL/rest/v1/contahub_periodo?bar_id=eq.3&data=gte.2026-03-23&data=lte.2026-03-29&select=data,vr_consumo_socio,vr_consumo_funcionario,vr_consumo_artista&limit=10"
try {
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    if ($response.Count -gt 0) {
        Write-Host "Encontrou dados em contahub_periodo!" -ForegroundColor Green
        $response | Format-Table -AutoSize
    } else {
        Write-Host "Sem dados em contahub_periodo" -ForegroundColor Red
    }
} catch {
    Write-Host "Erro ou colunas não existem: $_" -ForegroundColor Red
}

# 3. Buscar em vendas_diarias
Write-Host "`n3. Verificando vendas_diarias (semana 13)..." -ForegroundColor Yellow
$url = "$SUPABASE_URL/rest/v1/vendas_diarias?bar_id=eq.3&data=gte.2026-03-23&data=lte.2026-03-29&select=data,consumo_interno,desconto_total&limit=10"
try {
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    if ($response.Count -gt 0) {
        Write-Host "Encontrou dados em vendas_diarias!" -ForegroundColor Green
        $response | Format-Table -AutoSize
    } else {
        Write-Host "Sem dados em vendas_diarias" -ForegroundColor Red
    }
} catch {
    Write-Host "Erro ou colunas não existem: $_" -ForegroundColor Red
}

# 4. Verificar se visitas tem outros campos relevantes
Write-Host "`n4. Verificando campos da tabela visitas..." -ForegroundColor Yellow
$url = "$SUPABASE_URL/rest/v1/visitas?bar_id=eq.3&data_visita=eq.2026-03-23&limit=1&select=*"
try {
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    if ($response.Count -gt 0) {
        Write-Host "Campos disponíveis em visitas:" -ForegroundColor Green
        $response[0].PSObject.Properties.Name | Sort-Object | ForEach-Object {
            Write-Host "  - $_" -ForegroundColor White
        }
    }
} catch {
    Write-Host "Erro: $_" -ForegroundColor Red
}
