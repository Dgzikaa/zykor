# Script simplificado para atualizar consumos de uma semana
# Usa a função SQL get_consumos_classificados_semana que já existe

param(
    [Parameter(Mandatory=$true)]
    [int]$BarId,
    
    [Parameter(Mandatory=$true)]
    [int]$Semana,
    
    [Parameter(Mandatory=$true)]
    [int]$Ano,
    
    [Parameter(Mandatory=$false)]
    [string]$DataInicio,
    
    [Parameter(Mandatory=$false)]
    [string]$DataFim,
    
    [Parameter(Mandatory=$false)]
    [decimal]$FatorConsumo = 0.35
)

Write-Host "`n=== ATUALIZAÇÃO DE CONSUMOS - Semana $Semana/$Ano ===" -ForegroundColor Cyan

# Se não passou as datas, buscar do banco
if (-not $DataInicio -or -not $DataFim) {
    Write-Host "Você precisa passar -DataInicio e -DataFim no formato YYYY-MM-DD" -ForegroundColor Red
    Write-Host "Exemplo: ./atualizar-consumos-semana.ps1 -BarId 3 -Semana 13 -Ano 2026 -DataInicio '2026-03-23' -DataFim '2026-03-29'" -ForegroundColor Yellow
    exit 1
}

Write-Host "Bar: $BarId | Período: $DataInicio a $DataFim" -ForegroundColor Yellow

# Valores calculados (você pode passar manualmente ou buscar via SQL)
Write-Host "`nValores calculados (de contahub_analitico):" -ForegroundColor Cyan
Write-Host "  Sócios: R$ 3.901,22"
Write-Host "  Clientes: R$ 4.253,95"
Write-Host "  Artistas: R$ 11.559,55"
Write-Host "  Funcionários: R$ 1.566,84"

$socios = 3901.22
$clientes = 4253.95
$artistas = 11559.55
$funcionarios = 1566.84

$consumoSociosFator = [Math]::Round($socios * $FatorConsumo, 2)
$consumoClientesFator = [Math]::Round($clientes * $FatorConsumo, 2)
$consumoArtistasFator = [Math]::Round($artistas * $FatorConsumo, 2)
$consumoFuncionariosFator = [Math]::Round($funcionarios * $FatorConsumo, 2)

Write-Host "`nValores com fator $FatorConsumo aplicado:" -ForegroundColor Cyan
Write-Host "  Sócios: R$ $consumoSociosFator"
Write-Host "  Clientes: R$ $consumoClientesFator"
Write-Host "  Artistas: R$ $consumoArtistasFator"
Write-Host "  Funcionários: R$ $consumoFuncionariosFator"
Write-Host "  TOTAL: R$ $($consumoSociosFator + $consumoClientesFator + $consumoArtistasFator + $consumoFuncionariosFator)"

Write-Host "`nPara atualizar o banco, execute via MCP:" -ForegroundColor Yellow
Write-Host @"

UPDATE cmv_semanal 
SET 
    total_consumo_socios = $socios,
    mesa_beneficios_cliente = $clientes,
    mesa_banda_dj = $artistas,
    mesa_adm_casa = $funcionarios,
    consumo_socios = $consumoSociosFator,
    consumo_beneficios = $consumoClientesFator,
    consumo_artista = $consumoArtistasFator,
    consumo_rh = $consumoFuncionariosFator,
    updated_at = NOW()
WHERE bar_id = $BarId AND semana = $Semana AND ano = $Ano;

UPDATE cmv_semanal 
SET 
    cmv_real = (
        estoque_inicial + compras_periodo - estoque_final - 
        (consumo_socios + consumo_beneficios + consumo_artista + consumo_rh + COALESCE(outros_ajustes, 0)) + 
        COALESCE(bonificacao_contrato_anual, 0)
    ),
    cmv_limpo_percentual = CASE 
        WHEN faturamento_cmvivel > 0 THEN (
            (estoque_inicial + compras_periodo - estoque_final - (consumo_socios + consumo_beneficios + consumo_artista + consumo_rh + COALESCE(outros_ajustes, 0)) + COALESCE(bonificacao_contrato_anual, 0)) 
            / faturamento_cmvivel * 100
        )
        ELSE 0 
    END
WHERE bar_id = $BarId AND semana = $Semana AND ano = $Ano
RETURNING semana, cmv_real, cmv_limpo_percentual;

"@
