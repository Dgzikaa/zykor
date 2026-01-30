# 📜 HISTÓRICO DE IMPLEMENTAÇÕES - ZYKOR

> **IMPORTANTE**: Registre aqui tudo que foi implementado.
> Ao finalizar uma sessão, atualize este arquivo.

---

## 2026-01

### 2026-01-30 - Correção de Tempos Bar/Cozinha e dt_gerencial

**O que foi feito:**

1. **Correção de Tempos de Produção:**
   - ✅ Bar agora usa `t0_t3` (lançamento → entrega) em vez de `t0_t2`
   - ✅ Cozinha continua usando `t0_t2` (lançamento → fim produção)
   - ✅ Atrasos Bar: `t0_t3 > 4 minutos`
   - ✅ Atrasos Cozinha: `t0_t2 > 12 minutos`
   - ✅ Outliers removidos do cálculo (>30min bar, >60min cozinha)
   - ✅ Recalculadas todas as 57 semanas históricas

2. **Correção de dt_gerencial (Turno Errado):**
   - ✅ Adicionada função `calcularDataReal()` no `contahub-processor`
   - ✅ Regra: Se `hr_lancamento::date > dt_gerencial` E `hora >= 15h` → corrige data
   - ✅ Aplica em: pagamentos, tempo, periodo, vendas
   - ✅ Corrigidos 5.707 registros históricos

3. **Ressincronização ContaHub:**
   - ✅ Ressincronizados dias 26, 27, 29 e 30 de janeiro
   - ✅ Faturamento corrigido: R$34k → R$75k na semana

**Edge Functions atualizadas:**
- `contahub-processor` (v6) - com função `calcularDataReal()`
- `desempenho-semanal-auto` (v33) - já estava com t0_t3 para bar

**Arquivos alterados:**
- `backend/supabase/functions/contahub-processor/index.ts`
- `frontend/src/app/estrategico/desempenho/page.tsx` (calculo display)
- `.cursor/zykor-context.md` (documentação atualizada)

---

### 2026-01-16 - Página de Eventos e Correção de Produtos

**O que foi feito:**
- ✅ Corrigido filtro `not...in` na API `produtos-por-hora` que estava com sintaxe incorreta
- ✅ Antes: `'("Mercadorias- Compras","Insumos","Uso Interno")'` (errado)
- ✅ Depois: `'(Mercadorias- Compras,Insumos,Uso Interno)'` (correto)
- ✅ Página `/analitico/eventos` agora exibe produtos corretamente

**Arquivos alterados:**
- `frontend/src/app/api/ferramentas/produtos-por-hora/route.ts`

**Problema resolvido:** Página de eventos mostrava "Nenhum produto encontrado" mesmo tendo 4188 registros

---

### 2026-01-16 - Integração Marketing Meta/Google + Tab Mensal

**O que foi feito:**
- ✅ Criada tabela `marketing_semanal` para armazenar dados de marketing
- ✅ Criada Edge Function `sync-marketing-meta` - busca dados do Meta Ads e Instagram Organic
- ✅ Criada Edge Function `sync-marketing-google` - busca dados do Google Ads e GMB
- ✅ Criada Edge Function `sync-marketing-auto` - orquestra sync automático
- ✅ Configurado cron job diário às 07:00 BRT para sync automático
- ✅ Sincronizados dados históricos de Fev/2025 até Jan/2026 (Meta)
- ✅ Implementada aba "Mensal" na página de desempenho
- ✅ Criada API `/api/estrategico/desempenho/mensal` - agrega dados semanais em mensais
- ✅ Atualizada API `/api/estrategico/desempenho/semana` - mescla dados de `marketing_semanal`
- ✅ Corrigido cálculo de timezone no `alertas-inteligentes` (usava UTC, agora usa BRT)

**Arquivos criados:**
- `backend/supabase/functions/sync-marketing-meta/index.ts`
- `backend/supabase/functions/sync-marketing-google/index.ts`
- `backend/supabase/functions/sync-marketing-auto/index.ts`
- `frontend/src/app/api/estrategico/desempenho/mensal/route.ts`

