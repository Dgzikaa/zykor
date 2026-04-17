# Script para atualizar TODAS as referências de tabelas para usar schemas corretos

Write-Host "🚀 INICIANDO ATUALIZAÇÃO GLOBAL DE SCHEMAS" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

$totalFiles = 0
$totalReplacements = 0

# Função para processar um arquivo
function Update-File {
    param(
        [string]$FilePath,
        [hashtable]$Replacements
    )
    
    if (-not (Test-Path $FilePath)) {
        Write-Host "⚠️  Arquivo não encontrado: $FilePath" -ForegroundColor Yellow
        return 0
    }
    
    $fileName = Split-Path $FilePath -Leaf
    Write-Host "📝 Processando: $fileName" -ForegroundColor Green
    
    $content = Get-Content $FilePath -Raw -Encoding UTF8
    $originalContent = $content
    $fileReplacements = 0
    
    foreach ($old in $Replacements.Keys) {
        $new = $Replacements[$old]
        if ($content.Contains($old)) {
            $content = $content.Replace($old, $new)
            $fileReplacements++
            Write-Host "  ✓ $old → $new" -ForegroundColor DarkGray
        }
    }
    
    if ($fileReplacements -gt 0) {
        Set-Content $FilePath -Value $content -Encoding UTF8 -NoNewline
        Write-Host "  ✅ $fileReplacements substituições" -ForegroundColor Green
        return 1
    } else {
        Write-Host "  ⏭️  Nenhuma alteração necessária" -ForegroundColor Gray
        return 0
    }
}

# ==============================================
# MAPEAMENTO DE SUBSTITUIÇÕES
# ==============================================

$replacements = @{
    # BRONZE - Nomes de tabelas (com aspas simples para SQL/TypeScript)
    "'contahub_analitico'" = "'bronze.bronze_contahub_avendas_porproduto_analitico'"
    "'contahub_pagamentos'" = "'bronze.bronze_contahub_financeiro_pagamentosrecebidos'"
    "'contahub_periodo'" = "'bronze.bronze_contahub_avendas_vendasperiodo'"
    "'contahub_tempo'" = "'bronze.bronze_contahub_produtos_temposproducao'"
    "'contahub_cancelamentos'" = "'bronze.bronze_contahub_avendas_cancelamentos'"
    "'contahub_fatporhora'" = "'bronze.bronze_contahub_avendas_vendasdiahoraanalitico'"
    
    "'bronze_contahub_vendas_analitico'" = "'bronze.bronze_contahub_avendas_porproduto_analitico'"
    "'bronze_contahub_vendas_periodo'" = "'bronze.bronze_contahub_avendas_vendasperiodo'"
    "'bronze_contahub_vendas_cancelamentos'" = "'bronze.bronze_contahub_avendas_cancelamentos'"
    "'bronze_contahub_operacional_fatporhora'" = "'bronze.bronze_contahub_avendas_vendasdiahoraanalitico'"
    "'bronze_contahub_producao_tempo'" = "'bronze.bronze_contahub_produtos_temposproducao'"
    "'bronze_contahub_financeiro_pagamentos'" = "'bronze.bronze_contahub_financeiro_pagamentosrecebidos'"
    
    # BRONZE - Para .from() do Supabase (sem aspas)
    '.from("contahub_analitico")' = '.schema("bronze").from("bronze_contahub_avendas_porproduto_analitico")'
    '.from("contahub_pagamentos")' = '.schema("bronze").from("bronze_contahub_financeiro_pagamentosrecebidos")'
    '.from("contahub_periodo")' = '.schema("bronze").from("bronze_contahub_avendas_vendasperiodo")'
    '.from("contahub_tempo")' = '.schema("bronze").from("bronze_contahub_produtos_temposproducao")'
    '.from("contahub_cancelamentos")' = '.schema("bronze").from("bronze_contahub_avendas_cancelamentos")'
    '.from("contahub_fatporhora")' = '.schema("bronze").from("bronze_contahub_avendas_vendasdiahoraanalitico")'
    
    ".from('contahub_analitico')" = ".schema('bronze').from('bronze_contahub_avendas_porproduto_analitico')"
    ".from('contahub_pagamentos')" = ".schema('bronze').from('bronze_contahub_financeiro_pagamentosrecebidos')"
    ".from('contahub_periodo')" = ".schema('bronze').from('bronze_contahub_avendas_vendasperiodo')"
    ".from('contahub_tempo')" = ".schema('bronze').from('bronze_contahub_produtos_temposproducao')"
    ".from('contahub_cancelamentos')" = ".schema('bronze').from('bronze_contahub_avendas_cancelamentos')"
    ".from('contahub_fatporhora')" = ".schema('bronze').from('bronze_contahub_avendas_vendasdiahoraanalitico')"
    
    # SILVER
    ".from('silver_contahub_financeiro_pagamentos')" = ".schema('silver').from('silver_contahub_financeiro_pagamentosrecebidos')"
    
    # OPERATIONS
    ".from('eventos_base')" = ".schema('operations').from('eventos_base')"
    ".from('bares')" = ".schema('operations').from('bares')"
    
    # BRONZE - raw_data
    ".from('contahub_raw_data')" = ".schema('bronze').from('bronze_contahub_raw_data')"
}

