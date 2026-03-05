'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useBarContext } from '@/contexts/BarContext';
import { useUser } from '@/contexts/UserContext';
import {
  Search,
  Command,
  Clock,
  Star,
  ArrowRight,
  File,
  Users,
  Settings,
  BarChart3,
  Home,
  Zap,
  Target,
  TrendingUp,
  X,
  Brain,
  History,
  DollarSign,
  CheckCircle,
  Lightbulb,
  BookOpen,
  Database,
  Layers,
  Cpu,
  RefreshCw,
  Save,
  Keyboard,
  Package,
} from 'lucide-react';

// Tipos para o sistema de busca
interface SearchResult {
  id: string;
  title: string;
  description?: string;
  category: 'page' | 'feature' | 'data' | 'action' | 'help';
  icon: React.ElementType;
  href?: string;
  action?: () => void;
  keywords: string[];
  priority: number;
  lastUsed?: Date;
  isFavorite?: boolean;
  badge?: string;
  shortcut?: string;
  context?: string;
}

interface SearchCategory {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
}

interface UnifiedSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (href: string) => void;
}

const searchCategories: SearchCategory[] = [
  { id: 'page', name: 'Páginas', icon: File, color: 'text-blue-600' },
  {
    id: 'feature',
    name: 'Funcionalidades',
    icon: Zap,
    color: 'text-green-600',
  },
  { id: 'data', name: 'Dados', icon: Database, color: 'text-purple-600' },
  { id: 'action', name: 'Ações', icon: Target, color: 'text-orange-600' },
  { id: 'help', name: 'Ajuda', icon: Lightbulb, color: 'text-yellow-600' },
];

