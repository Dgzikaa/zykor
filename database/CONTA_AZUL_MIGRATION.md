# Migração NIBO → Conta Azul — Zykor

## 1. Mapa de Dependências NIBO (Estado Atual)

### 1.1 Tabelas no Banco (6 tabelas)

| Tabela | Rows | Uso |
|--------|------|-----|
| `nibo_agendamentos` | 50K | Contas a pagar/receber (despesas + receitas), 49 colunas |
| `nibo_categorias` | 124 | Categorias financeiras (categoria_nome → categoria_macro para DRE) |
| `nibo_centros_custo` | 3.3K | Centros de custo |
| `nibo_stakeholders` | 0 | Fornecedores/clientes (cache, vazio hoje) |
| `nibo_background_jobs` | 110 | Jobs de sync em background |
| `nibo_logs_sincronizacao` | 412 | Logs de execução do sync |

### 1.2 Edge Functions

| Function | O que faz |
|----------|-----------|
| `nibo-sync` | Sync principal: busca schedules/debit, schedules/credit, receipts da API NIBO → upsert em `nibo_agendamentos` |
| `integracao-dispatcher` | Router central que despacha para nibo-sync |

### 1.3 SQL Functions

| Função | O que faz |
|--------|-----------|
| `executar_nibo_sync_ambos_bares()` | Dispara sync para bar_id=3 e bar_id=4 via HTTP |
| `calculate_evento_metrics()` | Usa nibo_agendamentos para calcular custo_atracao |
| `cleanup_old_logs()` | Limpa logs antigos do sync |

### 1.4 Cron Jobs (pg_cron)

| Job | Schedule | Comando |
|-----|----------|---------|
| `nibo-sync-08h-ambos` | 08:00 BRT | `SELECT executar_nibo_sync_ambos_bares()` |
| `nibo-sync-19h-ambos` | 19:00 BRT | `SELECT executar_nibo_sync_ambos_bares()` |

### 1.5 Frontend — API Routes (Next.js)

| Rota | Método | Uso |
|------|--------|-----|
| `/api/nibo/sync` | POST | Trigger manual de sync |
| `/api/configuracoes/credenciais/nibo-status` | GET | Status da conexão |
| `/api/configuracoes/credenciais/nibo-connect` | POST | Salvar token NIBO |
| `/api/configuracoes/credenciais/nibo-sync` | POST | Trigger sync da tela de config |
| `/api/financeiro/nibo/stakeholders` | GET/POST | Listar/criar fornecedores |
| `/api/financeiro/nibo/categorias` | GET | Listar categorias |
| `/api/financeiro/nibo/centros-custo` | GET | Listar centros de custo |
| `/api/financeiro/nibo/dre-monthly-detailed` | GET | DRE mensal detalhado |
| `/api/financeiro/nibo/dre-yearly-detailed` | GET | DRE anual |
| `/api/agendamento/agendar-nibo` | POST | Agendar pagamento no NIBO |
| `/api/agendamento/buscar-stakeholder` | GET | Buscar fornecedor |
| `/api/agendamento/criar-supplier` | POST | Criar fornecedor |

### 1.6 Frontend — Páginas

| Página | Componentes |
|--------|-------------|
| `/ferramentas/agendamento` | AgendamentoCredenciais, NovoPagamentoForm, PagamentosList, StakeholderModal, ImportarFolhaModal |
| `/configuracoes` | NiboIntegrationCard (status, sync, credentials) |

### 1.7 Calculadores (Edge Functions Shared)

| Arquivo | Dependência |
|---------|-------------|
| `calc-custos.ts` | Lê `nibo_agendamentos` + `bar_categorias_custo` → calcula `custo_atracao` → grava em `desempenho_semanal` |

### 1.8 Views

| View | Dependência |
|------|-------------|
| `view_dre` | JOIN `nibo_agendamentos` + `nibo_categorias` → DRE por categoria_macro |

### 1.9 Config por Bar

| Tabela | Dados |
|--------|-------|
| `bar_categorias_custo` | Mapeia categoria_nome → tipo (atracao, cmv_comida, cmv_bebida) |
| `api_credentials` | Tokens NIBO por bar (sistema='nibo') |

