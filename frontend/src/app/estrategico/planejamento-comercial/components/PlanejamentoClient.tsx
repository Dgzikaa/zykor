'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useUser } from '@/contexts/UserContext';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { 
  Calendar, 
  Edit, 
  Save, 
  X, 
  TrendingUp, 
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Users,
  DollarSign,
  Clock,
  ChefHat,
  Wine,
  Target,
  AlertCircle,
  CheckCircle,
  Eye,
  Filter,
  BarChart3,
  Ticket,
  UserPlus,
  RefreshCcw,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  Pencil,
  Check
} from 'lucide-react';
import { PlanejamentoData } from '../services/planejamento-service';

interface EventoEdicaoCompleta {
  id: number;
  nome: string;
  data_evento: string;
  dia_semana: string;
  m1_r: number;
  cl_plan: number;
  te_plan: number;
  tb_plan: number;
  c_artistico_plan: number;
  real_r: number;
  cl_real: number;
  te_real: number;
  tb_real: number;
  t_medio: number;
  res_tot: number;
  res_p: number;
  c_art: number;
  c_prod: number;
  percent_b: number;
  percent_d: number;
  percent_c: number;
  percent_happy_hour: number;
  percent_stockout: number;
  t_coz: number;
  t_bar: number;
  atrasinho_cozinha: number;
  atrasinho_bar: number;
  atrasao_cozinha: number;
  atrasao_bar: number;
  sympla_liquido?: number;
  sympla_checkins?: number;
  yuzer_liquido?: number;
  yuzer_ingressos?: number;
  faturamento_couvert_manual?: number | null;
  faturamento_bar_manual?: number | null;
  atrasos_cozinha?: number;
  atrasos_bar?: number;
  observacoes: string;
}

interface PlanejamentoClientProps {
  initialData: PlanejamentoData[];
  serverMes: number;
  serverAno: number;
}

