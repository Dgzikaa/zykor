import { describe, it, expect } from 'vitest';

/**
 * Testes para funções de formatação
 * Formatação de moeda, porcentagem e datas
 */

describe('Formatadores', () => {
  describe('Formatação de Moeda (R$)', () => {
    const formatarMoeda = (valor: number): string => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(valor);
    };

    it('deve formatar valores inteiros', () => {
      expect(formatarMoeda(1000)).toContain('1.000,00');
      expect(formatarMoeda(100000)).toContain('100.000,00');
    });

    it('deve formatar valores decimais', () => {
      expect(formatarMoeda(1234.56)).toContain('1.234,56');
      expect(formatarMoeda(97.27)).toContain('97,27');
    });

    it('deve formatar valores negativos', () => {
      expect(formatarMoeda(-1000)).toContain('1.000,00');
      expect(formatarMoeda(-1000)).toContain('-');
    });

    it('deve formatar zero', () => {
      expect(formatarMoeda(0)).toContain('0,00');
    });

    it('deve arredondar para 2 casas decimais', () => {
      expect(formatarMoeda(1234.567)).toContain('1.234,57');
      expect(formatarMoeda(1234.564)).toContain('1.234,56');
    });

    it('deve formatar valores grandes', () => {
      expect(formatarMoeda(1000000)).toContain('1.000.000,00');
      expect(formatarMoeda(144320)).toContain('144.320,00');
    });
  });

  describe('Formatação de Porcentagem', () => {
    const formatarPorcentagem = (valor: number, casasDecimais: number = 2): string => {
      return `${valor.toFixed(casasDecimais)}%`;
    };

    it('deve formatar porcentagens inteiras', () => {
      expect(formatarPorcentagem(50)).toBe('50.00%');
      expect(formatarPorcentagem(100)).toBe('100.00%');
    });

    it('deve formatar porcentagens decimais', () => {
      expect(formatarPorcentagem(56.36)).toBe('56.36%');
      expect(formatarPorcentagem(97.27)).toBe('97.27%');
    });

    it('deve formatar com número específico de casas decimais', () => {
      expect(formatarPorcentagem(56.3678, 1)).toBe('56.4%');
      expect(formatarPorcentagem(56.3678, 3)).toBe('56.368%');
    });

    it('deve formatar zero', () => {
      expect(formatarPorcentagem(0)).toBe('0.00%');
    });

    it('deve formatar valores acima de 100%', () => {
      expect(formatarPorcentagem(120)).toBe('120.00%');
      expect(formatarPorcentagem(150.5)).toBe('150.50%');
    });

    it('deve formatar valores negativos', () => {
      expect(formatarPorcentagem(-10)).toBe('-10.00%');
    });
  });

  describe('Formatação de Datas', () => {
    const formatarData = (data: Date): string => {
      return new Intl.DateTimeFormat('pt-BR').format(data);
    };

    it('deve formatar datas no formato DD/MM/YYYY', () => {
      const data = new Date('2026-03-01');
      expect(formatarData(data)).toBe('01/03/2026');
    });

    it('deve formatar diferentes meses', () => {
      expect(formatarData(new Date('2026-01-15'))).toBe('15/01/2026');
      expect(formatarData(new Date('2026-12-31'))).toBe('31/12/2026');
    });

    it('deve formatar dias com zero à esquerda', () => {
      expect(formatarData(new Date('2026-03-05'))).toBe('05/03/2026');
    });
  });

  describe('Formatação de Data e Hora', () => {
    const formatarDataHora = (data: Date): string => {
      return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(data);
    };

    it('deve formatar data e hora', () => {
      const data = new Date('2026-03-01T18:30:00');
      const resultado = formatarDataHora(data);
      
      expect(resultado).toContain('01/03/2026');
      expect(resultado).toContain('18:30');
    });
  });

  describe('Formatação de Números', () => {
    const formatarNumero = (valor: number, casasDecimais: number = 0): string => {
      return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: casasDecimais,
        maximumFractionDigits: casasDecimais,
      }).format(valor);
    };

    it('deve formatar números inteiros', () => {
      expect(formatarNumero(1000)).toBe('1.000');
      expect(formatarNumero(1000000)).toBe('1.000.000');
    });

    it('deve formatar números com separador de milhares', () => {
      expect(formatarNumero(1234)).toBe('1.234');
      expect(formatarNumero(1234567)).toBe('1.234.567');
    });

    it('deve formatar números decimais', () => {
      expect(formatarNumero(1234.56, 2)).toBe('1.234,56');
      expect(formatarNumero(97.27, 2)).toBe('97,27');
    });
  });

  describe('Formatação de Tempo (minutos)', () => {
    const formatarTempo = (segundos: number): string => {
      const minutos = Math.floor(segundos / 60);
      const segs = segundos % 60;
      return `${minutos}min ${segs}s`;
    };

    it('deve converter segundos para minutos', () => {
      expect(formatarTempo(300)).toBe('5min 0s');
      expect(formatarTempo(420)).toBe('7min 0s');
    });

    it('deve formatar com segundos', () => {
      expect(formatarTempo(350)).toBe('5min 50s');
      expect(formatarTempo(125)).toBe('2min 5s');
    });

    it('deve formatar zero', () => {
      expect(formatarTempo(0)).toBe('0min 0s');
    });

    it('deve formatar tempos longos', () => {
      expect(formatarTempo(900)).toBe('15min 0s');
      expect(formatarTempo(1200)).toBe('20min 0s');
    });
  });

  describe('Formatação Compacta de Números', () => {
    const formatarNumeroCompacto = (valor: number): string => {
      if (valor >= 1000000) {
        return `${(valor / 1000000).toFixed(1)}M`;
      }
      if (valor >= 1000) {
        return `${(valor / 1000).toFixed(1)}k`;
      }
      return valor.toString();
    };

    it('deve formatar milhares com "k"', () => {
      expect(formatarNumeroCompacto(1000)).toBe('1.0k');
      expect(formatarNumeroCompacto(5500)).toBe('5.5k');
      expect(formatarNumeroCompacto(100000)).toBe('100.0k');
    });

    it('deve formatar milhões com "M"', () => {
      expect(formatarNumeroCompacto(1000000)).toBe('1.0M');
      expect(formatarNumeroCompacto(2500000)).toBe('2.5M');
    });

    it('deve manter números pequenos sem formatação', () => {
      expect(formatarNumeroCompacto(100)).toBe('100');
      expect(formatarNumeroCompacto(999)).toBe('999');
    });
  });

  describe('Formatação de Moeda Compacta', () => {
    const formatarMoedaCompacta = (valor: number): string => {
      if (valor >= 1000000) {
        return `R$ ${(valor / 1000000).toFixed(1)}M`;
      }
      if (valor >= 1000) {
        return `R$ ${(valor / 1000).toFixed(1)}k`;
      }
      return `R$ ${valor.toFixed(2)}`;
    };

    it('deve formatar valores em milhares', () => {
      expect(formatarMoedaCompacta(1000)).toBe('R$ 1.0k');
      expect(formatarMoedaCompacta(43186)).toBe('R$ 43.2k');
    });

    it('deve formatar valores em milhões', () => {
      expect(formatarMoedaCompacta(1000000)).toBe('R$ 1.0M');
      expect(formatarMoedaCompacta(2500000)).toBe('R$ 2.5M');
    });

    it('deve formatar valores pequenos normalmente', () => {
      expect(formatarMoedaCompacta(100)).toBe('R$ 100.00');
      expect(formatarMoedaCompacta(97.27)).toBe('R$ 97.27');
    });
  });

  describe('Edge Cases', () => {
    it('deve lidar com null/undefined como zero', () => {
      const formatarMoedaSafe = (valor: number | null | undefined): string => {
        const val = valor ?? 0;
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(val);
      };

      expect(formatarMoedaSafe(null)).toBe('R$ 0,00');
      expect(formatarMoedaSafe(undefined)).toBe('R$ 0,00');
    });

    it('deve lidar com valores muito pequenos', () => {
      const formatarMoeda = (valor: number): string => {
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(valor);
      };

      expect(formatarMoeda(0.01)).toBe('R$ 0,01');
      expect(formatarMoeda(0.001)).toBe('R$ 0,00'); // Arredonda para 2 casas
    });

    it('deve lidar com valores muito grandes', () => {
      const formatarMoeda = (valor: number): string => {
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(valor);
      };

      expect(formatarMoeda(999999999)).toBe('R$ 999.999.999,00');
    });
  });
});
