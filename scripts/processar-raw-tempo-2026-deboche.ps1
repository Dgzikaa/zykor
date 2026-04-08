# Script para processar todos os dados raw de tempo de 2026 - BAR DEBOCHE

$ErrorActionPreference = "Continue"

# Configurações
$supabaseUrl = "https://uqtgsvujwcbymjmvkjhy.supabase.co"
$serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0"
$functionUrl = "$supabaseUrl/functions/v1/contahub-processor"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PROCESSAR RAW DATA - TEMPO 2026 - DEBOCHE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Buscar todos os IDs de raw_data não processados de tempo para bar_id=4

$headers = @{
    "apikey" = $serviceKey
    "Authorization" = "Bearer $serviceKey"
    "Content-Type" = "application/json"
    "Prefer" = "return=representation"
}

try {
    $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/contahub_raw_data?select=id,data_date&data_type=eq.tempo&bar_id=eq.4&processed=eq.false&order=data_date.asc" -Headers $headers -Method Get
    
    $totalIds = $response.Count
    Write-Host "Total de registros para processar: $totalIds" -ForegroundColor Yellow
    Write-Host ""
    
    $processados = 0
    $sucesso = 0
    $erros = 0
    
    foreach ($record in $response) {
        $rawId = $record.id
        $dataDate = $record.data_date
        $processados++
        
        Write-Host "[$processados/$totalIds] Processando ID $rawId ($dataDate)..." -NoNewline
        
        try {
            $body = @{
                raw_data_id = $rawId
                data_date = $dataDate
            } | ConvertTo-Json
            
            $procHeaders = @{
                "Authorization" = "Bearer $serviceKey"
                "Content-Type" = "application/json"
            }
            
            $procResponse = Invoke-RestMethod -Uri $functionUrl -Method Post -Body $body -Headers $procHeaders -ContentType "application/json" -TimeoutSec 60
            
            if ($procResponse.success) {
                Write-Host " ✅ OK ($($procResponse.inserted_records) registros)" -ForegroundColor Green
                $sucesso++
            } else {
                Write-Host " ❌ ERRO: $($procResponse.error)" -ForegroundColor Red
                $erros++
            }
        } catch {
            Write-Host " ❌ ERRO: $($_.Exception.Message)" -ForegroundColor Red
            $erros++
        }
        
        # Pequena pausa
        Start-Sleep -Milliseconds 200
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "RESUMO" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Total: $totalIds" -ForegroundColor Yellow
    Write-Host "Sucesso: $sucesso" -ForegroundColor Green
    Write-Host "Erros: $erros" -ForegroundColor Red
    Write-Host ""
    
} catch {
    Write-Host "❌ Erro ao buscar registros: $($_.Exception.Message)" -ForegroundColor Red
}
