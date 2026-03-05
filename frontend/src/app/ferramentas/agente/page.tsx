'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBar } from '@/contexts/BarContext';
import { useUser } from '@/contexts/UserContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Send, 
  Sparkles, 
  TrendingUp, 
  Users, 
  DollarSign,
  Calendar,
  Zap,
  Bot,
  User,
  Loader2,
  ChevronRight,
  Clock,
  Target,
  Package,
  ExternalLink,
  BarChart2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  History,
  Mic
} from 'lucide-react';
import VoiceCommand from '@/components/dashboard/VoiceCommand';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  agent?: string;
  metrics?: {
    label: string;
    value: string;
    trend?: 'up' | 'down' | 'neutral';
    percentage?: number; // Para progress bars
  }[];
  suggestions?: string[];
  deepLinks?: { label: string; href: string }[];
  chartData?: { label: string; value: number; color?: string }[];
  insight?: { type: 'success' | 'warning' | 'info'; text: string };
  isTyping?: boolean;
  metricaId?: string; // Para feedback
  feedbackGiven?: 'up' | 'down' | null;
}

// Gerar ID de sessão único
const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Tipo para os prompts dinâmicos
interface DynamicPrompt {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  prompt: string;
  priority: number;
}

// Função para gerar sugestões dinâmicas baseadas no contexto
const getDynamicPrompts = (): DynamicPrompt[] => {
  const hour = new Date().getHours();
  const day = new Date().getDay(); // 0 = domingo, 6 = sábado
  
  // Base prompts
  const prompts: DynamicPrompt[] = [];
  
  // Baseado no horário
  if (hour < 12) {
    // Manhã - foco em resumo e planejamento
    prompts.push({ icon: RefreshCw, label: 'Resumo de ontem', prompt: 'Como foi ontem?', priority: 1 });
    prompts.push({ icon: Target, label: 'Projeção do dia', prompt: 'Qual a projeção para hoje?', priority: 2 });
  } else if (hour < 18) {
    // Tarde - foco em acompanhamento
    prompts.push({ icon: TrendingUp, label: 'Parcial do dia', prompt: 'Como está o faturamento de hoje?', priority: 1 });
    prompts.push({ icon: Users, label: 'Movimento atual', prompt: 'Como está o movimento?', priority: 2 });
  } else {
    // Noite - foco em resultados
    prompts.push({ icon: DollarSign, label: 'Fechamento do dia', prompt: 'Como fechou hoje?', priority: 1 });
    prompts.push({ icon: BarChart2, label: 'Performance noturna', prompt: 'Como está a noite?', priority: 2 });
  }
  
  // Baseado no dia da semana
  if (day === 1) { // Segunda
    prompts.push({ icon: Calendar, label: 'Fim de semana', prompt: 'Como foi o fim de semana?', priority: 0 });
    prompts.push({ icon: Target, label: 'Metas da semana', prompt: 'Quanto precisamos fazer essa semana?', priority: 3 });
  } else if (day === 5) { // Sexta
    prompts.push({ icon: Lightbulb, label: 'Previsão FDS', prompt: 'Qual a projeção pro fim de semana?', priority: 0 });
  } else if (day === 0) { // Domingo
    prompts.push({ icon: CheckCircle, label: 'Semana toda', prompt: 'Como foi a semana toda?', priority: 0 });
  }
  
  // Prompts padrão
  prompts.push({ icon: Package, label: 'CMV atual', prompt: 'Qual o CMV da última semana?', priority: 4 });
  prompts.push({ icon: TrendingUp, label: 'Ticket subindo?', prompt: 'O ticket está subindo ou caindo?', priority: 5 });
  prompts.push({ icon: Users, label: 'Comparar dias', prompt: 'Sexta foi melhor que sábado?', priority: 6 });
  
  // Ordenar por prioridade e pegar os 6 primeiros
  return prompts
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 6);
};

