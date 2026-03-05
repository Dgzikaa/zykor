'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  X, 
  Clock, 
  TrendingUp, 
  FileText, 
  Users, 
  Settings, 
  BarChart3,
  Calendar,
  MapPin,
  Star,
  Filter,
  Command,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  History,
  Zap,
  Tag,
  Folder,
  Database,
  Globe,
  Smartphone,
  Mail,
  Bell,
  ChevronRight,
  Sparkles,
  Target,
  Lightbulb,
  BookOpen,
  Shield,
  CreditCard,
  ShoppingCart,
  Truck,
  Package,
  Gift,
  Heart,
  Eye,
  Download,
  Share2,
  Edit,
  Trash2,
  Plus,
  Check,
  AlertCircle,
  Info,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { Badge } from './badge';
import { Card, CardContent } from './card';
import { cn } from '@/lib/utils';

// =====================================================
// 🔍 SISTEMA DE SEARCH GLOBAL - ZYKOR
// =====================================================

interface SearchResult {
  id: string;
  title: string;
  description: string;
  url: string;
  category: SearchCategory;
  icon: React.ReactNode;
  tags: string[];
  priority: number;
  lastAccessed?: Date;
  isRecent?: boolean;
  isPopular?: boolean;
}

interface SearchCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

interface GlobalSearchProps {
  className?: string;
  placeholder?: string;
  showShortcut?: boolean;
  maxResults?: number;
  onResultSelect?: (result: SearchResult) => void;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
  children?: React.ReactNode;
}

// =====================================================
// 🎯 CATEGORIAS DE BUSCA PRÉ-DEFINIDAS
// =====================================================

const SEARCH_CATEGORIES: SearchCategory[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    icon: <BarChart3 className="w-4 h-4" />,
    color: 'bg-blue-500',
    description: 'Visões gerais e métricas',
  },
  {
    id: 'usuarios',
    name: 'Usuários',
    icon: <Users className="w-4 h-4" />,
    color: 'bg-green-500',
    description: 'Gerenciamento de usuários',
  },
  {
    id: 'eventos',
    name: 'Eventos',
    icon: <Calendar className="w-4 h-4" />,
    color: 'bg-purple-500',
    description: 'Eventos e programações',
  },
  {
    id: 'relatorios',
    name: 'Relatórios',
    icon: <FileText className="w-4 h-4" />,
    color: 'bg-orange-500',
    description: 'Relatórios e análises',
  },
  {
    id: 'configuracoes',
    name: 'Configurações',
    icon: <Settings className="w-4 h-4" />,
    color: 'bg-gray-500',
    description: 'Configurações do sistema',
  },
  {
    id: 'operacoes',
    name: 'Operações',
    icon: <Target className="w-4 h-4" />,
    color: 'bg-red-500',
    description: 'Operações diárias',
  },
  {
    id: 'financeiro',
    name: 'Financeiro',
    icon: <CreditCard className="w-4 h-4" />,
    color: 'bg-emerald-500',
    description: 'Gestão financeira',
  },
  {
    id: 'marketing',
    name: 'Marketing',
    icon: <TrendingUp className="w-4 h-4" />,
    color: 'bg-pink-500',
    description: 'Estratégias de marketing',
  },
];

// =====================================================
// 🔍 COMPONENTE PRINCIPAL DE BUSCA
// =====================================================

