'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Star, MessageCircle, ThumbsUp, AlertTriangle } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ReviewSummary {
  total: number;
  media: number;
  distribuicao: Record<number, number>;
  elogios: string[];
  criticas: string[];
  reviewsComTexto: {
    nome: string;
    stars: number;
    texto: string;
    data: string;
  }[];
}

interface GoogleReviewsTooltipProps {
  barId: number;
  dataInicio: string;
  dataFim: string;
  children: React.ReactNode;
  mediaAtual?: number;
  total5Estrelas?: number;
}

export function GoogleReviewsTooltip({
  barId,
  dataInicio,
  dataFim,
  children,
  mediaAtual,
  total5Estrelas
}: GoogleReviewsTooltipProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/google-reviews/period-summary?bar_id=${barId}&data_inicio=${dataInicio}&data_fim=${dataFim}`
      );
      const data = await response.json();
      if (data.success) {
        setSummary(data.summary);
      } else {
        setError(data.error || 'Erro ao carregar dados');
      }
    } catch (err) {
      setError('Erro ao conectar com servidor');
    } finally {
      setLoading(false);
    }
  }, [barId, dataInicio, dataFim]);

  useEffect(() => {
    if (open && !summary && !loading) {
      fetchSummary();
    }
  }, [open, summary, loading, fetchSummary]);

  const renderStars = (count: number, total: number) => {
    const stars: React.ReactNode[] = [];
    for (let i = 0; i < count; i++) {
      stars.push(<Star key={i} className="w-3 h-3 fill-yellow-500 text-yellow-500" />);
    }
    return (
      <div className="flex items-center gap-1">
        <span className="flex">{stars}</span>
        <span className="text-xs text-[hsl(var(--muted-foreground))] ml-1">- {total}</span>
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span className="cursor-help underline decoration-dotted">
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent 
        side="bottom" 
        align="start" 
        className="w-96 p-0 shadow-xl z-50"
      >
        {loading ? (
          <div className="flex items-center justify-center p-6">
            <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--muted-foreground))]" />
            <span className="ml-2 text-sm text-[hsl(var(--muted-foreground))]">Carregando...</span>
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        ) : summary ? (
          <div className="divide-y divide-[hsl(var(--border))]">
            {/* Header com média */}
            <div className="bg-[hsl(var(--muted))] p-3 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" />
                  <span className="font-bold text-lg text-[hsl(var(--foreground))]">
                    {summary.media.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <span className="text-sm text-[hsl(var(--muted-foreground))]">
                  {summary.total} avaliações
                </span>
              </div>
            </div>

            {/* Distribuição de estrelas */}
            <div className="p-3 space-y-1">
              {[5, 4, 3, 2, 1].map(star => (
                <div key={star} className="flex items-center gap-2">
                  {renderStars(star, summary.distribuicao[star] || 0)}
                </div>
              ))}
            </div>

            {/* Percepção do Cliente */}
            {(summary.elogios.length > 0 || summary.criticas.length > 0) && (
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--foreground))]">
                  <MessageCircle className="w-4 h-4" />
                  Percepção do Cliente
                </div>
                
                {summary.elogios.length > 0 && (
                  <div className="flex items-start gap-2">
                    <ThumbsUp className="w-3.5 h-3.5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      <span className="font-medium text-green-600 dark:text-green-400">Elogios: </span>
                      {summary.elogios.join(', ')}
                    </div>
                  </div>
                )}
                
                {summary.criticas.length > 0 && (
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      <span className="font-medium text-orange-600 dark:text-orange-400">Atenção: </span>
                      {summary.criticas.join(', ')}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Algumas avaliações recentes */}
            {summary.reviewsComTexto.length > 0 && (
              <div className="p-3 space-y-2 max-h-32 overflow-y-auto scrollbar-thin">
                <div className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  Avaliações recentes
                </div>
                {summary.reviewsComTexto.slice(0, 2).map((review, idx) => (
                  <div key={idx} className="text-xs bg-[hsl(var(--muted))] p-2 rounded">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="font-medium text-[hsl(var(--foreground))]">
                        {review.nome}
                      </span>
                      <span className="flex">
                        {Array.from({ length: review.stars }).map((_, i) => (
                          <Star key={i} className="w-2.5 h-2.5 fill-yellow-500 text-yellow-500" />
                        ))}
                      </span>
                    </div>
                    <p className="text-[hsl(var(--muted-foreground))] line-clamp-2">
                      &quot;{review.texto}&quot;
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 text-center text-[hsl(var(--muted-foreground))] text-sm">
            Sem dados disponíveis
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