// Componente de mini gráfico de barras
const MiniBarChart = ({ data }: { data: { label: string; value: number; color?: string }[] }) => {
  const maxValue = Math.max(...data.map(d => d.value));
  
  return (
    <div className="flex items-end gap-1 h-16 p-2 bg-gray-900/50 rounded-lg">
      {data.map((item, idx) => (
        <div key={idx} className="flex flex-col items-center flex-1">
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${(item.value / maxValue) * 100}%` }}
            transition={{ duration: 0.5, delay: idx * 0.1 }}
            className={`w-full rounded-t-sm min-h-[4px] ${item.color || 'bg-purple-500'}`}
            style={{ maxHeight: '40px' }}
          />
          <span className="text-[10px] text-gray-500 mt-1 truncate w-full text-center">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
};

// Componente de progress bar circular
const CircularProgress = ({ percentage, label }: { percentage: number; label: string }) => {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  
  const getColor = () => {
    if (percentage >= 100) return 'text-green-500';
    if (percentage >= 80) return 'text-blue-500';
    if (percentage >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };
  
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-16 h-16">
        <svg className="w-full h-full -rotate-90">
          <circle
            cx="32"
            cy="32"
            r={radius}
            className="fill-none stroke-gray-700"
            strokeWidth="4"
          />
          <motion.circle
            cx="32"
            cy="32"
            r={radius}
            className={`fill-none ${getColor()}`}
            strokeWidth="4"
            strokeLinecap="round"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: 'easeOut' }}
            style={{
              strokeDasharray: circumference,
              stroke: 'currentColor'
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm font-bold ${getColor()}`}>
            {Math.round(percentage)}%
          </span>
        </div>
      </div>
      <span className="text-xs text-gray-400 mt-1">{label}</span>
    </div>
  );
};

// Componente de insight card
const InsightCard = ({ type, text }: { type: 'success' | 'warning' | 'info'; text: string }) => {
  const config = {
    success: { icon: CheckCircle, bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400' },
    warning: { icon: AlertTriangle, bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400' },
    info: { icon: Lightbulb, bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' }
  };
  
  const { icon: Icon, bg, border, text: textColor } = config[type];
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-start gap-2 p-3 rounded-lg ${bg} border ${border} mt-3`}
    >
      <Icon className={`w-4 h-4 ${textColor} flex-shrink-0 mt-0.5`} />
      <span className={`text-sm ${textColor}`}>{text}</span>
    </motion.div>
  );
};

export default function AgenteChatPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();
  const { user } = useUser();
  const router = useRouter();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [conversationContext, setConversationContext] = useState<string>(''); // Tema atual da conversa
  const [sessionId] = useState(() => generateSessionId()); // ID único da sessão
  const [showHistory, setShowHistory] = useState(false);
  const [historySessions, setHistorySessions] = useState<{ session_id: string; primeira_mensagem: string; data: string }[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Sugestões dinâmicas
  const dynamicPrompts = useMemo(() => getDynamicPrompts(), []);

  // Carregar histórico de sessões anteriores
  const loadHistorySessions = useCallback(async () => {
    try {
      const response = await fetch(`/api/agente?barId=${selectedBar?.id || 3}`);
      const data = await response.json();
      if (data.success) {
        setHistorySessions(data.sessoes || []);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }
  }, [selectedBar?.id]);

  // Carregar uma sessão específica
  const loadSession = async (sessionIdToLoad: string) => {
    try {
      const response = await fetch(`/api/agente?sessionId=${sessionIdToLoad}`);
      const data = await response.json();
      if (data.success && data.historico) {
        const loadedMessages: Message[] = data.historico.map((h: { id: string; role: 'user' | 'assistant'; content: string; created_at: string; agent_used?: string; metrics?: Message['metrics']; suggestions?: string[]; deep_links?: Message['deepLinks']; chart_data?: Message['chartData'] }) => ({
          id: h.id,
          role: h.role,
          content: h.content,
          timestamp: new Date(h.created_at),
          agent: h.agent_used,
          metrics: h.metrics,
          suggestions: h.suggestions,
          deepLinks: h.deep_links,
          chartData: h.chart_data
        }));
        setMessages(loadedMessages);
        setShowWelcome(false);
        setShowHistory(false);
      }
    } catch (error) {
      console.error('Erro ao carregar sessão:', error);
    }
  };

  // Enviar feedback
  const handleFeedback = async (messageId: string, rating: 'up' | 'down') => {
    // Atualizar UI imediatamente
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, feedbackGiven: rating } : m
    ));

    // Enviar para API (aqui usaríamos o metricaId se tivéssemos)
    try {
      await fetch('/api/agente', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metricaId: messageId, // Idealmente seria o ID da métrica
          rating: rating === 'up' ? 5 : 1
        })
      });
    } catch (error) {
      console.error('Erro ao enviar feedback:', error);
    }
  };

  useEffect(() => {
    setPageTitle('🤖 Agente Zykor');
    return () => setPageTitle('');
  }, [setPageTitle]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Atualizar contexto da conversa baseado nas mensagens
  useEffect(() => {
    if (messages.length > 0) {
      const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && m.agent);
      if (lastAssistant?.agent) {
        setConversationContext(lastAssistant.agent);
      }
    }
  }, [messages]);

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    setShowWelcome(false);
    setInput('');

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Adicionar mensagem de "digitando"
    const typingMessage: Message = {
      id: 'typing',
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isTyping: true
    };
    setMessages(prev => [...prev, typingMessage]);

    try {
      const response = await fetch('/api/agente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          barId: selectedBar?.id || 3,
          userId: user?.id,
          sessionId, // ID da sessão para histórico persistente
          context: {
            barName: selectedBar?.nome || 'Ordinário',
            currentTopic: conversationContext, // Tema atual da conversa
            previousMessages: messages.slice(-8).map(m => ({ // Aumentado para 8 mensagens
              role: m.role,
              content: m.content,
              agent: m.agent
            })),
            timeOfDay: new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'night',
            dayOfWeek: new Date().getDay()
          }
        })
      });

      const result = await response.json();

      // Remover mensagem de digitando
      setMessages(prev => prev.filter(m => m.id !== 'typing'));

      if (result.success) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: result.response,
          timestamp: new Date(),
          agent: result.agent,
          metrics: result.metrics,
          suggestions: result.suggestions,
          deepLinks: result.deepLinks,
          chartData: result.chartData,
          insight: result.insight
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Desculpe, não consegui processar sua solicitação. Tente novamente.',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      setMessages(prev => prev.filter(m => m.id !== 'typing'));
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Erro de conexão. Verifique sua internet e tente novamente.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Navegar para deep link
  const handleDeepLink = (href: string) => {
    router.push(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  return (
    <div className="h-[calc(100vh-4rem)] bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 flex flex-col overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-purple-500/5 to-blue-500/5 rounded-full blur-3xl" />
      </div>

      {/* Chat Container */}
      <div className="relative flex-1 flex flex-col max-w-4xl mx-auto w-full px-4">
        
        {/* Header com botões */}
        <div className="flex items-center justify-between py-3 border-b border-gray-700/50 mb-4">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-400" />
            <span className="text-sm text-gray-300">Sessão ativa</span>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                loadHistorySessions();
                setShowHistory(!showHistory);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/50 border border-gray-700/50 text-gray-400 hover:text-white hover:border-gray-600 transition-all text-sm"
            >
              <History className="w-4 h-4" />
              Histórico
            </motion.button>
            <Link 
              href="/ferramentas/agente/metricas"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 transition-all text-sm"
            >
              <BarChart2 className="w-4 h-4" />
              Métricas
            </Link>
          </div>
        </div>

        {/* Painel de Histórico */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="bg-gray-800/80 border border-gray-700/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-purple-400" />
                    Conversas Anteriores
                  </h3>
                  <button 
                    onClick={() => setShowHistory(false)}
                    className="text-gray-500 hover:text-white text-xs"
                  >
                    Fechar
                  </button>
                </div>
                {historySessions.length === 0 ? (
                  <p className="text-gray-500 text-sm">Nenhuma conversa anterior encontrada.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {historySessions.map((session, idx) => (
                      <motion.button
                        key={session.session_id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        onClick={() => loadSession(session.session_id)}
                        className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 border border-gray-600/30 transition-all text-left group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-300 truncate group-hover:text-white transition-colors">
                            {session.primeira_mensagem}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(session.data).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto py-6 space-y-6 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
          
          {/* Welcome Screen */}
          <AnimatePresence>
            {showWelcome && messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center justify-center h-full py-12"
              >
                {/* Logo/Icon */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                  className="relative mb-8"
                >
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-purple-500/30">
                    <Sparkles className="w-12 h-12 text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-green-500 border-4 border-gray-900 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                </motion.div>

                {/* Greeting */}
                <motion.h1
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-3xl font-bold text-white mb-2"
                >
                  {getGreeting()}, {user?.nome?.split(' ')[0] || 'Gestor'}!
                </motion.h1>
                
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-gray-400 text-lg mb-8 text-center max-w-md"
                >
                  Sou o agente do <span className="text-purple-400 font-semibold">Zykor</span>. 
                  Posso analisar dados do {selectedBar?.nome || 'bar'} e responder suas dúvidas.
                </motion.p>

                {/* Quick Prompts - Dinâmicos */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full max-w-2xl"
                >
                  {dynamicPrompts.map((item, idx) => (
                    <motion.button
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + idx * 0.1 }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSend(item.prompt)}
                      className="group flex items-center gap-3 p-4 rounded-xl bg-gray-800/50 border border-gray-700/50 hover:border-purple-500/50 hover:bg-gray-800 transition-all text-left"
                    >
                      <div className="p-2 rounded-lg bg-gray-700/50 group-hover:bg-purple-500/20 transition-colors">
                        <item.icon className="w-5 h-5 text-gray-400 group-hover:text-purple-400 transition-colors" />
                      </div>
                      <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                        {item.label}
                      </span>
                    </motion.button>
                  ))}
                </motion.div>
                
                {/* Contexto Info */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  className="text-xs text-gray-600 mt-4"
                >
                  💡 Sugestões baseadas no horário e dia atual
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages */}
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                  message.role === 'user' 
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600' 
                    : 'bg-gradient-to-br from-purple-500 to-purple-600'
                }`}>
                  {message.role === 'user' ? (
                    <User className="w-5 h-5 text-white" />
                  ) : (
                    <Bot className="w-5 h-5 text-white" />
                  )}
                </div>

                {/* Content */}
                <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {/* Agent Tag */}
                  {message.agent && (
                    <span className="text-xs text-purple-400 mb-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {message.agent}
                    </span>
                  )}
                  
                  {/* Message Bubble */}
                  <div className={`rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-md'
                      : 'bg-gray-800 text-gray-100 rounded-tl-md border border-gray-700/50'
                  }`}>
                    {message.isTyping ? (
                      <div className="flex items-center gap-2 py-1">
                        <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                        <span className="text-gray-400 text-sm">Analisando dados...</span>
                      </div>
                    ) : (
                      <div 
                        className="whitespace-pre-wrap text-sm leading-relaxed prose prose-invert prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ 
                          __html: message.content
                            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
                            .replace(/\n/g, '<br />')
                        }}
                      />
                    )}
                  </div>

                  {/* Metrics Cards with Progress */}
                  {message.metrics && message.metrics.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {message.metrics.map((metric, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.1 }}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/80 border border-gray-700/50"
                        >
                          {/* Trend Icon */}
                          {metric.trend && (
                            metric.trend === 'up' ? (
                              <ArrowUpRight className="w-4 h-4 text-green-400" />
                            ) : metric.trend === 'down' ? (
                              <ArrowDownRight className="w-4 h-4 text-red-400" />
                            ) : (
                              <Minus className="w-4 h-4 text-gray-400" />
                            )
                          )}
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase tracking-wide">{metric.label}</span>
                            <span className={`text-sm font-bold ${
                              metric.trend === 'up' ? 'text-green-400' :
                              metric.trend === 'down' ? 'text-red-400' : 'text-white'
                            }`}>
                              {metric.value}
                            </span>
                          </div>
                          {/* Mini progress bar se tiver percentage */}
                          {metric.percentage !== undefined && (
                            <div className="w-12 h-1.5 bg-gray-700 rounded-full overflow-hidden ml-2">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(metric.percentage, 100)}%` }}
                                transition={{ duration: 0.5 }}
                                className={`h-full rounded-full ${
                                  metric.percentage >= 100 ? 'bg-green-500' :
                                  metric.percentage >= 80 ? 'bg-blue-500' :
                                  metric.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                              />
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Chart Data */}
                  {message.chartData && message.chartData.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3 w-full max-w-xs"
                    >
                      <MiniBarChart data={message.chartData} />
                    </motion.div>
                  )}

                  {/* Insight Card */}
                  {message.insight && (
                    <InsightCard type={message.insight.type} text={message.insight.text} />
                  )}

                  {/* Deep Links */}
                  {message.deepLinks && message.deepLinks.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {message.deepLinks.map((link, idx) => (
                        <motion.button
                          key={idx}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.1 }}
                          onClick={() => handleDeepLink(link.href)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs hover:bg-blue-500/20 transition-colors group"
                        >
                          <ExternalLink className="w-3 h-3 group-hover:scale-110 transition-transform" />
                          {link.label}
                        </motion.button>
                      ))}
                    </div>
                  )}

                  {/* Suggestions */}
                  {message.suggestions && message.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {message.suggestions.map((suggestion, idx) => (
                        <motion.button
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          onClick={() => handleSend(suggestion)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs hover:bg-purple-500/20 hover:scale-105 transition-all"
                        >
                          <ChevronRight className="w-3 h-3" />
                          {suggestion}
                        </motion.button>
                      ))}
                    </div>
                  )}

                  {/* Timestamp + Feedback */}
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    
                    {/* Feedback buttons - apenas para mensagens do assistente */}
                    {message.role === 'assistant' && !message.isTyping && (
                      <div className="flex items-center gap-1">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleFeedback(message.id, 'up')}
                          className={`p-1.5 rounded-lg transition-all ${
                            message.feedbackGiven === 'up'
                              ? 'bg-green-500/20 text-green-400'
                              : 'hover:bg-gray-700/50 text-gray-500 hover:text-green-400'
                          }`}
                          title="Resposta útil"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleFeedback(message.id, 'down')}
                          className={`p-1.5 rounded-lg transition-all ${
                            message.feedbackGiven === 'down'
                              ? 'bg-red-500/20 text-red-400'
                              : 'hover:bg-gray-700/50 text-gray-500 hover:text-red-400'
                          }`}
                          title="Resposta não útil"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </motion.button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="relative py-4">
          <div className="relative flex items-end gap-3 p-2 rounded-2xl bg-gray-800/80 border border-gray-700/50 backdrop-blur-sm">
            {/* Voice Command Button */}
            <VoiceCommand 
              onCommand={(text) => {
                setInput(text);
                // Enviar automaticamente após comando de voz
                setTimeout(() => handleSend(text), 100);
              }}
              isProcessing={isLoading}
            />
            
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte sobre o Zykor ou use o microfone..."
              rows={1}
              className="flex-1 bg-transparent text-white placeholder-gray-500 resize-none outline-none px-4 py-3 max-h-32 text-sm"
              style={{ minHeight: '48px' }}
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className={`p-3 rounded-xl transition-all ${
                input.trim() && !isLoading
                  ? 'bg-gradient-to-r from-purple-500 to-blue-600 text-white shadow-lg shadow-purple-500/30'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </motion.button>
          </div>
          
          {/* Hint */}
          <p className="text-center text-xs text-gray-600 mt-2">
            <Mic className="w-3 h-3 inline mr-1" />
            Use o microfone ou pressione <kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">Enter</kbd> para enviar
          </p>
        </div>
      </div>
    </div>
  );
}
