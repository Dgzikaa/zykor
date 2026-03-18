# 📊 Regras por Bar - Zykor

> **Última atualização:** 18/03/2026
> **Bares:** Ordinário (ID: 3) | Deboche (ID: 4)

---

# 🔄 PIPELINE DE DADOS - VISÃO GERAL

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              FLUXO DE DADOS DIÁRIO                                       │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  07:00 ──► Google Sheets Sync (NPS, Voz Cliente, Pesquisa)                              │
│  08:00 ──► Relatório Matinal Discord                                                     │
│  08:00 ──► Sympla/Yuzer Sync (segundas-feiras)                                          │
│  09:00 ──► Alertas Proativos + Agente Análise Diária                                    │
│  10:00 ──► ContaHub Sync (ambos bares) ──► Update eventos_base                          │
│  11:00 ──► Google Reviews Sync + NIBO Sync                                               │
│  11:30 ──► Sync Contagem Estoque (ambos bares)                                          │
│  12:00 ──► Desempenho Auto + CMV Semanal                                                 │
│  14:00 ──► GetIn Sync (a cada 2h) + Umbler Sync                                          │
│  15:00 ──► Alertas Proativos (tarde)                                                     │
│  19:00 ──► NIBO Sync (2ª rodada)                                                         │
│  19:00 ──► Stockout Sync (ambos bares)                                                   │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

# 🗂️ FONTES DE DADOS

## APIs Externas → Tabelas Supabase

| Sistema | Edge Function | Tabela(s) Destino | Cronjob | Ordinário | Deboche |
|---------|--------------|-------------------|---------|-----------|---------|
| **ContaHub** | `contahub-sync-automatico` | `contahub_analitico`, `contahub_tempo`, `contahub_periodo`, `contahub_pagamentos`, `contahub_fatporhora` | `07:00 BRT` | ✅ | ✅ |
| **ContaHub Stockout** | `contahub-stockout-sync` | `contahub_stockout` | `19:00 BRT` | ✅ | ✅ |
| **GetIn** | `getin-sync-continuous` | `getin_reservas` → `eventos_base` | `a cada 2h` | ✅ | ❌ Sem API |
| **NIBO** | `nibo-sync` | `nibo_agendamentos` | `08:00, 19:00` | ✅ | ✅ |
| **Google Reviews** | `google-reviews-apify-sync` | `google_reviews` | `08:00 BRT` | ✅ | ✅ |
| **Falaê (NPS)** | `google-sheets-sync` | `nps_falae_diario`, `nps_falae_diario_pesquisa` | `05:00 BRT` | ✅ | ✅ |
| **Sympla** | `integracao-dispatcher` | `sympla_pedidos` | `Seg 05:00` | ✅ | ✅ |
| **Yuzer** | `integracao-dispatcher` | `yuzer_produtos` | `Seg 05:00` | ✅ | ✅ |

---

# 📈 PÁGINA: DESEMPENHO SEMANAL

## Pipeline de Cálculo

```
ContaHub/GetIn/NIBO (APIs)
        │
        ▼
   eventos_base ◄─── Trigger: update_eventos_base_from_contahub
        │
        ▼
recalcular-desempenho-auto (Edge Function)
        │ Cronjob: 12:00 BRT diário
        ▼
  desempenho_semanal (Tabela)
        │
        ▼
   DesempenhoClient.tsx (Frontend)
```

---

## 📦 SEÇÃO: GUARDRAIL - FATURAMENTO

### Faturamento Total

```
┌─────────────────────────────────────────────────────────────────┐
│ FATURAMENTO TOTAL                                                │
├──────────────┬──────────────────────────────────────────────────┤
│ Tipo         │ 🤖 AUTOMÁTICO                                    │
│ Tabela       │ eventos_base                                     │
│ Coluna       │ real_r                                           │
│ Fórmula      │ SUM(real_r) WHERE ativo = true                   │
│ Alimentado   │ ContaHub → contahub-processor → eventos_base     │
│ Cronjob      │ contahub-sync-7h-ambos (10:00 UTC)               │
│ Destino      │ desempenho_semanal.faturamento_total             │
├──────────────┴──────────────────────────────────────────────────┤
│ ORDINÁRIO    │ ✅ Igual                                         │
│ DEBOCHE      │ ✅ Igual                                         │
└─────────────────────────────────────────────────────────────────┘
```

