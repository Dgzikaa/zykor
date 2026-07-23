---
title: Funcionários
area: rh
slug: funcionarios
route: /rh/funcionarios
description: Central de RH do bar — cadastro da equipe, dossiê completo de cada colaborador, documentos, ponto, ocorrências e indicadores de gente.
order: 10
icon: Users
---

# Funcionários

> **Módulo RH em Beta.** Todo o menu de RH ainda está em testes/iteração — dados podem estar incompletos e o comportamento pode mudar. Um badge "Beta" no menu lateral e um banner amarelo no topo de cada página de RH sinalizam isso. Feedback é bem-vindo.

## Visão geral

A tela **Funcionários** é a central de RH (Recursos Humanos) do bar. Reúne, em um só lugar:

- O **cadastro de toda a equipe** (CLT, PJ e Freela), com foto, cargo, área, salário e dados de contato.
- Um **dossiê completo por pessoa**, aberto ao clicar em qualquer colaborador: ponto, onboarding, documentos, ocorrências, avaliações, treinamentos e pesquisa de felicidade.
- Um **painel de indicadores de gente** (headcount, turnover, absenteísmo, clima/eNPS) para acompanhar a saúde do time ao longo do tempo.
- **Alertas automáticos** de pendências (documento faltando ou vencido, treinamento vencido, férias que podem estar vencendo).

Quem usa no dia a dia: gestores do bar, sócios e responsáveis de RH. Serve tanto para o operacional (admitir, anexar contrato, registrar advertência, gerar recibo) quanto para a visão gerencial (quantas pessoas tenho, quanto está girando o time, como está o clima).

Todos os dados são **sempre filtrados pelo bar selecionado** — cada bar enxerga apenas a própria equipe.

## Como acessar

- No menu lateral: **RH → Funcionários** (ícone de pessoas).
- Rota direta: `/rh/funcionarios`.
- **Permissão necessária:** módulo **Gestão** (`gestao`). Sem essa permissão a página não abre.
- Se o seu acesso for **somente leitura** no módulo, um selo *"Somente leitura"* aparece no topo e as ações de escrita (criar, editar, anexar, aprovar) ficam bloqueadas — você continua vendo tudo, mas não altera.

## Passo a passo

### Cadastrar um novo funcionário
1. Clique em **Novo funcionário** (botão branco no topo direito).
2. Preencha os **Dados pessoais** — apenas o **Nome** é obrigatório; CPF, nascimento, telefone e email são opcionais.
3. Em **Contrato**, escolha o **Tipo de contratação** (CLT, PJ ou Freela), o cargo, a área e a data de admissão. O campo de valor muda conforme o tipo: **Salário base** para CLT/PJ, **Valor da diária** para Freela.
4. Em **Pagamento (PIX)**, informe a chave e o tipo da chave — usada para pagar o colaborador (importante para freelas).
5. Escreva **Observações** internas se quiser.
6. Clique em **Cadastrar funcionário**. Se você informou salário/diária/VT, o sistema também registra automaticamente o **contrato de admissão** no histórico.

### Editar um funcionário
1. Clique no card (ou linha) da pessoa para abrir o **dossiê**.
2. Na barra lateral do dossiê, clique em **Editar dados**.
3. Ajuste o que precisar. Ao editar, aparecem também **Data de demissão** e o switch **Funcionário ativo**.
4. Preencher uma **data de demissão** marca a pessoa como **inativa** automaticamente.
5. Se você mudar **salário, cargo, área ou tipo de contratação**, o sistema **fecha o contrato vigente e abre um novo** no histórico (registro de alteração contratual).
6. Clique em **Salvar alterações**.

### Buscar e filtrar a equipe
1. Vá para a aba **Equipe**.
2. Use a caixa **Buscar** para procurar por nome, CPF ou email (busca com um pequeno atraso enquanto você digita).
3. Refine com os seletores de **Área**, **Tipo** (CLT/PJ/Freela) e **status** (Ativos / Inativos / Todos — vem em "Ativos" por padrão).
4. Alterne entre visão em **Cards** e em **Tabela** pelos botões à direita.

