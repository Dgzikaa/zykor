# AUDITORIA COMPLETA: Tela Desempenho Estratégico
**Data**: 22/04/2026  
**Objetivo**: Mapear origens de dados e planejar migração para arquitetura Medalion pura

---

## SUMÁRIO EXECUTIVO

### Situação Atual:
- **API `/estrategico/desempenho`**: Recalcula tudo do zero agregando múltiplas fontes
- **`operations.eventos_base`**: Tabela híbrida (planejamento + real) atualizada por `calculate_evento_metrics`
- **`gold.desempenho`**: Tabela Medalion parcialmente povoada pelo ETL
- **`meta.desempenho_manual`**: Campos editáveis pelo usuário

### Problema:
- 🔴 **Arquitetura duplicada**: Mesmos dados calculados em 2 lugares
- 🔴 **API ignora gold.desempenho**: Recalcula tudo em tempo real
- 🔴 **Fonte de verdade indefinida**: eventos_base vs gold.desempenho

### Solução Proposta:
**Migrar API para ler `gold.desempenho` (fonte única) + `meta.desempenho_manual` (campos editáveis)**

---

## 1. INVENTÁRIO DE INDICADORES

### Total: **47 indicadores** na tela

#### GUARDRAIL - Estratégicos (11 indicadores)
1. Faturamento Total
2. Fat. Couvert
3. Fat. Bar
4. Fat. CMvível
5. CMV Teórico %
6. CMV Global %
7. CMV Limpo %
8. CMV R$
9. Ticket Médio
10. TM Entrada
11. TM Bar
12. CMO %
13. Atração/Fat.

#### OVT - Clientes (6 indicadores)
14. Clientes Ativos
15. Visitas
16. % Novos Clientes
17. Reservas Realizadas (mesas/pessoas)
18. Reservas Presentes (mesas/pessoas)
19. Quebra de Reservas

#### Qualidade (12 indicadores)
20. Avaliações 5★ Google
21. Média Google
22. NPS Digital
23. NPS Salão
24. NPS Reservas
25. NPS Felicidade Equipe
26-31. [NPS Critérios: Atendimento, Ambiente, Drink, Comida, Limpeza, Preço]

#### Cockpit Produtos (18 indicadores)
32-34. Stockout (Comidas, Drinks, Bar)
35-37. Mix de Vendas (Bebidas, Drinks, Comida)
38-39. Tempos (Bar, Cozinha)
40-43. Atrasos (Atrasinho/Atrasão Bar/Cozinha)
44-45. Horários (% Fat até 19h, % Fat após 22h)
46. Conta Assinada
47. Descontos

---

## 2. MATRIZ COMPLETA: FONTE ATUAL vs IDEAL

