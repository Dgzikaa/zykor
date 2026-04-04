# 🏗️ Agent V2 - Arquitetura Completa

## Visão Geral

Sistema modular de detecção de anomalias e geração de insights para operação de bares.

```
┌────────────────────────────────────────────────────────────────┐
│                      AGENT V2 SYSTEM                            │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐         ┌─────────────────┐              │
│  │   DETECTOR      │────────▶│    NARRATOR     │              │
│  │ (Determinístico)│         │     (LLM)       │              │
│  └─────────────────┘         └─────────────────┘              │
│         │                            │                         │
│         ▼                            ▼                         │
│  insight_events              agent_insights_v2                │
│  (eventos brutos)            (insights finais)                │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

## Componentes

### 1. Detector Determinístico
- **Localização**: `backend/supabase/functions/agente-detector/`
- **Função**: Detectar anomalias usando regras puras (sem LLM)
- **Input**: `{ bar_id, data }`
- **Output**: Eventos detectados salvos em `insight_events`
- **Custo**: R$ 0 (sem API calls)
- **Tempo**: ~2s

### 2. Narrator LLM
- **Localização**: `backend/supabase/functions/agente-narrator/`
- **Função**: Gerar insights acionáveis com LLM
- **Input**: `{ bar_id, data, eventos? }`
- **Output**: Insights salvos em `agent_insights_v2`
- **Custo**: ~R$ 0,001 por execução
- **Tempo**: ~3s

### 3. Orchestrator (Futuro - Prompt 4)
- **Função**: Coordenar detector + narrator
- **Responsabilidades**:
  - Chamar detector
  - Verificar se há eventos
  - Chamar narrator se houver eventos
  - Consolidar resultados

## Fluxo de Dados Completo

```
┌─────────────────────────────────────────────────────────────┐
│                    DADOS DE ENTRADA                          │
├─────────────────────────────────────────────────────────────┤
│  eventos_base        │  Métricas consolidadas do dia        │
│  vendas_item         │  Produtos vendidos                   │
│  bares_config        │  Configuração do bar                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               1️⃣ DETECTOR DETERMINÍSTICO                     │
├─────────────────────────────────────────────────────────────┤
│  • Busca métricas do dia                                    │
│  • Calcula comparativos (4 semanas, mensal)                 │
│  • Aplica 8 regras de detecção                              │
│  • Identifica anomalias                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    INSIGHT_EVENTS                            │
├─────────────────────────────────────────────────────────────┤
│  id                  │  UUID                                 │
│  bar_id              │  3                                    │
│  data                │  2026-03-30                           │
│  event_type          │  "queda_ticket_medio"                │
│  severity            │  "alta"                               │
│  evidence_json       │  ["ticket: R$ 78.50", "média: 92"]   │
│  processed           │  false  ◄─── Aguardando narrator     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  2️⃣ NARRATOR LLM                             │
├─────────────────────────────────────────────────────────────┤
│  • Busca eventos não processados                            │
│  • Busca contexto do dia                                    │
│  • Monta prompt especializado                               │
│  • Chama Gemini 2.0 Flash                                   │
│  • Parseia JSON de resposta                                 │
│  • Gera insights acionáveis                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  AGENT_INSIGHTS_V2                           │
├─────────────────────────────────────────────────────────────┤
│  id                  │  UUID                                 │
│  bar_id              │  3                                    │
│  data                │  2026-03-30                           │
│  titulo              │  "Queda Crítica no Ticket Médio"     │
│  descricao           │  "Análise detalhada..."              │
│  severidade          │  "alta"                               │
│  tipo                │  "problema"                           │
│  causa_provavel      │  "Mix de vendas deslocado..."        │
│  acoes_recomendadas  │  ["Revisar mix", "Analisar..."]      │
│  eventos_relacionados│  [uuid-1, uuid-2]                    │
│  resumo_geral        │  "Dia com performance abaixo..."     │
│  visualizado         │  false  ◄─── Para frontend           │
│  arquivado           │  false                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND DASHBOARD                        │
├─────────────────────────────────────────────────────────────┤
│  • Lista insights não visualizados                          │
│  • Mostra severidade e tipo                                 │
│  • Exibe ações recomendadas                                 │
│  • Permite arquivar/marcar como lido                        │
└─────────────────────────────────────────────────────────────┘
```

## Regras de Detecção (Detector)

| # | Evento | Threshold | Severidade | Descrição |
|---|--------|-----------|------------|-----------|
| 1 | `queda_ticket_medio` | < 90% média 4sem | Alta/Média | Clientes gastando menos |
| 2 | `queda_faturamento` | < 85% média 4sem | Alta/Média | Receita abaixo do esperado |
| 3 | `queda_clientes` | < 80% média 4sem | Alta/Média | Público reduzido |
| 4 | `aumento_custo` | > 115% média 4sem | Alta/Média | Custos anormalmente altos |
| 5 | `baixa_reserva` | < 70% média 4sem | Alta/Média | Reservas abaixo do normal |
| 6 | `performance_atracao_boa` | > 120% média | Baixa | Atração performando bem |
| 7 | `performance_atracao_ruim` | < 80% média | Média | Atração performando mal |
| 8 | `produto_anomalo` | Top mudou | Média | Mudança no mix de vendas |

## System Prompt (Narrator)

O Narrator usa um system prompt especializado que instrui o LLM a:

- ✅ Agir como analista sênior (operações + financeiro + growth)
- ✅ Detectar problemas e identificar oportunidades
- ✅ Explicar causas prováveis
- ✅ Sugerir ações práticas e executáveis
- ✅ Comparar com histórico
- ✅ Priorizar o que importa
- ✅ Usar linguagem clara e objetiva

## Tabelas do Sistema

### Input (Dados Operacionais)
- `eventos_base`: Métricas consolidadas diárias
- `vendas_item`: Produtos vendidos
- `bares_config`: Configuração do bar

### Intermediário (Eventos Detectados)
- `insight_events`: Eventos detectados pelo detector
  - `processed=false`: Aguardando narrator
  - `processed=true`: Já processado

### Output (Insights Finais)
- `agent_insights_v2`: Insights gerados pelo narrator
  - `visualizado=false`: Não lido pelo usuário
  - `arquivado=false`: Ativo

### Observabilidade
- `cron_heartbeats`: Logs de execução

## Exemplo End-to-End

### Cenário: Sexta-feira com performance ruim

#### 1. Detector Roda (09:00)
```json
POST /agente-detector { "bar_id": 3, "data": "2026-03-28" }