export function PlanejamentoClient({ initialData, serverMes, serverAno }: PlanejamentoClientProps) {
  const { user } = useUser();
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const router = useRouter();
  
  const [dados, setDados] = useState<PlanejamentoData[]>(initialData);
  const [filtroMes, setFiltroMes] = useState(serverMes);
  const [filtroAno, setFiltroAno] = useState(serverAno);
  const [linhaHighlight, setLinhaHighlight] = useState<number | null>(null);
  const [colunaHighlight, setColunaHighlight] = useState<string | null>(null);
  const [editandoReservas, setEditandoReservas] = useState<{id: number, campo: 'res_tot' | 'res_p'} | null>(null);
  const [valorReservaTemp, setValorReservaTemp] = useState<string>('');
  
  useEffect(() => {
    setDados(initialData);
    setFiltroMes(serverMes);
    setFiltroAno(serverAno);
  }, [initialData, serverMes, serverAno]);
  
  // Salvar reserva inline (Deboche)
  const salvarReservaInline = async (eventoId: number, campo: 'res_tot' | 'res_p', valor: number) => {
    try {
      const response = await apiCall(`/api/eventos/${eventoId}/update`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-selected-bar-id': String(selectedBar?.id || '')
        },
        body: JSON.stringify({ [campo]: valor }),
      });
      
      if (response.success) {
        setDados(prev => prev.map(e => 
          e.evento_id === eventoId ? { ...e, [campo]: valor } : e
        ));
        console.log(`✅ Reserva ${campo} atualizada para ${valor}`);
      } else {
        console.error('❌ Erro ao salvar reserva:', response.error);
        alert('Erro ao salvar reserva. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao salvar reserva:', error);
      alert('Erro ao salvar reserva. Tente novamente.');
    }
    setEditandoReservas(null);
    setValorReservaTemp('');
  };
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false); 
  const [eventoSelecionado, setEventoSelecionado] = useState<PlanejamentoData | null>(null);
  const [eventoEdicao, setEventoEdicao] = useState<EventoEdicaoCompleta | null>(null);
  const [salvando, setSalvando] = useState(false);
  
  // Estados para controlar grupos colapsáveis
  const [gruposAbertos, setGruposAbertos] = useState({
    clientes: false,
    ticket: false,
    artistico: false,
    producao: false
  });
  
  const toggleGrupo = (grupo: 'clientes' | 'ticket' | 'artistico' | 'producao') => {
    setGruposAbertos(prev => ({ ...prev, [grupo]: !prev[grupo] }));
  };
  
  const expandirTodos = () => {
    setGruposAbertos({ clientes: true, ticket: true, artistico: true, producao: true });
  };
  
  const recolherTodos = () => {
    setGruposAbertos({ clientes: false, ticket: false, artistico: false, producao: false });
  };

  useEffect(() => {
    setPageTitle('📊 Planejamento Comercial');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const alterarPeriodo = useCallback((novoMes: number, novoAno: number) => {
    router.push(`?mes=${novoMes}&ano=${novoAno}`);
  }, [router]);

  const modalDataCacheRef = useRef<Record<string, any>>({});

  const abrirModal = useCallback(async (evento: PlanejamentoData, editMode: boolean = false) => {
    setEventoSelecionado(evento);
    setModoEdicao(editMode);
    
    const cacheKey = `${evento.evento_id}-${evento.data_evento}`;
    if (modalDataCacheRef.current[cacheKey]) {
      setEventoEdicao(modalDataCacheRef.current[cacheKey]);
      setModalOpen(true);
      return;
    }
    
    const isDomingo = evento.dia_semana === 'DOMINGO' || evento.dia_semana === 'Domingo';
    
    const promises = [
      apiCall(`/api/estrategico/atrasos-evento?data=${evento.data_evento}`, {
        headers: { 'x-selected-bar-id': String(selectedBar?.id || '') }
      }).catch(() => ({ success: false, data: { atrasos_cozinha: 0, atrasos_bar: 0 } }))
    ];
    
    if (isDomingo) {
      promises.push(
        apiCall(`/api/eventos/${evento.evento_id}`, {
          headers: { 'x-selected-bar-id': String(selectedBar?.id || '') }
        }).catch(() => ({ data: null }))
      );
    }
    
    const [atrasosResponse, symplaYuzerResponse] = await Promise.all(promises);
    
    const atrasosData = atrasosResponse?.data || { atrasos_cozinha: 0, atrasos_bar: 0 };
    
    let dadosSymplaYuzer = {};
    if (isDomingo && symplaYuzerResponse?.data) {
      const evt = symplaYuzerResponse.data;
      dadosSymplaYuzer = {
        sympla_liquido: evt.sympla_liquido || 0,
        sympla_checkins: evt.sympla_checkins || 0,
        yuzer_liquido: evt.yuzer_liquido || 0,
        yuzer_ingressos: evt.yuzer_ingressos || 0
      };
    }

    const dadosIniciais: EventoEdicaoCompleta = {
      id: evento.evento_id,
      nome: evento.evento_nome,
      data_evento: evento.data_evento,
      dia_semana: evento.dia_semana,
      m1_r: evento.m1_receita || 0,
      cl_plan: evento.clientes_plan || 0,
      te_plan: evento.te_plan || 0,
      tb_plan: evento.tb_plan || 0,
      c_artistico_plan: evento.c_art || 0,
      real_r: evento.real_receita || 0,
      cl_real: evento.clientes_real || 0,
      te_real: evento.te_real || 0,
      tb_real: evento.tb_real || 0,
      t_medio: evento.t_medio || 0,
      res_tot: evento.res_tot || 0,
      res_p: evento.res_p || 0,
      c_art: evento.c_art || 0,
      c_prod: evento.c_prod || 0,
      percent_b: evento.percent_b || 0,
      percent_d: evento.percent_d || 0,
      percent_c: evento.percent_c || 0,
      percent_happy_hour: evento.percent_happy_hour || 0,
      percent_stockout: evento.percent_stockout || 0,
      t_coz: evento.t_coz || 0,
      t_bar: evento.t_bar || 0,
      atrasinho_cozinha: evento.atrasinho_cozinha || 0,
      atrasinho_bar: evento.atrasinho_bar || 0,
      atrasao_cozinha: evento.atrasao_cozinha || 0,
      atrasao_bar: evento.atrasao_bar || 0,
      ...dadosSymplaYuzer,
      atrasos_cozinha: atrasosData.atrasos_cozinha,
      atrasos_bar: atrasosData.atrasos_bar,
      observacoes: '',
      faturamento_couvert_manual: evento.faturamento_couvert_manual,
      faturamento_bar_manual: evento.faturamento_bar_manual
    };
    
    modalDataCacheRef.current[cacheKey] = dadosIniciais;
    setEventoEdicao(dadosIniciais);
    setModalOpen(true);
  }, [user, selectedBar]);

  const fecharModal = () => {
    setModalOpen(false);
    setEventoSelecionado(null);
    setEventoEdicao(null);
  };

  const salvarEdicao = async () => {
    if (!eventoEdicao) return;
    try {
      setSalvando(true);
      await apiCall(`/api/eventos/${eventoEdicao.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-selected-bar-id': String(selectedBar?.id || '') },
        body: JSON.stringify({
          nome: eventoEdicao.nome,
          m1_r: eventoEdicao.m1_r,
          cl_plan: eventoEdicao.cl_plan,
          te_plan: eventoEdicao.te_plan,
          tb_plan: eventoEdicao.tb_plan,
          c_artistico_plan: eventoEdicao.c_artistico_plan,
          observacoes: eventoEdicao.observacoes
        })
      });

      await apiCall(`/api/eventos/${eventoEdicao.id}/valores-reais`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-selected-bar-id': String(selectedBar?.id || '') },
        body: JSON.stringify({
          real_r: eventoEdicao.real_r || 0,
          cl_real: eventoEdicao.cl_real || 0,
          te_real: eventoEdicao.te_real || 0,
          tb_real: eventoEdicao.tb_real || 0,
          t_medio: eventoEdicao.t_medio || 0,
          res_tot: eventoEdicao.res_tot || 0,
          res_p: eventoEdicao.res_p || 0,
          c_art: eventoEdicao.c_art || 0,
          c_prod: eventoEdicao.c_prod || 0,
          t_coz: eventoEdicao.t_coz || 0,
          t_bar: eventoEdicao.t_bar || 0,
          atrasinho_cozinha: eventoEdicao.atrasinho_cozinha || 0,
          atrasinho_bar: eventoEdicao.atrasinho_bar || 0,
          atrasao_cozinha: eventoEdicao.atrasao_cozinha || 0,
          atrasao_bar: eventoEdicao.atrasao_bar || 0,
          faturamento_couvert_manual: eventoEdicao.faturamento_couvert_manual || null,
          faturamento_bar_manual: eventoEdicao.faturamento_bar_manual || null,
          observacoes: eventoEdicao.observacoes || ''
        })
      });

      // Invalidar cache do modal
      const cacheKey = `${eventoEdicao.id}-${eventoEdicao.data_evento}`;
      delete modalDataCacheRef.current[cacheKey];

      fecharModal();
      router.refresh(); 
    } catch (err) {
      console.error('Erro ao salvar:', err);
      alert('Erro ao salvar alterações');
    } finally {
      setSalvando(false);
    }
  };

  const formatarMoeda = (valor: number | null | undefined): string => {
    if (!valor && valor !== 0) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  const formatarPercentual = (valor: number | null | undefined): string => {
    if (!valor && valor !== 0) return '0,0%';
    return `${valor.toFixed(1).replace('.', ',')}%`;
  };

  const formatarTempo = (valor: number | null | undefined): string => {
    if (!valor && valor !== 0) return '0,00 min';
    return `${valor.toFixed(2).replace('.', ',')} min`;
  };

  const formatarContagem = (valor: number | null | undefined): string => {
    if (!valor && valor !== 0) return '0';
    return Math.round(valor).toString();
  };

  const temDetalheFinanceiro = (evento: PlanejamentoData) => {
    const contaHubLiquido = Number(evento.contahub_liquido || 0);
    const yuzerLiquido = Number(evento.yuzer_liquido || 0);
    const symplaLiquido = Number(evento.sympla_liquido || 0);
    return contaHubLiquido > 0 || yuzerLiquido > 0 || symplaLiquido > 0;
  };

  const meses = [
    { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
  ];

  const anos = [2025, 2026];

  const totaisAgregados = useMemo(() => {
    // Realizado = APENAS soma das receitas reais (não inclui planejado)
    const realizado = dados.reduce((sum, evento) => {
      return sum + (evento.real_receita || 0);
    }, 0);
    
    // Empilhamento = Realizado + Planejado dos eventos que ainda não aconteceram
    const empilhamento = dados.reduce((sum, evento) => {
      if (evento.real_receita && evento.real_receita > 0) return sum + evento.real_receita;
      return sum + (evento.m1_receita || 0);
    }, 0);
    
    const metaM1 = dados.reduce((sum, evento) => sum + (evento.m1_receita || 0), 0);
    const gap = empilhamento - metaM1;
    const gapPercent = metaM1 > 0 ? (gap / metaM1) * 100 : 0;
    const isPositive = gap >= 0;
    
    // Eventos realizados (com receita real > 0)
    const eventosRealizados = dados.filter(e => e.real_receita && e.real_receita > 0);
    
    // Contar dias únicos (não eventos) - agrupa por data
    const datasUnicas = new Set(dados.map(e => e.data_evento));
    const totalDiasComEvento = datasUnicas.size;
    
    // Contar dias únicos com eventos realizados
    const datasRealizadas = new Set(eventosRealizados.map(e => e.data_evento));
    const totalDiasRealizados = datasRealizadas.size;
    
    const totalEventosRealizados = eventosRealizados.length;
    const totalEventos = dados.length;
    
    // Total de clientes
    const totalClientes = eventosRealizados.reduce((sum, e) => sum + (e.clientes_real || 0), 0);
    
    // Ticket médio geral (baseado no realizado, não no empilhamento)
    const ticketMedioGeral = totalClientes > 0 ? realizado / totalClientes : 0;
    
    // Custos totais
    const custoArtistico = eventosRealizados.reduce((sum, e) => sum + (e.c_art || 0), 0);
    const custoProducao = eventosRealizados.reduce((sum, e) => sum + (e.c_prod || 0), 0);
    const custoTotal = custoArtistico + custoProducao;
    
    // % Custo sobre faturamento (baseado no realizado)
    const percentCustoFat = realizado > 0 ? (custoTotal / realizado) * 100 : 0;
    
    // Médias de tickets
    const eventosComTE = dados.filter(e => e.te_plan > 0);
    const mediaTEPlan = eventosComTE.length > 0 ? eventosComTE.reduce((sum, e) => sum + e.te_plan, 0) / eventosComTE.length : 0;
    const mediaTEReal = eventosRealizados.length > 0 ? eventosRealizados.reduce((sum, e) => sum + (e.te_real || 0), 0) / eventosRealizados.length : 0;
    const mediaTBReal = eventosRealizados.length > 0 ? eventosRealizados.reduce((sum, e) => sum + (e.tb_real || 0), 0) / eventosRealizados.length : 0;
    
    // Mix de vendas médio
    const mediaPercentB = eventosRealizados.length > 0 ? eventosRealizados.reduce((sum, e) => sum + (e.percent_b || 0), 0) / eventosRealizados.length : 0;
    const mediaPercentD = eventosRealizados.length > 0 ? eventosRealizados.reduce((sum, e) => sum + (e.percent_d || 0), 0) / eventosRealizados.length : 0;
    const mediaPercentC = eventosRealizados.length > 0 ? eventosRealizados.reduce((sum, e) => sum + (e.percent_c || 0), 0) / eventosRealizados.length : 0;
    
    return { 
      realizado,
      empilhamento, 
      metaM1, 
      gap, 
      gapPercent, 
      isPositive, 
      mediaTEPlan,
      totalEventos,
      totalEventosRealizados,
      totalDiasComEvento,
      totalDiasRealizados,
      totalClientes,
      ticketMedioGeral,
      custoTotal,
      percentCustoFat,
      mediaTEReal,
      mediaTBReal,
      mediaPercentB,
      mediaPercentD,
      mediaPercentC
    };
  }, [dados]);

  return (
    <TooltipProvider>
      <div className="flex flex-col">
        {dados.length === 0 ? (
          <div className="container mx-auto px-4 py-8">
            <Card className="card-dark p-8">
              <div className="text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-[hsl(var(--muted-foreground))]" />
                <h3 className="card-title-dark mb-2">Nenhum evento encontrado</h3>
                <p className="card-description-dark">
                  Não há eventos cadastrados para {meses.find(m => m.value === filtroMes)?.label} de {filtroAno}
                </p>
              </div>
            </Card>
          </div>
        ) : (
          <div className="container mx-auto px-2 py-4 max-w-[98vw]">
            <div className="flex gap-4">
              <div className="flex-1 hidden md:block">
                {/* Tabela Completa */}
                <div className="bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl shadow-sm overflow-auto max-h-[calc(100vh-120px)]">
                  <table className="text-[10px] w-full min-w-max" style={{borderCollapse: 'separate', borderSpacing: 0}}>
                    <thead className="bg-[hsl(var(--muted))]">
                      {/* Primeira linha - Grupos colapsáveis */}
                      <tr className="sticky top-0 z-30 bg-[hsl(var(--muted))] border-b-2 border-[hsl(var(--border))]">
                        <th colSpan={5} className="border-r-2 border-[hsl(var(--border))] bg-[hsl(var(--muted))]/95 sticky left-0 z-40" style={{minWidth: '446px'}}></th>

                        {/* Grupo CLIENTES */}
                        <th
                          colSpan={gruposAbertos.clientes ? 4 : 1}
                          className="px-3 py-2 text-center font-semibold text-[11px] border-r-2 border-[hsl(var(--border))] cursor-pointer hover:bg-[hsl(var(--muted))] transition-colors"
                          onClick={() => toggleGrupo('clientes')}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            {gruposAbertos.clientes ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            <Users className="h-3.5 w-3.5" />
                            <span className="font-bold">CLIENTES</span>
                          </div>
                        </th>
                        
                        {/* Grupo TICKET */}
                        <th
                          colSpan={gruposAbertos.ticket ? 3 : 1}
                          className="px-3 py-2 text-center font-semibold text-[11px] border-r-2 border-[hsl(var(--border))] cursor-pointer hover:bg-[hsl(var(--muted))] transition-colors"
                          onClick={() => toggleGrupo('ticket')}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            {gruposAbertos.ticket ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            <DollarSign className="h-3.5 w-3.5" />
                            <span className="font-bold">TICKET</span>
                          </div>
                        </th>
                        
                        {/* Grupo ARTÍSTICO */}
                        <th
                          colSpan={gruposAbertos.artistico ? 3 : 1}
                          className="px-3 py-2 text-center font-semibold text-[11px] border-r border-[hsl(var(--border))] cursor-pointer hover:bg-[hsl(var(--muted))] transition-colors"
                          onClick={() => toggleGrupo('artistico')}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            {gruposAbertos.artistico ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            <Target className="h-3.5 w-3.5" />
                            <span className="font-bold">ARTÍSTICO</span>
                          </div>
                        </th>

                        {/* Grupo PRODUÇÃO */}
                        <th
                          colSpan={gruposAbertos.producao ? 7 : 1}
                          className="px-3 py-2 text-center font-semibold text-[11px] border-r-2 border-[hsl(var(--border))] cursor-pointer hover:bg-[hsl(var(--muted))] transition-colors"
                          onClick={() => toggleGrupo('producao')}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            {gruposAbertos.producao ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            <ChefHat className="h-3.5 w-3.5" />
                            <span className="font-bold">PRODUÇÃO</span>
                          </div>
                        </th>
                        
                        <th className="px-3 py-2 text-center font-medium text-[hsl(var(--foreground))]" style={{width: '120px', minWidth: '120px', maxWidth: '120px'}}>Ações</th>
                      </tr>
                      
                      {/* Segunda linha - Headers principais e subcolunas */}
                      <tr className="sticky top-[32px] z-30 bg-[hsl(var(--muted))] border-b border-[hsl(var(--border))]">
                        {/* Colunas Fixas (5 primeiras: Data, Dia, Artista, Receita Real, Meta M1) */}
                        <th className="px-0.5 py-2 text-center text-[11px] font-semibold border-r border-[hsl(var(--border))] sticky left-0 bg-[hsl(var(--muted))] z-40" style={{width: '48px', minWidth: '48px', maxWidth: '48px'}}>Data</th>
                        <th className="px-0.5 py-2 text-center text-[11px] font-semibold border-r border-[hsl(var(--border))] sticky left-[48px] bg-[hsl(var(--muted))] z-40" style={{width: '38px', minWidth: '38px', maxWidth: '38px'}}>Dia</th>
                        <th className="px-2 py-2 text-left text-[11px] font-semibold border-r border-[hsl(var(--border))] sticky left-[86px] bg-[hsl(var(--muted))] z-40" style={{width: '140px', minWidth: '140px', maxWidth: '140px'}}>Artista</th>
                        <th className="px-2 py-2 text-center text-[11px] font-semibold border-r border-[hsl(var(--border))] sticky left-[226px] bg-[hsl(var(--muted))] z-40" style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}>Receita Real</th>
                        <th className="px-2 py-2 text-center text-[11px] font-semibold border-r-2 border-[hsl(var(--border))] sticky left-[336px] bg-[hsl(var(--muted))] z-40" style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}>Meta M1</th>
                        
                        {/* Subcolunas CLIENTES */}
                        {gruposAbertos.clientes ? (
                          <>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}>Clientes Planejado</th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}>Clientes Reais</th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}>Reservas Total</th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r-2 border-[hsl(var(--border))]" style={{width: '120px', minWidth: '120px', maxWidth: '120px'}}>Reservas Presentes</th>
                          </>
                        ) : (
                          <th className="border-r-2 border-[hsl(var(--border))]"></th>
                        )}
                        
                        {/* Subcolunas TICKET */}
                        {gruposAbertos.ticket ? (
                          <>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}>Entrada Real</th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '100px', minWidth: '100px', maxWidth: '100px'}}>Bar Real</th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r-2 border-[hsl(var(--border))]" style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}>Ticket Médio</th>
                          </>
                        ) : (
                          <th className="border-r-2 border-[hsl(var(--border))]"></th>
                        )}
                        
                        {/* Subcolunas ANÁLISES */}
                        {gruposAbertos.artistico ? (
                          <>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}>Custo Artístico</th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}>$ Couvert</th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '90px', minWidth: '90px', maxWidth: '90px'}}>% Art/Fat</th>
                          </>
                        ) : (
                          <th className="border-r border-[hsl(var(--border))]"></th>
                        )}

                        {gruposAbertos.producao ? (
                          <>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '90px', minWidth: '90px', maxWidth: '90px'}}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help underline decoration-dotted">% Bebidas</span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs bg-[hsl(var(--popover))] border-[hsl(var(--border))] z-[9999]">
                                  <div className="text-xs space-y-1">
                                    <p className="font-semibold">Categorias incluídas:</p>
                                    <ul className="list-disc list-inside space-y-0.5">
                                      <li>Chopp</li>
                                      <li>Bar</li>
                                      <li>Pegue e Pague</li>
                                      <li>Venda Volante</li>
                                      <li>Baldes</li>
                                    </ul>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '90px', minWidth: '90px', maxWidth: '90px'}}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help underline decoration-dotted">% Drinks</span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs bg-[hsl(var(--popover))] border-[hsl(var(--border))] z-[9999]">
                                  <div className="text-xs space-y-1">
                                    <p className="font-semibold">Categorias incluídas:</p>
                                    <ul className="list-disc list-inside space-y-0.5">
                                      <li>Preshh</li>
                                      <li>Montados</li>
                                      <li>Mexido</li>
                                      <li>Drinks</li>
                                      <li>Drinks Autorais</li>
                                      <li>Shot e Dose</li>
                                      <li>Batidos</li>
                                    </ul>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '90px', minWidth: '90px', maxWidth: '90px'}}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help underline decoration-dotted">% Cozinha</span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs bg-[hsl(var(--popover))] border-[hsl(var(--border))] z-[9999]">
                                  <div className="text-xs space-y-1">
                                    <p className="font-semibold">Categorias incluídas:</p>
                                    <ul className="list-disc list-inside space-y-0.5">
                                      <li>Cozinha</li>
                                      <li>Cozinha 1</li>
                                      <li>Cozinha 2</li>
                                    </ul>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '105px', minWidth: '105px', maxWidth: '105px'}}>Atrasão Coz</th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '105px', minWidth: '105px', maxWidth: '105px'}}>Atrasão Drinks</th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '100px', minWidth: '100px', maxWidth: '100px'}}>Stockout Drinks</th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r-2 border-[hsl(var(--border))]" style={{width: '100px', minWidth: '100px', maxWidth: '100px'}}>Stockout Comidas</th>
                          </>
                        ) : (
                          <th className="border-r-2 border-[hsl(var(--border))]"></th>
                        )}
                        
                        <th style={{width: '120px', minWidth: '120px', maxWidth: '120px'}}></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {dados.map((evento, idx) => {
                          // Calcular número da semana ISO (segunda a domingo)
                          const getWeekNumber = (dateStr: string) => {
                            const date = new Date(dateStr + 'T00:00:00');
                            
                            // Ajustar para segunda-feira ser o primeiro dia da semana
                            const day = date.getDay();
                            const diff = (day === 0 ? -6 : 1) - day; // Se domingo (0), volta 6 dias; senão, vai para segunda
                            const monday = new Date(date);
                            monday.setDate(date.getDate() + diff);
                            
                            // Calcular semana do ano baseada na segunda-feira
                            const firstDayOfYear = new Date(monday.getFullYear(), 0, 1);
                            const firstMonday = new Date(firstDayOfYear);
                            const firstDayOfWeek = firstDayOfYear.getDay();
                            const daysToMonday = (firstDayOfWeek === 0 ? 1 : (8 - firstDayOfWeek)) % 7;
                            firstMonday.setDate(firstDayOfYear.getDate() + daysToMonday);
                            
                            const daysSinceFirstMonday = Math.floor((monday.getTime() - firstMonday.getTime()) / 86400000);
                            return Math.floor(daysSinceFirstMonday / 7) + 1;
                          };
                          
                          const currentWeek = getWeekNumber(evento.data_evento);
                          const previousWeek = idx > 0 ? getWeekNumber(dados[idx - 1].data_evento) : null;
                          // Mostrar label da semana se for primeira linha OU se mudou de semana
                          const isNewWeek = idx === 0 || (previousWeek !== null && currentWeek !== previousWeek);

                          // Calcular total de colunas visíveis para o separador de semana
                          const totalColunas = 5
                            + (gruposAbertos.clientes ? 4 : 1)
                            + (gruposAbertos.ticket ? 3 : 1)
                            + (gruposAbertos.artistico ? 3 : 1)
                            + (gruposAbertos.producao ? 7 : 1)
                            + 1; // Ações

                          return (
                          <React.Fragment key={evento.evento_id}>
                          {isNewWeek && (
                            <tr className="bg-[hsl(var(--muted))]">
                              <td colSpan={totalColunas} className="py-1.5 px-3 text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider border-y-2 border-[hsl(var(--primary))]/30 sticky left-0">
                                Semana {currentWeek}
                              </td>
                            </tr>
                          )}
                          <tr
                            onClick={() => { setLinhaHighlight(idx); setColunaHighlight(null); }}
                            className={`group cursor-pointer transition-colors ${
                              linhaHighlight === idx
                                ? 'bg-blue-200 dark:bg-blue-800/60 ring-2 ring-blue-500 ring-inset shadow-sm'
                                : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'
                            }`}
                          >
                            {/* Colunas Fixas (Data, Dia, Artista, Receita Real, Meta M1) */}
                            <td className={`px-0.5 py-1.5 text-center text-[11px] font-medium border-r border-[hsl(var(--border))] sticky left-0 z-10 transition-colors ${linhaHighlight === idx ? 'bg-blue-200 dark:bg-blue-800/60' : 'bg-[hsl(var(--background))] group-hover:bg-blue-100/70 dark:group-hover:bg-blue-900/30'}`} style={{width: '48px', minWidth: '48px', maxWidth: '48px'}}>{evento.data_curta}</td>
                            <td className={`px-0.5 py-1.5 text-center text-[11px] text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))] sticky left-[48px] z-10 transition-colors ${linhaHighlight === idx ? 'bg-blue-200 dark:bg-blue-800/60' : 'bg-[hsl(var(--background))] group-hover:bg-blue-100/70 dark:group-hover:bg-blue-900/30'}`} style={{width: '38px', minWidth: '38px', maxWidth: '38px'}}>{evento.dia_semana?.substring(0, 3).toUpperCase()}</td>
                            <td className={`px-2 py-1.5 text-left text-[11px] border-r border-[hsl(var(--border))] sticky left-[86px] z-10 truncate transition-colors ${linhaHighlight === idx ? 'bg-blue-200 dark:bg-blue-800/60' : 'bg-[hsl(var(--background))] group-hover:bg-blue-100/70 dark:group-hover:bg-blue-900/30'}`} style={{width: '140px', minWidth: '140px', maxWidth: '140px'}} title={evento.evento_nome || 'Sem atração'}>{evento.evento_nome || '-'}</td>
                            <td 
                              onClick={(e) => { e.stopPropagation(); setLinhaHighlight(idx); setColunaHighlight('real_receita'); }}
                              className={`px-2 py-1.5 text-center text-[11px] border-r border-[hsl(var(--border))] sticky left-[226px] z-10 transition-colors cursor-pointer ${
                                linhaHighlight === idx ? 'bg-blue-200 dark:bg-blue-800/60' : 'bg-[hsl(var(--background))] group-hover:bg-blue-100/70 dark:group-hover:bg-blue-900/30'
                              } ${colunaHighlight === 'real_receita' ? 'bg-amber-100 dark:bg-amber-900/40 ring-2 ring-inset ring-amber-500' : ''}`} 
                              style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}>
                              {evento.real_receita > 0 ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className={`font-semibold cursor-help underline decoration-dotted ${evento.real_vs_m1_green ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                      {formatarMoeda(evento.real_receita)}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-sm bg-[hsl(var(--popover))] border-[hsl(var(--border))] z-[9999]">
                                    {temDetalheFinanceiro(evento) ? (
                                      <div className="text-xs space-y-1">
                                        <p><span className="font-semibold">Faturamento bruto ContaHub:</span> {formatarMoeda(evento.contahub_bruto || 0)}</p>
                                        <p><span className="font-semibold">Conta assinada:</span> {formatarMoeda(evento.conta_assinada || 0)}</p>
                                        <p><span className="font-semibold">Faturamento liquido ContaHub:</span> {formatarMoeda(evento.contahub_liquido || 0)}</p>
                                        {(Number(evento.yuzer_liquido || 0) > 0 || Number(evento.yuzer_entrada || 0) > 0 || Number(evento.yuzer_bar || 0) > 0) && (
                                          <>
                                            <p><span className="font-semibold">Faturamento Yuzer entrada:</span> {formatarMoeda(evento.yuzer_entrada || 0)}</p>
                                            <p><span className="font-semibold">Faturamento Yuzer bar:</span> {formatarMoeda(evento.yuzer_bar || 0)}</p>
                                            <p><span className="font-semibold">Descontos Yuzer:</span> {formatarMoeda(evento.yuzer_descontos || 0)}</p>
                                            <p><span className="font-semibold">Faturamento liquido Yuzer:</span> {formatarMoeda(evento.yuzer_liquido || 0)}</p>
                                          </>
                                        )}
                                        {Number(evento.sympla_liquido || 0) > 0 && (
                                          <p><span className="font-semibold">Faturamento liquido Sympla:</span> {formatarMoeda(evento.sympla_liquido || 0)}</p>
                                        )}
                                        <p className="pt-1 border-t border-[hsl(var(--border))]">
                                          <span className="font-semibold">Faturamento total:</span> {formatarMoeda(evento.faturamento_total_detalhado || evento.real_receita || 0)}
                                        </p>
                                      </div>
                                    ) : (
                                      <div className="text-xs">
                                        <p><span className="font-semibold">Faturamento bruto ContaHub:</span> {formatarMoeda(evento.contahub_bruto || 0)}</p>
                                        <p><span className="font-semibold">Conta assinada:</span> {formatarMoeda(evento.conta_assinada || 0)}</p>
                                        <p><span className="font-semibold">Faturamento liquido ContaHub:</span> {formatarMoeda(evento.contahub_liquido || 0)}</p>
                                      </div>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className={`font-semibold ${evento.real_vs_m1_green ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>-</span>
                              )}
                            </td>
                            <td 
                              onClick={(e) => { e.stopPropagation(); setLinhaHighlight(idx); setColunaHighlight('m1_receita'); }}
                              className={`px-2 py-1.5 text-center text-[11px] text-[hsl(var(--muted-foreground))] border-r-2 border-[hsl(var(--border))] sticky left-[336px] z-10 cursor-pointer transition-colors ${
                                linhaHighlight === idx ? 'bg-blue-200 dark:bg-blue-800/60' : 'bg-[hsl(var(--background))] group-hover:bg-blue-100/70 dark:group-hover:bg-blue-900/30'
                              } ${colunaHighlight === 'm1_receita' ? 'bg-amber-100 dark:bg-amber-900/40 ring-2 ring-inset ring-amber-500' : ''}`} 
                              style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}>{evento.m1_receita > 0 ? formatarMoeda(evento.m1_receita) : '-'}</td>
                            
                            {/* Grupo CLIENTES */}
                            {gruposAbertos.clientes ? (
                              <>
                                <td 
                                  onClick={(e) => { e.stopPropagation(); setLinhaHighlight(idx); setColunaHighlight('clientes_plan'); }}
                                  className={`px-2 py-1.5 text-center text-[11px] text-[hsl(var(--foreground))] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'clientes_plan' ? 'bg-amber-100 dark:bg-amber-900/40 ring-2 ring-inset ring-amber-500' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '100px', minWidth: '100px', maxWidth: '100px'}}>{evento.clientes_plan || '-'}</td>
                                <td 
                                  onClick={(e) => { e.stopPropagation(); setLinhaHighlight(idx); setColunaHighlight('clientes_real'); }}
                                  className={`px-2 py-1.5 text-center text-[11px] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'clientes_real' ? 'bg-amber-100 dark:bg-amber-900/40 ring-2 ring-inset ring-amber-500' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '100px', minWidth: '100px', maxWidth: '100px'}}><span className={`font-semibold ${evento.ci_real_vs_plan_green ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{evento.clientes_real || '-'}</span></td>
                                <td 
                                  onClick={(e) => { e.stopPropagation(); setLinhaHighlight(idx); setColunaHighlight('res_tot'); }}
                                  className={`px-2 py-1.5 text-center text-[11px] text-[hsl(var(--foreground))] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'res_tot' ? 'bg-amber-100 dark:bg-amber-900/40 ring-2 ring-inset ring-amber-500' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '100px', minWidth: '100px', maxWidth: '100px'}}>
                                  {selectedBar?.id === 4 ? (
                                    editandoReservas?.id === evento.evento_id && editandoReservas?.campo === 'res_tot' ? (
                                      <div className="flex items-center justify-center gap-1">
                                        <input
                                          type="number"
                                          className="w-14 px-1 py-0.5 text-center text-[11px] border border-blue-400 rounded bg-[hsl(var(--background))] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                          value={valorReservaTemp}
                                          onChange={(e) => setValorReservaTemp(e.target.value)}
                                          onBlur={() => salvarReservaInline(evento.evento_id, 'res_tot', parseInt(valorReservaTemp) || 0)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') salvarReservaInline(evento.evento_id, 'res_tot', parseInt(valorReservaTemp) || 0);
                                            if (e.key === 'Escape') { setEditandoReservas(null); setValorReservaTemp(''); }
                                          }}
                                          autoFocus
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                        <button
                                          onClick={(e) => { e.stopPropagation(); salvarReservaInline(evento.evento_id, 'res_tot', parseInt(valorReservaTemp) || 0); }}
                                          className="p-0.5 rounded hover:bg-green-100 dark:hover:bg-green-900/40 text-green-600"
                                        >
                                          <Check className="h-3 w-3" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div 
                                        className="flex items-center justify-center gap-1 cursor-pointer group/edit hover:bg-amber-50 dark:hover:bg-amber-900/30 px-1 py-0.5 rounded transition-colors"
                                        onClick={(e) => { e.stopPropagation(); setEditandoReservas({id: evento.evento_id, campo: 'res_tot'}); setValorReservaTemp(String(evento.res_tot || 0)); }}
                                      >
                                        <span className="font-medium">{evento.res_tot || '0'}</span>
                                        <Pencil className="h-3 w-3 text-amber-500 opacity-50 group-hover/edit:opacity-100 transition-opacity" />
                                      </div>
                                    )
                                  ) : (
                                    evento.res_tot || '-'
                                  )}
                                </td>
                                <td 
                                  onClick={(e) => { e.stopPropagation(); setLinhaHighlight(idx); setColunaHighlight('res_p'); }}
                                  className={`px-2 py-1.5 text-center text-[11px] text-[hsl(var(--foreground))] border-r-2 border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'res_p' ? 'bg-amber-100 dark:bg-amber-900/40 ring-2 ring-inset ring-amber-500' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '100px', minWidth: '100px', maxWidth: '100px'}}>
                                  {selectedBar?.id === 4 ? (
                                    editandoReservas?.id === evento.evento_id && editandoReservas?.campo === 'res_p' ? (
                                      <div className="flex items-center justify-center gap-1">
                                        <input
                                          type="number"
                                          className="w-14 px-1 py-0.5 text-center text-[11px] border border-blue-400 rounded bg-[hsl(var(--background))] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                          value={valorReservaTemp}
                                          onChange={(e) => setValorReservaTemp(e.target.value)}
                                          onBlur={() => salvarReservaInline(evento.evento_id, 'res_p', parseInt(valorReservaTemp) || 0)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') salvarReservaInline(evento.evento_id, 'res_p', parseInt(valorReservaTemp) || 0);
                                            if (e.key === 'Escape') { setEditandoReservas(null); setValorReservaTemp(''); }
                                          }}
                                          autoFocus
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                        <button
                                          onClick={(e) => { e.stopPropagation(); salvarReservaInline(evento.evento_id, 'res_p', parseInt(valorReservaTemp) || 0); }}
                                          className="p-0.5 rounded hover:bg-green-100 dark:hover:bg-green-900/40 text-green-600"
                                        >
                                          <Check className="h-3 w-3" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div 
                                        className="flex items-center justify-center gap-1 cursor-pointer group/edit hover:bg-amber-50 dark:hover:bg-amber-900/30 px-1 py-0.5 rounded transition-colors"
                                        onClick={(e) => { e.stopPropagation(); setEditandoReservas({id: evento.evento_id, campo: 'res_p'}); setValorReservaTemp(String(evento.res_p || 0)); }}
                                      >
                                        <span className="font-medium">{evento.res_p || '0'}</span>
                                        <Pencil className="h-3 w-3 text-amber-500 opacity-50 group-hover/edit:opacity-100 transition-opacity" />
                                      </div>
                                    )
                                  ) : (
                                    evento.res_p || '-'
                                  )}
                                </td>
                              </>
                            ) : (
                              <td className="px-2 py-1.5 text-center text-[11px] text-[hsl(var(--muted-foreground))] border-r-2 border-[hsl(var(--border))]" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>•••</td>
                            )}
                            
                            {/* Grupo TICKET */}
                            {gruposAbertos.ticket ? (
                              <>
                                <td 
                                  onClick={(e) => { e.stopPropagation(); setLinhaHighlight(idx); setColunaHighlight('te_real'); }}
                                  className={`px-2 py-1.5 text-right text-[11px] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'te_real' ? 'bg-amber-100 dark:bg-amber-900/40 ring-2 ring-inset ring-amber-500' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}><span className={`font-semibold ${evento.te_real_vs_plan_green ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{evento.te_real > 0 ? formatarMoeda(evento.te_real) : '-'}</span></td>
                                <td 
                                  onClick={(e) => { e.stopPropagation(); setLinhaHighlight(idx); setColunaHighlight('tb_real'); }}
                                  className={`px-2 py-1.5 text-right text-[11px] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'tb_real' ? 'bg-amber-100 dark:bg-amber-900/40 ring-2 ring-inset ring-amber-500' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}><span className={`font-semibold ${evento.tb_real_vs_plan_green ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{evento.tb_real > 0 ? formatarMoeda(evento.tb_real) : '-'}</span></td>
                                <td 
                                  onClick={(e) => { e.stopPropagation(); setLinhaHighlight(idx); setColunaHighlight('t_medio'); }}
                                  className={`px-2 py-1.5 text-right text-[11px] border-r-2 border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 't_medio' ? 'bg-amber-100 dark:bg-amber-900/40 ring-2 ring-inset ring-amber-500' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}><span className={`font-semibold ${evento.t_medio_green ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{evento.t_medio > 0 ? formatarMoeda(evento.t_medio) : '-'}</span></td>
                              </>
                            ) : (
                              <td className="px-2 py-1.5 text-center text-[11px] text-[hsl(var(--muted-foreground))] border-r-2 border-[hsl(var(--border))]" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>•••</td>
                            )}
                            
                            {/* Grupo ARTÍSTICO */}
                            {gruposAbertos.artistico ? (
                              <>
                                <td 
                                  onClick={(e) => { e.stopPropagation(); setLinhaHighlight(idx); setColunaHighlight('c_art'); }}
                                  className={`px-2 py-1.5 text-right text-[11px] text-[hsl(var(--foreground))] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'c_art' ? 'bg-amber-100 dark:bg-amber-900/40 ring-2 ring-inset ring-amber-500' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}>{evento.c_art > 0 ? formatarMoeda(evento.c_art) : '-'}</td>
                                <td 
                                  onClick={(e) => { e.stopPropagation(); setLinhaHighlight(idx); setColunaHighlight('faturamento_couvert'); }}
                                  className={`px-2 py-1.5 text-right text-[11px] text-[hsl(var(--foreground))] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'faturamento_couvert' ? 'bg-amber-100 dark:bg-amber-900/40 ring-2 ring-inset ring-amber-500' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}>{evento.faturamento_couvert > 0 ? formatarMoeda(evento.faturamento_couvert) : '-'}</td>
                                <td 
                                  onClick={(e) => { e.stopPropagation(); setLinhaHighlight(idx); setColunaHighlight('percent_art_fat'); }}
                                  className={`px-2 py-1.5 text-center text-[11px] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'percent_art_fat' ? 'bg-amber-100 dark:bg-amber-900/40 ring-2 ring-inset ring-amber-500' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '90px', minWidth: '90px', maxWidth: '90px'}}><span className={`font-semibold ${evento.percent_art_fat_green ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{evento.percent_art_fat > 0 ? formatarPercentual(evento.percent_art_fat) : '-'}</span></td>
                              </>
                            ) : (
                              <td className="px-2 py-1.5 text-center text-[11px] text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>•••</td>
                            )}

                            {/* Grupo PRODUÇÃO */}
                            {gruposAbertos.producao ? (
                              <>
                                <td 
                                  onClick={(e) => { e.stopPropagation(); setLinhaHighlight(idx); setColunaHighlight('percent_b'); }}
                                  className={`px-2 py-1.5 text-center text-[11px] text-[hsl(var(--foreground))] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'percent_b' ? 'bg-amber-100 dark:bg-amber-900/40 ring-2 ring-inset ring-amber-500' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '90px', minWidth: '90px', maxWidth: '90px'}}>{evento.percent_b > 0 ? formatarPercentual(evento.percent_b) : '-'}</td>
                                <td 
                                  onClick={(e) => { e.stopPropagation(); setLinhaHighlight(idx); setColunaHighlight('percent_d'); }}
                                  className={`px-2 py-1.5 text-center text-[11px] text-[hsl(var(--foreground))] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'percent_d' ? 'bg-amber-100 dark:bg-amber-900/40 ring-2 ring-inset ring-amber-500' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '90px', minWidth: '90px', maxWidth: '90px'}}>{evento.percent_d > 0 ? formatarPercentual(evento.percent_d) : '-'}</td>
                                <td 
                                  onClick={(e) => { e.stopPropagation(); setLinhaHighlight(idx); setColunaHighlight('percent_c'); }}
                                  className={`px-2 py-1.5 text-center text-[11px] text-[hsl(var(--foreground))] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'percent_c' ? 'bg-amber-100 dark:bg-amber-900/40 ring-2 ring-inset ring-amber-500' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '90px', minWidth: '90px', maxWidth: '90px'}}>{evento.percent_c > 0 ? formatarPercentual(evento.percent_c) : '-'}</td>
                                <td 
                                  onClick={(e) => { e.stopPropagation(); setLinhaHighlight(idx); setColunaHighlight('atrasao_cozinha'); }}
                                  className={`px-2 py-1.5 text-center text-[11px] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'atrasao_cozinha' ? 'bg-amber-100 dark:bg-amber-900/40 ring-2 ring-inset ring-amber-500' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '105px', minWidth: '105px', maxWidth: '105px'}}><span className={`font-semibold ${evento.atrasao_cozinha <= 10 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{evento.atrasao_cozinha > 0 ? formatarContagem(evento.atrasao_cozinha) : '-'}</span></td>
                                <td 
                                  onClick={(e) => { e.stopPropagation(); setLinhaHighlight(idx); setColunaHighlight('atrasao_bar'); }}
                                  className={`px-2 py-1.5 text-center text-[11px] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'atrasao_bar' ? 'bg-amber-100 dark:bg-amber-900/40 ring-2 ring-inset ring-amber-500' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '105px', minWidth: '105px', maxWidth: '105px'}}><span className={`font-semibold ${evento.atrasao_bar <= 50 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{evento.atrasao_bar > 0 ? formatarContagem(evento.atrasao_bar) : '-'}</span></td>
                                <td 
                                  onClick={(e) => { e.stopPropagation(); setLinhaHighlight(idx); setColunaHighlight('stockout_drinks'); }}
                                  className={`px-2 py-1.5 text-center text-[11px] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'stockout_drinks' ? 'bg-amber-100 dark:bg-amber-900/40 ring-2 ring-inset ring-amber-500' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '100px', minWidth: '100px', maxWidth: '100px'}}><span className={`font-semibold ${evento.stockout_drinks_perc <= 10 ? 'text-green-600 dark:text-green-400' : evento.stockout_drinks_perc <= 25 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>{evento.stockout_drinks_perc > 0 ? formatarPercentual(evento.stockout_drinks_perc) : '-'}</span></td>
                                <td 
                                  onClick={(e) => { e.stopPropagation(); setLinhaHighlight(idx); setColunaHighlight('stockout_comidas'); }}
                                  className={`px-2 py-1.5 text-center text-[11px] border-r-2 border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'stockout_comidas' ? 'bg-amber-100 dark:bg-amber-900/40 ring-2 ring-inset ring-amber-500' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '100px', minWidth: '100px', maxWidth: '100px'}}><span className={`font-semibold ${evento.stockout_comidas_perc <= 10 ? 'text-green-600 dark:text-green-400' : evento.stockout_comidas_perc <= 25 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>{evento.stockout_comidas_perc > 0 ? formatarPercentual(evento.stockout_comidas_perc) : '-'}</span></td>
                              </>
                            ) : (
                              <td className="px-2 py-1.5 text-center text-[11px] text-[hsl(var(--muted-foreground))] border-r-2 border-[hsl(var(--border))]" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>•••</td>
                            )}
                            
                            <td className="px-2 py-2 text-center" style={{width: '120px', minWidth: '120px', maxWidth: '120px'}}>
                              <div className="flex gap-1.5 justify-center">
                                <Button onClick={(e) => { e.stopPropagation(); abrirModal(evento, false); }} size="sm" variant="outline" className="h-7 w-7 p-0"><Eye className="h-3.5 w-3.5" /></Button>
                                <Button onClick={(e) => { e.stopPropagation(); abrirModal(evento, true); }} size="sm" variant="outline" className="h-7 w-7 p-0"><Edit className="h-3.5 w-3.5" /></Button>
                              </div>
                            </td>
                          </tr>
                          </React.Fragment>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sidebar */}
              <div className="w-64 flex-shrink-0 hidden md:block">
                <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))] rounded-xl shadow-sm p-4 sticky top-4">
                  <div className="space-y-3">
                    <div className="border-b border-[hsl(var(--border))] pb-3">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Filter className="h-4 w-4" /> Controles
                      </h3>
                    </div>
                    
                    {/* Botões de Expandir/Recolher */}
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={expandirTodos} 
                        className="flex-1 h-8"
                        leftIcon={<Maximize2 className="h-3.5 w-3.5" />}
                      >
                        Expandir
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={recolherTodos} 
                        className="flex-1 h-8"
                        leftIcon={<Minimize2 className="h-3.5 w-3.5" />}
                      >
                        Recolher
                      </Button>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-3">Período</label>
                      <div className="grid grid-cols-2 gap-2">
                        <Select value={filtroMes.toString()} onValueChange={(value) => alterarPeriodo(parseInt(value), filtroAno)}>
                          <SelectTrigger className="bg-[hsl(var(--background))]"><SelectValue /></SelectTrigger>
                          <SelectContent>{meses.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={filtroAno.toString()} onValueChange={(value) => alterarPeriodo(filtroMes, parseInt(value))}>
                          <SelectTrigger className="bg-[hsl(var(--background))]"><SelectValue /></SelectTrigger>
                          <SelectContent>{anos.map(a => <SelectItem key={a} value={a.toString()}>{a}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-[hsl(var(--border))]">
                      <h3 className="font-semibold text-[hsl(var(--foreground))] flex items-center gap-2 mb-3"><TrendingUp className="h-4 w-4" /> Estatísticas</h3>
                      <div className="space-y-3 text-xs">
                         <div className="space-y-1.5">
                            <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Meta M1:</span> <span className="font-medium text-[hsl(var(--foreground))]">{formatarMoeda(totaisAgregados.metaM1)}</span></div>
                            <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Realizado:</span><span className={`font-medium ${totaisAgregados.realizado >= totaisAgregados.metaM1 ? 'text-green-600' : 'text-red-600'}`}>{formatarMoeda(totaisAgregados.realizado)}</span></div>
                            <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Atingido:</span><span className="font-medium">{totaisAgregados.metaM1 > 0 ? ((totaisAgregados.realizado / totaisAgregados.metaM1) * 100).toFixed(1) : '0.0'}%</span></div>
                            <div className="flex justify-between">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-[hsl(var(--muted-foreground))] cursor-help underline decoration-dotted">Falta faturar:</span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs bg-[hsl(var(--popover))] border-[hsl(var(--border))] z-[9999]">
                                  <div className="text-xs">
                                    <p>Diferença entre a Meta M1 e o Realizado até o momento</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                              <span className={`font-medium ${totaisAgregados.metaM1 - totaisAgregados.realizado > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                {totaisAgregados.metaM1 - totaisAgregados.realizado < 0 ? '-' : ''}{formatarMoeda(Math.abs(totaisAgregados.metaM1 - totaisAgregados.realizado))}
                              </span>
                            </div>
                         </div>
                         
                         <div className="pt-3 border-t border-[hsl(var(--border))]">
                            <div className="flex justify-between items-center mb-1.5"><span className="font-medium">Empilhamento M1:</span><span className="font-bold">{formatarMoeda(totaisAgregados.empilhamento)}</span></div>
                            <div className="flex justify-between items-center"><span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">GAP:</span><span className={totaisAgregados.isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>{totaisAgregados.isPositive ? "+" : ""}{formatarMoeda(totaisAgregados.gap)} ({totaisAgregados.isPositive ? "+" : ""}{totaisAgregados.gapPercent.toFixed(1)}%)</span></div>
                         </div>
                         
                         <div className="pt-3 border-t border-[hsl(var(--border))] space-y-1.5">
                            <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Período:</span><span className="font-medium text-[hsl(var(--foreground))]">{meses.find(m => m.value === filtroMes)?.label} {filtroAno}</span></div>
                            <div className="flex justify-between">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-[hsl(var(--muted-foreground))] cursor-help underline decoration-dotted">Eventos:</span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs bg-[hsl(var(--popover))] border-[hsl(var(--border))] z-[9999]">
                                  <div className="text-xs space-y-1">
                                    <p><span className="font-semibold">Dias com eventos realizados:</span> {totaisAgregados.totalDiasRealizados}</p>
                                    <p><span className="font-semibold">Total de dias com eventos:</span> {totaisAgregados.totalDiasComEvento}</p>
                                    <p className="pt-1 border-t border-[hsl(var(--border))]"><span className="font-semibold">Total de eventos (incluindo múltiplos no mesmo dia):</span> {totaisAgregados.totalEventosRealizados} / {totaisAgregados.totalEventos}</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                              <span className="font-medium text-[hsl(var(--foreground))]">{totaisAgregados.totalDiasRealizados} / {totaisAgregados.totalDiasComEvento}</span>
                            </div>
                         </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Edição/Visualização */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogContent className="max-w-[70vw] max-h-[85vh] p-0 overflow-hidden rounded-lg shadow-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))]">
              <DialogHeader className="bg-[hsl(var(--muted))] p-4 border-b border-[hsl(var(--border))]"><DialogTitle className="flex items-center gap-3 text-xl font-semibold text-[hsl(var(--foreground))]"><BarChart3 className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />{modoEdicao ? 'Editar Evento' : 'Visualizar Evento'} - {eventoEdicao?.nome}</DialogTitle><DialogDescription>{modoEdicao ? 'Edite os dados planejados e reais' : 'Comparativo Planejado vs Realizado'}</DialogDescription></DialogHeader>
              <div className="flex-1 overflow-y-auto p-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                   <div className="space-y-3">
                      <div className="flex items-center gap-3 mb-2 pb-2 border-b"><div className="w-3 h-3 bg-blue-500 rounded-full"></div><h2 className="font-semibold">PLANEJADO</h2></div>
                      <div className="p-3 bg-[hsl(var(--muted))] rounded border"><Label>Receita M1</Label>{modoEdicao ? <Input type="number" value={eventoEdicao?.m1_r || 0} onChange={e => setEventoEdicao(p => p ? {...p, m1_r: parseFloat(e.target.value)} : null)} /> : <div className="p-2 bg-[hsl(var(--background))] rounded border">{formatarMoeda(eventoEdicao?.m1_r)}</div>}</div>
                      <div className="p-3 bg-[hsl(var(--muted))] rounded border"><Label>Clientes</Label>{modoEdicao ? <Input type="number" value={eventoEdicao?.cl_plan || 0} onChange={e => setEventoEdicao(p => p ? {...p, cl_plan: parseInt(e.target.value)} : null)} /> : <div className="p-2 bg-[hsl(var(--background))] rounded border">{(eventoEdicao?.cl_plan || 0).toLocaleString()}</div>}</div>
                      <div className="p-3 bg-[hsl(var(--muted))] rounded border"><Label>Ticket Entrada</Label>{modoEdicao ? <Input type="number" value={eventoEdicao?.te_plan || 0} onChange={e => setEventoEdicao(p => p ? {...p, te_plan: parseFloat(e.target.value)} : null)} /> : <div className="p-2 bg-[hsl(var(--background))] rounded border">{formatarMoeda(eventoEdicao?.te_plan)}</div>}</div>
                      <div className="p-3 bg-[hsl(var(--muted))] rounded border"><Label>Ticket Bar</Label>{modoEdicao ? <Input type="number" value={eventoEdicao?.tb_plan || 0} onChange={e => setEventoEdicao(p => p ? {...p, tb_plan: parseFloat(e.target.value)} : null)} /> : <div className="p-2 bg-[hsl(var(--background))] rounded border">{formatarMoeda(eventoEdicao?.tb_plan)}</div>}</div>
                      <div className="p-3 bg-[hsl(var(--muted))] rounded border"><Label>Custo Artístico</Label>{modoEdicao ? <Input type="number" value={eventoEdicao?.c_artistico_plan || 0} onChange={e => setEventoEdicao(p => p ? {...p, c_artistico_plan: parseFloat(e.target.value)} : null)} /> : <div className="p-2 bg-[hsl(var(--background))] rounded border">{formatarMoeda(eventoEdicao?.c_artistico_plan)}</div>}</div>
                   </div>
                   <div className="space-y-3">
                      <div className="flex items-center gap-3 mb-2 pb-2 border-b"><div className="w-3 h-3 bg-green-500 rounded-full"></div><h2 className="font-semibold">REALIZADO</h2></div>
                      <div className="p-3 bg-[hsl(var(--muted))] rounded border"><Label>Receita Real</Label>{modoEdicao ? <Input type="number" value={eventoEdicao?.real_r || 0} onChange={e => setEventoEdicao(p => p ? {...p, real_r: parseFloat(e.target.value)} : null)} /> : <div className="p-2 bg-[hsl(var(--background))] rounded border">{formatarMoeda(eventoEdicao?.real_r)}</div>}</div>
                      <div className="p-3 bg-[hsl(var(--muted))] rounded border"><Label>Clientes Real</Label>{modoEdicao ? <Input type="number" value={eventoEdicao?.cl_real || 0} onChange={e => setEventoEdicao(p => p ? {...p, cl_real: parseInt(e.target.value)} : null)} /> : <div className="p-2 bg-[hsl(var(--background))] rounded border">{(eventoEdicao?.cl_real || 0).toLocaleString()}</div>}</div>
                      <div className="p-3 bg-[hsl(var(--muted))] rounded border"><Label>Reservas (Total / Pagas)</Label>{modoEdicao ? <div className="flex gap-2"><Input type="number" value={eventoEdicao?.res_tot || 0} onChange={e => setEventoEdicao(p => p ? {...p, res_tot: parseInt(e.target.value)} : null)} /><Input type="number" value={eventoEdicao?.res_p || 0} onChange={e => setEventoEdicao(p => p ? {...p, res_p: parseInt(e.target.value)} : null)} /></div> : <div className="p-2 bg-[hsl(var(--background))] rounded border">{eventoEdicao?.res_tot} / {eventoEdicao?.res_p}</div>}</div>
                      <div className="p-3 bg-[hsl(var(--muted))] rounded border"><Label>Custo Artístico / Prod</Label>{modoEdicao ? <div className="flex gap-2"><Input type="number" value={eventoEdicao?.c_art || 0} onChange={e => setEventoEdicao(p => p ? {...p, c_art: parseFloat(e.target.value)} : null)} /><Input type="number" value={eventoEdicao?.c_prod || 0} onChange={e => setEventoEdicao(p => p ? {...p, c_prod: parseFloat(e.target.value)} : null)} /></div> : <div className="p-2 bg-[hsl(var(--background))] rounded border">{formatarMoeda(eventoEdicao?.c_art)} / {formatarMoeda(eventoEdicao?.c_prod)}</div>}</div>
                      <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800"><h3 className="text-base font-medium mb-2 text-[hsl(var(--foreground))] flex items-center gap-2"><AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" /> Atrasos de Entrega</h3><div className="grid grid-cols-2 gap-4"><div><Label>Cozinha</Label><div className="mt-1 font-medium">{eventoEdicao?.atrasos_cozinha ?? 0}</div></div><div><Label>Bar</Label><div className="mt-1 font-medium">{eventoEdicao?.atrasos_bar ?? 0}</div></div></div></div>
                   </div>
                </div>
              </div>
              <DialogFooter className="bg-[hsl(var(--muted))] p-4 border-t"><Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>{modoEdicao && <Button onClick={salvarEdicao} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar Alterações'}</Button>}</DialogFooter>
            </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
