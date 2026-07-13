---
title: Monitoramento
area: configuracoes
slug: monitoramento
route: /configuracoes/monitoramento
description: Painel técnico de saúde do sistema — banco de dados, cron jobs, pipeline de dados por bar e alertas — para acompanhar em tempo real se tudo está rodando.
order: 60
icon: Activity
---

# Monitoramento

## Visão geral

O **Monitoramento** é o "painel de instrumentos" do Zykor. Numa única tela ele mostra se o sistema está saudável: se o **banco de dados** responde bem, se as **rotinas automáticas (cron jobs)** estão rodando e concluindo com sucesso, se o **pipeline de dados** de cada bar está atualizado (desempenho, planejamento, CMV, estoque/stockout) e quantos **alertas** foram disparados nos últimos dias.

É uma tela **técnica e operacional**, voltada para quem cuida da infraestrutura e da qualidade dos dados (equipe de dados / TI / gestor responsável). O objetivo é responder rápido a perguntas como: "os números do dashboard estão atualizados?", "a última sincronização com o ContaHub e o Conta Azul aconteceu?", "algum job de madrugada falhou?", "faltou processar algum dia de estoque?".

Diferente da maioria das telas do sistema, o Monitoramento **não é filtrado por um único bar**: ele mostra a saúde global do sistema e, na aba Pipeline, quebra o status **por bar** (Ordinário e Deboche). A tela se **atualiza sozinha a cada 30 segundos** e também tem um botão **Atualizar** para forçar a leitura na hora.

## Como acessar

No menu lateral: **Configurações → Monitoramento** (ícone de atividade / pulso).

- **Permissão necessária:** módulo `configuracoes`. Quem não tem acesso a Configurações não enxerga o item no menu nem abre a rota.
- A tela **não depende do seletor de bar**: os cartões do topo e as abas de Health/Cron mostram o estado geral do sistema; a aba **Pipeline** lista todos os bares ativos lado a lado.

## Passo a passo

### Checar a saúde geral do sistema
1. Abra **Configurações → Monitoramento**.
2. Olhe primeiro a faixa de **4 cartões no topo**: Status Geral, Banco de Dados, Eventos Ativos e Alertas Abertos.
3. Se o **Status Geral** estiver verde (✓ OK), o essencial está funcionando. Amarelo (⚠ Aviso) indica degradação (ex.: muitas falhas de cron); vermelho (✕ Erro) indica que algum componente crítico caiu.

### Ver o detalhe de cada componente
1. Fique na aba **Health Checks** (é a aba aberta por padrão).
2. Leia os quadros de **Status dos Componentes** (banco, cron jobs, edge functions, uso de disco) — cada um traz uma mensagem curta com o status.
3. Logo abaixo, em **Últimas Sincronizações**, confira há quanto tempo o Conta Azul e o ContaHub foram sincronizados pela última vez.

### Conferir se os dados dos dashboards estão atualizados (por bar)
1. Clique na aba **Pipeline**.
2. Na tabela **Pipeline Gold por Bar**, cada linha é um bar e cada coluna é uma tabela de resultado (Desempenho Semanal/Mensal, Planejamento, CMV etc.).
3. Ícone **verde** = atualizado nas últimas 24h; **amarelo** = existe dado mas está velho (mais de 24h); **vermelho** = nunca calculado.
4. Abaixo, veja **Stockout Gap** para saber se algum dia de estoque ficou sem processar e o resumo de **Alertas Discord**.

### Investigar rotinas automáticas
1. Clique na aba **Cron Jobs** para ver a lista de rotinas agendadas (nome, horário e se está ativa).
2. Clique na aba **Execuções Recentes** para ver as últimas 50 execuções das últimas 24h, com status, horário de início/fim e a mensagem retornada.

### Forçar atualização
1. A tela recarrega sozinha a cada 30 segundos.
2. Para ler o estado agora, clique no botão **Atualizar** no canto superior direito.
3. Para sair, use **Voltar** (retorna para Configurações).

## Abas e seções

A tela tem **4 cartões de resumo** no topo e **4 abas**:

- **Cartões do topo (sempre visíveis):** Status Geral, Banco de Dados, Eventos Ativos, Alertas Abertos.
- **Health Checks:** status de cada componente do sistema + últimas sincronizações das integrações.
- **Pipeline:** três blocos — Pipeline Gold por Bar, Stockout Gap e Alertas Discord.
- **Cron Jobs:** lista das rotinas agendadas atualmente ativas.
- **Execuções Recentes:** histórico das últimas execuções das rotinas (24h).

## Colunas e cálculos

### Cartões do topo

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Status Geral | Selo OK / Aviso / Erro do sistema como um todo | Se algum check estiver em `error` → **Erro (unhealthy)**; se algum estiver em `warning` → **Aviso (degraded)**; senão **OK (healthy)**. Considera os checks de banco e cron. | `/api/health` |
| Latência (Status Geral) | Tempo total que a verificação de saúde levou | Milissegundos entre início e fim da chamada `/api/health` | `/api/health` (`response_time_ms`) |
| Banco de Dados (MB) | Tamanho aproximado do banco | Valor `db_size_mb` do snapshot de métricas | RPC `health_metrics_snapshot` |
| Latência (Banco) | Tempo de resposta do banco | Mede o tempo de um `SELECT` simples em `operations.bares`; acima de 2000ms vira aviso | `/api/health` (check database) |
| Eventos Ativos | Total de eventos cadastrados | `total_eventos` do snapshot | RPC `health_metrics_snapshot` |
| Últimos 7 dias (Eventos) | Eventos nos últimos 7 dias | `eventos_7_dias` do snapshot | RPC `health_metrics_snapshot` |
| Alertas Abertos | Quantidade de alertas em aberto | `alertas_abertos` do snapshot | RPC `health_metrics_snapshot` |
| Uptime | Há quanto tempo o processo da aplicação está no ar | Tempo desde o start do módulo da rota, em horas e minutos | `/api/health` (`uptime`) |

### Aba Health Checks — Status dos Componentes

| Componente | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Database | Se o banco responde | `SELECT id` em `operations.bares` (limit 1). OK se sem erro e latência ≤ 2000ms; Aviso se latência alta; Erro se falhar | `/api/health` → `operations.bares` |
| Cron jobs | Saúde das rotinas nas últimas 24h | Compara falhas vs. sucessos: se falhas > 20% dos sucessos → Aviso; senão OK. Mensagem traz nº de execuções bem-sucedidas e falhas | RPC `health_cron_stats_24h` |
| Edge functions | Status das funções de borda | **Fixo** como "OK / Edge Functions operacionais" (não há sonda ativa hoje) | `/api/health` (valor estático) |
| Disk usage | Uso de disco | **Fixo** como "OK / Uso de disco normal" (não há medição real hoje) | `/api/health` (valor estático) |

### Aba Health Checks — Últimas Sincronizações

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Conta Azul | Há quanto tempo foi a última sincronização | Texto relativo (ex.: "há 2 horas") sobre `ultima_sync_contaazul`; "Nunca" se vazio | RPC `health_metrics_snapshot` |
| ContaHub | Há quanto tempo foi a última sincronização | Texto relativo sobre `ultima_sync_contahub`; "Nunca" se vazio | RPC `health_metrics_snapshot` |

### Aba Pipeline — Pipeline Gold por Bar

Uma linha por bar ativo. Cada célula mostra um ícone de frescor + o tempo relativo da última atualização. **Regra do ícone:** verde (✓) se a data for de menos de 24h; amarelo (⚠) se houver data mas com mais de 24h; vermelho (✕) se nunca houver sido calculado.

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Bar | Nome do bar | Nome do bar ativo | `operations.bares` (ativo = true) |
| Desempenho Semanal | Última vez que o desempenho semanal foi calculado | `MAX(calculado_em)` para granularidade `semanal` | `gold.desempenho` |
| Desempenho Mensal | Última vez que o desempenho mensal foi calculado | `MAX(calculado_em)` para granularidade `mensal` | `gold.desempenho` |
| Planejamento | Última vez que o planejamento foi calculado | `MAX(calculado_em)` | `gold.planejamento` |
| CMV (gold) | Última vez que o CMV (camada gold) foi calculado | `MAX(calculado_em)` | `gold.cmv` |
| CMV Semanal (financial) | Última atualização do CMV semanal financeiro | `MAX(updated_at)` | `financial.cmv_semanal` |
| CMV Mensal (financial) | Última atualização do CMV mensal financeiro | `MAX(updated_at)` | `financial.cmv_mensal` |