export default function UnifiedSearch({
  isOpen = false,
  onClose = () => {},
  onNavigate,
}: UnifiedSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { selectedBar } = useBarContext();
  const { user } = useUser();

  // Resultados de busca
  const searchResults: SearchResult[] = [
    // Páginas principais
    {
      id: 'home',
      title: 'Home',
      description: 'Página inicial do sistema',
      category: 'page',
      icon: Home,
      href: '/home',
      keywords: ['home', 'início', 'principal', 'dashboard'],
      priority: 100,
      shortcut: 'Ctrl+H',
    },
    {
      id: 'dashboard-unificado',
      title: 'Dashboard Unificado',
      description: 'Centro de comando completo com widgets personalizáveis',
      category: 'page',
      icon: Target,
      href: '/dashboard-unificado',
      keywords: [
        'dashboard',
        'unificado',
        'centro',
        'comando',
        'widgets',
        'personalização',
      ],
      priority: 95,
      badge: 'Novo',
      shortcut: 'Ctrl+D',
    },
    {
      id: 'visao-geral',
      title: 'Visão Geral',
      description: 'Análise completa do desempenho do bar',
      category: 'page',
      icon: BarChart3,
      href: '/visao-geral',
      keywords: ['visão', 'geral', 'análise', 'desempenho', 'métricas'],
      priority: 90,
    },

    // Operações
    {
      id: 'operacoes',
      title: 'Operações',
      description: 'Centro de controle operacional completo',
      category: 'page',
      icon: Zap,
      href: '/operacoes',
      keywords: ['operações', 'controle', 'operacional', 'gestão'],
      priority: 90,
      shortcut: 'Ctrl+O',
    },
    {
      id: 'checklist-abertura',
      title: 'Checklist de Abertura',
      description: 'Lista de verificação para abertura do bar',
      category: 'feature',
      icon: CheckCircle,
      href: '/operacoes/checklist-abertura',
      keywords: ['checklist', 'abertura', 'verificação', 'operação'],
      priority: 85,
    },
    {
      id: 'terminal-producao',
      title: 'Terminal de Produção',
      description: 'Interface para gerenciamento da produção',
      category: 'feature',
      icon: Cpu,
      href: '/ferramentas/terminal',
      keywords: ['terminal', 'produção', 'cozinha', 'pedidos'],
      priority: 85,
      shortcut: 'Ctrl+P',
    },
    {
      id: 'receitas',
      title: 'Fichas Técnicas',
      description: 'Gerenciamento de fichas técnicas e ingredientes',
      category: 'feature',
      icon: BookOpen,
      href: '/extras/fichas-tecnicas',
      keywords: ['receitas', 'ingredientes', 'cardápio', 'produtos', 'ficha técnica'],
      priority: 80,
    },

    // Relatórios
    {
      id: 'dashboard-financeiro',
      title: 'Dashboard Financeiro',
      description: 'Análise financeira completa',
      category: 'page',
      icon: DollarSign,
      href: '/dashboard-financeiro',
      keywords: [
        'financeiro',
        'receitas',
        'despesas',
        'lucro',
        'contabilidade',
      ],
      priority: 80,
      shortcut: 'Ctrl+F',
    },
    {
      id: 'relatorio-analitico',
      title: 'Relatório Analítico',
      description: 'Análise detalhada de dados',
      category: 'page',
      icon: TrendingUp,
      href: '/analitico',
      keywords: ['relatório', 'analítico', 'dados', 'estatísticas'],
      priority: 75,
    },

    // Configurações
    {
      id: 'configuracoes',
      title: 'Configurações',
      description: 'Configurações gerais do sistema',
      category: 'page',
      icon: Settings,
      href: '/configuracoes',
      keywords: ['configurações', 'ajustes', 'preferências', 'admin'],
      priority: 70,
      shortcut: 'Ctrl+,',
    },
    {
      id: 'integracoes',
      title: 'Integrações',
      description: 'Gerenciar integrações com sistemas externos',
      category: 'feature',
      icon: Layers,
      href: '/configuracoes/administracao/integracoes',
      keywords: ['integrações', 'apis', 'conexões', 'windsor'],
      priority: 65,
    },

    // Ações
    {
      id: 'sync-windsor',
      title: 'Sincronizar Windsor.ai',
      description: 'Forçar sincronização com Windsor.ai',
      category: 'action',
      icon: RefreshCw,
      action: () => {
        console.log('Sincronizando Windsor.ai...');
      },
      keywords: ['sincronizar', 'windsor', 'refresh', 'atualizar'],
      priority: 60,
    },
    {
      id: 'backup-dados',
      title: 'Backup de Dados',
      description: 'Criar backup dos dados do sistema',
      category: 'action',
      icon: Save,
      action: () => {
        console.log('Criando backup...');
      },
      keywords: ['backup', 'dados', 'exportar', 'salvar'],
      priority: 55,
    },

    // Dados
    {
      id: 'usuarios',
      title: 'Usuários',
      description: 'Gerenciar usuários do sistema',
      category: 'data',
      icon: Users,
      href: '/configuracoes/administracao/usuarios',
      keywords: ['usuários', 'pessoas', 'funcionários', 'equipe'],
      priority: 70,
    },
    {
      id: 'produtos',
      title: 'Produtos',
      description: 'Catálogo de produtos',
      category: 'data',
      icon: Package,
      href: '/operacoes/produtos',
      keywords: ['produtos', 'itens', 'cardápio', 'estoque'],
      priority: 70,
    },

    // Ajuda
    {
      id: 'atalhos',
      title: 'Atalhos de Teclado',
      description: 'Lista de atalhos disponíveis',
      category: 'help',
      icon: Keyboard,
      action: () => {
        console.log('Mostrando atalhos...');
      },
      keywords: ['atalhos', 'teclado', 'shortcuts', 'hotkeys'],
      priority: 50,
      shortcut: 'Ctrl+?',
    },
    {
      id: 'documentacao',
      title: 'Documentação',
      description: 'Documentação completa do sistema',
      category: 'help',
      icon: BookOpen,
      href: '/docs',
      keywords: ['documentação', 'manual', 'guia', 'ajuda'],
      priority: 45,
    },
  ];

  // Filtrar resultados baseado na query
  const filteredResults =
    query.length > 0
      ? searchResults
          .filter(result => {
            const searchTerms = query.toLowerCase().split(' ');
            return searchTerms.every(
              term =>
                result.title.toLowerCase().includes(term) ||
                result.description?.toLowerCase().includes(term) ||
                result.keywords.some(keyword =>
                  keyword.toLowerCase().includes(term)
                )
            );
          })
          .sort((a, b) => b.priority - a.priority)
      : searchResults
          .filter(
            result =>
              favorites.includes(result.id) ||
              result.lastUsed ||
              result.priority > 80
          )
          .sort((a, b) => b.priority - a.priority);

  // Filtrar por categoria ativa
  const categoryFilteredResults = activeCategory
    ? filteredResults.filter(result => result.category === activeCategory)
    : filteredResults;

  // Agrupar resultados por categoria
  const groupedResults = categoryFilteredResults.reduce(
    (acc, result) => {
      if (!acc[result.category]) {
        acc[result.category] = [];
      }
      acc[result.category].push(result);
      return acc;
    },
    {} as Record<string, SearchResult[]>
  );

  // Handlers
  const handleResultSelect = useCallback((result: SearchResult) => {
    // Adicionar aos recentes
    setRecentSearches(prev => {
      const filtered = prev.filter(item => item.id !== result.id);
      return [result, ...filtered].slice(0, 5);
    });

    // Executar ação baseada no tipo
    if (result.category === 'page') {
      if (result.href) {
        if (onNavigate) {
          onNavigate(result.href);
        } else {
          router.push(result.href);
        }
      }
      onClose();
    } else if (result.category === 'action') {
      if (result.action) {
        result.action();
      }
      onClose();
    }
  }, [router, onNavigate, onClose]);

  const toggleFavorite = (resultId: string) => {
    setFavorites(prev =>
      prev.includes(resultId)
        ? prev.filter(id => id !== resultId)
        : [...prev, resultId]
    );
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        // Será controlado pelo componente pai
      }

      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev =>
            Math.min(prev + 1, categoryFilteredResults.length - 1)
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (categoryFilteredResults[selectedIndex]) {
            handleResultSelect(categoryFilteredResults[selectedIndex]);
          }
          break;
      }
    },
    [isOpen, selectedIndex, categoryFilteredResults, onClose, handleResultSelect]
  );

  // Effects
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeCategory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[10vh]">
      <Card className="w-full max-w-2xl mx-4 shadow-2xl border-0 bg-white dark:bg-gray-800">
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
            <Search className="h-5 w-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Buscar páginas, funcionalidades, dados..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="flex-1 text-lg bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                <Command className="h-3 w-3 mr-1" />K
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Categories */}
          <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700">
            <Button
              variant={activeCategory === null ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveCategory(null)}
              className="h-8 text-xs"
            >
              Todos
            </Button>
            {searchCategories.map(category => (
              <Button
                key={category.id}
                variant={activeCategory === category.id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveCategory(category.id)}
                className="h-8 text-xs"
              >
                <category.icon className="h-3 w-3 mr-1" />
                {category.name}
              </Button>
            ))}
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {query.length === 0 && recentSearches.length > 0 && (
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
                  <Clock className="h-4 w-4" />
                  Recentes
                </div>
                <div className="space-y-1">
                  {recentSearches.map((search, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-2 py-1 text-sm text-gray-700 dark:text-gray-300"
                    >
                      <History className="h-3 w-3" />
                      {search.title}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Object.entries(groupedResults).map(([categoryId, results]) => {
              const category = searchCategories.find(c => c.id === categoryId);
              if (!category || results.length === 0) return null;

              return (
                <div
                  key={categoryId}
                  className="border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                >
                  <div className="sticky top-0 bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      <category.icon className={`h-4 w-4 ${category.color}`} />
                      {category.name}
                    </div>
                  </div>

                  <div className="space-y-0">
                    {results.map(result => {
                      const globalIndex =
                        categoryFilteredResults.indexOf(result);
                      const isSelected = globalIndex === selectedIndex;
                      const isFav = favorites.includes(result.id);

                      return (
                        <div
                          key={result.id}
                          className={cn(
                            'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
                            isSelected
                              ? 'bg-blue-100 dark:bg-blue-900/30'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                          )}
                          onClick={() => handleResultSelect(result)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleResultSelect(result);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <result.icon
                            className={cn(
                              'h-5 w-5 flex-shrink-0',
                              isSelected
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-gray-500 dark:text-gray-400'
                            )}
                          />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'font-medium text-sm',
                                  isSelected
                                    ? 'text-blue-900 dark:text-blue-100'
                                    : 'text-gray-900 dark:text-white'
                                )}
                              >
                                {result.title}
                              </span>

                              {result.badge && (
                                <Badge variant="secondary" className="text-xs">
                                  {result.badge}
                                </Badge>
                              )}

                              {result.shortcut && (
                                <Badge variant="outline" className="text-xs">
                                  {result.shortcut}
                                </Badge>
                              )}
                            </div>

                            {result.description && (
                              <p
                                className={cn(
                                  'text-xs mt-1 truncate',
                                  isSelected
                                    ? 'text-blue-700 dark:text-blue-300'
                                    : 'text-gray-600 dark:text-gray-400'
                                )}
                              >
                                {result.description}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                toggleFavorite(result.id);
                              }}
                              className={cn(
                                'p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors',
                                isFav ? 'text-yellow-500' : 'text-gray-400'
                              )}
                            >
                              <Star
                                className={cn(
                                  'h-4 w-4',
                                  isFav && 'fill-current'
                                )}
                              />
                            </button>

                            <ArrowRight className="h-4 w-4 text-gray-400" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-xs">
                  ↑↓
                </Badge>
                <span>Navegar</span>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-xs">
                  ↵
                </Badge>
                <span>Selecionar</span>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-xs">
                  Esc
                </Badge>
                <span>Fechar</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <Brain className="h-4 w-4" />
              <span>Busca Inteligente</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Hook para usar o sistema de busca
export function useUnifiedSearch() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}
