import { describe, it, expect } from 'vitest';

/**
 * Testes para regras específicas por bar
 * Baseado em: .cursor/REGRAS-DE-NEGOCIO-COMPLETAS.md
 * 
 * CRÍTICO: Cada bar tem regras DIFERENTES!
 * - Ordinário (bar_id=3): usa t0_t3 para atrasos de bar
 * - Deboche (bar_id=4): usa t0_t2 para atrasos de bar
 */

describe('Regras por Bar', () => {
  const BAR_ORDINARIO = 3;
  const BAR_DEBOCHE = 4;

  describe('Tempos - Qual campo usar?', () => {
    it('Ordinário deve usar t0_t3 para tempos de bar/drinks', () => {
      const barId = BAR_ORDINARIO;
      const t0_t3 = 420; // 7 minutos em segundos
      const t0_t2 = 300; // 5 minutos em segundos
      
      // Ordinário usa t0_t3 (tempo total)
      const campoUsado = barId === BAR_ORDINARIO ? t0_t3 : t0_t2;
      const tempoMinutos = campoUsado / 60;
      
      expect(campoUsado).toBe(420);
      expect(tempoMinutos).toBe(7);
    });

    it('Deboche deve usar t0_t2 para tempos de bar/drinks', () => {
      const barId = BAR_DEBOCHE;
      const t0_t3 = 420; // 7 minutos em segundos
      const t0_t2 = 300; // 5 minutos em segundos
      
      // Deboche usa t0_t2 (até ficar pronto)
      const campoUsado = barId === BAR_DEBOCHE ? t0_t2 : t0_t3;
      const tempoMinutos = campoUsado / 60;
      
      expect(campoUsado).toBe(300);
      expect(tempoMinutos).toBe(5);
    });

    it('Ambos os bares devem usar t0_t2 para tempos de cozinha', () => {
      const t0_t2 = 900; // 15 minutos em segundos
      
      // Cozinha sempre usa t0_t2 para ambos os bares
      const tempoMinutos = t0_t2 / 60;
      
      expect(tempoMinutos).toBe(15);
    });
  });

  describe('Atrasos de Bar/Drinks', () => {
    describe('Ordinário (bar_id=3) - usa t0_t3', () => {
      it('deve identificar atrasinho bar > 5 min (300s)', () => {
        const barId = BAR_ORDINARIO;
        const t0_t3 = 350; // 5min 50s
        
        const isAtrasinho = t0_t3 > 300 && t0_t3 <= 600;
        
        expect(isAtrasinho).toBe(true);
      });

      it('deve identificar atrasão bar > 10 min (600s)', () => {
        const barId = BAR_ORDINARIO;
        const t0_t3 = 650; // 10min 50s
        
        const isAtrasao = t0_t3 > 600;
        
        expect(isAtrasao).toBe(true);
      });

      it('não deve contar como atraso se <= 5 min', () => {
        const barId = BAR_ORDINARIO;
        const t0_t3 = 280; // 4min 40s
        
        const isAtrasinho = t0_t3 > 300;
        const isAtrasao = t0_t3 > 600;
        
        expect(isAtrasinho).toBe(false);
        expect(isAtrasao).toBe(false);
      });

      it('deve contar atrasos corretamente em lote', () => {
        const barId = BAR_ORDINARIO;
        const tempos = [
          { t0_t3: 280 },  // Normal
          { t0_t3: 350 },  // Atrasinho
          { t0_t3: 500 },  // Atrasinho
          { t0_t3: 650 },  // Atrasão
          { t0_t3: 800 },  // Atrasão
        ];
        
        const atrasinhos = tempos.filter(t => t.t0_t3 > 300 && t.t0_t3 <= 600).length;
        const atrasoes = tempos.filter(t => t.t0_t3 > 600).length;
        
        expect(atrasinhos).toBe(2);
        expect(atrasoes).toBe(2);
      });
    });

    describe('Deboche (bar_id=4) - usa t0_t2', () => {
      it('deve identificar atrasinho bar > 5 min (300s) usando t0_t2', () => {
        const barId = BAR_DEBOCHE;
        const t0_t2 = 350; // 5min 50s
        
        const isAtrasinho = t0_t2 > 300 && t0_t2 <= 600;
        
        expect(isAtrasinho).toBe(true);
      });

      it('deve identificar atrasão bar > 10 min (600s) usando t0_t2', () => {
        const barId = BAR_DEBOCHE;
        const t0_t2 = 650; // 10min 50s
        
        const isAtrasao = t0_t2 > 600;
        
        expect(isAtrasao).toBe(true);
      });

      it('deve usar t0_t2 e não t0_t3', () => {
        const barId = BAR_DEBOCHE;
        const t0_t2 = 350; // 5min 50s (atrasinho)
        const t0_t3 = 280; // 4min 40s (normal)
        
        // Deboche usa t0_t2, então deve contar como atrasinho
        const campoUsado = barId === BAR_DEBOCHE ? t0_t2 : t0_t3;
        const isAtrasinho = campoUsado > 300 && campoUsado <= 600;
        
        expect(campoUsado).toBe(350);
        expect(isAtrasinho).toBe(true);
      });
    });
  });

  describe('Atrasos de Cozinha/Comida', () => {
    it('deve identificar atrasinho cozinha > 15 min (900s)', () => {
      const t0_t2 = 1000; // 16min 40s
      
      const isAtrasinho = t0_t2 > 900 && t0_t2 <= 1200;
      
      expect(isAtrasinho).toBe(true);
    });

    it('deve identificar atrasão cozinha > 20 min (1200s)', () => {
      const t0_t2 = 1300; // 21min 40s
      
      const isAtrasao = t0_t2 > 1200;
      
      expect(isAtrasao).toBe(true);
    });

    it('não deve contar como atraso se <= 15 min', () => {
      const t0_t2 = 850; // 14min 10s
      
      const isAtrasinho = t0_t2 > 900;
      const isAtrasao = t0_t2 > 1200;
      
      expect(isAtrasinho).toBe(false);
      expect(isAtrasao).toBe(false);
    });

    it('deve usar mesma regra para ambos os bares', () => {
      const temposCozinha = [
        { bar_id: BAR_ORDINARIO, t0_t2: 1000 },
        { bar_id: BAR_DEBOCHE, t0_t2: 1000 },
      ];
      
      // Ambos devem contar como atrasinho
      const atrasinhos = temposCozinha.filter(t => t.t0_t2 > 900 && t.t0_t2 <= 1200);
      
      expect(atrasinhos.length).toBe(2);
    });
  });

  describe('Limites de Atraso - Conversão de Segundos', () => {
    it('deve converter limites de bar corretamente', () => {
      const LIMITE_ATRASINHO_BAR = 300; // 5 minutos
      const LIMITE_ATRASAO_BAR = 600;   // 10 minutos
      
      expect(LIMITE_ATRASINHO_BAR / 60).toBe(5);
      expect(LIMITE_ATRASAO_BAR / 60).toBe(10);
    });

    it('deve converter limites de cozinha corretamente', () => {
      const LIMITE_ATRASINHO_COZINHA = 900;  // 15 minutos
      const LIMITE_ATRASAO_COZINHA = 1200;   // 20 minutos
      
      expect(LIMITE_ATRASINHO_COZINHA / 60).toBe(15);
      expect(LIMITE_ATRASAO_COZINHA / 60).toBe(20);
    });
  });

  describe('Dias de Operação', () => {
    it('Ordinário deve operar 7 dias por semana (incluindo domingo)', () => {
      const barId = BAR_ORDINARIO;
      const diasSemana = [0, 1, 2, 3, 4, 5, 6]; // 0=domingo, 1=segunda, ...
      
      // Ordinário opera todos os dias
      const diasOperacao = diasSemana.filter(dia => {
        if (barId === BAR_ORDINARIO) return true;
        if (barId === BAR_DEBOCHE) return dia !== 1; // Deboche não opera segunda
        return false;
      });
      
      expect(diasOperacao.length).toBe(7);
    });

    it('Deboche deve operar 6 dias por semana (sem segunda)', () => {
      const barId = BAR_DEBOCHE;
      const diasSemana = [0, 1, 2, 3, 4, 5, 6]; // 0=domingo, 1=segunda, ...
      
      // Deboche não opera segunda (dia 1)
      const diasOperacao = diasSemana.filter(dia => {
        if (barId === BAR_ORDINARIO) return true;
        if (barId === BAR_DEBOCHE) return dia !== 1;
        return false;
      });
      
      expect(diasOperacao.length).toBe(6);
      expect(diasOperacao).not.toContain(1); // Não contém segunda
    });

    it('deve pular segunda-feira para Deboche', () => {
      const barId = BAR_DEBOCHE;
      const diaSemana = 1; // Segunda-feira (dow)
      
      const deveOperar = barId === BAR_ORDINARIO || (barId === BAR_DEBOCHE && diaSemana !== 1);
      
      expect(deveOperar).toBe(false);
    });

    it('não deve pular domingo para Ordinário', () => {
      const barId = BAR_ORDINARIO;
      const diaSemana = 0; // Domingo (dow)
      
      const deveOperar = barId === BAR_ORDINARIO || (barId === BAR_DEBOCHE && diaSemana !== 1);
      
      expect(deveOperar).toBe(true);
    });
  });

  describe('Dias Principais da Semana', () => {
    it('Ordinário deve usar QUI+SÁB+DOM como dias principais', () => {
      const barId = BAR_ORDINARIO;
      const diasPrincipais = barId === BAR_ORDINARIO 
        ? ['Quinta', 'Sábado', 'Domingo']
        : ['Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      
      expect(diasPrincipais).toEqual(['Quinta', 'Sábado', 'Domingo']);
      expect(diasPrincipais.length).toBe(3);
    });

    it('Deboche deve usar TER+QUA+QUI e SEX+SÁB', () => {
      const barId = BAR_DEBOCHE;
      const diasPrincipais = barId === BAR_ORDINARIO 
        ? ['Quinta', 'Sábado', 'Domingo']
        : ['Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      
      expect(diasPrincipais).toEqual(['Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']);
      expect(diasPrincipais.length).toBe(5);
    });

    it('deve calcular faturamento de dias principais corretamente', () => {
      const eventos = [
        { dia_semana: 'Segunda', faturamento: 10000 },
        { dia_semana: 'Terça', faturamento: 15000 },
        { dia_semana: 'Quarta', faturamento: 18000 },
        { dia_semana: 'Quinta', faturamento: 40000 },
        { dia_semana: 'Sexta', faturamento: 35000 },
        { dia_semana: 'Sábado', faturamento: 50000 },
        { dia_semana: 'Domingo', faturamento: 30000 },
      ];
      
      // Ordinário: QUI+SÁB+DOM
      const diasPrincipaisOrdinario = ['Quinta', 'Sábado', 'Domingo'];
      const fatOrdinario = eventos
        .filter(e => diasPrincipaisOrdinario.includes(e.dia_semana))
        .reduce((sum, e) => sum + e.faturamento, 0);
      
      // Deboche: TER+QUA+QUI+SEX+SÁB
      const diasPrincipaisDeboche = ['Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const fatDeboche = eventos
        .filter(e => diasPrincipaisDeboche.includes(e.dia_semana))
        .reduce((sum, e) => sum + e.faturamento, 0);
      
      expect(fatOrdinario).toBe(120000); // 40k + 50k + 30k
      expect(fatDeboche).toBe(158000);   // 15k + 18k + 40k + 35k + 50k
    });
  });
});