→ Detecta 3 eventos:
  - queda_ticket_medio (alta)
  - queda_faturamento (media)
  - performance_atracao_ruim (media)

→ Salva em insight_events (processed=false)
```

#### 2. Narrator Roda (09:01)
```json
POST /agente-narrator { "bar_id": 3, "data": "2026-03-28" }

→ Busca 3 eventos não processados
→ Busca contexto: faturamento=R$ 12.500, clientes=159, atração="Banda X"
→ Chama Gemini com prompt especializado
→ Gemini retorna:
{
  "insights": [{
    "titulo": "Performance Abaixo do Esperado - Banda X Não Converteu",
    "severidade": "alta",
    "tipo": "problema",
    "descricao": "A sexta-feira teve faturamento 18% abaixo da média (R$ 12.500 vs R$ 15.200 esperado). O ticket médio caiu para R$ 78.50 (vs R$ 92 histórico), indicando que os clientes consumiram menos. A Banda X teve custo de R$ 3.500 mas não gerou a conversão esperada.",
    "causa_provavel": "A Banda X pode não ter o perfil ideal para o público do bar, ou a divulgação foi insuficiente. Também é possível que o mix de produtos oferecido não tenha sido atrativo.",
    "acoes_recomendadas": [
      "Avaliar fit da Banda X com o público através de pesquisa pós-evento",
      "Comparar performance com outras atrações de custo similar",
      "Revisar estratégia de divulgação para próximas sextas",
      "Analisar mix de vendas: verificar se faltou algum produto chave"
    ]
  }],
  "resumo_geral": "Sexta-feira com performance 18% abaixo do esperado. Atração não converteu conforme histórico. Recomenda-se revisar estratégia de booking e divulgação."
}

