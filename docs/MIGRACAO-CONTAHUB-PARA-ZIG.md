# Migração: ContaHub → API Zig

**Status**: ✅ API Testada e Funcionando  
**Data**: Março 2026  
**Chave API**: `b64b56f7f39d0968fb1cbd6a609a50e37ba35360dea958acddefaa4b63e40814`  
**Rede ID**: `7134590e-ea4b-499c-a9cd-9e073a8fb8d0`

### 🏪 Lojas Ativas
- **ORDINARIO**: `981e1272-3dd7-4f06-a92e-118df9e23bad`
- **DEBOCHE BAR ASA NORTE**: `3c8b17c8-63ca-4226-92b5-18fd945b02bc`

---

## 📋 Resumo Executivo

Estamos migrando do sistema ContaHub (baseado em queries e reclamações) para a **API Zig**, que nos dará:
- ✅ **Controle total** sobre os dados
- ✅ **API REST completa** com endpoints estruturados
- ✅ **Dados em tempo real** sem depender de terceiros
- ✅ **Integração direta** com nosso sistema

---

## 🔄 O Que Muda

### **ANTES (ContaHub)**
```
Sistema Zykor → ContaHub → Queries manuais → Reclamações → Dados inconsistentes
```
- ❌ Dependência de queries manuais
- ❌ Dados atrasados ou inconsistentes
- ❌ Necessidade de reclamações para correções
- ❌ Sem controle sobre a fonte de dados
- ❌ Integração limitada

### **DEPOIS (API Zig)**
```
Sistema Zykor → API Zig → Dados estruturados → Controle total
```
- ✅ API REST com autenticação por token
- ✅ Dados em tempo real
- ✅ Endpoints específicos para cada necessidade
- ✅ Controle total sobre requisições
- ✅ Possibilidade de automação completa

---

## 🎯 Endpoints Disponíveis

### Base URL
```
https://api.zigcore.com.br/integration
```

### Autenticação
```http
Authorization: b64b56f7f39d0968fb1cbd6a609a50e37ba35360dea958acddefaa4b63e40814
```

---

### 1. **Lojas** 🏪
```http
GET /erp/lojas?rede={rede}
```
**O que retorna**: Lista de lojas da rede
```json
[
  {
    "id": "123",
    "name": "Loja A"
  }
]
```

---

### 2. **Saída de Produtos** 📦
```http
GET /erp/saida-produtos?dtinicio=YYYY-MM-DD&dtfim=YYYY-MM-DD&loja={id}
```
**O que retorna**: Produtos vendidos no período
```json
[
  {
    "transactionId": "12345",
    "transactionDate": "2024-08-23T12:00:00",
    "productId": "98765",
    "productSku": "ABC123",
    "unitValue": 1500,
    "count": 2,
    "discountValue": 0,
    "productName": "Produto X",
    "productCategory": "Categoria Y",
    "redeId": "1",
    "lojaId": "1",
    "eventId": "1001",
    "eventDate": "2024-08-23",
    "employeeName": "João",
    "type": "Normal",
    "additions": []
  }
]
```

**Tipos de transação**:
- `Normal` - Venda normal
- `Couvert` - Couvert artístico
- `ZigCard` - Pagamento via cartão Zig
- `Entrance` - Entrada/ingresso
- `Tip` - Gorjeta

---

### 3. **Compradores** 👥
```http
GET /erp/compradores?dtinicio=YYYY-MM-DD&dtfim=YYYY-MM-DD&loja={id}
```
**O que retorna**: Lista de compradores no período
```json
[
  {
    "transactionId": "56789",
    "userDocument": "123.456.789-00",
    "userDocumentType": "CPF",
    "userPhone": "+55 11 98765-4321",
    "userName": "João Silva",
    "userEmail": "joao.silva@email.com",
    "productsValue": 20000,
    "tipValue": 500
  }
]
```

---

