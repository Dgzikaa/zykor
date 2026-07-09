'use client';

/** Card "Satisfação / NPS" (silver.nps_diario / Falae) + benchmark de concorrentes (manual). */

import { useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, Check, X } from 'lucide-react';
import { api } from '@/lib/api-client';
import { ChartCard, GraficoLinha } from '@/components/graficos/Charts';
import type { PeriodoValor } from '@/lib/receitas/periodo';

interface Ponto {
  key: string;
  label: string;
  respostas: number;
  nps: number | null;
}
interface Bench {
  id?: number;
  nome: string;
  nps: number;
}

export function CardNPS({ barId, periodo }: { barId?: number; periodo: PeriodoValor }) {
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [npsPeriodo, setNpsPeriodo] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!barId) return;
    setLoading(true);
    api
      .get(`/api/receitas/nps?bar_id=${barId}&granularidade=${periodo.granularidade}&inicio=${periodo.inicio}&fim=${periodo.fim}`)
      .then((r: any) => {
        if (r?.success) {
          setPontos(r.pontos ?? []);
          setNpsPeriodo(r.nps_periodo ?? null);
        } else {
          setPontos([]);
          setNpsPeriodo(null);
        }
      })
      .catch(() => {
        setPontos([]);
        setNpsPeriodo(null);
      })
      .finally(() => setLoading(false));
  }, [barId, periodo.granularidade, periodo.inicio, periodo.fim]);

  const comNps = pontos.filter((p) => p.nps != null);
  const right = npsPeriodo != null ? <span className="text-sm font-semibold text-[hsl(var(--foreground))]">NPS {npsPeriodo}</span> : undefined;

  return (
    <ChartCard titulo="Satisfação / NPS" subtitulo="NPS por período (Falae) + benchmark" right={right}>
      {loading ? (
        <div className="flex h-[240px] items-center justify-center text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : comNps.length === 0 ? (
        <div className="flex h-[240px] items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">Sem respostas de NPS no período.</div>
      ) : (
        <GraficoLinha
          data={comNps}
          xKey="label"
          series={[{ key: 'nps', nome: 'NPS', cor: '#8b5cf6' }]}
          formatV={(v) => String(Math.round(v))}
          height={240}
          rotacaoX={comNps.length > 8 ? 30 : 0}
        />
      )}
      <BenchmarkNPS />
    </ChartCard>
  );
}

function BenchmarkNPS() {
  const [itens, setItens] = useState<Bench[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<Bench[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api
      .get('/api/receitas/nps-benchmark')
      .then((r: any) => setItens(r?.success ? (r.itens ?? []) : []))
      .catch(() => setItens([]))
      .finally(() => setLoaded(true));
  }, []);

  const abrir = () => {
    setDraft(itens.map((i) => ({ nome: i.nome, nps: i.nps })));
    setEdit(true);
  };
  const salvar = async () => {
    setSalvando(true);
    try {
      const r: any = await api.put('/api/receitas/nps-benchmark', { itens: draft });
      if (r?.success) {
        setItens(r.itens ?? []);
        setEdit(false);
      }
    } catch {
      /* mantém edição aberta em erro */
    } finally {
      setSalvando(false);
    }
  };

  if (!loaded) return null;

  return (
    <div className="mt-3 border-t border-[hsl(var(--border))] pt-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Benchmark do segmento</span>
        {!edit ? (
          <button type="button" onClick={abrir} className="text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]" title="Editar benchmark">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setDraft((d) => [...d, { nome: '', nps: 0 }])} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" title="Adicionar">
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={salvar} disabled={salvando} className="text-emerald-600 hover:text-emerald-700" title="Salvar">
              {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </button>
            <button type="button" onClick={() => setEdit(false)} className="text-rose-600 hover:text-rose-700" title="Cancelar">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {!edit ? (
        <div className="flex flex-wrap gap-2">
          {itens.length === 0 && <span className="text-xs text-[hsl(var(--muted-foreground))]">Sem benchmark cadastrado.</span>}
          {itens.map((i, idx) => (
            <span key={idx} className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--muted)/0.5)] px-2.5 py-1 text-xs">
              <span className="text-[hsl(var(--muted-foreground))]">{i.nome}</span>
              <span className="font-semibold text-[hsl(var(--foreground))]">{i.nps}</span>
            </span>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {draft.map((d, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                value={d.nome}
                onChange={(e) => setDraft((a) => a.map((x, i) => (i === idx ? { ...x, nome: e.target.value } : x)))}
                placeholder="Concorrente"
                className="h-7 flex-1 rounded-md border border-[hsl(var(--border))] bg-transparent px-2 text-xs text-[hsl(var(--foreground))]"
              />
              <input
                type="number"
                value={d.nps}
                onChange={(e) => setDraft((a) => a.map((x, i) => (i === idx ? { ...x, nps: Number(e.target.value) } : x)))}
                className="h-7 w-16 rounded-md border border-[hsl(var(--border))] bg-transparent px-2 text-xs text-[hsl(var(--foreground))]"
              />
              <button type="button" onClick={() => setDraft((a) => a.filter((_, i) => i !== idx))} className="text-rose-600 hover:text-rose-700">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {draft.length === 0 && <span className="text-xs text-[hsl(var(--muted-foreground))]">Adicione concorrentes com o +.</span>}
        </div>
      )}
    </div>
  );
}
