# 🤖 Agent V2 - Sistema de Insights Inteligentes

**Status:** ✅ OPERACIONAL  
**Versão:** 1.0.0  
**Data de Deploy:** 2026-04-01

---

## 📚 Documentação

### Documentos Principais

1. **[AGENT_V2_DEPLOYMENT_SUCCESS.md](./AGENT_V2_DEPLOYMENT_SUCCESS.md)**  
   Relatório completo do deployment com status de todos os componentes, links úteis e checklist.

2. **[AGENT_V2_DEPLOY_GUIDE.md](./AGENT_V2_DEPLOY_GUIDE.md)**  
   Guia passo a passo para fazer deploy do sistema Agent V2.

### Backend

- **[backend/AGENT_V2_ARCHITECTURE.md](./backend/AGENT_V2_ARCHITECTURE.md)**  
  Arquitetura detalhada do sistema backend (Edge Functions).

- **[backend/AGENT_V2_IMPLEMENTATION.md](./backend/AGENT_V2_IMPLEMENTATION.md)**  
  Detalhes de implementação das Edge Functions.

#### Edge Functions (Código)

- **agente-detector:** `backend/supabase/functions/agente-detector/`
  - [README.md](../../backend/supabase/functions/agente-detector/README.md)
  - [ARCHITECTURE.md](../../backend/supabase/functions/agente-detector/ARCHITECTURE.md)

- **agente-narrator:** `backend/supabase/functions/agente-narrator/`
  - [README.md](../../backend/supabase/functions/agente-narrator/README.md)
  - [INTEGRATION.md](../../backend/supabase/functions/agente-narrator/INTEGRATION.md)

- **agente-pipeline-v2:** `backend/supabase/functions/agente-pipeline-v2/`
  - [README.md](../../backend/supabase/functions/agente-pipeline-v2/README.md)
  - [FLOW.md](../../backend/supabase/functions/agente-pipeline-v2/FLOW.md)
  - [DEPLOYMENT.md](../../backend/supabase/functions/agente-pipeline-v2/DEPLOYMENT.md)
  - [EXAMPLES.md](../../backend/supabase/functions/agente-pipeline-v2/EXAMPLES.md)

### Frontend

#### API Routes (Código)

- **API Routes:** `frontend/src/app/api/agente/insights-v2/`
  - [README.md](../../frontend/src/app/api/agente/insights-v2/README.md)
  - [ARCHITECTURE.md](../../frontend/src/app/api/agente/insights-v2/ARCHITECTURE.md)
  - [QUICKSTART.md](../../frontend/src/app/api/agente/insights-v2/QUICKSTART.md)
  - [EXAMPLES.md](../../frontend/src/app/api/agente/insights-v2/EXAMPLES.md)
  - [TEST.md](../../frontend/src/app/api/agente/insights-v2/TEST.md)
  - [VALIDATION.md](../../frontend/src/app/api/agente/insights-v2/VALIDATION.md)
  - [IMPLEMENTATION.md](../../frontend/src/app/api/agente/insights-v2/IMPLEMENTATION.md)

#### Componentes (Código)

- **InsightsV2Card:** `frontend/src/components/dashboard/InsightsV2Card.tsx`
  - [README.md](../../frontend/src/components/dashboard/InsightsV2Card.README.md)
  - [EXAMPLES.md](../../frontend/src/components/dashboard/InsightsV2Card.EXAMPLES.md)

- **Hooks:** `frontend/src/hooks/useInsightsV2.ts`
- **Types:** `frontend/src/types/agent-v2.ts`

### Scripts

- **[test-agent-v2-clean.ps1](./scripts/test-agent-v2-clean.ps1)**  
  Script PowerShell para testar o pipeline Agent V2.

- **[deploy-agent-v2.ps1](./scripts/deploy-agent-v2.ps1)**  
  Script PowerShell para automatizar o deploy completo.

---

## 🚀 Quick Start

### Testar o Pipeline

```powershell
powershell -ExecutionPolicy Bypass -File "docs/agent-v2/scripts/test-agent-v2-clean.ps1"
```

### Verificar Cronjobs

```sql
SELECT jobid, jobname, schedule, active 
FROM cron.job 
WHERE jobname LIKE 'agent-v2%';
```

### Acessar Dashboard

- **Supabase Functions:** https://supabase.com/dashboard/project/uqtgsvujwcbymjmvkjhy/functions
- **Frontend:** `/visao-geral/insights`

---

## 📊 Arquitetura

```
Frontend (InsightsV2Card)
    ↓
API Routes (/api/agente/insights-v2/*)
    ↓
agente-pipeline-v2 (Orchestrator)
    ↓                    ↓
agente-detector    agente-narrator
(8 Regras)         (Gemini LLM)
    ↓                    ↓
insight_events    agent_insights_v2
```

---

## ⏰ Cronjobs Ativos

- **agent-v2-bar-3-daily:** Executa às 09:00 UTC (06:00 BRT)
- **agent-v2-bar-4-daily:** Executa às 09:05 UTC (06:05 BRT)

---

## 🔗 Links Úteis

- **Supabase Dashboard:** https://supabase.com/dashboard/project/uqtgsvujwcbymjmvkjhy
- **Edge Functions:** https://supabase.com/dashboard/project/uqtgsvujwcbymjmvkjhy/functions
- **Database Editor:** https://supabase.com/dashboard/project/uqtgsvujwcbymjmvkjhy/editor

---

## 📝 Estrutura de Arquivos

```
docs/agent-v2/
├── README.md (este arquivo)
├── AGENT_V2_DEPLOYMENT_SUCCESS.md
├── AGENT_V2_DEPLOY_GUIDE.md
├── backend/
│   ├── AGENT_V2_ARCHITECTURE.md
│   └── AGENT_V2_IMPLEMENTATION.md
└── scripts/
    ├── test-agent-v2-clean.ps1
    └── deploy-agent-v2.ps1

backend/supabase/functions/
├── agente-detector/
│   ├── index.ts
│   ├── README.md
│   └── ARCHITECTURE.md
├── agente-narrator/
│   ├── index.ts
│   ├── README.md
│   └── INTEGRATION.md
└── agente-pipeline-v2/
    ├── index.ts
    ├── README.md
    ├── FLOW.md
    ├── DEPLOYMENT.md
    └── EXAMPLES.md

frontend/src/
├── app/api/agente/insights-v2/
│   ├── route.ts
│   ├── events/route.ts
│   ├── trigger/route.ts
│   └── [vários .md de documentação]
├── components/dashboard/
│   ├── InsightsV2Card.tsx
│   ├── InsightsV2Card.README.md
│   └── InsightsV2Card.EXAMPLES.md
├── hooks/
│   └── useInsightsV2.ts
└── types/
    └── agent-v2.ts

database/migrations/
└── 20260401_agent_v2_tables.sql
```

---

## ✅ Status dos Componentes

| Componente | Status | Versão |
|------------|--------|--------|
| Database Migration | ✅ Deployed | 20260401 |
| agente-detector | ✅ Active | v1 |
| agente-narrator | ✅ Active | v1 |
| agente-pipeline-v2 | ✅ Active | v1 |
| Frontend API Routes | ✅ Deployed | - |
| InsightsV2Card | ✅ Deployed | - |
| Cronjobs | ✅ Active | 2 jobs |

---

**Última atualização:** 2026-04-01  
**Mantido por:** Equipe Zykor