### Ticket Médio

```
┌─────────────────────────────────────────────────────────────────┐
│ TICKET MÉDIO                                                     │
├──────────────┬──────────────────────────────────────────────────┤
│              │        ORDINÁRIO           │      DEBOCHE        │
├──────────────┼────────────────────────────┼─────────────────────┤
│ Tipo         │ 🤖 AUTOMÁTICO              │ ✋ MANUAL           │
│ Tabela       │ eventos_base               │ Input Stone         │
│ Fórmula      │ faturamento / clientes     │ Valor digitado      │
│ Editável     │ ❌ Não                     │ ✅ Sim              │
│ Destino      │ desempenho_semanal.ticket_medio                  │
├──────────────┴────────────────────────────┴─────────────────────┤
│ Arquivo      │ DesempenhoClient.tsx (linha 92-97)               │
│ Condição     │ barId === 4 ? manual : auto                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 👥 SEÇÃO: OVT - CLIENTES

### Clientes Ativos (Base Ativa 90 dias)

```
┌─────────────────────────────────────────────────────────────────┐
│ CLIENTES ATIVOS                                                  │
├──────────────┬──────────────────────────────────────────────────┤
│              │        ORDINÁRIO           │      DEBOCHE        │
├──────────────┼────────────────────────────┼─────────────────────┤
│ Exibição     │ ✅ VISÍVEL                 │ ❌ OCULTO           │
│ Tipo         │ 🤖 AUTOMÁTICO (SP)         │ —                   │
│ Tabela       │ contahub_periodo           │ —                   │
│ Stored Proc  │ get_count_base_ativa       │ —                   │
├──────────────┴────────────────────────────┴─────────────────────┤
│ LÓGICA DA STORED PROCEDURE:                                      │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ SELECT COUNT(DISTINCT cli_fone)                           │   │
│ │ FROM contahub_periodo                                     │   │
│ │ WHERE bar_id = ?                                          │   │
│ │   AND dt_gerencial >= (data_fim - 90 days)                │   │
│ │   AND dt_gerencial <= data_fim                            │   │
│ │   AND cli_fone IS NOT NULL                                │   │
│ │   AND LENGTH(cli_fone) >= 8                               │   │
│ │ GROUP BY cli_fone                                         │   │
│ │ HAVING COUNT(*) >= 2  ◄── Mínimo 2 visitas                │   │
│ └───────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│ Motivo Oculto Deboche: Aguardando implementação API Zig         │
│ Arquivo: DesempenhoClient.tsx (condição barId !== 4)            │
└─────────────────────────────────────────────────────────────────┘
```

### % Novos Clientes

```
┌─────────────────────────────────────────────────────────────────┐
│ % NOVOS CLIENTES                                                 │
├──────────────┬──────────────────────────────────────────────────┤
│              │        ORDINÁRIO           │      DEBOCHE        │
├──────────────┼────────────────────────────┼─────────────────────┤
│ Exibição     │ ✅ VISÍVEL                 │ ❌ OCULTO           │
│ Tipo         │ 🤖 AUTOMÁTICO (SP)         │ —                   │
│ Tabela       │ contahub_periodo           │ —                   │
│ Stored Proc  │ calcular_metricas_clientes │ —                   │
├──────────────┴────────────────────────────┴─────────────────────┤
│ LÓGICA DA STORED PROCEDURE:                                      │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ Cliente NOVO = cli_fone que NÃO existe em                 │   │
│ │                dt_gerencial < p_data_inicio_atual         │   │
│ │                                                           │   │
│ │ Fórmula: (novos_atual / total_atual) * 100                │   │
│ └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Visitas (Clientes Atendidos)

