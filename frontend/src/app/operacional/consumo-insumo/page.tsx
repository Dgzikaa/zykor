'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { LogOut, Search, Loader2, Download, ChevronDown, ChevronRight } from 'lucide-react';

const fmtNum = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const fmtBRL = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const isoDate = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
// padrão = ontem (o dia atual ainda não tem dado consolidado)
const ontemISO = () => { const d = new Date(); d.setDate(d.getDate() - 1); return isoDate(d); };
const fmtDataBR = (s: string) => s.split('-').reverse().join('/');
function calcRange(gran: 'dia' | 'semana' | 'mes', ref: string): { ini: string; fim: string } {
  const dt = new Date(ref + 'T00:00:00');
  if (gran === 'dia') return { ini: ref, fim: ref };
  if (gran === 'semana') {
    const dow = (dt.getDay() + 6) % 7;
    const ini = new Date(dt); ini.setDate(dt.getDate() - dow);
    const fim = new Date(ini); fim.setDate(ini.getDate() + 6);
    return { ini: isoDate(ini), fim: isoDate(fim) };
  }
  const ini = new Date(dt.getFullYear(), dt.getMonth(), 1);
  const fim = new Date(dt.getFullYear(), dt.getMonth() + 1, 0);
  return { ini: isoDate(ini), fim: isoDate(fim) };
}

type Aba = 'insumo' | 'producao' | 'geral';
const ABAS: { id: Aba; label: string }[] = [
  { id: 'insumo', label: 'Insumos' },
  { id: 'producao', label: 'Produções' },
  { id: 'geral', label: 'Geral' },
];

