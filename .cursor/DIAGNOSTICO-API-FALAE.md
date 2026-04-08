# Diagnóstico: Estrutura de Retorno da API do Falaê

**Data:** 07/04/2026  
**Status:** Análise completa da estrutura de dados

---

## 📋 Resumo Executivo

A API do Falaê retorna dados de pesquisas NPS com uma estrutura específica que está sendo processada e armazenada corretamente no sistema. Este documento detalha:

1. Estrutura dos dados retornados pela API externa do Falaê
2. Como os dados são processados e armazenados no banco
3. Campos principais e suas transformações
4. Possíveis inconsistências identificadas

---

## 🔍 Estrutura da Resposta da API Externa

### Endpoint: `GET /api/answers`

**Base URL:** `https://api-b2s.experienciab2s.com`

**Parâmetros:**
- `is_enps`: boolean (false para NPS normal, true para eNPS)
- `date_start`: YYYY-MM-DD
- `date_end`: YYYY-MM-DD
- `limit`: número de registros por página (padrão: 50)
- `offset`: página atual (1, 2, 3...)

**Resposta:**
```json
{
  "data": [
    {
      "id": "580436ce-9fe4-46f3-bee6-3c8e1a928af0",
      "nps": 10,
      "created_at": "2026-03-31T22:28:03.000Z",
      "discursive_question": null,
      "search_id": "5ea57678-1748-4bb8-8558-782b2c47a6e8",
      "client_id": null,
      "consumption_id": null,
      "search": {
        "id": "5ea57678-1748-4bb8-8558-782b2c47a6e8",
        "name": "NPS Digital"
      },
      "client": {
        "id": null,
        "name": null,
        "email": null,
        "phone": null
      },
      "consumption": {
        "id": null,
        "order_id": null
      },
      "company": {
        "id": "d166952d-97f9-4882-a724-fcebcc7efff8",
        "name": "Ordinário Bar & Música"
      },
      "page": {},
      "criteria": [
        {
          "name": "5",
          "nick": "TEMPO DE ENTREGA",
          "type": "Rating",
          "suggestion": ""
        },
        {
          "name": "Lauane",
          "nick": "Atendentes Ordinário Bar & Música",
          "type": "Atendente",
          "suggestion": ""
        },
        {
          "name": "2026-03-28",
          "nick": "Data do pedido",
          "type": "Data",
          "suggestion": ""
        }
      ]
    }
  ],
  "total": 150
}
```

---

## 💾 Estrutura de Armazenamento no Banco

### Tabela: `falae_respostas`

| Campo | Tipo | Origem | Observações |
|-------|------|--------|-------------|
| `id` | uuid | Auto-gerado | PK da tabela |
| `bar_id` | integer | Credenciais | Mapeado via `api_credentials` |
| `falae_id` | text | `answer.id` | ID único da resposta no Falaê |
| `created_at` | timestamp | `answer.created_at` | Data/hora da criação da resposta |
| `nps` | integer | `answer.nps` | Nota NPS (0-10) |
| `discursive_question` | text | `answer.discursive_question` | Comentário do cliente |
| `client_id` | text | `answer.client.id` | ID do cliente |
| `client_name` | text | `answer.client.name` | Nome do cliente |
| `client_email` | text | `answer.client.email` | Email do cliente |
| `client_phone` | text | `answer.client.phone` | Telefone do cliente |
| `consumption_id` | text | `answer.consumption.id` | ID do consumo |
| `order_id` | text | `answer.consumption.order_id` | ID do pedido |
| `search_id` | text | `answer.search.id` | ID da pesquisa |
| `search_name` | text | `answer.search.name` | Nome da pesquisa (ex: "NPS Digital") |
| `criterios` | jsonb | `answer.criteria` | Array de critérios avaliados |
| `data_visita` | date | Extraído de `criteria` | Data real da visita (campo "Data do pedido") |
| `raw_data` | jsonb | Payload completo | Backup do payload original |
| `synced_at` | timestamp | Auto-gerado | Data/hora da sincronização |

---

## 🔄 Processamento dos Dados

### 1. Webhook (`/api/falae/webhook`)

