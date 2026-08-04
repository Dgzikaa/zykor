'use client';

/**
 * Almoço × Noite — /analitico/dia-noite
 *
 * Pergunta do Rodrigo (04/08/2026): "no sábado, quanto de faturamento foi feijuca e quanto foi a
 * noite?". A curva horária já existia, mas os blocos prontos começavam às 17h — o almoço não tinha
 * bloco. Aqui o dia é partido por uma hora de corte ajustável, com pessoas, ticket e o prato âncora.
 *
 * Fonte: /api/analitico/dia-noite (operations.fn_dia_noite). Só ContaHub — evento com bilheteria
 * Yuzer/Sympla não entra.
 */

import { useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { Skeleton } from '@/components/ui/skeleton';
import { Sun, Moon, Percent, Users, UtensilsCrossed } from 'lucide-react';
import { HeroRow, ChartCard, ChartGrid, GraficoBarrasAgrupadas, GraficoBarrasAgrupadasH, type Kpi } from '@/components/graficos/Charts';
import { FiltroBarra, SegFiltro, SelectFiltro } from '@/components/filtros/FiltroBarra';
import { Input } from '@/components/ui/input';

interface DiaRow {
  data: string; dow: number;
  fat_dia: number; fat_noite: number; fat_total: number; pct_dia: number | null;
  pessoas_dia: number; pessoas_noite: number; comandas_dia: number; comandas_noite: number;
  ticket_dia: number | null; ticket_noite: number | null;
  prod_qtd: number; prod_valor: number;
}
interface Resp {
  success: boolean;
  corte?: number;
  produto?: string | null;
  resumo?: {
    dias: number; fat_dia: number; fat_noite: number; fat_total: number; pct_dia: number | null;
    media_fat_dia: number | null; media_fat_noite: number | null;
    pessoas_dia: number; pessoas_noite: number; ticket_dia: number | null; ticket_noite: number | null;
    prod_qtd: number; prod_valor: number;
  };
  dias?: DiaRow[];
  por_dow?: { dow: number; dias: number; media_dia: number; media_noite: number; pct_dia: number | null }[];
}

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DIAS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const fmtBRL = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
const fmtBRLk = (n: number | null | undefined) => {
  if (n == null) return '—';
  const v = Number(n);
  return v >= 1000 ? `R$ ${(v / 1000).toFixed(1).replace('.', ',')}k` : fmtBRL(v);
};
const fmtPct = (n: number | null | undefined) =>
  n == null ? '—' : `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const fmtN = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function isoHoje(offsetDias = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const PRESETS = [
  ['30', 'Últimos 30d'],
  ['90', 'Últimos 90d'],
  ['180', 'Últimos 180d'],
  ['ano', 'Este ano'],
] as const;
type Preset = (typeof PRESETS)[number][0];

const CORTES = ['16', '17', '18', '19', '20'] as const;

const COR_DIA = '#f59e0b';
const COR_NOITE = '#6366f1';

export default function AlmocoNoitePage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();

  const [preset, setPreset] = useState<Preset>('90');
  const [dow, setDow] = useState('');
  const [corte, setCorte] = useState('18');
  const [produtoInput, setProdutoInput] = useState('feijoada');
  const [produto, setProduto] = useState('feijoada');

  useEffect(() => {
    setPageTitle('🍽️ Almoço × Noite');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const { de, ate } = useMemo(() => {
    if (preset === 'ano') return { de: `${isoHoje().slice(0, 4)}-01-01`, ate: isoHoje() };
    return { de: isoHoje(-Number(preset)), ate: isoHoje() };
  }, [preset]);

  const qs = new URLSearchParams({ bar_id: String(selectedBar?.id || ''), de, ate, corte, produto });
  if (dow) qs.set('dow', dow);

  const { data, isLoading } = useApiSWR<Resp>(selectedBar?.id ? `/api/analitico/dia-noite?${qs.toString()}` : null);

  const resumo = data?.resumo;
  const dias = useMemo(() => data?.dias || [], [data?.dias]);

  const kpis: Kpi[] = useMemo(() => {
    if (!resumo) return [];
    return [
      { label: `Almoço (até ${corte}h)`, valor: fmtBRL(resumo.fat_dia), icon: Sun, cor: COR_DIA, sub: `${fmtBRL(resumo.media_fat_dia)}/dia` },
      { label: `Noite (${corte}h+)`, valor: fmtBRL(resumo.fat_noite), icon: Moon, cor: COR_NOITE, sub: `${fmtBRL(resumo.media_fat_noite)}/dia` },
      { label: '% do fat. no almoço', valor: fmtPct(resumo.pct_dia), icon: Percent, sub: `${fmtN(resumo.dias)} dias` },
      { label: 'Pessoas almoço', valor: fmtN(resumo.pessoas_dia), icon: Users, sub: `ticket ${fmtBRL(resumo.ticket_dia)}` },
      { label: 'Pessoas noite', valor: fmtN(resumo.pessoas_noite), icon: Users, sub: `ticket ${fmtBRL(resumo.ticket_noite)}` },
      {
        label: produto ? `"${produto}"` : 'Prato âncora',
        valor: fmtN(resumo.prod_qtd),
        icon: UtensilsCrossed,
        sub: `${fmtBRL(resumo.prod_valor)} vendidos`,
      },
    ];
  }, [resumo, corte, produto]);

  const serie = useMemo(() => dias.slice().reverse().map((d) => ({ ...d, label: ddmm(d.data) })), [dias]);
  const porDow = useMemo(
    () => (data?.por_dow || []).map((d) => ({ ...d, dia: DIAS_SEMANA[d.dow] })),
    [data?.por_dow]
  );

  if (!selectedBar?.id) return <div className="p-6 text-sm text-gray-500">Selecione um bar.</div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <FiltroBarra>
        <SegFiltro value={preset} onChange={(v) => setPreset(v)} options={PRESETS} cor="indigo" title="Período" />
        <SelectFiltro value={dow} onChange={setDow} options={DIAS_SEMANA.map((d, i) => ({ value: String(i), label: d }))} todos="Todo dia da semana" />
        <SegFiltro
          value={corte}
          onChange={(v) => setCorte(v)}
          options={CORTES.map((c) => [c, `corte ${c}h`] as const)}
          cor="amber"
          title="Hora que separa almoço de noite"
        />
        <form
          onSubmit={(e) => { e.preventDefault(); setProduto(produtoInput.trim()); }}
          className="flex items-center gap-1.5"
        >
          <Input
            value={produtoInput}
            onChange={(e) => setProdutoInput(e.target.value)}
            placeholder="Prato âncora (ex.: feijoada)"
            className="h-8 w-[200px] text-sm"
          />
          <button type="submit" className="rounded-lg border border-[hsl(var(--border))] px-2.5 py-1.5 text-xs hover:bg-[hsl(var(--muted))]">
            Aplicar
          </button>
        </form>
      </FiltroBarra>

      {isLoading && !data ? (
        <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-72 w-full" /></div>
      ) : !data?.success || !resumo || !dias.length ? (
        <div className="rounded-xl border border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
          Sem faturamento por hora no período.
        </div>
      ) : (
        <>
          <HeroRow kpis={kpis} cols={6} />

          <ChartGrid cols={2}>
            <ChartCard titulo="Almoço × Noite por dia" subtitulo={`corte às ${corte}h · madrugada conta como noite`} span={2}>
              <GraficoBarrasAgrupadas
                data={serie}
                xKey="label"
                series={[
                  { key: 'fat_dia', nome: `Almoço (até ${corte}h)`, cor: COR_DIA },
                  { key: 'fat_noite', nome: `Noite (${corte}h+)`, cor: COR_NOITE },
                ]}
                lineKey="pct_dia"
                formatV={fmtBRLk}
                formatLine={fmtPct}
                nomeLinha="% almoço"
                rotacaoX={45}
              />
            </ChartCard>

            <ChartCard titulo="Média por dia da semana" subtitulo="quanto cada dia rende de almoço e de noite" span={2}>
              <GraficoBarrasAgrupadasH
                data={porDow}
                yKey="dia"
                series={[
                  { key: 'media_dia', nome: 'Almoço', cor: COR_DIA },
                  { key: 'media_noite', nome: 'Noite', cor: COR_NOITE },
                ]}
                formatV={fmtBRLk}
                height={300}
              />
            </ChartCard>
          </ChartGrid>

          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <h3 className="mb-3 text-sm font-semibold">Dia a dia</h3>
            <div className="overflow-x-auto max-h-[520px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[hsl(var(--card))]">
                  <tr className="text-left text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
                    <th className="py-2 pr-3 font-medium">Dia</th>
                    <th className="py-2 px-3 font-medium text-right">Almoço</th>
                    <th className="py-2 px-3 font-medium text-right">Noite</th>
                    <th className="py-2 px-3 font-medium text-right">Total</th>
                    <th className="py-2 px-3 font-medium text-right">% almoço</th>
                    <th className="py-2 px-3 font-medium text-right">Pessoas (alm/noite)</th>
                    <th className="py-2 px-3 font-medium text-right">Ticket (alm/noite)</th>
                    {produto && <th className="py-2 pl-3 font-medium text-right">{produto}</th>}
                  </tr>
                </thead>
                <tbody>
                  {dias.map((d) => (
                    <tr key={d.data} className="border-b border-[hsl(var(--border))]/50">
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {ddmm(d.data)} <span className="text-[hsl(var(--muted-foreground))]">{DIAS_CURTO[d.dow]}</span>
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-medium" style={{ color: COR_DIA }}>{fmtBRL(d.fat_dia)}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-medium" style={{ color: COR_NOITE }}>{fmtBRL(d.fat_noite)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmtBRL(d.fat_total)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmtPct(d.pct_dia)}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-[hsl(var(--muted-foreground))]">
                        {fmtN(d.pessoas_dia)} / {fmtN(d.pessoas_noite)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-[hsl(var(--muted-foreground))]">
                        {fmtBRL(d.ticket_dia)} / {fmtBRL(d.ticket_noite)}
                      </td>
                      {produto && (
                        <td className="py-2 pl-3 text-right tabular-nums">
                          {d.prod_qtd ? `${fmtN(d.prod_qtd)} · ${fmtBRL(d.prod_valor)}` : '—'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Faturamento pela hora do lançamento do item (comanda aberta às 14h que fecha às 22h fica
            distribuída no turno certo); pessoas pela hora de abertura da comanda. Madrugada (0h–6h) conta
            como noite. Só ContaHub — venda de ingresso Yuzer/Sympla não entra.
          </p>
        </>
      )}
    </div>
  );
}
