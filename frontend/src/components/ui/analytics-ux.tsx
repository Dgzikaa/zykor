'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  MousePointer, 
  Eye, 
  Clock, 
  Target,
  Zap,
  Activity,
  Map,
  Filter,
  Download,
  Share2,
  Settings,
  RefreshCw,
  Play,
  Pause,
  Square,
  Maximize2,
  Minimize2,
  X,
  Plus,
  Edit,
  Trash2,
  Info,
  AlertCircle,
  CheckCircle,
  Star,
  Heart,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  ChevronLeft,
  Calendar,
  MapPin,
  Search,
  Filter as FilterIcon,
  PieChart,
  LineChart,
  ScatterChart,
  AreaChart,
  BarChart,
  Activity as ActivityIcon,
  Zap as ZapIcon,
  Target as TargetIcon,
  Users as UsersIcon,
  Eye as EyeIcon,
  Clock as ClockIcon,
  MousePointer as MousePointerIcon,
} from 'lucide-react';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { Input } from './input';
import { cn } from '@/lib/utils';

// =====================================================
// 📈 SISTEMA DE ANALYTICS UX & HEATMAPS - ZYKOR
// =====================================================

interface UserEvent {
  id: string;
  type: 'click' | 'scroll' | 'hover' | 'focus' | 'input' | 'navigation' | 'error' | 'performance';
  element: string;
  path: string;
  timestamp: Date;
  metadata: Record<string, any>;
  sessionId: string;
  userId?: string;
}

interface HeatmapData {
  x: number;
  y: number;
  intensity: number;
  element: string;
  eventType: string;
  count: number;
}

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  target: number;
  status: 'good' | 'warning' | 'poor';
  trend: 'up' | 'down' | 'stable';
}

interface UserInsight {
  id: string;
  type: 'behavior' | 'performance' | 'engagement' | 'error';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  recommendations: string[];
  data: any;
}

interface AnalyticsUXProps {
  className?: string;
  enableTracking?: boolean;
  enableHeatmaps?: boolean;
  enablePerformance?: boolean;
  enableUserInsights?: boolean;
  sessionId?: string;
  userId?: string;
}

// =====================================================
// 🎯 TRACKER DE EVENTOS DE USUÁRIO
// =====================================================

