# 🔄 ContaHub Re-Sync Semanal - Documentação Completa

## 📋 Resumo Executivo

Sistema de re-sincronização semanal automática dos dados do ContaHub para capturar lançamentos tardios (cancelamentos, estornos, ajustes) que não foram capturados pela sincronização diária.

---

## 🎯 Problema Identificado

### Situação Atual
- Sincronização diária roda sempre **D+1** (1 dia depois da operação)
- Exemplo: Dados do dia 28/03 são sincronizados no dia 29/03

### O Problema
- **Cancelamentos e estornos podem ser lançados dias depois**
- Exemplo: Um cancelamento do dia 28/03 pode ser registrado no sistema apenas no dia 30/03
- Quando rodamos a sincronização no dia 29/03, esse lançamento ainda não existia
- **Resultado**: Dados ficam desatualizados permanentemente

### Impacto
- Faturamento incorreto
- CMV desatualizado
- Análises gerenciais imprecisas
- Decisões baseadas em dados incompletos

---

## ✅ Solução Implementada

### Estratégia
**Cronjob semanal** que re-sincroniza os últimos 7 dias toda segunda-feira às 06:00 BRT

### Por que Segunda-feira 06:00?
1. Captura lançamentos tardios da sexta, sábado e domingo
2. Não interfere com sync diário (07:00 BRT)
3. Dados atualizados para reunião semanal de gestão
4. Horário de baixo tráfego no sistema

### Por que 7 dias?
1. Lançamentos tardios geralmente ocorrem em 2-3 dias
2. 7 dias garante cobertura completa da semana operacional
3. Não sobrecarrega o sistema
4. Permite correção de dados até 1 semana atrás

---

## 🏗️ Arquitetura

### Componentes Criados

#### 1. Edge Function: `contahub-resync-semanal`
**Localização**: `backend/supabase/functions/contahub-resync-semanal/index.ts`

**Responsabilidades**:
- Calcular range de datas (últimos N dias)
- Chamar `contahub-sync-automatico` para cada data
- Enviar notificações Discord (início e fim)
- Registrar heartbeat para monitoramento
- Aguardar processamento automático via pg_cron

**Parâmetros**:
```typescript
{
  bar_id: number,           // ID do bar (3=Ordinário, 4=Deboche)
  dias_anteriores?: number, // Quantos dias re-sincronizar (padrão: 7)
  data_referencia?: string  // Data de referência (padrão: hoje)
}
```

**Exemplo de Resposta**:
```json
{
  "success": true,
  "summary": {
    "bar_id": 3,
    "periodo": "2026-03-23 a 2026-03-29",
    "total_dias": 7,
    "dias_sucesso": 7,
    "dias_erro": 0,
    "total_registros_coletados": 15847,
    "processamento": {
      "processados": 49,
      "pendentes": 0,
      "total": 49
    }
  }
}
```

#### 2. Cronjobs pg_cron
**Localização**: Migration SQL `20260402_contahub_resync_semanal_cron.sql`

**Jobs Criados**:

| Job Name | Schedule | Horário BRT | Bar | Descrição |
|----------|----------|-------------|-----|-----------|
| `contahub-resync-semanal-ordinario` | `0 9 * * 1` | Segunda 06:00 | 3 | Ordinário Bar |
| `contahub-resync-semanal-deboche` | `15 9 * * 1` | Segunda 06:15 | 4 | Deboche Bar |

**Por que 15 minutos de diferença?**
- Evita sobrecarga no ContaHub
- Permite processamento sequencial
- Reduz chance de timeout

#### 3. API Route: `/api/contahub/resync-semanal-manual`
**Localização**: `frontend/src/app/api/contahub/resync-semanal-manual/route.ts`

**Uso**: Permite executar re-sync manual para testes ou correções pontuais

**Exemplo**:
```bash
POST /api/contahub/resync-semanal-manual
{
  "bar_id": 3,
  "dias_anteriores": 7
}
```

#### 4. API Route: `/api/configuracoes/contahub/setup-resync-semanal`
**Localização**: `frontend/src/app/api/configuracoes/contahub/setup-resync-semanal/route.ts`

**Uso**: Gera SQL para configuração do cronjob no Supabase

#### 5. Componente UI: `ContaHubResyncSemanalCard`
**Localização**: `frontend/src/components/configuracoes/ContaHubResyncSemanalCard.tsx`

