# Script Automatizado para Atualizar TODOS os Arquivos Frontend
# Data: 17/04/2026
# Uso: powershell -ExecutionPolicy Bypass -File atualizar-frontend-completo.ps1

Write-Host "`n🚀 ATUALIZAÇÃO AUTOMÁTICA - FRONTEND SCHEMAS" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

$baseDir = "c:\Projects\zykor\frontend\src"
$backupDir = "c:\Projects\zykor\.backup-schemas-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

# Criar diretório de backup
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Write-Host "📦 Backup criado em: $backupDir`n" -ForegroundColor Green

# Lista de todos os arquivos a atualizar
$arquivos = @(
    "$baseDir\app\api\contahub\preencher-direto\route.ts",
    "$baseDir\app\api\contahub\preencher-sequencial\route.ts",
    "$baseDir\app\api\contahub\verificar-dados\route.ts",
    "$baseDir\app\api\contahub\processar-raw\route.ts",
    "$baseDir\app\api\contahub\coletar-retroativo\route.ts",
    "$baseDir\app\api\contahub\backfill-historico\route.ts",
    "$baseDir\app\api\contahub\processar-automatico\route.ts",
    "$baseDir\app\api\contahub\coletar-lacunas\route.ts",
    "$baseDir\app\api\contahub\stockout\route.ts",
    "$baseDir\app\api\contahub\stockout\recalcular\route.ts",
    "$baseDir\app\api\contahub\stockout\audit\route.ts",
    "$baseDir\app\api\analitico\stockout\route.ts",
    "$baseDir\app\api\analitico\stockout-historico\route.ts",
    "$baseDir\app\api\analitico\semanal\route.ts",
    "$baseDir\app\api\estrategico\desempenho\mensal\route.ts",
    "$baseDir\app\api\gestao\desempenho\recalcular-mix\route.ts",
    "$baseDir\app\api\gestao\desempenho\recalcular\route.ts",
    "$baseDir\app\api\auditoria\completa\route.ts",
    "$baseDir\app\api\visao-geral\indicadores-mensais\route.ts",
    "$baseDir\app\api\eventos\[id]\valores-reais\route.ts",
    "$baseDir\app\api\agente\lib\data-fetcher.ts",
    "$baseDir\lib\analytics-service.ts",
    "$baseDir\app\estrategico\desempenho\services\desempenho-service.ts",
    "$baseDir\components\ferramentas\HorarioPicoChart.tsx",
    "$baseDir\components\ferramentas\ProdutosDoDiaDataTable.tsx"
)

# Mapeamento de substituições
$substituicoes = @{
    # Bronze - aspas duplas
    '.from("contahub_analitico")' = '.schema("bronze").from("bronze_contahub_avendas_porproduto_analitico")'
    '.from("contahub_pagamentos")' = '.schema("bronze").from("bronze_contahub_financeiro_pagamentosrecebidos")'
    '.from("contahub_periodo")' = '.schema("bronze").from("bronze_contahub_avendas_vendasperiodo")'
    '.from("contahub_tempo")' = '.schema("bronze").from("bronze_contahub_produtos_temposproducao")'
    '.from("contahub_cancelamentos")' = '.schema("bronze").from("bronze_contahub_avendas_cancelamentos")'
    '.from("contahub_fatporhora")' = '.schema("bronze").from("bronze_contahub_avendas_vendasdiahoraanalitico")'
    '.from("contahub_raw_data")' = '.schema("bronze").from("bronze_contahub_raw_data")'
    
    # Bronze - aspas simples
    ".from('contahub_analitico')" = ".schema('bronze').from('bronze_contahub_avendas_porproduto_analitico')"
    ".from('contahub_pagamentos')" = ".schema('bronze').from('bronze_contahub_financeiro_pagamentosrecebidos')"
    ".from('contahub_periodo')" = ".schema('bronze').from('bronze_contahub_avendas_vendasperiodo')"
    ".from('contahub_tempo')" = ".schema('bronze').from('bronze_contahub_produtos_temposproducao')"
    ".from('contahub_cancelamentos')" = ".schema('bronze').from('bronze_contahub_avendas_cancelamentos')"
    ".from('contahub_fatporhora')" = ".schema('bronze').from('bronze_contahub_avendas_vendasdiahoraanalitico')"
    ".from('contahub_raw_data')" = ".schema('bronze').from('bronze_contahub_raw_data')"
    
    # Operations
    '.from("eventos_base")' = '.schema("operations").from("eventos_base")'
    ".from('eventos_base')" = ".schema('operations').from('eventos_base')"
    '.from("bares")' = '.schema("operations").from("bares")'
    ".from('bares')" = ".schema('operations').from('bares')"
    
    # Gold
    ".from('contahub_stockout')" = ".schema('gold').from('gold_contahub_operacional_stockout')"
    '.from("contahub_stockout")' = '.schema("gold").from("gold_contahub_operacional_stockout")'
}

