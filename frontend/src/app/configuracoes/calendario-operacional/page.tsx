'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle,
  XCircle,
  Info,
  RefreshCw,
  Save,
  Trash2,
  TrendingUp,
  DollarSign,
  CheckSquare,
  Square,
  Lightbulb,
  History,
  BarChart3
} from 'lucide-react';
import { LoadingState } from '@/components/ui/loading-state';
import Link from 'next/link';
import { toast } from 'sonner';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DiaCalendario {
  data: string;
  status: 'aberto' | 'fechado' | 'desconhecido';
  motivo?: string;
  observacao?: string;
  tem_registro: boolean;
  tem_movimento: boolean;
  valor_movimento?: number;
  diaSemana: number;
  diaSemanaLabel: string;
}

interface CalendarioData {
  mes: number;
  ano: number;
  bar_id: number;
  dias: DiaCalendario[];
  estatisticas: {
    total_dias: number;
    dias_abertos: number;
    dias_fechados: number;
    dias_com_registro_manual: number;
    percentual_aberto: string;
  };
}

const MOTIVOS_PREDEFINIDOS = [
  'Terça-feira (padrão)',
  'Segunda-feira (padrão)',
  'Feriado',
  'Manutenção',
  'Evento privado',
  'Férias coletivas',
  'Reforma',
  'Dia especial - Aberto',
  'Outro'
];

