/**
 * Testes de permissões
 */

import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  isAdmin,
  canManageFinancial,
  canManageOperations,
  canAccessRoute,
  MODULES,
} from '@/lib/auth/permissions';
import type { AuthenticatedUser } from '@/lib/auth/types';

describe('Permissões', () => {
  const adminUser: AuthenticatedUser = {
    id: 1,
    auth_id: 'admin-auth-id',
    email: 'admin@example.com',
    nome: 'Admin',
    role: 'admin',
    bar_id: 1,
    modulos_permitidos: ['todos'],
    ativo: true,
    senha_redefinida: true,
  };

  const financeiroUser: AuthenticatedUser = {
    id: 2,
    auth_id: 'financeiro-auth-id',
    email: 'financeiro@example.com',
    nome: 'Financeiro',
    role: 'financeiro',
    bar_id: 1,
    modulos_permitidos: ['financeiro', 'dashboard'],
    ativo: true,
    senha_redefinida: true,
  };

  const funcionarioUser: AuthenticatedUser = {
    id: 3,
    auth_id: 'funcionario-auth-id',
    email: 'funcionario@example.com',
    nome: 'Funcionário',
    role: 'funcionario',
    bar_id: 1,
    modulos_permitidos: ['operacoes', 'terminal_producao'],
    ativo: true,
    senha_redefinida: true,
  };

  describe('hasPermission', () => {
    it('admin deve ter todas as permissões', () => {
      expect(hasPermission(adminUser, MODULES.FINANCEIRO)).toBe(true);
      expect(hasPermission(adminUser, MODULES.OPERACOES)).toBe(true);
      expect(hasPermission(adminUser, MODULES.MARKETING)).toBe(true);
    });

    it('financeiro deve ter permissão financeira', () => {
      expect(hasPermission(financeiroUser, MODULES.FINANCEIRO)).toBe(true);
      expect(hasPermission(financeiroUser, MODULES.DASHBOARD)).toBe(true);
    });

    it('financeiro não deve ter permissão operacional', () => {
      expect(hasPermission(financeiroUser, MODULES.OPERACOES)).toBe(false);
    });

    it('funcionário deve ter permissões específicas', () => {
      expect(hasPermission(funcionarioUser, MODULES.OPERACOES)).toBe(true);
      expect(hasPermission(funcionarioUser, MODULES.TERMINAL_PRODUCAO)).toBe(true);
    });

    it('funcionário não deve ter permissão financeira', () => {
      expect(hasPermission(funcionarioUser, MODULES.FINANCEIRO)).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('deve retornar true se tiver pelo menos uma permissão', () => {
      expect(
        hasAnyPermission(funcionarioUser, [MODULES.OPERACOES, MODULES.FINANCEIRO])
      ).toBe(true);
    });

    it('deve retornar false se não tiver nenhuma permissão', () => {
      expect(
        hasAnyPermission(funcionarioUser, [MODULES.FINANCEIRO, MODULES.MARKETING])
      ).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('deve retornar true se tiver todas as permissões', () => {
      expect(
        hasAllPermissions(funcionarioUser, [MODULES.OPERACOES, MODULES.TERMINAL_PRODUCAO])
      ).toBe(true);
    });

    it('deve retornar false se faltar alguma permissão', () => {
      expect(
        hasAllPermissions(funcionarioUser, [MODULES.OPERACOES, MODULES.FINANCEIRO])
      ).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('deve identificar admin corretamente', () => {
      expect(isAdmin(adminUser)).toBe(true);
      expect(isAdmin(financeiroUser)).toBe(false);
      expect(isAdmin(funcionarioUser)).toBe(false);
    });
  });

  describe('canManageFinancial', () => {
    it('admin pode gerenciar financeiro', () => {
      expect(canManageFinancial(adminUser)).toBe(true);
    });

    it('financeiro pode gerenciar financeiro', () => {
      expect(canManageFinancial(financeiroUser)).toBe(true);
    });

    it('funcionário não pode gerenciar financeiro', () => {
      expect(canManageFinancial(funcionarioUser)).toBe(false);
    });
  });

  describe('canManageOperations', () => {
    it('admin pode gerenciar operações', () => {
      expect(canManageOperations(adminUser)).toBe(true);
    });

    it('funcionário com permissão pode gerenciar operações', () => {
      expect(canManageOperations(funcionarioUser)).toBe(true);
    });

    it('financeiro não pode gerenciar operações', () => {
      expect(canManageOperations(financeiroUser)).toBe(false);
    });
  });

  describe('canAccessRoute', () => {
    it('admin pode acessar qualquer rota', () => {
      expect(canAccessRoute(adminUser, '/configuracoes')).toBe(true);
      expect(canAccessRoute(adminUser, '/financeiro')).toBe(true);
      expect(canAccessRoute(adminUser, '/operacional')).toBe(true);
    });

    it('financeiro pode acessar rota financeira', () => {
      expect(canAccessRoute(financeiroUser, '/financeiro')).toBe(true);
    });

    it('financeiro não pode acessar configurações', () => {
      expect(canAccessRoute(financeiroUser, '/configuracoes')).toBe(false);
    });

    it('funcionário pode acessar rota operacional', () => {
      expect(canAccessRoute(funcionarioUser, '/operacional')).toBe(true);
    });
  });
});
