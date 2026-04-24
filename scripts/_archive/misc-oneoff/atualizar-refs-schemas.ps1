# Script para atualizar referências de tabelas para usar schemas corretos

Write-Host "🔄 Atualizando referências de tabelas para schemas..." -ForegroundColor Cyan

# Mapeamento de tabelas antigas -> novas (com schema)
$mappings = @{
    # Bronze - Views de compatibilidade (remover depois)
    "'contahub_analitico'" = "'bronze.bronze_contahub_avendas_porproduto_analitico'"
    "'contahub_pagamentos'" = "'bronze.bronze_contahub_financeiro_pagamentosrecebidos'"
    "'contahub_periodo'" = "'bronze.bronze_contahub_avendas_vendasperiodo'"
    "'contahub_tempo'" = "'bronze.bronze_contahub_produtos_temposproducao'"
    "'contahub_cancelamentos'" = "'bronze.bronze_contahub_avendas_cancelamentos'"
    "'contahub_fatporhora'" = "'bronze.bronze_contahub_avendas_vendasdiahoraanalitico'"
    
    # Bronze - Nomes antigos para novos
    "'bronze_contahub_vendas_analitico'" = "'bronze.bronze_contahub_avendas_porproduto_analitico'"
    "'bronze_contahub_vendas_cancelamentos'" = "'bronze.bronze_contahub_avendas_cancelamentos'"
    "'bronze_contahub_vendas_periodo'" = "'bronze.bronze_contahub_avendas_vendasperiodo'"
    "'bronze_contahub_operacional_fatporhora'" = "'bronze.bronze_contahub_avendas_vendasdiahoraanalitico'"
    "'bronze_contahub_producao_tempo'" = "'bronze.bronze_contahub_produtos_temposproducao'"
    "'bronze_contahub_financeiro_pagamentos'" = "'bronze.bronze_contahub_financeiro_pagamentosrecebidos'"
    
    # Sem quotes (para from())
    "contahub_analitico" = "bronze.bronze_contahub_avendas_porproduto_analitico"
    "contahub_pagamentos" = "bronze.bronze_contahub_financeiro_pagamentosrecebidos"
    "contahub_periodo" = "bronze.bronze_contahub_avendas_vendasperiodo"
    "contahub_tempo" = "bronze.bronze_contahub_produtos_temposproducao"
    "contahub_cancelamentos" = "bronze.bronze_contahub_avendas_cancelamentos"
    "contahub_fatporhora" = "bronze.bronze_contahub_avendas_vendasdiahoraanalitico"
    
    "bronze_contahub_vendas_analitico" = "bronze.bronze_contahub_avendas_porproduto_analitico"
    "bronze_contahub_vendas_cancelamentos" = "bronze.bronze_contahub_avendas_cancelamentos"
    "bronze_contahub_vendas_periodo" = "bronze.bronze_contahub_avendas_vendasperiodo"
    "bronze_contahub_operacional_fatporhora" = "bronze.bronze_contahub_avendas_vendasdiahoraanalitico"
    "bronze_contahub_producao_tempo" = "bronze.bronze_contahub_produtos_temposproducao"
    "bronze_contahub_financeiro_pagamentos" = "bronze.bronze_contahub_financeiro_pagamentosrecebidos"
}

# Arquivos a processar
$files = @(
    "backend\supabase\functions\contahub-processor\index.ts"
    "backend\supabase\functions\contahub-sync-automatico\index.ts"
    "backend\supabase\functions\_shared\calculators\calc-faturamento.ts"
    "backend\supabase\functions\_shared\calculators\calc-custos.ts"
    "backend\supabase\functions\_shared\calculators\calc-operacional.ts"
    "backend\supabase\functions\sync-faturamento-hora\index.ts"
)

$totalUpdated = 0

foreach ($file in $files) {
    $fullPath = Join-Path $PSScriptRoot "..\$file"
    
    if (-not (Test-Path $fullPath)) {
        Write-Host "⚠️  Arquivo não encontrado: $file" -ForegroundColor Yellow
        continue
    }
    
    Write-Host "`n📝 Processando: $file" -ForegroundColor Green
    
    $content = Get-Content $fullPath -Raw -Encoding UTF8
    $originalContent = $content
    $fileUpdates = 0
    
    foreach ($old in $mappings.Keys) {
        $new = $mappings[$old]
        if ($content -match [regex]::Escape($old)) {
            $content = $content -replace [regex]::Escape($old), $new
            $fileUpdates++
            Write-Host "  ✓ $old → $new" -ForegroundColor Gray
        }
    }
    
    if ($fileUpdates -gt 0) {
        Set-Content $fullPath -Value $content -Encoding UTF8 -NoNewline
        Write-Host "  ✅ $fileUpdates substituições feitas" -ForegroundColor Green
        $totalUpdated++
    } else {
        Write-Host "  ⏭️  Nenhuma alteração necessária" -ForegroundColor Gray
    }
}

Write-Host "`n✅ Concluído! $totalUpdated arquivos atualizados" -ForegroundColor Cyan
Write-Host "`n⚠️  IMPORTANTE: Revise as alterações antes de commitar!" -ForegroundColor Yellow
