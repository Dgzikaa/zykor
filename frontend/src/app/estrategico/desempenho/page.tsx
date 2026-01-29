'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Users,
  Star,
  ShoppingCart,
  Megaphone,
  BarChart3,
  Calendar,
  RefreshCcw,
  ChevronDown,
  ChevronUp,
  Pencil,
  Check,
  X,
  Layers,
  LayoutGrid,
  Info
} from 'lucide-react';
import { useBar } from '@/contexts/BarContext';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// Tipos
interface DadosSemana {
  id?: number;
  numero_semana: number;
  ano: number;
  data_inicio: string;
  data_fim: string;
  // Indicadores Estratégicos - GUARDRAIL
  faturamento_total: number;
  faturamento_entrada: number;
  faturamento_bar: number;
  faturamento_cmovivel: number;
  cmv_rs: number;
  ticket_medio: number;
  tm_entrada: number;
  tm_bar: number;
  cmv_limpo: number;
  cmv_global_real: number;
  cmv_teorico: number;
  cmo: number;
  custo_atracao_faturamento: number;
  // Indicadores Estratégicos - OVT
  retencao_1m: number;
  retencao_2m: number;
  perc_clientes_novos: number;
  clientes_atendidos: number;
  clientes_ativos: number;
  reservas_totais: number;
  reservas_presentes: number;
  // Indicadores de Qualidade
  avaliacoes_5_google_trip: number;
  media_avaliacoes_google: number;
  nps_reservas: number;
  nota_felicidade_equipe: number;
  // Cockpit Produtos
  stockout_comidas: number;
  stockout_drinks: number;
  stockout_bar: number;
  stockout_comidas_perc?: number;
  stockout_drinks_perc?: number;
  stockout_bar_perc?: number;
  perc_bebidas: number;
  perc_drinks: number;
  perc_comida: number;
  perc_happy_hour: number;
  qtde_itens_bar: number;
  atrasos_bar: number;
  atrasos_bar_perc?: number;
  tempo_saida_bar: number;
  qtde_itens_cozinha: number;
  atrasos_cozinha: number;
  atrasos_cozinha_perc?: number;
  tempo_saida_cozinha: number;
  // Cockpit Vendas
  perc_faturamento_ate_19h: number;
  perc_faturamento_apos_22h?: number;
  qui_sab_dom: number;
  // Cockpit Marketing - Orgânico
  o_num_posts: number;
  o_alcance: number;
  o_interacao: number;
  o_compartilhamento: number;
  o_engajamento: number;
  o_num_stories: number;
  o_visu_stories: number;
  // Cockpit Marketing - Meta
  m_valor_investido: number;
  m_alcance: number;
  m_frequencia: number;
  m_cpm: number;
  m_cliques: number;
  m_ctr: number;
  m_custo_por_clique: number;
  m_conversas_iniciadas: number;
}

interface SemanaResult {
  semana: number;
  ano: number;
  dados: DadosSemana | null;
}

// Status das métricas: auto (verde), manual (azul), nao_confiavel (amarelo)
type MetricaStatus = 'auto' | 'manual' | 'nao_confiavel';

interface MetricaInfo {
  status: MetricaStatus;
  fonte: string;
  calculo: string;
}

