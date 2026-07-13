---
title: Agendamentos
area: ferramentas-financeiro
slug: agendamentos
route: /financeiro/agendamentos
description: Monta uma lista de pagamentos a fornecedores e funcionários e dispara cada um via PIX no Banco Inter, registrando a despesa no Conta Azul.
order: 10
icon: Calendar
---

# Agendamentos

## Visão geral

A tela **Agendamentos** é a central de **pagamentos por PIX** do bar. Aqui o financeiro monta uma lista de pagamentos (fornecedores, prestadores, folha de funcionários) e, com um clique, cada pagamento é **enviado como PIX pelo Banco Inter** e, em seguida, **registrado como conta a pagar (despesa) no Conta Azul**.

Ela junta três coisas num lugar só:

- **Montar a lista** — adicionando pagamentos um a um (manual) ou colando uma folha inteira do Excel/Sheets.
- **Verificar cadastros** — confere se o beneficiário já existe como fornecedor no Conta Azul e busca a chave PIX.
- **Pagar e conciliar** — envia o PIX no Inter, cria a conta a pagar no Conta Azul e, quando o PIX é aprovado, dá baixa (quita) automaticamente para fechar a conciliação.

A lista de pagamentos é **compartilhada por bar**: quem sobe uma folha grava no banco e qualquer pessoa do financeiro do mesmo bar enxerga a mesma lista. Quem usa no dia a dia: financeiro, administrativo e sócios que fazem os pagamentos do bar.

> **Importante:** esta tela é a de **pagamento por PIX**. Não confundir com a agenda de reservas nem com a tela de **Pedidos de Pagamento** (aprovação/comprovante), que é um fluxo separado dentro de Ferramentas Financeiro.

## Como acessar

No menu lateral: **Ferramentas Financeiro → Agendamentos**.

A rota é `/financeiro/agendamentos` e é protegida pelo módulo **financeiro** (guard da página). Cada operação da lista (ver, inserir, excluir) é validada também no back-end pela permissão da ferramenta `ferramentas financeiro_agendamentos`. Sem essa permissão, a API responde "Sem permissão".

Para conseguir **pagar**, além do acesso à tela, o bar precisa ter:

1. **Credencial PIX do Banco Inter** configurada (conta bancária + certificado mTLS). Se faltar, aparece um aviso amarelo "PIX Inter não configurado" e o botão de pagar fica desabilitado.
2. **Conta Azul conectado** (token válido) — mostrado na faixa de status no topo.
3. Um **bar selecionado** no seletor do topo. Sem bar, a tela pede para selecionar um.

## Passo a passo

### Preparar a tela (uma vez por sessão)

1. Selecione o **bar** no topo da página.
2. Na coluna **Resumo** (lateral esquerda), escolha a **credencial Inter** — é a conta/certificado que efetivamente dispara o PIX. Ao trocar de bar, a credencial é reescolhida automaticamente para a do bar novo.
3. Escolha a **conta financeira (registro CA)** — em qual conta do Conta Azul o lançamento será registrado. Essa escolha fica **salva por bar** no navegador.
4. (Opcional) Clique em **Configurar webhook** para registrar no Inter a URL que recebe as atualizações de status do PIX em tempo real.

### Adicionar um pagamento manual (aba "Adicionar Manual")

1. Digite o **CPF/CNPJ** do beneficiário e clique em **Buscar** — o sistema procura o fornecedor no Conta Azul e, se achar, preenche o **nome** e a **chave PIX** automaticamente.
2. Confira/complete os campos obrigatórios: **Nome**, **Valor** (formato R$ 0,00), **Data de Pagamento** e **Categoria** (só categorias de despesa aparecem).
3. Preencha o que for opcional: **Chave PIX** (se não veio do cadastro), **Data de Competência**, **Centro de Custo** e **Descrição**.
4. Clique em **Adicionar pagamento**. O item entra na lista com status **Pendente**.

### Importar uma folha inteira (aba "Importar Folha (Paste)")

1. Defina a **Data de pagamento** e a **Competência** (mês AAAA-MM) que valerão para todas as linhas.
2. Escolha a **Categoria** (despesa) — o sistema tenta pré-selecionar automaticamente uma categoria de salário/folha. Opcionalmente escolha o **Centro de custo**.
3. No Excel/Sheets, copie as colunas da folha (Ctrl+C) e **cole** na caixa de texto. O formato esperado por coluna é `Nome [TAB] PIX [TAB] Valor [TAB] Cargo` (aceita cabeçalhos como `nome_beneficiario`, `chave_pix`, `valor`/`total`, `cargo`).
4. Clique em **Gerar Prévia**. A tela monta uma tabela de conferência e, em segundo plano, **verifica cada nome no Conta Azul**, marcando: ✅ cadastrado, ⚠️ aproximado (fuzzy) ou ❌ não cadastrado.
5. Para os ❌, clique em **Cadastrar** na própria linha para criar o fornecedor no Conta Azul sem sair da tela.
6. Clique em **Importar N pagamento(s)**. As linhas entram na lista com status **Pendente** e já vinculadas ao fornecedor CA encontrado.

