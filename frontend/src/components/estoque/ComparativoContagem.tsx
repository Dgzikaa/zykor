'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, GitCompareArrows, Search } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';

type DataOpt = { data_contagem: string; itens: number };
type Linha = {
  insumo_codigo: string; nome: string; categoria: string | null; tipo_item: string | null; unidade: string | null;
  qtd_a: number | null; valor_a: number | null; qtd_b: number | null; valor_b: number | null;
  delta_qtd: number | null; delta_valor: number | null; preco_atual: number | null;
};
type Resumo = { valor_a: number; valor_b: number; delta_valor: number };

const TIPOS = [
  { v: 'diaria', label: 'Diária' },
  { v: 'semanal', label: 'Semanal' },
  { v: 'mensal', label: 'Mensal' },
];
const brl = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n));
const fmtData = (s: string) => s.split('-').reverse().join('/');
const num = (n: number | null | undefined) => (n == null ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(Number(n)));

export function ComparativoContagem() {
  const { selectedBar } = useBar();
  const [tipo, setTipo] = useState('semanal');
  const [datas, setDatas] = useState<DataOpt[]>([]);
  const [dataA, setDataA] = useState('');
  const [dataB, setDataB] = useState('');
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');

  // carregar datas do tipo escolhido + escolher as 2 mais recentes
  const carregarDatas = useCallback(async () => {
    if (!selectedBar?.id) return;
    try {
      const res = await api.get(`/api/operacional/contagem/datas?tipo=${tipo}`);
      const ds: DataOpt[] = res.datas || [];
      setDatas(ds);
      setDataB(ds[0]?.data_contagem || '');
      setDataA(ds[1]?.data_contagem || ds[0]?.data_contagem || '');
    } catch (e: any) { toast.error(e?.message || 'Erro ao buscar datas'); }
  }, [selectedBar?.id, tipo]);
  useEffect(() => { carregarDatas(); }, [carregarDatas]);

  const comparar = useCallback(async () => {
    if (!dataA || !dataB) { setLinhas([]); setResumo(null); return; }
    setLoading(true);
    try {
      const res = await api.get(`/api/operacional/contagem/comparar?data_a=${dataA}&data_b=${dataB}`);
      setLinhas(res.itens || []);
      setResumo(res.resumo || null);
    } catch (e: any) { toast.error(e?.message || 'Erro ao comparar'); setLinhas([]); setResumo(null); }
    finally { setLoading(false); }
  }, [dataA, dataB]);
  useEffect(() => { comparar(); }, [comparar]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? linhas.filter((l) => l.nome?.toLowerCase().includes(q) || (l.categoria || '').toLowerCase().includes(q)) : linhas;
  }, [linhas, busca]);

  if (!selectedBar?.id) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">Selecione um bar.</CardContent></Card>;
  }

  const deltaColor = (n: number | null) => (n == null || n === 0 ? '' : n > 0 ? 'text-emerald-600' : 'text-red-600');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><GitCompareArrows className="h-5 w-5" /><CardTitle>Comparar contagens — {selectedBar.nome}</CardTitle></div>
          <CardDescription className="mt-1">Compare duas contagens do mesmo tipo. O valor usa sempre o preço atual.</CardDescription>
          <div className="flex flex-wrap items-end gap-3 mt-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Contagem A</label>
              <select value={dataA} onChange={(e) => setDataA(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm min-w-[9rem]">
                {datas.map((d) => <option key={d.data_contagem} value={d.data_contagem}>{fmtData(d.data_contagem)} ({d.itens})</option>)}
              </select>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground mb-2.5" />
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Contagem B</label>
              <select value={dataB} onChange={(e) => setDataB(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm min-w-[9rem]">
                {datas.map((d) => <option key={d.data_contagem} value={d.data_contagem}>{fmtData(d.data_contagem)} ({d.itens})</option>)}
              </select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {datas.length < 2 && !loading && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Poucas contagens do tipo <b>{tipo}</b> para comparar.</CardContent></Card>
      )}

      {resumo && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardHeader className="pb-2"><CardDescription>Valor em {fmtData(dataA)}</CardDescription><CardTitle className="text-2xl tabular-nums">{brl(resumo.valor_a)}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Valor em {fmtData(dataB)}</CardDescription><CardTitle className="text-2xl tabular-nums">{brl(resumo.valor_b)}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Variação</CardDescription><CardTitle className={`text-2xl tabular-nums ${deltaColor(resumo.delta_valor)}`}>{resumo.delta_valor > 0 ? '+' : ''}{brl(resumo.delta_valor)}</CardTitle></CardHeader></Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="relative w-full md:w-80">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar item…" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
          ) : filtradas.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">Sem itens para comparar.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left border-b text-muted-foreground">
                  <tr>
                    <th className="py-2 px-2 font-medium">Item</th>
                    <th className="py-2 px-2 font-medium text-right">Qtd {fmtData(dataA)}</th>
                    <th className="py-2 px-2 font-medium text-right">Qtd {fmtData(dataB)}</th>
                    <th className="py-2 px-2 font-medium text-right">Δ Qtd</th>
                    <th className="py-2 px-2 font-medium text-right">Valor {fmtData(dataA)}</th>
                    <th className="py-2 px-2 font-medium text-right">Valor {fmtData(dataB)}</th>
                    <th className="py-2 px-2 font-medium text-right">Δ Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((l) => (
                    <tr key={l.insumo_codigo} className="border-b hover:bg-muted/30">
                      <td className="py-1.5 px-2">
                        <div>{l.nome}</div>
                        <div className="text-xs text-muted-foreground">{l.categoria || '—'} · {l.unidade || 'un'}</div>
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{num(l.qtd_a)}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{num(l.qtd_b)}</td>
                      <td className={`py-1.5 px-2 text-right tabular-nums ${deltaColor(l.delta_qtd)}`}>{l.delta_qtd != null && l.delta_qtd > 0 ? '+' : ''}{num(l.delta_qtd)}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">{brl(l.valor_a)}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">{brl(l.valor_b)}</td>
                      <td className={`py-1.5 px-2 text-right tabular-nums ${deltaColor(l.delta_valor)}`}>{l.delta_valor != null && l.delta_valor > 0 ? '+' : ''}{brl(l.delta_valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