**Arquivos alterados:**
- `frontend/src/app/estrategico/desempenho/page.tsx` (tab mensal, layout melhorado)
- `frontend/src/app/api/estrategico/desempenho/semana/route.ts` (merge marketing)
- `backend/supabase/functions/alertas-inteligentes/index.ts` (timezone fix)

**Pendências:**
- ⏳ Instagram Organic Insights - aguardando acesso ao Business Manager da Supersal
- ⏳ Google Ads API - aguardando `GOOGLE_ADS_CUSTOMER_ID` e `GOOGLE_ADS_DEVELOPER_TOKEN`
- ⏳ Google My Business API - aguardando `GOOGLE_GMB_LOCATION_ID`

---

### 2026-01-16 - Melhorias Layout Desempenho

**O que foi feito:**
- ✅ Layout da página `/estrategico/desempenho` aproveitando tela inteira
- ✅ Indicadores lado a lado (não mais empilhados)
- ✅ Combinados cockpits "Qualidade" e "OVT - Clientes" em uma seção
- ✅ Todos os cockpits expandidos por padrão
- ✅ Adicionado ícone de lápis para campos manuais editáveis

---

### 2026-01-15 - Extração e Documentação Conselho de Cotistas

**O que foi feito:**
- ✅ Extraído conteúdo de 2 PDFs da reunião de conselho (script Node.js + pdfjs-dist)
- ✅ Documentados resultados financeiros 4º Tri 2025:
  - EBITDA: R$ 611.861,98
  - FCO: R$ 252.058,33
  - CMV Médio: 26%
  - Investimento inicial 100% pago
- ✅ Documentadas decisões do Conselho de Cotistas:
  - DEC-050: Distribuição R$ 390.000 em lucros
  - DEC-051: Investimentos R$ 466.000 aprovados (Telão LED, Retrofit, etc)
  - DEC-052: Valor sugerido CFO R$ 540.000
  - DEC-053: Migração para Zykor aprovada
- ✅ Documentada sociedade e participações:
  - Grupo Bizu: 65,472%
  - Digão: 16,368%
  - Augusto: 11,16%
  - Cidades: 5%
  - 3V: 1%
  - Gugu: 1%
- ✅ Atualizado contexto com métricas de desempenho:
  - Faturamento explodiu de R$ 1.2mi para R$ 1.6mi/mês
  - Meta clientes: era 3.000, alcançou 5.000!
  - Todos os dias aumentaram faturamento

**Arquivos criados/alterados:**
- `exemplo_teste/extract-pdf.js` - Script extrator de PDF
- `exemplo_teste/*.txt` - Textos extraídos dos PDFs
- `.cursor/zykor-context.md` - Atualizado com dados 4º Tri
- `.cursor/decisoes.md` - Novas decisões DEC-050 a DEC-053
- `.cursor/historico.md` - Este registro

**Motivo:** Alimentar agentes com dados estratégicos do negócio

---

### 2026-01-15 - Yuzer Sync Multi-dias e Categorização

**O que foi feito:**
- ✅ Corrigido processamento de eventos multi-dias (Carnaval, festivais)
- ✅ Nova função `extrairDatasDoNomeEvento` para detectar períodos
- ✅ Dados diários agora são inseridos corretamente em `yuzer_pagamento`
- ✅ RPC `update_eventos_base_with_sympla_yuzer` corrigida
- ✅ Criadas views de categorização:
  - `yuzer_produtos_categorizado` - Classifica em BILHETERIA, CERVEJA, DRINKS, etc
  - `yuzer_resumo_por_categoria` - Totais diários por categoria
- ✅ Agente SQL Expert atualizado com conhecimento de múltiplas fontes

**Arquivos alterados:**
- `backend/supabase/functions/yuzer-sync/index.ts`
- `backend/supabase/functions/agente-sql-expert/index.ts`
- Migrations para views e RPC

**Problema resolvido:** Carnaval tinha faturamento só no dia 1, agora distribui corretamente pelos 4 dias

---

### 2026-01-09 - Sistema de Contexto MEGA Completo