### Pagar (enviar PIX + registrar no Conta Azul)

**Um pagamento por vez:** na aba **Lista de Pagamentos**, clique em **Pagar** (ou **Reenviar**, se estava com erro) na linha desejada.

**Todos de uma vez:** na coluna **Resumo**, clique em **Processar todos (N)** — ele percorre todos os pendentes e os que estão com erro.

Para cada pagamento, a ordem é sempre: **1) envia o PIX no Inter** → **2) só se o Inter aceitar, cria a conta a pagar no Conta Azul**. Se o PIX falhar, nada é criado no Conta Azul. O status muda para **Aguardando Aprovação** quando o envio dá certo.

> Se o sistema detectar um PIX igual recente (possível duplicata), ele **pede confirmação** antes de enviar de novo, para evitar pagar em dobro.

### Editar ou excluir

- **Editar:** clique no lápis na linha. Dá para corrigir nome, chave PIX, valor, data e descrição. Ao salvar, o status **volta para Pendente** para permitir reenviar. Se o pagamento já tem lançamento no Conta Azul, a conta a pagar existente é reaproveitada (não duplica).
- **Excluir:** clique na lixeira da linha, ou marque várias com o checkbox e use **Apagar selecionados**. O botão **Limpar Lista** remove tudo do bar.

## Abas e seções

A tela tem uma **coluna de Resumo** fixa à esquerda e três **abas** principais à direita.

### Coluna Resumo (lateral)

Reúne a configuração de pagamento e os contadores de status. Contém os selects de **credencial Inter** e **conta financeira CA**, o botão **Processar todos** e os cards de contagem (Total, Pendentes, Agendados, Aguardando, Aprovados, Erros).

### Faixa de status do Conta Azul (topo)

Mostra se o Conta Azul está **conectado** e quantos fornecedores, categorias, centros e contas estão sincronizados, com botões **Sync fornecedores / Sync categorias / Sync centros** para atualizar esses cadastros sob demanda.

### Aba "Adicionar Manual"

Formulário para inserir um pagamento por vez, com busca de fornecedor por CPF/CNPJ.

### Aba "Importar Folha (Paste)"

Colagem de planilha, geração de prévia, verificação de cadastro no Conta Azul e importação em lote.

### Aba "Lista de Pagamentos"

A tabela com todos os pagamentos da lista, seus status e as ações (editar, excluir, pagar/reenviar).

## Colunas e cálculos

A tabela principal fica na aba **Lista de Pagamentos**. Os valores são, em sua maioria, **digitados/importados** (não há cálculo de métrica derivada), mas cada coluna é montada como abaixo.

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Checkbox | Seleção da linha para exclusão em lote | Estado local da tela | — |
| Nome | Nome do beneficiário | Campo digitado ou vindo da folha / do cadastro CA na busca | `financial.pagamentos_pendentes.dados` |
| CPF/CNPJ | Documento do beneficiário | Documento salvo (só dígitos), exibido com máscara de CPF ou CNPJ; se vazio mostra "Não informado" | `pagamentos_pendentes.dados.cpf_cnpj` |
| Valor | Valor do pagamento | Exibido exatamente como foi digitado/importado (string BRL, ex.: R$ 1.089,10). No envio é convertido para número (tira "R$", remove milhar, vírgula vira ponto) | `dados.valor` |
| Data | Data de pagamento (vencimento do PIX) | `data_pagamento` formatada em pt-BR; datas futuras fazem o Inter **agendar** o PIX | `dados.data_pagamento` |
| Categoria | Categoria de despesa do Conta Azul | Nome resolvido pelo `categoria_id` escolhido no formulário; "N/A" se vazio | Categorias CA (`categoria_nome`) |
| Centro de custo | Centro de custo do Conta Azul | Nome resolvido pelo `centro_custo_id`; "N/A" se vazio | Centros de custo CA (`centro_custo_nome`) |
| Status | Situação do pagamento | Etiqueta colorida derivada do campo `status` (ver tabela de status abaixo). Abaixo dela pode aparecer a mensagem de erro e o início do ID do lançamento no CA | `dados.status` |
| Criado em | Data/hora em que o item entrou na lista | `created_at` formatado (dia/mês/ano hora:min) | `dados.created_at` |
| Criado por | Quem adicionou o pagamento | `criado_por_nome` (usuário autenticado no momento da criação) | `dados.criado_por_nome` |
| Ações | Botões Editar / Excluir / Pagar (ou Reenviar) | Botões condicionais; "Pagar/Reenviar" só aparece para status pendente, agendado, erro CA ou erro Inter | Estado da tela |

