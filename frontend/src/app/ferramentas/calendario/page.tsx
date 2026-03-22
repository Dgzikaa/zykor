'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useUser } from '@/contexts/UserContext';
import { useBar } from '@/contexts/BarContext';
import { apiCall } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Calendar, 
  Edit, 
  Save, 
  X, 
  RefreshCcw, 
  TrendingUp, 
  Users, 
  DollarSign,
  Clock,
  ChefHat,
  Wine,
  Target,
  AlertCircle,
  CheckCircle,
  Filter,
  Database,
  Music,
  User,
  Plus
} from 'lucide-react';

interface EventoInfo {
  id?: number;
  nome: string;
  artista: string;
  genero: string;
  observacoes?: string;
}

interface DiaData {
  reservas: number;
  pessoas: number;
  confirmadas: number;
  pessoasConfirmadas: number;
  canceladas: number;
  pessoasCanceladas: number;
  noshow: number;
  pessoasNoshow: number;
  pendentes: number;
  pessoasPendentes: number;
  evento: EventoInfo | null;
}

interface ApiResponse {
  success: boolean;
  data: Record<string, DiaData>;
  totais: {
    reservas: number;
    pessoas: number;
    confirmadas: number;
    pessoasConfirmadas: number;
    canceladas: number;
    pessoasCanceladas: number;
    noshow: number;
    pessoasNoshow: number;
    pendentes: number;
    pessoasPendentes: number;
  };
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  reservasCount: number;
  totalPessoas: number;
  confirmadasCount: number;
  pessoasConfirmadas: number;
  canceladasCount: number;
  pessoasCanceladas: number;
  noshowCount: number;
  pessoasNoshow: number;
  pendentesCount: number;
  pessoasPendentes: number;
  evento: EventoInfo | null;
}

