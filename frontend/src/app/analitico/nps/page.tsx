'use client';

/**
 * NPS por Área — /analitico/nps
 *
 * Pedido do Cadu (04/08/2026): o Falae mostra a nota por área e o horário da RESPOSTA, mas pra
 * saber o DIA da visita é preciso abrir resposta por resposta. Aqui a base inteira é recortada
 * pela **data da visita**: dá pra ver que "Tempo de espera" caiu, em que dia caiu e ler os
 * comentários daquele dia.
 *
 * Fonte: /api/analitico/nps (views silver.v_nps_resposta / silver.v_nps_area).
 */

import { useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, Users, MessageSquare, ThumbsDown, CalendarOff } from 'lucide-react';
import { HeroRow, ChartCard, ChartGrid, GraficoBarraH, GraficoBarra, GraficoLinha, type Kpi } from '@/components/graficos/Charts';
import { FiltroBarra, SegFiltro, SelectFiltro, BuscaInput, ChipFiltro } from '@/components/filtros/FiltroBarra';

// ---------------------------------------------------------------------------

interface AreaAgg { area: string; nota_media: number; n: number; notas_baixas: number; pct_baixas: number }
interface DiaAgg {
  data: string; dow: number; evento: string | null; respostas: number;
  nps_score: number | null; nps_medio: number | null;
  pior_area: string | null; pior_nota: number | null; areas: Record<string, number>;
}
interface RespostaItem {
  falae_id: string; pesquisa: string | null; data_visita: string | null; data_resposta: string;
  dow: number | null; evento: string | null; nps: number; categoria: 'promotor' | 'neutro' | 'detrator';
  cliente: string | null; comentario: string | null; areas: { area: string; nota: number }[];
}
interface Resp {
  success: boolean;
  resumo?: {
    respostas: number; nps_score: number | null; nps_medio: number | null;
    promotores: number; neutros: number; detratores: number; comentarios: number; sem_data_visita: number;
  };
  areas?: AreaAgg[];
  evolucao?: { mes: string; n: number; nps_score: number | null; areas: Record<string, number | null> }[];
  dias?: DiaAgg[];
  respostas?: RespostaItem[];
}

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DIAS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const fmtN = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));
const fmtNota = (n: number | null | undefined) =>
  n == null ? '—' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtScore = (n: number | null | undefined) =>
  n == null ? '—' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const mesLabel = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;

