---
title: Auditoria
area: configuracoes
slug: auditoria
route: /configuracoes/auditoria
description: Trilha completa de quem fez o quê no sistema — criação, edição e exclusão de registros, mais controle de acessos, sessões e estatísticas de uso.
order: 70
icon: Shield
---

# Auditoria

## Visão geral

A tela de **Auditoria** é o "câmera de segurança" do Zykor. Ela registra automaticamente **quem fez o quê** dentro do sistema: cada criação, edição e exclusão de registro fica gravada com o usuário responsável, o horário, a tabela afetada e — no caso de edições — exatamente quais campos mudaram (o valor de antes e o de depois).

Além da trilha de ações, a tela também mostra:

- **Acessos**: sessões de login (quem está online agora, há quanto tempo está logado, quanto desse tempo está de fato navegando, IP e dispositivo) e tentativas de login que deram certo ou erraram.
- **Análise**: um painel de estatísticas de uso — pico de usuários simultâneos, engajamento, telas onde o pessoal passa mais tempo, ações por dia, por hora e por bar, e um resumo por usuário.

Quem usa no dia a dia: **donos e administradores**, para responder perguntas como "quem apagou esse insumo?", "quem alterou o preço da ficha?", "quem mexeu na permissão de fulano?", "meu time está usando o sistema?" e "quem está online agora?".

## Como acessar

No menu lateral: **Configurações → Auditoria** (ícone de escudo).

A tela aparece para quem tem a permissão de módulo **`configuracoes`**. Além disso, as APIs por trás dela exigem que o usuário seja **admin** — os dados de auditoria (`/api/configuracoes/auditoria` e `/api/configuracoes/auditoria/acessos`) só respondem para o papel `admin`. Ou seja, mesmo com o menu visível, apenas administradores conseguem carregar os registros.

## Passo a passo

### Ver o que foi feito e por quem (aba Tudo)

1. Abra **Configurações → Auditoria**. Ela já cai na aba **Tudo**, listando as ações mais recentes (100 por vez, da mais nova para a mais antiga).
2. Use os **Filtros** no topo para restringir: escolha o período (**De / Até**), a **Operação** (criação, edição, exclusão), a **Tabela** afetada, ou digite no campo **Buscar** um e-mail, parte de uma descrição ou o ID de um registro.
3. Clique em **Buscar** (ou pressione Enter no campo de busca) para aplicar.
4. **Clique em qualquer linha** da lista para expandir e ver os detalhes — em edições, aparecem os campos que mudaram (de → para); há também um "ver dados" que abre o JSON completo do antes e do depois.
5. Para carregar mais itens além dos 100 iniciais, use **Carregar mais** no rodapé da lista.

### Filtrar rápido por período e por coluna

1. Acima da lista há atalhos de período: **Hoje**, **7 dias**, **Este mês**, **Tudo**. Eles aplicam o filtro de data direto no servidor.
2. Os cabeçalhos **Usuário, Papel, Operação, Tabela e Bar** têm um funil (ícone de filtro). Clique nele para escolher valores específicos (estilo planilha) — o filtro age **sobre os registros já carregados** na tela.
3. Como o filtro de coluna só enxerga o que está carregado, se quiser filtrar sobre o período inteiro clique em **Carregar todos (N) p/ filtrar** — isso puxa todos os registros do período (em blocos) e pausa o tempo real.

### Exportar para CSV

1. Ajuste os filtros para deixar na tela só o que quer exportar.
2. Clique em **Exportar CSV** (canto direito da barra de filtros). Baixa um arquivo `auditoria_AAAA-MM-DD.csv` com data, usuário, papel, operação, tabela, registro, descrição e bar. **Exporta os registros carregados na tela** (não o banco inteiro).

### Ver o histórico completo de um registro (timeline)

1. Na lista, nas linhas que têm um ID de registro, clique no **ícone de relógio** ao lado da descrição.
2. Abre uma janela com **toda a linha do tempo daquele registro** — todas as vezes que ele foi criado, editado ou excluído, na ordem.

### Acompanhar acessos e sessões (aba Acessos)

