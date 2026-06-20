'use client';

import { useState, useRef, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    command?: string;
    data?: Record<string, unknown>;
    feedback?: 'positive' | 'negative';
  };
}

interface BarInfo {
  nome: string;
  id?: number;
}

interface SGBAssistantProps {
  isOpen: boolean;
  onToggle: () => void;
  barInfo: BarInfo | null;
}

export default function SGBAssistant({
  isOpen,
  onToggle,
  barInfo,
}: SGBAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: `Olá! Sou o Zykor Assistant 🤖\n\nSou seu assistente inteligente para análise de dados do ${barInfo?.nome || 'bar'}. Posso te ajudar com:\n\n• 📊 Análises de vendas e faturamento\n• 🔍 Detecção de padrões e anomalias\n• 💡 Sugestões de melhorias\n• ❓ Respostas sobre o negócio\n\nO que você gostaria de saber?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    // Inicializar cliente Supabase
    const supabase = await getSupabaseClient();
    if (!supabase) {
      console.error('❌ Erro ao conectar com banco');
      return;
    }

    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userInput = input.trim();
    console.log('🤖 Enviando mensagem:', userInput);

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: userInput,
      timestamp: new Date(),
    };

    // Adicionar mensagem do usuário imediatamente
    setMessages(prev => {
      const newMessages = [...prev, userMessage];
      console.log('📝 Mensagens atualizadas:', newMessages);
      return newMessages;
    });

    // Limpar input
    setInput('');
    setIsLoading(true);

    try {
      // Chamada para nossa API do assistente
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userInput,
          barId: barInfo?.id,
        }),
      });

      const result = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: result.success ? result.message : 'Desculpe, não consegui processar sua pergunta.',
        timestamp: new Date(),
        metadata: result.data ? { data: result.data } : undefined,
      };

      setMessages(prev => [...prev, assistantMessage]);
      console.log('🤖 Resposta enviada:', result.message);
    } catch (error) {
      console.error('❌ Erro no assistant:', error);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content:
          'Desculpe, ocorreu um erro ao processar sua solicitação. Tente novamente.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = async (
    messageId: string,
    feedback: 'positive' | 'negative'
  ) => {
    // Inicializar cliente Supabase
    const supabase = await getSupabaseClient();
    if (!supabase) {
      console.error('❌ Erro ao conectar com banco');
      return;
    }

    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId
          ? { ...msg, metadata: { ...msg.metadata, feedback } }
          : msg
      )
    );

    // TODO: Salvar feedback no banco para aprendizado
    console.log(`Feedback ${feedback} para mensagem ${messageId}`);
  };

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        type: 'assistant',
        content: `Chat limpo! 🧹\n\nSou o Zykor Assistant do ${barInfo?.nome || 'bar'}. Como posso te ajudar agora?`,
        timestamp: new Date(),
      },
    ]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-2 sm:right-4 bottom-4 top-4 w-[calc(100vw-1rem)] sm:w-96 max-w-[24rem] bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-2xl shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-t-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-white">🤖</span>
            </div>
            <div>
              <h3 className="font-bold text-white">Zykor Assistant</h3>
              <p className="text-white/80 text-xs">Assistente Inteligente</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={clearChat}
              className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
              title="Limpar chat"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
            <button
              onClick={onToggle}
              className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map(message => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl p-3 message-enter ${
                message.type === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <div className="whitespace-pre-wrap text-sm break-words">
                {message.content}
              </div>

              {/* Feedback buttons para mensagens do assistant */}
              {message.type === 'assistant' && message.id !== '1' && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleFeedback(message.id, 'positive')}
                      className={`p-1 rounded-md transition-colors ${
                        message.metadata?.feedback === 'positive'
                          ? 'bg-green-100 text-green-600'
                          : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                      }`}
                      title="Resposta útil"
                    >
                      👍
                    </button>
                    <button
                      onClick={() => handleFeedback(message.id, 'negative')}
                      className={`p-1 rounded-md transition-colors ${
                        message.metadata?.feedback === 'negative'
                          ? 'bg-red-100 text-red-600'
                          : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                      }`}
                      title="Resposta não útil"
                    >
                      👎
                    </button>
                  </div>
                  <span className="text-xs text-gray-400">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl p-3">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.1s' }}
                ></div>
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.2s' }}
                ></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Digite sua pergunta..."
            className="assistant-input flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white placeholder-gray-500"
            disabled={isLoading}
            style={{ color: '#1f2937', backgroundColor: '#ffffff' }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>

        {/* Quick Commands */}
        <div className="mt-2 flex flex-wrap gap-1">
          {[
            '💰 Vendas hoje',
            '📊 Análise semana',
            '🔍 Anomalias',
            '💡 Sugestões',
          ].map(cmd => (
            <button
              key={cmd}
              onClick={() => setInput(cmd)}
              className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {cmd}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}

// Todas as análises agora são feitas pela API /api/assistant
