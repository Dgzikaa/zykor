---
title: Painel Supabase
area: configuracoes
slug: painel-supabase
route: /configuracoes/painel
description: Central de saúde da infraestrutura Zykor — pipeline de dados, rotinas automáticas (cron) e KPIs do banco Supabase em tempo real.
order: 80
icon: Server
---

# Painel Supabase

## Visão geral

O **Painel Supabase** é a tela de "sala de máquinas" do Zykor. Em vez de falar sobre bar, faturamento ou estoque, ela mostra se a **infraestrutura que sustenta o sistema está saudável agora**: se as integrações estão puxando dados, se as rotinas automáticas rodaram, e se o banco de dados tem folga de conexões, memória e disco.

É a tela que você abre quando desconfia que "um número parou de atualizar" ou que "a integração travou". Ela agrupa três blocos:

1. **Saúde do pipeline de dados** — cada job de importação/processamento (edge functions com "batimento cardíaco") com status, última execução e erro, se houver.
2. **Rotinas automáticas (cron)** — os agendamentos do banco (pg_cron), mostrando a última execução de cada um.
3. **KPIs de infraestrutura** — conexões, cache do banco, tamanho do banco, carga da máquina, memória e disco, lidos ao vivo do Metrics API da Supabase.

No rodapé há um atalho para o **Grafana Cloud**, onde ficam o histórico completo e os alertas (o painel nativo mostra só o "estado agora").

Quem usa: o **administrador técnico / dono do sistema**. Não é uma tela operacional do dia a dia do bar — é diagnóstico de plataforma.

## Como acessar

Menu lateral: **Configurações → Painel** (rota `/configuracoes/painel`).

**Permissão:** os dois blocos de operações (pipeline e cron) são **exclusivos de administrador**. As APIs `/api/configuracoes/painel/pipeline` e `/api/configuracoes/painel/crons` exigem `role = admin` e devolvem "Apenas admin" (403) para qualquer outro usuário. O bloco de KPIs de infraestrutura exige apenas usuário autenticado, mas depende de credenciais de ambiente estarem configuradas (veja "Regras e detalhes importantes").

## Passo a passo

### Verificar se está tudo saudável (rotina de checagem)

1. Abra **Configurações → Painel**.
2. Olhe primeiro o card **Saúde do pipeline de dados**. Se aparecer "Tudo rodando normalmente ✓", nenhum job está com problema. Caso contrário, a lista mostra só os jobs em atenção (amarelo) ou erro (vermelho).
3. Olhe o card **Rotinas automáticas (cron)**. "Todas as rotinas rodaram com sucesso ✓" significa que nenhuma rotina ativa falhou na última execução.
4. Confira os **KPIs de infraestrutura** (conexões, cache, memória, disco). Verde é saudável; amarelo pede atenção; vermelho é crítico.

### Investigar um job de pipeline com problema

1. No card **Saúde do pipeline de dados**, os jobs vêm ordenados por gravidade (vermelho primeiro, depois amarelo, depois verde).
2. Cada linha mostra o nome do job, o `bar_id` (quando específico de um bar), a camada (bronze/silver/gold), a idade da última execução e, em vermelho, a mensagem de erro.
3. Clique em **"Ver todos os N jobs"** para incluir também os que estão OK (verde). Clique de novo em "Mostrar só o que precisa de atenção" para voltar a filtrar.

### Investigar uma rotina automática (cron) que falhou

1. No card **Rotinas automáticas (cron)**, por padrão aparecem só as rotinas ativas com problema (última execução diferente de "sucesso").
2. Cada linha mostra o nome da rotina, o agendamento (formato cron, ex.: `0 9 * * *`) e há quanto tempo rodou pela última vez.
3. Clique em **"Ver todas as N rotinas"** para listar todas as rotinas ativas, inclusive as que rodaram com sucesso.

### Atualizar os dados manualmente

- Clique no botão **Atualizar** (canto superior direito) para forçar uma nova leitura dos KPIs de infraestrutura. Ao lado dele aparece o horário da última leitura.
- Os cards se atualizam sozinhos: KPIs de infraestrutura a cada 1 minuto, pipeline a cada 1 minuto e cron a cada 2 minutos.

### Ver histórico e alertas

1. No card **Histórico & Alertas (Grafana Cloud)**, clique em **"Abrir dashboard no Grafana"**.
2. O dashboard abre em uma nova aba (o Grafana não permite ser embutido dentro do Zykor por segurança). Lá ficam os gráficos ao longo do tempo e as regras de alerta.

## Abas e seções

A tela é uma página única (sem abas), organizada de cima para baixo em quatro blocos:

| Seção | O que traz |
|---|---|
| **Saúde do pipeline de dados** | Lista de jobs (edge functions com heartbeat) com status, idade e erro. Resumo no cabeçalho: X ok / X atenção / X erro. |
| **Rotinas automáticas (cron)** | Lista de agendamentos pg_cron com última execução. Resumo: X ok / X com erro / X inativos. |
| **KPIs de infraestrutura** | Seis cards com conexões, cache, tamanho do banco, carga, memória e disco. |
| **Histórico & Alertas (Grafana Cloud)** | Atalho para o dashboard externo do Grafana. |

