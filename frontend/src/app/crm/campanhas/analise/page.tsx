'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Send, 
  MessageCircle, 
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  TrendingUp,
  RefreshCw,
  Calendar,
  Phone,
  DollarSign,
  Target,
  UserCheck,
  UserX,
  CalendarCheck,
  BarChart3,
  ArrowUpRight,
  ChevronRight,
  Search,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

interface Campanha {
  id: string;
  title: string;
  nome?: string;
  createdAtUTC: string;
  messagesSent: number;
  totalScheduled?: number;
  totalSent?: number;
  totalRead?: number;
  totalFailed?: number;
  analise?: MetricasAnalise | null;
}

interface MetricasAnalise {
  total_destinatarios: number;
  enviados: number;
  erros: number;
  taxa_envio: number;
  lidos: number;
  taxa_leitura: number;
  fizeram_reserva: number;
  taxa_conversao_reserva: number;
  reservas_seated: number;
  reservas_no_show: number;
  reservas_confirmadas: number;
  reservas_canceladas: number;
  foram_ao_bar: number;
  taxa_comparecimento: number;
  valor_total_gasto: number;
  ticket_medio: number;
}

interface DestinatarioComCruzamento {
  telefone: string;
  nome: string | null;
  status_envio: string;
  enviado_em: string | null;
  leu_mensagem: boolean;
  fez_reserva: boolean;
  reserva_status: string | null;
  reserva_data: string | null;
  compareceu: boolean;
  foi_ao_bar: boolean;
  data_visita: string | null;
  valor_gasto: number | null;
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
}