→ Salva em agent_insights_v2
→ Marca eventos como processed=true
```

#### 3. Frontend Exibe (09:02)
```typescript
// Dashboard busca insights não visualizados
const { data } = await supabase
  .from('agent_insights_v2')
  .select('*')
  .eq('visualizado', false)
  .order('severidade', { ascending: false });

// Mostra card com:
// 🔴 ALTA - Performance Abaixo do Esperado
// "A sexta-feira teve faturamento 18% abaixo..."
// [Ações Recomendadas] [Marcar como Lido] [Arquivar]
```

## Vantagens da Arquitetura

### ✅ Separação de Responsabilidades
- **Detector**: Rápido, determinístico, sem custo
- **Narrator**: Contextualizado, acionável, baixo custo

### ✅ Rastreabilidade
- Eventos detectados ficam registrados
- Possível auditar o que gerou cada insight
- Histórico completo de detecções

### ✅ Economia
- LLM só roda quando necessário
- Custo ~R$ 0,001 por execução
- Custo mensal ~R$ 2 (60 execuções)

### ✅ Qualidade
- Regras precisas + narrativa contextualizada
- Insights acionáveis (não apenas dados)
- Causas prováveis + ações recomendadas

### ✅ Escalabilidade
- Fácil adicionar novas regras no detector
- Fácil ajustar system prompt do narrator
- Fácil testar componentes isoladamente

### ✅ Performance
- Detector: ~2s
- Narrator: ~3s
- Total: ~5s (vs 30s+ da versão monolítica)

## Comparação: V1 vs V2

| Aspecto | V1 (Monolítico) | V2 (Modular) |
|---------|-----------------|--------------|
| **Arquitetura** | 1 função com LLM | 2 funções (regras + LLM) |
| **Custo** | ~R$ 0,05/exec | ~R$ 0,001/exec |
| **Tempo** | ~30s | ~5s |
| **Rastreabilidade** | Baixa | Alta |
| **Testabilidade** | Difícil | Fácil |
| **Manutenção** | Complexa | Simples |
| **Qualidade** | Variável | Consistente |

## Próximos Passos

### ✅ Concluído (Prompts 1-3)
1. ✅ Tabelas criadas (`insight_events`, `agent_insights_v2`)
2. ✅ Detector implementado (8 regras)
3. ✅ Narrator implementado (LLM)

### ⏳ Pendente (Prompts 4-6)
4. ⏳ **Orchestrator**: Coordenar detector + narrator
5. ⏳ **Cron Job**: Execução diária automática
6. ⏳ **Frontend**: Dashboard para visualizar insights

## Estrutura de Arquivos

```
backend/supabase/functions/
├── agente-detector/
│   ├── index.ts              (470 linhas - regras de detecção)
│   ├── README.md             (documentação da API)
│   ├── ARCHITECTURE.md       (arquitetura detalhada)
│   └── test-payload.json     (exemplo de teste)
│
├── agente-narrator/
│   ├── index.ts              (358 linhas - geração com LLM)
│   ├── README.md             (documentação da API)
│   ├── INTEGRATION.md        (integração detector+narrator)
│   └── test-payload.json     (exemplo de teste)
│
├── _shared/
│   ├── cors.ts               (headers CORS)
│   ├── heartbeat.ts          (observabilidade)
│   ├── gemini-client.ts      (cliente Gemini)
│   ├── date-helpers.ts       (utilitários de data)
│   └── timezone.ts           (timezone BRT)
│
└── AGENT_V2_ARCHITECTURE.md  (este arquivo)