```
┌─────────────────────────────────────────────────────────────────┐
│ VISITAS                                                          │
├──────────────┬──────────────────────────────────────────────────┤
│ Tipo         │ 🤖 AUTOMÁTICO                                    │
│ Tabela       │ eventos_base                                     │
│ Coluna       │ cl_real                                          │
│ Fórmula      │ SUM(cl_real) WHERE ativo = true                  │
│ Destino      │ desempenho_semanal.clientes_atendidos            │
├──────────────┴──────────────────────────────────────────────────┤
│ ORDINÁRIO    │ ✅ Igual                                         │
│ DEBOCHE      │ ✅ Igual                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## ⭐ SEÇÃO: QUALIDADE - GOOGLE REVIEWS

### Avaliações 5★

```
┌─────────────────────────────────────────────────────────────────┐
│ AVALIAÇÕES 5★ GOOGLE                                             │
├──────────────┬──────────────────────────────────────────────────┤
│ Tipo         │ 🤖 AUTOMÁTICO (SP)                               │
│ Tabela       │ google_reviews                                   │
│ Stored Proc  │ get_google_reviews_stars_by_date                 │
│ Cronjob      │ google-reviews-daily-sync (11:00 UTC)            │
│ Fonte        │ Apify (scraping Google Maps)                     │
├──────────────┴──────────────────────────────────────────────────┤
│ LÓGICA DA STORED PROCEDURE:                                      │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ SELECT stars, published_at_date                           │   │
│ │ FROM google_reviews                                       │   │
│ │ WHERE bar_id = ?                                          │   │
│ │   AND (published_at_date AT TIME ZONE 'America/Sao_Paulo')│   │
│ │       ::date >= p_data_inicio                             │   │
│ │   AND (published_at_date AT TIME ZONE 'America/Sao_Paulo')│   │
│ │       ::date <= p_data_fim                                │   │
│ │                                                           │   │
│ │ Cálculo: COUNT(*) WHERE stars = 5                         │   │
│ └───────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│ ORDINÁRIO    │ ✅ Igual                                         │
│ DEBOCHE      │ ✅ Igual                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 SEÇÃO: QUALIDADE - NPS

### NPS Digital / NPS Salão

```
┌─────────────────────────────────────────────────────────────────┐
│ NPS DIGITAL / NPS SALÃO                                          │
├──────────────┬──────────────────────────────────────────────────┤
│ Tipo         │ 🤖 AUTOMÁTICO (SP)                               │
│ Tabela       │ nps_falae_diario_pesquisa                        │
│ Stored Proc  │ calcular_nps_semanal_por_pesquisa                │
│ Cronjob      │ google-sheets-sync-diario (08:00 UTC)            │
│ Fonte        │ Google Sheets (Falaê exporta diariamente)        │
├──────────────┴──────────────────────────────────────────────────┤
│ LÓGICA DA STORED PROCEDURE:                                      │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ Filtros:                                                  │   │
│ │   - search_name = 'NPS Digital' ou 'Salão'                │   │
│ │   - data_referencia BETWEEN inicio AND fim                │   │
│ │                                                           │   │
│ │ Fórmula: (promotores/total * 100) - (detratores/total*100)│   │
│ └───────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│ ORDINÁRIO    │ ✅ Igual                                         │
│ DEBOCHE      │ ✅ Igual                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🍺 SEÇÃO: COCKPIT PRODUTOS - STOCKOUT

### % Stockout (Bar / Drinks / Comidas)

```
┌─────────────────────────────────────────────────────────────────┐
│ % STOCKOUT                                                       │
├──────────────┬──────────────────────────────────────────────────┤
│ Tipo         │ 🤖 AUTOMÁTICO (SP)                               │
│ Tabela       │ contahub_stockout                                │
│ Stored Proc  │ calcular_stockout_semanal                        │
│ Cronjob      │ stockout-sync-diario (22:00 UTC)                 │
│ Fonte        │ ContaHub API (status prd_venda = S/N)            │
├──────────────┴──────────────────────────────────────────────────┤
│ MAPEAMENTO DE CATEGORIAS:                                        │
│                                                                  │
│ ┌─────────────────────┬─────────────────────┐                   │
│ │     ORDINÁRIO       │       DEBOCHE       │                   │
│ ├─────────────────────┼─────────────────────┤                   │
│ │ loc_desc            │ loc_desc            │ → Categoria       │
│ ├─────────────────────┼─────────────────────┼────────────────   │
│ │ Bar, Shot, Dose,    │ Salao               │ → 'Bar'           │
│ │ Chopp               │                     │                   │
│ ├─────────────────────┼─────────────────────┤                   │
│ │ Batidos, Montados,  │ Bar                 │ → 'Drinks'        │
│ │ Mexido, Preshh      │                     │                   │
│ ├─────────────────────┼─────────────────────┤                   │
│ │ Cozinha 1,          │ Cozinha             │ → 'Comidas'       │
│ │ Cozinha 2           │                     │                   │
│ └─────────────────────┴─────────────────────┘                   │
│                                                                  │
│ EXCLUSÕES (ambos):                                               │
│ - prd_desc: [HH], [PP], [DD], [IN], Happy Hour, Dose Dupla      │
│ - grp_desc: Baldes, Chegadeira, Insumos, Uso interno            │
│ - loc_desc: Pegue e Pague, Venda Volante                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🍹 SEÇÃO: COCKPIT PRODUTOS - MIX DE VENDAS