**Fluxo:**
1. Recebe POST do Falaê com uma resposta individual
2. Valida token (Bearer, x-falae-token, query param ou payload)
3. Mapeia `bar_id` via `api_credentials` (por token ou company_id)
4. Extrai campos do payload usando `extractAnswerPayload()`
5. Processa `data_visita` dos critérios (busca campo "Data do pedido" tipo "Data")
6. Faz UPSERT em `falae_respostas` (conflict: `bar_id,falae_id`)
7. Recalcula agregados (`nps_falae_diario` e `nps_falae_diario_pesquisa`)

**Campos Processados:**
```typescript
{
  bar_id: Number(credencial.bar_id),
  falae_id: String(answer?.id),
  created_at: String(answer?.created_at || new Date().toISOString()),
  nps: parseNumeric(answer?.nps),
  discursive_question: answer?.discursive_question || null,
  criterios: answer?.criteria || answer?.criterios || answer?.questions || null,
  search_id: answer?.search_id || answer?.search?.id || null,
  search_name: answer?.search?.name || null,
  client_id: answer?.client_id || answer?.client?.id || null,
  client_name: answer?.client?.name || null,
  client_email: answer?.client?.email || null,
  client_phone: answer?.client?.phone || null,
  consumption_id: answer?.consumption?.id || null,
  order_id: answer?.consumption?.order_id || null,
  data_visita: extrairDataVisita(criterios),
  raw_data: payload,
  synced_at: new Date().toISOString()
}
```

### 2. Sync Manual (`/api/falae/sync`)

**Fluxo:**
1. Recebe POST com `bar_id` e `days_back` (padrão: 7 dias)
2. Busca credenciais em `api_credentials`
3. Faz paginação na API do Falaê (2 modos: `is_enps=false` e `is_enps=true`)
4. Coleta todas as respostas do período
5. Faz UPSERT em lote em `falae_respostas`
6. Recalcula agregados diários

**Particularidades:**
- Usa `offset` como número de página (1, 2, 3...), não índice absoluto
- Limite de 100 páginas por segurança
- Processa ambos os modos (NPS e eNPS) separadamente
- Remove duplicatas por `id` antes de inserir

### 3. Detailed Summary (`/api/falae/detailed-summary`)

**Fluxo:**
1. Recebe GET com `bar_id`, `data_inicio`, `data_fim`, `search_name` (opcional)
2. Busca respostas de `falae_respostas`
3. Filtra por `data_visita` (se disponível) ou `created_at`
4. Calcula métricas agregadas (NPS score, promotores, detratores, neutros)
5. Extrai médias por critério (tipo "Rating")
6. Retorna respostas detalhadas com comentários

---

## 📊 Estrutura dos Critérios

Os critérios vêm no campo `criteria` como array de objetos:

### Tipos de Critérios:

#### 1. Rating (Avaliação de 1-5)
```json
{
  "name": "5",
  "nick": "Atendimento",
  "type": "Rating",
  "suggestion": ""
}
```

#### 2. Atendente (Nome do atendente)
```json
{
  "name": "Lauane",
  "nick": "Atendentes Ordinário Bar & Música",
  "type": "Atendente",
  "suggestion": ""
}
```

#### 3. Data (Data da visita)
```json
{
  "name": "2026-03-28",
  "nick": "Data do pedido",
  "type": "Data",
  "suggestion": ""
}
```

### Extração da Data de Visita

O sistema busca automaticamente o critério com:
- `type === "Data"`
- `nick` contendo "data do pedido" (case-insensitive)
- `name` no formato YYYY-MM-DD

Esse valor é armazenado em `data_visita` e usado como data de referência nos cálculos.

---

## ⚠️ Possíveis Inconsistências Identificadas

### 1. **Data de Referência Ambígua**

**Problema:**
- `created_at`: Data/hora em que a resposta foi criada no Falaê
- `data_visita`: Data real da visita extraída dos critérios

**Impacto:**
- Se o cliente responde dias depois da visita, `created_at` não reflete a data real
- Agregações diárias podem ficar inconsistentes se usarem `created_at` em vez de `data_visita`

**Solução Atual:**
- Webhook e Sync priorizam `data_visita` quando disponível
- Fallback para `created_at` quando `data_visita` é null

**Recomendação:**
✅ **Sempre usar `data_visita` para agregações diárias**

---

### 2. **Campos de Cliente Frequentemente Nulos**

**Observação:**
Nos dados reais consultados, todos os registros têm:
- `client_name`: null
- `client_email`: null
- `client_phone`: null

**Possíveis Causas:**
- Pesquisa configurada como anônima
- Integração não captura dados de cliente
- Cliente não fornece informações

