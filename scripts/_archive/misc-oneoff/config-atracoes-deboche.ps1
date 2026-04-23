# Script para configurar categoria de atração para Bar Deboche

$ErrorActionPreference = "Stop"

# Configurações
$supabaseUrl = "https://uqtgsvujwcbymjmvkjhy.supabase.co"
$serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CONFIGURAR CATEGORIA ATRAÇÃO - DEBOCHE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$headers = @{
    "apikey" = $serviceKey
    "Authorization" = "Bearer $serviceKey"
    "Content-Type" = "application/json"
    "Prefer" = "return=representation"
}

# Verificar se já existe
Write-Host "Verificando configuração existente..." -NoNewline
try {
    $checkResponse = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/bar_categorias_custo?bar_id=eq.4&tipo=eq.atracao" -Headers $headers -Method Get
    
    if ($checkResponse.Count -gt 0) {
        Write-Host " ✅ JÁ EXISTE" -ForegroundColor Green
        Write-Host ""
        Write-Host "Configuração atual:" -ForegroundColor Yellow
        $checkResponse | Format-Table -AutoSize
        exit 0
    } else {
        Write-Host " ❌ NÃO ENCONTRADO" -ForegroundColor Yellow
    }
} catch {
    Write-Host " ❌ ERRO: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Inserir nova configuração
Write-Host ""
Write-Host "Inserindo nova configuração..." -NoNewline
try {
    $body = @{
        bar_id = 4
        tipo = "atracao"
        nome_categoria = "Atrações/Eventos"
        ativo = $true
    } | ConvertTo-Json
    
    $insertResponse = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/bar_categorias_custo" -Headers $headers -Method Post -Body $body
    
    Write-Host " ✅ SUCESSO" -ForegroundColor Green
    Write-Host ""
    Write-Host "Configuração inserida:" -ForegroundColor Green
    $insertResponse | Format-Table -AutoSize
    
} catch {
    Write-Host " ❌ ERRO: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CONFIGURAÇÃO CONCLUÍDA!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