**Funcionalidades**:
- Explicação visual do problema e solução
- Botão para gerar SQL de configuração
- Botão para testar manualmente
- Copiar SQL para clipboard
- Instruções passo a passo

---

## 🚀 Como Configurar (Primeira Vez)

### Passo 1: Deploy da Edge Function
```bash
cd backend/supabase
supabase functions deploy contahub-resync-semanal
```

### Passo 2: Configurar Cronjob no Supabase

**Opção A - Via Interface Web** (Recomendado):
1. Acesse `http://localhost:3001/configuracoes/integracoes`
2. Localize o card "Re-Sync Semanal ContaHub"
3. Clique em "Gerar SQL de Configuração"
4. Clique em "Copiar SQL"
5. Acesse Supabase Dashboard → SQL Editor
6. Cole e execute o SQL
7. Verifique se os jobs foram criados na última query

**Opção B - Manual**:
1. Copie o conteúdo do arquivo `20260402_contahub_resync_semanal_cron.sql`
2. Acesse Supabase Dashboard → SQL Editor
3. Cole e execute o SQL

### Passo 3: Verificar Configuração
```sql
-- Verificar se os jobs foram criados
SELECT 
  jobname,
  schedule,
  active,
  last_run,
  next_run
FROM cron.job 
WHERE jobname LIKE 'contahub-resync-semanal%'
ORDER BY jobname;
```

**Resultado Esperado**:
```
jobname                              | schedule    | active | next_run
-------------------------------------|-------------|--------|------------------
contahub-resync-semanal-ordinario    | 0 9 * * 1   | true   | 2026-04-07 09:00
contahub-resync-semanal-deboche      | 15 9 * * 1  | true   | 2026-04-07 09:15
```

---

## 🧪 Como Testar

### Teste Manual via Interface Web
1. Acesse `http://localhost:3001/configuracoes/integracoes`
2. Localize o card "Re-Sync Semanal ContaHub"
3. Clique em "Testar Manualmente"
4. Aguarde a execução (pode levar 5-10 minutos)
5. Verifique os logs no console

### Teste Manual via API
```bash
# PowerShell
Invoke-WebRequest -Method POST -Uri "http://localhost:3001/api/contahub/resync-semanal-manual" -ContentType "application/json" -Body '{"bar_id": 3, "dias_anteriores": 7}'

# cURL
curl -X POST http://localhost:3001/api/contahub/resync-semanal-manual \
  -H "Content-Type: application/json" \
  -d '{"bar_id": 3, "dias_anteriores": 7}'
```

### Teste Manual via Edge Function Direta
```sql
-- Execute no Supabase SQL Editor
SELECT net.http_post(
  url := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-resync-semanal',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer SEU_SERVICE_ROLE_KEY"}'::jsonb,
  body := '{"bar_id": 3, "dias_anteriores": 7}'::jsonb
);
```

---

## 📊 Monitoramento

### Verificar Última Execução
```sql
SELECT 
  runid,
  jobname,
  status,
  return_message,
  start_time,
  end_time,
  EXTRACT(EPOCH FROM (end_time - start_time)) as duration_seconds
FROM cron.job_run_details 
WHERE jobname LIKE 'contahub-resync-semanal%'
ORDER BY start_time DESC 
LIMIT 5;
```

### Verificar Dados Re-Sincronizados
```sql
-- Ver registros que foram atualizados (não apenas criados)
SELECT 
  data_date,
  data_type,
  processed,
  record_count,
  created_at,
  updated_at,
  EXTRACT(EPOCH FROM (updated_at - created_at)) as seconds_between_create_update
FROM contahub_raw_data
WHERE bar_id = 3
  AND updated_at > NOW() - INTERVAL '7 days'
  AND updated_at != created_at -- Apenas registros que foram atualizados
ORDER BY data_date DESC, data_type;
```

### Verificar Heartbeats
```sql
SELECT 
  function_name,
  bar_id,
  execution_type,
  status,
  started_at,
  ended_at,
  records_processed,
  metadata
FROM function_heartbeats
WHERE function_name = 'contahub-resync-semanal'
ORDER BY started_at DESC
LIMIT 10;
```

---

## 🔧 Manutenção

### Alterar Horário de Execução
```sql
-- Alterar para terça-feira 08:00 BRT (11:00 UTC)
SELECT cron.schedule(
  'contahub-resync-semanal-ordinario',
  '0 11 * * 2', -- Terça-feira às 11:00 UTC
  $$ ... $$
);
```

