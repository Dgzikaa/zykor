---
title: Pedidos de Pagamento
area: ferramentas-financeiro
slug: pedidos-pagamento
route: /financeiro/pedidos-pagamento
description: Central onde qualquer funcionário abre um pedido de pagamento (PIX, boleto, freela, cartão ou troca) e o financeiro revisa, aprova e dispara o lançamento no Conta Azul e o PIX no Banco Inter.
order: 20
icon: Receipt
---

# Pedidos de Pagamento

## Visão geral

A tela de **Pedidos de Pagamento** é a fila única de "coisas a pagar" do bar. Ela substitui o antigo fluxo por grupo de WhatsApp: em vez de mandar mensagem pedindo um PIX, qualquer funcionário logado abre um pedido aqui, e o financeiro analisa, aprova e dispara o pagamento — tudo com rastro (quem pediu, quem aprovou, comentários e histórico de alterações).

O sistema trabalha em **duas etapas separadas**, de propósito:

1. **Aprovar** (decisão): o financeiro confere os dados, escolhe a categoria, o fornecedor e a conta pagadora no Conta Azul e marca o pedido como *Aprovado*. **Nada é criado no Conta Azul nem no banco ainda.**
2. **Agendar** (execução): um segundo clique é que efetivamente cria a conta a pagar no **Conta Azul** e dispara o **PIX (ou boleto) no Banco Inter**.

Essa separação existe para evitar disparos acidentais: aprovar é barato e reversível; agendar mexe com dinheiro de verdade.

Usam a tela no dia a dia: **funcionários** (para abrir pedidos e anexar notas) e o **financeiro/dono** (para revisar, aprovar, agendar e conciliar).

## Como acessar

- **Menu lateral:** Financeiro → Ferramentas → **Pedidos de Pagamento** (ícone de recibo).
- **Rota:** `/financeiro/pedidos-pagamento`.
- **Permissão para ver a tela:** módulo `ferramentas financeiro_pedidos_de_pagamento`.
- **Permissão para aprovar/agendar/rejeitar** (perfil "financeiro"): ter `role` **admin** ou **financeiro**, ou o módulo `ferramentas_agendamento`. Quem não tem esse poder só enxerga e cria os **próprios** pedidos; quem tem enxerga todos os pedidos do bar e ganha os botões de aprovação, a aba **Cartão de Crédito** e o filtro "meus/todos".

A tela sempre trabalha sobre o **bar selecionado** no topo. Sem bar selecionado, aparece um aviso pedindo para escolher um.

## Passo a passo

### 1. Abrir um pedido de PIX (fornecedor ou reembolso)

1. Na aba **PIX**, clique em **Novo pedido**.
2. Escolha o **Tipo**: *Fornecedor Externo* ou *Reembolso Funcionário*.
3. Preencha a **Descrição**, o **Valor**, o **Vencimento** (data em que deve ser pago — não aceita data no passado) e a **Competência** (data em que a mercadoria chegou / o serviço foi prestado).
4. Em **Forma de pagamento**, escolha:
   - **Chave PIX** — pagamento automático pelo Inter na etapa de agendar.
   - **Copia e cola / QR** — cole o código; o pagamento será **manual** (o sócio cola no app do Inter). Ao colar, o sistema já lê o recebedor e, se o QR for estático, o valor.
5. Opcionalmente informe **Beneficiário**, **CPF/CNPJ**, **Observação**, marque **Precisa de comprovante** e anexe **nota/cupom/boleto**.
6. Clique em **Enviar pedido**. Ele entra na aba **Solicitado**, aguardando o financeiro.

> **Várias competências:** marque "Várias competências?" para dividir 1 PIX em N lançamentos no Conta Azul (um por data/valor). O valor total do pedido passa a ser a **soma das linhas**, mas o PIX sai uma vez só pelo total.

### 2. Aprovar um pedido (financeiro)

