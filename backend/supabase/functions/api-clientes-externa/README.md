# API Clientes Externa - GoBar

API REST para acesso externo aos dados de clientes do Zykor.

## 🔐 Autenticação

Todas as requisições devem incluir o header:
```
x-api-key: YOUR_API_KEY
```

## 🚦 Rate Limiting

- **Limite:** 100 requisições por minuto
- **Resposta quando excedido:** HTTP 429 com `{"code": "RATE_LIMIT"}`

---

## 📡 Endpoints

### 1. Listar Clientes

```http
GET /api-clientes-externa?bar_id=3
```

**Parâmetros de Query:**

| Parâmetro | Tipo | Obrigatório | Descrição | Default |
|-----------|------|-------------|-----------|---------|
| `bar_id` | integer | ✅ Sim | ID do bar (3=Ordinário, 4=Deboche) | - |
| `page` | integer | Não | Número da página | 1 |
| `limit` | integer | Não | Itens por página (max: 500) | 100 |
| `busca` | string | Não | Busca por nome ou telefone | - |
| `min_visitas` | integer | Não | Mínimo de visitas | 1 |
| `ordenar` | string | Não | Campo para ordenar: `visitas`, `nome`, `ultima_visita`, `total_gasto`, `total_consumo` | visitas |
| `ordem` | string | Não | Ordem: `asc` ou `desc` | desc |
| `ultima_visita_desde` | date | Não | Filtrar por data mínima da última visita (YYYY-MM-DD) | - |
| `ultima_visita_ate` | date | Não | Filtrar por data máxima da última visita (YYYY-MM-DD) | - |

**Resposta:**

```json
{
  "success": true,
  "data": {
    "clientes": [
      {
        "telefone": "61999999999",
        "nome": "João Silva",
        "total_visitas": 15,
        "ultima_visita": "2026-04-09",
        "dias_desde_ultima_visita": 1,
        "status": "ativo",
        "is_vip": true,
        "total_gasto": 2500.00,
        "total_entrada": 300.00,
        "total_consumo": 2200.00,
        "ticket_medio": 166.67,
        "ticket_medio_entrada": 20.00,
        "ticket_medio_consumo": 146.67,
        "atualizado_em": "2026-04-10T14:30:00Z"
      }
    ],
    "paginacao": {
      "pagina_atual": 1,
      "total_paginas": 10,
      "total_clientes": 1000,
      "por_pagina": 100
    }
  },
  "meta": {
    "bar_id": 3,
    "versao_api": "2.0",
    "campos_disponiveis": [...],
    "status_possiveis": ["novo", "ativo", "em_risco", "inativo"],
    "criterios_vip": "ticket_medio > R$ 150 OU total_visitas >= 10",
    "filtros_aplicados": {...}
  }
}
```

---

### 2. Buscar Cliente por Telefone

```http
GET /api-clientes-externa?bar_id=3&telefone=61999999999
```

**Parâmetros de Query:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `bar_id` | integer | ✅ Sim | ID do bar |
| `telefone` | string | ✅ Sim | Telefone do cliente (com ou sem formatação) |
| `data_desde` | date | Não | Filtrar histórico a partir de (YYYY-MM-DD) |
| `data_ate` | date | Não | Filtrar histórico até (YYYY-MM-DD) |

**Resposta:**

```json
{
  "success": true,
  "data": {
    "cliente": {
      "telefone": "61999999999",
      "nome": "João Silva",
      "total_visitas": 15,
      "primeira_visita": "2025-03-15",
      "ultima_visita": "2026-04-09",
      "dias_desde_ultima_visita": 1,
      "dias_desde_primeira_visita": 390,
      "frequencia_media_dias": 27.9,
      "status": "ativo",
      "is_vip": true,
      "total_gasto": 2500.00,
      "total_entrada": 300.00,
      "total_consumo": 2200.00,
      "ticket_medio": 166.67,
      "ticket_medio_entrada": 20.00,
      "ticket_medio_consumo": 146.67,
      "atualizado_em": "2026-04-10T14:30:00Z"
    },
    "historico": [
      {
        "data": "2026-04-09",
        "dia_semana": "Quarta",
        "nome": "João Silva",
        "valor_pagamentos": 180.50,
        "valor_consumo": 155.50,
        "valor_produtos": 155.50,
        "valor_couvert": 25.00,
        "classificacao_gasto": "medio"
      }
    ],
    "resumo_historico": {
      "total_visitas_no_periodo": 15,
      "gasto_total_no_periodo": "2500.00",
      "ticket_medio_no_periodo": "166.67",
      "dia_semana_favorito": {
        "Sexta": 6,
        "Sábado": 5,
        "Quinta": 4
      }
    },
    "filtros_aplicados": {
      "data_desde": null,
      "data_ate": null
    }
  }
}
```

