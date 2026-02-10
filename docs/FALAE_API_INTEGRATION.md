# Integração API Falaê - Ordinário Bar

## Status: ✅ IMPLEMENTADO (10/02/2026)

### Componentes Implementados:

1. **Tabelas no Supabase**:
   - `falae_respostas` - Armazena respostas NPS
   - `falae_config` - Configuração por bar (API key, search_id)
   - `v_falae_nps_periodo` - View para calcular NPS por período

2. **Edge Function**:
   - `falae-nps-sync` - Sincroniza respostas do Falaê para o banco
   - Uso: `GET /functions/v1/falae-nps-sync?bar_id=3&days_back=30`

3. **API Routes**:
   - `POST /api/falae/sync` - Dispara sincronização
   - `GET /api/falae/sync?bar_id=3&periodo=semana` - Métricas NPS
   - `GET /api/falae/nps-semanal?bar_id=3&semana=X&ano=Y` - NPS por semana

4. **Dashboard de Desempenho**:
   - Campo `falae_nps_score` integrado na Tabela de Desempenho
   - Exibido como "NPS Falaê" no grupo de qualidade/NPS
   - Dados atualizados automaticamente do Falaê

---

## Informações da API

| Campo | Valor |
|-------|-------|
| **URL Base** | `https://api-b2s.experienciab2s.com` |
| **Documentação** | https://docs.falae.app/api/ |
| **Swagger** | https://docs.falae.app/swagger |
| **Company ID** | `d166952d-97f9-4882-a724-fcebcc7efff8` |
| **Search ID (Salão)** | `9881c6ad-e76f-490e-9c7e-ddb7f3a47c5f` |

## Autenticação

Todas as requisições requerem Bearer Token no header:
```
Authorization: Bearer <FALAE_API_KEY>
```

## Endpoints Principais

### 1. Listar Pesquisas
```bash
GET /api/searches
```

### 2. Listar Respostas (NPS)
```bash
GET /api/answers?is_enps=false&date_start=2024-01-01&date_end=2024-01-31&limit=50&offset=0
```

**Parâmetros:**
- `is_enps`: false (NPS externo, não eNPS de funcionários)
- `date_start`: Data início (YYYY-MM-DD)
- `date_end`: Data fim (YYYY-MM-DD)
- `limit`: Máximo 50 por requisição
- `offset`: Para paginação

**Resposta:**
```json
{
  "limit": 50,
  "offset": 0,
  "total": 100,
  "data": [
    {
      "id": "uuid",
      "created_at": "2024-04-14T22:06:02.000Z",
      "nps": 10,
      "discursive_question": "Comentário do cliente",
      "client": {
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "(00) 0000-0000"
      },
      "criteria": [
        { "nick": "Ambiente", "name": "5", "type": "Rating" },
        { "nick": "Atendimento", "name": "5", "type": "Rating" }
      ]
    }
  ]
}
```

### 3. Cadastrar Cliente com Consumo
```bash
POST /api/clients/consumption
```

**Body:**
```json
{
  "name": "John Doe",
  "email": "johndoe@example.com",
  "phone": "(00) 0 0000-0000",
  "approved": true,
  "order_id": "contahub-12345",
  "order_value": 250.50,
  "order_created_at": "2025-01-14T22:00:00Z",
  "order_type": "Salão",
  "search_id": "9881c6ad-e76f-490e-9c7e-ddb7f3a47c5f"
}
```

## Questões da Pesquisa "Salão"

| ID | Tipo | Pergunta (pt-BR) |
|----|------|------------------|
| `16b951ee-2a20-48b1-a9fb-a98f1aff6ba8` | Like/Dislike | O atendente te convidou para responder a pesquisa? |
| `86d6a117-bb27-4c9e-9fcb-7f7e69b2a0b0` | Rating | Como você avalia o nosso AMBIENTE? |
| `d8d93835-a57c-4a76-89bd-76179032530f` | Rating | Como você avalia o nosso ATENDIMENTO? |
| `3b98f6e9-8f4b-4d08-944d-aa68cc36ce65` | Rating | Como você avalia a QUALIDADE DOS NOSSOS PRODUTOS? |
| (mais questões...) | Múltipla Escolha | Por que você veio hoje? |
| `1962237f-5509-4845-924b-7a2d4bcc9d9a` | Resposta Curta | O que você acredita que FALTA no Ordinário Bar & Música? |

## Uso no Zykor

### Sincronização de NPS

1. **Edge Function**: Criar `falae-nps-sync` para buscar respostas periodicamente
2. **Tabela**: `falae_respostas` para armazenar histórico
3. **Métricas**:
   - NPS Geral = (Promotores - Detratores) / Total × 100
   - NPS por critério (Ambiente, Atendimento, Produto, etc.)

### Cálculo de NPS
- **Promotores**: Nota 9-10
- **Neutros**: Nota 7-8
- **Detratores**: Nota 0-6

```
NPS = ((Promotores / Total) - (Detratores / Total)) × 100
```

## Secrets Necessários

| Nome | Descrição |
|------|-----------|
| `FALAE_API_KEY` | Token JWT do Ordinário |
| `FALAE_SEARCH_ID` | ID da pesquisa "Salão" |

## Próximos Passos

1. [ ] Adicionar `FALAE_API_KEY` como secret no Supabase
2. [ ] Criar tabela `falae_respostas` no banco
3. [ ] Criar Edge Function `falae-nps-sync`
4. [ ] Integrar NPS no dashboard de Desempenho
5. [ ] Configurar webhook para receber respostas em tempo real (opcional)
