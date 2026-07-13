---
title: Zykor Assistant
area: configuracoes
slug: assistente-zykor
route: /assistente-zykor
description: Chat de IA que responde perguntas em português sobre os bares consultando dados reais (vendas, clientes, finanças, integridade) em tempo real.
order: 100
icon: Bot
---

# Zykor Assistant

## Visão geral

O Zykor Assistant é um chat de inteligência artificial dentro do sistema. Você escreve uma pergunta em português natural — como "Como foi sábado no Ordi?" ou "Tem cliente ouro dormindo no Deboche?" — e a IA consulta os dados reais dos bares na hora para responder com números de verdade.

Diferente de um chat genérico, o assistente **não inventa números**: ele tem um conjunto fechado de "ferramentas" de leitura (vendas, clientes do clube, DRE, fluxo de caixa, alertas de integridade etc.). A cada pergunta, o modelo decide qual ferramenta usar, busca o dado no banco e só então formula a resposta. As respostas são curtas e diretas, no estilo de uma mensagem de WhatsApp (no máximo cerca de 8 linhas).

Quem usa no dia a dia: sócios e donos que querem uma resposta rápida sobre o negócio sem precisar abrir várias telas. O acesso é restrito a uma lista de números autorizados (whitelist de sócios).

O modelo de IA por trás é o Claude (família Sonnet). Cada pergunta puxa um retrato atualizado dos dados; não há memória financeira "congelada".

## Como acessar

- **Menu lateral:** Configurações → **Zykor Assistant** (ícone de robô).
- **Rota direta:** `/assistente-zykor`.
- **Permissão:** o item no menu aparece para quem tem o módulo `gestao`. O acesso à rota é liberado para quem tem qualquer um dos módulos `gestao`, `home` ou `configuracoes` — ou seja, é um acesso amplo dentro do sistema.
- **Whitelist de sócio:** além da permissão da tela, a IA só responde de fato se o telefone associado estiver cadastrado como sócio autorizado. Na versão web, a página envia sempre o número do sócio piloto (Rodrigo); números não autorizados recebem a mensagem "este número não está autorizado a usar o Assistente Zykor".

## Passo a passo

**Fazer uma pergunta:**

1. Abra a tela pelo menu Configurações → Zykor Assistant.
2. Digite a pergunta na caixa de texto embaixo ("Pergunta o que quiser...").
3. Clique no botão de enviar (ícone de avião) ou aperte Enter.
4. Enquanto a IA pensa e consulta os dados, aparecem três bolinhas animadas. A resposta chega em seguida, com uma etiqueta indicando de qual bar ela falou (Ordinário ou Deboche).

**Usar uma sugestão pronta:**

1. Logo abaixo da primeira mensagem de boas-vindas, há botões de sugestão (ex.: "Como foi sábado no Ordi?", "Qual a previsão pra próxima sexta?").
2. Clique em qualquer um deles para enviar a pergunta automaticamente.
3. As sugestões somem depois que você faz a primeira pergunta.

**Escolher o bar na pergunta:**

1. Escreva o nome do bar na própria frase: use "Ordi"/"Ordinário" para o bar 3 ou "Deboche"/"Descubra" para o bar 4.
2. Se você não citar nenhum bar, o assistente usa o **primeiro bar autorizado** como padrão (para o sócio piloto, o Ordinário).

**Especificar período:**

1. Você pode dizer as datas ("de 1 a 7 de maio") ou usar linguagem do dia a dia.
2. A IA entende termos como "essa semana" (segunda da semana atual até ontem), "ontem" e "mês passado" (mês inteiro anterior).

## Abas e seções

A tela é uma conversa única — não tem abas. Os elementos visíveis são:

- **Janela de conversa:** histórico de mensagens (suas em rosa, do assistente com o ícone de robô). Cada resposta do assistente mostra uma etiqueta com o bar que ela tratou.
- **Sugestões:** botões de perguntas prontas, exibidos só antes da primeira pergunta.
- **Caixa de envio:** campo de texto + botão enviar.
- **Rodapé informativo:** indica o modelo de IA usado, que o retrato de dados é puxado a cada pergunta e que, por enquanto, o canal é só web (sem WhatsApp).

## Colunas e cálculos

A tela em si não tem tabelas de dados; o que ela mostra são as respostas da IA. O que importa aqui são as **ferramentas de consulta** que o assistente pode acionar — cada uma busca um tipo de informação. A tabela abaixo descreve o que cada ferramenta retorna, como o número é obtido e a fonte real no banco.