### Exportar a lista em CSV
1. Na aba **Equipe**, aplique os filtros desejados.
2. Clique em **CSV**. O arquivo baixado traz Nome, CPF, Cargo, Área, Tipo, Admissão, Tempo de casa e Ativo, respeitando os filtros ativos.

### Anexar um documento (contrato, exame, carteira…)
1. Abra o dossiê da pessoa e vá à aba **Documentos**.
2. Escolha o **Tipo** (Carteira de Trabalho, Exame Admissional, Contrato, RG/CPF ou Outro).
3. Opcionalmente informe a **Validade** (útil para exames e certificados).
4. Selecione o **Arquivo** (PDF ou imagem) e clique em **Anexar**.
5. Documentos com validade passada aparecem marcados como *"venceu"*.

### Registrar uma ocorrência (advertência, falta, atestado, férias)
1. No dossiê, aba **Ocorrências**.
2. Escolha o **Tipo**, a **Data** (e o "Até" para períodos, como férias) e uma **Descrição**.
3. Clique em **Adicionar**. Registrar **férias** alimenta o alerta de férias e o card *"Em férias agora"* do dashboard.

### Aprovar ou recusar solicitações do portal
1. Na aba **Visão geral**, o bloco **Solicitações pendentes (portal)** lista pedidos de folga/férias feitos pelos funcionários.
2. Clique no **✓ verde** para aprovar ou no **✗ vermelho** para recusar.
3. Ao **aprovar**, o sistema cria automaticamente a ocorrência correspondente (férias vira ocorrência de "férias"; folga/outros viram "observação").

### Gerar recibo de pagamento
1. Abra o dossiê e clique em **Gerar recibo** na barra lateral.
2. Abre a tela de recibo já com o mês/ano atual pré-preenchidos para aquela pessoa.

### Compartilhar o portal do funcionário
1. No dossiê, se a pessoa tiver portal habilitado, clique em **Copiar link do portal**.
2. Envie o link (WhatsApp/QR) para o colaborador acessar o próprio portal.

## Abas e seções

A tela tem **quatro abas** no topo:

- **Visão geral** — dashboard operacional de RH: KPIs do dia, solicitações pendentes do portal, alerta de **quem está sem bater ponto** (ativos parados 7+ dias), quadro por área, clima/felicidade, pendências, quem está de férias, aniversariantes e aniversários de empresa.
- **Equipe** — a lista de colaboradores (cards ou tabela), com busca, filtros e exportação CSV. Clicar em qualquer pessoa abre o **dossiê**.
- **Organograma** — a equipe agrupada por **área**, com a contagem de pessoas por área (áreas maiores primeiro).
- **Indicadores** — painel gerencial dos últimos 12 meses: headcount, turnover, admissões/demissões, absenteísmo e eNPS (clima recorrente anônimo).

### Dossiê do funcionário (ao clicar numa pessoa)

Abre um painel com a lateral de **perfil** (foto/iniciais, status, tipo, tempo de casa, admissão, salário/diária, idade, CPF, telefone, email, PIX, nascimento e histórico de salário pago via Conta Azul) e **sete sub-abas**:

- **Ponto** — espelho de ponto do mês espelhando o **Tangerino**: cada dia classificado como trabalhou / falta / **ausência justificada** (atestado ou férias) / **folga** (dia sem escala) / feriado, com resumo de horas, faltas, justificadas e folgas.
- **Onboarding** — checklist de integração com barra de progresso; itens marcáveis e adicionáveis.
- **Documentos** — anexos com tipo, validade e link para abrir.
- **Ocorrências** — advertências, faltas, atestados, férias e observações.
- **Avaliações** — avaliações de desempenho com notas por critério (1 a 5) e nota geral.
- **Treinamentos** — cursos/certificações com instituição, conclusão e validade.
- **Felicidade** — o resultado da pesquisa de clima da própria pessoa (quando há).