### 1.10 Fluxo Crítico: Custo Atracao

```
nibo_agendamentos (tipo='despesa', categoria_nome='Atrações...')
    → bar_categorias_custo (tipo='atracao')
    → calc-custos.ts
    → desempenho_semanal.custo_atracao_faturamento
    → Dashboard /estrategico/desempenho
```

---

## 2. API Conta Azul — Referência Rápida

### 2.1 Autenticação (OAuth 2.0)

```
Base Auth: https://auth.contaazul.com
Base API:  https://api-v2.contaazul.com
```

**Fluxo:**
1. Redirecionar usuário → `https://auth.contaazul.com/login?response_type=code&client_id=XXX&redirect_uri=YYY&state=ZZZ&scope=openid+profile+aws.cognito.signin.user.admin`
2. Capturar `code` no redirect
3. POST `https://auth.contaazul.com/oauth2/token` com `grant_type=authorization_code` → recebe `access_token` (1h) + `refresh_token` (5 anos)
4. Renovar: POST com `grant_type=refresh_token` → novo access_token + novo refresh_token

**Headers em toda requisição:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Tokens na tabela `api_credentials`:**
- `access_token` → access_token do Conta Azul
- `refresh_token` → refresh_token (salvar novo a cada renovação!)
- `expires_at` → timestamp de expiração
- `client_id` + `client_secret` → credenciais do app

### 2.2 Endpoints Financeiros

| Endpoint | Método | Equivalente NIBO | Uso |
|----------|--------|------------------|-----|
| `/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar` | GET | schedules/debit | Listar despesas |
| `/v1/financeiro/eventos-financeiros/contas-a-receber/buscar` | GET | schedules/credit | Listar receitas |
| `/v1/financeiro/eventos-financeiros/contas-a-pagar` | POST | schedules/debit (create) | Criar despesa |
| `/v1/financeiro/eventos-financeiros/contas-a-receber` | POST | schedules/credit (create) | Criar receita |
| `/v1/financeiro/eventos-financeiros/parcelas/{id}` | GET | receipts | Detalhes de parcela |
| `/v1/financeiro/eventos-financeiros/parcelas/{id}` | PATCH | (update) | Atualizar parcela |
| `/v1/categorias` | GET | /categories | Listar categorias |
| `/v1/financeiro/categorias-dre` | GET | — | Categorias DRE |
| `/v1/centro-de-custo` | GET/POST | /costcenters | Centros de custo |
| `/v1/conta-financeira` | GET | /bankaccounts | Contas bancárias |
| `/v1/conta-financeira/{id}/saldo-atual` | GET | — | Saldo da conta |
| `/v1/financeiro/transferencias` | GET | — | Transferências |
| `/v1/financeiro/eventos-financeiros/parcelas/{id}/baixa` | POST | — | Registrar baixa |
| `/v1/pessoas` | GET/POST | /stakeholders | Fornecedores/Clientes |
| `/v1/pessoas/{id}` | GET/PUT/PATCH | /stakeholders/{id} | CRUD pessoa |

### 2.3 Filtros Disponíveis (Contas a Pagar)

```
GET /v1/financeiro/eventos-financeiros/contas-a-pagar/buscar
  ?pagina=1
  &tamanho_pagina=100
  &data_vencimento_de=2026-01-01
  &data_vencimento_ate=2026-03-31
  &data_competencia_de=2026-01-01
  &data_competencia_ate=2026-03-31
  &data_pagamento_de=...
  &data_pagamento_ate=...
  &data_alteracao_de=2026-03-23T00:00:00 (ISO 8601, GMT-3)
  &data_alteracao_ate=2026-03-24T23:59:59
  &status=EM_ABERTO,ATRASADO,RECEBIDO
  &ids_categorias=uuid1,uuid2
  &ids_centros_de_custo=uuid1
  &ids_contas_financeiras=uuid1
  &descricao=texto
  &valor_de=100
  &valor_ate=500
```

### 2.4 Estrutura de Resposta (Contas a Pagar)