// Mapeamento de cada métrica com status, fonte e cálculo
const METRICAS_INFO: Record<string, MetricaInfo> = {
  // GUARDRAIL
  faturamento_total: {
    status: 'auto',
    fonte: 'ContaHub + Yuzer + Sympla',
    calculo: 'Soma de todos os pagamentos (exceto "Conta Assinada")'
  },
  faturamento_entrada: {
    status: 'auto',
    fonte: 'ContaHub (contahub_periodo)',
    calculo: 'Soma do campo vr_couvert de todos os períodos'
  },
  faturamento_bar: {
    status: 'auto',
    fonte: 'Calculado',
    calculo: 'Faturamento Total - Faturamento Couvert'
  },
  faturamento_cmovivel: {
    status: 'auto',
    fonte: 'Calculado',
    calculo: 'Faturamento Bar - Repique'
  },
  cmv_rs: {
    status: 'manual',
    fonte: 'Planilha manual',
    calculo: 'CMV em reais inserido manualmente via planilha de estoque'
  },
  ticket_medio: {
    status: 'auto',
    fonte: 'ContaHub (contahub_periodo)',
    calculo: 'vr_pagamentos / pessoas (onde vr_pagamentos > 0)'
  },
  tm_entrada: {
    status: 'auto',
    fonte: 'ContaHub',
    calculo: 'Ticket médio de entrada (couvert/pessoa)'
  },
  tm_bar: {
    status: 'auto',
    fonte: 'ContaHub',
    calculo: 'Ticket médio do bar (consumo/pessoa)'
  },
  cmv_limpo: {
    status: 'auto',
    fonte: 'Calculado',
    calculo: '(CMV R$ / Faturamento CMvível) × 100'
  },
  cmv_global_real: {
    status: 'auto',
    fonte: 'Calculado',
    calculo: '(CMV R$ / Faturamento Total) × 100'
  },
  cmv_teorico: {
    status: 'nao_confiavel',
    fonte: 'Calculado',
    calculo: 'CMV teórico baseado em fichas técnicas (pode estar desatualizado)'
  },
  cmo: {
    status: 'auto',
    fonte: 'NIBO (nibo_agendamentos)',
    calculo: 'Soma das categorias: SALÁRIO FUNCIONÁRIOS, FREELA, ALIMENTAÇÃO, etc.'
  },
  custo_atracao_faturamento: {
    status: 'auto',
    fonte: 'NIBO (nibo_agendamentos)',
    calculo: '(Custos ATRAÇÕES + PRODUÇÃO EVENTOS) / Faturamento Total × 100'
  },
  // OVT
  retencao_1m: {
    status: 'auto',
    fonte: 'ContaHub (contahub_periodo)',
    calculo: 'Clientes que visitaram há ~30 dias e retornaram esta semana'
  },
  retencao_2m: {
    status: 'auto',
    fonte: 'ContaHub (contahub_periodo)',
    calculo: 'Clientes que visitaram há ~60 dias e retornaram esta semana'
  },
  perc_clientes_novos: {
    status: 'auto',
    fonte: 'Stored Procedure',
    calculo: 'calcular_metricas_clientes: (novos / total) × 100'
  },
  clientes_atendidos: {
    status: 'auto',
    fonte: 'ContaHub + Yuzer + Sympla',
    calculo: 'Soma de pessoas ContaHub + ingressos Yuzer + check-ins Sympla'
  },
  clientes_ativos: {
    status: 'auto',
    fonte: 'Stored Procedure',
    calculo: 'get_count_base_ativa: clientes com 2+ visitas em 90 dias'
  },
  reservas_totais: {
    status: 'manual',
    fonte: 'GetIn ou manual',
    calculo: 'Total de reservas da semana'
  },
  reservas_presentes: {
    status: 'manual',
    fonte: 'GetIn ou manual',
    calculo: 'Reservas com status "seated" ou confirmadas'
  },
  avaliacoes_5_google_trip: {
    status: 'nao_confiavel',
    fonte: 'Windsor (windsor_google)',
    calculo: 'Contagem de review_star_rating = "FIVE" (verificar filtro bar_id)'
  },
  media_avaliacoes_google: {
    status: 'nao_confiavel',
    fonte: 'Windsor (windsor_google)',
    calculo: 'Média de review_average_rating (verificar sincronização)'
  },
  nps_reservas: {
    status: 'auto',
    fonte: 'NPS Reservas (nps_reservas)',
    calculo: 'Média das notas de NPS das reservas'
  },
  nota_felicidade_equipe: {
    status: 'manual',
    fonte: 'Pesquisa interna',
    calculo: 'Nota de satisfação da equipe (manual)'
  },
  // Cockpit Produtos
  stockout_comidas: {
    status: 'auto',
    fonte: 'ContaHub (contahub_stockout)',
    calculo: 'Produtos de cozinha com estoque ≤ 0 e prd_venda = "S"'
  },
  stockout_drinks: {
    status: 'auto',
    fonte: 'ContaHub (contahub_stockout)',
    calculo: 'Produtos de bar/drinks com estoque ≤ 0 e prd_venda = "S"'
  },
  stockout_bar: {
    status: 'auto',
    fonte: 'ContaHub (contahub_stockout)',
    calculo: 'Produtos de bar com estoque ≤ 0 e prd_venda = "S"'
  },
  perc_bebidas: {
    status: 'auto',
    fonte: 'eventos_base',
    calculo: 'Média de percent_b dos eventos da semana'
  },
  perc_drinks: {
    status: 'auto',
    fonte: 'eventos_base',
    calculo: 'Média de percent_d dos eventos da semana'
  },
  perc_comida: {
    status: 'auto',
    fonte: 'eventos_base',
    calculo: 'Média de percent_c dos eventos da semana'
  },
  perc_happy_hour: {
    status: 'auto',
    fonte: 'eventos_base',
    calculo: '% do faturamento até 19h (Happy Hour)'
  },
  qtde_itens_bar: {
    status: 'auto',
    fonte: 'ContaHub (contahub_analitico)',
    calculo: 'Soma de qtd para grupos de bar'
  },
  qtde_itens_cozinha: {
    status: 'auto',
    fonte: 'ContaHub (contahub_analitico)',
    calculo: 'Soma de qtd para grupos de cozinha'
  },
  tempo_saida_bar: {
    status: 'nao_confiavel',
    fonte: 'ContaHub (contahub_tempo)',
    calculo: 'Média de t0_t2 para itens de bar (verificar se está em minutos)'
  },
  tempo_saida_cozinha: {
    status: 'nao_confiavel',
    fonte: 'ContaHub (contahub_tempo)',
    calculo: 'Média de t0_t2 para itens de cozinha (verificar se está em minutos)'
  },
  atrasos_bar: {
    status: 'nao_confiavel',
    fonte: 'ContaHub (contahub_tempo)',
    calculo: 'Itens de bar com t0_t2 > 4 minutos (verificar threshold)'
  },
  atrasos_cozinha: {
    status: 'nao_confiavel',
    fonte: 'ContaHub (contahub_tempo)',
    calculo: 'Itens de cozinha com t0_t2 > 12 minutos (verificar threshold)'
  },
  // Vendas
  perc_faturamento_ate_19h: {
    status: 'auto',
    fonte: 'eventos_base',
    calculo: 'Média de fat_19h_percent dos eventos da semana'
  },
  perc_faturamento_apos_22h: {
    status: 'auto',
    fonte: 'contahub_periodo',
    calculo: '% do faturamento após 22h'
  },
  qui_sab_dom: {
    status: 'auto',
    fonte: 'eventos_base',
    calculo: 'Soma do faturamento de QUI+SÁB+DOM'
  },
  // Marketing
  o_num_posts: { status: 'manual', fonte: 'Marketing', calculo: 'Número de posts orgânicos' },
  o_alcance: { status: 'manual', fonte: 'Marketing', calculo: 'Alcance orgânico' },
  o_interacao: { status: 'manual', fonte: 'Marketing', calculo: 'Interações orgânicas' },
  o_compartilhamento: { status: 'manual', fonte: 'Marketing', calculo: 'Compartilhamentos orgânicos' },
  o_engajamento: { status: 'manual', fonte: 'Marketing', calculo: 'Taxa de engajamento' },
  o_num_stories: { status: 'manual', fonte: 'Marketing', calculo: 'Número de stories' },
  o_visu_stories: { status: 'manual', fonte: 'Marketing', calculo: 'Visualizações de stories' },
  m_valor_investido: { status: 'manual', fonte: 'Meta Ads', calculo: 'Valor investido em ads' },
  m_alcance: { status: 'manual', fonte: 'Meta Ads', calculo: 'Alcance pago' },
  m_frequencia: { status: 'manual', fonte: 'Meta Ads', calculo: 'Frequência média' },
  m_cpm: { status: 'manual', fonte: 'Meta Ads', calculo: 'Custo por mil impressões' },
  m_cliques: { status: 'manual', fonte: 'Meta Ads', calculo: 'Cliques no anúncio' },
  m_ctr: { status: 'manual', fonte: 'Meta Ads', calculo: 'Click-through rate' },
  m_custo_por_clique: { status: 'manual', fonte: 'Meta Ads', calculo: 'Custo por clique' },
  m_conversas_iniciadas: { status: 'manual', fonte: 'Meta Ads', calculo: 'Conversas iniciadas via ads' },
};

