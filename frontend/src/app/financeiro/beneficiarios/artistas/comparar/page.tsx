'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { Artista } from '../../_components/AtracoesTab';

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
const fmtBRL2 = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtNum = (v: number) => new Intl.NumberFormat('pt-BR').format(v || 0);

// metricas: melhor = maior, exceto custo_medio e custo_pct_fat (melhor = menor)
type Metrica = { label: string; get: (a: Artista) => number; fmt: (v: number) => string; menorMelhor?: boolean };
const METRICAS: Metrica[] = [
  { label: 'Shows realizados', get: (a) => a.shows_feitos, fmt: fmtNum },
  { label: 'Shows previstos', get: (a) => a.shows_previstos, fmt: fmtNum },
  { label: 'Faturamento médio', get: (a) => a.fat_medio, fmt: fmtBRL },
  { label: 'Faturamento total', get: (a) => a.fat_total, fmt: fmtBRL },
  { label: 'Público médio', get: (a) => a.publico_medio, fmt: fmtNum },
  { label: 'Ticket médio', get: (a) => a.ticket_medio, fmt: fmtBRL2 },
  { label: 'Custo médio / show', get: (a) => a.custo_medio, fmt: fmtBRL, menorMelhor: true },
  { label: 'Custo / faturamento', get: (a) => a.custo_pct_fat, fmt: (v) => (v ? `${v}%` : '—'), menorMelhor: true },
  { label: 'Custo total', get: (a) => a.custo_total, fmt: fmtBRL, menorMelhor: true },
];

function CompararInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const { setPageTitle } = usePageTitle();
  useEffect(() => {
    setPageTitle('📊 Comparar atrações');
    return () => setPageTitle('');
  }, [setPageTitle]);
  const keys = useMemo(() => (params.get('keys') || '').split(',').map(decodeURIComponent).filter(Boolean), [params]);

  const [loading, setLoading] = useState(true);
  const [artistas, setArtistas] = useState<Artista[]>([]);

  const carregar = useCallback(async () => {
    if (!selectedBar || keys.length === 0) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await api.get('/api/financeiro/beneficiarios/artistas');
      const all: Artista[] = res.artistas || [];
      const picked = keys.map((k) => all.find((a) => a.key === k)).filter(Boolean) as Artista[];
      setArtistas(picked);
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao comparar', message: e?.message }); }
    finally { setLoading(false); }
  }, [selectedBar, keys, showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const melhorIdx = (m: Metrica): number => {
    if (artistas.length < 2) return -1;
    let best = 0;
    for (let i = 1; i < artistas.length; i++) {
      const cur = m.get(artistas[i]); const bv = m.get(artistas[best]);
      if (m.menorMelhor ? cur < bv : cur > bv) best = i;
    }
    return best;
  };

  return (
    <div className="container mx-auto px-3 py-5 max-w-5xl">
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => router.push('/financeiro/beneficiarios')}>
        <ArrowLeft className="w-4 h-4 mr-1.5" />Atrações
      </Button>

      {loading ? (
        <div className="py-24 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
      ) : artistas.length < 2 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          Selecione ao menos 2 atrações na aba Atrações pra comparar.
        </CardContent></Card>
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b"><tr>
              <th className="text-left px-3 py-2 sticky left-0 bg-card text-xs text-muted-foreground min-w-[150px]">Métrica</th>
              {artistas.map((a) => (
                <th key={a.key} className="text-right px-3 py-2 whitespace-nowrap min-w-[130px]">
                  <button className="hover:underline font-semibold" onClick={() => router.push(`/financeiro/beneficiarios/artistas/${encodeURIComponent(a.key)}`)}>
                    {a.nome}
                  </button>
                  {a.genero && <div className="text-[10px] text-muted-foreground font-normal">{a.genero}</div>}
                </th>
              ))}
            </tr></thead>
            <tbody>
              {METRICAS.map((m) => {
                const best = melhorIdx(m);
                return (
                  <tr key={m.label} className="border-b last:border-0">
                    <td className="px-3 py-1.5 sticky left-0 bg-card text-xs text-muted-foreground">{m.label}</td>
                    {artistas.map((a, i) => (
                      <td key={a.key} className={`px-3 py-1.5 text-right tabular-nums ${i === best ? 'font-bold text-emerald-600' : ''}`}>
                        {m.fmt(m.get(a))}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      <p className="text-[11px] text-muted-foreground mt-2">Verde = melhor da linha. Para custo, melhor é o menor.</p>
    </div>
  );
}

export default function CompararArtistasPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="py-24 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>}>
        <CompararInner />
      </Suspense>
    </ProtectedRoute>
  );
}
