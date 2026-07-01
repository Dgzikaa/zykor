'use client';

import {
  Banknote,
  Beer,
  CupSoda,
  DollarSign,
  FileSignature,
  PackageX,
  Mic,
  Palette,
  Receipt,
  Recycle,
  Repeat,
  Tag,
  Target,
  Timer,
  TrendingUp,
  UserPlus,
  UserRound,
  Utensils,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { EventoResponse } from './types';
import { KpiCard } from './KpiCard';
import { DiagnosticoCard } from './DiagnosticoCard';
import { MixDetalheModal } from './MixDetalheModal';

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
  const margem = m.faturamento > 0 ? (m.resultado / m.faturamento) * 100 : 0;
  // ROI da atração: faturamento incremental (vs média do mesmo dia) por R$ de cachê.
  const roiAtracao = m.c_art > 0 && base && baseN > 0 ? (m.faturamento - base.faturamento) / m.c_art : null;
  // Perfil de clientes do dia (novos x recorrentes + retorno)
  const cp = data.clientes_perfil;

  // Modal de detalhamento do mix (auditoria) — só na visão de dia
  const [mixOpen, setMixOpen] = useState(false);
  const podeDetalhar =
    data.gran === 'dia' && !!evt.bar_id && !!evt.data_evento;

  return (
    <div className="space-y-1">
      {/* Diagnóstico no topo da visão geral */}
      <DiagnosticoCard
        veredito={data.diagnostico?.veredito}
        insights={data.diagnostico?.insights}
        baselineN={baseN}
        gran={data.gran}
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
          sub={`${margem.toFixed(1)}% de margem`}
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

      {data.gran === 'dia' && (
        <>
          <SectionTitle>Ritmo até 19h / 20h</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              label="Faturamento até 19h"
              value={formatCurrency(Number(evt.fat_19h) || 0)}
              accent="blue"
              icon={<Timer className="w-4 h-4" />}
              sub={evt.fat_19h_percent != null ? `${Number(evt.fat_19h_percent).toFixed(0)}% do dia` : undefined}
            />
            <KpiCard
              label="Faturamento até 20h"
              value={formatCurrency(Number(evt.fat_20h) || 0)}
              accent="blue"
              icon={<Timer className="w-4 h-4" />}
              sub={evt.fat_20h_percent != null ? `${Number(evt.fat_20h_percent).toFixed(0)}% do dia` : undefined}
            />
            <KpiCard
              label="Pessoas até 19h"
              value={Math.round(Number(evt.pessoas_ate_19h) || 0).toLocaleString('pt-BR')}
              accent="green"
              icon={<UserRound className="w-4 h-4" />}
              sub={
                m.publico > 0
                  ? `${(((Number(evt.pessoas_ate_19h) || 0) / m.publico) * 100).toFixed(0)}% do público · comanda aberta`
                  : 'comanda aberta'
              }
            />
            <KpiCard
              label="Pessoas até 20h"
              value={Math.round(Number(evt.pessoas_ate_20h) || 0).toLocaleString('pt-BR')}
              accent="green"
              icon={<UserRound className="w-4 h-4" />}
              sub={
                m.publico > 0
                  ? `${(((Number(evt.pessoas_ate_20h) || 0) / m.publico) * 100).toFixed(0)}% do público · comanda aberta`
                  : 'comanda aberta'
              }
            />
          </div>
        </>
      )}

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
        <button
          type="button"
          onClick={() => podeDetalhar && setMixOpen(true)}
          disabled={!podeDetalhar}
          className={`text-left rounded-lg border border-l-4 border-l-violet-500 bg-white dark:bg-gray-800 dark:border-gray-700 p-3 ${
            podeDetalhar
              ? 'cursor-pointer hover:bg-violet-50 dark:hover:bg-violet-900/10 transition-colors'
              : ''
          }`}
        >
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center justify-between">
            Mix de consumo
            {podeDetalhar && (
              <span className="text-[10px] text-violet-500 normal-case font-normal">
                ver detalhe →
              </span>
            )}
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
        </button>
      </div>

      {(cp || roiAtracao !== null) && (
        <>
          <SectionTitle>Clientes & Atração</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {cp && (
              <>
                <KpiCard
                  label="Clientes novos"
                  value={Math.round(cp.novos).toLocaleString('pt-BR')}
                  accent="green"
                  icon={<UserPlus className="w-4 h-4" />}
                  sub={cp.total > 0 ? `${((cp.novos / cp.total) * 100).toFixed(0)}% dos identificados` : undefined}
                />
                <KpiCard
                  label="Recorrentes"
                  value={Math.round(cp.recorrentes).toLocaleString('pt-BR')}
                  accent="blue"
                  icon={<Repeat className="w-4 h-4" />}
                  sub={cp.total > 0 ? `${((cp.recorrentes / cp.total) * 100).toFixed(0)}% dos identificados` : undefined}
                />
                <KpiCard
                  label="Taxa de retorno"
                  value={cp.total > 0 ? `${((cp.retorno_30d / cp.total) * 100).toFixed(0)}%` : '—'}
                  accent="violet"
                  icon={<UserRound className="w-4 h-4" />}
                  sub={`voltaram em 30d · ${cp.total > 0 ? ((cp.retorno_60d / cp.total) * 100).toFixed(0) : 0}% em 60d`}
                />
              </>
            )}
            {roiAtracao !== null && (
              <KpiCard
                label="ROI da atração"
                value={`${roiAtracao.toFixed(1)}x`}
                accent={roiAtracao >= 0 ? 'green' : 'red'}
                icon={<Target className="w-4 h-4" />}
                sub="fat. incremental ÷ cachê"
              />
            )}
          </div>
        </>
      )}

      <SectionTitle>Cancelamentos & Conta Assinada</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Cancelamentos"
          value={formatCurrency(Number(evt.cancelamentos) || 0)}
          accent="red"
          icon={<XCircle className="w-4 h-4" />}
          sub={
            evt.cancelamentos_qtd
              ? `${Number(evt.cancelamentos_qtd).toLocaleString('pt-BR')} itens`
              : undefined
          }
        />
        <KpiCard
          label="Conta Assinada"
          value={formatCurrency(Number(evt.conta_assinada) || 0)}
          accent="amber"
          icon={<FileSignature className="w-4 h-4" />}
          sub={
            evt.conta_assinada_perc
              ? `${Number(evt.conta_assinada_perc).toFixed(2)}% do faturamento`
              : undefined
          }
        />
        <KpiCard
          label="Descontos"
          value={formatCurrency(Number(evt.descontos) || 0)}
          accent="amber"
          icon={<Tag className="w-4 h-4" />}
        />
        {Number(evt.eco_copo_valor) > 0 && (
          <KpiCard
            label="Eco Copos"
            value={formatCurrency(Number(evt.eco_copo_valor) || 0)}
            accent="green"
            icon={<Recycle className="w-4 h-4" />}
            sub={
              evt.eco_copo_qtd
                ? `${Number(evt.eco_copo_qtd).toLocaleString('pt-BR')} un`
                : undefined
            }
          />
        )}
        {Number(evt.consumacao_artistas) > 0 && (
          <KpiCard
            label="Consumação Artistas"
            value={formatCurrency(Number(evt.consumacao_artistas) || 0)}
            accent="violet"
            icon={<Mic className="w-4 h-4" />}
            sub="comp de consumo (ContaHub)"
          />
        )}
      </div>

      {evt.observacoes && (
        <div className="mt-5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
          <span className="text-[11px] font-semibold text-gray-500 uppercase">Observações</span>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{evt.observacoes}</p>
        </div>
      )}

      {podeDetalhar && (
        <MixDetalheModal
          open={mixOpen}
          onOpenChange={setMixOpen}
          barId={Number(evt.bar_id)}
          data={String(evt.data_evento)}
        />
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
