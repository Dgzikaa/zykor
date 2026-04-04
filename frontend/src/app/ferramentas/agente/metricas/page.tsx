'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart2, 
  TrendingUp, 
  Clock, 
  MessageSquare, 
  ThumbsUp,
  Zap,
  Activity,
  RefreshCw,
  Calendar,
  Bot
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface MetricasResumo {
  totalQueries: number;
  queriesComSucesso: number;
  taxaSucesso: string;
  cacheHits: number;
  taxaCache: string;
  tempoMedio: number;
  ratingMedio: string;
  totalFeedbacks: number;
}

interface AgenteStats {
  queries: number;
  tempo_medio: number;
  rating_medio: number;
}

interface HoraData {
  hora: number;
  queries: number;
}

interface DiaData {
  dia: string;
  queries: number;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function MetricasAgentePage() {
  const [resumo, setResumo] = useState<MetricasResumo | null>(null);
  const [porAgente, setPorAgente] = useState<Record<string, AgenteStats>>({});
  const [topIntents, setTopIntents] = useState<[string, number][]>([]);
  const [porHora, setPorHora] = useState<HoraData[]>([]);
  const [porDia, setPorDia] = useState<DiaData[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('7');

  const carregarMetricas = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/agente/metricas?barId=3&periodo=${periodo}`);
      const data = await response.json();
      
      if (data.success) {
        setResumo(data.resumo);
        setPorAgente(data.porAgente);
        setTopIntents(data.topIntents);
        setPorHora(data.porHora);
        setPorDia(data.porDia);
      }
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => {
    carregarMetricas();
  }, [carregarMetricas]);

  const agenteData = Object.entries(porAgente).map(([nome, stats]) => ({
    nome: nome.replace('Analista ', '').replace('Assistente ', ''),
    queries: stats.queries,
    tempo: stats.tempo_medio,
    rating: stats.rating_medio
  }));

  const intentData = topIntents.map(([intent, count]) => ({
    name: intent,
    value: count
  }));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <BarChart2 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Métricas do Agente
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Dashboard de uso e performance
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white"
            >
              <option value="1">Hoje</option>
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
            </select>
            <Button onClick={carregarMetricas} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <>
            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Total de Queries</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">
                          {resumo?.totalQueries.toLocaleString()}
                        </p>
                        <p className="text-sm text-green-500 mt-1">
                          {resumo?.taxaSucesso}% sucesso
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                        <MessageSquare className="w-6 h-6 text-blue-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Tempo Médio</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">
                          {resumo?.tempoMedio}ms
                        </p>
                        <p className="text-sm text-purple-500 mt-1">
                          {resumo?.taxaCache}% cache hit
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                        <Clock className="w-6 h-6 text-purple-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Rating Médio</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">
                          {resumo?.ratingMedio}/5
                        </p>
                        <p className="text-sm text-amber-500 mt-1">
                          {resumo?.totalFeedbacks} feedbacks
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                        <ThumbsUp className="w-6 h-6 text-amber-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Cache Hits</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">
                          {resumo?.cacheHits}
                        </p>
                        <p className="text-sm text-green-500 mt-1">
                          {resumo?.taxaCache}% eficiência
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                        <Zap className="w-6 h-6 text-green-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Uso por Hora */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                      <Activity className="w-5 h-5 text-blue-500" />
                      Uso por Hora (24h)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={porHora}>
                        <XAxis 
                          dataKey="hora" 
                          tickFormatter={(v) => `${v}h`}
                          stroke="#9CA3AF"
                        />
                        <YAxis stroke="#9CA3AF" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1F2937', 
                            border: 'none',
                            borderRadius: '8px',
                            color: '#F9FAFB'
                          }}
                          formatter={(value: number | undefined) => [`${value} queries`, 'Quantidade']}
                          labelFormatter={(label) => `${label}h`}
                        />
                        <Bar dataKey="queries" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Evolução Diária */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                      <Calendar className="w-5 h-5 text-purple-500" />
                      Evolução Diária
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={porDia}>
                        <XAxis 
                          dataKey="dia" 
                          tickFormatter={(v) => {
                            const d = new Date(v);
                            return `${d.getDate()}/${d.getMonth() + 1}`;
                          }}
                          stroke="#9CA3AF"
                        />
                        <YAxis stroke="#9CA3AF" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1F2937', 
                            border: 'none',
                            borderRadius: '8px',
                            color: '#F9FAFB'
                          }}
                          formatter={(value: number | undefined) => [`${value} queries`, 'Quantidade']}
                          labelFormatter={(label) => {
                            const d = new Date(label);
                            return d.toLocaleDateString('pt-BR');
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="queries" 
                          stroke="#8B5CF6" 
                          strokeWidth={2}
                          dot={{ fill: '#8B5CF6', strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Segunda linha de gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Intents */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
              >
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                      <TrendingUp className="w-5 h-5 text-green-500" />
                      Top Intents (Mais Consultados)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={intentData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                        >
                          {intentData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1F2937', 
                            border: 'none',
                            borderRadius: '8px',
                            color: '#F9FAFB'
                          }}
                          formatter={(value: number | undefined) => [`${value} queries`, 'Quantidade']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Uso por Agente */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
              >
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                      <Bot className="w-5 h-5 text-amber-500" />
                      Uso por Agente
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={agenteData} layout="vertical">
                        <XAxis type="number" stroke="#9CA3AF" />
                        <YAxis 
                          type="category" 
                          dataKey="nome" 
                          width={100}
                          stroke="#9CA3AF"
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1F2937', 
                            border: 'none',
                            borderRadius: '8px',
                            color: '#F9FAFB'
                          }}
                          formatter={(value: number | undefined, name: string | undefined) => {
                            if (name === 'queries') return [`${value} queries`, 'Quantidade'];
                            if (name === 'tempo') return [`${Math.round(value as number)}ms`, 'Tempo médio'];
                            return [value, name];
                          }}
                        />
                        <Bar dataKey="queries" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
