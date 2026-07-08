'use client';

/**
 * Seletor de período compartilhado da área Receitas.
 *
 * Combina dois controles segmentados independentes + calendário custom:
 *   - Granularidade (Diário / Semanal / Mensal) — como o gráfico agrupa.
 *   - Range (7d / 14d / Mensal / Trimestral / Semestral / Anual + custom) — a janela.
 *
 * Qualquer um dos dois eixos pode ser escondido via `mostrarGranularidade` /
 * `mostrarRange` quando a tela só precisa de um deles.
 */

import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type Granularidade,
  type PeriodoPreset,
  type PeriodoValor,
  GRANULARIDADE_OPCOES,
  PRESET_OPCOES,
  calcularRange,
} from '@/lib/receitas/periodo';

interface PeriodRangePickerProps {
  value: PeriodoValor;
  onChange: (valor: PeriodoValor) => void;
  mostrarGranularidade?: boolean;
  mostrarRange?: boolean;
  className?: string;
}

export function PeriodRangePicker({
  value,
  onChange,
  mostrarGranularidade = true,
  mostrarRange = true,
  className,
}: PeriodRangePickerProps) {
  const selecionarGranularidade = (g: Granularidade) => onChange({ ...value, granularidade: g });

  const selecionarPreset = (preset: Exclude<PeriodoPreset, 'custom'>) => {
    const { inicio, fim } = calcularRange(preset);
    onChange({ ...value, preset, inicio, fim });
  };

  const editarData = (campo: 'inicio' | 'fim', valor: string) => {
    if (!valor) return;
    onChange({ ...value, preset: 'custom', [campo]: valor });
  };

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center', className)}>
      {mostrarGranularidade && (
        <Segmentado
          opcoes={GRANULARIDADE_OPCOES}
          ativo={value.granularidade}
          onSelecionar={(v) => selecionarGranularidade(v as Granularidade)}
        />
      )}

      {mostrarRange && (
        <>
          <Segmentado
            opcoes={PRESET_OPCOES}
            ativo={value.preset === 'custom' ? '' : value.preset}
            onSelecionar={(v) => selecionarPreset(v as Exclude<PeriodoPreset, 'custom'>)}
          />

          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <input
              type="date"
              value={value.inicio}
              max={value.fim}
              onChange={(e) => editarData('inicio', e.target.value)}
              className="h-8 rounded-md border border-[hsl(var(--border))] bg-transparent px-2 text-xs text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            />
            <span className="text-xs text-[hsl(var(--muted-foreground))]">até</span>
            <input
              type="date"
              value={value.fim}
              min={value.inicio}
              onChange={(e) => editarData('fim', e.target.value)}
              className="h-8 rounded-md border border-[hsl(var(--border))] bg-transparent px-2 text-xs text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            />
          </div>
        </>
      )}
    </div>
  );
}

interface OpcaoSegmento {
  valor: string;
  label: string;
}

function Segmentado({
  opcoes,
  ativo,
  onSelecionar,
}: {
  opcoes: readonly OpcaoSegmento[];
  ativo: string;
  onSelecionar: (valor: string) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] p-0.5">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onSelecionar(o.valor)}
          className={cn(
            'h-8 rounded-md px-3 text-xs font-medium transition-colors',
            ativo === o.valor
              ? 'bg-[hsl(var(--background))] text-[hsl(var(--foreground))] shadow-sm'
              : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
