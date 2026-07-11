'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Send, 
  MessageCircle, 
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  RefreshCw,
  Calendar,
  Phone,
  DollarSign,
  Target,
  UserCheck,
  UserX,
  CalendarCheck,
  BarChart3,
  ArrowLeft,
  AlertTriangle,
  MessageSquare,
  User,
  TrendingUp,
  ArrowUpRight
} from 'lucide-react';
import Link from 'next/link';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';

interface MetricasAnalise {
  total_destinatarios: number;
  enviados: number;
  erros: number;
  taxa_envio: number;
  lidos: number;
  taxa_leitura: number;
  fizeram_reserva: number;
  taxa_conversao_reserva: number;
  reservas_seated?: number;
  reservas_no_show?: number;
  reservas_pending?: number;
  reservas_confirmadas?: number;
  reservas_canceladas?: number;
  foram_ao_bar?: number;
  taxa_comparecimento?: number;
  valor_total_gasto?: number;
  ticket_medio?: number;
}

interface DestinatarioComCruzamento {
  telefone: string;
  nome: string | null;
  status_envio: string;
  enviado_em: string | null;
  leu_mensagem: boolean;
  lido_em: string | null;
  fez_reserva: boolean;
  reserva_status: string | null;
  reserva_data: string | null;
  reserva_horario?: string | null;
  reserva_pessoas?: number | null;
  reserva_nome?: string | null;
  compareceu?: boolean;
  foi_ao_bar?: boolean;
  data_visita?: string | null;
  valor_gasto?: number | null;
}

interface TimelineResumo {
  reservas_antes_bulk: number;
  pessoas_antes_bulk: number;
  bulk_enviado_em: string;
  reservas_depois_bulk: number;
  pessoas_depois_bulk: number;
  reservas_sem_data: number;
  impacto_estimado: {
    novas_reservas: number;
    novas_pessoas: number;
    crescimento_percentual: string;
  };
}

interface AnaliseCampanha {
  campanha: {
    id: string;
    nome: string;
    template_mensagem: string;
    status: string;
    created_at: string;
    total_destinatarios: number;
    enviados: number;
    lidos: number;
    erros: number;
  };
  metricas: MetricasAnalise;
  destinatarios: DestinatarioComCruzamento[];
  timeline_resumo?: TimelineResumo;
  resumo?: {
    modo: string;
    data_evento: string | null;
    total_reservas_dia: number;
    reservas_do_bulk: number;
    reservas_fora_bulk: number;
    pessoas_total_bulk: number;
    pessoas_total_fora_bulk: number;
    leram_e_fizeram_reserva: number;
    pessoas_leram_e_fizeram_reserva: number;
    taxa_conversao_leitura: string;
    quem_leu_e_reservou: Array<{
      nome: string;
      telefone: string;
      pessoas: number;
      horario: string;
    }>;
    quem_recebeu_e_reservou?: Array<{
      nome: string;
      telefone?: string;
      pessoas: number;
      horario: string;
      leu?: boolean;
    }>;
  };
}