1. Clique na aba **Acessos**.
2. No topo, três cartões clicáveis: **Online agora**, **Sessões recentes** e **Logins falhos**. Clique num deles para focar a tabela abaixo naquele recorte. Passar o mouse sobre "Online agora" mostra a lista de quem está conectado.
3. A tabela de **Sessões** mostra tempo logado × tempo ativo, IP e situação. **Clique numa sessão** para expandir e ver as ações que aquele usuário fez naquela janela de login.
4. Para desconectar alguém: na coluna Situação de uma sessão ainda aberta, clique em **encerrar**. Para desconectar todo mundo de uma vez, use o botão **Deslogar todos** (vermelho). Ambos pedem confirmação.

### Ver estatísticas de uso (aba Análise)

1. Clique na aba **Análise**.
2. Escolha o período no topo: **7, 30 ou 90 dias**.
3. Explore os indicadores ("big numbers"), os gráficos (atividade por dia, por hora, concorrência, duração de sessões, logins, telas mais usadas, ações por bar) e a tabela **Resumo por usuário** no final.

## Abas e seções

| Aba | O que mostra |
|---|---|
| **Tudo** | Lista completa da trilha de auditoria — toda criação, edição e exclusão de registro, com filtros, busca, timeline por registro e exportação. |
| **Ações sensíveis** | Mesma lista, mas só as ações de maior risco: exclusões, mudanças de permissão de usuário e alterações de credenciais (severidade `warning` ou `critical`). |
| **Acessos** | Sessões de login (online, tempo logado × ativo, IP, dispositivo), tentativas de login (sucesso/falha) e ações para encerrar sessões. |
| **Análise** | Painel de estatísticas de uso: indicadores, gráficos de atividade/engajamento e resumo por usuário. |

## Colunas e cálculos

### Aba "Tudo" e "Ações sensíveis" — lista de registros

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Quando | Data e hora da ação | Campo `timestamp` do evento, formatado em pt-BR (dd/mm/aa hh:mm:ss) | `system.audit_trail.timestamp` |
| Usuário | Quem fez a ação | `user_email`; se vazio, mostra "sistema" | `audit_trail.user_email` (vem do header `x-audit-email` da requisição autenticada) |
| Papel | Papel do usuário na hora da ação | `user_role` (ex.: admin, financeiro) | `audit_trail.user_role` (header `x-audit-role`) |
| Operação | Tipo da ação | `operation`: INSERT (criou), UPDATE (editou), DELETE (excluiu) — com cor por tipo | `audit_trail.operation` (`TG_OP` do gatilho) |
| Tabela | Área/entidade afetada, em nome amigável | `table_name` (ex.: `operations.insumos`) traduzido por um dicionário para rótulo legível (ex.: "Insumo"); sem dicionário, formata o nome da tabela | `audit_trail.table_name` |
| O quê | Resumo da ação em linguagem natural | Montado no cliente: "Editou X · N campo(s)", "Criou X: rótulo", "Excluiu X: rótulo". O rótulo puxa nome/descrição/título/código/e-mail do registro | Derivado de `old_values` / `new_values` |
| Bar | Bar onde a ação ocorreu | `bar_id` do registro (ou do header `x-audit-bar` quando o registro não tem bar); "—" quando não há | `audit_trail.bar_id` |
| Selo "sensível" | Marca ações de risco | Aparece quando `severity = 'critical'` | `audit_trail.severity` |
| Campos alterados (ao expandir) | Numa edição, o que mudou de fato | Compara `old_values` × `new_values` chave a chave; ignora carimbos automáticos (criado_em, atualizado_em, updated_at etc.) e mostra campo, valor antigo → valor novo | `old_values`, `new_values` |
| ver dados (ao expandir) | JSON bruto antes/depois | Exibe `old_values` (antes/excluído) e `new_values` (depois) sem transformação | `old_values`, `new_values` |

