# Teste de sincronização local
Write-Host "🔄 Testando sincronização retroativa do Falaê (LOCAL)..." -ForegroundColor Cyan
Write-Host ""

$body = @{
    bar_id = 4
    data_inicio = "2026-03-10"
    data_fim = (Get-Date -Format "yyyy-MM-dd")
} | ConvertTo-Json

Write-Host "📋 Payload:" -ForegroundColor Yellow
Write-Host $body -ForegroundColor Gray
Write-Host ""

try {
    Write-Host "🌐 Chamando API local..." -ForegroundColor Cyan
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/falae/sync-retroativo" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 300
    
    Write-Host "✅ Resposta recebida!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Resultado completo:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor White
    
} catch {
    Write-Host "❌ Erro:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Detalhes:" -ForegroundColor Yellow
        Write-Host $_.ErrorDetails.Message -ForegroundColor Gray
    }
    exit 1
}
