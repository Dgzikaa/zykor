/**
 * Sistema de Autenticação Unificado
 * Exporta todas as funções e tipos necessários
 */

// Tipos
export type {
  AuthenticatedUser,
  AuthToken,
  AuthResponse,
  AuditEvent,
} from './types';

// JWT
export {
  generateToken,
  validateToken,
  decodeToken,
  isTokenExpired,
  generateRefreshToken,
  validateRefreshToken,
  getTokenTimeRemaining,
} from './jwt';

// Permissions
export {
  MODULES,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  isAdmin,
  canManageFinancial,
  canManageOperations,
  canManageMarketing,
  getUserPermissions,
  canAccessRoute,
} from './permissions';

// Server-side authentication
export {
  authenticateRequest,
  validateBarAccess,
  requireAuth,
  requireAdmin,
  requirePermission,
  requireBarAccess,
  authErrorResponse,
  permissionErrorResponse,
} from './server';

// Auditoria
export {
  logAuditEvent,
  getAuditLogs,
} from './audit';

// API Wrappers
export {
  withAuth,
  withAuthAndLog,
  extractBarId,
  normalizeModulos,
  canModifyUser,
} from './api-wrapper';

// Monitoring
export type { SecurityAlert } from './monitoring';
export {
  logSecurityAlert,
  checkFailedLogins,
  checkUnauthorizedAccess,
  monitorPermissionChange,
  monitorSensitiveDataAccess,
  getSecurityAlertsSummary,
} from './monitoring';
