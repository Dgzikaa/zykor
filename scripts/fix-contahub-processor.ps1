$filePath = "c:\Projects\zykor\backend\supabase\functions\contahub-processor\index.ts"

Write-Host "🔄 Atualizando contahub-processor/index.ts..." -ForegroundColor Cyan

$content = Get-Content $filePath -Raw -Encoding UTF8

$replacements = @{
    "'bronze_contahub_vendas_analitico'" = "'bronze_contahub_avendas_porproduto_analitico'"
    "'bronze_contahub_vendas_periodo'" = "'bronze_contahub_avendas_vendasperiodo'"
    "'bronze_contahub_operacional_fatporhora'" = "'bronze_contahub_avendas_vendasdiahoraanalitico'"
    "'bronze_contahub_financeiro_pagamentos'" = "'bronze_contahub_financeiro_pagamentosrecebidos'"
    "'bronze_contahub_producao_tempo'" = "'bronze_contahub_produtos_temposproducao'"
    "'bronze_contahub_vendas_cancelamentos'" = "'bronze_contahub_avendas_cancelamentos'"
    "'contahub_raw_data'" = "'bronze_contahub_raw_data'"
    ".from\('bronze_contahub_vendas_analitico'\)" = ".from('bronze_contahub_avendas_porproduto_analitico')"
    ".from\('bronze_contahub_vendas_periodo'\)" = ".from('bronze_contahub_avendas_vendasperiodo')"
    ".from\('bronze_contahub_operacional_fatporhora'\)" = ".from('bronze_contahub_avendas_vendasdiahoraanalitico')"
    ".from\('bronze_contahub_financeiro_pagamentos'\)" = ".from('bronze_contahub_financeiro_pagamentosrecebidos')"
    ".from\('bronze_contahub_producao_tempo'\)" = ".from('bronze_contahub_produtos_temposproducao')"
    ".from\('bronze_contahub_vendas_cancelamentos'\)" = ".from('bronze_contahub_avendas_cancelamentos')"
    ".from\('contahub_raw_data'\)" = ".schema('bronze').from('bronze_contahub_raw_data')"
    ".from\('eventos_base'\)" = ".schema('operations').from('eventos_base')"
}

$count = 0
foreach ($old in $replacements.Keys) {
    $new = $replacements[$old]
    if ($content -match $old) {
        $content = $content -replace $old, $new
        $count++
        Write-Host "  ✓ $old → $new" -ForegroundColor Gray
    }
}

# Adicionar schema nas chamadas insertInBatches que ainda não tem
$content = $content -replace "insertInBatches\(`r?`n\s+supabase,\s*`r?`n\s+'bronze_contahub_", "insertInBatches(`r`n            supabase,`r`n            'bronze_contahub_"
$content = $content -replace "(\s+analiticoRecords\r?\n\s+)\)", "`$1, 'bronze')"
$content = $content -replace "(\s+periodoRecords\r?\n\s+)\)", "`$1, 'bronze')"
$content = $content -replace "(\s+fatporhoraRecords\r?\n\s+)\)", "`$1, 'bronze')"
$content = $content -replace "(\s+pagamentosRecords\r?\n\s+)\)", "`$1, 'bronze')"
$content = $content -replace "(\s+tempoRecords\r?\n\s+)\)", "`$1, 'bronze')"
$content = $content -replace "(\s+cancelamentosRecords\r?\n\s+)\)", "`$1, 'bronze')"

Set-Content $filePath -Value $content -Encoding UTF8 -NoNewline

Write-Host "`n✅ $count substituições concluídas!" -ForegroundColor Green
