---
title: Usuários e Permissões
area: configuracoes
slug: usuarios
route: /configuracoes/administracao/usuarios
description: Cadastro de usuários do sistema, vínculo com bares e controle de acesso por módulo (ver, editar, inserir e excluir).
order: 40
icon: Users
---

# Usuários e Permissões

## Visão geral

Esta é a tela de administração de quem pode entrar no Zykor e do que cada pessoa consegue ver e fazer. A partir dela você:

- Cadastra novos usuários (que passam a poder fazer login no sistema).
- Define a quais **bares** cada pessoa tem acesso.
- Escolhe a **função** (Administrador, Funcionário ou Financeiro).
- Libera acesso **módulo por módulo**, com granularidade de ação: **Ver**, **Editar**, **Inserir** e **Excluir**.
- Reseta senha, ativa/desativa e exclui usuários.

É uma tela sensível: quem cadastra usuário aqui está criando conta real de acesso e distribuindo poder dentro do sistema. Por isso ela é restrita a administradores.

Cada usuário cadastrado aqui existe em dois lugares ao mesmo tempo: no **sistema de autenticação** (login e senha) e na **tabela de usuários do Zykor** (dados cadastrais, função e permissões). A tela mantém os dois em sincronia automaticamente.

## Como acessar

No menu lateral: **Configurações → Administração → Usuários** (rota `/configuracoes/administracao/usuarios`).

**Permissão necessária:** apenas usuários com função **Administrador** (`role = admin`) conseguem abrir a tela. Se um usuário não-admin tentar entrar, o sistema mostra "Acesso Restrito" e o redireciona para a Home. Além do bloqueio na tela, a API também exige admin — toda operação (listar, criar, editar, excluir) passa por uma verificação de administrador no servidor.

## Passo a passo

### Cadastrar um novo usuário

1. Clique em **Novo Usuário** (botão no canto superior direito).
2. Em **Dados Básicos**, preencha **Nome Completo** e **Email** (ambos obrigatórios). O email é sempre padronizado para minúsculas — não se preocupe com maiúsculas.
3. Em **Bares com Acesso**, marque **pelo menos um bar**. Sem bar selecionado o sistema não deixa salvar.
4. Escolha a **Função** (Administrador, Funcionário ou Financeiro). Se escolher Administrador, o acesso total é ligado automaticamente.
5. (Opcional) Preencha celular, CPF, data de nascimento, telefone fixo e endereço.
6. Em **Permissões**, se a pessoa não for admin, marque os módulos e ações que ela pode usar (veja a seção "Colunas e cálculos" para o significado de V/E/I/X).
7. Deixe **Usuário ativo no sistema** marcado.
8. Clique em **Criar**.

O que acontece ao criar: o sistema gera uma **senha temporária única**, cria a conta de login, grava o cadastro, associa os bares e **tenta enviar um email de boas-vindas** com as credenciais. Se o email falhar, a própria tela mostra a senha temporária na tela para você repassar manualmente ao usuário.

### Editar um usuário

1. Na linha do usuário, clique em **Editar**.
2. Ajuste dados cadastrais, bares, função ou permissões.
3. Clique em **Atualizar**.

Ao editar permissões ou função, o usuário é forçado a **relogar** para que o novo acesso valha em todo lugar (o sistema registra um "corte de token" por email). Se você editar a si mesmo, a barra lateral é atualizada na hora, sem precisar sair.

### Resetar a senha de um usuário

1. Clique em **Senha** na linha do usuário (ou no botão **Redefinir Senha** dentro da edição).
2. Confirme a ação no aviso.
3. O sistema gera uma **nova senha temporária**, atualiza a conta e **testa o login** para garantir que a senha funciona.
4. Um modal mostra a senha temporária e um **link de redefinição** (válido por 1 hora). Copie a senha ou o link e repasse ao usuário. O sistema também tenta enviar por email.

### Ativar / desativar

Na edição do usuário, use o checkbox **Usuário ativo no sistema**. Usuário inativo continua cadastrado, mas fica sem acesso.

### Excluir um usuário

1. Clique em **Excluir** na linha do usuário.
2. Confirme o aviso e digite **CONFIRMAR** quando solicitado.
3. O usuário é removido **permanentemente** — tanto do cadastro quanto do sistema de login. Essa ação não pode ser desfeita.

### Buscar e filtrar

- Use o campo **Buscar usuários** para filtrar por nome ou email.
- Use o seletor de **função** para mostrar só Administradores, Funcionários ou Financeiro.

## Abas e seções

A tela não tem abas. O conteúdo se divide em:

