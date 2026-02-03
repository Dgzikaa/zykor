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

// Tipos
interface DadosSemana {
  id?: number;
  numero_semana: number;
  ano: number;
  data_inicio: string;
  data_fim: string;
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
  retencao_1m: number;
  retencao_2m: number;
  perc_clientes_novos: number;
  clientes_atendidos: number;
  clientes_ativos: number;
  reservas_totais: number;
  reservas_presentes: number;
  pessoas_reservas_totais?: number;
  pessoas_reservas_presentes?: number;
  avaliacoes_5_google_trip: number;
  media_avaliacoes_google: number;
  nps_geral: number;
  nps_reservas: number;
  nota_felicidade_equipe: number;
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
  perc_faturamento_ate_19h: number;
  perc_faturamento_apos_22h?: number;
  qui_sab_dom: number;
  o_num_posts: number;
  o_alcance: number;
  o_interacao: number;
  o_compartilhamento: number;
  o_engajamento: number;
  o_num_stories: number;
  o_visu_stories: number;
  m_valor_investido: number;
  m_alcance: number;
  m_frequencia: number;
  m_cpm: number;
  m_cliques: number;
  m_ctr: number;
  m_custo_por_clique: number;
  m_conversas_iniciadas: number;
}

// Status das métricas
type MetricaStatus = 'auto' | 'manual' | 'nao_confiavel';

interface MetricaConfig {
  key: string;
  label: string;
  status: MetricaStatus;
  fonte: string;
  calculo: string;
  formato: 'moeda' | 'moeda_decimal' | 'percentual' | 'numero' | 'decimal' | 'reservas';
  inverso?: boolean;
  sufixo?: string;
  editavel?: boolean;
  keyPessoas?: string; // Campo secundário para formato 'reservas' (mostra "reservas/pessoas")
  indentado?: boolean; // Indica se está indentado (sub-item de um grupo)
}

// Tipo de agregação para grupos planos
type TipoAgregacao = 'media' | 'soma' | 'fixa' | 'campo';

// Grupo de métricas relacionadas
interface GrupoMetricas {
  id: string;
  label: string;        // Label do grupo (ex: "Faturamento Total")
  metricas: MetricaConfig[];
  // Para grupos planos: como calcular o valor agregado no header
  agregacao?: {
    tipo: TipoAgregacao;
    valorFixo?: number;   // Para tipo 'fixa' (ex: 100%)
    campo?: string;       // Para tipo 'campo' (ex: 'clientes_ativos')
    formato: string;      // Formato de exibição (percentual, numero, etc)
    sufixo?: string;
  };
}

interface SecaoConfig {
  id: string;
  titulo: string;
  icone: React.ReactNode;
  cor: string;
  grupos: GrupoMetricas[];  // Agora usa grupos ao invés de métricas diretas
}

