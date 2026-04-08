# Correção: Loop de Redirecionamento para Login

**Data**: 08 de Abril de 2026  
**Problema**: Usuários com senha salva no navegador ficam em loop de redirecionamento para a tela de login

## Problema Identificado

O sistema estava com um problema de gestão de sessão onde:

1. O navegador preenchia automaticamente email e senha
2. O login era feito via API (`/api/auth/login`)
3. O token JWT era gerado e salvo em cookie
4. MAS a sessão do Supabase Auth Client não era registrada
5. Em requisições subsequentes, o middleware validava o JWT mas o cliente Supabase não tinha sessão
6. Isso causava redirecionamentos constantes para `/login`

## Solução Implementada

### 1. Criação de API de Validação de Sessão
**Arquivo**: `frontend/src/app/api/auth/validate/route.ts`

- Valida se o token JWT está presente e válido
- Retorna informações do usuário se válido
- Usado para verificar sessão antes de redirecionar

### 2. Criação de API de Refresh Token
**Arquivo**: `frontend/src/app/api/auth/refresh/route.ts`

- Renova o token JWT usando refresh token
- Atualiza dados do usuário do banco
- Gera novo token com 7 dias de validade

### 3. Gerenciador de Sessão
**Arquivo**: `frontend/src/lib/auth/session-manager.ts`

Funções criadas:
- `hasValidSession()`: Verifica se há sessão válida, tenta renovar se expirada
- `clearSession()`: Limpa todos os dados de sessão (localStorage + cookies)
- `validateAndSyncSession()`: Valida e sincroniza sessão com dados do servidor
- `setupSessionSync()`: Configura listeners para sincronização entre abas

### 4. Componente SessionManager
**Arquivo**: `frontend/src/components/SessionManager.tsx`

- Componente client-side que roda em todas as páginas
- Verifica sessão ao carregar página
- Redireciona para login se sessão inválida
- Sincroniza sessão entre abas abertas

### 5. Melhorias na Página de Login
**Arquivo**: `frontend/src/app/login/page.tsx`

Mudanças:
- Usa `validateAndSyncSession()` para verificar se usuário já está logado
- Registra sessão no Supabase Auth Client após login tradicional
- Configura sincronização de sessão entre abas
- Limpa dados locais se sessão inválida

### 6. Melhorias no Middleware
**Arquivo**: `frontend/middleware.ts`

- Logs mais detalhados sobre validação de autenticação
- Melhor tratamento de erros ao parsear cookies
- Validação mais robusta de tokens JWT

### 7. Integração no Layout Raiz
**Arquivo**: `frontend/src/app/layout.tsx`

- `SessionManager` adicionado ao layout raiz
- Garante que todas as páginas tenham validação de sessão

## Fluxo de Autenticação Corrigido

### Login Tradicional (Email + Senha)
1. Usuário preenche email e senha (pode ser auto-preenchido)
2. Frontend chama `/api/auth/login`
3. Backend valida credenciais no Supabase Auth
4. Backend gera JWT e refresh token
5. Backend salva tokens em cookies httpOnly
6. **NOVO**: Frontend registra sessão no Supabase Auth Client
7. Frontend salva dados em localStorage (cache)
8. Redireciona para `/home` ou `returnUrl`

### Validação de Sessão em Páginas
1. `SessionManager` verifica sessão ao carregar página
2. Chama `/api/auth/validate` para verificar JWT
3. Se JWT válido: continua navegação
4. Se JWT expirado: tenta renovar com `/api/auth/refresh`
5. Se renovação bem-sucedida: continua navegação
6. Se renovação falha: redireciona para `/login`

### Sincronização Entre Abas
1. `setupSessionSync()` configura listener de storage
2. Quando usuário desloga em uma aba:
   - Evento de storage é disparado
   - Outras abas detectam mudança
   - Limpam sessão local
   - Redirecionam para `/login`

### Renovação Automática de Token
1. A cada 5 minutos, `SessionManager` verifica sessão
2. Se token expirou, chama `/api/auth/refresh`
3. Novo token é gerado e salvo em cookie
4. Sessão continua ativa sem interrupção

## Arquivos Modificados

### Novos Arquivos
- `frontend/src/app/api/auth/validate/route.ts`
- `frontend/src/app/api/auth/refresh/route.ts`
- `frontend/src/lib/auth/session-manager.ts`
- `frontend/src/components/SessionManager.tsx`

### Arquivos Modificados
- `frontend/src/app/login/page.tsx`
- `frontend/middleware.ts`
- `frontend/src/app/layout.tsx`

## Como Testar

### Teste 1: Login com Senha Salva
1. Limpar cookies e localStorage
2. Fazer login e salvar senha no navegador
3. Fechar aba
4. Abrir nova aba e acessar `https://zykor.com.br`
5. **Esperado**: Deve redirecionar para `/login` e permitir login sem loop

