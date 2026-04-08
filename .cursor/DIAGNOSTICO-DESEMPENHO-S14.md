# Diagnóstico Completo — Desempenho S14 (30/03 - 05/04)

## Causa Raiz Principal

A tabela `desempenho_semanal` foi calculada pela última vez no dia **2 de abril às 14:23**.
Naquele momento, só existiam eventos de **Segunda, Terça e Quarta**.

Desde então, a edge function `recalcular-desempenho-v2` vem **falhando** porque a função `acquire_job_lock` não existia no banco (já corrigi isso).

**O código de cálculo em si está correto** — analisei os 6 calculadores e a lógica está sólida.
O problema é que rodou com dados parciais e nunca mais conseguiu atualizar.

---

## Análise Indicador por Indicador

### Faturamento = R$87.457 (deveria ser ~R$367K)
- Soma de Seg(13.496) + Ter(21.687) + Qua(52.407) = 87.590
- Faltam Qui(64.601) + Sex(82.524) + Sab(98.306) + Dom(34.956) = ~280K
- **Causa:** dados parciais (calculado dia 02/04)

### Reservas = 98 (deveria ser ~1.201)
- Seg(24) + Ter(74) = 98
- Faltam os outros dias que somam ~1.103 a mais
- **Causa:** dados parciais

### Qui+Sab+Dom = R$0 (deveria ser ~R$197K)
- Em 2 de abril às 14h, nenhum evento de Qui/Sab/Dom existia ainda
- **Causa:** dados parciais

### Fat até 19h = 6.37% (deveria ser ~71%)
- Só tinha dados de `faturamento_hora` para Seg-Qua
- **Causa:** dados parciais

### CMO% = -85.74 (deveria ser 0, é manual)
- O campo `cmo` **NÃO é calculado** pela edge function (não está no FIELD_MAPPING)
- O valor já estava no registro quando foi criado
- A edge function nunca toca nesse campo
- **Causa:** valor pré-existente no registro. Precisa zerar manualmente.

### Clientes Ativos = 32.809 (S13 era 5.260)
- A RPC `get_count_base_ativa` conta clientes com 2+ visitas em 90 dias na tabela `visitas`
- Rodei agora e retorna **32.960**
- A tabela `visitas` tem **233.250 registros** e **34.514 telefones únicos** nos últimos 90 dias (bar 3)
- Isso parece inflado — cada comanda do ContaHub gera uma "visita"
- O valor 5.260 da S13 provavelmente foi inserido **manualmente** ou por outro mecanismo
- **Causa:** RPC get_count_base_ativa conta comandas como visitas. Precisa investigar.

### Stockout Comidas = 34.68% e Stockout Bar = 56.41%
- Vem da tabela `contahub_stockout_filtrado` (dados reais do POS)
- Categoria "Bar" tem apenas **13 produtos** cadastrados e **7 ficam em stockout todo dia** (~54%)
- Pode ser problema de catálogo — produtos inativos ainda aparecendo
- **Causa:** dados reais, mas possível problema de catálogo de produtos

### Mix de Bebidas estranho
- Eventos 1005 (Sab) e 1006 (Dom) têm `percent_b/d/c = 0`
- O `contahub_analitico` TEM dados (1.578 e 664 itens respectivamente)
- Mas `calculate_evento_metrics` não populou o mix — provavelmente falha por causa do `nibo_agendamentos`
- **Causa:** calculate_evento_metrics falha antes de calcular mix

### Atrasinhos zerado
- Todos eventos mostram `atrasinho_bar = 0` e `atrasinho_cozinha = 0`
- Isso vem dos dados dos eventos, não do cálculo
- **Causa:** dados zerados na fonte (eventos_base)

---

## Correções Já Aplicadas (hoje)

1. ✅ `acquire_job_lock()` e `release_job_lock()` criadas no banco
2. ✅ ContaHub 05/04 sincronizado (ambos bares)
3. ✅ Evento 1005 (bar 3, Sab) — te_real/tb_real corrigidos
4. ✅ **Evento 1096 (bar 4, Sab)** — tinha faturamento_couvert = R$743K e faturamento_bar = R$7.1M. Corrigido para te_real=7.44, tb_real=71.68

---

## O Que Precisa Acontecer (em ordem)

### Passo 1 — Corrigir calculate_evento_metrics (CURSOR - PROMPT 1)
Remover referência a `nibo_agendamentos`. Sem isso, eventos 1005/1006/1097 ficam com mix = 0.

### Passo 2 — Recalcular eventos com mix zerado
Depois do passo 1, rodar:
```sql
UPDATE eventos_base SET precisa_recalculo = true WHERE id IN (1005, 1006, 1097);
SELECT * FROM auto_recalculo_eventos_pendentes('hotfix-mix');
```

### Passo 3 — Disparar recálculo do desempenho S14
Depois dos eventos corrigidos, disparar a edge function:
```sql
SELECT executar_recalculo_desempenho_v2();
```
Ou chamar diretamente via HTTP (se o ENABLE_V2_WRITE estiver true).

### Passo 4 — Zerar CMO manualmente
```sql
UPDATE desempenho_semanal SET cmo = 0 WHERE id = 671;
```

### Passo 5 — Investigar clientes_ativos
A RPC `get_count_base_ativa` retorna ~33K. Se o esperado é ~5K, a lógica da RPC ou a tabela `visitas` precisa de revisão (possivelmente contando comandas como visitas distintas).

### Passo 6 — Revisar catálogo stockout
Categoria "Bar" tem apenas 13 produtos com 7 em stockout permanente. Verificar se há produtos inativos ou categorias mal configuradas.

---

## Resumo

| Indicador | Valor Atual | Causa | Resolve com Recálculo? |
|-----------|-------------|-------|----------------------|
| Faturamento | R$87K | Dados parciais (02/04) | ✅ Sim |
| Reservas | 98 | Dados parciais | ✅ Sim |
| Qui+Sab+Dom | R$0 | Dados parciais | ✅ Sim |
| Fat até 19h | 6.37% | Dados parciais | ✅ Sim |
| CMO% | -85.74 | Valor pré-existente | ❌ Manual |
| Clientes Ativos | 32.809 | RPC inflada | ❌ Precisa corrigir RPC |
| Stockout | 34%/56% | Catálogo incompleto | ❌ Precisa revisar catálogo |
| Mix bebidas | Parcial | nibo_agendamentos | ⚠️ Após PROMPT 1 |
| Atrasinhos | 0 | Dados zerados na fonte | ❓ Verificar fonte |