export function UserEventTracker({
  children,
  className = '',
  sessionId,
  userId,
  enableTracking = true,
}: {
  children: React.ReactNode;
  className?: string;
  sessionId?: string;
  userId?: string;
  enableTracking?: boolean;
}) {
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [isTracking, setIsTracking] = useState(enableTracking);
  const [sessionStart] = useState(new Date());

  // Gerar session ID se não fornecido
  const currentSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Track de eventos
  const trackEvent = useCallback((event: Omit<UserEvent, 'id' | 'sessionId' | 'timestamp'>) => {
    if (!isTracking) return;

    const newEvent: UserEvent = {
      ...event,
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: currentSessionId,
      timestamp: new Date(),
    };

    setEvents(prev => [...prev, newEvent]);

    // Enviar para analytics (em produção)
    sendToAnalytics(newEvent);
  }, [isTracking, currentSessionId]);

  // Enviar para analytics
  const sendToAnalytics = useCallback(async (event: UserEvent) => {
    try {
      // Em produção, enviar para serviço de analytics
      if (process.env.NODE_ENV === 'production') {
        await fetch('/api/analytics/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        });
      }
    } catch (error) {
      console.warn('Failed to send analytics event:', error);
    }
  }, []);

  // Event listeners
  useEffect(() => {
    if (!isTracking) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      trackEvent({
        type: 'click',
        element: target.tagName.toLowerCase(),
        path: window.location.pathname,
        metadata: {
          text: target.textContent?.slice(0, 100),
          className: target.className,
          id: target.id,
          position: { x: e.clientX, y: e.clientY },
        },
      });
    };

    const handleScroll = () => {
      trackEvent({
        type: 'scroll',
        element: 'window',
        path: window.location.pathname,
        metadata: {
          scrollY: window.scrollY,
          scrollX: window.scrollX,
          viewportHeight: window.innerHeight,
          documentHeight: document.documentElement.scrollHeight,
        },
      });
    };

    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement;
      trackEvent({
        type: 'input',
        element: target.tagName.toLowerCase(),
        path: window.location.pathname,
        metadata: {
          fieldName: target.name,
          fieldType: target.type,
          valueLength: target.value.length,
        },
      });
    };

    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      trackEvent({
        type: 'focus',
        element: target.tagName.toLowerCase(),
        path: window.location.pathname,
        metadata: {
          fieldName: target.getAttribute('name'),
          fieldType: target.getAttribute('type'),
        },
      });
    };

    // Adicionar event listeners
    document.addEventListener('click', handleClick);
    document.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('input', handleInput);
    document.addEventListener('focus', handleFocus, true);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('scroll', handleScroll);
      document.removeEventListener('input', handleInput);
      document.removeEventListener('focus', handleFocus, true);
    };
  }, [isTracking, trackEvent]);

  // Toggle tracking
  const toggleTracking = useCallback(() => {
    setIsTracking(prev => !prev);
  }, []);

  return (
    <div className={className}>
      {/* Debug panel (apenas em desenvolvimento) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 z-50">
          <Card className="w-80 bg-white dark:bg-gray-800 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Event Tracker
                <Badge variant={isTracking ? 'default' : 'secondary'} className="text-xs">
                  {isTracking ? 'ON' : 'OFF'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={isTracking ? 'destructive' : 'default'}
                  onClick={toggleTracking}
                  className="text-xs"
                >
                  {isTracking ? 'Stop' : 'Start'} Tracking
                </Button>
                <span className="text-xs text-gray-500">
                  {events.length} events
                </span>
              </div>
              <div className="text-xs text-gray-500">
                Session: {currentSessionId.slice(-8)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {children}
    </div>
  );
}

// =====================================================
// 🔥 HEATMAP VISUALIZER
// =====================================================

interface HeatmapProps {
  className?: string;
  data: HeatmapData[];
  width?: number;
  height?: number;
  intensity?: 'clicks' | 'hovers' | 'scrolls' | 'all';
  showLegend?: boolean;
  showStats?: boolean;
}

export function HeatmapVisualizer({
  className = '',
  data,
  width = 800,
  height = 600,
  intensity = 'all',
  showLegend = true,
  showStats = true,
}: HeatmapProps) {
  const [hoveredPoint, setHoveredPoint] = useState<HeatmapData | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [currentIntensity, setIntensity] = useState(intensity);

  // Filtrar dados por intensidade
  const filteredData = data.filter(point => {
    if (currentIntensity === 'all') return true;
    return point.eventType === currentIntensity;
  });

  // Calcular intensidade máxima para normalização
  const maxIntensity = Math.max(...filteredData.map(p => p.intensity));

  // Renderizar pontos do heatmap
  const renderHeatmapPoints = () => {
    return filteredData.map((point, index) => {
      const normalizedIntensity = point.intensity / maxIntensity;
      const opacity = 0.3 + (normalizedIntensity * 0.7);
      const size = 8 + (normalizedIntensity * 12);

      return (
        <motion.circle
          key={index}
          cx={point.x * zoom + pan.x}
          cy={point.y * zoom + pan.y}
          r={size}
          fill={`rgba(255, 0, 0, ${opacity})`}
          stroke="rgba(255, 255, 255, 0.8)"
          strokeWidth="1"
          onMouseEnter={() => setHoveredPoint(point)}
          onMouseLeave={() => setHoveredPoint(null)}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: index * 0.01 }}
        />
      );
    });
  };

  // Estatísticas do heatmap
  const stats = {
    totalEvents: filteredData.length,
    avgIntensity: filteredData.reduce((sum, p) => sum + p.intensity, 0) / filteredData.length,
    hotSpots: filteredData.filter(p => p.intensity > maxIntensity * 0.8).length,
    coverage: (filteredData.length / (width * height / 100)) * 100,
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Controles */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setZoom(prev => Math.min(prev + 0.2, 3))}
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setZoom(prev => Math.max(prev - 0.2, 0.5))}
          >
            <Minimize2 className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Intensidade:</span>
          <select
            value={currentIntensity}
            onChange={(e) => setIntensity(e.target.value as any)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="all">Todas</option>
            <option value="clicks">Cliques</option>
            <option value="hovers">Hovers</option>
            <option value="scrolls">Scrolls</option>
          </select>
        </div>
      </div>

      {/* Heatmap SVG */}
      <div className="relative border rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto"
        >
          {/* Background grid */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Heatmap points */}
          {renderHeatmapPoints()}

          {/* Hover tooltip */}
          {hoveredPoint && (
            <g>
              <rect
                x={hoveredPoint.x * zoom + pan.x - 60}
                y={hoveredPoint.y * zoom + pan.y - 40}
                width="120"
                height="30"
                fill="rgba(0,0,0,0.8)"
                rx="4"
              />
              <text
                x={hoveredPoint.x * zoom + pan.x}
                y={hoveredPoint.y * zoom + pan.y - 20}
                textAnchor="middle"
                fill="white"
                fontSize="12"
              >
                {hoveredPoint.element}
              </text>
              <text
                x={hoveredPoint.x * zoom + pan.x}
                y={hoveredPoint.y * zoom + pan.y - 5}
                textAnchor="middle"
                fill="white"
                fontSize="10"
              >
                {hoveredPoint.intensity} eventos
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Estatísticas */}
      {showStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.totalEvents}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total de Eventos</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.avgIntensity.toFixed(1)}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Intensidade Média</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{stats.hotSpots}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Hot Spots</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.coverage.toFixed(1)}%</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Cobertura</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Legenda */}
      {showLegend && (
        <Card>
          <CardContent className="p-4">
            <h4 className="font-medium mb-2">Legenda</h4>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded-full opacity-30"></div>
                <span className="text-sm">Baixa intensidade</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded-full opacity-70"></div>
                <span className="text-sm">Média intensidade</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded-full opacity-100"></div>
                <span className="text-sm">Alta intensidade</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// =====================================================
// ⚡ PERFORMANCE MONITOR
// =====================================================

interface PerformanceMonitorProps {
  className?: string;
  showMetrics?: boolean;
  showCharts?: boolean;
  autoRefresh?: boolean;
}

export function PerformanceMonitor({
  className = '',
  showMetrics = true,
  showCharts = true,
  autoRefresh = true,
}: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(true);

  // Coletar métricas de performance
  const collectMetrics = useCallback(() => {
    if (typeof window === 'undefined') return;

    const newMetrics: PerformanceMetric[] = [
      {
        name: 'First Contentful Paint',
        value: performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        unit: 'ms',
        target: 1500,
        status: 'good',
        trend: 'stable',
      },
      {
        name: 'Largest Contentful Paint',
        value: performance.getEntriesByType('largest-contentful-paint')[0]?.startTime || 0,
        unit: 'ms',
        target: 2500,
        status: 'good',
        trend: 'stable',
      },
      {
        name: 'Cumulative Layout Shift',
        value: performance.getEntriesByType('layout-shift').reduce((sum, entry: any) => sum + entry.value, 0),
        unit: '',
        target: 0.1,
        status: 'good',
        trend: 'stable',
      },
      {
        name: 'First Input Delay',
        value: (performance.getEntriesByType('first-input')[0] as any)?.processingStart || 0,
        unit: 'ms',
        target: 100,
        status: 'good',
        trend: 'stable',
      },
    ];

    // Calcular status e tendências
    newMetrics.forEach(metric => {
      if (metric.value <= metric.target) {
        metric.status = 'good';
      } else if (metric.value <= metric.target * 1.5) {
        metric.status = 'warning';
      } else {
        metric.status = 'poor';
      }
    });

    setMetrics(newMetrics);
  }, []);

  // Iniciar monitoramento
  useEffect(() => {
    if (!isMonitoring) return;

    collectMetrics();

    if (autoRefresh) {
      const interval = setInterval(collectMetrics, 5000);
      return () => clearInterval(interval);
    }
  }, [isMonitoring, collectMetrics, autoRefresh]);

  // Toggle monitoramento
  const toggleMonitoring = useCallback(() => {
    setIsMonitoring(prev => !prev);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-600 dark:text-green-400';
      case 'warning': return 'text-yellow-600 dark:text-yellow-400';
      case 'poor': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good': return <CheckCircle className="w-4 h-4" />;
      case 'warning': return <AlertCircle className="w-4 h-4" />;
      case 'poor': return <X className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Performance Monitor
        </h3>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={isMonitoring ? 'default' : 'secondary'}
            onClick={toggleMonitoring}
          >
            {isMonitoring ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isMonitoring ? 'Pausar' : 'Iniciar'}
          </Button>
          <Button size="sm" variant="outline" onClick={collectMetrics}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Métricas */}
      {showMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {metric.name}
                  </span>
                  <span className={cn('flex items-center gap-1', getStatusColor(metric.status))}>
                    {getStatusIcon(metric.status)}
                  </span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {metric.value.toFixed(1)}
                  <span className="text-sm text-gray-500 ml-1">{metric.unit}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Meta: {metric.target} {metric.unit}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Gráficos */}
      {showCharts && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tendências de Performance</CardTitle>
            <CardDescription>
              Monitoramento em tempo real das métricas de performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Gráficos de performance serão implementados aqui</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// =====================================================
// 🧠 USER INSIGHTS GENERATOR
// =====================================================

interface UserInsightsProps {
  className?: string;
  events: UserEvent[];
  showRecommendations?: boolean;
  showTrends?: boolean;
}

export function UserInsightsGenerator({
  className = '',
  events,
  showRecommendations = true,
  showTrends = true,
}: UserInsightsProps) {
  const [insights, setInsights] = useState<UserInsight[]>([]);

  // Gerar insights baseados nos eventos
  useEffect(() => {
    if (events.length === 0) return;

    const newInsights: UserInsight[] = [];

    // Análise de comportamento
    const clickEvents = events.filter(e => e.type === 'click');
    const scrollEvents = events.filter(e => e.type === 'scroll');
    const inputEvents = events.filter(e => e.type === 'input');

    // Insight: Elementos mais clicados
    const clickCounts = clickEvents.reduce((acc, event) => {
      acc[event.element] = (acc[event.element] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostClicked = Object.entries(clickCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);

    if (mostClicked.length > 0) {
      newInsights.push({
        id: 'most-clicked',
        type: 'behavior',
        title: 'Elementos Mais Interativos',
        description: `Os usuários clicam mais em: ${mostClicked.map(([element, count]) => `${element} (${count}x)`).join(', ')}`,
        severity: 'low',
        recommendations: [
          'Otimizar esses elementos para melhor experiência',
          'Considerar adicionar funcionalidades relacionadas',
          'Analisar se os cliques são intencionais',
        ],
        data: mostClicked,
      });
    }

    // Insight: Padrões de scroll
    if (scrollEvents.length > 0) {
      const avgScrollDepth = scrollEvents.reduce((sum, event) => sum + (event.metadata.scrollY || 0), 0) / scrollEvents.length;
      const maxScroll = Math.max(...scrollEvents.map(e => e.metadata.scrollY || 0));
      const scrollPercentage = (avgScrollDepth / maxScroll) * 100;

      if (scrollPercentage < 50) {
        newInsights.push({
          id: 'low-engagement',
          type: 'engagement',
          title: 'Engajamento de Scroll Baixo',
          description: `Usuários scrollam apenas ${scrollPercentage.toFixed(1)}% da página em média`,
          severity: 'medium',
          recommendations: [
            'Melhorar o conteúdo no topo da página',
            'Adicionar elementos visuais atrativos',
            'Considerar paginação para conteúdo longo',
          ],
          data: { avgScrollDepth, maxScroll, scrollPercentage },
        });
      }
    }

    // Insight: Erros de input
    if (inputEvents.length > 0) {
      const inputErrors = inputEvents.filter(e => e.metadata.error);
      if (inputErrors.length > 0) {
        newInsights.push({
          id: 'input-errors',
          type: 'error',
          title: 'Erros de Input Detectados',
          description: `${inputErrors.length} erros de input em ${inputEvents.length} tentativas`,
          severity: 'high',
          recommendations: [
            'Revisar validação de formulários',
            'Melhorar mensagens de erro',
            'Adicionar autocomplete e sugestões',
          ],
          data: { errors: inputErrors.length, total: inputEvents.length },
        });
      }
    }

    setInsights(newInsights);
  }, [events]);

  return (
    <div className={cn('space-y-4', className)}>
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Target className="w-5 h-5" />
        Insights do Usuário
      </h3>

      {insights.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <Target className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>Analisando comportamento do usuário...</p>
            <p className="text-sm">Insights serão gerados conforme mais eventos são coletados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {insights.map((insight) => (
            <Card key={insight.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {insight.title}
                      <Badge
                        variant={
                          insight.severity === 'high' ? 'destructive' :
                          insight.severity === 'medium' ? 'secondary' : 'outline'
                        }
                        className="text-xs"
                      >
                        {insight.severity.toUpperCase()}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {insight.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              {showRecommendations && insight.recommendations.length > 0 && (
                <CardContent>
                  <h4 className="font-medium text-sm mb-2">Recomendações:</h4>
                  <ul className="space-y-1">
                    {insight.recommendations.map((rec, index) => (
                      <li key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================
// 🚀 COMPONENTE PRINCIPAL DE ANALYTICS
// =====================================================

export function AnalyticsUX({
  className = '',
  enableTracking = true,
  enableHeatmaps = true,
  enablePerformance = true,
  enableUserInsights = true,
  sessionId,
  userId,
}: AnalyticsUXProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'heatmaps' | 'performance' | 'insights'>('overview');
  const [events, setEvents] = useState<UserEvent[]>([]);

  // Mock data para demonstração
  useEffect(() => {
    const mockEvents: UserEvent[] = [
      {
        id: '1',
        type: 'click',
        element: 'button',
        path: '/dashboard',
        timestamp: new Date(),
        metadata: { x: 100, y: 200, text: 'Salvar' },
        sessionId: 'session_1',
      },
      {
        id: '2',
        type: 'scroll',
        element: 'window',
        path: '/dashboard',
        timestamp: new Date(),
        metadata: { scrollY: 500, scrollX: 0 },
        sessionId: 'session_1',
      },
      // Adicionar mais eventos mock aqui
    ];

    setEvents(mockEvents);
  }, []);

  const tabs = [
    { id: 'overview', label: 'Visão Geral', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'heatmaps', label: 'Heatmaps', icon: <Map className="w-4 h-4" /> },
    { id: 'performance', label: 'Performance', icon: <Zap className="w-4 h-4" /> },
    { id: 'insights', label: 'Insights', icon: <Target className="w-4 h-4" /> },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <Users className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                  <div className="text-2xl font-bold">{events.length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Eventos Coletados</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <MousePointer className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <div className="text-2xl font-bold">{events.filter(e => e.type === 'click').length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Cliques</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Eye className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                  <div className="text-2xl font-bold">{events.filter(e => e.type === 'scroll').length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Scrolls</div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 'heatmaps':
        return enableHeatmaps ? (
          <HeatmapVisualizer
            data={[
              { x: 100, y: 200, intensity: 0.8, element: 'button', eventType: 'clicks', count: 15 },
              { x: 300, y: 150, intensity: 0.6, element: 'link', eventType: 'clicks', count: 8 },
              { x: 500, y: 400, intensity: 0.9, element: 'input', eventType: 'focus', count: 22 },
            ]}
          />
        ) : (
          <div className="text-center text-gray-500 py-8">
            Heatmaps estão desabilitados
          </div>
        );

      case 'performance':
        return enablePerformance ? (
          <PerformanceMonitor />
        ) : (
          <div className="text-center text-gray-500 py-8">
            Monitor de performance está desabilitado
          </div>
        );

      case 'insights':
        return enableUserInsights ? (
          <UserInsightsGenerator events={events} />
        ) : (
          <div className="text-center text-gray-500 py-8">
            Insights do usuário estão desabilitados
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          Analytics UX
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          <Button variant="outline" size="sm">
            <Share2 className="w-4 h-4 mr-2" />
            Compartilhar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors',
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {renderTabContent()}
      </div>
    </div>
  );
}

// =====================================================
// 🚀 HOOKS DE ANALYTICS
// =====================================================

export function useAnalytics() {
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [isTracking, setIsTracking] = useState(false);

  const startTracking = useCallback(() => {
    setIsTracking(true);
  }, []);

  const stopTracking = useCallback(() => {
    setIsTracking(false);
  }, []);

  const addEvent = useCallback((event: Omit<UserEvent, 'id' | 'timestamp'>) => {
    if (!isTracking) return;

    const newEvent: UserEvent = {
      ...event,
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    setEvents(prev => [...prev, newEvent]);
  }, [isTracking]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return {
    events,
    isTracking,
    startTracking,
    stopTracking,
    addEvent,
    clearEvents,
  };
}

export function usePerformanceMetrics() {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);

  const collectMetrics = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Implementar coleta de métricas reais
    const newMetrics: PerformanceMetric[] = [
      {
        name: 'Page Load Time',
        value: performance.now(),
        unit: 'ms',
        target: 3000,
        status: 'good',
        trend: 'stable',
      },
    ];

    setMetrics(newMetrics);
  }, []);

  return {
    metrics,
    collectMetrics,
  };
}
