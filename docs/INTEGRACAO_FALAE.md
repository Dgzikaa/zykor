# Integração Falaê - Documentação Completa

> **Versão da API:** 1.0.2 (OAS 3.0)  
> **Status:** 🔜 Integração Planejada  
> **Última atualização:** Fevereiro 2025  
> **Website:** https://www.falae.app  
> **Contato:** contato@falae.app

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Ambientes Disponíveis](#ambientes-disponíveis)
3. [Autenticação](#autenticação)
4. [Endpoints da API](#endpoints-da-api)
   - [Answers (Respostas)](#answers-respostas)
   - [Clients (Clientes)](#clients-clientes)
   - [Companies (Empresas)](#companies-empresas)
   - [Searches (Pesquisas)](#searches-pesquisas)
   - [Exports (Exportações)](#exports-exportações)
   - [Coupons (Cupons)](#coupons-cupons)
   - [Activities (Atividades)](#activities-atividades)
   - [Awardeds (Premiados)](#awardeds-premiados)
5. [Webhook](#webhook)
6. [Códigos de Erro](#códigos-de-erro)
7. [Casos de Uso para Zykor](#casos-de-uso-para-zykor)

---

## 📖 Visão Geral

O **Falaê** é uma plataforma de pesquisa de satisfação que oferece recursos completos para:

- Gerenciar pesquisas de satisfação (NPS)
- Cadastrar e gerenciar clientes
- Controlar cupons de fidelidade
- Gerenciar programa de premiados/sorteios
- Registrar atividades de contato com clientes
- Exportar relatórios consolidados
- Automatizar envio de dados via Webhook

### Documentação Interativa (Swagger)

🔗 [Swagger API do Falaê](https://api-b2s.experienciab2s.com/docs)

---

## 🌐 Ambientes Disponíveis

| Ambiente | URL |
|----------|-----|
| **Desenvolvimento** | `http://localhost:3333` |
| **Staging (Teste)** | `https://teste-api.falae.app` |
| **Produção** | `https://api-b2s.experienciab2s.com` |

---

## 🔐 Autenticação

A API utiliza **JWT (JSON Web Token)** para autenticação. O token deve ser enviado no header de todas as requisições:

```http
Authorization: Bearer <SEU_TOKEN>
```

> ⚠️ Para obter um token de autenticação, entre em contato com a equipe do Falaê: **contato@falae.app**

---

## 🚀 Endpoints da API

---

## Answers (Respostas)

### 1. Listar Respostas de Pesquisas

```http
GET /api/answers
```

Retorna uma lista de respostas de pesquisas, com opções de filtro e paginação. Máximo de 50 respostas por requisição.

#### Parâmetros de Query

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `is_enps` | boolean | ✅ | Filtra respostas relacionadas ao eNPS |
| `date_start` | string | ✅ | Data de início no formato `YYYY-MM-DD` |
| `date_end` | string | ✅ | Data de fim no formato `YYYY-MM-DD` |
| `limit` | integer | ✅ | Número máximo de respostas (máximo 50) |
| `offset` | integer | ✅ | Número de respostas a pular (paginação) |
| `search_id` | string (UUID) | ❌ | ID da pesquisa para filtrar respostas |
| `clients_only` | boolean | ❌ | Retorna apenas respostas de clientes (default: false) |

#### Exemplo de Requisição

```bash
curl -X GET "https://api-b2s.experienciab2s.com/api/answers?is_enps=true&date_start=2024-01-01&date_end=2024-01-31&limit=50&offset=0" \
     -H "Authorization: Bearer SEU_TOKEN"
```

#### Resposta (200 - OK)

```json
{
  "limit": 50,
  "offset": 0,
  "total": 2,
  "data": [
    {
      "id": "103a525c-0ce3-4182-a504-aad595425233",
      "created_at": "2024-04-14T22:06:02.000Z",
      "nps": 10,
      "search": {
        "id": "103a525c-0ce3-4182-a504-aad595425233",
        "name": "Salão"
      },
      "discursive_question": "",
      "company": {
        "id": "103a525c-0ce3-4182-a504-aad595425233",
        "name": "Empresa 1"
      },
      "client": {
        "id": "103a525c-0ce3-4182-a504-aad595425233",
        "name": "John Doe",
        "email": "johndoe@example.com",
        "phone": "(00) 0 0000-0000",
        "born_date": "25/02/1980"
      },
      "criteria": [
        {
          "nick": "Atendimento",
          "name": "10",
          "suggestion": "",
          "type": "NPS"
        }
      ]
    }
  ]
}
```

---

### 2. Buscar Resposta por ID

```http
GET /api/answers/{id}
```

Retorna informações detalhadas sobre uma resposta específica, incluindo dados de cliente, consumo, empresa, página e critérios.

#### Parâmetros de Caminho

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | string (UUID) | ✅ | Identificador único da resposta |

#### Resposta (200 - OK)

```json
{
  "id": "03944421-7382-4d05-a278-80b44e7cb742",
  "created_at": "2023-09-08T23:00:00.000Z",
  "nps": 10,
  "discursive_question": null,
  "company": {
    "id": "203a525c-0ce3-4182-a504-aad595425233",
    "name": "Company Setup - 2"
  },
  "search": {
    "id": "203a525c-0ce3-4182-a504-aad595425233",
    "name": "Delivery"
  },
  "page": {
    "id": "103a525c-0ce3-4182-a504-aad595425233",
    "name": "Retirada"
  },
  "client": {
    "id": "03944421-7382-4d05-a278-80b44e7cb742",
    "name": "John",
    "email": "john@example.com",
    "phone": null,
    "born_date": null
  },
  "consumption": {
    "id": "03944421-7382-4d05-a278-80b44e7cb742",
    "order_id": "order_1"
  },
  "criteria": [
    {
      "name": "Lorem",
      "nick": "Resposta Curta",
      "suggestion": null,
      "type": "Resposta Curta"
    },
    {
      "name": "4",
      "nick": "Rating",
      "suggestion": null,
      "type": "Rating"
    },
    {
      "name": "10",
      "nick": "NPS",
      "suggestion": null,
      "type": "NPS"
    },
    {
      "name": "3",
      "nick": "Emoticon",
      "suggestion": null,
      "type": "Emoticon"
    }
  ]
}
```

---

### 3. Atualizar Status da Resposta

```http
PATCH /api/answers/{id}
```

Atualiza o status de uma resposta específica. Permite alterar o status de processamento das respostas dos clientes para gerenciamento de workflow.

#### Parâmetros de Caminho

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | string (UUID) | ✅ | Identificador único da resposta |

#### Corpo da Requisição

```json
{
  "status": "in-progress"
}
```

#### Resposta (201 - Atualizado)

```json
{}
```

---

### 4. Criar Closed Loop (Feedback de Acompanhamento)

```http
POST /api/answers/{id}/description
```

Cria um closed loop (descrição de feedback) para uma resposta específica. Permite adicionar informações de acompanhamento ou detalhes de resolução.

#### Parâmetros de Caminho

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | string (UUID) | ✅ | Identificador único da resposta |

#### Corpo da Requisição

```json
{
  "message": "Customer issue was resolved by providing a discount coupon and following up via phone call.",
  "user_email": "support@company.com",
  "user_name": "Support Agent"
}
```

#### Resposta (201 - Criado)

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "answer_id": "03944421-7382-4d05-a278-80b44e7cb742",
  "description": "Customer issue was resolved by providing a discount coupon and following up via phone call.",
  "user_email": "support@company.com",
  "user_name": "Support Agent - API",
  "created_at": "2024-04-15T14:30:00.000Z"
}
```

---

## Clients (Clientes)

### 5. Criar um Cliente

```http
POST /api/clients
```

Cria um novo cliente com geração opcional de link de pesquisa.

#### Corpo da Requisição

```json
{
  "name": "John Doe",
  "email": "johndoe@example.com",
  "phone": "(00) 0 0000-0000",
  "born_date": "25/02/1980",
  "approved": true,
  "search_id": "102a525c-0ce3-4182-a504-aad595425233"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `name` | string | ✅ | Nome do cliente |
| `email` | string | ❌ | E-mail do cliente |
| `phone` | string | ❌ | Telefone do cliente |
| `born_date` | string | ❌ | Data de nascimento (DD/MM/YYYY) |
| `approved` | boolean | ❌ | Cliente aprovou receber comunicações |
| `search_id` | string (UUID) | ❌ | ID da pesquisa para gerar link |

#### Resposta (200 - Criado)

```json
{
  "message": "Client created with success",
  "id": "ef9fa264-3850-4bd2-875e-2b40a4dd432f",
  "link": "https://pesquisa.falae.app"
}
```

---

### 6. Criar Cliente com Consumo

```http
POST /api/clients/consumption
```

Cria um cliente e registra informações de consumo com geração opcional de link de pesquisa.

#### Corpo da Requisição

```json
{
  "name": "John Doe",
  "email": "johndoe@example.com",
  "phone": "(00) 0 0000-0000",
  "born_date": "25/02/1980",
  "approved": true,
  "order_id": "plataforma-22",
  "order_value": 25.5,
  "order_created_at": "2025-01-14T10:00:00Z",
  "order_type": "Delivery",
  "search_id": "102a525c-0ce3-4182-a504-aad595425233"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `name` | string | ✅ | Nome do cliente |
| `email` | string | ❌ | E-mail do cliente |
| `phone` | string | ❌ | Telefone do cliente |
| `born_date` | string | ❌ | Data de nascimento (DD/MM/YYYY) |
| `approved` | boolean | ❌ | Cliente aprovou receber comunicações |
| `order_id` | string | ❌ | ID do pedido na plataforma origem |
| `order_value` | number | ❌ | Valor do pedido |
| `order_created_at` | string (ISO 8601) | ❌ | Data/hora do pedido |
| `order_type` | string | ❌ | Tipo do pedido (ex: Delivery, Salão) |
| `search_id` | string (UUID) | ❌ | ID da pesquisa para gerar link |

#### Resposta (200 - Criado)

```json
{
  "message": "Client and consumption successfully registered!",
  "client": { "id": "ef9fa264-3850-4bd2-875e-2b40a4dd432f" },
  "consumption": { "id": "18d12320-ebbf-4688-a4fa-67481aceb929" },
  "link": "https://pesquisa.falae.app"
}
```

---

### 7. Enviar Grupo de Clientes e Disparar Pesquisa

```http
POST /api/clients/dispatch
```

Cria um grupo de clientes e dispara automaticamente uma pesquisa de satisfação.

#### Corpo da Requisição

```json
{
  "search_id": "search_id",
  "page_id": "page_id",
  "dispatch": true,
  "resend_search": 1,
  "clients": [
    {
      "name": "John Doe",
      "email": "johndoe@example.com",
      "phone": "(00) 0 0000-0000",
      "born_date": "25/02/1980",
      "approved": true
    },
    {
      "name": "Jane Doe",
      "email": "janedoe@example.com",
      "phone": "(00) 0 0000-0000",
      "born_date": "15/10/1985",
      "approved": true
    }
  ]
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `search_id` | string | ✅ | ID da pesquisa |
| `page_id` | string | ✅ | ID da página |
| `dispatch` | boolean | ✅ | Se deve disparar a pesquisa |
| `resend_search` | integer | ❌ | Número de reenvios |
| `clients` | array | ✅ | Lista de clientes |

#### Resposta (201 - Criado)

```json
{
  "message": "Clientes cadastrados e pesquisa enviada com sucesso!"
}
```

---

## Companies (Empresas)

### 8. Listar Empresas Vinculadas

```http
GET /api/companies
```

Retorna a lista de empresas associadas ao token do usuário.

#### Resposta (200 - OK)

```json
[
  { "id": "103a525c-0ce3-4182-a504-aad595425233", "name": "Company 1" },
  { "id": "203a525c-0ce3-4182-a504-aad595425233", "name": "Company 2" },
  { "id": "303a525c-0ce3-4182-a504-aad595425233", "name": "Company 3" }
]
```

---

## Searches (Pesquisas)

### 9. Listar Pesquisas Disponíveis

```http
GET /api/searches
```

Retorna a lista de pesquisas vinculadas ao token do usuário.

#### Resposta (200 - OK)

```json
[
  {
    "id": "103a525c-0ce3-4182-a504-aad595425233",
    "name": "Search 1",
    "company_id": "603a525c-0ce3-4182-a504-aad595425233"
  },
  {
    "id": "203a525c-0ce3-4182-a504-aad595425233",
    "name": "Search 2",
    "company_id": "503a525c-0ce3-4182-a504-aad595425233"
  },
  {
    "id": "303a525c-0ce3-4182-a504-aad595425233",
    "name": "Search 3",
    "company_id": "403a525c-0ce3-4182-a504-aad595425233"
  }
]
```

---

## Exports (Exportações)

### 10. Exportar Relatórios Consolidados

```http
GET /api/exports
```

Gera um relatório consolidado com clientes, respostas e cupons dos últimos 90 dias.

#### Resposta (200 - OK)

```json
[
  {
    "total": 80,
    "clients": 0,
    "promoter": 80,
    "detractor": 0,
    "neutral": 0,
    "company": "Empresa 1",
    "uf": "MG",
    "nps": 100,
    "couponsUsed": 0,
    "couponsCreated": 0,
    "criteria": [
      { "name": "Atendimento", "nps": 100 },
      { "name": "Ambiente", "nps": 75 },
      { "name": "Tempo de espera", "nps": 95 }
    ]
  },
  {
    "total": 40,
    "clients": 0,
    "promoter": 40,
    "detractor": 0,
    "neutral": 0,
    "company": "Empresa 2",
    "uf": "RS",
    "nps": 100,
    "couponsUsed": 0,
    "couponsCreated": 0,
    "criteria": [
      { "name": "Atendimento", "nps": 95 },
      { "name": "Ambiente", "nps": 90 },
      { "name": "Tempo de espera", "nps": 92 }
    ]
  },
  {
    "total": 100,
    "clients": 100,
    "promoter": 90,
    "detractor": 5,
    "neutral": 5,
    "company": "Empresa 3",
    "uf": "SP",
    "nps": 85,
    "couponsUsed": 0,
    "couponsCreated": 0,
    "criteria": [
      { "name": "Atendimento", "nps": 95 },
      { "name": "Ambiente", "nps": 90 },
      { "name": "Tempo de espera", "nps": 100 }
    ]
  }
]
```

---

## Coupons (Cupons)

### 11. Listar Cupons com Filtros

```http
GET /api/coupons
```

Retorna uma lista paginada de cupons com opções de filtro. Máximo de 100 cupons por requisição. Funciona com integrações de franquia e empresa.

#### Parâmetros de Query

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `date_start` | string | ✅ | Data início (criação) - `YYYY-MM-DD` |
| `date_end` | string | ✅ | Data fim (criação) - `YYYY-MM-DD` |
| `date_of_use_start` | string | ❌ | Data início (uso) - `YYYY-MM-DD` |
| `date_of_use_end` | string | ❌ | Data fim (uso) - `YYYY-MM-DD` |
| `expiration_date_start` | string | ❌ | Data início (expiração) - `YYYY-MM-DD` |
| `expiration_date_end` | string | ❌ | Data fim (expiração) - `YYYY-MM-DD` |
| `coupon_status` | string | ❌ | Status: `Utilizado`, `Não Utilizado`, `Vencido`, `Vencendo` |
| `limit` | integer | ✅ | Número de cupons (máximo 100) |
| `offset` | integer | ✅ | Offset para paginação (mínimo 1) |
| `search` | string | ❌ | Busca por código ou info do cliente |
| `order_column` | string | ✅ | Coluna para ordenação (ex: `created_at`) |
| `order_type` | string | ✅ | Direção: `ASC` ou `DESC` |
| `module` | string | ✅ | Módulo: `premiado` ou `falae` |

#### Exemplo de Requisição

```bash
curl -X GET "https://api-b2s.experienciab2s.com/api/coupons?date_start=2024-01-01&date_end=2024-12-31&limit=10&offset=1&order_column=created_at&order_type=DESC&module=falae" \
     -H "Authorization: Bearer SEU_TOKEN"
```

#### Resposta (200 - OK)

```json
{
  "limit": 10,
  "offset": 1,
  "total": 45,
  "coupons": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "code": "WELCOME2024",
      "status": true,
      "date_of_use": "2024-03-15",
      "expiration_date": "2024-12-31",
      "created_at": "2024-01-15T10:30:00.000Z",
      "bonus": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "string",
        "type": "answer"
      },
      "client": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "name": "string",
        "email": "string",
        "phone": "string"
      }
    }
  ]
}
```

---

### 12. Buscar Cupons por Cliente

```http
GET /api/coupons/clients/{company_id}
```

Retorna uma lista de cupons vinculados a um cliente específico por telefone, e-mail ou CPF.

#### Parâmetros de Caminho

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `company_id` | string | ✅ | ID da empresa |

#### Parâmetros de Query

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `phone` | string | ❌ | Telefone formato E.164 (ex: `551199999999`) |
| `email` | string | ❌ | E-mail do cliente |
| `cpf` | string | ❌ | CPF no formato `000.000.000-00` |

> ⚠️ Pelo menos um parâmetro de query é recomendado.

#### Exemplo de Requisição

```bash
curl -X GET "https://api-b2s.experienciab2s.com/api/coupons/clients/103a525c-0ce3-4182-a504-aad595425233?email=cliente@exemplo.com" \
     -H "Authorization: Bearer SEU_TOKEN"
```

#### Resposta (200 - OK)

```json
[
  {
    "id": "103a525c-0ce3-4182-a504-aad595425233",
    "status": true,
    "expiration_date": "2024-12-31",
    "date_of_use": "2024-05-10",
    "created_at": "2024-01-01T12:00:00.000Z",
    "code": "ABCDEF123",
    "bonus": {
      "name": "5% Cashback"
    }
  },
  {
    "id": "303a525c-0ce3-4182-a504-aad595425233",
    "status": false,
    "expiration_date": "2024-11-30",
    "date_of_use": null,
    "created_at": "2024-02-15",
    "code": "XYZ789",
    "bonus": {
      "name": "10% Cashback"
    }
  }
]
```

---

### 13. Atualizar Status de Cupom

```http
PATCH /api/coupons/status/{id}
```

Atualiza o status de um cupom específico, marcando como utilizado. O sistema valida que o cupom existe, não foi usado e não está expirado (data de expiração deve ser maior que 3 horas do momento atual).

#### Parâmetros de Caminho

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | string | ✅ | Identificador único do cupom |

#### Exemplo de Requisição

```bash
curl -X PATCH "https://api-b2s.experienciab2s.com/api/coupons/status/abc123-cupom-id" \
     -H "Authorization: Bearer SEU_TOKEN"
```

#### Resposta (204 - No Content)

O status do cupom foi atualizado com sucesso. Nenhum conteúdo é retornado.

#### Erros Possíveis

```json
{
  "status": "error",
  "message": "Coupon already used"
}
```

---

## Activities (Atividades)

### 14. Criar Atividade

```http
POST /api/activities
```

Cria uma nova atividade (ex: e-mail, SMS ou WhatsApp) para um cliente e atualiza as informações do último contato.

#### Corpo da Requisição

```json
{
  "client_id": "ef9fa264-3850-4bd2-875e-2b40a4dd432f",
  "name": "Envio de mensagem de boas-vindas",
  "description": "Foi enviado um WhatsApp com informações do programa de fidelidade",
  "type": "whatsapp"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `client_id` | string (UUID) | ✅ | ID do cliente |
| `name` | string | ✅ | Nome/título da atividade |
| `description` | string | ❌ | Descrição detalhada |
| `type` | string | ✅ | Tipo: `email`, `sms`, `whatsapp` |

#### Resposta (201 - Criado)

Atividade criada com sucesso.

---

## Awardeds (Premiados)

### 15. Listar Premiados

```http
GET /api/awardeds
```

Retorna uma lista paginada de premiados com opções de filtro por período e prêmios específicos. Fornece acesso aos prêmios do programa de fidelidade.

#### Parâmetros de Query

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `date_start` | string (date) | ✅ | Data início - `YYYY-MM-DD` |
| `date_end` | string (date) | ✅ | Data fim - `YYYY-MM-DD` |
| `limit` | integer | ✅ | Número de registros por requisição |
| `offset` | integer | ✅ | Offset para paginação |
| `awardeds_id` | array (UUID) | ❌ | Filtrar por IDs específicos de prêmios |

#### Exemplo de Requisição

```bash
curl -X GET "https://api-b2s.experienciab2s.com/api/awardeds?date_start=2024-01-01&date_end=2024-12-31&limit=50&offset=0" \
     -H "Authorization: Bearer SEU_TOKEN"
```

#### Resposta (200 - OK)

```json
{
  "total": 125,
  "limit": 50,
  "offset": 0,
  "data": [
    {
      "id": "abc123e4-56f7-89ab-cdef-123456789abc",
      "created_at": "2024-04-15T10:30:00.000Z",
      "awarded": {
        "id": "def456g7-89hi-01jk-lmno-456789012def",
        "name": "Sorteio Mensal Premium"
      },
      "client": {
        "id": "ghi789j0-12kl-34mn-opqr-789012345ghi",
        "name": "Maria Silva",
        "email": "maria.silva@example.com",
        "phone": "(11) 99999-9999",
        "born_date": "1985-03-15T00:00:00.000Z"
      },
      "company": {
        "id": "jkl012m3-45no-67pq-rstu-012345678jkl",
        "name": "Restaurante Bom Sabor"
      }
    },
    {
      "id": "mno345p6-78qr-90st-uvwx-345678901mno",
      "created_at": "2024-04-14T14:20:00.000Z",
      "awarded": {
        "id": "pqr678s9-01tu-23vw-xyza-678901234pqr",
        "name": "Cashback Semanal"
      },
      "client": {
        "id": "stu901v2-34wx-56yz-abcd-901234567stu",
        "name": "João Santos",
        "email": "joao.santos@example.com",
        "phone": null,
        "born_date": null
      },
      "company": {
        "id": "vwx234y5-67za-89bc-defg-234567890vwx",
        "name": "Loja de Eletrônicos Tech"
      }
    }
  ]
}
```

---

## 🔔 Webhook

O Webhook do Falaê permite o envio automático das respostas de pesquisa para uma URL personalizada.

### Como Configurar

1. Acesse a tela de **Integrações** na plataforma Falaê
2. Pesquise por **"Webhook Falaê"** e clique em **"Ativar"**
3. Adicione a **URL de destino** para onde os dados serão enviados
4. *(Opcional)* Insira um **Token de autenticação**, se necessário
5. Clique em **"Configurar"** para finalizar

### Dados Enviados pelo Webhook

| Dado | Descrição |
|------|-----------|
| ✅ Respostas de pesquisas | Dados completos da resposta |
| ✅ Pontuação NPS | Nota do cliente |
| ✅ Sugestões e comentários | Feedback textual (se houver) |
| ✅ Dados dos clientes | Nome, e-mail, telefone, data de nascimento |
| ✅ Informações de consumo | Quando disponíveis |

> ⚠️ **Importante:** O Webhook só envia dados quando o cliente está cadastrado no momento da resposta.

### Formato do Payload

#### Com dados de consumo

```json
{
  "answer": {
    "id": "dba4613f-1036-4189-809a-78a5f03416c0",
    "nps": 10,
    "discursive_question": "Estava tudo ótimo",
    "company_id": "6c820ca0-1315-4c67-b57d-543b66e76e2d",
    "search_id": "5445c8a6-b892-4808-a6b8-642df1ca6baa"
  },
  "client": {
    "id": "1e881c4f-1fae-48ff-a5c8-c590c2a296d9",
    "name": "John",
    "born_date": "2000-01-10",
    "email": "john@example.com",
    "phone": "+5532999999999"
  },
  "consumption": {
    "order_id": "delivery-1",
    "id": "ba68cb99-fbf9-41d9-9eec-932c00ef96f4"
  }
}
```

#### Sem dados de consumo

```json
{
  "answer": {
    "id": "38e47391-ee43-4582-bf19-fa5f57c61a79",
    "nps": 10,
    "discursive_question": null,
    "company_id": "6c820ca0-1315-4c67-b57d-543b66e76e2d",
    "search_id": "firstSearchId"
  },
  "client": {
    "id": "da438578-1935-46d0-a2c0-05f9ecdbee55",
    "name": "John",
    "born_date": "2000-01-10",
    "email": "john@example.com",
    "phone": "+5532999999999"
  }
}
```

### Benefícios do Webhook

- ✅ **Automação total** do envio de dados
- ✅ **Conexão direta** com qualquer sistema externo via URL
- ✅ **Redução de retrabalho** e maior agilidade
- ✅ **Ações imediatas** como campanhas, alertas e notificações

---

## ⚠️ Códigos de Erro

| Código | Descrição |
|--------|-----------|
| `400` | Bad Request - Erro de validação, parâmetros inválidos ou ausentes |
| `401` | Unauthorized - Token JWT ausente ou inválido |
| `403` | Forbidden - Token válido mas permissões insuficientes |
| `404` | Not Found - Recurso ou token não encontrado |

### Erros Específicos de Cupons (400)

- Parâmetros obrigatórios ausentes
- Formato de data inválido (deve ser `YYYY-MM-DD`)
- Valor de `coupon_status` inválido
- `limit` deve ser entre 0 e 100
- `offset` deve ser >= 1
- `order_type` deve ser `ASC` ou `DESC`
- `module` deve ser `premiado` ou `falae`

---

## 🎯 Casos de Uso para Zykor

### Integrações Potenciais

1. **Sincronização de NPS**
   - Importar respostas de pesquisa automaticamente
   - Vincular NPS por unidade/empresa
   - Gerar indicadores de satisfação no dashboard
   - Acompanhar critérios específicos (Atendimento, Ambiente, Tempo de espera)

2. **Gestão de Clientes**
   - Sincronizar base de clientes entre sistemas
   - Enviar clientes para disparo de pesquisas pós-atendimento
   - Registrar atividades de contato (WhatsApp, SMS, E-mail)

3. **Programa de Fidelidade**
   - Gerenciar cupons e benefícios
   - Atualizar status de cupons utilizados
   - Acompanhar premiados e sorteios
   - Integrar com sistema de pontos

4. **Closed Loop (Acompanhamento)**
   - Receber alertas de NPS baixo (detratores)
   - Registrar ações de recuperação via API
   - Atualizar status de tratamento das respostas

5. **Webhook para Alertas em Tempo Real**
   - Receber respostas em tempo real
   - Criar alertas automáticos para detratores
   - Acionar fluxos de recuperação de clientes

6. **Relatórios Consolidados**
   - Importar dados de exportação periódica
   - Consolidar métricas por critério
   - Comparar performance entre unidades
   - Acompanhar promotores, neutros e detratores

### Próximos Passos para Integração

- [ ] Solicitar token de autenticação à equipe Falaê
- [ ] Definir quais endpoints serão utilizados
- [ ] Mapear campos do Falaê para tabelas do Supabase
- [ ] Criar tabelas no Supabase para armazenar dados do Falaê
- [ ] Implementar endpoint de Webhook para receber respostas
- [ ] Desenvolver sincronização periódica de dados
- [ ] Criar dashboard de NPS no Zykor

---

## 📞 Suporte

Para dúvidas ou acesso ao token de autenticação:

📩 **contato@falae.app**  
🔗 **https://www.falae.app**
