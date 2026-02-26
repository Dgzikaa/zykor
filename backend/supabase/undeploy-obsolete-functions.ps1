# Script para fazer undeploy de Edge Functions obsoletas do Supabase
# Data: 25/02/2026

Write-Host "🗑️  Removendo Edge Functions obsoletas do Supabase..." -ForegroundColor Yellow
Write-Host ""

# Lista de funções de AGENTE que foram consolidadas no agente-dispatcher
$agenteFunctions = @(
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
    "agente-treinamento"
)

# Lista de funções de ALERTAS que foram consolidadas no alertas-dispatcher
$alertasFunctions = @(
    "alertas-inteligentes",
    "alertas-proativos",
    "processar-alertas-discord",
    "relatorio-matinal-discord"
)

# Lista de funções de INTEGRAÇÃO que foram consolidadas no integracao-dispatcher
$integracaoFunctions = @(
    "yuzer-sync",
    "sympla-sync",
    "nibo-sync",
    "getin-sync-continuous"
)

# Lista de funções de GOOGLE SHEETS que foram consolidadas no google-sheets-sync
$sheetsFunctions = @(
    "sync-fichas-tecnicas",
    "sync-insumos-receitas",
    "sync-contagem-sheets",
    "sync-orcamentacao-sheets",
    "sync-cmv-sheets"
)

# Lista de funções de DISCORD que foram consolidadas no discord-dispatcher
$discordFunctions = @(
    "discord-notification",
    "discord-commands"
)

# Lista de funções de SYNC que foram consolidadas no sync-dispatcher
$syncFunctions = @(
    "sync-eventos",
    "sync-cliente-estatisticas",
    "sync-conhecimento",
    "sync-marketing-meta"
)

# Lista de funções de WEBHOOK que foram consolidadas no webhook-dispatcher
$webhookFunctions = @(
    "umbler-webhook",
    "google-reviews-apify-sync"
)

# Lista de funções de CONTAHUB que foram consolidadas no contahub-sync
$contahubFunctions = @(
    "contahub-analitico",
    "contahub-fatporhora",
    "contahub-pagamentos",
    "contahub-periodo",
    "contahub-prodporhora",
    "contahub-stockout",
    "contahub-tempo",
    "contahub-vendas"
)

# Lista de funções de RELATÓRIOS que foram removidas
$relatorioFunctions = @(
    "cmv-semanal-auto",
    "desempenho-semanal-auto",
    "relatorio-pdf"
)

# Lista de funções de SYNC RETROATIVO que foram removidas
$retroativoFunctions = @(
    "sync-contagem-retroativo",
    "sync-orcamentacao-cron"
)

# Consolidar todas as funções
$allFunctions = $agenteFunctions + $alertasFunctions + $integracaoFunctions + 
                $sheetsFunctions + $discordFunctions + $syncFunctions + 
                $webhookFunctions + $contahubFunctions + $relatorioFunctions + 
                $retroativoFunctions

Write-Host "📋 Total de funções a remover: $($allFunctions.Count)" -ForegroundColor Cyan
Write-Host ""

$removed = 0
$errors = 0

foreach ($func in $allFunctions) {
    Write-Host "🗑️  Removendo: $func" -NoNewline
    
    try {
        $result = supabase functions delete $func --project-ref uqtgsvujwcbymjmvkjhy 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host " ✅" -ForegroundColor Green
            $removed++
        } else {
            Write-Host " ⚠️  (já removida ou não existe)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host " ❌ Erro: $_" -ForegroundColor Red
        $errors++
    }
    
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ Funções removidas: $removed" -ForegroundColor Green
Write-Host "⚠️  Erros: $errors" -ForegroundColor Yellow
Write-Host "📊 Total processado: $($allFunctions.Count)" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎉 Limpeza concluída!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Funções que devem permanecer (23):" -ForegroundColor Yellow
Write-Host "   - agente-dispatcher" -ForegroundColor White
Write-Host "   - alertas-dispatcher" -ForegroundColor White
Write-Host "   - integracao-dispatcher" -ForegroundColor White
Write-Host "   - contahub-sync" -ForegroundColor White
Write-Host "   - google-sheets-sync" -ForegroundColor White
Write-Host "   - discord-dispatcher" -ForegroundColor White
Write-Host "   - sync-dispatcher" -ForegroundColor White
Write-Host "   - webhook-dispatcher" -ForegroundColor White
Write-Host "   - (+ 15 outras funções específicas)" -ForegroundColor White
