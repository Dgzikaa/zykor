# Script para testar a propagação de estoque do CMV
# Valida que estoque inicial da semana N = estoque final da semana N-1

param(
    [int]$BarId = 3,
    [int]$Ano = 2026
)

Write-Host "🔍 Testando propagação de estoque - Bar $BarId, Ano $Ano" -ForegroundColor Cyan
Write-Host ""

# 1. Ajustar row map do Deboche (se necessário)
if ($BarId -eq 4) {
    Write-Host "🔧 Ajustando row_map do Deboche..." -ForegroundColor Yellow
    $ajusteResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/cmv-semanal/ajustar-rowmap-deboche" -Method POST -ContentType "application/json"
    
    if ($ajusteResponse.success) {
        Write-Host "✅ Row map ajustado com sucesso" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Aviso: $($ajusteResponse.error)" -ForegroundColor Yellow
    }
    Write-Host ""
}

# 2. Propagar estoque
Write-Host "🔄 Propagando estoque inicial..." -ForegroundColor Yellow
$body = @{
    bar_id = $BarId
    ano = $Ano
} | ConvertTo-Json

$propagarResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/cmv-semanal/propagar-estoque" -Method POST -Body $body -ContentType "application/json"

if ($propagarResponse.success) {
    Write-Host "✅ Propagação concluída: $($propagarResponse.total_propagacoes) semanas atualizadas" -ForegroundColor Green
} else {
    Write-Host "❌ Erro: $($propagarResponse.error)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 3. Validar consistência
Write-Host "🔍 Validando consistência..." -ForegroundColor Yellow
$cmvResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/cmv-semanal?bar_id=$BarId" -Method GET

$semanas = $cmvResponse.data | Where-Object { $_.ano -eq $Ano } | Sort-Object semana

$erros = 0
$validacoes = 0

for ($i = 1; $i -lt $semanas.Count; $i++) {
    $semanaAtual = $semanas[$i]
    $semanaAnterior = $semanas[$i - 1]
    
    # Validar CMV
    $inicialAtual = [decimal]$semanaAtual.estoque_inicial
    $finalAnterior = [decimal]$semanaAnterior.estoque_final
    
    $diff = [Math]::Abs($inicialAtual - $finalAnterior)
    
    if ($diff -gt 0.01) {
        Write-Host "❌ Semana $($semanaAtual.semana): inicial R$ $inicialAtual ≠ final anterior R$ $finalAnterior (diff: R$ $diff)" -ForegroundColor Red
        $erros++
    } else {
        Write-Host "✅ Semana $($semanaAtual.semana): inicial = final anterior (R$ $inicialAtual)" -ForegroundColor Green
    }
    
    $validacoes++
}

Write-Host ""
Write-Host "📊 Resultado: $validacoes validações, $erros erros" -ForegroundColor $(if ($erros -eq 0) { "Green" } else { "Red" })

if ($erros -eq 0) {
    Write-Host "✅ Todas as semanas estão consistentes!" -ForegroundColor Green
} else {
    Write-Host "❌ Encontrados $erros erros de consistência" -ForegroundColor Red
    exit 1
}