## Colunas e cálculos

### Aba Equipe — cards e tabela

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Avatar (iniciais/cor) | Foto ou iniciais da pessoa | Iniciais = primeiras letras das 2 primeiras palavras do nome; cor derivada do nome | `hr.funcionarios` |
| Nome | Nome do colaborador | Campo direto; "(inativo)" quando `ativo = false` | `hr.funcionarios` |
| Cargo · Área | Cargo e área da pessoa | Junção do `cargo_id`/`area_id` com os nomes cadastrados | `hr.funcionarios`, `hr.cargos`, `hr.areas` |
| Tipo | Vínculo (CLT/PJ/Freela) | Campo `tipo_contratacao` | `hr.funcionarios` |
| Tempo de casa | Há quanto tempo está na empresa | Meses entre a **data de admissão** e hoje, exibido como "Xa Ym" (anos/meses) | `hr.funcionarios.data_admissao` |
| Selo de alertas (número em vermelho) | Quantidade de pendências da pessoa | Contagem de alertas calculados (ver "Alertas" abaixo) | motor de alertas (`lib/rh/alertas`) |

### Aba Visão geral — KPIs do topo

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Ativos | Nº de funcionários ativos (e inativos no subtítulo) | Conta `ativo = true`; inativos = total − ativos | `hr.funcionarios` |
| Em férias | Pessoas de férias hoje | Ocorrências tipo "ferias" cujo período engloba a data de hoje | `hr.funcionario_ocorrencias` |
| Faltas (mês) | Faltas no mês corrente | Ocorrências tipo "falta" com início a partir do 1º dia do mês | `hr.funcionario_ocorrencias` |
| Com alertas | Pessoas com alguma pendência | Nº de ativos com ao menos 1 alerta | motor de alertas |
| Felicidade | % de satisfação da última pesquisa | Média do `resultado_percentual` da pesquisa mais recente (com nº de respostas) | `hr.pesquisa_felicidade` |
| Tempo de casa | Média de tempo de casa | Média (em meses) do tempo de admissão dos ativos com data; exibida em anos/meses | `hr.funcionarios.data_admissao` |

### Aba Visão geral — blocos

| Bloco / Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Quadro por área (barras) | Nº de pessoas por área | Contagem de ativos agrupados por área | `hr.funcionarios` + `hr.areas` |
| Tags por tipo | Quantos CLT / PJ / Freela | Contagem de ativos por `tipo_contratacao` | `hr.funcionarios` |
| +adm. 90d / −dem. 90d | Admissões e demissões nos últimos 90 dias | Admissões/demissões com data nos últimos 90 dias | `hr.funcionarios` (datas de admissão/demissão) |
| Clima · Felicidade (%) | Satisfação e tendência | % e média da última pesquisa; linha de tendência das últimas pesquisas; 5 dimensões (Engajamento, Pertencimento, Relacionamento, Liderança, Reconhecimento) | `hr.pesquisa_felicidade` |
| Pendências (por tipo) | Alertas agregados do bar | Soma dos alertas por tipo (sem exame, sem contrato, doc vencido, treino vencido, férias vencendo) | motor de alertas |
| Em férias agora | Quem está de férias e até quando | Ocorrências de férias vigentes hoje | `hr.funcionario_ocorrencias` |
| Aniversariantes do mês | Aniversários de nascimento | Ativos cujo mês de nascimento = mês atual, com dia e idade | `hr.funcionarios.data_nascimento` |
| Aniversários de empresa | Aniversários de admissão (≥ 1 ano) | Ativos cujo mês de admissão = mês atual e ≥ 1 ano de casa | `hr.funcionarios.data_admissao` |
| Solicitações pendentes | Pedidos de folga/férias do portal | Solicitações com status "pendente" | `hr.solicitacoes` |
| **Sem bater ponto** | Ativos **com escala** parados há **7+ dias** (candidatos a demissão não marcada no Tangerino / abandono) | Última presença (dia "trabalhou") no livro-razão do Tangerino há mais de 6 dias; corta líderes que não batem ponto (sem falta prevista e sem presença). Mostra dias parado, última presença e faltas/justificadas dos últimos 30 dias | `hr.v_ponto_ausentes` (sobre `hr.v_ponto_dia`) |
| Avaliações de desempenho | Módulo em construção | Placeholder — "em breve" | — |

