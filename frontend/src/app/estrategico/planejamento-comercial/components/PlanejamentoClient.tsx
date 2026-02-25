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
  RefreshCcw
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
  percent_stockout: number;
  t_coz: number;
  t_bar: number;
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
  
  useEffect(() => {
    setDados(initialData);
    setFiltroMes(serverMes);
    setFiltroAno(serverAno);
  }, [initialData, serverMes, serverAno]);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false); 
  const [eventoSelecionado, setEventoSelecionado] = useState<PlanejamentoData | null>(null);
  const [eventoEdicao, setEventoEdicao] = useState<EventoEdicaoCompleta | null>(null);
  const [salvando, setSalvando] = useState(false);

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
        headers: { 'x-user-data': encodeURIComponent(JSON.stringify({ ...user, bar_id: selectedBar?.id })) }
      }).catch(() => ({ success: false, data: { atrasos_cozinha: 0, atrasos_bar: 0 } }))
    ];
    
    if (isDomingo) {
      promises.push(
        apiCall(`/api/eventos/${evento.evento_id}`, {
          headers: { 'x-user-data': encodeURIComponent(JSON.stringify({ ...user, bar_id: selectedBar?.id })) }
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
      percent_stockout: evento.percent_stockout || 0,
      t_coz: evento.t_coz || 0,
      t_bar: evento.t_bar || 0,
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
        headers: { 'Content-Type': 'application/json', 'x-user-data': encodeURIComponent(JSON.stringify({ ...user, bar_id: selectedBar?.id })) },
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
        headers: { 'Content-Type': 'application/json', 'x-user-data': encodeURIComponent(JSON.stringify({ ...user, bar_id: selectedBar?.id })) },
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

  const meses = [
    { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
  ];

  const anos = [2025, 2026];

  const totaisAgregados = useMemo(() => {
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
    const totalEventosRealizados = eventosRealizados.length;
    const totalEventos = dados.length;
    
    // Total de clientes
    const totalClientes = eventosRealizados.reduce((sum, e) => sum + (e.clientes_real || 0), 0);
    
    // Ticket médio geral
    const ticketMedioGeral = totalClientes > 0 ? empilhamento / totalClientes : 0;
    
    // Custos totais
    const custoArtistico = eventosRealizados.reduce((sum, e) => sum + (e.c_art || 0), 0);
    const custoProducao = eventosRealizados.reduce((sum, e) => sum + (e.c_prod || 0), 0);
    const custoTotal = custoArtistico + custoProducao;
    
    // % Custo sobre faturamento
    const percentCustoFat = empilhamento > 0 ? (custoTotal / empilhamento) * 100 : 0;
    
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
      empilhamento, 
      metaM1, 
      gap, 
      gapPercent, 
      isPositive, 
      mediaTEPlan,
      totalEventos,
      totalEventosRealizados,
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
    <div className="min-h-[calc(100vh-8px)] bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-2 py-1 pb-6 max-w-[98vw]">
        {dados.length === 0 ? (
          <Card className="card-dark p-8">
            <div className="text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="card-title-dark mb-2">Nenhum evento encontrado</h3>
              <p className="card-description-dark">
                Não há eventos cadastrados para {meses.find(m => m.value === filtroMes)?.label} de {filtroAno}
              </p>
              <div className="mt-4 flex justify-center gap-4">
                 <Select value={filtroMes.toString()} onValueChange={(value) => alterarPeriodo(parseInt(value), filtroAno)}>
                    <SelectTrigger className="w-32 bg-white dark:bg-gray-700"><SelectValue /></SelectTrigger>
                    <SelectContent>{meses.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}</SelectContent>
                 </Select>
                 <Select value={filtroAno.toString()} onValueChange={(value) => alterarPeriodo(filtroMes, parseInt(value))}>
                    <SelectTrigger className="w-24 bg-white dark:bg-gray-700"><SelectValue /></SelectTrigger>
                    <SelectContent>{anos.map(a => <SelectItem key={a} value={a.toString()}>{a}</SelectItem>)}</SelectContent>
                 </Select>
              </div>
            </div>
          </Card>
        ) : (
          <>
            <div className="flex gap-4">
              <Card className="card-dark flex-1 hidden md:block">
                <CardContent className="p-0">
                  <div className="overflow-x-auto border-x border-gray-200 dark:border-gray-700">
                    <table className="w-full text-[11px] border-collapse">
                      <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                        <tr>
                          <th className="px-1 py-0.5 text-left text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase border-r border-gray-200 dark:border-gray-700">Data</th>
                          <th className="px-1 py-0.5 text-left text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase border-r border-gray-200 dark:border-gray-700">Dia</th>
                          <th className="px-1 py-0.5 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase border-r border-gray-200 dark:border-gray-700">Real</th>
                          <th className="px-1 py-0.5 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase border-r border-gray-200 dark:border-gray-700">M1</th>
                          <th className="px-1 py-0.5 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase border-r border-gray-200 dark:border-gray-700">Cl.P</th>
                          <th className="px-1 py-0.5 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase border-r border-gray-200 dark:border-gray-700">Cl.R</th>
                          <th className="px-1 py-0.5 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase border-r border-gray-200 dark:border-gray-700">R.Tot</th>
                          <th className="px-1 py-0.5 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase border-r border-gray-200 dark:border-gray-700">R.P</th>
                          <th className="px-1 py-0.5 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase border-r border-gray-200 dark:border-gray-700">Lot</th>
                          <th className="px-1 py-0.5 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase border-r border-gray-200 dark:border-gray-700">TE.P</th>
                          <th className="px-1 py-0.5 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase border-r border-gray-200 dark:border-gray-700">TE.R</th>
                          <th className="px-1 py-0.5 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase border-r border-gray-200 dark:border-gray-700">TB.P</th>
                          <th className="px-1 py-0.5 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase border-r border-gray-200 dark:border-gray-700">TB.R</th>
                          <th className="px-1 py-0.5 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase border-r border-gray-200 dark:border-gray-700">T.Med</th>
                          <th className="px-1 py-0.5 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase border-r border-gray-200 dark:border-gray-700">C.Art</th>
                          <th className="px-1 py-0.5 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase border-r border-gray-200 dark:border-gray-700">C.Prod</th>
                          <th className="px-1 py-0.5 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase border-r border-gray-200 dark:border-gray-700">%Art</th>
                          <th className="px-1 py-0.5 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase border-r border-gray-200 dark:border-gray-700">%B</th>
                          <th className="px-1 py-0.5 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase border-r border-gray-200 dark:border-gray-700">%D</th>
                          <th className="px-1 py-0.5 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase border-r border-gray-200 dark:border-gray-700">%C</th>
                          <th className="px-1 py-0.5 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase border-r border-gray-200 dark:border-gray-700">%S</th>
                          <th className="px-1 py-0.5 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase border-r border-gray-200 dark:border-gray-700">T.Coz</th>
                          <th className="px-1 py-0.5 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase border-r border-gray-200 dark:border-gray-700">T.Bar</th>
                          <th className="px-1 py-0.5 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {dados.map((evento) => (
                          <tr key={evento.evento_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="px-1 py-0.5 text-xs font-medium text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700">{evento.data_curta}</td>
                            <td className="px-1 py-0.5 text-xs text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">{evento.dia_semana?.substring(0, 3).toUpperCase()}</td>
                            <td className="px-1 py-0.5 text-right text-xs border-r border-gray-200 dark:border-gray-700"><span className={`font-medium ${evento.real_vs_m1_green ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{evento.real_receita > 0 ? formatarMoeda(evento.real_receita) : '-'}</span></td>
                            <td className="px-1 py-0.5 text-right text-xs text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">{evento.m1_receita > 0 ? formatarMoeda(evento.m1_receita) : '-'}</td>
                            <td className="px-1 py-0.5 text-right text-xs text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">{evento.clientes_plan || '-'}</td>
                            <td className="px-1 py-0.5 text-right text-xs border-r border-gray-200 dark:border-gray-700"><span className={`font-medium ${evento.ci_real_vs_plan_green ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{evento.clientes_real || '-'}</span></td>
                            <td className="px-1 py-0.5 text-right text-xs text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">{evento.res_tot || '-'}</td>
                            <td className="px-1 py-0.5 text-right text-xs text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">{evento.res_p || '-'}</td>
                            <td className="px-1 py-0.5 text-right text-xs text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">{evento.lot_max || '-'}</td>
                            <td className="px-1 py-0.5 text-right text-xs text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">{evento.te_plan > 0 ? formatarMoeda(evento.te_plan) : '-'}</td>
                            <td className="px-1 py-0.5 text-right text-xs border-r border-gray-200 dark:border-gray-700"><span className={`font-medium ${evento.te_real_vs_plan_green ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{evento.te_real > 0 ? formatarMoeda(evento.te_real) : '-'}</span></td>
                            <td className="px-1 py-0.5 text-right text-xs text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">{evento.tb_plan > 0 ? formatarMoeda(evento.tb_plan) : '-'}</td>
                            <td className="px-1 py-0.5 text-right text-xs border-r border-gray-200 dark:border-gray-700"><span className={`font-medium ${evento.tb_real_vs_plan_green ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{evento.tb_real > 0 ? formatarMoeda(evento.tb_real) : '-'}</span></td>
                            <td className="px-1 py-0.5 text-right text-xs border-r border-gray-200 dark:border-gray-700"><span className={`font-medium ${evento.t_medio_green ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{evento.t_medio > 0 ? formatarMoeda(evento.t_medio) : '-'}</span></td>
                            <td className="px-1 py-0.5 text-right text-xs text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">{evento.c_art > 0 ? formatarMoeda(evento.c_art) : '-'}</td>
                            <td className="px-1 py-0.5 text-right text-xs text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">{evento.c_prod > 0 ? formatarMoeda(evento.c_prod) : '-'}</td>
                            <td className="px-1 py-0.5 text-right text-xs border-r border-gray-200 dark:border-gray-700"><span className={`font-medium ${evento.percent_art_fat_green ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{evento.percent_art_fat > 0 ? formatarPercentual(evento.percent_art_fat) : '-'}</span></td>
                            <td className="px-1 py-0.5 text-right text-xs text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">{evento.percent_b > 0 ? formatarPercentual(evento.percent_b) : '-'}</td>
                            <td className="px-1 py-0.5 text-right text-xs text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">{evento.percent_d > 0 ? formatarPercentual(evento.percent_d) : '-'}</td>
                            <td className="px-1 py-0.5 text-right text-xs text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">{evento.percent_c > 0 ? formatarPercentual(evento.percent_c) : '-'}</td>
                            <td className="px-1 py-0.5 text-right text-xs border-r border-gray-200 dark:border-gray-700"><span className={`font-medium ${evento.percent_stockout <= 10 ? 'text-green-600 dark:text-green-400' : evento.percent_stockout <= 25 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>{evento.percent_stockout > 0 ? formatarPercentual(evento.percent_stockout) : '-'}</span></td>
                            <td className="px-1 py-0.5 text-right text-xs border-r border-gray-200 dark:border-gray-700"><span className={`font-medium ${evento.t_coz_green ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{evento.t_coz > 0 ? formatarTempo(evento.t_coz) : '-'}</span></td>
                            <td className="px-1 py-0.5 text-right text-xs border-r border-gray-200 dark:border-gray-700"><span className={`font-medium ${evento.t_bar_green ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{evento.t_bar > 0 ? formatarTempo(evento.t_bar) : '-'}</span></td>
                            <td className="px-1 py-0.5 text-center">
                              <div className="flex gap-1 justify-center">
                                <Button onClick={() => abrirModal(evento, false)} size="sm" variant="outline" className="h-7 w-7 p-0"><Eye className="h-3 w-3" /></Button>
                                <Button onClick={() => abrirModal(evento, true)} size="sm" variant="outline" className="h-7 w-7 p-0"><Edit className="h-3 w-3" /></Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Sidebar */}
              <div className="w-64 flex-shrink-0 hidden md:block">
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-4 sticky top-4">
                  <div className="space-y-3">
                    <div className="border-b border-gray-200 dark:border-gray-700 pb-3">
                      <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Filter className="h-4 w-4 text-blue-600" /> Controles
                      </h3>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">Período</label>
                      <div className="grid grid-cols-2 gap-2">
                        <Select value={filtroMes.toString()} onValueChange={(value) => alterarPeriodo(parseInt(value), filtroAno)}>
                          <SelectTrigger className="bg-white dark:bg-gray-700"><SelectValue /></SelectTrigger>
                          <SelectContent>{meses.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={filtroAno.toString()} onValueChange={(value) => alterarPeriodo(filtroMes, parseInt(value))}>
                          <SelectTrigger className="bg-white dark:bg-gray-700"><SelectValue /></SelectTrigger>
                          <SelectContent>{anos.map(a => <SelectItem key={a} value={a.toString()}>{a}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3"><TrendingUp className="h-4 w-4 text-purple-600" /> Estatísticas</h3>
                      <div className="space-y-3 text-xs">
                         <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                            <div className="flex justify-between mb-1"><span>Meta M1:</span> <span className="font-medium text-gray-900 dark:text-white">{formatarMoeda(totaisAgregados.metaM1)}</span></div>
                            <div className="flex justify-between mb-1"><span>Realizado:</span><span className={`font-medium ${totaisAgregados.empilhamento >= totaisAgregados.metaM1 ? 'text-green-600' : 'text-red-600'}`}>{formatarMoeda(totaisAgregados.empilhamento)}</span></div>
                            <div className="flex justify-between mb-1"><span>Atingido:</span><span className="font-medium text-blue-600 dark:text-blue-400">{totaisAgregados.metaM1 > 0 ? ((totaisAgregados.empilhamento / totaisAgregados.metaM1) * 100).toFixed(1) : '0.0'}%</span></div>
                            <div className="flex justify-between"><span>Falta faturar:</span><span className="font-medium text-orange-600">{formatarMoeda(Math.max(0, totaisAgregados.metaM1 - totaisAgregados.empilhamento))}</span></div>
                         </div>
                         <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-200 dark:border-blue-800">
                            <div className="flex justify-between items-center mb-1"><span className="text-blue-700 dark:text-blue-300 font-medium">Empilhamento M1:</span><span className="font-bold text-blue-800 dark:text-blue-200">{formatarMoeda(totaisAgregados.empilhamento)}</span></div>
                            <div className="flex justify-between items-center mt-1 pt-1 border-t border-blue-200 dark:border-blue-700"><span className="text-xs text-blue-600 dark:text-blue-400 font-medium">GAP:</span><span className={totaisAgregados.isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>{totaisAgregados.isPositive ? "+" : ""}{formatarMoeda(totaisAgregados.gap)} ({totaisAgregados.isPositive ? "+" : ""}{totaisAgregados.gapPercent.toFixed(1)}%)</span></div>
                         </div>
                         
                         <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                            <div className="flex justify-between mb-1"><span>Período:</span><span className="font-medium text-gray-900 dark:text-white">{meses.find(m => m.value === filtroMes)?.label} {filtroAno}</span></div>
                            <div className="flex justify-between"><span>Eventos:</span><span className="font-medium text-gray-900 dark:text-white">{totaisAgregados.totalEventosRealizados} / {totaisAgregados.totalEventos}</span></div>
                         </div>
                         
                         <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded border border-purple-200 dark:border-purple-800">
                            <div className="flex justify-between mb-1"><span className="text-purple-700 dark:text-purple-300">T.M Entrada:</span><span className="font-medium text-purple-800 dark:text-purple-200">{formatarMoeda(totaisAgregados.mediaTEReal)}</span></div>
                            <div className="flex justify-between mb-1"><span className="text-purple-700 dark:text-purple-300">T.M Entrada Real:</span><span className="font-medium text-green-600 dark:text-green-400">{formatarMoeda(totaisAgregados.mediaTEReal)}</span></div>
                         </div>
                         
                         <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded border border-purple-200 dark:border-purple-800">
                            <div className="flex justify-between mb-1"><span className="text-purple-700 dark:text-purple-300">T.M Bar:</span><span className="font-medium text-purple-800 dark:text-purple-200">{formatarMoeda(totaisAgregados.mediaTBReal)}</span></div>
                            <div className="flex justify-between mb-1"><span className="text-purple-700 dark:text-purple-300">T.M Bar Real:</span><span className="font-medium text-green-600 dark:text-green-400">{formatarMoeda(totaisAgregados.mediaTBReal)}</span></div>
                         </div>
                         
                         <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                            <div className="flex justify-between mb-1"><span>Meta T.Coz:</span><span className="font-medium text-gray-900 dark:text-white">12.0min</span></div>
                            <div className="flex justify-between mb-1"><span>T.Coz Real:</span><span className="font-medium text-green-600 dark:text-green-400">{(dados.filter(e => e.t_coz > 0).reduce((sum, e) => sum + e.t_coz, 0) / Math.max(1, dados.filter(e => e.t_coz > 0).length)).toFixed(1)}min</span></div>
                         </div>
                         
                         <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                            <div className="flex justify-between mb-1"><span>Meta T.Bar:</span><span className="font-medium text-gray-900 dark:text-white">4.0min</span></div>
                            <div className="flex justify-between mb-1"><span>T.Bar Real:</span><span className="font-medium text-red-600 dark:text-red-400">{(dados.filter(e => e.t_bar > 0).reduce((sum, e) => sum + e.t_bar, 0) / Math.max(1, dados.filter(e => e.t_bar > 0).length)).toFixed(1)}min</span></div>
                         </div>
                         
                         <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                            <div className="flex justify-between mb-1"><span>Meta Clientes:</span><span className="font-medium text-gray-900 dark:text-white">{dados.reduce((sum, e) => sum + (e.clientes_plan || 0), 0).toLocaleString()}</span></div>
                            <div className="flex justify-between"><span>Clientes Real:</span><span className="font-medium text-green-600 dark:text-green-400">{totaisAgregados.totalClientes.toLocaleString()}</span></div>
                         </div>
                         
                         <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                            <div className="flex justify-between mb-1"><span>Meta Reservas Presentes:</span><span className="font-medium text-gray-900 dark:text-white">{dados.reduce((sum, e) => sum + (e.res_tot || 0), 0).toLocaleString()}</span></div>
                            <div className="flex justify-between"><span>Reservas Presentes Real:</span><span className="font-medium text-green-600 dark:text-green-400">{dados.reduce((sum, e) => sum + (e.res_p || 0), 0).toLocaleString()}</span></div>
                         </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </>
        )}

        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogContent className="max-w-[70vw] max-h-[85vh] p-0 overflow-hidden rounded-lg shadow-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
              <DialogHeader className="bg-gray-50 dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700"><DialogTitle className="flex items-center gap-3 text-xl font-semibold text-gray-900 dark:text-white"><BarChart3 className="h-6 w-6 text-gray-600 dark:text-gray-400" />{modoEdicao ? 'Editar Evento' : 'Visualizar Evento'} - {eventoEdicao?.nome}</DialogTitle><DialogDescription>{modoEdicao ? 'Edite os dados planejados e reais' : 'Comparativo Planejado vs Realizado'}</DialogDescription></DialogHeader>
              <div className="flex-1 overflow-y-auto p-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                   <div className="space-y-3">
                      <div className="flex items-center gap-3 mb-2 pb-2 border-b"><div className="w-3 h-3 bg-blue-500 rounded-full"></div><h2 className="font-semibold">PLANEJADO</h2></div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded border"><Label>Receita M1</Label>{modoEdicao ? <Input type="number" value={eventoEdicao?.m1_r || 0} onChange={e => setEventoEdicao(p => p ? {...p, m1_r: parseFloat(e.target.value)} : null)} /> : <div className="p-2 bg-white dark:bg-gray-700 rounded border">{formatarMoeda(eventoEdicao?.m1_r)}</div>}</div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded border"><Label>Clientes</Label>{modoEdicao ? <Input type="number" value={eventoEdicao?.cl_plan || 0} onChange={e => setEventoEdicao(p => p ? {...p, cl_plan: parseInt(e.target.value)} : null)} /> : <div className="p-2 bg-white dark:bg-gray-700 rounded border">{(eventoEdicao?.cl_plan || 0).toLocaleString()}</div>}</div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded border"><Label>Ticket Entrada</Label>{modoEdicao ? <Input type="number" value={eventoEdicao?.te_plan || 0} onChange={e => setEventoEdicao(p => p ? {...p, te_plan: parseFloat(e.target.value)} : null)} /> : <div className="p-2 bg-white dark:bg-gray-700 rounded border">{formatarMoeda(eventoEdicao?.te_plan)}</div>}</div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded border"><Label>Ticket Bar</Label>{modoEdicao ? <Input type="number" value={eventoEdicao?.tb_plan || 0} onChange={e => setEventoEdicao(p => p ? {...p, tb_plan: parseFloat(e.target.value)} : null)} /> : <div className="p-2 bg-white dark:bg-gray-700 rounded border">{formatarMoeda(eventoEdicao?.tb_plan)}</div>}</div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded border"><Label>Custo Artístico</Label>{modoEdicao ? <Input type="number" value={eventoEdicao?.c_artistico_plan || 0} onChange={e => setEventoEdicao(p => p ? {...p, c_artistico_plan: parseFloat(e.target.value)} : null)} /> : <div className="p-2 bg-white dark:bg-gray-700 rounded border">{formatarMoeda(eventoEdicao?.c_artistico_plan)}</div>}</div>
                   </div>
                   <div className="space-y-3">
                      <div className="flex items-center gap-3 mb-2 pb-2 border-b"><div className="w-3 h-3 bg-green-500 rounded-full"></div><h2 className="font-semibold">REALIZADO</h2></div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded border"><Label>Receita Real</Label>{modoEdicao ? <Input type="number" value={eventoEdicao?.real_r || 0} onChange={e => setEventoEdicao(p => p ? {...p, real_r: parseFloat(e.target.value)} : null)} /> : <div className="p-2 bg-white dark:bg-gray-700 rounded border">{formatarMoeda(eventoEdicao?.real_r)}</div>}</div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded border"><Label>Clientes Real</Label>{modoEdicao ? <Input type="number" value={eventoEdicao?.cl_real || 0} onChange={e => setEventoEdicao(p => p ? {...p, cl_real: parseInt(e.target.value)} : null)} /> : <div className="p-2 bg-white dark:bg-gray-700 rounded border">{(eventoEdicao?.cl_real || 0).toLocaleString()}</div>}</div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded border"><Label>Reservas (Total / Pagas)</Label>{modoEdicao ? <div className="flex gap-2"><Input type="number" value={eventoEdicao?.res_tot || 0} onChange={e => setEventoEdicao(p => p ? {...p, res_tot: parseInt(e.target.value)} : null)} /><Input type="number" value={eventoEdicao?.res_p || 0} onChange={e => setEventoEdicao(p => p ? {...p, res_p: parseInt(e.target.value)} : null)} /></div> : <div className="p-2 bg-white dark:bg-gray-700 rounded border">{eventoEdicao?.res_tot} / {eventoEdicao?.res_p}</div>}</div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded border"><Label>Custo Artístico / Prod</Label>{modoEdicao ? <div className="flex gap-2"><Input type="number" value={eventoEdicao?.c_art || 0} onChange={e => setEventoEdicao(p => p ? {...p, c_art: parseFloat(e.target.value)} : null)} /><Input type="number" value={eventoEdicao?.c_prod || 0} onChange={e => setEventoEdicao(p => p ? {...p, c_prod: parseFloat(e.target.value)} : null)} /></div> : <div className="p-2 bg-white dark:bg-gray-700 rounded border">{formatarMoeda(eventoEdicao?.c_art)} / {formatarMoeda(eventoEdicao?.c_prod)}</div>}</div>
                      <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800"><h3 className="text-base font-medium mb-2 text-gray-900 dark:text-white flex items-center gap-2"><AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" /> Atrasos de Entrega</h3><div className="grid grid-cols-2 gap-4"><div><Label>Cozinha</Label><div className="mt-1 font-medium">{eventoEdicao?.atrasos_cozinha ?? 0}</div></div><div><Label>Bar</Label><div className="mt-1 font-medium">{eventoEdicao?.atrasos_bar ?? 0}</div></div></div></div>
                   </div>
                </div>
              </div>
              <DialogFooter className="bg-gray-50 dark:bg-gray-800 p-4 border-t"><Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>{modoEdicao && <Button onClick={salvarEdicao} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar Alterações'}</Button>}</DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