### % Bebidas / % Drinks / % Comida

```
┌─────────────────────────────────────────────────────────────────┐
│ MIX DE VENDAS (% Bebidas, % Drinks, % Comida)                    │
├──────────────┬──────────────────────────────────────────────────┤
│ Tipo         │ 🤖 AUTOMÁTICO (SP)                               │
│ Tabela       │ contahub_analitico                               │
│ Stored Proc  │ calcular_mix_vendas                              │
│ Cronjob      │ Alimentado pelo contahub-sync-7h-ambos           │
├──────────────┴──────────────────────────────────────────────────┤
│ CRITÉRIOS POR BAR:                                               │
│                                                                  │
│ ┌─────────────┬─────────────────────┬─────────────────────┐     │
│ │ Indicador   │     ORDINÁRIO       │       DEBOCHE       │     │
│ ├─────────────┼─────────────────────┼─────────────────────┤     │
│ │ % Bebidas   │ categoria_mix =     │ loc_desc = 'Salao'  │     │
│ │             │ 'BEBIDA'            │                     │     │
│ ├─────────────┼─────────────────────┼─────────────────────┤     │
│ │ % Drinks    │ categoria_mix =     │ loc_desc = 'Bar'    │     │
│ │             │ 'DRINK'             │                     │     │
│ ├─────────────┼─────────────────────┼─────────────────────┤     │
│ │ % Comida    │ categoria_mix =     │ loc_desc IN         │     │
│ │             │ 'COMIDA'            │ ('Cozinha',         │     │
│ │             │                     │  'Cozinha 2')       │     │
│ └─────────────┴─────────────────────┴─────────────────────┘     │
│                                                                  │
│ Filtro tipo: 'venda integral', 'com desconto', '100% desconto'  │
│ Fórmula: SUM(valor WHERE critério) / SUM(valor) * 100           │
└─────────────────────────────────────────────────────────────────┘
```

---

## ⏱️ SEÇÃO: COCKPIT PRODUTOS - TEMPOS

### Tempo Drinks (Bar) / Tempo Comida (Cozinha)

```
┌─────────────────────────────────────────────────────────────────┐
│ TEMPO DE SAÍDA                                                   │
├──────────────┬──────────────────────────────────────────────────┤
│ Tipo         │ 🤖 AUTOMÁTICO (SP)                               │
│ Tabela       │ contahub_tempo                                   │
│ Stored Proc  │ calcular_tempo_saida                             │
│ Cronjob      │ Alimentado pelo contahub-sync-7h-ambos           │
├──────────────┴──────────────────────────────────────────────────┤
│ CONFIGURAÇÃO POR BAR:                                            │
│                                                                  │
│ ┌─────────────┬─────────────────────┬─────────────────────┐     │
│ │ Indicador   │     ORDINÁRIO       │       DEBOCHE       │     │
│ ├─────────────┼─────────────────────┼─────────────────────┤     │
│ │ Tempo Bar   │ COLUNA: t0_t3       │ COLUNA: t0_t2       │     │
│ │             │ FILTRO: categoria   │ FILTRO: loc_desc =  │     │
│ │             │ = 'DRINK'           │ 'Bar' AND           │     │
│ │             │                     │ categoria = 'bebida'│     │
│ ├─────────────┼─────────────────────┼─────────────────────┤     │
│ │ Tempo       │ COLUNA: t0_t2       │ COLUNA: t0_t2       │     │
│ │ Cozinha     │ FILTRO: categoria   │ FILTRO: loc_desc IN │     │
│ │             │ = 'COMIDA'          │ ('Cozinha',         │     │
│ │             │                     │  'Cozinha 2') AND   │     │
│ │             │                     │ categoria = 'comida'│     │
│ └─────────────┴─────────────────────┴─────────────────────┘     │
│                                                                  │
│ Fórmula: AVG(coluna_tempo) / 60 (segundos → minutos)            │
│                                                                  │
│ ⚠️ Exclusão: Dias de Carnaval 2026 (13-17/02) dados incorretos  │
└─────────────────────────────────────────────────────────────────┘
```