$totalArquivos = 0
$totalSubstituicoes = 0
$erros = @()

foreach ($arquivo in $arquivos) {
    if (-not (Test-Path $arquivo)) {
        Write-Host "⚠️  Não encontrado: $arquivo" -ForegroundColor Yellow
        continue
    }
    
    $nomeArquivo = Split-Path $arquivo -Leaf
    $pastaRelativa = (Split-Path $arquivo -Parent).Replace($baseDir, "").TrimStart("\")
    Write-Host "`n📝 $pastaRelativa\$nomeArquivo" -ForegroundColor Green
    
    try {
        # Fazer backup
        $backupPath = Join-Path $backupDir (Split-Path $arquivo -Leaf)
        Copy-Item $arquivo $backupPath -Force
        
        # Ler conteúdo
        $content = Get-Content $arquivo -Raw -Encoding UTF8
        $original = $content
        $subs = 0
        
        # Aplicar substituições
        foreach ($old in $substituicoes.Keys) {
            $new = $substituicoes[$old]
            if ($content.Contains($old)) {
                $content = $content.Replace($old, $new)
                $subs++
                Write-Host "  ✓ Substituição aplicada" -ForegroundColor DarkGray
            }
        }
        
        if ($subs -gt 0) {
            # Salvar arquivo atualizado
            Set-Content $arquivo -Value $content -Encoding UTF8 -NoNewline
            Write-Host "  ✅ $subs substituições" -ForegroundColor Green
            $totalArquivos++
            $totalSubstituicoes += $subs
        } else {
            Write-Host "  ⏭️  Nenhuma alteração necessária" -ForegroundColor Gray
        }
    }
    catch {
        $erros += "Erro em $nomeArquivo : $_"
        Write-Host "  ❌ ERRO: $_" -ForegroundColor Red
    }
}

# Relatório Final
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "✅ ATUALIZAÇÃO CONCLUÍDA!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "📊 Estatísticas:" -ForegroundColor White
Write-Host "   - Arquivos atualizados: $totalArquivos" -ForegroundColor White
Write-Host "   - Total de substituições: $totalSubstituicoes" -ForegroundColor White
Write-Host "   - Erros: $($erros.Count)" -ForegroundColor White
Write-Host "   - Backup: $backupDir" -ForegroundColor White

if ($erros.Count -gt 0) {
    Write-Host "`n⚠️  ERROS ENCONTRADOS:" -ForegroundColor Yellow
    foreach ($erro in $erros) {
        Write-Host "   $erro" -ForegroundColor Red
    }
}

Write-Host "`n📝 PRÓXIMOS PASSOS:" -ForegroundColor Cyan
Write-Host "   1. Revisar alterações: git diff" -ForegroundColor White
Write-Host "   2. Testar TypeScript: npm run type-check" -ForegroundColor White
Write-Host "   3. Testar Build: npm run build" -ForegroundColor White
Write-Host "   4. Commit: git add . && git commit -m 'refactor: atualizar schemas'" -ForegroundColor White

Write-Host "`n✨ Script finalizado em $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Cyan
