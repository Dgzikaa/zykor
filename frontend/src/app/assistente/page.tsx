'use client';

import { useState, useRef, useEffect } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, BarChart3, TrendingUp, Calendar, Users, DollarSign, MessageSquare } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart
} from 'recharts';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  chartData?: any;
  chartType?: 'line' | 'bar' | 'pie' | 'composed';
  metadata?: any;
}

interface ChartData {
  type: 'line' | 'bar' | 'pie' | 'composed';
  data: any[];
  title: string;
  description?: string;
}

const QUICK_ACTIONS = [
  {
    icon: BarChart3,
    title: "Comparar Artistas",
    description: "Compare performance entre diferentes artistas",
    prompt: "Compare as vendas do Pagode Vira-Lata vs Sambadona"
  },
  {
    icon: TrendingUp,
    title: "Gráfico de Crescimento",
    description: "Visualize tendências de vendas e crescimento",
    prompt: "Mostre o gráfico de crescimento das vendas desta semana"
  },
  {
    icon: Calendar,
    title: "Análise por Período",
    description: "Analise performance por datas específicas",
    prompt: "Como foram as vendas nos eventos de agosto?"
  },
  {
    icon: Users,
    title: "Público vs Vendas",
    description: "Correlação entre público e faturamento",
    prompt: "Mostre a relação entre público e vendas por evento"
  },
  {
    icon: DollarSign,
    title: "Ticket Médio Evolution",
    description: "Evolução do ticket médio ao longo do tempo",
    prompt: "Gráfico da evolução do ticket médio por artista"
  }
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function AssistentePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { setPageTitle } = usePageTitle();
  useEffect(() => {
    setPageTitle('🤖 Assistente');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Mensagem de boas-vindas
    setMessages([{
      id: '1',
      type: 'assistant',
      content: `🤖 **Assistente SGB - Analytics & Charts**\n\nOlá! Sou seu analista de dados com capacidade de gerar gráficos avançados.\n\n**Posso criar visualizações de:**\n• Comparações entre artistas/eventos\n• Gráficos de crescimento e tendências\n• Análises de performance por período\n• Correlações entre métricas\n• Dashboards personalizados\n\n**Exemplos de comandos:**\n• "Compare Pagode Vira-Lata vs Sambadona"\n• "Gráfico de vendas do último mês"\n• "Performance do artista X na data Y"\n• "Ticket médio por tipo de evento"`,
      timestamp: new Date()
    }]);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          barId: 3,
          generateChart: true // Flag para indicar que queremos gráficos
        }),
      });

      const result = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: result.message || 'Desculpe, não consegui processar sua solicitação.',
        timestamp: new Date(),
        chartData: result.chartData,
        chartType: result.chartType,
        metadata: result.data
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Desculpe, ocorreu um erro ao processar sua solicitação. Tente novamente.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
  };

  const renderChart = (message: Message) => {
    if (!message.chartData || !message.chartType) return null;

    const { chartData, chartType } = message;

    return (
      <Card className="mt-4 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 size={20} />
            {chartData.title || 'Gráfico de Análise'}
          </CardTitle>
          {chartData.description && (
            <CardDescription className="text-gray-600 dark:text-gray-400">
              {chartData.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            {chartType === 'line' ? (
              <LineChart data={chartData.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} />
                {chartData.additionalLines?.map((line: any, index: number) => (
                  <Line 
                    key={index}
                    type="monotone" 
                    dataKey={line.key} 
                    stroke={COLORS[index % COLORS.length]} 
                    strokeWidth={2}
                    name={line.name}
                  />
                ))}
              </LineChart>
            ) : chartType === 'bar' ? (
              <BarChart data={chartData.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#8884d8" />
                {chartData.additionalBars?.map((bar: any, index: number) => (
                  <Bar 
                    key={index}
                    dataKey={bar.key} 
                    fill={COLORS[index % COLORS.length]}
                    name={bar.name}
                  />
                ))}
              </BarChart>
            ) : chartType === 'pie' ? (
              <PieChart>
                <Pie
                  data={chartData.data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={150}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.data.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            ) : (
              <ComposedChart data={chartData.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="vendas" fill="#8884d8" name="Vendas" />
                <Line type="monotone" dataKey="publico" stroke="#ff7300" name="Público" />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Sidebar com Ações Rápidas */}
          <div className="lg:col-span-1">
            <Card className="card-dark sticky top-6">
              <CardHeader>
                <CardTitle className="card-title-dark flex items-center gap-2">
                  <MessageSquare size={20} />
                  Ações Rápidas
                </CardTitle>
                <CardDescription className="card-description-dark">
                  Clique para usar comandos predefinidos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {QUICK_ACTIONS.map((action, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="w-full justify-start h-auto p-3 btn-outline-dark"
                    onClick={() => handleQuickAction(action.prompt)}
                  >
                    <div className="flex items-start gap-3">
                      <action.icon size={16} className="mt-1 flex-shrink-0" />
                      <div className="text-left">
                        <div className="font-medium text-sm">{action.title}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {action.description}
                        </div>
                      </div>
                    </div>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Chat Principal */}
          <div className="lg:col-span-3">
            <Card className="card-dark h-[calc(100vh-8rem)]">
              <CardHeader>
                <CardTitle className="card-title-dark flex items-center gap-2">
                  <BarChart3 size={24} />
                  Assistente Analytics & Charts
                </CardTitle>
                <CardDescription className="card-description-dark">
                  Análises avançadas com visualizações em tempo real
                </CardDescription>
              </CardHeader>
              
              <CardContent className="h-full flex flex-col">
                {/* Área de Mensagens */}
                <ScrollArea className="flex-1 pr-4">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-4 ${
                            message.type === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                          }`}
                        >
                          <div className="whitespace-pre-wrap">{message.content}</div>
                          
                          {/* Renderizar gráfico se disponível */}
                          {message.type === 'assistant' && renderChart(message)}
                          
                          {/* Metadata/dados adicionais */}
                          {message.metadata && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(message.metadata).slice(0, 4).map(([key, value]: any) => (
                                  <Badge key={key} variant="secondary" className="text-xs">
                                    {key}: {typeof value === 'number' ? value.toFixed(2) : value}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div className="mt-2 text-xs opacity-70">
                            {message.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            <span className="text-gray-600 dark:text-gray-400">Analisando dados...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div ref={messagesEndRef} />
                </ScrollArea>

                {/* Input de Mensagem */}
                <div className="mt-4 flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Digite sua pergunta ou comando para análise..."
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    disabled={isLoading}
                    className="input-dark"
                  />
                  <Button 
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                    className="btn-primary-dark"
                  >
                    <Send size={16} />
                  </Button>
                </div>
                
                {/* Exemplos rápidos */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge 
                    variant="outline" 
                    className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 text-xs"
                    onClick={() => setInput("Compare Pagode Vira-Lata vs Sambadona com gráfico")}
                  >
                    Compare artistas
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 text-xs"
                    onClick={() => setInput("Gráfico de vendas dos últimos eventos")}
                  >
                    Gráfico vendas
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 text-xs"
                    onClick={() => setInput("Análise de crescimento do ticket médio")}
                  >
                    Ticket médio
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
