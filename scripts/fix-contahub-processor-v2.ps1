$filePath = "c:\Projects\zykor\backend\supabase\functions\contahub-processor\index.ts"

Write-Host "🔄 Atualizando contahub-processor/index.ts..." -ForegroundColor Cyan

$content = Get-Content $filePath -Raw -Encoding UTF8

# Substituições simples de nomes de tabelas
$content = $content.Replace("'bronze_contahub_vendas_analitico'", "'bronze_contahub_avendas_porproduto_analitico'")
$content = $content.Replace("'bronze_contahub_vendas_periodo'", "'bronze_contahub_avendas_vendasperiodo'")
$content = $content.Replace("'bronze_contahub_operacional_fatporhora'", "'bronze_contahub_avendas_vendasdiahoraanalitico'")
$content = $content.Replace("'bronze_contahub_financeiro_pagamentos'", "'bronze_contahub_financeiro_pagamentosrecebidos'")
$content = $content.Replace("'bronze_contahub_producao_tempo'", "'bronze_contahub_produtos_temposproducao'")
$content = $content.Replace("'bronze_contahub_vendas_cancelamentos'", "'bronze_contahub_avendas_cancelamentos'")

# Adicionar , 'bronze' antes de todos os ); que fecham insertInBatches
$content = $content.Replace("analiticoRecords`r`n          );", "analiticoRecords,`r`n            'bronze'`r`n          );")
$content = $content.Replace("periodoRecords`r`n          );", "periodoRecords,`r`n            'bronze'`r`n          );")
$content = $content.Replace("fatporhoraRecords`r`n          );", "fatporhoraRecords,`r`n            'bronze'`r`n          );")
$content = $content.Replace("pagamentosRecords`r`n          );", "pagamentosRecords,`r`n            'bronze'`r`n          );")
$content = $content.Replace("tempoRecords`r`n          );", "tempoRecords,`r`n            'bronze'`r`n          );")
$content = $content.Replace("cancelamentosRecords);", "cancelamentosRecords, 'bronze');")

# Atualizar referências a contahub_raw_data e eventos_base
$content = $content.Replace(".from('contahub_raw_data')", ".schema('bronze').from('bronze_contahub_raw_data')")
$content = $content.Replace(".from('eventos_base')", ".schema('operations').from('eventos_base')")

Set-Content $filePath -Value $content -Encoding UTF8 -NoNewline

Write-Host "✅ Substituições concluídas!" -ForegroundColor Green