# ==============================================
# LISTA DE ARQUIVOS A PROCESSAR
# ==============================================

$baseDir = "c:\Projects\zykor"
$files = @(
    # Backend - Edge Functions
    "$baseDir\backend\supabase\functions\_shared\calculators\calc-faturamento.ts",
    "$baseDir\backend\supabase\functions\_shared\calculators\calc-custos.ts",
    "$baseDir\backend\supabase\functions\_shared\calculators\calc-operacional.ts",
    "$baseDir\backend\supabase\functions\contahub-sync-automatico\index.ts",
    "$baseDir\backend\supabase\functions\sync-faturamento-hora\index.ts",
    "$baseDir\backend\supabase\functions\cmv-semanal-auto\index.ts",
    
    # Frontend - APIs
    "$baseDir\frontend\src\app\api\estrategico\desempenho\mensal\route.ts",
    "$baseDir\frontend\src\app\api\auditoria\completa\route.ts",
    "$baseDir\frontend\src\app\api\analitico\semanal\route.ts",
    "$baseDir\frontend\src\app\api\contahub\preencher-lacunas\route.ts",
    "$baseDir\frontend\src\app\api\gestao\desempenho\recalcular-mix\route.ts",
    "$baseDir\frontend\src\app\api\gestao\desempenho\recalcular\route.ts",
    "$baseDir\frontend\src\app\api\analitico\stockout-historico\route.ts",
    "$baseDir\frontend\src\app\api\contahub\preencher-direto\route.ts",
    "$baseDir\frontend\src\app\api\contahub\preencher-sequencial\route.ts",
    "$baseDir\frontend\src\app\api\contahub\verificar-dados\route.ts",
    "$baseDir\frontend\src\app\api\visao-geral\indicadores-mensais\route.ts"
)

Write-Host "`n📦 Processando $($files.Count) arquivos...`n" -ForegroundColor Cyan

foreach ($file in $files) {
    $result = Update-File -FilePath $file -Replacements $replacements
    if ($result -eq 1) {
        $totalFiles++
    }
    $totalReplacements += $result
}

# ==============================================
# RESUMO
# ==============================================

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "✅ ATUALIZAÇÃO CONCLUÍDA!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "📊 Arquivos atualizados: $totalFiles" -ForegroundColor White
Write-Host "🔄 Total de substituições: $totalReplacements" -ForegroundColor White
Write-Host "`n⚠️  IMPORTANTE:" -ForegroundColor Yellow
Write-Host "   1. Revise as alterações com git diff" -ForegroundColor Yellow
Write-Host "   2. Teste localmente antes de fazer push" -ForegroundColor Yellow
Write-Host "   3. Não esqueça de dropar as views de compatibilidade depois" -ForegroundColor Yellow
