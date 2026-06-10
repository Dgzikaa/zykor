'use client';

import {
  Banknote,
  Beer,
  CupSoda,
  DollarSign,
  PackageX,
  Palette,
  Receipt,
  Timer,
  TrendingUp,
  UserRound,
  Utensils,
  Wallet,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { EventoResponse } from './types';
import { KpiCard } from './KpiCard';
import { DiagnosticoCard } from './DiagnosticoCard';

function moedaCompacta(v: number) {
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toFixed(1).replace('.', ',')}k`;
  return formatCurrency(v);
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-5 mb-2">
      {children}
    </h3>
  );
}

interface Props {
  data: EventoResponse;
}

export function TabVisaoGeral({ data }: Props) {
  const evt = data.evento!;
  const m = data.metricas!;
  const d = data.deltas || {};
  const base = data.baseline?.media;
  const baseN = data.baseline?.n ?? 0;

  const subVs = (val: number | undefined, fmt: (n: number) => string) =>
    val !== undefined && val !== null && baseN > 0 ? `méd ${fmt(val)}` : undefined;

  const percArtFat = m.faturamento > 0 ? (m.c_art / m.faturamento) * 100 : 0;

  return (
    <div className="space-y-1">
      {/* Diagnóstico no topo da visão geral */}
      <DiagnosticoCard
        veredito={data.diagnostico?.veredito}
        insights={data.diagnostico?.insights}
        baselineN={baseN}
      />

      <SectionTitle>Resultado do evento</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Faturamento"
          value={formatCurrency(m.faturamento)}
          accent="blue"
          icon={<TrendingUp className="w-4 h-4" />}
          delta={d.faturamento}
          sub={subVs(base?.faturamento, moedaCompacta)}
        />
        <KpiCard
          label="Custo Artístico"
          value={formatCurrency(m.c_art)}
          accent="amber"
          icon={<Palette className="w-4 h-4" />}
          delta={d.c_art}
          inverso
          sub={
            m.c_art > 0
              ? `${percArtFat.toFixed(1)}% do faturamento`
              : subVs(base?.c_art, moedaCompacta)
          }
        />
        <KpiCard
          label="Custo Produção"
          value={formatCurrency(m.c_prod)}
          accent="amber"
          icon={<Banknote className="w-4 h-4" />}
          delta={d.c_prod}
          inverso
          sub={subVs(base?.c_prod, moedaCompacta)}
        />
        <KpiCard
          label="Resultado"
          value={formatCurrency(m.resultado)}
          accent={m.resultado >= 0 ? 'green' : 'red'}
          icon={<Wallet className="w-4 h-4" />}
          delta={d.resultado}
          destaque
          sub="faturamento − custos"
        />
      </div>

      <SectionTitle>Receita & Tickets</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Entrada (Couvert)"
          value={formatCurrency(m.couvert)}
          accent="violet"
          icon={<Receipt className="w-4 h-4" />}
          delta={d.couvert}
          sub={subVs(base?.couvert, moedaCompacta)}
        />
        <KpiCard
          label="Bar"
          value={formatCurrency(m.bar)}
          accent="violet"
          icon={<Beer className="w-4 h-4" />}
          delta={d.bar}
          sub={subVs(base?.bar, moedaCompacta)}
        />
        <KpiCard
          label="Ticket Médio"
          value={formatCurrency(m.ticket)}
          accent="blue"
          icon={<DollarSign className="w-4 h-4" />}
          delta={d.ticket}
          sub={subVs(base?.ticket, (n) => formatCurrency(n))}
        />
        <KpiCard
          label="Público"
          value={Math.round(m.publico).toLocaleString('pt-BR')}
          accent="green"
          icon={<UserRound className="w-4 h-4" />}
          delta={d.publico}
          sub={base && baseN > 0 ? `méd ${Math.round(base.publico)}` : undefined}
        />
      </div>

      <SectionTitle>Operação & Mix</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="% Stockout"
          value={`${m.percent_stockout.toFixed(1)}%`}
          accent={m.percent_stockout >= 15 ? 'red' : 'slate'}
          icon={<PackageX className="w-4 h-4" />}
          delta={d.percent_stockout}
          inverso
          sub={
            base && baseN > 0
              ? `méd ${base.percent_stockout.toFixed(1)}%`
              : undefined
          }
        />
        <KpiCard
          label="Atrasos"
          value={Math.round(m.atrasos).toLocaleString('pt-BR')}
          accent={m.atrasos >= 10 ? 'red' : 'slate'}
          icon={<Timer className="w-4 h-4" />}
          delta={d.atrasos}
          inverso
          sub={`${Number(evt.atrasao_cozinha) || 0} coz · ${Number(evt.atrasao_bar) || 0} bar`}
        />
        <KpiCard
          label="Reservas"
          value={Math.round(m.res_tot).toLocaleString('pt-BR')}
          accent="slate"
          icon={<UserRound className="w-4 h-4" />}
          delta={d.res_tot}
        />
        <div className="rounded-lg border border-l-4 border-l-violet-500 bg-white dark:bg-gray-800 dark:border-gray-700 p-3">
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Mix de consumo
          </span>
          <div className="mt-2 space-y-1.5">
            <MixRow
              icon={<Utensils className="w-3 h-3" />}
              label="Comida"
              pct={m.percent_comida}
              color="bg-amber-500"
            />
            <MixRow
              icon={<Beer className="w-3 h-3" />}
              label="Bebida"
              pct={m.percent_bebida}
              color="bg-blue-500"
            />
            <MixRow
              icon={<CupSoda className="w-3 h-3" />}
              label="Drink"
              pct={m.percent_drink}
              color="bg-violet-500"
            />
          </div>
        </div>
      </div>

      {evt.observacoes && (
        <div className="mt-5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
          <span className="text-[11px] font-semibold text-gray-500 uppercase">Observações</span>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{evt.observacoes}</p>
        </div>
      )}
    </div>
  );
}

function MixRow({
  icon,
  label,
  pct,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  pct: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400">{icon}</span>
      <span className="text-[11px] text-gray-600 dark:text-gray-300 w-14">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 w-10 text-right">
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}