### 4. **Faturamento** 💰
```http
GET /erp/faturamento?dtinicio=YYYY-MM-DD&dtfim=YYYY-MM-DD&loja={id}
```
**O que retorna**: Dados de faturamento por método de pagamento
```json
[
  {
    "paymentId": 1,
    "paymentName": "Cartão de Crédito",
    "value": 15000,
    "redeId": "1",
    "lojaId": "1",
    "eventId": "1001",
    "eventDate": "2024-08-23"
  }
]
```

---

### 5. **Faturamento Detalhado (Máquinas Integradas)** 💳
```http
GET /erp/faturamento/detalhesMaquinaIntegrada?dtinicio=YYYY-MM-DD&dtfim=YYYY-MM-DD&loja={id}
```
**O que retorna**: Detalhamento por bandeira de cartão
```json
[
  {
    "paymentId": 1,
    "paymentName": "Cartão de Crédito",
    "lojaId": "1",
    "eventId": "1001",
    "values": [
      {
        "cardBrand": "Visa",
        "totalValue": 5000
      },
      {
        "cardBrand": "MasterCard",
        "totalValue": 10000
      }
    ]
  }
]
```

---

### 6. **Notas Fiscais** 🧾
```http
GET /erp/invoice?dtinicio=YYYY-MM-DD&dtfim=YYYY-MM-DD&loja={id}&page={page}
```
**O que retorna**: Notas fiscais emitidas (paginado)
```json
[
  {
    "id": "12345",
    "redeId": "1",
    "lojaId": "1",
    "eventId": "1001",
    "eventDate": "2024-08-23",
    "mode": "nfce",
    "isCanceled": false,
    "xml": "<xml_data>",
    "canceledXml": null
  }
]
```

**Tipos de nota**:
- `nfce` - NFC-e
- `nfse` - NFS-e
- `sat` - SAT
- `ivaVendus` - IVA Vendus

---

### 7. **Check-ins** ✅
```http
GET /erp/checkins?desde=YYYY-MM-DD&dtfim=YYYY-MM-DD&loja={id}&page={page}
```
**O que retorna**: Check-ins realizados (paginado)
```json
[
  {
    "checkinTime": "2024-08-23T12:00:00",
    "name": "João Silva",
    "document": "123.456.789-00",
    "documentType": "CPF",
    "phone": "+55 11 98765-4321",
    "isForeign": false
  }
]
```

---

### 8. **Recargas** 🔄
```http
GET /erp/recharges?dtinicio=YYYY-MM-DD&dtfim=YYYY-MM-DD&loja={id}
```
**O que retorna**: Recargas/pré-pagamentos realizados
```json
[
  {
    "date": "2024-08-23",
    "author": "Maria Souza",
    "authorId": "789",
    "totalValue": 10000,
    "userDocument": "123.456.789-00",
    "userDocumentType": "CPF",
    "userPhone": "+55 11 98765-4321",
    "userName": "José Silva",
    "userEmail": "jose.silva@email.com",
    "isForeign": false
  }
]
```

---

### 9. **Bônus/Cashback** 🎁 (POST)
```http
POST /cashback/give
```
**O que faz**: Cria um bônus para consumo
```json
{
  "document": "12345678900",
  "documentType": "CPF",
  "username": "João Silva",
  "value": 1000,
  "cashbackId": "uuid-aqui",
  "obs": "Bônus promocional"
}
```

**⚠️ IMPORTANTE**: 
- `value` deve ser em centavos (1000 = R$ 10,00)
- Sem vírgulas ou pontos no valor
- Retorna sem body (status 200 = sucesso)

---

## 🏗️ Arquitetura Nova

