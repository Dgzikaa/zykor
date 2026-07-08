'use client';

import { useState, useEffect } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageCircle,
  Phone,
  User,
  Clock,
  Search,
  RefreshCw,
  Bot,
  UserCheck,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  Calendar,
  TrendingUp,
  MessageSquare,
  Users
} from 'lucide-react';

interface Conversa {
  id: string;
  contato_telefone: string;
  contato_nome: string | null;
  status: string;
  setor: string | null;
  atendente_nome: string | null;
  total_mensagens: number;
  total_mensagens_cliente: number;
  total_mensagens_bot: number;
  total_mensagens_atendente: number;
  tempo_primeira_resposta_segundos: number | null;
  tempo_total_segundos: number | null;
  cliente_contahub_id: number | null;
  iniciada_em: string | null;
  finalizada_em: string | null;
  created_at: string;
}

interface Mensagem {
  id: string;
  direcao: string;
  tipo_remetente: string | null;
  contato_nome: string | null;
  tipo_mensagem: string;
  conteudo: string | null;
  media_url: string | null;
  created_at: string;
}

interface Metricas {
  periodo: number;
  conversas: {
    total: number;
    por_status: Record<string, number>;
    tempo_medio_resposta_segundos: number;
    tempo_medio_atendimento_segundos: number;
    por_dia: Record<string, number>;
    correlacionadas_contahub: number;
    taxa_correlacao: number;
  };
  mensagens: {
    total: number;
    por_direcao: Record<string, number>;
    por_remetente: Record<string, number>;
  };
  campanhas: {
    total: number;
    concluidas: number;
    total_enviados: number;
    total_erros: number;
    taxa_entrega: number;
    taxa_resposta: number;
  };
}

