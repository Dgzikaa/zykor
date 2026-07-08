'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { api } from '@/lib/api-client';
import {
  Target, Save, Loader2, AlertCircle, DollarSign, Coffee, Wallet,
  TrendingUp, Star, Calendar,
} from 'lucide-react';

interface MetaItem { id: string; categoria: string; campo: string; nome: string; tipo: 'number' | 'text'; valor: number | string }
interface Grupo { categoria: string; label: string; itens: MetaItem[] }

const ESTILO: Record<string, { icon: any; cor: string }> = {
  indicadores_estrategicos: { icon: Target, cor: 'from-indigo-500 to-indigo-600' },
  indicadores_mensais: { icon: Calendar, cor: 'from-sky-500 to-sky-600' },
  cockpit_vendas: { icon: DollarSign, cor: 'from-green-500 to-green-600' },
  cockpit_produtos: { icon: Coffee, cor: 'from-purple-500 to-purple-600' },
  cockpit_financeiro: { icon: Wallet, cor: 'from-emerald-500 to-emerald-600' },
  cockpit_marketing: { icon: TrendingUp, cor: 'from-blue-500 to-blue-600' },
  indicadores_qualidade: { icon: Star, cor: 'from-amber-500 to-amber-600' },
};

export default function MetasPage() {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const { setPageTitle } = usePageTitle();
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [barNome, setBarNome] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
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

  useEffect(() => { carregar(); }, [carregar, selectedBar?.id]);

  useEffect(() => {
    setPageTitle('🎯 Metas');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const tipoPorId = useMemo(() => {
    const m: Record<string, 'number' | 'text'> = {};
    grupos.forEach(g => g.itens.forEach(i => { m[i.id] = i.tipo; }));
    return m;
  }, [grupos]);

  const totalMetricas = useMemo(() => grupos.reduce((s, g) => s + g.itens.length, 0), [grupos]);
  const totalEdits = Object.keys(edits).length;

  const valorExibido = (item: MetaItem) =>
    edits[item.id] !== undefined ? edits[item.id] : String(item.valor ?? '');

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
      {/* Header fixo com resumo + salvar sempre visível */}
      <div className="sticky top-0 z-10 -mx-3 px-3 py-3 mb-4 bg-background/85 backdrop-blur border-b border-[hsl(var(--border))]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2"><Target className="w-5 h-5" /></h1>
            <p className="text-sm text-muted-foreground">
              <strong>{barNome || selectedBar?.nome || 'bar selecionado'}</strong>
              {!loading && <> · {totalMetricas} métricas em {grupos.length} categorias</>}
              {' '}· troque o bar no seletor do topo
            </p>
          </div>
          <Button onClick={salvar} disabled={salvando || totalEdits === 0}>
            {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {totalEdits > 0 ? `Salvar ${totalEdits} alteração${totalEdits > 1 ? 'ões' : ''}` : 'Salvar'}
          </Button>
        </div>
      </div>

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
          {grupos.map(g => {
            const estilo = ESTILO[g.categoria] || { icon: Target, cor: 'from-gray-500 to-gray-600' };
            const Icone = estilo.icon;
            return (
              <Card key={g.categoria} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className={`p-1.5 rounded-md bg-gradient-to-r ${estilo.cor} text-white`}>
                        <Icone className="w-4 h-4" />
                      </span>
                      {g.label}
                    </span>
                    <Badge variant="secondary">{g.itens.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {g.itens.map(item => {
                      const alterado = edits[item.id] !== undefined;
                      return (
                        <div key={item.id}>
                          <Label className="text-xs flex items-center gap-1 mb-1">
                            {item.nome}
                            {alterado && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="alterado" />}
                          </Label>
                          <Input
                            inputMode={item.tipo === 'number' ? 'decimal' : 'text'}
                            value={valorExibido(item)}
                            className={alterado ? 'border-amber-400' : ''}
                            onChange={(e) => setEdits(prev => ({ ...prev, [item.id]: e.target.value }))}
                          />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
