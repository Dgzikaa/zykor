/**
 * 🧪 Testes - InsightsV2Card
 * 
 * Testes unitários e de integração para o componente InsightsV2Card
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import InsightsV2Card from './InsightsV2Card';

// Mock do fetch global
global.fetch = jest.fn();

// Mock do toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('InsightsV2Card', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // TESTES DE RENDERIZAÇÃO
  // ============================================================

  it('deve renderizar o componente corretamente', () => {
    render(<InsightsV2Card barId={3} />);
    
    expect(screen.getByText('Insights V2 — Análise Inteligente')).toBeInTheDocument();
    expect(screen.getByText('Executar Análise')).toBeInTheDocument();
  });

  it('deve renderizar em modo compacto', () => {
    render(<InsightsV2Card barId={3} compact={true} />);
    
    expect(screen.getByText('Insights V2')).toBeInTheDocument();
    expect(screen.queryByText('Executar Análise')).not.toBeInTheDocument();
  });

  it('deve renderizar sem ações quando showActions=false', () => {
    render(<InsightsV2Card barId={3} showActions={false} />);
    
    expect(screen.queryByText('Executar Análise')).not.toBeInTheDocument();
  });

  // ============================================================
  // TESTES DE LOADING
  // ============================================================

  it('deve mostrar skeleton durante loading', async () => {
    (global.fetch as jest.Mock).mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({
        json: async () => ({ success: true, insights: [], stats: {} })
      }), 1000))
    );

    render(<InsightsV2Card barId={3} />);
    
    const skeletons = screen.getAllByRole('status');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // ============================================================
  // TESTES DE EMPTY STATE
  // ============================================================

  it('deve mostrar empty state quando não há insights', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        insights: [],
        stats: {
          total: 0,
          nao_visualizados: 0,
          problemas: 0,
          oportunidades: 0,
          por_severidade: { alta: 0, media: 0, baixa: 0 }
        }
      })
    });

    render(<InsightsV2Card barId={3} />);
    
    await waitFor(() => {
      expect(screen.getByText('✨ Nenhum insight no momento.')).toBeInTheDocument();
    });
  });

  // ============================================================
  // TESTES DE EXIBIÇÃO DE DADOS
  // ============================================================

  it('deve exibir insights corretamente', async () => {
    const mockInsights = [
      {
        id: '1',
        bar_id: 3,
        data: '2026-03-30',
        titulo: 'Queda no Ticket Médio',
        descricao: 'Ticket médio caiu 15%',
        severidade: 'alta',
        tipo: 'problema',
        causa_provavel: 'Menos consumo de bebidas premium',
        acoes_recomendadas: ['Revisar cardápio', 'Treinar equipe'],
        eventos_relacionados: [],
        resumo_geral: null,
        source: 'zykor_agent',
        visualizado: false,
        arquivado: false,
        created_at: '2026-04-01T09:00:00Z'
      }
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        insights: mockInsights,
        stats: {
          total: 1,
          nao_visualizados: 1,
          problemas: 1,
          oportunidades: 0,
          por_severidade: { alta: 1, media: 0, baixa: 0 }
        }
      })
    });

    render(<InsightsV2Card barId={3} />);
    
    await waitFor(() => {
      expect(screen.getByText('Queda no Ticket Médio')).toBeInTheDocument();
      expect(screen.getByText('Ticket médio caiu 15%')).toBeInTheDocument();
      expect(screen.getByText('Menos consumo de bebidas premium')).toBeInTheDocument();
    });
  });

  // ============================================================
  // TESTES DE BADGES
  // ============================================================

  it('deve exibir badge de severidade corretamente', async () => {
    const mockInsights = [
      {
        id: '1',
        titulo: 'Insight Alta',
        severidade: 'alta',
        tipo: 'problema',
        descricao: 'Teste',
        acoes_recomendadas: [],
        eventos_relacionados: [],
        visualizado: false,
        arquivado: false,
        created_at: '2026-04-01T09:00:00Z'
      }
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        insights: mockInsights,
        stats: {}
      })
    });

    render(<InsightsV2Card barId={3} />);
    
    await waitFor(() => {
      expect(screen.getByText('Alta')).toBeInTheDocument();
    });
  });

  it('deve exibir badge "Novo" para insights não visualizados', async () => {
    const mockInsights = [
      {
        id: '1',
        titulo: 'Insight Novo',
        severidade: 'media',
        tipo: 'oportunidade',
        descricao: 'Teste',
        acoes_recomendadas: [],
        eventos_relacionados: [],
        visualizado: false,
        arquivado: false,
        created_at: '2026-04-01T09:00:00Z'
      }
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        insights: mockInsights,
        stats: {}
      })
    });

    render(<InsightsV2Card barId={3} />);
    
    await waitFor(() => {
      expect(screen.getByText('Novo')).toBeInTheDocument();
    });
  });

  // ============================================================
  // TESTES DE AÇÕES
  // ============================================================

  it('deve executar análise ao clicar no botão', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: async () => ({ success: true, insights: [], stats: {} })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          pipeline: {
            detector: { eventos_detectados: 3 },
            narrator: { insights_gerados: 1 }
          }
        })
      })
      .mockResolvedValueOnce({
        json: async () => ({ success: true, insights: [], stats: {} })
      });

    render(<InsightsV2Card barId={3} />);
    
    await waitFor(() => {
      expect(screen.getByText('Executar Análise')).toBeInTheDocument();
    });

    const button = screen.getByText('Executar Análise');
    fireEvent.click(button);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('Análise concluída')
      );
    });
  });

  it('deve marcar insight como lido', async () => {
    const mockInsights = [
      {
        id: '1',
        titulo: 'Insight Teste',
        severidade: 'media',
        tipo: 'problema',
        descricao: 'Teste',
        acoes_recomendadas: [],
        eventos_relacionados: [],
        visualizado: false,
        arquivado: false,
        created_at: '2026-04-01T09:00:00Z'
      }
    ];

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          insights: mockInsights,
          stats: {}
        })
      })
      .mockResolvedValueOnce({
        json: async () => ({ success: true })
      });

    render(<InsightsV2Card barId={3} />);
    
    await waitFor(() => {
      expect(screen.getByText('Marcar como lido')).toBeInTheDocument();
    });

    const button = screen.getByText('Marcar como lido');
    fireEvent.click(button);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/agente/insights-v2',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"visualizado":true')
        })
      );
    });
  });

  // ============================================================
  // TESTES DE FILTROS
  // ============================================================

  it('deve aplicar filtro de tipo', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ success: true, insights: [], stats: {} })
    });

    render(<InsightsV2Card barId={3} />);
    
    await waitFor(() => {
      expect(screen.getByText('Todos os tipos')).toBeInTheDocument();
    });

    const select = screen.getByDisplayValue('Todos os tipos');
    fireEvent.change(select, { target: { value: 'problema' } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('tipo=problema')
      );
    });
  });

  it('deve aplicar filtro de severidade', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ success: true, insights: [], stats: {} })
    });

    render(<InsightsV2Card barId={3} />);
    
    await waitFor(() => {
      expect(screen.getByText('Todas as severidades')).toBeInTheDocument();
    });

    const select = screen.getByDisplayValue('Todas as severidades');
    fireEvent.change(select, { target: { value: 'alta' } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('severidade=alta')
      );
    });
  });

  // ============================================================
  // TESTES DE STATS
  // ============================================================

  it('deve exibir stats corretamente', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        insights: [],
        stats: {
          total: 15,
          nao_visualizados: 8,
          problemas: 10,
          oportunidades: 5,
          por_severidade: { alta: 3, media: 8, baixa: 4 }
        }
      })
    });

    render(<InsightsV2Card barId={3} />);
    
    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument(); // Total
      expect(screen.getByText('8')).toBeInTheDocument();  // Não lidos
      expect(screen.getByText('10')).toBeInTheDocument(); // Problemas
      expect(screen.getByText('5')).toBeInTheDocument();  // Oportunidades
    });
  });

  // ============================================================
  // TESTES DE AÇÕES RECOMENDADAS
  // ============================================================

  it('deve exibir ações recomendadas', async () => {
    const mockInsights = [
      {
        id: '1',
        titulo: 'Insight com Ações',
        severidade: 'alta',
        tipo: 'problema',
        descricao: 'Teste',
        acoes_recomendadas: [
          'Ação 1',
          'Ação 2',
          'Ação 3'
        ],
        eventos_relacionados: [],
        visualizado: false,
        arquivado: false,
        created_at: '2026-04-01T09:00:00Z'
      }
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        insights: mockInsights,
        stats: {}
      })
    });

    render(<InsightsV2Card barId={3} />);
    
    await waitFor(() => {
      expect(screen.getByText('✅ Ações recomendadas:')).toBeInTheDocument();
      expect(screen.getByText('Ação 1')).toBeInTheDocument();
      expect(screen.getByText('Ação 2')).toBeInTheDocument();
      expect(screen.getByText('+1 ações adicionais')).toBeInTheDocument();
    });
  });

  // ============================================================
  // TESTES DE ATUALIZAÇÃO
  // ============================================================

  it('deve atualizar insights ao clicar em refresh', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ success: true, insights: [], stats: {} })
    });

    render(<InsightsV2Card barId={3} />);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    const refreshButton = screen.getAllByRole('button').find(
      btn => btn.querySelector('svg')?.classList.contains('lucide-refresh-ccw')
    );

    if (refreshButton) {
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    }
  });

  // ============================================================
  // TESTES DE ERRO
  // ============================================================

  it('deve tratar erro ao buscar insights', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    render(<InsightsV2Card barId={3} />);
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Erro ao buscar insights v2:',
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });

  it('deve tratar erro ao executar análise', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: async () => ({ success: true, insights: [], stats: {} })
      })
      .mockRejectedValueOnce(new Error('Pipeline error'));

    render(<InsightsV2Card barId={3} />);
    
    await waitFor(() => {
      expect(screen.getByText('Executar Análise')).toBeInTheDocument();
    });

    const button = screen.getByText('Executar Análise');
    fireEvent.click(button);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Erro ao executar análise');
    });
  });
});

// ============================================================
// TESTES DE INTEGRAÇÃO
// ============================================================

describe('InsightsV2Card - Integração', () => {
  it('deve executar fluxo completo: análise → fetch → marcar lido', async () => {
    const mockInsight = {
      id: '1',
      titulo: 'Insight Teste',
      severidade: 'alta',
      tipo: 'problema',
      descricao: 'Teste completo',
      acoes_recomendadas: ['Ação 1'],
      eventos_relacionados: [],
      visualizado: false,
      arquivado: false,
      created_at: '2026-04-01T09:00:00Z'
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: async () => ({ success: true, insights: [], stats: {} })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          pipeline: {
            detector: { eventos_detectados: 1 },
            narrator: { insights_gerados: 1 }
          }
        })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          insights: [mockInsight],
          stats: { total: 1, nao_visualizados: 1, problemas: 1, oportunidades: 0 }
        })
      })
      .mockResolvedValueOnce({
        json: async () => ({ success: true })
      });

    render(<InsightsV2Card barId={3} />);
    
    // 1. Executar análise
    await waitFor(() => {
      expect(screen.getByText('Executar Análise')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Executar Análise'));

    // 2. Verificar toast de sucesso
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });

    // 3. Verificar se insight apareceu
    await waitFor(() => {
      expect(screen.getByText('Insight Teste')).toBeInTheDocument();
    });

    // 4. Marcar como lido
    fireEvent.click(screen.getByText('Marcar como lido'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/agente/insights-v2',
        expect.objectContaining({ method: 'PUT' })
      );
    });
  });
});