export default function SaidasPage() {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const barId = selectedBar?.id;

  const [aba, setAba] = useState<Aba>('insumo');
  const [gran, setGran] = useState<'dia' | 'semana' | 'mes'>('dia');
  const [dataRef, setDataRef] = useState(ontemISO());
  const range = useMemo(() => calcRange(gran, dataRef), [gran, dataRef]);

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<any[] | null>(null);
  const [loadingBreak, setLoadingBreak] = useState(false);

  const temDrill = aba !== 'geral'; // Geral não abre quebra por produto
  const unidadeLabel = aba === 'insumo' ? 'ml / g / un' : aba === 'producao' ? 'un. da produção' : '—';

  const carregar = useCallback(async () => {
    if (!barId) return;
    setLoading(true); setAberto(null); setBreakdown(null); setCat(null);
    try {
      const r = await api.get(`/api/operacional/consumo-insumo?bar_id=${barId}&ini=${range.ini}&fim=${range.fim}&aba=${aba}`);
      if (!r.success) throw new Error(r.error);
      setRows(r.rows || []);
    } catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [barId, range.ini, range.fim, aba]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { carregar(); }, [carregar]);

  const abrirBreak = async (codigo: string) => {
    if (!temDrill) return;
    if (aberto === codigo) { setAberto(null); setBreakdown(null); return; }
    setAberto(codigo); setBreakdown(null); setLoadingBreak(true);
    try {
      const r = await api.get(`/api/operacional/consumo-insumo?bar_id=${barId}&ini=${range.ini}&fim=${range.fim}&aba=${aba}&codigo=${encodeURIComponent(codigo)}`);
      if (!r.success) throw new Error(r.error);
      setBreakdown(r.breakdown || []);
    } catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
    finally { setLoadingBreak(false); }
  };

  const cats = useMemo(() => Array.from(new Set(rows.map(i => i.categoria || 'Outros'))).sort(), [rows]);
  const view = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter(i => (!cat || (i.categoria || 'Outros') === cat)
      && (!q || (i.nome || '').toLowerCase().includes(q) || (i.codigo || '').toLowerCase().includes(q)));
  }, [rows, busca, cat]);

  const exportCsv = () => {
    if (!view.length) return;
    const head = aba === 'geral'
      ? ['Tipo', 'Codigo', 'Nome', 'Categoria', 'Saida', 'Unidade', 'Faturamento', 'Dias']
      : ['Codigo', 'Nome', 'Categoria', 'Saida', 'Unidade', 'Dias'];
    const linhas = view.map((i: any) => (aba === 'geral'
      ? [i.tipo, i.codigo, i.nome || '', i.categoria || '', i.qtd ?? '', i.unidade ?? '', i.valor ?? '', i.dias ?? '']
      : [i.codigo, i.nome || '', i.categoria || '', i.qtd ?? '', i.unidade ?? '', i.dias ?? ''])
      .map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'));
    const csv = '﻿' + [head.join(';'), ...linhas].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `saidas-${aba}_${range.ini}_${range.fim}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const btnGran = (g: 'dia' | 'semana' | 'mes', label: string) => (
    <button onClick={() => setGran(g)} className={`text-xs rounded px-3 py-1.5 border ${gran === g ? 'bg-violet-500 text-white border-violet-500' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>{label}</button>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-100 dark:bg-violet-900/30 rounded-xl"><LogOut className="w-6 h-6 text-violet-600 dark:text-violet-400" /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Saídas</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Consumo teórico das vendas do ContaHub, explodido na ficha técnica — por insumo, por produção, e o geral.</p>
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
          {ABAS.map(a => (
            <button key={a.id} onClick={() => setAba(a.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${aba === a.id ? 'border-violet-500 text-violet-600 dark:text-violet-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              {a.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {btnGran('dia', 'Dia')}{btnGran('semana', 'Semana')}{btnGran('mes', 'Mês')}
          <Input type="date" value={dataRef} onChange={e => setDataRef(e.target.value)} className="w-auto h-8" />
          <span className="text-sm text-gray-500 dark:text-gray-400">{range.ini === range.fim ? fmtDataBR(range.ini) : `${fmtDataBR(range.ini)} → ${fmtDataBR(range.fim)}`}</span>
          <div className="relative ml-auto"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar…" className="pl-9 h-8 w-56" /></div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!view.length}><Download className="w-4 h-4 mr-1.5" />CSV</Button>
        </div>

        {cats.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setCat(null)} className={`text-xs rounded px-2.5 py-1 border ${!cat ? 'bg-gray-700 text-white border-gray-700' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>Todas</button>
            {cats.map(c => <button key={c} onClick={() => setCat(x => x === c ? null : c)} className={`text-xs rounded px-2.5 py-1 border ${cat === c ? 'bg-violet-500 text-white border-violet-500' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>{c}</button>)}
          </div>
        )}

        {loading ? <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        : view.length === 0 ? <Card className="card-dark"><CardContent className="py-16 text-center text-gray-400">Sem saídas no período (ou fichas/de-para pendentes).</CardContent></Card>
        : (
          <Card className="card-dark">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800"><tr>
                  {temDrill && <th className="w-8"></th>}
                  {aba === 'geral' && <th className="text-left font-medium px-3 py-2">Tipo</th>}
                  <th className="text-left font-medium px-3 py-2">Cód.</th>
                  <th className="text-left font-medium px-3 py-2">{aba === 'insumo' ? 'Insumo' : aba === 'producao' ? 'Produção' : 'Item'}</th>
                  <th className="text-left font-medium px-3 py-2">Categoria</th>
                  <th className="text-right font-medium px-3 py-2">Saída ({unidadeLabel})</th>
                  {aba === 'geral' && <th className="text-right font-medium px-3 py-2">Faturamento</th>}
                  <th className="text-right font-medium px-3 py-2">Dias</th>
                </tr></thead>
                <tbody>
                  {view.map((i: any) => (
                    <>
                      <tr key={`${i.tipo || ''}${i.codigo}`} onClick={() => abrirBreak(i.codigo)} className={`border-b border-gray-50 dark:border-gray-800/50 ${temDrill ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40' : ''}`}>
                        {temDrill && <td className="text-center text-gray-400">{aberto === i.codigo ? <ChevronDown className="w-4 h-4 inline" /> : <ChevronRight className="w-4 h-4 inline" />}</td>}
                        {aba === 'geral' && <td className="px-3 py-2"><span className={`text-[10px] rounded px-1.5 py-0.5 ${i.tipo === 'finalizacao' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>{i.tipo === 'finalizacao' ? 'Finalização' : 'Produção'}</span></td>}
                        <td className="px-3 py-2 font-mono text-xs text-gray-500">{i.codigo}</td>
                        <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{i.nome || <span className="text-gray-400 italic">sem cadastro</span>} {i.unidade && aba !== 'geral' ? '' : i.unidade ? <span className="text-gray-400 text-xs">· {i.unidade}</span> : ''}</td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{i.categoria || 'Outros'}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtNum(i.qtd)}</td>
                        {aba === 'geral' && <td className="px-3 py-2 text-right tabular-nums text-blue-600 dark:text-blue-400">{i.tipo === 'finalizacao' ? fmtBRL(i.valor) : '—'}</td>}
                        <td className="px-3 py-2 text-right tabular-nums text-gray-500">{i.dias}</td>
                      </tr>
                      {temDrill && aberto === i.codigo && (
                        <tr className="bg-gray-50/60 dark:bg-gray-800/20">
                          <td></td>
                          <td colSpan={5} className="px-3 py-3">
                            {loadingBreak ? <Loader2 className="w-4 h-4 animate-spin" />
                            : !breakdown || breakdown.length === 0 ? <span className="text-xs text-gray-400">Sem produtos no período.</span>
                            : (
                              <div className="space-y-0.5">
                                <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Puxado por cada produto vendido</div>
                                <table className="w-full text-xs">
                                  <thead className="text-gray-400"><tr>
                                    <th className="text-left font-medium py-1">Produto</th>
                                    {aba === 'insumo' && <th className="text-right font-medium py-1 w-28">Qtd vendida</th>}
                                    <th className="text-right font-medium py-1 w-32">Saída</th>
                                  </tr></thead>
                                  <tbody>
                                    {breakdown.map((p: any) => (
                                      <tr key={p.produto_cod} className="border-t border-gray-100 dark:border-gray-800/60">
                                        <td className="py-1 text-gray-700 dark:text-gray-200">{p.produto_nome || p.produto_cod} <span className="text-gray-400 font-mono">· {p.produto_cod}</span></td>
                                        {aba === 'insumo' && <td className="py-1 text-right tabular-nums">{fmtNum(p.qtd_venda)}</td>}
                                        <td className="py-1 text-right tabular-nums font-medium">{fmtNum(p.qtd)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