export default function CalendarioPage() {
  const { user } = useUser();
  const { selectedBar } = useBar();
  
  // Estados principais
  const [dados, setDados] = useState<Record<string, DiaData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estados de filtros
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [totais, setTotais] = useState({ 
    reservas: 0, 
    pessoas: 0, 
    confirmadas: 0, 
    pessoasConfirmadas: 0,
    canceladas: 0,
    pessoasCanceladas: 0,
    noshow: 0,
    pessoasNoshow: 0,
    pendentes: 0,
    pessoasPendentes: 0
  });
  
  // Estados do modal
  const [modalOpen, setModalOpen] = useState(false);
  const [eventoSelecionado, setEventoSelecionado] = useState<{
    data: string;
    evento: EventoInfo | null;
  } | null>(null);
  const [eventoCompleto, setEventoCompleto] = useState<EventoInfo | null>(null);
  const [carregandoEvento, setCarregandoEvento] = useState(false);
  const [salvandoEvento, setSalvandoEvento] = useState(false);
  const [excluindoEvento, setExcluindoEvento] = useState(false);
  
  // Estado para sincronização Getin
  const [sincronizandoGetin, setSincronizandoGetin] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Auto refresh a cada 30 segundos se habilitado
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      buscarDados();
    }, 30000); // 30 segundos

    return () => clearInterval(interval);
  }, [autoRefresh, currentMonth, currentYear, user]);

  // Buscar dados da API
  const buscarDados = async (mes?: number, ano?: number) => {
    try {
      setLoading(true);
      setError(null);
      
      const mesParam = mes || (currentMonth + 1);
      const anoParam = ano || currentYear;
      
      console.log(`🔍 Buscando dados para ${mesParam}/${anoParam}`);
      
      const params = new URLSearchParams({
        mes: mesParam.toString(),
        ano: anoParam.toString()
      });

      const response = await apiCall(`/api/ferramentas/calendario?${params}`, {
        headers: {
          'x-selected-bar-id': String(selectedBar?.id || '')
        }
      });
      
      console.log('📊 Dados recebidos:', {
        total: Object.keys(response.data || {}).length,
        totais: response.totais,
        meta: response.meta
      });

      if (response.success && response.data) {
        setDados(response.data);
        setTotais(response.totais || { 
          reservas: 0, 
          pessoas: 0, 
          confirmadas: 0, 
          pessoasConfirmadas: 0, 
          canceladas: 0, 
          pessoasCanceladas: 0 
        });
        console.log(`✅ ${Object.keys(response.data).length} dias carregados para ${mesParam}/${anoParam}`);
      } else {
        setError('Erro ao carregar dados');
      }
    } catch (err) {
      console.error('❌ Erro ao buscar dados:', err);
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados iniciais
  useEffect(() => {
    if (user && selectedBar) {
      buscarDados();
    }
  }, [user, selectedBar?.id, currentMonth, currentYear]);

  // Alterar mês/ano
  const alterarPeriodo = (novoMes: number, novoAno: number) => {
    setCurrentMonth(novoMes);
    setCurrentYear(novoAno);
  };

  // Sincronizar dados do Getin
  const sincronizarGetin = async () => {
    try {
      setSincronizandoGetin(true);
      console.log('🔄 Iniciando sincronização forçada do Getin...');
      
      const response = await apiCall('/api/trigger-getin-sync', {
        method: 'GET',
        headers: {
          'x-selected-bar-id': String(selectedBar?.id || '')
        }
      });

      if (response.success) {
        console.log('✅ Sincronização Getin concluída:', response.stats);
        
        // Mostrar feedback de sucesso
        alert(`✅ Sincronização concluída!\n\n📊 Reservas processadas: ${response.stats?.total_encontrados || 0}\n✅ Reservas salvas: ${response.stats?.total_salvos || 0}\n❌ Erros: ${response.stats?.total_erros || 0}`);
        
        // Recarregar dados da página após sincronização
        await buscarDados();
      } else {
        throw new Error(response.error || 'Erro na sincronização');
      }
    } catch (err) {
      console.error('❌ Erro na sincronização Getin:', err);
      alert('❌ Erro ao sincronizar dados do Getin. Tente novamente.');
    } finally {
      setSincronizandoGetin(false);
    }
  };

  // Abrir modal de edição de evento
  const abrirModalEvento = async (data: string, evento: EventoInfo | null) => {
    setEventoSelecionado({ data, evento });
    setModalOpen(true);
    
    // Se existe um evento, carregar dados completos da base de dados
    if (evento) {
      const eventoCompleto = await carregarDadosEvento(data);
      setEventoCompleto(eventoCompleto);
    } else {
      setEventoCompleto(null);
    }
  };

  // Fechar modal
  const fecharModal = () => {
    setModalOpen(false);
    setEventoSelecionado(null);
    setEventoCompleto(null);
  };

  // Salvar evento
  const salvarEvento = async (dadosEvento: {
    nome_evento: string;
    nome_artista: string;
    genero_musical: string;
    observacoes?: string;
  }) => {
    if (!eventoSelecionado || !user) return;

    console.log('💾 Iniciando salvamento do evento:', {
      eventoSelecionado,
      dadosEvento,
      eventoCompleto
    });

    setSalvandoEvento(true);
    try {
      const eventoId = eventoCompleto?.id;
      let response;
      
      if (eventoId) {
        // Atualizar evento existente usando PUT
        console.log('🔄 Atualizando evento existente ID:', eventoId);
        const updateData = {
          id: eventoId,
          nome: dadosEvento.nome_evento,
          artista: dadosEvento.nome_artista || null,
          genero: dadosEvento.genero_musical,
          observacoes: dadosEvento.observacoes || null
        };
        
        response = await apiCall('/api/ferramentas/calendario/eventos', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-selected-bar-id': String(selectedBar?.id || '')
          },
          body: JSON.stringify(updateData)
        });
        
        if (!response.success) {
          throw new Error(response.error || 'Erro ao atualizar evento');
        }

        console.log('✅ Evento atualizado:', response.data);
      } else {
        // Criar novo evento usando POST
        console.log('➕ Criando novo evento');
        const novoEvento = {
          data_evento: eventoSelecionado.data,
          nome: dadosEvento.nome_evento,
          artista: dadosEvento.nome_artista || null,
          genero: dadosEvento.genero_musical,
          observacoes: dadosEvento.observacoes || null
        };

        response = await apiCall('/api/ferramentas/calendario/eventos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-selected-bar-id': String(selectedBar?.id || '')
          },
          body: JSON.stringify(novoEvento)
        });
        
        if (!response.success) {
          throw new Error(response.error || 'Erro ao criar evento');
        }

        console.log('✅ Evento criado:', response.data);
      }

      // Atualizar dados locais
      setDados(prev => ({
        ...prev,
        [eventoSelecionado.data]: {
          ...prev[eventoSelecionado.data],
          evento: {
            id: eventoId || response.data?.id,
            nome: dadosEvento.nome_evento,
            artista: dadosEvento.nome_artista,
            genero: dadosEvento.genero_musical,
            observacoes: dadosEvento.observacoes
          }
        }
      }));

      alert('✅ Evento salvo com sucesso!');
      fecharModal();
      
      // Recarregar dados para garantir sincronização
      buscarDados();
      
    } catch (error) {
      console.error('Erro ao salvar evento:', error);
      alert('❌ Erro ao salvar evento: ' + (error as Error).message);
    } finally {
      setSalvandoEvento(false);
    }
  };

  // Excluir evento
  const excluirEvento = async () => {
    if (!eventoSelecionado || !eventoCompleto?.id) {
      alert('❌ Não é possível excluir: evento não identificado');
      return;
    }

    const confirmacao = confirm(
      `🗑️ Tem certeza que deseja excluir o evento "${eventoCompleto.nome}"?\n\nEsta ação não pode ser desfeita.`
    );
    
    if (!confirmacao) return;

    setExcluindoEvento(true);
    try {
      console.log('🗑️ Excluindo evento ID:', eventoCompleto.id);
      
      const response = await apiCall(`/api/ferramentas/calendario/eventos?id=${eventoCompleto.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-selected-bar-id': String(selectedBar?.id || '')
        }
      });

      if (!response.success) {
        throw new Error(response.error || 'Erro ao excluir evento');
      }

      // Atualizar dados locais removendo o evento
      setDados(prev => ({
        ...prev,
        [eventoSelecionado.data]: {
          ...prev[eventoSelecionado.data],
          evento: null
        }
      }));

      alert('✅ Evento excluído com sucesso!');
      fecharModal();
      
      // Recarregar dados para garantir sincronização
      buscarDados();
      
    } catch (error) {
      console.error('Erro ao excluir evento:', error);
      alert('❌ Erro ao excluir evento: ' + (error as Error).message);
    } finally {
      setExcluindoEvento(false);
    }
  };

  // Carregar dados completos do evento
  const carregarDadosEvento = async (data: string) => {
    if (!user) return null;

    console.log('🔍 Carregando dados do evento para:', data);
    setCarregandoEvento(true);
    try {
      const response = await apiCall(`/api/ferramentas/calendario/eventos?data=${data}`, {
        headers: {
          'x-selected-bar-id': String(selectedBar?.id || '')
        }
      });
      
      console.log('📋 Dados recebidos da API:', response);
      
      if (response.success && response.data) {
        console.log('✅ Evento encontrado:', response.data);
        const eventoCompleto = {
          id: response.data.id,
          nome: response.data.nome || '',
          artista: response.data.artista || '',
          genero: response.data.genero || '',
          observacoes: response.data.observacoes || ''
        };
        console.log('📋 Evento formatado:', eventoCompleto);
        return eventoCompleto;
      } else {
        console.log('❌ Nenhum evento encontrado para a data:', data);
      }
      return null;
    } catch (error) {
      console.error('Erro ao carregar dados do evento:', error);
      return null;
    } finally {
      setCarregandoEvento(false);
    }
  };

  // Gerar dias do calendário
  const generateCalendarDays = (): CalendarDay[] => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: CalendarDay[] = [];

    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const dateString = date.toISOString().split('T')[0];
      const dayData = dados[dateString];
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isPast = date < today;
      
      days.push({
        date,
        isCurrentMonth: date.getMonth() === currentMonth,
        isToday: date.toDateString() === new Date().toDateString(),
        isPast,
        reservasCount: dayData?.reservas || 0,
        totalPessoas: dayData?.pessoas || 0,
        confirmadasCount: dayData?.confirmadas || 0,
        pessoasConfirmadas: dayData?.pessoasConfirmadas || 0,
        canceladasCount: dayData?.canceladas || 0,
        pessoasCanceladas: dayData?.pessoasCanceladas || 0,
        noshowCount: dayData?.noshow || 0,
        pessoasNoshow: dayData?.pessoasNoshow || 0,
        pendentesCount: dayData?.pendentes || 0,
        pessoasPendentes: dayData?.pessoasPendentes || 0,
        evento: dayData?.evento || null
      });
    }

    return days;
  };

  // Formatação de valores
  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  // Meses para o seletor
  const meses = [
    { value: 0, label: 'Janeiro' },
    { value: 1, label: 'Fevereiro' },
    { value: 2, label: 'Março' },
    { value: 3, label: 'Abril' },
    { value: 4, label: 'Maio' },
    { value: 5, label: 'Junho' },
    { value: 6, label: 'Julho' },
    { value: 7, label: 'Agosto' },
    { value: 8, label: 'Setembro' },
    { value: 9, label: 'Outubro' },
    { value: 10, label: 'Novembro' },
    { value: 11, label: 'Dezembro' }
  ];

  // Anos disponíveis
  const anos = [2024, 2025, 2026];

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const weekDays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCcw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600 dark:text-gray-400">Carregando calendário...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="card-dark p-6 max-w-md">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-4 text-red-600" />
            <h3 className="card-title-dark mb-2">Erro ao carregar dados</h3>
            <p className="card-description-dark mb-4">{error}</p>
            <Button onClick={() => buscarDados()} className="btn-primary-dark">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-3 py-2 max-w-7xl">
        {/* Header com filtros */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3 mb-2 shadow-sm flex-shrink-0">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
                <Calendar className="h-6 w-6 text-blue-600" />
                Calendário de Eventos
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Visualize eventos, artistas e reservas em formato de calendário
              </p>
            </div>
            
            {/* Filtros de período */}
            <div className="flex items-center gap-3">
              <Filter className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              <Select value={currentMonth.toString()} onValueChange={(value) => alterarPeriodo(parseInt(value), currentYear)}>
                <SelectTrigger className="w-32 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  {meses.map((mes) => (
                    <SelectItem key={mes.value} value={mes.value.toString()} className="text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-gray-700">
                      {mes.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={currentYear.toString()} onValueChange={(value) => alterarPeriodo(currentMonth, parseInt(value))}>
                <SelectTrigger className="w-24 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  {anos.map((ano) => (
                    <SelectItem key={ano} value={ano.toString()} className="text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-gray-700">
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button 
                onClick={sincronizarGetin} 
                variant="outline" 
                size="sm"
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
                disabled={sincronizandoGetin}
                title="Sincronizar dados do Getin (reservas)"
              >
                {sincronizandoGetin ? (
                  <RefreshCcw className="h-4 w-4 animate-spin" />
                ) : (
                  <Database className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Calendário */}
        <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
          {/* Header do Calendário */}
          <CardHeader className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-3 py-2 flex-shrink-0">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
              <CardTitle className="text-3xl font-normal text-gray-900 dark:text-white">
                {monthNames[currentMonth]} {currentYear}
              </CardTitle>
              
              {/* Estatísticas Minimalistas */}
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-600 dark:text-gray-400">{totais.confirmadas} confirmadas</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-400 rounded-full"></div>
                  <span className="text-gray-600 dark:text-gray-400">{totais.pendentes} pendentes</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  <span className="text-gray-600 dark:text-gray-400">{totais.canceladas} canceladas</span>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* Cabeçalho dos dias da semana */}
            <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
              {weekDays.map((day) => (
                <div key={day} className="py-1.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>

            {/* Grid dos dias */}
            <div className="grid grid-cols-7" style={{ gridTemplateRows: 'repeat(6, minmax(115px, auto))' }}>
              {generateCalendarDays().map((day, index) => {
                if (!day.isCurrentMonth) {
                  return (
                    <div key={index} className="border-r border-b last:border-r-0 bg-gray-50/30 dark:bg-gray-800/30 opacity-40" />
                  );
                }

                const hasReservas = day.reservasCount > 0;
                const hasEvento = day.evento;
                const confirmadas = day.confirmadasCount;
                const canceladas = day.canceladasCount;
                const noshow = day.noshowCount;
                const pendentes = day.pendentesCount;

                return (
                  <div
                    key={index}
                    className={`border-r border-b border-gray-100 dark:border-gray-800 last:border-r-0 p-2 relative transition-all hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer flex flex-col justify-start ${
                      day.isToday 
                        ? 'bg-blue-50 dark:bg-blue-900/10' 
                        : 'bg-white dark:bg-gray-900'
                    }`}
                    onClick={() => !hasEvento && abrirModalEvento(day.date.toISOString().split('T')[0], null)}
                  >
                    {/* Número do dia - canto superior esquerdo */}
                    <div className="flex justify-start mb-2">
                      <span className={`text-sm font-medium ${
                        day.isToday 
                          ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold' 
                          : 'text-gray-900 dark:text-gray-100'
                      }`}>
                        {day.date.getDate()}
                      </span>
                    </div>

                    {/* Eventos estilo Google Calendar */}
                    <div className="space-y-0.5 flex-shrink-0">
                      {hasEvento ? (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirModalEvento(day.date.toISOString().split('T')[0], day.evento);
                          }}
                          className="group cursor-pointer"
                        >
                          {/* Event pill estilo Google Calendar */}
                          <div className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-0.5 rounded text-xs font-medium truncate transition-colors shadow-sm">
                            {day.evento?.nome}
                          </div>
                          {day.evento?.artista && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 truncate mt-0.5 px-1 leading-tight">
                              {day.evento?.artista}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirModalEvento(day.date.toISOString().split('T')[0], null);
                          }}
                          className="w-full h-5 border border-dashed border-gray-300 dark:border-gray-600 rounded text-gray-400 hover:border-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all text-xs opacity-0 group-hover:opacity-100"
                        >
                          <Plus className="w-3 h-3 mx-auto" />
                        </button>
                      )}
                    </div>

                    {/* Indicador de reservas - canto inferior direito */}
                    {hasReservas && (
                      <div className="absolute bottom-1 right-1 text-xs font-normal leading-tight">
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-green-600 dark:text-green-400 text-xs">
                            {day.reservasCount - canceladas} ({day.totalPessoas - day.pessoasCanceladas} pax)
                          </span>
                          {canceladas > 0 && (
                            <span className="text-red-500 dark:text-red-400 text-xs">
                              -{canceladas} ({day.pessoasCanceladas} pax)
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>


          </CardContent>
        </Card>



        {/* Modal de Edição de Evento */}
        {modalOpen && eventoSelecionado && (
          <ModalEdicaoEvento
            isOpen={modalOpen}
            onClose={fecharModal}
            onSave={salvarEvento}
            onDelete={excluirEvento}
            evento={eventoSelecionado.evento}
            eventoCompleto={eventoCompleto}
            data={eventoSelecionado.data}
            loading={salvandoEvento}
            deleting={excluindoEvento}
            carregandoEvento={carregandoEvento}
          />
        )}
      </div>
    </div>
  );
}

// Componente Modal de Edição de Evento
interface ModalEdicaoEventoProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dados: {
    nome_evento: string;
    nome_artista: string;
    genero_musical: string;
    observacoes?: string;
  }) => void;
  onDelete: () => void;
  evento: EventoInfo | null;
  eventoCompleto: EventoInfo | null;
  data: string;
  loading: boolean;
  deleting: boolean;
  carregandoEvento: boolean;
}

function ModalEdicaoEvento({ 
  isOpen, 
  onClose, 
  onSave, 
  onDelete, 
  evento, 
  eventoCompleto, 
  data, 
  loading, 
  deleting, 
  carregandoEvento 
}: ModalEdicaoEventoProps) {
  const dadosEvento = eventoCompleto || evento;
  
  const [formData, setFormData] = useState({
    nome_evento: '',
    nome_artista: '',
    genero_musical: '',
    observacoes: ''
  });

  useEffect(() => {
    if (dadosEvento) {
      setFormData({
        nome_evento: dadosEvento.nome || '',
        nome_artista: dadosEvento.artista || '',
        genero_musical: dadosEvento.genero || '',
        observacoes: dadosEvento.observacoes || ''
      });
    } else {
      setFormData({
        nome_evento: '',
        nome_artista: '',
        genero_musical: '',
        observacoes: ''
      });
    }
  }, [dadosEvento]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome_evento.trim()) {
      alert('Nome do evento é obrigatório');
      return;
    }
    onSave(formData);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            {evento ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            {evento ? 'Editar Evento' : 'Novo Evento'}
          </DialogTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
            {formatDate(data)}
          </p>
          {carregandoEvento && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <RefreshCcw className="w-4 h-4 animate-spin" />
              Carregando dados do evento...
            </div>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nome do Evento *
            </label>
            <Input
              value={formData.nome_evento}
              onChange={(e) => setFormData({ ...formData, nome_evento: e.target.value })}
              placeholder="Ex: Quarta de Bamba"
              required
              disabled={carregandoEvento}
              className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Artista/Banda
            </label>
            <Input
              value={formData.nome_artista}
              onChange={(e) => setFormData({ ...formData, nome_artista: e.target.value })}
              placeholder="Ex: Breno Alves"
              disabled={carregandoEvento}
              className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Gênero Musical
            </label>
            <Select 
              value={formData.genero_musical} 
              onValueChange={(value) => setFormData({ ...formData, genero_musical: value })}
              disabled={carregandoEvento}
            >
              <SelectTrigger className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                <SelectValue placeholder="Selecione um gênero" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <SelectItem value="Samba" className="text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-gray-700">Samba</SelectItem>
                <SelectItem value="Pagode" className="text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-gray-700">Pagode</SelectItem>
                <SelectItem value="Sertanejo" className="text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-gray-700">Sertanejo</SelectItem>
                <SelectItem value="DJ" className="text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-gray-700">DJ</SelectItem>
                <SelectItem value="Jazz" className="text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-gray-700">Jazz</SelectItem>
                <SelectItem value="Vocal" className="text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-gray-700">Vocal</SelectItem>
                <SelectItem value="Cubana" className="text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-gray-700">Música Cubana</SelectItem>
                <SelectItem value="Variado" className="text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-gray-700">Variado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Observações
            </label>
            <Textarea
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Ex: Festival Junino, Feriado, etc."
              rows={3}
              disabled={carregandoEvento}
              className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>

          <DialogFooter className="flex gap-3">
            {eventoCompleto?.id && (
              <Button
                type="button"
                onClick={onDelete}
                variant="destructive"
                disabled={loading || deleting || carregandoEvento}
                className="flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <RefreshCcw className="w-4 h-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  <>
                    <X className="w-4 h-4" />
                    Excluir
                  </>
                )}
              </Button>
            )}
            
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              disabled={loading || deleting}
              className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Cancelar
            </Button>
            
            <Button
              type="submit"
              disabled={loading || deleting || carregandoEvento}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? (
                <>
                  <RefreshCcw className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
