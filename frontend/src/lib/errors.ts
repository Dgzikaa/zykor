/**
 * Erros de dominio padronizados.
 *
 * Use esses erros nos services/repositories. O middleware HTTP
 * (lib/http/with-auth.ts) converte automaticamente para a resposta
 * HTTP correta.
 */

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// 401
export class UnauthorizedError extends AppError {
  constructor(message = 'Nao autorizado') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

// 403
export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado') {
    super(message, 'FORBIDDEN', 403);
  }
}

// 404
export class NotFoundError extends AppError {
  constructor(entity: string, id?: string | number) {
    super(
      id !== undefined ? `${entity} ${id} nao encontrado` : `${entity} nao encontrado`,
      'NOT_FOUND',
      404,
      { entity, id }
    );
  }
}

// 400
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

// 409
export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFLICT', 409, details);
  }
}

// 500
export class RepositoryError extends AppError {
  constructor(operation: string, original: unknown) {
    super(
      `Erro de banco em ${operation}`,
      'REPOSITORY_ERROR',
      500,
      { operation, original: serializeError(original) }
    );
  }
}

// 500
export class ConfigAusenteError extends AppError {
  constructor(config: string, context?: string | number) {
    super(
      `Configuracao ausente: ${config}${context ? ` (contexto: ${context})` : ''}`,
      'CONFIG_AUSENTE',
      500,
      { config, context }
    );
  }
}

// helper
function serializeError(err: unknown): unknown {
  if (err instanceof Error) {
    return { name: err.name, message: err.message };
  }
  return err;
}
