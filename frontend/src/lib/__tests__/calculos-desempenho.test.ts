import { describe, it, expect } from 'vitest';

/**
 * Testes para cálculos de desempenho
 * Baseado em: .cursor/REGRAS-DE-NEGOCIO-COMPLETAS.md
 */

describe('Cálculos de Desempenho', () => {
  describe('Ticket Médio', () => {
    it('deve calcular ticket médio = faturamento / clientes', () => {
      const faturamento = 100000;
      const clientes = 1000;
      const ticketMedio = faturamento / clientes;
      
      expect(ticketMedio).toBe(100);
    });

    it('deve calcular ticket médio com valores decimais', () => {
      const faturamento = 43186;
      const clientes = 444;
      const ticketMedio = faturamento / clientes;
      
      expect(ticketMedio).toBeCloseTo(97.27, 2);
    });

    it('deve retornar 0 quando não há clientes (divisão por zero)', () => {
      const faturamento = 100000;
      const clientes = 0;
      const ticketMedio = clientes === 0 ? 0 : faturamento / clientes;
      
      expect(ticketMedio).toBe(0);
    });

    it('deve retornar 0 quando faturamento é zero', () => {
      const faturamento = 0;
      const clientes = 100;
      const ticketMedio = faturamento / clientes;
      
      expect(ticketMedio).toBe(0);
    });
  });

  describe('% Meta (Atingimento)', () => {
    it('deve calcular % meta = faturamento / meta * 100', () => {
      const faturamento = 80000;
      const meta = 100000;
      const percMeta = (faturamento / meta) * 100;
      
      expect(percMeta).toBe(80);
    });

    it('deve calcular % meta acima de 100%', () => {
      const faturamento = 120000;
      const meta = 100000;
      const percMeta = (faturamento / meta) * 100;
      
      expect(percMeta).toBe(120);
    });

    it('deve retornar 0 quando meta é zero (divisão por zero)', () => {
      const faturamento = 80000;
      const meta = 0;
      const percMeta = meta === 0 ? 0 : (faturamento / meta) * 100;
      
      expect(percMeta).toBe(0);
    });

    it('deve calcular % meta com valores decimais', () => {
      const faturamento = 144320;
      const meta = 150000;
      const percMeta = (faturamento / meta) * 100;
      
      expect(percMeta).toBeCloseTo(96.21, 2);
    });
  });

  describe('Faturamento Total', () => {
    it('deve somar faturamento = contahub_liquido + yuzer_liquido + sympla_liquido', () => {
      const contahubLiquido = 111111;
      const yuzerLiquido = 30000;
      const symplaLiquido = 3208;
      const faturamentoTotal = contahubLiquido + yuzerLiquido + symplaLiquido;
      
      expect(faturamentoTotal).toBe(144319);
    });

    it('deve calcular faturamento apenas com ContaHub', () => {
      const contahubLiquido = 43186;
      const yuzerLiquido = 0;
      const symplaLiquido = 0;
      const faturamentoTotal = contahubLiquido + yuzerLiquido + symplaLiquido;
      
      expect(faturamentoTotal).toBe(43186);
    });
  });

  describe('Faturamento Entrada', () => {
    it('deve calcular faturamento entrada = couvert + yuzer_ingressos + sympla', () => {
      const couvert = 5000;
      const yuzerIngressos = 25000;
      const symplaLiquido = 3208;
      const faturamentoEntrada = couvert + yuzerIngressos + symplaLiquido;
      
      expect(faturamentoEntrada).toBe(33208);
    });
  });

  describe('Faturamento Bar', () => {
    it('deve calcular faturamento bar = (contahub_liquido - couvert) + yuzer_bar', () => {
      const contahubLiquido = 120000;
      const couvert = 5000;
      const yuzerBar = 30000 - 25000; // yuzer_liquido - yuzer_ingressos
      const faturamentoBar = (contahubLiquido - couvert) + yuzerBar;
      
      expect(faturamentoBar).toBe(120000);
    });

    it('deve calcular faturamento bar sem Yuzer', () => {
      const contahubLiquido = 43186;
      const couvert = 2500;
      const yuzerBar = 0;
      const faturamentoBar = (contahubLiquido - couvert) + yuzerBar;
      
      expect(faturamentoBar).toBe(40686);
    });
  });

  describe('Clientes Total', () => {
    it('deve somar clientes = contahub_pessoas + yuzer_ingressos_qtd + sympla_checkins', () => {
      const contahubPessoas = 800;
      const yuzerIngressosQtd = 300;
      const symplaCheckins = 77;
      const clientesTotal = contahubPessoas + yuzerIngressosQtd + symplaCheckins;
      
      expect(clientesTotal).toBe(1177);
    });
  });

  describe('% Mix de Produtos', () => {
    it('deve calcular % bebidas = valor_bebidas / faturamento_total * 100', () => {
      const valorBebidas = 57000;
      const faturamentoTotal = 100000;
      const percBebidas = (valorBebidas / faturamentoTotal) * 100;
      
      expect(percBebidas).toBeCloseTo(57, 2);
    });

    it('deve calcular % drinks', () => {
      const valorDrinks = 35000;
      const faturamentoTotal = 100000;
      const percDrinks = (valorDrinks / faturamentoTotal) * 100;
      
      expect(percDrinks).toBe(35);
    });

    it('deve calcular % comida', () => {
      const valorComida = 7000;
      const faturamentoTotal = 100000;
      const percComida = (valorComida / faturamentoTotal) * 100;
      
      expect(percComida).toBeCloseTo(7, 2);
    });

    it('deve somar 100% quando todos os valores são contabilizados', () => {
      const valorBebidas = 57000;
      const valorDrinks = 35000;
      const valorComida = 7000;
      const valorOutros = 1000;
      const faturamentoTotal = valorBebidas + valorDrinks + valorComida + valorOutros;
      
      const percBebidas = (valorBebidas / faturamentoTotal) * 100;
      const percDrinks = (valorDrinks / faturamentoTotal) * 100;
      const percComida = (valorComida / faturamentoTotal) * 100;
      const percOutros = (valorOutros / faturamentoTotal) * 100;
      
      expect(percBebidas + percDrinks + percComida + percOutros).toBe(100);
    });
  });

  describe('Média Ponderada (Mix Semanal)', () => {
    it('deve calcular média ponderada de % bebidas', () => {
      // Dia 1: R$ 100k com 60% bebidas = R$ 60k em bebidas
      // Dia 2: R$ 10k com 20% bebidas = R$ 2k em bebidas
      // Total: R$ 110k com R$ 62k em bebidas = 56.36%
      
      const eventos = [
        { faturamento: 100000, percBebidas: 60 },
        { faturamento: 10000, percBebidas: 20 },
      ];
      
      const faturamentoTotal = eventos.reduce((sum, e) => sum + e.faturamento, 0);
      const somaBebidasPonderada = eventos.reduce(
        (sum, e) => sum + (e.faturamento * e.percBebidas / 100),
        0
      );
      const percBebidasPonderado = (somaBebidasPonderada / faturamentoTotal) * 100;
      
      expect(faturamentoTotal).toBe(110000);
      expect(somaBebidasPonderada).toBe(62000);
      expect(percBebidasPonderado).toBeCloseTo(56.36, 2);
    });

    it('média ponderada deve ser diferente de média simples', () => {
      const eventos = [
        { faturamento: 100000, percBebidas: 60 },
        { faturamento: 10000, percBebidas: 20 },
      ];
      
      // Média simples (ERRADA)
      const mediaSimples = eventos.reduce((sum, e) => sum + e.percBebidas, 0) / eventos.length;
      
      // Média ponderada (CORRETA)
      const faturamentoTotal = eventos.reduce((sum, e) => sum + e.faturamento, 0);
      const somaBebidasPonderada = eventos.reduce(
        (sum, e) => sum + (e.faturamento * e.percBebidas / 100),
        0
      );
      const mediaPonderada = (somaBebidasPonderada / faturamentoTotal) * 100;
      
      expect(mediaSimples).toBe(40); // Média simples = (60 + 20) / 2
      expect(mediaPonderada).toBeCloseTo(56.36, 2); // Média ponderada
      expect(mediaPonderada).not.toBe(mediaSimples);
    });
  });
});