> Observação: a RPC também calcula `planejamento_ultima_data` (`MAX(data_evento)` de `gold.planejamento`) e `desempenho_ultima_semana` (`MAX(data_inicio)` de `gold.desempenho` semanal). Esses campos vêm no dado, mas não aparecem como colunas próprias na tabela atual.

### Aba Pipeline — Stockout Gap (últimos 7 dias)

Um cartão por bar. Mostra dias com estoque na camada bronze mas ainda **não processados** na silver.

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Selo Gap / OK | Se há dias faltando na silver | Tem gap quando existe pelo menos uma data que está no bronze e **não** está no silver | Bronze vs. Silver de stockout |
| Bronze (dias) | Nº de dias com dado bronze nos últimos 7 dias | Contagem de dias distintos com registro bronze | `bronze.bronze_contahub_operacional_stockout_raw` |
| Silver (dias) | Nº de dias com dado silver nos últimos 7 dias | Contagem de dias distintos com registro silver | `silver.silver_contahub_operacional_stockout_processado` |
| Faltando silver | Lista das datas com gap | Datas do bronze **exceto** as do silver, por bar | diferença bronze − silver |

### Aba Pipeline — Alertas Discord (últimos 7 dias)

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Erros abertos | Alertas do tipo erro ainda não resolvidos | Contagem de `tipo = 'erro'` e não resolvido | `system.alertas_enviados` |
| Avisos abertos | Alertas do tipo aviso ainda não resolvidos | Contagem de `tipo = 'aviso'` e não resolvido | `system.alertas_enviados` |
| Pendentes (24h) | Alertas não resolvidos das últimas 24h | Contagem de não resolvidos criados nas últimas 24h | `system.alertas_enviados` |
| Disparados hoje | Alertas criados hoje | Contagem de alertas com data de criação a partir de hoje | `system.alertas_enviados` |

> Todas essas contagens consideram apenas alertas criados nos **últimos 7 dias**.

### Aba Cron Jobs

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| ID | Identificador do job | `jobid` | `cron.job` |
| Nome | Nome da rotina | `jobname` | `cron.job` |
| Schedule | Agendamento (formato cron) | `schedule` (ex.: `0 12 * * *`) | `cron.job` |
| Status | Ativo / Inativo | Só lista jobs com `active = true` (todos aparecem como Ativo) | `cron.job` |

### Aba Execuções Recentes

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Job | Nome da rotina executada | `jobname` (ou `Job {id}` se sem nome) | `cron.job_run_details` + `cron.job` |
| Status | Resultado da execução | Selo por `status`: succeeded → OK, failed → Erro, demais → texto cru | `cron.job_run_details` |
| Início | Quando começou | `start_time` formatado dd/MM HH:mm:ss | `cron.job_run_details` |
| Fim | Quando terminou | `end_time` formatado dd/MM HH:mm:ss | `cron.job_run_details` |
| Mensagem | Retorno da execução | Primeiros 200 caracteres de `return_message` | `cron.job_run_details` |

## Filtros e opções

Esta tela tem **poucos filtros** — ela mostra o estado atual do sistema, não um recorte de período escolhido pelo usuário:

- **Atualizar:** relê todas as fontes na hora. Também há auto-refresh automático a cada 30 segundos.
- **Voltar:** retorna para a tela de Configurações.
- **Abas:** trocam a visão entre Health Checks, Pipeline, Cron Jobs e Execuções Recentes.
- **Janelas de tempo fixas (embutidas, não configuráveis):** Execuções Recentes usa as últimas **24h** (até 50 registros); Stockout Gap e Alertas usam os últimos **7 dias**; o frescor das tabelas gold usa o corte de **24h**; sincronizações mostram o tempo desde a última ocorrência.

## Regras e detalhes importantes