## Colunas e cálculos

### Card "Saúde do pipeline de dados"

Cada linha é a **última execução** de um job de dados nos últimos 7 dias (fonte: matview `gold.v_pipeline_health`, alimentada pela tabela `system.cron_heartbeats`).

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Nome do job (`job_name`) | Qual rotina/edge function é | Nome gravado no batimento (heartbeat) do job | `system.cron_heartbeats` |
| `bar_id` | Bar específico do job (quando houver) | Só aparece quando o job é de um bar; jobs globais não mostram | `system.cron_heartbeats.bar_id` |
| Camada | bronze / silver / gold / ops | Mapeamento do job por camada do pipeline | `ops.job_camada_mapping` |
| Idade | Há quanto tempo foi a última execução | `now() - started_at`, exibida em formato curto (dias/horas) | `gold.v_pipeline_health.idade` |
| Mensagem de erro | Texto do erro, se falhou | `error_message` da última execução (só aparece se preenchido) | `system.cron_heartbeats.error_message` |
| Bolinha de status (`health_color`) | Verde / amarelo / vermelho | **Vermelho:** status = `error`, ou status = `running` há mais de 30 min. **Amarelo:** última execução antiga demais para a camada — bronze > 6h, silver > 12h, gold > 24h. **Verde:** status = `success` ou `partial`. **Cinza:** demais casos. | Regra na view `gold.v_pipeline_health` |
| Resumo (cabeçalho) | X ok / X atenção / X erro | Contagem de jobs por cor (verde / amarelo / vermelho) | Agregação no endpoint |

### Card "Rotinas automáticas (cron)"

Cada linha é a **última execução de cada job pg_cron** (fonte: função `system.cron_status()`, que lê `cron.job` + `cron.job_run_details`).

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Rotina (`job`) | Nome do agendamento | `cron.job.jobname` | `cron.job` |
| Agendamento (`schedule`) | Periodicidade em formato cron | `cron.job.schedule` (ex.: `0 9 * * *`) | `cron.job` |
| Há quanto tempo | Quando rodou pela última vez | `now() - start_time` da última execução, exibido como "agora" (< 90s), "há X min", "há X h" ou "há X d" | `cron.job_run_details.start_time` |
| Bolinha de status | Verde ou vermelho | **Problema (vermelho)** quando a rotina está **ativa** e o status da última execução existe e é **diferente de `succeeded`**. Caso contrário, verde. | `cron.job_run_details.status` + `cron.job.active` |
| Resumo (cabeçalho) | X ok / X com erro / X inativos | ok = total − com problema; com erro = ativas com status ≠ `succeeded`; inativos = jobs com `active = false` | Agregação no endpoint |

Observações: por padrão a lista mostra só rotinas ativas com problema; rotinas **inativas** entram na contagem "inativos" mas não aparecem na lista, nem quando você expande "Ver todas". A função também retorna `duracao_s` (duração da última execução em segundos), embora a tela use principalmente o "há quanto tempo".

### Cards de KPI (infraestrutura)

Lidos ao vivo do **Metrics API da Supabase** (formato Prometheus), no endpoint `/customer/v1/privileged/metrics`. Todos refletem o **estado atual**, não uma média.

| Card | O que mostra | Como é calculado | Métrica de origem |
|---|---|---|---|
| **Conexões ativas** | Conexões abertas no banco vs. limite | Soma de `pg_stat_database_num_backends`; limite = `max_connections_connection_count`. Percentual = ativas ÷ limite × 100. Cor: verde < 60%, amarelo 60–80%, vermelho ≥ 80% | `pg_stat_database_num_backends`, `max_connections_connection_count` |
| **Cache hit (banco)** | % de leituras servidas da memória (ideal ≥ 99%) | `blks_hit ÷ (blks_hit + blks_read) × 100`, somando todos os bancos. Cor: verde ≥ 95%, amarelo 90–95%, vermelho < 90% | `pg_stat_database_blks_hit_total`, `pg_stat_database_blks_read_total` |
| **Tamanho do banco** | Espaço ocupado pelos dados | Tamanho do banco `postgres` (ignora `template0`/`template1`). Exibe em GB (ou MB se < 1 GB) | `pg_database_size_bytes` (datname = postgres) |
| **Load average (1m)** | Carga da máquina no último minuto | Valor direto, sem transformação | `node_load1` |
| **Memória usada** | % de RAM em uso | `(1 − memória_disponível ÷ memória_total) × 100`. Cor: verde < 70%, amarelo 70–85%, vermelho ≥ 85% | `node_memory_MemTotal_bytes`, `node_memory_MemAvailable_bytes` |
| **Disco usado** | % de disco em uso (e tamanho total no subtítulo) | `(1 − disco_disponível ÷ disco_total) × 100`. Prioriza o volume `/data` (onde o banco cresce), depois `/`, depois o maior filesystem. Cor: verde < 70%, amarelo 70–85%, vermelho ≥ 85% | `node_filesystem_size_bytes`, `node_filesystem_avail_bytes` |