---

## ⚠️ SEÇÃO: COCKPIT PRODUTOS - ATRASOS

### Atrasão Drinks / Atrasão Comida

```
┌─────────────────────────────────────────────────────────────────┐
│ ATRASÃO (ATRASOS CRÍTICOS)                                       │
├──────────────┬──────────────────────────────────────────────────┤
│ Tipo         │ 🤖 AUTOMÁTICO (SP)                               │
│ Tabela       │ contahub_tempo                                   │
│ Stored Proc  │ calcular_atrasos_tempo                           │
├──────────────┴──────────────────────────────────────────────────┤
│ THRESHOLDS ATUAIS:                                               │
│                                                                  │
│ ┌─────────────┬─────────────────────┬─────────────────────┐     │
│ │ Indicador   │     ORDINÁRIO       │       DEBOCHE       │     │
│ ├─────────────┼─────────────────────┼─────────────────────┤     │
│ │ Atrasão     │ t0_t3 > 1200 seg    │ t0_t2 > 600 seg     │     │
│ │ Drinks      │ (> 20 minutos)      │ (> 10 minutos)      │     │
│ ├─────────────┼─────────────────────┼─────────────────────┤     │
│ │ Atrasão     │ t0_t2 > 1200 seg    │ t0_t2 > 1200 seg    │     │
│ │ Comida      │ (> 20 minutos)      │ (> 20 minutos)      │     │
│ └─────────────┴─────────────────────┴─────────────────────┘     │
│                                                                  │
│ loc_desc FILTROS:                                                │
│ ┌─────────────┬─────────────────────┬─────────────────────┐     │
│ │ Indicador   │     ORDINÁRIO       │       DEBOCHE       │     │
│ ├─────────────┼─────────────────────┼─────────────────────┤     │
│ │ Bar         │ Preshh, Montados,   │ loc_desc = 'Bar'    │     │
│ │             │ Mexido, Drinks,     │ AND categoria =     │     │
│ │             │ Drinks Autorais,    │ 'bebida'            │     │
│ │             │ Shot e Dose,        │                     │     │
│ │             │ Batidos             │                     │     │
│ ├─────────────┼─────────────────────┼─────────────────────┤     │
│ │ Cozinha     │ Cozinha, Cozinha 1, │ Cozinha, Cozinha 2  │     │
│ │             │ Cozinha 2           │ AND categoria =     │     │
│ │             │                     │ 'comida'            │     │
│ └─────────────┴─────────────────────┴─────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### Atrasinho Drinks / Atrasinho Comida

```
┌─────────────────────────────────────────────────────────────────┐
│ ATRASINHO (ATRASOS LEVES)                                        │
├──────────────┬──────────────────────────────────────────────────┤
│ Tipo         │ 🤖 AUTOMÁTICO (pré-calculado em eventos_base)    │
│ Tabela       │ eventos_base                                     │
│ Colunas      │ atrasinho_bar, atrasinho_cozinha                 │
├──────────────┴──────────────────────────────────────────────────┤
│ THRESHOLDS ATUAIS (ambos bares):                                 │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────┐     │
│ │ Atrasinho Drinks: t0_t3 > 240 seg E < 480 seg           │     │
│ │                   (> 4 min e < 8 min)                   │     │
│ ├─────────────────────────────────────────────────────────┤     │
│ │ Atrasinho Comida: t0_t2 > 900 seg E < 1200 seg          │     │
│ │                   (> 15 min e < 20 min)                 │     │
│ └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│ Fórmula: SUM(atrasinho_*) da semana                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 💰 SEÇÃO: VENDAS - HORÁRIOS

