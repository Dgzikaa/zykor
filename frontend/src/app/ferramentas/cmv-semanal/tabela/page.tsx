'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ChevronDown, 
  ChevronRight, 
  RefreshCcw, 
  Calendar,
  Eye,
  Pencil,
  Check,
  X,
  DollarSign,
  Users,
  Calculator,
  BarChart3,
  Table2,
  CloudDownload
} from 'lucide-react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Tipos
interface CMVSemanal {
  id: string;
  bar_id: number;
  ano: number;
  semana: number;
  data_inicio: string;
  data_fim: string;
  
  // Vendas
  vendas_brutas: number;
  vendas_liquidas: number;
  faturamento_cmvivel: number;
  
  // Estoque e Compras
  estoque_inicial: number;
  compras_periodo: number;
  estoque_final: number;
  
  // Consumos Internos
  consumo_socios: number;
  consumo_beneficios: number;
  consumo_adm: number;
  consumo_rh: number;
  consumo_artista: number;
  outros_ajustes: number;
  ajuste_bonificacoes: number;
  bonificacao_contrato_anual: number;
  bonificacao_cashback_mensal: number;
  
  // Cálculos CMV
  cmv_real: number;
  cmv_limpo_percentual: number;
  cmv_teorico_percentual: number;
  gap: number;
  
  // Estoque Final Detalhado
  estoque_final_cozinha: number;
  estoque_final_bebidas: number;
  estoque_final_drinks: number;
  
  // Estoque Inicial Detalhado
  estoque_inicial_cozinha: number;
  estoque_inicial_bebidas: number;
  estoque_inicial_drinks: number;
  
  // Compras Detalhadas
  compras_custo_comida: number;
  compras_custo_bebidas: number;
  compras_custo_drinks: number;
  compras_custo_outros: number;
  
  // Contas Especiais
  total_consumo_socios: number;
  mesa_beneficios_cliente: number;
  mesa_banda_dj: number;
  chegadeira: number;
  mesa_adm_casa: number;
  mesa_rh: number;
  
  status: string;
  responsavel?: string;
  observacoes?: string;
}

// Status das métricas
type MetricaStatus = 'auto' | 'manual' | 'calculado';

interface MetricaConfig {
  key: string;
  label: string;
  status: MetricaStatus;
  fonte: string;
  calculo: string;
  formato: 'moeda' | 'percentual' | 'numero' | 'decimal' | 'gap';
  drilldown?: boolean;
  editavel?: boolean;
  indentado?: boolean;
  sufixo?: string;
}

interface GrupoMetricas {
  id: string;
  label: string;
  metricas: MetricaConfig[];
  semCollapse?: boolean; // Se true, mostra métricas diretamente sem header de grupo
}

interface SecaoConfig {
  id: string;
  titulo: string;
  icone: React.ReactNode;
  cor: string;
  grupos: GrupoMetricas[];
}

