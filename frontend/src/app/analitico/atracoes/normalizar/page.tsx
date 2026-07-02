'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useBar } from '@/contexts/BarContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Users, ArrowRight, Loader2, Check } from 'lucide-react';

interface Par {
  id_a: number; nome_a: string; uso_a: number;
  id_b: number; nome_b: string; uso_b: number;
  sim: number;
}
interface Artista { id: number; nome: string; tipo?: string; uso?: number; }

export default function NormalizarArtistasPage() {
  const { selectedBar } = useBar();
  const barId = selectedBar?.id;
  const [loading, setLoading] = useState(true);
  const [pares, setPares] = useState<Par[]>([]);
  const [artistas, setArtistas] = useState<Artista[]>([]);
  const [busy, setBusy] = useState<string | null>(null); // chave do par em processamento

  const carregar = useCallback(async () => {
    if (!barId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/eventos/artistas/duplicados', { headers: { 'x-selected-bar-id': String(barId) } });
      const j = await res.json();
      if (j.success) { setPares(j.pares || []); setArtistas(j.artistas || []); }
    } finally {
      setLoading(false);
    }
  }, [barId]);

  useEffect(() => { carregar(); }, [carregar]);

  const chave = (p: Par) => `${p.id_a}-${p.id_b}`;

  // mescla p_from -> p_into (o "into" é o nome que fica)
  const mesclar = async (p: Par, intoId: number) => {
    if (!barId) return;
    const fromId = intoId === p.id_a ? p.id_b : p.id_a;
    const fica = intoId === p.id_a ? p.nome_a : p.nome_b;
    const some = intoId === p.id_a ? p.nome_b : p.nome_a;
    if (!confirm(`Unificar "${some}" em "${fica}"?\n\nTodo o histórico, cachês e tags de "${some}" passam pra "${fica}", e "${some}" é desativado.`)) return;
    setBusy(chave(p));
    try {
      await fetch('/api/eventos/artistas/duplicados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-selected-bar-id': String(barId) },
        body: JSON.stringify({ action: 'merge', from_id: fromId, into_id: intoId }),
      });
      await carregar();
    } finally {
      setBusy(null);
    }
  };

  // agrupa vários artistas num só (o "into" é o que fica) — casos que o algoritmo não detecta
  const agrupar = async (fromIds: number[], intoId: number) => {
    if (!barId || !fromIds.length || !intoId) return;
    const intoN = artistas.find((a) => a.id === intoId)?.nome || '';
    const fromN = fromIds.map((id) => artistas.find((a) => a.id === id)?.nome).filter(Boolean);
    if (!confirm(`Agrupar ${fromN.length} artista(s) em "${intoN}"?\n\n${fromN.join(', ')}\n\nTudo (histórico, cachês, tags) migra pra "${intoN}" e os outros são desativados.`)) return;
    setBusy('agrupar');
    try {
      for (const fromId of fromIds) {
        await fetch('/api/eventos/artistas/duplicados', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-selected-bar-id': String(barId) },
          body: JSON.stringify({ action: 'merge', from_id: fromId, into_id: intoId }),
        });
      }
      await carregar();
    } finally {
      setBusy(null);
    }
  };

  const ignorar = async (p: Par) => {
    if (!barId) return;
    setBusy(chave(p));
    try {
      await fetch('/api/eventos/artistas/duplicados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-selected-bar-id': String(barId) },
        body: JSON.stringify({ action: 'ignorar', id_a: p.id_a, id_b: p.id_b }),
      });
      await carregar();
    } finally {
      setBusy(null);
    }
  };

  if (!barId) return <div className="p-6 text-gray-500">Selecione um bar.</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="mb-6">
          <Link href="/analitico/atracoes/tagging" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-2">
            <ArrowLeft className="w-4 h-4" /> Voltar para tagging
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6" /> Normalizar Artistas
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {selectedBar?.nome} · pares parecidos que podem ser o mesmo artista. Clique no nome que deve <b>ficar</b> —
            o outro é unificado nele (histórico, cachês e tags migram junto).
          </p>
        </div>

        {/* lista completa — marque os que são o mesmo artista e agrupe (resolve os casos que o algoritmo não pega) */}
        <TodosArtistas artistas={artistas} disabled={busy === 'agrupar'} onAgrupar={agrupar} />

        {loading ? (
          <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : pares.length === 0 ? (
          <div className="p-10 text-center text-gray-500 dark:text-gray-400">
            <Check className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
            Nenhum duplicado pendente. 🎉
          </div>
        ) : (
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-0 divide-y divide-gray-100 dark:divide-gray-700">
              {pares.map((p) => {
                const processando = busy === chave(p);
                return (
                  <div key={chave(p)} className="p-3 md:p-4 flex flex-wrap items-center gap-2">
                    <MergeBtn nome={p.nome_a} uso={p.uso_a} disabled={processando} onClick={() => mesclar(p, p.id_a)} />
                    <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" />
                    <MergeBtn nome={p.nome_b} uso={p.uso_b} disabled={processando} onClick={() => mesclar(p, p.id_b)} />
                    <span className="text-[10px] text-gray-400 ml-1">{Math.round(p.sim * 100)}% parecido</span>
                    <div className="ml-auto flex items-center gap-2">
                      {processando && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                      <button
                        onClick={() => ignorar(p)}
                        disabled={processando}
                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50"
                        title="Não são o mesmo artista — some da lista"
                      >
                        não é duplicata
                      </button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Lista completa de artistas: marca (checkbox) os que são o mesmo, escolhe qual
// nome fica e agrupa. Resolve 100% dos casos (número escrito × dígito, nome × nome
// artístico, etc.) sem depender da detecção automática.
function TodosArtistas({ artistas, disabled, onAgrupar }: {
  artistas: Artista[];
  disabled: boolean;
  onAgrupar: (fromIds: number[], intoId: number) => void;
}) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [survivor, setSurvivor] = useState<number | null>(null);
  const filtrados = artistas.filter((a) => a.nome.toLowerCase().includes(q.trim().toLowerCase()));
  const selecionados = artistas.filter((a) => sel.has(a.id));
  const surv = survivor && sel.has(survivor) ? survivor : (selecionados[0]?.id ?? null);
  const toggle = (id: number) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const limpar = () => { setSel(new Set()); setSurvivor(null); };
  return (
    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mb-4">
      <CardContent className="p-3 md:p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Todos os artistas ({artistas.length})
            <span className="ml-1 text-xs font-normal text-gray-400">— marque os iguais e agrupe</span>
          </div>
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 filtrar…"
            className="w-44 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
        </div>

        {sel.size >= 2 && (
          <div className="flex flex-wrap items-center gap-2 mb-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 px-3 py-2 text-sm">
            <span className="text-purple-700 dark:text-purple-300 font-medium">Agrupar {sel.size} em:</span>
            <select
              value={surv ?? ''} onChange={(e) => setSurvivor(Number(e.target.value))}
              className="rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-1.5 py-1 text-sm"
            >
              {selecionados.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
            <Button size="sm" disabled={disabled || !surv}
              onClick={() => { if (surv) { onAgrupar([...sel].filter((id) => id !== surv), surv); limpar(); } }}>
              {disabled ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Agrupar'}
            </Button>
            <button onClick={limpar} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">limpar</button>
          </div>
        )}

        <div className="max-h-80 overflow-y-auto -mx-1 divide-y divide-gray-50 dark:divide-gray-800">
          {filtrados.map((a) => (
            <label key={a.id} className="flex items-center gap-2 px-1 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 rounded">
              <input type="checkbox" checked={sel.has(a.id)} onChange={() => toggle(a.id)} className="accent-purple-600" />
              <span className="text-sm text-gray-800 dark:text-gray-100">{a.nome}</span>
              {a.tipo && <span className="text-[10px] uppercase text-gray-400">{a.tipo}</span>}
              <span className="ml-auto text-[10px] text-gray-400">{a.uso ?? 0} show{(a.uso ?? 0) === 1 ? '' : 's'}</span>
            </label>
          ))}
          {filtrados.length === 0 && <div className="px-1 py-3 text-xs text-gray-400">Nenhum artista com esse filtro.</div>}
        </div>
      </CardContent>
    </Card>
  );
}

// Botão de um lado do par: clicar significa "este nome fica, o outro vem pra cá".
function MergeBtn({ nome, uso, disabled, onClick }: { nome: string; uso: number; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-sm hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50"
      title={`Manter "${nome}" (unifica o outro aqui)`}
    >
      <span className="font-medium text-gray-800 dark:text-gray-100">{nome}</span>
      <span className="text-[10px] text-gray-400">{uso} show{uso === 1 ? '' : 's'}</span>
      <span className="text-[10px] text-purple-600 dark:text-purple-400 opacity-0 group-hover:opacity-100">manter</span>
    </button>
  );
}