### Aba "Acessos" — cartões e tabelas

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Online agora (cartão) | Quantos estão conectados neste momento | Conta sessões sem `ended_at` e com `last_seen_at` nos últimos 2 minutos | `system.user_sessions` |
| Sessões recentes (cartão) | Total de sessões carregadas | Contagem das últimas 150 sessões | `system.user_sessions` |
| Logins falhos (cartão) | Tentativas de login que falharam | Conta tentativas com `sucesso = false` | `system.login_attempts` |
| Usuário (sessão) | Quem logou | `user_email` (+ bar da sessão) | `user_sessions.user_email` |
| Entrada | Início da sessão | `login_at` formatado | `user_sessions.login_at` |
| Logado | Tempo total logado | `duracao_seg` = (fim − login_at); fim = `ended_at` ou, se aberta, `last_seen_at` | Calculado na API |
| Ativo | Tempo realmente navegando (e % do logado) | `ativo_seg` = `active_seconds` acumulado; % = ativo ÷ logado. Ocioso = 100 − esse % | `user_sessions.active_seconds` (heartbeat) |
| IP | Endereço de onde acessou | `ip` da sessão | `user_sessions.ip` |
| Situação | Online / saiu quando / inativo | "online" se online=true; senão "saiu {ended_at}"; senão "inativo". Botão **encerrar** aparece se a sessão não tem `ended_at` | `user_sessions` |
| Ações da sessão (ao expandir) | O que o usuário fez naquela sessão | Busca a trilha por e-mail no intervalo login→fim (±1 min de tolerância) e filtra pelo mesmo e-mail | `audit_trail` cruzado com a janela da sessão |
| Quando / Email / IP / Resultado (tentativas) | Log de tentativas de login | `at`, `email`, `ip` e `sucesso` (ok/falhou + `motivo`) | `system.login_attempts` |

### Aba "Análise" — indicadores (big numbers)

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Pico simultâneo | Máximo de sessões ativas ao mesmo tempo | Varredura dos eventos entra/sai das sessões (soma corrida +1/−1) e pega o maior | `user_sessions` via `acessos_analytics` |
| Online agora | Sessões ativas neste momento | Sessões abertas com `last_seen_at` nos últimos 2 min | `user_sessions` |
| Usuários únicos | Pessoas distintas com sessão no período | `count(distinct user_email)` | `user_sessions` |
| Sessões (período) | Total de sessões no período | `count(*)` das sessões | `user_sessions` |
| Tempo logado | Soma do tempo logado de todos | `sum(dur_seg)` (fim − login por sessão) | `user_sessions` |
| Tempo ativo | Soma do tempo navegando | `sum(active_seconds)` | `user_sessions` |
| Engajamento | % do tempo logado em que houve navegação | 100 × ativo ÷ logado | `user_sessions` |
| Sessão média / máx | Duração média e máxima das sessões | `avg(dur_seg)` e `max(dur_seg)` | `user_sessions` |
| Mobile | % de sessões em celular | % das sessões cujo `user_agent` bate mobile/android/iphone/ipad/ipod | `user_sessions.user_agent` |
| Ações (período) | Total de ações registradas (e por sessão) | `count(*)` do audit_trail; por sessão = ações ÷ sessões | `audit_trail` |
| Exclusões | Quantas exclusões no período | Total de eventos `DELETE` | `audit_trail` (via `audit_stats`) |
| Ações sensíveis | Ações de severidade elevada | Total de eventos com severidade `warning`/`critical` | `audit_trail` |
| Logins falhos | Tentativas malsucedidas (e % das tentativas) | `count` de `sucesso=false`; % sobre o total de tentativas | `login_attempts` |
| Cobertura | Quantas tabelas auditáveis já geraram evento | `com_eventos / auditaveis` e o % | `audit_stats` / catálogo de tabelas |

### Aba "Análise" — gráficos

