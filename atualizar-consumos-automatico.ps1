# Script para atualizar consumos automaticamente via SQL
# Busca de contahub_analitico e atualiza cmv_semanal

param(
    [Parameter(Mandatory=$true)]
    [int]$BarId,
    
    [Parameter(Mandatory=$true)]
    [int]$Semana,
    
    [Parameter(Mandatory=$true)]
    [int]$Ano,
    
    [Parameter(Mandatory=$false)]
    [decimal]$FatorConsumo = 0.35
)

$SUPABASE_URL = "https://uqtgsvujwcbymjmvkjhy.supabase.co"
$SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0"

$headers = @{
    "apikey" = $SERVICE_KEY
    "Authorization" = "Bearer $SERVICE_KEY"
    "Content-Type" = "application/json"
}

Write-Host "`n=== ATUALIZAÇÃO AUTOMÁTICA DE CONSUMOS ===" -ForegroundColor Cyan
Write-Host "Bar: $BarId | Semana: $Semana | Ano: $Ano | Fator: $FatorConsumo" -ForegroundColor Yellow

# 1. Buscar datas da semana
Write-Host "`n[1/4] Buscando datas da semana..." -ForegroundColor Cyan
$queryDatas = "SELECT data_inicio, data_fim FROM desempenho_semanal WHERE bar_id = $BarId AND numero_semana = $Semana AND ano = $Ano LIMIT 1"
$uriDatas = "$SUPABASE_URL/rest/v1/rpc/execute_sql"
$bodyDatas = @{ query = $queryDatas } | ConvertTo-Json

try {
    $responseDatas = Invoke-RestMethod -Uri $uriDatas -Method POST -Headers $headers -Body $bodyDatas
    $dataInicio = $responseDatas[0].data_inicio
    $dataFim = $responseDatas[0].data_fim
    Write-Host "✅ Período: $dataInicio a $dataFim" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro ao buscar datas: $_" -ForegroundColor Red
    exit 1
}

# 2. Buscar consumos classificados via função SQL
Write-Host "`n[2/4] Buscando consumos de contahub_analitico..." -ForegroundColor Cyan
$uriConsumos = "$SUPABASE_URL/rest/v1/rpc/get_consumos_classificados_semana"
$bodyConsumos = @{
    input_bar_id = $BarId
    input_data_inicio = $dataInicio
    input_data_fim = $dataFim
} | ConvertTo-Json

try {
    $consumos = Invoke-RestMethod -Uri $uriConsumos -Method POST -Headers $headers -Body $bodyConsumos
    
    $socios = ($consumos | Where-Object { $_.categoria -eq 'socios' }).total
    $clientes = ($consumos | Where-Object { $_.categoria -eq 'clientes' }).total
    $artistas = ($consumos | Where-Object { $_.categoria -eq 'artistas' }).total
    $funcionarios = ($consumos | Where-Object { $_.categoria -eq 'funcionarios' }).total
    
    Write-Host "✅ Consumos brutos:" -ForegroundColor Green
    Write-Host "   Sócios: R$ $socios"
    Write-Host "   Clientes: R$ $clientes"
    Write-Host "   Artistas: R$ $artistas"
    Write-Host "   Funcionários: R$ $funcionarios"
    Write-Host "   TOTAL: R$ $($socios + $clientes + $artistas + $funcionarios)"
} catch {
    Write-Host "❌ Erro ao buscar consumos: $_" -ForegroundColor Red
    exit 1
}

# 3. Aplicar fator e atualizar banco
Write-Host "`n[3/4] Aplicando fator de $FatorConsumo e atualizando banco..." -ForegroundColor Cyan

$consumoSociosFator = [Math]::Round($socios * $FatorConsumo, 2)
$consumoClientesFator = [Math]::Round($clientes * $FatorConsumo, 2)
$consumoArtistasFator = [Math]::Round($artistas * $FatorConsumo, 2)
$consumoFuncionariosFator = [Math]::Round($funcionarios * $FatorConsumo, 2)

Write-Host "   Sócios (com fator): R$ $consumoSociosFator"
Write-Host "   Clientes (com fator): R$ $consumoClientesFator"
Write-Host "   Artistas (com fator): R$ $consumoArtistasFator"
Write-Host "   Funcionários (com fator): R$ $consumoFuncionariosFator"

$queryUpdate = @"
UPDATE cmv_semanal 
SET 
    total_consumo_socios = $socios,
    mesa_beneficios_cliente = $clientes,
    mesa_banda_dj = $artistas,
    mesa_adm_casa = $funcionarios,
    consumo_socios = $consumoSociosFator,
    consumo_beneficios = $consumoClientesFator,
    consumo_artista = $consumoArtistasFator,
    consumo_rh = $consumoFuncionariosFator,
    updated_at = NOW()
WHERE bar_id = $BarId AND semana = $Semana AND ano = $Ano
RETURNING semana, total_consumo_socios, mesa_beneficios_cliente, mesa_banda_dj, mesa_adm_casa
"@

$bodyUpdate = @{ query = $queryUpdate } | ConvertTo-Json

try {
    $responseUpdate = Invoke-RestMethod -Uri $uriDatas -Method POST -Headers $headers -Body $bodyUpdate
    Write-Host "✅ Banco atualizado!" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro ao atualizar banco: $_" -ForegroundColor Red
    exit 1
}

# 4. Recalcular CMV Real
Write-Host "`n[4/4] Recalculando CMV Real..." -ForegroundColor Cyan

$queryRecalc = @"
UPDATE cmv_semanal 
SET 
    cmv_real = (
        estoque_inicial + 
        compras_periodo - 
        estoque_final - 
        (consumo_socios + consumo_beneficios + consumo_artista + consumo_rh + COALESCE(outros_ajustes, 0)) + 
        COALESCE(bonificacao_contrato_anual, 0)
    ),
    cmv_limpo_percentual = CASE 
        WHEN faturamento_cmvivel > 0 THEN (
            (estoque_inicial + compras_periodo - estoque_final - (consumo_socios + consumo_beneficios + consumo_artista + consumo_rh + COALESCE(outros_ajustes, 0)) + COALESCE(bonificacao_contrato_anual, 0)) 
            / faturamento_cmvivel * 100
        )
        ELSE 0 
    END
WHERE bar_id = $BarId AND semana = $Semana AND ano = $Ano
RETURNING semana, cmv_real, cmv_limpo_percentual, faturamento_cmvivel
"@

$bodyRecalc = @{ query = $queryRecalc } | ConvertTo-Json

try {
    $responseRecalc = Invoke-RestMethod -Uri $uriDatas -Method POST -Headers $headers -Body $bodyRecalc
    $resultado = $responseRecalc[0]
    
    Write-Host "✅ CMV Recalculado!" -ForegroundColor Green
    Write-Host "   CMV Real: R$ $($resultado.cmv_real)"
    Write-Host "   Faturamento CMVível: R$ $($resultado.faturamento_cmvivel)"
    Write-Host "   CMV Limpo %: $([Math]::Round($resultado.cmv_limpo_percentual, 2))%"
} catch {
    Write-Host "❌ Erro ao recalcular CMV: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ CONCLUÍDO!" -ForegroundColor Green
