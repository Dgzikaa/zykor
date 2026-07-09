'use client';

/**
 * Análise de Detratores/Promotores (Bloco 3).
 * Compara o faturamento médio por dia da semana do mês de referência em 3 janelas
 * (YoY, mês anterior, trimestre anterior) e gera um RASCUNHO de análise por IA
 * (Problemas / Oportunidades / Reflexões) que o sócio edita antes de usar.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { PageShell } from '@/components/layout/PageShell';

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
  const [comp, setComp] = useState<{ dias: DiaCmp[]; labels: any } | null>(null);
  const [loadingComp, setLoadingComp] = useState(true);
  const [contexto, setContexto] = useState('');
  const [narrativa, setNarrativa] = useState<Narrativa | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erroIA, setErroIA] = useState<string | null>(null);

  useEffect(() => {
    setPageTitle('🔎 Análise de Receita');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const barId = selectedBar?.id;

  useEffect(() => {
    if (!barId) return;
    setLoadingComp(true);
    setNarrativa(null);
    api
      .get(`/api/receitas/analise-dia-semana?bar_id=${barId}&mes=${mes}`)
      .then((r: any) => setComp(r?.success ? { dias: r.dias ?? [], labels: r.labels ?? {} } : null))
      .catch(() => setComp(null))
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
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <h2 className="mb-3 text-sm font-semibold text-[hsl(var(--foreground))]">
              Faturamento médio por dia da semana — {comp?.labels?.atual ?? mes}
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
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Rascunho gerado por IA — revise e edite antes de usar na apresentação.</p>
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