| Gráfico | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Atividade por dia | Criou/Editou/Excluiu por dia (empilhado) | Contagem por dia e por operação | `audit_stats.por_dia` |
| Usuários online por hora | Em quais horas o pessoal mais usa | Sessões distribuídas hora a hora entre login e fim | `acessos_analytics.online_por_hora` |
| Ações por hora | Pico de operação por hora | Contagem de INSERT/UPDATE/DELETE por hora | `acessos_analytics.acoes_por_hora` |
| Concorrência ao longo do tempo | Sessões ativas por hora do calendário | Sessões cobrindo cada janela de 1 hora | `acessos_analytics.concorrencia` |
| Duração das sessões | Quantas sessões em cada faixa de tempo | Sessões agrupadas em faixas (<1min, 1-5min, 5-15min, 15-30min, 30-60min, 60min+) | `acessos_analytics.hist_duracao` |
| Logins por dia | Sucesso × falha por dia | Contagem de tentativas ok e falho por dia | `acessos_analytics.logins_por_dia` |
| Telas / Endpoints top | Onde o pessoal passa mais tempo (ou endpoints mais chamados) | Soma de `active_seconds` por tela; se ainda não há tempo por tela, cai para top endpoints (contagem) | `session_page_time` / `audit_trail.endpoint` |
| Ações por bar | Onde estão mexendo mais | Contagem de ações por `bar_id` | `audit_trail` |
| Tempo ativo por bar | Tempo navegando em cada bar | Soma de `active_seconds` por bar | `session_page_time` |
| Tabelas mais alteradas | Áreas com mais eventos | Top tabelas por total de eventos | `audit_stats.top_tabelas` |

### Aba "Análise" — Resumo por usuário

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Usuário | E-mail (com ícone de celular se ≥50% mobile) | `user_email`; ícone por `mobile_pct` | `user_sessions` |
| Sessões | Nº de sessões no período | `count(*)` das sessões do usuário | `user_sessions` |
| Logado / Ativo | Tempo logado e tempo navegando | `sum(dur_seg)` e `sum(active_seconds)` | `user_sessions` |
| Engaj. | % do logado em navegação | 100 × ativo ÷ logado (verde ≥50%, âmbar ≥25%) | `user_sessions` |
| Criou / Editou / Excluiu | Ações do usuário por tipo | Contagem de INSERT / UPDATE / DELETE | `audit_trail` |
| Por bar (ações) | Distribuição de ações por bar | Contagem de ações por `bar_id` do usuário | `audit_trail` + `operations.bares` |
| Área que mais mexe | Tabela mais alterada pelo usuário | `mode()` do `table_name` | `audit_trail` |
| Tela top | Tela onde passou mais tempo (+ tempo) | Tela com maior soma de `active_seconds` | `session_page_time` |
| Últ. online | Última vez visto | `max(fim)` das sessões | `user_sessions` |

## Filtros e opções

- **De / Até**: recorta o período por `timestamp` (a data final vale até 23:59:59 do dia). Atalhos rápidos: Hoje, 7 dias, Este mês, Tudo.
- **Operação**: filtra por tipo de ação (INSERT/UPDATE/DELETE). A lista de opções vem das operações realmente presentes na trilha.
- **Tabela**: filtra por entidade afetada. O dropdown mostra o **catálogo completo de tabelas auditáveis** agrupadas por schema, com a contagem de eventos de cada uma (não só as que já geraram evento).
- **Buscar**: procura por e-mail do usuário, texto da descrição **ou** ID do registro (busca parcial, sem diferenciar maiúsculas).
- **Filtros de coluna** (funil no cabeçalho): seleção múltipla estilo planilha; agem apenas sobre os registros já carregados na tela.
- **Tempo real**: quando ligado (padrão), a lista se atualiza sozinha a cada 10 segundos. É pausado automaticamente ao usar "Carregar todos".
- **Aba Análise → 7 / 30 / 90 dias**: define a janela das estatísticas.
- **Aba Acessos → cartões**: alternam o foco da tabela entre todas as sessões, só online, ou só logins falhos.

## Regras e detalhes importantes

