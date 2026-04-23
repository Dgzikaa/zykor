# 🧪 Teste: Coleta de Periodo Março/2025
# Usa a edge function contahub-sync-automatico existente

Write-Host "🧪 ========================================"  -ForegroundColor Cyan
Write-Host "🧪 TESTE: Coleta Periodo Março/2025"  -ForegroundColor Cyan
Write-Host "🧪 qryId: 51 (com campo VD)"  -ForegroundColor Cyan
Write-Host "🧪 Período: 01-07/03/2025 (1 semana)"  -ForegroundColor Cyan
Write-Host "🧪 ========================================`n"  -ForegroundColor Cyan

$SUPABASE_URL = "https://uqtgsvujwcbymjmvkjhy.supabase.co"
$SERVICE_KEY = $env:SUPABASE_SERVICE_ROLE_KEY

if (-not $SERVICE_KEY) {
    Write-Host "❌ SUPABASE_SERVICE_ROLE_KEY não encontrada" -ForegroundColor Red
    exit 1
}

# Datas para testar (primeira semana de março/2025)
$datas = @(
    "2025-03-01",
    "2025-03-02",
    "2025-03-03",
    "2025-03-04",
    "2025-03-05",
    "2025-03-06",
    "2025-03-07"
)

$totalRegistros = 0
$sucesso = 0
$erro = 0

foreach ($data in $datas) {
    Write-Host "`n$('=' * 60)" -ForegroundColor Yellow
    Write-Host "📅 Processando: $data" -ForegroundColor Yellow
    Write-Host "$('=' * 60)" -ForegroundColor Yellow
    
    try {
        $body = @{
            data_inicio = $data
            data_fim = $data
            tipo_dados = @("periodo")
            bars = @(3)  # Bar Ordinário
        } | ConvertTo-Json
        
        Write-Host "📡 Chamando contahub-sync-automatico..." -ForegroundColor Cyan
        
        $headers = @{
            "Authorization" = "Bearer $SERVICE_KEY"
            "Content-Type" = "application/json"
        }
        
        $response = Invoke-RestMethod `
            -Uri "$SUPABASE_URL/functions/v1/contahub-sync-automatico" `
            -Method Post `
            -Headers $headers `
            -Body $body `
            -TimeoutSec 300
        
        Write-Host "✅ Resposta recebida" -ForegroundColor Green
        Write-Host ($response | ConvertTo-Json -Depth 5)
        
        $sucesso++
        
        # Aguardar um pouco entre requisições
        Start-Sleep -Seconds 2
        
    } catch {
        Write-Host "❌ Erro ao processar $data : $($_.Exception.Message)" -ForegroundColor Red
        $erro++
    }
}

# Aguardar processamento
Write-Host "`n⏳ Aguardando 10 segundos para processamento..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

# Verificar no banco
Write-Host "`n📊 Verificando dados salvos no banco..." -ForegroundColor Cyan

$query = @"
SELECT 
  data_date,
  bar_id,
  record_count,
  processed,
  (raw_json->'list'->0->>'vd') as primeiro_vd
FROM contahub_raw_data
WHERE data_type = 'periodo'
  AND data_date >= '2025-03-01'
  AND data_date <= '2025-03-07'
ORDER BY data_date
"@

try {
    $checkBody = @{
        query = $query
    } | ConvertTo-Json
    
    $result = Invoke-RestMethod `
        -Uri "$SUPABASE_URL/rest/v1/rpc/execute_sql" `
        -Method Post `
        -Headers $headers `
        -Body $checkBody
    
    Write-Host "`n📦 Registros salvos:" -ForegroundColor Green
    $result | ForEach-Object {
        $vdStatus = if ($_.primeiro_vd) { "✅ VD=$($_.primeiro_vd)" } else { "❌ SEM VD" }
        Write-Host "   $($_.data_date): $($_.record_count) registros - $vdStatus"
    }
    
    $totalComVD = ($result | Where-Object { $_.primeiro_vd } | Measure-Object).Count
    $totalSemVD = ($result | Where-Object { -not $_.primeiro_vd } | Measure-Object).Count
    
    Write-Host "`n$('=' * 60)" -ForegroundColor Yellow
    Write-Host "📊 RESUMO DO TESTE" -ForegroundColor Yellow
    Write-Host "$('=' * 60)" -ForegroundColor Yellow
    Write-Host "✅ Sucessos: $sucesso" -ForegroundColor Green
    Write-Host "❌ Erros: $erro" -ForegroundColor Red
    Write-Host "✅ Datas com VD: $totalComVD/7" -ForegroundColor Green
    Write-Host "❌ Datas sem VD: $totalSemVD/7" -ForegroundColor Red
    
    if ($totalComVD -eq 7) {
        Write-Host "`n🎉 SUCESSO TOTAL! Todas as datas têm campo VD!" -ForegroundColor Green
        Write-Host "✅ qryId 51 está funcionando corretamente!" -ForegroundColor Green
        Write-Host "`n💡 Próximo passo: Rodar coleta completa de março/2025 até abril/2026" -ForegroundColor Cyan
    } elseif ($totalComVD -gt 0) {
        Write-Host "`n⚠️ ATENÇÃO! Algumas datas têm VD, outras não." -ForegroundColor Yellow
    } else {
        Write-Host "`n❌ PROBLEMA! Nenhuma data retornou campo VD!" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Erro ao verificar banco: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n✅ Teste concluído!" -ForegroundColor Green
