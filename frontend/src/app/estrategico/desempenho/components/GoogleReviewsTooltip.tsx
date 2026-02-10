'use client';

import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (open && !summary && !loading) {
      fetchSummary();
    }
  }, [open]);

  const fetchSummary = async () => {
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
  };

  const renderStars = (count: number, total: number) => {
    const stars: React.ReactNode[] = [];
    for (let i = 0; i < count; i++) {
      stars.push(<Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />);
    }
    return (
      <div className="flex items-center gap-1">
        <span className="flex">{stars}</span>
        <span className="text-xs text-gray-600 dark:text-gray-400 ml-1">- {total}</span>
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
        side="top" 
        align="center" 
        className="w-80 p-0 shadow-xl"
      >
        {loading ? (
          <div className="flex items-center justify-center p-6">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">Carregando...</span>
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-500 text-sm">
            {error}
          </div>
        ) : summary ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {/* Header com média */}
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 p-3 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  <span className="font-bold text-lg text-gray-900 dark:text-white">
                    {summary.media.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
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
                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <MessageCircle className="w-4 h-4" />
                  Percepção do Cliente
                </div>
                
                {summary.elogios.length > 0 && (
                  <div className="flex items-start gap-2">
                    <ThumbsUp className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      <span className="font-medium text-green-600 dark:text-green-400">Elogios: </span>
                      {summary.elogios.join(', ')}
                    </div>
                  </div>
                )}
                
                {summary.criticas.length > 0 && (
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-500 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      <span className="font-medium text-orange-600 dark:text-orange-400">Atenção: </span>
                      {summary.criticas.join(', ')}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Algumas avaliações recentes */}
            {summary.reviewsComTexto.length > 0 && (
              <div className="p-3 space-y-2 max-h-32 overflow-y-auto">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Avaliações recentes
                </div>
                {summary.reviewsComTexto.slice(0, 2).map((review, idx) => (
                  <div key={idx} className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {review.nome}
                      </span>
                      <span className="flex">
                        {Array.from({ length: review.stars }).map((_, i) => (
                          <Star key={i} className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                        ))}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 line-clamp-2">
                      "{review.texto}"
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 text-center text-gray-500 text-sm">
            Sem dados disponíveis
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