1. Na aba **PIX** → sub-aba **Solicitado**, cada pedido aparece como um card. Você pode aprovar **direto no card**: escolha **Categoria** (o Zykor pré-sugere a categoria do último pedido aprovado do mesmo fornecedor, marcada com ✨ "sugerida"), **Conta pagadora** e **Fornecedor CA**, e clique em **Aprovar**.
2. Para conferir mais detalhes (anexos, competências, comentários), clique no corpo do card para abrir o **detalhe**, onde há o painel completo de aprovação — incluindo **Centro de custo** e o cadastro rápido de fornecedor no Conta Azul quando ele ainda não existe.
3. Faltando categoria, fornecedor, conta pagadora ou credencial Inter, a aprovação é barrada com uma mensagem dizendo o que completar.
4. **Aprovar todos:** com pedidos prontos (categoria + fornecedor), o botão **Aprovar todos (N)** despacha o lote em sequência; os que estiverem incompletos ficam de fora e são reportados.

### 3. Agendar / Subir (disparar o pagamento)

1. Vá à sub-aba **Aprovado**.
2. Em cada card aprovado, clique em **Agendar** (nos freelas, **Subir (1 PIX)**). Isso cria a conta a pagar no Conta Azul e dispara o PIX/boleto no Inter. O status vira **Aguardando aprovação sócio** (laranja) — ainda na aba Aprovado. No freela é **um PIX pela pessoa toda** e **um lançamento no Conta Azul por diária** (cada um com a categoria daquela diária).
3. **Agendar todos (N)** faz o lote de uma vez.
4. Falta o **OK final do sócio no app do Inter**. Quando ele aprova, o pedido vai **sozinho** para a aba **Finalizado** (como *Agendado p/ a data* ou *Pago*); se recusa, aparece em Finalizado como *Recusado pelo sócio*. O Zykor acompanha o banco pelo webhook — não precisa reabrir nem reclicar.

### 4. Recusar um pedido

No card (ou no detalhe), clique em **Recusar**, informe o **motivo** e confirme. O pedido vai para a aba **Recusado** com o motivo registrado.

### 5. Marcar como pago

Para pagamentos **copia e cola** (manuais) ou feitos fora do fluxo automático, abra o detalhe e clique em **Marcar como pago** (status *aprovado* ou *agendado*).

### 6. Exportar o resumo do dia

Na sub-aba **Consolidado**, cada dia tem o botão **Copiar** — gera um texto no formato das antigas mensagens do grupo (valor, descrição, categoria, PIX, favorecido, competência, vencimento) para colar onde quiser.

## Abas e seções

A tela tem **cinco abas por tipo de pagamento** no topo:

| Aba | Para que serve |
|---|---|
| **PIX** | Pagamentos avulsos a fornecedores e reembolsos por chave PIX ou copia-e-cola. É a aba principal. |
| **Freela** | Lançamento semanal das diárias de freelas, com roster e importação por planilha. |
| **Boleto** | Subir boletos (foto/PDF lidos por IA, câmera ou manual) e acompanhá-los. |
| **Cartão de Crédito** | (Só financeiro) Conferência de faturas de cartão importadas de Excel/OFX/CSV, linha a linha. |
| **Trocas** | Registro de insumos emprestados/enviados a outro bar, corrigindo o estoque (desvio) dos dois. |

