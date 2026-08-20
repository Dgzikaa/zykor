'use client';

import { useMemo, useState } from 'react';
import { useApiSWR } from '@/hooks/useApiSWR';
import {
  ChartCard, ChartGrid, GraficoBarraH, GraficoDonut, GraficoLinha,
  HeroRow, type Kpi,
} from '@/components/graficos/Charts';
import { Loader2, TrendingDown, Repeat, Boxes, ChefHat, Drumstick } from 'lucide-react';

/**
 * ANÁLISES DE DESVIO — a evolução, não o retrato de uma semana.
 *
 * Gonza (20/08/2026): "gráficos dos desvios semana a semana, mês a mês. O desvio aberto por
 * Insumo/Produção/Proteína evoluindo no tempo. Quais insumos estão dando mais desvio, ranking".
 *
 * Cada ponto do gráfico é uma JANELA ENTRE DUAS CONTAGENS — que é a única forma de o desvio
 * existir. Por isso o eixo mostra a data de fechamento da contagem e não "semana 33": o time
 * conta quando conta, e forçar um calendário fixo criaria número que a tela principal não
 * confirma.
 */

const fmtBRL = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtBRL2 = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDM = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');

const GRUPO_ICONE: Record<string, any> = { insumo: Boxes, producao: ChefHat, proteina: Drumstick };
const GRUPO_LABEL: Record<string, string> = { insumo: 'Insumo', producao: 'Produção', proteina: 'Proteína' };

/** hoje e "hoje menos N dias", no fuso de quem olha (toISOString erraria o dia à noite). */
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const diasAtras = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };

/**
 * Recortes prontos (Rodrigo, 20/08/2026: "pra pegar os maiores do último mês, ou da última
 * semana, ou do ano todo"). `dias: null` = sem filtro de data, usa a contagem de períodos.
 */
const RECORTES = [
  { chave: 'ultima', rotulo: 'Última contagem', dias: 14 },
  { chave: 'mes', rotulo: 'Último mês', dias: 31 },
  { chave: 'tri', rotulo: '3 meses', dias: 92 },
  { chave: 'sem', rotulo: '6 meses', dias: 184 },
  { chave: 'ano', rotulo: 'Ano todo', dias: 365 },
] as const;