export default function CalendarioOperacionalPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();

  const [mesAtual, setMesAtual] = useState(new Date().getMonth() + 1);
  const [anoAtual, setAnoAtual] = useState(new Date().getFullYear());
  const [calendarioData, setCalendarioData] = useState<CalendarioData | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Modal de edição
  const [modalAberto, setModalAberto] = useState(false);
  const [diaEdicao, setDiaEdicao] = useState<DiaCalendario | null>(null);
  const [statusEdicao, setStatusEdicao] = useState<'aberto' | 'fechado'>('fechado');
  const [motivoEdicao, setMotivoEdicao] = useState('');
  const [observacaoEdicao, setObservacaoEdicao] = useState('');
  const [salvando, setSalvando] = useState(false);
  
  // Bulk selection
  const [modoSelecao, setModoSelecao] = useState(false);
  const [diasSelecionados, setDiasSelecionados] = useState<Set<string>>(new Set());
  const [statusBulk, setStatusBulk] = useState<'aberto' | 'fechado'>('fechado');
  const [motivoBulk, setMotivoBulk] = useState('');
  
  // Sugestões
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [sugestoes, setSugestoes] = useState<any>(null);

  useEffect(() => {
    setPageTitle('Calendário Operacional');
    carregarCalendario();
  }, [mesAtual, anoAtual]);

  const carregarCalendario = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/ferramentas/calendario-operacional?mes=${mesAtual}&ano=${anoAtual}&bar_id=${selectedBar?.id}`
      );
      
      if (!response.ok) throw new Error('Erro ao carregar calendário');
      
      const result = await response.json();
      setCalendarioData(result.data);
    } catch (error) {
      console.error('Erro ao carregar calendário:', error);
      toast.error('Erro ao carregar calendário');
    } finally {
      setLoading(false);
    }
  };

  const carregarSugestoes = async () => {
    try {
      const response = await fetch(
        `/api/ferramentas/calendario-operacional/sugestoes?mes=${mesAtual}&ano=${anoAtual}&bar_id=${selectedBar?.id}`
      );
      if (!response.ok) throw new Error('Erro ao carregar sugestões');
      const result = await response.json();
      setSugestoes(result.data);
      setMostrarSugestoes(true);
    } catch (error) {
      console.error('Erro ao carregar sugestões:', error);
      toast.error('Erro ao carregar sugestões');
    }
  };

  const toggleDiaSelecao = (data: string) => {
    const novoSet = new Set(diasSelecionados);
    if (novoSet.has(data)) {
      novoSet.delete(data);
    } else {
      novoSet.add(data);
    }
    setDiasSelecionados(novoSet);
  };

  const selecionarTodos = () => {
    if (!calendarioData) return;
    const todasDatas = new Set(calendarioData.dias.map(d => d.data));
    setDiasSelecionados(todasDatas);
  };

  const limparSelecao = () => {
    setDiasSelecionados(new Set());
    setModoSelecao(false);
  };

  const aplicarBulkAction = async () => {
    if (diasSelecionados.size === 0) {
      toast.error('Selecione pelo menos um dia');
      return;
    }

    setSalvando(true);
    try {
      const response = await fetch('/api/ferramentas/calendario-operacional/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datas: Array.from(diasSelecionados),
          bar_id: selectedBar?.id,
          status: statusBulk,
          motivo: motivoBulk,
          usuario_nome: 'Usuário Web'
        })
      });

      if (!response.ok) throw new Error('Erro ao aplicar ação em lote');

      const result = await response.json();
      toast.success(result.message);
      limparSelecao();
      carregarCalendario();
    } catch (error) {
      console.error('Erro ao aplicar bulk action:', error);
      toast.error('Erro ao aplicar ação em lote');
    } finally {
      setSalvando(false);
    }
  };

  const aplicarSugestao = async (datas: string[], status: string, motivo: string) => {
    setSalvando(true);
    try {
      const response = await fetch('/api/ferramentas/calendario-operacional/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datas,
          bar_id: selectedBar?.id,
          status,
          motivo,
          usuario_nome: 'Sugestão Automática'
        })
      });

      if (!response.ok) throw new Error('Erro ao aplicar sugestão');

      const result = await response.json();
      toast.success(result.message);
      setMostrarSugestoes(false);
      carregarCalendario();
    } catch (error) {
      console.error('Erro ao aplicar sugestão:', error);
      toast.error('Erro ao aplicar sugestão');
    } finally {
      setSalvando(false);
    }
  };

  const abrirModalEdicao = (dia: DiaCalendario) => {
    setDiaEdicao(dia);
    setStatusEdicao(dia.status === 'desconhecido' ? 'fechado' : dia.status);
    setMotivoEdicao(dia.motivo || '');
    setObservacaoEdicao(dia.observacao || '');
    setModalAberto(true);
  };

  const salvarDia = async () => {
    if (!diaEdicao) return;

    setSalvando(true);
    try {
      const response = await fetch('/api/ferramentas/calendario-operacional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: diaEdicao.data,
          bar_id: selectedBar?.id,
          status: statusEdicao,
          motivo: motivoEdicao,
          observacao: observacaoEdicao
        })
      });

      if (!response.ok) throw new Error('Erro ao salvar');

      toast.success('Dia atualizado com sucesso!');
      setModalAberto(false);
      carregarCalendario();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar alterações');
    } finally {
      setSalvando(false);
    }
  };

  const removerRegistro = async () => {
    if (!diaEdicao || !diaEdicao.tem_registro) return;

    setSalvando(true);
    try {
      const response = await fetch(
        `/api/ferramentas/calendario-operacional?data=${diaEdicao.data}&bar_id=${selectedBar?.id}`,
        { method: 'DELETE' }
      );

      if (!response.ok) throw new Error('Erro ao remover');

      toast.success('Registro removido! Status voltará ao padrão automático.');
      setModalAberto(false);
      carregarCalendario();
    } catch (error) {
      console.error('Erro ao remover:', error);
      toast.error('Erro ao remover registro');
    } finally {
      setSalvando(false);
    }
  };

  const mudarMes = (direcao: 'anterior' | 'proximo') => {
    if (direcao === 'anterior') {
      if (mesAtual === 1) {
        setMesAtual(12);
        setAnoAtual(anoAtual - 1);
      } else {
        setMesAtual(mesAtual - 1);
      }
    } else {
      if (mesAtual === 12) {
        setMesAtual(1);
        setAnoAtual(anoAtual + 1);
      } else {
        setMesAtual(mesAtual + 1);
      }
    }
  };

  const getNomeMes = (mes: number) => {
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return meses[mes - 1];
  };

  const getCorStatus = (status: string) => {
    switch (status) {
      case 'aberto': return 'bg-green-100 dark:bg-green-900/30 border-green-500 dark:border-green-600';
      case 'fechado': return 'bg-red-100 dark:bg-red-900/30 border-red-500 dark:border-red-600';
      default: return 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600';
    }
  };

  const getIconeStatus = (status: string) => {
    switch (status) {
      case 'aberto': return <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case 'fechado': return <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
      default: return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  // Organizar dias em semanas para exibição em grade
  const organizarEmSemanas = (dias: DiaCalendario[]) => {
    if (!dias || dias.length === 0) return [];

    const semanas: DiaCalendario[][] = [];
    let semanaAtual: DiaCalendario[] = [];

    // Adicionar dias vazios no início se necessário
    const primeiroDia = dias[0];
    const diaSemanaInicio = primeiroDia.diaSemana;
    
    for (let i = 0; i < diaSemanaInicio; i++) {
      semanaAtual.push(null as any);
    }

    // Adicionar dias do mês
    dias.forEach((dia, index) => {
      semanaAtual.push(dia);
      
      // Se completou uma semana (7 dias) ou é o último dia
      if (semanaAtual.length === 7 || index === dias.length - 1) {
        // Completar semana com dias vazios se necessário
        while (semanaAtual.length < 7) {
          semanaAtual.push(null as any);
        }
        semanas.push(semanaAtual);
        semanaAtual = [];
      }
    });

    return semanas;
  };

  const semanas = calendarioData ? organizarEmSemanas(calendarioData.dias) : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header com Navegação */}
        <Card className="card-dark mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="card-title-dark flex items-center gap-2">
                  <CalendarIcon className="w-6 h-6" />
                  Calendário Operacional
                </CardTitle>
                <CardDescription className="card-description-dark mt-2">
                  Gerencie os dias de abertura e fechamento do bar
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Link href="/configuracoes/calendario-operacional/analytics">
                  <Button variant="outline" size="sm" className="bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Analytics
                  </Button>
                </Link>
                <Button
                  onClick={carregarCalendario}
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {/* Barra de Ferramentas */}
            <div className="flex flex-wrap gap-2 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
              <Button
                onClick={() => setModoSelecao(!modoSelecao)}
                variant={modoSelecao ? 'default' : 'outline'}
                size="sm"
                className={modoSelecao ? 'bg-blue-600 hover:bg-blue-700' : ''}
              >
                {modoSelecao ? <CheckSquare className="w-4 h-4 mr-2" /> : <Square className="w-4 h-4 mr-2" />}
                Modo Seleção
              </Button>

              <Button
                onClick={carregarSugestoes}
                variant="outline"
                size="sm"
                className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
              >
                <Lightbulb className="w-4 h-4 mr-2" />
                Sugestões
              </Button>

              {modoSelecao && (
                <>
                  <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-2" />
                  <Button
                    onClick={selecionarTodos}
                    variant="outline"
                    size="sm"
                  >
                    Selecionar Todos
                  </Button>
                  <Button
                    onClick={limparSelecao}
                    variant="outline"
                    size="sm"
                  >
                    Limpar
                  </Button>
                  {diasSelecionados.size > 0 && (
                    <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700 px-3 py-1">
                      {diasSelecionados.size} {diasSelecionados.size === 1 ? 'dia selecionado' : 'dias selecionados'}
                    </Badge>
                  )}
                </>
              )}
            </div>

            {/* Bulk Actions Panel */}
            {modoSelecao && diasSelecionados.size > 0 && (
              <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 mb-6">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                    Ação em Lote - {diasSelecionados.size} {diasSelecionados.size === 1 ? 'dia' : 'dias'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[200px]">
                      <Label className="text-sm text-blue-900 dark:text-blue-300 mb-2 block">Status</Label>
                      <select
                        value={statusBulk}
                        onChange={(e) => setStatusBulk(e.target.value as 'aberto' | 'fechado')}
                        className="input-dark"
                      >
                        <option value="fechado">Fechado</option>
                        <option value="aberto">Aberto</option>
                      </select>
                    </div>
                    <div className="flex-1 min-w-[300px]">
                      <Label className="text-sm text-blue-900 dark:text-blue-300 mb-2 block">Motivo</Label>
                      <Input
                        value={motivoBulk}
                        onChange={(e) => setMotivoBulk(e.target.value)}
                        placeholder="Motivo da alteração"
                        className="input-dark"
                      />
                    </div>
                    <Button
                      onClick={aplicarBulkAction}
                      disabled={salvando}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {salvando ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Aplicando...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Aplicar
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Navegação de Mês */}
            <div className="flex items-center justify-between mb-6">
              <Button
                onClick={() => mudarMes('anterior')}
                variant="outline"
                size="sm"
                className="bg-white dark:bg-gray-700"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Anterior
              </Button>
              
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {getNomeMes(mesAtual)} {anoAtual}
              </h2>
              
              <Button
                onClick={() => mudarMes('proximo')}
                variant="outline"
                size="sm"
                className="bg-white dark:bg-gray-700"
              >
                Próximo
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

            {/* Estatísticas */}
            {calendarioData && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total de Dias</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {calendarioData.estatisticas.total_dias}
                  </div>
                </div>
                
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="text-sm text-green-700 dark:text-green-400">Dias Abertos</div>
                  <div className="text-2xl font-bold text-green-900 dark:text-green-300">
                    {calendarioData.estatisticas.dias_abertos}
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-500 mt-1">
                    {calendarioData.estatisticas.percentual_aberto}
                  </div>
                </div>
                
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="text-sm text-red-700 dark:text-red-400">Dias Fechados</div>
                  <div className="text-2xl font-bold text-red-900 dark:text-red-300">
                    {calendarioData.estatisticas.dias_fechados}
                  </div>
                </div>
                
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="text-sm text-blue-700 dark:text-blue-400">Registros Manuais</div>
                  <div className="text-2xl font-bold text-blue-900 dark:text-blue-300">
                    {calendarioData.estatisticas.dias_com_registro_manual}
                  </div>
                </div>
              </div>
            )}

            {/* Calendário */}
            {loading ? (
              <LoadingState
                title="Carregando calendário..."
                subtitle="Processando dias operacionais"
                icon={<CalendarIcon className="w-4 h-4" />}
              />
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Cabeçalho dos dias da semana */}
                <div className="grid grid-cols-7 bg-gray-100 dark:bg-gray-700">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia) => (
                    <div 
                      key={dia}
                      className="p-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600 last:border-r-0"
                    >
                      {dia}
                    </div>
                  ))}
                </div>

                {/* Dias do mês */}
                {semanas.map((semana, semanaIdx) => (
                  <div key={semanaIdx} className="grid grid-cols-7 border-t border-gray-200 dark:border-gray-700">
                    {semana.map((dia, diaIdx) => (
                      <div
                        key={diaIdx}
                        className="min-h-[100px] border-r border-gray-200 dark:border-gray-700 last:border-r-0"
                      >
                        {dia && (
                          <button
                            onClick={() => modoSelecao ? toggleDiaSelecao(dia.data) : abrirModalEdicao(dia)}
                            className={`w-full h-full p-2 text-left transition-all hover:opacity-80 relative ${getCorStatus(dia.status)} ${
                              modoSelecao && diasSelecionados.has(dia.data) ? 'ring-4 ring-blue-500 dark:ring-blue-400' : ''
                            }`}
                          >
                            {modoSelecao && (
                              <div className="absolute top-1 left-1">
                                {diasSelecionados.has(dia.data) ? (
                                  <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800 rounded" />
                                ) : (
                                  <Square className="w-5 h-5 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 rounded" />
                                )}
                              </div>
                            )}
                            <div className={`flex items-start justify-between mb-1 ${modoSelecao ? 'ml-6' : ''}`}>
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {new Date(dia.data + 'T12:00:00').getDate()}
                              </span>
                              {getIconeStatus(dia.status)}
                            </div>
                            
                            <div className="text-xs space-y-1">
                              {dia.tem_registro && (
                                <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700">
                                  Manual
                                </Badge>
                              )}
                              
                              {dia.tem_movimento && dia.valor_movimento && dia.valor_movimento > 0 && (
                                <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                  <DollarSign className="w-3 h-3" />
                                  <span className="font-mono">
                                    {dia.valor_movimento.toLocaleString('pt-BR', { 
                                      style: 'currency', 
                                      currency: 'BRL',
                                      minimumFractionDigits: 0
                                    })}
                                  </span>
                                </div>
                              )}
                              
                              {dia.motivo && (
                                <p className="text-gray-600 dark:text-gray-400 line-clamp-2">
                                  {dia.motivo}
                                </p>
                              )}
                            </div>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Legenda */}
            <div className="mt-6 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-100 dark:bg-green-900/30 border-2 border-green-500 dark:border-green-600 rounded"></div>
                <span className="text-gray-700 dark:text-gray-300">Aberto</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-100 dark:bg-red-900/30 border-2 border-red-500 dark:border-red-600 rounded"></div>
                <span className="text-gray-700 dark:text-gray-300">Fechado</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900 border-blue-300">Manual</Badge>
                <span className="text-gray-700 dark:text-gray-300">Registro manual (você definiu)</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-gray-700 dark:text-gray-300">Movimento detectado</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Modal de Edição */}
        <Dialog open={modalAberto} onOpenChange={setModalAberto}>
          <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white">
                Editar Dia - {diaEdicao && new Date(diaEdicao.data + 'T12:00:00').toLocaleDateString('pt-BR', { 
                  day: '2-digit', 
                  month: 'long', 
                  year: 'numeric',
                  weekday: 'long'
                })}
              </DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400">
                {diaEdicao?.tem_registro 
                  ? 'Este dia possui registro manual. Você pode editar ou remover.'
                  : 'Adicione um registro manual para sobrescrever o status automático.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              {/* Status */}
              <div>
                <Label className="text-gray-900 dark:text-white">Status do Dia</Label>
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => setStatusEdicao('aberto')}
                    className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                      statusEdicao === 'aberto'
                        ? 'bg-green-100 dark:bg-green-900/30 border-green-500 dark:border-green-600'
                        : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <CheckCircle className={`w-5 h-5 mx-auto mb-1 ${
                      statusEdicao === 'aberto' ? 'text-green-600 dark:text-green-400' : 'text-gray-400'
                    }`} />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Aberto</span>
                  </button>
                  
                  <button
                    onClick={() => setStatusEdicao('fechado')}
                    className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                      statusEdicao === 'fechado'
                        ? 'bg-red-100 dark:bg-red-900/30 border-red-500 dark:border-red-600'
                        : 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <XCircle className={`w-5 h-5 mx-auto mb-1 ${
                      statusEdicao === 'fechado' ? 'text-red-600 dark:text-red-400' : 'text-gray-400'
                    }`} />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Fechado</span>
                  </button>
                </div>
              </div>

              {/* Motivo */}
              <div>
                <Label htmlFor="motivo" className="text-gray-900 dark:text-white">Motivo</Label>
                <select
                  id="motivo"
                  value={motivoEdicao}
                  onChange={(e) => setMotivoEdicao(e.target.value)}
                  className="w-full mt-1 input-dark"
                >
                  <option value="">Selecione um motivo...</option>
                  {MOTIVOS_PREDEFINIDOS.map(motivo => (
                    <option key={motivo} value={motivo}>{motivo}</option>
                  ))}
                </select>
              </div>

              {/* Observação */}
              <div>
                <Label htmlFor="observacao" className="text-gray-900 dark:text-white">Observação (opcional)</Label>
                <Textarea
                  id="observacao"
                  value={observacaoEdicao}
                  onChange={(e) => setObservacaoEdicao(e.target.value)}
                  placeholder="Adicione detalhes adicionais..."
                  rows={3}
                  className="mt-1 textarea-dark"
                />
              </div>

              {/* Informações Adicionais */}
              {diaEdicao && (
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Movimento:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {diaEdicao.tem_movimento && diaEdicao.valor_movimento 
                        ? diaEdicao.valor_movimento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : 'Sem movimento'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Status Atual:</span>
                    <Badge className={diaEdicao.status === 'aberto' ? 'badge-success' : 'badge-error'}>
                      {diaEdicao.status}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Botões */}
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={salvarDia}
                  disabled={salvando}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {salvando ? 'Salvando...' : 'Salvar'}
                </Button>
                
                {diaEdicao?.tem_registro && (
                  <Button
                    onClick={removerRegistro}
                    disabled={salvando}
                    variant="outline"
                    className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/40"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remover
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Sugestões */}
        <Dialog open={mostrarSugestoes} onOpenChange={setMostrarSugestoes}>
          <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                Sugestões Inteligentes
              </DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400">
                Sugestões baseadas em feriados, padrões detectados e histórico
              </DialogDescription>
            </DialogHeader>

            {sugestoes && (
              <div className="space-y-4">
                {sugestoes.resumo && (
                  <div className="flex gap-2">
                    <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900 border-blue-300">
                      {sugestoes.resumo.total_sugestoes} sugestões
                    </Badge>
                    {sugestoes.resumo.feriados_nao_cadastrados > 0 && (
                      <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900 border-yellow-300">
                        {sugestoes.resumo.feriados_nao_cadastrados} feriados
                      </Badge>
                    )}
                    {sugestoes.resumo.inconsistencias > 0 && (
                      <Badge variant="outline" className="bg-red-100 dark:bg-red-900 border-red-300">
                        {sugestoes.resumo.inconsistencias} inconsistências
                      </Badge>
                    )}
                  </div>
                )}

                {sugestoes.sugestoes.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 mx-auto text-green-600 dark:text-green-400 mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      Nenhuma sugestão no momento. Calendário está consistente!
                    </p>
                  </div>
                ) : (
                  sugestoes.sugestoes.map((sugestao: any, idx: number) => (
                    <Card key={idx} className={`
                      ${sugestao.prioridade === 'alta' ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20' : ''}
                      ${sugestao.prioridade === 'media' ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20' : ''}
                      ${sugestao.prioridade === 'baixa' ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20' : ''}
                    `}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">
                              {sugestao.titulo}
                            </CardTitle>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {sugestao.descricao}
                            </p>
                          </div>
                          <Badge variant="outline" className={`
                            ${sugestao.prioridade === 'alta' ? 'bg-red-100 dark:bg-red-900 border-red-300' : ''}
                            ${sugestao.prioridade === 'media' ? 'bg-yellow-100 dark:bg-yellow-900 border-yellow-300' : ''}
                            ${sugestao.prioridade === 'baixa' ? 'bg-blue-100 dark:bg-blue-900 border-blue-300' : ''}
                          `}>
                            {sugestao.prioridade}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {sugestao.acoes && sugestao.acoes.length > 0 && (
                          <div className="space-y-2">
                            {sugestao.acoes.slice(0, 5).map((acao: any, acaoIdx: number) => (
                              <div key={acaoIdx} className="text-xs bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-gray-900 dark:text-white">
                                    {new Date(acao.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                                  </span>
                                  {acao.motivo && (
                                    <span className="text-gray-600 dark:text-gray-400">{acao.motivo}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                            {sugestao.acoes.length > 5 && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                ... e mais {sugestao.acoes.length - 5} {sugestao.acoes.length - 5 === 1 ? 'dia' : 'dias'}
                              </p>
                            )}
                            <Button
                              onClick={() => aplicarSugestao(
                                sugestao.acoes.map((a: any) => a.data),
                                sugestao.acoes[0].status || 'fechado',
                                sugestao.acoes[0].motivo || sugestao.titulo
                              )}
                              size="sm"
                              className="w-full bg-blue-600 hover:bg-blue-700 mt-2"
                              disabled={salvando}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Aplicar Sugestão
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