### Aba Indicadores — KPIs e gráficos (últimos 12 meses)

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Headcount | Quadro atual de pessoas | Nº de pessoas ativas no fim do mês corrente (admitidas até o fim do mês e não demitidas) | `hr.funcionarios` |
| Turnover 12m (%) | Rotatividade do ano | Demissões dos 12 meses ÷ headcount médio do período × 100 | `hr.funcionarios` (datas) |
| Admissões 12m | Contratações no ano | Soma das admissões mês a mês | `hr.funcionarios.data_admissao` |
| Demissões 12m | Desligamentos no ano | Soma das demissões mês a mês | `hr.funcionarios.data_demissao` |
| Faltas 12m | Faltas no ano | Soma das ocorrências de "falta" no período | `hr.funcionario_ocorrencias` |
| Turnover mensal (%) | Rotatividade por mês | Por mês: demissões do mês ÷ headcount médio do mês (média entre início e fim) × 100 | `hr.funcionarios` |
| Headcount/Admissões/Demissões (gráfico) | Evolução mês a mês | Barras de admissões/demissões e linha de headcount de fechamento | `hr.funcionarios` |
| Absenteísmo (faltas + atestados) | Ausências por mês | Barras empilhadas de faltas e atestados por mês | `hr.funcionario_ocorrencias` |
| eNPS · clima (90 dias) | Clima recorrente anônimo | eNPS = (% promotores − % detratores). Promotores = nota 9–10; Neutros = 7–8; Detratores = 0–6, nos últimos 90 dias | `hr.enps_respostas` |

### Dossiê — sub-aba Ponto (resumo do mês)

Espelha o **livro-razão diário do Tangerino** (endpoint `daily-summary`): cada dia já vem classificado pelo próprio Tangerino, e a **falta é reclassificada como "ausência justificada"** quando há atestado/férias registrado no dossiê cobrindo o dia. A **folga** vem da escala (dia sem jornada prevista). Meses sem esse dado caem no cálculo antigo (ponto × escala).

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Trabalhadas | Horas trabalhadas no mês | Soma de `horas_trab` (workedHours do Tangerino) | `hr.v_espelho_dia` |
| Hora extra | Horas extras no mês | Soma de `horas_extra` (trabalhado − previsto) | `hr.v_espelho_dia` |
| Faltas | Dias de falta real | Dias com situação "falta" (previsto, sem batida e sem justificativa) | `hr.v_espelho_dia` |
| Justificadas | Ausências justificadas | Dias com atestado/férias cobrindo (situação "ausência justificada") | `hr.v_espelho_dia` + `hr.funcionario_ocorrencias` |
| Folgas | Dias de folga | Dias sem jornada prevista na escala (situação "folga") | `hr.v_espelho_dia` |
| Atrasos | Dias com atraso | Batida mais de 10 min após o início da escala | `hr.v_espelho_dia` |
| Linha do dia (Escala/Entrada/Saída/Trab./Extra/Status) | Situação do dia | Situação = trabalhou / falta / ausência justificada / folga / feriado / atraso, espelhando o Tangerino. Ícones de foto e geolocalização (bateu no bar / fora do local) | `hr.v_espelho_dia` |

### Dossiê — sub-aba Avaliações