export default function CampanhaDetalhesPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const campanhaId = params.id as string;
  
  // Data do evento pode vir da URL ou ser definida pelo usuário
  const dataEventoUrl = searchParams.get('data_evento');
  const [dataEvento, setDataEvento] = useState<string>(dataEventoUrl || '');
  const [dados, setDados] = useState<AnaliseCampanha | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('todos');
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();
  const barId = selectedBar?.id;

  useEffect(() => {
    setPageTitle('📣 Campanha');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const fetchDetalhes = useCallback(async (dataAlvo?: string) => {
    if (!campanhaId || !barId) return;

    setLoading(true);
    setError(null);
    try {
      let url = `/api/umbler/bulksend?bar_id=${barId}&session_id=${campanhaId}&cruzamento=true`;
      if (dataAlvo) {
        url += `&data_evento=${dataAlvo}`;
      }
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setDados(data);
      } else {
        setError(data.error || 'Erro ao carregar campanha');
      }
    } catch (err) {
      console.error('Erro ao buscar detalhes:', err);
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, [campanhaId, barId]);

  useEffect(() => {
    fetchDetalhes(dataEvento || undefined);
  }, [fetchDetalhes, dataEvento]);
  
  const handleDataEventoChange = (novaData: string) => {
    setDataEvento(novaData);
    // Atualiza a URL sem recarregar a página
    const url = new URL(window.location.href);
    if (novaData) {
      url.searchParams.set('data_evento', novaData);
    } else {
      url.searchParams.delete('data_evento');
    }
    window.history.replaceState({}, '', url.toString());
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateShort = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit'
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return '-';
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 11) {
      const ddd = digits.slice(-11, -9);
      const parte1 = digits.slice(-9, -4);
      const parte2 = digits.slice(-4);
      return `(${ddd}) ${parte1}-${parte2}`;
    }
    return phone;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Read':
        return <Eye className="h-4 w-4 text-cyan-400" />;
      case 'Sent':
      case 'Received':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'Failed':
        return <XCircle className="h-4 w-4 text-red-400" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-400" />;
    }
  };

  // Filtrar destinatários baseado na aba ativa
  const getFilteredDestinatarios = () => {
    if (!dados?.destinatarios) return [];
    
    switch (activeTab) {
      case 'reservaram':
        return dados.destinatarios.filter(d => d.fez_reserva);
      case 'compareceram':
        return dados.destinatarios.filter(d => d.foi_ao_bar);
      case 'leram':
        return dados.destinatarios.filter(d => d.leu_mensagem);
      case 'nao_leram':
        return dados.destinatarios.filter(d => !d.leu_mensagem);
      default:
        return dados.destinatarios;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-8 w-64" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-[400px] rounded-xl" />
            <Skeleton className="h-[400px] rounded-xl" />
            <Skeleton className="h-[400px] rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !dados) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          <Link href="/crm/campanhas/analise">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </Link>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-12 text-center">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-700 font-medium">{error || 'Campanha não encontrada'}</p>
              <Button onClick={() => fetchDetalhes(dataEvento || undefined)} variant="outline" className="mt-4">
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { campanha, metricas, destinatarios } = dados;
  const filteredDestinatarios = getFilteredDestinatarios();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/crm/campanhas/analise">
              <Button variant="ghost" size="icon" className="rounded-lg hover:bg-gray-200">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <p className="text-gray-500 text-sm mt-1">
                Detalhes da campanha de marketing
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Seletor de Data do Evento */}
            <div className="flex items-center gap-2 bg-white rounded-lg border px-3 py-1.5">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">Data alvo:</span>
              <Input
                type="date"
                value={dataEvento}
                onChange={(e) => handleDataEventoChange(e.target.value)}
                className="border-0 p-0 h-auto w-auto text-sm font-medium focus-visible:ring-0"
              />
            </div>
            <Button onClick={() => fetchDetalhes(dataEvento || undefined)} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>
        
        {/* Card de Impacto da Campanha */}
        {dados.timeline_resumo && (
          <Card className="border-0 shadow-sm bg-gradient-to-r from-purple-50 to-indigo-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                Impacto da Campanha
                {dataEvento && (
                  <Badge className="bg-purple-100 text-purple-700 ml-2">
                    Reservas para {new Date(dataEvento + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {/* Reservas Antes */}
                <div className="bg-white/80 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-500 mb-1">Antes do Bulk</p>
                  <p className="text-2xl font-bold text-gray-700">{dados.timeline_resumo.reservas_antes_bulk}</p>
                  <p className="text-xs text-gray-400">{dados.timeline_resumo.pessoas_antes_bulk} pessoas</p>
                </div>
                
                {/* Seta */}
                <div className="flex items-center justify-center">
                  <ArrowUpRight className="h-8 w-8 text-purple-400" />
                </div>
                
                {/* Reservas Depois */}
                <div className="bg-white/80 rounded-lg p-4 text-center border-2 border-green-200">
                  <p className="text-sm text-gray-500 mb-1">Depois do Bulk</p>
                  <p className="text-2xl font-bold text-green-600">{dados.timeline_resumo.reservas_depois_bulk}</p>
                  <p className="text-xs text-gray-400">{dados.timeline_resumo.pessoas_depois_bulk} pessoas</p>
                </div>
                
                {/* Crescimento */}
                <div className="bg-green-100 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-500 mb-1">Crescimento</p>
                  <p className="text-2xl font-bold text-green-600">
                    +{dados.timeline_resumo.impacto_estimado.crescimento_percentual}
                  </p>
                  <p className="text-xs text-gray-400">novas reservas</p>
                </div>
                
                {/* Do Bulk que Reservaram */}
                <div className="bg-purple-100 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-500 mb-1">Do Bulk</p>
                  <p className="text-2xl font-bold text-purple-600">{metricas.fizeram_reserva}</p>
                  <p className="text-xs text-gray-400">fizeram reserva</p>
                </div>
              </div>
              
              {/* Lista de quem recebeu e reservou */}
              {dados.resumo?.quem_recebeu_e_reservou && dados.resumo.quem_recebeu_e_reservou.length > 0 && (
                <div className="mt-4 pt-4 border-t border-purple-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Quem recebeu a mensagem e fez reserva:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {dados.resumo.quem_recebeu_e_reservou.map((pessoa: { nome: string; pessoas: number; horario: string; leu?: boolean }, idx: number) => (
                      <Badge key={idx} className={`${pessoa.leu ? 'bg-cyan-100 text-cyan-700' : 'bg-white text-gray-700'} border`}>
                        {pessoa.nome} ({pessoa.pessoas} {pessoa.pessoas === 1 ? 'pessoa' : 'pessoas'} às {pessoa.horario?.slice(0, 5)})
                        {pessoa.leu && <Eye className="h-3 w-3 ml-1 inline" />}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Resumo do funil */}
              {dados.resumo && (
                <div className="mt-4 pt-4 border-t border-purple-200">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">Total do dia:</span>
                    <span className="font-medium text-gray-700">{dados.resumo.total_reservas_dia} reservas</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-purple-600">{metricas.fizeram_reserva || 0} do bulk</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-600">{dados.resumo.total_reservas_dia - (metricas.fizeram_reserva || 0)} de fora</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-green-600">{dados.resumo.pessoas_total_bulk + dados.resumo.pessoas_total_fora_bulk} pessoas total</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Layout 3 Colunas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* COLUNA ESQUERDA - Detalhes do Envio */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  Detalhes do envio
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Título */}
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <MessageSquare className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-1">Título</p>
                    <p className="text-sm font-medium text-gray-900">{campanha.nome}</p>
                  </div>
                </div>

                {/* Canal */}
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <MessageCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-1">Canal</p>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <MessageCircle className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-sm font-medium text-gray-900">WhatsApp</span>
                    </div>
                  </div>
                </div>

                {/* Iniciado em */}
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Calendar className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-1">Iniciado em</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(campanha.created_at)}</p>
                  </div>
                </div>

                {/* Iniciado por */}
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <User className="h-4 w-4 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-1">Iniciado por</p>
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-orange-500 flex items-center justify-center">
                        <span className="text-white text-xs font-medium">S</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">Sistema</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Métricas de Envio */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 space-y-3">
                {/* Agendadas */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-gray-400" />
                    <span className="text-sm text-gray-600">Agendadas</span>
                  </div>
                  <Badge variant="outline" className="text-gray-600">0</Badge>
                </div>

                {/* Enviadas */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Send className="h-5 w-5 text-blue-500" />
                    <span className="text-sm text-gray-600">Enviadas</span>
                  </div>
                  <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                    {metricas.enviados}
                  </Badge>
                </div>

                {/* Lidas */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Eye className="h-5 w-5 text-cyan-500" />
                    <span className="text-sm text-gray-600">Lidas</span>
                  </div>
                  <Badge className="bg-cyan-100 text-cyan-700 hover:bg-cyan-100">
                    {metricas.lidos}
                  </Badge>
                </div>

                {/* Erros */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <span className="text-sm text-gray-600">Erro</span>
                  </div>
                  <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                    {metricas.erros}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* COLUNA CENTRAL - Template Enviado */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-green-500" />
                  Template enviado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500 mb-3">Exemplo de visualização</p>
                
                {/* Preview do WhatsApp */}
                <div className="bg-[#e5ddd5] rounded-lg p-4 relative">
                  {/* Mensagem */}
                  <div className="bg-white rounded-lg p-3 shadow-sm max-w-[85%] ml-auto">
                    {/* Cabeçalho */}
                    <p className="text-sm font-semibold text-gray-900 mb-2">Tem presente pra você!</p>
                    
                    {/* Corpo da mensagem */}
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">
                      {campanha.template_mensagem || 'Sem template disponível'}
                    </div>
                    
                    {/* Horário */}
                    <div className="flex items-center justify-end gap-1 mt-2">
                      <span className="text-[10px] text-gray-400">
                        {new Date(campanha.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <Eye className="h-3 w-3 text-blue-500" />
                    </div>
                  </div>

                  {/* Botões de Ação */}
                  <div className="mt-2 space-y-2 max-w-[85%] ml-auto">
                    <button className="w-full bg-white rounded-lg py-2 px-3 text-sm text-blue-500 font-medium flex items-center justify-center gap-2 shadow-sm">
                      <CalendarCheck className="h-4 w-4" />
                      Faça sua reserva
                    </button>
                    <button className="w-full bg-white rounded-lg py-2 px-3 text-sm text-gray-600 font-medium flex items-center justify-center gap-2 shadow-sm">
                      <Phone className="h-4 w-4" />
                      Quero falar com atendente
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* COLUNA DIREITA - Dados do GetIn */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-500" />
                  Conversão - GetIn
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Reservas */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CalendarCheck className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-gray-900">Reservas</span>
                    </div>
                    <Badge className="bg-green-500 text-white">{metricas.fizeram_reserva || 0}</Badge>
                  </div>
                  <div className="text-xs text-gray-600">
                    {(metricas.taxa_conversao_reserva || 0).toFixed(1)}% dos que receberam a mensagem
                  </div>
                  
                  {/* Status das reservas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                    <div className="bg-white/80 rounded p-2 text-center">
                      <UserCheck className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
                      <p className="text-lg font-bold text-gray-900">{metricas.reservas_seated || 0}</p>
                      <p className="text-[10px] text-gray-500">Seated</p>
                    </div>
                    <div className="bg-white/80 rounded p-2 text-center">
                      <Clock className="h-4 w-4 text-yellow-500 mx-auto mb-1" />
                      <p className="text-lg font-bold text-gray-900">{metricas.reservas_confirmadas || metricas.reservas_pending || 0}</p>
                      <p className="text-[10px] text-gray-500">Confirmadas</p>
                    </div>
                    <div className="bg-white/80 rounded p-2 text-center">
                      <UserX className="h-4 w-4 text-red-500 mx-auto mb-1" />
                      <p className="text-lg font-bold text-gray-900">{metricas.reservas_no_show || 0}</p>
                      <p className="text-[10px] text-gray-500">No-Show</p>
                    </div>
                    <div className="bg-white/80 rounded p-2 text-center">
                      <XCircle className="h-4 w-4 text-gray-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-gray-900">{metricas.reservas_canceladas || 0}</p>
                      <p className="text-[10px] text-gray-500">Canceladas</p>
                    </div>
                  </div>
                </div>

                {/* Foram ao Bar */}
                <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-purple-600" />
                      <span className="font-medium text-gray-900">Foram ao Bar</span>
                    </div>
                    <Badge className="bg-purple-500 text-white">{metricas.foram_ao_bar || 0}</Badge>
                  </div>
                  <div className="text-xs text-gray-600">
                    {(metricas.taxa_comparecimento || 0).toFixed(1)}% de comparecimento
                  </div>
                </div>

                {/* Faturamento */}
                <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-yellow-600" />
                      <span className="font-medium text-gray-900">Faturamento</span>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(metricas.valor_total_gasto || 0)}
                  </p>
                  <div className="text-xs text-gray-600 mt-1">
                    Ticket Médio: {formatCurrency(metricas.ticket_medio || 0)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabela de Destinatários */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Users className="h-5 w-5 text-gray-500" />
                Destinatários ({destinatarios.length})
              </CardTitle>
              
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-gray-100">
                  <TabsTrigger value="todos" className="text-xs">
                    Todos ({destinatarios.length})
                  </TabsTrigger>
                  <TabsTrigger value="leram" className="text-xs">
                    Leram ({destinatarios.filter(d => d.leu_mensagem).length})
                  </TabsTrigger>
                  <TabsTrigger value="reservaram" className="text-xs">
                    Reservaram ({metricas.fizeram_reserva || 0})
                  </TabsTrigger>
                  <TabsTrigger value="compareceram" className="text-xs">
                    Compareceram ({metricas.foram_ao_bar || 0})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-gray-500">Telefone</TableHead>
                    <TableHead className="text-gray-500">Nome</TableHead>
                    <TableHead className="text-gray-500 text-center">Status</TableHead>
                    <TableHead className="text-gray-500 text-center">Leu</TableHead>
                    <TableHead className="text-gray-500 text-center">Reservou</TableHead>
                    <TableHead className="text-gray-500 text-center">Status Reserva</TableHead>
                    <TableHead className="text-gray-500 text-center">Foi ao Bar</TableHead>
                    <TableHead className="text-gray-500 text-right">Valor Gasto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDestinatarios.slice(0, 100).map((dest, idx) => (
                    <TableRow key={idx} className="hover:bg-gray-50">
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 text-gray-400" />
                          {formatPhone(dest.telefone)}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {dest.nome || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {getStatusIcon(dest.status_envio)}
                          <span className="text-xs text-gray-500">{dest.status_envio}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {dest.leu_mensagem ? (
                          <Eye className="h-4 w-4 text-cyan-500 mx-auto" />
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {dest.fez_reserva ? (
                          <CalendarCheck className="h-4 w-4 text-green-500 mx-auto" />
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {dest.reserva_status === 'seated' && (
                          <Badge className="bg-emerald-100 text-emerald-700 text-xs">Seated</Badge>
                        )}
                        {dest.reserva_status === 'no-show' && (
                          <Badge className="bg-red-100 text-red-700 text-xs">No-Show</Badge>
                        )}
                        {dest.reserva_status === 'confirmed' && (
                          <Badge className="bg-yellow-100 text-yellow-700 text-xs">Confirmada</Badge>
                        )}
                        {(dest.reserva_status === 'canceled-user' || dest.reserva_status === 'canceled-agent') && (
                          <Badge className="bg-gray-100 text-gray-600 text-xs">Cancelada</Badge>
                        )}
                        {!dest.reserva_status && <span className="text-gray-300">-</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {dest.foi_ao_bar ? (
                          <Target className="h-4 w-4 text-purple-500 mx-auto" />
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {dest.valor_gasto ? (
                          <span className="text-yellow-600 font-medium">
                            {formatCurrency(dest.valor_gasto)}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredDestinatarios.length > 100 && (
                <div className="text-center py-4 text-sm text-gray-500">
                  Mostrando 100 de {filteredDestinatarios.length} destinatários
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
