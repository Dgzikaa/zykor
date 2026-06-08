'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { Target, Save, Loader2, AlertCircle } from 'lucide-react';

interface MetaItem { id: string; categoria: string; campo: string; nome: string; tipo: 'number' | 'text'; valor: number | string }
interface Grupo { categoria: string; label: string; itens: MetaItem[] }

export default function MetasPage() {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [barNome, setBarNome] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  // edições pendentes: id -> valor (string do input)
  const [edits, setEdits] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    setLoading(true);
    setEdits({});
    try {
      const res = await api.get('/api/configuracoes/metas');
      setGrupos(res.grupos || []);
      setBarNome(res.bar_nome || null);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar metas', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Recarrega ao trocar o bar selecionado (o api-client envia x-selected-bar-id).
  useEffect(() => { carregar(); }, [carregar, selectedBar?.id]);

  const tipoPorId = useMemo(() => {
    const m: Record<string, 'number' | 'text'> = {};
    grupos.forEach(g => g.itens.forEach(i => { m[i.id] = i.tipo; }));
    return m;
  }, [grupos]);

  const valorExibido = (item: MetaItem) =>
    edits[item.id] !== undefined ? edits[item.id] : String(item.valor ?? '');

  const totalEdits = Object.keys(edits).length;

  const salvar = async () => {
    if (totalEdits === 0) return;
    setSalvando(true);
    try {
      const metas = Object.entries(edits).map(([id, valor]) => ({ id, valor, tipo: tipoPorId[id] }));
      await api.put('/api/configuracoes/metas', { metas });
      toast({ title: 'Metas salvas', description: `${totalEdits} valor(es) atualizado(s).` });
      await carregar();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="container mx-auto px-3 py-5 max-w-4xl">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h1 className="text-xl font-bold flex items-center gap-2"><Target className="w-5 h-5" /> Metas</h1>
        {totalEdits > 0 && (
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar {totalEdits} alteração{totalEdits > 1 ? 'ões' : ''}
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Metas de <strong>{barNome || selectedBar?.nome || 'bar selecionado'}</strong>.
        Para editar outro bar, troque no seletor no topo.
      </p>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
      ) : grupos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
            Este bar ainda não tem metas configuradas.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grupos.map(g => (
            <Card key={g.categoria}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  {g.label}
                  <Badge variant="secondary">{g.itens.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {g.itens.map(item => {
                    const alterado = edits[item.id] !== undefined;
                    return (
                      <div key={item.id}>
                        <Label className="text-xs flex items-center gap-1">
                          {item.nome}
                          {alterado && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="alterado" />}
                        </Label>
                        <Input
                          inputMode={item.tipo === 'number' ? 'decimal' : 'text'}
                          value={valorExibido(item)}
                          onChange={(e) => setEdits(prev => ({ ...prev, [item.id]: e.target.value }))}
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