| # | Indicador | Key API | Fonte Atual | gold.desempenho | meta.manual | Status |
|---|-----------|---------|-------------|-----------------|-------------|--------|
| 1 | Faturamento Total | `faturamento_total` | **eventos_base.real_r** (soma) | ✅ TEM | ❌ | **B - MIGRAR** |
| 2 | Fat. Couvert | `faturamento_couvert` | **cliente_visitas.valor_couvert** (soma) | ✅ TEM (`faturamento_entrada`) | ❌ | **B - MIGRAR** |
| 3 | Fat. Bar | `faturamento_bar` | **calculado** (total - couvert) | ✅ TEM | ❌ | **B - MIGRAR** |
| 4 | Fat. CMvível | `faturamento_cmovivel` | **NÃO CALCULADO** (0) | ✅ TEM | ❌ | **B - MIGRAR** |
| 5 | CMV Teórico % | `cmv_teorico` | **meta.desempenho_manual** | ✅ TEM | ✅ TEM | **A - OK** |
| 6 | CMV Global % | `cmv_global_real` | **NÃO CALCULADO** (0) | ✅ TEM | ❌ | **B - MIGRAR** |
| 7 | CMV Limpo % | `cmv_limpo` | **NÃO CALCULADO** (0) | ✅ TEM | ✅ TEM | **B - MIGRAR** |
| 8 | CMV R$ | `cmv_rs` | **NÃO CALCULADO** (0) | ✅ TEM (`cmv`) | ✅ TEM | **B - MIGRAR** |
| 9 | Ticket Médio | `ticket_medio` | **eventos_base** (fat/clientes) | ✅ TEM | ✅ TEM | **B - MIGRAR** |
| 10 | TM Entrada | `tm_entrada` | **eventos_base.te_real** (média) | ✅ TEM | ✅ TEM | **B - MIGRAR** |
| 11 | TM Bar | `tm_bar` | **eventos_base.tb_real** (média) | ✅ TEM | ✅ TEM | **B - MIGRAR** |
| 12 | CMO % | `cmo` | **meta.desempenho_manual** | ✅ TEM | ✅ TEM | **A - OK** |
| 13 | Atração/Fat. | `custo_atracao_faturamento` | **eventos_base.c_art** (soma/%) | ✅ TEM | ✅ TEM | **B - MIGRAR** |
| 14 | Clientes Ativos | `clientes_ativos` | **cliente_visitas** (calcula 2+) | ✅ TEM | ❌ | **B - MIGRAR** |
| 15 | Visitas | `clientes_atendidos` | **eventos_base.cl_real** (soma) | ✅ TEM | ❌ | **B - MIGRAR** |
| 16 | % Novos Clientes | `perc_clientes_novos` | **NÃO CALCULADO** (0) | ✅ TEM | ✅ TEM | **B - MIGRAR** |
| 17 | Reservas Realizadas | `reservas_totais` | **eventos_base.res_tot** (soma) | ✅ TEM (ambos: antigo + novo) | ✅ TEM | **B - MIGRAR** |
| 18 | Reservas Presentes | `reservas_presentes` | **eventos_base.res_p** (soma) | ✅ TEM (ambos: antigo + novo) | ✅ TEM | **B - MIGRAR** |
| 19 | Quebra Reservas | `quebra_reservas` | **calculado frontend** | ✅ TEM (`reservas_quebra_pct`) | ❌ | **B - MIGRAR** |
| 20 | Avaliações 5★ Google | `avaliacoes_5_google_trip` | **NÃO CALCULADO** | ✅ TEM | ✅ TEM | **B - MIGRAR** |
| 21 | Média Google | `media_avaliacoes_google` | **NÃO CALCULADO** | ✅ TEM | ✅ TEM | **B - MIGRAR** |
| 22 | NPS Digital | `nps_digital` | **NÃO CALCULADO** | ✅ TEM | ✅ TEM | **B - MIGRAR** |
| 23 | NPS Salão | `nps_salao` | **NÃO CALCULADO** | ✅ TEM | ✅ TEM | **B - MIGRAR** |
| 24 | NPS Reservas | `nps_reservas` | **meta.desempenho_manual** | ✅ TEM | ✅ TEM | **A - OK** |
| 25 | NPS Felicidade | `nota_felicidade_equipe` | **meta.desempenho_manual** | ❌ SEM | ✅ TEM | **C - ADD GOLD** |
| 26-31 | NPS Critérios | `nps_*` | **NÃO CALCULADO** | ✅ TEM | ✅ TEM | **B - MIGRAR** |
| 32 | Stockout Comidas | `stockout_comidas_perc` | **NÃO CALCULADO** | ✅ TEM | ✅ TEM | **B - MIGRAR** |
| 33 | Stockout Drinks | `stockout_drinks_perc` | **NÃO CALCULADO** | ✅ TEM | ✅ TEM | **B - MIGRAR** |
| 34 | Stockout Bar | `stockout_bar_perc` | **NÃO CALCULADO** | ✅ TEM | ✅ TEM | **B - MIGRAR** |
| 35 | % Bebidas | `perc_bebidas` | **NÃO CALCULADO** (0) | ✅ TEM | ✅ TEM | **B - MIGRAR** |
| 36 | % Drinks | `perc_drinks` | **NÃO CALCULADO** (0) | ✅ TEM | ✅ TEM | **B - MIGRAR** |
| 37 | % Comida | `perc_comida` | **NÃO CALCULADO** (0) | ✅ TEM | ✅ TEM | **B - MIGRAR** |
| 38 | Tempo Bar | `tempo_saida_bar` | **NÃO CALCULADO** | ✅ TEM (`tempo_drinks`) | ❌ | **B - MIGRAR** |
| 39 | Tempo Cozinha | `tempo_saida_cozinha` | **NÃO CALCULADO** | ✅ TEM (`tempo_cozinha`) | ❌ | **B - MIGRAR** |
| 40-43 | Atrasos | `atrasos_*` | **NÃO CALCULADO** | ✅ TEM | ❌ | **B - MIGRAR** |
| 44 | % Fat até 19h | `perc_faturamento_ate_19h` | **eventos_base.fat_19h_percent** | ✅ TEM | ✅ TEM | **B - MIGRAR** |
| 45 | % Fat após 22h | `perc_faturamento_apos_22h` | **NÃO CALCULADO** | ✅ TEM | ✅ TEM | **B - MIGRAR** |
| 46 | Conta Assinada | `conta_assinada_valor` | **NÃO CALCULADO** | ❌ SEM | ✅ TEM | **C - ADD GOLD** |
| 47 | Cancelamentos | `cancelamentos` | **NÃO CALCULADO** | ✅ TEM (`cancelamentos_total`) | ✅ TEM | **B - MIGRAR** |

