# Database — SQL Source of Truth

Este diretório contém TODAS as SQL functions, views e triggers de produção.

## Estrutura

```
database/
├── functions/      # 120 SQL functions
├── views/          # 30 views
├── triggers/       # Triggers de tabelas
├── migrations/     # Migrations aplicadas
└── _archived/      # Código removido (referência)
```

## Convenções

### Naming

- **snake_case** para todos os identificadores
- Prefixo por domínio/função:
  - `adapter_` — converte staging → domínio (ex: `adapter_contahub_to_vendas_item`)
  - `calcular_` — cálculos de métricas (ex: `calcular_mix_vendas`)
  - `get_` — consultas/getters (ex: `get_metas_dia`)
  - `process_` — processamento de dados (ex: `process_analitico_data`)
  - `sync_` — sincronização (ex: `sync_mesas_getin_to_eventos`)
  - `verificar_` — validações/health checks (ex: `verificar_saude_crons`)
  - `admin_` — funções administrativas (ex: `admin_get_api_credentials`)

### Adapters

Formato: `adapter_<fonte>_to_<dominio>(bar_id, data)`

```sql
-- Exemplo
SELECT * FROM adapter_contahub_to_vendas_item(3, '2026-03-20');
```

Adapters existentes:
- `adapter_contahub_to_vendas_item`
- `adapter_contahub_to_visitas`
- `adapter_contahub_to_tempos_producao`
- `adapter_contahub_to_faturamento_hora`
- `adapter_contahub_to_faturamento_pagamentos`

### Config

Sempre ler de tabelas de configuração:

```sql
-- Regras de negócio
SELECT * FROM bar_regras_negocio WHERE bar_id = $1;

-- Categorias de custo NIBO
SELECT * FROM bar_categorias_custo WHERE bar_id = $1;

-- Metas por dia
SELECT * FROM bar_metas_periodo WHERE bar_id = $1 AND dia_semana = $2;

-- Mapeamento de locais
SELECT * FROM bar_local_mapeamento WHERE bar_id = $1;
```

### Regras

```
⛔ NUNCA hardcodar bar_id
⛔ NUNCA usar fallbacks — config ausente = erro explícito
⛔ NUNCA ler contahub_* em código de negócio
✅ Sempre usar tabelas de domínio
✅ Sempre parametrizar por bar_id
```

## Functions por Categoria

### Adapters (staging → domínio)
- `adapter_contahub_to_vendas_item`
- `adapter_contahub_to_visitas`
- `adapter_contahub_to_tempos_producao`
- `adapter_contahub_to_faturamento_hora`
- `adapter_contahub_to_faturamento_pagamentos`

### Cálculos
- `calculate_evento_metrics` — métricas de eventos
- `calculate_ticket_medio` — ticket médio
- `calcular_mix_vendas` — mix de vendas
- `calcular_atrasos_tempo` — atrasos de tempo
- `calcular_tempo_saida` — tempo de saída
- `calcular_nps_semanal_por_pesquisa` — NPS
- `calcular_stockout_semanal` — stockout

### Getters
- `get_metas_dia` — metas por dia
- `get_semana_atual` — semana atual
- `get_categorias_custo` — categorias NIBO
- `get_cmv_fator_consumo` — fator CMV
- `get_user_bar_id` — bar do usuário

### Triggers
- `fill_semana_on_insert` — preenche semana
- `map_categoria_mix` — mapeia categoria mix
- `map_categoria_tempo` — mapeia categoria tempo
- `sync_mesas_getin_to_eventos` — sync GetIn → eventos

### Health Checks
- `verificar_saude_crons` — saúde dos crons
- `verificar_saude_pipeline_d1_alerta_discord` — pipeline D-1
- `verificar_saude_desempenho_v2_alerta_discord` — desempenho v2

## Views Principais

| View | Descrição |
|------|-----------|
| `view_eventos` | Eventos com métricas calculadas |
| `view_visao_geral_anual` | Visão geral anual |
| `view_visao_geral_trimestral` | Visão geral trimestral |
| `view_dre` | DRE |
| `view_top_produtos` | Top produtos |
| `nps_agregado_semanal` | NPS agregado |
| `contahub_stockout_filtrado` | Stockout filtrado |

## Documentação Adicional

- `CONVENTIONS.md` — convenções detalhadas
- `DOMAIN_MAP.md` — mapeamento de domínios
- `SGB_MASTER_BLUEPRINT.md` — arquitetura completa (raiz)