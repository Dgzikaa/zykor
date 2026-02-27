# 🤖 AGENTE DE EXPLORAÇÃO DIÁRIA - AUTOMAÇÃO
**Criado em:** 27/02/2026  
**Status:** Pronto para ativação

---

## 🎯 O QUE FAZ

O **Agente de Exploração Diária** executa automaticamente **todos os dias às 6h da manhã**:

1. ✅ **Auditoria de saúde dos dados** (score 0-100%)
2. ✅ **Análise do dia anterior** (faturamento, público, ticket médio)
3. ✅ **Detecção de anomalias** (CMV alto, faturamento baixo, etc)
4. ✅ **Geração de relatório** (salvo no banco)
5. ✅ **Envio de alertas** (Discord, email, push)

---

## 🔧 ARQUITETURA

### Componentes Criados:

```
📁 APIs:
├── /api/exploracao/agente-diario      → Agente principal
├── /api/auditoria/completa            → Auditoria de saúde
├── /api/exploracao/faturamento        → Análise de faturamento
├── /api/exploracao/produtos           → Análise de produtos
├── /api/exploracao/cmv                → Análise de CMV
└── /api/exploracao/equipe             → Análise de checklists

📁 Banco de Dados:
├── relatorios_diarios                 → Tabela de relatórios
└── cron.job                           → Jobs agendados

📁 Documentação:
├── setup-agente-diario.sql            → Script de instalação
└── README-AGENTE-DIARIO.md            → Este arquivo
```

---

## 🚀 COMO ATIVAR

### Passo 1: Executar SQL no Supabase

```sql
-- Copiar e colar no Supabase SQL Editor:
-- Arquivo: docs/automacao/setup-agente-diario.sql
```

### Passo 2: Configurar Variáveis de Ambiente

Adicionar no `.env.local`:

```bash
CRON_SECRET=seu-secret-super-seguro-aqui-123456
NEXT_PUBLIC_APP_URL=https://zykor.vercel.app
```

### Passo 3: Configurar no Supabase

```sql
ALTER DATABASE postgres SET app.cron_secret = 'mesmo-secret-do-env';
```

### Passo 4: Testar Manualmente

```sql
SELECT executar_agente_diario();
```

### Passo 5: Verificar Resultado

```sql
SELECT * FROM relatorios_diarios ORDER BY executado_em DESC LIMIT 1;
```

---

## ⏰ FREQUÊNCIA DE EXECUÇÃO

| Job | Frequência | Horário (BRT) | Descrição |
|-----|------------|---------------|-----------|
| **Agente Diário** | Todos os dias | 6h da manhã | Auditoria + métricas do dia anterior |
| **Relatório Semanal** | Toda segunda | 7h da manhã | Resumo da semana |
| **Exploração Mensal** | Todo dia 1 | 6h da manhã | Análise profunda mensal |

---

## 📊 O QUE É ANALISADO DIARIAMENTE

### 1. Saúde dos Dados (Score 0-100%)
- CMVs impossíveis (>100% ou <0%)
- Eventos sem público
- Estoque negativo
- Duplicações
- Gaps temporais

### 2. Métricas do Dia Anterior
- Faturamento
- Público
- Ticket médio
- Comparação com média dos últimos 30 dias

### 3. Detecção de Anomalias
- 🚨 Faturamento < 50% da média
- 🎉 Faturamento > 200% da média
- ⚠️ Público = 0 mas faturamento > 0
- 🚨 CMV > 50% (crítico)
- ⚠️ CMV > 40% (atenção)

---

## 🔔 ALERTAS AUTOMÁTICOS

### Quando são enviados:
- CMV crítico (>50%)
- Faturamento muito abaixo da média
- Público não registrado
- Score de saúde < 50%

### Canais de notificação:
- ✅ Discord (implementado)
- ⏳ Email (futuro)
- ⏳ Push notifications (futuro)
- ⏳ WhatsApp (futuro)

---

## 📈 RELATÓRIOS GERADOS

### Diário (todos os dias):
- Score de saúde
- Métricas do dia anterior
- Alertas e anomalias
- Comparação com média

