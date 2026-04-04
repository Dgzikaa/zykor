import { describe, it, expect } from 'vitest';

/**
 * Testes para regras de Stockout
 * Baseado em: .cursor/REGRAS-DE-NEGOCIO-COMPLETAS.md
 * 
 * Stockout = Produto cadastrado como ativo mas SEM estoque para venda
 * Campo: prd_venda ('S' = disponível, 'N' = sem estoque)
 */

describe('Regras de Stockout', () => {
  describe('Produtos Excluídos', () => {
    it('deve excluir produtos com prefixo [HH]', () => {
      const produtos = [
        { prd_desc: '[HH] Cerveja Brahma', prd_venda: 'N', prd_ativo: 'S' },
        { prd_desc: 'Cerveja Brahma', prd_venda: 'N', prd_ativo: 'S' },
        { prd_desc: 'Heineken', prd_venda: 'S', prd_ativo: 'S' },
      ];
      
      // Excluir produtos com [HH]
      const produtosValidos = produtos.filter(p => !p.prd_desc.startsWith('[HH]'));
      
      expect(produtosValidos.length).toBe(2);
      expect(produtosValidos.some(p => p.prd_desc.startsWith('[HH]'))).toBe(false);
    });

    it('deve excluir produtos com prefixo [DD]', () => {
      const produtos = [
        { prd_desc: '[DD] Vodka Dose Dupla', prd_venda: 'N', prd_ativo: 'S' },
        { prd_desc: 'Vodka', prd_venda: 'N', prd_ativo: 'S' },
      ];
      
      const produtosValidos = produtos.filter(p => !p.prd_desc.startsWith('[DD]'));
      
      expect(produtosValidos.length).toBe(1);
      expect(produtosValidos[0].prd_desc).toBe('Vodka');
    });

    it('deve excluir produtos com prefixo [IN]', () => {
      const produtos = [
        { prd_desc: '[IN] Limão', prd_venda: 'N', prd_ativo: 'S' },
        { prd_desc: 'Caipirinha de Limão', prd_venda: 'S', prd_ativo: 'S' },
      ];
      
      const produtosValidos = produtos.filter(p => !p.prd_desc.startsWith('[IN]'));
      
      expect(produtosValidos.length).toBe(1);
      expect(produtosValidos[0].prd_desc).toBe('Caipirinha de Limão');
    });

    it('deve excluir todos os prefixos especiais', () => {
      const produtos = [
        { prd_desc: '[HH] Cerveja', prd_venda: 'N', prd_ativo: 'S' },
        { prd_desc: '[DD] Vodka', prd_venda: 'N', prd_ativo: 'S' },
        { prd_desc: '[IN] Açúcar', prd_venda: 'N', prd_ativo: 'S' },
        { prd_desc: 'Caipirinha', prd_venda: 'S', prd_ativo: 'S' },
      ];
      
      const prefixosExcluidos = ['[HH]', '[DD]', '[IN]'];
      const produtosValidos = produtos.filter(
        p => !prefixosExcluidos.some(prefix => p.prd_desc.startsWith(prefix))
      );
      
      expect(produtosValidos.length).toBe(1);
      expect(produtosValidos[0].prd_desc).toBe('Caipirinha');
    });

    it('deve excluir grupos com "Insumo" no nome', () => {
      const produtos = [
        { prd_desc: 'Limão', grp_desc: 'Insumos', prd_venda: 'N', prd_ativo: 'S' },
        { prd_desc: 'Caipirinha', grp_desc: 'Drinks', prd_venda: 'S', prd_ativo: 'S' },
      ];
      
      const produtosValidos = produtos.filter(
        p => !p.grp_desc.toLowerCase().includes('insumo')
      );
      
      expect(produtosValidos.length).toBe(1);
      expect(produtosValidos[0].prd_desc).toBe('Caipirinha');
    });
  });

  describe('Cálculo de % Stockout', () => {
    it('deve calcular % stockout = produtos sem estoque / total * 100', () => {
      const produtos = [
        { prd_desc: 'Cerveja Brahma', prd_venda: 'N', prd_ativo: 'S' },
        { prd_desc: 'Heineken', prd_venda: 'N', prd_ativo: 'S' },
        { prd_desc: 'Skol', prd_venda: 'S', prd_ativo: 'S' },
        { prd_desc: 'Budweiser', prd_venda: 'S', prd_ativo: 'S' },
      ];
      
      const semEstoque = produtos.filter(p => p.prd_venda === 'N').length;
      const total = produtos.length;
      const percStockout = (semEstoque / total) * 100;
      
      expect(semEstoque).toBe(2);
      expect(total).toBe(4);
      expect(percStockout).toBe(50);
    });

    it('deve retornar 0% quando todos os produtos têm estoque', () => {
      const produtos = [
        { prd_desc: 'Cerveja Brahma', prd_venda: 'S', prd_ativo: 'S' },
        { prd_desc: 'Heineken', prd_venda: 'S', prd_ativo: 'S' },
      ];
      
      const semEstoque = produtos.filter(p => p.prd_venda === 'N').length;
      const total = produtos.length;
      const percStockout = (semEstoque / total) * 100;
      
      expect(percStockout).toBe(0);
    });

    it('deve retornar 100% quando nenhum produto tem estoque', () => {
      const produtos = [
        { prd_desc: 'Cerveja Brahma', prd_venda: 'N', prd_ativo: 'S' },
        { prd_desc: 'Heineken', prd_venda: 'N', prd_ativo: 'S' },
      ];
      
      const semEstoque = produtos.filter(p => p.prd_venda === 'N').length;
      const total = produtos.length;
      const percStockout = (semEstoque / total) * 100;
      
      expect(percStockout).toBe(100);
    });

    it('deve considerar apenas produtos ativos', () => {
      const produtos = [
        { prd_desc: 'Cerveja Brahma', prd_venda: 'N', prd_ativo: 'S' },
        { prd_desc: 'Heineken', prd_venda: 'N', prd_ativo: 'N' }, // Inativo
        { prd_desc: 'Skol', prd_venda: 'S', prd_ativo: 'S' },
      ];
      
      const produtosAtivos = produtos.filter(p => p.prd_ativo === 'S');
      const semEstoque = produtosAtivos.filter(p => p.prd_venda === 'N').length;
      const total = produtosAtivos.length;
      const percStockout = (semEstoque / total) * 100;
      
      expect(produtosAtivos.length).toBe(2);
      expect(semEstoque).toBe(1);
      expect(percStockout).toBe(50);
    });
  });

  describe('Cálculo Completo com Filtros', () => {
    it('deve calcular stockout excluindo prefixos especiais', () => {
      const produtos = [
        { prd_desc: '[HH] Cerveja', prd_venda: 'N', prd_ativo: 'S', grp_desc: 'Cervejas' },
        { prd_desc: '[DD] Vodka', prd_venda: 'N', prd_ativo: 'S', grp_desc: 'Destilados' },
        { prd_desc: '[IN] Limão', prd_venda: 'N', prd_ativo: 'S', grp_desc: 'Insumos' },
        { prd_desc: 'Cerveja Brahma', prd_venda: 'N', prd_ativo: 'S', grp_desc: 'Cervejas' },
        { prd_desc: 'Heineken', prd_venda: 'N', prd_ativo: 'S', grp_desc: 'Cervejas' },
        { prd_desc: 'Skol', prd_venda: 'S', prd_ativo: 'S', grp_desc: 'Cervejas' },
      ];
      
      // Filtrar produtos válidos
      const prefixosExcluidos = ['[HH]', '[DD]', '[IN]'];
      const produtosValidos = produtos.filter(
        p => p.prd_ativo === 'S' &&
             !prefixosExcluidos.some(prefix => p.prd_desc.startsWith(prefix)) &&
             !p.grp_desc.toLowerCase().includes('insumo')
      );
      
      const semEstoque = produtosValidos.filter(p => p.prd_venda === 'N').length;
      const total = produtosValidos.length;
      const percStockout = (semEstoque / total) * 100;
      
      expect(produtosValidos.length).toBe(3); // Brahma, Heineken, Skol
      expect(semEstoque).toBe(2); // Brahma, Heineken
      expect(percStockout).toBeCloseTo(66.67, 2);
    });

    it('deve calcular stockout por categoria (bar, drinks, comida)', () => {
      const produtos = [
        // BAR
        { prd_desc: 'Cerveja', prd_venda: 'N', prd_ativo: 'S', loc_desc: 'Bar' },
        { prd_desc: 'Chopp', prd_venda: 'S', prd_ativo: 'S', loc_desc: 'Chopp' },
        // DRINKS
        { prd_desc: 'Caipirinha', prd_venda: 'N', prd_ativo: 'S', loc_desc: 'Drinks' },
        { prd_desc: 'Mojito', prd_venda: 'N', prd_ativo: 'S', loc_desc: 'Drinks' },
        { prd_desc: 'Margarita', prd_venda: 'S', prd_ativo: 'S', loc_desc: 'Drinks' },
        // COMIDA
        { prd_desc: 'Hambúrguer', prd_venda: 'N', prd_ativo: 'S', loc_desc: 'Cozinha' },
        { prd_desc: 'Batata Frita', prd_venda: 'S', prd_ativo: 'S', loc_desc: 'Cozinha' },
      ];
      
      const locaisBar = ['Bar', 'Chopp', 'Baldes'];
      const locaisDrinks = ['Drinks', 'Preshh', 'Montados'];
      const locaisComida = ['Cozinha', 'Cozinha 1', 'Cozinha 2'];
      
      // Stockout Bar
      const produtosBar = produtos.filter(p => locaisBar.includes(p.loc_desc));
      const stockoutBar = (produtosBar.filter(p => p.prd_venda === 'N').length / produtosBar.length) * 100;
      
      // Stockout Drinks
      const produtosDrinks = produtos.filter(p => locaisDrinks.includes(p.loc_desc));
      const stockoutDrinks = (produtosDrinks.filter(p => p.prd_venda === 'N').length / produtosDrinks.length) * 100;
      
      // Stockout Comida
      const produtosComida = produtos.filter(p => locaisComida.includes(p.loc_desc));
      const stockoutComida = (produtosComida.filter(p => p.prd_venda === 'N').length / produtosComida.length) * 100;
      
      expect(stockoutBar).toBe(50); // 1 de 2
      expect(stockoutDrinks).toBeCloseTo(66.67, 2); // 2 de 3
      expect(stockoutComida).toBe(50); // 1 de 2
    });
  });

  describe('Metas de Stockout', () => {
    it('deve identificar stockout ideal < 5%', () => {
      const percStockout = 3.5;
      const isIdeal = percStockout < 5;
      
      expect(isIdeal).toBe(true);
    });

    it('deve identificar stockout aceitável entre 5-10%', () => {
      const percStockout = 7.5;
      const isAceitavel = percStockout >= 5 && percStockout <= 10;
      
      expect(isAceitavel).toBe(true);
    });

    it('deve identificar stockout problemático > 10%', () => {
      const percStockout = 12;
      const isProblematico = percStockout > 10;
      
      expect(isProblematico).toBe(true);
    });

    it('deve identificar stockout crítico > 15%', () => {
      const percStockout = 18;
      const isCritico = percStockout > 15;
      
      expect(isCritico).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('deve retornar 0% quando não há produtos', () => {
      const produtos: any[] = [];
      
      const semEstoque = produtos.filter(p => p.prd_venda === 'N').length;
      const total = produtos.length;
      const percStockout = total === 0 ? 0 : (semEstoque / total) * 100;
      
      expect(percStockout).toBe(0);
    });

    it('deve lidar com produtos sem loc_desc', () => {
      const produtos = [
        { prd_desc: 'Produto 1', prd_venda: 'N', prd_ativo: 'S', loc_desc: null },
        { prd_desc: 'Produto 2', prd_venda: 'S', prd_ativo: 'S', loc_desc: 'Bar' },
      ];
      
      const produtosValidos = produtos.filter(p => p.prd_ativo === 'S');
      const semEstoque = produtosValidos.filter(p => p.prd_venda === 'N').length;
      const total = produtosValidos.length;
      const percStockout = (semEstoque / total) * 100;
      
      expect(percStockout).toBe(50);
    });
  });
});
