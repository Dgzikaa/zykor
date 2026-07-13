---
title: Integrações
area: configuracoes
slug: integracoes
route: /configuracoes/administracao/integracoes
description: Painel de saúde de todas as conexões externas do bar (PDV, financeiro, reservas, eventos, marketing, IA e infra), mostrando credenciais, última sincronização e volume recente.
order: 30
icon: Zap
---

# Integrações

## Visão geral

A tela **Integrações** é o painel de saúde de todas as conexões externas do Zykor. Em vez de cada dono/administrador precisar entrar em cada sistema (ContaHub, Conta Azul, Instagram, etc.) para saber se está tudo conectado, esta tela reúne num só lugar o **status de cada integração**: se a credencial existe e está válida, quando foi a última sincronização e quantos registros novos entraram nos últimos 7 dias.

É um painel de **monitoramento e diagnóstico**, não de configuração pesada. Ele responde perguntas como: "o ContaHub está puxando as vendas?", "o token do Conta Azul expirou?", "o Instagram deste bar está conectado?", "faz quanto tempo que a reserva do GetIn não sincroniza?". Duas integrações permitem ação direta a partir daqui (conectar/desconectar Instagram e abrir a configuração do Umbler e do Tangerino); as demais são apenas visualização de saúde.

Quem usa: dono, administrador e time técnico, principalmente quando algo "parou de atualizar" e é preciso descobrir onde está o gargalo.

## Como acessar

- Menu lateral: **Configurações → Integrações** (ícone de raio / `Zap`).
- Rota: `/configuracoes/administracao/integracoes`.
- Permissão necessária: módulo **`configuracoes`**. Sem essa permissão o item nem aparece no menu e a rota é bloqueada pelo guard.
- Os dados são sempre carregados para o **bar selecionado** no topo. Ao trocar de bar, o painel recarrega.

## Passo a passo

### Ver a saúde geral das integrações

1. Selecione o **bar** no seletor do topo.
2. A tela carrega automaticamente e mostra os **cinco cartões de resumo** no cabeçalho (Do bar, Conectadas, Atenção, Desconectadas, Sem config).
3. Abaixo, as integrações aparecem em **cartões agrupados por categoria** (PDV, Financeiro, Reservas, Eventos, etc.), e por último o bloco **Plataforma** (infra e IA, iguais para todos os bares).
4. Cada cartão mostra o **status** (badge colorido), a **última sincronização** (ex.: "há 2 horas") e o **volume dos últimos 7 dias** (ex.: "1.240 novos (7d)").

### Investigar uma integração específica

1. Clique em qualquer cartão de integração.
2. Abre um **painel de detalhe** com três blocos:
   - **Credencial**: fonte da credencial, data de expiração (se houver), valores mascarados (só os 4 últimos caracteres) e detalhes extras em JSON.
   - **Sincronização**: data/hora da última sync, status dessa sync e volume de registros dos últimos 7 dias.
   - **Jobs agendados**: os crons que alimentam a integração.
3. Se houver problema, um bloco âmbar de **Atenção** lista o que está errado (ex.: "Token expirando em menos de 7 dias").

### Filtrar por status

1. Clique num dos cartões de resumo (**Conectadas**, **Atenção**, **Desconectadas**, **Sem config**).
2. A lista abaixo passa a mostrar só as integrações naquele status. Clique em **Do bar** para voltar a ver todas.

### Buscar uma integração pelo nome

1. Digite no campo de busca (ex.: "ContaHub", "NIBO", "Instagram").
2. A lista filtra por nome ou descrição em tempo real.

### Conectar o Instagram de um bar

1. Localize o cartão **Instagram** (categoria Marketing & Social).
2. Se estiver desconectado, clique em **Conectar Instagram**. Você é redirecionado para o login Business (OAuth) do Meta.
3. Ao voltar, um aviso confirma o sucesso (ex.: "Instagram conectado: @seubar") ou mostra o erro.
4. Para desconectar, clique em **Desconectar** no mesmo cartão e confirme. O histórico já sincronizado é preservado.

### Configurar Umbler ou Tangerino

1. No cartão **Umbler Talk**, clique em **Configurar** para abrir a tela dedicada de configuração do WhatsApp/Umbler.
2. No cartão **Tangerino (Sólides DP)**, clique em **Configurar token** para abrir a tela de token do ponto.

### Atualizar os dados

