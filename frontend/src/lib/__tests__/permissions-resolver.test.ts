import { describe, it, expect } from 'vitest';
import {
  userHasModule,
  userHasAnyModule,
  canonicalize,
  getCanonicalModuleIds,
  expandUserPermissions,
} from '../permissions/resolver';

/**
 * Testes do resolver único de permissões.
 * Garante que o bug do "Nenhum módulo disponível" para financeiro não volte:
 * permissões legadas (financeiro_agendamento, gestao_stockout) precisam casar
 * com os ids canônicos do menu (ferramentas_agendamento, ferramentas_stockout).
 */
describe('Resolver de permissões', () => {
  describe('regressão: usuário financeiro (David)', () => {
    const david = ['ferramentas', 'financeiro', 'financeiro_agendamento'];
    const davidLegado = ['financeiro_agendamento']; // estado original que quebrou

    it('financeiro_agendamento concede o módulo canônico ferramentas_agendamento', () => {
      expect(userHasModule(davidLegado, 'ferramentas_agendamento')).toBe(true);
    });

    it('ferramentas_agendamento concede a permissão legada financeiro_agendamento (simétrico)', () => {
      expect(userHasModule(['ferramentas_agendamento'], 'financeiro_agendamento')).toBe(true);
    });

    it('David enxerga pelo menos um card da home (não fica vazio)', () => {
      const cardAgendamento = ['todos', 'ferramentas_agendamento', 'financeiro_agendamento', 'ferramentas', 'operacoes', 'financeiro'];
      expect(userHasAnyModule(david, cardAgendamento)).toBe(true);
    });

    it('gestao_stockout concede ferramentas_stockout', () => {
      expect(userHasModule(['gestao_stockout'], 'ferramentas_stockout')).toBe(true);
    });
  });

  describe('coringa "todos"', () => {
    it('concede qualquer módulo', () => {
      expect(userHasModule(['todos'], 'configuracoes_administracao')).toBe(true);
      expect(userHasModule(['todos'], 'qualquer_coisa')).toBe(true);
    });
  });

  describe('generics por categoria', () => {
    it('"ferramentas" concede módulos da categoria Ferramentas', () => {
      expect(userHasModule(['ferramentas'], 'ferramentas_cmv_semanal')).toBe(true);
      expect(userHasModule(['ferramentas'], 'ferramentas_agendamento')).toBe(true);
    });

    it('"estrategico" concede módulos estratégicos', () => {
      expect(userHasModule(['estrategico'], 'estrategico_desempenho')).toBe(true);
    });

    it('ter um módulo concede o hub genérico da categoria', () => {
      expect(userHasModule(['ferramentas_stockout'], 'ferramentas')).toBe(true);
    });
  });

  describe('não concede acesso indevido', () => {
    it('financeiro_agendamento NÃO concede configurações', () => {
      expect(userHasModule(['financeiro_agendamento'], 'configuracoes_administracao')).toBe(false);
    });

    it('permissões vazias não concedem nada', () => {
      expect(userHasModule([], 'ferramentas_agendamento')).toBe(false);
      expect(userHasModule(null, 'ferramentas_agendamento')).toBe(false);
    });

    it('um módulo de Ferramentas não concede um módulo Estratégico específico', () => {
      expect(userHasModule(['ferramentas_agendamento'], 'estrategico_desempenho')).toBe(false);
    });
  });

  describe('formato objeto {modulo: true}', () => {
    it('aceita objeto booleano além de array', () => {
      expect(userHasModule({ financeiro_agendamento: true, foo: false }, 'ferramentas_agendamento')).toBe(true);
      expect(userHasModule({ foo: false }, 'ferramentas_agendamento')).toBe(false);
    });
  });

  describe('integridade dos aliases', () => {
    it('todo alias resolve para um id canônico real do menu (ou outro generic conhecido)', () => {
      const canonical = new Set(getCanonicalModuleIds());
      const aliasesParaModulos = [
        'financeiro_agendamento',
        'agendamento_pagamentos',
        'gestao_stockout',
        'crm',
        'crm_segmentacao_rfm',
        'ferramentas_nps',
        'desempenho',
        'planejamento',
        'clientes',
        'eventos',
      ];
      for (const alias of aliasesParaModulos) {
        expect(canonical.has(canonicalize(alias))).toBe(true);
      }
    });
  });

  describe('expandUserPermissions', () => {
    it('inclui o token cru e sua forma canônica', () => {
      const set = expandUserPermissions(['financeiro_agendamento']);
      expect(set.has('financeiro_agendamento')).toBe(true);
      expect(set.has('ferramentas_agendamento')).toBe(true);
    });
  });
});