**Impacto:**
- Impossível rastrear cliente específico
- Não é possível fazer análise por perfil de cliente

**Recomendação:**
⚠️ **Verificar configuração da pesquisa no painel do Falaê**

---

### 3. **Inconsistência na Nomenclatura de Campos**

**Problema:**
O webhook aceita múltiplas variações do mesmo campo:

```typescript
// Critérios
answer?.criteria || answer?.criterios || answer?.questions

// Search ID
answer?.search_id || answer?.search?.id

// Client ID
answer?.client_id || answer?.client?.id
```

**Causa:**
- API do Falaê pode retornar estruturas diferentes
- Webhook precisa ser resiliente a variações

**Impacto:**
- Código mais complexo
- Possibilidade de bugs se nova estrutura aparecer

**Recomendação:**
✅ **Manter fallbacks, mas monitorar logs para identificar variações**

---

### 4. **Filtros da API `detailed-summary`**

**Problema:**
A query usa `.or()` para filtrar por `data_visita` ou `created_at`:

```typescript
.or(`data_visita.gte.${dataInicio},and(data_visita.is.null,created_at.gte.${dataInicio})`)
.or(`data_visita.lte.${dataFim},and(data_visita.is.null,created_at.lte.${dataFim}T23:59:59)`)
```

Depois faz filtro adicional no código:
```typescript
const filtradas = (respostas || []).filter((r: any) => {
  const dataRef = r.data_visita || r.created_at?.split('T')[0];
  return dataRef >= dataInicio && dataRef <= dataFim;
}) as any[];
```

**Impacto:**
- Filtro duplo (banco + código) pode causar confusão
- Performance: busca mais dados do que necessário

**Recomendação:**
⚠️ **Simplificar filtro para usar apenas `data_visita` ou `created_at` de forma consistente**

---

### 5. **Cálculo de NPS Score**

**Fórmula Atual:**
```typescript
const npsScore = total > 0 
  ? Math.round(((promotores - detratores) / total) * 100) 
  : null;
```

**Classificação:**
- **Promotores:** NPS >= 9
- **Neutros:** NPS >= 7 && NPS <= 8
- **Detratores:** NPS <= 6

**Validação:**
✅ Fórmula está correta e consistente em todas as APIs

---

## 📈 Tabelas Agregadas

### `nps_falae_diario`

Agregação diária por bar:

| Campo | Descrição |
|-------|-----------|
| `bar_id` | ID do bar |
| `data_referencia` | Data da visita (ou created_at) |
| `respostas_total` | Total de respostas no dia |
| `promotores` | Quantidade de promotores (NPS >= 9) |
| `neutros` | Quantidade de neutros (NPS 7-8) |
| `detratores` | Quantidade de detratores (NPS <= 6) |
| `nps_score` | Score NPS calculado |
| `nps_media` | Média das notas (0-10) |
| `atualizado_em` | Timestamp da última atualização |

### `nps_falae_diario_pesquisa`

Agregação diária por bar E tipo de pesquisa:

| Campo | Descrição |
|-------|-----------|
| `bar_id` | ID do bar |
| `data_referencia` | Data da visita |
| `search_name` | Nome da pesquisa (ex: "NPS Digital") |
| `respostas_total` | Total de respostas |
| `promotores` | Quantidade de promotores |
| `neutros` | Quantidade de neutros |
| `detratores` | Quantidade de detratores |
| `nps_score` | Score NPS calculado |
| `nps_media` | Média das notas |

**Atualização:**
- Via RPC `recalcular_nps_diario_pesquisa(p_bar_id, p_data_inicio, p_data_fim)`

---

## 🔧 APIs Disponíveis

### 1. `GET /api/falae/webhook`
Retorna configuração do webhook para setup

### 2. `POST /api/falae/webhook`
Recebe webhooks do Falaê (resposta individual)

### 3. `POST /api/falae/sync`
Sincronização manual de período (padrão: 7 dias)

**Body:**
```json
{
  "bar_id": 3,
  "days_back": 30
}
```

**Response:**
```json
{
  "success": true,
  "bar_id": 3,
  "periodo": {
    "inicio": "2026-03-08",
    "fim": "2026-04-07"
  },
  "respostas": {
    "encontradas": 150,
    "inseridas_atualizadas": 150,
    "erros": 0
  },
  "nps_periodo": 85,
  "nps_diario": {
    "dias_atualizados": 30,
    "respostas_total": 150
  },
  "nps_diario_pesquisa": {
    "rows_affected": 30
  }
}
```

