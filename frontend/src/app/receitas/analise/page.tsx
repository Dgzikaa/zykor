'use client';

/**
 * Análise de Detratores/Promotores (Bloco 3).
 * Compara o faturamento médio por dia da semana do mês de referência em 3 janelas
 * (YoY, mês anterior, trimestre anterior) e gera um RASCUNHO de análise por IA
 * (Problemas / Oportunidades / Reflexões) que o sócio edita antes de usar.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Sparkles, Save, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { PageShell } from '@/components/layout/PageShell';
import { MatrizFaturamentoDiaSemana } from '@/components/receitas/MatrizFaturamentoDiaSemana';

const money0 = (v: number | null) => (v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));

interface DiaCmp {
  dia: string;
  atual: number | null;
  delta_yoy: number | null;
  delta_mom: number | null;
  delta_tri: number | null;
  classe_yoy: string | null;
  classe_mom: string | null;
  classe_tri: string | null;
}
interface CardIA { titulo: string; texto: string }
interface Narrativa { problemas: CardIA[]; oportunidades: CardIA[]; reflexoes: CardIA[] }

function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function Delta({ v, classe }: { v: number | null; classe: string | null }) {
  if (v == null) return <span className="text-[hsl(var(--muted-foreground))]">—</span>;
  const cor = classe === 'promotor' ? 'text-emerald-600 dark:text-emerald-400' : classe === 'detrator' ? 'text-rose-600 dark:text-rose-400' : 'text-[hsl(var(--muted-foreground))]';
  const Icon = classe === 'promotor' ? TrendingUp : classe === 'detrator' ? TrendingDown : Minus;
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${cor}`}>
      <Icon className="h-3.5 w-3.5" />
      {v > 0 ? '+' : ''}{v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
    </span>
  );
}

export default function AnaliseReceitasPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const [mes, setMes] = useState<string>(mesAtual());
  const [janela, setJanela] = useState<number>(6); // quantos meses a matriz mostra (termina no mês de referência)
  const [comp, setComp] = useState<{ dias: DiaCmp[]; labels: any } | null>(null);
  const [loadingComp, setLoadingComp] = useState(true);
  const [contexto, setContexto] = useState('');
  const [narrativa, setNarrativa] = useState<Narrativa | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erroIA, setErroIA] = useState<string | null>(null);
  const [salvandoAnalise, setSalvandoAnalise] = useState(false);
  const [salvoEm, setSalvoEm] = useState<string | null>(null);

  useEffect(() => {
    setPageTitle('🔎 Análise de Receita');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const barId = selectedBar?.id;

  // janela da matriz: `janela` meses terminando no mês de referência
  const { inicio, fim } = useMemo(() => {
    const [ano, m] = mes.split('-').map(Number);
    const ini = new Date(Date.UTC(ano, (m - 1) - (janela - 1), 1));
    const fimD = new Date(Date.UTC(ano, m, 0)); // último dia do mês de referência
    return { inicio: ini.toISOString().slice(0, 10), fim: fimD.toISOString().slice(0, 10) };
  }, [mes, janela]);

  useEffect(() => {
    if (!barId) return;
    setLoadingComp(true);
    setSalvoEm(null);
    Promise.all([
      api.get(`/api/receitas/analise-dia-semana?bar_id=${barId}&mes=${mes}`).catch(() => null),
      api.get(`/api/receitas/analise-salvar?bar_id=${barId}&mes=${mes}`).catch(() => null),
    ])
      .then(([cmp, sav]: any[]) => {
        setComp(cmp?.success ? { dias: cmp.dias ?? [], labels: cmp.labels ?? {} } : null);
        if (sav?.success && sav.analise) {
          setContexto(sav.analise.contexto ?? '');
          setNarrativa({ problemas: sav.analise.problemas ?? [], oportunidades: sav.analise.oportunidades ?? [], reflexoes: sav.analise.reflexoes ?? [] });
        } else {
          setContexto('');
          setNarrativa(null);
        }
      })
      .finally(() => setLoadingComp(false));
  }, [barId, mes]);

  const gerar = useCallback(async () => {
    if (!comp?.dias?.length) return;
    setGerando(true);
    setErroIA(null);
    try {
      const r: any = await api.post('/api/receitas/analise-narrativa', {
        mes,
        labels: comp.labels,
        dias: comp.dias,
        contexto,
      });
      if (r?.success) {
        setNarrativa({ problemas: r.problemas ?? [], oportunidades: r.oportunidades ?? [], reflexoes: r.reflexoes ?? [] });
      } else {
        setErroIA(r?.error || 'Não foi possível gerar a análise.');
      }
    } catch (e: any) {
      setErroIA(e?.message || 'Erro ao gerar a análise.');
    } finally {
      setGerando(false);
    }
  }, [comp, mes, contexto]);

  const salvarAnalise = useCallback(async () => {
    if (!barId) return;
    setSalvandoAnalise(true);
    try {
      await api.put('/api/receitas/analise-salvar', {
        bar_id: barId,
        mes,
        contexto,
        problemas: narrativa?.problemas ?? [],
        oportunidades: narrativa?.oportunidades ?? [],
        reflexoes: narrativa?.reflexoes ?? [],
      });
      setSalvoEm(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      /* silencioso — mantém em tela */
    } finally {
      setSalvandoAnalise(false);
    }
  }, [barId, mes, contexto, narrativa]);

  const editar = (grupo: keyof Narrativa, i: number, campo: keyof CardIA, valor: string) => {
    setNarrativa((n) => {
      if (!n) return n;
      const copia = { ...n, [grupo]: n[grupo].map((c, idx) => (idx === i ? { ...c, [campo]: valor } : c)) };
      return copia;
    });
  };

  return (
    <PageShell width="wide">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Detratores e promotores de receita por dia da semana — {selectedBar?.nome ?? 'bar'}.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-[hsl(var(--muted-foreground))]">Mês de referência</span>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="h-9 rounded-md border border-[hsl(var(--border))] bg-transparent px-2 text-sm text-[hsl(var(--foreground))]"
          />
        </label>
      </div>

      {!barId ? (
        <div className="flex h-64 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">Selecione um bar.</div>
      ) : (
        <>
          {/* MATRIZ mês a mês — médias lado a lado + variação (tela cheia, legível) */}
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Faturamento médio por dia da semana — mês a mês</h2>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Média por ocorrência de cada dia, com a variação vs o mês anterior. Verde mais forte = dia/mês melhor.</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                Janela
                <select value={janela} onChange={(e) => setJanela(Number(e.target.value))}
                  className="h-8 rounded-md border border-[hsl(var(--border))] bg-transparent px-2 text-sm text-[hsl(var(--foreground))]">
                  <option value={3}>3 meses</option>
                  <option value={6}>6 meses</option>
                  <option value={12}>12 meses</option>
                </select>
              </label>
            </div>
            <MatrizFaturamentoDiaSemana barId={barId} inicio={inicio} fim={fim} />
          </div>

          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <h2 className="mb-3 text-sm font-semibold text-[hsl(var(--foreground))]">
              Faturamento médio por dia da semana — {comp?.labels?.atual ?? mes} (vs janelas)
            </h2>
            {loadingComp ? (
              <div className="flex h-40 items-center justify-center text-[hsl(var(--muted-foreground))]"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : !comp?.dias?.length ? (
              <div className="flex h-40 items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">Sem dados para o mês.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                      <th className="py-2 pr-4">Dia</th>
                      <th className="py-2 pr-4">Atual</th>
                      <th className="py-2 pr-4">vs {comp.labels?.yoy ?? 'ano ant.'}</th>
                      <th className="py-2 pr-4">vs {comp.labels?.mom ?? 'mês ant.'}</th>
                      <th className="py-2 pr-4">vs trimestre</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comp.dias.map((d) => (
                      <tr key={d.dia} className="border-t border-[hsl(var(--border))]">
                        <td className="py-2 pr-4 font-medium text-[hsl(var(--foreground))]">{d.dia}</td>
                        <td className="py-2 pr-4 text-[hsl(var(--foreground))]">{money0(d.atual)}</td>
                        <td className="py-2 pr-4"><Delta v={d.delta_yoy} classe={d.classe_yoy} /></td>
                        <td className="py-2 pr-4"><Delta v={d.delta_mom} classe={d.classe_mom} /></td>
                        <td className="py-2 pr-4"><Delta v={d.delta_tri} classe={d.classe_tri} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Contexto do período</h2>
            <p className="mb-2 mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
              O que mudou na operação (programação, happy hour, temática, eventos). Ajuda a IA a explicar as causas em vez de só descrever os números.
            </p>
            <textarea
              value={contexto}
              onChange={(e) => setContexto(e.target.value)}
              rows={3}
              placeholder="Ex.: implementamos HH de dose dupla na segunda; sábado com festa até 4h; domingo com Sertanejo…"
              className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent p-2 text-sm text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={gerar}
                disabled={gerando || !comp?.dias?.length}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 text-sm font-medium text-[hsl(var(--primary-foreground))] shadow-sm transition-colors hover:bg-[hsl(var(--primary)/0.9)] disabled:opacity-50"
              >
                {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Gerar rascunho com IA
              </button>
              {erroIA && <span className="text-sm text-rose-600 dark:text-rose-400">{erroIA}</span>}
            </div>
          </div>

          {narrativa && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Rascunho — revise e edite antes de usar. Salve para manter (por bar e mês).</p>
                <div className="flex items-center gap-2">
                  {salvoEm && <span className="text-xs text-emerald-600 dark:text-emerald-400">Salvo às {salvoEm}</span>}
                  <button
                    type="button"
                    onClick={salvarAnalise}
                    disabled={salvandoAnalise}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-3 text-xs font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))] disabled:opacity-50"
                  >
                    {salvandoAnalise ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Salvar análise
                  </button>
                </div>
              </div>
              {(['problemas', 'oportunidades', 'reflexoes'] as const).map((grupo) => (
                <div key={grupo}>
                  <h3 className="mb-2 text-sm font-semibold capitalize text-[hsl(var(--foreground))]">
                    {grupo === 'problemas' ? 'Problemas' : grupo === 'oportunidades' ? 'Oportunidades' : 'Reflexões'}
                  </h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {narrativa[grupo].map((c, i) => (
                      <div key={i} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
                        <input
                          value={c.titulo}
                          onChange={(e) => editar(grupo, i, 'titulo', e.target.value)}
                          className="mb-1 w-full bg-transparent text-sm font-semibold text-[hsl(var(--foreground))] focus-visible:outline-none"
                        />
                        <textarea
                          value={c.texto}
                          onChange={(e) => editar(grupo, i, 'texto', e.target.value)}
                          rows={3}
                          className="w-full resize-none bg-transparent text-sm text-[hsl(var(--muted-foreground))] focus-visible:outline-none"
                        />
                      </div>
                    ))}
                    {!narrativa[grupo].length && <p className="text-sm text-[hsl(var(--muted-foreground))]">—</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