### Alterar Quantidade de Dias
```sql
-- Re-sincronizar últimos 14 dias
SELECT cron.schedule(
  'contahub-resync-semanal-ordinario',
  '0 9 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-resync-semanal',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object(
      'bar_id', 3,
      'dias_anteriores', 14  -- ← Alterado de 7 para 14
    )
  ) as request_id;
  $$
);
```

### Desabilitar Temporariamente
```sql
-- Desabilitar job
SELECT cron.unschedule('contahub-resync-semanal-ordinario');

-- Reabilitar depois
-- Execute novamente o SQL de criação
```

---

## 📈 Exemplo Prático de Uso

### Cenário Real

**Data**: Segunda-feira, 30/03/2026, 06:00 BRT

**O que acontece**:

1. **06:00** - Cronjob `contahub-resync-semanal-ordinario` dispara
2. **Edge Function** calcula: últimos 7 dias = 23/03 a 29/03
3. **Para cada dia** (23, 24, 25, 26, 27, 28, 29):
   - Chama `contahub-sync-automatico` com `data_date`
   - Coleta dados atualizados do ContaHub (analitico, pagamentos, cancelamentos, etc.)
   - Salva em `contahub_raw_data` com **UPSERT** (atualiza se já existe)
   - Marca `processed=false` para reprocessamento
4. **pg_cron automático** processa os dados (job separado, roda a cada 30min)
5. **Notificação Discord** enviada com resumo

**Resultado**:
- Cancelamento do dia 28/03 lançado tardiamente no dia 30/03 **é capturado**
- Dados de faturamento, CMV e análises ficam **atualizados**
- Relatórios gerenciais refletem a **realidade operacional**

---

## 🔍 Diferença: Sync Diário vs Re-Sync Semanal

| Aspecto | Sync Diário | Re-Sync Semanal |
|---------|-------------|-----------------|
| **Frequência** | Todo dia 07:00 BRT | Segunda 06:00 BRT |
| **Objetivo** | Coletar dados do dia anterior | Atualizar dados da semana anterior |
| **Dados** | D-1 (ontem) | D-7 a D-1 (última semana) |
| **Método** | INSERT (novos registros) | UPSERT (atualiza existentes) |
| **Captura** | Lançamentos do dia | Lançamentos tardios |
| **Edge Function** | `contahub-sync-automatico` | `contahub-resync-semanal` |

---

## 📁 Arquivos Criados/Modificados

```
backend/supabase/functions/
└── contahub-resync-semanal/
    └── index.ts                                    ← Nova Edge Function

database/migrations/
└── 20260402_contahub_resync_semanal_cron.sql      ← Migration SQL

frontend/src/app/api/
├── contahub/resync-semanal-manual/route.ts        ← API para teste manual
└── configuracoes/contahub/setup-resync-semanal/route.ts  ← API para gerar SQL

frontend/src/components/configuracoes/
└── ContaHubResyncSemanalCard.tsx                  ← Componente UI

frontend/src/app/configuracoes/integracoes/page.tsx ← Página atualizada
```

---

## 🎬 Fluxo Completo

```
┌─────────────────────────────────────────────────────────────────┐
│ SEGUNDA-FEIRA 06:00 BRT (09:00 UTC)                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ pg_cron dispara: contahub-resync-semanal-ordinario              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Edge Function: contahub-resync-semanal                          │
│ - Calcula datas: D-7 a D-1                                      │
│ - Envia notificação Discord (início)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ LOOP: Para cada data (23/03, 24/03, ..., 29/03)                │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │ Chama: contahub-sync-automatico                         │  │
│   │ - Faz login no ContaHub                                 │  │
│   │ - Busca dados atualizados (analitico, pagamentos, etc.) │  │
│   │ - UPSERT em contahub_raw_data (atualiza se existe)     │  │
│   │ - Marca processed=false                                 │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│   Delay 2 segundos entre datas                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Aguarda 30 segundos                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ pg_cron automático processa dados (job separado, a cada 30min)  │
│ - Lê contahub_raw_data onde processed=false                     │
│ - Processa e insere em tabelas finais                           │
│ - Marca processed=true                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Envia notificação Discord (resumo final)                        │
│ - Período re-sincronizado                                       │
│ - Total de registros                                            │
│ - Status de processamento                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ Segurança e Performance

### UPSERT Strategy
- Usa `onConflict: 'bar_id,data_type,data_date'`
- Atualiza registros existentes em vez de duplicar
- Mantém histórico de `created_at` e `updated_at`

### Rate Limiting
- 2 segundos de delay entre datas
- 15 minutos de diferença entre bares
- Evita sobrecarga no ContaHub

### Error Handling
- Continua mesmo se uma data falhar
- Registra erros individuais
- Envia notificação com resumo de erros
- Heartbeat para monitoramento

---

## 📞 Notificações Discord

### Notificação de Início
```
🔄 ContaHub Re-Sync Semanal Iniciado