```json
{
  "itens_totais": 150,
  "itens": [
    {
      "id": "uuid",
      "descricao": "Aluguel",
      "valor_bruto": 5000.00,
      "valor_liquido": 4800.00,
      "data_vencimento": "2026-03-15",
      "data_competencia": "2026-03-01",
      "status": "PENDENTE",
      "contato": { "id": "uuid", "nome": "Fornecedor X" },
      "categoria": { "id": "uuid", "nome": "Aluguel" },
      "centro_custo": { "id": "uuid", "nome": "Operacional" },
      "conta_financeira": { "id": "uuid", "nome": "Banco Inter" }
    }
  ]
}
```

### 2.5 Mapeamento NIBO → Conta Azul (Campos)

| Campo NIBO (nibo_agendamentos) | Campo Conta Azul | Notas |
|-------------------------------|------------------|-------|
| nibo_id | id (uuid) | Identificador externo |
| tipo ('despesa'/'receita') | tipo endpoint (contas-a-pagar/contas-a-receber) | Separa por endpoint |
| valor | valor_bruto / valor_liquido | CA separa bruto/líquido |
| data_vencimento | data_vencimento | Mesmo formato |
| data_competencia | data_competencia | YYYY-MM-DD |
| data_pagamento | data_pagamento (via baixas) | CA usa sistema de baixas |
| status | status (PENDENTE/QUITADO/ATRASADO/etc) | Mapear enums |
| descricao | descricao | Texto livre |
| titulo | descricao (evento) | Sem campo separado |
| categoria_id / categoria_nome | id_categoria / nome (via /v1/categorias) | UUID no CA |
| stakeholder_id / stakeholder_nome | contato (uuid via /v1/pessoas) | CA chama de "pessoas" |
| centro_custo_id / centro_custo_nome | id_centro_custo (via /v1/centro-de-custo) | UUID no CA |
| conta_bancaria_id | id_conta_financeira (via /v1/conta-financeira) | UUID no CA |
| valor_pago | valor_pago (parcela) | Via sistema de baixas |
| numero_documento | descricao/nota (parcela) | Campo livre |
| recorrente | — | CA não tem recorrência via API |

### 2.6 Status Mapping

| NIBO | Conta Azul |
|------|-----------|
| pendente | PENDENTE / EM_ABERTO |
| pago | QUITADO / RECEBIDO |
| vencido | ATRASADO |
| cancelado | CANCELADO / PERDIDO |
| parcial | RECEBIDO_PARCIAL |

### 2.7 Rate Limits

- 429 Too Many Requests → implementar backoff exponencial
- Paginação: max 1000 por página
- Token expira em 1h → auto-refresh obrigatório

---

## 3. Plano de Migração

### FASE 1: Infraestrutura (tabelas + auth)

**3.1.1 Novas tabelas:**
- `contaazul_lancamentos` → substitui nibo_agendamentos (contas a pagar + receber)
- `contaazul_categorias` → substitui nibo_categorias
- `contaazul_centros_custo` → substitui nibo_centros_custo
- `contaazul_pessoas` → substitui nibo_stakeholders (fornecedores/clientes)
- `contaazul_contas_financeiras` → nova (contas bancárias do CA)
- `contaazul_logs_sincronizacao` → substitui nibo_logs_sincronizacao

**3.1.2 OAuth flow:**
- Edge function `contaazul-auth` → callback handler para capturar code
- Armazenar tokens em `api_credentials` (sistema='contaazul')
- Auto-refresh de access_token antes de expirar

**3.1.3 Migração de `bar_categorias_custo`:**
- Mapear categoria_nome NIBO → categoria_nome Conta Azul
- Manter mesma estrutura (tipo=atracao, cmv_comida, etc)

### FASE 2: Edge Function de Sync

**3.2.1 `contaazul-sync` edge function:**
- Substituir `nibo-sync`
- Buscar contas-a-pagar + contas-a-receber por `data_alteracao_de/ate` (sync incremental)
- Paginação automática (até 1000/página)
- Upsert em `contaazul_lancamentos`
- Sync de categorias, centros de custo, pessoas, contas financeiras

