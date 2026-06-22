'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Loader2, Search, Music, ChevronRight, BarChart3, ArrowUpDown } from 'lucide-react';

export type Artista = {
  key: string; nome: string; genero: string | null;
  shows_total: number; shows_feitos: number; shows_previstos: number;
  custo_total: number; custo_medio: number;
  fat_total: number; fat_medio: number;
  publico_total: number; publico_medio: number;
  ticket_medio: number; custo_pct_fat: number;
  primeira: string | null; ultima: string | null; proximo: string | null;
};

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
const fmtBRL2 = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtNum = (v: number) => new Intl.NumberFormat('pt-BR').format(v || 0);

type SortKey = 'shows_feitos' | 'custo_total' | 'custo_medio' | 'fat_medio' | 'publico_medio' | 'ticket_medio' | 'custo_pct_fat';

export default function AtracoesTab() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const router = useRouter();
  const [artistas, setArtistas] = useState<Artista[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('shows_feitos');
  const [sel, setSel] = useState<string[]>([]);

  const carregar = useCallback(async () => {
    if (!selectedBar) return;
    setLoading(true);
    try {
      const res = await api.get('/api/financeiro/beneficiarios/artistas');
      setArtistas(res.artistas || []);
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao carregar atrações', message: e?.message }); }
    finally { setLoading(false); }
  }, [selectedBar, showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const filtradas = useMemo(() => {
    const norm = (s: string) => s.toLowerCase();
    const arr = q ? artistas.filter(a => norm(a.nome).includes(norm(q))) : artistas.slice();
    arr.sort((a, b) => (b[sort] as number) - (a[sort] as number));
    return arr;
  }, [artistas, q, sort]);

  const totalCasa = useMemo(() => ({
    artistas: artistas.length,
    shows: artistas.reduce((s, a) => s + a.shows_feitos, 0),
    custo: artistas.reduce((s, a) => s + a.custo_total, 0),
  }), [artistas]);

  const toggleSel = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSel(prev => prev.includes(key) ? prev.filter(k => k !== key) : prev.length >= 3 ? prev : [...prev, key]);
  };

  const abrir = (key: string) => router.push(`/financeiro/beneficiarios/artistas/${encodeURIComponent(key)}`);
  const comparar = () => router.push(`/financeiro/beneficiarios/artistas/comparar?keys=${sel.map(encodeURIComponent).join(',')}`);

  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className="text-right px-3 py-2 whitespace-nowrap cursor-pointer select-none hover:text-foreground" onClick={() => setSort(k)}>
      <span className="inline-flex items-center gap-1 justify-end">
        {children}
        <ArrowUpDown className={`w-3 h-3 ${sort === k ? 'text-foreground' : 'opacity-30'}`} />
      </span>
    </th>
  );

  return (
    <>
      <p className="text-sm text-muted-foreground mb-3">
        Cada atração paga, com quanto custa e o que rende. Clique numa linha pra ver o perfil completo; marque até 3 pra comparar.
      </p>

      {!loading && artistas.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Atrações</div><div className="text-lg font-bold">{totalCasa.artistas}</div></CardContent></Card>
          <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Shows realizados</div><div className="text-lg font-bold">{fmtNum(totalCasa.shows)}</div></CardContent></Card>
          <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Custo de atração (total)</div><div className="text-lg font-bold">{fmtBRL(totalCasa.custo)}</div></CardContent></Card>
        </div>
      )}

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar atração…" className="pl-8" />
        </div>
        {sel.length >= 2 && (
          <Button size="sm" onClick={comparar}><BarChart3 className="w-4 h-4 mr-1.5" />Comparar {sel.length}</Button>
        )}
        {sel.length === 1 && <span className="text-xs text-muted-foreground">Marque mais 1 pra comparar</span>}
      </div>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
      ) : artistas.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Music className="w-9 h-9 mx-auto mb-2 opacity-40" />
          Nenhuma atração cadastrada neste bar.
          <div className="text-xs mt-1">O dashboard usa o campo <b>artista</b> dos eventos. Esse bar ainda não preenche.</div>
        </CardContent></Card>
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b"><tr>
              <th className="w-8 px-2"></th>
              <th className="text-left px-3 py-2 sticky left-0 bg-card min-w-[180px]">Atração</th>
              <Th k="shows_feitos">Shows</Th>
              <Th k="custo_total">Custo total</Th>
              <Th k="custo_medio">Custo/show</Th>
              <Th k="fat_medio">Fat. médio</Th>
              <Th k="publico_medio">Público</Th>
              <Th k="ticket_medio">Ticket</Th>
              <Th k="custo_pct_fat">% Fat.</Th>
            </tr></thead>
            <tbody>
              {filtradas.map((a) => (
                <tr key={a.key} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => abrir(a.key)}>
                  <td className="px-2 py-1.5 text-center" onClick={(e) => toggleSel(a.key, e)}>
                    <input type="checkbox" checked={sel.includes(a.key)} readOnly className="cursor-pointer" />
                  </td>
                  <td className="px-3 py-1.5 sticky left-0 bg-card">
                    <div className="font-medium truncate max-w-[220px] flex items-center gap-1">
                      <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                      {a.nome}
                    </div>
                    {(a.shows_previstos > 0 || a.genero) && (
                      <span className="text-[10px] text-muted-foreground ml-[18px]">
                        {a.genero || ''}{a.genero && a.shows_previstos > 0 ? ' · ' : ''}
                        {a.shows_previstos > 0 ? `${a.shows_previstos} previsto${a.shows_previstos > 1 ? 's' : ''}` : ''}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{a.shows_feitos}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmtBRL(a.custo_total)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmtBRL(a.custo_medio)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmtBRL(a.fat_medio)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{fmtNum(a.publico_medio)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmtBRL2(a.ticket_medio)}</td>
                  <td className={`px-3 py-1.5 text-right tabular-nums ${a.custo_pct_fat > 25 ? 'text-amber-600' : 'text-muted-foreground'}`}>{a.custo_pct_fat ? `${a.custo_pct_fat}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