**O que foi feito:**
- ✅ Criado `.cursor/zykor-context.md` - contexto COMPLETO do sistema
- ✅ Criado `.cursor/ideias.md` - ideias em andamento
- ✅ Criado `.cursor/decisoes.md` - decisoes arquiteturais
- ✅ Criado `.cursor/historico.md` - historico de implementacoes
- ✅ Atualizado `.cursorrules` para ler esses arquivos automaticamente

**Dados coletados do banco e documentados:**
- ✅ Faturamento anual 2025: R$ 10.998.108,44 (104.828 clientes)
- ✅ Faturamento mensal dos ultimos 12 meses
- ✅ Recordes: R$ 147.509 (maior dia), 1.316 pessoas (maior publico)
- ✅ Media de faturamento por dia da semana (historico real)
- ✅ Top artistas por faturamento (Benzadeus, Breno Alves, etc)
- ✅ Top 10 melhores dias com datas e artistas
- ✅ NPS real: Geral 9.3, Atendimento 9.5, Musica 9.5
- ✅ Top 10 produtos mais vendidos
- ✅ Categorias de produtos por volume
- ✅ 50+ jobs pg_cron documentados
- ✅ Usuarios do sistema (Cadu, Diogo, Gonza, Rodrigo, Isaias)
- ✅ Checklists ativos

**Informacoes do usuario documentadas:**
- ✅ Operacao 7 dias por semana em 2026 (novo!)
- ✅ Metas de segunda e terca: R$ 14.175,82
- ✅ Capacidade: 850 simultaneo, 1.200 giro, 400-500 sentados
- ✅ Horario: 18h - 02h
- ✅ Endereco: SBS Q. 2 BL Q Lojas 5/6 - Asa Sul, Brasilia
- ✅ Instagram: @ordinariobar
- ✅ 6 socios: Gonza, Cadu, Digao, Corbal, Diogo, Augusto
- ✅ Programacao completa de Janeiro 2026
- ✅ Niver Ordi: 31/01
- ✅ Copa do Mundo 2026 - ano excepcional
- ✅ Sazonalidade: fortes (Out-Dez), fracos (Jan-Fev)

**Sistema de Agentes documentado:**
- ✅ agente-analise-diaria (10:00 BRT)
- ✅ agente-analise-semanal (Segunda 08:00)
- ✅ agente-analise-mensal (Dia 2, 08:00)
- ✅ agente-ia-analyzer (nucleo central)
- ✅ Tabelas de agentes mapeadas

**Arquivos criados/alterados:**
- `.cursor/zykor-context.md`
- `.cursor/ideias.md`
- `.cursor/decisoes.md`
- `.cursor/historico.md`
- `.cursorrules`

**Motivo:** Garantir continuidade entre sessoes de chat, agente tem memoria COMPLETA do projeto

---

### 2026-01-09 - Melhoria Profunda na Análise Diária

**O que foi feito:**
- ✅ Análise diária busca última operação REAL do mesmo dia (ignora fechados)
- ✅ Filtro: só considera dias com faturamento > R$ 1.000
- ✅ Compara com últimas 4 operações do mesmo dia da semana
- ✅ Calcula estatísticas históricas (média, tendência, melhor/pior dia)
- ✅ Prompt do Gemini muito mais detalhado:
  - ROI da atração
  - Análise de margens
  - Gaps vs meta
  - Tendências
- ✅ Fallback enriquecido quando IA indisponível
- ✅ Atualizado modelo Gemini para `2.0-flash`
- ✅ Usa header `x-goog-api-key` ao invés de query param
- ✅ Desativado job duplicado `alertas-inteligentes-diario`

**Arquivos alterados:**
- `backend/supabase/functions/agente-analise-diaria/index.ts`
- `backend/supabase/functions/agente-ia-analyzer/index.ts`

**Problema resolvido:** Análise estava comparando com dia 01/01 (fechado), agora busca último dia operacional

---

### 2026-01-09 - Desativação de Alertas Duplicados

**O que foi feito:**
- ✅ Identificado job `alertas-inteligentes-diario` enviando alertas básicos
- ✅ Este job rodava 10:30, depois do `agente-analise-diaria` (10:00)
- ✅ Causava confusão com mensagens tipo "Faturamento abaixo da meta"
- ✅ Job desativado via pg_cron

