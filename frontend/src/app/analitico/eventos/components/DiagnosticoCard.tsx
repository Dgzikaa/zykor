'use client';

import { AlertTriangle, CheckCircle2, Info, Sparkles } from 'lucide-react';
import { Insight } from './types';

const VEREDITO = {
  bom: {
    label: 'Dia bom',
    cls: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  },
  regular: {
    label: 'Dia dentro do esperado',
    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  ruim: {
    label: 'Dia abaixo do esperado',
    cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  },
};

const TIPO = {
  positivo: {
    icon: CheckCircle2,
    cls: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  },
  atencao: {
    icon: AlertTriangle,
    cls: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  },
  info: {
    icon: Info,
    cls: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  },
};

interface Props {
  veredito?: 'bom' | 'regular' | 'ruim';
  insights?: Insight[];
  baselineN?: number;
}

export function DiagnosticoCard({ veredito = 'regular', insights = [], baselineN = 0 }: Props) {
  const v = VEREDITO[veredito];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Diagnóstico do dia
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${v.cls}`}>
            {v.label}
          </span>
          {baselineN > 0 && (
            <span className="text-[10px] text-gray-400">
              vs média das últimas {baselineN} datas
            </span>
          )}
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {insights.map((ins, i) => {
          const t = TIPO[ins.tipo];
          const Icon = t.icon;
          return (
            <div key={i} className={`rounded-lg border p-3 flex gap-3 ${t.bg}`}>
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${t.cls}`} />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                  {ins.titulo}
                </p>
                <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-0.5 leading-snug">
                  {ins.descricao}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