1. Clique em **Atualizar** (ícone de recarregar) no canto superior direito para forçar uma nova leitura do status.

## Abas e seções

A tela não tem abas, mas organiza os cartões em **grupos por categoria**, na seguinte ordem:

| Grupo | O que reúne |
|---|---|
| **PDV** | Ponto de venda — fonte primária de receita (ContaHub). |
| **Financeiro** | ERPs e bancos (Conta Azul, Banco Inter). |
| **Reservas** | Reservas online e fila (GetIn). |
| **Eventos** | Bilheteria online e física (Sympla, Yuzer). |
| **Marketing & Social** | Redes sociais e anúncios (Instagram, Meta Ads). |
| **Reviews** | Avaliações de clientes (Google Reviews via Apify). |
| **Comunicação** | WhatsApp, NPS, notificações e planilhas (Umbler, Falaê, Discord, Google Sheets). |
| **Recursos Humanos** | Ponto, jornada e férias (Tangerino / Sólides DP). |
| **Plataforma** | Infra e IA, iguais para todos os bares (Anthropic, OpenAI, Supabase, Vercel, Sentry). |

O bloco **Plataforma** aparece separado no final porque essas integrações são globais (infra/IA) e **não contam** no resumo "Conectadas" do bar — elas têm um contador próprio no rodapé do cabeçalho ("Plataforma: X/Y conectadas").

## Colunas e cálculos

Cada integração é um cartão. Abaixo, o significado e o cálculo real de cada indicador visível (nos cartões de resumo, nos cartões de integração e no painel de detalhe).

### Cartões de resumo (cabeçalho)

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Do bar** | Total de integrações que pertencem a este bar | Contagem das integrações com escopo `bar` no catálogo | `catalog.ts` (`resumo.total`) |
| **Conectadas** | Quantas do bar estão saudáveis | Integrações do bar com `statusGeral = 'conectada'` | Cálculo da API |
| **Atenção** | Quantas do bar têm algum alerta | Integrações do bar com `statusGeral = 'parcial'` | Cálculo da API |
| **Desconectadas** | Quantas do bar estão fora do ar | Integrações do bar com `statusGeral = 'desconectada'` | Cálculo da API |
| **Sem config** | Quantas do bar não estão configuradas / o bar não usa | Integrações do bar com `statusGeral = 'nao_configurada'` | Cálculo da API |
| **Plataforma X/Y** | Quantas integrações de infra/IA estão conectadas | `plataforma_ok` (status `conectada`) sobre `plataforma_total` (todas de escopo `plataforma`) | Cálculo da API |

### Cartão de cada integração

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| **Logo / Nome / Descrição** | Identidade da integração | Valores fixos definidos no catálogo (`logoLabel`, `logoCor`, `nome`, `descricao`) | `catalog.ts` |
| **Status (badge)** | Conectada / Atenção / Desconectada / Não configurada | Cálculo combinado de credencial + atividade recente (ver "Regras" abaixo) | `calcularStatusGeral()` |
| **Problema (faixa âmbar)** | Primeiro alerta detectado | Primeiro item da lista `problemas` (ex.: "Token expirando em menos de 7 dias") | Cálculo da API |
| **Última sync** | Há quanto tempo sincronizou | Data/hora mais recente entre todas as fontes de sync da integração, exibida como tempo relativo (ex.: "há 3 horas") | `pegarUltimaSync()` — pega o MAX das tabelas de log |
| **Volume (7d)** | Registros novos nos últimos 7 dias | Contagem `count` na tabela bronze da integração, com `colunaTempo >= agora - 7 dias`, filtrada por bar (quando aplicável) | `pegarVolume7d()` |
| **Ações** | Botões disponíveis | Ações declaradas no catálogo + ações fixas por integração (conectar/desconectar Instagram, abrir dashboard) | `acoesPara()` |

### Painel de detalhe

