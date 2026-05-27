'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus, Construction, LucideIcon, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Singletons no escopo do modulo - IndicadorCard renderiza dezenas de vezes por dashboard.
const FMT_IND_MOEDA = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});
const FMT_IND_NUM = new Intl.NumberFormat('pt-BR');

interface IndicadorCardProps {
  titulo: string;
  valor: number;
  meta: number;
  prefixo?: string;
  sufixo?: string;
  formato?: 'numero' | 'moeda' | 'percentual' | 'decimal';
  tendencia?: number;
  detalhes?: Record<string, number>;
  cor?: 'blue' | 'green' | 'purple' | 'yellow' | 'red' | 'orange' | 'pink' | 'cyan' | 'indigo';
  inverterProgresso?: boolean; // Para indicadores onde "menos é melhor"
  inverterComparacao?: boolean; // Para indicadores onde variação negativa é boa (CMO, % Artística)
  periodoAnalisado?: string; // Período que está sendo analisado
  emDesenvolvimento?: boolean; // Para indicadores em desenvolvimento
  comparacao?: {
    valor: number;
    label: string; // "vs mês anterior" ou "vs trimestre anterior"
  };
  icone?: LucideIcon; // Ícone do card
  tooltipTexto?: string; // Texto explicativo do tooltip
}