| Ferramenta / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Vendas por período | Faturamento líquido, pessoas e ticket médio por dia num intervalo | Soma o faturamento líquido e o total de pessoas dos dias no período; ticket médio geral = faturamento total ÷ pessoas total (arredondado) | `silver.vendas_diarias` (colunas `faturamento_liquido_r`, `total_pessoas`, `ticket_medio_pessoas_r`) |
| Membros do Clube | Top membros do Clube Ordi por nível/segmento | Lista membros do bar, opcionalmente filtrados por nível (diamante/ouro/prata/bronze) e segmento (vip/frequente/dormindo/novo/casual/perdido), ordenados por gasto total; até 50 (padrão 15) | `crm.clube_ordi_membros` |
| Clientes em queda | VIPs em risco de churn (queda de ticket ou intervalo maior entre visitas) | Ordena por score de risco; traz variação do ticket (últimas 4 vs. 4 anteriores), dias inativo e valor anual em risco; top 15 | `crm.clientes_em_queda` |
| Performance de garçom | Faturamento, ticket médio, share drinks/comida, % desconto e % upsell de bebida por garçom | Função de banco que calcula os indicadores por garçom para os últimos N dias (padrão 30); top 15 | RPC `garcom_performance` |
| Combos que convertem | Pares de produtos que aparecem juntos na mesma comanda | Função de banco que cruza produtos coocorrentes nos últimos 60 dias, com mínimo de 25 pares; remove itens de banda; até 20 | RPC `produto_combos` |
| Aniversariantes | Clientes que fazem aniversário numa janela futura | Filtra clientes com próximo aniversário entre hoje e hoje+N dias (padrão 7); ordena pela data; até 30 | `crm.aniversariantes` |
| No-show reincidentes | Clientes que reservaram e faltaram várias vezes | Traz um resumo geral do bar + top 15 reincidentes com total de reservas, no-shows e % de no-show | `gold.noshow_resumo` e `gold.noshow_reincidentes` |
| Previsão de demanda | Faturamento e público previstos para os próximos dias | Lê as previsões já calculadas por modelo para os próximos eventos (até 14 registros) | `gold.demanda_previsoes` (`fat_previsto`, `publico_previsto`, `modelo_usado`) |
| Alertas de integridade | Sinais de fraude/desvio (descontos altos, cortesias volumosas, taxas anormais) | Filtra alertas do bar dos últimos N dias (padrão 14), ordenados por severidade e valor envolvido; até 30 | `integridade.alertas` |
| DRE (competência) | Receita, custos e despesas por categoria e mês | Chama a função da DRE por ano; se pedir um mês, filtra e mostra linhas por macro/categoria com valor com sinal (despesa negativa); senão agrega por mês e macro | RPC `get_dre_por_ano` |
| DFC (fluxo de caixa) | Operacional, Investimento, Financiamento e variação de caixa por mês | Chama a função do DFC por ano (por data de pagamento); soma o líquido de cada grupo por mês; variação de caixa = Operacional + Investimento + Financiamento | RPC `get_dfc_por_ano` |
| Mudanças no Conta Azul | Alterações em lançamentos (categoria/valor/competência/pagamento/exclusão) | Lista o histórico de alterações do CA (a partir de jun/2026), opcionalmente filtrado por mês de competência e/ou por data da alteração; até 50, mais recentes primeiro | `bronze.contaazul_lancamentos_historico` |
| Evolução da DRE | Como uma linha (ou mês) da DRE mudou entre as fotos diárias | Compara o valor da linha por data de snapshot; se informar a categoria, filtra por ela; senão traz as que mais mudaram (precisa de ≥2 dias de foto) | `financial.dre_dfc_snapshot` (tipo DRE) |

Observação: valores de despesa na DRE vêm com **sinal negativo**. Os dados financeiros (DRE/DFC/auditoria) hoje são consistentes principalmente no **Ordinário (bar 3)**; o histórico de snapshots e de mudanças do CA começou em **jun/2026**, então pode estar raso por enquanto.

## Filtros e opções

Não há filtros de tela (dropdowns ou seletores). Tudo é controlado pela própria pergunta:

