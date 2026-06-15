'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, AlertTriangle, CheckCircle2, Beer, CupSoda, Utensils, Package2 } from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { toast } from 'sonner';

interface Grupo {
  grupo: string;
  categoria: string | null;
  volume: number;
  itens: number;
  pendente: boolean;
}

const CATS = [
  { key: 'BEBIDA', label: 'Bebida', icon: Beer, cls: 'bg-blue-600' },
  { key: 'DRINK', label: 'Drink', icon: CupSoda, cls: 'bg-violet-600' },
  { key: 'COMIDA', label: 'Comida', icon: Utensils, cls: 'bg-amber-600' },
  { key: 'OUTROS', label: 'Outros', icon: Package2, cls: 'bg-gray-500' },
];

function moeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export default function ClassificacaoGruposPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);

  useEffect(() => {
    setPageTitle('Classificação de Grupos (Mix)');
  }, [setPageTitle]);

  const carregar = useCallback(async () => {
    if (!selectedBar) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/grupos-classificacao?bar_id=${selectedBar.id}`);
      const j = await r.json();
      if (j.success) setGrupos(j.grupos);
      else toast.error(j.error || 'Erro ao carregar');
    } catch {
      toast.error('Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [selectedBar]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const classificar = async (grupo: string, categoria: string) => {
    if (!selectedBar) return;
    setSalvando(grupo);
    try {
      const r = await fetch('/api/grupos-classificacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bar_id: selectedBar.id, grupo, categoria }),
      });
      const j = await r.json();
      if (j.success) {
        setGrupos((prev) =>
          prev.map((g) => (g.grupo === grupo ? { ...g, categoria, pendente: false } : g))
        );
        toast.success(`${grupo} → ${categoria}`);
      } else {
        toast.error(j.error || 'Erro ao salvar');
      }
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSalvando(null);
    }
  };

  const pendentes = grupos.filter((g) => g.pendente);
  const classificados = grupos.filter((g) => !g.pendente);

  const linha = (g: Grupo) => (
    <div
      key={g.grupo}
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3"
    >
      <div className="min-w-[180px]">
        <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{g.grupo}</p>
        <p className="text-xs text-gray-400">
          {moeda(g.volume)} · {g.itens.toLocaleString('pt-BR')} itens (180d)
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        {CATS.map((c) => {
          const ativo = g.categoria === c.key;
          const Icon = c.icon;
          return (
            <button
              key={c.key}
              disabled={salvando === g.grupo}
              onClick={() => classificar(g.grupo, c.key)}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                ativo
                  ? `${c.cls} text-white`
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Classificação de Grupos (Mix)
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Define se cada grupo do cardápio é Bebida, Drink, Comida ou Outros. É o que monta a
            cesta/mix de vendas. Grupos novos ou sem classificação aparecem no topo.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Pendentes */}
      <Card className="border-amber-300 dark:border-amber-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-amber-700 dark:text-amber-300">
            <AlertTriangle className="w-5 h-5" />
            Sem classificação ({pendentes.length})
          </CardTitle>
          <CardDescription>
            Esses grupos ainda não entram na cesta. Classifique para contarem no mix.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {pendentes.length === 0 ? (
            <p className="text-sm text-gray-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" /> Tudo classificado 🎉
            </p>
          ) : (
            pendentes.map(linha)
          )}
        </CardContent>
      </Card>

      {/* Classificados */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Classificados ({classificados.length})</CardTitle>
          <CardDescription>Clique para reclassificar a qualquer momento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {classificados.map(linha)}
        </CardContent>
      </Card>
    </div>
  );
}
