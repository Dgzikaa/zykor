# Test Agent V2 Pipeline
Write-Host ""
Write-Host "Testing Agent V2 Pipeline..." -ForegroundColor Cyan

$SUPABASE_URL = "https://uqtgsvujwcbymjmvkjhy.supabase.co"
$ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzMTExNjYsImV4cCI6MjA2Njg4NzE2Nn0.59x53jDOpNe9yVevnP-TcXr6Dkj0QjU8elJb636xV6M"

# Test 1: Detector
Write-Host ""
Write-Host "TEST 1: Agente Detector" -ForegroundColor Yellow

$detectorBody = @{
    bar_id = 3
    data = "2026-03-30"
} | ConvertTo-Json

try {
    $detectorResponse = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/functions/v1/agente-detector" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $ANON_KEY"
            "Content-Type" = "application/json"
            "apikey" = $ANON_KEY
        } `
        -Body $detectorBody `
        -TimeoutSec 60

    Write-Host "SUCCESS: Detector executed!" -ForegroundColor Green
    Write-Host "Data: $($detectorResponse.data_analise)" -ForegroundColor Cyan
    Write-Host "Events detected: $($detectorResponse.eventos_detectados)" -ForegroundColor Cyan
    Write-Host "Events saved: $($detectorResponse.eventos_salvos)" -ForegroundColor Cyan
    
    if ($detectorResponse.eventos -and $detectorResponse.eventos.Count -gt 0) {
        Write-Host ""
        Write-Host "Detected events:" -ForegroundColor White
        $detectorResponse.eventos | ForEach-Object {
            Write-Host "  - $($_.tipo) (severity: $($_.severidade))" -ForegroundColor Magenta
        }
    }
} catch {
    Write-Host "ERROR in Detector:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Start-Sleep -Seconds 2

# Test 2: Pipeline
Write-Host ""
Write-Host "TEST 2: Complete Pipeline (Detector + Narrator)" -ForegroundColor Yellow
Write-Host "Please wait... (may take up to 60s)" -ForegroundColor Gray

$pipelineBody = @{
    bar_id = 3
    data = "2026-03-30"
} | ConvertTo-Json

try {
    $pipelineResponse = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/functions/v1/agente-pipeline-v2" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $ANON_KEY"
            "Content-Type" = "application/json"
            "apikey" = $ANON_KEY
        } `
        -Body $pipelineBody `
        -TimeoutSec 90

    Write-Host ""
    Write-Host "SUCCESS: Pipeline executed!" -ForegroundColor Green
    Write-Host "Events detected: $($pipelineResponse.eventos_detectados)" -ForegroundColor Cyan
    Write-Host "Insights generated: $($pipelineResponse.insights_gerados)" -ForegroundColor Cyan
    
    if ($pipelineResponse.insights -and $pipelineResponse.insights.Count -gt 0) {
        Write-Host ""
        Write-Host "Generated Insights:" -ForegroundColor White
        Write-Host "----------------------------------------" -ForegroundColor DarkGray
        
        $pipelineResponse.insights | ForEach-Object {
            Write-Host ""
            Write-Host "$($_.titulo)" -ForegroundColor Magenta
            Write-Host "Type: $($_.tipo) | Severity: $($_.severidade)" -ForegroundColor Yellow
            Write-Host "$($_.descricao)" -ForegroundColor White
            
            if ($_.causa_provavel) {
                Write-Host ""
                Write-Host "Probable cause:" -ForegroundColor Cyan
                Write-Host "$($_.causa_provavel)" -ForegroundColor Gray
            }
            
            if ($_.acoes_recomendadas -and $_.acoes_recomendadas.Count -gt 0) {
                Write-Host ""
                Write-Host "Recommended actions:" -ForegroundColor Green
                $_.acoes_recomendadas | ForEach-Object {
                    Write-Host "  * $_" -ForegroundColor Gray
                }
            }
            
            Write-Host "----------------------------------------" -ForegroundColor DarkGray
        }
    }
    
} catch {
    Write-Host ""
    Write-Host "ERROR in Pipeline:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
Write-Host "Tests completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Check data in Supabase Dashboard:" -ForegroundColor Cyan
Write-Host "https://supabase.com/dashboard/project/uqtgsvujwcbymjmvkjhy/editor" -ForegroundColor Gray
