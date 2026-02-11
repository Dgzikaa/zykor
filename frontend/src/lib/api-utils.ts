import { NextResponse } from 'next/server';
import { getAdminClient } from './supabase-admin';

/**
 * Utilitário para respostas de API padronizadas
 */

// Tipos de resposta
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: unknown;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Retorna uma resposta de sucesso padronizada
 */
export function successResponse<T>(data: T, message?: string, status = 200) {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
  };
  
  if (message) {
    response.message = message;
  }
  
  return NextResponse.json(response, { status });
}

/**
 * Retorna uma resposta de erro padronizada
 */
export function errorResponse(error: string, status = 500, details?: unknown) {
  const response: ApiErrorResponse = {
    success: false,
    error,
  };
  
  if (details) {
    response.details = details;
  }
  
  return NextResponse.json(response, { status });
}

/**
 * Wrapper para tratamento de erros em APIs
 */
export function handleApiError(error: unknown, context?: string) {
  console.error(`[API Error]${context ? ` ${context}:` : ''}`, error);
  
  if (error instanceof Error) {
    return errorResponse(error.message, 500);
  }
  
  return errorResponse('Erro interno do servidor', 500);
}

/**
 * Valida parâmetro obrigatório bar_id
 */
export function validateBarId(barId: string | null | undefined): { valid: true; barId: number } | { valid: false; response: NextResponse } {
  if (!barId) {
    return {
      valid: false,
      response: errorResponse('bar_id é obrigatório', 400)
    };
  }
  
  const parsed = parseInt(barId, 10);
  
  if (isNaN(parsed) || parsed <= 0) {
    return {
      valid: false,
      response: errorResponse('bar_id inválido', 400)
    };
  }
  
  return { valid: true, barId: parsed };
}

/**
 * Obtém cliente Supabase com tratamento de erro
 */
export async function getSupabaseOrError() {
  try {
    const supabase = await getAdminClient();
    return { supabase, error: null };
  } catch (error) {
    console.error('[Supabase Error]', error);
    return { 
      supabase: null, 
      error: errorResponse('Erro ao conectar com banco de dados', 500) 
    };
  }
}

/**
 * Valida período de datas
 */
export function validateDateRange(
  dataInicio?: string | null,
  dataFim?: string | null
): { valid: true; dataInicio: Date; dataFim: Date } | { valid: false; response: NextResponse } {
  if (!dataInicio || !dataFim) {
    return {
      valid: false,
      response: errorResponse('data_inicio e data_fim são obrigatórios', 400)
    };
  }
  
  const inicio = new Date(dataInicio);
  const fim = new Date(dataFim);
  
  if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
    return {
      valid: false,
      response: errorResponse('Formato de data inválido', 400)
    };
  }
  
  if (inicio > fim) {
    return {
      valid: false,
      response: errorResponse('data_inicio não pode ser maior que data_fim', 400)
    };
  }
  
  return { valid: true, dataInicio: inicio, dataFim: fim };
}

/**
 * Extrai parâmetros de paginação
 */
export function getPaginationParams(searchParams: URLSearchParams) {
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  
  // Limites de segurança
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 1000);
  const offset = (safePage - 1) * safeLimit;
  
  return { page: safePage, limit: safeLimit, offset };
}

/**
 * Formata resposta com paginação
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  return successResponse({
    items: data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    }
  });
}