**3.2.2 SQL Function:**
- `executar_contaazul_sync_ambos_bares()` → substitui `executar_nibo_sync_ambos_bares()`
- Mesmos cron jobs (08h e 19h BRT)

### FASE 3: Calculadores + Views

**3.3.1 `calc-custos.ts`:**
- Trocar query de `nibo_agendamentos` → `contaazul_lancamentos`
- Manter lógica de `bar_categorias_custo` (mapeia categoria → tipo)
- `custo_atracao` continua funcionando igual

**3.3.2 `view_dre`:**
- Recriar JOIN com `contaazul_lancamentos` + `contaazul_categorias`
- Manter output idêntico (ano, mes, categoria_macro, total_valor)

### FASE 4: Frontend

**3.4.1 API Routes:**
- Criar novas rotas `/api/financeiro/contaazul/*` (ou adaptar as existentes)
- ContaAzulIntegrationCard (substituir NiboIntegrationCard)
- Tela de OAuth (botão "Conectar Conta Azul" → redirect → callback)

**3.4.2 Página de Agendamento:**
- Adaptar para criar contas-a-pagar via Conta Azul API
- Buscar pessoas (fornecedores) via `/v1/pessoas`

**3.4.3 NOVA: Página Contas a Pagar (diferencial):**
- DataTable com todas as colunas do CA + **data_competencia**
- Filtros: período, status, categoria, centro de custo, fornecedor
- Layout similar ao CA mas com as colunas que faltam
- Fonte: `contaazul_lancamentos` (local, rápido, offline)

### FASE 5: Cutover

**3.5.1 Período de transição:**
- Rodar NIBO sync + Conta Azul sync em paralelo (1-2 semanas)
- Validar que dados batem

**3.5.2 Desativar NIBO:**
- Desativar cron jobs nibo-sync-08h-ambos / nibo-sync-19h-ambos
- Manter tabelas nibo_* como histórico (read-only)
- Remover secrets NIBO do Supabase
- Marcar api_credentials.ativo = false para sistema='nibo'

---

## 4. Prompts para Cursor (Execução por Fase)

### PROMPT FASE 1A — Migração SQL (tabelas)
```
Crie a migração SQL para o projeto Zykor em database/migrations/20260324_contaazul_tables.sql.

Tabelas a criar (todas com bar_id, created_at, updated_at, RLS habilitado):

1. contaazul_lancamentos — equivalente a nibo_agendamentos:
   - id SERIAL PK
   - contaazul_id UUID UNIQUE (id do CA)
   - bar_id INTEGER NOT NULL REFERENCES bares(id)
   - tipo VARCHAR NOT NULL ('DESPESA'/'RECEITA')
   - status VARCHAR NOT NULL
   - descricao TEXT
   - observacao TEXT
   - valor_bruto NUMERIC NOT NULL
   - valor_liquido NUMERIC
   - valor_pago NUMERIC DEFAULT 0
   - data_vencimento DATE
   - data_competencia DATE
   - data_pagamento DATE
   - categoria_id UUID
   - categoria_nome VARCHAR
   - centro_custo_id UUID
   - centro_custo_nome VARCHAR
   - pessoa_id UUID
   - pessoa_nome VARCHAR
   - conta_financeira_id UUID
   - conta_financeira_nome VARCHAR
   - metodo_pagamento VARCHAR
   - numero_documento VARCHAR
   - numero_parcela INTEGER
   - total_parcelas INTEGER
   - data_alteracao TIMESTAMPTZ (data_alteracao do CA, para sync incremental)
   - raw_data JSONB DEFAULT '{}'
   - origem VARCHAR DEFAULT 'contaazul'
   - created_at/updated_at TIMESTAMPTZ
   Indexes: bar_id, (bar_id, data_competencia), (bar_id, data_vencimento), contaazul_id UNIQUE

2. contaazul_categorias:
   - id SERIAL PK
   - contaazul_id UUID UNIQUE
   - bar_id INTEGER REFERENCES bares(id)
   - nome VARCHAR NOT NULL
   - tipo VARCHAR ('RECEITA'/'DESPESA')
   - categoria_pai_id UUID
   - ativo BOOLEAN DEFAULT true
   - categoria_macro VARCHAR (para DRE, mapeamento manual)

3. contaazul_centros_custo:
   - id SERIAL PK
   - contaazul_id UUID UNIQUE
   - bar_id INTEGER REFERENCES bares(id)
   - codigo VARCHAR
   - nome VARCHAR NOT NULL
   - ativo BOOLEAN DEFAULT true

4. contaazul_pessoas:
   - id SERIAL PK
   - contaazul_id UUID UNIQUE
   - bar_id INTEGER REFERENCES bares(id)
   - nome VARCHAR NOT NULL
   - tipo_pessoa VARCHAR ('Física'/'Jurídica'/'Estrangeira')
   - documento VARCHAR
   - email VARCHAR
   - telefone VARCHAR
   - perfil VARCHAR ('Cliente'/'Fornecedor'/'Transportadora')
   - ativo BOOLEAN DEFAULT true

5. contaazul_contas_financeiras:
   - id SERIAL PK
   - contaazul_id UUID UNIQUE
   - bar_id INTEGER REFERENCES bares(id)
   - nome VARCHAR NOT NULL
   - tipo VARCHAR
   - banco VARCHAR
   - ativo BOOLEAN DEFAULT true

6. contaazul_logs_sincronizacao:
   - mesma estrutura que nibo_logs_sincronizacao

Habilitar RLS em todas. Policies: service_role full, authenticated SELECT com user_has_bar_access(bar_id).
Seguir convenções de database/CONVENTIONS.md.
```

