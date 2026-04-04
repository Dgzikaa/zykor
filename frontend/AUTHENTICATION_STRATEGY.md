# Estratégia de Autenticação Unificada

## Hierarquia de Autenticação

### 1. JWT via Cookie HttpOnly `auth_token` (PRIMÁRIO)
- **Gerado no login**: `/api/auth/login`
- **Validade**: 7 dias
- **Segurança**: HttpOnly, Secure (produção), SameSite=Lax
- **Conteúdo**:
  ```typescript
  {
    user_id: number,
    auth_id: string,
    email: string,
    bar_id: number,
    role: 'admin' | 'manager' | 'funcionario',
    modulos_permitidos: string[]
  }
  ```

### 2. Header `x-selected-bar-id` (Multi-tenancy)
- **Enviado pelo client**: Via `localStorage.getItem('sgb_selected_bar_id')`
- **Validado no servidor**: Verifica se usuário tem acesso ao bar
- **Fallback**: Usa `bar_id` do JWT se header não fornecido

### 3. Cookie Legado `sgb_user` (DEPRECADO)
- **Status**: Mantido temporariamente para compatibilidade
- **Será removido**: Após migração completa
- **Não usar em novas implementações**

## Fluxo de Autenticação

```
┌─────────────┐
│   Cliente   │
└──────┬──────┘
       │ 1. POST /api/auth/login
       │    { email, password }
       ▼
┌─────────────────────┐
│  API Login          │
│  - Valida Supabase  │
│  - Gera JWT         │
│  - Set Cookie       │
└──────┬──────────────┘
       │ 2. Response
       │    { user, token }
       │    Set-Cookie: auth_token=...
       ▼
┌─────────────┐
│   Cliente   │
│  - Salva em │
│  localStorage│
└──────┬──────┘
       │ 3. Request API
       │    Cookie: auth_token=...
       │    x-selected-bar-id: 3
       ▼
┌─────────────────────────┐
│  API Route              │
│  - getAuthenticatedUser │
│  - Valida JWT           │
│  - Valida bar_id        │
└──────┬──────────────────┘
       │ 4. Response
       │    { data }
       ▼
┌─────────────┐
│   Cliente   │
└─────────────┘
```

## Como Usar

### Em API Routes

#### 1. Autenticação Simples
```typescript
import { requireAuth, getBarIdFromRequest } from '@/lib/auth';

export const GET = requireAuth(async (request, user) => {
  const barId = getBarIdFromRequest(request, user);
  
  // user está autenticado
  // barId é validado
  
  return NextResponse.json({ data: ... });
});
```

#### 2. Apenas Admin
```typescript
import { requireAdmin } from '@/lib/auth';

export const POST = requireAdmin(async (request, user) => {
  // user é admin
  return NextResponse.json({ data: ... });
});
```

#### 3. Permissão Específica
```typescript
import { requirePermission } from '@/lib/auth';

export const GET = requirePermission('eventos')(async (request, user) => {
  // user tem permissão para módulo 'eventos'
  return NextResponse.json({ data: ... });
});
```

#### 4. Autenticação Manual (casos especiais)
```typescript
import { getAuthenticatedUser, getBarIdFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  
  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  
  const barId = getBarIdFromRequest(request, user);
  
  // ...
}
```

### No Cliente (Frontend)

#### 1. Fazer Chamadas API
```typescript
import { api } from '@/lib/api-client';

// Cookie JWT é enviado automaticamente
// x-selected-bar-id é adicionado automaticamente
const data = await api.get('/api/eventos');
```

#### 2. Trocar Bar Selecionado
```typescript
// Atualizar localStorage
localStorage.setItem('sgb_selected_bar_id', String(newBarId));

// Próximas chamadas usarão o novo bar_id
const data = await api.get('/api/eventos');
```

## Arquivos Principais

### Core
- `frontend/src/lib/auth/get-user.ts` - Helper principal de autenticação
- `frontend/src/lib/auth/middleware.ts` - Wrappers (requireAuth, requireAdmin, etc)
- `frontend/src/lib/auth/jwt.ts` - Funções JWT
- `frontend/src/lib/auth/index.ts` - Exports unificados

