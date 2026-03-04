# 📋 Situação do Planejamento Comercial - 01/03/2026 (Deboche Bar)

## ✅ Diagnóstico Realizado

**Data:** 03/03/2026 (segunda-feira)  
**Evento:** Domingo Regular - 01/03/2026  
**Evento ID:** 858  
**Bar ID:** 4 (Deboche)

## 🔍 Problema Identificado

O planejamento comercial está **ZERADO** para o dia 01/03/2026 porque:

1. ✅ O evento **JÁ ACONTECEU** (domingo, 01/03/2026)
2. ❌ **Não há dados de faturamento** no banco de dados
3. ⚠️  Os dados do **ContaHub não foram sincronizados**

## 🔧 Ações Executadas

1. ✅ Verificado status do evento no banco
2. ✅ Executado recálculo manual (`calculate_evento_metrics`)
3. ✅ Evento atualizado:
   - `precisa_recalculo`: `false`
   - `calculado_em`: `2026-03-02 22:56:41`
   - `real_r`: `R$ 0,00` (zerado porque não há dados)

## 🚀 Próximos Passos

### 1. Verificar se há dados no ContaHub

Acessar o ContaHub e verificar se há vendas registradas para 01/03/2026.

### 2. Sincronizar dados do ContaHub

Se houver vendas no ContaHub, executar a sincronização:

```bash
# Opção 1: Via API do Zykor (se disponível)
# POST /api/integracoes/contahub/sync
# Body: { "bar_id": 4, "data_inicio": "2026-03-01", "data_fim": "2026-03-01" }

# Opção 2: Via script manual (se disponível)
cd c:\Projects\zykor\scripts
node sync-contahub-deboche.js --data=2026-03-01
```

### 3. Verificar ingressos Sympla

Se houve venda de ingressos via Sympla, vincular o evento Sympla ao evento base:

```sql
-- Verificar eventos Sympla para 01/03/2026
SELECT id, nome_evento, data_inicio, total_liquido, total_checkins
FROM sympla_eventos
WHERE data_inicio::date = '2026-03-01';

-- Vincular ao evento base (se necessário)
UPDATE sympla_pedidos
SET evento_id = 858
WHERE evento_sympla_id = 'ID_DO_EVENTO_SYMPLA';
```

### 4. Recalcular evento novamente

Após sincronizar os dados:

```bash
cd c:\Projects\zykor\scripts
node verificar-e-calcular-ontem.js
```

## 📊 Scripts Disponíveis

- `verificar-e-calcular-ontem.js` - Verifica e calcula evento de 01/03/2026
- `verificar-dados-ontem-v2.js` - Verifica dados disponíveis
- `diagnostico-e-calculo-ontem.js` - Diagnóstico completo
- `resumo-situacao.js` - Resumo da situação atual

## 🔄 Sincronização Automática

### Por que não rodou automaticamente?

O sistema tem sincronização automática via `pg_cron`, mas pode não ter rodado por:

1. **Cron não configurado** para esse tipo de sincronização
2. **Cron rodou mas não havia dados** no ContaHub ainda
3. **Erro na execução** do cron (verificar logs)

### Verificar status do cron

```sql
-- Ver jobs do cron
SELECT jobid, schedule, active, command
FROM cron.job
WHERE command LIKE '%deboche%' OR command LIKE '%bar_id=4%';

-- Ver últimas execuções
SELECT *
FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE command LIKE '%deboche%')
ORDER BY start_time DESC
LIMIT 10;
```

## ⚠️ Observações Importantes

1. **Data correta:** 01/03/2026 é **DOMINGO** (não sábado)
2. **M-1 disponível:** R$ 5.408,65 (referência do mês anterior)
3. **Evento ativo:** Sim, está ativo no banco
4. **Cálculo funcionando:** A função `calculate_evento_metrics` está OK

## 💡 Conclusão

O sistema de cálculo está **funcionando corretamente**. O problema é a **falta de dados de origem** (ContaHub, Sympla, Yuzer).

**Ação imediata:** Sincronizar dados do ContaHub para 01/03/2026.
