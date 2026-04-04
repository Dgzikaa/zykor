# Migração Completa: Nibo → Conta Azul

## Status Atual
✅ **Fase 1 Concluída**: Lançamentos financeiros básicos migrados
🔄 **Fase 2 Em Andamento**: Migração completa de todas as funcionalidades

---

## Mapeamento de Endpoints: Nibo vs Conta Azul

### 1. Contas a Pagar/Receber (Schedules)

| Funcionalidade | Nibo | Conta Azul |
|---|---|---|
| **Listar Despesas** | `GET /schedules/debit` | `GET /v1/financeiro/eventos-financeiros/contas-a-pagar/buscar` |
| **Listar Receitas** | `GET /schedules/credit` | `GET /v1/financeiro/eventos-financeiros/contas-a-receber/buscar` |
| **Criar Despesa** | `POST /schedules/debit` | `POST /v1/financeiro/eventos-financeiros/contas-a-pagar` |
| **Criar Receita** | `POST /schedules/credit` | `POST /v1/financeiro/eventos-financeiros/contas-a-receber` |
| **Buscar por ID** | `GET /schedules/{id}` | `GET /v1/financeiro/eventos-financeiros/{id_evento}/parcelas` |
| **Detalhes Parcela** | N/A | `GET /v1/financeiro/eventos-financeiros/parcelas/{id}` |

### 2. Categorias

| Funcionalidade | Nibo | Conta Azul |
|---|---|---|
| **Listar Categorias** | `GET /categories` | `GET /v1/categorias` |
| **Filtrar por Tipo** | `?type=EXPENSE/REVENUE` | `?tipo=DESPESA/RECEITA` |
| **Categorias DRE** | N/A | `GET /v1/financeiro/categorias-dre` |

### 3. Centros de Custo

| Funcionalidade | Nibo | Conta Azul |
|---|---|---|
| **Listar Centros** | `GET /cost-centers` | `GET /v1/centro-de-custo` |
| **Criar Centro** | `POST /cost-centers` | `POST /v1/centro-de-custo` |
| **Filtrar Status** | `?status=active` | `?status=ATIVO/INATIVO/TODOS` |

### 4. Stakeholders (Fornecedores/Clientes)

| Funcionalidade | Nibo | Conta Azul |
|---|---|---|
| **Listar Fornecedores** | `GET /stakeholders?type=supplier` | `GET /v1/fornecedores` |
| **Listar Clientes** | `GET /stakeholders?type=customer` | `GET /v1/clientes` |
| **Criar Fornecedor** | `POST /stakeholders` | `POST /v1/fornecedores` |
| **Buscar por CPF/CNPJ** | `?document={doc}` | `?cpf_cnpj={doc}` |

### 5. Contas Bancárias

| Funcionalidade | Nibo | Conta Azul |
|---|---|---|
| **Listar Contas** | `GET /bank-accounts` | `GET /v1/contas-bancarias` |
| **Saldo Conta** | `GET /bank-accounts/{id}/balance` | `GET /v1/contas-bancarias/{id}/saldo` |

### 6. Funcionários (Employees)

| Funcionalidade | Nibo | Conta Azul |
|---|---|---|
| **Listar Funcionários** | `GET /employees` | ⚠️ **Não disponível na API Conta Azul** |

---

## Estrutura de Dados: Mapeamento de Campos

### Lançamentos Financeiros

| Campo Nibo | Campo Conta Azul | Observações |
|---|---|---|
| `scheduleId` | `id_evento` | ID do evento financeiro |
| `value` | `total` | Valor em **centavos** no CA |
| `paidValue` | `pago` | Valor pago em **centavos** |
| `dueDate` | `data_vencimento` | Data de vencimento |
| `paymentDate` | `data_pagamento` | Data de pagamento |
| `accrualDate` | `data_competencia` | Data de competência |
| `description` | `descricao` | Descrição |
| `status` | `status` | PENDING/ACQUITTED/OVERDUE |
| `stakeholder.name` | `pessoa_nome` | Nome fornecedor/cliente |
| `categories[0].categoryName` | `categoria_nome` | Nome da categoria |
| `costCenters[0].costCenterName` | `centro_custo_nome` | Nome do centro de custo |
| `bankAccount.name` | `conta_financeira.nome` | Conta bancária |

### Status: Mapeamento

| Nibo | Conta Azul |
|---|---|
| `PENDING` | `PENDING` |
| `PAID` | `ACQUITTED` |
| `OVERDUE` | `OVERDUE` |
| `CANCELED` | `CANCELED` |

---

## Tabelas do Banco: Migração

### Tabela Atual: `nibo_agendamentos`
**Ações necessárias:**
1. Renomear para `lancamentos_financeiros` (genérico)
2. OU criar view que une `nibo_agendamentos` + `contaazul_lancamentos`
3. OU migrar todos os dados históricos para `contaazul_lancamentos`

### Campos a Adicionar em `contaazul_lancamentos`

