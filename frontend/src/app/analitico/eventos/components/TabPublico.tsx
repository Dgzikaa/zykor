'use client';

import { useEffect, useState } from 'react';
import { CalendarCheck, CalendarX, Repeat, Sparkle, UserPlus, Users } from 'lucide-react';
import { EventoResponse, Gran } from './types';
import { KpiCard } from './KpiCard';

interface ClientesResp {
  atual: {
    totalClientes: number;
    novosClientes: number;
    clientesRetornantes: number;
    percentualNovos: number;
    percentualRetornantes: number;
    clientesAtivos: number;
  };
  anterior: {
    totalClientes: number;
    novosClientes: number;
    clientesRetornantes: number;
    clientesAtivos: number;
  };
  variacoes: { total: number; novos: number; retornantes: number; ativos: number };
  label?: string;
}

interface Props {
  data: EventoResponse;
  dataSelecionada: string;
  barId: number;
  gran?: Gran;
}

export function TabPublico({ data, dataSelecionada, barId, gran = 'dia' }: Props) {
  const [clientes, setClientes] = useState<ClientesResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setErro(null);
    fetch(
      `/api/clientes-ativos?periodo=${gran}&data_inicio=${dataSelecionada}&bar_id=${barId}`
    )
      .then((r) => r.json())
      .then((json) => {
        if (!ativo) return;
        if (json?.success) setClientes(json.data);
        else setErro(json?.error || 'Falha ao carregar clientes');
      })
      .catch((e) => ativo && setErro(String(e)))
      .finally(() => ativo && setLoading(false));
    return () => {
      ativo = false;
    };
  }, [dataSelecionada, barId, gran]);

  const compTexto =
    gran === 'mes'
      ? 'vs o mês anterior'
      : gran === 'semana'
        ? 'vs a semana anterior'
        : 'vs a mesma data da semana anterior';

  const evt = data.evento!;
  const resTot = Number(evt.res_tot) || 0;
  const resP = Number(evt.res_p) || 0;
  const baseRes = data.baseline?.media?.res_tot;
  const dRes = data.deltas?.res_tot ?? null;

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-gray-400">
        Comparação de clientes {compTexto}
        {clientes?.label ? ` · ${clientes.label}` : ''}.
      </p>

      {erro && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-700 dark:text-amber-300">
          Não foi possível carregar a base de clientes ({erro}).
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"
            />
          ))}
        </div>
      ) : (
        clientes && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard
                label="Total de Clientes"
                value={clientes.atual.totalClientes.toLocaleString('pt-BR')}
                accent="blue"
                icon={<Users className="w-4 h-4" />}
                delta={clientes.variacoes.total}
              />
              <KpiCard
                label="Novos Clientes"
                value={clientes.atual.novosClientes.toLocaleString('pt-BR')}
                accent="green"
                icon={<UserPlus className="w-4 h-4" />}
                delta={clientes.variacoes.novos}
                sub={`${clientes.atual.percentualNovos.toFixed(1)}% do total`}
              />
              <KpiCard
                label="Recorrentes"
                value={clientes.atual.clientesRetornantes.toLocaleString('pt-BR')}
                accent="violet"
                icon={<Repeat className="w-4 h-4" />}
                delta={clientes.variacoes.retornantes}
                sub={`${clientes.atual.percentualRetornantes.toFixed(1)}% do total`}
              />
              <KpiCard
                label="Clientes Ativos"
                value={clientes.atual.clientesAtivos.toLocaleString('pt-BR')}
                accent="amber"
                icon={<Sparkle className="w-4 h-4" />}
                delta={clientes.variacoes.ativos}
                sub="base ativa do bar"
              />
            </div>

            {/* Barra novos x recorrentes */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Composição do público
              </h3>
              <div className="flex h-6 rounded-full overflow-hidden">
                <div
                  className="bg-green-500 flex items-center justify-center text-[10px] text-white font-medium"
                  style={{ width: `${clientes.atual.percentualNovos}%` }}
                >
                  {clientes.atual.percentualNovos >= 12
                    ? `Novos ${clientes.atual.percentualNovos.toFixed(0)}%`
                    : ''}
                </div>
                <div
                  className="bg-violet-500 flex items-center justify-center text-[10px] text-white font-medium"
                  style={{ width: `${clientes.atual.percentualRetornantes}%` }}
                >
                  {clientes.atual.percentualRetornantes >= 12
                    ? `Recorrentes ${clientes.atual.percentualRetornantes.toFixed(0)}%`
                    : ''}
                </div>
              </div>
              <div className="flex gap-4 mt-2 text-[11px] text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" /> Novos
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-violet-500" /> Recorrentes
                </span>
              </div>
            </div>
          </>
        )
      )}

      {/* Reservas (do gold.planejamento) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Reservas"
          value={resTot.toLocaleString('pt-BR')}
          accent="slate"
          icon={<CalendarCheck className="w-4 h-4" />}
          delta={dRes}
          inverso={false}
          sub={
            baseRes !== undefined && (data.baseline?.n ?? 0) > 0
              ? `méd ${Math.round(baseRes)}`
              : undefined
          }
        />
        <KpiCard
          label="Reservas presentes"
          value={resP.toLocaleString('pt-BR')}
          accent="slate"
          icon={<CalendarCheck className="w-4 h-4" />}
          sub={evt.mesas_totais !== undefined ? 'sentaram' : undefined}
        />
        {evt.reservas_quebra_pct !== undefined && (
          <KpiCard
            label="Quebra de reserva"
            value={`${Number(evt.reservas_quebra_pct || 0).toFixed(1)}%`}
            accent="red"
            inverso
            icon={<CalendarX className="w-4 h-4" />}
            sub="no-show + canceladas"
          />
        )}
        {evt.mesas_totais !== undefined && (
          <KpiCard
            label="Mesas"
            value={`${Number(evt.mesas_presentes) || 0}/${Number(evt.mesas_totais) || 0}`}
            accent="slate"
            icon={<Users className="w-4 h-4" />}
            sub="presentes/total"
          />
        )}
      </div>
    </div>
  );
}
