#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Corrige os estoques das semanas S01-S13/2026 (bar_id=3)
    
.DESCRIPTION
    Problema identificado: a partir de S02/2026, as contagens de estoque no banco
    pararam de capturar bebidas (Retorn?veis, Vinhos) e drinks (DESTILADOS, etc).
    Apenas cozinha estava sendo contada. Isso quebrou toda a cadeia de
    estoque_inicial = estoque_final da semana anterior.
    
    Este script chama sync-sheets para cada semana afetada, puxando os valores
    corretos da planilha Google Sheets. Depois recalcula o CMV.
    
    Semanas afetadas: S01-S13 de 2026 (bar_id=3)
    Primeira semana correta: S14/2026
    
.NOTES
    Execute LOCALMENTE com o servidor Next.js rodando (npm run dev)
    ou aponte BASE_URL para a produ??o.
#>

param(
    [string]$BaseUrl = "https://zykor.com.br",
    [int]$BarId = 3,
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Continue"

$corVerde  = "Green"
$corVermelho = "Red"
$corAmarelo = "Yellow"
$corCiano  = "Cyan"

function Write-Status($msg, $cor = "White") {
    Write-Host $msg -ForegroundColor $cor
}

Write-Status "========================================================" $corCiano
Write-Status "  CORRE??O DE ESTOQUES CMV SEMANAL 2026 - bar_id=$BarId" $corCiano
Write-Status "========================================================" $corCiano
Write-Status ""
Write-Status "Base URL: $BaseUrl"
Write-Status "Dry Run:  $DryRun"
Write-Status ""

# Semanas afetadas: 1 a 13 de 2026
# S01 tem EI correto mas EF=0; S02-S13 t?m EI e EF s? com cozinha
$semanasAfetadas = @(
    @{ semana = 1;  ano = 2026; descricao = "S01/26 (29/12-04/01) - EF incorreto (zero)" },
    @{ semana = 2;  ano = 2026; descricao = "S02/26 (05/01-11/01) - EI+EF sem bebidas/drinks" },
    @{ semana = 3;  ano = 2026; descricao = "S03/26 (12/01-18/01) - EI+EF sem bebidas/drinks" },
    @{ semana = 4;  ano = 2026; descricao = "S04/26 (19/01-25/01) - EI+EF sem bebidas/drinks" },
    @{ semana = 5;  ano = 2026; descricao = "S05/26 (26/01-01/02) - EI+EF sem bebidas/drinks" },
    @{ semana = 6;  ano = 2026; descricao = "S06/26 (02/02-08/02) - EI+EF sem bebidas/drinks" },
    @{ semana = 7;  ano = 2026; descricao = "S07/26 (09/02-15/02) - EI+EF sem bebidas/drinks" },
    @{ semana = 8;  ano = 2026; descricao = "S08/26 (16/02-22/02) - EI+EF sem bebidas/drinks" },
    @{ semana = 9;  ano = 2026; descricao = "S09/26 (23/02-01/03) - EI+EF sem bebidas/drinks" },
    @{ semana = 10; ano = 2026; descricao = "S10/26 (02/03-08/03) - EI+EF sem bebidas/drinks" },
    @{ semana = 11; ano = 2026; descricao = "S11/26 (09/03-15/03) - EI+EF sem bebidas/drinks" },
    @{ semana = 12; ano = 2026; descricao = "S12/26 (16/03-22/03) - EI+EF sem bebidas/drinks" },
    @{ semana = 13; ano = 2026; descricao = "S13/26 (23/03-29/03) - EI sem bebidas/drinks (EF correto)" }
)

Write-Status "Semanas a corrigir via sync-sheets (planilha ? banco):" $corAmarelo
foreach ($s in $semanasAfetadas) {
    Write-Status "  ? $($s.descricao)"
}
Write-Status ""

if ($DryRun) {
    Write-Status "*** DRY RUN - nenhuma altera??o ser? feita ***" $corAmarelo
    Write-Status ""
}

$sucessos = @()
$falhas   = @()

foreach ($item in $semanasAfetadas) {
    $semana = $item.semana
    $ano    = $item.ano
    $desc   = $item.descricao

    Write-Status "?????????????????????????????????????????????" 
    Write-Status "Processando: $desc" $corAmarelo

    if ($DryRun) {
        Write-Status "  [DRY RUN] Chamaria: POST $BaseUrl/api/cmv-semanal/sync-sheets" $corCiano
        $sucessos += $desc
        continue
    }

    try {
        $body = @{
            bar_id = $BarId
            semana = $semana
            ano    = $ano
        } | ConvertTo-Json

        $resposta = Invoke-RestMethod `
            -Uri "$BaseUrl/api/cmv-semanal/sync-sheets" `
            -Method POST `
            -ContentType "application/json" `
            -Body $body `
            -ErrorAction Stop

        if ($resposta.success) {
            Write-Status "  ? OK: $($resposta.message)" $corVerde
            $sucessos += $desc
        } else {
            Write-Status "  ??  Resposta sem sucesso: $($resposta | ConvertTo-Json -Compress)" $corAmarelo
            $falhas += $desc
        }
    } catch {
        $erro = $_.Exception.Message
        Write-Status "  ? ERRO: $erro" $corVermelho
        $falhas += $desc
    }

    # Delay para n?o sobrecarregar a Edge Function
    Start-Sleep -Milliseconds 800
}

Write-Status ""
Write-Status "========================================================" $corCiano
Write-Status "  SYNC-SHEETS CONCLU?DO" $corCiano
Write-Status "  ? Sucessos: $($sucessos.Count)/$($semanasAfetadas.Count)" $corVerde
if ($falhas.Count -gt 0) {
    Write-Status "  ? Falhas:   $($falhas.Count)/$($semanasAfetadas.Count)" $corVermelho
}
Write-Status "========================================================" $corCiano

if ($falhas.Count -gt 0) {
    Write-Status ""
    Write-Status "Semanas com falha:" $corVermelho
    foreach ($f in $falhas) {
        Write-Status "  ? $f" $corVermelho
    }
}

if ($falhas.Count -gt 0) {
    Write-Status ""
    Write-Status "??  H? falhas ? N?O rodando recalcular-todos. Corrija os erros acima e re-execute." $corAmarelo
    exit 1
}

# ?? Etapa 2: Recalcular CMV de todas as semanas ??????????????????????????????
Write-Status ""
Write-Status "Etapa 2: Recalculando CMV de todas as semanas (recalcular-todos)..." $corAmarelo

if ($DryRun) {
    Write-Status "  [DRY RUN] Chamaria: POST $BaseUrl/api/cmv-semanal/recalcular-todos" $corCiano
} else {
    try {
        $bodyRecalc = @{ bar_id = $BarId } | ConvertTo-Json

        $respostaRecalc = Invoke-RestMethod `
            -Uri "$BaseUrl/api/cmv-semanal/recalcular-todos" `
            -Method POST `
            -ContentType "application/json" `
            -Body $bodyRecalc `
            -ErrorAction Stop

        if ($respostaRecalc.success) {
            Write-Status "  ? CMV recalculado: $($respostaRecalc.message)" $corVerde
        } else {
            Write-Status "  ??  Rec?lculo retornou: $($respostaRecalc | ConvertTo-Json -Compress)" $corAmarelo
        }
    } catch {
        Write-Status "  ? Erro no rec?lculo: $($_.Exception.Message)" $corVermelho
    }
}

# ?? Etapa 3: Valida??o no banco ???????????????????????????????????????????????
Write-Status ""
Write-Status "========================================================" $corCiano
Write-Status "  VALIDA??O P?S-CORRE??O (banco de dados)" $corCiano
Write-Status "========================================================" $corCiano
Write-Status ""
Write-Status "Execute a query abaixo no Supabase para validar:" $corAmarelo
$queryValidacao = 'SELECT semana, data_inicio, ROUND(estoque_inicial::numeric,2) AS ei_total, ROUND(estoque_inicial_bebidas::numeric,2) AS ei_bebidas, ROUND(estoque_inicial_drinks::numeric,2) AS ei_drinks, ROUND(estoque_final::numeric,2) AS ef_total, ROUND(estoque_final_bebidas::numeric,2) AS ef_bebidas, ROUND(cmv_real::numeric,2) AS cmv_real FROM cmv_semanal WHERE bar_id = 3 AND ano = 2026 AND semana <= 16 ORDER BY semana'
Write-Status $queryValidacao

Write-Status ""
Write-Status "Criterios de validacao:" $corAmarelo
Write-Status "  S13/26: ei_total deve ser ~156.809"
Write-Status "  S14/26: ei_total deve ser ~160.628 (= EF da S13)"
Write-Status "  ei_bebidas e ei_drinks devem ser > 0 em S02-S13"
Write-Status "  cmv_real nao deve ser negativo"
Write-Status ""
Write-Status "Script finalizado." $corVerde