Rodapé: "N métricas lidas do endpoint" indica quantas linhas de métrica o Metrics API devolveu naquela leitura (útil só para diagnóstico).

## Filtros e opções

O painel não tem filtro por bar nem por período — ele é **global e de tempo real**. As opções disponíveis são:

- **Atualizar** — força nova leitura dos KPIs de infraestrutura.
- **Ver todos os N jobs / Mostrar só o que precisa de atenção** (pipeline) — alterna entre mostrar apenas jobs em atenção/erro e mostrar todos, inclusive os verdes.
- **Ver todas as N rotinas / Mostrar só o que precisa de atenção** (cron) — alterna entre só as rotinas com problema e todas as rotinas ativas.
- **Abrir dashboard no Grafana** — leva ao histórico e alertas em nova aba.

Auto-atualização automática (sem clique): KPIs a cada 60s, pipeline a cada 60s, cron a cada 120s.

## Regras e detalhes importantes

- **Somente admin nos dois cards de operações.** Pipeline e cron exigem `role = admin`. Usuário sem esse papel não vê esses dados (403). Os KPIs de infraestrutura pedem só login válido.
- **Segredos nunca vão ao navegador.** A leitura do Metrics API é feita 100% no servidor, com autenticação Basic montada a partir de `SUPABASE_METRICS_SECRET` ou, na falta dele, da `SUPABASE_SERVICE_ROLE_KEY` que o app já usa. Se nenhuma dessas variáveis estiver disponível, o card de KPIs mostra "Configuração pendente" e o restante da tela continua funcionando.
- **Janela de 7 dias no pipeline.** A saúde do pipeline considera apenas jobs com batimento nos últimos 7 dias. Um job que não roda há mais tempo simplesmente não aparece.
- **Limiares de atraso por camada (amarelo):** bronze fica amarelo após 6h sem rodar, silver após 12h, gold após 24h. Esses tempos refletem a frequência esperada de cada camada do pipeline.
- **"Running" preso = vermelho.** Um job em execução há mais de 30 minutos é tratado como travado (vermelho), não como saudável.
- **Cron: só conta a última execução.** O status vem sempre do último registro em `cron.job_run_details`. Um job que falhou uma vez no meio mas teve sucesso na última execução aparece como OK. Vale lembrar (regra conhecida do sistema): "sucesso em menos de 1s" nem sempre garante que o trabalho foi feito de verdade — use o Grafana para o histórico.
- **Rotinas inativas** entram só na contagem "inativos"; não aparecem na lista.
- **Grafana não é embutido.** Por política de segurança do próprio Grafana (não pode ser exibido dentro de outro site), o histórico abre em nova aba em vez de aparecer dentro do Zykor.
- **Tudo em tempo real, sem cache.** Todas as chamadas usam `no-store`; não há dado congelado nem competência/vencimento envolvidos aqui — é foto do momento.

## Dúvidas frequentes

**Um número do sistema parou de atualizar. Onde olho primeiro?**
No card "Saúde do pipeline de dados". Procure o job da integração correspondente (ContaHub, NIBO, Conta Azul, etc.) em amarelo ou vermelho e leia a mensagem de erro.

**Por que não vejo os cards de pipeline e cron?**
Eles são exclusivos de administrador. Se você não tem papel `admin`, esses blocos não carregam.

**O card de KPIs mostra "Configuração pendente". E agora?**
Falta a variável de ambiente com a credencial do Metrics API (`SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_METRICS_SECRET`) no ambiente atual. É configuração de infraestrutura, feita pela equipe técnica.

**O que significa "cache hit" no banco?**
É o percentual de leituras atendidas direto da memória, sem ir ao disco. Acima de 99% é o ideal; abaixo de 90% indica que o banco está indo muito ao disco (mais lento).

**Cron mostra "há 2 h" mas o agendamento é de hora em hora. Está errado?**
Pode ser sinal de que a rotina não disparou na hora esperada. Confira se a bolinha está vermelha (última execução falhou) e cruze com o Grafana para ver o histórico.

**Qual a diferença entre "pipeline" e "cron" aqui?**
Pipeline = jobs de dados que reportam batimento (edge functions de ingestão/processamento). Cron = os agendamentos do banco (pg_cron) que disparam essas e outras rotinas. Um problema pode aparecer em um sem aparecer no outro.

## Fonte dos dados

- **`gold.v_pipeline_health`** (matview) — saúde do pipeline; alimentada por `system.cron_heartbeats` e mapeada por camada em `ops.job_camada_mapping`.
- **`system.cron_status()`** (função SQL) — status das rotinas pg_cron; lê `cron.job` e `cron.job_run_details`.
- **Metrics API da Supabase** — endpoint `/customer/v1/privileged/metrics` (formato Prometheus), autenticado com a service role key. Origem dos KPIs de conexões, cache, tamanho do banco, load, memória e disco.
- **Grafana Cloud** — dashboard externo com histórico e alertas (mesmo scrape do Metrics API).

Endpoints internos: `/api/configuracoes/supabase-metrics` (KPIs), `/api/configuracoes/painel/pipeline` (saúde do pipeline), `/api/configuracoes/painel/crons` (rotinas cron).
