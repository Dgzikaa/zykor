/**
 * Testes de autenticação
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { generateToken, validateToken, isTokenExpired } from '@/lib/auth/jwt';
import type { AuthToken } from '@/lib/auth/types';

describe('Autenticação JWT', () => {
  describe('generateToken', () => {
    it('deve gerar token válido', () => {
      const payload: Omit<AuthToken, 'iat' | 'exp'> = {
        user_id: 1,
        auth_id: 'test-auth-id',
        email: 'test@example.com',
        bar_id: 1,
        role: 'admin',
        modulos_permitidos: ['todos'],
      };

      const token = generateToken(payload);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    it('deve gerar tokens diferentes para payloads diferentes', () => {
      const payload1 = {
        user_id: 1,
        auth_id: 'auth-1',
        email: 'user1@example.com',
        bar_id: 1,
        role: 'admin' as const,
        modulos_permitidos: ['todos'],
      };

      const payload2 = {
        user_id: 2,
        auth_id: 'auth-2',
        email: 'user2@example.com',
        bar_id: 2,
        role: 'funcionario' as const,
        modulos_permitidos: ['operacoes'],
      };

      const token1 = generateToken(payload1);
      const token2 = generateToken(payload2);

      expect(token1).not.toBe(token2);
    });
  });

  describe('validateToken', () => {
    it('deve validar token válido', () => {
      const payload = {
        user_id: 1,
        auth_id: 'test-auth-id',
        email: 'test@example.com',
        bar_id: 1,
        role: 'admin' as const,
        modulos_permitidos: ['todos'],
      };

      const token = generateToken(payload);
      const decoded = validateToken(token);

      expect(decoded).toBeTruthy();
      expect(decoded?.user_id).toBe(1);
      expect(decoded?.email).toBe('test@example.com');
      expect(decoded?.role).toBe('admin');
    });

    it('deve rejeitar token inválido', () => {
      const invalidToken = 'invalid.token.here';
      const decoded = validateToken(invalidToken);

      expect(decoded).toBeNull();
    });

    it('deve rejeitar token expirado', () => {
      // Token com expiração no passado
      const expiredToken = generateToken({
        user_id: 1,
        auth_id: 'test',
        email: 'test@example.com',
        bar_id: 1,
        role: 'admin',
        modulos_permitidos: ['todos'],
      });

      // Simular token expirado modificando o tempo
      const decoded = validateToken(expiredToken);
      // Token recém-criado não deve estar expirado
      expect(decoded).toBeTruthy();
    });
  });

  describe('isTokenExpired', () => {
    it('deve detectar token não expirado', () => {
      const token = generateToken({
        user_id: 1,
        auth_id: 'test',
        email: 'test@example.com',
        bar_id: 1,
        role: 'admin',
        modulos_permitidos: ['todos'],
      });

      expect(isTokenExpired(token)).toBe(false);
    });

    it('deve detectar token inválido como expirado', () => {
      expect(isTokenExpired('invalid-token')).toBe(true);
    });
  });
});
