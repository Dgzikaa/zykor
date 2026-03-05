'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  ArrowRight,
  Home,
  CheckSquare,
  Settings,
  BarChart3,
  Calendar,
  PieChart,
  TrendingUp,
  Database,
  Zap,
  ChefHat,
  FileText,
  Bell,
  UserCircle,
  RefreshCw,
  Trash2,
  Command,
  Navigation,
} from 'lucide-react';

// Tipos para comandos
interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  action?: () => void | Promise<void>;
  category: 'navigation' | 'actions' | 'cache' | 'admin' | 'quick';
  keywords: string[];
  badge?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isExecuting, setIsExecuting] = useState(false);
  const router = useRouter();

  // Comandos disponíveis
  const commands: CommandItem[] = useMemo(
    () => [
      // Navegação Principal
      {
        id: 'nav-home',
        title: 'Home',
        description: 'Página inicial do sistema',
        icon: Home,
        href: '/home',
        category: 'navigation',
        keywords: ['home', 'início', 'principal', 'dashboard'],
      },
      {
        id: 'nav-checklists',
        title: 'Checklists',
        description: 'Gerenciar listas de verificação',
        icon: CheckSquare,
        href: '/checklists',
        category: 'navigation',
        keywords: ['checklist', 'lista', 'verificação', 'tarefa'],
      },
      {
        id: 'nav-funcionario-checklists',
        title: 'Checklists do Funcionário',
        description: 'Área de checklists para funcionários',
        icon: CheckSquare,
        href: '/funcionario/checklists',
        category: 'navigation',
        keywords: ['funcionário', 'colaborador', 'checklist', 'trabalho'],
      },
      {
        id: 'nav-visao-mensal',
        title: 'Estratégico - Visão Mensal',
        description: 'Comparativo mensal dos últimos 3 meses',
        icon: Calendar,
        href: '/estrategico/visao-mensal',
        category: 'navigation',
        keywords: ['estratégico', 'visão', 'mensal', 'comparativo', 'mês', 'indicadores', 'evolução'],
      },

      // Configurações
      {
        id: 'nav-config',
        title: 'Configurações',
        description: 'Configurações do sistema',
        icon: Settings,
        href: '/configuracoes',
        category: 'navigation',
        keywords: ['configuração', 'config', 'setting', 'admin'],
      },
      {
        id: 'nav-analytics',
        title: 'Analytics',
        description: 'Métricas e analytics do sistema',
        icon: BarChart3,
        href: '/configuracoes/analytics',
        category: 'navigation',
        keywords: ['analytics', 'métricas', 'estatísticas', 'dados'],
        badge: 'NEW',
      },
      {
        id: 'nav-cache',
        title: 'Cache',
        description: 'Monitoramento de cache e performance',
        icon: Database,
        href: '/configuracoes/cache',
        category: 'navigation',
        keywords: ['cache', 'performance', 'redis', 'memória'],
        badge: 'NEW',
      },
      {
        id: 'nav-templates',
        title: 'Templates',
        description: 'Gerenciar templates do sistema',
        icon: FileText,
        href: '/configuracoes/templates',
        category: 'navigation',
        keywords: ['template', 'modelo', 'layout'],
      },

      // Relatórios
      {
        id: 'nav-relatorios',
        title: 'Relatórios',
        description: 'Todos os relatórios do sistema',
        icon: PieChart,
        href: '/relatorios',
        category: 'navigation',
        keywords: ['relatório', 'report', 'dados', 'análise'],
      },
      {
        id: 'nav-contahub-teste',
        title: 'ContaHub Teste',
        description: 'Relatório de teste ContaHub',
        icon: TrendingUp,
        href: '/relatorios/contahub-teste',
        category: 'navigation',
        keywords: ['contahub', 'teste', 'relatório'],
      },
      {
        id: 'nav-analitico',
        title: 'Analítico',
        description: 'Relatório analítico detalhado',
        icon: BarChart3,
        href: '/analitico',
        category: 'navigation',
        keywords: ['analítico', 'análise', 'detalhado'],
      },
      {
        id: 'nav-analitico-semanal',
        title: 'Analítico - Semanal',
        description: 'Comparativo das últimas 4 ocorrências por dia da semana',
        icon: Calendar,
        href: '/analitico/semanal',
        category: 'navigation',
        keywords: ['analítico', 'semanal', 'comparativo', 'dia', 'semana'],
      },
      {
        id: 'nav-vendas-categorias',
        title: 'Vendas por Categoria',
        description: 'Drinks, Cervejas e Comidas vendidas por ano',
        icon: TrendingUp,
        href: '/relatorios/vendas-categorias',
        category: 'navigation',
        keywords: ['vendas', 'categoria', 'drinks', 'cervejas', 'comidas', 'ano'],
      },

      // Operações
      {
        id: 'nav-operacoes',
        title: 'Operações',
        description: 'Centro de controle operacional',
        icon: Zap,
        href: '/operacoes',
        category: 'navigation',
        keywords: ['operação', 'operacional', 'gestão', 'controle'],
      },
      {
        id: 'nav-receitas',
        title: 'Fichas Técnicas',
        description: 'Gerenciar fichas técnicas e receitas',
        icon: ChefHat,
        href: '/extras/fichas-tecnicas',
        category: 'navigation',
        keywords: ['receita', 'produto', 'cardápio', 'comida', 'ficha técnica'],
      },
      {
        id: 'nav-tempo',
        title: 'Tempo',
        description: 'Controle de tempo operacional',
        icon: Calendar,
        href: '/operacoes/tempo',
        category: 'navigation',
        keywords: ['tempo', 'horário', 'cronômetro'],
      },

      // Visão Geral
      {
        id: 'nav-visao-geral',
        title: 'Visão Geral',
        description: 'Análises e visões gerais',
        icon: TrendingUp,
        href: '/visao-geral',
        category: 'navigation',
        keywords: ['visão', 'geral', 'overview', 'resumo'],
      },
      {
        id: 'nav-comparativo',
        title: 'Comparativo',
        description: 'Análise comparativa de dados',
        icon: BarChart3,
        href: '/visao-geral/comparativo',
        category: 'navigation',
        keywords: ['comparativo', 'comparação', 'análise'],
      },

      // Conta
      {
        id: 'nav-minha-conta',
        title: 'Minha Conta',
        description: 'Gerenciar conta do usuário',
        icon: UserCircle,
        href: '/usuarios/minha-conta',
        category: 'navigation',
        keywords: ['conta', 'perfil', 'usuário', 'configuração'],
      },
      {
        id: 'nav-notifications',
        title: 'Notificações',
        description: 'Central de notificações',
        icon: Bell,
        href: '/usuarios/notifications',
        category: 'navigation',
        keywords: ['notificação', 'alerta', 'aviso'],
      },

      // Ações de Cache
      {
        id: 'action-cache-clear',
        title: 'Limpar Cache',
        description: 'Limpar todo o cache do sistema',
        icon: Trash2,
        category: 'cache',
        keywords: ['limpar', 'cache', 'clear', 'reset'],
        action: async () => {
          await fetch('/api/cache/metricas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'clear' }),
          });
        },
      },
      {
        id: 'action-cache-warmup',
        title: 'Cache Warmup',
        description: 'Pré-aquecer cache com dados críticos',
        icon: Zap,
        category: 'cache',
        keywords: ['warmup', 'cache', 'preaquecer', 'inicializar'],
        action: async () => {
          await fetch('/api/cache/metricas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'warmup' }),
          });
        },
      },

      // Ações Rápidas
      {
        id: 'action-refresh',
        title: 'Recarregar Página',
        description: 'Atualizar a página atual',
        icon: RefreshCw,
        category: 'quick',
        keywords: ['refresh', 'reload', 'atualizar', 'recarregar'],
        action: () => {
          window.location.reload();
        },
      },
    ],
    []
  );

  // Busca fuzzy
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;

    const lowerQuery = query.toLowerCase();

    return commands
      .filter(command => {
        // Busca no título
        if (command.title.toLowerCase().includes(lowerQuery)) return true;

        // Busca na descrição
        if (command.description?.toLowerCase().includes(lowerQuery))
          return true;

        // Busca nas keywords
        if (
          command.keywords.some(keyword =>
            keyword.toLowerCase().includes(lowerQuery)
          )
        )
          return true;

        return false;
      })
      .sort((a, b) => {
        // Priorizar matches exatos no título
        const aExact = a.title.toLowerCase().startsWith(lowerQuery);
        const bExact = b.title.toLowerCase().startsWith(lowerQuery);

        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        return 0;
      });
  }, [query, commands]);

  // Resetar seleção quando mudar a busca
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelectCommand = useCallback(async (command: CommandItem) => {
    if (isExecuting) return;

    setIsExecuting(true);

    try {
      if (command.action) {
        await command.action();
      } else if (command.href) {
        router.push(command.href);
      }
    } catch (error) {
      console.error('Erro ao executar comando:', error);
    } finally {
      setIsExecuting(false);
      onClose();
      setQuery('');
    }
  }, [isExecuting, onClose, router]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            handleSelectCommand(filteredCommands[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose, handleSelectCommand]);

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'navigation':
        return 'Navegação';
      case 'actions':
        return 'Ações';
      case 'cache':
        return 'Cache';
      case 'admin':
        return 'Administração';
      case 'quick':
        return 'Ações Rápidas';
      default:
        return 'Outros';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'navigation':
        return Navigation;
      case 'actions':
        return Zap;
      case 'cache':
        return Database;
      case 'admin':
        return Settings;
      case 'quick':
        return Command;
      default:
        return Search;
    }
  };

  // Agrupar comandos por categoria
  const groupedCommands = useMemo(() => {
    const groups = filteredCommands.reduce(
      (acc, command) => {
        if (!acc[command.category]) {
          acc[command.category] = [];
        }
        acc[command.category].push(command);
        return acc;
      },
      {} as Record<string, CommandItem[]>
    );

    return Object.entries(groups).sort(([a], [b]) => {
      const order = ['navigation', 'quick', 'cache', 'actions', 'admin'];
      return order.indexOf(a) - order.indexOf(b);
    });
  }, [filteredCommands]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="modal-dark max-w-2xl sm:max-w-lg md:max-w-2xl p-0 mx-4 sm:mx-0">
        <div className="command-palette">
          {/* Header com busca */}
          <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
            <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <Input
              placeholder="Digite um comando ou navegue..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="border-0 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-0 text-base sm:text-lg flex-1"
            />
            <div className="hidden sm:flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                ↵
              </kbd>
              <span>selecionar</span>
            </div>
          </div>

          {/* Lista de comandos */}
          <div className="max-h-96 sm:max-h-80 md:max-h-96 overflow-y-auto">
            {groupedCommands.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum comando encontrado</p>
                <p className="text-sm">Tente uma busca diferente</p>
              </div>
            ) : (
              groupedCommands.map(
                ([category, categoryCommands], groupIndex) => (
                  <div
                    key={category}
                    className={
                      groupIndex > 0
                        ? 'border-t border-gray-200 dark:border-gray-700'
                        : ''
                    }
                  >
                    {/* Header da categoria */}
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                        {(() => {
                          const Icon = getCategoryIcon(category);
                          return <Icon className="w-3 h-3" />;
                        })()}
                        {getCategoryLabel(category)}
                      </div>
                    </div>

                    {/* Comandos da categoria */}
                    {categoryCommands.map((command, index) => {
                      const absoluteIndex = filteredCommands.indexOf(command);
                      const isSelected = selectedIndex === absoluteIndex;

                      return (
                        <div
                          key={command.id}
                          className={`
                          flex items-center gap-3 px-4 py-3 sm:py-2 cursor-pointer transition-colors touch-manipulation
                          ${
                            isSelected
                              ? 'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-blue-500'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 active:bg-gray-100 dark:active:bg-gray-600'
                          }
                          ${isExecuting ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                          onClick={() =>
                            !isExecuting && handleSelectCommand(command)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              if (!isExecuting) {
                                handleSelectCommand(command);
                              }
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <command.icon
                            className={`w-5 h-5 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}
                          />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-medium ${isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-white'}`}
                              >
                                {command.title}
                              </span>
                              {command.badge && (
                                <Badge className="badge-primary text-xs">
                                  {command.badge}
                                </Badge>
                              )}
                            </div>
                            {command.description && (
                              <p
                                className={`text-sm ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}
                              >
                                {command.description}
                              </p>
                            )}
                          </div>

                          <ArrowRight
                            className={`w-4 h-4 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )
              )
            )}
          </div>

          {/* Footer com shortcuts */}
          <div className="hidden sm:flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">
                  ↑↓
                </kbd>
                <span>navegar</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">
                  ↵
                </kbd>
                <span>selecionar</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">
                  esc
                </kbd>
                <span>fechar</span>
              </div>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400">
              {filteredCommands.length} comando
              {filteredCommands.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