// Cores por status
const STATUS_COLORS = {
  auto: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    border: 'border-emerald-300 dark:border-emerald-700',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500'
  },
  manual: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    border: 'border-blue-300 dark:border-blue-700',
    text: 'text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500'
  },
  nao_confiavel: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    border: 'border-amber-300 dark:border-amber-700',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500'
  }
};

// Componente de Indicador Individual com Tooltip e Edição
interface IndicadorProps {
  label: string;
  metricaKey: string;
  valor: number | null;
  valorAnterior?: number | null;
  formato?: 'moeda' | 'percentual' | 'numero' | 'decimal' | 'reservas';
  inverso?: boolean;
  sufixo?: string;
  reservasTotais?: number;
  editavel?: boolean;
  onSave?: (valor: number) => void;
  semanaId?: number;
}

function Indicador({ 
  label, 
  metricaKey,
  valor, 
  valorAnterior, 
  formato = 'numero', 
  inverso = false, 
  sufixo = '',
  reservasTotais,
  editavel = false,
  onSave,
  semanaId
}: IndicadorProps) {
  const [editando, setEditando] = useState(false);
  const [valorEdit, setValorEdit] = useState('');
  const [salvando, setSalvando] = useState(false);

  const info = METRICAS_INFO[metricaKey] || { status: 'auto', fonte: 'Desconhecido', calculo: 'Cálculo não documentado' };
  const statusColors = STATUS_COLORS[info.status];

  const formatarValor = (v: number | null) => {
    if (v === null || v === undefined) return '-';
    
    switch (formato) {
      case 'moeda':
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
      case 'percentual':
        return `${v.toFixed(1)}%`;
      case 'decimal':
        return v.toFixed(2) + sufixo;
      case 'reservas':
        return `${v}/${reservasTotais || 0}`;
      default:
        return v.toLocaleString('pt-BR') + sufixo;
    }
  };

  const variacao = valorAnterior && valor ? ((valor - valorAnterior) / valorAnterior) * 100 : null;
  const temVariacao = variacao !== null && !isNaN(variacao) && isFinite(variacao);
  const variacaoPositiva = inverso ? (variacao && variacao < 0) : (variacao && variacao > 0);
  const variacaoNegativa = inverso ? (variacao && variacao > 0) : (variacao && variacao < 0);

  const handleSave = async () => {
    if (!onSave) return;
    const numValue = parseFloat(valorEdit.replace(',', '.'));
    if (isNaN(numValue)) return;
    
    setSalvando(true);
    try {
      await onSave(numValue);
      setEditando(false);
    } finally {
      setSalvando(false);
    }
  };

  const iniciarEdicao = () => {
    setValorEdit(valor?.toString().replace('.', ',') || '');
    setEditando(true);
  };

  return (
    <TooltipProvider>
      <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn("w-2 h-2 rounded-full cursor-help", statusColors.dot)} />
            </TooltipTrigger>
            <TooltipContent side="right" className={cn("max-w-xs p-3", statusColors.bg, statusColors.border, "border")}>
              <div className="space-y-1.5">
                <div className={cn("font-semibold text-sm", statusColors.text)}>
                  {info.status === 'auto' && 'Automático'}
                  {info.status === 'manual' && 'Manual'}
                  {info.status === 'nao_confiavel' && 'Não Confiável'}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300">
                  <strong>Fonte:</strong> {info.fonte}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300">
                  <strong>Cálculo:</strong> {info.calculo}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
          <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
        </div>
        
        <div className="flex items-center gap-2">
          {editando ? (
            <div className="flex items-center gap-1">
              <Input
                type="text"
                value={valorEdit}
                onChange={(e) => setValorEdit(e.target.value)}
                className="w-24 h-7 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') setEditando(false);
                }}
              />
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSave} disabled={salvando}>
                <Check className="h-3 w-3 text-emerald-600" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditando(false)}>
                <X className="h-3 w-3 text-red-600" />
              </Button>
            </div>
          ) : (
            <>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {formatarValor(valor)}
              </span>
              {temVariacao && (
                <div className={cn(
                  "flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded",
                  variacaoPositiva && "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30",
                  variacaoNegativa && "text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/30",
                  !variacaoPositiva && !variacaoNegativa && "text-gray-500 bg-gray-100 dark:text-gray-400 dark:bg-gray-800"
                )}>
                  {variacaoPositiva && <TrendingUp className="w-3 h-3" />}
                  {variacaoNegativa && <TrendingDown className="w-3 h-3" />}
                  {!variacaoPositiva && !variacaoNegativa && <Minus className="w-3 h-3" />}
                  <span>{Math.abs(variacao!).toFixed(1)}%</span>
                </div>
              )}
              {editavel && info.status === 'manual' && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={iniciarEdicao}
                >
                  <Pencil className="h-3 w-3 text-blue-600" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

// Componente de Seção Colapsável
interface SecaoProps {
  titulo: string;
  icone: React.ReactNode;
  corGradiente: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Secao({ titulo, icone, corGradiente, children, defaultOpen = true }: SecaoProps) {
  const [aberto, setAberto] = useState(defaultOpen);

  return (
    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <CardHeader 
        className={cn("py-3 px-4 cursor-pointer", corGradiente)}
        onClick={() => setAberto(!aberto)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icone}
            <CardTitle className="text-sm font-semibold text-white">{titulo}</CardTitle>
          </div>
          {aberto ? (
            <ChevronUp className="w-4 h-4 text-white/80" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/80" />
          )}
        </div>
      </CardHeader>
      <AnimatePresence>
        {aberto && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="p-0 divide-y divide-gray-100 dark:divide-gray-700">
              {children}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// Função para calcular a semana ISO do ano
function getSemanaISO(data: Date): { semana: number; ano: number } {
  const d = new Date(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const inicioAno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil((((d.getTime() - inicioAno.getTime()) / 86400000) + 1) / 7);
  return { semana, ano: d.getUTCFullYear() };
}

export default function DesempenhoPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'semanal' | 'mensal'>('semanal');
  const [loading, setLoading] = useState(true);
  const [vistaEmpilhada, setVistaEmpilhada] = useState(true);
  
  // Calcular semana atual dinamicamente
  const semanaInicialCalc = useMemo(() => getSemanaISO(new Date()), []);
  
  // Estados para visão semanal empilhada (6 semanas)
  const [semanaFinal, setSemanaFinal] = useState<number>(semanaInicialCalc.semana);
  const [anoFinal, setAnoFinal] = useState<number>(semanaInicialCalc.ano);
  const [semanasData, setSemanasData] = useState<SemanaResult[]>([]);
  
  // Estados para visão semanal única (compatibilidade)
  const [dadosSemana, setDadosSemana] = useState<DadosSemana | null>(null);
  const [dadosSemanaAnterior, setDadosSemanaAnterior] = useState<DadosSemana | null>(null);
  
  // Estados para visão mensal
  const [mesAtual, setMesAtual] = useState<number>(new Date().getMonth() + 1);
  const [anoMensal, setAnoMensal] = useState<number>(new Date().getFullYear());
  const [dadosMes, setDadosMes] = useState<DadosSemana | null>(null);
  const [dadosMesAnterior, setDadosMesAnterior] = useState<DadosSemana | null>(null);
  const [qtdSemanasMes, setQtdSemanasMes] = useState<number>(0);
  
  const nomesMeses = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  // Formatar data
  const formatarData = (dataStr: string) => {
    if (!dataStr) return '';
    const data = new Date(dataStr + 'T12:00:00');
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  // Carregar múltiplas semanas (vista empilhada)
  const carregarSemanasEmpilhadas = useCallback(async () => {
    if (!selectedBar || !user) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `/api/estrategico/desempenho/semanas?quantidade=6&ate_semana=${semanaFinal}&ano=${anoFinal}`,
        {
          headers: {
            'x-user-data': encodeURIComponent(JSON.stringify({ ...user, bar_id: selectedBar?.id }))
          }
        }
      );

      if (!response.ok) throw new Error('Erro ao carregar dados');
      
      const data = await response.json();
      setSemanasData(data.semanas || []);
      
      // Para compatibilidade, também setar a última semana como dados únicos
      if (data.semanas?.length > 0) {
        const ultimaSemana = data.semanas[data.semanas.length - 1];
        const penultimaSemana = data.semanas.length > 1 ? data.semanas[data.semanas.length - 2] : null;
        setDadosSemana(ultimaSemana.dados);
        setDadosSemanaAnterior(penultimaSemana?.dados || null);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({ title: 'Erro', description: 'Falha ao carregar dados', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [selectedBar?.id, user?.id, semanaFinal, anoFinal, toast]);

  // Carregar dados do mês
  const carregarDadosMensal = useCallback(async () => {
    if (!selectedBar || !user) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `/api/estrategico/desempenho/mensal?mes=${mesAtual}&ano=${anoMensal}`,
        {
          headers: {
            'x-user-data': encodeURIComponent(JSON.stringify({ ...user, bar_id: selectedBar?.id }))
          }
        }
      );

      if (!response.ok) throw new Error('Erro ao carregar dados mensais');
      
      const data = await response.json();
      setDadosMes(data.mes || null);
      setDadosMesAnterior(data.mesAnterior || null);
      setQtdSemanasMes(data.quantidadeSemanas || 0);
    } catch (error) {
      console.error('Erro ao carregar dados mensais:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedBar?.id, user?.id, mesAtual, anoMensal]);

  // Função unificada para carregar dados
  const carregarDados = useCallback(() => {
    if (activeTab === 'semanal') {
      carregarSemanasEmpilhadas();
    } else {
      carregarDadosMensal();
    }
  }, [activeTab, carregarSemanasEmpilhadas, carregarDadosMensal]);

  // Navegação semanal (mover todas as 6 semanas)
  const navegarSemanas = (direcao: 'anterior' | 'proxima') => {
    if (direcao === 'anterior') {
      if (semanaFinal <= 6) {
        setSemanaFinal(53 + semanaFinal - 6);
        setAnoFinal(prev => prev - 1);
      } else {
        setSemanaFinal(prev => prev - 6);
      }
    } else {
      if (semanaFinal + 6 > 53) {
        setSemanaFinal((semanaFinal + 6) - 53);
        setAnoFinal(prev => prev + 1);
      } else {
        setSemanaFinal(prev => prev + 6);
      }
    }
  };

  // Navegação mensal
  const navegarMes = (direcao: 'anterior' | 'proxima') => {
    if (direcao === 'anterior') {
      if (mesAtual === 1) {
        setMesAtual(12);
        setAnoMensal(prev => prev - 1);
      } else {
        setMesAtual(prev => prev - 1);
      }
    } else {
      if (mesAtual === 12) {
        setMesAtual(1);
        setAnoMensal(prev => prev + 1);
      } else {
        setMesAtual(prev => prev + 1);
      }
    }
  };

  // Salvar métrica manualmente
  const salvarMetrica = async (semanaId: number, campo: string, valor: number) => {
    try {
      const response = await fetch('/api/gestao/desempenho', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-data': encodeURIComponent(JSON.stringify({ ...user, bar_id: selectedBar?.id }))
        },
        body: JSON.stringify({ id: semanaId, [campo]: valor })
      });

      if (!response.ok) throw new Error('Erro ao salvar');
      
      toast({ title: 'Salvo!', description: 'Valor atualizado com sucesso' });
      carregarDados();
    } catch (error) {
      toast({ title: 'Erro', description: 'Falha ao salvar valor', variant: 'destructive' });
    }
  };

  useEffect(() => {
    setPageTitle('Desempenho');
  }, [setPageTitle]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Verificar seleção de bar
  if (!selectedBar) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="bg-white dark:bg-gray-800 p-8 text-center max-w-md">
          <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Selecione um Bar
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Escolha um bar no seletor acima para visualizar os indicadores de desempenho.
          </p>
        </Card>
      </div>
    );
  }

  // Renderizar indicadores para uma semana específica
  const renderIndicadores = (dados: DadosSemana | null, dadosAnt: DadosSemana | null, editavel: boolean = false) => {
    if (!dados) return null;
    
    return (
      <>
        {/* GUARDRAIL - Indicadores Estratégicos */}
        <Secao
          titulo="GUARDRAIL - Estratégicos"
          icone={<DollarSign className="w-4 h-4 text-white" />}
          corGradiente="bg-gradient-to-r from-emerald-600 to-emerald-700"
        >
          <Indicador label="Faturamento Total" metricaKey="faturamento_total" valor={dados.faturamento_total} valorAnterior={dadosAnt?.faturamento_total} formato="moeda" />
          <Indicador label="Faturamento Couvert" metricaKey="faturamento_entrada" valor={dados.faturamento_entrada} valorAnterior={dadosAnt?.faturamento_entrada} formato="moeda" />
          <Indicador label="Faturamento Bar" metricaKey="faturamento_bar" valor={dados.faturamento_bar} valorAnterior={dadosAnt?.faturamento_bar} formato="moeda" />
          <Indicador label="Faturamento CMvível" metricaKey="faturamento_cmovivel" valor={dados.faturamento_cmovivel} valorAnterior={dadosAnt?.faturamento_cmovivel} formato="moeda" />
          <Indicador label="CMV R$" metricaKey="cmv_rs" valor={dados.cmv_rs} valorAnterior={dadosAnt?.cmv_rs} formato="moeda" inverso editavel={editavel} onSave={(v) => dados.id && salvarMetrica(dados.id, 'cmv_rs', v)} />
          <Indicador label="Ticket Médio ContaHub" metricaKey="ticket_medio" valor={dados.ticket_medio} valorAnterior={dadosAnt?.ticket_medio} formato="moeda" />
          <Indicador label="TM Entrada" metricaKey="tm_entrada" valor={dados.tm_entrada} valorAnterior={dadosAnt?.tm_entrada} formato="moeda" />
          <Indicador label="TM Bar" metricaKey="tm_bar" valor={dados.tm_bar} valorAnterior={dadosAnt?.tm_bar} formato="moeda" />
          <Indicador label="CMV Limpo %" metricaKey="cmv_limpo" valor={dados.cmv_limpo} valorAnterior={dadosAnt?.cmv_limpo} formato="percentual" inverso />
          <Indicador label="CMV Global Real" metricaKey="cmv_global_real" valor={dados.cmv_global_real} valorAnterior={dadosAnt?.cmv_global_real} formato="percentual" inverso />
          <Indicador label="CMV Teórico" metricaKey="cmv_teorico" valor={dados.cmv_teorico} valorAnterior={dadosAnt?.cmv_teorico} formato="percentual" inverso />
          <Indicador label="CMO %" metricaKey="cmo" valor={dados.cmo} valorAnterior={dadosAnt?.cmo} formato="percentual" inverso />
          <Indicador label="Atração/Faturamento" metricaKey="custo_atracao_faturamento" valor={dados.custo_atracao_faturamento} valorAnterior={dadosAnt?.custo_atracao_faturamento} formato="percentual" inverso />
        </Secao>

        {/* OVT - Clientes + Qualidade */}
        <Secao
          titulo="OVT - Clientes & Qualidade"
          icone={<Users className="w-4 h-4 text-white" />}
          corGradiente="bg-gradient-to-r from-blue-600 to-blue-700"
        >
          <Indicador label="Retenção 1 mês" metricaKey="retencao_1m" valor={dados.retencao_1m} valorAnterior={dadosAnt?.retencao_1m} formato="percentual" />
          <Indicador label="Retenção 2 meses" metricaKey="retencao_2m" valor={dados.retencao_2m} valorAnterior={dadosAnt?.retencao_2m} formato="percentual" />
          <Indicador label="% Novos Clientes" metricaKey="perc_clientes_novos" valor={dados.perc_clientes_novos} valorAnterior={dadosAnt?.perc_clientes_novos} formato="percentual" />
          <Indicador label="Visitas" metricaKey="clientes_atendidos" valor={dados.clientes_atendidos} valorAnterior={dadosAnt?.clientes_atendidos} />
          <Indicador label="Clientes Ativos" metricaKey="clientes_ativos" valor={dados.clientes_ativos} valorAnterior={dadosAnt?.clientes_ativos} />
          <Indicador 
            label="Reservas" 
            metricaKey="reservas_presentes" 
            valor={dados.reservas_presentes} 
            valorAnterior={dadosAnt?.reservas_presentes} 
            formato="reservas"
            reservasTotais={dados.reservas_totais}
            editavel={editavel}
            onSave={(v) => dados.id && salvarMetrica(dados.id, 'reservas_presentes', v)}
          />
          <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase flex items-center gap-1">
              <Star className="w-3 h-3" /> Qualidade
            </span>
          </div>
          <Indicador label="Avaliações 5★ Google" metricaKey="avaliacoes_5_google_trip" valor={dados.avaliacoes_5_google_trip} valorAnterior={dadosAnt?.avaliacoes_5_google_trip} />
          <Indicador label="Média Google" metricaKey="media_avaliacoes_google" valor={dados.media_avaliacoes_google} valorAnterior={dadosAnt?.media_avaliacoes_google} formato="decimal" />
          <Indicador label="NPS Reservas" metricaKey="nps_reservas" valor={dados.nps_reservas} valorAnterior={dadosAnt?.nps_reservas} />
          <Indicador label="NPS Felicidade Equipe" metricaKey="nota_felicidade_equipe" valor={dados.nota_felicidade_equipe} valorAnterior={dadosAnt?.nota_felicidade_equipe} editavel={editavel} onSave={(v) => dados.id && salvarMetrica(dados.id, 'nota_felicidade_equipe', v)} />
        </Secao>

        {/* Cockpit Produtos */}
        <Secao
          titulo="Cockpit Produtos"
          icone={<ShoppingCart className="w-4 h-4 text-white" />}
          corGradiente="bg-gradient-to-r from-orange-500 to-orange-600"
          defaultOpen={true}
        >
          <Indicador label="StockOut Comidas" metricaKey="stockout_comidas" valor={dados.stockout_comidas} valorAnterior={dadosAnt?.stockout_comidas} inverso sufixo={dados.stockout_comidas_perc ? ` (${dados.stockout_comidas_perc.toFixed(1)}%)` : ''} />
          <Indicador label="StockOut Drinks" metricaKey="stockout_drinks" valor={dados.stockout_drinks} valorAnterior={dadosAnt?.stockout_drinks} inverso sufixo={dados.stockout_drinks_perc ? ` (${dados.stockout_drinks_perc.toFixed(1)}%)` : ''} />
          <Indicador label="StockOut Bar" metricaKey="stockout_bar" valor={dados.stockout_bar} valorAnterior={dadosAnt?.stockout_bar} inverso sufixo={dados.stockout_bar_perc ? ` (${dados.stockout_bar_perc.toFixed(1)}%)` : ''} />
          <Indicador label="% Bebidas" metricaKey="perc_bebidas" valor={dados.perc_bebidas} valorAnterior={dadosAnt?.perc_bebidas} formato="percentual" />
          <Indicador label="% Drinks" metricaKey="perc_drinks" valor={dados.perc_drinks} valorAnterior={dadosAnt?.perc_drinks} formato="percentual" />
          <Indicador label="% Comida" metricaKey="perc_comida" valor={dados.perc_comida} valorAnterior={dadosAnt?.perc_comida} formato="percentual" />
          <Indicador label="% Happy Hour" metricaKey="perc_happy_hour" valor={dados.perc_happy_hour} valorAnterior={dadosAnt?.perc_happy_hour} formato="percentual" />
          <Indicador label="Qtde Itens Bar" metricaKey="qtde_itens_bar" valor={dados.qtde_itens_bar} valorAnterior={dadosAnt?.qtde_itens_bar} />
          <Indicador label="Atrasos Bar" metricaKey="atrasos_bar" valor={dados.atrasos_bar} valorAnterior={dadosAnt?.atrasos_bar} inverso sufixo={dados.atrasos_bar_perc ? ` (${dados.atrasos_bar_perc.toFixed(1)}%)` : ''} />
          <Indicador label="Tempo Saída Bar" metricaKey="tempo_saida_bar" valor={dados.tempo_saida_bar} valorAnterior={dadosAnt?.tempo_saida_bar} formato="decimal" sufixo=" min" inverso />
          <Indicador label="Qtde Itens Cozinha" metricaKey="qtde_itens_cozinha" valor={dados.qtde_itens_cozinha} valorAnterior={dadosAnt?.qtde_itens_cozinha} />
          <Indicador label="Atrasos Cozinha" metricaKey="atrasos_cozinha" valor={dados.atrasos_cozinha} valorAnterior={dadosAnt?.atrasos_cozinha} inverso sufixo={dados.atrasos_cozinha_perc ? ` (${dados.atrasos_cozinha_perc.toFixed(1)}%)` : ''} />
          <Indicador label="Tempo Saída Cozinha" metricaKey="tempo_saida_cozinha" valor={dados.tempo_saida_cozinha} valorAnterior={dadosAnt?.tempo_saida_cozinha} formato="decimal" sufixo=" min" inverso />
        </Secao>

        {/* Cockpit Vendas + Marketing */}
        <Secao
          titulo="Vendas & Marketing"
          icone={<Megaphone className="w-4 h-4 text-white" />}
          corGradiente="bg-gradient-to-r from-pink-500 to-pink-600"
          defaultOpen={true}
        >
          {/* Vendas */}
          <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/30">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Vendas</span>
          </div>
          <Indicador label="% Fat. até 19h" metricaKey="perc_faturamento_ate_19h" valor={dados.perc_faturamento_ate_19h} valorAnterior={dadosAnt?.perc_faturamento_ate_19h} formato="percentual" />
          <Indicador label="% Fat. após 22h" metricaKey="perc_faturamento_apos_22h" valor={dados.perc_faturamento_apos_22h || 0} valorAnterior={dadosAnt?.perc_faturamento_apos_22h} formato="percentual" />
          <Indicador label="QUI+SÁB+DOM" metricaKey="qui_sab_dom" valor={dados.qui_sab_dom} valorAnterior={dadosAnt?.qui_sab_dom} formato="moeda" />
          
          {/* Marketing Orgânico */}
          <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/30">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Marketing Orgânico</span>
          </div>
          <Indicador label="Nº de Posts" metricaKey="o_num_posts" valor={dados.o_num_posts} valorAnterior={dadosAnt?.o_num_posts} editavel={editavel} onSave={(v) => dados.id && salvarMetrica(dados.id, 'o_num_posts', v)} />
          <Indicador label="Alcance" metricaKey="o_alcance" valor={dados.o_alcance} valorAnterior={dadosAnt?.o_alcance} editavel={editavel} onSave={(v) => dados.id && salvarMetrica(dados.id, 'o_alcance', v)} />
          <Indicador label="Interação" metricaKey="o_interacao" valor={dados.o_interacao} valorAnterior={dadosAnt?.o_interacao} editavel={editavel} onSave={(v) => dados.id && salvarMetrica(dados.id, 'o_interacao', v)} />
          <Indicador label="Compartilhamento" metricaKey="o_compartilhamento" valor={dados.o_compartilhamento} valorAnterior={dadosAnt?.o_compartilhamento} editavel={editavel} onSave={(v) => dados.id && salvarMetrica(dados.id, 'o_compartilhamento', v)} />
          <Indicador label="Engajamento" metricaKey="o_engajamento" valor={dados.o_engajamento} valorAnterior={dadosAnt?.o_engajamento} formato="percentual" editavel={editavel} onSave={(v) => dados.id && salvarMetrica(dados.id, 'o_engajamento', v)} />
          <Indicador label="Nº Stories" metricaKey="o_num_stories" valor={dados.o_num_stories} valorAnterior={dadosAnt?.o_num_stories} editavel={editavel} onSave={(v) => dados.id && salvarMetrica(dados.id, 'o_num_stories', v)} />
          <Indicador label="Visu Stories" metricaKey="o_visu_stories" valor={dados.o_visu_stories} valorAnterior={dadosAnt?.o_visu_stories} editavel={editavel} onSave={(v) => dados.id && salvarMetrica(dados.id, 'o_visu_stories', v)} />
          
          {/* Marketing Pago */}
          <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/30">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Marketing Pago (Meta)</span>
          </div>
          <Indicador label="Valor Investido" metricaKey="m_valor_investido" valor={dados.m_valor_investido} valorAnterior={dadosAnt?.m_valor_investido} formato="moeda" editavel={editavel} onSave={(v) => dados.id && salvarMetrica(dados.id, 'm_valor_investido', v)} />
          <Indicador label="Alcance" metricaKey="m_alcance" valor={dados.m_alcance} valorAnterior={dadosAnt?.m_alcance} editavel={editavel} onSave={(v) => dados.id && salvarMetrica(dados.id, 'm_alcance', v)} />
          <Indicador label="Frequência" metricaKey="m_frequencia" valor={dados.m_frequencia} valorAnterior={dadosAnt?.m_frequencia} formato="decimal" editavel={editavel} onSave={(v) => dados.id && salvarMetrica(dados.id, 'm_frequencia', v)} />
          <Indicador label="CPM" metricaKey="m_cpm" valor={dados.m_cpm} valorAnterior={dadosAnt?.m_cpm} formato="moeda" inverso editavel={editavel} onSave={(v) => dados.id && salvarMetrica(dados.id, 'm_cpm', v)} />
          <Indicador label="Cliques" metricaKey="m_cliques" valor={dados.m_cliques} valorAnterior={dadosAnt?.m_cliques} editavel={editavel} onSave={(v) => dados.id && salvarMetrica(dados.id, 'm_cliques', v)} />
          <Indicador label="CTR" metricaKey="m_ctr" valor={dados.m_ctr} valorAnterior={dadosAnt?.m_ctr} formato="percentual" editavel={editavel} onSave={(v) => dados.id && salvarMetrica(dados.id, 'm_ctr', v)} />
          <Indicador label="Custo por Clique" metricaKey="m_custo_por_clique" valor={dados.m_custo_por_clique} valorAnterior={dadosAnt?.m_custo_por_clique} formato="moeda" inverso editavel={editavel} onSave={(v) => dados.id && salvarMetrica(dados.id, 'm_custo_por_clique', v)} />
          <Indicador label="Conversas Iniciadas" metricaKey="m_conversas_iniciadas" valor={dados.m_conversas_iniciadas} valorAnterior={dadosAnt?.m_conversas_iniciadas} editavel={editavel} onSave={(v) => dados.id && salvarMetrica(dados.id, 'm_conversas_iniciadas', v)} />
        </Secao>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header com navegação */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-[98vw] mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'semanal' | 'mensal')}>
              <TabsList className="bg-gray-100 dark:bg-gray-700">
                <TabsTrigger value="semanal" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-600">
                  <Calendar className="w-4 h-4 mr-2" />
                  Semanal
                </TabsTrigger>
                <TabsTrigger value="mensal" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-600">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Mensal
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Toggle Vista Empilhada (apenas para semanal) */}
            {activeTab === 'semanal' && (
              <div className="flex items-center gap-2">
                <Button
                  variant={vistaEmpilhada ? "default" : "outline"}
                  size="sm"
                  onClick={() => setVistaEmpilhada(true)}
                  className="gap-1"
                >
                  <Layers className="h-4 w-4" />
                  6 Semanas
                </Button>
                <Button
                  variant={!vistaEmpilhada ? "default" : "outline"}
                  size="sm"
                  onClick={() => setVistaEmpilhada(false)}
                  className="gap-1"
                >
                  <LayoutGrid className="h-4 w-4" />
                  Única
                </Button>
              </div>
            )}

            {/* Navegação de Semana/Mês */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => activeTab === 'semanal' ? navegarSemanas('anterior') : navegarMes('anterior')}
                className="h-10 w-10"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              
              <div className="min-w-[220px] text-center">
                {activeTab === 'semanal' ? (
                  vistaEmpilhada ? (
                    <>
                      <div className="text-lg font-bold text-gray-900 dark:text-white">
                        Semanas {(semanaFinal - 5 > 0 ? semanaFinal - 5 : 53 + (semanaFinal - 5)).toString().padStart(2, '0')} - {semanaFinal.toString().padStart(2, '0')}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Ano {anoFinal}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-lg font-bold text-gray-900 dark:text-white">
                        Semana {semanaFinal.toString().padStart(2, '0')}
                      </div>
                      {dadosSemana && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {formatarData(dadosSemana.data_inicio)} a {formatarData(dadosSemana.data_fim)}/{anoFinal}
                        </div>
                      )}
                    </>
                  )
                ) : (
                  <>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {nomesMeses[mesAtual]} {anoMensal}
                    </div>
                    {qtdSemanasMes > 0 && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {qtdSemanasMes} semanas consolidadas
                      </div>
                    )}
                  </>
                )}
              </div>
              
              <Button
                variant="outline"
                size="icon"
                onClick={() => activeTab === 'semanal' ? navegarSemanas('proxima') : navegarMes('proxima')}
                className="h-10 w-10"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Legenda e Refresh */}
            <div className="flex items-center gap-3">
              {/* Legenda de cores */}
              <div className="hidden md:flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-gray-600 dark:text-gray-400">Automático</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-gray-600 dark:text-gray-400">Manual</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-gray-600 dark:text-gray-400">Verificar</span>
                </div>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={carregarDados}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
                Atualizar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-[98vw] mx-auto px-4 py-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : activeTab === 'semanal' && vistaEmpilhada ? (
          // Vista Empilhada: 6 semanas lado a lado com scroll horizontal
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {semanasData.map((semanaItem, index) => {
                const semanaAnterior = index > 0 ? semanasData[index - 1] : null;
                const isUltima = index === semanasData.length - 1;
                
                return (
                  <div 
                    key={`${semanaItem.ano}-${semanaItem.semana}`}
                    className={cn(
                      "w-[320px] flex-shrink-0",
                      isUltima && "ring-2 ring-emerald-500 rounded-xl"
                    )}
                  >
                    {/* Header da semana */}
                    <div className={cn(
                      "mb-3 p-3 rounded-lg text-center",
                      isUltima ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-gray-100 dark:bg-gray-700"
                    )}>
                      <div className={cn(
                        "font-bold",
                        isUltima ? "text-emerald-700 dark:text-emerald-400" : "text-gray-700 dark:text-gray-300"
                      )}>
                        Semana {semanaItem.semana.toString().padStart(2, '0')}
                      </div>
                      {semanaItem.dados && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {formatarData(semanaItem.dados.data_inicio)} - {formatarData(semanaItem.dados.data_fim)}
                        </div>
                      )}
                    </div>
                    
                    {/* Indicadores da semana */}
                    {semanaItem.dados ? (
                      <div className="space-y-4">
                        {renderIndicadores(semanaItem.dados, semanaAnterior?.dados || null, isUltima)}
                      </div>
                    ) : (
                      <Card className="p-8 text-center bg-gray-50 dark:bg-gray-800">
                        <p className="text-gray-500 dark:text-gray-400">Sem dados</p>
                      </Card>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : !vistaEmpilhada && activeTab === 'semanal' ? (
          // Vista Única Semanal
          !dadosSemana ? (
            <Card className="bg-white dark:bg-gray-800 p-8 text-center">
              <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Sem dados para esta semana
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Não há dados de desempenho registrados para a Semana {semanaFinal} de {anoFinal}.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {renderIndicadores(dadosSemana, dadosSemanaAnterior, true)}
            </div>
          )
        ) : (
          // Vista Mensal
          !dadosMes ? (
            <Card className="bg-white dark:bg-gray-800 p-8 text-center">
              <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Sem dados para este mês
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Não há dados de desempenho registrados para {nomesMeses[mesAtual]} de {anoMensal}.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {renderIndicadores(dadosMes, dadosMesAnterior, false)}
            </div>
          )
        )}
      </div>
    </div>
  );
}
