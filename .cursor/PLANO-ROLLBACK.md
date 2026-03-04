# 🔄 PLANO DE ROLLBACK - Refatoração Zykor

**Data de criação**: 03/03/2026  
**Versão**: 1.0

> **IMPORTANTE**: Este documento deve ser atualizado após cada fase concluída com os comandos exatos de rollback.

---

## 🎯 Estratégia Geral de Rollback

1. **Database Functions**: Manter `_v2` em paralelo até validação completa
2. **Edge Functions**: Nunca deletar, apenas marcar como deprecated
3. **Cron Jobs**: Desativar, não deletar (podem ser reativados)
4. **Tabelas**: Nunca deletar, apenas adicionar colunas
5. **Backup completo**: Restaurável em < 30 minutos

---

## FASE 0: Backup e Preparação

### Status
- [ ] Executada
- [ ] Validada
- [ ] Rollback testado

### Alterações Realizadas
- Criado: `.cursor/PLANO-ROLLBACK.md`
- Criado: `scripts/test-arquitetura-nova.js`
- Criado: `backups/pre-refatoracao-{timestamp}.sql`

### Rollback
**Não necessário** - Apenas criação de arquivos documentais e scripts.

---

## FASE 1: Estrutura do Banco

### Status
- [ ] Executada
- [ ] Validada
- [ ] Rollback testado

### Alterações Realizadas
```sql
-- Script 1: Adicionar campos em eventos_base
ALTER TABLE eventos_base ADD COLUMN cancelamentos NUMERIC DEFAULT 0;
ALTER TABLE eventos_base ADD COLUMN descontos NUMERIC DEFAULT 0;
ALTER TABLE eventos_base ADD COLUMN conta_assinada NUMERIC DEFAULT 0;

-- Script 2: Adicionar campos em desempenho_semanal
ALTER TABLE desempenho_semanal ADD COLUMN ter_qua_qui NUMERIC;
ALTER TABLE desempenho_semanal ADD COLUMN sex_sab NUMERIC;

-- Script 3: Criar tabela bares_config
CREATE TABLE bares_config (...);
INSERT INTO bares_config (bar_id = 3) VALUES (...); -- Ordinário
INSERT INTO bares_config (bar_id = 4) VALUES (...); -- Deboche

-- Script 4: Criar índices
CREATE INDEX idx_eventos_base_cancelamentos ON eventos_base(cancelamentos);
CREATE INDEX idx_eventos_base_conta_assinada ON eventos_base(conta_assinada);
CREATE INDEX idx_bares_config_bar_id ON bares_config(bar_id);
```

### Rollback

```sql
-- Remover índices
DROP INDEX IF EXISTS idx_eventos_base_cancelamentos;
DROP INDEX IF EXISTS idx_eventos_base_conta_assinada;
DROP INDEX IF EXISTS idx_bares_config_bar_id;

-- Remover tabela bares_config
DROP TABLE IF EXISTS bares_config CASCADE;

-- Remover campos de desempenho_semanal
ALTER TABLE desempenho_semanal DROP COLUMN IF EXISTS ter_qua_qui;
ALTER TABLE desempenho_semanal DROP COLUMN IF EXISTS sex_sab;

-- Remover campos de eventos_base
ALTER TABLE eventos_base DROP COLUMN IF EXISTS conta_assinada;
ALTER TABLE eventos_base DROP COLUMN IF EXISTS descontos;
ALTER TABLE eventos_base DROP COLUMN IF EXISTS cancelamentos;
```

**⚠️ ATENÇÃO**: Se já houver dados nas colunas, fazer backup antes:
```sql
-- Backup antes de dropar
SELECT bar_id, data_evento, cancelamentos, descontos, conta_assinada 
INTO TEMP TABLE backup_eventos_base_fase1
FROM eventos_base 
WHERE cancelamentos > 0 OR descontos > 0 OR conta_assinada > 0;
```

---

## FASE 2: Database Function Principal

### Status
- [ ] Executada
- [ ] Validada
- [ ] Rollback testado

### Alterações Realizadas
```sql
-- Criada função: calculate_daily_metrics_v2()
CREATE OR REPLACE FUNCTION calculate_daily_metrics_v2(...) ...

-- Criada Edge Function: processamento-dados-v2
-- Criado Cron Job: test-processamento-v2-ordinario (23h)
SELECT cron.schedule('test-processamento-v2-ordinario', '0 23 * * *', ...);
```

### Rollback

```sql
-- Desativar cron job de teste
SELECT cron.unschedule('test-processamento-v2-ordinario');
SELECT cron.unschedule('test-processamento-v2-deboche');

-- Remover database function
DROP FUNCTION IF EXISTS calculate_daily_metrics_v2(INTEGER, DATE) CASCADE;
```

**Edge Function**: Deletar via Supabase CLI
```bash
supabase functions delete processamento-dados-v2
```

---

## FASE 3: Database Function de Agregação Semanal

### Status
- [ ] Executada
- [ ] Validada
- [ ] Rollback testado

### Alterações Realizadas
```sql
-- Criada função: aggregate_weekly_metrics_v2()
CREATE OR REPLACE FUNCTION aggregate_weekly_metrics_v2(...) ...

-- Criada Edge Function: agregacao-semanal-v2
-- Criado Cron Job: test-agregacao-v2 (23h30)
SELECT cron.schedule('test-agregacao-v2', '30 23 * * *', ...);
```

