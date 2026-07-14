'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import {
  Package, Clock, TrendingDown, DollarSign, AlertTriangle,
  CalendarDays, CheckCircle2, Gauge, ListChecks, Loader2,
} from 'lucide-react';
import {
  addDiasIso, fmtDM, isoLocal, desvioRendReais, fmtBRL, fmtNum, rendAmigavel,
  fmtPct, fmtTempo, fmtData, secaoDeCodigo, type Secao,
} from './_shared';
import { DetalheExecucaoModal } from './DetalheExecucaoModal';

type Gran = 'dia' | 'semana' | 'mes';

// segunda-feira (ISO) da semana de uma data local YYYY-MM-DD
const segundaDaSemana = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // Mon=0..Sun=6
  return addDiasIso(iso, -dow);
};
const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const nomeMes = (ym: string): string => { const [y, m] = ym.split('-').map(Number); return `${MESES_ABREV[(m || 1) - 1]}/${y}`; };
const labelDia = (iso: string): string => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }); };

// uma produção está "dentro do rendimento esperado" quando o real fica a ±5% do esperado da ficha
const dentroDoRendimento = (e: any): boolean =>
  e.rendimento_real != null && e.rendimento_esperado != null && e.rendimento_esperado > 0 &&
  Math.abs(Number(e.rendimento_real) / Number(e.rendimento_esperado) - 1) <= 0.05;
const temRendimento = (e: any): boolean =>
  e.rendimento_real != null && e.rendimento_esperado != null && Number(e.rendimento_esperado) > 0;

