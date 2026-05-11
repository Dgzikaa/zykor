'use client';

import { useBar } from '@/contexts/BarContext';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MapPinIcon, CheckCircle2Icon } from 'lucide-react';
import { ContaAzulSyncButton } from '@/components/ContaAzulSyncButton';

export default function BarSelector() {
  const { selectedBar, setSelectedBar, availableBars, isLoading } = useBar();

  // Loading state
  if (isLoading) {
    return (
      <div className="p-3 border-t border-slate-700/50">
        <div className="bg-slate-700/50 rounded-xl p-3 animate-pulse">
          <div className="h-4 bg-slate-600 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-slate-600 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  // Collapsed state
  // TODO: implementar estado collapsed
  // if (isCollapsed) {
  //   return (
  //     <div className="flex items-center justify-center p-3 border-t border-slate-700/50">
  //       <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300">
  //         <MapPinIcon className="w-5 h-5 text-white" />
  //       </div>
  //     </div>
  //   )
  // }

  return (
    <div className="p-3">
      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MapPinIcon className="w-4 h-4 text-gray-600 dark:text-slate-400" />
            <span className="text-xs font-medium text-gray-600 dark:text-slate-400 uppercase tracking-wide">
              Estabelecimento
            </span>
          </div>
          <Badge
            variant="outline"
            className="text-xs px-2 py-1 bg-gray-100 dark:bg-slate-700/50 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-600"
          >
            {availableBars.length}
          </Badge>
        </div>

        {/* Selector */}
        <div className="relative">
          <Select
            value={selectedBar?.id?.toString() || ''}
            onValueChange={value => {
              const bar = availableBars.find(b => b.id.toString() === value);
              if (bar) setSelectedBar(bar);
            }}
          >
            <SelectTrigger className="w-full bg-white dark:bg-slate-700/50 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-700/70 transition-all duration-200">
              <SelectValue placeholder="Selecione um estabelecimento">
                <div className="flex items-center space-x-2">
                  <span className="font-medium">
                    {selectedBar?.nome || 'Selecione um estabelecimento'}
                  </span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="w-full bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 max-h-60 overflow-y-auto">
              {availableBars.map(bar => (
                <SelectItem
                  key={bar.id}
                  value={bar.id.toString()}
                  className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-700 focus:bg-gray-100 dark:focus:bg-slate-700 cursor-pointer"
                >
                  <div className="flex items-center space-x-2 w-full">
                    <div className="font-medium truncate">
                      {bar.nome}
                    </div>
                    {selectedBar?.id === bar.id && (
                      <CheckCircle2Icon className="w-4 h-4 text-green-500 flex-shrink-0" />
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status + ação Conta Azul */}
        {selectedBar && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-xs min-w-0">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0"></div>
              <span className="text-slate-400 truncate">
                Conectado • {selectedBar.nome}
              </span>
            </div>
            <ContaAzulSyncButton />
          </div>
        )}
      </div>
    </div>
  );
}
