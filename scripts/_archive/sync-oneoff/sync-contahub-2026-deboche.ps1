# Script para sincronizar todos os dados de tempo do ContaHub para 2026 - BAR DEBOCHE
# De 01/01/2026 até 08/04/2026

$ErrorActionPreference = "Continue"

# Configurações
$apiUrl = "http://localhost:3001/api/contahub/sync-diario"
$dataInicio = Get-Date "2026-01-01"
$dataFim = Get-Date "2026-04-08"
$barId = 4  # Bar Deboche

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SYNC CONTAHUB 2026 - TEMPO - DEBOCHE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Data Início: $($dataInicio.ToString('yyyy-MM-dd'))" -ForegroundColor Yellow
Write-Host "Data Fim: $($dataFim.ToString('yyyy-MM-dd'))" -ForegroundColor Yellow
Write-Host "Bar ID: $barId (Deboche)" -ForegroundColor Yellow
Write-Host ""

$totalDias = ($dataFim - $dataInicio).Days + 1
$processados = 0
$sucesso = 0
$erros = 0

$dataAtual = $dataInicio

while ($dataAtual -le $dataFim) {
    $dataStr = $dataAtual.ToString("yyyy-MM-dd")
    $processados++
    
    Write-Host "[$processados/$totalDias] Sincronizando $dataStr..." -NoNewline
    
    try {
        $body = @{
            data_date = $dataStr
            bar_id = $barId
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri $apiUrl -Method Post -Body $body -ContentType "application/json" -TimeoutSec 120
        
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
    
    # Pequena pausa para não sobrecarregar
    Start-Sleep -Milliseconds 500
    
    $dataAtual = $dataAtual.AddDays(1)
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RESUMO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Total de dias: $totalDias" -ForegroundColor Yellow
Write-Host "Sucesso: $sucesso" -ForegroundColor Green
Write-Host "Erros: $erros" -ForegroundColor Red
Write-Host ""