Dentro da aba **PIX** (e da lista da aba **Boleto**/**Freela**) há sub-abas por status: **Solicitado**, **Aprovado**, **Finalizado**, **Recusado**, **Todos** e **Consolidado**. Elas seguem o **ciclo real do Banco Inter**:

- **Solicitado** = só o que aguarda a aprovação do financeiro.
- **Aprovado** = o que ainda depende de alguém agir: *aprovado* (o financeiro ainda vai **Subir**), *aguardando aprovação do sócio* (já foi subido ao Inter, em **laranja**, esperando o OK do sócio no app) e os erros de agendamento (*erro Conta Azul* / *erro Inter*, que pedem novo "Agendar").
- **Finalizado** = o sócio já aprovou no Inter, saiu da alçada do financeiro: *agendado* ("Agendado p/ DD/MM", aguardando a data), *pago* (efetivado) e *recusado pelo sócio* (registro).
- **Recusado** = *rejeitado* (pelo financeiro) + *cancelado*.
- **Todos** = tudo.
- **Consolidado** = visão diária dos pagamentos já decididos (ver abaixo).

> **Como o pagamento anda sozinho:** ao subir um PIX/boleto, ele vira **Aguardando aprovação sócio** (laranja) e fica na aba Aprovado. O **webhook do Inter** promove automaticamente: quando o sócio aprova no app, vira **Agendado** (ou **Pago**, se foi na hora) e pula para **Finalizado**; se o sócio recusa, vira **Recusado pelo sócio**. Ninguém precisa clicar de novo.

### Aba Boleto

Sobe boletos (foto/PDF lidos por IA, câmera ou manual) e acompanha o pagamento. Tem as sub-abas **Solicitado / Aprovado / Finalizado / Recusado / Todos** (igual ao PIX). Ao lançar, dá para **editar a descrição** que vai pro Conta Azul e **dividir em categorias (rateio)**. Na lista, quem aprova tem um botão de **excluir/cancelar** o boleto (desfaz o agendamento no Inter se já subiu).

> **Status automático do boleto (reconciliação):** pagamento de boleto pelo Inter **não** passa pelo webhook de PIX, então o Zykor consulta o Inter (módulo de Pagamento) algumas vezes por dia e vira o boleto **agendado → pago/cancelado** sozinho. Quem aprova pode forçar na hora com o botão **"Reconciliar boletos"** no topo da lista. Boletos agendados para uma **data futura** ficam corretamente em aberto até o Inter debitar.

### Aba Freela

O fluxo de freela é **separado em dois papéis**:

**1. Operação** (`/operacional/freelas`, menu Operacional › **Freelas (Semana)**, permissão `gestao`): quem toca a operação (ex.: Junin) monta a semana. Navega semana a semana (seg→dom, diárias vencem **na terça seguinte**), marca os freelas do roster, informa valor e **função + dia trabalhado (competência)** e clica em **Adicionar ao rascunho** — as diárias ficam como **rascunho** (edita/remove à vontade), **invisíveis pro financeiro**. Ao fim, **Encerrar semana** **agrupa as diárias de cada pessoa num único pagamento** (uma conta por freela na semana, com cada diária virando uma "competência") e envia ao financeiro. **Reabrir** desfaz o agrupamento e volta tudo a rascunho editável (só o que o financeiro ainda não aprovou). Um botão **Novo freela** cadastra alguém no roster na hora (nome, função, valor padrão, PIX); o vínculo com o Conta Azul (fornecedor/categoria) fica pro financeiro.

**2. Financeiro** (esta aba **Freela**, em Pedidos de Pagamento): cada freela vira **um card por pessoa** (a semana toda dela). No topo do card, o financeiro escolhe o **fornecedor CA** — **um só por pessoa**, já **pré-preenchido** pelo cadastro do freela ou por semelhança de nome com os fornecedores do CA (mostra "sugerido por nome — confira"). A **categoria é por diária**: cada linha (dia + **função**) tem seu próprio seletor, **pré-preenchido pela sugestão por função** (garçom sempre cai na categoria de garçom, cozinha na de cozinha) aprendida do histórico. Confere e clica **Aprovar** (ou **Recusar**) a pessoa; um **checkbox** por pessoa permite aprovar várias de uma vez. Depois, **Subir (1 PIX)** dispara **um único PIX no Inter** para a pessoa (soma das diárias) e **cria N lançamentos no Conta Azul — um por diária, cada um com a sua categoria** (mesmo ciclo do PIX: aguardando sócio → Finalizado). A **lixeira** **exclui/cancela** o pagamento da pessoa — inclusive depois de subido (o Zykor **cancela o agendamento no Inter**; se já houver lançamento no Conta Azul, avisa para removê-lo à mão, pois o CA não tem exclusão via API).

### Aba Cartão de Crédito

Conferência das faturas de cartão, linha a linha, com lançamento no Conta Azul. O topo lista **os cartões cadastrados** (ex.: Itaú Azul Gonza, Itaú Latam Cadu); ao clicar num cartão, aparecem **as faturas dele** (uma por vencimento) para você escolher. Você compara o total das compras com o valor informado pelo banco para checar se "bate". Faturas podem ser **encerradas**, **reabertas** e **excluídas**.

**Fornecedor = titular do cartão (mas editável por linha).** Por padrão, no lançamento de cada compra no Conta Azul o *fornecedor* é o **dono do cartão** (o titular), não um contato genérico nem o estabelecimento — o **estabelecimento vira a descrição** do lançamento. A coluna **Fornecedor** é um **dropdown**: dá para **trocar o fornecedor pontualmente naquela linha** antes de lançar (útil quando a compra é de outra pessoa); deixando no padrão, usa o titular. O bar escolhido em cada linha é só **onde** ela é lançada (Conta Azul/Inter daquele bar).

**Vincular o titular (uma vez, no botão "Cartões"):** abra **Cartões** e, na seção **Finais → Fornecedor**, para cada final de cartão (ex.: ••8939) selecione o fornecedor titular no Conta Azul (ou clique **＋ novo** para cadastrá-lo na hora). O vínculo vale **para os dois bares** e para **todas as faturas** — o Zykor acha o mesmo titular no Conta Azul de cada bar (ou cria) automaticamente. A tabela da fatura mostra o titular na coluna **Fornecedor**; se algum final ainda não estiver vinculado, o lançamento avisa "vincule o titular na seção Fornecedor por cartão".

**Importar:** dentro da fatura selecionada, use **Importar Excel/OFX/CSV nesta fatura**. O arquivo do Itaú traz o vencimento e o valor no cabeçalho (o Zykor puxa sozinho) e o sistema **deduplica** as linhas (reimportar a mesma fatura atualiza, não duplica).

**Cadastro de cartões:** o botão **Cartões** também tem a seção **Contas de cartão** (banco + tipo + dono), que são as contas que **agrupam as faturas** no topo.

### Aba Trocas

Quem **envia** o insumo registra: escolhe o bar de destino, os insumos e as quantidades (o custo puxa do preço do insumo). Ao registrar, o **desvio de estoque dos dois bares corrige na hora** (saída no emissor, entrada no recebedor). Depois, opcionalmente, lança no Conta Azul (receita a receber no emissor + despesa a pagar no recebedor) e dispara o PIX de acerto entre os bares — com um **preview** antes de confirmar, porque o Conta Azul não permite excluir lançamento.

**De-para do insumo destino (não é código-a-código):** o mesmo código `i0XXX` no ContaHub NÃO é o mesmo insumo nos dois bares (o mesmo `i0279` pode ser "Pão Smash" no Deboche e "Espumante" no Ordinário). Por isso a coluna **"Equivale a qual insumo no [bar destino]?"** é obrigatória e funciona como um **combobox digitável**: o sistema sugere o equivalente por sobreposição de palavras do NOME (ignora acentos/pontuação e palavras tipo "und/kg/ml"), mas quem registra confirma vendo nome + código dos dois lados. Se um insumo não existe no destino, escolha **"— sem equivalente —"**: a saída daqui é registrada mesmo assim, mas a entrada lá não; o aviso amarelo lista os itens sem equivalente pra você decidir se cadastra antes.

## Colunas e cálculos

### Card do pedido (abas PIX e Boleto)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Descrição | Título do pedido | Texto digitado por quem abriu (`descricao`) | `financial.pedidos_pagamento` |
| Tipo | Reembolso / Fornecedor / Freela / Cartão / Avulso / Adiantamento | Campo `tipo` traduzido por rótulo | `financial.pedidos_pagamento` |
| Selo "Comprovante" | Se o pagamento exige comprovante depois | `precisa_comprovante = true` | `financial.pedidos_pagamento` |
| Selo "Copia e cola" | Se é PIX copia-e-cola (pagamento manual) | Existe `pix_copia_cola` | `financial.pedidos_pagamento` |
| Solicitante / recebe | Quem abriu e quem recebe | `solicitante_nome` e `beneficiario_nome` | `financial.pedidos_pagamento` |
| Vence | Data de vencimento | `data_vencimento` (formatado dd/mm/aaaa) | `financial.pedidos_pagamento` |
| Comp. | Competência | `data_competencia` | `financial.pedidos_pagamento` |
| Valor | Valor do pedido em R$ | `valor`; com múltiplas competências é a **soma** das linhas | `pedidos_pagamento` / `pedidos_pagamento_competencias` |
| Status | Situação atual | `status` (aguardando aprovação, aprovado, **aguardando aprovação sócio** [laranja], agendado, pago, **recusado pelo sócio**, erro CA, erro Inter, rejeitado, cancelado) | `financial.pedidos_pagamento` |
| Categoria (sugerida) | Categoria de despesa do CA + sugestão automática | Sugestão = categoria do **último pedido aprovado do mesmo fornecedor** (por pessoa do CA, senão por nome do beneficiário) | histórico de `pedidos_pagamento` |
| Conta pagadora | Conta do CA de onde sai o PIX | Escolha manual ou **conta pagadora padrão do bar**; define a credencial Inter usada | `bronze_contaazul_contas_financeiras` |
| Fornecedor CA | Contato/fornecedor vinculado no Conta Azul | Vínculo por documento (CPF/CNPJ) ou, na falta, por nome | `bronze_contaazul_pessoas` |

### Aba Consolidado (visão diária)

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Total geral | Soma de tudo que sai no período | Σ `valor` dos pedidos com status aprovado/agendado/pago/erro | `financial.pedidos_pagamento` |
| Qtd de pagamentos / dias | Contagem de pedidos e de dias | Nº de itens incluídos e de grupos por dia | idem |
| Cabeçalho do dia | Dia da semana + data + subtotal | Agrupa por **data de vencimento**; ordena por data (sem vencimento no fim); subtotal = Σ `valor` do dia | idem |
| Itens do dia | Descrição, status, favorecido, categoria, chave PIX, valor | Campos do pedido; ordenados por valor decrescente | idem |

> O Consolidado **exclui** o que ainda aguarda aprovação, o recusado, o cancelado e rascunhos.

### Aba Freela

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Semana | Intervalo seg→dom e terça de vencimento | Segunda da semana da data; vencimento = domingo + 2 dias | cálculo no cliente |
| Card por pessoa | Uma conta por freela na semana | Pedido `tipo=freela` (1 por pessoa/semana) agrupado no "Encerrar" | `financial.pedidos_pagamento` |
| Linha por diária | Dia + função + valor + categoria | Cada **competência** do pedido (dia trabalhado) | `financial.pedidos_pagamento_competencias` |
| Fornecedor CA | Fornecedor do pagamento (1 por pessoa) | Cadastro do freela ou match por nome; editável | `financial.beneficiarios` / seleção |
| Categoria (por diária) | Categoria contábil de cada diária | Sugestão por **função** (histórico de competências aprovadas); editável | `pedidos_pagamento_competencias.categoria_id` |
| Total da pessoa | Soma das diárias da semana | Σ `valor` das competências (= `valor` do pedido) | idem |
| Roster (valor) | Freelas cadastrados e valor da diária | `valor_padrao` do beneficiário como sugestão | `financial.beneficiarios` |

### Aba Cartão de Crédito

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Total / lançado | Total de compras e quanto já foi ao CA | Σ `valor` de linhas tipo *compra*; lançado = as com status *lançado* | tabelas de fatura de cartão |
| "bate / dif" | Conferência com o valor do banco | Compara total das compras com `valor_informado`; ✓ se diferença < R$ 0,01 | fatura de cartão |
| Data / Estabelecimento / Titular / Cartão / Valor | Dados da transação | Extraídos do extrato importado (Excel/OFX/CSV) | linhas da fatura |
| **Fornecedor** | Titular do cartão daquela linha | Vínculo Final→Fornecedor definido no botão **Cartões** (por `cartao_final`) | `financial.cartao_fornecedor_map` |
| Bar / Categoria | Rateio da linha | Escolha manual; categoria depende do bar escolhido; o bar define **onde** lança | Conta Azul (categorias de despesa) |
| Ação | Lançar / Ignorar / Lançado | Botão dispara o lançamento no CA (descrição = estabelecimento, fornecedor = titular); linhas podem ser ignoradas | fatura de cartão |

### Aba Trocas

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Valor da troca | Valor total dos insumos enviados | Σ (quantidade × custo unitário) dos itens | preço do insumo |
| Data | Competência da troca | `data_competencia` | `financial.trocas` |
| De → Para | Bar emissor → bar recebedor | `bar_origem` (vermelho) → `bar_destino` (verde) | `financial.trocas` |
| Itens | Insumos e quantidades | Lista dos itens da troca | itens da troca |
| Conta Azul | Estado do lançamento e do PIX | Status da troca + status do PIX no Inter | `financial.trocas` |

## Filtros e opções

- **Bar (topo):** tudo é filtrado por `bar_id`; nas opções de aprovação, categorias/contas/Inter vêm do **bar do pedido**, não do bar selecionado no topo (evita pagar da empresa errada).
- **Sub-abas por status** (Solicitado / Aprovado / Recusado / Todos / Consolidado).
- **Só c/ comprovante:** mostra só pedidos que exigem comprovante.
- **Mostrando: meus / todos** (só financeiro): alterna entre ver os próprios pedidos ou os do bar inteiro.
- **Aprovar todos / Agendar todos:** ações em lote, sempre **sequenciais** (um de cada vez, para não estourar o limite de requisições do Conta Azul / Inter).
- **Cartão:** busca por estabelecimento, "Só compras", "Esconder lançados" e filtros de coluna (titular, cartão, categoria) no cabeçalho da tabela.

## Regras e detalhes importantes

- **Filtragem por bar:** toda query é escopada ao `bar_id` do usuário; um pedido só é aprovado/agendado se pertencer ao bar selecionado.
- **Vencimento × competência:** *vencimento* é quando se paga (e agenda no Inter); *competência* é quando o custo aconteceu (define o lançamento no Conta Azul). No pedido manual o vencimento **não pode ser no passado**.
- **Conta pagadora manda na credencial Inter:** a conta pagadora escolhida determina de qual empresa/credencial do Inter o PIX sai. Sem escolha, usa a **conta pagadora padrão do bar**.
- **Ordem banco → Conta Azul (execução):** ao agendar, o Zykor **fala com o Inter primeiro**; só cria a conta no Conta Azul depois que o banco aceita. Se o banco falha, nada é lançado no CA. O processo é **idempotente** — um novo "Agendar" após erro reaproveita o que já deu certo (código do Inter, lançamentos já criados).
- **Copia e cola / QR é manual:** esse pedido não passa pelo Inter automaticamente; fica em *aprovado* e é quitado com **Marcar como pago** depois de o sócio colar o código no app.
- **Boletos:** são pedidos de fornecedor com **linha digitável**. Sem a linha, o Inter não paga automático (o sistema avisa e deixa criar mesmo assim). A leitura por IA/câmera preenche valor, vencimento, beneficiário e linha; a **competência é sempre preenchida por quem sobe**.
- **Validação da linha digitável:** a linha é conferida pelos **dígitos verificadores** (44/47/48 dígitos). Se a leitura por IA vier truncada ou com dígito trocado (ex.: 46 dígitos), o sistema **relê o boleto automaticamente** uma vez; se ainda ficar inválida, o campo fica **vermelho com aviso** e a criação pede confirmação — evitando que um boleto quebrado só falhe lá na hora de pagar no Inter. Nesse caso, confira e cole a linha correta antes de criar.
- **Sugestão de categoria:** só aparece para quem aprova e para pedidos pendentes sem categoria; é apenas um pré-preenchimento a confirmar. No **freela** a sugestão é **por função** (garçom, bartender, cozinha…), aprendida do histórico de diárias já aprovadas com aquela função.
- **Freela (modelo por competência):** semana seg→dom paga na terça seguinte. Ao encerrar, as diárias de cada pessoa são **agrupadas num único pedido** (uma **competência** por dia). Assim o financeiro decide o **fornecedor uma vez** (por pessoa) e a **categoria por diária**, e o **Subir** faz **1 PIX pela pessoa toda + 1 lançamento no Conta Azul por diária** (cada um com a sua categoria). Freela sem fornecedor no CA é vinculado pelo financeiro na aprovação. Freelas lançados no modelo antigo (uma conta por diária) continuam aparecendo como cards de uma linha só.
- **Ciclo do sócio (webhook Inter):** depois de subido, o pedido fica **Aguardando aprovação sócio** (laranja, aba Aprovado). O webhook do Inter promove sozinho: sócio aprova → **Agendado** (Finalizado) → na data → **Pago**; sócio recusa → **Recusado pelo sócio** (Finalizado). Pagamento efetivado no mesmo dia pula direto para **Pago**.
- **Exclusão vs cancelamento:** só admin pode **excluir** definitivamente (pedidos de teste/duplicados). Nos **freelas**, o financeiro pode **excluir/cancelar** o pagamento de uma pessoa mesmo depois de aprovado ou subido — se já foi ao Inter, o Zykor cancela o agendamento no banco antes; se já há lançamento no Conta Azul, ele **não** apaga (o CA não tem exclusão via API) e avisa para removê-lo à mão.
- **Tempo real:** a lista atualiza sozinha via broadcast quando alguém cria/aprova/paga, com poll silencioso de reserva a cada 12 s na aba PIX.
- **Auditoria:** cada mudança de campo/status gera linha de **histórico**, e transições importantes viram **comentário do sistema** na thread do pedido.
- **Arredondamento:** valores de competência são arredondados para 2 casas; o total é a soma dessas linhas.

## Dúvidas frequentes

**Aprovar já paga?**
Não. Aprovar só confirma os dados e manda o pedido para a aba *Aprovado*. Quem cria a conta no Conta Azul e dispara o PIX é o botão **Agendar**.

**Por que meu pedido não some depois de agendar?**
Ele muda para *Agendado*, mas o dinheiro só sai depois do **OK final do sócio no app do Inter**. O Zykor agenda; o banco confirma.

**O que fazer quando aparece "Erro Conta Azul" ou "Erro Inter"?**
Abra o pedido, leia a mensagem de erro, corrija o que faltou (conta, credencial, linha digitável…) e clique em **Tentar de novo**. O processo reaproveita o que já deu certo, sem duplicar.

**Não achei o fornecedor no Conta Azul. E agora?**
No detalhe do pedido, use o cadastro rápido ("Não achou o contato? Cadastre no Conta Azul") informando nome e, se tiver, CPF/CNPJ. Ele já é vinculado ao pedido.

**Como funciona "1 PIX, várias competências"?**
O pagamento sai uma vez só pelo total, mas o Zykor cria **um lançamento por competência** no Conta Azul, útil para separar meses/notas de um mesmo pagamento.

**Todo mundo vê todos os pedidos?**
Não. Quem não tem permissão de aprovação só vê e cria os próprios. O financeiro vê todos os do bar e pode alternar "meus/todos".

## Fonte dos dados

**Schema `financial`:**
- `pedidos_pagamento` — o pedido em si (valor, status, vínculos CA/Inter, datas).
- `pedidos_pagamento_competencias` — as linhas de competência (1 PIX → N lançamentos).
- `pedidos_pagamento_comentarios` — thread de comentários e mensagens do sistema.
- `pedidos_pagamento_historico` — auditoria de mudanças de campo/status.
- `beneficiarios` — cadastro de freelas/beneficiários (PIX, CPF, categoria, fornecedor CA).
- `pagamento_config_bar` — memoriza a conta pagadora + credencial Inter padrão do bar.
- `trocas` (+ itens) — trocas de insumo entre bares.
- `cartao_cadastro` — contas de cartão (banco + tipo + dono) que agrupam as faturas.
- `cartao_faturas` (+ `cartao_fatura_linhas`) — faturas de cartão e suas transações.
- `cartao_fornecedor_map` — de-para **final do cartão → fornecedor (titular)** no Conta Azul, por bar.

**Schema `bronze` (espelho do Conta Azul):**
- `bronze_contaazul_pessoas` — fornecedores/contatos.
- `bronze_contaazul_contas_financeiras` — contas pagadoras e o mapeamento para a credencial do Inter.

**Integrações de origem:**
- **Conta Azul** — categorias de despesa, centros de custo, contas financeiras, fornecedores e criação das contas a pagar (lançamentos).
- **Banco Inter** — emissão do PIX e do pagamento de boleto (por credencial derivada da conta pagadora).
- **IA (leitura de boleto)** — OCR de foto/PDF do boleto em `/api/financeiro/boleto/ler`; leitura por câmera do código de barras.
- **Fatura de cartão** — importação de extratos Excel/OFX/CSV (Itaú, Nubank) para conferência e lançamento no Conta Azul.