database/migrations/
└── 20260401_agent_v2_tables.sql  (tabelas do sistema)
```

## Testes

### Teste Completo (Detector + Narrator)

```bash
# 1. Rodar detector
curl -X POST http://localhost:54321/functions/v1/agente-detector \
  -H "Content-Type: application/json" \
  -d '{"bar_id": 3, "data": "2026-03-30"}'

# 2. Verificar eventos criados
SELECT * FROM insight_events WHERE processed = false;

# 3. Rodar narrator
curl -X POST http://localhost:54321/functions/v1/agente-narrator \
  -H "Content-Type: application/json" \
  -d '{"bar_id": 3, "data": "2026-03-30"}'

# 4. Verificar insights criados
SELECT * FROM agent_insights_v2 WHERE visualizado = false;
```

### Teste Unitário (Narrator Isolado)

```bash
curl -X POST http://localhost:54321/functions/v1/agente-narrator \
  -H "Content-Type: application/json" \
  -d @backend/supabase/functions/agente-narrator/test-payload.json
```

## Monitoramento

### Métricas Chave
- **Detector**: Eventos detectados por dia
- **Narrator**: Insights gerados por dia
- **Taxa de conversão**: Eventos → Insights
- **Tempo de resposta**: Detector + Narrator
- **Taxa de erro**: Falhas no LLM

### Dashboards
- `cron_heartbeats`: Histórico de execuções
- `insight_events`: Eventos detectados
- `agent_insights_v2`: Insights gerados

### Alertas
- Detector sem eventos por >3 dias (possível problema nos dados)
- Narrator com erro no LLM (API key, quota, etc)
- Insights não visualizados por >7 dias (usuário não está usando)

## Manutenção

### Ajustar Regras (Detector)
1. Editar `agente-detector/index.ts`
2. Modificar thresholds nas regras
3. Testar com dados históricos
4. Deploy

### Ajustar Narrativa (Narrator)
1. Editar `SYSTEM_PROMPT` em `agente-narrator/index.ts`
2. Testar com eventos reais
3. Validar qualidade dos insights
4. Deploy

### Adicionar Nova Regra
1. Adicionar lógica em `aplicarRegrasDeteccao()` (detector)
2. Definir `event_type`, `severity`, `evidence`
3. Narrator automaticamente processará o novo tipo de evento
4. Ajustar system prompt se necessário

## Custos Estimados

### Por Execução
- Detector: R$ 0 (regras puras)
- Narrator: R$ 0,001 (Gemini API)
- **Total**: R$ 0,001

### Mensal (2 bares, 30 dias)
- Execuções: 60
- Custo: R$ 0,06
- **Extremamente econômico!** 💰

### Comparação com V1
- V1: R$ 3,00/mês (50x mais caro)
- V2: R$ 0,06/mês
- **Economia: 98%** 🎉

## Segurança

### RLS (Row Level Security)
- Ambas as tabelas têm RLS habilitado
- Policies baseadas em `user_bar_access`
- Service role tem acesso total

### API Keys
- `GEMINI_API_KEY`: Necessária para narrator
- `SUPABASE_SERVICE_ROLE_KEY`: Necessária para ambos

## Roadmap

### Curto Prazo
- [ ] Criar orchestrator (Prompt 4)
- [ ] Configurar cron job (Prompt 5)
- [ ] Criar frontend (Prompt 6)

### Médio Prazo
- [ ] Adicionar mais regras de detecção
- [ ] Melhorar system prompt com feedback
- [ ] Criar dashboard de métricas do agente

### Longo Prazo
- [ ] ML para ajustar thresholds automaticamente
- [ ] Feedback loop: usuário valida insights
- [ ] Predição: alertas antes do problema acontecer
