/**
 * Helpers para construir respostas HTTP padronizadas.
 */
import { NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';
import { z } from 'zod';

export function success<T>(data: T, init?: { status?: number; meta?: Record<string, unknown> }) {
  return NextResponse.json(
    { success: true, data, ...(init?.meta ? { meta: init.meta } : {}) },
    { status: init?.status ?? 200 }
  );
}

export function fail(error: string, status = 500, details?: unknown) {
  return NextResponse.json(
    { success: false, error, ...(details ? { details } : {}) },
    { status }
  );
}

/**
 * Converte qualquer erro lancado em service/repository para a resposta
 * HTTP apropriada. Centraliza o tratamento.
 */
export function handleError(error: unknown): NextResponse {
  // Erros de dominio (AppError e subclasses)
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code,
        ...(error.details ? { details: error.details } : {}),
      },
      { status: error.statusCode }
    );
  }

  // Erros de validacao Zod
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: error.issues,
      },
      { status: 400 }
    );
  }

  // Erros nao previstos
  console.error('[handleError] Erro nao tratado:', error);
  const message = error instanceof Error ? error.message : 'Erro desconhecido';
  return NextResponse.json(
    { success: false, error: 'Erro interno do servidor', details: message },
    { status: 500 }
  );
}