### Estrutura de Pastas
```
frontend/
├── src/
│   ├── app/
│   │   └── api/
│   │       └── zig/                    # Nova pasta para API Zig
│   │           ├── lojas/
│   │           │   └── route.ts
│   │           ├── saida-produtos/
│   │           │   └── route.ts
│   │           ├── compradores/
│   │           │   └── route.ts
│   │           ├── faturamento/
│   │           │   └── route.ts
│   │           ├── faturamento-detalhado/
│   │           │   └── route.ts
│   │           ├── notas-fiscais/
│   │           │   └── route.ts
│   │           ├── checkins/
│   │           │   └── route.ts
│   │           ├── recargas/
│   │           │   └── route.ts
│   │           └── bonus/
│   │               └── route.ts
│   └── lib/
│       └── zig-client.ts               # Cliente HTTP para API Zig
```

---

## 💾 Impacto no Banco de Dados

### Novas Tabelas Necessárias

#### 1. `zig_lojas`
```sql
CREATE TABLE zig_lojas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rede_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 2. `zig_transacoes`
```sql
CREATE TABLE zig_transacoes (
  transaction_id TEXT PRIMARY KEY,
  transaction_date TIMESTAMP,
  product_id TEXT,
  product_sku TEXT,
  unit_value INTEGER,
  count INTEGER,
  discount_value INTEGER,
  product_name TEXT,
  product_category TEXT,
  rede_id TEXT,
  loja_id TEXT,
  event_id TEXT,
  event_date DATE,
  employee_name TEXT,
  type TEXT,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 3. `zig_compradores`
```sql
CREATE TABLE zig_compradores (
  id SERIAL PRIMARY KEY,
  transaction_id TEXT,
  user_document TEXT,
  user_document_type TEXT,
  user_phone TEXT,
  user_name TEXT,
  user_email TEXT,
  products_value INTEGER,
  tip_value INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 4. `zig_faturamento`
```sql
CREATE TABLE zig_faturamento (
  id SERIAL PRIMARY KEY,
  payment_id INTEGER,
  payment_name TEXT,
  value INTEGER,
  rede_id TEXT,
  loja_id TEXT,
  event_id TEXT,
  event_date DATE,
  card_brand TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 5. `zig_sync_log`
```sql
CREATE TABLE zig_sync_log (
  id SERIAL PRIMARY KEY,
  endpoint TEXT NOT NULL,
  loja_id TEXT,
  date_range TEXT,
  status TEXT,
  records_synced INTEGER,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔧 Implementação Técnica

### 1. Cliente HTTP (`lib/zig-client.ts`)
```typescript
const ZIG_API_BASE = 'https://api.zigcore.com.br/integration';
const ZIG_API_KEY = process.env.ZIG_API_KEY;

export async function zigRequest(endpoint: string, params?: Record<string, string>) {
  const url = new URL(`${ZIG_API_BASE}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': ZIG_API_KEY!,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Zig API error: ${response.status}`);
  }

  return response.json();
}
```

### 2. Exemplo de Endpoint (`app/api/zig/lojas/route.ts`)
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { zigRequest } from '@/lib/zig-client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rede = searchParams.get('rede');

    if (!rede) {
      return NextResponse.json({ error: 'rede é obrigatório' }, { status: 400 });
    }

    const data = await zigRequest('/erp/lojas', { rede });
    return NextResponse.json(data);
  } catch (error) {
    console.error('Erro ao buscar lojas:', error);
    return NextResponse.json({ error: 'Erro ao buscar lojas' }, { status: 500 });
  }
}
```

---

## 📊 Estratégia de Sincronização

### Sincronização Automática (Cron Jobs)
```typescript
// Executar a cada 1 hora
export async function syncZigData() {
  const lojas = await getLojas();
  
  for (const loja of lojas) {
    // Sincronizar últimas 24h
    const dtinicio = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    const dtfim = format(new Date(), 'yyyy-MM-dd');
    
    await syncSaidaProdutos(loja.id, dtinicio, dtfim);
    await syncCompradores(loja.id, dtinicio, dtfim);
    await syncFaturamento(loja.id, dtinicio, dtfim);
  }
}
```

### Sincronização Manual (Dashboard)
- Botão no dashboard para forçar sincronização
- Seleção de período customizado
- Log de sincronizações realizadas

---

## 🎯 Benefícios Imediatos

### 1. **Dados em Tempo Real**
- Antes: Esperar dias por dados do ContaHub
- Depois: Requisição HTTP e dados instantâneos

### 2. **Controle Total**
- Antes: Dependência de terceiros
- Depois: Controle sobre quando e como buscar dados

### 3. **Automação**
- Antes: Processos manuais
- Depois: Cron jobs automáticos

### 4. **Rastreabilidade**
- Antes: Sem histórico de mudanças
- Depois: Log completo de sincronizações

### 5. **Escalabilidade**
- Antes: Limitado pelo ContaHub
- Depois: Escalável conforme necessidade

---

## 🚀 Plano de Migração

### Fase 1: Setup Inicial ✅
- [x] Receber chave API
- [x] Analisar documentação
- [x] Criar documento de migração
- [x] Testar API e confirmar funcionamento
- [x] Identificar lojas ativas (ORDINARIO + DEBOCHE BAR)

### Fase 2: Desenvolvimento
- [ ] Criar `lib/zig-client.ts`
- [ ] Implementar endpoints básicos (lojas, saída-produtos)
- [ ] Criar tabelas no Supabase
- [ ] Testar integração com dados reais

### Fase 3: Sincronização
- [ ] Implementar sistema de sync automático
- [ ] Criar dashboard de monitoramento
- [ ] Implementar logs de sincronização
- [ ] Testar com dados históricos

### Fase 4: Migração Gradual
- [ ] Rodar Zig e ContaHub em paralelo
- [ ] Comparar dados
- [ ] Ajustar inconsistências
- [ ] Validar com cliente

### Fase 5: Desativação ContaHub
- [ ] Confirmar 100% dos dados migrando corretamente
- [ ] Desativar queries do ContaHub
- [ ] Documentar processo completo
- [ ] Celebrar! 🎉

---

## ⚠️ Pontos de Atenção

### 1. **Valores em Centavos**
Todos os valores monetários vêm em centavos:
- `15000` = R$ 150,00
- `500` = R$ 5,00

### 2. **Paginação**
Alguns endpoints usam paginação:
- `/erp/invoice`
- `/erp/checkins`

### 3. **Rate Limiting**
Ainda não sabemos os limites da API. Monitorar:
- Quantas requisições por minuto?
- Há throttling?
- Precisa implementar retry?

### 4. **Formato de Datas**
- Query params: `YYYY-MM-DD` (ex: `2024-08-23`)
- Respostas: ISO 8601 (ex: `2024-08-23T12:00:00`)

### 5. **Dados Nulos**
Alguns campos podem ser `null`:
- `fractionalAmount`
- `fractionUnit`
- `invoiceId`
- `userEmail`
- `canceledXml`

---

## 📝 Variáveis de Ambiente

Adicionar ao `.env.local`:
```bash
# API Zig
ZIG_API_KEY=b64b56f7f39d0968fb1cbd6a609a50e37ba35360dea958acddefaa4b63e40814
ZIG_API_BASE_URL=https://api.zigcore.com.br/integration
ZIG_REDE_ID=7134590e-ea4b-499c-a9cd-9e073a8fb8d0

# Lojas (para referência)
# ORDINARIO: 981e1272-3dd7-4f06-a92e-118df9e23bad
# DEBOCHE BAR ASA NORTE: 3c8b17c8-63ca-4226-92b5-18fd945b02bc
```

---

## 🧪 Testes Iniciais

### 1. Testar Autenticação
```bash
curl -H "Authorization: b64b56f7f39d0968fb1cbd6a609a50e37ba35360dea958acddefaa4b63e40814" \
  "https://api.zigcore.com.br/integration/erp/lojas?rede=TESTE"
```

### 2. Verificar Estrutura de Dados
- Confirmar se os campos batem com a documentação
- Verificar tipos de dados
- Identificar campos obrigatórios vs opcionais

### 3. Testar Paginação
- Verificar quantos registros por página
- Testar navegação entre páginas

---

## 📞 Contato Zig

**Suporte**: (informações a serem adicionadas)  
**Documentação**: Ver `docs/Documentacao_Zig_API.pdf`

---

## 🎓 Conclusão

A migração para a API Zig representa um **salto de qualidade** no controle e gestão dos dados. Saímos de um modelo reativo (queries + reclamações) para um modelo **proativo e automatizado**.

**Próximos passos**: Começar implementação técnica e testes com dados reais.

---

## 🧪 Testes Realizados (09/03/2026)

### Endpoints Testados - Resultados

| Endpoint | Status | Observação |
|----------|--------|------------|
| `/erp/lojas` | ✅ OK | 2 lojas (ORDINARIO + DEBOCHE) |
| `/erp/saida-produtos` | ✅ OK | 4 registros de teste |
| `/erp/compradores` | ✅ OK | 1 registro |
| `/erp/faturamento` | ✅ OK | 19 métodos de pagamento |
| `/erp/faturamento/detalhesMaquinaIntegrada` | ✅ OK | Vazio (sem dados cartão) |
| `/erp/invoice` | ❌ ERRO 500 | Aguardando correção Zig |
| `/erp/checkins` | ❌ ERRO 500 | Aguardando correção Zig |
| `/erp/recharges` | ✅ OK | 2 recargas |
| `/cashback/give` | ⏸️ Não testado | POST - precisa sandbox |

### Endpoints NÃO Documentados (Descobertos)

| Endpoint | Status | Estrutura |
|----------|--------|-----------|
| `/erp/discounts` | ✅ OK | Descontos aplicados |
| `/erp/refunds` | ✅ OK | Estornos com products[], reason, author |
| `/erp/events` | ✅ OK | Eventos com id, name, beginAt, peopleCapacity |

### Campos Extras Descobertos (não na documentação)

**saida-produtos:**
- `eventName`, `source`, `barId`, `barName`, `obs`, `kindId`, `systemProduct`, `isRefunded`

**compradores:**
- `userGender`, `userBirthdate`, `isPaid`, `paymentType`, `terminal`, `date`, `chipNfc`

**recharges:**
- `barId`, `barName`

### ⚠️ GAPS Identificados - Perguntas Enviadas à Zig

1. **Contagem de pessoas por comanda** - Não encontrado
2. **Custo dos produtos (CMV)** - Não encontrado
3. **Estoque de produtos** - Não encontrado
4. **Tempos de produção/entrega** - Não encontrado
5. **Taxas de cartão** - Não encontrado
6. **Erro 500 em checkins e invoice** - Aguardando
7. **Loja DEBOCHE retornando 400** - Aguardando
8. **Documentação endpoints não documentados** - Aguardando

### Mapeamento ContaHub → Zig

| Tabela ContaHub | Endpoint Zig | Cobertura |
|-----------------|--------------|-----------|
| `contahub_periodo` | `/erp/compradores` | 🟡 Parcial (sem pessoas) |
| `contahub_pagamentos` | `/erp/faturamento` | 🟡 Parcial (sem taxas) |
| `contahub_analitico` | `/erp/saida-produtos` | 🟡 Parcial (sem custo) |
| `contahub_tempo` | ❌ Não existe | 🔴 Sem equivalente |
| `contahub_fatporhora` | Calcular de saida-produtos | 🟢 Possível |
| `contahub_stockout` | ❌ Não existe | 🔴 Sem equivalente |
| `contahub_vendas` | `/erp/saida-produtos` | 🟢 OK |
| `contahub_cancelamentos` | `/erp/refunds` | 🟢 OK |

---

*Documento criado em: Março 2026*  
*Última atualização: 09/03/2026*
