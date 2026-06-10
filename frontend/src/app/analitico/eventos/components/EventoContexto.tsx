'use client';

import { CalendarDays, Music2, Users } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { EventoResponse } from './types';
import { DeltaBadge } from './DeltaBadge';

function dataLonga(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

interface Props {
  data: EventoResponse;
  dataSelecionada: string;
}

export function EventoContexto({ data, dataSelecionada }: Props) {
  const evt = data.evento;
  const artista = evt?.artista || evt?.nome || evt?.nome_evento || 'Sem atração';
  const fat = evt?._faturamento ?? 0;
  const resultado = evt?._resultado ?? 0;
  const dFat = data.deltas?.faturamento ?? null;

  return (
    <div className="rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 md:p-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-slate-300 text-xs mb-1">
            <CalendarDays className="w-4 h-4" />
            <span className="capitalize">{dataLonga(dataSelecionada)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Music2 className="w-5 h-5 text-violet-300 shrink-0" />
            <h2 className="text-lg md:text-xl font-bold truncate" title={artista}>
              {artista}
            </h2>
          </div>
          {evt?.genero && (
            <span className="text-[11px] text-slate-400 mt-1 inline-block">{evt.genero}</span>
          )}
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[11px] text-slate-400 uppercase tracking-wide">Faturamento</p>
            <p className="text-xl md:text-2xl font-bold">{formatCurrency(fat)}</p>
            <DeltaBadge delta={dFat} className="justify-end" />
          </div>
          <div className="text-right border-l border-slate-700 pl-6">
            <p className="text-[11px] text-slate-400 uppercase tracking-wide flex items-center gap-1 justify-end">
              <Users className="w-3 h-3" /> Resultado
            </p>
            <p
              className={`text-xl md:text-2xl font-bold ${
                resultado >= 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {formatCurrency(resultado)}
            </p>
            <span className="text-[10px] text-slate-400">fat − custos</span>
          </div>
        </div>
      </div>
    </div>
  );
}