### Rollback

```sql
-- Desativar cron job de teste
SELECT cron.unschedule('test-agregacao-v2');

-- Remover database function
DROP FUNCTION IF EXISTS aggregate_weekly_metrics_v2(INTEGER, INTEGER, INTEGER) CASCADE;
```

**Edge Function**: Deletar via Supabase CLI
```bash
supabase functions delete agregacao-semanal-v2
```

---

## FASE 4: Consolidar Edge Functions de Sync

### Status
- [ ] Executada
- [ ] Validada
- [ ] Rollback testado

### Alterações Realizadas
```sql
-- Desativados cron jobs antigos (10h)
SELECT cron.unschedule('contahub-sync-7h-ambos');

-- Criados novos cron jobs (06h30)
SELECT cron.schedule('contahub-sync-630-ambos', '30 6 * * *', ...);
```

**Edge Function**: `contahub-dispatcher-v2` criada

### Rollback

```sql
-- Desativar novos cron jobs
SELECT cron.unschedule('contahub-sync-630-ambos');

-- Reativar cron jobs antigos
SELECT cron.schedule('contahub-sync-7h-ambos', '0 10 * * *', ...);
```

**Edge Function**: Manter ambas (antiga e nova) até validação completa.

---

## FASE 5: Consolidar Edge Functions de Integração

### Status
- [ ] Executada
- [ ] Validada
- [ ] Rollback testado

### Alterações Realizadas
```sql
-- Ajustados horários de integrações
SELECT cron.unschedule('yuzer-sync-semanal'); -- Antigo 8h 2ª
SELECT cron.schedule('yuzer-sync-diario-novo', '0 7 * * *', ...); -- Novo 7h diário
```

**Edge Function**: `integracao-dispatcher-v2` criada

### Rollback

```sql
-- Restaurar horários antigos
SELECT cron.unschedule('yuzer-sync-diario-novo');
SELECT cron.schedule('yuzer-sync-semanal', '0 8 * * 1', ...);
-- ... restaurar todos os cron jobs originais
```

---

## FASE 6: Limpeza e Deleção

### Status
- [ ] Executada
- [ ] Validada
- [ ] Rollback testado

### ⚠️ CRÍTICO: SÓ EXECUTAR APÓS 2 SEMANAS DE VALIDAÇÃO

### Alterações Realizadas
**Cron Jobs Desativados**:
- Lista completa de jobs desativados (será preenchida durante execução)

**Database Functions Deletadas**:
- Lista completa de functions deletadas (será preenchida durante execução)

**Edge Functions Deletadas**:
- Lista completa de edge functions deletadas (será preenchida durante execução)

### Rollback

**⚠️ IMPOSSÍVEL após deletar!**

Por isso:
1. Fazer backup completo antes desta fase
2. Exportar código de todas as functions antes de deletar
3. Manter backup por pelo menos 6 meses
4. Documentar tudo que foi deletado

**Backup pré-limpeza**:
```bash
# Exportar todas as database functions
pg_dump --schema-only --format=plain -f backups/functions-backup-pre-limpeza.sql

# Backup completo
supabase db dump -f backups/full-backup-pre-limpeza-$(date +%Y%m%d).sql
```

---

## FASE 7: Monitoramento e Documentação

### Status
- [ ] Executada
- [ ] Validada

### Alterações Realizadas
- Criado: `frontend/src/app/admin/monitoramento/page.tsx`
- Atualizado: `.cursor/zykor-context.md`
- Criado: `.cursor/ARQUITETURA-ATUAL.md`
- Criado: `.cursor/GUIA-MANUTENCAO.md`

### Rollback
**Não necessário** - Apenas documentação e features novas.

---

## 🚨 Comandos de Emergência

### Restaurar Backup Completo

```bash
# Via Supabase CLI
supabase db reset --db-url "postgresql://..."

# Via psql
psql -U postgres -d zykor < backups/pre-refatoracao-{timestamp}.sql
```

### Desativar TODOS os Novos Cron Jobs

```sql
-- Listar todos os jobs ativos
SELECT jobid, jobname, schedule FROM cron.job WHERE active = true;

-- Desativar jobs com "_v2" ou "novo" no nome
SELECT cron.unschedule(jobname) 
FROM cron.job 
WHERE jobname LIKE '%_v2%' OR jobname LIKE '%novo%';
```

### Verificar Estado Atual

```sql
-- Database functions v2
SELECT proname FROM pg_proc 
WHERE proname LIKE '%_v2%' 
ORDER BY proname;

-- Cron jobs ativos
SELECT jobname, schedule, active FROM cron.job 
WHERE active = true 
ORDER BY schedule;

-- Colunas adicionadas
SELECT column_name FROM information_schema.columns 
WHERE table_name IN ('eventos_base', 'desempenho_semanal', 'bares_config');
```

---

## 📞 Contatos de Emergência

- **Supabase Support**: support@supabase.io
- **Backup em**: `c:\Projects\zykor\backups\`
- **Documentação**: `.cursor/REGRAS-DE-NEGOCIO-COMPLETAS.md`

---

## 📊 Log de Alterações

| Data | Fase | Ação | Status | Rollback Testado |
|------|------|------|--------|------------------|
| 03/03/2026 | 0 | Criação do plano | ✅ | N/A |
| | | | | |
| | | | | |

---

**Última atualização**: 03/03/2026 21:30  
**Próxima revisão**: Após cada fase concluída
