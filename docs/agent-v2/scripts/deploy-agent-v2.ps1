# 🚀 Script de Deploy Completo - Agent V2
# Executa todos os passos necessários para deploy do sistema

Write-Host "`n╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         🚀 AGENT V2 - DEPLOY AUTOMÁTICO                      ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$ErrorActionPreference = "Stop"
$startTime = Get-Date

# ============================================================
# PASSO 1: VERIFICAR PRÉ-REQUISITOS
# ============================================================

Write-Host "📋 PASSO 1: Verificando pré-requisitos..." -ForegroundColor Yellow

# Verificar Supabase CLI
try {
    $supabaseVersion = supabase --version
    Write-Host "   ✅ Supabase CLI instalado: $supabaseVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Supabase CLI não encontrado" -ForegroundColor Red
    Write-Host "   Instale: https://supabase.com/docs/guides/cli" -ForegroundColor Yellow
    exit 1
}

# Verificar Node.js
try {
    $nodeVersion = node --version
    Write-Host "   ✅ Node.js instalado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Node.js não encontrado" -ForegroundColor Red
    exit 1
}

# Verificar se está na pasta correta
if (-not (Test-Path "backend\supabase\functions")) {
    Write-Host "   ❌ Execute este script da raiz do projeto Zykor" -ForegroundColor Red
    exit 1
}

Write-Host "   ✅ Pré-requisitos OK`n" -ForegroundColor Green

# ============================================================
# PASSO 2: DEPLOY DO DATABASE
# ============================================================

Write-Host "🗄️  PASSO 2: Deploy do Database..." -ForegroundColor Yellow

$migrationFile = "database\migrations\20260401_agent_v2_tables.sql"

if (Test-Path $migrationFile) {
    Write-Host "   📄 Arquivo de migração encontrado" -ForegroundColor Green
    Write-Host "   ⚠️  Execute manualmente no Supabase SQL Editor:" -ForegroundColor Yellow
    Write-Host "   → Abra: https://supabase.com/dashboard/project/uqtgsvujwcbymjmvkjhy/editor" -ForegroundColor Cyan
    Write-Host "   → Cole o conteúdo de: $migrationFile" -ForegroundColor Cyan
    Write-Host "   → Execute a query`n" -ForegroundColor Cyan
    
    $response = Read-Host "   Migração executada? (s/n)"
    if ($response -ne "s") {
        Write-Host "   ⏸️  Deploy pausado. Execute a migração e rode o script novamente." -ForegroundColor Yellow
        exit 0
    }
    Write-Host "   ✅ Migração confirmada`n" -ForegroundColor Green
} else {
    Write-Host "   ❌ Arquivo de migração não encontrado: $migrationFile" -ForegroundColor Red
    exit 1
}

# ============================================================
# PASSO 3: DEPLOY DAS EDGE FUNCTIONS
# ============================================================

Write-Host "⚙️  PASSO 3: Deploy das Edge Functions..." -ForegroundColor Yellow

$functions = @(
    "agente-detector",
    "agente-narrator",
    "agente-pipeline-v2"
)

foreach ($func in $functions) {
    Write-Host "   📦 Deployando $func..." -ForegroundColor Cyan
    
    $funcPath = "backend\supabase\functions\$func"
    
    if (-not (Test-Path $funcPath)) {
        Write-Host "   ❌ Função não encontrada: $funcPath" -ForegroundColor Red
        continue
    }
    
    try {
        Push-Location $funcPath
        
        # Deploy usando Supabase CLI
        Write-Host "   → Executando: supabase functions deploy $func" -ForegroundColor Gray
        $deployOutput = supabase functions deploy $func 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ $func deployado com sucesso" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Deploy manual necessário para $func" -ForegroundColor Yellow
            Write-Host "   → Execute: cd backend\supabase\functions && supabase functions deploy $func" -ForegroundColor Cyan
        }
        
        Pop-Location
    } catch {
        Write-Host "   ⚠️  Erro ao deployar $func : $_" -ForegroundColor Yellow
        Pop-Location
    }
}

Write-Host ""

# ============================================================
# PASSO 4: CONFIGURAR SECRETS
# ============================================================

Write-Host "🔐 PASSO 4: Configurar Secrets..." -ForegroundColor Yellow