### PROMPT FASE 1B — OAuth Edge Function
```
Crie a edge function contaazul-auth em backend/supabase/functions/contaazul-auth/index.ts.

Funcionalidades:
1. POST com action='get_auth_url' → retorna URL de autorização do Conta Azul
2. POST com action='callback' + code → troca code por tokens, salva em api_credentials
3. POST com action='refresh' → renova access_token usando refresh_token
4. POST com action='status' → verifica se tokens estão válidos

Detalhes OAuth:
- Auth URL: https://auth.contaazul.com/login?response_type=code&client_id=XXX&redirect_uri=YYY&state=ZZZ&scope=openid+profile+aws.cognito.signin.user.admin
- Token URL: https://auth.contaazul.com/oauth2/token
- Authorization header: Basic base64(client_id:client_secret)
- Salvar access_token, refresh_token, expires_at em api_credentials (sistema='contaazul')
- IMPORTANTE: Salvar novo refresh_token a cada renovação (muda!)

Usar _shared/supabase-client.ts e _shared/cors.ts existentes.
Tabela api_credentials já tem campos: access_token, refresh_token, expires_at, client_id, client_secret.
```

### PROMPT FASE 2 — Sync Edge Function
```
Crie a edge function contaazul-sync em backend/supabase/functions/contaazul-sync/index.ts.

Base API: https://api-v2.contaazul.com

Funcionalidades:
1. Sync contas-a-pagar: GET /v1/financeiro/eventos-financeiros/contas-a-pagar/buscar
2. Sync contas-a-receber: GET /v1/financeiro/eventos-financeiros/contas-a-receber/buscar
3. Sync categorias: GET /v1/categorias
4. Sync centros de custo: GET /v1/centro-de-custo
5. Sync pessoas: GET /v1/pessoas
6. Sync contas financeiras: GET /v1/conta-financeira

Modos de sync:
- 'daily_incremental': busca por data_alteracao dos últimos 2 dias
- 'full_month': busca por data_vencimento do mês atual + anterior
- 'custom': date range customizado

Para cada sync:
- Paginar automaticamente (tamanho_pagina=200)
- Auto-refresh token se 401
- Upsert em contaazul_lancamentos por contaazul_id
- Mapear campos conforme CONTA_AZUL_MIGRATION.md seção 2.5
- Logar em contaazul_logs_sincronizacao
- Heartbeat em cron_heartbeats

Parametros: bar_id, sync_mode, date_from, date_to
Ler credentials de api_credentials WHERE sistema='contaazul' AND bar_id=X.
```