### Semanal (toda segunda):
- Resumo da semana
- Top 5 insights
- Ações recomendadas
- Tendências

### Mensal (todo dia 1):
- Relatório executivo completo
- 50+ insights
- 20+ oportunidades
- ROI estimado

---

## 🔍 COMO MONITORAR

### Via API:
```bash
GET /api/monitoramento/cron-jobs
```

### Via SQL:
```sql
-- Ver últimas execuções
SELECT 
  j.jobname,
  jrd.status,
  jrd.start_time,
  jrd.end_time,
  jrd.return_message
FROM cron.job_run_details jrd
LEFT JOIN cron.job j ON jrd.jobid = j.jobid
WHERE j.jobname LIKE '%agente%'
ORDER BY jrd.start_time DESC
LIMIT 10;

-- Ver últimos relatórios gerados
SELECT 
  data_referencia,
  score_saude,
  faturamento,
  publico,
  alertas,
  executado_em
FROM relatorios_diarios
ORDER BY data_referencia DESC
LIMIT 10;
```

### Via Dashboard (futuro):
- Página: `/monitoramento/agente-diario`
- Gráficos de score de saúde ao longo do tempo
- Lista de alertas recentes
- Histórico de execuções

---

## 🛠️ MANUTENÇÃO

### Pausar o agente:
```sql
SELECT cron.unschedule('agente-exploracao-diario');
```

### Reativar o agente:
```sql
SELECT cron.schedule(
  'agente-exploracao-diario',
  '0 9 * * *',
  $$SELECT executar_agente_diario();$$
);
```

### Alterar horário:
```sql
-- Exemplo: mudar para 8h BRT (11h UTC)
SELECT cron.unschedule('agente-exploracao-diario');
SELECT cron.schedule(
  'agente-exploracao-diario',
  '0 11 * * *',
  $$SELECT executar_agente_diario();$$
);
```

### Ver logs de erro:
```sql
SELECT 
  jobname,
  status,
  return_message,
  start_time
FROM cron.job_run_details jrd
LEFT JOIN cron.job j ON jrd.jobid = j.jobid
WHERE status = 'failed'
ORDER BY start_time DESC
LIMIT 20;
```

---

## 💡 PRÓXIMAS MELHORIAS

### Curto Prazo (1 mês):
- [ ] Dashboard de monitoramento
- [ ] Notificações por email
- [ ] Relatórios em PDF

### Médio Prazo (3 meses):
- [ ] Insights gerados por IA (Gemini)
- [ ] Recomendações automáticas
- [ ] Predições de faturamento

### Longo Prazo (6 meses):
- [ ] Agente autônomo (toma ações sozinho)
- [ ] Otimização contínua de preços
- [ ] Sistema de alertas preditivos

---

## 📞 SUPORTE

**Documentação Completa:**
- [Relatório Final 30 Dias](../exploracao-diaria/RELATORIO-FINAL-30-DIAS.md)
- [Dashboard Executivo](../exploracao-diaria/DASHBOARD-EXECUTIVO.md)

**Arquivos Técnicos:**
- API: `frontend/src/app/api/exploracao/agente-diario/route.ts`
- SQL: `docs/automacao/setup-agente-diario.sql`

**Contato:**
- Via plataforma Zykor
- Via Discord (se configurado)

---

## ✅ CHECKLIST DE ATIVAÇÃO

- [ ] Executar `setup-agente-diario.sql` no Supabase
- [ ] Configurar `CRON_SECRET` no `.env.local`
- [ ] Configurar `app.cron_secret` no Supabase
- [ ] Testar manualmente: `SELECT executar_agente_diario();`
- [ ] Verificar relatório gerado: `SELECT * FROM relatorios_diarios;`
- [ ] Aguardar primeira execução automática (6h da manhã)
- [ ] Monitorar por 7 dias
- [ ] Ajustar alertas conforme necessário

---

**🎉 AGENTE PRONTO PARA ATIVAÇÃO!**

**Próximo Passo:** Executar o SQL e configurar as variáveis de ambiente.