- **Automático via gatilho de banco.** A trilha não é preenchida à mão: um gatilho (`system.fn_audit`) captura todo INSERT/UPDATE/DELETE das tabelas de negócio e grava em `system.audit_trail`.
- **Só registra ações do app autenticado.** O gatilho só grava quando a escrita traz o cabeçalho `x-audit-email` (injetado pelas requisições autenticadas do Zykor). Escritas de **ETL, cron, edge functions ou psql direto não são auditadas** — de propósito, para não poluir a trilha com ações de máquina.
- **Edições "vazias" são ignoradas.** Se um UPDATE não muda nenhum valor real, não vira evento. Na tela, mudanças em campos de carimbo (criado_em, atualizado_em, updated_at, etc.) também são ocultadas na comparação de campos.
- **Severidade define "sensível".** Mudanças em usuários/permissões (`auth_custom.usuarios`, `auth_custom.usuarios_bares`) e em credenciais viram `critical` (categoria segurança); exclusões viram `warning`; o resto é `info`. A aba "Ações sensíveis" mostra `warning` + `critical`.
- **Trilha é append-only.** Nem o service_role pode alterar ou apagar linhas da trilha — só o gatilho insere. A retenção é de **12 meses**, com limpeza mensal automática (todo dia 1º às 4h).
- **Produções têm auditoria própria.** As tabelas de execução de produção não recebem o gatilho genérico (têm auditoria dedicada no app), para evitar log duplicado.
- **Filtro por bar.** Cada evento carrega o `bar_id` do registro afetado (ou do header quando o registro não tem bar). A auditoria é transversal aos bares — um admin vê todos.
- **Sessão "online" = últimos 2 minutos.** Uma sessão conta como online se está aberta e teve atividade (`last_seen_at`) nos últimos 2 minutos; o tempo ativo vem de um heartbeat que soma segundos enquanto a tela está de fato em uso.
- **Exportação e filtros de coluna são locais.** O CSV e os filtros de cabeçalho operam sobre os registros já carregados na tela — para cobrir todo o período, carregue tudo antes.

## Dúvidas frequentes

**Quem consegue ver esta tela?**
Administradores. O item aparece para quem tem o módulo Configurações, mas os dados só carregam para o papel `admin`.

**Por que uma alteração feita por importação/integração não aparece?**
Porque só ações vindas do app autenticado (com o cabeçalho de auditoria) são registradas. ETL, cron e edge functions são propositalmente ignorados.

**Consigo saber exatamente o que mudou numa edição?**
Sim. Clique na linha para expandir: aparecem os campos alterados no formato "de → para", e em "ver dados" o JSON completo do antes e do depois.

**Dá para ver todo o histórico de um registro específico?**
Sim. Nas linhas com ID, clique no ícone de relógio para abrir a linha do tempo com todas as ações daquele registro.

**Por quanto tempo os registros ficam guardados?**
12 meses. Uma limpeza automática mensal remove o que é mais antigo.

**O botão "Deslogar todos" é seguro?**
Ele invalida as sessões atuais — todos (você incluído) precisarão entrar de novo. Use com cuidado; há confirmação antes de executar.

## Fonte dos dados

- **`system.audit_trail`** — a trilha em si (operação, tabela, registro, usuário, papel, bar, valores antes/depois, severidade, categoria, endpoint, método). Preenchida pelo gatilho `system.fn_audit`.
- **`system.user_sessions`** — sessões de login (login_at, last_seen_at, active_seconds, ip, user_agent, ended_at).
- **`system.login_attempts`** — tentativas de login (sucesso/falha, motivo, IP).
- **`system.session_page_time`** — tempo ativo por tela e por bar (alimentado pelo heartbeat).
- **Funções SQL (schema `system`):** `audit_stats` (totais, cobertura, por dia, top tabelas), `acessos_analytics` (indicadores, gráficos e resumo por usuário), `audit_saude` (tamanho/retenção da trilha), `audit_tabelas_catalogo` (catálogo de tabelas auditáveis), `session_heartbeat` (registra atividade), `audit_purge` (retenção).
- **`operations.bares`** — nome dos bares nos gráficos e no resumo por usuário.

Origem dos dados: **eventos internos do próprio Zykor** (ações dos usuários no sistema). Não depende de integrações externas como ContaHub, NIBO, Conta Azul, Stone, Yuzer ou Sympla.