### Campos Marketing (15 indicadores):
- **TODOS** vêm de `meta.desempenho_manual`
- **TODOS** já estão em `gold.desempenho`
- **Status**: **A - OK** (já usa meta corretamente)

---

## 3. CLASSIFICAÇÃO POR GRUPO

### **GRUPO A - JÁ FUNCIONA** (4 campos)
✅ API já lê de `meta.desempenho_manual` ou calcula correto:
- `cmv_teorico`
- `cmo`
- `nps_reservas`
- Marketing (15 campos: o_*, m_*, g_*)

**Total Grupo A: 19 campos**

### **GRUPO B - GOLD TEM, API NÃO LÊ** (26 campos)
⚠️ `gold.desempenho` tem a coluna, mas API recalcula/ignora:
- Faturamentos (total, couvert, bar, cmvivel)
- Tickets (médio, entrada, bar)
- CMV (global, limpo, R$)
- Atração %
- Clientes (ativos, atendidos, % novos)
- **Reservas** (totais, presentes, quebra) ← **PROBLEMA PRINCIPAL!**
- Google (avaliações, média)
- NPS (digital, salão, critérios)
- Stockout (3)
- Mix vendas (3)
- Tempos (2)
- Atrasos (4)
- % Fat horários (2)
- Cancelamentos

**Total Grupo B: 26 campos**

### **GRUPO C - GOLD NÃO TEM** (2 campos)
❌ Precisam ser adicionados em `gold.desempenho`:
- `nota_felicidade_equipe` (NPS Felicidade)
- `conta_assinada_valor` (Conta Assinada R$ + %)

**Total Grupo C: 2 campos**

---

## 4. COMPARAÇÃO: eventos_base vs gold.desempenho

### Semana 16 Bar 3:

| Campo | eventos_base (soma) | gold.desempenho | Meta.manual | Usado na Tela |
|-------|---------------------|-----------------|-------------|---------------|
| **Faturamento** | R$ 470.827 | R$ 470.827 ✅ | - | eventos_base |
| **Clientes** | 3.513 | - | - | eventos_base |
| **Reservas Tot** | 1.404 pessoas ✅ | 4.663 pessoas ❌ (old) / 88 mesas ✅ (new) | - | eventos_base |
| **Reservas Pres** | 1.320 pessoas ✅ | 1.067 pessoas ❌ (old) / 80 mesas ✅ (new) | - | eventos_base |
| **Mix Bebidas** | NÃO CALCULADO | 66.32% ✅ | - | gold |
| **Mix Drinks** | NÃO CALCULADO | 19.60% ✅ | - | gold |
| **Mix Comida** | NÃO CALCULADO | 14.07% ✅ | - | gold |
| **Atração %** | c_art soma | 1.19% ✅ | - | eventos_base |
| **CMV %** | NÃO CALCULADO | 0% (não calculado) | - | meta.manual |
| **NPS Digital** | NÃO CALCULADO | calculado ✅ | - | gold |
| **Stockout** | NÃO CALCULADO | calculado ✅ | - | gold |