| Campo | O que mostra | Como é obtido | Fonte |
|---|---|---|---|
| **Credencial → Fonte** | Onde a credencial está guardada | `api_credentials:<sistema>`, `env_global`, tabela ou tabela OAuth, conforme a integração | `checarCredencialBar()` / `checarCredencialGlobal()` |
| **Credencial → Expira em** | Validade do token | Campo `expires_at` da linha da credencial, com tempo relativo | `api_credentials` / tabela OAuth |
| **Credencial → Valores mascarados** | Chaves/tokens ofuscados | Só os **4 últimos caracteres**, prefixados por `••••` (nunca o valor completo) | Função `mascarar()` |
| **Credencial → Detalhes extras (JSON)** | Metadados (empresa, CNPJ, ambiente, escopos, último refresh) | Campos auxiliares da linha da credencial | `api_credentials` / tabela |
| **Sincronização → Última sync** | Data/hora exata da última sync | Timestamp mais recente entre as fontes de sync | `pegarUltimaSync()` |
| **Sincronização → Status última sync** | Resultado da última execução | Coluna de status da tabela de log (ex.: `success`, `error`) | Tabela de sync log |
| **Sincronização → Volume 7 dias** | Registros novos em 7 dias | Mesmo cálculo do cartão | `pegarVolume7d()` |
| **Jobs agendados** | Crons que rodam a integração | Lista fixa de nomes de cron do catálogo | `catalog.ts` (`crons`) |

## Filtros e opções

| Filtro / Opção | Efeito |
|---|---|
| **Seletor de bar** (topo) | Recarrega todo o painel para o bar escolhido. Credenciais por bar, syncs e volumes são filtrados por `bar_id`. |
| **Cartões de resumo (clicáveis)** | Filtram a lista por status (Do bar / Conectadas / Atenção / Desconectadas / Sem config). |
| **Busca por texto** | Filtra por nome ou descrição da integração. |
| **Atualizar** | Força nova leitura do status (a API cacheia por 60s por usuário). |

## Regras e detalhes importantes

- **Escopo por bar vs. plataforma.** Integrações de escopo `bar` (ContaHub, Conta Azul, GetIn, Instagram, etc.) contam no resumo do bar. As de escopo `plataforma` (Supabase, Vercel, Sentry, Anthropic, OpenAI, Google Reviews, Meta Ads, Discord) são globais e ficam no bloco **Plataforma** com contador separado — não inflam o "Conectadas" do bar.

- **Flag de uso por bar.** ContaHub, Yuzer e Sympla têm um "interruptor" em `operations.bares_config` (`tem_api_contahub`, `tem_api_yuzer`, `tem_api_sympla`). Se a flag estiver desligada, a integração aparece como **Não configurada** com o aviso "Este bar não usa esta integração" — sem tentar inferir status por atividade global. Isso evita mostrar "ContaHub conectado" num bar que não tem ContaHub.

- **Status inferido por atividade.** Algumas integrações (ContaHub, Conta Azul, GetIn, Google Reviews, Google Sheets) marcam `inferirPorAtividade`. Para elas, **atividade recente vence a credencial**: se houve volume nos últimos 7 dias **ou** a última sync foi há menos de 48h, o status é **Conectada** mesmo que a credencial não esteja visível (pode estar em Supabase secrets). Se não houve atividade e a credencial está ausente, vira **Atenção** com "Sem atividade nos últimos 7 dias — verifique se o cron está rodando".

- **Como o status geral é decidido** (`calcularStatusGeral`):
  - **Conectada**: credencial ok e sem problemas, ou atividade recente detectada.
  - **Atenção (parcial)**: há avisos (token expirando em < 7 dias, sem sync há muitas horas/dias, atividade parada mas deveria rodar).
  - **Desconectada**: credencial desativada, ou token expirado sem refresh token.
  - **Não configurada**: credencial ausente (opcional ou não), ou o bar não usa a integração.

- **Regra de expiração.** Para integrações que **não expiram** (`naoExpira` — webhooks, DSN, API keys sem TTL como Meta Ads, Discord, Supabase, Sentry, Anthropic), os estados "expirado/expirando" são ignorados. Para as demais: token expirado **com** refresh token só vira alerta se a última sync foi há mais de 12h; **sem** refresh token vira Desconectada.

- **Alerta de sync parada.** Para integrações do bar (não-globais), se a última sync foi há mais de 48h aparece "Sem sync há N dias"; entre 12h e 48h aparece "Sem sync há Nh".

- **Bar em modo manual.** Se o bar estiver marcado como `modo_manual` em `operations.bares`, integrações do bar sem credencial não geram "Atenção" — caem para **Não configurada** com "Bar manual — integração não configurada".

- **Segurança das credenciais.** Nenhum valor completo de token/chave é exibido: a API mostra só os **4 últimos caracteres** mascarados. Credenciais globais são lidas de variáveis de ambiente do servidor; credenciais por bar vêm de `api_credentials` filtradas por `bar_id`.