### Teste 2: Sessão Persistente
1. Fazer login normalmente
2. Navegar entre páginas
3. Fechar navegador
4. Reabrir navegador e acessar `https://zykor.com.br/home`
5. **Esperado**: Deve manter sessão ativa (se dentro de 7 dias)

### Teste 3: Sincronização Entre Abas
1. Fazer login em uma aba
2. Abrir segunda aba e acessar Zykor
3. Na primeira aba, fazer logout
4. **Esperado**: Segunda aba deve detectar logout e redirecionar para login

### Teste 4: Renovação Automática
1. Fazer login
2. Aguardar 5 minutos
3. Continuar usando o sistema
4. **Esperado**: Token deve ser renovado automaticamente sem interrupção

### Teste 5: Token Expirado
1. Fazer login
2. Manualmente deletar cookie `auth_token` (DevTools)
3. Tentar acessar qualquer página
4. **Esperado**: Deve tentar renovar com refresh token ou redirecionar para login

## Logs para Monitoramento

### Console do Navegador
- `✅ Sessão válida encontrada, redirecionando...`
- `⚠️ Token inválido ou expirado, limpando dados...`
- `🔄 Token expirado, tentando renovar...`
- `✅ Token renovado com sucesso`
- `✅ Sessão registrada no Supabase Auth Client`

### Logs do Servidor (Middleware)
- `✅ MIDDLEWARE: Token JWT válido para [email]`
- `⚠️ MIDDLEWARE: Token JWT inválido ou expirado`
- `✅ MIDDLEWARE: Cookie sgb_user válido para [email]`
- `🚫 MIDDLEWARE: Nenhuma autenticação válida encontrada`

### Logs da API de Validação
- `✅ [VALIDATE] Token válido para [email]`
- `⚠️ [VALIDATE] Token não encontrado`
- `⚠️ [VALIDATE] Token inválido ou expirado`

## Compatibilidade

### Mantido para Compatibilidade
- Cookie `sgb_user` (não httpOnly) - usado como cache client-side
- localStorage `sgb_user` - cache de dados do usuário
- Validação via cookie `sgb_user` no middleware (fallback)

### Fonte de Verdade
- Cookie `auth_token` (httpOnly) - JWT com 7 dias de validade
- Cookie `refresh_token` (httpOnly) - JWT com 30 dias de validade

## Próximos Passos (Futuro)

1. **Migração Completa para JWT**: Remover dependência de `sgb_user` cookie
2. **WebSocket para Logout**: Notificar logout em tempo real entre dispositivos
3. **Biometria**: Melhorar fluxo de login biométrico com mesma validação
4. **Monitoramento**: Adicionar métricas de sessão (tempo médio, renovações, etc)

## Notas Técnicas

### Por que Supabase Auth Client?
O Supabase SDK mantém sua própria sessão interna. Mesmo com JWT válido, se o cliente Supabase não tem sessão registrada, algumas operações podem falhar. Por isso, após login tradicional, registramos a sessão no cliente.

### Por que Dois Tokens?
- **auth_token**: Token de acesso curto (7 dias) para operações do dia a dia
- **refresh_token**: Token de renovação longo (30 dias) para renovar auth_token sem novo login

### Por que localStorage + Cookie?
- **Cookie httpOnly**: Seguro contra XSS, usado pelo servidor
- **localStorage**: Acesso rápido client-side para dados do usuário (cache)
- **Cookie não-httpOnly (sgb_user)**: Compatibilidade com código legado

## Segurança

### Proteções Implementadas
- Tokens JWT assinados com secret
- Cookies httpOnly para tokens sensíveis
- Validação de expiração em múltiplas camadas
- Limpeza automática de sessão inválida
- Rate limiting na API de login (já existente)

### Considerações
- JWT_SECRET deve ser forte e mantido em segredo
- HTTPS obrigatório em produção (cookies secure)
- Tokens não podem ser revogados (usar blacklist se necessário no futuro)

## Troubleshooting

### Problema: Ainda redireciona para login
**Verificar**:
1. Console do navegador - qual log aparece?
2. Cookies - `auth_token` e `refresh_token` estão presentes?
3. Network tab - `/api/auth/validate` retorna 200?
4. localStorage - `sgb_user` está presente e válido?

### Problema: Erro "JWT_SECRET não configurado"
**Solução**: Adicionar `JWT_SECRET` no `.env` do frontend

### Problema: Token expira muito rápido
**Verificar**: Relógio do servidor está sincronizado? JWT usa timestamp Unix.

### Problema: Sessão não sincroniza entre abas
**Verificar**: localStorage está habilitado? Navegador permite storage events?

## Conclusão

Esta correção resolve o problema de loop de login implementando:
1. Validação robusta de sessão
2. Renovação automática de tokens
3. Sincronização entre abas
4. Melhor gestão do ciclo de vida da sessão

O sistema agora mantém a sessão consistente mesmo com senha salva no navegador.
