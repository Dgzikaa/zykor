# Script PowerShell para sincronizar histórico do Falaê
# Uso: .\sync-falae-historico.ps1

Write-Host "🔄 Sincronizando histórico do Falaê..." -ForegroundColor Cyan
Write-Host "📅 Período: 10/03/2026 até hoje" -ForegroundColor Yellow
Write-Host "🏪 Bar: Deboche (ID: 4)" -ForegroundColor Yellow
Write-Host ""

$body = @{
    bar_id = 4
    data_inicio = "2026-03-10"
    data_fim = (Get-Date -Format "yyyy-MM-dd")
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "https://zykor.vercel.app/api/falae/sync-retroativo" -Method Post -Body $body -ContentType "application/json"
    
    Write-Host "✅ Sincronização concluída!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Resultados:" -ForegroundColor Cyan
    Write-Host "  - Respostas encontradas: $($response.resultado.respostas.encontradas)" -ForegroundColor White
    Write-Host "  - Respostas inseridas: $($response.resultado.respostas.inseridas_atualizadas)" -ForegroundColor White
    Write-Host "  - NPS Score do período: $($response.resultado.nps_periodo)" -ForegroundColor White
    Write-Host "  - Dias atualizados: $($response.resultado.nps_diario.dias_atualizados)" -ForegroundColor White
    Write-Host ""
    
    if ($response.resultado.detalhes) {
        Write-Host "📋 Detalhes:" -ForegroundColor Cyan
        $response.resultado.detalhes | ForEach-Object {
            if (-not $_.erro) {
                $tipo = if ($_.is_enps) { "eNPS" } else { "NPS" }
                Write-Host "  - $tipo : $($_.paginas) páginas, $($_.total_reportado) respostas" -ForegroundColor White
            }
        }
    }
    
} catch {
    Write-Host "❌ Erro ao sincronizar:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 Pronto! Agora verifique o NPS Digital no Zykor" -ForegroundColor Green
