# 🔍 Detector Determinístico - Agent V2

Edge Function que detecta eventos e anomalias usando **regras determinísticas puras** (sem LLM).

## Arquitetura

```
┌─────────────────┐
│  agente-detector│
│   (Edge Func)   │
└────────┬────────┘
         │
         ├─► Busca métricas do dia (eventos_base, vendas_item)
         ├─► Busca comparativos históricos (4 semanas, mensal)
         ├─► Aplica 8 regras de detecção
         └─► Salva eventos em insight_events
```

## Request

```json
{
  "bar_id": 3,
  "data": "2026-03-31"  // Opcional, default = ontem
}
```

## Response

```json
{
  "success": true,
  "data_analise": "2026-03-31",
  "eventos_detectados": 2,
  "eventos_salvos": 2,
  "eventos": [
    {
      "tipo": "queda_ticket_medio",
      "severidade": "alta",
      "evidencias": [
        "ticket_medio_dia: R$ 78.50",
        "media_ultimas_4_semanas: R$ 92.00",
        "variacao: -14.7%"
      ]
    },
    {
      "tipo": "aumento_custo",
      "severidade": "media",
      "evidencias": [
        "custo_total_dia: R$ 3500.00",
        "media_ultimas_4_semanas: R$ 2800.00",
        "variacao: +25.0%"
      ]
    }
  ]
}
```

## Regras de Detecção

| # | Tipo Evento | Condição | Severidade |
|---|-------------|----------|------------|
| 1 | `queda_ticket_medio` | ticket < média_4sem × 0.90 | alta se <-15%, media se <-10% |
| 2 | `queda_faturamento` | fat < média_4sem × 0.85 | alta se <-20%, media se <-15% |
| 3 | `queda_clientes` | clientes < média_4sem × 0.80 | alta se <-25%, media se <-20% |
| 4 | `aumento_custo` | custo > média_4sem × 1.15 | alta se >+25%, media se >+15% |
| 5 | `baixa_reserva` | reservas < média_4sem × 0.70 | alta se <-40%, media se <-30% |
| 6 | `performance_atracao_boa` | fat/cliente > média × 1.20 | baixa (oportunidade) |
| 7 | `performance_atracao_ruim` | fat/cliente < média × 0.80 | media |
| 8 | `produto_anomalo` | top produto mudou vs histórico | media |

## Comparativos Utilizados

- **Média 4 semanas (mesmo dia da semana)**: Compara com as últimas 4 ocorrências do mesmo dia da semana
- **Semana passada (mesmo dia)**: Compara com exatamente 7 dias atrás
- **Média mensal**: Compara com a média de todos os dias do mês atual

## Dados Buscados

### Métricas do Dia
- Faturamento (real_r)
- Clientes (cl_real)
- Ticket médio (t_medio)
- Reservas
- Custo total
- Atração
- Top 5 produtos vendidos

### Tabelas Consultadas
- `eventos_base`: Métricas consolidadas do dia
- `vendas_item`: Produtos vendidos para análise de mix
- `insight_events`: Tabela de destino para eventos detectados

## Integração

Esta função é chamada por:
- **Cron diário**: Roda automaticamente todo dia às 9h BRT
- **API manual**: Pode ser chamada via POST para análise sob demanda
- **Agente Narrator**: Consome os eventos detectados para gerar insights com LLM

## Próximos Passos

1. Criar `agente-narrator` (Edge Function com LLM)
2. Criar `agente-orchestrator` (coordena detector + narrator)
3. Configurar cron job para execução diária
4. Criar API routes no frontend para consumir insights

## Observabilidade

- Registra heartbeat em `cron_heartbeats`
- Logs estruturados com timestamps BRT
- Métricas de eventos detectados e salvos