| Coluna | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Período / Avaliador | Ciclo avaliado e quem avaliou | Campos informados no formulário | `hr` (avaliações) |
| Notas por critério | Pontualidade, postura, equipe, qualidade, proatividade, atendimento | Cada critério recebe nota de 1 a 5 | `hr` (avaliações) |
| Nota geral | Média da avaliação | Consolidada a partir das notas por critério (exibida como X,X/5) | `hr` (avaliações) |
| Pontos fortes / a desenvolver | Comentários qualitativos | Texto livre | `hr` (avaliações) |

### Dossiê — barra de perfil (destaques financeiros)

| Campo | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Salário / Diária | Remuneração da pessoa | Freela → valor da diária; CLT/PJ → salário base cadastrado. Se não houver salário base, cai para a **média do salário pago** apurado na Conta Azul, com o rótulo "Salário (CA · média Nm)" | `hr.funcionarios`, `hr.v_funcionario_salario` |
| Salário pago (Conta Azul) | Últimos pagamentos reais | Lançamentos de salário casados por nome na Conta Azul (últimos meses) | `hr.v_funcionario_salario` (origem Conta Azul) |
| Foto de perfil | Avatar | Foto cadastrada; se não houver, usa a última selfie do ponto (Tangerino); se nada, iniciais | `hr.funcionarios`, `hr.ponto_registro` |

## Filtros e opções

- **Bar (contexto global):** toda a tela responde ao bar selecionado no topo do sistema. Trocar o bar recarrega a equipe e os indicadores.
- **Busca (aba Equipe):** procura por nome, CPF ou email, com um pequeno atraso (250 ms) enquanto você digita para não travar.
- **Área:** filtra pela área do colaborador.
- **Tipo:** CLT, PJ ou Freela.
- **Status:** Ativos (padrão), Inativos ou Todos.
- **Cards × Tabela:** só muda a forma de visualizar a mesma lista.
- **Seletor de mês (dossiê → Ponto):** navega mês a mês no espelho de ponto; não deixa avançar além do mês atual.
- **Mês (aniversariantes):** o dashboard usa o mês corrente por padrão.

## Regras e detalhes importantes

- **Sempre por bar:** todas as consultas filtram por `bar_id`. Um funcionário só aparece no bar em que foi cadastrado.
- **Schema `hr`:** os dados de RH ficam em um schema de domínio próprio (`hr`), não na camada medallion de dados analíticos.
- **Demissão = inativo:** informar data de demissão marca automaticamente a pessoa como inativa. Alertas **não** são gerados para inativos.
- **Histórico de contrato automático:** ao cadastrar (com salário/VT/diária) cria-se o contrato de admissão; ao alterar salário/cargo/área/tipo, o contrato vigente é encerrado e abre-se um novo, preservando o histórico.
- **Salário: cadastro vs. Conta Azul.** O valor exibido prioriza o **salário base cadastrado**. Se ele estiver vazio, o sistema mostra a **média do valor efetivamente pago** apurada na Conta Azul (casamento por nome) — por isso pode haver pequena divergência quando o cadastro está incompleto.
- **Felicidade por pessoa é por nome:** a pesquisa de clima é casada ao colaborador pelo **nome**. Nomes divergentes podem não casar; nesse caso a aba Felicidade fica vazia.
- **eNPS é anônimo:** as respostas de eNPS não identificam a pessoa; o link da pesquisa é público e o resultado considera os **últimos 90 dias**.
- **Alertas são automáticos** e calculados na hora (não é campo manual): sem exame admissional, sem contrato anexado, documento vencido, treinamento vencido e "férias podem estar vencendo" (admitido há 12+ meses sem férias registradas nos últimos 12 meses).
- **Aprovar solicitação gera ocorrência:** aprovar um pedido do portal cria a ocorrência correspondente automaticamente (férias/observação).
- **Ponto manual vs. automático:** o espelho funciona com ponto lançado manualmente; quando a **Tangerino** está integrada, ela alimenta o mesmo registro (com foto e geolocalização).
- **Estados vazios:** listas sem resultado mostram mensagens amigáveis ("Nenhum funcionário", "Ninguém de férias no momento", "Sem pesquisa de felicidade ainda").
- **Somente leitura:** o selo no topo e o bloqueio das ações de escrita respeitam a permissão do módulo Gestão.

