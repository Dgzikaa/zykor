'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DollarSign,
  Users,
  Star,
  ShoppingCart,
  Megaphone,
  BarChart3,
  Calendar,
  RefreshCcw,
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,
  X,
  Table2
} from 'lucide-react';
import { useBar } from '@/contexts/BarContext';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { DadosSemana, SecaoConfig, GrupoMetricas, MetricaConfig, TipoAgregacao } from '../types';
import { GoogleReviewsTooltip } from './GoogleReviewsTooltip';

// ============================================================================
// CONFIGURAÇÃO UI (SECOES, ETC)
// ============================================================================

// Cores por status
const STATUS_COLORS = {
  auto: { dot: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  manual: { dot: 'bg-blue-500', text: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  nao_confiavel: { dot: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' }
};

const SECOES: SecaoConfig[] = [
  {
    id: 'guardrail',
    titulo: 'GUARDRAIL - Estratégicos',
    icone: <DollarSign className="w-4 h-4" />,
    cor: 'bg-emerald-600',
    grupos: [
      {
        id: 'faturamento',
        label: 'Faturamento Total',
        metricas: [
          { key: 'faturamento_total', label: 'Faturamento Total', status: 'auto', fonte: 'eventos_base (consolidado)', calculo: 'Soma de real_r + (te_real × cl_real) de todos os eventos da semana', formato: 'moeda' },
          { key: 'faturamento_entrada', label: 'Fat. Couvert', status: 'auto', fonte: 'eventos_base (consolidado)', calculo: 'Soma de (te_real × cl_real) de todos os eventos', formato: 'moeda', indentado: true },
          { key: 'faturamento_bar', label: 'Fat. Bar', status: 'auto', fonte: 'eventos_base (consolidado)', calculo: 'Soma de real_r de todos os eventos', formato: 'moeda', indentado: true },
          { key: 'faturamento_cmovivel', label: 'Fat. CMvível', status: 'auto', fonte: 'Calculado', calculo: 'Bar - Repique', formato: 'moeda', indentado: true },
        ]
      },
      {
        id: 'cmv',
        label: 'CMV Teórico %',
        metricas: [
          { key: 'cmv_teorico', label: 'CMV Teórico %', status: 'manual', fonte: 'Planilha', calculo: 'Inserido manualmente', formato: 'percentual', inverso: true, editavel: true },
          { key: 'cmv_global_real', label: 'CMV Global %', status: 'auto', fonte: 'Calculado', calculo: 'CMV R$ / Fat. Total × 100', formato: 'percentual', inverso: true, indentado: true },
          { key: 'cmv_limpo', label: 'CMV Limpo %', status: 'auto', fonte: 'CMV Semanal', calculo: 'CMV R$ / Fat. CMVível × 100', formato: 'percentual', inverso: true, indentado: true },
          { key: 'cmv_rs', label: 'CMV R$', status: 'auto', fonte: 'CMV Semanal', calculo: 'Est.Inicial + Compras - Est.Final - Consumos + Bonif.', formato: 'moeda', inverso: true, indentado: true },
        ]
      },
      {
        id: 'ticket',
        label: 'Ticket Médio',
        metricas: [
          { key: 'ticket_medio', label: 'Ticket Médio', status: 'auto', fonte: 'eventos_base (consolidado)', calculo: 'Faturamento Total / Público Total', formato: 'moeda_decimal' },
          { key: 'tm_entrada', label: 'TM Entrada', status: 'auto', fonte: 'eventos_base (consolidado)', calculo: 'Fat. Entrada / Público Total', formato: 'moeda_decimal', indentado: true },
          { key: 'tm_bar', label: 'TM Bar', status: 'auto', fonte: 'eventos_base (consolidado)', calculo: 'Fat. Bar / Público Total', formato: 'moeda_decimal', indentado: true },
        ]
      },
      {
        id: 'custos',
        label: 'Custos',
        metricas: [
          { key: 'cmo', label: 'CMO %', status: 'nao_confiavel', fonte: 'NIBO', calculo: 'Custos MO / Faturamento', formato: 'percentual', inverso: true },
          { key: 'custo_atracao_faturamento', label: 'Atração/Fat.', status: 'auto', fonte: 'NIBO', calculo: 'Atrações / Faturamento', formato: 'percentual', inverso: true },
        ]
      }
    ]
  },
  {
    id: 'ovt',
    titulo: 'OVT - Clientes',
    icone: <Users className="w-4 h-4" />,
    cor: 'bg-blue-600',
    grupos: [
      {
        id: 'volume',
        label: 'Volume',
        metricas: [
          { key: 'clientes_ativos', label: 'Clientes Ativos', status: 'auto', fonte: 'ContaHub', calculo: 'Clientes únicos ativos no período', formato: 'numero' },
          { key: 'clientes_atendidos', label: 'Visitas', status: 'auto', fonte: 'eventos_base (consolidado)', calculo: 'Soma de cl_real de todos os eventos (Sympla + Yuzer + ContaHub)', formato: 'numero' },
          { key: 'perc_clientes_novos', label: '% Novos Clientes', status: 'auto', fonte: 'Stored Procedure', calculo: 'Novos / Total', formato: 'percentual' },
        ]
      },
      {
        id: 'reservas',
        label: 'Reservas',
        metricas: [
          { key: 'reservas_totais', label: 'Reservas Realizadas', status: 'auto', fonte: 'GetIn', calculo: 'Total reservas/pessoas', formato: 'reservas', keyPessoas: 'pessoas_reservas_totais' },
          { key: 'reservas_presentes', label: 'Reservas Presentes', status: 'auto', fonte: 'GetIn', calculo: 'Reservas seated/pessoas', formato: 'reservas', keyPessoas: 'pessoas_reservas_presentes' },
          { key: 'quebra_reservas', label: 'Quebra de Reservas', status: 'auto', fonte: 'Calculado', calculo: '(Pessoas Total - Pessoas Presentes) / Pessoas Total', formato: 'percentual' },
        ]
      }
    ]
  },
  {
    id: 'qualidade',
    titulo: 'Qualidade',
    icone: <Star className="w-4 h-4" />,
    cor: 'bg-indigo-600',
    grupos: [
      {
        id: 'avaliacoes',
        label: 'Avaliações',
        metricas: [
          { key: 'avaliacoes_5_google_trip', label: 'Avaliações 5★ Google', status: 'auto', fonte: 'Google Reviews (Apify)', calculo: 'Contagem de avaliações 5 estrelas no período', formato: 'numero', temTooltipGoogle: true },
          { key: 'media_avaliacoes_google', label: 'Média Google', status: 'auto', fonte: 'Google Reviews (Apify)', calculo: 'Média das estrelas no período', formato: 'decimal', temTooltipGoogle: true },
        ]
      },
      {
        id: 'nps',
        label: 'NPS',
        metricas: [
          { key: 'falae_nps_score', label: 'NPS Falaê', status: 'auto', fonte: 'Falaê', calculo: '% Promotores - % Detratores (pesquisa pós-visita)', formato: 'numero' },
          { key: 'nps_geral', label: 'NPS Geral', status: 'auto', fonte: 'NPS', calculo: '% Promotores - % Detratores', formato: 'numero' },
          { key: 'nps_reservas', label: 'NPS Reservas', status: 'auto', fonte: 'NPS', calculo: '% Promotores - % Detratores (com reserva)', formato: 'numero' },
        ]
      },
      {
        id: 'equipe',
        label: 'Equipe',
        metricas: [
          { key: 'nota_felicidade_equipe', label: 'Felicidade Equipe', status: 'manual', fonte: 'Pesquisa', calculo: 'Manual', formato: 'numero', editavel: true },
        ]
      }
    ]
  },
  {
    id: 'produtos',
    titulo: 'Cockpit Produtos',
    icone: <ShoppingCart className="w-4 h-4" />,
    cor: 'bg-orange-500',
    grupos: [
      {
        id: 'stockout',
        label: 'Stockout',
        agregacao: { tipo: 'media', formato: 'percentual' },
        metricas: [
          { key: 'stockout_comidas_perc', label: '% Stockout Comidas', status: 'auto', fonte: 'ContaHub Stockout', calculo: 'Média da semana: Cozinha 1 + Cozinha 2', formato: 'percentual', inverso: true },
          { key: 'stockout_drinks_perc', label: '% Stockout Drinks', status: 'auto', fonte: 'ContaHub Stockout', calculo: 'Média da semana: Batidos + Montados + Mexido + Preshh', formato: 'percentual', inverso: true },
          { key: 'stockout_bar_perc', label: '% Stockout Bar', status: 'auto', fonte: 'ContaHub Stockout', calculo: 'Média da semana: Bar + Baldes + Shot e Dose + Chopp', formato: 'percentual', inverso: true },
        ]
      },
      {
        id: 'mix',
        label: 'Mix de Vendas',
        agregacao: { tipo: 'fixa', valorFixo: 100, formato: 'percentual' },
        metricas: [
          { key: 'perc_bebidas', label: '% Bebidas', status: 'auto', fonte: 'eventos_base', calculo: 'Bebidas / Total vendas', formato: 'percentual' },
          { key: 'perc_drinks', label: '% Drinks', status: 'auto', fonte: 'eventos_base', calculo: 'Drinks / Total vendas', formato: 'percentual' },
          { key: 'perc_comida', label: '% Comida', status: 'auto', fonte: 'eventos_base', calculo: 'Comida / Total vendas', formato: 'percentual' },
        ]
      },
      {
        id: 'tempos',
        label: 'Tempos',
        agregacao: { tipo: 'media', formato: 'decimal', sufixo: ' min' },
        metricas: [
          { key: 'tempo_saida_bar', label: 'Tempo Drinks', status: 'auto', fonte: 'contahub_tempo', calculo: 'Média t0_t3 (Drinks preparados)', formato: 'decimal', inverso: true, sufixo: ' min' },
          { key: 'tempo_saida_cozinha', label: 'Tempo Comida', status: 'auto', fonte: 'contahub_tempo', calculo: 'Média t0_t2 (Cozinha)', formato: 'decimal', inverso: true, sufixo: ' min' },
        ]
      },
      {
        id: 'atrasos',
        label: 'Atrasos',
        agregacao: { tipo: 'soma', formato: 'numero' },
        metricas: [
          { key: 'atrasinhos_bar', label: 'Atrasinho Drinks', status: 'auto', fonte: 'contahub_tempo', calculo: 't0_t3 >4 e <8 min', formato: 'numero', inverso: true, temTooltipDetalhes: true, detalhesKey: 'atrasinhos_detalhes' },
          { key: 'atrasinhos_cozinha', label: 'Atrasinho Comida', status: 'auto', fonte: 'contahub_tempo', calculo: 't0_t2 >15 e <20 min', formato: 'numero', inverso: true, temTooltipDetalhes: true, detalhesKey: 'atrasinhos_detalhes' },
          { key: 'atraso_bar', label: 'Atraso Drinks', status: 'auto', fonte: 'contahub_tempo', calculo: 't0_t3 >8 e <10 min', formato: 'numero', inverso: true, temTooltipDetalhes: true, detalhesKey: 'atraso_detalhes' },
          { key: 'atraso_cozinha', label: 'Atraso Comida', status: 'auto', fonte: 'contahub_tempo', calculo: 't0_t2 >20 e <30 min', formato: 'numero', inverso: true, temTooltipDetalhes: true, detalhesKey: 'atraso_detalhes' },
          { key: 'atrasos_bar', label: 'Atrasão Drinks', status: 'auto', fonte: 'contahub_tempo', calculo: 't0_t3 > 20 min', formato: 'numero', inverso: true, temTooltipDetalhes: true, keyPercentual: 'atrasos_bar_perc' },
          { key: 'atrasos_cozinha', label: 'Atrasão Comida', status: 'auto', fonte: 'contahub_tempo', calculo: 't0_t2 > 30 min', formato: 'numero', inverso: true, temTooltipDetalhes: true, keyPercentual: 'atrasos_cozinha_perc' },
        ]
      }
    ]
  },
  {
    id: 'vendas',
    titulo: 'Vendas',
    icone: <DollarSign className="w-4 h-4" />,
    cor: 'bg-purple-500',
    grupos: [
      {
        id: 'horarios',
        label: 'Horários',
        metricas: [
          { key: 'perc_faturamento_ate_19h', label: '% Fat. até 19h', status: 'auto', fonte: 'eventos_base', calculo: 'Média fat_19h_percent', formato: 'percentual' },
          { key: 'perc_faturamento_apos_22h', label: '% Fat. após 22h', status: 'auto', fonte: 'contahub_fatporhora', calculo: 'Soma após 22h', formato: 'percentual' },
          { key: 'qui_sab_dom', label: 'QUI+SÁB+DOM', status: 'auto', fonte: 'eventos_base', calculo: 'Soma real_r', formato: 'moeda' },
          { key: 'conta_assinada_valor', label: 'Conta Assinada', status: 'auto', fonte: 'contahub_pagamentos', calculo: 'Soma meio=Conta Assinada', formato: 'moeda_com_percentual', percentualKey: 'conta_assinada_perc' },
          { key: 'descontos_valor', label: 'Descontos', status: 'auto', fonte: 'contahub_periodo', calculo: 'Soma vr_desconto', formato: 'moeda_com_percentual', percentualKey: 'descontos_perc', temTooltipDetalhes: true },
          { key: 'cancelamentos', label: 'Cancelamentos', status: 'auto', fonte: 'contahub_cancelamentos', calculo: 'Soma custototal', formato: 'moeda', temTooltipDetalhes: true, detalhesKey: 'cancelamentos_detalhes' },
        ]
      }
    ]
  },
  {
    id: 'marketing',
    titulo: 'Marketing',
    icone: <Megaphone className="w-4 h-4" />,
    cor: 'bg-pink-500',
    grupos: [
      {
        id: 'organico',
        label: 'Marketing Orgânico',
        metricas: [
          { key: 'o_num_posts', label: 'Nº Posts', status: 'manual', fonte: 'Marketing', calculo: 'Manual', formato: 'numero', editavel: true },
          { key: 'o_alcance', label: 'Alcance Orgânico', status: 'manual', fonte: 'Marketing', calculo: 'Manual', formato: 'numero', editavel: true },
          { key: 'o_engajamento', label: 'Engajamento %', status: 'manual', fonte: 'Marketing', calculo: 'Manual', formato: 'percentual', editavel: true },
        ]
      },
      {
        id: 'pago',
        label: 'Marketing Pago',
        metricas: [
          { key: 'm_valor_investido', label: 'Investido Ads', status: 'manual', fonte: 'Meta Ads', calculo: 'Manual', formato: 'moeda', editavel: true },
          { key: 'm_alcance', label: 'Alcance Pago', status: 'manual', fonte: 'Meta Ads', calculo: 'Manual', formato: 'numero', editavel: true },
          { key: 'm_cliques', label: 'Cliques Ads', status: 'manual', fonte: 'Meta Ads', calculo: 'Manual', formato: 'numero', editavel: true },
          { key: 'm_ctr', label: 'CTR', status: 'manual', fonte: 'Meta Ads', calculo: 'Manual', formato: 'percentual', editavel: true },
        ]
      }
    ]
  }
];

// Helpers UI
const isGrupoHierarquico = (grupo: GrupoMetricas): boolean => {
  // Grupo hierárquico: label do grupo = label da primeira métrica E tem mais de 1 métrica
  if (!grupo.metricas.length || grupo.metricas.length === 1) return false;
  const labelGrupo = grupo.label.toLowerCase().replace(/[%]/g, '').trim();
  const labelMetrica = grupo.metricas[0].label.toLowerCase().replace(/[%]/g, '').trim();
  return labelGrupo === labelMetrica;
};

// Verifica se grupo tem apenas 1 métrica (exibir diretamente sem header de grupo)
const isGrupoSimples = (grupo: GrupoMetricas): boolean => {
  return grupo.metricas.length === 1;
};

const calcularValorAgregado = (grupo: GrupoMetricas, semana: any): number | null => {
  if (!grupo.agregacao) return null;
  
  if (grupo.agregacao.tipo === 'fixa' && grupo.agregacao.valorFixo !== undefined) {
    return grupo.agregacao.valorFixo;
  }
  
  if (grupo.agregacao.tipo === 'campo' && grupo.agregacao.campo) {
    const valor = semana[grupo.agregacao.campo];
    return valor !== null && valor !== undefined ? Number(valor) : null;
  }
  
  const valores: number[] = [];
  for (const metrica of grupo.metricas) {
    const valor = semana[metrica.key];
    if (valor !== null && valor !== undefined && typeof valor === 'number') {
      valores.push(valor);
    }
  }
  
  if (valores.length === 0) return null;
  
  if (grupo.agregacao.tipo === 'media') return valores.reduce((a, b) => a + b, 0) / valores.length;
  if (grupo.agregacao.tipo === 'soma') return valores.reduce((a, b) => a + b, 0);
  
  return null;
};

const formatarValor = (valor: number | string | null | undefined, formato: string, sufixo?: string): string => {
  const num = typeof valor === 'string' ? parseFloat(valor) : valor;
  if (num === null || num === undefined || (typeof num === 'number' && isNaN(num))) return '-';
  
  switch (formato) {
    case 'moeda':
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(num);
    case 'moeda_decimal':
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    case 'percentual':
      return `${num.toFixed(1)}%`;
    case 'decimal':
      return (Math.round(num * 100) / 100).toFixed(2).replace('.', ',') + (sufixo || '');
    default:
      const valorArredondado = Math.round(num * 100) / 100;
      const isInteiro = valorArredondado === Math.floor(valorArredondado);
      return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: isInteiro ? 0 : 2 }).format(valorArredondado) + (sufixo || '');
  }
};

const formatarDataCurta = (dataStr: string): string => {
  if (!dataStr) return '';
  const data = new Date(dataStr + 'T12:00:00');
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const getSemanasNoAno = (ano: number): number => {
  const dec28 = new Date(ano, 11, 28);
  const dayOfYear = Math.floor((dec28.getTime() - new Date(ano, 0, 1).getTime()) / 86400000) + 1;
  return Math.ceil((dayOfYear + new Date(ano, 0, 1).getDay()) / 7);
};

const getDataInicioSemana = (ano: number, semana: number): string => {
  const simple = new Date(ano, 0, 1 + (semana - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = new Date(simple);
  if (dow <= 4) {
    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  } else {
    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  }
  return ISOweekStart.toISOString().split('T')[0];
};

const getDataFimSemana = (dataInicio: string): string => {
  const data = new Date(dataInicio + 'T12:00:00');
  data.setDate(data.getDate() + 6);
  return data.toISOString().split('T')[0];
};

// ============================================================================
// COMPONENTE PRINCIPAL (CLIENT)
// ============================================================================

interface DesempenhoClientProps {
  initialData: DadosSemana[];
  semanaAtual: number;
  anoAtual: number;
  visao: 'semanal' | 'mensal';
  barId: number;
}

export function DesempenhoClient({
  initialData,
  semanaAtual,
  anoAtual,
  visao,
  barId
}: DesempenhoClientProps) {
  const router = useRouter();
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [semanaAtualIdx, setSemanaAtualIdx] = useState<number>(-1);
  
  const [secoesAbertas, setSecoesAbertas] = useState<Record<string, boolean>>({
    guardrail: true,
    ovt: true,
    qualidade: true,
    produtos: true,
    vendas: true,
    marketing: true
  });
  
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({
    'guardrail-faturamento': false,
    'guardrail-cmv': false,
    'guardrail-ticket': false,
    'guardrail-custos': true,
    'ovt-volume': true,
    'ovt-reservas': true,
    'qualidade-avaliacoes': true,
    'qualidade-nps': true,
    'qualidade-equipe': true,
    'produtos-stockout': true,
    'produtos-mix': true,
    'produtos-tempos': true,
    'produtos-atrasos': true,
    'vendas-horarios': true,
    'marketing-organico': true,
    'marketing-pago': true,
  });
  
  const secoesNaoColapsaveis = useMemo(() => ['ovt', 'qualidade', 'vendas'], []);
  const [editando, setEditando] = useState<{ semanaId: number; campo: string } | null>(null);
  const [valorEdit, setValorEdit] = useState('');
  const [valoresLocais, setValoresLocais] = useState<Record<string, Record<string, number>>>({});
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const semanaAtualRef = useRef<HTMLDivElement>(null);

  // Processar Initial Data (Adicionar semanas futuras)
  const semanasProcessadas = useMemo(() => {
    if (visao === 'mensal') return initialData;
    
    // Semanal: adicionar 5 semanas futuras vazias para scroll
    const semanas = [...initialData];
    let semanaFutura = semanaAtual;
    let anoFuturo = anoAtual;
    
    // Encontrar último registro real para continuar dele se existir, ou usar semana atual
    const ultimoReal = semanas.length > 0 ? semanas[semanas.length - 1] : null;
    if (ultimoReal) {
      semanaFutura = ultimoReal.numero_semana;
      anoFuturo = ultimoReal.ano;
    }

    for (let i = 0; i < 5; i++) {
        semanaFutura++;
        const semanasNoAno = getSemanasNoAno(anoFuturo);
        if (semanaFutura > semanasNoAno) {
          semanaFutura = 1;
          anoFuturo++;
        }
        
        // Verificar se já existe
        const jaExiste = semanas.some(s => s.numero_semana === semanaFutura && s.ano === anoFuturo);
        
        if (!jaExiste) {
          const dataInicio = getDataInicioSemana(anoFuturo, semanaFutura);
          const dataFim = getDataFimSemana(dataInicio);
          
          semanas.push({
            id: undefined,
            numero_semana: semanaFutura,
            ano: anoFuturo,
            data_inicio: dataInicio,
            data_fim: dataFim,
          } as DadosSemana);
        }
    }
    return semanas;
  }, [initialData, visao, semanaAtual, anoAtual]);

  // Encontrar índice da semana atual
  useEffect(() => {
    let idx = -1;
    if (visao === 'mensal') {
      const mesAtual = new Date().getMonth() + 1;
      const anoAtualReal = new Date().getFullYear();
      idx = semanasProcessadas.findIndex(m => m.ano === anoAtualReal && m.numero_semana === mesAtual);
    } else {
      idx = semanasProcessadas.findIndex(s => s.numero_semana === semanaAtual && s.ano === anoAtual);
    }
    setSemanaAtualIdx(idx >= 0 ? idx : semanasProcessadas.length - 1 || 0);
  }, [semanasProcessadas, visao, semanaAtual, anoAtual]);

  // Scroll inicial
  useEffect(() => {
    // Timeout para garantir renderização
    const timer = setTimeout(() => {
      if (scrollContainerRef.current && semanaAtualRef.current) {
        const container = scrollContainerRef.current;
        const element = semanaAtualRef.current;
        const containerWidth = container.offsetWidth;
        const elementLeft = element.offsetLeft;
        const elementWidth = element.offsetWidth;
        container.scrollLeft = elementLeft - (containerWidth * 0.6) + (elementWidth / 2);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [semanaAtualIdx]); // Re-run quando o índice mudar (ex: troca de visão ou dados carregados)

  useEffect(() => {
    setPageTitle('Desempenho');
  }, [setPageTitle]);

  const toggleGrupo = useCallback((grupoId: string) => {
    setGruposAbertos(prev => ({ ...prev, [grupoId]: !prev[grupoId] }));
  }, []);

  const toggleSecao = (id: string) => {
    setSecoesAbertas(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const NOMES_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const formatarHeaderColuna = (item: DadosSemana): { titulo: string; subtitulo: string } => {
    if (visao === 'mensal') {
      return {
        titulo: `${NOMES_MESES[item.numero_semana - 1]}/${item.ano.toString().slice(-2)}`,
        subtitulo: `Mês ${item.numero_semana}`
      };
    }
    return {
      titulo: `S${item.numero_semana.toString().padStart(2, '0')}/${item.ano.toString().slice(-2)}`,
      subtitulo: `${formatarDataCurta(item.data_inicio)} - ${formatarDataCurta(item.data_fim)}`
    };
  };

  // Função de atualização completa: NIBO + Planilha CMV + Refresh (FUNÇÃO UNIFICADA)
  const atualizarTudo = async () => {
    if (!selectedBar) {
      toast({
        title: "Bar não selecionado",
        description: "Selecione um bar para atualizar os dados",
        variant: "destructive"
      });
      return;
    }

    setSincronizando(true);

    try {
      console.log('🔄 Iniciando atualização completa...');
      
      // 1. Sincronizar NIBO (compras) - busca dados do NIBO para o banco
      console.log('📦 Sincronizando NIBO...');
      const niboResponse = await fetch('/api/nibo/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bar_id: selectedBar.id,
          sync_mode: 'daily_complete'
        })
      });
      
      if (!niboResponse.ok) {
        console.warn('⚠️ Erro ao sincronizar NIBO, continuando...');
      } else {
        console.log('✅ NIBO sincronizado');
      }

      // 2. Processar CMV de TODAS as semanas (Planilha + NIBO + ContaHub → Banco)
      console.log('📊 Processando CMV de todas as semanas...');
      const cmvResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/cmv-semanal-auto`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({ 
            bar_id: selectedBar.id,
            todas_semanas: true // Processa TODAS as semanas da planilha
          })
        }
      );
      
      if (!cmvResponse.ok) {
        const errorData = await cmvResponse.json().catch(() => ({}));
        console.warn('⚠️ Erro ao processar CMV:', errorData);
      } else {
        const resultado = await cmvResponse.json();
        console.log('✅ CMV processado:', resultado.message);
      }

      // 3. Atualizar a página
      console.log('🔃 Atualizando página...');
      router.refresh();

      toast({
        title: "✅ Dados Atualizados",
        description: "Planilha + NIBO sincronizados com sucesso"
      });

    } catch (error) {
      console.error('Erro ao atualizar:', error);
      toast({
        title: "Erro ao atualizar",
        description: error instanceof Error ? error.message : "Falha na atualização",
        variant: "destructive"
      });
    } finally {
      setSincronizando(false);
    }
  };

  const salvarMetrica = async (semanaId: number, campo: string) => {
    if (!semanaId) {
      toast({ title: 'Erro', description: 'ID da semana/mês não encontrado', variant: 'destructive' });
      return;
    }
    
    const numValue = parseFloat(valorEdit.replace(',', '.'));
    if (isNaN(numValue)) {
      setEditando(null);
      toast({ title: 'Erro', description: 'Valor inválido', variant: 'destructive' });
      return;
    }
    
    // Usar API route existente (PUT /api/gestao/desempenho)
    // TODO: Converter para Server Action
    try {
      setLoading(true);
      const response = await fetch('/api/gestao/desempenho', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-data': encodeURIComponent(JSON.stringify({ ...user, bar_id: barId }))
        },
        body: JSON.stringify({ id: semanaId, [campo]: numValue })
      });

      if (!response.ok) throw new Error('Erro ao salvar');
      
      // Atualizar estado local para refletir imediatamente
      setValoresLocais(prev => ({
        ...prev,
        [semanaId]: {
          ...(prev[semanaId] || {}),
          [campo]: numValue
        }
      }));
      
      toast({ title: 'Salvo!', description: 'Valor atualizado' });
      setEditando(null);
      router.refresh(); // Refresh RSC data
    } catch (error) {
      console.error('Erro:', error);
      toast({ title: 'Erro', description: 'Falha ao salvar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Helper para obter valor considerando override local
  const getValorComOverride = (semana: DadosSemana, key: string): any => {
    const semanaId = semana.id?.toString() || '';
    if (valoresLocais[semanaId]?.[key] !== undefined) {
      return valoresLocais[semanaId][key];
    }
    return (semana as any)[key];
  };

  // Se não houver dados e não estiver carregando (mas loading é false inicialmente)
  if (initialData.length === 0 && visao === 'mensal') {
     // Mensal vazio
  }

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-full mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Tabs value={visao} onValueChange={(v) => router.push(`?visao=${v}`)}>
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
              
              <div className="flex items-center gap-2">
                <Table2 className="w-5 h-5 text-gray-500" />
                <span className="font-semibold text-gray-900 dark:text-white">
                  {semanasProcessadas.length} {visao === 'semanal' ? 'semanas' : 'meses'} carregados
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
               {/* Legenda */}
              <div className="hidden md:flex items-center gap-3 text-xs">
                 {/* ... Legenda igual ... */}
                 <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /><span className="text-gray-600 dark:text-gray-400">Automático</span></div>
                 <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /><span className="text-gray-600 dark:text-gray-400">Manual</span></div>
                 <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /><span className="text-gray-600 dark:text-gray-400">Verificar</span></div>
              </div>
              
              <Button variant="outline" size="sm" onClick={atualizarTudo} disabled={loading || sincronizando} className="gap-2">
                <RefreshCcw className={cn("h-4 w-4", sincronizando && "animate-spin")} />
                {sincronizando ? 'Atualizando...' : 'Atualizar'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto smooth-scroll">
        <div className="flex" style={{ minWidth: 'max-content' }}>
          {/* Coluna Fixa */}
          <div className="sticky left-0 z-20 flex-shrink-0 w-[200px] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-md">
            <div className="h-[72px] border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex items-center justify-center sticky top-0 z-30">
              <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 text-center">INDICADOR</span>
            </div>
            {SECOES.map(secao => (
              <div key={secao.id} className="virtualized-section">
                <div className={cn("flex items-center gap-2 px-3 cursor-pointer", secao.cor)} style={{ height: '40px' }} onClick={() => toggleSecao(secao.id)}>
                   {/* ... Header Seção ... */}
                   {secoesAbertas[secao.id] ? <ChevronDown className="w-4 h-4 text-white" /> : <ChevronRight className="w-4 h-4 text-white" />}
                   {secao.icone}
                   <span className="text-xs font-semibold text-white truncate">{secao.titulo}</span>
                </div>
                {secoesAbertas[secao.id] && secao.grupos.map(grupo => {
                   // ... Renderizar labels dos grupos ...
                   const hierarquico = isGrupoHierarquico(grupo);
                   const grupoSimples = isGrupoSimples(grupo);
                   const metricasParaMostrar = hierarquico ? grupo.metricas.slice(1) : grupo.metricas;
                   // Grupos simples (1 métrica) não mostram header de grupo, apenas a métrica diretamente
                   const mostrarHeaderGrupo = !grupoSimples && (hierarquico || !!grupo.agregacao);
                   return (
                      <div key={grupo.id}>
                         {mostrarHeaderGrupo && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={cn("flex items-center gap-2 px-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600", !secoesNaoColapsaveis.includes(secao.id) && "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700")} style={{ height: '36px' }} onClick={() => !secoesNaoColapsaveis.includes(secao.id) && toggleGrupo(`${secao.id}-${grupo.id}`)}>
                                    {/* ... Chevron e Label ... */}
                                    {!secoesNaoColapsaveis.includes(secao.id) && (gruposAbertos[`${secao.id}-${grupo.id}`] ? <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />)}
                                    {hierarquico && <div className={cn("w-2 h-2 rounded-full flex-shrink-0", STATUS_COLORS[grupo.metricas[0]?.status || 'auto'].dot)} />}
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{grupo.label}</span>
                                    {!hierarquico && <span className="text-[10px] text-gray-400 dark:text-gray-500">({grupo.metricas.length})</span>}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs p-3">
                                  {hierarquico && grupo.metricas[0] ? (
                                    <div className="space-y-1">
                                      <p className="font-semibold text-sm">{grupo.metricas[0].label}</p>
                                      <p className="text-xs"><strong>Fonte:</strong> {grupo.metricas[0].fonte}</p>
                                      <p className="text-xs"><strong>Cálculo:</strong> {grupo.metricas[0].calculo}</p>
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      <p className="font-semibold text-sm">{grupo.label}</p>
                                      <p className="text-xs text-gray-500">Grupo com {grupo.metricas.length} métricas</p>
                                      {grupo.agregacao && <p className="text-xs"><strong>Agregação:</strong> {grupo.agregacao.tipo}</p>}
                                    </div>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                         )}
                         {/* Métricas */}
                         {(!mostrarHeaderGrupo || secoesNaoColapsaveis.includes(secao.id) || gruposAbertos[`${secao.id}-${grupo.id}`]) && metricasParaMostrar.map((metrica) => (
                           <TooltipProvider key={metrica.key}>
                              <Tooltip>
                                 <TooltipTrigger asChild>
                                    <div className="flex items-center gap-2 px-6 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-help bg-gray-50/50 dark:bg-gray-800/50" style={{ height: '32px' }}>
                                       <div className={cn("w-2 h-2 rounded-full flex-shrink-0", STATUS_COLORS[metrica.status].dot)} />
                                       <span className="text-xs text-gray-500 dark:text-gray-400 truncate leading-none">{hierarquico ? '└ ' : ''}{metrica.label}</span>
                                    </div>
                                 </TooltipTrigger>
                                 <TooltipContent side="right" className={cn("max-w-xs p-3", STATUS_COLORS[metrica.status].bg)}>
                                   <div className="space-y-1">
                                     <p className="font-semibold text-sm">{metrica.label}</p>
                                     <p className="text-xs"><strong>Fonte:</strong> {metrica.fonte}</p>
                                     <p className="text-xs"><strong>Cálculo:</strong> {metrica.calculo}</p>
                                     <div className="flex items-center gap-1 mt-1">
                                       <div className={cn("w-2 h-2 rounded-full", STATUS_COLORS[metrica.status].dot)} />
                                       <span className={cn("text-xs", STATUS_COLORS[metrica.status].text)}>
                                         {metrica.status === 'auto' ? 'Automático' : metrica.status === 'manual' ? 'Manual' : 'Não confiável'}
                                       </span>
                                     </div>
                                   </div>
                                 </TooltipContent>
                              </Tooltip>
                           </TooltipProvider>
                         ))}
                      </div>
                   )
                })}
              </div>
            ))}
          </div>

          {/* Área das Semanas */}
          <div className="flex-1">
             <div className="inline-flex" style={{ minWidth: 'max-content' }}>
               {semanasProcessadas.map((semana, idx) => {
                 const isAtual = idx === semanaAtualIdx;
                 return (
                   <div
                     key={`${semana.ano}-${semana.numero_semana}`}
                     ref={isAtual ? semanaAtualRef : undefined}
                     role="button"
                     tabIndex={0}
                     onClick={(e) => {
                       if ((e.target as HTMLElement).closest('button, input')) return;
                       setSemanaAtualIdx(idx);
                     }}
                     onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSemanaAtualIdx(idx); } }}
                     className={cn(
                       "flex-shrink-0 w-[120px] border-r border-gray-200 dark:border-gray-700 cursor-pointer transition-colors",
                       isAtual && "bg-emerald-50 dark:bg-emerald-900/20",
                       !isAtual && "hover:bg-gray-100 dark:hover:bg-gray-700/50"
                     )}
                   >
                      {/* Header Semana */}
                      <div className={cn("h-[72px] border-b border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center px-1 sticky top-0 z-10", isAtual ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-gray-50 dark:bg-gray-700")}>
                         {(() => {
                           const header = formatarHeaderColuna(semana);
                           return <><span className={cn("text-sm font-bold text-center", isAtual ? "text-emerald-700 dark:text-emerald-400" : "text-gray-700 dark:text-gray-300")}>{header.titulo}</span><span className="text-[10px] text-gray-500 dark:text-gray-400 text-center">{header.subtitulo}</span></>;
                         })()}
                      </div>
                      
                      {/* Dados */}
                      {SECOES.map(secao => (
                         <div key={secao.id}>
                            <div className={cn(secao.cor, "opacity-80")} style={{ height: '40px' }} />
                            {secoesAbertas[secao.id] && secao.grupos.map(grupo => {
                               // ... Lógica de renderização de células (igual page.tsx) ...
                               const hierarquico = isGrupoHierarquico(grupo);
                               const grupoSimples = isGrupoSimples(grupo);
                               const metricaPrincipal = grupo.metricas[0];
                               const metricasParaMostrar = hierarquico ? grupo.metricas.slice(1) : grupo.metricas;
                               // Grupos simples (1 métrica) não mostram header de grupo
                               const mostrarHeaderGrupo = !grupoSimples && (hierarquico || !!grupo.agregacao);
                               
                               const valorPrincipal = hierarquico && metricaPrincipal ? getValorComOverride(semana, metricaPrincipal.key) : null;
                               const valorPessoasPrincipal = hierarquico && metricaPrincipal?.keyPessoas ? getValorComOverride(semana, metricaPrincipal.keyPessoas) : null;
                               const isEditandoPrincipal = hierarquico && editando?.semanaId === semana.id && editando?.campo === metricaPrincipal?.key;
                               const valorAgregado = !hierarquico ? calcularValorAgregado(grupo, semana) : null;
                               const valorAgregadoFormatado = valorAgregado !== null && grupo.agregacao ? formatarValor(valorAgregado, grupo.agregacao.formato, grupo.agregacao.sufixo) : '-';
                               const valorPrincipalFormatado = hierarquico && metricaPrincipal?.formato === 'reservas' 
                                  ? (valorPrincipal !== null && valorPrincipal !== undefined ? `${Math.round(valorPrincipal)}/${valorPessoasPrincipal !== null && valorPessoasPrincipal !== undefined ? Math.round(valorPessoasPrincipal) : '-'}` : '-')
                                  : hierarquico ? formatarValor(valorPrincipal, metricaPrincipal?.formato || 'numero', metricaPrincipal?.sufixo) : null;

                               return (
                                  <div key={grupo.id}>
                                     {mostrarHeaderGrupo && (
                                        <div className={cn("relative flex items-center justify-center px-2 border-b border-gray-200 dark:border-gray-600 group", isAtual ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-gray-50 dark:bg-gray-800")} style={{ height: '36px' }}>
                                           {hierarquico ? (
                                              isEditandoPrincipal ? (
                                                <div className="absolute inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-800 shadow-lg border border-blue-300 rounded">
                                                  <div className="flex items-center gap-1 px-1">
                                                    <Input type="text" value={valorEdit} onChange={(e) => setValorEdit(e.target.value)} className="w-14 h-6 text-xs p-1" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') salvarMetrica(semana.id!, metricaPrincipal.key); if (e.key === 'Escape') setEditando(null); }} />
                                                    <Button size="icon" variant="ghost" className="h-5 w-5 flex-shrink-0" onClick={() => salvarMetrica(semana.id!, metricaPrincipal.key)}><Check className="h-3 w-3 text-emerald-600" /></Button>
                                                    <Button size="icon" variant="ghost" className="h-5 w-5 flex-shrink-0" onClick={() => setEditando(null)}><X className="h-3 w-3 text-red-600" /></Button>
                                                  </div>
                                                </div>
                                             ) : (
                                               <TooltipProvider>
                                                 <Tooltip>
                                                   <TooltipTrigger asChild>
                                                     <span className="text-xs font-medium text-gray-900 dark:text-white text-center cursor-help">{valorPrincipalFormatado}</span>
                                                   </TooltipTrigger>
                                                   <TooltipContent side="top" className={cn("max-w-xs p-3", STATUS_COLORS[metricaPrincipal.status].bg)}>
                                                     <div className="space-y-1">
                                                       <p className="font-semibold text-sm">{metricaPrincipal.label}</p>
                                                       <p className="text-xs"><strong>Fonte:</strong> {metricaPrincipal.fonte}</p>
                                                       <p className="text-xs"><strong>Cálculo:</strong> {metricaPrincipal.calculo}</p>
                                                       <div className="flex items-center gap-1 mt-1">
                                                         <div className={cn("w-2 h-2 rounded-full", STATUS_COLORS[metricaPrincipal.status].dot)} />
                                                         <span className={cn("text-xs", STATUS_COLORS[metricaPrincipal.status].text)}>
                                                           {metricaPrincipal.status === 'auto' ? 'Automático' : metricaPrincipal.status === 'manual' ? 'Manual' : 'Não confiável'}
                                                         </span>
                                                       </div>
                                                     </div>
                                                   </TooltipContent>
                                                 </Tooltip>
                                               </TooltipProvider>
                                             )
                                          ) : (
                                            <TooltipProvider>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <span className="text-xs font-medium text-gray-900 dark:text-white text-center cursor-help">{valorAgregadoFormatado}</span>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="max-w-xs p-3">
                                                  <div className="space-y-1">
                                                    <p className="font-semibold text-sm">{grupo.label}</p>
                                                    <p className="text-xs"><strong>Agregação:</strong> {grupo.agregacao?.tipo === 'soma' ? 'Soma' : grupo.agregacao?.tipo === 'media' ? 'Média' : 'Fixo'}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">Valor calculado a partir das métricas abaixo</p>
                                                  </div>
                                                </TooltipContent>
                                              </Tooltip>
                                            </TooltipProvider>
                                          )}
                                           {hierarquico && !isEditandoPrincipal && metricaPrincipal?.editavel && semana.id && (
                                               <Button size="icon" variant="ghost" className="absolute right-0 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { setEditando({ semanaId: semana.id!, campo: metricaPrincipal.key }); setValorEdit(valorPrincipal?.toString().replace('.', ',') || ''); }}><Pencil className="h-3 w-3 text-blue-600" /></Button>
                                           )}
                                        </div>
                                     )}
                                     {(!mostrarHeaderGrupo || secoesNaoColapsaveis.includes(secao.id) || gruposAbertos[`${secao.id}-${grupo.id}`]) && metricasParaMostrar.map((metrica) => {
                                        const valor = getValorComOverride(semana, metrica.key);
                                        const valorPessoas = metrica.keyPessoas ? getValorComOverride(semana, metrica.keyPessoas) : null;
                                        const valorPercentual = metrica.keyPercentual ? getValorComOverride(semana, metrica.keyPercentual) : null;
                                        const valorPercentualKey = metrica.percentualKey ? getValorComOverride(semana, metrica.percentualKey) : null;
                                        const isEditandoCell = editando?.semanaId === semana.id && editando?.campo === metrica.key;
                                       let valorFormatado = metrica.formato === 'reservas' ? (valor !== null && valor !== undefined ? `${Math.round(valor)}/${valorPessoas !== null && valorPessoas !== undefined ? Math.round(valorPessoas) : '-'}` : '-') : formatarValor(valor, metrica.formato, metrica.sufixo);
                                       if (metrica.keyPercentual && valorPercentual !== null && valorPercentual !== undefined && typeof valorPercentual === 'number' && valor !== null && valor !== undefined) valorFormatado = `${formatarValor(valor, 'numero')} (${valorPercentual.toFixed(1)}%)`;
                                       // Formato moeda_com_percentual: R$ 27.520 (3,5%)
                                       if (metrica.formato === 'moeda_com_percentual' && valor !== null && valor !== undefined) {
                                         const moedaFormatada = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(valor);
                                         if (valorPercentualKey !== null && valorPercentualKey !== undefined && typeof valorPercentualKey === 'number') {
                                           valorFormatado = `${moedaFormatada} (${valorPercentualKey.toFixed(1)}%)`;
                                         } else {
                                           valorFormatado = moedaFormatada;
                                         }
                                       }
                                        const temDetalhes = metrica.temTooltipDetalhes;
                                        const temTooltipGoogle = metrica.temTooltipGoogle;
                                        
                                        return (
                                           <div key={metrica.key} className={cn("relative flex items-center justify-center px-2 border-b border-gray-100 dark:border-gray-700 group", isAtual ? "bg-emerald-50/30 dark:bg-emerald-900/10" : "bg-gray-50/50 dark:bg-gray-800/50")} style={{ height: '32px' }}>
                                              {isEditandoCell ? (
                                                <div className="absolute inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-800 shadow-lg border border-blue-300 rounded">
                                                  <div className="flex items-center gap-1 px-1">
                                                    <Input type="text" value={valorEdit} onChange={(e) => setValorEdit(e.target.value)} className="w-14 h-6 text-xs p-1" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') salvarMetrica(semana.id!, metrica.key); if (e.key === 'Escape') setEditando(null); }} />
                                                    <Button size="icon" variant="ghost" className="h-5 w-5 flex-shrink-0" onClick={() => salvarMetrica(semana.id!, metrica.key)}><Check className="h-3 w-3 text-emerald-600" /></Button>
                                                    <Button size="icon" variant="ghost" className="h-5 w-5 flex-shrink-0" onClick={() => setEditando(null)}><X className="h-3 w-3 text-red-600" /></Button>
                                                  </div>
                                                </div>
                                              ) : temTooltipGoogle && semana.data_inicio && semana.data_fim ? (
                                                <GoogleReviewsTooltip
                                                  barId={barId}
                                                  dataInicio={semana.data_inicio}
                                                  dataFim={semana.data_fim}
                                                >
                                                  <span className="text-xs text-gray-600 dark:text-gray-400 text-center">
                                                    {valorFormatado}
                                                  </span>
                                                </GoogleReviewsTooltip>
                                              ) : temDetalhes ? (
                                                <TooltipProvider>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <span className="text-xs text-gray-600 dark:text-gray-400 text-center cursor-help underline decoration-dotted">
                                                        {valorFormatado}
                                                      </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="max-w-sm p-3 max-h-[320px] overflow-y-auto">
                                                      <div className="space-y-1">
                                                        <p className="font-semibold text-sm">{metrica.label}</p>
                                                        <p className="text-xs"><strong>Fonte:</strong> {metrica.fonte}</p>
                                                        <p className="text-xs"><strong>Cálculo:</strong> {metrica.calculo}</p>
                                                        {metrica.keyPercentual && valorPercentual !== null && typeof valorPercentual === 'number' && (
                                                          <p className="text-xs"><strong>Percentual:</strong> {valorPercentual.toFixed(1)}%</p>
                                                        )}
                                                        {(() => {
                                                          const detalhesKey = (metrica as any).detalhesKey || metrica.key + '_detalhes';
                                                          const detalhes = (semana as unknown as Record<string, unknown>)[detalhesKey];
                                                          if (!detalhes || !Array.isArray(detalhes) || detalhes.length === 0) return null;
                                                          const primeiro = detalhes[0] as Record<string, unknown>;
                                                          if (primeiro?.dia_semana && typeof primeiro?.valor === 'number') {
                                                            return (
                                                              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                                                <p className="text-xs font-medium mb-1">Por dia (ordem: maior valor):</p>
                                                                {detalhes.map((d: unknown, i: number) => {
                                                                  const item = d as { dia_semana: string; data?: string; valor: number };
                                                                  return <p key={i} className="text-xs">{item.dia_semana} ({item.data ?? ''}): {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}</p>;
                                                                })}
                                                              </div>
                                                            );
                                                          }
                                                          if (typeof primeiro?.atrasinhos_bar === 'number' || typeof primeiro?.atraso_bar === 'number') {
                                                            return (
                                                              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                                                <p className="text-xs font-medium mb-1">Por dia:</p>
                                                                {detalhes.map((d: unknown, i: number) => {
                                                                  const item = d as { dia_semana: string; atrasinhos_bar?: number; atrasinhos_cozinha?: number; atraso_bar?: number; atraso_cozinha?: number };
                                                                  return (
                                                                    <p key={i} className="text-xs">
                                                                      {item.dia_semana}: {item.atrasinhos_bar ?? 0} atrasinhos drinks, {item.atrasinhos_cozinha ?? 0} atrasinhos comida | {item.atraso_bar ?? 0} atraso drinks, {item.atraso_cozinha ?? 0} atraso comida
                                                                    </p>
                                                                  );
                                                                })}
                                                              </div>
                                                            );
                                                          }
                                                          if (Array.isArray(primeiro?.itens)) {
                                                            return (
                                                              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                                                {detalhes.map((d: unknown, i: number) => {
                                                                  const item = d as { dia_semana: string; itens?: { nome: string; quantidade: number; atraso_minutos?: number }[] };
                                                                  const itens = item.itens || [];
                                                                  return (
                                                                    <div key={i} className="mb-1">
                                                                      <p className="text-xs font-medium">{item.dia_semana}:</p>
                                                                      {itens.slice(0, 5).map((it, j) => (
                                                                        <p key={j} className="text-xs pl-2">• {it.nome}: {it.quantidade} ({it.atraso_minutos?.toFixed(1) ?? '-'} min)</p>
                                                                      ))}
                                                                      {itens.length > 5 && <p className="text-xs pl-2 text-gray-500">+{itens.length - 5} itens...</p>}
                                                                    </div>
                                                                  );
                                                                })}
                                                              </div>
                                                            );
                                                          }
                                                          return null;
                                                        })()}
                                                      </div>
                                                    </TooltipContent>
                                                  </Tooltip>
                                                </TooltipProvider>
                                             ) : (
                                               <TooltipProvider>
                                                 <Tooltip>
                                                   <TooltipTrigger asChild>
                                                     <span className="text-xs text-gray-600 dark:text-gray-400 text-center cursor-help">
                                                       {valorFormatado}
                                                     </span>
                                                   </TooltipTrigger>
                                                   <TooltipContent side="top" className={cn("max-w-xs p-3", STATUS_COLORS[metrica.status].bg)}>
                                                     <div className="space-y-1">
                                                       <p className="font-semibold text-sm">{metrica.label}</p>
                                                       <p className="text-xs"><strong>Fonte:</strong> {metrica.fonte}</p>
                                                       <p className="text-xs"><strong>Cálculo:</strong> {metrica.calculo}</p>
                                                       <div className="flex items-center gap-1 mt-1">
                                                         <div className={cn("w-2 h-2 rounded-full", STATUS_COLORS[metrica.status].dot)} />
                                                         <span className={cn("text-xs", STATUS_COLORS[metrica.status].text)}>
                                                           {metrica.status === 'auto' ? 'Automático' : metrica.status === 'manual' ? 'Manual' : 'Não confiável'}
                                                         </span>
                                                       </div>
                                                     </div>
                                                   </TooltipContent>
                                                 </Tooltip>
                                               </TooltipProvider>
                                             )}
                                              {!isEditandoCell && metrica.editavel && semana.id && (
                                                 <Button size="icon" variant="ghost" className="absolute right-0 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { setEditando({ semanaId: semana.id!, campo: metrica.key }); setValorEdit(valor?.toString().replace('.', ',') || ''); }}><Pencil className="h-3 w-3 text-blue-600" /></Button>
                                              )}
                                           </div>
                                        )
                                     })}
                                  </div>
                               )
                            })}
                         </div>
                      ))}
                   </div>
                 );
               })}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