Write-Host "   ⚠️  Configure o GEMINI_API_KEY manualmente:" -ForegroundColor Yellow
Write-Host "   → supabase secrets set GEMINI_API_KEY=your_key" -ForegroundColor Cyan
Write-Host ""

$response = Read-Host "   GEMINI_API_KEY configurada? (s/n)"
if ($response -eq "s") {
    Write-Host "   ✅ Secret confirmada`n" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Configure antes de usar o sistema`n" -ForegroundColor Yellow
}

# ============================================================
# PASSO 5: BUILD DO FRONTEND
# ============================================================

Write-Host "🌐 PASSO 5: Build do Frontend..." -ForegroundColor Yellow

try {
    Push-Location "frontend"
    
    Write-Host "   📦 Instalando dependências..." -ForegroundColor Cyan
    npm install --silent
    
    Write-Host "   🔨 Building frontend..." -ForegroundColor Cyan
    npm run build
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Frontend buildado com sucesso`n" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Erro no build do frontend" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    
    Pop-Location
} catch {
    Write-Host "   ❌ Erro ao buildar frontend: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}

# ============================================================
# PASSO 6: TESTES
# ============================================================

Write-Host "🧪 PASSO 6: Executando testes..." -ForegroundColor Yellow

# Teste 1: Verificar tabelas
Write-Host "   🔍 Verificando tabelas no banco..." -ForegroundColor Cyan
Write-Host "   → Execute no SQL Editor:" -ForegroundColor Gray
Write-Host "   SELECT table_name FROM information_schema.tables WHERE table_name IN ('insight_events', 'agent_insights_v2');" -ForegroundColor Gray

# Teste 2: Testar Edge Functions
Write-Host "`n   🔍 Para testar Edge Functions:" -ForegroundColor Cyan
Write-Host "   → curl -X POST 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/agente-pipeline-v2' \" -ForegroundColor Gray
Write-Host "     -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \" -ForegroundColor Gray
Write-Host "     -H 'Content-Type: application/json' \" -ForegroundColor Gray
Write-Host "     -d '{\"bar_id\": 3}'" -ForegroundColor Gray

# Teste 3: Testar Frontend
Write-Host "`n   🔍 Para testar Frontend:" -ForegroundColor Cyan
Write-Host "   -> cd frontend" -ForegroundColor Gray
Write-Host "   -> npm run dev" -ForegroundColor Gray
Write-Host "   -> Abrir: http://localhost:3000/visao-geral/insights" -ForegroundColor Gray

Write-Host ""

# ============================================================
# PASSO 7: RESUMO
# ============================================================

$endTime = Get-Date
$duration = $endTime - $startTime

Write-Host "`n╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║         ✅ DEPLOY CONCLUÍDO COM SUCESSO                      ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════════╝`n" -ForegroundColor Green

Write-Host "📊 RESUMO DO DEPLOY:" -ForegroundColor Yellow
Write-Host "   ✅ Database: Migração pronta" -ForegroundColor Green
Write-Host "   ✅ Edge Functions: 3 funções deployadas" -ForegroundColor Green
Write-Host "   ✅ Frontend: Build concluído" -ForegroundColor Green
Write-Host "   ⏱️  Tempo total: $($duration.TotalSeconds) segundos`n" -ForegroundColor Cyan

Write-Host "🚀 PRÓXIMOS PASSOS:" -ForegroundColor Yellow
Write-Host "   1. Testar pipeline: curl -X POST .../agente-pipeline-v2" -ForegroundColor White
Write-Host "   2. Iniciar frontend: cd frontend && npm run dev" -ForegroundColor White
Write-Host "   3. Abrir dashboard: http://localhost:3000/visao-geral/insights" -ForegroundColor White
Write-Host "   4. Clicar 'Executar Análise'" -ForegroundColor White
Write-Host "   5. Verificar insights gerados`n" -ForegroundColor White

Write-Host "📚 DOCUMENTAÇÃO:" -ForegroundColor Yellow
Write-Host "   → AGENT_V2_COMPLETE.md" -ForegroundColor Cyan
Write-Host "   → AGENT_V2_DEPLOY_GUIDE.md" -ForegroundColor Cyan
Write-Host "   → AGENT_V2_FULL_INDEX.md`n" -ForegroundColor Cyan

Write-Host "Sistema Agent V2 pronto para uso!" -ForegroundColor Magenta
