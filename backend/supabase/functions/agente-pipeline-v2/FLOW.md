# 🔄 Fluxo do Orchestrator - Diagrama de Sequência

## Fluxo Completo (Com Eventos Detectados)

```
┌─────────┐  ┌─────────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐
│  Cron   │  │ Orchestrator│  │ Detector │  │ Narrator │  │ Discord │
│  Job    │  │             │  │          │  │          │  │         │
└────┬────┘  └──────┬──────┘  └────┬─────┘  └────┬─────┘  └────┬────┘
     │              │              │              │              │
     │ POST /agente-pipeline-v2   │              │              │
     │─────────────>│              │              │              │
     │              │              │              │              │
     │              │ 1. Detector  │              │              │
     │              │─────────────>│              │              │
     │              │              │              │              │
     │              │ Busca dados  │              │              │
     │              │<─────────────│              │              │
     │              │              │              │              │
     │              │ Aplica regras│              │              │
     │              │<─────────────│              │              │
     │              │              │              │              │
     │              │ Salva eventos│              │              │
     │              │<─────────────│              │              │
     │              │              │              │              │
     │              │ { eventos: 3 }              │              │
     │              │<─────────────│              │              │
     │              │              │              │              │
     │              │ 2. Narrator  │              │              │
     │              │──────────────┼─────────────>│              │
     │              │              │              │              │
     │              │              │ Busca eventos│              │
     │              │              │<─────────────│              │
     │              │              │              │              │
     │              │              │ Chama Gemini │              │
     │              │              │<─────────────│              │
     │              │              │              │              │
     │              │              │ Salva insights              │
     │              │              │<─────────────│              │
     │              │              │              │              │
     │              │ { insights: 1 }             │              │
     │              │<─────────────┼──────────────│              │
     │              │              │              │              │
     │              │ 3. Notificação (se crítico) │              │
     │              │──────────────┼──────────────┼─────────────>│
     │              │              │              │              │
     │              │              │              │  Embed enviado
     │              │<─────────────┼──────────────┼──────────────│
     │              │              │              │              │
     │ { success: true, insights: [...] }        │              │
     │<─────────────│              │              │              │
     │              │              │              │              │
```

## Fluxo Simplificado (Sem Eventos)

```
┌─────────┐  ┌─────────────┐  ┌──────────┐
│  Cron   │  │ Orchestrator│  │ Detector │
│  Job    │  │             │  │          │
└────┬────┘  └──────┬──────┘  └────┬─────┘
     │              │              │
     │ POST /agente-pipeline-v2   │
     │─────────────>│              │
     │              │              │
     │              │ 1. Detector  │
     │              │─────────────>│
     │              │              │
     │              │ { eventos: 0 }
     │              │<─────────────│
     │              │              │
     │              │ (Pula narrator e notificações)
     │              │              │
     │ { success: true, eventos: 0 }
     │<─────────────│              │
     │              │              │
```

## Decisões do Orchestrator

### 1. Chamar Narrator?
```typescript
if (detectorResult.eventos_detectados > 0) {
  await chamarNarrator(bar_id, data);
} else {
  console.log('Nenhum evento, pulando narrator');
}
```

**Razão**: Economia de custo e tempo. Narrator só roda quando necessário.

### 2. Enviar Notificação?
```typescript
const insightsCriticos = insights.filter(i => i.severidade === 'alta');
if (insightsCriticos.length > 0) {
  await enviarNotificacoes(insightsCriticos);
}
```

**Razão**: Evitar spam. Só notifica problemas críticos.

### 3. Continuar em Caso de Erro?
```typescript
try {
  await enviarNotificacao(...);
} catch (error) {
  console.error('Erro ao enviar notificação:', error);
  // Continua (notificação não é crítica)
}
```

**Razão**: Notificação é opcional. Pipeline não deve falhar por isso.

## Cenários de Execução

### Cenário 1: Dia Normal (Sem Anomalias)
```
09:00 → Cron dispara orchestrator
09:01 → Detector roda (2s)
09:02 → Nenhum evento detectado
09:02 → Pipeline completo
Custo: R$ 0
Tempo: 2s
```

### Cenário 2: Dia com Anomalias Leves
```
09:00 → Cron dispara orchestrator
09:01 → Detector roda (2s)
09:02 → 2 eventos detectados (severidade: media)
09:03 → Narrator roda (3s)
09:04 → 1 insight gerado (severidade: media)
09:04 → Sem notificação (não é crítico)
09:04 → Pipeline completo
Custo: R$ 0,001
Tempo: 5s
```

### Cenário 3: Dia com Anomalias Críticas
```
09:00 → Cron dispara orchestrator
09:01 → Detector roda (2s)
09:02 → 3 eventos detectados (1 alta, 2 media)
09:03 → Narrator roda (3s)
09:04 → 1 insight gerado (severidade: alta)
09:05 → Notificação enviada ao Discord
09:05 → Pipeline completo
Custo: R$ 0,001
Tempo: 5.5s
```

## Métricas de Sucesso

### Por Execução
- ✅ Eventos detectados
- ✅ Insights gerados
- ✅ Notificações enviadas
- ✅ Tempo total de execução
- ✅ Status (success/error)

### Agregadas (Mensal)
- Total de execuções
- Taxa de detecção (% de dias com eventos)
- Taxa de insights críticos
- Tempo médio de execução
- Taxa de erro

## Comparação: Monolítico vs Orquestrado

### V1 (Monolítico)
```
┌─────────────────────┐
│  agente-dispatcher  │
│                     │
│  • Busca dados      │
│  • Chama LLM        │
│  • Salva insights   │
│  • Notifica         │
└─────────────────────┘

Tempo: ~30s
Custo: ~R$ 0,05
Testabilidade: Difícil
```

### V2 (Orquestrado)
```
┌──────────────────────┐
│ agente-pipeline-v2   │
│                      │
│  ├─► Detector (2s)   │
│  ├─► Narrator (3s)   │
│  └─► Discord (0.5s)  │
└──────────────────────┘

Tempo: ~5.5s
Custo: ~R$ 0,001
Testabilidade: Fácil
```

## Vantagens do Orchestrator

### ✅ Coordenação Simples
- Chama funções especializadas
- Cada função faz uma coisa bem feita
- Fácil adicionar novas etapas

### ✅ Resiliência
- Se detector falhar, pipeline para
- Se narrator falhar, eventos ficam para retry
- Se Discord falhar, pipeline continua

### ✅ Observabilidade
- Heartbeat único para todo o pipeline
- Logs estruturados de cada etapa
- Métricas consolidadas

### ✅ Flexibilidade
- Pode chamar funções em ordem diferente
- Pode adicionar validações entre etapas
- Pode paralelizar etapas futuras

## Troubleshooting

### Problema: Detector não retorna eventos
```
Verificar:
1. Dados existem em eventos_base para a data?
2. Thresholds das regras estão corretos?
3. Comparativos históricos existem?
```

### Problema: Narrator não gera insights
```
Verificar:
1. Eventos estão em insight_events?
2. GEMINI_API_KEY está configurada?
3. Quota da API Gemini não esgotou?
```

### Problema: Notificações não chegam
```
Verificar:
1. Webhook Discord está configurado?
2. Insights têm severidade 'alta'?
3. Webhook URL está válida?
```

## Próximos Passos

1. ✅ Criar orchestrator (este prompt)
2. ⏳ Configurar cron job (Prompt 5)
3. ⏳ Criar frontend (Prompt 6)