---

### 3. Estatísticas Gerais do Bar

```http
GET /api-clientes-externa?bar_id=3&stats=true
```

**Resposta:**

```json
{
  "success": true,
  "data": {
    "bar_id": 3,
    "periodo": {
      "data_mais_antiga": "2025-02-28",
      "data_mais_recente": "2026-04-09",
      "dias_de_dados": 405
    },
    "clientes": {
      "total": 95000,
      "ativos_ultimos_30_dias": 15000,
      "inativos_ultimos_30_dias": 80000,
      "percentual_ativos": "15.8"
    },
    "visitas": {
      "total": 153000,
      "media_por_cliente": "1.6"
    },
    "financeiro": {
      "total_gasto": "18500000.00",
      "total_entrada": "2100000.00",
      "total_consumo": "16400000.00",
      "ticket_medio_geral": "120.92"
    },
    "vip": {
      "total_clientes_vip": 9500,
      "percentual_clientes": "10.0",
      "total_gasto_vip": "12000000.00",
      "percentual_gasto": "64.9",
      "ticket_medio_vip": "185.50"
    },
    "top_5_clientes": [
      {
        "telefone": "61999999999",
        "nome": "João Silva",
        "total_visitas": 150,
        "total_gasto": "25000.00",
        "ultima_visita": "2026-04-09"
      }
    ],
    "atualizado_em": "2026-04-10T14:30:00Z"
  }
}
```

---

## 📊 Campos Explicados

### Status do Cliente

| Status | Descrição |
|--------|-----------|
| `novo` | Cliente sem visitas registradas |
| `ativo` | Visitou nos últimos 30 dias |
| `em_risco` | Não visita há 31-90 dias |
| `inativo` | Não visita há mais de 90 dias |

### Classificação de Gasto (Histórico)

| Classificação | Valor |
|---------------|-------|
| `baixo` | < R$ 100 |
| `medio` | R$ 100 - R$ 200 |
| `alto` | > R$ 200 |

### Critérios VIP

Um cliente é considerado VIP se:
- **Ticket médio > R$ 150** OU
- **Total de visitas >= 10**

---

## 🔄 Atualização dos Dados

- **Fonte de Dados:** `contahub_periodo` (fonte única de verdade)
- **Atualização:** Dados sincronizados automaticamente via `pg_cron` às 7h e 19h
- **Latência:** Dados disponíveis em até 5 minutos após sincronização

---

## ❌ Códigos de Erro

| Código | Status | Descrição |
|--------|--------|-----------|
| `MISSING_CONFIG` | 500 | API Key não configurada no servidor |
| `MISSING_API_KEY` | 401 | Header x-api-key não fornecido |
| `INVALID_API_KEY` | 403 | API Key inválida |
| `RATE_LIMIT` | 429 | Limite de requisições excedido |
| `MISSING_BAR_ID` | 400 | Parâmetro bar_id não fornecido |
| `DATABASE_ERROR` | 500 | Erro ao consultar banco de dados |
| `INTERNAL_ERROR` | 500 | Erro interno do servidor |

---

## 📝 Exemplos de Uso

### Buscar clientes VIP ativos

```bash
curl -X GET "https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/api-clientes-externa?bar_id=3&min_visitas=10&ordenar=total_gasto&ordem=desc" \
  -H "x-api-key: YOUR_API_KEY"
```

### Buscar cliente específico com histórico dos últimos 30 dias

```bash
curl -X GET "https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/api-clientes-externa?bar_id=3&telefone=61999999999&data_desde=2026-03-10" \
  -H "x-api-key: YOUR_API_KEY"
```

### Obter estatísticas gerais do bar

```bash
curl -X GET "https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/api-clientes-externa?bar_id=3&stats=true" \
  -H "x-api-key: YOUR_API_KEY"
```

---

## 🎯 Garantia de Qualidade

✅ **100% Sincronizado** - Todos os dados vêm da fonte única `contahub_periodo`  
✅ **Sem Duplicatas** - Validação automática de integridade  
✅ **Sempre Atualizado** - Views calculadas em tempo real  
✅ **Performance Otimizada** - Materialized views para cache  
✅ **Dados Validados** - Comparado com ContaHub e Excel

---

## 📞 Suporte

Em caso de dúvidas ou problemas, entre em contato com a equipe Zykor.
