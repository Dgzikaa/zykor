# Sincronização NIBO - Deboche Bar

## 🎯 Objetivo

Sincronizar agendamentos (contas a pagar/receber) do NIBO para o banco de dados do Zykor.

## 📋 Pré-requisitos

1. Token da API do Nibo configurado no banco (✅ já está configurado)
2. Node.js instalado
3. Dependências instaladas: `npm install` na pasta `scripts/`

## 🚀 Como Usar

### 1. Sincronização Retroativa (Manual)

Para buscar TODOS os dados desde 02/05/2023 até hoje:

```bash
cd c:\Projects\zykor\scripts
node sync-nibo-deboche-retroativo.js
```

**O que o script faz:**
- Busca TODOS os agendamentos (pagos e pendentes) com `dueDate` no período
- Período: 02/05/2023 até hoje (2026-03-02)
- Tipos: Despesas (schedules/debit) + Receitas (schedules/credit)
- Insere/atualiza na tabela `nibo_agendamentos`
- Usa `upsert` com `nibo_id` para evitar duplicatas
- Processa em lotes de 100 registros

**Tempo estimado:** 
- ~10-20 minutos (Deboche tem MUITOS dados - esperado 15.000+ registros)
- O script mostra progresso em tempo real

**⚠️ IMPORTANTE:**
- Deixe o script rodar até o final (não interrompa!)
- Ele vai buscar página por página (500 registros por vez)
- Aguarda 500ms entre requisições para não sobrecarregar a API do Nibo

### 2. Sincronização Automática (Cron)

**Já está configurado!** ✅

O `pg_cron` roda automaticamente todos os dias:

- **Job ID 246** (Ordinário Bar): 13:00 UTC (10:00 BRT)
- **Job ID 247** (Deboche Bar): 13:15 UTC (10:15 BRT)

**O que o cron faz:**
- Chama a Edge Function `integracao-dispatcher` com `action: 'nibo'`
- Redireciona para `nibo-sync` Edge Function
- Sincroniza últimos 30 dias + próximos 90 dias (modo `daily_complete`)

### 3. Verificar Status do Cron

```sql
SELECT 
  jobid, 
  schedule, 
  active,
  SUBSTRING(command, 1, 100) as comando_resumo
FROM cron.job 
WHERE command LIKE '%nibo%'
ORDER BY jobid;
```

## 📊 Categorias Importantes

Para o **Deboche Bar**:

- **Custo Artístico** = Categoria "Atrações Programação" (ou similar com "Atração")
- **Custo de Produção** = Sempre zerado (não possui no Deboche)

## 🔧 Troubleshooting

### Erro: "Credenciais não encontradas"

Verificar se o token está configurado:

```sql
SELECT id, bar_id, sistema, ativo, api_token 
FROM api_credentials 
WHERE bar_id = 4 AND sistema = 'nibo';
```

### Erro: "NIBO API 401/403"

Token inválido ou expirado. Atualizar na tabela `api_credentials`.

### Nenhum registro encontrado

- Verificar se há agendamentos PAGOS no período
- Tentar ampliar o período de busca
- Verificar filtros na API do Nibo

## 📝 Logs

O script mostra:
- ✅ Total de registros buscados
- ✅ Total inserido no banco
- ✅ Categorias encontradas em Fev/2025
- ✅ Atrações/Eventos em Fev/2025

## 🔗 Edge Function

A Edge Function `nibo-sync` foi criada em:
- `backend/supabase/functions/nibo-sync/index.ts`

**Deploy:**
```bash
cd backend
supabase functions deploy nibo-sync
```

## ⚠️ Importante

- O script busca apenas agendamentos com `paymentDate` (já pagos)
- Usa `upsert` para evitar duplicatas (chave: `nibo_id`)
- Limite de 500 registros por página (limite da API do Nibo)
- Aguarda 300-500ms entre requisições para não sobrecarregar a API
