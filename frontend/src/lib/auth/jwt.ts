/**
 * Funções para manipulação de JWT
 */

import jwt from 'jsonwebtoken';
import type { AuthToken } from './types';

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXT_PUBLIC_JWT_SECRET || 'zykor-secret-key-change-in-production';
const JWT_EXPIRATION = '7d'; // 7 dias

/**
 * Gerar token JWT
 */
export function generateToken(payload: Omit<AuthToken, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRATION,
  });
}

/**
 * Validar e decodificar token JWT
 */
export function validateToken(token: string): AuthToken | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthToken;
    
    // Verificar expiração
    if (decoded.exp && decoded.exp < Date.now() / 1000) {
      return null;
    }
    
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Decodificar token sem validar (útil para debug)
 */
export function decodeToken(token: string): AuthToken | null {
  try {
    return jwt.decode(token) as AuthToken;
  } catch (error) {
    return null;
  }
}

/**
 * Verificar se token está expirado
 */
export function isTokenExpired(token: string): boolean {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;
  
  return decoded.exp < Date.now() / 1000;
}

/**
 * Gerar refresh token (válido por 30 dias)
 */
export function generateRefreshToken(payload: Omit<AuthToken, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '30d',
  });
}

/**
 * Validar refresh token
 */
export function validateRefreshToken(token: string): AuthToken | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthToken;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Obter tempo restante do token em segundos
 */
export function getTokenTimeRemaining(token: string): number {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return 0;
  
  const remaining = decoded.exp - Date.now() / 1000;
  return Math.max(0, remaining);
}