/** ISO de hoje/N dias atrás sem fuso (o app roda em UTC-3 e `toISOString` puxa o dia anterior). */
function isoHoje(offsetDias = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const corNota = (n: number | null) => (n == null ? '#94a3b8' : n >= 4.5 ? '#10b981' : n >= 4 ? '#f59e0b' : '#ef4444');
const corScore = (n: number | null) => (n == null ? '#94a3b8' : n >= 50 ? '#10b981' : n >= 0 ? '#f59e0b' : '#ef4444');
const corCategoria: Record<string, string> = {
  promotor: 'text-emerald-600 dark:text-emerald-400 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20',
  neutro: 'text-amber-600 dark:text-amber-400 border-amber-300 bg-amber-50 dark:bg-amber-900/20',
  detrator: 'text-rose-600 dark:text-rose-400 border-rose-300 bg-rose-50 dark:bg-rose-900/20',
};

const PRESETS = [
  ['30', 'Últimos 30d'],
  ['90', 'Últimos 90d'],
  ['ano', 'Este ano'],
  ['tudo', 'Tudo'],
] as const;
type Preset = (typeof PRESETS)[number][0];

// ---------------------------------------------------------------------------

export default function NpsPorAreaPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();

  const [preset, setPreset] = useState<Preset>('90');
  const [base, setBase] = useState<'visita' | 'resposta'>('visita');
  const [dow, setDow] = useState('');
  const [areaSel, setAreaSel] = useState('');
  const [categoria, setCategoria] = useState('');
  const [busca, setBusca] = useState('');
  const [diaSel, setDiaSel] = useState<string | null>(null);

  useEffect(() => {
    setPageTitle('⭐ NPS por Área');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const { de, ate } = useMemo(() => {
    if (preset === 'tudo') return { de: '', ate: '' };
    if (preset === 'ano') return { de: `${isoHoje().slice(0, 4)}-01-01`, ate: isoHoje() };
    return { de: isoHoje(-Number(preset)), ate: isoHoje() };
  }, [preset]);

  const qs = new URLSearchParams({ bar_id: String(selectedBar?.id || ''), base });
  if (de) qs.set('de', de);
  if (ate) qs.set('ate', ate);
  if (dow) qs.set('dow', dow);

  const { data, isLoading } = useApiSWR<Resp>(selectedBar?.id ? `/api/analitico/nps?${qs.toString()}` : null);

  const resumo = data?.resumo;
  const areas = useMemo(() => data?.areas || [], [data?.areas]);
  const dias = useMemo(() => data?.dias || [], [data?.dias]);

  const kpis: Kpi[] = useMemo(() => {
    if (!resumo) return [];
    return [
      { label: 'NPS', valor: fmtScore(resumo.nps_score), icon: Star, cor: corScore(resumo.nps_score), sub: `${fmtN(resumo.respostas)} respostas` },
      { label: 'Nota média', valor: fmtNota(resumo.nps_medio), icon: Star, sub: 'de 0 a 10' },
      { label: 'Promotores', valor: fmtN(resumo.promotores), icon: Users, cor: '#10b981', sub: `${fmtN(resumo.neutros)} neutros` },
      { label: 'Detratores', valor: fmtN(resumo.detratores), icon: ThumbsDown, cor: '#ef4444', invLower: true },
      { label: 'Comentários', valor: fmtN(resumo.comentarios), icon: MessageSquare },
      { label: 'Sem data da visita', valor: fmtN(resumo.sem_data_visita), icon: CalendarOff, sub: 'fora do corte por dia' },
    ];
  }, [resumo]);

  // Evolução: NPS por mês + nota da área escolhida (a linha).
  const evolucao = useMemo(
    () =>
      (data?.evolucao || []).map((e) => ({
        ...e,
        label: mesLabel(e.mes),
        nota_area: areaSel ? (e.areas?.[areaSel] ?? null) : null,
      })),
    [data?.evolucao, areaSel]
  );

  // Série por dia da área escolhida (ou do NPS quando nenhuma área está selecionada).
  const serieDias = useMemo(
    () =>
      dias
        .slice()
        .reverse()
        .map((d) => ({
          label: ddmm(d.data),
          data: d.data,
          nps_score: d.nps_score,
          nota_area: areaSel ? (d.areas?.[areaSel] ?? null) : null,
        })),
    [dias, areaSel]
  );

  const opcoesArea = useMemo(() => areas.map((a) => a.area).sort((a, b) => a.localeCompare(b, 'pt-BR')), [areas]);

  const respostasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (data?.respostas || []).filter((r) => {
      if (categoria && r.categoria !== categoria) return false;
      if (diaSel && (base === 'visita' ? r.data_visita : r.data_resposta) !== diaSel) return false;
      if (areaSel && !r.areas.some((a) => a.area === areaSel)) return false;
      if (termo) {
        const alvo = `${r.comentario || ''} ${r.cliente || ''} ${r.evento || ''}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [data?.respostas, categoria, diaSel, areaSel, busca, base]);

  if (!selectedBar?.id) return <div className="p-6 text-sm text-gray-500">Selecione um bar.</div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* ---- filtros ---- */}
      <FiltroBarra>
        <SegFiltro value={preset} onChange={(v) => setPreset(v)} options={PRESETS} cor="indigo" title="Período" />
        <SegFiltro
          value={base}
          onChange={(v) => { setBase(v); setDiaSel(null); }}
          options={[['visita', 'Data da visita'], ['resposta', 'Data da resposta']] as const}
          cor="violet"
          title="O período recorta por qual data?"
        />
        <SelectFiltro value={dow} onChange={setDow} options={DIAS_SEMANA.map((d, i) => ({ value: String(i), label: d }))} todos="Todo dia da semana" />
        <SelectFiltro value={areaSel} onChange={setAreaSel} options={opcoesArea} todos="Todas as áreas" title="Área avaliada" />
        {de && (
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {ddmm(de)} a {ddmm(ate)}
          </span>
        )}
      </FiltroBarra>

      {isLoading && !data ? (
        <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-72 w-full" /></div>
      ) : !data?.success || !resumo || !resumo.respostas ? (
        <div className="rounded-xl border border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
          Sem respostas de NPS no período{base === 'visita' ? ' (pelo dia da visita)' : ''}.
        </div>
      ) : (
        <>
          <HeroRow kpis={kpis} cols={6} />

          <ChartGrid cols={2}>
            <ChartCard titulo="Nota por área" subtitulo="média de 1 a 5 · o gargalo vem primeiro">
              <GraficoBarraH
                data={areas}
                xKey="area"
                valueKey="nota_media"
                formatV={fmtNota}
                corPorItem={(d) => corNota(d.nota_media)}
                maxItens={12}
              />
            </ChartCard>

            <ChartCard
              titulo={areaSel ? `${areaSel} — evolução mensal` : 'NPS por mês'}
              subtitulo={areaSel ? 'barra = respostas no mês · linha = nota da área' : 'barra = respostas no mês · linha = NPS'}
            >
              <GraficoBarra
                data={evolucao}
                xKey="label"
                valueKey="n"
                lineKey={areaSel ? 'nota_area' : 'nps_score'}
                formatV={fmtN}
                formatLine={areaSel ? fmtNota : fmtScore}
                nomeBarra="Respostas"
                nomeLinha={areaSel ? 'Nota' : 'NPS'}
                corLinha={areaSel ? '#8b5cf6' : '#10b981'}
              />
            </ChartCard>

            <ChartCard
              titulo={areaSel ? `${areaSel} — dia a dia` : 'NPS dia a dia'}
              subtitulo={`por ${base === 'visita' ? 'data da visita' : 'data da resposta'} · clique na tabela abaixo pra ler os comentários do dia`}
              span={2}
            >
              <GraficoLinha
                data={serieDias}
                xKey="label"
                series={areaSel ? [{ key: 'nota_area', nome: areaSel, cor: '#8b5cf6' }] : [{ key: 'nps_score', nome: 'NPS', cor: '#10b981' }]}
                formatV={areaSel ? fmtNota : fmtScore}
                connectNulls
                rotacaoX={45}
                height={260}
              />
            </ChartCard>
          </ChartGrid>

          {/* ---- dias ---- */}
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                Dias por {base === 'visita' ? 'data da visita' : 'data da resposta'}
                {areaSel && <span className="ml-1 font-normal text-[hsl(var(--muted-foreground))]">· nota de {areaSel}</span>}
              </h3>
              {diaSel && (
                <button onClick={() => setDiaSel(null)} className="text-xs text-indigo-600 hover:underline">
                  limpar dia selecionado ({ddmm(diaSel)})
                </button>
              )}
            </div>
            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[hsl(var(--card))]">
                  <tr className="text-left text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
                    <th className="py-2 pr-3 font-medium">Dia</th>
                    <th className="py-2 px-3 font-medium">Evento</th>
                    <th className="py-2 px-3 font-medium text-right">Respostas</th>
                    <th className="py-2 px-3 font-medium text-right">NPS</th>
                    <th className="py-2 px-3 font-medium text-right">Nota média</th>
                    <th className="py-2 pl-3 font-medium">{areaSel ? `Nota de ${areaSel}` : 'Pior área do dia'}</th>
                  </tr>
                </thead>
                <tbody>
                  {dias.map((d) => {
                    const notaArea = areaSel ? (d.areas?.[areaSel] ?? null) : d.pior_nota;
                    return (
                      <tr
                        key={d.data}
                        onClick={() => setDiaSel(diaSel === d.data ? null : d.data)}
                        className={`cursor-pointer border-b border-[hsl(var(--border))]/50 hover:bg-[hsl(var(--muted))]/40 ${diaSel === d.data ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
                      >
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {ddmm(d.data)} <span className="text-[hsl(var(--muted-foreground))]">{DIAS_CURTO[d.dow]}</span>
                        </td>
                        <td className="py-2 px-3 max-w-[260px] truncate" title={d.evento || ''}>
                          {d.evento || <span className="text-[hsl(var(--muted-foreground))]">—</span>}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">{fmtN(d.respostas)}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-medium" style={{ color: corScore(d.nps_score) }}>
                          {fmtScore(d.nps_score)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">{fmtNota(d.nps_medio)}</td>
                        <td className="py-2 pl-3 whitespace-nowrap">
                          {notaArea == null ? (
                            <span className="text-[hsl(var(--muted-foreground))]">—</span>
                          ) : (
                            <>
                              {!areaSel && d.pior_area && <span className="mr-1.5">{d.pior_area}</span>}
                              <span className="font-medium tabular-nums" style={{ color: corNota(notaArea) }}>{fmtNota(notaArea)}</span>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ---- respostas ---- */}
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold mr-1">
                Respostas <span className="font-normal text-[hsl(var(--muted-foreground))]">({fmtN(respostasFiltradas.length)})</span>
              </h3>
              {(['promotor', 'neutro', 'detrator'] as const).map((c) => (
                <ChipFiltro
                  key={c}
                  ativo={categoria === c}
                  onClick={() => setCategoria(categoria === c ? '' : c)}
                  cor={c === 'promotor' ? 'emerald' : c === 'neutro' ? 'amber' : 'rose'}
                >
                  {c === 'promotor' ? 'Promotores' : c === 'neutro' ? 'Neutros' : 'Detratores'}
                </ChipFiltro>
              ))}
              <BuscaInput value={busca} onChange={setBusca} placeholder="Buscar no comentário, cliente ou evento…" className="max-w-sm" />
            </div>

            <div className="space-y-2 max-h-[560px] overflow-y-auto">
              {respostasFiltradas.map((r) => (
                <div key={r.falae_id} className="rounded-lg border border-[hsl(var(--border))] p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full border px-2 py-0.5 font-medium ${corCategoria[r.categoria]}`}>
                      {r.nps}
                    </span>
                    <span className="font-medium">
                      {r.data_visita ? (
                        <>Visita {ddmm(r.data_visita)} {r.dow != null && <span className="text-[hsl(var(--muted-foreground))]">{DIAS_CURTO[r.dow]}</span>}</>
                      ) : (
                        <span className="text-[hsl(var(--muted-foreground))]">Sem data da visita</span>
                      )}
                    </span>
                    {r.evento && <span className="text-[hsl(var(--muted-foreground))] truncate max-w-[240px]">· {r.evento}</span>}
                    <span className="text-[hsl(var(--muted-foreground))]">· respondeu {ddmm(r.data_resposta)}</span>
                    {r.cliente && <span className="text-[hsl(var(--muted-foreground))] truncate max-w-[180px]">· {r.cliente}</span>}
                  </div>

                  {r.areas.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.areas.map((a) => (
                        <span
                          key={a.area}
                          className="rounded-md border border-[hsl(var(--border))] px-1.5 py-0.5 text-[11px]"
                          style={{ color: corNota(a.nota) }}
                          title={`${a.area}: ${a.nota} de 5`}
                        >
                          {a.area} {a.nota}
                        </span>
                      ))}
                    </div>
                  )}

                  {r.comentario && <p className="mt-2 text-sm text-[hsl(var(--foreground))]">{r.comentario}</p>}
                </div>
              ))}
              {!respostasFiltradas.length && (
                <div className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Nenhuma resposta com esses filtros.</div>
              )}
            </div>
          </div>

          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Notas de área são de 1 a 5 (o Falae coleta uma por área em cada resposta); o NPS é de 0 a 10.
            Rótulos diferentes da mesma coisa (&ldquo;Tempo de Espera&rdquo;, &ldquo;TEMPO DE ENTREGA&rdquo;,
            &ldquo;TEMPO DE ESPERA DOS PEDIDOS&rdquo;) são unificados numa área só.
            {resumo.sem_data_visita > 0 && ` ${fmtN(resumo.sem_data_visita)} resposta(s) do período não informaram a data da visita e ficam fora dos cortes por dia.`}
          </p>
        </>
      )}
    </div>
  );
}