## Dúvidas frequentes

**Por que uma pessoa não aparece na lista?**
Verifique o filtro de status (talvez esteja em "Ativos" e a pessoa esteja inativa) e o filtro de área/tipo. Confirme também que ela foi cadastrada **neste bar**.

**O salário mostrado está diferente do cadastro. Por quê?**
Quando o salário base não está preenchido, a tela exibe a **média do que foi pago na Conta Azul** (casado por nome), sinalizado com o rótulo "Salário (CA · média)". Preencha o salário base no cadastro para fixar o valor.

**Como marco alguém como desligado?**
Edite o funcionário e informe a **data de demissão** — isso já o torna inativo automaticamente.

**De onde vem o número de "Com alertas"?**
São pendências calculadas automaticamente: exame admissional ou contrato faltando, documento/treinamento vencido e férias possivelmente vencendo. Inativos não geram alertas.

**A aba Felicidade da pessoa está vazia, e agora?**
A pesquisa é casada por nome. Se o nome na pesquisa de clima não bater exatamente com o cadastro, o resultado individual não aparece — ajuste o nome para casar.

**O que é o eNPS na aba Indicadores?**
É a medição anônima de clima dos últimos 90 dias: promotores (nota 9–10) menos detratores (0–6). Use o botão **Copiar link da pesquisa** para coletar respostas da equipe.

## Fonte dos dados

Todas as tabelas ficam no schema **`hr`** (domínio de RH), filtradas por `bar_id`:

- `hr.funcionarios` — cadastro central (dados pessoais, contrato, salário, PIX, status).
- `hr.cargos`, `hr.areas` — cargos e áreas do bar (dropdowns e organograma).
- `hr.contratos_funcionario` — histórico contratual (admissão e alterações de salário/cargo).
- `hr.documentos_funcionario` — anexos (contrato, exame, carteira, RG/CPF), com validade.
- `hr.funcionario_ocorrencias` — advertências, faltas, atestados, férias e observações.
- `hr.treinamentos` — cursos/certificações e suas validades.
- `hr.pesquisa_felicidade` — pesquisa de clima/felicidade (geral e por dimensão).
- `hr.enps_respostas` — respostas anônimas de eNPS (clima recorrente).
- `hr.solicitacoes` — pedidos de folga/férias vindos do portal do funcionário.
- `hr.ponto_registro` — marcações de ponto (fonte também da selfie usada como avatar).
- `hr.escalas` — jornada prevista por dia (do Tangerino); dia sem linha = folga.
- `bronze.bronze_tangerino_daily_summary` — livro-razão diário do Tangerino (worked/estimated/missed/isAdjustment/isHoliday por funcionário-dia), puxado pelo cron `tangerino-daily-summary-sync` (8:25).
- `hr.v_ponto_dia` — silver: o livro-razão resolvido **por bar** (join `tangerino_employee_id` → funcionário), classificando cada dia (trabalhou/falta/ausência justificada/folga/feriado) e reclassificando falta→justificada via atestado/férias.
- `hr.v_espelho_dia` — espelho do dossiê: `v_ponto_dia` + detalhe de batida (entrada/saída/foto/geo) + escala; deriva atraso.
- `hr.v_ponto_ausentes` — ativos com escala sem presença há 7+ dias (painel "Sem bater ponto" do dashboard).
- `hr.v_espelho_ponto` — visão antiga (ponto × escala), usada como **fallback** nos meses sem daily-summary.
- `hr.v_funcionario_salario` — visão do salário efetivamente pago, com origem na integração **Conta Azul**.

Integrações externas envolvidas: **Conta Azul** (salário pago) e **Tangerino** (ponto, escala e livro-razão diário; conta única do grupo, roteada por bar no silver). Os demais dados são preenchidos manualmente no próprio Zykor.