```sql
-- Campos para compatibilidade com sistema de agendamento
ALTER TABLE contaazul_lancamentos ADD COLUMN IF NOT EXISTS
  inter_codigo_solicitacao VARCHAR(100),
  inter_status VARCHAR(50),
  inter_data_aprovacao TIMESTAMPTZ,
  inter_data_efetivacao TIMESTAMPTZ,
  inter_chave_pix TEXT,
  agendado BOOLEAN DEFAULT FALSE,
  data_agendamento TIMESTAMPTZ,
  processado BOOLEAN DEFAULT FALSE,
  data_processamento TIMESTAMPTZ;

-- Índices
CREATE INDEX IF NOT EXISTS idx_contaazul_inter_codigo 
  ON contaazul_lancamentos(inter_codigo_solicitacao);
CREATE INDEX IF NOT EXISTS idx_contaazul_agendado 
  ON contaazul_lancamentos(agendado) WHERE agendado = TRUE;
```

---

## Edge Functions: Migração

### 1. `nibo-sync` → `contaazul-sync`
✅ **Status**: Já criado e funcional

### 2. Novos Endpoints Necessários

#### `/api/financeiro/contaazul/categorias`
- Buscar categorias do Conta Azul
- Sincronizar com banco local

#### `/api/financeiro/contaazul/centros-custo`
- Buscar centros de custo
- Sincronizar com banco local

#### `/api/financeiro/contaazul/stakeholders`
- Buscar fornecedores/clientes
- Sincronizar com banco local

#### `/api/financeiro/contaazul/schedules`
- **Substituir** `/api/financeiro/nibo/schedules`
- Buscar agendamentos futuros

---

## Código Afetado: Arquivos a Atualizar

### Edge Functions
- ✅ `contaazul-sync/index.ts` - Já criado
- 🔄 `cmv-semanal-auto/index.ts` - Trocar `nibo_agendamentos` por `contaazul_lancamentos`
- 🔄 `inter-pix-webhook/index.ts` - Atualizar para `contaazul_lancamentos`

### API Routes (Frontend)
- 🔄 `/api/visao-geral/indicadores-mensais/route.ts`
- 🔄 `/api/gestao/desempenho/recalcular/route.ts`
- 🔄 `/api/analitico/semanal/route.ts`
- 🔄 `/api/estrategico/desempenho/route.ts`
- 🔄 `/api/estrategico/orcamentacao/route.ts`
- 🔄 `/api/cmv-semanal/buscar-dados-automaticos/route.ts`
- 🔄 `/api/cmv-semanal/buscar-cma/route.ts`
- 🔄 `/api/agendamento/*` - Múltiplos arquivos

### Criar Novos Endpoints
- ⚠️ `/api/financeiro/contaazul/categorias/route.ts`
- ⚠️ `/api/financeiro/contaazul/centros-custo/route.ts`
- ⚠️ `/api/financeiro/contaazul/stakeholders/route.ts`

---

## Plano de Migração: Fases

### ✅ Fase 1: Lançamentos Básicos (CONCLUÍDA)
- [x] Criar tabela `contaazul_lancamentos`
- [x] Edge Function `contaazul-sync`
- [x] Interface de visualização
- [x] Sincronização automática (cron)
- [x] OAuth e autenticação

### 🔄 Fase 2: Categorias e Centros de Custo (EM ANDAMENTO)
- [ ] Criar API `/api/financeiro/contaazul/categorias`
- [ ] Criar API `/api/financeiro/contaazul/centros-custo`
- [ ] Sincronizar categorias no banco
- [ ] Sincronizar centros de custo no banco
- [ ] Atualizar `contaazul-sync` para incluir categorias/centros

### 📋 Fase 3: Stakeholders
- [ ] Criar API `/api/financeiro/contaazul/stakeholders`
- [ ] Sincronizar fornecedores
- [ ] Sincronizar clientes
- [ ] Migrar sistema de agendamento

### 📋 Fase 4: Substituir Queries
- [ ] Criar view unificada `lancamentos_financeiros`
- [ ] Atualizar todas as queries de CMO
- [ ] Atualizar queries de desempenho
- [ ] Atualizar queries de orçamentação
- [ ] Atualizar webhook Inter PIX

### 📋 Fase 5: Desativação do Nibo
- [ ] Validar todos os dados migrados
- [ ] Desativar cron do Nibo
- [ ] Desativar Edge Function `nibo-sync`
- [ ] Manter tabela `nibo_agendamentos` como histórico (read-only)

---

## Riscos e Considerações

### ⚠️ Funcionários (Employees)
- **Problema**: Conta Azul não tem endpoint de funcionários
- **Solução**: Manter tabela local ou usar módulo de RH separado

### ⚠️ Integração Inter PIX
- Webhook atualiza `nibo_agendamentos` via `inter_codigo_solicitacao`
- Precisa atualizar para `contaazul_lancamentos`

### ⚠️ Dados Históricos
- Decidir se migra histórico do Nibo ou mantém duas tabelas
- Recomendação: Criar view unificada

---

## Próximos Passos Imediatos

1. **Criar endpoints de categorias e centros de custo**
2. **Atualizar `contaazul-sync` para buscar categorias/centros**
3. **Criar view unificada de lançamentos**
4. **Atualizar queries mais críticas (CMO, Desempenho)**
5. **Testar em paralelo (Nibo + Conta Azul) antes de desativar**
