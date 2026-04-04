/**
 * Tipos unificados para autenticação
 * Usado em TODO o sistema - server e client
 */

export interface AuthenticatedUser {
  // Identificação
  id: number;                    // ID na tabela usuarios
  auth_id: string;               // UUID do Supabase Auth
  email: string;
  nome: string;
  
  // Autorização
  role: 'admin' | 'manager' | 'financeiro' | 'funcionario';
  bar_id: number;                // Bar atualmente selecionado
  modulos_permitidos: string[];  // SEMPRE array de strings
  
  // Status
  ativo: boolean;
  senha_redefinida?: boolean;
  
  // Metadados (opcional)
  setor?: string;
  telefone?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Dados armazenados no token JWT
 */
export interface AuthToken {
  user_id: number;
  auth_id: string;
  email: string;
  bar_id: number;
  role: string;
  modulos_permitidos: string[];
  iat: number;  // Issued at
  exp: number;  // Expiration
}

/**
 * Resposta de autenticação
 */
export interface AuthResponse {
  success: boolean;
  user?: AuthenticatedUser;
  availableBars?: Array<{
    id: number;
    nome: string;
    role: string;
    modulos_permitidos: string[];
  }>;
  token?: string;
  error?: string;
}

/**
 * Evento de auditoria
 */
export interface AuditEvent {
  user_id: number;
  action: string;
  resource: string;
  resource_id?: string;
  changes?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}
