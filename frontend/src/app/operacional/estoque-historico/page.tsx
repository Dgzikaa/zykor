'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { Boxes, Loader2, Search, CalendarDays, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const fmtBRL = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const fmtQtd = (q: any, u: string | null) => `${Number(q || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}${u ? ' ' + u : ''}`;

const TIPOS = [
  { key: 'diaria', label: 'Diária', sub: 'Curva A' },
  { key: 'semanal', label: 'Semanal', sub: 'Completa' },
  { key: 'mensal', label: 'Mensal', sub: 'Inventário' },
];

export default function EstoqueHistoricoPage() {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const barId = selectedBar?.id;
  const [tipo, setTipo] = useState('semanal');
  const [sincronizando, setSincronizando] = useState(false);
  const [data, setData] = useState<string | null>(null);
  const [datas, setDatas] = useState<any[]>([]);
  const [itens, setItens] = useState<any[]>([]);
  const [totaisArea, setTotaisArea] = useState<any[]>([]);
  const [totalGeral, setTotalGeral] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [comparar, setComparar] = useState(false);
  const [dataB, setDataB] = useState<string | null>(null);
  const [comp, setComp] = useState<any | null>(null);
  const [loadingComp, setLoadingComp] = useState(false);

  // compara duas contagens DO MESMO TIPO (data + tipo) — busca os dois lados já filtrados pelo tipo
  const carregarComp = useCallback(async (t: string, a: string | null, b: string | null) => {
    if (!a || !b || a === b) { setComp(null); return; }
    setLoadingComp(true);
    try {
      const [ra, rb] = await Promise.all([
        api.get(`/api/operacional/estoque-historico?tipo=${t}&data=${a}`),
        api.get(`/api/operacional/estoque-historico?tipo=${t}&data=${b}`),
      ]);
      const chave = (i: any) => i.insumo_codigo || i.insumo_nome;
      const mapA = new Map<string, any>((ra.itens || []).map((i: any) => [chave(i), i]));
      const mapB = new Map<string, any>((rb.itens || []).map((i: any) => [chave(i), i]));
      const keys = Array.from(new Set([...mapA.keys(), ...mapB.keys()]));
      let va = 0, vb = 0;
      const itens = keys.map((k) => {
        const A = mapA.get(k), B = mapB.get(k);
        const qa = Number(A?.estoque_final || 0), qb = Number(B?.estoque_final || 0);
        const vAi = Number(A?.valor || 0), vBi = Number(B?.valor || 0);
        va += vAi; vb += vBi;
        return { insumo_codigo: A?.insumo_codigo || B?.insumo_codigo, nome: A?.insumo_nome || B?.insumo_nome, unidade: A?.unidade_medida || B?.unidade_medida, qtd_a: qa, qtd_b: qb, delta_qtd: qb - qa, valor_a: vAi, valor_b: vBi, delta_valor: vBi - vAi };
      }).sort((x, y) => Math.abs(y.delta_valor) - Math.abs(x.delta_valor));
      setComp({ data_a: a, data_b: b, itens, resumo: { valor_a: va, valor_b: vb, delta_valor: vb - va } });
    } finally { setLoadingComp(false); }
  }, []);
  const toggleComparar = () => {
    if (comparar) { setComparar(false); return; }
    const segunda = (datas.find((d: any) => d.data !== data)?.data) || null;
    setDataB(segunda); setComparar(true); carregarComp(tipo, data, segunda);
  };
  const trocarDataB = (b: string) => { setDataB(b); carregarComp(tipo, data, b); };

  const carregar = useCallback(async (t: string, d?: string | null) => {
    if (!barId) return;
    setLoading(true);
    try {
      const q = `tipo=${t}${d ? `&data=${d}` : ''}`;
      const r = await api.get(`/api/operacional/estoque-historico?${q}`);
      if (r.success) {
        setDatas(r.datas || []);
        setData(r.data || null);
        setItens(r.itens || []);
        setTotaisArea(r.totais_area || []);
        setTotalGeral(r.total_geral || 0);
      }
    } finally { setLoading(false); }
  }, [barId]);

  // ao trocar de tipo, recarrega da data mais recente
  useEffect(() => { carregar(tipo, null); }, [tipo, carregar]);

  // roda o sync da planilha de contagem (aba INSUMOS) pro bar atual e recarrega
  const sincronizar = async () => {
    if (!barId) return;
    setSincronizando(true);
    try {
      const r = await api.post('/api/operacional/estoque-historico', { action: 'sync' });
      if (!r.success) throw new Error(r.error);
      const sem = (r.sem_cadastro || []).length;
      toast({ title: 'Estoque sincronizado', description: `${r.upserted ?? 0} linhas atualizadas${sem ? ` · ${sem} sem cadastro` : ''}` });
      await carregar(tipo, null);
    } catch (e: any) { toast({ title: 'Erro ao sincronizar', description: e?.message, variant: 'destructive' }); }
    finally { setSincronizando(false); }
  };

  const trocarData = (d: string) => { setData(d); carregar(tipo, d); if (comparar) carregarComp(tipo, d, dataB); };

  const itensView = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return itens.filter(i => !s || (i.insumo_nome || '').toLowerCase().includes(s) || (i.insumo_codigo || '').toLowerCase().includes(s));
  }, [itens, busca]);
  const compView = useMemo(() => {
    if (!comp) return [];
    const s = busca.trim().toLowerCase();
    return (comp.itens || []).filter((i: any) => !s || (i.nome || '').toLowerCase().includes(s) || (i.insumo_codigo || '').toLowerCase().includes(s));
  }, [comp, busca]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 rounded-xl"><Boxes className="w-6 h-6 text-amber-600 dark:text-amber-400" /></div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Estoque — Histórico de Contagens</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Valor em estoque por área e por contagem · {selectedBar?.nome || `Bar ${barId ?? ''}`}</p>
          </div>
          <Button onClick={sincronizar} disabled={sincronizando} variant="outline" className="shrink-0" title="Buscar o estoque dos últimos 14 dias da planilha de contagem (aba INSUMOS)">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${sincronizando ? 'animate-spin' : ''}`} />{sincronizando ? 'Sincronizando…' : 'Sincronizar planilha'}
          </Button>
        </div>

        {/* Tipo de contagem */}
        <div className="flex flex-wrap gap-2">
          {TIPOS.map(t => (
            <button key={t.key} onClick={() => { setTipo(t.key); setComparar(false); setComp(null); }}
              className={`rounded-lg px-4 py-2 text-sm transition border ${tipo === t.key ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
              <span className="font-semibold">{t.label}</span> <span className="text-xs opacity-80">· {t.sub}</span>
            </button>
          ))}
        </div>

        {/* Cards de total */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Card className="card-dark"><CardContent className="py-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Total em estoque</div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{fmtBRL(totalGeral)}</div>
          </CardContent></Card>
          {totaisArea.map((a: any) => (
            <Card key={a.area} className="card-dark"><CardContent className="py-3">
              <div className="text-xs text-muted-foreground uppercase tracking-wide capitalize">{a.area} <span className="normal-case">({a.itens} itens)</span></div>
              <div className="text-2xl font-bold">{fmtBRL(a.valor)}</div>
            </CardContent></Card>
          ))}
        </div>

        {/* Seletor de data + comparar + busca */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <CalendarDays className="w-4 h-4 text-gray-400 shrink-0" />
            <select value={data || ''} onChange={e => trocarData(e.target.value)}
              className="h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm sm:min-w-[220px]">
              {datas.length === 0 && <option value="">Sem contagens</option>}
              {datas.map((d: any) => <option key={d.data} value={d.data}>{fmtData(d.data)} · {d.itens} itens</option>)}
            </select>
            <button onClick={toggleComparar}
              className={`h-10 rounded-md px-3 text-sm border ${comparar ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}>
              {comparar ? 'Comparando' : 'Comparar'}
            </button>
            {comparar && (
              <>
                <span className="text-gray-400 text-sm">com</span>
                <select value={dataB || ''} onChange={e => trocarDataB(e.target.value)}
                  className="h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm sm:min-w-[220px]">
                  {datas.filter((d: any) => d.data !== data).map((d: any) => <option key={d.data} value={d.data}>{fmtData(d.data)} · {d.itens} itens</option>)}
                </select>
              </>
            )}
          </div>
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar insumo…" className="pl-9" />
          </div>
        </div>

        {comparar && comp?.resumo && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">{fmtData(comp.data_a)}</div><div className="text-xl font-bold">{fmtBRL(comp.resumo.valor_a)}</div></CardContent></Card>
            <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">{fmtData(comp.data_b)}</div><div className="text-xl font-bold">{fmtBRL(comp.resumo.valor_b)}</div></CardContent></Card>
            <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Diferença</div><div className={`text-xl font-bold ${comp.resumo.delta_valor < 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{fmtBRL(comp.resumo.delta_valor)}</div></CardContent></Card>
          </div>
        )}

        {/* Tabela */}
        {!comparar ? (
        <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
              <th className="text-left font-medium px-3 py-2">Cód.</th>
              <th className="text-left font-medium px-3 py-2">Insumo</th>
              <th className="text-left font-medium px-3 py-2">Área</th>
              <th className="text-left font-medium px-3 py-2">Categoria</th>
              <th className="text-right font-medium px-3 py-2">Qtd. contada</th>
              <th className="text-right font-medium px-3 py-2">Preço (no momento)</th>
              <th className="text-right font-medium px-3 py-2">Valor</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              : itensView.length === 0 ? <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400">Nenhuma contagem nessa data.</td></tr>
              : itensView.map((it: any, i: number) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">{it.insumo_codigo || '—'}</td>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{it.insumo_nome}</td>
                  <td className="px-3 py-2"><Badge variant="outline">{it.area || '—'}</Badge></td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{it.categoria || '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtQtd(it.estoque_final, it.unidade_medida)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{it.custo_unitario ? fmtBRL(it.custo_unitario) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{it.valor ? fmtBRL(it.valor) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></CardContent></Card>
        ) : (
        <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
              <th className="text-left font-medium px-3 py-2">Cód.</th>
              <th className="text-left font-medium px-3 py-2">Insumo</th>
              <th className="text-right font-medium px-3 py-2">Qtd {fmtData(comp?.data_a)}</th>
              <th className="text-right font-medium px-3 py-2">Qtd {fmtData(comp?.data_b)}</th>
              <th className="text-right font-medium px-3 py-2">Δ Qtd</th>
              <th className="text-right font-medium px-3 py-2">Valor {fmtData(comp?.data_a)}</th>
              <th className="text-right font-medium px-3 py-2">Valor {fmtData(comp?.data_b)}</th>
              <th className="text-right font-medium px-3 py-2">Δ Valor</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loadingComp ? <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              : compView.length === 0 ? <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400">Escolha duas datas pra comparar.</td></tr>
              : compView.map((it: any, i: number) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">{it.insumo_codigo || '—'}</td>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{it.nome}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtQtd(it.qtd_a, it.unidade)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtQtd(it.qtd_b, it.unidade)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${Number(it.delta_qtd) < 0 ? 'text-red-500' : Number(it.delta_qtd) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{Number(it.delta_qtd) > 0 ? '+' : ''}{Number(it.delta_qtd || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtBRL(it.valor_a)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtBRL(it.valor_b)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-medium ${Number(it.delta_valor) < 0 ? 'text-red-500' : Number(it.delta_valor) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{fmtBRL(it.delta_valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></CardContent></Card>
        )}
      </div>
    </div>
  );
}