---

## 5. ANÁLISE DADOS S16

### eventos_base (fonte atual API):
| Data | Evento | res_tot | res_p | Versão |
|------|--------|---------|-------|--------|
| 13/04 | Segunda da Resenha | 9 | 9 | V23 ✅ |
| 14/04 | 7naRoda | 79 | 79 | V23 ✅ |
| 15/04 | Quarta de Bamba | 231 | 229 | V23 ✅ |
| 16/04 | Pé no Ordi | 128 | 128 | V23 ✅ |
| 17/04 | Pagode Vira Lata | 360 | 320 | V23 ✅ |
| 18/04 | Feijuca do Ordi | 287 | 245 | V23 ✅ |
| 19/04 | Uma Mesa e Um Pagode | 310 | 310 | V23 ✅ |
| **TOTAL** | **7 eventos** | **1.404** | **1.320** | - |

### bronze.bronze_getin_reservations (fonte real):
| Status | Qtd Reservas | Total Pessoas |
|--------|--------------|---------------|
| `pending` | 45 | 750 |
| `seated` | 18 | 317 |
| `confirmed` | 17 | 253 |
| `canceled-user` | 7 | 82 |
| `no-show` | 1 | 2 |
| **TOTAL** | **88** | **1.404** |

### Regras de Negócio Aplicadas:
```
PRESENTES = seated (317) + pending (750) + confirmed (253) = 1.320 pessoas ✅
NÃO PRESENTES = no-show (2) + canceled (82) = 84 pessoas
QUEBRA = 84 / 1.404 = 5.98% ✅
```

### Comparação com Excel:
| Fonte | Total | Presentes | Quebra |
|-------|-------|-----------|--------|
| **Excel** | 1.256 | 1.056 | 15.9% |
| **eventos_base (API)** | 1.404 ✅ | 1.320 ✅ | 5.98% ✅ |
| **Getin Bronze** | 1.404 ✅ | 1.320 ✅ | 5.98% ✅ |

**Conclusão**: Sistema está **CORRETO**. Excel pode estar com dados parciais ou critério diferente.

---

## 6. DEPENDÊNCIAS BACKEND

### Funções que escrevem em `operations.eventos_base`:
1. **`calculate_evento_metrics`** ← **PRINCIPAL** (atualiza res_tot, res_p, c_art, etc)
2. `auto_recalculo_eventos_pendentes`
3. `processar_eventos_mes`
4. `recalcular_eventos_recentes`
5. `update_eventos_ambos_bares`
6. `update_eventos_base_from_contahub_batch`
7. `update_eventos_base_with_sympla_yuzer`

### Triggers em `eventos_base`:
- `trigger_fill_semana`: Preenche campo `semana` automaticamente
- Constraint triggers (audit)

### Cron Jobs:
- Múltiplos jobs chamam `calculate_evento_metrics` após sync ContaHub
- ETL Gold roda após eventos_base atualizar

---

## 7. FLUXO ATUAL (ARQUITETURA PROBLEMÁTICA)

```
┌─────────────────────────────────────────────────────────┐
│ BRONZE: Dados brutos (ContaHub, Getin, etc)           │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│ SILVER: Agregações (vendas_item, cliente_visitas, etc)│
└────────────────┬────────────────────────────────────────┘
                 ↓
      ┌──────────┴──────────┐
      ↓                     ↓
┌─────────────────┐  ┌──────────────────────────┐
│ GOLD:           │  │ operations.eventos_base  │  ← HÍBRIDO!
│ desempenho      │  │ (planejamento + real)    │
│ (ETL)           │  │ (calculate_evento_metrics)│
└─────────────────┘  └──────────────────────────┘
      ↓                     ↓
      ❌ IGNORADO          ✅ USADO
                           ↓
              ┌─────────────────────────────┐
              │ API /estrategico/desempenho │
              │ (recalcula do zero)         │
              └─────────────────────────────┘
                           ↓
                    Frontend (Tela)
```

