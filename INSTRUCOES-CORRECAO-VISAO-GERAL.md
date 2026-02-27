# CORREÇÃO COMPLETA: VISÃO GERAL ESTRATÉGICA

## 🎯 Problema Identificado

A página /estrategico/visao-geral estava mostrando dados incorretos:

- **Clientes Ativos**: 29.493 (❌ ERRADO - estava somando pessoas com duplicatas)
- **Deveria ser**: ~20.594 clientes únicos

## ✅ Solução Implementada

### 1. **View Materializada Corrigida**
- Agora conta **clientes únicos** por telefone (COUNT(DISTINCT cli_fone))
- Adiciona campo ase_ativa_90d para base ativa de 90 dias (2+ visitas)
- Separa corretamente:
  - clientes_totais: Total de clientes únicos do trimestre
  - ase_ativa_90d: Clientes com 2+ visitas nos últimos 90 dias

### 2. **Função RPC Atualizada**
- calcular_visao_geral_trimestral agora retorna ase_ativa_90d no campo clientes_ativos
- Calcula variações corretamente para ambas as métricas

### 3. **Atualização Automática (Cron Job)**
- Views são atualizadas **automaticamente** todos os dias às 3h da manhã
- Usa REFRESH MATERIALIZED VIEW CONCURRENTLY (não trava a tabela)

## 📋 Como Executar

### Passo 1: Abrir Supabase SQL Editor
1. Acesse: https://supabase.com/dashboard/project/uqtgsvujwcbymjmvkjhy
2. Faça login
3. Clique em "SQL Editor" no menu lateral

### Passo 2: Executar o Script
1. Abra o arquivo: CORRECAO-VISAO-GERAL-COMPLETA.sql
2. Copie TODO o conteúdo
3. Cole no SQL Editor do Supabase
4. Clique em "Run" (ou pressione Ctrl+Enter)

### Passo 3: Verificar Resultado
O próprio script já executa verificações no final:
- Lista os cron jobs criados
- Mostra os dados da view para bar_id=3, ano=2026
- Testa a função RPC

## 🔍 O que o Script Faz

### PASSO 1: Recriar View
`sql
DROP MATERIALIZED VIEW IF EXISTS public.view_visao_geral_trimestral CASCADE;
CREATE MATERIALIZED VIEW public.view_visao_geral_trimestral AS
...
`
- Remove a view antiga
- Cria nova view com campos corretos
- Adiciona ase_ativa_90d calculado corretamente

### PASSO 2: Atualizar Função RPC
`sql
CREATE OR REPLACE FUNCTION calcular_visao_geral_trimestral(...)
RETURNS TABLE (
  clientes_totais NUMERIC,
  clientes_ativos NUMERIC,  -- Agora usa base_ativa_90d
  ...
)
`
- Atualiza a função para usar o novo campo
- Calcula variações corretamente

### PASSO 3: Configurar Cron Jobs
`sql
SELECT cron.schedule(
  'refresh_view_visao_geral_trimestral',
  '0 3 * * *',  -- Todos os dias às 3h
  ...
);
`
- Remove jobs antigos (se existirem)
- Cria novos jobs para atualização automática
- Atualiza tanto a view trimestral quanto a anual

### PASSO 4: Verificações
- Lista os jobs criados
- Mostra dados da view
- Testa a função RPC

## 📊 Resultado Esperado

Após executar o script, a página /estrategico/visao-geral deve mostrar:

### Clientes Ativos (Base Ativa 90 dias)
- **Valor correto**: ~5.000-6.000 clientes (com 2+ visitas nos últimos 90 dias)
- **Meta**: 5.100 clientes
- **% Atingimento**: ~100%

### Clientes Totais (Trimestre)
- **Valor correto**: ~20.594 clientes únicos
- **Meta**: 30.000 clientes
- **% Atingimento**: ~69%

## 🔄 Manutenção Automática

### Cron Jobs Configurados

| Job | Frequência | Horário | Ação |
|-----|-----------|---------|------|
| efresh_view_visao_geral_trimestral | Diário | 3h | Atualiza view trimestral |
| efresh_view_visao_geral_anual | Diário | 3h | Atualiza view anual |

### Verificar Jobs
`sql
SELECT * FROM cron.job WHERE jobname LIKE 'refresh_view_visao_geral%';
`

### Atualizar Manualmente (se necessário)
`sql
REFRESH MATERIALIZED VIEW CONCURRENTLY public.view_visao_geral_trimestral;
REFRESH MATERIALIZED VIEW CONCURRENTLY public.view_visao_geral_anual;
`

## 🐛 Troubleshooting

### Problema: Dados ainda incorretos após executar
**Solução**: Aguarde até 3h da manhã ou force o refresh manual:
`sql
REFRESH MATERIALIZED VIEW CONCURRENTLY public.view_visao_geral_trimestral;
`

### Problema: Cron job não está rodando
**Solução**: Verifique se o pg_cron está habilitado:
`sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
`

### Problema: Erro ao criar view
**Solução**: Verifique se as tabelas base existem:
`sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('contahub_periodo', 'contahub_pagamentos', 'yuzer_pagamento', 'nibo_agendamentos', 'view_eventos');
`

## 📝 Arquivos Criados

- CORRECAO-VISAO-GERAL-COMPLETA.sql - Script SQL completo para executar
- INSTRUCOES-CORRECAO-VISAO-GERAL.md - Este arquivo com instruções

## ✅ Checklist de Execução

- [ ] Abrir Supabase SQL Editor
- [ ] Copiar conteúdo de CORRECAO-VISAO-GERAL-COMPLETA.sql
- [ ] Colar no SQL Editor
- [ ] Executar o script (Run)
- [ ] Verificar que não houve erros
- [ ] Conferir resultado das queries de verificação
- [ ] Recarregar página /estrategico/visao-geral
- [ ] Verificar que os números estão corretos

## 🎉 Conclusão

Após executar este script:
- ✅ Views materializadas corrigidas
- ✅ Função RPC atualizada
- ✅ Cron jobs configurados
- ✅ Atualização automática funcionando
- ✅ Dados corretos na página

**Tempo estimado de execução**: ~30 segundos
**Próxima atualização automática**: Amanhã às 3h