### Contadores da coluna Resumo

Cada card é uma **contagem** simples de itens da lista por status (não somam valores em R$):

| Indicador | O que mostra | Como é calculado |
|---|---|---|
| Total | Quantidade de pagamentos na lista | `pagamentos.length` |
| Pendentes | Itens ainda não enviados | Contagem de `status === 'pendente'` |
| Agendados | Itens com status agendado | Contagem de `status === 'agendado'` |
| Aguardando | PIX enviado, aguardando aprovação/execução | Contagem de `status === 'aguardando_aprovacao'` |
| Aprovados | PIX confirmado pelo Inter | Contagem de `status === 'aprovado'` |
| Erros | Itens que falharam | Contagem de `status === 'erro'` (os cards não somam `erro_inter`/`erro_ca`) |
| Processar todos (N) | Alvo do botão de pagamento em lote | `Pendentes + Erros` |

### Significado de cada status

| Status (etiqueta) | O que significa |
|---|---|
| **Pendente** | Na lista, ainda não enviado |
| **Agendado** | Marcado como agendado |
| **Aguardando Aprovação** | PIX enviado ao Inter com sucesso; aguardando execução/aprovação |
| **Aprovado** | Inter confirmou (EXECUTADO/CONCLUÍDO/PAGO/COMPLETED) — dispara a baixa no CA |
| **Inter ❌ (erro_inter)** | Falha no envio do PIX; **nada foi criado no Conta Azul** |
| **Conta Azul ❌ (erro_ca)** | PIX já foi enviado, mas faltou registrar a conta a pagar no CA (reenviar só completa o CA) |
| **Erro** | Erro genérico |

### Prévia da folha (aba Importar)

| Coluna | O que mostra | Como é obtida |
|---|---|---|
| CA | Situação do cadastro no Conta Azul | Resultado do match: ✅ por documento/exato, ⚠️ aproximado (com % de similaridade) ou ❌ não cadastrado |
| Nome | Nome extraído da linha colada | Parser da folha (separa nome e chave PIX) |
| PIX | Chave PIX extraída | Detecta e-mail, chave aleatória (UUID), CPF/CNPJ ou telefone dentro da linha |
| Cargo | Cargo/descrição | Coluna de cargo da folha (ou "Funcionário" como padrão) |
| Total | Valor da linha | `valor`/`total` convertido de BRL para número; linhas com total ≤ 0 são descartadas |

## Filtros e opções

Esta tela não tem filtros de período/relatório — ela é operacional. As opções que mudam o comportamento são:

- **Seletor de bar (topo):** define de qual bar é a lista, as credenciais Inter e os cadastros do Conta Azul. Trocar de bar recarrega tudo. Há uma **trava de segurança**: não é possível pagar um item de um bar usando a credencial de outro.
- **Credencial Inter (Resumo):** qual conta/certificado dispara o PIX. Obrigatória para pagar.
- **Conta financeira CA (Resumo):** em qual conta do Conta Azul o lançamento entra. O select mostra só contas ativas, do tipo Conta Corrente e **exclui contas Stone**. Salva por bar.
- **Vincular contas a esta API:** permite marcar quais contas CA pertencem ao CNPJ da credencial Inter selecionada. Quando há vínculo, o select passa a mostrar **só** as contas vinculadas. Salvo no navegador.
- **Categoria (formulário/folha):** só lista categorias de **despesa** (DESPESA/EXPENSE) e ativas; na folha, o sistema tenta pré-selecionar uma categoria de salário/folha e ignora as marcadas "[NÃO USAR]".

## Regras e detalhes importantes

