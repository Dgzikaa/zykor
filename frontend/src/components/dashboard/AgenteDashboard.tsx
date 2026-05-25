'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBar } from '@/contexts/BarContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  RefreshCcw,
  ChevronRight,
  MessageSquare,
  BarChart2,
  DollarSign,
  Users,
  Target,
  Lightbulb,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';

interface Insight {
  id: string;
  tipo: 'positivo' | 'negativo' | 'neutro' | 'alerta';
  titulo: string;
  descricao: string;
  metrica?: string;
  valor?: number;
  variacao?: number;
  link?: string;
  prioridade: number;
}

interface MetricaRapida {
  nome: string;
  valor: string;
  variacao?: number;
  status: 'bom' | 'atencao' | 'ruim' | 'neutro';
  icon: React.ComponentType<{ className?: string }>;
}

export default function AgenteDashboard() {
  const { selectedBar } = useBar();
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [metricas, setMetricas] = useState<MetricaRapida[]>([]);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);

  const fetchInsightsAgente = async () => {
    if (!selectedBar?.id) return;

    setLoading(true);
    try {
      // Buscar insights do agente
      const response = await fetch('/api/agente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Gere insights rápidos sobre o desempenho de hoje e da semana',
          barId: selectedBar.id,
          sessionId: 'dashboard'
        })
      });

      const result = await response.json();

      if (result.success) {
        // Processar resposta em insights
        const data = result.data;
        
        // Criar métricas rápidas
        const novasMetricas: MetricaRapida[] = [];
        
        if (data?.faturamento !== undefined) {
          novasMetricas.push({
            nome: 'Faturamento',
            valor: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.faturamento),
            variacao: data.variacaoFaturamento,
            status: (data.variacaoFaturamento ?? 0) >= 0 ? 'bom' : 'atencao',
            icon: DollarSign
          });
        }

        if (data?.publico !== undefined) {
          novasMetricas.push({
            nome: 'Público',
            valor: data.publico.toString(),
            variacao: data.variacaoPublico,
            status: (data.variacaoPublico ?? 0) >= 0 ? 'bom' : 'neutro',
            icon: Users
          });
        }

        if (data?.atingimento !== undefined) {
          novasMetricas.push({
            nome: 'Meta',
            valor: `${data.atingimento.toFixed(0)}%`,
            status: data.atingimento >= 100 ? 'bom' : data.atingimento >= 80 ? 'atencao' : 'ruim',
            icon: Target
          });
        }

        if (data?.cmv !== undefined) {
          novasMetricas.push({
            nome: 'CMV',
            valor: `${data.cmv.toFixed(1)}%`,
            status: data.cmv <= 34 ? 'bom' : data.cmv <= 38 ? 'atencao' : 'ruim',
            icon: BarChart2
          });
        }

        setMetricas(novasMetricas.length > 0 ? novasMetricas : [
          { nome: 'Faturamento', valor: 'R$ --', status: 'neutro', icon: DollarSign },
          { nome: 'Público', valor: '--', status: 'neutro', icon: Users },
          { nome: 'Meta', valor: '--%', status: 'neutro', icon: Target },
          { nome: 'CMV', valor: '--%', status: 'neutro', icon: BarChart2 }
        ]);

        // Processar insights
        const novosInsights: Insight[] = [];
        
        if (result.metrics) {
          result.metrics.forEach((m: any, idx: number) => {
            novosInsights.push({
              id: `metric-${idx}`,
              tipo: m.trend === 'up' ? 'positivo' : m.trend === 'down' ? 'negativo' : 'neutro',
              titulo: m.label,
              descricao: m.value,
              prioridade: idx
            });
          });
        }

        if (result.insight) {
          novosInsights.push({
            id: 'main-insight',
            tipo: result.insight.type === 'success' ? 'positivo' : 
                  result.insight.type === 'warning' ? 'alerta' : 'neutro',
            titulo: '💡 Insight',
            descricao: result.insight.text,
            prioridade: 0
          });
        }

        setInsights(novosInsights);
        setUltimaAtualizacao(new Date());
      }
    } catch (error) {
      console.error('Erro ao buscar insights:', error);
      toast.error('Erro ao carregar insights');
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch desabilitado: chamava Claude no mount de toda visita ao /home,
  // virou gargalo de LCP (Anthropic call demora ~2-4s) e custava muito.
  // Agora o usuario clica em "Gerar insights" pra disparar manualmente.
  // useEffect(() => { fetchInsightsAgente(); }, [selectedBar?.id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'bom': return 'text-green-600 dark:text-green-400';
      case 'atencao': return 'text-yellow-600 dark:text-yellow-400';
      case 'ruim': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getInsightIcon = (tipo: string) => {
    switch (tipo) {
      case 'positivo': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'negativo': return <TrendingDown className="w-4 h-4 text-red-500" />;
      case 'alerta': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default: return <Lightbulb className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 dark:from-purple-500/20 dark:to-blue-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
                Agente IA
                <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs">
                  Zykor
                </Badge>
              </CardTitle>
              {ultimaAtualizacao && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Atualizado {ultimaAtualizacao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/ferramentas/agente">
              <Button size="sm" variant="ghost" className="text-purple-600 dark:text-purple-400">
                <MessageSquare className="w-4 h-4 mr-1" />
                Chat
              </Button>
            </Link>
            <Button
              size="sm"
              variant="ghost"
              onClick={fetchInsightsAgente}
              disabled={loading}
            >
              <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {/* Métricas Rápidas - Responsivo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
          {metricas.map((metrica, idx) => (
            <motion.div
              key={metrica.nome}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="text-center p-2 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-900"
            >
              <div className="flex justify-center mb-1">
                <metrica.icon className={`w-4 h-4 ${getStatusColor(metrica.status)}`} />
              </div>
              <div className={`text-base sm:text-lg font-bold ${getStatusColor(metrica.status)} truncate`}>
                {loading ? '...' : metrica.valor}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {metrica.nome}
              </div>
              {metrica.variacao !== undefined && (
                <div className={`text-xs ${metrica.variacao >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {metrica.variacao >= 0 ? '+' : ''}{metrica.variacao.toFixed(1)}%
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Insights */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-yellow-500" />
            Insights
          </h4>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <RefreshCcw className="w-5 h-5 animate-spin text-purple-500" />
              <span className="ml-2 text-sm text-gray-500">Analisando...</span>
            </div>
          ) : insights.length === 0 ? (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <p className="text-sm">Tudo em ordem! Nenhum alerta.</p>
            </div>
          ) : (
            <AnimatePresence>
              {insights.slice(0, 3).map((insight, idx) => (
                <motion.div
                  key={insight.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`
                    p-3 rounded-lg border
                    ${insight.tipo === 'positivo' ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' :
                      insight.tipo === 'negativo' ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' :
                      insight.tipo === 'alerta' ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800' :
                      'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'}
                  `}
                >
                  <div className="flex items-start gap-2">
                    {getInsightIcon(insight.tipo)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {insight.titulo}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        {insight.descricao}
                      </p>
                    </div>
                    {insight.link && (
                      <Link href={insight.link}>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </Link>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Link para chat completo */}
        <Link href="/ferramentas/agente">
          <motion.div 
            className="mt-4 p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 dark:from-purple-500/20 dark:to-blue-500/20 border border-purple-200 dark:border-purple-800 cursor-pointer hover:shadow-md transition-shadow"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Pergunte qualquer coisa ao agente
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-purple-500" />
            </div>
          </motion.div>
        </Link>
      </CardContent>
    </Card>
  );
}
