'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useBar } from '@/contexts/BarContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { ClipboardList, Search, Loader2, Check, ChevronLeft, Save } from 'lucide-react';

type Area = { nome: string; itens: number };
type Item = { insumo_id: number; codigo: string; nome: string; categoria: string | null; unidade_medida: string | null; custo_unitario: number | null; ultimo_final: number | null; contado: number | null };

const hoje = () => new Date().toISOString().slice(0, 10);
const num = (v: string) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));

export default function ContagemPage() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const [areas, setAreas] = useState<Area[]>([]);
  const [area, setArea] = useState<string | null>(null);
  const [data, setData] = useState(hoje());
  const [itens, setItens] = useState<Item[]>([]);
  const [valores, setValores] = useState<Record<number, string>>({});
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const carregarAreas = useCallback(async () => {
    if (!selectedBar?.id) return;
    const res = await api.get('/api/operacional/contagem');
    setAreas(res.areas || []);
  }, [selectedBar?.id]);
  useEffect(() => { carregarAreas(); }, [carregarAreas]);

  const abrirArea = async (a: string) => {
    setArea(a); setLoading(true); setBusca('');
    try {
      const res = await api.get(`/api/operacional/contagem?area=${encodeURIComponent(a)}&data=${data}`);
      const its: Item[] = res.itens || [];
      setItens(its);
      const v: Record<number, string> = {};
      its.forEach(i => { if (i.contado != null) v[i.insumo_id] = String(i.contado); });
      setValores(v);
    } finally { setLoading(false); }
  };

  const salvar = async () => {
    const payload = Object.entries(valores)
      .filter(([, v]) => v !== '' && v != null)
      .map(([id, v]) => ({ insumo_id: Number(id), estoque_final: num(v) }));
    if (!payload.length) return showToast({ type: 'error', title: 'Conte ao menos 1 item' });
    setSaving(true);
    try {
      const res = await api.post('/api/operacional/contagem', { area, data, itens: payload });
      showToast({ type: 'success', title: `Contagem salva`, message: `${res.salvos} item(ns) — área ${area}.` });
      carregarAreas();
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao salvar', message: e?.message }); }
    finally { setSaving(false); }
  };

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const arr = q ? itens.filter(i => i.nome.toLowerCase().includes(q)) : itens;
    const grupos: Record<string, Item[]> = {};
    arr.forEach(i => { const c = i.categoria || 'Sem categoria'; (grupos[c] ||= []).push(i); });
    return Object.entries(grupos);
  }, [itens, busca]);

  const contados = useMemo(() => Object.values(valores).filter(v => v !== '' && v != null).length, [valores]);

  // ---- Seleção de área ----
  if (!area) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto px-3 py-5 max-w-2xl">
          <div className="flex items-center gap-2 mb-1"><ClipboardList className="w-5 h-5" /><h1 className="text-xl font-bold">Contagem de Estoque</h1></div>
          <p className="text-sm text-muted-foreground mb-4">Escolha a área e conte pelo celular. Sem planilha.</p>
          <div className="mb-4">
            <label className="text-xs text-muted-foreground block mb-1">Data da contagem</label>
            <Input type="date" value={data} onChange={e => setData(e.target.value)} className="w-44" />
          </div>
          {areas.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhuma área com itens cadastrados (defina o <b>local</b> dos insumos).</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {areas.map(a => (
                <button key={a.nome} onClick={() => abrirArea(a.nome)}
                  className="text-left rounded-lg border p-4 hover:bg-muted/40 transition active:scale-[0.99]">
                  <div className="font-semibold capitalize">{a.nome}</div>
                  <div className="text-xs text-muted-foreground">{a.itens} itens</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </ProtectedRoute>
    );
  }

  // ---- Contagem da área ----
  return (
    <ProtectedRoute>
      <div className="container mx-auto px-3 py-4 max-w-2xl pb-24">
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="sm" className="px-2" onClick={() => setArea(null)}><ChevronLeft className="w-4 h-4" /></Button>
          <h1 className="text-lg font-bold capitalize flex-1">{area}</h1>
          <span className="text-xs text-muted-foreground">{contados}/{itens.length}</span>
        </div>
        <div className="h-1.5 rounded bg-muted mb-3 overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${itens.length ? (contados / itens.length) * 100 : 0}%` }} />
        </div>

        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar item…" className="pl-8" />
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        ) : (
          <div className="space-y-4">
            {filtrados.map(([cat, lista]) => (
              <div key={cat}>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 sticky top-0 bg-background/95 py-1">{cat}</div>
                <div className="space-y-1.5">
                  {lista.map(i => {
                    const v = valores[i.insumo_id] ?? '';
                    return (
                      <div key={i.insumo_id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate flex items-center gap-1">{v !== '' && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}{i.nome}</div>
                          <div className="text-[11px] text-muted-foreground">{i.unidade_medida || 'un'} · últ: {i.ultimo_final ?? '—'}</div>
                        </div>
                        <Input value={v} onChange={e => setValores(p => ({ ...p, [i.insumo_id]: e.target.value }))}
                          inputMode="decimal" placeholder="0" className="w-20 text-center text-base h-11" />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {filtrados.length === 0 && <div className="py-8 text-center text-muted-foreground text-sm">Nenhum item.</div>}
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur px-3 py-2.5">
          <div className="container mx-auto max-w-2xl">
            <Button onClick={salvar} disabled={saving} className="w-full h-11">
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando…</> : <><Save className="w-4 h-4 mr-2" />Salvar contagem ({contados})</>}
            </Button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
