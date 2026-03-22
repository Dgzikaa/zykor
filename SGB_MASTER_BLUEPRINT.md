# SGB / Zykor — MASTER BLUEPRINT

Data: 2026-03-20
Versão: 3.0 FINAL

---

## STATUS: MIGRAÇÃO COMPLETA

```
✅ ContaHub 100% desacoplado (5 tabelas de domínio)
✅ Zero hardcodes de bar_id em SQL functions e edge functions
✅ Zero fallbacks hardcoded no frontend
✅ Multi-bar validado (teste bar_id=5 passou 9/9)
✅ SQL Source of Truth: gap 0 (banco = repositório)
✅ 20/20 edge functions com heartbeat
✅ 26 edge functions ativas (lixo removido)
✅ 31 API routes mortas deletadas
✅ 5 libs mortas deletadas (80KB)
✅ 10 tabelas lixo dropadas
✅ Pipeline surveys/NPS restaurado e observável
✅ nps_reservas saneada (7.519 duplicatas removidas)
✅ Projeto limpo (pastas lixo, duplicatas, debug removidos)
```

**Para adicionar um 3º bar: 6 INSERTs em tabelas de config. Zero código.**

---

## ARQUITETURA

```
FONTES EXTERNAS
  ContaHub │ POS X │ NIBO │ GetIn │ Google Sheets

━━━━ INGESTION ━━━━
  contahub-sync-automatico → contahub_raw_data → process_*

━━━━ NORMALIZATION (staging → domínio) ━━━━
  contahub_analitico   → adapter → vendas_item          (~800K linhas)
  contahub_periodo     → adapter → visitas               (~213K linhas)
  contahub_tempo       → adapter → tempos_producao       (~603K linhas)
  contahub_fatporhora  → adapter → faturamento_hora      (~7.7K linhas)
  contahub_pagamentos  → adapter → faturamento_pagamentos (~217K linhas)
  contahub_stockout    → view contahub_stockout_filtrado  (staging direto)

━━━━ DOMAIN ━━━━
  vendas_item, visitas, tempos_producao, faturamento_hora, faturamento_pagamentos
  eventos_base, desempenho_semanal, cmv_semanal

━━━━ CONFIG ━━━━
  bar_regras_negocio     (fator CMV, ano início, tempo_metrica, inclui_sympla_yuzer)
  bar_categorias_custo   (categorias NIBO por bar)
  bar_metas_periodo      (metas M1/TE/TB por dia)
  bar_local_mapeamento   (locais POS → categorias)
  bares_config           (dias operação, horários)
  api_credentials        (credenciais + ROW_MAP em JSONB)
```

---

## REGRA FUNDAMENTAL

```
NUNCA misturar financeiro (pagamentos) com comanda (visitas) com vendas (itens).
NUNCA ler contahub_* diretamente em código de negócio (usar tabelas de domínio).
NUNCA hardcodar bar_id (usar tabelas de config).
NUNCA usar fallbacks — se config ausente, é erro explícito.
```

---

## MAPEAMENTO DE COLUNAS

**contahub_analitico → vendas_item:**
```
valorfinal → valor | trn_dtgerencial → data_venda | tipo → tipo_transacao
grp_desc → grupo_desc | prd_desc → produto_desc | qtd → quantidade
loc_desc → local_desc | categoria_mix → categoria_mix
```

**contahub_periodo → visitas:**
```
dt_gerencial → data_visita | cli_nome → cliente_nome | cli_fone → cliente_fone
vr_pagamentos → valor_pagamentos | vr_couvert → valor_couvert
vr_produtos → valor_produtos | vr_desconto → valor_desconto
liquido → valor_consumo | motivo → motivo_desconto
```

**contahub_tempo → tempos_producao:**
```
data → data_producao | prd_desc → produto_desc | loc_desc → local_desc
t0_t2, t0_t3, categoria → mesmos nomes
```

**contahub_fatporhora → faturamento_hora:**
```
vd_dtgerencial → data_venda | hora → hora | valor → valor | qtd → quantidade
```

**contahub_pagamentos → faturamento_pagamentos:**
```
dt_gerencial → data_pagamento | liquido → valor_liquido | valor → valor_bruto
meio → meio | taxa → taxa | cliente → cliente_nome | mesa → mesa_desc
```

---

## PIPELINE DIÁRIO (BRT)

```
05:00  google-sheets-sync      → nps, voz_cliente, pesquisa_felicidade, nps_reservas
07:00  contahub-sync-7h-ambos  → contahub_raw_data
08:00  contahub-update-eventos → process_* → staging → domain tables → eventos_base
08:00  nibo-sync-08h           → nibo_agendamentos
08:30  sync-contagem           → contagem_estoque_insumos
08:30  auto-recalculo-eventos  → calculate_evento_metrics
09:00  alertas + agente        → Discord + AI
09:00  desempenho-v2-diario    → desempenho_semanal
09:00  cmv-semanal-auto        → cmv_semanal
09:30  sync-cmv-sheets         → cmv_semanal (planilha)
```

---

## EDGE FUNCTIONS (26 ativas)

**Dispatchers:** agente, alertas, integracao, sync, discord, webhook
**Sync:** contahub-sync-automatico, google-sheets-sync, nibo-sync, getin-sync-continuous, umbler-sync-incremental, google-reviews-apify-sync, sync-contagem-sheets, sync-cmv-sheets, sync-cmv-mensal, sync-cmo-planilha, contahub-stockout-sync
**Processamento:** recalcular-desempenho-v2, cmv-semanal-auto
**Ferramentas:** relatorio-pdf, monitor-concorrencia, atualizar-fichas-tecnicas, api-clientes-externa, contahub-sync (legado mantido)
**Auth/Webhook:** login, inter-auth, inter-webhook-config, inter-pix-webhook, google-reviews-auth, google-reviews-callback, umbler-send
**Infra:** cron-watchdog, checklist-auto-scheduler

---

## CONFIG POR BAR

**bar_regras_negocio:**
| bar_id | cmv_fator_consumo | ano_inicio | tempo_metrica_bar | inclui_sympla_yuzer |
|---|---|---|---|---|
| 3 | 0.35 | 2025 | t0_t3 | true |
| 4 | 0.35 | 2024 | t0_t2 | false |

**bar_categorias_custo:** 11 linhas (cmv_comida/bebida/drink/atracao/alimentacao × 2 bares)
**bar_metas_periodo:** 14 linhas (7 dias × 2 bares)
**bar_local_mapeamento:** 8 linhas (bebidas/drinks/comidas/excluidos × 2 bares)

---

## WORKFLOW

```
Claude → analisa, audita, desenha, entrega prompts prontos
Cursor → executa (1 prompt por chat novo, até 3 em paralelo)
Claude → valida resultado via SQL, entrega próximo prompt
```

Blueprint: C:\Projects\zykor\SGB_MASTER_BLUEPRINT.md