export function GlobalSearch({
  className = '',
  placeholder = 'Buscar no sistema...',
  showShortcut = true,
  maxResults = 10,
  onResultSelect,
}: GlobalSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Mock data - em produção viria de uma API
  const mockSearchResults: SearchResult[] = [
    {
      id: '1',
      title: 'Dashboard Principal',
      description: 'Visão geral do sistema com métricas principais',
      url: '/dashboard',
      category: SEARCH_CATEGORIES[0],
      icon: <BarChart3 className="w-4 h-4" />,
      tags: ['dashboard', 'métricas', 'visão geral'],
      priority: 10,
      isPopular: true,
    },
    {
      id: '2',
      title: 'Gerenciar Usuários',
      description: 'Adicionar, editar e remover usuários do sistema',
      url: '/configuracoes/administracao/usuarios',
      category: SEARCH_CATEGORIES[1],
      icon: <Users className="w-4 h-4" />,
      tags: ['usuários', 'admin', 'permissões'],
      priority: 9,
      isRecent: true,
    },
    {
      id: '3',
      title: 'Relatório de Vendas',
      description: 'Análise detalhada de vendas e receitas',
      url: '/relatorios/vendas',
      category: SEARCH_CATEGORIES[3],
      icon: <FileText className="w-4 h-4" />,
      tags: ['vendas', 'relatório', 'análise'],
      priority: 8,
    },
    {
      id: '4',
      title: 'Configurações do Sistema',
      description: 'Personalizar configurações gerais',
      url: '/configuracoes',
      category: SEARCH_CATEGORIES[4],
      icon: <Settings className="w-4 h-4" />,
      tags: ['configurações', 'sistema', 'preferências'],
      priority: 7,
    },
    {
      id: '5',
      title: 'Eventos Ativos',
      description: 'Lista de eventos em andamento',
      url: '/eventos',
      category: SEARCH_CATEGORIES[2],
      icon: <Calendar className="w-4 h-4" />,
      tags: ['eventos', 'agenda', 'programação'],
      priority: 6,
    },
  ];

  // Abrir modal de busca
  const openSearch = useCallback(() => {
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Fechar modal de busca
  const closeSearch = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setResults([]);
    setSelectedIndex(0);
    setActiveCategory(null);
  }, []);

  // Buscar resultados
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    
    // Simular delay de busca
    await new Promise(resolve => setTimeout(resolve, 200));

    const filteredResults = mockSearchResults.filter(result => {
      const searchLower = searchQuery.toLowerCase();
      const matchesTitle = result.title.toLowerCase().includes(searchLower);
      const matchesDescription = result.description.toLowerCase().includes(searchLower);
      const matchesTags = result.tags.some(tag => tag.toLowerCase().includes(searchLower));
      const matchesCategory = result.category.name.toLowerCase().includes(searchLower);

      return matchesTitle || matchesDescription || matchesTags || matchesCategory;
    });

    // Ordenar por prioridade e relevância
    const sortedResults = filteredResults.sort((a, b) => {
      let scoreA = a.priority;
      let scoreB = b.priority;

      // Bônus para resultados recentes e populares
      if (a.isRecent) scoreA += 2;
      if (a.isPopular) scoreA += 1;
      if (b.isRecent) scoreB += 2;
      if (b.isPopular) scoreB += 1;

      return scoreB - scoreA;
    });

    setResults(sortedResults.slice(0, maxResults));
    setIsLoading(false);
  }, [maxResults]);

  // Navegar pelos resultados
  const navigateResults = useCallback((direction: 'up' | 'down') => {
    if (results.length === 0) return;

    setSelectedIndex(prev => {
      if (direction === 'down') {
        return prev < results.length - 1 ? prev + 1 : 0;
      } else {
        return prev > 0 ? prev - 1 : results.length - 1;
      }
    });
  }, [results.length]);

  // Selecionar resultado
  const selectResult = useCallback((result: SearchResult) => {
    if (onResultSelect) {
      onResultSelect(result);
    } else {
      router.push(result.url);
    }
    closeSearch();
  }, [onResultSelect, router, closeSearch]);

  // Filtrar por categoria
  const filterByCategory = useCallback((categoryId: string | null) => {
    setActiveCategory(categoryId);
    if (categoryId) {
      const filtered = mockSearchResults.filter(result => result.category.id === categoryId);
      setResults(filtered.slice(0, maxResults));
    } else {
      performSearch(query);
    }
  }, [query, maxResults, performSearch]);

  // Efeitos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        openSearch();
      }

      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          closeSearch();
          break;
        case 'ArrowDown':
          e.preventDefault();
          navigateResults('down');
          break;
        case 'ArrowUp':
          e.preventDefault();
          navigateResults('up');
          break;
        case 'Enter':
          e.preventDefault();
          if (results.length > 0) {
            selectResult(results[selectedIndex]);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, openSearch, closeSearch, navigateResults, results, selectedIndex, selectResult]);

  // Buscar quando query mudar
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [query, performSearch]);

  return (
    <>
      {/* Botão de busca */}
      <Button
        variant="outline"
        className={cn(
          'relative w-full justify-start text-sm text-muted-foreground',
          className
        )}
        onClick={openSearch}
      >
        <Search className="mr-2 h-4 w-4" />
        <span>{placeholder}</span>
        {showShortcut && (
          <kbd className="pointer-events-none absolute right-2 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        )}
      </Button>

      {/* Modal de busca */}
      <SearchModal
        isOpen={isOpen}
        onClose={closeSearch}
      >
        <div className="w-full max-w-2xl mx-auto">
          {/* Header da busca */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite para buscar..."
              className="pl-10 pr-4 py-3 text-lg border-0 bg-transparent focus:ring-0 focus:outline-none"
              autoComplete="off"
            />
            {query && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Categorias */}
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={activeCategory === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => filterByCategory(null)}
                className="text-xs"
              >
                <Filter className="w-4 h-4 mr-1" />
                Todas
              </Button>
              {SEARCH_CATEGORIES.map((category) => (
                <Button
                  key={category.id}
                  variant={activeCategory === category.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => filterByCategory(category.id)}
                  className="text-xs"
                >
                  <span className={cn('w-2 h-2 rounded-full mr-2', category.color)} />
                  {category.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Resultados */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : results.length > 0 ? (
              results.map((result, index) => (
                <SearchResultItem
                  key={result.id}
                  result={result}
                  isSelected={index === selectedIndex}
                  onClick={() => selectResult(result)}
                />
              ))
            ) : query ? (
              <div className="text-center py-8 text-gray-500">
                <Search className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Nenhum resultado encontrado para &quot;{query}&quot;</p>
                <p className="text-sm">Tente outros termos ou verifique a ortografia</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Sugestões rápidas */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Sugestões Rápidas
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {mockSearchResults.slice(0, 4).map((result) => (
                      <QuickSuggestion
                        key={result.id}
                        result={result}
                        onClick={() => selectResult(result)}
                      />
                    ))}
                  </div>
                </div>

                {/* Histórico recente */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Recentes
                  </h3>
                  <div className="space-y-1">
                    {mockSearchResults.filter(r => r.isRecent).slice(0, 3).map((result) => (
                      <RecentItem
                        key={result.id}
                        result={result}
                        onClick={() => selectResult(result)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer com atalhos */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <ArrowUp className="w-3 h-3" />
                  <ArrowDown className="w-3 h-3" />
                  Navegar
                </span>
                <span className="flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" />
                  Selecionar
                </span>
                <span className="flex items-center gap-1">
                  <Command className="w-3 h-3" />
                  K
                  Abrir
                </span>
              </div>
              <span>{results.length} resultado{results.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </SearchModal>
    </>
  );
}

// =====================================================
// 🎨 COMPONENTES AUXILIARES
// =====================================================

// Item de resultado de busca
function SearchResultItem({
  result,
  isSelected,
  onClick,
}: {
  result: SearchResult;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card
        className={cn(
          'cursor-pointer transition-all duration-200',
          isSelected 
            ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : 'hover:bg-gray-50 dark:hover:bg-gray-800'
        )}
        onClick={onClick}
      >
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center text-white',
              result.category.color
            )}>
              {result.icon}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-gray-900 dark:text-white truncate">
                  {result.title}
                </h4>
                <div className="flex items-center gap-1">
                  {result.isRecent && (
                    <Badge variant="secondary" className="text-xs">
                      <Clock className="w-3 h-3 mr-1" />
                      Recente
                    </Badge>
                  )}
                  {result.isPopular && (
                    <Badge variant="secondary" className="text-xs">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Popular
                    </Badge>
                  )}
                </div>
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                {result.description}
              </p>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {result.category.name}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    {result.url}
                  </span>
                </div>
                
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Sugestão rápida
function QuickSuggestion({
  result,
  onClick,
}: {
  result: SearchResult;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      className="h-auto p-3 justify-start text-left"
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <div className={cn(
          'w-6 h-6 rounded flex items-center justify-center text-white',
          result.category.color
        )}>
          {result.icon}
        </div>
        <div>
          <div className="font-medium text-sm">{result.title}</div>
          <div className="text-xs text-gray-500">{result.category.name}</div>
        </div>
      </div>
    </Button>
  );
}

// Item recente
function RecentItem({
  result,
  onClick,
}: {
  result: SearchResult;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      className="w-full justify-start h-auto p-2 text-left"
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-gray-400" />
        <span className="text-sm">{result.title}</span>
        <Badge variant="outline" className="text-xs ml-auto">
          {result.category.name}
        </Badge>
      </div>
    </Button>
  );
}

// Modal de busca
function SearchModal({ isOpen, onClose, className = '', children }: SearchModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={cn(
            'fixed inset-4 top-20 mx-auto max-w-4xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6',
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {children || (isOpen && (
            <GlobalSearch
              className="hidden"
              onResultSelect={(result) => {
                // Handle result selection
                console.log('Selected:', result);
              }}
            />
          ))}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// =====================================================
// 🚀 HOOKS DE BUSCA
// =====================================================

export function useGlobalSearch() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const openSearch = useCallback(() => setIsSearchOpen(true), []);
  const closeSearch = useCallback(() => setIsSearchOpen(false), []);
  const updateQuery = useCallback((query: string) => setSearchQuery(query), []);

  return {
    isSearchOpen,
    searchQuery,
    searchResults,
    openSearch,
    closeSearch,
    updateQuery,
    setSearchResults,
  };
}

export function useSearchHistory() {
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const addToHistory = useCallback((query: string) => {
    setSearchHistory(prev => {
      const filtered = prev.filter(q => q !== query);
      return [query, ...filtered].slice(0, 10);
    });
  }, []);

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
  }, []);

  return {
    searchHistory,
    addToHistory,
    clearHistory,
  };
}

// =====================================================
// 📱 SEARCH RESPONSIVO
// =====================================================

export function ResponsiveGlobalSearch(props: GlobalSearchProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const mobileProps = {
    maxResults: isMobile ? 5 : props.maxResults || 10,
    showShortcut: !isMobile,
  };

  return (
    <GlobalSearch
      {...props}
      {...mobileProps}
    />
  );
}