- **Bar:** citar "Ordi/Ordinário" (bar 3) ou "Deboche/Descubra" (bar 4) na frase. Sem citar, usa o bar padrão do sócio.
- **Período:** informar datas ou usar termos naturais ("essa semana", "ontem", "mês passado").
- **Nível/segmento de cliente, número de dias, produto etc.:** também vêm da linguagem da pergunta — a IA traduz para os parâmetros da ferramenta correspondente.
- **Botões de sugestão:** atalhos para perguntas comuns, disponíveis só antes da primeira mensagem.

## Regras e detalhes importantes

- **Filtragem por bar:** toda consulta é feita para um único `bar_id`, detectado a partir da pergunta. Nunca mistura bares na mesma resposta.
- **Whitelist obrigatória:** só telefones cadastrados como sócio ativo recebem resposta com dados. Na web, o número enviado é fixo (sócio piloto).
- **Somente leitura:** o assistente não altera nada. As ferramentas apenas consultam views e funções; não existe SQL livre — é uma lista fechada e explícita de consultas permitidas.
- **Competência × pagamento:** a DRE usa regime de **competência**; o DFC usa **data de pagamento**. São visões diferentes do mesmo negócio.
- **Sinais e arredondamentos:** despesas na DRE aparecem negativas; a maioria dos totais é arredondada para número inteiro (reais).
- **Limite de rodadas:** a IA pode encadear até 6 consultas por pergunta. Se atingir o teto sem concluir, a resposta pode ficar incompleta (o caso é registrado no log).
- **Estados vazios:** para dados recentes (mudanças do CA, evolução da DRE), se ainda não houver histórico suficiente, o assistente avisa que os registros começaram em jun/2026 ou que faltam dias de foto para comparar.
- **Registro (log):** toda pergunta e resposta é gravada com telefone, bar inferido, tokens usados e tempo de processamento — para auditoria e melhoria.
- **Data e dia da semana:** o assistente sabe a data atual e o dia da semana, e usa isso para interpretar "essa semana", "sexta", "fim de semana" etc.
- **Canal:** por enquanto só web. Não há envio automático por WhatsApp a partir desta tela.

## Dúvidas frequentes

**O assistente inventa números?**
Não. Ele só responde com base nas ferramentas de leitura ligadas ao banco. Se o dado não existir, ele avisa em vez de inventar.

**Por que ele respondeu sobre o bar errado?**
Provavelmente você não citou o bar na pergunta, então ele usou o padrão. Escreva "no Deboche" ou "no Ordi" para direcionar.

**Consigo perguntar sobre finanças dos dois bares?**
As ferramentas financeiras (DRE, DFC, mudanças do CA) hoje são sólidas principalmente no Ordinário. No Deboche podem estar incompletas.

**Por que a resposta veio curta?**
É proposital: o assistente responde no estilo WhatsApp, direto e em até cerca de 8 linhas. Peça detalhes se quiser mais.

**Qualquer usuário do sistema pode usar?**
A tela abre para quem tem os módulos de gestão/home/configurações, mas a IA só responde a números na whitelist de sócios. Hoje o canal web usa o número do sócio piloto.

**Ele lembra da conversa anterior?**
Cada pergunta é respondida no contexto da sessão atual da tela. Os dados são sempre puxados na hora, não há "número congelado" de perguntas passadas.

## Fonte dos dados

As respostas combinam dados de várias camadas do sistema, todas filtradas por bar:

- **Vendas:** `silver.vendas_diarias` (origem ContaHub).
- **Clientes/Clube/CRM:** `crm.clube_ordi_membros`, `crm.clientes_em_queda`, `crm.aniversariantes`.
- **Garçom e combos:** funções `garcom_performance` e `produto_combos` (origem ContaHub).
- **Reservas/No-show:** `gold.noshow_resumo`, `gold.noshow_reincidentes` (origem GetIn/reservas).
- **Previsões:** `gold.demanda_previsoes`.
- **Integridade:** `integridade.alertas`.
- **Financeiro:** funções `get_dre_por_ano` e `get_dfc_por_ano`, `bronze.contaazul_lancamentos_historico` e `financial.dre_dfc_snapshot` (origem Conta Azul).
- **Autorização e logs:** `integrations.whatsapp_assistente_socios` (whitelist) e `integrations.whatsapp_assistente_log` (registro das conversas); dados dos bares em `operations.bares`.
- **IA:** modelo Claude (família Sonnet) via API da Anthropic, orquestrado pela Edge Function `assistente-zykor` no Supabase, acionada pela rota interna `/api/assistente`.