// Cores por status
const STATUS_COLORS = {
  auto: { dot: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  manual: { dot: 'bg-blue-500', text: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  nao_confiavel: { dot: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' }
};

// Helper: verifica se grupo é hierárquico (primeira métrica representa o grupo)
// Ex: "Faturamento Total" grupo com métrica "Faturamento Total" = hierárquico
// Ex: "Custos Operacionais" grupo com métrica "CMO %" = plano (todas métricas são iguais)
const isGrupoHierarquico = (grupo: GrupoMetricas): boolean => {
  if (!grupo.metricas.length) return false;
  // Compara se o label do grupo começa igual ao label da primeira métrica
  // ou se são exatamente iguais (ex: "Faturamento Total" === "Faturamento Total")
  const labelGrupo = grupo.label.toLowerCase().replace(/[%]/g, '').trim();
  const labelMetrica = grupo.metricas[0].label.toLowerCase().replace(/[%]/g, '').trim();
  return labelGrupo === labelMetrica;
};

// Helper: calcula valor agregado para grupos planos
const calcularValorAgregado = (grupo: GrupoMetricas, semana: any): number | null => {
  if (!grupo.agregacao) return null;
  
  // Valor fixo (ex: Mix de Vendas = 100%)
  if (grupo.agregacao.tipo === 'fixa' && grupo.agregacao.valorFixo !== undefined) {
    return grupo.agregacao.valorFixo;
  }
  
  // Campo específico (ex: Clientes Ativos usa o campo 'clientes_ativos' direto)
  if (grupo.agregacao.tipo === 'campo' && grupo.agregacao.campo) {
    const valor = semana[grupo.agregacao.campo];
    return valor !== null && valor !== undefined ? Number(valor) : null;
  }
  
  // Coleta valores válidos das métricas
  const valores: number[] = [];
  for (const metrica of grupo.metricas) {
    const valor = semana[metrica.key];
    if (valor !== null && valor !== undefined && typeof valor === 'number') {
      valores.push(valor);
    }
  }
  
  if (valores.length === 0) return null;
  
  // Média
  if (grupo.agregacao.tipo === 'media') {
    return valores.reduce((a, b) => a + b, 0) / valores.length;
  }
  
  // Soma
  if (grupo.agregacao.tipo === 'soma') {
    return valores.reduce((a, b) => a + b, 0);
  }
  
  return null;
};

// Configuração das seções e métricas COM AGRUPAMENTO
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
          { key: 'faturamento_total', label: 'Faturamento Total', status: 'auto', fonte: 'ContaHub + Yuzer + Sympla', calculo: 'Soma de todos os pagamentos', formato: 'moeda' },
          { key: 'faturamento_entrada', label: 'Fat. Couvert', status: 'auto', fonte: 'ContaHub', calculo: 'Soma do vr_couvert', formato: 'moeda', indentado: true },
          { key: 'faturamento_bar', label: 'Fat. Bar', status: 'auto', fonte: 'Calculado', calculo: 'Total - Couvert', formato: 'moeda', indentado: true },
          { key: 'faturamento_cmovivel', label: 'Fat. CMvível', status: 'auto', fonte: 'Calculado', calculo: 'Bar - Repique', formato: 'moeda', indentado: true },
        ]
      },
      {
        id: 'cmv',
        label: 'CMV Teórico %',
        metricas: [
          { key: 'cmv_teorico', label: 'CMV Teórico %', status: 'manual', fonte: 'Planilha', calculo: 'Inserido manualmente', formato: 'percentual', inverso: true, editavel: true },
          { key: 'cmv_global_real', label: 'CMV Global %', status: 'auto', fonte: 'Calculado', calculo: 'CMV / Total × 100', formato: 'percentual', inverso: true, indentado: true },
          { key: 'cmv_limpo', label: 'CMV Limpo %', status: 'auto', fonte: 'Calculado', calculo: 'CMV / CMvível × 100', formato: 'percentual', inverso: true, indentado: true },
          { key: 'cmv_rs', label: 'CMV R$', status: 'manual', fonte: 'Planilha', calculo: 'Inserido manualmente', formato: 'moeda', inverso: true, editavel: true, indentado: true },
        ]
      },
      {
        id: 'ticket',
        label: 'Ticket Médio',
        metricas: [
          { key: 'ticket_medio', label: 'Ticket Médio', status: 'auto', fonte: 'ContaHub', calculo: 'vr_pagamentos / pessoas', formato: 'moeda_decimal' },
          { key: 'tm_entrada', label: 'TM Entrada', status: 'auto', fonte: 'ContaHub', calculo: 'Couvert / Clientes', formato: 'moeda_decimal', indentado: true },
          { key: 'tm_bar', label: 'TM Bar', status: 'auto', fonte: 'ContaHub', calculo: 'Fat Bar / Clientes', formato: 'moeda_decimal', indentado: true },
        ]
      },
      {
        id: 'custos',
        label: 'Custos Operacionais',
        agregacao: { tipo: 'soma', formato: 'percentual' },
        metricas: [
          { key: 'cmo', label: 'CMO %', status: 'auto', fonte: 'NIBO', calculo: 'Custos MO / Faturamento', formato: 'percentual', inverso: true },
          { key: 'custo_atracao_faturamento', label: 'Atração/Fat.', status: 'auto', fonte: 'NIBO', calculo: 'Atrações / Faturamento', formato: 'percentual', inverso: true },
        ]
      }
    ]
  },
  {
    id: 'ovt',
    titulo: 'OVT - Clientes & Qualidade',
    icone: <Users className="w-4 h-4" />,
    cor: 'bg-blue-600',
    grupos: [
      {
        id: 'retencao',
        label: 'Retenção',
        agregacao: { tipo: 'soma', formato: 'percentual' },
        metricas: [
          { key: 'retencao_1m', label: 'Retenção 1 mês', status: 'auto', fonte: 'ContaHub', calculo: 'Clientes que retornaram em 30 dias', formato: 'percentual' },
          { key: 'retencao_2m', label: 'Retenção 2 meses', status: 'auto', fonte: 'ContaHub', calculo: 'Clientes que retornaram em 60 dias', formato: 'percentual' },
        ]
      },
      {
        id: 'clientes_ativos',
        label: 'Clientes Ativos',
        agregacao: { tipo: 'campo', campo: 'clientes_ativos', formato: 'numero' },
        metricas: []
      },
      {
        id: 'volume',
        label: 'Volume',
        // Sem agregação: Visitas e % Novos têm contextos diferentes
        metricas: [
          { key: 'clientes_atendidos', label: 'Visitas', status: 'auto', fonte: 'ContaHub + Yuzer', calculo: 'Soma de pessoas na semana', formato: 'numero' },
          { key: 'perc_clientes_novos', label: '% Novos Clientes', status: 'auto', fonte: 'Stored Procedure', calculo: 'Novos / Total', formato: 'percentual' },
        ]
      },
      {
        id: 'reservas',
        label: 'Reservas',
        // Sem agregação: formato especial "reservas/pessoas"
        metricas: [
          { key: 'reservas_totais', label: 'Reservas Realizadas', status: 'auto', fonte: 'GetIn', calculo: 'Total reservas/pessoas', formato: 'reservas', keyPessoas: 'pessoas_reservas_totais' },
          { key: 'reservas_presentes', label: 'Reservas Presentes', status: 'auto', fonte: 'GetIn', calculo: 'Reservas seated/pessoas', formato: 'reservas', keyPessoas: 'pessoas_reservas_presentes' },
        ]
      },
      {
        id: 'qualidade',
        label: 'Qualidade',
        // Sem agregação: métricas têm formatos e escalas diferentes (quantidade, nota, NPS)
        metricas: [
          { key: 'avaliacoes_5_google_trip', label: 'Avaliações 5★ Google', status: 'manual', fonte: 'SuperSal', calculo: 'Relatório semanal', formato: 'numero', editavel: true },
          { key: 'media_avaliacoes_google', label: 'Média Google', status: 'manual', fonte: 'SuperSal', calculo: 'Relatório semanal', formato: 'decimal', editavel: true },
          { key: 'nps_geral', label: 'NPS Geral', status: 'auto', fonte: 'NPS', calculo: '% Promotores - % Detratores', formato: 'numero' },
          { key: 'nps_reservas', label: 'NPS Reservas', status: 'auto', fonte: 'NPS', calculo: '% Promotores - % Detratores (com reserva)', formato: 'numero' },
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
        id: 'producao',
        label: 'Produção',
        agregacao: { tipo: 'soma', formato: 'numero' },
        metricas: [
          { key: 'qtde_itens_bar', label: 'Itens Bar', status: 'auto', fonte: 'contahub_analitico', calculo: 'Soma qtd bar', formato: 'numero' },
          { key: 'qtde_itens_cozinha', label: 'Itens Cozinha', status: 'auto', fonte: 'contahub_analitico', calculo: 'Soma qtd cozinha', formato: 'numero' },
        ]
      },
      {
        id: 'tempos',
        label: 'Tempos',
        agregacao: { tipo: 'media', formato: 'decimal', sufixo: ' min' },
        metricas: [
          { key: 'tempo_saida_bar', label: 'Tempo Bar', status: 'nao_confiavel', fonte: 'contahub_tempo', calculo: 'Média t0_t3', formato: 'decimal', inverso: true, sufixo: ' min' },
          { key: 'tempo_saida_cozinha', label: 'Tempo Cozinha', status: 'nao_confiavel', fonte: 'contahub_tempo', calculo: 'Média t0_t2', formato: 'decimal', inverso: true, sufixo: ' min' },
        ]
      },
      {
        id: 'atrasos',
        label: 'Atrasos',
        agregacao: { tipo: 'soma', formato: 'numero' },
        metricas: [
          { key: 'atrasos_bar', label: 'Atrasos Bar', status: 'nao_confiavel', fonte: 'contahub_tempo', calculo: 't0_t3 > 4min', formato: 'numero', inverso: true },
          { key: 'atrasos_cozinha', label: 'Atrasos Cozinha', status: 'nao_confiavel', fonte: 'contahub_tempo', calculo: 't0_t2 > 12min', formato: 'numero', inverso: true },
        ]
      }
    ]
  },
  {
    id: 'vendas',
    titulo: 'Vendas & Marketing',
    icone: <Megaphone className="w-4 h-4" />,
    cor: 'bg-pink-500',
    grupos: [
      {
        id: 'horarios',
        label: 'Horários',
        // Sem agregação: métricas têm formatos diferentes (% e R$)
        metricas: [
          { key: 'perc_faturamento_ate_19h', label: '% Fat. até 19h', status: 'auto', fonte: 'eventos_base', calculo: 'Média fat_19h_percent', formato: 'percentual' },
          { key: 'perc_faturamento_apos_22h', label: '% Fat. após 22h', status: 'auto', fonte: 'contahub_fatporhora', calculo: 'Soma após 22h', formato: 'percentual' },
          { key: 'qui_sab_dom', label: 'QUI+SÁB+DOM', status: 'auto', fonte: 'eventos_base', calculo: 'Soma real_r', formato: 'moeda' },
        ]
      },
      {
        id: 'organico',
        label: 'Marketing Orgânico',
        // Sem agregação: métricas têm formatos diferentes (numero e %)
        metricas: [
          { key: 'o_num_posts', label: 'Nº Posts', status: 'manual', fonte: 'Marketing', calculo: 'Manual', formato: 'numero', editavel: true },
          { key: 'o_alcance', label: 'Alcance Orgânico', status: 'manual', fonte: 'Marketing', calculo: 'Manual', formato: 'numero', editavel: true },
          { key: 'o_engajamento', label: 'Engajamento %', status: 'manual', fonte: 'Marketing', calculo: 'Manual', formato: 'percentual', editavel: true },
        ]
      },
      {
        id: 'pago',
        label: 'Marketing Pago',
        // Sem agregação: métricas têm formatos diferentes (moeda, numero, %)
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

// Helper para obter todas as métricas de uma seção (flatten)
const getMetricasSecao = (secao: SecaoConfig): MetricaConfig[] => {
  return secao.grupos.flatMap(g => g.metricas);
};

// Formatador de valores
const formatarValor = (valor: number | null | undefined, formato: string, sufixo?: string): string => {
  if (valor === null || valor === undefined) return '-';
  
  switch (formato) {
    case 'moeda':
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(valor);
    case 'moeda_decimal':
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);
    case 'percentual':
      return `${valor.toFixed(1)}%`;
    case 'decimal':
      // Arredondar para 2 casas decimais (ex: 9.385 → 9.39)
      return (Math.round(valor * 100) / 100).toFixed(2).replace('.', ',') + (sufixo || '');
    default:
      // Números inteiros sem casas decimais, números decimais com até 2 casas
      const valorArredondado = Math.round(valor * 100) / 100;
      const isInteiro = valorArredondado === Math.floor(valorArredondado);
      return new Intl.NumberFormat('pt-BR', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: isInteiro ? 0 : 2 
      }).format(valorArredondado) + (sufixo || '');
  }
};

// Formatador de data curta
const formatarDataCurta = (dataStr: string): string => {
  if (!dataStr) return '';
  const data = new Date(dataStr + 'T12:00:00');
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

// Calcular semanas ISO em um ano
const getSemanasNoAno = (ano: number): number => {
  const dec28 = new Date(ano, 11, 28);
  const dayOfYear = Math.floor((dec28.getTime() - new Date(ano, 0, 1).getTime()) / 86400000) + 1;
  return Math.ceil((dayOfYear + new Date(ano, 0, 1).getDay()) / 7);
};

// Calcular data de início de uma semana ISO
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

// Calcular data de fim de uma semana (6 dias após início)
const getDataFimSemana = (dataInicio: string): string => {
  const data = new Date(dataInicio + 'T12:00:00');
  data.setDate(data.getDate() + 6);
  return data.toISOString().split('T')[0];
};

export default function DesempenhoPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [semanas, setSemanas] = useState<DadosSemana[]>([]);
  const [semanaAtualIdx, setSemanaAtualIdx] = useState<number>(-1);
  const [secoesAbertas, setSecoesAbertas] = useState<Record<string, boolean>>({
    guardrail: true,
    ovt: true,
    produtos: true,
    vendas: true
  });
  // Estado para grupos abertos/fechados (para as subcategorias)
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({});
  // Visão: 'semanal' ou 'mensal'
  const [visao, setVisao] = useState<'semanal' | 'mensal'>('semanal');
  const [editando, setEditando] = useState<{ semanaId: number; campo: string } | null>(null);
  const [valorEdit, setValorEdit] = useState('');
  
  // Toggle grupo aberto/fechado
  const toggleGrupo = useCallback((grupoId: string) => {
    setGruposAbertos(prev => ({ ...prev, [grupoId]: !prev[grupoId] }));
  }, []);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const semanaAtualRef = useRef<HTMLDivElement>(null);

  // Carregar dados (semanas ou meses)
  const carregarSemanas = useCallback(async () => {
    if (!selectedBar || !user) return;
    
    setLoading(true);
    try {
      if (visao === 'mensal') {
        // Carregar dados mensais - desde março/2025 até o mês atual
        const anoAtual = new Date().getFullYear();
        const mesAtual = new Date().getMonth() + 1;
        
        // Gerar lista de meses desde março/2025 até o mês atual
        const mesesParaCarregar: { mes: number; ano: number }[] = [];
        const anoInicio = 2025;
        const mesInicio = 3; // Março
        
        for (let ano = anoInicio; ano <= anoAtual; ano++) {
          const mesInicialDoAno = ano === anoInicio ? mesInicio : 1;
          const mesFinalDoAno = ano === anoAtual ? mesAtual : 12;
          
          for (let mes = mesInicialDoAno; mes <= mesFinalDoAno; mes++) {
            mesesParaCarregar.push({ mes, ano });
          }
        }
        
        // Carregar todos os meses em paralelo
        const promises = mesesParaCarregar.map(({ mes, ano }) =>
          fetch(`/api/estrategico/desempenho/mensal?mes=${mes}&ano=${ano}`, {
            headers: {
              'x-user-data': encodeURIComponent(JSON.stringify({ ...user, bar_id: selectedBar?.id }))
            }
          }).then(r => r.json()).then(data => ({ data, mes, ano }))
        );
        
        const resultados = await Promise.all(promises);
        
        // Ordenar do mais antigo para o mais recente (igual semanal)
        const mesesData: DadosSemana[] = resultados
          .map(({ data, mes, ano }) => ({
            id: ano * 100 + mes, // ID único baseado em ano e mês
            numero_semana: mes, // Usamos numero_semana para armazenar o mês
            ano: ano,
            data_inicio: `${ano}-${String(mes).padStart(2, '0')}-01`,
            data_fim: `${ano}-${String(mes).padStart(2, '0')}-${new Date(ano, mes, 0).getDate()}`,
            ...(data.mes || {})
          } as DadosSemana))
          .sort((a, b) => {
            // Ordenar do mais antigo para o mais recente
            if (a.ano !== b.ano) return a.ano - b.ano;
            return a.numero_semana - b.numero_semana;
          });
        
        setSemanas(mesesData);
        // Encontrar o índice do mês atual
        const idxMesAtual = mesesData.findIndex(m => m.ano === anoAtual && m.numero_semana === mesAtual);
        setSemanaAtualIdx(idxMesAtual >= 0 ? idxMesAtual : 0);
        
      } else {
        // Carregar dados semanais
        const response = await fetch('/api/estrategico/desempenho/todas-semanas', {
          headers: {
            'x-user-data': encodeURIComponent(JSON.stringify({ ...user, bar_id: selectedBar?.id }))
          }
        });

        if (!response.ok) throw new Error('Erro ao carregar dados');
        
        const data = await response.json();
        let semanasCompletas = data.semanas || [];
        
        // Adicionar semanas futuras vazias para permitir scroll (5 semanas à frente)
        if (data.semanaAtual && data.anoAtual) {
          let semanaFutura = data.semanaAtual;
          let anoFuturo = data.anoAtual;
          
          for (let i = 0; i < 5; i++) {
            semanaFutura++;
            const semanasNoAno = getSemanasNoAno(anoFuturo);
            if (semanaFutura > semanasNoAno) {
              semanaFutura = 1;
              anoFuturo++;
            }
            
            // Verificar se já existe
            const jaExiste = semanasCompletas.some((s: DadosSemana) => 
              s.numero_semana === semanaFutura && s.ano === anoFuturo
            );
            
            if (!jaExiste) {
              const dataInicio = getDataInicioSemana(anoFuturo, semanaFutura);
              const dataFim = getDataFimSemana(dataInicio);
              
              semanasCompletas.push({
                id: undefined,
                numero_semana: semanaFutura,
                ano: anoFuturo,
                data_inicio: dataInicio,
                data_fim: dataFim,
                // Todos os valores como null/undefined para indicar "sem dados"
              } as DadosSemana);
            }
          }
          
          // Ordenar por ano e semana
          semanasCompletas.sort((a: DadosSemana, b: DadosSemana) => {
            if (a.ano !== b.ano) return a.ano - b.ano;
            return a.numero_semana - b.numero_semana;
          });
        }
        
        setSemanas(semanasCompletas);
        
        // Encontrar índice da semana atual
        const idx = semanasCompletas.findIndex((s: DadosSemana) => 
          s.numero_semana === data.semanaAtual && s.ano === data.anoAtual
        );
        setSemanaAtualIdx(idx >= 0 ? idx : semanasCompletas.length - 1 || 0);
      }
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({ title: 'Erro', description: 'Falha ao carregar dados', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [selectedBar?.id, user?.id, visao]);

  // Scroll para semana atual após carregar - deixar semana atual mais ao centro-direita
  useEffect(() => {
    if (!loading && scrollContainerRef.current && semanaAtualRef.current) {
      const container = scrollContainerRef.current;
      const element = semanaAtualRef.current;
      const containerWidth = container.offsetWidth;
      const elementLeft = element.offsetLeft;
      const elementWidth = element.offsetWidth;
      
      // Scroll para deixar a semana atual visível com algumas semanas à direita
      // Posicionar a semana atual a ~70% da largura visível (mais ao centro)
      container.scrollLeft = elementLeft - (containerWidth * 0.6) + (elementWidth / 2);
    }
  }, [loading, semanaAtualIdx]);

  // Recarregar quando visão mudar
  useEffect(() => {
    carregarSemanas();
  }, [visao]);

  // Toggle seção
  const toggleSecao = (id: string) => {
    setSecoesAbertas(prev => ({ ...prev, [id]: !prev[id] }));
  };
  
  // Helper para formatar header de coluna (semana ou mês)
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

  // Salvar métrica
  const salvarMetrica = async (semanaId: number, campo: string) => {
    console.log('🔵 salvarMetrica chamada:', { semanaId, campo, valorEdit });
    
    if (!semanaId) {
      console.error('❌ semanaId está undefined/null');
      toast({ title: 'Erro', description: 'ID da semana não encontrado', variant: 'destructive' });
      return;
    }
    
    const numValue = parseFloat(valorEdit.replace(',', '.'));
    console.log('🔵 Valor parseado:', numValue);
    
    if (isNaN(numValue)) {
      setEditando(null);
      toast({ title: 'Erro', description: 'Valor inválido', variant: 'destructive' });
      return;
    }
    
    if (!selectedBar?.id) {
      toast({ title: 'Erro', description: 'Selecione um bar primeiro', variant: 'destructive' });
      return;
    }
    
    console.log('🔵 Enviando para API:', { id: semanaId, [campo]: numValue, bar_id: selectedBar.id });
    
    try {
      const response = await fetch('/api/gestao/desempenho', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-data': encodeURIComponent(JSON.stringify({ ...user, bar_id: selectedBar.id }))
        },
        body: JSON.stringify({ id: semanaId, [campo]: numValue })
      });

      const result = await response.json();
      console.log('🔵 Resposta da API:', result);
      
      if (!response.ok) {
        console.error('❌ Erro ao salvar:', result);
        throw new Error(result.error || 'Erro ao salvar');
      }
      
      toast({ title: 'Salvo!', description: 'Valor atualizado' });
      setEditando(null);
      carregarSemanas();
    } catch (error) {
      console.error('❌ Erro na requisição:', error);
      toast({ title: 'Erro', description: error instanceof Error ? error.message : 'Falha ao salvar', variant: 'destructive' });
    }
  };

  useEffect(() => {
    setPageTitle('Desempenho');
  }, [setPageTitle]);

  useEffect(() => {
    carregarSemanas();
  }, [carregarSemanas]);

  if (!selectedBar) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="bg-white dark:bg-gray-800 p-8 text-center max-w-md">
          <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Selecione um Bar
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Escolha um bar no seletor acima para visualizar os indicadores.
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
              
              <div className="flex items-center gap-2">
                <Table2 className="w-5 h-5 text-gray-500" />
                <span className="font-semibold text-gray-900 dark:text-white">
                  {semanas.length} {visao === 'semanal' ? 'semanas' : 'meses'} carregados
                </span>
              </div>
            </div>
            
            {/* Legenda */}
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-gray-600 dark:text-gray-400">Automático</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-gray-600 dark:text-gray-400">Manual</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-gray-600 dark:text-gray-400">Verificar</span>
                </div>
              </div>
              
              <Button variant="outline" size="sm" onClick={carregarSemanas} disabled={loading} className="gap-2">
                <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
                Atualizar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo - Layout Excel com scroll horizontal e vertical */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-auto"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="flex" style={{ minWidth: 'max-content' }}>
          {/* Coluna fixa - Labels dos indicadores */}
          <div className="sticky left-0 z-20 flex-shrink-0 w-[200px] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-md">
          {/* Header vazio para alinhar com headers das semanas - sticky no topo */}
          <div className="h-[72px] border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex items-center justify-center sticky top-0 z-30">
            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 text-center">INDICADOR</span>
          </div>
          
          {/* Labels das métricas por seção COM GRUPOS */}
          {SECOES.map(secao => (
            <div key={secao.id}>
              {/* Header da seção */}
              <div 
                className={cn("flex items-center gap-2 px-3 cursor-pointer", secao.cor)}
                style={{ height: '40px' }}
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
              
              {/* Grupos de métricas */}
              {secoesAbertas[secao.id] && secao.grupos.map(grupo => {
                const hierarquico = isGrupoHierarquico(grupo);
                const metricasParaMostrar = hierarquico ? grupo.metricas.slice(1) : grupo.metricas;
                
                return (
                  <div key={grupo.id}>
                    {/* Header do grupo com bolinha de status + expansão */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div 
                            className="flex items-center gap-2 px-3 bg-gray-50 dark:bg-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600"
                            style={{ height: '36px' }}
                            onClick={() => toggleGrupo(`${secao.id}-${grupo.id}`)}
                          >
                            {gruposAbertos[`${secao.id}-${grupo.id}`] ? (
                              <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            )}
                            {/* Bolinha só aparece em grupos hierárquicos (onde a primeira métrica representa o grupo) */}
                            {hierarquico && (
                              <div className={cn("w-2 h-2 rounded-full flex-shrink-0", STATUS_COLORS[grupo.metricas[0]?.status || 'auto'].dot)} />
                            )}
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{grupo.label}</span>
                            {!hierarquico && (
                              <span className="text-[10px] text-gray-400 dark:text-gray-500">({grupo.metricas.length})</span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs p-3 bg-gray-50 dark:bg-gray-800">
                          <div className="space-y-1">
                            {hierarquico ? (
                              <>
                                <div className={cn("font-semibold text-sm", STATUS_COLORS[grupo.metricas[0]?.status || 'auto'].text)}>
                                  {grupo.metricas[0]?.status === 'auto' && 'Automático'}
                                  {grupo.metricas[0]?.status === 'manual' && 'Manual'}
                                  {grupo.metricas[0]?.status === 'nao_confiavel' && 'Não Confiável'}
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-300">
                                  <strong>Fonte:</strong> {grupo.metricas[0]?.fonte}
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-300">
                                  <strong>Cálculo:</strong> {grupo.metricas[0]?.calculo}
                                </div>
                              </>
                            ) : (
                              <div className="text-xs text-gray-600 dark:text-gray-300">
                                Clique para expandir {grupo.metricas.length} indicadores
                              </div>
                            )}
                            {metricasParaMostrar.length > 0 && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-200 dark:border-gray-600 mt-1">
                                Clique para ver {metricasParaMostrar.length} {hierarquico ? 'sub-indicador(es)' : 'indicador(es)'}
                              </div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    {/* Sub-métricas do grupo (apenas quando expandido) */}
                    {gruposAbertos[`${secao.id}-${grupo.id}`] && metricasParaMostrar.map((metrica) => (
                      <TooltipProvider key={metrica.key}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div 
                              className="flex items-center gap-2 px-6 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-help bg-gray-50/50 dark:bg-gray-800/50"
                              style={{ height: '32px' }}
                            >
                              <div className={cn("w-2 h-2 rounded-full flex-shrink-0", STATUS_COLORS[metrica.status].dot)} />
                              <span className="text-xs text-gray-500 dark:text-gray-400 truncate leading-none">
                                {hierarquico ? '└ ' : ''}{metrica.label}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right" className={cn("max-w-xs p-3", STATUS_COLORS[metrica.status].bg)}>
                            <div className="space-y-1">
                              <div className={cn("font-semibold text-sm", STATUS_COLORS[metrica.status].text)}>
                                {metrica.status === 'auto' && 'Automático'}
                                {metrica.status === 'manual' && 'Manual'}
                                {metrica.status === 'nao_confiavel' && 'Não Confiável'}
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
                );
              })}
            </div>
          ))}
        </div>

          {/* Área das Semanas */}
          <div className="flex-1">
          {loading ? (
            <div className="flex gap-0">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[120px]">
                  <Skeleton className="h-[72px] rounded-none" />
                  {[...Array(40)].map((_, j) => (
                    <Skeleton key={j} className="h-9 rounded-none" />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="inline-flex" style={{ minWidth: 'max-content' }}>
              {semanas.map((semana, idx) => {
                const isAtual = idx === semanaAtualIdx;
                
                return (
                  <div 
                    key={`${semana.ano}-${semana.numero_semana}`}
                    ref={isAtual ? semanaAtualRef : undefined}
                    className={cn(
                      "flex-shrink-0 w-[120px] border-r border-gray-200 dark:border-gray-700",
                      isAtual && "bg-emerald-50 dark:bg-emerald-900/20"
                    )}
                  >
                    {/* Header da semana - sticky no topo */}
                    <div className={cn(
                      "h-[72px] border-b border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center px-1 sticky top-0 z-10",
                      isAtual ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-gray-50 dark:bg-gray-700"
                    )}>
                      {(() => {
                        const header = formatarHeaderColuna(semana);
                        return (
                          <>
                            <span className={cn(
                              "text-sm font-bold text-center",
                              isAtual ? "text-emerald-700 dark:text-emerald-400" : "text-gray-700 dark:text-gray-300"
                            )}>
                              {header.titulo}
                            </span>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 text-center">
                              {header.subtitulo}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                    
                    {/* Valores por seção COM GRUPOS */}
                    {SECOES.map(secao => (
                      <div key={secao.id}>
                        {/* Espaço para header da seção */}
                        <div 
                          className={cn(secao.cor, "opacity-80")} 
                          style={{ height: '40px' }}
                        />
                        
                        {/* Valores dos grupos */}
                        {secoesAbertas[secao.id] && secao.grupos.map(grupo => {
                          const hierarquico = isGrupoHierarquico(grupo);
                          const metricaPrincipal = grupo.metricas[0];
                          const metricasParaMostrar = hierarquico ? grupo.metricas.slice(1) : grupo.metricas;
                          
                          // Para grupos hierárquicos, mostra o valor da primeira métrica no header
                          const valorPrincipal = hierarquico && metricaPrincipal ? (semana as any)[metricaPrincipal.key] : null;
                          const valorPessoasPrincipal = hierarquico && metricaPrincipal?.keyPessoas ? (semana as any)[metricaPrincipal.keyPessoas] : null;
                          const isEditandoPrincipal = hierarquico && editando?.semanaId === semana.id && editando?.campo === metricaPrincipal?.key;
                          
                          // Para grupos planos, calcula o valor agregado
                          const valorAgregado = !hierarquico ? calcularValorAgregado(grupo, semana) : null;
                          const valorAgregadoFormatado = valorAgregado !== null && grupo.agregacao
                            ? formatarValor(valorAgregado, grupo.agregacao.formato, grupo.agregacao.sufixo)
                            : '-';
                          
                          const valorPrincipalFormatado = hierarquico && metricaPrincipal?.formato === 'reservas' 
                            ? (valorPrincipal !== null && valorPrincipal !== undefined 
                                ? `${Math.round(valorPrincipal)}/${valorPessoasPrincipal !== null && valorPessoasPrincipal !== undefined ? Math.round(valorPessoasPrincipal) : '-'}` 
                                : '-')
                            : hierarquico ? formatarValor(valorPrincipal, metricaPrincipal?.formato || 'numero', metricaPrincipal?.sufixo) : null;
                          
                          return (
                            <div key={grupo.id}>
                              {/* Header do grupo - valor para hierárquicos OU agregado para planos */}
                              <div 
                                className={cn(
                                  "relative flex items-center justify-center px-2 border-b border-gray-200 dark:border-gray-600 group",
                                  isAtual ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-gray-50 dark:bg-gray-800"
                                )}
                                style={{ height: '36px' }}
                              >
                                {hierarquico ? (
                                  // Grupo hierárquico: mostra valor editável
                                  isEditandoPrincipal ? (
                                    <div className="flex items-center gap-1">
                                      <Input
                                        type="text"
                                        value={valorEdit}
                                        onChange={(e) => setValorEdit(e.target.value)}
                                        className="w-16 h-6 text-xs p-1"
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') salvarMetrica(semana.id!, metricaPrincipal.key);
                                          if (e.key === 'Escape') setEditando(null);
                                        }}
                                      />
                                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => salvarMetrica(semana.id!, metricaPrincipal.key)}>
                                        <Check className="h-3 w-3 text-emerald-600" />
                                      </Button>
                                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setEditando(null)}>
                                        <X className="h-3 w-3 text-red-600" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <span className="text-xs font-medium text-gray-900 dark:text-white text-center">
                                      {valorPrincipalFormatado}
                                    </span>
                                  )
                                ) : (
                                  // Grupo plano: mostra valor agregado ou "..." se não tem agregação
                                  grupo.agregacao ? (
                                    <span className="text-xs font-medium text-gray-900 dark:text-white text-center">
                                      {valorAgregadoFormatado}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                      ...
                                    </span>
                                  )
                                )}
                                {hierarquico && !isEditandoPrincipal && metricaPrincipal?.editavel && semana.id && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="absolute right-0 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => {
                                      setEditando({ semanaId: semana.id!, campo: metricaPrincipal.key });
                                      setValorEdit(valorPrincipal?.toString().replace('.', ',') || '');
                                    }}
                                  >
                                    <Pencil className="h-3 w-3 text-blue-600" />
                                  </Button>
                                )}
                              </div>
                              
                              {/* Valores das métricas (quando expandido) */}
                              {gruposAbertos[`${secao.id}-${grupo.id}`] && metricasParaMostrar.map((metrica) => {
                                const valor = (semana as any)[metrica.key];
                                const valorPessoas = metrica.keyPessoas ? (semana as any)[metrica.keyPessoas] : null;
                                const isEditandoCell = editando?.semanaId === semana.id && editando?.campo === metrica.key;
                                
                                const valorFormatado = metrica.formato === 'reservas' 
                                  ? (valor !== null && valor !== undefined 
                                      ? `${Math.round(valor)}/${valorPessoas !== null && valorPessoas !== undefined ? Math.round(valorPessoas) : '-'}` 
                                      : '-')
                                  : formatarValor(valor, metrica.formato, metrica.sufixo);
                                
                                return (
                                  <div 
                                    key={metrica.key}
                                    className={cn(
                                      "relative flex items-center justify-center px-2 border-b border-gray-100 dark:border-gray-700 group",
                                      isAtual ? "bg-emerald-50/30 dark:bg-emerald-900/10" : "bg-gray-50/50 dark:bg-gray-800/50"
                                    )}
                                    style={{ height: '32px' }}
                                  >
                                    {isEditandoCell ? (
                                      <div className="flex items-center gap-1">
                                        <Input
                                          type="text"
                                          value={valorEdit}
                                          onChange={(e) => setValorEdit(e.target.value)}
                                          className="w-16 h-6 text-xs p-1"
                                          autoFocus
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') salvarMetrica(semana.id!, metrica.key);
                                            if (e.key === 'Escape') setEditando(null);
                                          }}
                                        />
                                        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => salvarMetrica(semana.id!, metrica.key)}>
                                          <Check className="h-3 w-3 text-emerald-600" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setEditando(null)}>
                                          <X className="h-3 w-3 text-red-600" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-600 dark:text-gray-400 text-center">
                                        {valorFormatado}
                                      </span>
                                    )}
                                    {!isEditandoCell && metrica.editavel && semana.id && (
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="absolute right-0 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => {
                                          setEditando({ semanaId: semana.id!, campo: metrica.key });
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
                          );
                        })}
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
    </div>
  );
}
