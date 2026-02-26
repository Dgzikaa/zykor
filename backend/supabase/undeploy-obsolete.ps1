# Script para fazer undeploy de Edge Functions obsoletas
# Data: 25/02/2026

Write-Host "Removendo Edge Functions obsoletas do Supabase..." -ForegroundColor Yellow

# Lista completa de funcoes obsoletas
$obsoleteFunctions = @(
    # Agente (16 funcoes)
    "agente-analise-diaria",
    "agente-analise-mensal",
    "agente-analise-periodos",
    "agente-analise-semanal",
    "agente-auditor",
    "agente-chat",
    "agente-comparacao",
    "agente-custos",
    "agente-feedback",
    "agente-ia-analyzer",
    "agente-mapeador-labels",
    "agente-metas",
    "agente-planejamento",
    "agente-sql-expert",
    "agente-supervisor",
    "agente-treinamento",
    
    # Alertas (4 funcoes)
    "alertas-inteligentes",
    "alertas-proativos",
    "processar-alertas-discord",
    "relatorio-matinal-discord",
    
    # Integracao (4 funcoes)
    "yuzer-sync",
    "sympla-sync",
    "nibo-sync",
    "getin-sync-continuous",
    
    # Google Sheets (5 funcoes)
    "sync-fichas-tecnicas",
    "sync-insumos-receitas",
    "sync-contagem-sheets",
    "sync-orcamentacao-sheets",
    "sync-cmv-sheets",
    
    # Discord (2 funcoes)
    "discord-notification",
    "discord-commands",
    
    # Sync (4 funcoes)
    "sync-eventos",
    "sync-cliente-estatisticas",
    "sync-conhecimento",
    "sync-marketing-meta",
    
    # Webhook (2 funcoes)
    "umbler-webhook",
    "google-reviews-apify-sync",
    
    # ContaHub (8 funcoes)
    "contahub-analitico",
    "contahub-fatporhora",
    "contahub-pagamentos",
    "contahub-periodo",
    "contahub-prodporhora",
    "contahub-stockout",
    "contahub-tempo",
    "contahub-vendas",
    
    # Relatorios (2 funcoes)
    "cmv-semanal-auto",
    "desempenho-semanal-auto",
    
    # Retroativo (2 funcoes)
    "sync-contagem-retroativo",
    "sync-orcamentacao-cron"
)

Write-Host "Total de funcoes a remover: $($obsoleteFunctions.Count)"
Write-Host ""

$removed = 0
$notFound = 0

foreach ($func in $obsoleteFunctions) {
    Write-Host "Removendo: $func ... " -NoNewline
    
    $result = supabase functions delete $func --project-ref uqtgsvujwcbymjmvkjhy 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK" -ForegroundColor Green
        $removed++
    } else {
        Write-Host "Nao encontrada" -ForegroundColor Yellow
        $notFound++
    }
    
    Start-Sleep -Milliseconds 300
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Funcoes removidas: $removed" -ForegroundColor Green
Write-Host "Nao encontradas: $notFound" -ForegroundColor Yellow
Write-Host "Total: $($obsoleteFunctions.Count)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Concluido!" -ForegroundColor Green