export default function ConversasPage() {
  const { setPageTitle } = usePageTitle();

  useEffect(() => {
    setPageTitle('💬 Conversas');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMetricas, setLoadingMetricas] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>('');
  const [filtroBusca, setFiltroBusca] = useState('');
  const [conversaSelecionada, setConversaSelecionada] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loadingMensagens, setLoadingMensagens] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);

  useEffect(() => {
    fetchConversas();
    fetchMetricas();
  }, [filtroStatus]);

  const fetchConversas = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ bar_id: '3', limit: '50' });
      if (filtroStatus) params.append('status', filtroStatus);
      if (filtroBusca) params.append('telefone', filtroBusca);

      const response = await fetch(`/api/umbler/conversas?${params}`);
      const data = await response.json();
      setConversas(data.conversas || []);
    } catch (error) {
      console.error('Erro ao buscar conversas:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetricas = async () => {
    setLoadingMetricas(true);
    try {
      const response = await fetch('/api/umbler/metricas?bar_id=3&periodo=7');
      const data = await response.json();
      setMetricas(data);
    } catch (error) {
      console.error('Erro ao buscar métricas:', error);
    } finally {
      setLoadingMetricas(false);
    }
  };

  const fetchMensagens = async (conversaId: string) => {
    setLoadingMensagens(true);
    try {
      const response = await fetch(`/api/umbler/conversas/${conversaId}`);
      const data = await response.json();
      setMensagens(data.mensagens || []);
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
    } finally {
      setLoadingMensagens(false);
    }
  };

  const abrirConversa = async (conversa: Conversa) => {
    setConversaSelecionada(conversa);
    setModalAberto(true);
    await fetchMensagens(conversa.id);
  };

  const formatarTempo = (segundos: number | null): string => {
    if (!segundos) return '-';
    if (segundos < 60) return `${segundos}s`;
    if (segundos < 3600) return `${Math.floor(segundos / 60)}m`;
    return `${Math.floor(segundos / 3600)}h ${Math.floor((segundos % 3600) / 60)}m`;
  };

  const formatarData = (data: string | null): string => {
    if (!data) return '-';
    return new Date(data).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { cor: string; icone: React.ReactNode }> = {
      aberta: { cor: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300', icone: <MessageCircle className="w-3 h-3" /> },
      em_atendimento: { cor: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300', icone: <UserCheck className="w-3 h-3" /> },
      finalizada: { cor: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', icone: <CheckCircle className="w-3 h-3" /> }
    };
    const config = statusConfig[status] || statusConfig.aberta;
    return (
      <Badge className={`${config.cor} flex items-center gap-1`}>
        {config.icone}
        {status === 'em_atendimento' ? 'Em Atendimento' : status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getTipoRemetenteBadge = (tipo: string | null) => {
    const config: Record<string, { cor: string; label: string }> = {
      cliente: { cor: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300', label: 'Cliente' },
      bot: { cor: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300', label: 'Bot' },
      atendente: { cor: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300', label: 'Atendente' },
      campanha: { cor: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300', label: 'Campanha' }
    };
    const c = config[tipo || 'cliente'] || config.cliente;
    return <Badge className={c.cor}>{c.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Conversas do Chatbot
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Histórico de atendimentos via WhatsApp (Umbler Talk)
          </p>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {loadingMetricas ? (
            Array(4).fill(0).map((_, i) => (
              <Card key={i} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))
          ) : metricas ? (
            <>
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Conversas (7d)</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{metricas.conversas.total}</p>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Tempo Médio Resposta</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatarTempo(metricas.conversas.tempo_medio_resposta_segundos)}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-purple-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Correlação ContaHub</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {metricas.conversas.taxa_correlacao}%
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-orange-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Mensagens (7d)</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{metricas.mensagens.total}</p>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        {/* Filtros */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por telefone..."
                    value={filtroBusca}
                    onChange={(e) => setFiltroBusca(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchConversas()}
                    className="pl-10 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  />
                </div>
              </div>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-[180px] bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos os status</SelectItem>
                  <SelectItem value="aberta">Aberta</SelectItem>
                  <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
                  <SelectItem value="finalizada">Finalizada</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={fetchConversas} variant="outline" className="border-gray-300 dark:border-gray-600">
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Conversas */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Conversas Recentes</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Clique em uma conversa para ver as mensagens
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {Array(5).fill(0).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-40 mb-2" />
                      <Skeleton className="h-3 w-60" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversas.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Nenhuma conversa encontrada</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                  As conversas do chatbot aparecerão aqui quando o webhook estiver configurado
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {conversas.map((conversa) => (
                  <div
                    key={conversa.id}
                    onClick={() => abrirConversa(conversa)}
                    className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                      <User className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 dark:text-white truncate">
                          {conversa.contato_nome || 'Cliente'}
                        </span>
                        {getStatusBadge(conversa.status)}
                        {conversa.cliente_contahub_id && (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                            ContaHub
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {conversa.contato_telefone}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {conversa.total_mensagens} msgs
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatarData(conversa.created_at)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-500">
                        {conversa.atendente_nome && (
                          <span className="flex items-center gap-1">
                            <UserCheck className="w-3 h-3" />
                            {conversa.atendente_nome}
                          </span>
                        )}
                      </div>
                      {conversa.tempo_total_segundos && (
                        <span className="text-xs text-gray-400">
                          Duração: {formatarTempo(conversa.tempo_total_segundos)}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal de Detalhes da Conversa */}
        <Dialog open={modalAberto} onOpenChange={setModalAberto}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Conversa com {conversaSelecionada?.contato_nome || 'Cliente'}
              </DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400">
                {conversaSelecionada?.contato_telefone} • {formatarData(conversaSelecionada?.created_at || null)}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto max-h-[50vh] p-4 space-y-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              {loadingMensagens ? (
                <div className="space-y-4">
                  {Array(3).fill(0).map((_, i) => (
                    <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                      <Skeleton className="h-16 w-48 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : mensagens.length === 0 ? (
                <div className="text-center py-8">
                  <MessageCircle className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-500 dark:text-gray-500">Nenhuma mensagem encontrada</p>
                </div>
              ) : (
                mensagens.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direcao === 'entrada' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        msg.direcao === 'entrada'
                          ? 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
                          : 'bg-blue-500 text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {getTipoRemetenteBadge(msg.tipo_remetente)}
                        <span className="text-xs opacity-70">
                          {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className={`text-sm ${msg.direcao === 'entrada' ? 'text-gray-900 dark:text-white' : 'text-white'}`}>
                        {msg.conteudo || '[Mídia]'}
                      </p>
                      {msg.media_url && (
                        <a
                          href={msg.media_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs underline mt-1 block"
                        >
                          Ver mídia
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {conversaSelecionada && (
              <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Resumo</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Total msgs:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">{conversaSelecionada.total_mensagens}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Cliente:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">{conversaSelecionada.total_mensagens_cliente}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Bot:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">{conversaSelecionada.total_mensagens_bot}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Atendente:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">{conversaSelecionada.total_mensagens_atendente}</span>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
