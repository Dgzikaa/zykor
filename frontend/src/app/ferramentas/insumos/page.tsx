'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Save, X, AlertCircle, Package } from 'lucide-react';
import { toast } from 'sonner';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';

type Insumo = {
  id: number;
  bar_id: number;
  codigo: string;
  nome: string;
  categoria: string | null;
  tipo_local: string | null;
  unidade_medida: string;
  custo_unitario: number | null;
  ativo: boolean;
  master_codigo: string | null;
  updated_at: string | null;
};

type EditingState = {
  id: number;
  field: 'custo_unitario' | 'categoria';
  value: string;
} | null;

const formatBRL = (n: number | null | undefined): string => {
  if (n == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n));
};

export default function InsumosPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();

  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<EditingState>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPageTitle('Insumos');
  }, [setPageTitle]);

  const fetchInsumos = useCallback(async () => {
    if (!selectedBar?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ferramentas/insumos?bar_id=${selectedBar.id}&apenas_ativos=true`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Falha ao buscar insumos');
      setInsumos(json.insumos || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao buscar insumos');
      setInsumos([]);
    } finally {
      setLoading(false);
    }
  }, [selectedBar?.id]);

  useEffect(() => {
    fetchInsumos();
  }, [fetchInsumos]);

  const filtered = useMemo(() => {
    if (!search.trim()) return insumos;
    const q = search.toLowerCase();
    return insumos.filter(
      (i) =>
        i.nome.toLowerCase().includes(q) ||
        (i.codigo || '').toLowerCase().includes(q) ||
        (i.categoria || '').toLowerCase().includes(q)
    );
  }, [insumos, search]);

  const stats = useMemo(() => {
    const total = insumos.length;
    const semCusto = insumos.filter((i) => i.custo_unitario == null || Number(i.custo_unitario) === 0).length;
    const semCategoria = insumos.filter(
      (i) => !i.categoria || i.categoria.toLowerCase() === 'categoria'
    ).length;
    return { total, semCusto, semCategoria };
  }, [insumos]);

  const beginEdit = (insumo: Insumo, field: 'custo_unitario' | 'categoria') => {
    const value =
      field === 'custo_unitario'
        ? insumo.custo_unitario == null
          ? ''
          : String(insumo.custo_unitario)
        : insumo.categoria ?? '';
    setEditing({ id: insumo.id, field, value });
  };

  const cancelEdit = () => setEditing(null);

  const commitEdit = async () => {
    if (!editing) return;
    const insumo = insumos.find((i) => i.id === editing.id);
    if (!insumo) return;

    const trimmed = editing.value.trim();
    let payload: { id: number; custo_unitario?: number | null; categoria?: string };

    if (editing.field === 'custo_unitario') {
      if (trimmed === '') {
        payload = { id: editing.id, custo_unitario: null };
      } else {
        const n = Number(trimmed.replace(',', '.'));
        if (!Number.isFinite(n) || n < 0) {
          toast.error('Custo inválido');
          return;
        }
        if (n === Number(insumo.custo_unitario ?? 0)) {
          cancelEdit();
          return;
        }
        payload = { id: editing.id, custo_unitario: n };
      }
    } else {
      if (trimmed.length === 0) {
        toast.error('Categoria não pode ser vazia');
        return;
      }
      if (trimmed === (insumo.categoria ?? '')) {
        cancelEdit();
        return;
      }
      payload = { id: editing.id, categoria: trimmed };
    }

    setSaving(true);
    try {
      const res = await fetch('/api/ferramentas/insumos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Falha ao salvar');

      setInsumos((prev) =>
        prev.map((i) =>
          i.id === editing.id
            ? {
                ...i,
                ...(editing.field === 'custo_unitario'
                  ? { custo_unitario: payload.custo_unitario ?? null }
                  : { categoria: payload.categoria ?? i.categoria }),
                updated_at: json.insumo?.updated_at ?? i.updated_at,
              }
            : i
        )
      );
      toast.success('Salvo');
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  if (!selectedBar?.id) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Selecione um bar para ver os insumos.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total ativos</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sem custo</CardDescription>
            <CardTitle className="text-3xl text-amber-600">
              {stats.semCusto}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Categoria pendente</CardDescription>
            <CardTitle className="text-3xl text-amber-600">
              {stats.semCategoria}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              <CardTitle>Catálogo de insumos — {selectedBar.nome}</CardTitle>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, código ou categoria"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <CardDescription className="mt-2">
            Clique no custo ou categoria para editar. Enter salva, Esc cancela.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {search ? 'Nenhum insumo encontrado para esta busca.' : 'Nenhum insumo ativo.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left border-b">
                  <tr>
                    <th className="py-2 px-2 font-medium text-muted-foreground">Código</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground">Nome</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground">Categoria</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground">Unid.</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground text-right">Custo</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((i) => {
                    const isEditingCusto = editing?.id === i.id && editing.field === 'custo_unitario';
                    const isEditingCat = editing?.id === i.id && editing.field === 'categoria';
                    const semCusto = i.custo_unitario == null || Number(i.custo_unitario) === 0;
                    const catPlaceholder =
                      !i.categoria || i.categoria.toLowerCase() === 'categoria';

                    return (
                      <tr key={i.id} className="border-b hover:bg-muted/30">
                        <td className="py-2 px-2 font-mono text-xs text-muted-foreground">
                          {i.codigo}
                        </td>
                        <td className="py-2 px-2">{i.nome}</td>
                        <td className="py-2 px-2">
                          {isEditingCat ? (
                            <div className="flex items-center gap-1">
                              <Input
                                ref={(el) => { el?.focus(); }}
                                value={editing!.value}
                                onChange={(e) => setEditing({ ...editing!, value: e.target.value })}
                                onKeyDown={onKey}
                                disabled={saving}
                                className="h-8 w-44"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={commitEdit}
                                disabled={saving}
                                title="Salvar (Enter)"
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelEdit}
                                disabled={saving}
                                title="Cancelar (Esc)"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => beginEdit(i, 'categoria')}
                              className="text-left hover:underline"
                            >
                              {catPlaceholder ? (
                                <Badge variant="outline" className="text-amber-700 border-amber-300">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  preencher
                                </Badge>
                              ) : (
                                i.categoria
                              )}
                            </button>
                          )}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground">{i.unidade_medida}</td>
                        <td className="py-2 px-2 text-right">
                          {isEditingCusto ? (
                            <div className="flex items-center justify-end gap-1">
                              <Input
                                ref={(el) => { el?.focus(); }}
                                type="text"
                                inputMode="decimal"
                                value={editing!.value}
                                onChange={(e) => setEditing({ ...editing!, value: e.target.value })}
                                onKeyDown={onKey}
                                disabled={saving}
                                className="h-8 w-28 text-right"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={commitEdit}
                                disabled={saving}
                                title="Salvar (Enter)"
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelEdit}
                                disabled={saving}
                                title="Cancelar (Esc)"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => beginEdit(i, 'custo_unitario')}
                              className="hover:underline tabular-nums"
                            >
                              {semCusto ? (
                                <Badge variant="outline" className="text-amber-700 border-amber-300">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  preencher
                                </Badge>
                              ) : (
                                formatBRL(Number(i.custo_unitario))
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