export default function AnaliseCampanhasPage() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampanha, setSelectedCampanha] = useState<AnaliseCampanha | null>(null);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchCampanhas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Buscar campanhas diretamente da API Umbler bulksend com cruzamento
      const response = await fetch('/api/umbler/bulksend?bar_id=3&limit=20&cruzamento=true');
      const data = await response.json();
      
      if (data.success && data.campanhas) {
        setCampanhas(data.campanhas);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      console.error('Erro ao buscar campanhas:', err);
      setError('Erro ao conectar com a API');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDetalhes = async (campanhaId: string) => {
    // Redirecionar para a página dedicada de detalhes da campanha
    window.location.href = `/crm/campanhas/${campanhaId}`;
  };

  useEffect(() => {
    fetchCampanhas();
  }, [fetchCampanhas]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      'concluida': { color: 'bg-green-500/20 text-green-400', label: 'Concluída' },
      'em_execucao': { color: 'bg-blue-500/20 text-blue-400', label: 'Em Execução' },
      'agendada': { color: 'bg-yellow-500/20 text-yellow-400', label: 'Agendada' },
      'rascunho': { color: 'bg-gray-500/20 text-gray-400', label: 'Rascunho' },
      'cancelada': { color: 'bg-red-500/20 text-red-400', label: 'Cancelada' },
    };
    const config = statusConfig[status] || statusConfig['rascunho'];
    return <Badge className={config.color}>{config.label}</Badge>;
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 13) {
      return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    return phone;
  };

  const filteredCampanhas = campanhas.filter(c => 
    c.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/crm/campanhas">
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-purple-400" />
                Análise de Campanhas
              </h1>
              <p className="text-gray-400 mt-1">
                Cruzamento de disparos WhatsApp × Reservas × Comparecimento
              </p>
            </div>
          </div>
          <Button 
            onClick={fetchCampanhas} 
            variant="outline" 
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Buscar campanha..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-800/50 border-gray-700 text-white"
          />
        </div>

        {/* Lista de Campanhas com Análise */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-6">
                  <Skeleton className="h-24 w-full bg-gray-700" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCampanhas.map((campanha) => (
              <Card 
                key={campanha.id} 
                className="bg-gray-800/50 border-gray-700 hover:border-purple-500/50 transition-colors cursor-pointer"
                onClick={() => fetchDetalhes(campanha.id)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">{campanha.title}</h3>
                        <Badge className="bg-green-500/20 text-green-400">Concluída</Badge>
                        <Badge className="bg-blue-500/20 text-blue-400 text-xs">
                          {campanha.totalSent || campanha.totalScheduled || campanha.messagesSent || 0} enviados
                        </Badge>
                        {(campanha.totalRead != null && campanha.totalRead > 0) && (
                          <Badge className="bg-cyan-500/20 text-cyan-400 text-xs">
                            {campanha.totalRead} lidos ({campanha.totalSent ? Math.round((campanha.totalRead / campanha.totalSent) * 100) : 0}%)
                          </Badge>
                        )}
                        {(campanha.totalFailed != null && campanha.totalFailed > 0) && (
                          <Badge className="bg-red-500/20 text-red-400 text-xs">
                            {campanha.totalFailed} erros
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">
                        <Calendar className="inline h-3 w-3 mr-1" />
                        {formatDate(campanha.createdAtUTC)}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-purple-400 hover:text-purple-300">
                      Ver Detalhes <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>

                  {/* Métricas de Envio - apenas enviados e lidos na listagem */}
                  {campanha.analise ? (
                    <div className="grid grid-cols-2 gap-4 max-w-md">
                      {/* Enviados */}
                      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                        <Send className="h-5 w-5 text-blue-400 mx-auto mb-1" />
                        <p className="text-xl font-bold text-white">{campanha.analise.enviados}</p>
                        <p className="text-xs text-gray-400">Enviados</p>
                        <p className="text-xs text-blue-400">{campanha.analise.taxa_envio.toFixed(1)}%</p>
                      </div>

                      {/* Lidos */}
                      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                        <Eye className="h-5 w-5 text-cyan-400 mx-auto mb-1" />
                        <p className="text-xl font-bold text-white">{campanha.analise.lidos}</p>
                        <p className="text-xs text-gray-400">Lidos</p>
                        <p className="text-xs text-cyan-400">{campanha.analise.taxa_leitura.toFixed(1)}%</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-16">
                      <div className="flex items-center gap-2 text-gray-400">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Carregando...
                      </div>
                    </div>
                  )}

                  {/* Instrução para ver detalhes */}
                  {campanha.analise && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <p className="text-xs text-gray-500">
                        Clique em &quot;Ver Detalhes&quot; e defina a data alvo para ver métricas de reserva e conversão
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {filteredCampanhas.length === 0 && !error && (
              <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-12 text-center">
                  <MessageCircle className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Nenhuma campanha em massa encontrada</p>
                  <p className="text-gray-500 text-sm mt-2">
                    Mostrando apenas campanhas com mais de 90 envios
                  </p>
                </CardContent>
              </Card>
            )}
            
            {error && (
              <Card className="bg-red-900/20 border-red-700">
                <CardContent className="p-12 text-center">
                  <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <p className="text-red-400">{error}</p>
                  <Button 
                    onClick={fetchCampanhas} 
                    variant="outline" 
                    className="mt-4 border-red-600 text-red-400"
                  >
                    Tentar novamente
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Dialog de Detalhes */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700">
            {loadingDetalhes ? (
              <div className="p-8 text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-purple-400 mx-auto mb-4" />
                <p className="text-gray-400">Carregando detalhes...</p>
              </div>
            ) : selectedCampanha && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-xl text-white flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-purple-400" />
                    {selectedCampanha.campanha.nome}
                  </DialogTitle>
                  <DialogDescription className="text-gray-400">
                    Análise detalhada da campanha • {formatDate(selectedCampanha.campanha.created_at)}
                  </DialogDescription>
                </DialogHeader>

                {/* Métricas Resumo */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6">
                  <Card className="bg-gray-800/50 border-gray-700">
                    <CardContent className="p-4 text-center">
                      <Send className="h-6 w-6 text-blue-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-white">{selectedCampanha.metricas.enviados}</p>
                      <p className="text-sm text-gray-400">Enviados</p>
                      <p className="text-xs text-blue-400">{selectedCampanha.metricas.taxa_envio.toFixed(1)}% de {selectedCampanha.metricas.total_destinatarios}</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-800/50 border-gray-700">
                    <CardContent className="p-4 text-center">
                      <CalendarCheck className="h-6 w-6 text-green-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-white">{selectedCampanha.metricas.fizeram_reserva}</p>
                      <p className="text-sm text-gray-400">Fizeram Reserva</p>
                      <p className="text-xs text-green-400">{selectedCampanha.metricas.taxa_conversao_reserva.toFixed(1)}% conversão</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-800/50 border-gray-700">
                    <CardContent className="p-4 text-center">
                      <Target className="h-6 w-6 text-purple-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-white">{selectedCampanha.metricas.foram_ao_bar}</p>
                      <p className="text-sm text-gray-400">Foram ao Bar</p>
                      <p className="text-xs text-purple-400">{selectedCampanha.metricas.taxa_comparecimento.toFixed(1)}% comparecimento</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-800/50 border-gray-700">
                    <CardContent className="p-4 text-center">
                      <DollarSign className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-white">{formatCurrency(selectedCampanha.metricas.valor_total_gasto)}</p>
                      <p className="text-sm text-gray-400">Faturamento</p>
                      <p className="text-xs text-yellow-400">TM: {formatCurrency(selectedCampanha.metricas.ticket_medio)}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Status das Reservas */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="bg-emerald-500/10 rounded-lg p-3 text-center">
                    <UserCheck className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
                    <p className="text-lg font-bold text-white">{selectedCampanha.metricas.reservas_seated}</p>
                    <p className="text-xs text-emerald-400">Seated</p>
                  </div>
                  <div className="bg-yellow-500/10 rounded-lg p-3 text-center">
                    <Clock className="h-5 w-5 text-yellow-400 mx-auto mb-1" />
                    <p className="text-lg font-bold text-white">{selectedCampanha.metricas.reservas_confirmadas}</p>
                    <p className="text-xs text-yellow-400">Confirmadas</p>
                  </div>
                  <div className="bg-red-500/10 rounded-lg p-3 text-center">
                    <UserX className="h-5 w-5 text-red-400 mx-auto mb-1" />
                    <p className="text-lg font-bold text-white">{selectedCampanha.metricas.reservas_no_show}</p>
                    <p className="text-xs text-red-400">No-Show</p>
                  </div>
                  <div className="bg-gray-500/10 rounded-lg p-3 text-center">
                    <XCircle className="h-5 w-5 text-gray-400 mx-auto mb-1" />
                    <p className="text-lg font-bold text-white">{selectedCampanha.metricas.reservas_canceladas}</p>
                    <p className="text-xs text-gray-400">Canceladas</p>
                  </div>
                </div>

                {/* Tabela de Destinatários */}
                <Card className="bg-gray-800/50 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white text-sm flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Destinatários ({selectedCampanha.destinatarios.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[400px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-gray-700 hover:bg-transparent">
                            <TableHead className="text-gray-400">Telefone</TableHead>
                            <TableHead className="text-gray-400">Nome</TableHead>
                            <TableHead className="text-gray-400 text-center">Enviado</TableHead>
                            <TableHead className="text-gray-400 text-center">Leu</TableHead>
                            <TableHead className="text-gray-400 text-center">Reservou</TableHead>
                            <TableHead className="text-gray-400 text-center">Status Reserva</TableHead>
                            <TableHead className="text-gray-400 text-center">Foi ao Bar</TableHead>
                            <TableHead className="text-gray-400 text-right">Valor Gasto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedCampanha.destinatarios.map((dest, idx) => (
                            <TableRow key={idx} className="border-gray-700 hover:bg-gray-800/50">
                              <TableCell className="text-white font-mono text-sm">
                                <Phone className="inline h-3 w-3 mr-1 text-gray-500" />
                                {formatPhone(dest.telefone)}
                              </TableCell>
                              <TableCell className="text-gray-300">
                                {dest.nome || '-'}
                              </TableCell>
                              <TableCell className="text-center">
                                {dest.status_envio === 'enviado' ? (
                                  <CheckCircle className="h-4 w-4 text-green-400 mx-auto" />
                                ) : dest.status_envio === 'erro' ? (
                                  <XCircle className="h-4 w-4 text-red-400 mx-auto" />
                                ) : (
                                  <Clock className="h-4 w-4 text-yellow-400 mx-auto" />
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {dest.leu_mensagem ? (
                                  <Eye className="h-4 w-4 text-cyan-400 mx-auto" />
                                ) : (
                                  <span className="text-gray-600">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {dest.fez_reserva ? (
                                  <CalendarCheck className="h-4 w-4 text-green-400 mx-auto" />
                                ) : (
                                  <span className="text-gray-600">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {dest.reserva_status === 'seated' && (
                                  <Badge className="bg-emerald-500/20 text-emerald-400">Seated</Badge>
                                )}
                                {dest.reserva_status === 'no-show' && (
                                  <Badge className="bg-red-500/20 text-red-400">No-Show</Badge>
                                )}
                                {dest.reserva_status === 'confirmed' && (
                                  <Badge className="bg-yellow-500/20 text-yellow-400">Confirmada</Badge>
                                )}
                                {(dest.reserva_status === 'canceled-user' || dest.reserva_status === 'canceled-agent') && (
                                  <Badge className="bg-gray-500/20 text-gray-400">Cancelada</Badge>
                                )}
                                {!dest.reserva_status && <span className="text-gray-600">-</span>}
                              </TableCell>
                              <TableCell className="text-center">
                                {dest.foi_ao_bar ? (
                                  <Target className="h-4 w-4 text-purple-400 mx-auto" />
                                ) : (
                                  <span className="text-gray-600">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {dest.valor_gasto ? (
                                  <span className="text-yellow-400 font-medium">
                                    {formatCurrency(dest.valor_gasto)}
                                  </span>
                                ) : (
                                  <span className="text-gray-600">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