### % Fat. até 19h / % Fat. após 22h

```
┌─────────────────────────────────────────────────────────────────┐
│ FATURAMENTO POR HORÁRIO                                          │
├──────────────┬──────────────────────────────────────────────────┤
│ Tipo         │ 🤖 AUTOMÁTICO                                    │
│ Tabela       │ contahub_fatporhora                              │
│ Colunas      │ hora, valor                                      │
│ Cronjob      │ Alimentado pelo contahub-sync-7h-ambos           │
├──────────────┴──────────────────────────────────────────────────┤
│ CÁLCULOS:                                                        │
│                                                                  │
│ % Fat até 19h = SUM(valor WHERE hora < 19) / SUM(valor) * 100   │
│ % Fat após 22h = SUM(valor WHERE hora >= 22) / SUM(valor) * 100 │
├─────────────────────────────────────────────────────────────────┤
│ ORDINÁRIO    │ ✅ Igual                                         │
│ DEBOCHE      │ ✅ Igual                                         │
└─────────────────────────────────────────────────────────────────┘
```

### QUI+SÁB+DOM / TER+QUA+QUI / SEX+SÁB

```
┌─────────────────────────────────────────────────────────────────┐
│ FATURAMENTO POR DIA DA SEMANA                                    │
├──────────────┬──────────────────────────────────────────────────┤
│ Tipo         │ 🤖 AUTOMÁTICO                                    │
│ Tabela       │ ⚠️ contahub_analitico (PROBLEMA!)                │
│ Coluna       │ valorfinal, trn_dtgerencial                      │
├──────────────┴──────────────────────────────────────────────────┤
│ EXIBIÇÃO POR BAR:                                                │
│                                                                  │
│ ┌─────────────────────┬─────────────────────┐                   │
│ │     ORDINÁRIO       │       DEBOCHE       │                   │
│ ├─────────────────────┼─────────────────────┤                   │
│ │ QUI+SÁB+DOM         │ TER+QUA+QUI         │                   │
│ │ (dias 4, 6, 0)      │ (dias 2, 3, 4)      │                   │
│ │                     │                     │                   │
│ │                     │ SEX+SÁB             │                   │
│ │                     │ (dias 5, 6)         │                   │
│ └─────────────────────┴─────────────────────┘                   │
│                                                                  │
│ ⚠️ PROBLEMA IDENTIFICADO:                                        │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ Usando: contahub_analitico.valorfinal                     │   │
│ │ (múltiplos registros por transação = valor por item)      │   │
│ │                                                           │   │
│ │ Deveria usar: eventos_base.real_r                         │   │
│ │ (valor consolidado por dia)                               │   │
│ │                                                           │   │
│ │ Exemplo erro S11: Sex+Sab = R$1.641 (deveria ser ~R$43k)  │   │
│ └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Couvert Total R$ / Atrações/Eventos

```
┌─────────────────────────────────────────────────────────────────┐
│ COUVERT E ATRAÇÕES                                               │
├──────────────┬──────────────────────────────────────────────────┤
│              │        ORDINÁRIO           │      DEBOCHE        │
├──────────────┼────────────────────────────┼─────────────────────┤
│ Exibição     │ ❌ OCULTO                  │ ✅ VISÍVEL          │
├──────────────┴────────────────────────────┴─────────────────────┤
│ COUVERT TOTAL R$:                                                │
│ ┌─────────────────────────────────────────────────────────┐     │
│ │ Tipo: 🤖 AUTOMÁTICO                                     │     │
│ │ Tabela: contahub_periodo                                │     │
│ │ Coluna: vr_couvert                                      │     │
│ │ Fórmula: SUM(vr_couvert)                                │     │
│ │ Destino: desempenho_semanal.couvert_atracoes            │     │
│ └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│ ATRAÇÕES/EVENTOS (Custo):                                        │
│ ┌─────────────────────────────────────────────────────────┐     │
│ │ Tipo: 🤖 AUTOMÁTICO                                     │     │
│ │ Tabela: nibo_agendamentos                               │     │
│ │ Filtros: tipo = 'despesa', deletado = false             │     │
│ │                                                         │     │
│ │ CATEGORIAS POR BAR:                                     │     │
│ │ ┌───────────────────┬───────────────────┐               │     │
│ │ │ ORDINÁRIO         │ DEBOCHE           │               │     │
│ │ ├───────────────────┼───────────────────┤               │     │
│ │ │ 'Atrações         │ 'Atrações/Eventos'│               │     │
│ │ │  Programação',    │                   │               │     │
│ │ │ 'Produção Eventos'│                   │               │     │
│ │ └───────────────────┴───────────────────┘               │     │
│ └─────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### Cancelamentos