- **Credencial global "parcial".** Para integrações globais que esperam várias variáveis de ambiente, se só **algumas** estiverem presentes o status da credencial fica como "expirando" (o código reaproveita esse rótulo para representar "parcial").

- **Cache.** A resposta da API é cacheada por 60 segundos por usuário (com stale-while-revalidate de 5 minutos), pois o status muda lentamente. Use **Atualizar** se quiser forçar leitura nova.

## Dúvidas frequentes

**Por que o ContaHub aparece "Conectada" se não vejo a senha na tela?**
Porque o ContaHub usa login/senha em variável de ambiente global (não uma API key por bar). O status é inferido pela **atividade**: se houve vendas sincronizadas nos últimos 7 dias ou sync nas últimas 48h, ele é considerado conectado.

**Uma integração está em "Atenção". O que faço?**
Clique no cartão para abrir o detalhe e ler a mensagem exata em "Atenção". Geralmente é token expirando, sync parada há muitas horas, ou ausência de atividade recente — o texto indica o próximo passo (ex.: verificar cron, reconectar).

**Por que o Instagram de um bar aparece desconectado e o de outro não?**
O Instagram é conectado **por bar** via OAuth Business. Cada bar precisa passar pelo fluxo "Conectar Instagram" separadamente; a conexão de um bar não vale para o outro.

**Um bar mostra "Este bar não usa esta integração". Isso é erro?**
Não. Significa que a flag de uso daquela integração (ContaHub/Yuzer/Sympla) está desligada na configuração do bar. É esperado para bares que não usam aquele sistema.

**O que é o bloco "Plataforma" no final?**
São as integrações de infraestrutura e IA (Supabase, Vercel, Sentry, Anthropic, OpenAI, etc.) que são iguais para todos os bares. Elas têm contador próprio e não contam no "Conectadas" do bar.

**Consigo configurar as integrações por aqui?**
Só ações pontuais: conectar/desconectar Instagram e abrir a configuração do Umbler e do Tangerino. As demais são monitoramento — a configuração de credenciais é feita nos respectivos sistemas ou no cadastro de credenciais do backend.

## Fonte dos dados

A tela é montada pela API `/api/configuracoes/administracao/integracoes` (filtrada por `bar_id`), que cruza um catálogo central com dados reais do banco:

- **Catálogo**: `frontend/src/app/configuracoes/administracao/integracoes/catalog.ts` (define nome, categoria, onde achar credencial, tabelas de sync/volume e crons de cada integração).
- **Credenciais por bar**: tabela `api_credentials` (Conta Azul, Banco Inter, GetIn, Yuzer, Falaê, Tangerino), `integrations.umbler_config`, `integrations.falae_config`, `integrations.instagram_contas` (OAuth), `integrations.google_oauth_tokens`.
- **Credenciais globais**: variáveis de ambiente do servidor (ContaHub, Meta Ads, Discord, Anthropic, OpenAI, Supabase, Vercel, Sentry, Apify, Google).
- **Config do bar**: `operations.bares_config` (flags `tem_api_*`) e `operations.bares` (modo manual).
- **Logs de sincronização**: `system.sync_logs_contahub`, `bronze.bronze_contaazul_sync_log`, `integrations.contaazul_logs_sincronizacao`, `integrations.getin_sync_logs`, `bronze.bronze_sympla_sync_log`, `bronze.bronze_yuzer_sync_log`, `integrations.instagram_sync_logs`.
- **Volume 7 dias (tabelas bronze)**: `bronze.bronze_contahub_raw_data`, `bronze.bronze_contaazul_lancamentos`, `financial.inter_webhook_logs`, `bronze.bronze_getin_reservations`, `bronze.bronze_sympla_participantes`, `bronze.bronze_yuzer_eventos`, `bronze.bronze_google_reviews`, `integrations.umbler_mensagens`, `bronze.bronze_falae_respostas`, `bronze.bronze_tangerino_punch`.
- **Integrações de origem cobertas**: ContaHub (PDV), Conta Azul e Banco Inter (financeiro), GetIn (reservas), Sympla e Yuzer (eventos), Instagram e Meta Ads (marketing), Google Reviews via Apify (reviews), Umbler/Falaê/Discord/Google Sheets (comunicação), Tangerino/Sólides (RH), Supabase/Vercel/Sentry/Anthropic/OpenAI (plataforma).