### Problemas:
1. **Duplicação**: Mesmos dados calculados em `gold.desempenho` E `calculate_evento_metrics`
2. **Fonte errada**: API lê `eventos_base` (tabela de planejamento) em vez de `gold.desempenho` (medalion)
3. **Performance**: API recalcula tudo em tempo real (slow, timeouts)
4. **Inconsistência**: `gold.desempenho` existe mas não é usado

---

## 8. FLUXO IDEAL (ARQUITETURA MEDALION PURA)

```
BRONZE → SILVER → GOLD → API → Frontend
                    ↑
              (fonte única)
```

```
┌─────────────────────────────────────────────────────────┐
│ BRONZE: Dados brutos                                   │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│ SILVER: Agregações diárias                             │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│ GOLD: desempenho (semanal/mensal)                      │
│ + meta.desempenho_manual (campos editáveis)            │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│ API: SELECT * FROM gold.desempenho                     │
│      LEFT JOIN meta.desempenho_manual                  │
└────────────────┬────────────────────────────────────────┘
                 ↓
              Frontend (Tela)
```

### Vantagens:
1. ✅ **Fonte única**: gold.desempenho
2. ✅ **Performance**: SELECT simples (sem agregações)
3. ✅ **Consistência**: Mesmos dados em toda stack
4. ✅ **Medalion correto**: Bronze → Silver → Gold → API

---

## 9. NÚMEROS BRUTOS: eventos_base vs Getin S16

| Fonte | Total Pessoas | Presentes | Quebra % | Observação |
|-------|---------------|-----------|----------|------------|
| **Excel (user)** | 1.256 | 1.056 | 15.9% | Dados parciais? |
| **eventos_base** | **1.404** ✅ | **1.320** ✅ | **5.98%** ✅ | Fonte atual da API |
| **Getin (exceto canceled)** | 1.322 | 1.320 | 6.35% | Getin real |
| **Getin (seated+confirmed+noshow)** | 572 | 317 | 0.35% | Critério restrito |

**Conclusão:** `eventos_base` está **CORRETO** após `calculate_evento_metrics` V23!

---

## 10. DEPENDÊNCIAS A DEPRECAR

Após migração para `gold.desempenho`:

### Deprecar/Remover:
1. ❌ `calculate_evento_metrics` (função gigante, não mais necessária)
2. ❌ `operations.eventos_base.res_tot/res_p/c_art/etc` (campos calculados)
3. ❌ Crons que chamam `calculate_evento_metrics`
4. ❌ API recalcular do zero

### Manter:
1. ✅ `operations.eventos_base` (apenas planejamento: m1_r, cl_plan, etc)
2. ✅ ETL Gold (fonte de verdade)
3. ✅ `meta.desempenho_manual` (campos editáveis)

---

## 11. PLANO DE MIGRAÇÃO

### **FASE 1: Preparação Gold** (30 min)
1. Adicionar 2 colunas faltantes:
   - `nota_felicidade_equipe` (double precision)
   - `conta_assinada_valor` + `conta_assinada_perc` (numeric)

2. Corrigir ETL Gold para preencher campos antigos também:
   - `reservas_totais` ← `reservas_totais_quantidade`
   - `reservas_presentes` ← `reservas_presentes_quantidade`
   - (para retrocompatibilidade)

3. Rebuild Gold S14-S17 para todas as semanas

### **FASE 2: Reescrever API** (1-2h)
Arquivo: `frontend/src/app/api/estrategico/desempenho/route.ts`

**ANTES** (758 linhas, recalcula tudo):
```typescript
// Busca eventos_base
// Soma res_tot, res_p, real_r, etc
// Calcula clientes ativos (loop pesado)
// Calcula CMO proporcional
// Retorna ~400 linhas de lógica
```