export function IndicadorCard({
  titulo,
  valor,
  meta,
  prefixo = '',
  sufixo = '',
  formato = 'numero',
  tendencia,
  detalhes,
  cor = 'blue',
  inverterProgresso = false,
  inverterComparacao = false,
  periodoAnalisado,
  emDesenvolvimento = false,
  comparacao,
  icone: Icone,
  tooltipTexto
}: IndicadorCardProps) {
  const formatarValor = (val: number) => {
    switch (formato) {
      case 'moeda':
        return FMT_IND_MOEDA.format(val);
      case 'percentual':
        return `${val.toFixed(1)}%`;
      case 'decimal':
        return val.toFixed(1);
      case 'numero':
      default:
        return FMT_IND_NUM.format(Math.round(val));
    }
  };

  const progresso = meta > 0 ? (inverterProgresso ? Math.max(0, (2 * meta - valor) / meta * 100) : (valor / meta) * 100) : 0;
  
  const getCorClasse = () => {
    switch (cor) {
      case 'green':
        return {
          bg: 'bg-green-500',
          bgLight: 'bg-green-100 dark:bg-green-900/30',
          text: 'text-green-600 dark:text-green-400'
        };
      case 'purple':
        return {
          bg: 'bg-purple-500',
          bgLight: 'bg-purple-100 dark:bg-purple-900/30',
          text: 'text-purple-600 dark:text-purple-400'
        };
      case 'yellow':
        return {
          bg: 'bg-yellow-500',
          bgLight: 'bg-yellow-100 dark:bg-yellow-900/30',
          text: 'text-yellow-600 dark:text-yellow-400'
        };
      case 'red':
        return {
          bg: 'bg-red-500',
          bgLight: 'bg-red-100 dark:bg-red-900/30',
          text: 'text-red-600 dark:text-red-400'
        };
      case 'orange':
        return {
          bg: 'bg-orange-500',
          bgLight: 'bg-orange-100 dark:bg-orange-900/30',
          text: 'text-orange-600 dark:text-orange-400'
        };
      case 'pink':
        return {
          bg: 'bg-pink-500',
          bgLight: 'bg-pink-100 dark:bg-pink-900/30',
          text: 'text-pink-600 dark:text-pink-400'
        };
      case 'cyan':
        return {
          bg: 'bg-cyan-500',
          bgLight: 'bg-cyan-100 dark:bg-cyan-900/30',
          text: 'text-cyan-600 dark:text-cyan-400'
        };
      case 'indigo':
        return {
          bg: 'bg-indigo-500',
          bgLight: 'bg-indigo-100 dark:bg-indigo-900/30',
          text: 'text-indigo-600 dark:text-indigo-400'
        };
      case 'blue':
      default:
        return {
          bg: 'bg-blue-500',
          bgLight: 'bg-blue-100 dark:bg-blue-900/30',
          text: 'text-blue-600 dark:text-blue-400'
        };
    }
  };

  const cores = getCorClasse();

  return (
    <TooltipProvider>
    <Card className={`card-dark shadow-sm hover:shadow-lg transition-shadow ${emDesenvolvimento ? 'opacity-70' : ''}`}>
      <CardHeader className="pb-2 p-3 sm:p-6">
        <div className="flex items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Ícone */}
            {Icone && (
              <div className={`p-1.5 ${cores.bgLight} rounded-lg flex-shrink-0`}>
                <Icone className={`w-4 h-4 ${cores.text}`} />
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 flex-1 min-w-0">
              <CardTitle className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white break-words">
                {titulo}
              </CardTitle>
              {emDesenvolvimento && (
                <Badge variant="outline" className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-xs self-start sm:self-auto">
                  <Construction className="h-3 w-3 mr-1" />
                  Em Desenvolvimento
                </Badge>
              )}
            </div>
            {/* Tooltip de ajuda */}
            {tooltipTexto && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors flex-shrink-0">
                    <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-sm bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 p-3">
                  <p>{tooltipTexto}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          {!emDesenvolvimento && tendencia !== undefined && (
            <div className={`flex items-center gap-1 ${tendencia > 0 ? 'text-green-600 dark:text-green-400' : tendencia < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}`}>
              {tendencia > 0 ? (
                <>
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm font-medium">+{tendencia.toFixed(1)}%</span>
                </>
              ) : tendencia < 0 ? (
                <>
                  <TrendingDown className="w-4 h-4" />
                  <span className="text-sm font-medium">{tendencia.toFixed(1)}%</span>
                </>
              ) : (
                <>
                  <Minus className="w-4 h-4" />
                  <span className="text-sm font-medium">0%</span>
                </>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6 pt-0">
        {/* Seção de comparação - ACIMA do valor principal */}
        {!emDesenvolvimento && comparacao && (
          <div className="flex items-center justify-center mb-2">
            <div className="flex items-center gap-1">
              {(() => {
                // Lógica de cores baseada em inverterComparacao
                const isPositive = inverterComparacao ? comparacao.valor < 0 : comparacao.valor > 0;
                const isNegative = inverterComparacao ? comparacao.valor > 0 : comparacao.valor < 0;
                
                if (isPositive) {
                  return <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400" />;
                } else if (isNegative) {
                  return <TrendingDown className="w-3 h-3 text-red-600 dark:text-red-400" />;
                } else {
                  return <Minus className="w-3 h-3 text-gray-500 dark:text-gray-500" />;
                }
              })()}
              <span className={`text-xs font-medium ${(() => {
                const isPositive = inverterComparacao ? comparacao.valor < 0 : comparacao.valor > 0;
                const isNegative = inverterComparacao ? comparacao.valor > 0 : comparacao.valor < 0;
                
                if (isPositive) {
                  return 'text-green-600 dark:text-green-400';
                } else if (isNegative) {
                  return 'text-red-600 dark:text-red-400';
                } else {
                  return 'text-gray-500 dark:text-gray-500';
                }
              })()}`}>
                {comparacao.label} {comparacao.valor > 0 ? '+' : ''}{comparacao.valor.toFixed(1)}%
              </span>
            </div>
          </div>
        )}
        
        <div>
          <div className="flex items-baseline justify-between mb-1 gap-2">
            <p className={`text-lg sm:text-xl lg:text-2xl font-bold ${emDesenvolvimento ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'} break-words`}>
              {emDesenvolvimento ? 'Disponível em breve' : `${prefixo}${formatarValor(valor)}${sufixo}`}
            </p>
            {!emDesenvolvimento && (
              <Badge variant="secondary" className={`${cores.bgLight} flex-shrink-0`}>
                <span className={cores.text}>
                  {progresso.toFixed(0)}%
                </span>
              </Badge>
            )}
          </div>
          <p className={`text-xs sm:text-sm ${emDesenvolvimento ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400'} break-words`}>
            {emDesenvolvimento ? 'Indicador sendo desenvolvido' : `Meta: ${prefixo}${formatarValor(meta)}${sufixo}`}
          </p>
        </div>

        {!emDesenvolvimento && <Progress value={progresso} color={cor} className="h-2" />}

        {!emDesenvolvimento && (detalhes || periodoAnalisado) && (
          <div className="space-y-1 pt-2 border-t border-gray-200 dark:border-gray-700">
            {detalhes && (
              <>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-500 mb-2">
                  Detalhamento
                </p>
                {Object.entries(detalhes).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">
                      {key}:
                    </span>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {formatarValor(value)}
                    </span>
                  </div>
                ))}
              </>
            )}
            
            {periodoAnalisado && (
              <div className={detalhes ? "mt-3" : ""}>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-500 mb-1">
                  Período Analisado
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {periodoAnalisado}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
    </TooltipProvider>
  );
}
