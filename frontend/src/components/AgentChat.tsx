'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User, BarChart3 } from 'lucide-react';
import { GraficoLinha, GraficoBarra, GraficoDonut } from '@/components/graficos/Charts';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  chartData?: any;
  chartType?: 'line' | 'bar' | 'pie' | 'composed' | 'area';
  data?: any;
}

interface ChartData {
  type: 'line' | 'bar' | 'pie' | 'composed' | 'area';
  data: any[];
  title: string;
  description?: string;
}

export default function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeChart, setActiveChart] = useState<ChartData | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setMessages([{
      id: 'welcome',
      type: 'assistant',
      content: `👋 **Olá! Sou Claude, seu assistente AI integrado ao SGB.**\n\nTenho acesso completo aos seus dados e posso:\n\n🔍 **Analisar** vendas, produtos, eventos\n📊 **Criar gráficos** dinâmicos em tempo real\n🎯 **Comparar** performance entre artistas\n💡 **Sugerir** otimizações e insights\n🗣️ **Conversar** naturalmente sobre seu negócio\n\n**Exemplos:**\n• "Analise as vendas de hoje"\n• "Compare Pagode Vira-Lata vs Sambadona"\n• "Crie um gráfico de crescimento"\n• "Como posso aumentar o ticket médio?"`,
      timestamp: new Date()
    }]);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) {
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentInput,
          conversation_history: messages.slice(-10)
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
        data: result.data
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (result.chartData) {
        setActiveChart({
          type: result.chartType || 'line',
          data: result.chartData.data || [],
          title: result.chartData.title || 'Análise de Dados',
          description: result.chartData.description
        });
        setTimeout(() => {
          const chartArea = document.querySelector('.chart-area');
          if (chartArea) {
            chartArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 500);
      }

    } catch (error) {
      console.error('Erro:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Desculpe, ocorreu um erro ao processar sua solicitação.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderChart = (chartData: ChartData) => {
    const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

    switch (chartData.type) {
      case 'line':
        return (
          <GraficoLinha
            data={chartData.data}
            xKey="name"
            series={[{ key: 'value', nome: 'Valor', cor: '#3B82F6' }]}
            height={400}
          />
        );
      case 'bar':
        return (
          <GraficoBarra
            data={chartData.data}
            xKey="name"
            valueKey="value"
            cor="#3B82F6"
            height={400}
            nomeBarra="Valor"
          />
        );
      case 'pie':
        return (
          <GraficoDonut
            data={chartData.data}
            nameKey="name"
            valueKey="value"
            cores={COLORS}
            height={400}
          />
        );
      default:
        return <div>Tipo de gráfico não suportado</div>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Área de Visualização */}
      <Card className="card-dark chart-area">
        <CardHeader>
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <CardTitle className="card-title-dark">Área de Visualização</CardTitle>
              <CardDescription className="card-description-dark">
                Os gráficos gerados pelo Agente aparecerão aqui em tempo real
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activeChart ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {activeChart.title}
                </h3>
                {activeChart.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {activeChart.description}
                  </p>
                )}
              </div>
              {renderChart(activeChart)}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BarChart3 className="w-16 h-16 text-gray-400 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">
                Aguardando análise...
              </h3>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Peça para o Claude criar um gráfico
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chat com Claude */}
      <Card className="card-dark">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Bot className="w-6 h-6 text-green-600 dark:text-green-400" />
            <div>
              <CardTitle className="card-title-dark">Chat com Claude</CardTitle>
              <CardDescription className="card-description-dark">
                Converse naturalmente sobre seus dados
              </CardDescription>
            </div>
            <Badge className="badge-success ml-auto">Online</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Área de mensagens */}
            <ScrollArea className="h-96 w-full border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex gap-3 max-w-[80%] ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className="flex-shrink-0">
                        {message.type === 'user' ? (
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-white" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                            <Bot className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                      <div
                        className={`rounded-lg p-3 ${
                          message.type === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                        }`}
                      >
                        <div className="prose prose-sm max-w-none">
                          {message.content.split('\n').map((line, index) => (
                            <p key={index} className="whitespace-pre-wrap mb-1 last:mb-0">
                              {line}
                            </p>
                          ))}
                        </div>
                        <div className="text-xs opacity-70 mt-2">
                          {message.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input de mensagem */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Digite sua pergunta para Claude..."
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  disabled={isLoading}
                  className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
                <Button 
                  onClick={handleSend}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                  type="button"
                >
                  <Send size={16} />
                </Button>
              </div>
              
              {/* Sugestões rápidas */}
              <div className="flex flex-wrap gap-2">
                <Badge 
                  variant="outline" 
                  className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  onClick={() => setInput("📊 Vendas hoje")}
                >
                  📊 Vendas hoje
                </Badge>
                <Badge 
                  variant="outline" 
                  className="cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/20"
                  onClick={() => setInput("👥 Comparar artistas")}
                >
                  👥 Comparar artistas
                </Badge>
                <Badge 
                  variant="outline" 
                  className="cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  onClick={() => setInput("📈 Gráfico crescimento")}
                >
                  📈 Gráfico crescimento
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