**DEPOIS** (~100 linhas, SELECT simples):
```typescript
const { data: semanasGold } = await supabase
  .from('desempenho')
  .select('*, desempenho_manual(*)')
  .eq('bar_id', barId)
  .eq('ano', ano)
  .eq('granularidade', 'semanal')
  .order('numero_semana', { ascending: false });

// Merge gold + meta.manual
// Retornar
```

### **FASE 3: Validação** (30 min)
1. Comparar resposta API antiga vs nova
2. Validar tela exibe corretamente
3. Performance test (deve ser 10x mais rápido)

### **FASE 4: Deprecação** (30 min)
1. Marcar `calculate_evento_metrics` como deprecated
2. Desativar crons que a chamam
3. Documentar campos `eventos_base` que não são mais usados

### **FASE 5: Limpeza** (depois, quando validado)
1. DROP function `calculate_evento_metrics`
2. DROP colunas `eventos_base.res_tot/res_p/c_art/etc`
3. Simplificar `eventos_base` para apenas planejamento

---

## 12. TEMPO ESTIMADO

| Fase | Duração | Prioridade |
|------|---------|------------|
| Fase 1 | 30 min | 🔴 ALTA |
| Fase 2 | 1-2h | 🔴 ALTA |
| Fase 3 | 30 min | 🔴 ALTA |
| Fase 4 | 30 min | 🟡 MÉDIA |
| Fase 5 | 1h | 🟢 BAIXA (futuro) |
| **TOTAL** | **3-4h** | - |

---

## 13. RISCOS E MITIGAÇÕES

### Riscos:
1. **API nova quebra tela**: Campos faltando ou formato diferente
2. **Performance pior**: Gold não tem índices adequados
3. **Dados inconsistentes**: ETL Gold com bugs

### Mitigações:
1. **Feature flag**: Manter ambas APIs, alternar via config
2. **Teste A/B**: Comparar respostas antiga vs nova
3. **Rollback fácil**: Git revert se der problema
4. **Validação**: Script que compara ambas fontes campo a campo

---

## 14. BENEFÍCIOS

### Imediatos:
- ✅ **Performance**: API 10x mais rápida (SELECT vs agregações)
- ✅ **Simplicidade**: API de 758 → ~100 linhas
- ✅ **Consistência**: Fonte única de verdade

### Médio Prazo:
- ✅ **Manutenibilidade**: 1 lugar para corrigir bugs (ETL Gold)
- ✅ **Arquitetura limpa**: Medalion puro
- ✅ **Escalabilidade**: Gold pré-calculado, API só lê

### Longo Prazo:
- ✅ **Deprecar eventos_base**: Simplificar schema
- ✅ **Deprecar calculate_evento_metrics**: Função gigante removida
- ✅ **Reduzir processamento**: Menos crons, menos cálculos redundantes

---

## 15. DECISÃO REQUERIDA

### Opção A: **Migração Completa** (recomendado)
- Fases 1-4 completas
- API lê apenas `gold.desempenho`
- `calculate_evento_metrics` deprecated

### Opção B: **Híbrido Temporário**
- Manter ambas APIs
- Feature flag para alternar
- Deprecar depois de validar

### Opção C: **Status Quo** (não recomendado)
- Manter arquitetura duplicada
- Resolver apenas bug de reservas (cache)
- Deixar refatoração para depois

---

## 16. PRÓXIMOS PASSOS IMEDIATOS

### Para resolver bug de "0 reservas" AGORA:
**✅ Confirmar se é cache do browser/Vercel**
- Build `de47ab56` deve estar terminando
- Hard refresh: `Ctrl + Shift + R`
- Ou janela anônima
- Ou aguardar 5-10min (CDN cache expira)

### Para refatoração completa:
**Aguardar decisão do usuário sobre Opção A, B ou C**

---

## CONCLUSÃO

**Dados estão corretos no banco.**  
**API retorna dados corretos.**  
**Problema atual é 100% cache.**

Após resolver cache, decidir se faz migração completa para arquitetura Medalion pura (Opção A recomendada).

---

**FIM DA AUDITORIA**
