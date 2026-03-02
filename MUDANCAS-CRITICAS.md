# Mudanças Críticas para Login Funcionar

## Arquivos que DEVEM ser atualizados:

### 1. API de Login
- `frontend/src/app/api/auth/login/route.ts`
  - Buscar usuário com `.single()` ao invés de array
  - Buscar bares via `usuarios_bares`
  - Usar `auth_id` ao invés de `user_id`

### 2. API user-bars
- `frontend/src/app/api/configuracoes/bars/user-bars/route.ts`
  - Buscar usuário único
  - Join com `usuarios_bares`

### 3. Middleware
- `frontend/src/middleware/auth.ts`
  - Atualizar interface `AuthenticatedUser` com `auth_id`

## Arquivos que podem esperar:
- Todos os outros podem ser corrigidos depois do login funcionar
