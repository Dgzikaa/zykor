# Script para reprocessar desempenho semanal 2026 - Bar Deboche

$ErrorActionPreference = "Continue"

# Configurações
$supabaseUrl = "https://uqtgsvujwcbymjmvkjhy.supabase.co"
$serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0"
$functionUrl = "$supabaseUrl/functions/v1/recalcular-desempenho-v2"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "REPROCESSAR DESEMPENHO 2026 - DEBOCHE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$headers = @{
    "Authorization" = "Bearer $serviceKey"
    "Content-Type" = "application/json"
}

# Reprocessar semanas 5 até 14 (semana atual)
$semanas = 5..14

$total = $semanas.Count
$processados = 0
$sucesso = 0
$erros = 0

foreach ($semana in $semanas) {
    $processados++
    
    Write-Host "[$processados/$total] Reprocessando semana $semana..." -NoNewline
    
    try {
        $body = @{
            bar_id = 4
            ano = 2026
            semana = $semana
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri $functionUrl -Method Post -Body $body -Headers $headers -ContentType "application/json" -TimeoutSec 120
        
        if ($response.success) {
            Write-Host " ✅ OK" -ForegroundColor Green
            $sucesso++
        } else {
            Write-Host " ❌ ERRO: $($response.error)" -ForegroundColor Red
            $erros++
        }
    } catch {
        Write-Host " ❌ ERRO: $($_.Exception.Message)" -ForegroundColor Red
        $erros++
    }
    
    # Pequena pausa
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RESUMO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Total: $total" -ForegroundColor Yellow
Write-Host "Sucesso: $sucesso" -ForegroundColor Green
Write-Host "Erros: $erros" -ForegroundColor Red
Write-Host ""
