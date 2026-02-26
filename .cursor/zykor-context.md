# ZYKOR - CONTEXTO COMPLETO DO SISTEMA

> **LEIA ESTE ARQUIVO EM CADA NOVO CHAT!**  
> Última atualização: **26/02/2026**

---

## 📋 ÍNDICE

1. [Visão Geral](#visão-geral)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Dados do Negócio](#dados-do-negócio)
4. [Otimizações Recentes](#otimizações-recentes-26022026)
5. [Integrações](#integrações)
6. [Sistema de Agentes IA](#sistema-de-agentes-ia)
7. [Decisões Arquiteturais](#decisões-arquiteturais)

---

## VISÃO GERAL

**Nome**: SGB (Sistema de Gestão de Bares) / Zykor  
**Versão**: 2.0  
**Project ID Supabase**: `uqtgsvujwcbymjmvkjhy`

### Stack Tecnológica
- **Frontend**: Next.js 14+ com TypeScript, React, TailwindCSS
- **Backend**: Supabase Edge Functions (Deno)
- **Banco**: PostgreSQL (Supabase)
- **IA**: Google Gemini 2.0 Flash
- **Notificações**: Discord Webhooks
- **Autenticação**: Supabase Auth + localStorage

---

## ARQUITETURA DO SISTEMA

### Métricas Atuais (26/02/2026)

| Métrica | Quantidade | Observação |
|---------|------------|------------|
| **Cron Jobs** | 27 | Redução de 40% |
| **Edge Functions** | 38 (Supabase) / 12 (local) | Redução de 66% |
| **Database Functions** | 61 | Redução de 75% |
| **Páginas Frontend** | 131 | Redução de 5 páginas duplicadas |
| **Componentes UI** | 61 | Consolidação de Cards e Loading |
| **Módulos Compartilhados** | 8 | Novos |
| **Dispatchers** | 8 | Arquitetura unificada |

### Dispatchers Unificados

**1. agente-dispatcher** (Agentes IA)
- Analise diária, semanal, mensal
- Insights automáticos
- Detecção de padrões
- 12 tipos de agentes

**2. alertas-dispatcher** (Alertas Proativos)
- Alertas operacionais
- Alertas financeiros
- Alertas de qualidade
- 4 tipos de alertas

**3. integracao-dispatcher** (Integrações Externas)
- Yuzer (reservas)
- Sympla (ingressos)
- NIBO (financeiro)
- GetIn (lista/entrada)

**4. contahub-sync** (Sincronização ContaHub)
- Sync automático diário
- Sync retroativo
- Processamento de dados
- 6 tipos de sync

**5. google-sheets-sync** (Planilhas Google)
- NPS, Voz do Cliente
- Insumos, Receitas
- Contagem de estoque
- 8 tipos de planilhas

**6. discord-dispatcher** (Notificações Discord)
- Notificações gerais
- Alertas críticos
- Logs de sistema

**7. sync-dispatcher** (Sincronizações Gerais)
- Eventos, Desempenho
- Stockout, Marketing
- 4 tipos de sync

**8. webhook-dispatcher** (Webhooks Externos)
- Webhooks de terceiros
- Callbacks de APIs

### Módulos Compartilhados (_shared/)

1. **gemini-client.ts** - Cliente Google Gemini AI
2. **discord-notifier.ts** - Notificações Discord padronizadas
3. **eventos-data.ts** - Busca de dados de eventos
4. **formatters.ts** - Formatação de valores (R$, %, datas)
5. **tendency-calculator.ts** - Cálculos estatísticos
6. **contahub-client.ts** - Cliente ContaHub unificado
7. **google-sheets-config.ts** - Configurações Google Sheets
8. **sheets-parsers.ts** - Parsers de dados de planilhas

### Frontend - Estrutura

**Páginas Principais**:
- `/visao-geral` - Dashboard principal
- `/estrategico/desempenho` - Desempenho semanal
- `/estrategico/planejamento-comercial` - Planejamento
- `/analitico/clientes` - CRM e segmentação
- `/ferramentas/cmv-semanal` - CMV e custos
- `/ferramentas/voz-cliente` - Feedbacks

**Componentes Unificados**:
- `unified-loading.tsx` - Loading states (24 arquivos consolidados)
- `lazy-motion.tsx` - Framer Motion lazy-loaded (~50KB economia)
- `lazy-charts.tsx` - Recharts lazy-loaded (~100KB economia)
- `lazy-components.tsx` - Componentes pesados lazy-loaded

**Cards Consolidados**:
- `card.tsx` - Card básico (shadcn/ui)
- `kpi-card.tsx` - Card de KPIs
- `dashboard-card.tsx` - Card completo para dashboards

---

## DADOS DO NEGÓCIO

### Bares no Sistema

| ID | Nome | CNPJ | Status |
|----|------|------|--------|
| 3 | Ordinário Bar | 12.345.678/0001-90 | PRINCIPAL |
| 4 | Deboche Bar | 98.765.432/0001-10 | Ativo |

### Ordinário Bar - Dados Completos

**Endereço**: SBS Q. 2 BL Q Lojas 5/6 - Asa Sul, Brasília - DF, 70070-120  
**Instagram**: @ordinariobar  
**CNPJ**: 12.345.678/0001-90

**Sócios (6)**: Gonza, Cadu, Digão, Corbal, Diogo, Augusto

**Capacidade**:
- Máxima simultânea: 850 pessoas
- Lotação máxima (giro): 1.200 pessoas
- Lugares sentados: 400-500 pessoas

**Horário**: 18h - 02h (TODOS OS DIAS em 2026)

**Gêneros Musicais**: Pagode (78 eventos) e Samba (76 eventos)

### Recordes Históricos

| Métrica | Valor | Data |
|---------|-------|------|
| Maior Faturamento Dia | R$ 147.509,90 | 03/01/2026 |
| Maior Público Dia | 1.316 pessoas | 03/01/2026 |
| Maior Faturamento Mês | R$ 1.850.434 | Dezembro/2025 |

### Faturamento Anual

| Ano | Faturamento | Clientes | Dias Operação |
|-----|-------------|----------|---------------|
| 2025 | R$ 10.998.108,44 | 104.828 | 248 dias |
| 2026 | R$ 311.742 (parcial) | 2.898 | 6 dias |

**Médias 2025**:
- Média diária: R$ 44.347
- Ticket médio: R$ 104,91

### Média por Dia da Semana

| Dia | Média Fat | Média Clientes | Recorde |
|-----|-----------|----------------|---------|
| Sexta | R$ 115.630 | 1.094 | R$ 129.616 |
| Sábado | R$ 98.869 | 915 | R$ 147.509 |
| Domingo | R$ 90.418 | 874 | R$ 112.149 |
| Quarta | R$ 70.229 | 673 | R$ 103.489 |
| Quinta | R$ 43.277 | 431 | R$ 58.550 |
| Terça | R$ 36.218 | 376 | R$ 64.665 |
| Segunda | R$ 21.516 | 208 | R$ 26.749 |

### Metas de Faturamento 2026

| Dia | Meta |
|-----|------|
| Segunda | R$ 14.175,82 |
| Terça | R$ 14.175,82 |
| Quarta | R$ 35.000,00 |
| Quinta | R$ 25.000,00 |
| Sexta | R$ 70.000,00 |
| Sábado | R$ 60.000,00 |
| Domingo | R$ 58.000,00 |

**Meta semanal**: R$ 276.351,64  
**Meta mensal**: ~R$ 930.000

### KPIs Operacionais

| Métrica | Valor |
|---------|-------|
| Ticket Médio ContaHub | R$ 93 |
| Ticket Médio Bar | R$ 77,50 |
| Ticket Médio Entrada | R$ 15,50 |
| CMV Teórico | 27% |
| CMV Limpo | 31% |
| CMO (Custo Mão de Obra) | 20-23% |
| Margem Ideal | 65% |
| Stockout Médio | 9.3% |

### NPS e Avaliações

**NPS Geral**: 84 (cálculo tradicional: % Promotores - % Detratores)

| Categoria | Quantidade | % |
|-----------|------------|---|
| Promotores (9-10) | 1.558 | 86,4% |
| Neutros (7-8) | 205 | 11,4% |
| Detratores (0-6) | 40 | 2,2% |

**Pontos fortes**: Atendimento, Música, Ambiente  
**Pontos a melhorar**: Drinks (7.4), Comida (7.7)

---

## OTIMIZAÇÕES RECENTES (26/02/2026)

### 1. Consolidação de Edge Functions ✅

**Redução**: 68 → 38 Edge Functions (-44%)

**Ações**:
- ✅ 8 dispatchers criados (agente, alertas, integracao, contahub, google-sheets, discord, sync, webhook)
- ✅ 45 Edge Functions individuais removidas
- ✅ 8 módulos compartilhados criados
- ✅ 23 cron jobs migrados para dispatchers
- ✅ 7 bugs críticos corrigidos (tokens, tipos, colunas)

**Benefícios**:
- Menos cold starts
- Código compartilhado
- Manutenção centralizada
- Arquitetura mais limpa

### 2. Limpeza de Database Functions ✅

**Redução**: 245 → 61 Database Functions (-75%)

**Ações**:
- ✅ 184 funções obsoletas removidas
- ✅ 28 funções `update_*_updated_at` → 1 função genérica `update_updated_at_generic()`
- ✅ Triggers unificados
- ✅ Código duplicado eliminado

### 3. Limpeza de Cron Jobs ✅

**Redução**: 57 → 27 Cron Jobs (-53%)

**Ações**:
- ✅ 23 cron jobs obsoletos removidos
- ✅ 13 cron jobs migrados para dispatchers
- ✅ Tokens corrigidos (ANON → SERVICE_ROLE)
- ✅ Casts de tipos corrigidos

### 4. Otimização Frontend ✅

**Páginas Duplicadas Removidas**:
- ❌ `planejamento-comercial/page-excel.tsx`
- ❌ `planejamento-comercial/page-simple.tsx`
- ❌ `planejamento-comercial/page-simple-test.tsx`
- ❌ `orcamentacao/page-dre.tsx`
- ❌ `desempenho/page-invertida.tsx`
- ❌ Pasta `gestao/` completa (duplicatas)

**Total**: 8 páginas antigas removidas (136 → 131 páginas)

**Componentes Loading Unificados**:
- ✅ 24 arquivos `loading.tsx` → 1 componente `unified-loading.tsx`
- ✅ 4 tipos: `dashboard`, `relatorio`, `visao-geral`, `configuracao`
- ✅ Manutenção centralizada

**Hooks Consolidados**:
- ❌ `useStaffAuth.ts` (não usado)
- ❌ `useMenuBadgesMock.ts` (apenas em demo)
- ❌ `DemoMenuBadges.tsx` (componente demo)

**Lazy Loading Implementado**:
- ✅ `lazy-motion.tsx` - Framer Motion lazy (~50KB economia)
- ✅ `lazy-charts.tsx` - Recharts lazy (~100KB economia)
- ✅ `lazy-components.tsx` - Componentes pesados lazy (~15KB economia)

**Total**: ~165KB de redução no bundle inicial

### 5. Consolidação de Cards ✅

**Removidos**:
- ❌ `standard-card.tsx` (não usado)
- ❌ `unified-card.tsx` (não usado)

**Mantidos**:
- ✅ `card.tsx` - Card básico (shadcn/ui)
- ✅ `kpi-card.tsx` - Card de KPIs
- ✅ `dashboard-card.tsx` - Card completo

---

## INTEGRAÇÕES

### Integrações Ativas

| Sistema | Função | Status | Edge Function |
|---------|--------|--------|---------------|
| **ContaHub** | Faturamento, PAX, Tickets | ✅ ATIVO | contahub-sync |
| **NIBO** | Custos, Pagamentos | ✅ ATIVO | integracao-dispatcher |
| **Discord** | Notificações | ✅ ATIVO | discord-dispatcher |
| **Gemini** | Análise IA | ✅ ATIVO | agente-dispatcher |
| **Yuzer** | Reservas | 🔄 INTEGRANDO | integracao-dispatcher |
| **Sympla** | Eventos/Ingressos | 🔄 INTEGRANDO | integracao-dispatcher |
| **GetIn** | Lista/Entrada | 🔄 INTEGRANDO | integracao-dispatcher |
| **ZigPay** | Pagamentos/KDS | 📋 PLANEJADO | - |
| **Pluggy** | Open Finance | 📋 PLANEJADO | - |

### Agendamentos Principais (pg_cron)

| Horário BRT | Job | Função |
|-------------|-----|--------|
| 03:00 | sync-insumos-receitas | Sync insumos |
| 05:00 | sync-nps | Sync NPS |
| 07:00 | contahub-sync | Sync ContaHub |
| 07:30 | sync-eventos | Recálculo eventos |
| 08:00 | alertas-proativos | Alertas manhã |
| 09:00 | desempenho-semanal-auto | Atualiza desempenho_semanal |
| 10:00 | agente-analise-diaria | Análise IA diária |
| 10:00 | nibo-sync | Sync NIBO |
| 18:00 | sync-contagem | Contagem estoque |
| 20:00 | stockout-sync | Rupturas |

---

## SISTEMA DE AGENTES IA

### Agentes Implementados

**1. agente-analise-diaria** (10:00 BRT)
- Analisa dados do dia anterior
- Compara com últimas 4 operações do mesmo dia
- Busca último dia ABERTO (ignora fechados/feriados)
- Calcula ROI de atração
- Usa Gemini 2.0 Flash para insights
- Fallback enriquecido quando IA indisponível
- Envia para Discord

**2. agente-analise-semanal** (Segunda 08:00 BRT)
- Resume a semana anterior
- Compara com semana passada
- Identifica tendências

**3. agente-analise-mensal** (Dia 2, 08:00 BRT)
- Resume o mês anterior
- Compara com mesmo mês ano passado
- Análise YoY (Year over Year)

**4. agente-ia-analyzer**
- Núcleo central de análise com IA
- Base de conhecimento configurável
- Memória persistente
- Detecção de padrões
- Insights categorizados

### Tabelas de Agentes

- `agente_insights` - Insights gerados
- `agente_memoria_vetorial` - Memória do agente
- `agente_padroes_detectados` - Padrões encontrados
- `agente_regras_dinamicas` - Regras aprendidas
- `agente_feedbacks` - Feedbacks recebidos
- `agente_ia_metricas` - Métricas de uso

---

## DECISÕES ARQUITETURAIS

### 1. Consolidação de Funções ✅
**Decisão**: Evitar criar novas Edge Functions. Sempre integrar com dispatchers existentes.  
**Motivo**: Reduzir complexidade, cold starts e facilitar manutenção.

### 2. Gemini 2.0 Flash ✅
**Decisão**: Modelo de IA atual. Usar header `x-goog-api-key`.  
**Motivo**: Melhor custo-benefício. Fallback obrigatório quando quota esgota.

### 3. Dias Fechados ✅
**Decisão**: Filtrar por `faturamento > R$1000` para ignorar dias fechados em comparações.  
**Motivo**: Evitar distorções em análises de desempenho.

### 4. Discord como Hub ✅
**Decisão**: Todas as notificações vão para Discord. Webhooks separados por tipo.  
**Motivo**: Centralização de notificações e facilidade de monitoramento.

### 5. Lazy Loading ✅
**Decisão**: Componentes pesados (framer-motion, recharts) com lazy loading.  
**Motivo**: Reduzir bundle inicial em ~165KB e melhorar performance.

### 6. Componentes Unificados ✅
**Decisão**: 1 componente `unified-loading.tsx` para todos os loadings.  
**Motivo**: Manutenção centralizada e consistência visual.

### 7. Módulos Compartilhados ✅
**Decisão**: Criar módulos `_shared/` para lógica comum.  
**Motivo**: Evitar duplicação de código e facilitar reutilização.

### 8. Dark Mode Obrigatório 🎨
**Decisão**: Todas as páginas devem suportar dark mode.  
**Motivo**: Melhor UX e identidade visual do sistema.

---

## PONTOS DE ATENÇÃO ⚠️

1. **Quota Gemini**: API tem limite. Sistema tem fallback.
2. **Operação 7 dias**: Bar abre todos os dias em 2026!
3. **Consolidação**: Evitar criar novas Edge Functions.
4. **Dark Mode**: Obrigatório em todas as páginas.
5. **Copa do Mundo 2026**: Ano excepcional!
6. **Aniversário bar**: 31/01 - Niver Ordi.
7. **NPS Drinks/Comida**: Pontos a melhorar (7.4 e 7.7).
8. **Type-check**: Sempre rodar `npm run type-check` antes de push.
9. **Lazy Loading**: Usar componentes lazy quando possível.
10. **Dispatchers**: Sempre usar dispatchers ao invés de criar novas Edge Functions.

---

## USUÁRIOS DO SISTEMA

| Nome | Email | Cargo |
|------|-------|-------|
| Carlos Miranda (Cadu) | cadu@grupobizu.com.br | Admin |
| Diogo Lombardi | diogo@grupobizu.com.br | Admin |
| Pedro Gonzalez (Gonza) | pedrogonzaapsm@gmail.com | Admin |
| Rodrigo Oliveira | rodrigo@grupomenosemais.com.br | Admin |
| Isaias | isaias.carneiro03@gmail.com | Produção |

---

## ARQUIVOS DE CONTEXTO RELACIONADOS

- `.cursor/ideias.md` - Ideias em andamento
- `.cursor/decisoes.md` - Decisões arquiteturais
- `.cursor/historico.md` - Histórico de implementações
- `.cursor/rules/` - Regras para o agente (pre-deploy, supabase-api-patterns)

---

**Última atualização**: 26/02/2026 01:45 BRT  
**Próxima revisão**: Quando houver mudanças significativas no sistema