- **Barra de filtros** (busca + função) e botão **Novo Usuário**.
- **Tabela de usuários** (lista principal).
- **Modal de criação/edição**, organizado em três blocos: **Dados Básicos**, **Endereço** e **Permissões** (+ status ativo).
- **Modal de redefinição de senha**, com a senha temporária, o link de redefinição, o status do envio de email e as instruções para o usuário.

O bloco **Permissões** do modal traz o checkbox **Administrador (acesso total)** e, logo abaixo, a matriz **Acesso por módulo**, agrupada por categoria (as mesmas categorias do menu lateral). Cada categoria tem um atalho **Marcar todos** e mostra um contador do tipo "3/8" (quantos módulos daquela categoria estão liberados).

## Colunas e cálculos

Colunas da tabela principal de usuários:

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Nome | Nome completo do usuário | Campo `nome` do cadastro, exibido direto | `auth_custom.usuarios.nome` |
| Email | Email de login | Campo `email` (sempre normalizado em minúsculas ao salvar) | `auth_custom.usuarios.email` |
| Função | Papel do usuário (Administrador, Funcionário ou Financeiro) | Campo `role` traduzido para rótulo amigável | `auth_custom.usuarios.role` |
| Bares | Bares aos quais o usuário tem acesso | Lista os bares vinculados: usa `bares_ids` (novo) e cai para `bar_id` (legado) se não houver; até 2 mostra os nomes, acima de 2 mostra "N bares" | `auth_custom.usuarios_bares` (join com lista de bares de `/api/configuracoes/bars`) |
| Módulos | Quantos módulos o usuário tem liberados | Contagem simples do array `modulos_permitidos` (`modulos_permitidos.length`) | `auth_custom.usuarios.modulos_permitidos` |
| Status | Se o usuário está ativo | Ícone de check quando `ativo = true`, ícone apagado quando `false` | `auth_custom.usuarios.ativo` |
| Ações | Botões Editar, Senha e Excluir | Sem cálculo — dispara as operações descritas no passo a passo | — |

Matriz de permissões no modal (V / E / I / X por módulo):

| Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| V (Ver) | Se o usuário pode abrir/visualizar o módulo | É a base do acesso; qualquer outra ação (E, I, X) implica automaticamente Ver | `modulos_permitidos` |
| E (Editar) | Se pode editar registros do módulo | Token `<modulo>:editar` marcado, ou módulo com acesso total | `modulos_permitidos` |
| I (Inserir) | Se pode criar novos registros | Token `<modulo>:inserir` marcado, ou módulo com acesso total | `modulos_permitidos` |
| X (Excluir) | Se pode excluir registros | Token `<modulo>:excluir` marcado, ou módulo com acesso total | `modulos_permitidos` |
| Contador "X/Y" da categoria | Quantos módulos da categoria têm ao menos "Ver" | Conta os módulos da categoria em que a ação **Ver** está ativa, sobre o total da categoria | derivado de `modulos_permitidos` |

**Como as permissões são guardadas (importante):** o campo `modulos_permitidos` é uma lista de "tokens". Um token "liso" (ex.: `operacional_producao`) significa **acesso total** àquele módulo (V+E+I+X). Um token com ação (ex.: `operacional_producao:ver`) significa **acesso parcial** — só aquela ação. Marcar "Ver" liga o acesso mínimo; desmarcar "Ver" remove todas as ações do módulo. O token especial `todos` (ligado pelo checkbox **Administrador**) concede tudo.

## Filtros e opções

| Filtro / Opção | Efeito |
|---|---|
| **Buscar usuários** | Filtra a lista por nome ou email (busca parcial, sem diferenciar maiúsculas). |
| **Função** (Todas / Administrador / Funcionário / Financeiro) | Mostra só os usuários com a função escolhida. |
| **Administrador (acesso total)** (no modal) | Liga o acesso a todos os módulos automaticamente e desabilita a matriz manual; ao ligar, a função vira Administrador. |
| **Marcar todos** (por categoria, no modal) | Libera acesso total (V+E+I+X) a todos os módulos daquela categoria de uma vez; desmarcar remove todos. |
| **Bares com Acesso** (no modal) | Define em quais bares o usuário entra. Obrigatório ao menos um. |
| **Usuário ativo no sistema** | Liga/desliga o acesso sem apagar o cadastro. |

## Regras e detalhes importantes