- **Não é por bar (exceto Pipeline):** os cartões do topo e as abas Health/Cron refletem o sistema inteiro. Só a aba **Pipeline** separa por bar, listando os bares **ativos** (`operations.bares` com `ativo = true`).
- **Frescor de 24h:** na tabela Pipeline Gold, a régua de cores é fixa em 24 horas — coerente com o cron que recalcula as tabelas gold uma vez por dia (12h BRT). Amarelo não significa erro necessariamente; pode ser só o horário antes da rodada do dia.
- **Componentes fixos:** os checks de **Edge Functions** e **Uso de Disco** hoje retornam "OK" fixo — são placeholders e não representam uma medição real. Não use esses dois como garantia; confie nos checks de banco e cron.
- **Status HTTP do health:** internamente, quando o sistema está `unhealthy` a rota de saúde responde com código 503 (útil para monitores externos); a tela em si sempre renderiza os cartões.
- **Stockout é snapshot:** o gap compara o que foi capturado (bronze) com o que foi processado (silver). Um dia listado como "faltando silver" indica que o auto-heal D-1 não pegou aquele dia — vale investigar, não backfillar manualmente.
- **Alertas resolvidos somem das contagens de "abertos":** as métricas de erros/avisos abertos só contam o que ainda **não foi resolvido**.
- **Leitura administrativa:** as rotinas de cron são lidas via consulta administrativa às tabelas internas `cron.job` e `cron.job_run_details` (extensão pg_cron do Postgres).

## Dúvidas frequentes

**Por que uma coluna do Pipeline aparece amarela de manhã?**
Porque as tabelas gold são recalculadas uma vez por dia (por volta das 12h BRT). Antes da rodada do dia, a última atualização tem mais de 24h e o ícone fica amarelo. Depois da rodada, volta ao verde.

**A tela mostra dados de qual bar?**
Os cartões do topo e as abas Health/Cron são do sistema todo. A aba Pipeline mostra cada bar (Ordinário e Deboche) em sua própria linha/cartão.

**O que significa "Última sincronização: Nunca" no Conta Azul ou ContaHub?**
Que o snapshot de métricas não encontrou uma data de sincronização recente para aquela integração. Vale checar se o job de sync rodou (abas Cron Jobs / Execuções Recentes).

**Preciso ficar clicando em Atualizar?**
Não. A tela se atualiza sozinha a cada 30 segundos. O botão Atualizar é só para ver o estado imediatamente.

**Um cron aparece como "failed" nas Execuções Recentes — o que faço?**
Leia a coluna Mensagem (retorno da execução) para entender o erro. Como a tela puxa as últimas 24h, uma falha isolada seguida de sucessos costuma ser transitória; falhas repetidas do mesmo job pedem investigação.

**Edge Functions e Disco aparecem sempre OK — posso confiar?**
Não como diagnóstico real: hoje esses dois são valores fixos. A saúde efetivamente medida é a do banco de dados e a das rotinas de cron.

## Fonte dos dados

**APIs consumidas pela tela:**
- `/api/health` — status geral, checks de banco/cron e métricas dos cartões.
- `/api/monitoramento/cron-jobs` — lista de jobs e execuções recentes.
- `/api/monitoramento/health-dashboard` — dados da aba Pipeline.

**Funções e tabelas de banco:**
- RPC `public.get_health_dashboard()` — monta a aba Pipeline (gold por bar, stockout gap e alertas).
- RPC `health_metrics_snapshot()` — métricas dos cartões (eventos, alertas, tamanho do banco, últimas sincronizações).
- RPC `health_cron_stats_24h()` — resumo de sucessos/falhas de cron nas últimas 24h.
- `gold.desempenho`, `gold.planejamento`, `gold.cmv` — camada gold de resultados.
- `financial.cmv_semanal`, `financial.cmv_mensal` — CMV financeiro.
- `bronze.bronze_contahub_operacional_stockout_raw` e `silver.silver_contahub_operacional_stockout_processado` — comparação de stockout (origem: ContaHub).
- `system.alertas_enviados` — alertas de pipeline (integração de saída: Discord).
- `operations.bares` — bares ativos e sonda de conexão do banco.
- `cron.job` e `cron.job_run_details` — rotinas agendadas e histórico de execuções (extensão pg_cron).

**Integrações de origem citadas na tela:** ContaHub e Conta Azul (sincronizações), Discord (alertas).