```
┌─────────────────────────────────────────────────────────────────┐
│ CANCELAMENTOS                                                    │
├──────────────┬──────────────────────────────────────────────────┤
│ Tipo         │ 🤖 AUTOMÁTICO                                    │
│ Tabela       │ contahub_cancelamentos                           │
│ Coluna       │ custototal                                       │
│ Fórmula      │ SUM(custototal)                                  │
│ Cronjob      │ Alimentado pelo contahub-sync-7h-ambos           │
│ Destino      │ desempenho_semanal.cancelamentos                 │
├──────────────┴──────────────────────────────────────────────────┤
│ ORDINÁRIO    │ ✅ Igual                                         │
│ DEBOCHE      │ ✅ Igual                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

# 📋 PÁGINA: PLANEJAMENTO COMERCIAL

## Pipeline de Dados

```
GetIn (API) ──► getin_reservas ──► eventos_base (via sync_mesas_getin_to_eventos)
                     │
ContaHub ────────────┘
                     │
NIBO ────────────────┘
                     │
                     ▼
              eventos_base
                     │
                     ▼
         PlanejamentoClient.tsx
```

---

## 🗓️ RESERVAS

```
┌─────────────────────────────────────────────────────────────────┐
│ RESERVAS (TOTAL / PRESENTES)                                     │
├──────────────┬──────────────────────────────────────────────────┤
│              │        ORDINÁRIO           │      DEBOCHE        │
├──────────────┼────────────────────────────┼─────────────────────┤
│ Tipo         │ 🤖 AUTOMÁTICO              │ ✋ MANUAL (modal)   │
│ Fonte        │ GetIn API                  │ ❌ Sem API          │
│ Cronjob      │ getin-sync-continuo        │ —                   │
│              │ (a cada 2h)                │                     │
│ Tabela       │ getin_reservas →           │ eventos_base        │
│              │ eventos_base               │ (input direto)      │
│ Colunas      │ res_tot, res_p             │ res_tot, res_p      │
│              │ num_mesas_tot,             │                     │
│              │ num_mesas_presentes        │                     │
│ Editável     │ ✅ Modal apenas            │ ✅ Modal apenas     │
│              │                            │ ⚠️ Precisa inline   │
├──────────────┴────────────────────────────┴─────────────────────┤
│ Arquivo: PlanejamentoClient.tsx                                  │
│ Edição: Via modal (modoEdicao = true)                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📌 COLUNAS FIXAS (STICKY)

```
┌─────────────────────────────────────────────────────────────────┐
│ COLUNAS CONGELADAS ATUALMENTE                                    │
├──────────────┬──────────────────────────────────────────────────┤
│ Coluna       │ CSS Position      │ Status                       │
├──────────────┼───────────────────┼──────────────────────────────┤
│ Data         │ sticky left-0     │ ✅ Congelada                 │
│ Dia          │ sticky left-48px  │ ✅ Congelada                 │
│ Artista      │ sticky left-86px  │ ✅ Congelada                 │
│ Receita Real │ —                 │ ⚠️ PRECISA CONGELAR          │
│ Meta M1      │ —                 │ ⚠️ PRECISA CONGELAR          │
└──────────────┴───────────────────┴──────────────────────────────┘
```

---

# 📜 STORED PROCEDURES - REFERÊNCIA RÁPIDA

