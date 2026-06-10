'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, PackageX, Star, Timer } from 'lucide-react';
import { EventoResponse } from './types';
import { DiagnosticoCard } from './DiagnosticoCard';

interface NpsRecord {
  data_pesquisa: string;
  setor?: string;
  nps_geral?: number;
  media_geral?: number;
  nps_comida?: number;
  nps_drink?: number;
  nps_atendimento?: number;
  nps_ambiente?: number;
  nps_musica?: number;
  nps_preco?: number;
  comentarios?: string;
}

interface Props {
  data: EventoResponse;
  dataSelecionada: string;
  barId: number;
}

function media(vals: (number | undefined | null)[]) {
  const ns = vals.map((v) => Number(v)).filter((v) => !isNaN(v) && v > 0);
  if (!ns.length) return null;
  return ns.reduce((s, v) => s + v, 0) / ns.length;
}

export function TabQualidade({ data, dataSelecionada, barId }: Props) {
  const [nps, setNps] = useState<NpsRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const npsInicio = data.periodo?.inicio || dataSelecionada;
  const npsFim = data.periodo?.fim || dataSelecionada;

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    fetch(`/api/nps?bar_id=${barId}&data_inicio=${npsInicio}&data_fim=${npsFim}`)
      .then((r) => r.json())
      .then((json) => {
        if (ativo && json?.success) setNps(json.data || []);
      })
      .catch(() => {})
      .finally(() => ativo && setLoading(false));
    return () => {
      ativo = false;
    };
  }, [npsInicio, npsFim, barId]);

  const evt = data.evento!;
  const m = data.metricas!;

  // Semana/mês: NPS vem agregado do gold.desempenho (mesma fonte da tela de Desempenho).
  // Dia: cai pro fetch legado /api/nps.
  const npsD = data.nps;
  const usaDesemp = !!(npsD && npsD.respostas > 0);
  const numOuNull = (v: any) => (v === null || v === undefined ? null : Number(v));

  const npsGeral = usaDesemp
    ? numOuNull(npsD!.geral)
    : media(nps.map((n) => n.nps_geral ?? n.media_geral));
  const respostas = usaDesemp ? npsD!.respostas : nps.length;
  const comentarios = nps.filter((n) => n.comentarios && n.comentarios.trim().length > 0);

  const categorias = usaDesemp
    ? [
        { label: 'Atendimento', val: numOuNull(npsD!.atendimento) },
        { label: 'Comida', val: numOuNull(npsD!.comida) },
        { label: 'Drink', val: numOuNull(npsD!.drink) },
        { label: 'Ambiente', val: numOuNull(npsD!.ambiente) },
        { label: 'Música', val: numOuNull(npsD!.musica) },
        { label: 'Preço', val: numOuNull(npsD!.preco) },
      ]
    : [
        { label: 'Atendimento', val: media(nps.map((n) => n.nps_atendimento)) },
        { label: 'Comida', val: media(nps.map((n) => n.nps_comida)) },
        { label: 'Drink', val: media(nps.map((n) => n.nps_drink)) },
        { label: 'Ambiente', val: media(nps.map((n) => n.nps_ambiente)) },
        { label: 'Música', val: media(nps.map((n) => n.nps_musica)) },
        { label: 'Preço', val: media(nps.map((n) => n.nps_preco)) },
      ];

  const stockoutCats = [
    { label: 'Geral', val: m.percent_stockout },
    { label: 'Bebidas', val: Number(evt.stockout_bebidas_perc) || 0 },
    { label: 'Comidas', val: Number(evt.stockout_comidas_perc) || 0 },
    { label: 'Drinks', val: Number(evt.stockout_drinks_perc) || 0 },
  ];

  return (
    <div className="space-y-4">
      <DiagnosticoCard
        veredito={data.diagnostico?.veredito}
        insights={data.diagnostico?.insights}
        baselineN={data.baseline?.n ?? 0}
        gran={data.gran}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* NPS */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {data.gran && data.gran !== 'dia' ? 'NPS do período' : 'NPS do dia'}
            </h3>
          </div>
          {loading && !usaDesemp ? (
            <div className="h-20 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
          ) : npsGeral === null ? (
            <p className="text-xs text-gray-400">
              {data.gran && data.gran !== 'dia'
                ? 'Sem respostas de NPS registradas no período.'
                : 'Sem respostas de NPS registradas nesta data.'}
            </p>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {npsGeral.toFixed(1)}
                </span>
                <span className="text-xs text-gray-400">
                  {respostas} resposta{respostas > 1 ? 's' : ''}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                {categorias
                  .filter((c) => c.val !== null)
                  .map((c) => (
                    <div
                      key={c.label}
                      className="rounded-md bg-gray-50 dark:bg-gray-700/50 px-2 py-1.5"
                    >
                      <p className="text-[10px] text-gray-400">{c.label}</p>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        {c.val!.toFixed(1)}
                      </p>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>

        {/* Stockout por categoria */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <PackageX className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Stockout por categoria
            </h3>
          </div>
          <div className="space-y-2">
            {stockoutCats.map((c) => (
              <div key={c.label} className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500 w-16">{c.label}</span>
                <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      c.val >= 25 ? 'bg-red-500' : c.val >= 10 ? 'bg-amber-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, c.val)}%` }}
                  />
                </div>
                <span className="text-[11px] font-semibold w-12 text-right text-gray-700 dark:text-gray-200">
                  {c.val.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Atrasos detalhados */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Timer className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Tempos & Atrasos
          </h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <AtrasoBox
            label="Atrasos cozinha"
            value={Number(evt.atrasao_cozinha) || 0}
            sub={`${Number(evt.atrasinho_cozinha) || 0} atrasinhos`}
            tempo={evt.t_coz}
          />
          <AtrasoBox
            label="Atrasos bar"
            value={Number(evt.atrasao_bar) || 0}
            sub={`${Number(evt.atrasinho_bar) || 0} atrasinhos`}
            tempo={evt.t_bar}
          />
          <AtrasoBox label="Tempo médio cozinha" value={null} tempoLabel={evt.t_coz} />
          <AtrasoBox label="Tempo médio bar" value={null} tempoLabel={evt.t_bar} />
        </div>
      </div>

      {/* Comentários / reclamações */}
      {comentarios.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-violet-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Comentários do dia ({comentarios.length})
            </h3>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {comentarios.map((c, i) => (
              <div
                key={i}
                className="rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2 text-xs text-gray-700 dark:text-gray-200"
              >
                {c.setor && (
                  <span className="text-[10px] font-semibold text-gray-400 mr-1">
                    [{c.setor}]
                  </span>
                )}
                {c.comentarios}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AtrasoBox({
  label,
  value,
  sub,
  tempo,
  tempoLabel,
}: {
  label: string;
  value: number | null;
  sub?: string;
  tempo?: any;
  tempoLabel?: any;
}) {
  const minutos = (s: any) => {
    const n = Number(s);
    if (!n || isNaN(n)) return '—';
    // t_coz/t_bar estão em SEGUNDOS no gold (ex.: 546s = 9,1 min)
    return `${(n / 60).toFixed(1).replace('.', ',')} min`;
  };
  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-700 p-3">
      <p className="text-[11px] text-gray-400">{label}</p>
      {value !== null ? (
        <>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
          {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
          {tempo !== undefined && (
            <p className="text-[10px] text-gray-400">tempo méd {minutos(tempo)}</p>
          )}
        </>
      ) : (
        <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {minutos(tempoLabel)}
        </p>
      )}
    </div>
  );
}
