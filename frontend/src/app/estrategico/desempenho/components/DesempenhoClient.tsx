'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Target,
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,
  X,
  Table2,
  Factory,
  UserCog,
  Calculator,
  ArrowUp,
  ArrowDown,
  Loader2
} from 'lucide-react';
import { useBar } from '@/contexts/BarContext';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { DadosSemana, SecaoConfig, GrupoMetricas, MetricaConfig, TipoAgregacao, MetasDesempenhoMap } from '../types';

// ============================================================================
// CONFIGURAÇÃO UI (SECOES, ETC)
// ============================================================================

// Cores por status
const STATUS_COLORS = {
  auto: { dot: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  manual: { dot: 'bg-blue-500', text: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  nao_confiavel: { dot: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' }
};

const getSecoesConfig = (barId?: number): SecaoConfig[] => [
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
          { key: 'faturamento_total', label: 'Faturamento Total', status: 'auto', fonte: 'eventos_base (consolidado)', calculo: 'Faturamento bruto - Conta Assinada', formato: 'moeda', temTooltipFaturamento: true },
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
          // Deboche usa Ticket Médio manual (Stone) em vez do automático (ContaHub)
          ...(barId === 4 ? [
            { key: 'ticket_medio', label: 'Ticket Médio', status: 'manual' as const, fonte: 'Stone (manual)', calculo: 'Inserido manualmente da Stone', formato: 'moeda_decimal' as const, editavel: true },
          ] : [
            { key: 'ticket_medio', label: 'Ticket Médio', status: 'auto' as const, fonte: 'eventos_base (consolidado)', calculo: 'Faturamento Total / Público Total', formato: 'moeda_decimal' as const },
          ]),
          { key: 'tm_entrada', label: 'TM Entrada', status: 'auto', fonte: 'eventos_base (consolidado)', calculo: 'Fat. Entrada / Público Total', formato: 'moeda_decimal', indentado: true },
          { key: 'tm_bar', label: 'TM Bar', status: 'auto', fonte: 'eventos_base (consolidado)', calculo: 'Fat. Bar / Público Total', formato: 'moeda_decimal', indentado: true },
        ]
      },
      {
        id: 'custos',
        label: 'Custos',
        metricas: [
          { key: 'cmo', label: 'CMO %', status: 'manual', fonte: 'Simulação CMO (manual)', calculo: 'CMO Total / Faturamento × 100 (inserido manualmente até automatização)', formato: 'percentual', inverso: true, editavel: true },
          { key: 'custo_atracao_faturamento', label: 'Atração/Fat.', status: 'auto', fonte: 'eventos_base (c_art)', calculo: 'Soma c_art eventos / Faturamento × 100', formato: 'percentual', inverso: true, temTooltipAtracao: true },
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
          // Clientes Ativos e % Novos Clientes ocultos para Deboche (bar_id=4) até implementar Zig
          ...(barId !== 4 ? [
            { key: 'clientes_ativos', label: 'Clientes Ativos', status: 'auto' as const, fonte: 'ContaHub', calculo: 'Clientes únicos com 2+ visitas nos últimos 90 dias (até o último dia do período)', formato: 'numero' as const },
          ] : []),
          { key: 'clientes_atendidos', label: 'Visitas', status: 'auto', fonte: 'eventos_base (consolidado)', calculo: 'Soma de clientes_real de todos os eventos (Sympla + Yuzer + ContaHub)', formato: 'numero' },
          ...(barId !== 4 ? [
            { key: 'perc_clientes_novos', label: '% Novos Clientes', status: 'auto' as const, fonte: 'Stored Procedure', calculo: 'Clientes novos / Total de visitas', formato: 'percentual' as const },
          ] : []),
        ]
      },
      {
        id: 'reservas',
        label: 'Reservas',
        metricas: [
          // Deboche usa campo manual para Reservas (até implementar API GetIn)
          ...(barId === 4 ? [
            { key: 'mesas_totais', label: 'Reservas Realizadas', status: 'manual' as const, fonte: 'Manual', calculo: 'Inserido manualmente até API GetIn', formato: 'reservas' as const, keyPessoas: 'reservas_totais', editavel: true },
            { key: 'mesas_presentes', label: 'Reservas Presentes', status: 'manual' as const, fonte: 'Manual', calculo: 'Inserido manualmente até API GetIn', formato: 'reservas' as const, keyPessoas: 'reservas_presentes', editavel: true },
          ] : [
            { key: 'mesas_totais', label: 'Reservas Realizadas', status: 'auto' as const, fonte: 'GetIn', calculo: 'Mesas reservadas / Total de pessoas reservadas', formato: 'reservas' as const, keyPessoas: 'reservas_totais' },
            { key: 'mesas_presentes', label: 'Reservas Presentes', status: 'auto' as const, fonte: 'GetIn', calculo: 'Mesas presentes / Pessoas presentes', formato: 'reservas' as const, keyPessoas: 'reservas_presentes' },
          ]),
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
          { key: 'avaliacoes_5_google_trip', label: 'Avaliações 5★ Google', status: 'auto', fonte: 'Google Reviews (Apify)', calculo: 'Contagem de avaliações 5 estrelas no período', formato: 'numero', temTooltipGoogle5Estrelas: true, totalKey: 'google_reviews_total' },
          { key: 'media_avaliacoes_google', label: 'Média Google', status: 'auto', fonte: 'Google Reviews (Apify)', calculo: 'Média das estrelas no período', formato: 'decimal', temTooltipGoogle: true },
        ]
      },
      {
        id: 'nps',
        label: 'NPS',
        metricas: [
          { key: 'nps_digital', label: 'NPS Digital', status: 'auto', fonte: 'Falaê (pesquisa = NPS Digital)', calculo: '% Promotores - % Detratores (link randômico pós-visita)', formato: 'numero', temTooltipDetalhes: true, respostasKey: 'nps_digital_respostas' },
          { key: 'nps_salao', label: 'NPS Salão', status: 'auto', fonte: 'Falaê (pesquisa = Salão)', calculo: '% Promotores - % Detratores (pesquisa presencial no salão)', formato: 'numero', temTooltipDetalhes: true, respostasKey: 'nps_salao_respostas' },
          { key: 'nps_reservas', label: 'NPS Reservas', status: 'manual', fonte: 'GetIn (aguardando API)', calculo: '% Promotores - % Detratores (avaliação sobre reservas)', formato: 'numero', editavel: true },
          { key: 'nota_felicidade_equipe', label: 'NPS Felicidade', status: 'manual', fonte: 'Planilha Equipe (Andreia)', calculo: 'Pesquisa de felicidade da equipe', formato: 'numero', editavel: true },
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
          { key: 'perc_bebidas', label: '% Bebidas', status: 'auto', fonte: 'eventos_base', calculo: 'Calculado por categoria_mix canônica (BEBIDA)', formato: 'percentual' },
          { key: 'perc_drinks', label: '% Drinks', status: 'auto', fonte: 'eventos_base', calculo: 'Calculado por categoria_mix canônica (DRINK)', formato: 'percentual' },
          { key: 'perc_comida', label: '% Comida', status: 'auto', fonte: 'eventos_base', calculo: 'Calculado por categoria_mix canônica (COMIDA)', formato: 'percentual' },
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
          { key: 'atrasinhos_bar', label: 'Atrasinho Drinks', status: 'auto', fonte: 'contahub_tempo', calculo: 't0_t3 > 5 min', formato: 'numero', inverso: true, temTooltipDetalhes: true, detalhesKey: 'atrasinhos_detalhes', keyPercentual: 'atrasinhos_bar_perc' },
          { key: 'atrasinhos_cozinha', label: 'Atrasinho Comida', status: 'auto', fonte: 'contahub_tempo', calculo: 't0_t2 > 15 min', formato: 'numero', inverso: true, temTooltipDetalhes: true, detalhesKey: 'atrasinhos_detalhes', keyPercentual: 'atrasinhos_cozinha_perc' },
          { key: 'atrasos_bar', label: 'Atrasão Drinks', status: 'auto', fonte: 'contahub_tempo', calculo: 't0_t3 > 10 min', formato: 'numero', inverso: true, temTooltipDetalhes: true, keyPercentual: 'atrasos_bar_perc' },
          { key: 'atrasos_cozinha', label: 'Atrasão Comida', status: 'auto', fonte: 'contahub_tempo', calculo: 't0_t2 > 20 min', formato: 'numero', inverso: true, temTooltipDetalhes: true, keyPercentual: 'atrasos_cozinha_perc' },
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
          { key: 'perc_faturamento_ate_19h', label: '% Fat. até 19h', status: 'auto' as const, fonte: 'eventos_base', calculo: 'Média fat_19h_percent', formato: 'percentual' as const },
          { key: 'perc_faturamento_apos_22h', label: '% Fat. após 22h', status: 'auto' as const, fonte: 'contahub_fatporhora', calculo: 'Soma após 22h', formato: 'percentual' as const },
          // Indicadores diferentes por bar: Ordinário (QUI+SÁB+DOM) vs Deboche (TER+QUA+QUI e SEX+SÁB)
          ...(barId === 4 ? [
            { key: 'ter_qua_qui', label: 'TER+QUA+QUI', status: 'auto' as const, fonte: 'eventos_base', calculo: 'Soma real_r terça/quarta/quinta', formato: 'moeda' as const },
            { key: 'sex_sab', label: 'SEX+SÁB', status: 'auto' as const, fonte: 'eventos_base', calculo: 'Soma real_r sexta/sábado', formato: 'moeda' as const },
            { key: 'perc_happy_hour', label: '% PROMO HH', status: 'auto' as const, fonte: 'contahub_analitico', calculo: 'grp_desc=Happy Hour / Total vendas', formato: 'percentual' as const },
          ] : [
            { key: 'qui_sab_dom', label: 'QUI+SÁB+DOM', status: 'auto' as const, fonte: 'eventos_base', calculo: 'Soma real_r', formato: 'moeda' as const },
          ]),
          { key: 'conta_assinada_valor', label: 'Conta Assinada', status: 'auto' as const, fonte: 'faturamento_pagamentos', calculo: 'Soma meio=Conta Assinada', formato: 'moeda_com_percentual' as const, percentualKey: 'conta_assinada_perc' },
          { key: 'descontos_valor', label: 'Descontos', status: 'auto' as const, fonte: 'visitas', calculo: 'Soma valor_desconto', formato: 'moeda_com_percentual' as const, percentualKey: 'descontos_perc', temTooltipDetalhes: true },
          { key: 'cancelamentos', label: 'Cancelamentos', status: 'auto' as const, fonte: 'contahub_cancelamentos', calculo: 'Soma custototal', formato: 'moeda' as const, temTooltipDetalhes: true, detalhesKey: 'cancelamentos_detalhes' },
          // Couvert Total e Atrações/Eventos para comparação (Deboche) - APÓS Cancelamentos
          ...(barId === 4 ? [
            { key: 'couvert_atracoes', label: 'Couvert Total R$', status: 'auto' as const, fonte: 'visitas', calculo: 'Soma valor_couvert', formato: 'moeda' as const },
            { key: 'atracoes_eventos', label: 'Atrações/Eventos R$', status: 'auto' as const, fonte: 'Conta Azul', calculo: 'Soma lançamentos categoria atração', formato: 'moeda' as const },
          ] : []),
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
        label: '[O] Orgânico',
        metricas: [
          { key: 'o_num_posts', label: '[O] Nº de Posts', status: 'manual', fonte: 'Instagram', calculo: 'Manual', formato: 'numero', editavel: true },
          { key: 'o_alcance', label: '[O] Alcance', status: 'manual', fonte: 'Instagram', calculo: 'Manual', formato: 'numero', editavel: true },
          { key: 'o_interacao', label: '[O] Interação', status: 'manual', fonte: 'Instagram', calculo: 'Manual', formato: 'numero', editavel: true },
          { key: 'o_compartilhamento', label: '[O] Compartilhamento', status: 'manual', fonte: 'Instagram', calculo: 'Manual', formato: 'numero', editavel: true },
          { key: 'o_engajamento', label: '[O] Engajamento', status: 'manual', fonte: 'Instagram', calculo: 'Manual', formato: 'percentual', editavel: true },
          { key: 'o_num_stories', label: '[O] Nº Stories', status: 'manual', fonte: 'Instagram', calculo: 'Manual', formato: 'numero', editavel: true },
          { key: 'o_visu_stories', label: '[O] Visu Stories', status: 'manual', fonte: 'Instagram', calculo: 'Manual', formato: 'numero', editavel: true },
        ]
      },
      {
        id: 'meta_ads',
        label: '[M] Meta Ads',
        metricas: [
          { key: 'm_valor_investido', label: '[M] Valor Investido', status: 'manual', fonte: 'Meta Ads', calculo: 'Manual', formato: 'moeda', editavel: true },
          { key: 'm_alcance', label: '[M] Alcance', status: 'manual', fonte: 'Meta Ads', calculo: 'Manual', formato: 'numero', editavel: true },
          { key: 'm_frequencia', label: '[M] Frequência', status: 'manual', fonte: 'Meta Ads', calculo: 'Manual', formato: 'decimal', editavel: true },
          { key: 'm_cpm', label: '[M] CPM (Custo por Visu)', status: 'manual', fonte: 'Meta Ads', calculo: 'Manual', formato: 'moeda_decimal', editavel: true },
          { key: 'm_cliques', label: '[M] Cliques', status: 'manual', fonte: 'Meta Ads', calculo: 'Manual', formato: 'numero', editavel: true },
          { key: 'm_ctr', label: '[M] CTR (Taxa de Clique)', status: 'manual', fonte: 'Meta Ads', calculo: 'Manual', formato: 'percentual', editavel: true },
          { key: 'm_cpc', label: '[M] Custo por Clique', status: 'manual', fonte: 'Meta Ads', calculo: 'Manual', formato: 'moeda_decimal', editavel: true },
          { key: 'm_conversas_iniciadas', label: '[M] Conversas Iniciadas', status: 'manual', fonte: 'Meta Ads', calculo: 'Manual', formato: 'numero', editavel: true },
        ]
      },
      {
        id: 'gmn',
        label: '[GMN] Google Meu Negócio',
        metricas: [
          { key: 'gmn_total_visualizacoes', label: '[GMN] Total de Visualizações', status: 'manual', fonte: 'Google Meu Negócio', calculo: 'Manual', formato: 'numero', editavel: true },
          { key: 'gmn_total_acoes', label: '[GMN] Total de Ações', status: 'manual', fonte: 'Google Meu Negócio', calculo: 'Manual', formato: 'numero', editavel: true },
          { key: 'gmn_solicitacoes_rotas', label: '[GMN] Rotas', status: 'manual', fonte: 'Google Meu Negócio', calculo: 'Manual', formato: 'numero', editavel: true },
        ]
      },
      {
        id: 'gads',
        label: '[GADs] Google Ads',
        metricas: [
          { key: 'g_valor_investido', label: '[GADs] Valor Investido', status: 'manual', fonte: 'Google Ads', calculo: 'Manual', formato: 'moeda', editavel: true },
          { key: 'g_impressoes', label: '[GADs] Total de Impressões', status: 'manual', fonte: 'Google Ads', calculo: 'Manual', formato: 'numero', editavel: true },
          { key: 'g_cliques', label: '[GADs] Total de Cliques', status: 'manual', fonte: 'Google Ads', calculo: 'Manual', formato: 'numero', editavel: true },
          { key: 'g_ctr', label: '[GADs] CTR', status: 'manual', fonte: 'Google Ads', calculo: 'Manual', formato: 'percentual', editavel: true },
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

const calcularValorAgregado = (grupo: GrupoMetricas, semana: DadosSemana): number | null => {
  if (!grupo.agregacao) return null;
  
  if (grupo.agregacao.tipo === 'fixa' && grupo.agregacao.valorFixo !== undefined) {
    return grupo.agregacao.valorFixo;
  }
  
  if (grupo.agregacao.tipo === 'campo' && grupo.agregacao.campo) {
    const valor = semana[grupo.agregacao.campo as keyof DadosSemana];
    return valor !== null && valor !== undefined ? Number(valor) : null;
  }
  
  const valores: number[] = [];
  for (const metrica of grupo.metricas) {
    const valor = semana[metrica.key as keyof DadosSemana];
    if (valor !== null && valor !== undefined && typeof valor === 'number') {
      valores.push(valor);
    }
  }
  
  if (valores.length === 0) return null;
  
  if (grupo.agregacao.tipo === 'media') return valores.reduce((a, b) => a + b, 0) / valores.length;
  if (grupo.agregacao.tipo === 'soma') return valores.reduce((a, b) => a + b, 0);
  
  return null;
};

/** Coerção para cálculos numéricos em células (valores vindos de `getValorComOverride`). */
function numeroMetrica(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

const formatarValor = (valor: unknown, formato: string, sufixo?: string): string => {
  if (valor !== null && typeof valor === 'object') return '-';
  if (typeof valor === 'boolean') return '-';
  const num =
    typeof valor === 'string' ? parseFloat(valor) : typeof valor === 'number' ? valor : NaN;
  if (valor === null || valor === undefined || Number.isNaN(num)) return '-';

  switch (formato) {
    case 'moeda':
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(num);
    case 'moeda_decimal':
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    case 'percentual':
      return `${num.toFixed(1)}%`;
    case 'decimal':
      return (Math.round(num * 100) / 100).toFixed(2).replace('.', ',') + (sufixo || '');
    default: {
      const valorArredondado = Math.round(num * 100) / 100;
      const isInteiro = valorArredondado === Math.floor(valorArredondado);
      return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: isInteiro ? 0 : 2 }).format(valorArredondado) + (sufixo || '');
    }
  }
};

// Verifica se o valor atingiu a meta e retorna a cor
const verificarMeta = (valor: unknown, metricaKey: string, metas: MetasDesempenhoMap): 'verde' | 'vermelho' | 'neutro' => {
  if (valor === null || valor === undefined || !metas[metricaKey]) return 'neutro';
  
  const meta = metas[metricaKey];
  const num = typeof valor === 'number' ? valor : typeof valor === 'string' ? parseFloat(valor) : NaN;
  
  if (isNaN(num)) return 'neutro';
  
  switch (meta.operador) {
    case '>=':
      return num >= meta.valor ? 'verde' : 'vermelho';
    case '<=':
      return num <= meta.valor ? 'verde' : 'vermelho';
    case '>':
      return num > meta.valor ? 'verde' : 'vermelho';
    case '<':
      return num < meta.valor ? 'verde' : 'vermelho';
    case '=':
      return num === meta.valor ? 'verde' : 'vermelho';
    default:
      return 'neutro';
  }
};

const getCorMeta = (status: 'verde' | 'vermelho' | 'neutro'): string => {
  switch (status) {
    case 'verde':
      return 'text-emerald-600 dark:text-emerald-400 font-semibold';
    case 'vermelho':
      return 'text-red-600 dark:text-red-400 font-semibold';
    default:
      return 'text-gray-600 dark:text-gray-400';
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

  // Fonte de verdade: contexto (client) > prop (server)
  // Resolve race condition onde cookie server-side fica dessincronizado do contexto client
  const effectiveBarId = selectedBar?.id || barId;

  // Gerar configuração de seções baseada no barId
  const SECOES = useMemo(() => getSecoesConfig(effectiveBarId), [effectiveBarId]);
  
  const [loading, setLoading] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [semanaAtualIdx, setSemanaAtualIdx] = useState<number>(-1);
  const [metas, setMetas] = useState<MetasDesempenhoMap>({});
  const [metasOrigens, setMetasOrigens] = useState<Record<string, { tipo: 'definida' | 'herdada'; semana?: number; ano?: number }>>({});
  const [metasModalAberto, setMetasModalAberto] = useState(false);
  const [salvandoMetas, setSalvandoMetas] = useState(false);
  const [metasEditValues, setMetasEditValues] = useState<Record<string, string>>({});
  
  const [secoesAbertas, setSecoesAbertas] = useState<Record<string, boolean>>({
    guardrail: true,
    ovt: true,
    qualidade: true,
    produtos: true,
    vendas: true,
    marketing: true,
    producao: true,
    rh: true,
    financeiro: true
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
  const [valorEditPessoas, setValorEditPessoas] = useState('');
  const [valoresLocais, setValoresLocais] = useState<Record<string, Record<string, number>>>({});
  const [falaeDialog, setFalaeDialog] = useState<{
    aberto: boolean;
    periodo: string;
    npsScore: number | null;
    totalRespostas: number;
    promotores: number;
    neutros: number;
    detratores: number;
    avaliacoes: { nome: string; media: number; total: number }[];
    comentarios: {
      nps: number;
      comentario: string;
      data: string;
      tipo: 'promotor' | 'neutro' | 'detrator';
      avaliacoes?: { nome: string; nota: number }[];
    }[];
  }>({
    aberto: false,
    periodo: '',
    npsScore: null,
    totalRespostas: 0,
    promotores: 0,
    neutros: 0,
    detratores: 0,
    avaliacoes: [],
    comentarios: [],
  });
  const [filtroComentarioFalae, setFiltroComentarioFalae] = useState<'todos' | 'detrator' | 'neutro' | 'promotor'>('todos');
  
  // Estado do modal de Google Reviews
  const [googleReviewsDialog, setGoogleReviewsDialog] = useState<{
    aberto: boolean;
    loading: boolean;
    titulo: string;
    periodo: string;
    dataInicio: string;
    dataFim: string;
    filtroEstrelas: number | null;
    total: number;
    media: number;
    distribuicao: Record<number, number>;
    porDia: { data: string; diaSemana: string; total: number; media: number; distribuicao: Record<number, number> }[];
    elogios: string[];
    criticas: string[];
    reviewsPositivas: { nome: string; stars: number; texto: string; data: string; tipo: string }[];
    reviewsNegativas: { nome: string; stars: number; texto: string; data: string; tipo: string }[];
    reviewsNeutras: { nome: string; stars: number; texto: string; data: string; tipo: string }[];
  }>({
    aberto: false,
    loading: false,
    titulo: 'Detalhes Google Reviews',
    periodo: '',
    dataInicio: '',
    dataFim: '',
    filtroEstrelas: null,
    total: 0,
    media: 0,
    distribuicao: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    porDia: [],
    elogios: [],
    criticas: [],
    reviewsPositivas: [],
    reviewsNegativas: [],
    reviewsNeutras: [],
  });
  const [filtroReviewGoogle, setFiltroReviewGoogle] = useState<'todos' | 'positivo' | 'neutro' | 'negativo'>('todos');
  const [filtroDiaGoogle, setFiltroDiaGoogle] = useState<string | null>(null);
  const [paginaReviewGoogle, setPaginaReviewGoogle] = useState(1);
  const [reviewExpandidaGoogle, setReviewExpandidaGoogle] = useState<Set<string>>(new Set());
  const REVIEWS_POR_PAGINA = 10;

  // Estado do modal de NPS Falaê (Digital/Salão)
  const [npsDialog, setNpsDialog] = useState<{
    aberto: boolean;
    loading: boolean;
    titulo: string;
    periodo: string;
    dataInicio: string;
    dataFim: string;
    searchName: string;
    total: number;
    npsScore: number | null;
    promotores: number;
    neutros: number;
    detratores: number;
    mediaNotas: number | null;
    respostas: {
      id: string;
      nps: number;
      data: string;
      dataVisita: string | null;
      comentario: string | null;
      clientName: string | null;
      tipo: 'promotor' | 'neutro' | 'detrator';
      criterios: { nome: string; nota: number }[];
    }[];
    criteriosMedia: { nome: string; media: number; total: number }[];
  }>({
    aberto: false,
    loading: false,
    titulo: '',
    periodo: '',
    dataInicio: '',
    dataFim: '',
    searchName: '',
    total: 0,
    npsScore: null,
    promotores: 0,
    neutros: 0,
    detratores: 0,
    mediaNotas: null,
    respostas: [],
    criteriosMedia: [],
  });
  const [filtroNps, setFiltroNps] = useState<'todos' | 'promotor' | 'neutro' | 'detrator'>('todos');
  const [filtroDiaNps, setFiltroDiaNps] = useState<string | null>(null);
  const [paginaNps, setPaginaNps] = useState(1);
  const [respostaExpandidaNps, setRespostaExpandidaNps] = useState<Set<string>>(new Set());
  const NPS_POR_PAGINA = 10;

  // Estado do modal de Atração/Faturamento
  const [atracaoDialog, setAtracaoDialog] = useState<{
    aberto: boolean;
    loading: boolean;
    periodo: string;
    dataInicio: string;
    dataFim: string;
    total: number;
    custoArtisticoTotal: number;
    custoProducaoTotal: number;
    custoTotal: number;
    faturamentoTotal: number;
    couvertTotal: number;
    percentualMedio: number;
    dias: {
      data: string;
      dataFormatada: string;
      diaSemana: string;
      evento: string;
      artista: string | null;
      custoArtistico: number;
      custoProducao: number;
      custoTotal: number;
      faturamento: number;
      couvert: number;
      percentualFat: number;
    }[];
  }>({
    aberto: false,
    loading: false,
    periodo: '',
    dataInicio: '',
    dataFim: '',
    total: 0,
    custoArtisticoTotal: 0,
    custoProducaoTotal: 0,
    custoTotal: 0,
    faturamentoTotal: 0,
    couvertTotal: 0,
    percentualMedio: 0,
    dias: [],
  });
  
  // Estado do modal de edição individual de meta
  const [editMetaDialog, setEditMetaDialog] = useState<{
    aberto: boolean;
    metrica: MetricaConfig | null;
    valorAtual: number | null;
    valorNovo: string;
    salvando: boolean;
  }>({
    aberto: false,
    metrica: null,
    valorAtual: null,
    valorNovo: '',
    salvando: false,
  });
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const semanaAtualRef = useRef<HTMLDivElement>(null);

  const metasPorSecao = useMemo(() => {
    const usedKeys = new Set<string>();
    const secoes = SECOES.map((secao) => {
      const grupos = secao.grupos
        .map((grupo) => {
          const metricas = grupo.metricas
            .filter((metrica) => {
              if (usedKeys.has(metrica.key)) return false;
              usedKeys.add(metrica.key);
              return true;
            })
            .map((metrica) => ({
              key: metrica.key,
              label: metrica.label,
              formato: metrica.formato,
              sufixo: metrica.sufixo,
              inverso: metrica.inverso,
            }));
          return {
            id: grupo.id,
            label: grupo.label,
            metricas,
          };
        })
        .filter((g) => g.metricas.length > 0);

      return {
        id: secao.id,
        titulo: secao.titulo,
        grupos,
      };
    }).filter((s) => s.grupos.length > 0);

    return secoes;
  }, [SECOES]);

  const metricasParaMetaFlat = useMemo(
    () => metasPorSecao.flatMap((s) => s.grupos.flatMap((g) => g.metricas)),
    [metasPorSecao]
  );

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
    setPageTitle('📊 Desempenho');
    return () => setPageTitle('');
  }, [setPageTitle]);

  // Quando o bar muda no contexto e difere do prop server-side, recarregar dados
  useEffect(() => {
    if (selectedBar?.id && selectedBar.id !== barId) {
      router.refresh();
    }
  }, [selectedBar?.id, barId, router]);

  // Semana selecionada (para metas reativas)
  const semanaSelecionada = useMemo(() => {
    if (semanaAtualIdx < 0 || !semanasProcessadas[semanaAtualIdx]) return null;
    return semanasProcessadas[semanaAtualIdx];
  }, [semanaAtualIdx, semanasProcessadas]);

  // Carregar metas (reativo à semana selecionada na visão semanal)
  useEffect(() => {
    const carregarMetas = async () => {
      if (!selectedBar) return;

      try {
        let url = `/api/estrategico/desempenho/metas?bar_id=${selectedBar.id}&periodo=${visao}`;

        // Na visão semanal, buscar metas da semana selecionada (com fallback no backend)
        if (visao === 'semanal' && semanaSelecionada) {
          url += `&semana=${semanaSelecionada.numero_semana}&ano=${semanaSelecionada.ano}`;
        }

        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setMetas(data.metas || {});
          setMetasOrigens(data.origens || {});
        }
      } catch (error) {
        console.error('Erro ao carregar metas:', error);
      }
    };

    carregarMetas();
  }, [selectedBar, visao, semanaSelecionada]);

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

  const abrirModalMetas = useCallback(() => {
    const valoresIniciais: Record<string, string> = {};
    metricasParaMetaFlat.forEach((m) => {
      const valorAtual = metas[m.key]?.valor;
      valoresIniciais[m.key] =
        valorAtual !== null && valorAtual !== undefined && Number.isFinite(valorAtual)
          ? String(valorAtual)
          : '';
    });
    setMetasEditValues(valoresIniciais);
    setMetasModalAberto(true);
  }, [metricasParaMetaFlat, metas]);

  const salvarMetasDesempenho = useCallback(async () => {
    if (!selectedBar?.id) {
      toast({ title: 'Erro', description: 'Selecione um bar para salvar metas', variant: 'destructive' });
      return;
    }

    const metasPayload = metricasParaMetaFlat
      .map((m) => {
        const raw = (metasEditValues[m.key] || '').toString().trim();
        if (!raw) return null;
        const valor = Number(raw.replace(',', '.'));
        if (!Number.isFinite(valor)) return null;
        return {
          metrica: m.key,
          valor,
          operador: metas[m.key]?.operador || (m.inverso ? '<=' : '>='),
        };
      })
      .filter((m): m is { metrica: string; valor: number; operador: string } => !!m);

    if (metasPayload.length === 0) {
      toast({ title: 'Nada para salvar', description: 'Preencha ao menos uma meta válida.', variant: 'destructive' });
      return;
    }

    try {
      setSalvandoMetas(true);
      const putBody: Record<string, unknown> = {
        bar_id: selectedBar.id,
        periodo: visao,
        metas: metasPayload,
      };

      // Na visão semanal, vincular metas à semana selecionada
      if (visao === 'semanal' && semanaSelecionada) {
        putBody.semana = semanaSelecionada.numero_semana;
        putBody.ano = semanaSelecionada.ano;
      }

      const response = await fetch('/api/estrategico/desempenho/metas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(putBody),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || 'Falha ao salvar metas');
      }

      setMetas(data?.metas || {});
      setMetasModalAberto(false);
      toast({ title: 'Metas salvas', description: `${metasPayload.length} metas atualizadas com sucesso.` });
    } catch (error) {
      toast({
        title: 'Erro ao salvar metas',
        description: error instanceof Error ? error.message : 'Falha ao salvar',
        variant: 'destructive',
      });
    } finally {
      setSalvandoMetas(false);
    }
  }, [selectedBar, visao, metricasParaMetaFlat, metasEditValues, metas, semanaSelecionada, toast]);

  // Abrir modal de edição individual de meta
  const abrirEditMeta = useCallback((metrica: MetricaConfig) => {
    const valorAtual = metas[metrica.key]?.valor ?? null;
    const isHerdada = metasOrigens[metrica.key]?.tipo === 'herdada';
    setEditMetaDialog({
      aberto: true,
      metrica,
      valorAtual,
      valorNovo: valorAtual !== null ? String(valorAtual) : '',
      salvando: false,
    });
    // Se é herdada, mostrar no placeholder que o valor vem de outra semana
    if (isHerdada && valorAtual !== null) {
      // O valor no campo é pré-preenchido para facilitar, mas pode ser alterado
    }
  }, [metas, metasOrigens]);

  // Salvar meta individual com histórico
  const salvarMetaIndividual = useCallback(async () => {
    if (!selectedBar?.id || !editMetaDialog.metrica) return;

    const valorNovo = Number(editMetaDialog.valorNovo.replace(',', '.'));
    if (!Number.isFinite(valorNovo)) {
      toast({ title: 'Valor inválido', description: 'Digite um número válido', variant: 'destructive' });
      return;
    }

    setEditMetaDialog(prev => ({ ...prev, salvando: true }));

    try {
      const patchBody: Record<string, unknown> = {
        bar_id: selectedBar.id,
        periodo: visao,
        metrica: editMetaDialog.metrica.key,
        valor: valorNovo,
        operador: metas[editMetaDialog.metrica.key]?.operador || (editMetaDialog.metrica.inverso ? '<=' : '>='),
        alterado_por: user?.nome || user?.email || 'Usuário',
      };

      // Na visão semanal, vincular meta à semana selecionada
      if (visao === 'semanal' && semanaSelecionada) {
        patchBody.semana = semanaSelecionada.numero_semana;
        patchBody.ano = semanaSelecionada.ano;
      }

      const response = await fetch('/api/estrategico/desempenho/metas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || 'Falha ao salvar meta');
      }

      // Atualizar metas localmente
      setMetas(prev => ({
        ...prev,
        [editMetaDialog.metrica!.key]: {
          valor: valorNovo,
          operador: prev[editMetaDialog.metrica!.key]?.operador || (editMetaDialog.metrica!.inverso ? '<=' : '>='),
        },
      }));

      // Marcar como 'definida' para esta semana
      if (visao === 'semanal' && semanaSelecionada) {
        setMetasOrigens(prev => ({
          ...prev,
          [editMetaDialog.metrica!.key]: {
            tipo: 'definida',
            semana: semanaSelecionada.numero_semana,
            ano: semanaSelecionada.ano,
          },
        }));
      }

      setEditMetaDialog({ aberto: false, metrica: null, valorAtual: null, valorNovo: '', salvando: false });

      const valorAnteriorFormatado = data.valor_anterior !== null
        ? formatarValor(data.valor_anterior, editMetaDialog.metrica.formato, editMetaDialog.metrica.sufixo)
        : 'não definido';
      const valorNovoFormatado = formatarValor(valorNovo, editMetaDialog.metrica.formato, editMetaDialog.metrica.sufixo);
      const semanaInfo = visao === 'semanal' && semanaSelecionada ? ` (S${String(semanaSelecionada.numero_semana).padStart(2, '0')})` : '';

      toast({
        title: 'Meta atualizada',
        description: `${editMetaDialog.metrica.label}${semanaInfo}: ${valorAnteriorFormatado} → ${valorNovoFormatado}`
      });
    } catch (error) {
      toast({
        title: 'Erro ao salvar meta',
        description: error instanceof Error ? error.message : 'Falha ao salvar',
        variant: 'destructive',
      });
    } finally {
      setEditMetaDialog(prev => ({ ...prev, salvando: false }));
    }
  }, [selectedBar, visao, editMetaDialog, metas, user, semanaSelecionada, toast]);

  const abrirDetalhesFalae = useCallback((semana: DadosSemana) => {
    const avaliacoes = semana.falae_avaliacoes_detalhes ?? [];
    const comentarios = semana.falae_comentarios_detalhes ?? [];
    const periodo = `${formatarDataCurta(semana.data_inicio)} - ${formatarDataCurta(semana.data_fim)}`;

    setFalaeDialog({
      aberto: true,
      periodo,
      npsScore: semana.falae_nps_score ?? null,
      totalRespostas: Number(semana.falae_respostas_total || 0),
      promotores: Number(semana.falae_promotores_total || 0),
      neutros: Number(semana.falae_neutros_total || 0),
      detratores: Number(semana.falae_detratores_total || 0),
      avaliacoes,
      comentarios,
    });
    setFiltroComentarioFalae('todos');
  }, []);

  const abrirDetalhesGoogleReviews = useCallback(async (semana: DadosSemana, filtroEstrelas?: number) => {
    const periodo = `${formatarDataCurta(semana.data_inicio)} - ${formatarDataCurta(semana.data_fim)}`;
    const titulo = filtroEstrelas === 5 ? 'Avaliações 5★ Google' : 'Detalhes Google Reviews';

    setGoogleReviewsDialog(prev => ({
      ...prev,
      aberto: true,
      loading: true,
      titulo,
      periodo,
      dataInicio: semana.data_inicio,
      dataFim: semana.data_fim,
      filtroEstrelas: filtroEstrelas || null,
    }));
    setFiltroReviewGoogle('todos');
    setFiltroDiaGoogle(null);
    setPaginaReviewGoogle(1);
    setReviewExpandidaGoogle(new Set());

    try {
      let url = `/api/google-reviews/detailed-summary?bar_id=${effectiveBarId}&data_inicio=${semana.data_inicio}&data_fim=${semana.data_fim}`;
      if (filtroEstrelas) {
        url += `&stars=${filtroEstrelas}`;
      }
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success && data.summary) {
        setGoogleReviewsDialog(prev => ({
          ...prev,
          loading: false,
          total: data.summary.total,
          media: data.summary.media,
          distribuicao: data.summary.distribuicao,
          porDia: data.summary.porDia,
          elogios: data.summary.elogios,
          criticas: data.summary.criticas,
          reviewsPositivas: data.summary.reviewsPositivas,
          reviewsNegativas: data.summary.reviewsNegativas,
          reviewsNeutras: data.summary.reviewsNeutras,
        }));
      } else {
        setGoogleReviewsDialog(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('Erro ao buscar detalhes Google Reviews:', error);
      setGoogleReviewsDialog(prev => ({ ...prev, loading: false }));
    }
  }, [effectiveBarId]);

  const abrirDetalhesNps = useCallback(async (semana: DadosSemana, searchName: string, titulo: string) => {
    const periodo = `${formatarDataCurta(semana.data_inicio)} - ${formatarDataCurta(semana.data_fim)}`;
    
    setNpsDialog(prev => ({
      ...prev,
      aberto: true,
      loading: true,
      titulo,
      periodo,
      dataInicio: semana.data_inicio,
      dataFim: semana.data_fim,
      searchName,
    }));
    setFiltroNps('todos');
    setFiltroDiaNps(null);
    setPaginaNps(1);
    setRespostaExpandidaNps(new Set());

    try {
      const response = await fetch(
        `/api/falae/detailed-summary?bar_id=${effectiveBarId}&data_inicio=${semana.data_inicio}&data_fim=${semana.data_fim}&search_name=${encodeURIComponent(searchName)}`
      );
      const data = await response.json();
      
      if (data.success && data.summary) {
        setNpsDialog(prev => ({
          ...prev,
          loading: false,
          total: data.summary.total,
          npsScore: data.summary.npsScore,
          promotores: data.summary.promotores,
          neutros: data.summary.neutros,
          detratores: data.summary.detratores,
          mediaNotas: data.summary.mediaNotas,
          respostas: data.summary.respostas,
          criteriosMedia: data.summary.criteriosMedia,
        }));
      } else {
        setNpsDialog(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('Erro ao buscar detalhes NPS:', error);
      setNpsDialog(prev => ({ ...prev, loading: false }));
    }
  }, [effectiveBarId]);

  const abrirDetalhesAtracao = useCallback(async (semana: DadosSemana) => {
    const periodo = `${formatarDataCurta(semana.data_inicio)} - ${formatarDataCurta(semana.data_fim)}`;
    
    setAtracaoDialog(prev => ({
      ...prev,
      aberto: true,
      loading: true,
      periodo,
      dataInicio: semana.data_inicio,
      dataFim: semana.data_fim,
    }));

    try {
      const response = await fetch(
        `/api/eventos/atracao-detalhes?bar_id=${effectiveBarId}&data_inicio=${semana.data_inicio}&data_fim=${semana.data_fim}`
      );
      const data = await response.json();
      
      if (data.success && data.summary) {
        setAtracaoDialog(prev => ({
          ...prev,
          loading: false,
          total: data.summary.total,
          custoArtisticoTotal: data.summary.custoArtisticoTotal,
          custoProducaoTotal: data.summary.custoProducaoTotal,
          custoTotal: data.summary.custoTotal,
          faturamentoTotal: data.summary.faturamentoTotal,
          couvertTotal: data.summary.couvertTotal,
          percentualMedio: data.summary.percentualMedio,
          dias: data.summary.dias,
        }));
      } else {
        setAtracaoDialog(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('Erro ao buscar detalhes Atração:', error);
      setAtracaoDialog(prev => ({ ...prev, loading: false }));
    }
  }, [effectiveBarId]);

  const respostasNpsFiltradas = useMemo(() => {
    const ordemTipo = { detrator: 0, neutro: 1, promotor: 2 } as const;
    let base = [...npsDialog.respostas].sort((a, b) => {
      const ordem = ordemTipo[a.tipo] - ordemTipo[b.tipo];
      if (ordem !== 0) return ordem;
      return a.data < b.data ? 1 : -1;
    });
    
    if (filtroNps !== 'todos') {
      base = base.filter((r) => r.tipo === filtroNps);
    }
    
    // Filtrar por dia se selecionado
    if (filtroDiaNps) {
      base = base.filter(r => r.data === filtroDiaNps);
    }
    
    return base;
  }, [npsDialog.respostas, filtroNps, filtroDiaNps]);
  
  // Paginação de respostas NPS
  const respostasNpsPaginadas = useMemo(() => {
    const inicio = (paginaNps - 1) * NPS_POR_PAGINA;
    return respostasNpsFiltradas.slice(inicio, inicio + NPS_POR_PAGINA);
  }, [respostasNpsFiltradas, paginaNps]);
  
  const totalPaginasNps = Math.ceil(respostasNpsFiltradas.length / NPS_POR_PAGINA);

  const contagemRespostasNps = useMemo(() => {
    const counts = { detrator: 0, neutro: 0, promotor: 0 };
    for (const r of npsDialog.respostas) {
      counts[r.tipo] += 1;
    }
    return {
      ...counts,
      todos: npsDialog.respostas.length,
    };
  }, [npsDialog.respostas]);
  
  // Agregação de NPS por dia
  const npsPorDia = useMemo(() => {
    const porDiaMap = new Map<string, { total: number; soma: number; promotores: number; detratores: number }>();
    const diasSemanaOrdem = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    
    for (const r of npsDialog.respostas) {
      const data = r.dataVisita || r.data;
      if (!data) continue;
      
      if (!porDiaMap.has(data)) {
        porDiaMap.set(data, { total: 0, soma: 0, promotores: 0, detratores: 0 });
      }
      const stat = porDiaMap.get(data)!;
      stat.total += 1;
      stat.soma += r.nps;
      if (r.tipo === 'promotor') stat.promotores += 1;
      if (r.tipo === 'detrator') stat.detratores += 1;
    }
    
    const resultado = Array.from(porDiaMap.entries()).map(([data, stats]) => {
      const dateObj = new Date(data + 'T12:00:00');
      const diaSemanaIndex = dateObj.getDay();
      const diasNomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const nps = stats.total > 0 ? Math.round(((stats.promotores - stats.detratores) / stats.total) * 100) : 0;
      
      return {
        data,
        diaSemana: diasNomes[diaSemanaIndex],
        total: stats.total,
        nps,
        media: stats.total > 0 ? stats.soma / stats.total : 0,
      };
    });
    
    // Ordenar por dia da semana (Segunda -> Domingo)
    return resultado.sort((a, b) => {
      const ordemA = diasSemanaOrdem.indexOf(a.diaSemana);
      const ordemB = diasSemanaOrdem.indexOf(b.diaSemana);
      return ordemA - ordemB;
    });
  }, [npsDialog.respostas]);

  const reviewsGoogleFiltradas = useMemo(() => {
    let reviews: { nome: string; stars: number; texto: string; data: string; tipo: string }[] = [];
    
    if (filtroReviewGoogle === 'todos') {
      reviews = [
        ...googleReviewsDialog.reviewsNegativas,
        ...googleReviewsDialog.reviewsNeutras,
        ...googleReviewsDialog.reviewsPositivas,
      ];
    } else if (filtroReviewGoogle === 'positivo') {
      reviews = googleReviewsDialog.reviewsPositivas;
    } else if (filtroReviewGoogle === 'negativo') {
      reviews = googleReviewsDialog.reviewsNegativas;
    } else {
      reviews = googleReviewsDialog.reviewsNeutras;
    }
    
    // Filtrar por dia se selecionado
    if (filtroDiaGoogle) {
      reviews = reviews.filter(r => r.data === filtroDiaGoogle);
    }
    
    return reviews;
  }, [googleReviewsDialog, filtroReviewGoogle, filtroDiaGoogle]);
  
  // Paginação de reviews Google
  const reviewsGooglePaginadas = useMemo(() => {
    const inicio = (paginaReviewGoogle - 1) * REVIEWS_POR_PAGINA;
    return reviewsGoogleFiltradas.slice(inicio, inicio + REVIEWS_POR_PAGINA);
  }, [reviewsGoogleFiltradas, paginaReviewGoogle]);
  
  const totalPaginasReviewGoogle = Math.ceil(reviewsGoogleFiltradas.length / REVIEWS_POR_PAGINA);

  const contagemReviewsGoogle = useMemo(() => ({
    positivo: googleReviewsDialog.reviewsPositivas.length,
    neutro: googleReviewsDialog.reviewsNeutras.length,
    negativo: googleReviewsDialog.reviewsNegativas.length,
    todos: googleReviewsDialog.reviewsPositivas.length + googleReviewsDialog.reviewsNeutras.length + googleReviewsDialog.reviewsNegativas.length,
  }), [googleReviewsDialog]);

  const comentariosFalaeOrdenadosFiltrados = useMemo(() => {
    const ordemTipo = { detrator: 0, neutro: 1, promotor: 2 } as const;
    const base = [...falaeDialog.comentarios].sort((a, b) => {
      const ordem = ordemTipo[a.tipo] - ordemTipo[b.tipo];
      if (ordem !== 0) return ordem;
      return a.data < b.data ? 1 : -1;
    });
    if (filtroComentarioFalae === 'todos') return base;
    return base.filter((c) => c.tipo === filtroComentarioFalae);
  }, [falaeDialog.comentarios, filtroComentarioFalae]);

  const contagemComentariosFalae = useMemo(() => {
    const counts = { detrator: 0, neutro: 0, promotor: 0 };
    for (const c of falaeDialog.comentarios) {
      counts[c.tipo] += 1;
    }
    return {
      ...counts,
      todos: falaeDialog.comentarios.length,
    };
  }, [falaeDialog.comentarios]);

  // Função de atualização completa: Conta Azul + CMV + Refresh (FUNÇÃO UNIFICADA)
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

      // 1. Processar CMV de TODAS as semanas (Conta Azul + ContaHub → Banco)
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
            todas_semanas: true
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

      // 2. Recalcular desempenho semanal (atualiza tabela desempenho_semanal)
      console.log('📊 Recalculando desempenho semanal...');
      const desempenhoResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/recalcular-desempenho-auto`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
          }
        }
      );
      
      if (!desempenhoResponse.ok) {
        console.warn('⚠️ Erro ao recalcular desempenho, continuando...');
      } else {
        const resultado = await desempenhoResponse.json();
        console.log('✅ Desempenho recalculado:', resultado.message);
      }

      // 4. Atualizar a página
      console.log('🔃 Atualizando página...');
      router.refresh();

      toast({
        title: "✅ Dados Atualizados",
        description: "Conta Azul + ContaHub + Desempenho sincronizados"
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

  const salvarMetrica = async (semanaId: number, campo: string, campoPessoas?: string) => {
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
    
    // Se for campo de reservas (mesas), validar também o campo de pessoas
    let numValuePessoas: number | undefined;
    if (campoPessoas && valorEditPessoas) {
      numValuePessoas = parseFloat(valorEditPessoas.replace(',', '.'));
      if (isNaN(numValuePessoas)) {
        toast({ title: 'Erro', description: 'Valor de pessoas inválido', variant: 'destructive' });
        return;
      }
    }
    
    try {
      setLoading(true);
      
      // Detectar se é campo de marketing no mensal
      const isMarketingField = campo.startsWith('o_') || campo.startsWith('m_') || campo.startsWith('g_') || campo.startsWith('gmn_');
      
      if (visao === 'mensal' && isMarketingField) {
        // Buscar dados da semana/mês atual para pegar ano e mes
        const semanaAtual = semanasProcessadas.find(s => s.id === semanaId);
        if (!semanaAtual) {
          throw new Error('Semana/mês não encontrado');
        }
        
        // Salvar em marketing_mensal
        const response = await fetch('/api/estrategico/marketing-mensal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            bar_id: effectiveBarId,
            ano: semanaAtual.ano,
            mes: semanaAtual.numero_semana, // No mensal, numero_semana é o mês
            [campo]: numValue
          })
        });

        if (!response.ok) throw new Error('Erro ao salvar marketing mensal');
      } else {
        // Preparar body com campo principal e campo de pessoas (se houver)
        const bodyData: any = { id: semanaId, [campo]: numValue };
        if (campoPessoas && numValuePessoas !== undefined) {
          bodyData[campoPessoas] = numValuePessoas;
        }
        
        // Usar API route existente para desempenho semanal
        const response = await fetch('/api/gestao/desempenho', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-selected-bar-id': String(effectiveBarId || '')
          },
          body: JSON.stringify(bodyData)
        });

        if (!response.ok) throw new Error('Erro ao salvar');
      }
      
      // Atualizar estado local para refletir imediatamente
      const novosValores: Record<string, number> = { [campo]: numValue };
      if (campoPessoas && numValuePessoas !== undefined) {
        novosValores[campoPessoas] = numValuePessoas;
      }
      
      setValoresLocais(prev => ({
        ...prev,
        [semanaId]: {
          ...(prev[semanaId] || {}),
          ...novosValores
        }
      }));
      
      toast({ title: 'Salvo!', description: 'Valor atualizado' });
      setEditando(null);
      setValorEditPessoas('');
      // Não chamar router.refresh() aqui — o estado local já foi atualizado em setValoresLocais
      // router.refresh() re-executava o server component e causava troca de bar involuntária
    } catch (error) {
      console.error('Erro:', error);
      toast({ title: 'Erro', description: 'Falha ao salvar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Helper para obter valor considerando override local
  const getValorComOverride = (semana: DadosSemana, key: string): unknown => {
    const semanaId = semana.id?.toString() || '';
    if (valoresLocais[semanaId]?.[key] !== undefined) {
      return valoresLocais[semanaId][key];
    }
    if (key in semana) {
      return semana[key as keyof DadosSemana];
    }
    return undefined;
  };

  // Se não houver dados e não estiver carregando (mas loading é false inicialmente)
  if (initialData.length === 0 && visao === 'mensal') {
     // Mensal vazio
  }

  return (
    <>
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
              
              <Button variant="outline" size="sm" onClick={abrirModalMetas} className="gap-2">
                <Target className="h-4 w-4" />
                Metas
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto smooth-scroll">
        <div className="flex" style={{ minWidth: 'fit-content' }}>
          {/* Colunas Fixas (Indicador + Metas na visão mensal) */}
          <div className="sticky left-0 z-20 flex flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-md" style={{ minWidth: '272px', width: '272px' }}>
            {/* Coluna Indicador */}
            <div className="w-[200px] border-r border-gray-200 dark:border-gray-700">
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
                            <TooltipProvider delayDuration={300}>
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
                           <TooltipProvider key={metrica.key} delayDuration={300}>
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
                                     {metas[metrica.key] && (
                                       <p className="text-xs mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                         <strong>Meta {visao === 'semanal' ? 'Semanal' : 'Mensal'}:</strong> {formatarValor(metas[metrica.key].valor, metrica.formato, metrica.sufixo)}
                                          {visao === 'semanal' && metasOrigens[metrica.key]?.tipo === 'herdada' && (
                                            <span className="text-[10px] text-gray-400 ml-1">(herdada{metasOrigens[metrica.key]?.semana ? ` da S${metasOrigens[metrica.key].semana}` : ''})</span>
                                          )}
                                       </p>
                                     )}
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

            {/* Coluna Metas - reativa à semana/mês selecionado */}
              <div className="w-[72px] border-l border-amber-200 dark:border-amber-800/50">
                <div className="h-[72px] border-b border-gray-200 dark:border-gray-700 bg-gradient-to-b from-amber-100 to-amber-50 dark:from-amber-900/40 dark:to-amber-900/20 flex items-center justify-center sticky top-0 z-30">
                  <div className="flex flex-col items-center">
                    <Target className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mb-0.5" />
                    <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Meta</span>
                    {visao === 'semanal' && semanaSelecionada && (
                      <span className="text-[8px] text-amber-500 dark:text-amber-500">
                        S{String(semanaSelecionada.numero_semana).padStart(2, '0')}
                      </span>
                    )}
                  </div>
                </div>
                {SECOES.map(secao => (
                  <div key={`metas-${secao.id}`}>
                    {/* Header da seção */}
                    <div className={cn("flex items-center justify-center", secao.cor)} style={{ height: '40px' }} />
                    {secoesAbertas[secao.id] && secao.grupos.map(grupo => {
                      const hierarquico = isGrupoHierarquico(grupo);
                      const grupoSimples = isGrupoSimples(grupo);
                      const metricasParaMostrar = hierarquico ? grupo.metricas.slice(1) : grupo.metricas;
                      const mostrarHeaderGrupo = !grupoSimples && (hierarquico || !!grupo.agregacao);
                      return (
                        <div key={`metas-${grupo.id}`}>
                          {mostrarHeaderGrupo && (
                            <div
                              className="flex items-center justify-center bg-amber-50/50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-800/30 hover:bg-amber-100/70 dark:hover:bg-amber-800/20 transition-colors cursor-pointer group"
                              style={{ height: '36px' }}
                              onClick={() => hierarquico && grupo.metricas[0] && abrirEditMeta(grupo.metricas[0])}
                              title={hierarquico && grupo.metricas[0] ? `Clique para editar meta de ${grupo.metricas[0].label}${metasOrigens[grupo.metricas[0].key]?.tipo === 'herdada' ? ' (herdada)' : ''}` : undefined}
                            >
                              {hierarquico && grupo.metricas[0] && metas[grupo.metricas[0].key] ? (
                                <span className={cn(
                                  "text-[10px] font-semibold truncate px-1 group-hover:underline",
                                  metasOrigens[grupo.metricas[0].key]?.tipo === 'herdada'
                                    ? "text-amber-400/70 dark:text-amber-500/50 italic"
                                    : "text-amber-700 dark:text-amber-400"
                                )}>
                                  {formatarValor(metas[grupo.metricas[0].key].valor, grupo.metricas[0].formato, grupo.metricas[0].sufixo)}
                                </span>
                              ) : (
                                <span className="text-[10px] text-amber-300 dark:text-amber-700 group-hover:text-amber-500">{hierarquico ? '+' : '-'}</span>
                              )}
                            </div>
                          )}
                          {(!mostrarHeaderGrupo || secoesNaoColapsaveis.includes(secao.id) || gruposAbertos[`${secao.id}-${grupo.id}`]) && metricasParaMostrar.map((metrica) => {
                            const isHerdada = metasOrigens[metrica.key]?.tipo === 'herdada';
                            return (
                            <div
                              key={`meta-${metrica.key}`}
                              className="flex items-center justify-center border-b border-amber-100/50 dark:border-amber-800/20 bg-amber-50/20 dark:bg-amber-900/5 hover:bg-amber-200/60 dark:hover:bg-amber-800/30 transition-colors cursor-pointer group"
                              style={{ height: '32px' }}
                              onClick={() => abrirEditMeta(metrica)}
                              title={`Clique para editar meta de ${metrica.label}${isHerdada ? ` (herdada${metasOrigens[metrica.key]?.semana ? ` da S${metasOrigens[metrica.key].semana}` : ''})` : ''}`}
                            >
                              {metas[metrica.key] ? (
                                <span className={cn(
                                  "text-[10px] font-medium truncate px-1 group-hover:underline",
                                  isHerdada
                                    ? "text-amber-400/70 dark:text-amber-500/50 italic"
                                    : "text-amber-700 dark:text-amber-400"
                                )}>
                                  {formatarValor(metas[metrica.key].valor, metrica.formato, metrica.sufixo)}
                                </span>
                              ) : (
                                <span className="text-[10px] text-amber-300 dark:text-amber-700 group-hover:text-amber-500">+</span>
                              )}
                            </div>
                            );
                          })}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
          </div>

          {/* Área das Semanas - inline-flex para manter largura natural */}
          <div className="flex-shrink-0 inline-flex">
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
                                  ? (valorPrincipal !== null && valorPrincipal !== undefined ? `${Math.round(numeroMetrica(valorPrincipal))}/${valorPessoasPrincipal !== null && valorPessoasPrincipal !== undefined ? Math.round(numeroMetrica(valorPessoasPrincipal)) : '-'}` : '-')
                                  : hierarquico ? formatarValor(valorPrincipal, metricaPrincipal?.formato || 'numero', metricaPrincipal?.sufixo) : null;

                               return (
                                  <div key={grupo.id}>
                                     {mostrarHeaderGrupo && (
                                        <div className={cn("relative flex items-center justify-center px-2 border-b border-gray-200 dark:border-gray-600 group", isAtual ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-gray-50 dark:bg-gray-800")} style={{ height: '36px' }}>
                                           {hierarquico ? (
                                              isEditandoPrincipal ? (
                                                <div className="absolute inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-800 shadow-lg border border-blue-300 rounded">
                                                  {metricaPrincipal.formato === 'reservas' && metricaPrincipal.keyPessoas ? (
                                                    <div className="flex items-center gap-1 px-1">
                                                      <Input type="text" value={valorEdit} onChange={(e) => setValorEdit(e.target.value)} className="w-10 h-6 text-xs p-1" placeholder="Mesas" onKeyDown={(e) => { if (e.key === 'Enter') salvarMetrica(semana.id!, metricaPrincipal.key, metricaPrincipal.keyPessoas); if (e.key === 'Escape') setEditando(null); }} />
                                                      <span className="text-xs text-gray-400">/</span>
                                                      <Input type="text" value={valorEditPessoas} onChange={(e) => setValorEditPessoas(e.target.value)} className="w-10 h-6 text-xs p-1" placeholder="Pessoas" onKeyDown={(e) => { if (e.key === 'Enter') salvarMetrica(semana.id!, metricaPrincipal.key, metricaPrincipal.keyPessoas); if (e.key === 'Escape') setEditando(null); }} />
                                                      <Button size="icon" variant="ghost" className="h-5 w-5 flex-shrink-0" onClick={() => salvarMetrica(semana.id!, metricaPrincipal.key, metricaPrincipal.keyPessoas)}><Check className="h-3 w-3 text-emerald-600" /></Button>
                                                      <Button size="icon" variant="ghost" className="h-5 w-5 flex-shrink-0" onClick={() => { setEditando(null); setValorEditPessoas(''); }}><X className="h-3 w-3 text-red-600" /></Button>
                                                    </div>
                                                  ) : (
                                                    <div className="flex items-center gap-1 px-1">
                                                      <Input type="text" value={valorEdit} onChange={(e) => setValorEdit(e.target.value)} className="w-14 h-6 text-xs p-1" onKeyDown={(e) => { if (e.key === 'Enter') salvarMetrica(semana.id!, metricaPrincipal.key); if (e.key === 'Escape') setEditando(null); }} />
                                                      <Button size="icon" variant="ghost" className="h-5 w-5 flex-shrink-0" onClick={() => salvarMetrica(semana.id!, metricaPrincipal.key)}><Check className="h-3 w-3 text-emerald-600" /></Button>
                                                      <Button size="icon" variant="ghost" className="h-5 w-5 flex-shrink-0" onClick={() => setEditando(null)}><X className="h-3 w-3 text-red-600" /></Button>
                                                    </div>
                                                  )}
                                                </div>
                                            ) : (
                                              <TooltipProvider>
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <div className="flex items-center justify-center gap-1">
                                                      <span className={cn("text-xs font-medium text-center cursor-help", getCorMeta(verificarMeta(valorPrincipal, metricaPrincipal.key, metas)))}>{valorPrincipalFormatado}</span>
                                                      {metricaPrincipal.key === 'faturamento_total' && visao === 'semanal' && (() => {
                                                        const metaSemanal = numeroMetrica(getValorComOverride(semana, 'meta_semanal'));
                                                        const faturamentoTotal = numeroMetrica(valorPrincipal);
                                                        if (metaSemanal > 0 && faturamentoTotal > 0) {
                                                          const percentualAtingido = Math.round((faturamentoTotal / metaSemanal) * 100);
                                                          const acimaMeta = percentualAtingido >= 100;
                                                          return (
                                                            <span className={cn(
                                                              "text-[10px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5",
                                                              acimaMeta ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                                                            )}>
                                                              {acimaMeta ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                                                              {percentualAtingido}%
                                                            </span>
                                                          );
                                                        }
                                                        return null;
                                                      })()}
                                                    </div>
                                                  </TooltipTrigger>
                                                  <TooltipContent side="top" className={cn("max-w-xs p-3", STATUS_COLORS[metricaPrincipal.status].bg)}>
                                                    <div className="space-y-1">
                                                      <p className="font-semibold text-sm">{metricaPrincipal.label}</p>
                                                      <p className="text-xs"><strong>Fonte:</strong> {metricaPrincipal.fonte}</p>
                                                      <p className="text-xs"><strong>Cálculo:</strong> {metricaPrincipal.calculo}</p>
                                                      {metricaPrincipal.key === 'faturamento_total' && (() => {
                                                        const contaAssinada = numeroMetrica(getValorComOverride(semana, 'conta_assinada_valor'));
                                                        const faturamentoTotal = numeroMetrica(valorPrincipal);
                                                        const faturamentoBruto = faturamentoTotal + contaAssinada;
                                                        const metaSemanal = visao === 'semanal' ? numeroMetrica(getValorComOverride(semana, 'meta_semanal')) : 0;
                                                        const percentualAtingido = metaSemanal > 0 ? Math.round((faturamentoTotal / metaSemanal) * 100) : 0;
                                                        return (
                                                          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 space-y-1">
                                                            <p className="text-xs">
                                                              <strong>Fat. Bruto:</strong> {formatarValor(faturamentoBruto, 'moeda')}
                                                            </p>
                                                            <p className="text-xs text-red-600 dark:text-red-400">
                                                              <strong>(-) Conta Assinada:</strong> {formatarValor(contaAssinada, 'moeda')}
                                                            </p>
                                                            <p className="text-xs font-semibold">
                                                              <strong>= Fat. Total:</strong> {formatarValor(faturamentoTotal, 'moeda')}
                                                            </p>
                                                            {visao === 'semanal' && metaSemanal > 0 && (
                                                              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                                                <p className="text-xs">
                                                                  <strong>Meta Semanal (Soma M1):</strong> {formatarValor(metaSemanal, 'moeda')}
                                                                </p>
                                                                <p className={cn("text-xs font-bold", percentualAtingido >= 100 ? "text-green-600" : "text-red-600")}>
                                                                  <strong>Atingido:</strong> {percentualAtingido}% {percentualAtingido >= 100 ? '✓' : ''}
                                                                </p>
                                                              </div>
                                                            )}
                                                          </div>
                                                        );
                                                      })()}
                                                      {metas[metricaPrincipal.key] && (
                                                        <p className="text-xs mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                                          <strong>Meta {visao === 'semanal' ? 'Semanal' : 'Mensal'}:</strong> {formatarValor(metas[metricaPrincipal.key].valor, metricaPrincipal.formato, metricaPrincipal.sufixo)}
                                                          {visao === 'semanal' && metasOrigens[metricaPrincipal.key]?.tipo === 'herdada' && (
                                                            <span className="text-[10px] text-gray-400 ml-1">(herdada{metasOrigens[metricaPrincipal.key]?.semana ? ` da S${metasOrigens[metricaPrincipal.key].semana}` : ''})</span>
                                                          )}
                                                        </p>
                                                      )}
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
                                               <Button size="icon" variant="ghost" className="absolute right-0 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { 
                                                 setEditando({ semanaId: semana.id!, campo: metricaPrincipal.key }); 
                                                 setValorEdit(valorPrincipal !== null && valorPrincipal !== undefined ? String(valorPrincipal).replace('.', ',') : ''); 
                                                 if (metricaPrincipal.formato === 'reservas' && metricaPrincipal.keyPessoas) {
                                                   setValorEditPessoas(valorPessoasPrincipal !== null && valorPessoasPrincipal !== undefined ? String(valorPessoasPrincipal).replace('.', ',') : '');
                                                 }
                                               }}><Pencil className="h-3 w-3 text-blue-600" /></Button>
                                           )}
                                        </div>
                                     )}
                                     {(!mostrarHeaderGrupo || secoesNaoColapsaveis.includes(secao.id) || gruposAbertos[`${secao.id}-${grupo.id}`]) && metricasParaMostrar.map((metrica) => {
                                        const valor = getValorComOverride(semana, metrica.key);
                                        const valorPessoas = metrica.keyPessoas ? getValorComOverride(semana, metrica.keyPessoas) : null;
                                        const valorPercentual = metrica.keyPercentual ? getValorComOverride(semana, metrica.keyPercentual) : null;
                                        const valorPercentualKey = metrica.percentualKey ? getValorComOverride(semana, metrica.percentualKey) : null;
                                        const isEditandoCell = editando?.semanaId === semana.id && editando?.campo === metrica.key;
                                       let valorFormatado = metrica.formato === 'reservas' ? (valor !== null && valor !== undefined ? `${Math.round(numeroMetrica(valor))}/${valorPessoas !== null && valorPessoas !== undefined ? Math.round(numeroMetrica(valorPessoas)) : '-'}` : '-') : formatarValor(valor, metrica.formato, metrica.sufixo);
                                      if (metrica.keyPercentual && valorPercentual !== null && valorPercentual !== undefined && typeof valorPercentual === 'number' && valor !== null && valor !== undefined) valorFormatado = `${formatarValor(valor, 'numero')} (${valorPercentual.toFixed(1)}%)`;
                                      // Mostrar número de respostas ao lado do NPS (ex: "80 (40)")
                                      if (metrica.respostasKey && valor !== null && valor !== undefined) {
                                        const respostas = getValorComOverride(semana, metrica.respostasKey);
                                        if (respostas !== null && respostas !== undefined && typeof respostas === 'number' && respostas > 0) {
                                          valorFormatado = `${formatarValor(valor, metrica.formato, metrica.sufixo)} (${respostas})`;
                                        }
                                      }
                                      // Mostrar total de avaliações ao lado das 5 estrelas (ex: "342 (361)")
                                      if (metrica.totalKey && valor !== null && valor !== undefined) {
                                        const total = getValorComOverride(semana, metrica.totalKey);
                                        if (total !== null && total !== undefined && typeof total === 'number' && total > 0) {
                                          valorFormatado = `${formatarValor(valor, metrica.formato, metrica.sufixo)} (${total})`;
                                        }
                                      }
                                      // Formato moeda_com_percentual: R$ 27.520 (3,5%)
                                       if (metrica.formato === 'moeda_com_percentual' && valor !== null && valor !== undefined) {
                                         const moedaFormatada = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(numeroMetrica(valor));
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
                                                  {metrica.formato === 'reservas' && metrica.keyPessoas ? (
                                                    <div className="flex items-center gap-1 px-1">
                                                      <Input type="text" value={valorEdit} onChange={(e) => setValorEdit(e.target.value)} className="w-10 h-6 text-xs p-1" placeholder="Mesas" onKeyDown={(e) => { if (e.key === 'Enter') salvarMetrica(semana.id!, metrica.key, metrica.keyPessoas); if (e.key === 'Escape') setEditando(null); }} />
                                                      <span className="text-xs text-gray-400">/</span>
                                                      <Input type="text" value={valorEditPessoas} onChange={(e) => setValorEditPessoas(e.target.value)} className="w-10 h-6 text-xs p-1" placeholder="Pessoas" onKeyDown={(e) => { if (e.key === 'Enter') salvarMetrica(semana.id!, metrica.key, metrica.keyPessoas); if (e.key === 'Escape') setEditando(null); }} />
                                                      <Button size="icon" variant="ghost" className="h-5 w-5 flex-shrink-0" onClick={() => salvarMetrica(semana.id!, metrica.key, metrica.keyPessoas)}><Check className="h-3 w-3 text-emerald-600" /></Button>
                                                      <Button size="icon" variant="ghost" className="h-5 w-5 flex-shrink-0" onClick={() => { setEditando(null); setValorEditPessoas(''); }}><X className="h-3 w-3 text-red-600" /></Button>
                                                    </div>
                                                  ) : (
                                                    <div className="flex items-center gap-1 px-1">
                                                      <Input type="text" value={valorEdit} onChange={(e) => setValorEdit(e.target.value)} className="w-14 h-6 text-xs p-1" onKeyDown={(e) => { if (e.key === 'Enter') salvarMetrica(semana.id!, metrica.key); if (e.key === 'Escape') setEditando(null); }} />
                                                      <Button size="icon" variant="ghost" className="h-5 w-5 flex-shrink-0" onClick={() => salvarMetrica(semana.id!, metrica.key)}><Check className="h-3 w-3 text-emerald-600" /></Button>
                                                      <Button size="icon" variant="ghost" className="h-5 w-5 flex-shrink-0" onClick={() => setEditando(null)}><X className="h-3 w-3 text-red-600" /></Button>
                                                    </div>
                                                  )}
                                                </div>
                                              ) : metrica.temTooltipGoogle5Estrelas && semana.data_inicio && semana.data_fim ? (
                                                <button
                                                  type="button"
                                                  onClick={() => abrirDetalhesGoogleReviews(semana, 5)}
                                                  className={cn(
                                                    "text-xs text-center underline decoration-dotted hover:opacity-80 transition-opacity",
                                                    getCorMeta(verificarMeta(valor, metrica.key, metas))
                                                  )}
                                                  title="Clique para ver avaliações 5 estrelas"
                                                >
                                                  {valorFormatado}
                                                </button>
                                              ) : metrica.temTooltipAtracao && semana.data_inicio && semana.data_fim ? (
                                                <button
                                                  type="button"
                                                  onClick={() => abrirDetalhesAtracao(semana)}
                                                  className={cn(
                                                    "text-xs text-center underline decoration-dotted hover:opacity-80 transition-opacity",
                                                    getCorMeta(verificarMeta(valor, metrica.key, metas))
                                                  )}
                                                  title="Clique para ver custos de atração por dia"
                                                >
                                                  {valorFormatado}
                                                </button>
                                              ) : temTooltipGoogle && semana.data_inicio && semana.data_fim ? (
                                                <button
                                                  type="button"
                                                  onClick={() => abrirDetalhesGoogleReviews(semana)}
                                                  className={cn(
                                                    "text-xs text-center underline decoration-dotted hover:opacity-80 transition-opacity",
                                                    getCorMeta(verificarMeta(valor, metrica.key, metas))
                                                  )}
                                                  title="Clique para ver detalhes das avaliações"
                                                >
                                                  {valorFormatado}
                                                </button>
                                              ) : (metrica.key === 'nps_digital' || metrica.key === 'nps_salao') && semana.data_inicio && semana.data_fim && valor !== null && valor !== undefined ? (
                                                <button
                                                  type="button"
                                                  onClick={() => abrirDetalhesNps(
                                                    semana, 
                                                    metrica.key === 'nps_digital' ? 'NPS Digital' : 'Salão',
                                                    metrica.label
                                                  )}
                                                  className={cn(
                                                    "text-xs text-center underline decoration-dotted hover:opacity-80 transition-opacity",
                                                    getCorMeta(verificarMeta(valor, metrica.key, metas))
                                                  )}
                                                  title="Clique para ver detalhes das respostas NPS"
                                                >
                                                  {valorFormatado}
                                                </button>
                                              ) : metrica.temTooltipFaturamento ? (
                                                <TooltipProvider>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <span className={cn("text-xs text-center cursor-help", getCorMeta(verificarMeta(valor, metrica.key, metas)))}>
                                                        {valorFormatado}
                                                      </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className={cn("max-w-xs p-3", STATUS_COLORS[metrica.status].bg)}>
                                                      <div className="space-y-1">
                                                        <p className="font-semibold text-sm">{metrica.label}</p>
                                                        <p className="text-xs"><strong>Fonte:</strong> {metrica.fonte}</p>
                                                        <p className="text-xs"><strong>Cálculo:</strong> {metrica.calculo}</p>
                                                        {(() => {
                                                          const contaAssinada = numeroMetrica(getValorComOverride(semana, 'conta_assinada_valor'));
                                                          const faturamentoTotal = numeroMetrica(valor);
                                                          const faturamentoBruto = faturamentoTotal + contaAssinada;
                                                          return (
                                                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 space-y-1">
                                                              <p className="text-xs">
                                                                <strong>Fat. Bruto:</strong> {formatarValor(faturamentoBruto, 'moeda')}
                                                              </p>
                                                              <p className="text-xs text-red-600 dark:text-red-400">
                                                                <strong>(-) Conta Assinada:</strong> {formatarValor(contaAssinada, 'moeda')}
                                                              </p>
                                                              <p className="text-xs font-semibold">
                                                                <strong>= Fat. Total:</strong> {formatarValor(faturamentoTotal, 'moeda')}
                                                              </p>
                                                            </div>
                                                          );
                                                        })()}
                                                        {metas[metrica.key] && (
                                                          <p className="text-xs mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                                            <strong>Meta {visao === 'semanal' ? 'Semanal' : 'Mensal'}:</strong> {formatarValor(metas[metrica.key].valor, metrica.formato, metrica.sufixo)}
                                                          </p>
                                                        )}
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
                                              ) : metrica.key === 'falae_nps_score' ? (
                                                <button
                                                  type="button"
                                                  onClick={() => abrirDetalhesFalae(semana)}
                                                  className={cn(
                                                    "text-xs text-center underline decoration-dotted hover:opacity-80 transition-opacity",
                                                    getCorMeta(verificarMeta(valor, metrica.key, metas))
                                                  )}
                                                  title="Clique para ver médias por avaliação e comentários"
                                                >
                                                  {valorFormatado}
                                                </button>
                                              ) : temDetalhes ? (
                                                <TooltipProvider>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <span className={cn("text-xs text-center cursor-help underline decoration-dotted", getCorMeta(verificarMeta(valor, metrica.key, metas)))}>
                                                        {valorFormatado}
                                                      </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="max-w-sm p-3 max-h-[320px] overflow-y-auto">
                                                      <div className="space-y-1">
                                                        <p className="font-semibold text-sm">{metrica.label}</p>
                                                        <p className="text-xs"><strong>Fonte:</strong> {metrica.fonte}</p>
                                                        <p className="text-xs"><strong>Cálculo:</strong> {metrica.calculo}</p>
                                                        {metas[metrica.key] && (
                                                          <p className="text-xs mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                                            <strong>Meta {visao === 'semanal' ? 'Semanal' : 'Mensal'}:</strong> {formatarValor(metas[metrica.key].valor, metrica.formato, metrica.sufixo)}
                                                          </p>
                                                        )}
                                                        {metrica.keyPercentual && valorPercentual !== null && typeof valorPercentual === 'number' && (
                                                          <p className="text-xs"><strong>Percentual:</strong> {valorPercentual.toFixed(1)}%</p>
                                                        )}
                                                        {(() => {
                                                          const detalhesKey = metrica.detalhesKey || metrica.key + '_detalhes';
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
                                                     <span className={cn("text-xs text-center cursor-help", getCorMeta(verificarMeta(valor, metrica.key, metas)))}>
                                                       {valorFormatado}
                                                     </span>
                                                   </TooltipTrigger>
                                                   <TooltipContent side="top" className={cn("max-w-xs p-3", STATUS_COLORS[metrica.status].bg)}>
                                                     <div className="space-y-1">
                                                       <p className="font-semibold text-sm">{metrica.label}</p>
                                                       <p className="text-xs"><strong>Fonte:</strong> {metrica.fonte}</p>
                                                       <p className="text-xs"><strong>Cálculo:</strong> {metrica.calculo}</p>
                                                       {metas[metrica.key] && (
                                                         <p className="text-xs mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                                           <strong>Meta {visao === 'semanal' ? 'Semanal' : 'Mensal'}:</strong> {formatarValor(metas[metrica.key].valor, metrica.formato, metrica.sufixo)}
                                                         </p>
                                                       )}
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
                                                 <Button size="icon" variant="ghost" className="absolute right-0 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { 
                                                   setEditando({ semanaId: semana.id!, campo: metrica.key }); 
                                                   setValorEdit(valor?.toString().replace('.', ',') || ''); 
                                                   if (metrica.formato === 'reservas' && metrica.keyPessoas) {
                                                     setValorEditPessoas(valorPessoas?.toString().replace('.', ',') || '');
                                                   }
                                                 }}><Pencil className="h-3 w-3 text-blue-600" /></Button>
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
    <Dialog open={metasModalAberto} onOpenChange={setMetasModalAberto}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Metas de Desempenho ({visao === 'semanal' ? 'Semanal' : 'Mensal'})</DialogTitle>
          <DialogDescription>
            Metas agrupadas por bloco do desempenho. Edite e salve quando quiser.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto px-1">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 py-2">
            {metasPorSecao.map((secao) => (
              <section key={secao.id} className="rounded-md border p-3 bg-gray-50 dark:bg-gray-800/60 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{secao.titulo}</h3>
                {secao.grupos.map((grupo) => (
                  <div key={`${secao.id}-${grupo.id}`} className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 p-2.5 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{grupo.label}</p>
                    {grupo.metricas.map((m) => (
                      <div key={m.key} className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-2 items-center">
                        <div>
                          <p className="text-sm text-gray-900 dark:text-gray-100">{m.label} - Meta</p>
                          <p className="text-[11px] text-gray-500">
                            Atual: {metas[m.key] ? formatarValor(metas[m.key].valor, m.formato, m.sufixo) : '-'} • Op. {metas[m.key]?.operador || (m.inverso ? '<=' : '>=')}
                          </p>
                        </div>
                        <Input
                          value={metasEditValues[m.key] || ''}
                          onChange={(e) =>
                            setMetasEditValues((prev) => ({
                              ...prev,
                              [m.key]: e.target.value,
                            }))
                          }
                          placeholder={`Ex: ${m.formato.includes('moeda') ? '103.00' : '95'}`}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </section>
            ))}
          </div>
        </div>
        <DialogFooter className="p-0 pt-2">
          <Button type="button" variant="outline" onClick={() => setMetasModalAberto(false)} disabled={salvandoMetas}>
            Cancelar
          </Button>
          <Button type="button" onClick={salvarMetasDesempenho} disabled={salvandoMetas}>
            {salvandoMetas ? 'Salvando...' : 'Salvar Metas'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={falaeDialog.aberto} onOpenChange={(aberto) => setFalaeDialog((prev) => ({ ...prev, aberto }))}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Detalhes NPS Falaê</DialogTitle>
          <DialogDescription>
            Semana {falaeDialog.periodo} • NPS {falaeDialog.npsScore ?? '-'} • {falaeDialog.totalRespostas} respostas
          </DialogDescription>
        </DialogHeader>
        <div className="p-4 pt-0 space-y-4 overflow-y-auto max-h-[70vh]">
          <section className="rounded-md border p-3 bg-blue-50/60 dark:bg-blue-950/20">
            <p className="text-sm font-semibold mb-1">Como o NPS é calculado</p>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              O NPS usa somente a nota geral de 0 a 10:
              <span className="font-medium"> Promotores ({falaeDialog.promotores})</span>,
              <span className="font-medium"> Detratores ({falaeDialog.detratores})</span> e
              <span className="font-medium"> Total ({falaeDialog.totalRespostas})</span>.
            </p>
            <p className="text-xs text-gray-700 dark:text-gray-200 mt-1">
              Fórmula: (({falaeDialog.promotores} - {falaeDialog.detratores}) / {falaeDialog.totalRespostas || 1}) x 100 ={' '}
              <span className="font-semibold">{falaeDialog.npsScore ?? '-'}</span>
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              As notas de “Média por avaliação” (Música, Atendimento, etc.) são critérios de qualidade e não entram diretamente nessa fórmula.
            </p>
          </section>
          <section className="rounded-md border p-3">
            <p className="text-sm font-semibold mb-3">Média por avaliação</p>
            {falaeDialog.avaliacoes.length === 0 ? (
              <p className="text-sm text-gray-500">Sem avaliações detalhadas na semana.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {falaeDialog.avaliacoes.map((a) => (
                  <div
                    key={a.nome}
                    className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2.5 py-2"
                  >
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{a.nome}</p>
                    <p className="text-sm font-semibold">
                      {a.media.toFixed(1).replace('.', ',')}/5 <span className="text-gray-500 font-normal">({a.total})</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="rounded-md border p-3">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold">Comentários da semana</p>
                <p className="text-xs text-gray-500">
                  {falaeDialog.totalRespostas} respostas no total • {contagemComentariosFalae.todos} com comentário
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={filtroComentarioFalae === 'detrator' ? 'default' : 'outline'}
                  className="h-7 px-2 text-xs"
                  onClick={() => setFiltroComentarioFalae('detrator')}
                >
                  Detratores ({contagemComentariosFalae.detrator} comentários)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={filtroComentarioFalae === 'neutro' ? 'default' : 'outline'}
                  className="h-7 px-2 text-xs"
                  onClick={() => setFiltroComentarioFalae('neutro')}
                >
                  Neutros ({contagemComentariosFalae.neutro} comentários)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={filtroComentarioFalae === 'promotor' ? 'default' : 'outline'}
                  className="h-7 px-2 text-xs"
                  onClick={() => setFiltroComentarioFalae('promotor')}
                >
                  Promotores ({contagemComentariosFalae.promotor} comentários)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={filtroComentarioFalae === 'todos' ? 'default' : 'outline'}
                  className="h-7 px-2 text-xs"
                  onClick={() => setFiltroComentarioFalae('todos')}
                >
                  Todos comentários ({contagemComentariosFalae.todos})
                </Button>
              </div>
            </div>
            {comentariosFalaeOrdenadosFiltrados.length === 0 ? (
              <p className="text-sm text-gray-500">Sem comentários na semana.</p>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                {comentariosFalaeOrdenadosFiltrados.map((c, idx) => (
                  <div key={`${c.data}-${idx}`} className="rounded bg-gray-50 dark:bg-gray-800 p-2">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>NPS {c.nps} • {c.tipo}</span>
                      <span>{new Date(c.data).toLocaleString('pt-BR')}</span>
                    </div>
                    {!!c.avaliacoes?.length && (
                      <div className="mb-1 flex flex-wrap gap-1">
                        {c.avaliacoes.map((a, idxA) => (
                          <span
                            key={`${a.nome}-${idxA}`}
                            className="inline-flex items-center rounded bg-white dark:bg-gray-700 px-1.5 py-0.5 text-[11px] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
                          >
                            {a.nome}: {a.nota.toFixed(1).replace('.', ',')}/5
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-sm">{c.comentario}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
    
    {/* Modal Google Reviews Detalhado */}
    <Dialog open={googleReviewsDialog.aberto} onOpenChange={(aberto) => setGoogleReviewsDialog(prev => ({ ...prev, aberto }))}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" />
            {googleReviewsDialog.titulo}
          </DialogTitle>
          <DialogDescription>
            Semana {googleReviewsDialog.periodo} • Média {googleReviewsDialog.media.toFixed(2).replace('.', ',')} • {googleReviewsDialog.total} avaliações
            {googleReviewsDialog.filtroEstrelas === 5 && ' de 5 estrelas'}
          </DialogDescription>
        </DialogHeader>
        
        {googleReviewsDialog.loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
            <span className="ml-3 text-gray-500">Carregando detalhes...</span>
          </div>
        ) : (
          <div className="p-4 pt-0 space-y-4 overflow-y-auto max-h-[70vh]">
            {/* Resumo Geral */}
            <section className="rounded-md border p-3 bg-yellow-50/60 dark:bg-yellow-950/20">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-yellow-600">{googleReviewsDialog.media.toFixed(2).replace('.', ',')}</p>
                    <p className="text-xs text-gray-500">Média</p>
                  </div>
                  <div className="space-y-0.5">
                    {[5, 4, 3, 2, 1].map(star => (
                      <div key={star} className="flex items-center gap-1">
                        <span className="text-xs w-3">{star}</span>
                        <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                        <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-yellow-500 rounded-full" 
                            style={{ width: `${googleReviewsDialog.total > 0 ? (googleReviewsDialog.distribuicao[star] / googleReviewsDialog.total) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-8">{googleReviewsDialog.distribuicao[star]}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-center md:text-right">
                  <p className="text-2xl font-bold">{googleReviewsDialog.total}</p>
                  <p className="text-xs text-gray-500">Total de avaliações</p>
                </div>
              </div>
            </section>

            {/* Avaliações por Dia */}
            {googleReviewsDialog.porDia.length > 0 && (
              <section className="rounded-md border p-3">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold">Avaliações por dia</p>
                  {filtroDiaGoogle && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs text-gray-500"
                      onClick={() => { setFiltroDiaGoogle(null); setPaginaReviewGoogle(1); }}
                    >
                      Limpar filtro de dia
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
                  {googleReviewsDialog.porDia.map((dia) => (
                    <button
                      type="button"
                      key={dia.data} 
                      onClick={() => { setFiltroDiaGoogle(filtroDiaGoogle === dia.data ? null : dia.data); setPaginaReviewGoogle(1); }}
                      className={cn(
                        "rounded border p-2 text-center transition-all cursor-pointer",
                        filtroDiaGoogle === dia.data 
                          ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30 ring-2 ring-yellow-500/50" 
                          : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-yellow-400 hover:bg-yellow-50/50"
                      )}
                    >
                      <p className="text-xs text-gray-500">{dia.diaSemana}</p>
                      <p className="text-xs font-medium">{dia.data}</p>
                      <p className="text-lg font-bold text-yellow-600">{dia.total}</p>
                      <p className="text-xs text-gray-500">⭐ {dia.media.toFixed(2).replace('.', ',')}</p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Percepção do Cliente */}
            {(googleReviewsDialog.elogios.length > 0 || googleReviewsDialog.criticas.length > 0) && (
              <section className="rounded-md border p-3">
                <p className="text-sm font-semibold mb-3">Percepção do Cliente</p>
                <div className="space-y-2">
                  {googleReviewsDialog.elogios.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 font-medium text-xs flex-shrink-0">✓ Elogios:</span>
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        {googleReviewsDialog.elogios.join(', ')}
                      </p>
                    </div>
                  )}
                  {googleReviewsDialog.criticas.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-orange-600 font-medium text-xs flex-shrink-0">⚠ Atenção:</span>
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        {googleReviewsDialog.criticas.join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Avaliações com Comentários */}
            <section className="rounded-md border p-3">
              <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold">Avaliações com comentários</p>
                  <p className="text-xs text-gray-500">
                    {reviewsGoogleFiltradas.length} de {contagemReviewsGoogle.todos} avaliações
                    {filtroDiaGoogle && ` (filtrado por ${filtroDiaGoogle})`}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    variant={filtroReviewGoogle === 'negativo' ? 'default' : 'outline'}
                    className="h-7 px-2 text-xs"
                    onClick={() => { setFiltroReviewGoogle('negativo'); setPaginaReviewGoogle(1); }}
                  >
                    ⭐ 1-2 ({contagemReviewsGoogle.negativo})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={filtroReviewGoogle === 'neutro' ? 'default' : 'outline'}
                    className="h-7 px-2 text-xs"
                    onClick={() => { setFiltroReviewGoogle('neutro'); setPaginaReviewGoogle(1); }}
                  >
                    ⭐ 3 ({contagemReviewsGoogle.neutro})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={filtroReviewGoogle === 'positivo' ? 'default' : 'outline'}
                    className="h-7 px-2 text-xs"
                    onClick={() => { setFiltroReviewGoogle('positivo'); setPaginaReviewGoogle(1); }}
                  >
                    ⭐ 4-5 ({contagemReviewsGoogle.positivo})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={filtroReviewGoogle === 'todos' ? 'default' : 'outline'}
                    className="h-7 px-2 text-xs"
                    onClick={() => { setFiltroReviewGoogle('todos'); setPaginaReviewGoogle(1); }}
                  >
                    Todos ({contagemReviewsGoogle.todos})
                  </Button>
                </div>
              </div>
              {reviewsGoogleFiltradas.length === 0 ? (
                <p className="text-sm text-gray-500">Sem avaliações com comentário nesta categoria.</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                    {reviewsGooglePaginadas.map((review, idx) => {
                      const reviewKey = `${review.data}-${review.nome}-${idx}`;
                      const isExpanded = reviewExpandidaGoogle.has(reviewKey);
                      const textoLongo = review.texto.length > 150;
                      
                      return (
                        <div 
                          key={reviewKey} 
                          className={cn(
                            "rounded p-2",
                            review.tipo === 'negativo' ? 'bg-red-50 dark:bg-red-950/30' :
                            review.tipo === 'neutro' ? 'bg-yellow-50 dark:bg-yellow-950/30' :
                            'bg-green-50 dark:bg-green-950/30'
                          )}
                        >
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium">{review.nome}</span>
                            <span className="text-gray-500">{review.data}</span>
                          </div>
                          <div className="flex items-center gap-0.5 mb-1">
                            {Array.from({ length: review.stars }).map((_, i) => (
                              <Star key={i} className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                            ))}
                            {Array.from({ length: 5 - review.stars }).map((_, i) => (
                              <Star key={i} className="w-3 h-3 text-gray-300" />
                            ))}
                          </div>
                          <p className={cn(
                            "text-xs text-gray-700 dark:text-gray-300",
                            !isExpanded && textoLongo && "line-clamp-3"
                          )}>
                            {review.texto}
                          </p>
                          {textoLongo && (
                            <button
                              type="button"
                              onClick={() => {
                                setReviewExpandidaGoogle(prev => {
                                  const newSet = new Set(prev);
                                  if (isExpanded) {
                                    newSet.delete(reviewKey);
                                  } else {
                                    newSet.add(reviewKey);
                                  }
                                  return newSet;
                                });
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 mt-1 font-medium"
                            >
                              {isExpanded ? 'Ver menos' : 'Ver mais...'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Paginação */}
                  {totalPaginasReviewGoogle > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-3 border-t">
                      <p className="text-xs text-gray-500">
                        Mostrando {((paginaReviewGoogle - 1) * REVIEWS_POR_PAGINA) + 1} - {Math.min(paginaReviewGoogle * REVIEWS_POR_PAGINA, reviewsGoogleFiltradas.length)} de {reviewsGoogleFiltradas.length}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={paginaReviewGoogle === 1}
                          onClick={() => setPaginaReviewGoogle(1)}
                        >
                          ««
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={paginaReviewGoogle === 1}
                          onClick={() => setPaginaReviewGoogle(p => Math.max(1, p - 1))}
                        >
                          «
                        </Button>
                        <span className="px-2 text-xs">
                          {paginaReviewGoogle} / {totalPaginasReviewGoogle}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={paginaReviewGoogle === totalPaginasReviewGoogle}
                          onClick={() => setPaginaReviewGoogle(p => Math.min(totalPaginasReviewGoogle, p + 1))}
                        >
                          »
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={paginaReviewGoogle === totalPaginasReviewGoogle}
                          onClick={() => setPaginaReviewGoogle(totalPaginasReviewGoogle)}
                        >
                          »»
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Modal de NPS Digital/Salão */}
    <Dialog open={npsDialog.aberto} onOpenChange={(aberto) => setNpsDialog((prev) => ({ ...prev, aberto }))}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-blue-600" />
            Detalhes {npsDialog.titulo}
          </DialogTitle>
          <DialogDescription>
            Semana {npsDialog.periodo} • NPS {npsDialog.npsScore ?? '-'} • {npsDialog.total} respostas
          </DialogDescription>
        </DialogHeader>
        {npsDialog.loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="p-4 pt-0 space-y-4 overflow-y-auto max-h-[70vh]">
            {/* Resumo NPS */}
            <section className="rounded-md border p-3 bg-blue-50/60 dark:bg-blue-950/20">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className={cn(
                      "text-3xl font-bold",
                      npsDialog.npsScore !== null && npsDialog.npsScore >= 70 ? "text-green-600" :
                      npsDialog.npsScore !== null && npsDialog.npsScore >= 50 ? "text-yellow-600" :
                      npsDialog.npsScore !== null && npsDialog.npsScore >= 0 ? "text-orange-500" : "text-red-600"
                    )}>
                      {npsDialog.npsScore ?? '-'}
                    </p>
                    <p className="text-xs text-gray-500">NPS Score</p>
                  </div>
                  <div className="text-sm space-y-0.5">
                    <p className="text-green-600">Promotores (9-10): <span className="font-semibold">{npsDialog.promotores}</span></p>
                    <p className="text-yellow-600">Neutros (7-8): <span className="font-semibold">{npsDialog.neutros}</span></p>
                    <p className="text-red-600">Detratores (0-6): <span className="font-semibold">{npsDialog.detratores}</span></p>
                  </div>
                </div>
                <div className="text-center md:text-right">
                  <p className="text-2xl font-bold">{npsDialog.total}</p>
                  <p className="text-xs text-gray-500">Total de respostas</p>
                  {npsDialog.mediaNotas && (
                    <p className="text-xs text-gray-500">Média: {npsDialog.mediaNotas.toFixed(1)}</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                <strong>Fórmula:</strong> (({npsDialog.promotores} - {npsDialog.detratores}) / {npsDialog.total || 1}) × 100 = <span className="font-semibold">{npsDialog.npsScore ?? '-'}</span>
              </p>
            </section>

            {/* Médias por Critério */}
            {npsDialog.criteriosMedia.length > 0 && (
              <section className="rounded-md border p-3">
                <p className="text-sm font-semibold mb-3">Média por avaliação</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {npsDialog.criteriosMedia.map((c) => (
                    <div
                      key={c.nome}
                      className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2.5 py-2"
                    >
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{c.nome}</p>
                      <p className={cn(
                        "text-lg font-bold",
                        c.media >= 9 ? "text-green-600" : c.media >= 7 ? "text-yellow-600" : "text-red-500"
                      )}>
                        {c.media.toFixed(1)}
                        <span className="text-xs text-gray-400 font-normal ml-1">({c.total})</span>
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Respostas por Dia */}
            {npsPorDia.length > 0 && (
              <section className="rounded-md border p-3">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold">Respostas por dia</p>
                  {filtroDiaNps && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs text-gray-500"
                      onClick={() => { setFiltroDiaNps(null); setPaginaNps(1); }}
                    >
                      Limpar filtro de dia
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
                  {npsPorDia.map((dia) => (
                    <button
                      type="button"
                      key={dia.data}
                      onClick={() => { setFiltroDiaNps(filtroDiaNps === dia.data ? null : dia.data); setPaginaNps(1); }}
                      className={cn(
                        "rounded border p-2 text-center transition-all cursor-pointer",
                        filtroDiaNps === dia.data
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-500/50"
                          : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-blue-400 hover:bg-blue-50/50"
                      )}
                    >
                      <p className="text-xs text-gray-500">{dia.diaSemana}</p>
                      <p className="text-xs font-medium">{dia.data.split('-').slice(1).reverse().join('/')}</p>
                      <p className="text-lg font-bold text-blue-600">{dia.total}</p>
                      <p className={cn(
                        "text-xs font-medium",
                        dia.nps >= 50 ? "text-green-600" : dia.nps >= 0 ? "text-yellow-600" : "text-red-600"
                      )}>NPS {dia.nps}</p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Respostas Individuais */}
            <section className="rounded-md border p-3">
              <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold">Respostas da semana</p>
                  <p className="text-xs text-gray-500">
                    {respostasNpsFiltradas.length} de {npsDialog.total} respostas
                    {filtroDiaNps && ` (filtrado por ${filtroDiaNps.split('-').slice(1).reverse().join('/')})`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={filtroNps === 'todos' ? 'default' : 'outline'}
                    onClick={() => { setFiltroNps('todos'); setPaginaNps(1); }}
                    className="text-xs h-7 px-2"
                  >
                    Todos ({contagemRespostasNps.todos})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={filtroNps === 'detrator' ? 'destructive' : 'outline'}
                    onClick={() => { setFiltroNps('detrator'); setPaginaNps(1); }}
                    className="text-xs h-7 px-2"
                  >
                    0-6 ({contagemRespostasNps.detrator})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={filtroNps === 'neutro' ? 'secondary' : 'outline'}
                    onClick={() => { setFiltroNps('neutro'); setPaginaNps(1); }}
                    className="text-xs h-7 px-2"
                  >
                    7-8 ({contagemRespostasNps.neutro})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={filtroNps === 'promotor' ? 'default' : 'outline'}
                    onClick={() => { setFiltroNps('promotor'); setPaginaNps(1); }}
                    className={cn("text-xs h-7 px-2", filtroNps === 'promotor' && "bg-green-600 hover:bg-green-700")}
                  >
                    9-10 ({contagemRespostasNps.promotor})
                  </Button>
                </div>
              </div>
              {respostasNpsFiltradas.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Nenhuma resposta encontrada</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {respostasNpsPaginadas.map((resp) => {
                      const isExpanded = respostaExpandidaNps.has(resp.id);
                      const comentarioLongo = resp.comentario && resp.comentario.length > 100;
                      
                      return (
                        <div
                          key={resp.id}
                          className={cn(
                            "rounded border p-2",
                            resp.tipo === 'promotor' ? "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/30" :
                            resp.tipo === 'detrator' ? "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30" :
                            "border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-950/30"
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={cn(
                              "text-lg font-bold",
                              resp.tipo === 'promotor' ? "text-green-600" :
                              resp.tipo === 'detrator' ? "text-red-600" : "text-yellow-600"
                            )}>
                              {resp.nps}
                            </span>
                            <div className="text-right">
                              <span className="text-[10px] text-gray-500 block">
                                {resp.dataVisita ? `Visita: ${resp.dataVisita}` : resp.data}
                              </span>
                              {resp.clientName && (
                                <span className="text-[10px] text-gray-400 block truncate max-w-[120px]">
                                  {resp.clientName}
                                </span>
                              )}
                            </div>
                          </div>
                          {resp.comentario && (
                            <>
                              <p className={cn(
                                "text-xs text-gray-700 dark:text-gray-300 mt-1",
                                !isExpanded && comentarioLongo && "line-clamp-2"
                              )}>
                                &quot;{resp.comentario}&quot;
                              </p>
                              {comentarioLongo && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRespostaExpandidaNps(prev => {
                                      const newSet = new Set(prev);
                                      if (isExpanded) {
                                        newSet.delete(resp.id);
                                      } else {
                                        newSet.add(resp.id);
                                      }
                                      return newSet;
                                    });
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-800 mt-1 font-medium"
                                >
                                  {isExpanded ? 'Ver menos' : 'Ver mais...'}
                                </button>
                              )}
                            </>
                          )}
                          {resp.criterios.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {resp.criterios.slice(0, 3).map((c, i) => (
                                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                  {c.nome}: {c.nota}
                                </span>
                              ))}
                              {resp.criterios.length > 3 && (
                                <span className="text-[10px] text-gray-400">+{resp.criterios.length - 3}</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Paginação NPS */}
                  {totalPaginasNps > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-3 border-t">
                      <p className="text-xs text-gray-500">
                        Mostrando {((paginaNps - 1) * NPS_POR_PAGINA) + 1} - {Math.min(paginaNps * NPS_POR_PAGINA, respostasNpsFiltradas.length)} de {respostasNpsFiltradas.length}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={paginaNps === 1}
                          onClick={() => setPaginaNps(1)}
                        >
                          ««
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={paginaNps === 1}
                          onClick={() => setPaginaNps(p => Math.max(1, p - 1))}
                        >
                          «
                        </Button>
                        <span className="px-2 text-xs">
                          {paginaNps} / {totalPaginasNps}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={paginaNps === totalPaginasNps}
                          onClick={() => setPaginaNps(p => Math.min(totalPaginasNps, p + 1))}
                        >
                          »
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={paginaNps === totalPaginasNps}
                          onClick={() => setPaginaNps(totalPaginasNps)}
                        >
                          »»
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Modal de Atração/Faturamento */}
    <Dialog open={atracaoDialog.aberto} onOpenChange={(aberto) => setAtracaoDialog((prev) => ({ ...prev, aberto }))}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-purple-600" />
            Custos de Atração por Dia
          </DialogTitle>
          <DialogDescription>
            Semana {atracaoDialog.periodo} • {atracaoDialog.total} eventos • Custo Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(atracaoDialog.custoTotal)}
          </DialogDescription>
        </DialogHeader>
        {atracaoDialog.loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          </div>
        ) : (
          <div className="p-4 pt-0 space-y-4 overflow-y-auto max-h-[70vh]">
            {/* Resumo Geral */}
            <section className="rounded-md border p-3 bg-purple-50/60 dark:bg-purple-950/20">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-xs text-gray-500">Custo Artístico</p>
                      <p className="text-lg font-bold text-purple-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(atracaoDialog.custoArtisticoTotal)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Custo Produção</p>
                      <p className="text-lg font-bold text-orange-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(atracaoDialog.custoProducaoTotal)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Custo Total</p>
                      <p className="text-lg font-bold text-red-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(atracaoDialog.custoTotal)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-center md:text-right space-y-1">
                  <div>
                    <p className="text-xs text-gray-500">Faturamento Total</p>
                    <p className="text-lg font-bold text-green-600">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(atracaoDialog.faturamentoTotal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">% Atração/Fat.</p>
                    <p className={cn(
                      "text-lg font-bold",
                      atracaoDialog.percentualMedio <= 5 ? "text-green-600" :
                      atracaoDialog.percentualMedio <= 10 ? "text-yellow-600" : "text-red-600"
                    )}>
                      {atracaoDialog.percentualMedio.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Detalhes por Dia */}
            <section className="rounded-md border p-3">
              <p className="text-sm font-semibold mb-3">Custos por dia da semana</p>
              {atracaoDialog.dias.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Nenhum evento encontrado</p>
              ) : (
                <div className="space-y-2">
                  {atracaoDialog.dias.map((dia) => (
                    <div
                      key={dia.data}
                      className={cn(
                        "rounded border p-3",
                        dia.custoTotal > 0 ? "border-purple-200 bg-purple-50/50 dark:border-purple-900 dark:bg-purple-950/30" :
                        "border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50"
                      )}
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-500 w-16">{dia.diaSemana}</span>
                            <span className="text-xs text-gray-400">{dia.dataFormatada}</span>
                          </div>
                          <p className="text-sm font-medium mt-0.5 line-clamp-1">{dia.evento}</p>
                          {dia.artista && (
                            <p className="text-xs text-gray-500 mt-0.5">Artista: {dia.artista}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          {dia.custoArtistico > 0 && (
                            <div>
                              <p className="text-[10px] text-gray-400">Artístico</p>
                              <p className="text-xs font-semibold text-purple-600">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dia.custoArtistico)}
                              </p>
                            </div>
                          )}
                          {dia.custoProducao > 0 && (
                            <div>
                              <p className="text-[10px] text-gray-400">Produção</p>
                              <p className="text-xs font-semibold text-orange-600">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dia.custoProducao)}
                              </p>
                            </div>
                          )}
                          <div>
                            <p className="text-[10px] text-gray-400">Custo Total</p>
                            <p className={cn(
                              "text-xs font-semibold",
                              dia.custoTotal > 0 ? "text-red-600" : "text-gray-400"
                            )}>
                              {dia.custoTotal > 0 
                                ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dia.custoTotal)
                                : '-'
                              }
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400">Faturamento</p>
                            <p className="text-xs font-semibold text-green-600">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dia.faturamento)}
                            </p>
                          </div>
                          <div className="w-12">
                            <p className="text-[10px] text-gray-400">%</p>
                            <p className={cn(
                              "text-xs font-semibold",
                              dia.percentualFat <= 5 ? "text-green-600" :
                              dia.percentualFat <= 10 ? "text-yellow-600" : "text-red-600"
                            )}>
                              {dia.percentualFat > 0 ? `${dia.percentualFat.toFixed(1)}%` : '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Couvert (se houver) */}
            {atracaoDialog.couvertTotal > 0 && (
              <section className="rounded-md border p-3 bg-amber-50/60 dark:bg-amber-950/20">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Couvert Total da Semana</p>
                  <p className="text-lg font-bold text-amber-600">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(atracaoDialog.couvertTotal)}
                  </p>
                </div>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
    
    {/* Modal de Edição Individual de Meta */}
    <Dialog open={editMetaDialog.aberto} onOpenChange={(aberto) => !editMetaDialog.salvando && setEditMetaDialog(prev => ({ ...prev, aberto }))}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-600" />
            Editar Meta
          </DialogTitle>
          <DialogDescription>
            {editMetaDialog.metrica?.label}
            {visao === 'semanal' && semanaSelecionada && (
              <span className="ml-2 text-amber-600 font-medium">
                — Semana {String(semanaSelecionada.numero_semana).padStart(2, '0')}/{semanaSelecionada.ano}
              </span>
            )}
            {editMetaDialog.metrica && metasOrigens[editMetaDialog.metrica.key]?.tipo === 'herdada' && (
              <span className="block text-[11px] text-gray-400 mt-1 italic">
                Valor atual herdado{metasOrigens[editMetaDialog.metrica.key]?.semana ? ` da Semana ${metasOrigens[editMetaDialog.metrica.key].semana}` : ' (global)'}. Ao salvar, será definido para esta semana.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Valor atual:</span>
            <span className="font-medium">
              {editMetaDialog.valorAtual !== null 
                ? formatarValor(editMetaDialog.valorAtual, editMetaDialog.metrica?.formato || 'numero', editMetaDialog.metrica?.sufixo)
                : <span className="text-gray-400 italic">não definido</span>
              }
            </span>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Novo valor:</label>
            <Input
              type="text"
              placeholder={editMetaDialog.metrica?.formato?.includes('moeda') ? 'Ex: 420000' : editMetaDialog.metrica?.formato?.includes('percentual') ? 'Ex: 29' : 'Digite o valor'}
              value={editMetaDialog.valorNovo}
              onChange={(e) => setEditMetaDialog(prev => ({ ...prev, valorNovo: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !editMetaDialog.salvando) {
                  salvarMetaIndividual();
                }
              }}
              className="text-lg font-medium"
            />
            <p className="text-xs text-gray-500">
              {editMetaDialog.metrica?.formato?.includes('moeda') && 'Digite apenas números (ex: 420000 para R$ 420.000)'}
              {editMetaDialog.metrica?.formato?.includes('percentual') && 'Digite apenas números (ex: 29 para 29%)'}
              {!editMetaDialog.metrica?.formato?.includes('moeda') && !editMetaDialog.metrica?.formato?.includes('percentual') && 'Digite o valor numérico'}
            </p>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 rounded p-2">
            <Pencil className="w-3 h-3" />
            <span>Alterações são registradas no histórico automaticamente</span>
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => setEditMetaDialog({ aberto: false, metrica: null, valorAtual: null, valorNovo: '', salvando: false })}
            disabled={editMetaDialog.salvando}
          >
            Cancelar
          </Button>
          <Button 
            type="button" 
            onClick={salvarMetaIndividual} 
            disabled={editMetaDialog.salvando || !editMetaDialog.valorNovo.trim()}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {editMetaDialog.salvando ? 'Salvando...' : 'Salvar Meta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
