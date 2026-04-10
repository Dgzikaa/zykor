# Script para sincronizar range de datas do ContaHub
param(
    [Parameter(Mandatory=$true)]
    [int]$BarId,
    
    [Parameter(Mandatory=$true)]
    [string]$DataInicio,
    
    [Parameter(Mandatory=$true)]
    [string]$DataFim
)

$url = "https://pzojhaqqgjlquzouhelm.supabase.co/functions/v1/contahub-sync-automatico"
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6b2poYXFxZ2pscXV6b3VoZWxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQwMzU2NTcsImV4cCI6MjA0OTYxMTY1N30.gVLqLkuEKkRPqIE5SLjdJQxe-cNLSJQTBKAg1qqfxMg"

$startDate = [DateTime]::Parse($DataInicio)
$endDate = [DateTime]::Parse($DataFim)
$currentDate = $startDate

$totalDias = ($endDate - $startDate).Days + 1
$contador = 0
$sucessos = 0
$erros = 0

Write-Host "🚀 Iniciando sincronização de $totalDias dias..." -ForegroundColor Cyan
Write-Host "📊 Bar ID: $BarId" -ForegroundColor Yellow
Write-Host "📅 Período: $DataInicio a $DataFim" -ForegroundColor Yellow
Write-Host ""

while ($currentDate -le $endDate) {
    $contador++
    $dateStr = $currentDate.ToString("yyyy-MM-dd")
    $percentual = [math]::Round(($contador / $totalDias) * 100, 1)
    
    Write-Host "[$contador/$totalDias - $percentual%] Sincronizando $dateStr..." -NoNewline
    
    try {
        $body = @{
            bar_id = $BarId
            data_date = $dateStr
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri $url -Method Post -Headers @{
            "Content-Type" = "application/json"
            "Authorization" = "Bearer $token"
        } -Body $body -TimeoutSec 30
        
        Write-Host " ✅" -ForegroundColor Green
        $sucessos++
    }
    catch {
        Write-Host " ❌ Erro: $($_.Exception.Message)" -ForegroundColor Red
        $erros++
    }
    
    $currentDate = $currentDate.AddDays(1)
    
    # Delay de 1 segundo entre chamadas
    Start-Sleep -Milliseconds 1000
}

Write-Host ""
Write-Host "🎯 Sincronização concluída!" -ForegroundColor Cyan
Write-Host "✅ Sucessos: $sucessos" -ForegroundColor Green
Write-Host "❌ Erros: $erros" -ForegroundColor Red