export function AbaAnalise({ secaoAtiva }: { secaoAtiva: Secao }) {
  const { selectedBar } = useBar();
  const barId = selectedBar?.id;
  const [gran, setGran] = useState<Gran>('semana');
  const [periodoSel, setPeriodoSel] = useState<string>(''); // dia iso / segunda da semana / 'YYYY-MM'
  const [execs, setExecs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [detalhe, setDetalhe] = useState<any | null>(null); // #10 — abrir a produção (igual ao Histórico)

  // janela ampla (últimos 180 dias) só p/ montar as opções de período; o filtro é o seletor abaixo
  const carregar = useCallback(async () => {
    if (!barId) return;
    setLoading(true);
    try {
      const de = new Date(); de.setDate(de.getDate() - 180);
      const qs = new URLSearchParams({ bar_id: String(barId), de: de.toISOString().slice(0, 10), ate: `${new Date().toISOString().slice(0, 10)}T23:59:59.999` });
      const r = await api.get(`/api/operacional/producoes/execucao?${qs.toString()}`);
      if (r.success) setExecs(r.execucoes || []);
    } finally { setLoading(false); }
  }, [barId]);
  useEffect(() => { carregar(); }, [carregar]);

  // só a seção ativa (Cozinha/Bar)
  const execsSecao = useMemo(() => execs.filter((e: any) => secaoDeCodigo(e.producao_codigo) === secaoAtiva), [execs, secaoAtiva]);
  // chave de período de uma execução conforme a granularidade
  const chaveDe = useCallback((e: any) => {
    const dia = isoLocal(e.criado_em);
    return gran === 'dia' ? dia : gran === 'semana' ? segundaDaSemana(dia) : dia.slice(0, 7);
  }, [gran]);

  // opções do seletor (períodos que têm produção), mais recente primeiro — igual à tela de Desvios
  const opcoes = useMemo(() => {
    const set = new Set<string>();
    for (const e of execsSecao) set.add(chaveDe(e));
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [execsSecao, chaveDe]);
  // ao trocar granularidade/seção, garante um período válido selecionado (o mais recente)
  useEffect(() => { if (!opcoes.includes(periodoSel)) setPeriodoSel(opcoes[0] || ''); }, [opcoes, periodoSel]);

  const labelPeriodo = useCallback((key: string) => !key ? '—' : gran === 'dia' ? labelDia(key) : gran === 'semana' ? `${fmtDM(key)} – ${fmtDM(addDiasIso(key, 6))}` : nomeMes(key), [gran]);

  // execuções do período selecionado (mais recentes primeiro) — a listagem de baixo
  const doPeriodo = useMemo(() =>
    execsSecao.filter(e => chaveDe(e) === periodoSel).sort((a, b) => (a.criado_em < b.criado_em ? 1 : -1)),
    [execsSecao, chaveDe, periodoSel]);

  // resumo consolidado do período selecionado — o cabeçalho de cima
  const resumo = useMemo(() => {
    const list = doPeriodo;
    const comRend = list.filter(temRendimento);
    const dentro = comRend.filter(dentroDoRendimento).length;
    const custoPlan = list.reduce((s: number, e: any) => s + (Number(e.custo_planejado) || 0), 0);
    const custoReal = list.reduce((s: number, e: any) => s + (Number(e.custo_real) || 0), 0);
    const aders = list.filter((e: any) => e.aderencia_pct != null).map((e: any) => Number(e.aderencia_pct));
    return {
      n: list.length, avaliaveis: comRend.length, dentro,
      nota: comRend.length ? (dentro / comRend.length) * 100 : null,
      rendMedio: comRend.length ? comRend.reduce((s: number, e: any) => s + (Number(e.rendimento_real) / Number(e.rendimento_esperado) * 100), 0) / comRend.length : null,
      aderMedia: aders.length ? aders.reduce((s: number, v: number) => s + v, 0) / aders.length : null,
      desvioInsumo: custoReal - custoPlan,
      desvioRend: list.reduce((s: number, e: any) => s + (desvioRendReais(e) ?? 0), 0),
      tempoTotal: list.reduce((s: number, e: any) => s + (Number(e.duracao_seg) || 0), 0),
    };
  }, [doPeriodo]);

  const corNota = (n: number | null) => n == null ? 'text-gray-400' : n >= 90 ? 'text-emerald-600 dark:text-emerald-400' : n >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
  const corDesvio = (v: number) => v > 0.005 ? 'text-red-600 dark:text-red-400' : v < -0.005 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-gray-100';

  return (
    <div className="space-y-3">
      {/* controles: granularidade + seletor do período (igual Desvios) */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 bg-muted/30">
          {(['dia', 'semana', 'mes'] as Gran[]).map(g => (
            <button key={g} onClick={() => setGran(g)}
              className={`text-sm rounded-md px-3 py-1 transition ${gran === g ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
              {g === 'mes' ? 'Mês' : g === 'dia' ? 'Dia' : 'Semana'}
            </button>
          ))}
        </div>
        <div className="inline-flex items-center gap-1.5 text-sm">
          <CalendarDays className="w-4 h-4 text-violet-500" />
          <span className="text-gray-500">{gran === 'dia' ? 'Dia' : gran === 'semana' ? 'Semana' : 'Mês'}</span>
          <select value={periodoSel} onChange={e => setPeriodoSel(e.target.value)}
            className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm text-gray-900 dark:text-white">
            {opcoes.length === 0 && <option value="">—</option>}
            {opcoes.map(k => <option key={k} value={k}>{labelPeriodo(k)}</option>)}
          </select>
        </div>
        <span className="text-xs text-gray-400 ml-auto">{doPeriodo.length} produç{doPeriodo.length === 1 ? 'ão' : 'ões'} · {secaoAtiva}</span>
      </div>

      {/* resumo do período selecionado */}
      <Card className="card-dark border-violet-200 dark:border-violet-900/40">
        <CardContent className="p-3">
          <div className="flex items-center gap-1.5 mb-2 text-sm font-semibold text-violet-700 dark:text-violet-300">
            <Gauge className="w-4 h-4" />Resumo {gran === 'dia' ? 'do dia' : gran === 'semana' ? 'da semana' : 'do mês'} <span className="text-gray-400 font-normal capitalize">{labelPeriodo(periodoSel)}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2">
              <div className="flex items-center gap-1 text-xs text-gray-500"><Gauge className="w-3.5 h-3.5" />Nota</div>
              <div className={`text-lg font-bold tabular-nums ${corNota(resumo.nota)}`}>{fmtPct(resumo.nota)}</div>
              <div className="text-[11px] text-gray-400">{resumo.dentro}/{resumo.avaliaveis} no rend. (±5%)</div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2">
              <div className="flex items-center gap-1 text-xs text-gray-500"><TrendingDown className="w-3.5 h-3.5" />Rend. médio</div>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{fmtPct(resumo.rendMedio)}</div>
              <div className="text-[11px] text-gray-400">real ÷ esperado</div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2">
              <div className="flex items-center gap-1 text-xs text-gray-500"><Package className="w-3.5 h-3.5" />Aderência</div>
              <div className={`text-lg font-bold tabular-nums ${resumo.aderMedia == null ? 'text-gray-400' : resumo.aderMedia >= 90 ? 'text-emerald-600' : resumo.aderMedia >= 80 ? 'text-amber-600' : 'text-red-600'}`}>{fmtPct(resumo.aderMedia)}</div>
              <div className="text-[11px] text-gray-400">insumos calc.×usado</div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2">
              <div className="flex items-center gap-1 text-xs text-gray-500"><Package className="w-3.5 h-3.5" />Desvio insumos</div>
              <div className={`text-base font-bold tabular-nums ${corDesvio(resumo.desvioInsumo)}`}>{resumo.desvioInsumo >= 0 ? '+' : ''}{fmtBRL(resumo.desvioInsumo)}</div>
              <div className="text-[11px] text-gray-400">real − planejado</div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2">
              <div className="flex items-center gap-1 text-xs text-gray-500"><DollarSign className="w-3.5 h-3.5" />Desvio rend.</div>
              <div className={`text-base font-bold tabular-nums ${resumo.desvioRend > 0.005 ? 'text-emerald-600 dark:text-emerald-400' : resumo.desvioRend < -0.005 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>{resumo.desvioRend >= 0 ? '+' : ''}{fmtBRL(resumo.desvioRend)}</div>
              <div className="text-[11px] text-gray-400">vs esperado</div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2">
              <div className="flex items-center gap-1 text-xs text-gray-500"><Clock className="w-3.5 h-3.5" />Tempo</div>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{fmtTempo(resumo.tempoTotal)}</div>
              <div className="text-[11px] text-gray-400">soma do período</div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2">
              <div className="flex items-center gap-1 text-xs text-gray-500"><ListChecks className="w-3.5 h-3.5" />Produções</div>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{resumo.n}</div>
              <div className="text-[11px] text-gray-400">no período</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* listagem: as produções do período filtrado */}
      <Card className="card-dark">
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="py-10 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : doPeriodo.length === 0 ? (
            <div className="py-10 text-center text-gray-400">Nenhuma produção registrada neste período para {secaoAtiva}.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 dark:text-gray-400 border-b"><tr>
                <th className="text-left font-medium px-3 py-2">Produção</th>
                <th className="text-left font-medium px-3 py-2">Data</th>
                <th className="text-left font-medium px-3 py-2">Responsável</th>
                <th className="text-right font-medium px-3 py-2" title="Rendimento real / esperado da ficha">Rend. real / esp.</th>
                <th className="text-center font-medium px-3 py-2" title="Dentro de ±5% do rendimento esperado">No rend.?</th>
                <th className="text-right font-medium px-3 py-2" title="Aderência de insumos (calculado × usado)">Aderência</th>
                <th className="text-right font-medium px-3 py-2" title="Custo real − planejado">Desvio insumos</th>
                <th className="text-right font-medium px-3 py-2">Tempo</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {doPeriodo.map((e: any) => {
                  const temR = temRendimento(e);
                  const dentro = dentroDoRendimento(e);
                  const rendPct = temR ? Number(e.rendimento_real) / Number(e.rendimento_esperado) * 100 : null;
                  const desvio = (Number(e.custo_real) || 0) - (Number(e.custo_planejado) || 0);
                  return (
                    <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer" onClick={() => setDetalhe(e)} title="Abrir produção">
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{e.producao_nome || `#${e.producao_id}`}{e.producao_codigo && <span className="text-gray-400 font-mono text-xs"> · {e.producao_codigo}</span>}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-600 dark:text-gray-300">{fmtData(e.criado_em)}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{e.responsavel_nome || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                        {temR ? (() => { const r = rendAmigavel(e); return <>{fmtNum(r.real, 2)} <span className="text-gray-400">/</span> {fmtNum(r.esp, 2)}{r.un ? ` ${r.un}` : ''} {rendPct != null && <span className={`text-xs ${corNota(dentro ? 100 : 0)}`}>({rendPct.toFixed(0)}%)</span>}</>; })() : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {!temR ? <span className="text-gray-300">—</span>
                          : dentro ? <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-4 h-4" /></span>
                          : <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400"><AlertTriangle className="w-4 h-4" /></span>}
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums ${e.aderencia_pct == null ? 'text-gray-400' : e.aderencia_pct >= 90 ? 'text-emerald-600 dark:text-emerald-400' : e.aderencia_pct >= 80 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>{fmtPct(e.aderencia_pct)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${corDesvio(desvio)}`}>{desvio >= 0 ? '+' : ''}{fmtBRL(desvio)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-500">{e.duracao_seg != null ? fmtTempo(e.duracao_seg) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-gray-400 leading-relaxed">
        Troque <b>Dia / Semana / Mês</b> e escolha o período no seletor. O <b>resumo de cima</b> consolida o período; a <b>lista</b> mostra as produções dele.
        A <b>Nota</b> é o % de produções com rendimento real dentro de <b>±5%</b> do esperado da ficha.
        Clique numa produção pra abrir o detalhe (planejado × realizado dos insumos).
      </p>

      {/* #10 — abrir a produção (só leitura): planejado × realizado dos insumos (#9) */}
      <DetalheExecucaoModal execucao={detalhe} barId={barId} onClose={() => setDetalhe(null)} />
    </div>
  );
}