📅 Período: 2026-03-23 a 2026-03-29
🍺 Bar ID: 3
⏰ Início: 30/03/2026 06:00:15
```

### Notificação de Sucesso
```
✅ ContaHub Re-Sync Semanal Concluído

📅 Período: 2026-03-23 a 2026-03-29
📊 Dias: 7/7 re-sincronizados
📈 Registros: 15,847 coletados
⚙️ Processamento: 49/49 processados
⏰ Fim: 30/03/2026 06:08:42
```

### Notificação de Erro Parcial
```
⚠️ ContaHub Re-Sync Semanal Concluído com Erros

📅 Período: 2026-03-23 a 2026-03-29
📊 Dias: 6/7 re-sincronizados
📈 Registros: 13,245 coletados
⚙️ Processamento: 42/49 processados
⚠️ Erros: 1 dia falhou
⏰ Fim: 30/03/2026 06:09:15
```

---

## 🐛 Troubleshooting

### Problema: Cronjob não executa
**Verificar**:
```sql
SELECT * FROM cron.job WHERE jobname LIKE 'contahub-resync-semanal%';
```
**Solução**: Se `active=false`, recriar o job executando o SQL novamente

### Problema: Edge Function retorna erro
**Verificar logs**:
```sql
SELECT * FROM function_heartbeats 
WHERE function_name = 'contahub-resync-semanal' 
ORDER BY started_at DESC LIMIT 5;
```
**Solução**: Verificar credenciais do ContaHub em `api_credentials`

### Problema: Dados não são processados
**Verificar**:
```sql
SELECT * FROM contahub_raw_data 
WHERE processed = false 
  AND created_at < NOW() - INTERVAL '1 hour';
```
**Solução**: Verificar se o cronjob de processamento automático está ativo

### Problema: Timeout na Edge Function
**Causa**: Muitos dias para re-sincronizar
**Solução**: Reduzir `dias_anteriores` de 7 para 5 ou 3

---

## 📅 Cronograma de Execução

### Próximas Execuções (Exemplo)
- **07/04/2026 (Segunda)** 06:00 BRT → Re-sync 31/03 a 06/04
- **14/04/2026 (Segunda)** 06:00 BRT → Re-sync 07/04 a 13/04
- **21/04/2026 (Segunda)** 06:00 BRT → Re-sync 14/04 a 20/04
- **28/04/2026 (Segunda)** 06:00 BRT → Re-sync 21/04 a 27/04

---

## 💡 Melhorias Futuras (Opcional)

1. **Re-sync Inteligente**: Apenas re-sincronizar dias com discrepâncias detectadas
2. **Alertas Proativos**: Notificar quando cancelamentos tardios forem detectados
3. **Dashboard de Auditoria**: Visualizar diferenças entre sync original e re-sync
4. **Re-sync Sob Demanda**: Permitir re-sincronizar períodos específicos via UI

---

## ✅ Checklist de Implementação

- [x] Edge Function `contahub-resync-semanal` criada
- [x] Migration SQL para pg_cron criada
- [x] API route para teste manual criada
- [x] API route para gerar SQL criada
- [x] Componente UI criado
- [x] Página de integrações atualizada
- [x] Documentação completa criada
- [ ] Deploy da Edge Function no Supabase
- [ ] Executar migration SQL no Supabase
- [ ] Testar execução manual
- [ ] Aguardar primeira execução automática (próxima segunda-feira)
- [ ] Validar dados re-sincronizados

---

## 📞 Suporte

Em caso de dúvidas ou problemas:
1. Verificar logs no Supabase Dashboard
2. Verificar heartbeats na tabela `function_heartbeats`
3. Verificar notificações no Discord
4. Consultar esta documentação

---

**Criado em**: 02/04/2026  
**Versão**: 1.0  
**Autor**: Sistema Zykor