### PROMPT FASE 3 — Calculador + View DRE
```
Atualize calc-custos.ts em backend/supabase/functions/_shared/calculators/calc-custos.ts.

Mudança: trocar query de nibo_agendamentos para contaazul_lancamentos.

Antes: query nibo_agendamentos WHERE tipo='despesa' AND categoria_nome IN (categorias de bar_categorias_custo)
Depois: query contaazul_lancamentos WHERE tipo='DESPESA' AND categoria_nome IN (mesmas categorias)

Manter fallback: se contaazul_lancamentos vazio, tentar nibo_agendamentos (período de transição).

Também recriar view_dre em database/views/view_dre.sql:
- JOIN contaazul_lancamentos + contaazul_categorias (em vez de nibo_*)
- Manter output idêntico: ano, mes, categoria_macro, total_valor, total_registros, origem
```

### PROMPT FASE 4A — Página Contas a Pagar (DIFERENCIAL)
```
Crie a página /financeiro/contas-a-pagar no frontend Zykor (Next.js 15, React 19, Tailwind, Radix UI).

Requisitos:
1. DataTable com colunas: Status, Descrição, Fornecedor, Categoria, Centro de Custo, Valor Bruto, Valor Líquido, Data Vencimento, **Data Competência**, Data Pagamento, Conta Financeira, Método Pagamento
2. Filtros: período (vencimento ou competência), status multi-select, categoria, centro de custo, fornecedor, busca texto
3. Paginação server-side (busca em contaazul_lancamentos)
4. Totalizadores: total em aberto, total pago, total atrasado
5. Export CSV
6. Layout similar ao Conta Azul (clean, profissional)
7. Respeitar BarContext (bar_id do bar selecionado)

Fonte de dados: API route /api/financeiro/contaazul/lancamentos que consulta contaazul_lancamentos com filtros.
Usar os mesmos componentes de UI que o resto do projeto (verificar frontend/src/components/ui/).
```

### PROMPT FASE 4B — Card de Integração + OAuth UI
```
Crie o ContaAzulIntegrationCard em frontend/src/components/configuracoes/ContaAzulIntegrationCard.tsx.

Similar ao NiboIntegrationCard existente, mas para Conta Azul:
1. Status: Conectado/Desconectado
2. Botão "Conectar Conta Azul" → abre popup OAuth → callback salva tokens
3. Botão "Sincronizar Agora"
4. Estatísticas: lançamentos, categorias, centros de custo, pessoas
5. Último sync: data/hora + status

OAuth callback: criar /api/financeiro/contaazul/oauth/callback que recebe o code e chama a edge function contaazul-auth.
```

---

## 5. Ordem de Execução

```
FASE 1A: SQL Migration (tabelas)           → Cursor Prompt 1A
FASE 1B: OAuth Edge Function               → Cursor Prompt 1B
FASE 1B+: Configurar app no Portal CA      → Manual (Rodrigo)
FASE 1B++: Primeira conexão OAuth           → Manual (teste)
FASE 2:  Sync Edge Function                → Cursor Prompt 2
FASE 2+: Testar sync + validar dados       → Manual
FASE 3:  Calculador + View DRE             → Cursor Prompt 3
FASE 4A: Página Contas a Pagar             → Cursor Prompt 4A
FASE 4B: Card Integração + OAuth UI        → Cursor Prompt 4B
FASE 5:  Cutover (paralelo → desativar NIBO) → Manual
```

---

## 6. Notas Importantes

- **NUNCA deletar tabelas nibo_*** → manter como histórico read-only
- **bar_categorias_custo** precisa ser atualizada com nomes de categorias do CA (pode ser diferente do NIBO)
- **refresh_token muda a cada renovação** → sempre salvar o novo
- **Rate limit 429** → implementar retry com backoff exponencial
- **data_alteracao** é chave para sync incremental eficiente (não buscar tudo toda vez)
- **Dois bares** → cada bar terá suas próprias credenciais OAuth no Conta Azul