| Procedure | Descrição | Usada em |
|-----------|-----------|----------|
| `calcular_atrasos_tempo` | Conta atrasos por threshold | recalcular-desempenho-auto |
| `calcular_tempo_saida` | Média tempo bar/cozinha | recalcular-desempenho-auto |
| `calcular_mix_vendas` | % por categoria | recalcular-desempenho-auto |
| `calcular_stockout_semanal` | % ruptura estoque | recalcular-desempenho-auto |
| `calcular_metricas_clientes` | % novos clientes | recalcular-desempenho-auto |
| `get_count_base_ativa` | Clientes ativos 90d | recalcular-desempenho-auto |
| `calcular_nps_semanal_por_pesquisa` | NPS por pesquisa | recalcular-desempenho-auto |
| `get_google_reviews_stars_by_date` | Reviews por data | recalcular-desempenho-auto |
| `sync_mesas_getin_to_eventos` | GetIn → eventos_base | getin-sync-continuous |
| `update_eventos_base_from_contahub` | ContaHub → eventos | contahub-update-eventos |

---

# ⏰ CRONJOBS - HORÁRIOS (UTC → BRT)

| Cronjob | Horário UTC | Horário BRT | Descrição |
|---------|-------------|-------------|-----------|
| google-sheets-sync-diario | 08:00 | 05:00 | NPS, Voz Cliente |
| relatorio_matinal_discord | 08:00 | 05:00 | Relatório manhã |
| sympla-sync-semanal | 08:00 Seg | 05:00 Seg | Sympla/Yuzer |
| alertas-proativos-manha | 09:00 | 06:00 | Alertas Discord |
| agente-analise-diaria | 09:00 | 06:00 | Análise IA |
| contahub-sync-7h-ambos | 10:00 | 07:00 | ContaHub principal |
| sync-eventos-diario | 10:30 | 07:30 | Eventos consolidados |
| contahub-update-eventos-ambos | 11:00 | 08:00 | Update eventos_base |
| google-reviews-daily-sync | 11:00 | 08:00 | Google Reviews |
| nibo-sync-08h-ambos | 11:00 | 08:00 | NIBO 1ª rodada |
| sync-contagem-ordinario | 11:30 | 08:30 | Contagem estoque |
| sync-contagem-deboche | 11:35 | 08:35 | Contagem estoque |
| desempenho-auto-diario | 12:00 | 09:00 | **DESEMPENHO SEMANAL** |
| cmv-semanal-auto-diario | 12:00 | 09:00 | CMV Semanal |
| getin-sync-continuo | */2h | */2h | GetIn reservas |
| alertas-proativos-tarde | 15:00 | 12:00 | Alertas Discord |
| nibo-sync-19h-ambos | 22:00 | 19:00 | NIBO 2ª rodada |
| stockout-sync-diario | 22:00 | 19:00 | Stockout (ambos) |

---

# 📁 ARQUIVOS RELEVANTES

```
BACKEND (Edge Functions):
├── recalcular-desempenho-auto/index.ts  ◄── Cálculo desempenho semanal
├── contahub-sync-automatico/index.ts    ◄── Sync ContaHub
├── contahub-processor/index.ts          ◄── Processa dados ContaHub
├── getin-sync-continuous/index.ts       ◄── Sync GetIn (reservas)
├── nibo-sync/index.ts                   ◄── Sync NIBO (custos)
├── google-reviews-apify-sync/index.ts   ◄── Sync Google Reviews
└── google-sheets-sync/index.ts          ◄── Sync NPS/Falaê

FRONTEND:
├── desempenho/components/DesempenhoClient.tsx    ◄── Config indicadores
├── planejamento-comercial/components/PlanejamentoClient.tsx
└── api/estrategico/desempenho/mensal/route.ts    ◄── Agregação mensal

DATABASE (Stored Procedures):
├── calcular_atrasos_tempo
├── calcular_tempo_saida
├── calcular_mix_vendas
├── calcular_stockout_semanal
├── calcular_metricas_clientes
├── get_count_base_ativa
├── calcular_nps_semanal_por_pesquisa
└── get_google_reviews_stars_by_date
```

---

# 📊 LEGENDA

| Símbolo | Significado |
|---------|-------------|
| 🤖 | Automático (calculado por sistema) |
| ✋ | Manual (input do usuário) |
| SP | Stored Procedure |
| ✅ | Habilitado/Igual |
| ❌ | Desabilitado/Oculto |
| ⚠️ | Problema/Atenção necessária |