**Query executada:**
```sql
SELECT cron.unschedule('alertas-inteligentes-diario');
```

---

### 2026-01-08 - Criação dos Agentes de Análise

**O que foi feito:**
- ✅ Criado `agente-analise-diaria` - análise profunda diária com IA
- ✅ Criado `agente-analise-semanal` - resumo semanal comparativo
- ✅ Criado `agente-analise-mensal` - resumo mensal com YoY
- ✅ Configurados agendamentos pg_cron:
  - Diária: 10:00 (13:00 UTC)
  - Semanal: Segunda 08:00 (11:00 UTC)
  - Mensal: Dia 2, 08:00 (11:00 UTC)
- ✅ Integração com Discord para envio de análises

**Arquivos criados:**
- `backend/supabase/functions/agente-analise-diaria/index.ts`
- `backend/supabase/functions/agente-analise-semanal/index.ts`
- `backend/supabase/functions/agente-analise-mensal/index.ts`

---

### 2026-01-07 - Grande Limpeza e Consolidação

**O que foi feito:**
- ✅ Auditoria completa de Edge Functions
- ✅ Deletadas funções duplicadas/obsoletas:
  - `discord_notification` (duplicada de `discord-notification`)
  - `contahub_collector`, `contahub_processor`, `contahub_orchestrator`
  - `contahub-processor`
  - `nibo_collector`, `nibo_processor`, `nibo_orchestrator`
  - `unified-contahub-worker`
  - `analise-diaria-automatica`
  - `sync-eventos-automatico`
  - `inter-auth-test`, `getin-debug-test`, `discord-security-test`
  - `sync-recipes-insumos`, `contahub-prodporhora`
- ✅ Limpeza de tabelas com dados antigos:
  - `contahub_raw_data` - removidos dados processados
  - `security_events` - removidos logs antigos
- ✅ Integração de análise no `contahub-sync-automatico`
- ✅ Consolidação: análise agora é feita por `agente-ia-analyzer`

**Funções restantes (ATIVAS):**
- `contahub-sync-automatico` ✅
- `nibo-sync` ✅
- `discord-notification` ✅
- `agente-ia-analyzer` ✅
- `agente-analise-diaria` ✅
- `agente-analise-semanal` ✅
- `agente-analise-mensal` ✅
- `sympla-sync` ✅
- `yuzer-sync` 🔄
- `getin-sync` 🔄

---

## 2025-12

### Dezembro 2025 - Sistema Base Implementado

**Funcionalidades principais:**
- ✅ Sistema de sync ContaHub (faturamento, PAX, tickets)
- ✅ Sistema de sync Nibo (custos, pagamentos)
- ✅ Dashboards principais no frontend
- ✅ Sistema de configurações de checklists
- ✅ Sistema de metas por bar/período
- ✅ Integração Discord para notificações
- ✅ Sistema de autenticação
- ✅ Gerenciamento de usuários e permissões

---

## 2025-11

### Novembro 2025 - Estrutura Inicial

**O que foi feito:**
- ✅ Setup inicial do projeto Next.js 14
- ✅ Configuração Supabase
- ✅ Estrutura de pastas definida
- ✅ Componentes base (UI library)
- ✅ Sistema de temas (dark mode)
- ✅ Layout principal com sidebar

---

## 📝 COMO REGISTRAR

Após cada implementação significativa, adicione:

```markdown
### YYYY-MM-DD - Título Descritivo

**O que foi feito:**
- ✅ Item 1
- ✅ Item 2

**Arquivos criados/alterados:**
- `caminho/arquivo.ts`

**Problema resolvido:** (se aplicável)

**Commit:** `hash` (opcional)
```

---

## 📊 ESTATÍSTICAS

| Mês | Implementações | Destaques |
|-----|----------------|-----------|
| Jan/2026 | 8+ | Agentes IA, Limpeza, Contexto |
| Dez/2025 | ~15 | Sistema base completo |
| Nov/2025 | ~10 | Estrutura inicial |
