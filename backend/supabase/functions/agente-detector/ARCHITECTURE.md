# 🏗️ Arquitetura Agent V2 - Detector Determinístico

## Visão Geral

O **Detector Determinístico** é o primeiro componente da arquitetura modular do Agent V2. Ele substitui a abordagem monolítica anterior por um sistema de **detecção baseada em regras + narrativa com LLM**.

## Componentes do Sistema

```
┌──────────────────────────────────────────────────────────┐
│                    AGENT V2 SYSTEM                        │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  1. DETECTOR (esta função)                               │
│     ├─► Regras determinísticas                           │
│     ├─► Sem LLM                                           │
│     └─► Salva em: insight_events                         │
│                                                           │
│  2. NARRATOR (próximo prompt)                            │
│     ├─► Consome insight_events                           │
│     ├─► Usa LLM (Gemini)                                  │
│     └─► Salva em: agent_insights_v2                      │
│                                                           │
│  3. ORCHESTRATOR (futuro)                                │
│     └─► Coordena detector + narrator                     │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

## Fluxo de Dados

```
eventos_base + vendas_item
         │
         ▼
   [DETECTOR] ──► Aplica 8 regras
         │
         ▼
  insight_events (eventos detectados)
         │
         ▼
   [NARRATOR] ──► Gera narrativa com LLM
         │
         ▼
  agent_insights_v2 (insights finais)
         │
         ▼
    Frontend (Dashboard)
```

## Regras Implementadas

### 1. Queda Ticket Médio
- **Threshold**: < 90% da média 4 semanas
- **Severidade**: Alta se <-15%, Média se <-10%
- **Uso**: Detecta quando clientes estão gastando menos

### 2. Queda Faturamento
- **Threshold**: < 85% da média 4 semanas
- **Severidade**: Alta se <-20%, Média se <-15%
- **Uso**: Detecta quedas significativas de receita

### 3. Queda Clientes
- **Threshold**: < 80% da média 4 semanas
- **Severidade**: Alta se <-25%, Média se <-20%
- **Uso**: Detecta redução de público

### 4. Aumento Custo
- **Threshold**: > 115% da média 4 semanas
- **Severidade**: Alta se >+25%, Média se >+15%
- **Uso**: Detecta custos anormalmente altos

### 5. Baixa Reserva
- **Threshold**: < 70% da média 4 semanas
- **Severidade**: Alta se <-40%, Média se <-30%
- **Uso**: Detecta queda em reservas antecipadas

### 6. Performance Atração Boa
- **Threshold**: Faturamento/cliente > 120% da média
- **Severidade**: Baixa (oportunidade)
- **Uso**: Identifica atrações que performam bem

### 7. Performance Atração Ruim
- **Threshold**: Faturamento/cliente < 80% da média
- **Severidade**: Média
- **Uso**: Identifica atrações que performam mal

### 8. Produto Anômalo
- **Threshold**: Top produto mudou vs histórico
- **Severidade**: Média
- **Uso**: Detecta mudanças no mix de vendas

## Comparativos Utilizados

### Média 4 Semanas (Mesmo Dia)
- Busca as últimas 4 ocorrências do mesmo dia da semana
- Ex: Se hoje é sexta, compara com as últimas 4 sextas
- **Uso**: Normaliza sazonalidade semanal

### Semana Passada (Mesmo Dia)
- Compara com exatamente 7 dias atrás
- **Uso**: Detecta mudanças recentes

### Média Mensal
- Média de todos os dias do mês atual
- **Uso**: Contexto mensal para tendências

## Estrutura de Dados

### Input (Request)
```typescript
{
  bar_id: number;      // Obrigatório
  data?: string;       // Opcional, default = ontem (YYYY-MM-DD)
}
```

### Output (Response)
```typescript
{
  success: boolean;
  data_analise: string;
  eventos_detectados: number;
  eventos_salvos: number;
  eventos: Array<{
    tipo: string;
    severidade: 'baixa' | 'media' | 'alta';
    evidencias: string[];
  }>;
}
```

### Evento Salvo (insight_events)
```typescript
{
  id: UUID;
  bar_id: number;
  data: DATE;
  event_type: string;
  severity: 'baixa' | 'media' | 'alta';
  evidence_json: string[];  // Array de strings com evidências
  processed: boolean;       // false até ser processado pelo narrator
  created_at: timestamp;
}
```

## Vantagens da Arquitetura V2

### ✅ Separação de Responsabilidades
- Detector: Regras puras, rápido, determinístico
- Narrator: LLM para contexto e narrativa

### ✅ Custo Otimizado
- LLM só roda quando há eventos detectados
- Detecção é gratuita (sem API calls)

### ✅ Rastreabilidade
- Eventos detectados ficam registrados
- Possível auditar o que disparou cada insight

### ✅ Escalabilidade
- Fácil adicionar novas regras
- Fácil ajustar thresholds
- Fácil testar regras isoladamente

### ✅ Performance
- Detecção roda em <2s
- Narrator só processa eventos relevantes

## Próximos Passos

1. ✅ Criar tabelas (`insight_events`, `agent_insights_v2`)
2. ✅ Criar detector determinístico
3. ⏳ Criar narrator com LLM (Prompt 3)
4. ⏳ Criar orchestrator (Prompt 4)
5. ⏳ Configurar cron job (Prompt 5)
6. ⏳ Criar frontend para visualização (Prompt 6)

## Testes

### Teste Manual
```bash
curl -X POST https://your-project.supabase.co/functions/v1/agente-detector \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"bar_id": 3, "data": "2026-03-30"}'
```

### Teste Local (Supabase CLI)
```bash
supabase functions serve agente-detector
curl -X POST http://localhost:54321/functions/v1/agente-detector \
  -H "Content-Type: application/json" \
  -d @backend/supabase/functions/agente-detector/test-payload.json
```

## Monitoramento

- **Heartbeats**: Registrados em `cron_heartbeats`
- **Logs**: Console logs estruturados com timestamps BRT
- **Métricas**: Eventos detectados, eventos salvos, duração

## Manutenção

### Ajustar Thresholds
Editar as constantes nas regras (ex: `0.90`, `0.85`, etc.)

### Adicionar Nova Regra
1. Adicionar lógica em `aplicarRegrasDeteccao()`
2. Definir `event_type`, `severity` e `evidence`
3. Testar com dados históricos

### Desabilitar Regra
Comentar o bloco da regra em `aplicarRegrasDeteccao()`