- **Filtragem por bar:** toda a lista é sempre por `bar_id`. O back-end **ignora** qualquer `bar_id` vindo do cliente e usa o bar do usuário autenticado (com override seguro pelo header `x-selected-bar-id`), evitando escrita cross-bar.
- **Ordem PIX → Conta Azul (não é opcional):** o PIX é enviado **antes** de criar a conta a pagar no CA. Motivo: o Conta Azul **não permite excluir** uma conta a pagar pela API — se o CA fosse criado primeiro e o PIX falhasse (ex.: chave errada), sobraria uma conta órfã impossível de apagar.
- **Competência × vencimento:** `data_competencia` (quando informada) é a competência do lançamento no CA; `data_pagamento` é o **vencimento/data do PIX**. Se a competência não for preenchida, usa-se a data de pagamento. Na folha, a competência vira o **primeiro dia do mês** informado.
- **Datas futuras agendam:** uma data de pagamento no futuro faz o Inter **agendar** o PIX para aquele dia.
- **Idempotência (não duplica):** se o PIX já foi enviado (código de solicitação salvo), não reenvia — só completa a etapa que faltou no CA. Se a conta a pagar já existe, não recria.
- **Baixa automática no CA:** enquanto há pagamentos aguardando, a tela faz um **polling a cada 5 segundos** lendo o status na tabela de PIX (não chama o Inter direto; o webhook atualiza a tabela). Quando o PIX é aprovado e já existe conta a pagar, o sistema **dá baixa (quita)** automaticamente no Conta Azul para fechar a conciliação.
- **Manual vs. automático:** os dados dos pagamentos são **manuais** (digitados ou colados). A verificação de cadastro, o envio do PIX, o registro e a baixa no CA são **automáticos**.
- **Persistência compartilhada:** a lista é salva no banco (`financial.pagamentos_pendentes`) e visível a todo o financeiro do bar. Há um cache local no navegador como fallback offline. A remoção só acontece por exclusão explícita (nunca é apagada por sincronização, para não sobrescrever o trabalho de outro usuário).
- **Valores:** o `valor` é guardado como o texto digitado; a conversão para número trata o formato pt-BR (remove "R$" e milhar, troca vírgula por ponto). Valores ≤ 0 ou inválidos bloqueiam o pagamento.
- **Estados vazios:** sem bar selecionado, a tela pede para escolher um; sem credencial Inter, mostra o aviso amarelo e desabilita o pagamento; lista sem itens mostra "Nenhum pagamento na lista".

## Dúvidas frequentes

**O PIX foi enviado mas o status ficou "Conta Azul ❌". E agora?**
O PIX já saiu — o dinheiro foi pago. Só faltou registrar a conta a pagar no Conta Azul. Clique em **Reenviar**: como o PIX já tem código salvo, ele **não é enviado de novo**, o sistema só completa o registro no CA.

**Por que o botão "Pagar" está desabilitado?**
Falta alguma condição: nenhum bar selecionado, credencial Inter não configurada/não selecionada, ou não há pendentes. Verifique o aviso no topo e os selects da coluna Resumo.

**A mesma pessoa recebeu duas vezes?**
É improvável: o sistema detecta PIX iguais recentes e pede confirmação antes de reenviar; e o envio é idempotente por código de solicitação. Só reenvia em dobro se você confirmar manualmente o alerta de duplicata.

**Colei a folha e apareceu "Nenhuma linha válida".**
Cole com separação por TAB (direto do Excel/Sheets) e garanta que cada linha tenha nome e um valor positivo. Linhas de cabeçalho, totais e valores ≤ 0 são descartadas.

**O beneficiário não tem chave PIX preenchida.**
Se o cadastro no Conta Azul não tem chave, informe a chave PIX manualmente no formulário (ou edite a linha). O PIX aceita CPF/CNPJ, e-mail, telefone ou chave aleatória.

**Trocar o valor de um pagamento que já tem conta no Conta Azul resolve tudo?**
Não totalmente. Corrigir a **chave PIX** reenvia o PIX certo, mas se você mudou o **valor** e já havia lançamento no CA, ajuste ou cancele a conta a pagar diretamente no Conta Azul — a API não sobrescreve o valor da conta existente.

## Fonte dos dados

- **`financial.pagamentos_pendentes`** — tabela que guarda a lista de pagamentos (rascunho) por bar, com o objeto completo do pagamento no campo `dados`. Alimentada pela API `/api/financeiro/agendamentos/pendentes` (GET/POST/DELETE).
- **Banco Inter (PIX)** — envio, agendamento e status do PIX, via `/api/financeiro/inter/pix`, `/inter/pix/status`, `/inter/credenciais` e `/inter/webhook/registrar`. Credenciais por bar (conta + certificado mTLS).
- **Conta Azul** — cadastros e lançamentos financeiros, via `/api/financeiro/contaazul/*`: `categorias`, `centros-custo`, `contas-financeiras`, `stakeholders` (fornecedores), `match-fornecedores` (verificação da folha), `lancamentos` (cria a conta a pagar), `baixa` (quita) e `status` (conexão/estatísticas).
- **Verificação de credenciais** — `/api/financeiro/verificar-credenciais` (checa se o bar tem PIX Inter configurado).
