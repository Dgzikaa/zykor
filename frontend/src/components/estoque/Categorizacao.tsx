'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Package, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';

type Item = {
  id: number; codigo: string; nome: string; categoria: string | null;
  tipo_local: string | null; tipo_item: string | null; frequencia: string | null;
  unidade_medida: string | null; preco_atual: number | null; tem_vmarket: boolean; ativo: boolean;
};

const FREQ = [
  { v: 'diaria', label: 'Diária' },
  { v: 'semanal', label: 'Semanal' },
  { v: 'mensal', label: 'Mensal' },
];
const LOCAL = [{ v: 'bar', label: 'Bar' }, { v: 'cozinha', label: 'Cozinha' }];
const TIPO = [
  { v: 'insumo', label: 'Insumo' },
  { v: 'producao_cozinha', label: 'Produção cozinha' },
  { v: 'producao_drink', label: 'Produção drink' },
];
const TIPO_LABEL: Record<string, string> = Object.fromEntries(TIPO.map((t) => [t.v, t.label]));
const brl = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n));

function Select({ value, options, onChange, placeholder }: {
  value: string | null; options: { v: string; label: string }[]; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className={`h-8 rounded-md border bg-background px-2 text-sm ${value ? '' : 'text-amber-600 border-amber-300'}`}
    >
      <option value="" disabled>{placeholder}</option>
      {options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
    </select>
  );
}

export function Categorizacao() {
  const { selectedBar } = useBar();
  const [itens, setItens] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [fTipo, setFTipo] = useState<string>('');
  const [fFreq, setFFreq] = useState<string>('');

  const fetchCatalogo = useCallback(async () => {
    if (!selectedBar?.id) return;
    setLoading(true);
    try {
      const res = await api.get('/api/operacional/contagem/categorizacao');
      setItens(res.itens || []);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao buscar catálogo');
      setItens([]);
    } finally { setLoading(false); }
  }, [selectedBar?.id]);
  useEffect(() => { fetchCatalogo(); }, [fetchCatalogo]);

  const salvar = async (id: number, campo: 'frequencia' | 'tipo_local' | 'tipo_item', valor: string) => {
    const antes = itens;
    setItens((prev) => prev.map((i) => (i.id === id ? { ...i, [campo]: valor } : i)));
    try {
      await api.patch('/api/operacional/contagem/categorizacao', { id, [campo]: valor });
    } catch (e: any) {
      setItens(antes);
      toast.error(e?.message || 'Erro ao salvar');
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return itens.filter((i) =>
      (!fTipo || i.tipo_item === fTipo) &&
      (!fFreq || i.frequencia === fFreq) &&
      (!q || i.nome.toLowerCase().includes(q) || (i.codigo || '').toLowerCase().includes(q) || (i.categoria || '').toLowerCase().includes(q)),
    );
  }, [itens, search, fTipo, fFreq]);

  const grupos = useMemo(() => {
    const g: Record<string, Item[]> = {};
    for (const i of filtered) { const k = i.tipo_item || 'insumo'; (g[k] ||= []).push(i); }
    return ['insumo', 'producao_cozinha', 'producao_drink'].filter((k) => g[k]?.length).map((k) => [k, g[k]] as const);
  }, [filtered]);

  const semFreq = useMemo(() => itens.filter((i) => !i.frequencia).length, [itens]);

  if (!selectedBar?.id) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">Selecione um bar.</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Itens no catálogo</CardDescription><CardTitle className="text-3xl">{itens.length}</CardTitle></CardHeader></Card>
        <Card onClick={() => setFFreq((v) => (v ? '' : 'mensal'))} className="cursor-pointer hover:bg-muted/30">
          <CardHeader className="pb-2"><CardDescription>Sem frequência definida</CardDescription><CardTitle className="text-3xl text-amber-600">{semFreq}</CardTitle></CardHeader>
        </Card>
        <Card><CardHeader className="pb-2"><CardDescription>Com preço do VMarket</CardDescription><CardTitle className="text-3xl text-emerald-600">{itens.filter((i) => i.tem_vmarket).length}</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><Tag className="h-5 w-5" /><CardTitle>Categorização — {selectedBar.nome}</CardTitle></div>
          <CardDescription className="mt-1">
            Defina onde cada item entra na contagem (frequência), o local e o tipo. O preço vem do VMarket (catálogo de compras); preparos usam o custo da ficha.
          </CardDescription>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <div className="relative w-full md:w-72">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por nome, código ou categoria" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
              <option value="">Todos os tipos</option>
              {TIPO.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select>
            <select value={fFreq} onChange={(e) => setFFreq(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
              <option value="">Todas frequências</option>
              {FREQ.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">Nenhum item para este filtro.</div>
          ) : (
            <div className="space-y-6">
              {grupos.map(([tipo, lista]) => (
                <div key={tipo}>
                  <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
                    <Package className="h-4 w-4 text-muted-foreground" />{TIPO_LABEL[tipo]} <span className="text-muted-foreground font-normal">({lista.length})</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left border-b text-muted-foreground">
                        <tr>
                          <th className="py-2 px-2 font-medium">Código</th>
                          <th className="py-2 px-2 font-medium">Nome</th>
                          <th className="py-2 px-2 font-medium">Frequência</th>
                          <th className="py-2 px-2 font-medium">Local</th>
                          <th className="py-2 px-2 font-medium">Tipo</th>
                          <th className="py-2 px-2 font-medium text-right">Preço atual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lista.map((i) => (
                          <tr key={i.id} className="border-b hover:bg-muted/30">
                            <td className="py-1.5 px-2 font-mono text-xs text-muted-foreground">{i.codigo}</td>
                            <td className="py-1.5 px-2">{i.nome}</td>
                            <td className="py-1.5 px-2"><Select value={i.frequencia} options={FREQ} placeholder="definir" onChange={(v) => salvar(i.id, 'frequencia', v)} /></td>
                            <td className="py-1.5 px-2"><Select value={i.tipo_local} options={LOCAL} placeholder="definir" onChange={(v) => salvar(i.id, 'tipo_local', v)} /></td>
                            <td className="py-1.5 px-2"><Select value={i.tipo_item} options={TIPO} placeholder="definir" onChange={(v) => salvar(i.id, 'tipo_item', v)} /></td>
                            <td className="py-1.5 px-2 text-right tabular-nums">
                              {brl(i.preco_atual)}
                              {i.tem_vmarket
                                ? <Badge variant="outline" className="ml-1.5 text-emerald-700 border-emerald-300">VMarket</Badge>
                                : <Badge variant="outline" className="ml-1.5 text-muted-foreground">ficha</Badge>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