// Cores por status
// auto e calculado = verde (dados verificados e confiáveis)
// manual = azul (bonificações inseridas manualmente)
const STATUS_COLORS = {
  auto: { dot: 'bg-green-500', text: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
  manual: { dot: 'bg-blue-500', text: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  calculado: { dot: 'bg-green-500', text: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' }
};

// Configuração das seções e métricas
const SECOES: SecaoConfig[] = [
  {
    id: 'vendas',
    titulo: 'VENDAS',
    icone: <DollarSign className="w-4 h-4" />,
    cor: 'bg-emerald-600',
    grupos: [
      {
        id: 'faturamento',
        label: 'Faturamento',
        semCollapse: true,
        metricas: [
          { key: 'vendas_brutas', label: 'Faturamento Bruto', status: 'auto', fonte: 'ContaHub', calculo: 'SUM(valor) excluindo Conta Assinada', formato: 'moeda', drilldown: true },
          { key: 'vendas_liquidas', label: 'Faturamento Limpo', status: 'calculado', fonte: 'ContaHub', calculo: 'SUM(liquido) excluindo Conta Assinada', formato: 'moeda', drilldown: true },
        ]
      }
    ]
  },
  {
    id: 'cmv',
    titulo: 'CÁLCULO CMV',
    icone: <Calculator className="w-4 h-4" />,
    cor: 'bg-blue-600',
    grupos: [
      {
        id: 'estoque_inicial',
        label: 'Estoque Inicial',
        metricas: [
          { key: 'estoque_inicial', label: 'TOTAL', status: 'calculado', fonte: 'Manual (Excel)', calculo: 'Cozinha + Drinks + Bebidas', formato: 'moeda' },
          { key: 'estoque_inicial_cozinha', label: 'Cozinha', status: 'manual', fonte: 'Manual (Excel)', calculo: 'Inserido manualmente', formato: 'moeda', editavel: true },
          { key: 'estoque_inicial_drinks', label: 'Drinks', status: 'manual', fonte: 'Manual (Excel)', calculo: 'Inserido manualmente', formato: 'moeda', editavel: true },
          { key: 'estoque_inicial_bebidas', label: 'Bebidas', status: 'manual', fonte: 'Manual (Excel)', calculo: 'Inserido manualmente', formato: 'moeda', editavel: true },
        ]
      },
      {
        id: 'compras',
        label: '(+) Compras',
        metricas: [
          { key: 'compras_periodo', label: 'TOTAL', status: 'calculado', fonte: 'NIBO', calculo: 'Cozinha + Drinks + Bebidas + Outros', formato: 'moeda', drilldown: true },
          { key: 'compras_custo_comida', label: 'Custo Cozinha', status: 'auto', fonte: 'NIBO', calculo: 'categoria_nome = CUSTO COMIDA', formato: 'moeda', drilldown: true },
          { key: 'compras_custo_drinks', label: 'Custo Drinks', status: 'auto', fonte: 'NIBO', calculo: 'categoria_nome = CUSTO DRINKS', formato: 'moeda', drilldown: true },
          { key: 'compras_custo_bebidas', label: 'Custo Bebidas', status: 'auto', fonte: 'NIBO', calculo: 'Custo Bebidas', formato: 'moeda', drilldown: true },
          { key: 'compras_custo_outros', label: 'Custo Outros', status: 'auto', fonte: 'NIBO', calculo: 'Materiais de limpeza/operação', formato: 'moeda', drilldown: true },
        ]
      },
      {
        id: 'estoque_final',
        label: '(-) Estoque Final',
        metricas: [
          { key: 'estoque_final', label: 'TOTAL', status: 'calculado', fonte: 'Manual (Excel)', calculo: 'Cozinha + Drinks + Bebidas', formato: 'moeda' },
          { key: 'estoque_final_cozinha', label: 'Cozinha', status: 'manual', fonte: 'Manual (Excel)', calculo: 'Inserido manualmente', formato: 'moeda', editavel: true },
          { key: 'estoque_final_drinks', label: 'Drinks', status: 'manual', fonte: 'Manual (Excel)', calculo: 'Inserido manualmente', formato: 'moeda', editavel: true },
          { key: 'estoque_final_bebidas', label: 'Bebidas', status: 'manual', fonte: 'Manual (Excel)', calculo: 'Inserido manualmente', formato: 'moeda', editavel: true },
        ]
      },
      {
        id: 'consumos',
        label: '(-) Consumações × 0.35',
        metricas: [
          { key: 'total_consumos', label: 'TOTAL (×0.35)', status: 'calculado', fonte: 'Calculado', calculo: 'Soma de todas as consumações × 0.35 (CMV)', formato: 'moeda' },
          { key: 'total_consumo_socios', label: 'Sócios (×0.35)', status: 'auto', fonte: 'ContaHub', calculo: 'motivo ILIKE %sócio% × 0.35', formato: 'moeda', drilldown: true },
          { key: 'mesa_adm_casa', label: 'Funcionários (×0.35)', status: 'auto', fonte: 'ContaHub', calculo: 'motivo ILIKE %adm% ou %casa% × 0.35', formato: 'moeda', drilldown: true },
          { key: 'mesa_beneficios_cliente', label: 'Clientes (×0.35)', status: 'auto', fonte: 'ContaHub', calculo: 'motivo ILIKE %benefício% × 0.35', formato: 'moeda', drilldown: true },
          { key: 'mesa_banda_dj', label: 'Artistas (×0.35)', status: 'auto', fonte: 'ContaHub', calculo: 'motivo ILIKE %banda% ou %dj% × 0.35', formato: 'moeda', drilldown: true },
        ]
      },
      {
        id: 'bonificacoes',
        label: '(-) Bonificações',
        metricas: [
          { key: 'ajuste_bonificacoes', label: 'TOTAL', status: 'manual', fonte: 'Manual', calculo: 'Contrato Anual + Cashback Mensal', formato: 'moeda' },
          { key: 'bonificacao_contrato_anual', label: 'Contrato Anual', status: 'manual', fonte: 'Manual', calculo: 'Valor inserido manualmente', formato: 'moeda', editavel: true },
          { key: 'bonificacao_cashback_mensal', label: 'Cashback Mensal', status: 'manual', fonte: 'Manual', calculo: 'Valor inserido manualmente', formato: 'moeda', editavel: true },
        ]
      }
    ]
  },
  {
    id: 'resultados',
    titulo: 'RESULTADOS',
    icone: <Users className="w-4 h-4" />,
    cor: 'bg-pink-600',
    grupos: [
      {
        id: 'cmv_resultado',
        label: 'CMV',
        semCollapse: true,
        metricas: [
          { key: 'cmv_real', label: 'CMV', status: 'calculado', fonte: 'Calculado', calculo: 'Est.Inicial + Compras - Est.Final - Consumos', formato: 'moeda' },
          { key: 'cmv_limpo_percentual', label: 'CMV Limpo (%)', status: 'calculado', fonte: 'Calculado', calculo: '(CMV / Fat. CMVível) × 100', formato: 'percentual' },
          { key: 'cmv_teorico_percentual', label: 'CMV Real (%)', status: 'calculado', fonte: 'Calculado', calculo: 'CMV Teórico/Meta', formato: 'percentual' },
        ]
      }
    ]
  }
];

// Formatadores
const formatarValor = (valor: number | null | undefined, formato: string, sufixo?: string): string => {
  if (valor === null || valor === undefined) return '-';
  
  switch (formato) {
    case 'moeda':
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(valor);
    case 'percentual':
      return `${valor.toFixed(2)}%`;
    case 'decimal':
      return (Math.round(valor * 100) / 100).toFixed(2).replace('.', ',') + (sufixo || '');
    case 'gap':
      const prefix = valor > 0 ? '+' : '';
      const color = valor < 0 ? 'text-yellow-600' : valor <= 5 ? 'text-green-600' : 'text-red-600';
      return `${prefix}${valor.toFixed(2)}%`;
    default:
      return new Intl.NumberFormat('pt-BR').format(valor) + (sufixo || '');
  }
};

const formatarDataCurta = (dataStr: string): string => {
  if (!dataStr) return '';
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}`;
};

// Calcular semana atual (ISO 8601 - mesmo cálculo do backend)
const getSemanaAtual = (): number => {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

// Calcular Giro de Estoque
const calcularGiroEstoque = (semana: CMVSemanal): number => {
  const mediaEstoque = ((semana.estoque_inicial || 0) + (semana.estoque_final || 0)) / 2;
  if (mediaEstoque === 0) return 0;
  return (semana.cmv_real || 0) / mediaEstoque;
};

export default function CMVSemanalTabelaPage() {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  
  const [semanas, setSemanas] = useState<CMVSemanal[]>([]);
  const [loading, setLoading] = useState(true);
  const [semanaAtualIdx, setSemanaAtualIdx] = useState<number>(-1);
  const [anoFiltro, setAnoFiltro] = useState<string>('todos');
  // Visão: 'semanal' ou 'mensal'
  const [visao, setVisao] = useState<'semanal' | 'mensal'>('semanal');
  const [secoesAbertas, setSecoesAbertas] = useState<Record<string, boolean>>({
    vendas: true,
    cmv: true,
    resultados: true
  });
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({
    // Vendas - expandido
    'vendas-faturamento': true,
    // CMV - grupos colapsados por padrão
    'cmv-estoque_inicial': false,
    'cmv-compras': false,
    'cmv-estoque_final': false,
    'cmv-consumos': false,
    'cmv-bonificacoes': false,
    // Resultados - expandido (mostra os 3 itens)
    'resultados-cmv_resultado': true,
  });
  const [editando, setEditando] = useState<{ semanaId: string; campo: string } | null>(null);
  const [valorEdit, setValorEdit] = useState('');
  const [sincronizandoNibo, setSincronizandoNibo] = useState(false);
  
  // Modal Drill-Down
  const [modalDrillDown, setModalDrillDown] = useState<{
    open: boolean;
    titulo: string;
    campo: string;
    semana: CMVSemanal | null;
    loading: boolean;
    dados: any[];
  }>({
    open: false,
    titulo: '',
    campo: '',
    semana: null,
    loading: false,
    dados: []
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const semanaAtualRef = useRef<HTMLDivElement>(null);

  // Nomes dos meses
  const NOMES_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  // Sincronizar dados do NIBO
  const sincronizarNibo = async () => {
    if (!selectedBar?.id) {
      toast({ title: 'Erro', description: 'Selecione um bar primeiro', variant: 'destructive' });
      return;
    }

    setSincronizandoNibo(true);

    try {
      // Chamar API de sincronização do NIBO
      const response = await fetch('/api/nibo/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bar_id: selectedBar.id,
          sync_mode: 'daily_complete' // Sincronização completa dos últimos 3 meses
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao sincronizar com NIBO');
      }

      const result = await response.json();

      toast({ 
        title: '✅ NIBO Sincronizado', 
        description: result.message || 'Dados do NIBO foram atualizados com sucesso'
      });

      // Recarregar dados após sincronização
      await carregarDados();

    } catch (error) {
      console.error('Erro ao sincronizar NIBO:', error);
      toast({ 
        title: 'Erro ao sincronizar NIBO', 
        description: error instanceof Error ? error.message : 'Falha na sincronização',
        variant: 'destructive' 
      });
    } finally {
      setSincronizandoNibo(false);
    }
  };

  // Carregar dados
  const carregarDados = useCallback(async () => {
    if (!selectedBar?.id) return;
    
    try {
      setLoading(true);
      
      if (visao === 'mensal') {
        // Carregar dados mensais - desde janeiro/2025 até o mês atual
        const anoAtual = new Date().getFullYear();
        const mesAtual = new Date().getMonth() + 1;
        
        // Gerar lista de meses desde janeiro/2025 até o mês atual
        const mesesParaCarregar: { mes: number; ano: number }[] = [];
        const anoInicio = 2025;
        const mesInicio = 1; // Janeiro
        
        for (let ano = anoInicio; ano <= anoAtual; ano++) {
          // Aplicar filtro de ano se selecionado
          if (anoFiltro !== 'todos' && ano !== parseInt(anoFiltro)) continue;
          
          const mesInicialDoAno = ano === anoInicio ? mesInicio : 1;
          const mesFinalDoAno = ano === anoAtual ? mesAtual : 12;
          
          for (let mes = mesInicialDoAno; mes <= mesFinalDoAno; mes++) {
            mesesParaCarregar.push({ mes, ano });
          }
        }
        
        // Carregar todos os meses em paralelo
        const promises = mesesParaCarregar.map(({ mes, ano }) =>
          fetch(`/api/cmv-semanal/mensal?mes=${mes}&ano=${ano}&bar_id=${selectedBar.id}`)
            .then(r => r.json())
            .then(data => ({ data, mes, ano }))
        );
        
        const resultados = await Promise.all(promises);
        
        // Ordenar do mais antigo para o mais recente
        const mesesData = resultados
          .map(({ data, mes, ano }) => ({
            id: `${ano}-${mes}`,
            bar_id: selectedBar.id,
            ano: ano,
            semana: mes, // Usamos semana para armazenar o mês (reaproveitar a estrutura)
            data_inicio: `${ano}-${String(mes).padStart(2, '0')}-01`,
            data_fim: `${ano}-${String(mes).padStart(2, '0')}-${new Date(ano, mes, 0).getDate()}`,
            ...(data.mes || {})
          } as CMVSemanal))
          .sort((a, b) => {
            if (a.ano !== b.ano) return a.ano - b.ano;
            return a.semana - b.semana;
          });
        
        setSemanas(mesesData);
        
        // Encontrar o índice do mês atual
        const idxMesAtual = mesesData.findIndex(m => m.ano === anoAtual && m.semana === mesAtual);
        setSemanaAtualIdx(idxMesAtual >= 0 ? idxMesAtual : mesesData.length - 1);
        
      } else {
        // Carregar dados semanais (lógica original)
        const response = await fetch(`/api/cmv-semanal?bar_id=${selectedBar.id}`);
        if (!response.ok) throw new Error('Erro ao carregar dados');
        
        const result = await response.json();
        const data = result.data || [];
        
        // Filtrar por ano e ordenar por ano/semana (crescente)
        const filtrado = data
          .filter((item: CMVSemanal) => anoFiltro === 'todos' || item.ano === parseInt(anoFiltro))
          .sort((a: CMVSemanal, b: CMVSemanal) => {
            if (a.ano !== b.ano) return a.ano - b.ano;
            return a.semana - b.semana;
          });
        
        setSemanas(filtrado);
        
        // Encontrar índice da semana atual
        const semanaAtual = getSemanaAtual();
        const anoAtual = new Date().getFullYear();
        const idx = filtrado.findIndex((s: CMVSemanal) => s.semana === semanaAtual && s.ano === anoAtual);
        setSemanaAtualIdx(idx >= 0 ? idx : filtrado.length - 1);
      }
      
    } catch (error) {
      console.error('Erro ao carregar CMV:', error);
      toast({ title: 'Erro', description: 'Falha ao carregar dados', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [anoFiltro, selectedBar?.id, visao]);

  useEffect(() => {
    if (selectedBar?.id) {
      carregarDados();
    }
  }, [carregarDados]);

  // Recarregar quando visão mudar
  useEffect(() => {
    if (selectedBar?.id) {
      carregarDados();
    }
  }, [visao]);

  // Scroll para semana atual
  useEffect(() => {
    if (!loading && scrollContainerRef.current && semanaAtualRef.current) {
      const container = scrollContainerRef.current;
      const element = semanaAtualRef.current;
      const containerWidth = container.offsetWidth;
      const elementLeft = element.offsetLeft;
      const elementWidth = element.offsetWidth;
      
      container.scrollLeft = elementLeft - (containerWidth * 0.6) + (elementWidth / 2);
    }
  }, [loading, semanaAtualIdx]);

  // Toggle seção
  const toggleSecao = (id: string) => {
    setSecoesAbertas(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Toggle grupo
  const toggleGrupo = useCallback((grupoId: string) => {
    setGruposAbertos(prev => ({ ...prev, [grupoId]: !prev[grupoId] }));
  }, []);

  // Abrir drill-down
  const abrirDrillDown = async (titulo: string, campo: string, semana: CMVSemanal) => {
    setModalDrillDown({
      open: true,
      titulo,
      campo,
      semana,
      loading: true,
      dados: []
    });

    try {
      const params = new URLSearchParams({
        bar_id: semana.bar_id.toString(),
        data_inicio: semana.data_inicio,
        data_fim: semana.data_fim,
        campo: campo
      });

      const response = await fetch(`/api/cmv-semanal/detalhes?${params}`);
      
      if (!response.ok) throw new Error('Erro ao buscar detalhes');

      const result = await response.json();
      
      const detalhesFormatados = result.detalhes.map((item: any) => ({
        label: item.descricao,
        valor: item.valor,
        data: item.data,
        detalhes: item.detalhes,
        categoria: item.categoria,
        tipo: item.tipo,
        sinal: item.sinal,
        quantidade: item.quantidade,
        unidade: item.unidade,
        custo_unitario: item.custo_unitario,
        fornecedor: item.fornecedor,
        documento: item.documento,
        status: item.status,
        motivo: item.motivo,
        local: item.local
      }));

      setModalDrillDown(prev => ({
        ...prev,
        loading: false,
        dados: detalhesFormatados
      }));
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
      setModalDrillDown(prev => ({
        ...prev,
        loading: false,
        dados: []
      }));
    }
  };

  // Salvar métrica editada
  const salvarMetrica = async (semanaId: string, campo: string) => {
    const numValue = parseFloat(valorEdit.replace(',', '.'));
    
    if (isNaN(numValue)) {
      setEditando(null);
      toast({ title: 'Erro', description: 'Valor inválido', variant: 'destructive' });
      return;
    }
    
    try {
      const response = await fetch('/api/cmv-semanal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: semanaId, [campo]: numValue })
      });

      if (!response.ok) throw new Error('Erro ao salvar');
      
      toast({ title: 'Salvo!', description: 'Valor atualizado' });
      setEditando(null);
      carregarDados();
    } catch (error) {
      toast({ title: 'Erro', description: 'Falha ao salvar', variant: 'destructive' });
    }
  };

  // Obter valor da métrica
  const getValorMetrica = (semana: CMVSemanal, key: string): number | null => {
    if (key === 'giro_estoque') {
      return calcularGiroEstoque(semana);
    }
    // Estoque Inicial = soma dos sub-itens
    if (key === 'estoque_inicial') {
      return (semana.estoque_inicial_cozinha || 0) + 
             (semana.estoque_inicial_drinks || 0) + 
             (semana.estoque_inicial_bebidas || 0);
    }
    // Estoque Final = soma dos sub-itens
    if (key === 'estoque_final') {
      return (semana.estoque_final_cozinha || 0) + 
             (semana.estoque_final_drinks || 0) + 
             (semana.estoque_final_bebidas || 0);
    }
    // Compras = soma dos sub-itens
    if (key === 'compras_periodo') {
      return (semana.compras_custo_comida || 0) + 
             (semana.compras_custo_drinks || 0) + 
             (semana.compras_custo_bebidas || 0) + 
             (semana.compras_custo_outros || 0);
    }
    // Consumações = soma dos sub-itens × 0.35 (CMV do consumo)
    // 4 categorias: Sócios, Funcionários, Clientes, Artistas
    if (key === 'total_consumos') {
      return ((semana.total_consumo_socios || 0) * 0.35) + 
             ((semana.mesa_adm_casa || 0) * 0.35) + 
             ((semana.mesa_beneficios_cliente || 0) * 0.35) + 
             ((semana.mesa_banda_dj || 0) * 0.35);
    }
    // Consumações individuais também × 0.35
    if (key === 'total_consumo_socios') {
      return (semana.total_consumo_socios || 0) * 0.35;
    }
    if (key === 'mesa_adm_casa') {
      return (semana.mesa_adm_casa || 0) * 0.35;
    }
    if (key === 'mesa_beneficios_cliente') {
      return (semana.mesa_beneficios_cliente || 0) * 0.35;
    }
    if (key === 'mesa_banda_dj') {
      return (semana.mesa_banda_dj || 0) * 0.35;
    }
    // Bonificações = soma dos sub-itens
    if (key === 'ajuste_bonificacoes') {
      return (semana.bonificacao_contrato_anual || 0) + 
             (semana.bonificacao_cashback_mensal || 0);
    }
    return (semana as any)[key] ?? null;
  };

  // Cor do gap
  const getGapColor = (valor: number): string => {
    if (valor < 0) return 'text-yellow-600 dark:text-yellow-400';
    if (valor <= 5) return 'text-green-600 dark:text-green-400';
    return 'text-red-600 dark:text-red-400';
  };

  // Gerar detalhes para tooltip do valor
  const getDetalhesTooltip = (semana: CMVSemanal, key: string): { label: string; valor: number; formula?: string }[] | null => {
    switch (key) {
      case 'estoque_inicial':
        return [
          { label: 'Cozinha', valor: semana.estoque_inicial_cozinha || 0 },
          { label: 'Drinks', valor: semana.estoque_inicial_drinks || 0 },
          { label: 'Bebidas', valor: semana.estoque_inicial_bebidas || 0 },
        ];
      case 'estoque_final':
        return [
          { label: 'Cozinha', valor: semana.estoque_final_cozinha || 0 },
          { label: 'Drinks', valor: semana.estoque_final_drinks || 0 },
          { label: 'Bebidas', valor: semana.estoque_final_bebidas || 0 },
        ];
      case 'compras_periodo':
        return [
          { label: 'Cozinha', valor: semana.compras_custo_comida || 0 },
          { label: 'Drinks', valor: semana.compras_custo_drinks || 0 },
          { label: 'Bebidas', valor: semana.compras_custo_bebidas || 0 },
          { label: 'Outros', valor: semana.compras_custo_outros || 0 },
        ];
      case 'total_consumos':
        // 4 categorias: Sócios, Funcionários, Clientes, Artistas
        return [
          { label: 'Sócios × 0.35', valor: (semana.total_consumo_socios || 0) * 0.35 },
          { label: 'Funcionários × 0.35', valor: (semana.mesa_adm_casa || 0) * 0.35 },
          { label: 'Clientes × 0.35', valor: (semana.mesa_beneficios_cliente || 0) * 0.35 },
          { label: 'Artistas × 0.35', valor: (semana.mesa_banda_dj || 0) * 0.35 },
        ];
      case 'ajuste_bonificacoes':
        return [
          { label: 'Contrato Anual', valor: semana.bonificacao_contrato_anual || 0 },
          { label: 'Cashback Mensal', valor: semana.bonificacao_cashback_mensal || 0 },
        ];
      // RESULTADOS - Tooltips com cálculos detalhados
      case 'cmv_real':
        const estoqueInicial = (semana.estoque_inicial_cozinha || 0) + (semana.estoque_inicial_drinks || 0) + (semana.estoque_inicial_bebidas || 0);
        const compras = (semana.compras_custo_comida || 0) + (semana.compras_custo_drinks || 0) + (semana.compras_custo_bebidas || 0) + (semana.compras_custo_outros || 0);
        const estoqueFinal = (semana.estoque_final_cozinha || 0) + (semana.estoque_final_drinks || 0) + (semana.estoque_final_bebidas || 0);
        // 4 categorias: Sócios, Funcionários, Clientes, Artistas
        const consumosTotal = ((semana.total_consumo_socios || 0) * 0.35) + ((semana.mesa_adm_casa || 0) * 0.35) + ((semana.mesa_beneficios_cliente || 0) * 0.35) + ((semana.mesa_banda_dj || 0) * 0.35);
        const bonificacoes = (semana.bonificacao_contrato_anual || 0) + (semana.bonificacao_cashback_mensal || 0);
        return [
          { label: 'Estoque Inicial', valor: estoqueInicial },
          { label: '(+) Compras', valor: compras },
          { label: '(-) Estoque Final', valor: -estoqueFinal },
          { label: '(-) Consumações × 0.35', valor: -consumosTotal },
          { label: '(-) Bonificações', valor: -bonificacoes },
        ];
      case 'cmv_limpo_percentual':
        const cmvReal = semana.cmv_real || 0;
        const fatCmvivel = semana.faturamento_cmvivel || 1;
        return [
          { label: 'CMV Real', valor: cmvReal },
          { label: '÷ Fat. CMVível', valor: fatCmvivel },
          { label: '× 100', valor: (cmvReal / fatCmvivel) * 100, formula: `(${formatarValor(cmvReal, 'moeda')} ÷ ${formatarValor(fatCmvivel, 'moeda')}) × 100` },
        ];
      case 'cmv_teorico_percentual':
        return [
          { label: 'Meta CMV', valor: semana.cmv_teorico_percentual || 0, formula: 'Valor teórico/meta definido' },
        ];
      default:
        return null;
    }
  };

  if (!selectedBar) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="bg-white dark:bg-gray-800 p-8 text-center max-w-md">
          <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Selecione um Bar
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Escolha um bar no seletor acima para visualizar o CMV semanal.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
      
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-full mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Toggle Semanal/Mensal */}
              <Tabs value={visao} onValueChange={(v) => setVisao(v as 'semanal' | 'mensal')}>
                <TabsList className="h-9">
                  <TabsTrigger value="semanal" className="text-xs px-3">
                    <Calendar className="w-3.5 h-3.5 mr-1.5" />
                    Semanal
                  </TabsTrigger>
                  <TabsTrigger value="mensal" className="text-xs px-3">
                    <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                    Mensal
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              
              {/* Filtro de Ano */}
              <div className="flex items-center gap-2">
                <Select value={anoFiltro} onValueChange={(v) => setAnoFiltro(v)}>
                  <SelectTrigger className="w-28 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2026">2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <Table2 className="w-5 h-5 text-gray-500" />
                <span className="font-semibold text-gray-900 dark:text-white">
                  {semanas.length} {visao === 'semanal' ? 'semanas' : 'meses'}
                </span>
                {visao === 'semanal' && (
                  <span className="text-sm text-gray-500">
                    (Semana atual: {getSemanaAtual()})
                  </span>
                )}
              </div>
            </div>
            
            {/* Ações */}
            <div className="flex items-center gap-3">
              {/* Legenda */}
              <div className="hidden md:flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  <span className="text-gray-600 dark:text-gray-400">Verificar</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-gray-600 dark:text-gray-400">Manual</span>
                </div>
              </div>
              
              <Link href="/ferramentas/cmv-semanal">
                <Button variant="outline" size="sm">
                  <Calendar className="w-4 h-4 mr-2" />
                  Listagem
                </Button>
              </Link>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={sincronizarNibo} 
                disabled={sincronizandoNibo || loading}
                className="border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                <CloudDownload className={cn("h-4 w-4 mr-2", sincronizandoNibo && "animate-pulse")} />
                {sincronizandoNibo ? 'Sincronizando...' : 'Atualizar NIBO'}
              </Button>
              
              <Button variant="outline" size="sm" onClick={carregarDados} disabled={loading}>
                <RefreshCcw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                Atualizar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo - Layout estilo Excel */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-auto smooth-scroll"
      >
        <div className="flex" style={{ minWidth: 'max-content' }}>
          
          {/* Coluna fixa - Labels */}
          <div className="sticky left-0 z-20 flex-shrink-0 w-[220px] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-md">
            {/* Header vazio */}
            <div className="h-[60px] border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex items-center justify-center sticky top-0 z-30">
              <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">INDICADOR</span>
            </div>
            
            {/* Labels das métricas */}
            {SECOES.map(secao => (
              <div key={secao.id} className="virtualized-section">
                {/* Header da seção */}
                <div 
                  className={cn("flex items-center gap-2 px-3 cursor-pointer", secao.cor)}
                  style={{ height: '36px' }}
                  onClick={() => toggleSecao(secao.id)}
                >
                  {secoesAbertas[secao.id] ? (
                    <ChevronDown className="w-4 h-4 text-white" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-white" />
                  )}
                  {secao.icone}
                  <span className="text-xs font-semibold text-white truncate">{secao.titulo}</span>
                </div>
                
                {/* Grupos */}
                {secoesAbertas[secao.id] && secao.grupos.map(grupo => {
                  const isGrupoAberto = gruposAbertos[`${secao.id}-${grupo.id}`] !== false;
                  const primeiraMetrica = grupo.metricas[0];
                  const metricasParaMostrar = grupo.semCollapse ? grupo.metricas : (isGrupoAberto ? grupo.metricas.slice(1) : []);
                  
                  return (
                  <div key={grupo.id}>
                    {/* Header do grupo - não mostrar se semCollapse */}
                    {!grupo.semCollapse && (
                      <div 
                        className="flex items-center gap-2 px-3 bg-gray-100 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                        style={{ height: '32px' }}
                        onClick={() => toggleGrupo(`${secao.id}-${grupo.id}`)}
                      >
                        {isGrupoAberto ? (
                          <ChevronDown className="w-3 h-3 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-gray-400" />
                        )}
                        <div className={cn("w-2 h-2 rounded-full flex-shrink-0", STATUS_COLORS[primeiraMetrica?.status || 'auto'].dot)} />
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300 truncate">{grupo.label}</span>
                        {!isGrupoAberto && (
                          <span className="text-[10px] text-gray-400">({grupo.metricas.length - 1} itens)</span>
                        )}
                      </div>
                    )}
                    
                    {/* Métricas */}
                    {metricasParaMostrar.map(metrica => (
                      <TooltipProvider key={metrica.key}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div 
                              className="flex items-center gap-2 px-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-help"
                              style={{ height: '30px' }}
                            >
                              <div className={cn("w-2 h-2 rounded-full flex-shrink-0", STATUS_COLORS[metrica.status].dot)} />
                              <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                {metrica.label}
                              </span>
                              {metrica.drilldown && (
                                <Eye className="w-3 h-3 text-blue-400 flex-shrink-0" />
                              )}
                              {metrica.editavel && (
                                <Pencil className="w-3 h-3 text-blue-400 flex-shrink-0" />
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right" className={cn("max-w-xs p-3", STATUS_COLORS[metrica.status].bg)}>
                            <div className="space-y-1">
                              <div className={cn("font-semibold text-sm", STATUS_COLORS[metrica.status].text)}>
                                {metrica.status === 'auto' && 'Automático (Verificar)'}
                                {metrica.status === 'manual' && 'Manual (Editável)'}
                                {metrica.status === 'calculado' && 'Calculado (Verificar)'}
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-300">
                                <strong>Fonte:</strong> {metrica.fonte}
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-300">
                                <strong>Cálculo:</strong> {metrica.calculo}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                )})}
              </div>
            ))}
          </div>

          {/* Área das Semanas */}
          <div className="flex-1">
            {loading ? (
              <div className="flex gap-0">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-[110px]">
                    <Skeleton className="h-[60px] rounded-none" />
                    {[...Array(25)].map((_, j) => (
                      <Skeleton key={j} className="h-[30px] rounded-none" />
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="inline-flex" style={{ minWidth: 'max-content' }}>
                {semanas.map((semana, idx) => {
                  const isAtual = idx === semanaAtualIdx;
                  const semanaAtualNum = getSemanaAtual();
                  const mesAtualNum = new Date().getMonth() + 1;
                  const anoAtualNum = new Date().getFullYear();
                  const isSemanaAtual = visao === 'mensal' 
                    ? (semana.semana === mesAtualNum && semana.ano === anoAtualNum)
                    : (semana.semana === semanaAtualNum && semana.ano === anoAtualNum);
                  
                  return (
                    <div 
                      key={semana.id}
                      ref={isAtual ? semanaAtualRef : undefined}
                      className={cn(
                        "flex-shrink-0 w-[110px] border-r border-gray-200 dark:border-gray-700",
                        isSemanaAtual && "bg-emerald-50 dark:bg-emerald-900/20"
                      )}
                    >
                      {/* Header da semana/mês */}
                      <div className={cn(
                        "h-[60px] border-b border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center px-1 sticky top-0 z-10",
                        isSemanaAtual ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-gray-50 dark:bg-gray-700"
                      )}>
                        {visao === 'mensal' ? (
                          <>
                            <span className={cn(
                              "text-sm font-bold",
                              isSemanaAtual ? "text-emerald-700 dark:text-emerald-400" : "text-gray-700 dark:text-gray-300"
                            )}>
                              {NOMES_MESES[semana.semana - 1]}/{semana.ano.toString().slice(-2)}
                            </span>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                              Mês {semana.semana}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className={cn(
                              "text-sm font-bold",
                              isSemanaAtual ? "text-emerald-700 dark:text-emerald-400" : "text-gray-700 dark:text-gray-300"
                            )}>
                              S{semana.semana.toString().padStart(2, '0')}/{semana.ano.toString().slice(-2)}
                            </span>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                              {formatarDataCurta(semana.data_inicio)} - {formatarDataCurta(semana.data_fim)}
                            </span>
                          </>
                        )}
                        {isSemanaAtual && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-emerald-600 text-white rounded-full mt-0.5">
                            ATUAL
                          </span>
                        )}
                      </div>
                      
                      {/* Valores por seção */}
                      {SECOES.map(secao => (
                        <div key={secao.id}>
                          {/* Espaço para header da seção */}
                          <div className={cn(secao.cor, "opacity-80")} style={{ height: '36px' }} />
                          
                          {/* Valores dos grupos */}
                          {secoesAbertas[secao.id] && secao.grupos.map(grupo => {
                            const isGrupoAberto = gruposAbertos[`${secao.id}-${grupo.id}`] !== false;
                            const primeiraMetrica = grupo.metricas[0];
                            const valorTotal = primeiraMetrica ? getValorMetrica(semana, primeiraMetrica.key) : null;
                            const metricasParaMostrar = grupo.semCollapse ? grupo.metricas : (isGrupoAberto ? grupo.metricas.slice(1) : []);
                            
                            return (
                            <div key={grupo.id}>
                              {/* Header do grupo com valor TOTAL - não mostrar se semCollapse */}
                              {!grupo.semCollapse && (() => {
                                const detalhesHeader = primeiraMetrica ? getDetalhesTooltip(semana, primeiraMetrica.key) : null;
                                const valorFormatadoHeader = formatarValor(valorTotal, primeiraMetrica?.formato || 'moeda', primeiraMetrica?.sufixo);
                                
                                return (
                                  <div 
                                    className={cn(
                                      "flex items-center justify-center border-b border-gray-200 dark:border-gray-600",
                                      isSemanaAtual ? "bg-emerald-50/50 dark:bg-emerald-900/10" : "bg-gray-100 dark:bg-gray-700/50"
                                    )}
                                    style={{ height: '32px' }}
                                  >
                                    {detalhesHeader && detalhesHeader.some(d => d.valor !== 0) ? (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span className={cn(
                                              "text-xs font-medium font-mono cursor-help underline decoration-dotted decoration-gray-400",
                                              primeiraMetrica?.formato === 'gap' && valorTotal !== null ? getGapColor(valorTotal) : "text-gray-700 dark:text-gray-300"
                                            )}>
                                              {valorFormatadoHeader}
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="p-2 bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                                            <div className="space-y-1">
                                              <div className="text-xs font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600 pb-1 mb-1">
                                                {grupo.label}
                                              </div>
                                              {detalhesHeader.filter(d => d.valor !== 0).map((d, i) => (
                                                <div key={i} className="flex justify-between gap-4 text-xs">
                                                  <span className="text-gray-600 dark:text-gray-400">{d.label}</span>
                                                  <span className="font-mono text-gray-900 dark:text-white">
                                                    {formatarValor(d.valor, 'moeda')}
                                                  </span>
                                                </div>
                                              ))}
                                              <div className="flex justify-between gap-4 text-xs font-semibold border-t border-gray-200 dark:border-gray-600 pt-1 mt-1">
                                                <span className="text-gray-700 dark:text-gray-300">Total</span>
                                                <span className="font-mono text-blue-600 dark:text-blue-400">
                                                  {valorFormatadoHeader}
                                                </span>
                                              </div>
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    ) : (
                                      <span className={cn(
                                        "text-xs font-medium font-mono",
                                        primeiraMetrica?.formato === 'gap' && valorTotal !== null ? getGapColor(valorTotal) : "text-gray-700 dark:text-gray-300"
                                      )}>
                                        {valorFormatadoHeader}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                              
                              {/* Valores das métricas */}
                              {metricasParaMostrar.map(metrica => {
                                const valor = getValorMetrica(semana, metrica.key);
                                const isEditandoCell = editando?.semanaId === semana.id && editando?.campo === metrica.key;
                                
                                return (
                                  <div 
                                    key={metrica.key}
                                    className={cn(
                                      "relative flex items-center justify-center px-1 border-b border-gray-100 dark:border-gray-700 group",
                                      isSemanaAtual ? "bg-emerald-50/30 dark:bg-emerald-900/10" : "",
                                      metrica.drilldown && visao === 'semanal' && "cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                    )}
                                    style={{ height: '30px' }}
                                    onClick={() => metrica.drilldown && visao === 'semanal' && abrirDrillDown(metrica.label, metrica.key, semana)}
                                  >
                                    {isEditandoCell ? (
                                      <div className="flex items-center gap-1">
                                        <Input
                                          type="text"
                                          value={valorEdit}
                                          onChange={(e) => setValorEdit(e.target.value)}
                                          className="w-16 h-6 text-xs p-1"
                                          autoFocus
                                          onClick={(e) => e.stopPropagation()}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') salvarMetrica(semana.id, metrica.key);
                                            if (e.key === 'Escape') setEditando(null);
                                          }}
                                        />
                                        <Button 
                                          size="icon" 
                                          variant="ghost" 
                                          className="h-5 w-5" 
                                          onClick={(e) => { e.stopPropagation(); salvarMetrica(semana.id, metrica.key); }}
                                        >
                                          <Check className="h-3 w-3 text-emerald-600" />
                                        </Button>
                                        <Button 
                                          size="icon" 
                                          variant="ghost" 
                                          className="h-5 w-5" 
                                          onClick={(e) => { e.stopPropagation(); setEditando(null); }}
                                        >
                                          <X className="h-3 w-3 text-red-600" />
                                        </Button>
                                      </div>
                                    ) : (() => {
                                      const detalhes = getDetalhesTooltip(semana, metrica.key);
                                      const valorFormatado = formatarValor(valor, metrica.formato, metrica.sufixo);
                                      
                                      // Tooltip com detalhes de composição (para totais)
                                      if (detalhes && detalhes.some(d => d.valor !== 0)) {
                                        return (
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <span className={cn(
                                                  "text-xs text-center font-mono cursor-help underline decoration-dotted decoration-gray-400",
                                                  metrica.formato === 'gap' && valor !== null ? getGapColor(valor) : "text-gray-700 dark:text-gray-300"
                                                )}>
                                                  {valorFormatado}
                                                </span>
                                              </TooltipTrigger>
                                              <TooltipContent side="top" className="p-2 bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                                                <div className="space-y-1">
                                                  <div className="text-xs font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600 pb-1 mb-1">
                                                    {metrica.label}
                                                  </div>
                                                  {detalhes.filter(d => d.valor !== 0).map((d, i) => (
                                                    <div key={i} className="flex justify-between gap-4 text-xs">
                                                      <span className="text-gray-600 dark:text-gray-400">{d.label}</span>
                                                      <span className="font-mono text-gray-900 dark:text-white">
                                                        {formatarValor(d.valor, 'moeda')}
                                                      </span>
                                                    </div>
                                                  ))}
                                                  <div className="flex justify-between gap-4 text-xs font-semibold border-t border-gray-200 dark:border-gray-600 pt-1 mt-1">
                                                    <span className="text-gray-700 dark:text-gray-300">Total</span>
                                                    <span className="font-mono text-blue-600 dark:text-blue-400">
                                                      {valorFormatado}
                                                    </span>
                                                  </div>
                                                  {metrica.drilldown && (
                                                    <div className="text-[10px] text-blue-500 text-center pt-1">
                                                      Clique para ver detalhes
                                                    </div>
                                                  )}
                                                </div>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        );
                                      }
                                      
                                      // Tooltip simples para métricas com drilldown
                                      if (metrica.drilldown) {
                                        return (
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <span className={cn(
                                                  "text-xs text-center font-mono cursor-pointer underline decoration-dotted decoration-gray-400",
                                                  metrica.formato === 'gap' && valor !== null ? getGapColor(valor) : "text-gray-700 dark:text-gray-300"
                                                )}>
                                                  {valorFormatado}
                                                </span>
                                              </TooltipTrigger>
                                              <TooltipContent side="top" className="p-2 bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                                                <div className="space-y-1">
                                                  <div className="text-xs font-semibold text-gray-900 dark:text-white">
                                                    {metrica.label}
                                                  </div>
                                                  <div className="text-xs text-gray-600 dark:text-gray-400">
                                                    <strong>Fonte:</strong> {metrica.fonte}
                                                  </div>
                                                  <div className="text-xs text-gray-600 dark:text-gray-400">
                                                    <strong>Cálculo:</strong> {metrica.calculo}
                                                  </div>
                                                  <div className="text-[10px] text-blue-500 text-center pt-1">
                                                    Clique para ver detalhes
                                                  </div>
                                                </div>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        );
                                      }
                                      
                                      // Tooltip para resultados (CMV, CMV Limpo %, CMV Teórico %)
                                      const detalhesResultado = getDetalhesTooltip(semana, metrica.key);
                                      if (detalhesResultado && ['cmv_real', 'cmv_limpo_percentual', 'cmv_teorico_percentual'].includes(metrica.key)) {
                                        return (
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <span className={cn(
                                                  "text-xs text-center font-mono cursor-help underline decoration-dotted decoration-gray-400",
                                                  metrica.formato === 'percentual' && valor !== null && valor > 40 ? "text-red-600 dark:text-red-400" :
                                                  metrica.formato === 'percentual' && valor !== null && valor <= 33 ? "text-green-600 dark:text-green-400" :
                                                  "text-gray-700 dark:text-gray-300"
                                                )}>
                                                  {valorFormatado}
                                                </span>
                                              </TooltipTrigger>
                                              <TooltipContent side="top" className="p-3 bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-w-xs">
                                                <div className="space-y-2">
                                                  <div className="text-xs font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600 pb-1 mb-2">
                                                    📊 {metrica.label}
                                                  </div>
                                                  <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-2">
                                                    <strong>Fórmula:</strong> {metrica.calculo}
                                                  </div>
                                                  {detalhesResultado.map((d, i) => (
                                                    <div key={i} className="flex justify-between gap-4 text-xs">
                                                      <span className={cn(
                                                        "text-gray-600 dark:text-gray-400",
                                                        d.valor < 0 && "text-red-500"
                                                      )}>{d.label}</span>
                                                      <span className="font-mono text-gray-900 dark:text-white">
                                                        {metrica.key === 'cmv_limpo_percentual' && d.label.includes('×') 
                                                          ? `${d.valor.toFixed(2)}%`
                                                          : formatarValor(Math.abs(d.valor), metrica.key === 'cmv_teorico_percentual' ? 'percentual' : 'moeda')}
                                                      </span>
                                                    </div>
                                                  ))}
                                                  <div className="flex justify-between gap-4 text-xs font-bold border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                                                    <span className="text-gray-700 dark:text-gray-300">= Resultado</span>
                                                    <span className={cn(
                                                      "font-mono",
                                                      metrica.formato === 'percentual' && valor !== null && valor > 40 ? "text-red-600" :
                                                      metrica.formato === 'percentual' && valor !== null && valor <= 33 ? "text-green-600" :
                                                      "text-blue-600 dark:text-blue-400"
                                                    )}>
                                                      {valorFormatado}
                                                    </span>
                                                  </div>
                                                </div>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        );
                                      }
                                      
                                      return (
                                        <span className={cn(
                                          "text-xs text-center font-mono",
                                          metrica.formato === 'gap' && valor !== null ? getGapColor(valor) : "text-gray-700 dark:text-gray-300"
                                        )}>
                                          {valorFormatado}
                                        </span>
                                      );
                                    })()}
                                    
                                    {/* Botão editar - apenas no modo semanal */}
                                    {!isEditandoCell && metrica.editavel && visao === 'semanal' && (
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="absolute right-0 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditando({ semanaId: semana.id, campo: metrica.key });
                                          setValorEdit(valor?.toString().replace('.', ',') || '');
                                        }}
                                      >
                                        <Pencil className="h-3 w-3 text-blue-600" />
                                      </Button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )})}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Drill-Down */}
      <Dialog open={modalDrillDown.open} onOpenChange={(open) => setModalDrillDown({ ...modalDrillDown, open })}>
        <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">
              Detalhamento: {modalDrillDown.titulo}
            </DialogTitle>
            {modalDrillDown.semana && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Semana {modalDrillDown.semana.semana} ({formatarDataCurta(modalDrillDown.semana.data_inicio)} - {formatarDataCurta(modalDrillDown.semana.data_fim)})
              </p>
            )}
          </DialogHeader>
          
          <div className="mt-4">
            {modalDrillDown.loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-400">Carregando detalhes...</span>
              </div>
            ) : modalDrillDown.dados.length > 0 ? (
              <div className="space-y-2">
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-900 dark:text-blue-200">
                    <strong>{modalDrillDown.dados.length}</strong> {modalDrillDown.dados.length === 1 ? 'registro encontrado' : 'registros encontrados'}
                  </p>
                </div>

                <div className="max-h-[400px] overflow-y-auto space-y-2">
                  {modalDrillDown.dados.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {item.label}
                            </span>
                          </div>
                          
                          <div className="space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
                            {item.data && (
                              <p><strong>Data:</strong> {formatarDataCurta(item.data)}</p>
                            )}
                            {item.categoria && (
                              <p><strong>Categoria:</strong> {item.categoria}</p>
                            )}
                            {item.fornecedor && (
                              <p><strong>Fornecedor:</strong> {item.fornecedor}</p>
                            )}
                            {item.motivo && (
                              <p><strong>Motivo:</strong> {item.motivo}</p>
                            )}
                            {item.quantidade && (
                              <p>
                                <strong>Qtd:</strong> {item.quantidade.toFixed(2)} {item.unidade || 'un'}
                                {item.custo_unitario && ` × ${formatarValor(item.custo_unitario, 'moeda')}`}
                              </p>
                            )}
                            {item.detalhes && (
                              <p className="text-gray-500 italic">{item.detalhes}</p>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-base font-mono font-bold text-gray-900 dark:text-white">
                            {formatarValor(Math.abs(item.valor), 'moeda')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/20 rounded-lg border-2 border-blue-500 mt-4">
                  <span className="text-lg font-bold text-blue-900 dark:text-blue-200">TOTAL</span>
                  <span className="text-lg font-mono font-bold text-blue-900 dark:text-blue-200">
                    {formatarValor(modalDrillDown.dados.reduce((sum, item) => sum + (item.valor || 0), 0), 'moeda')}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Eye className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <p className="font-semibold mb-2">Nenhum registro encontrado</p>
                <p className="text-sm">Não há dados disponíveis para este item no período selecionado.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