export function AbaAnalises() {
  const [tipo, setTipo] = useState<'semanal' | 'mensal'>('semanal');
  const [recorte, setRecorte] = useState<string>('tri');
  const [grupo, setGrupo] = useState<'todos' | 'insumo' | 'producao' | 'proteina'>('todos');
  // Filtro por ÁREA no ranking: "as metas da galera vamos fazer por área" (Gonza, 20/08/2026).
  const [areaSel, setAreaSel] = useState<string>('todas');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  const query = useMemo(() => {
    if (recorte === 'custom' && (de || ate)) {
      return `de=${de || '2000-01-01'}&ate=${ate || ymd(new Date())}`;
    }
    const r = RECORTES.find((x) => x.chave === recorte) || RECORTES[2];
    return `de=${diasAtras(r.dias)}&ate=${ymd(new Date())}`;
  }, [recorte, de, ate]);

  const { data, isLoading } = useApiSWR<any>(
    `/api/operacional/desvios/analises?tipo=${tipo}&${query}`);

  /** Áreas presentes no período — viram as séries do gráfico de linha por área. */
  const areasSeries = useMemo(
    () => ((data?.areas || []) as any[]).map((a) => a.nome as string), [data]);

  const serie = useMemo(() => (data?.serie || []).map((s: any) => {
    const linha: any = {
      ...s,
      rotulo: fmtDM(s.fim),
      insumos_perdas: s.insumos.perdas,
      producoes_perdas: s.producoes.perdas,
      proteinas_perdas: s.proteinas.perdas,
    };
    // área que não teve perda na janela entra como 0 — sem isso a linha corta no meio
    for (const a of areasSeries) linha[`area_${a}`] = Number(s.por_area?.[a] || 0);
    return linha;
  }), [data, areasSeries]);

  /**
   * Proteína é OUTRA LEITURA dos mesmos insumos, não uma terceira origem — por isso fica fora
   * de "Todos". Era o que fazia o Filé mignon aparecer duas vezes com valores diferentes
   * (R$ 21.352 como insumo, R$ 6.809 como proteína). Em "Todos" vale a leitura de insumo;
   * quem quer a de proteína filtra por Proteínas.
   */
  const ranking = useMemo(() => {
    const base = (data?.ranking || []) as any[];
    const porGrupo = grupo === 'todos'
      ? base.filter((r) => r.grupo !== 'proteina')
      : base.filter((r) => r.grupo === grupo);
    return areaSel === 'todas' ? porGrupo : porGrupo.filter((r) => r.area === areaSel);
  }, [data, grupo, areaSel]);

  /** O intervalo REAL que a tela está somando — o ranking acumula exatamente isto. */
  const intervaloTxt = useMemo(() => {
    if (!data?.intervalo) return '';
    const per = `${data.janelas} ${tipo === 'semanal' ? (data.janelas === 1 ? 'semana' : 'semanas') : (data.janelas === 1 ? 'mês' : 'meses')}`;
    return `${fmtDM(data.intervalo.de)} a ${fmtDM(data.intervalo.ate)} · ${per}`;
  }, [data, tipo]);

  const kpis: Kpi[] = useMemo(() => {
    if (!serie.length) return [];
    const ultimo = serie[serie.length - 1];
    const anterior = serie.length > 1 ? serie[serie.length - 2] : null;
    const delta = anterior && anterior.perda_total > 0
      ? ((ultimo.perda_total - anterior.perda_total) / anterior.perda_total) * 100 : null;
    const recorrentes = (data?.ranking || []).filter((r: any) => r.recorrente).length;
    return [
      { label: `Perda no último período`, valor: fmtBRL(ultimo.perda_total), sub: `${fmtDM(ultimo.ini)} a ${fmtDM(ultimo.fim)}`,
        delta, invLower: true, icon: TrendingDown },
      { label: `Média por ${tipo === 'semanal' ? 'semana' : 'mês'}`, valor: fmtBRL(data?.total?.media_por_periodo || 0),
        sub: `${serie.length} períodos` },
      { label: 'Perda acumulada', valor: fmtBRL(data?.total?.perdas || 0), sub: 'insumos + produções · não soma proteínas' },
      { label: 'Itens recorrentes', valor: String(recorrentes), sub: 'perdem na maioria dos períodos', icon: Repeat },
    ];
  }, [serie, data, tipo, intervaloTxt]);

  if (isLoading) {
    return <div className="py-20 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-gray-400" /></div>;
  }
  if (!serie.length) {
    return (
      <div className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
        Ainda não há duas contagens {tipo === 'semanal' ? 'semanais' : 'mensais'} para comparar.
        O desvio só existe entre uma contagem e a seguinte.
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex rounded-lg border border-[hsl(var(--border))] overflow-hidden">
          {(['semanal', 'mensal'] as const).map((t) => (
            <button key={t} onClick={() => setTipo(t)}
              className={`px-3 py-1.5 text-xs font-medium transition ${
                tipo === t ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-[hsl(var(--muted))]'}`}>
              {t === 'semanal' ? 'Semana a semana' : 'Mês a mês'}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-[hsl(var(--border))] overflow-hidden">
          {RECORTES.map((r) => (
            <button key={r.chave} onClick={() => setRecorte(r.chave)}
              className={`px-2.5 py-1.5 text-xs font-medium transition ${
                recorte === r.chave ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-[hsl(var(--muted))]'}`}>
              {r.rotulo}
            </button>
          ))}
          <button onClick={() => setRecorte('custom')}
            className={`px-2.5 py-1.5 text-xs font-medium transition ${
              recorte === 'custom' ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-[hsl(var(--muted))]'}`}>
            Escolher datas
          </button>
        </div>

        {recorte === 'custom' && (
          <span className="inline-flex items-center gap-1.5">
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)}
              className="h-8 rounded-md border border-[hsl(var(--border))] bg-transparent px-2 text-xs" />
            <span className="text-[11px] text-gray-400">até</span>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)}
              className="h-8 rounded-md border border-[hsl(var(--border))] bg-transparent px-2 text-xs" />
          </span>
        )}
      </div>

      <p className="text-[11px] text-gray-400 -mt-1">
        Cada ponto é o intervalo entre duas contagens {tipo === 'semanal' ? 'semanais' : 'mensais'} —
        é assim que o desvio existe. Itens marcados com o olhinho ficam de fora.
        {intervaloTxt && <> Período em tela: <b>{intervaloTxt}</b>.</>}
      </p>

      {data?.truncado > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[12px]">
          Mostrando os <b>{data.janelas}</b> períodos mais recentes do intervalo — outros{' '}
          <b>{data.truncado}</b> ficaram de fora para a tela não demorar. Estreite as datas para vê-los.
        </div>
      )}

      <HeroRow kpis={kpis} cols={4} />

      <ChartGrid cols={2}>
        {/* Duas linhas, uma pergunta cada: ORIGEM responde "de onde vem a perda" e ÁREA responde
            "onde ela acontece". Empilhar as duas num gráfico só misturaria dois recortes do
            MESMO total e a soma pareceria o dobro. */}
        <ChartCard titulo="Evolução por origem"
          subtitulo="insumos + produções somam o total · proteínas é outra leitura dos mesmos insumos (tracejada)" span={2}>
          <GraficoLinha
            data={serie} xKey="rotulo" height={300} formatV={fmtBRL}
            series={[
              { key: 'insumos_perdas', nome: 'Insumos' },
              { key: 'producoes_perdas', nome: 'Produções' },
              { key: 'proteinas_perdas', nome: 'Proteínas (outra leitura)', dashed: true },
            ]}
          />
        </ChartCard>

        <ChartCard titulo="Evolução por área" subtitulo="a mesma perda, aberta por Comidas / Drinks / Salão / Alimentação" span={2}>
          {areasSeries.length ? (
            <GraficoLinha
              data={serie} xKey="rotulo" height={300} formatV={fmtBRL}
              series={areasSeries.map((a) => ({ key: `area_${a}`, nome: a }))}
            />
          ) : <div className="py-20 text-center text-xs text-gray-400">Sem perda por área no período.</div>}
        </ChartCard>

        <ChartCard titulo="Onde a perda se concentra" subtitulo={`por área · ${intervaloTxt || 'intervalo analisado'}`}>
          {(data?.areas || []).length
            ? <GraficoDonut data={data.areas} nameKey="nome" valueKey="perda" height={280} formatV={fmtBRL}
                centro={fmtBRL(data?.total?.perdas || 0)} />
            : <div className="py-16 text-center text-xs text-gray-400">Sem perda registrada no período.</div>}
        </ChartCard>

        <ChartCard titulo="Maiores desvios acumulados" subtitulo={`soma da perda em ${intervaloTxt || 'todo o período'}`} span={2}
          right={
            <div className="flex items-center gap-1.5">
              <div className="inline-flex rounded-lg border border-[hsl(var(--border))] overflow-hidden">
                {(['todos', 'insumo', 'producao', 'proteina'] as const).map((g) => (
                  <button key={g} onClick={() => setGrupo(g)}
                    className={`px-2.5 py-1 text-[11px] font-medium transition ${
                      grupo === g ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-[hsl(var(--muted))]'}`}>
                    {g === 'todos' ? 'Todos' : GRUPO_LABEL[g] + 's'}
                  </button>
                ))}
              </div>
              {/* Área é o recorte das METAS da equipe — precisa filtrar aqui também. */}
              <select value={areaSel} onChange={(e) => setAreaSel(e.target.value)}
                className="h-[26px] rounded-md border border-[hsl(var(--border))] bg-transparent px-1.5 text-[11px]">
                <option value="todas">Todas as áreas</option>
                {areasSeries.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          }>
          {ranking.length ? (
            <GraficoBarraH data={ranking.map((r) => ({ nome: r.nome, perda: r.perda }))}
              xKey="nome" valueKey="perda" height={Math.min(420, 40 + ranking.length * 26)}
              formatV={fmtBRL} maxItens={14} />
          ) : <div className="py-16 text-center text-xs text-gray-400">Nada nesta origem.</div>}
        </ChartCard>
      </ChartGrid>

      {/* Ranking em tabela — o gráfico mostra a ordem, a tabela responde "por que". */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
        <div className="px-4 py-3 border-b border-[hsl(var(--border))]">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Ranking de desvios{intervaloTxt && <span className="font-normal text-gray-500"> · {intervaloTxt}</span>}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <b>Recorrente</b> = perdeu na maioria dos períodos. É o que vale investigar primeiro —
            um item que perdeu muito uma vez costuma ser erro de contagem; o que perde sempre é processo.
            {grupo === 'proteina'
              ? ' Proteínas usa outra conta (VMarket × utilizado na produção), por isso o mesmo item pode ter valor diferente da lista de insumos.'
              : ' "Todos" não inclui Proteínas: seriam os MESMOS itens contados por outra régua.'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-gray-500 bg-[hsl(var(--muted))]/40">
              <tr>
                <th className="text-left px-3 py-2">#</th>
                <th className="text-left px-3 py-2">Item</th>
                <th className="text-left px-3 py-2">Origem</th>
                <th className="text-left px-3 py-2">Área</th>
                <th className="text-right px-3 py-2">Perda acumulada</th>
                <th className="text-right px-3 py-2">Períodos c/ perda</th>
                <th className="text-right px-3 py-2">Média por período</th>
              </tr>
            </thead>
            <tbody>
              {ranking.slice(0, 30).map((r: any, i: number) => {
                const Icone = GRUPO_ICONE[r.grupo] || Boxes;
                return (
                  <tr key={`${r.grupo}-${r.codigo}`} className="border-t border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/30">
                    <td className="px-3 py-2 text-gray-400 tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2">
                      <span className="font-medium text-gray-900 dark:text-white">{r.nome}</span>
                      <span className="block text-[10px] text-gray-400">{r.codigo}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                        <Icone className="w-3.5 h-3.5" />{GRUPO_LABEL[r.grupo]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{r.grupo === 'proteina' ? '—' : r.area}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-rose-600 dark:text-rose-400">{fmtBRL2(r.perda)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.janelas_com_perda}
                      {r.recorrente && (
                        <span className="ml-1.5 text-[9px] uppercase tracking-wide px-1 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold">
                          recorrente
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtBRL2(r.media)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