- **Acesso restrito a admin:** tanto a tela quanto a API só respondem a administradores. Não-admins são bloqueados e redirecionados.
- **Email sempre em minúsculas:** ao criar ou editar, o email é normalizado (minúsculas, sem espaços). Isso evita o problema clássico de "usuário sem vínculo" no primeiro acesso, quando o email na tabela ficava diferente do email no sistema de login.
- **Dois registros por usuário:** cada pessoa tem uma conta no sistema de autenticação (login/senha) e uma linha na tabela de usuários. A tela cria, atualiza e apaga os dois juntos. Se a criação da linha falhar depois da conta de login, a conta de login é desfeita para não deixar "órfão".
- **Vínculo com bar é por `auth_id`:** a tabela que liga usuário a bar (`usuarios_bares`) usa o identificador de autenticação do usuário, não o id numérico do cadastro. Ao editar, os vínculos antigos são apagados e recriados com os bares selecionados.
- **`bares_ids` (novo) vs `bar_id` (legado):** o modelo atual permite **vários bares por usuário**. Cadastros antigos que só tinham um `bar_id` continuam funcionando — a tela cai para esse valor quando não há a lista nova.
- **Edição de permissão força relogin:** ao salvar mudanças, o sistema grava um "corte de token" por email, obrigando o usuário a entrar de novo para carregar as permissões atualizadas em todo o sistema.
- **Senha temporária:** tanto ao criar quanto ao resetar, a senha gerada é **única e temporária**. Na criação o padrão começa com `Zk!`; no reset começa com `Temp`. O usuário deve trocá-la no primeiro acesso.
- **Reset testa o login:** ao redefinir senha, o sistema efetivamente tenta logar com a nova senha para garantir que funciona antes de mostrar ao admin. Se o email no sistema de login for diferente do email do cadastro, a tela avisa qual email usar para entrar.
- **Link de redefinição expira em 1 hora.**
- **Exclusão é permanente e pede dupla confirmação** (aviso + digitar "CONFIRMAR"). Remove o usuário do cadastro e do sistema de login.
- **Módulos vêm do menu:** a lista de módulos da matriz de permissões é gerada automaticamente a partir do menu lateral (fonte única). Sempre que uma página nova entra no menu, ela aparece aqui para ser liberada.
- **Estado vazio:** se nenhum usuário casar com a busca/filtro, a tela mostra "Nenhum usuário encontrado"; se não houver nenhum cadastrado, mostra "Nenhum usuário cadastrado".

## Dúvidas frequentes

**Por que não consigo abrir esta tela?**
Ela é exclusiva para administradores. Se você vê "Acesso Restrito", sua função não é admin — peça a um administrador para ajustar.

**Criei o usuário mas o email não chegou. E agora?**
Sem problema: quando o email falha, a própria tela exibe as credenciais (email + senha temporária) para você repassar por WhatsApp ou outro canal. O usuário troca a senha no primeiro login.

**Qual a diferença entre desativar e excluir?**
Desativar mantém o cadastro e o histórico, apenas tira o acesso — dá para reativar depois. Excluir apaga tudo permanentemente (cadastro e login) e não pode ser desfeito.

**O usuário editou as permissões e nada mudou para ele. Por quê?**
Mudanças de permissão só valem depois que a pessoa **relogar**. O sistema já força isso, mas o usuário precisa sair e entrar de novo (ou fechar e reabrir a sessão).

**Um usuário pode ter acesso a mais de um bar?**
Sim. Em "Bares com Acesso" marque quantos bares quiser. É obrigatório ao menos um.

**O que significam as letras V, E, I e X?**
Ver, Editar, Inserir e Excluir. "Ver" é o acesso básico; marcar Editar, Inserir ou Excluir liga o "Ver" automaticamente. Deixar tudo marcado equivale a acesso total ao módulo.

## Fonte dos dados

- **`auth_custom.usuarios`** — cadastro do usuário: nome, email, função (`role`), `modulos_permitidos`, `ativo`, dados de contato/endereço, `auth_id`, controle de senha (`senha_redefinida`, `reset_token`).
- **`auth_custom.usuarios_bares`** — vínculo entre usuário (por `auth_id`) e bar (`bar_id`).
- **Supabase Auth (`auth.users`)** — conta de login/senha, criada e sincronizada junto ao cadastro.
- **`system.user_token_cutoff`** — registro que força relogin após mudança de permissão/função.
- **API `/api/configuracoes/usuarios`** — GET/POST/PUT/DELETE de usuários (todos exigem admin).
- **API `/api/configuracoes/permissoes`** — lista de módulos e funções padrão, gerada a partir do menu lateral (`lib/permissions/modules.ts` + `lib/navigation/menu.ts`).
- **API `/api/configuracoes/bars`** — lista de bares para o seletor de acesso.
- **API `/api/configuracoes/usuarios/redefinir-senha`** — geração de senha temporária e link de redefinição.

Esta tela é de administração interna do Zykor; não puxa dados de integrações externas (ContaHub, NIBO, Conta Azul, Stone etc.).