### 4. `GET /api/falae/sync`
Consulta métricas de período (semana, mês, trimestre)

**Query Params:**
- `bar_id`: ID do bar
- `periodo`: "semana" | "mes" | "trimestre"

### 5. `GET /api/falae/detailed-summary`
Detalhamento completo de respostas por período e pesquisa

**Query Params:**
- `bar_id`: ID do bar (obrigatório)
- `data_inicio`: YYYY-MM-DD (obrigatório)
- `data_fim`: YYYY-MM-DD (obrigatório)
- `search_name`: Nome da pesquisa (opcional)

**Response:**
```json
{
  "success": true,
  "summary": {
    "searchName": "NPS Digital",
    "total": 50,
    "npsScore": 85,
    "promotores": 45,
    "neutros": 3,
    "detratores": 2,
    "mediaNotas": 9.2,
    "respostas": [
      {
        "id": "580436ce-9fe4-46f3-bee6-3c8e1a928af0",
        "nps": 10,
        "data": "31/03/2026",
        "dataVisita": "28/03/2026",
        "comentario": null,
        "clientName": null,
        "clientEmail": null,
        "tipo": "promotor",
        "criterios": [
          { "nome": "Atendimento", "nota": 5 },
          { "nome": "Ambiente", "nota": 5 }
        ]
      }
    ],
    "criteriosMedia": [
      { "nome": "Atendimento", "media": 4.8, "total": 50 },
      { "nome": "Ambiente", "media": 4.6, "total": 50 }
    ]
  }
}
```

---

## ✅ Checklist de Validação

Para verificar se os dados estão consistentes:

### 1. Verificar Credenciais
```sql
SELECT bar_id, sistema, empresa_id, ativo, atualizado_em
FROM api_credentials
WHERE sistema = 'falae' AND ativo = true;
```

### 2. Verificar Respostas Recentes
```sql
SELECT 
  falae_id,
  nps,
  created_at,
  data_visita,
  search_name,
  client_name,
  client_email
FROM falae_respostas
WHERE bar_id = 3
ORDER BY created_at DESC
LIMIT 10;
```

### 3. Verificar Agregações Diárias
```sql
SELECT 
  data_referencia,
  respostas_total,
  promotores,
  detratores,
  nps_score
FROM nps_falae_diario
WHERE bar_id = 3
ORDER BY data_referencia DESC
LIMIT 10;
```

### 4. Verificar Agregações por Pesquisa
```sql
SELECT 
  data_referencia,
  search_name,
  respostas_total,
  nps_score
FROM nps_falae_diario_pesquisa
WHERE bar_id = 3
ORDER BY data_referencia DESC, search_name
LIMIT 10;
```

### 5. Comparar Totais
```sql
-- Total de respostas brutas
SELECT COUNT(*) as total_respostas
FROM falae_respostas
WHERE bar_id = 3 AND created_at >= '2026-03-01';

-- Total agregado
SELECT SUM(respostas_total) as total_agregado
FROM nps_falae_diario
WHERE bar_id = 3 AND data_referencia >= '2026-03-01';
```

---

## 🎯 Recomendações Finais

### Curto Prazo:
1. ✅ **Validar que `data_visita` está sendo extraída corretamente**
2. ⚠️ **Verificar por que campos de cliente estão sempre nulos**
3. ✅ **Confirmar que agregações usam `data_visita` como prioridade**

### Médio Prazo:
1. 📊 **Adicionar logs detalhados no webhook para debug**
2. 🔍 **Criar dashboard de monitoramento de sync**
3. 📝 **Documentar variações de estrutura da API do Falaê**

### Longo Prazo:
1. 🚀 **Implementar validação de schema dos payloads**
2. 🔔 **Alertas automáticos para inconsistências**
3. 📈 **Métricas de qualidade dos dados (% campos nulos, etc)**

---

## 📞 Contatos e Referências

- **Painel Falaê:** https://plataforma.falae.app/
- **Webhook Config:** https://plataforma.falae.app/rede/integracao/webhook
- **API Base URL:** https://api-b2s.experienciab2s.com

---

**Última Atualização:** 07/04/2026  
**Autor:** Sistema Zykor  
**Versão:** 1.0
