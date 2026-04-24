# Script simplificado para atualizar schemas

Write-Host "🚀 Atualizando referências de schemas..." -ForegroundColor Cyan

$baseDir = "c:\Projects\zykor"
$files = @(
    "$baseDir\backend\supabase\functions\_shared\calculators\calc-faturamento.ts",
    "$baseDir\backend\supabase\functions\_shared\calculators\calc-custos.ts",
    "$baseDir\backend\supabase\functions\_shared\calculators\calc-operacional.ts",
    "$baseDir\backend\supabase\functions\contahub-sync-automatico\index.ts",
    "$baseDir\backend\supabase\functions\sync-faturamento-hora\index.ts",
    "$baseDir\backend\supabase\functions\cmv-semanal-auto\index.ts",
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

$updated = 0

foreach ($file in $files) {
    if (-not (Test-Path $file)) {
        Write-Host "⚠️  Não encontrado: $file" -ForegroundColor Yellow
        continue
    }
    
    Write-Host "`n📝 $(Split-Path $file -Leaf)" -ForegroundColor Green
    
    $content = Get-Content $file -Raw -Encoding UTF8
    $original = $content
    
    # Substituições básicas
    $content = $content.Replace(".from(`"contahub_analitico`")", ".schema(`"bronze`").from(`"bronze_contahub_avendas_porproduto_analitico`")")
    $content = $content.Replace(".from('contahub_analitico')", ".schema('bronze').from('bronze_contahub_avendas_porproduto_analitico')")
    $content = $content.Replace(".from(`"contahub_pagamentos`")", ".schema(`"bronze`").from(`"bronze_contahub_financeiro_pagamentosrecebidos`")")
    $content = $content.Replace(".from('contahub_pagamentos')", ".schema('bronze').from('bronze_contahub_financeiro_pagamentosrecebidos')")
    $content = $content.Replace(".from(`"contahub_periodo`")", ".schema(`"bronze`").from(`"bronze_contahub_avendas_vendasperiodo`")")
    $content = $content.Replace(".from('contahub_periodo')", ".schema('bronze').from('bronze_contahub_avendas_vendasperiodo')")
    $content = $content.Replace(".from(`"contahub_tempo`")", ".schema(`"bronze`").from(`"bronze_contahub_produtos_temposproducao`")")
    $content = $content.Replace(".from('contahub_tempo')", ".schema('bronze').from('bronze_contahub_produtos_temposproducao')")
    $content = $content.Replace(".from(`"contahub_cancelamentos`")", ".schema(`"bronze`").from(`"bronze_contahub_avendas_cancelamentos`")")
    $content = $content.Replace(".from('contahub_cancelamentos')", ".schema('bronze').from('bronze_contahub_avendas_cancelamentos')")
    $content = $content.Replace(".from(`"contahub_fatporhora`")", ".schema(`"bronze`").from(`"bronze_contahub_avendas_vendasdiahoraanalitico`")")
    $content = $content.Replace(".from('contahub_fatporhora')", ".schema('bronze').from('bronze_contahub_avendas_vendasdiahoraanalitico')")
    
    $content = $content.Replace(".from(`"bronze_contahub_vendas_analitico`")", ".schema(`"bronze`").from(`"bronze_contahub_avendas_porproduto_analitico`")")
    $content = $content.Replace(".from('bronze_contahub_vendas_analitico')", ".schema('bronze').from('bronze_contahub_avendas_porproduto_analitico')")
    
    # Outras tabelas
    $content = $content.Replace(".from(`"eventos_base`")", ".schema(`"operations`").from(`"eventos_base`")")
    $content = $content.Replace(".from('eventos_base')", ".schema('operations').from('eventos_base')")
    $content = $content.Replace(".from(`"contahub_raw_data`")", ".schema(`"bronze`").from(`"bronze_contahub_raw_data`")")
    $content = $content.Replace(".from('contahub_raw_data')", ".schema('bronze').from('bronze_contahub_raw_data')")
    
    if ($content -ne $original) {
        Set-Content $file -Value $content -Encoding UTF8 -NoNewline
        Write-Host "  ✅ Atualizado" -ForegroundColor Green
        $updated++
    } else {
        Write-Host "  ⏭️  Sem alterações" -ForegroundColor Gray
    }
}

Write-Host "`n✅ Concluído! $updated arquivos atualizados" -ForegroundColor Cyan
