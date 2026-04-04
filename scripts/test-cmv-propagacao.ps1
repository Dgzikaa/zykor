# Script para corrigir o historico de estoque do CMV (rodar UMA VEZ)
# Aplica a regra contabil: estoque inicial da semana N = estoque final da semana N-1

param(
    [int]$BarId = 3,
    [int]$Ano = 2026
)

Write-Host "Corrigindo historico de estoque - Bar $BarId, Ano $Ano" -ForegroundColor Cyan
Write-Host ""

# Propagar estoque via Edge Function
Write-Host "Aplicando regra contabil..." -ForegroundColor Yellow

$supabaseUrl = $env:NEXT_PUBLIC_SUPABASE_URL
$supabaseKey = $env:SUPABASE_SERVICE_ROLE_KEY

if (-not $supabaseUrl -or -not $supabaseKey) {
    Write-Host "ERRO: Variaveis de ambiente nao configuradas" -ForegroundColor Red
    Write-Host "Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor Yellow
    exit 1
}

$body = @{
    bar_id = $BarId
    ano = $Ano
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $supabaseKey"
}

try {
    $propagarResponse = Invoke-RestMethod -Uri "$supabaseUrl/functions/v1/cmv-propagar-estoque" -Method POST -Body $body -Headers $headers -ContentType "application/json"
    
    if ($propagarResponse.success) {
        Write-Host "Propagacao concluida: $($propagarResponse.total_propagacoes) semanas atualizadas" -ForegroundColor Green
    } else {
        Write-Host "ERRO: $($propagarResponse.error)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "ERRO ao chamar Edge Function: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Validar consistencia via API local
Write-Host "Validando consistencia..." -ForegroundColor Yellow

try {
    $cmvResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/cmv-semanal?bar_id=$BarId" -Method GET

    $semanas = $cmvResponse.data | Where-Object { $_.ano -eq $Ano } | Sort-Object semana

    if ($semanas.Count -lt 2) {
        Write-Host "Menos de 2 semanas encontradas para validar" -ForegroundColor Yellow
        exit 0
    }

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
            Write-Host "ERRO Semana $($semanaAtual.semana): inicial R$ $inicialAtual != final anterior R$ $finalAnterior (diff: R$ $diff)" -ForegroundColor Red
            $erros++
        } else {
            Write-Host "OK Semana $($semanaAtual.semana): inicial = final anterior (R$ $inicialAtual)" -ForegroundColor Green
        }
        
        $validacoes++
    }

    Write-Host ""
    Write-Host "Resultado: $validacoes validacoes, $erros erros" -ForegroundColor $(if ($erros -eq 0) { "Green" } else { "Red" })

    if ($erros -eq 0) {
        Write-Host "Todas as semanas estao consistentes!" -ForegroundColor Green
    } else {
        Write-Host "Encontrados $erros erros de consistencia" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Nao foi possivel validar via API local (servidor pode estar offline)" -ForegroundColor Yellow
    Write-Host "Verifique manualmente em: https://zykor.com.br/ferramentas/cmv-semanal/tabela" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Script concluido" -ForegroundColor Green