### Cliente
- `frontend/src/lib/api-client.ts` - Cliente HTTP com auth automática
- `frontend/src/middleware.ts` - Middleware Next.js (validação de rotas)

### APIs
- `frontend/src/app/api/auth/login/route.ts` - Gera JWT
- `frontend/src/app/api/auth/me/route.ts` - Valida sessão
- `frontend/src/app/api/auth/logout/route.ts` - Limpa cookies

## Migração de APIs Antigas

### Antes (DEPRECADO)
```typescript
export async function GET(request: NextRequest) {
  // ❌ Extrair manualmente
  const barIdHeader = request.headers.get('x-selected-bar-id');
  const barId = barIdHeader ? parseInt(barIdHeader) : null;
  
  if (!barId) {
    return NextResponse.json({ error: 'bar_id obrigatório' }, { status: 400 });
  }
  
  // Sem autenticação!
  const { data } = await supabase.from('eventos').select('*').eq('bar_id', barId);
  
  return NextResponse.json({ data });
}
```

### Depois (RECOMENDADO)
```typescript
import { requireAuth, getBarIdFromRequest } from '@/lib/auth';

export const GET = requireAuth(async (request, user) => {
  const barId = getBarIdFromRequest(request, user);
  
  // ✅ Autenticado e validado
  const { data } = await supabase
    .from('eventos')
    .select('*')
    .eq('bar_id', barId);
  
  return NextResponse.json({ data });
});
```

## Segurança

### ✅ Boas Práticas Implementadas
1. **JWT em HttpOnly Cookie** - Não acessível via JavaScript (XSS protection)
2. **Secure em Produção** - HTTPS obrigatório
3. **SameSite=Lax** - CSRF protection
4. **Validação de Bar Access** - Usuário só acessa bares permitidos
5. **Refresh Token** - 30 dias para renovação automática
6. **Rate Limiting** - Proteção contra brute force no login

### ⚠️ Pontos de Atenção
1. **Cookie Legado** - Remover `sgb_user` após migração completa
2. **JWT_SECRET** - Deve estar configurado em produção
3. **Expiração** - Implementar refresh automático no cliente

## Status da Migração

### ✅ Implementado
- [x] Helper unificado `getAuthenticatedUser()`
- [x] Wrappers `requireAuth`, `requireAdmin`, `requirePermission`
- [x] Geração de JWT no login
- [x] Validação de JWT em API routes
- [x] Multi-tenancy via header `x-selected-bar-id`
- [x] Fallback para cookie legado (compatibilidade)

### 🔄 Em Progresso
- [ ] Migrar 380 API routes para usar novo sistema
- [ ] Remover referências a `x-user-id` (deprecado)
- [ ] Implementar refresh automático de token

### 📋 Próximos Passos
1. Migrar APIs críticas (POST, PUT, DELETE) primeiro
2. Atualizar APIs de leitura (GET)
3. Remover cookie legado `sgb_user`
4. Implementar refresh token automático no cliente
5. Adicionar testes de autenticação

## Troubleshooting

### Erro 401 (Não Autorizado)
- Verificar se cookie `auth_token` está presente
- Verificar se JWT não expirou (7 dias)
- Verificar se `JWT_SECRET` está configurado

### Erro 403 (Acesso Negado ao Bar)
- Verificar se usuário tem acesso ao bar via `usuarios_bares`
- Verificar se `x-selected-bar-id` é válido
- Admin tem acesso a todos os bares

### Cookie Não Sendo Enviado
- Verificar `credentials: 'include'` no fetch
- Verificar se domínio é o mesmo (SameSite)
- Verificar se HTTPS em produção (Secure)

## Referências

- JWT: https://jwt.io/
- HttpOnly Cookies: https://owasp.org/www-community/HttpOnly
- Next.js Middleware: https://nextjs.org/docs/app/building-your-application/routing/middleware
