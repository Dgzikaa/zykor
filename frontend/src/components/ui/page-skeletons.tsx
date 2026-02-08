'use client';

import { memo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Skeleton otimizados para páginas principais
 * Imitam o layout real para melhor percepção de velocidade
 */

// 🚀 Skeleton para página de Orçamentação (estilo Excel)
export const OrcamentacaoSkeleton = memo(function OrcamentacaoSkeleton() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      
      {/* Cards de resumo */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
      
      {/* Tabela estilo Excel */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-100 dark:bg-gray-800 p-3 flex gap-4">
          <Skeleton className="h-6 w-32" />
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-20" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, row) => (
          <div key={row} className="border-t p-3 flex gap-4">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 7 }).map((_, col) => (
              <Skeleton key={col} className="h-5 w-20" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
});

// 🚀 Skeleton para página de Desempenho (tabela semanal)
export const DesempenhoSkeleton = memo(function DesempenhoSkeleton() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      {/* Header com tabs */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 rounded-full" />
          <Skeleton className="h-9 w-32 rounded-full" />
        </div>
      </div>
      
      {/* Seções colapsáveis */}
      {Array.from({ length: 4 }).map((_, section) => (
        <div key={section} className="border rounded-lg overflow-hidden">
          <div className="bg-gray-100 dark:bg-gray-800 p-3 flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="p-3 space-y-2">
            {Array.from({ length: 3 }).map((_, row) => (
              <div key={row} className="flex gap-4">
                <Skeleton className="h-5 w-40" />
                {Array.from({ length: 8 }).map((_, col) => (
                  <Skeleton key={col} className="h-5 w-16" />
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});

// 🚀 Skeleton para página de CMV Semanal
export const CMVSemanalSkeleton = memo(function CMVSemanalSkeleton() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      
      {/* Cards de estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      
      {/* Tabela */}
      <div className="border rounded-lg overflow-hidden">
        {Array.from({ length: 10 }).map((_, row) => (
          <div key={row} className={cn(
            "p-3 flex gap-4",
            row === 0 ? "bg-gray-100 dark:bg-gray-800" : "border-t"
          )}>
            <Skeleton className="h-5 w-24" />
            {Array.from({ length: 6 }).map((_, col) => (
              <Skeleton key={col} className="h-5 w-20" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
});

// 🚀 Skeleton para página de Visão Geral
export const VisaoGeralSkeleton = memo(function VisaoGeralSkeleton() {
  return (
    <div className="p-4 space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>
      
      {/* Cards anuais */}
      <div className="space-y-2">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
      
      {/* Cards trimestrais */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-8" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="flex justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// 🚀 Skeleton para página de Clientes
export const ClientesSkeleton = memo(function ClientesSkeleton() {
  return (
    <div className="p-4 space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      
      {/* Cards de estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border rounded-lg overflow-hidden">
            <Skeleton className="h-12 w-full" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
      
      {/* Tabs e tabela */}
      <div className="border rounded-lg overflow-hidden">
        <div className="p-3 border-b flex gap-2">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
        <div className="p-3">
          {Array.from({ length: 10 }).map((_, row) => (
            <div key={row} className="flex gap-4 py-3 border-b last:border-0">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// 🚀 Skeleton para página de Planejamento Comercial
export const PlanejamentoSkeleton = memo(function PlanejamentoSkeleton() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-8" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      
      {/* Calendário/Tabela de eventos */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-100 dark:bg-gray-800 p-3 flex gap-4">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-20" />
        </div>
        {Array.from({ length: 12 }).map((_, row) => (
          <div key={row} className="border-t p-3 flex gap-4 items-center">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
});

// Exportar todos
export default {
  OrcamentacaoSkeleton,
  DesempenhoSkeleton,
  CMVSemanalSkeleton,
  VisaoGeralSkeleton,
  ClientesSkeleton,
  PlanejamentoSkeleton,
};
