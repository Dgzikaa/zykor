'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { FlaskConical, Search, Loader2, Download, ChevronDown, ChevronRight } from 'lucide-react';

const fmtNum = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const isoDate = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
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

export default function ConsumoInsumoPage() {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const barId = selectedBar?.id;

  const [gran, setGran] = useState<'dia' | 'semana' | 'mes'>('dia');
  const [dataRef, setDataRef] = useState(isoDate(new Date()));
  const range = useMemo(() => calcRange(gran, dataRef), [gran, dataRef]);

  const [insumos, setInsumos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [serie, setSerie] = useState<any[] | null>(null);
  const [loadingSerie, setLoadingSerie] = useState(false);

  const carregar = useCallback(async () => {
    if (!barId) return;
    setLoading(true); setAberto(null); setSerie(null);
    try {
      const r = await api.get(`/api/operacional/consumo-insumo?bar_id=${barId}&ini=${range.ini}&fim=${range.fim}`);
      if (!r.success) throw new Error(r.error);
      setInsumos(r.insumos || []);
    } catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [barId, range.ini, range.fim]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { carregar(); }, [carregar]);

  const abrirSerie = async (codigo: string) => {
    if (aberto === codigo) { setAberto(null); setSerie(null); return; }
    setAberto(codigo); setSerie(null); setLoadingSerie(true);
    try {
      const r = await api.get(`/api/operacional/consumo-insumo?bar_id=${barId}&ini=${range.ini}&fim=${range.fim}&codigo=${encodeURIComponent(codigo)}`);
      if (!r.success) throw new Error(r.error);
      setSerie(r.serie || []);
    } catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
    finally { setLoadingSerie(false); }
  };

  const cats = useMemo(() => Array.from(new Set(insumos.map(i => i.categoria || 'Outros'))).sort(), [insumos]);
  const view = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return insumos.filter(i => (!cat || (i.categoria || 'Outros') === cat)
      && (!q || (i.insumo_nome || '').toLowerCase().includes(q) || (i.insumo_codigo || '').toLowerCase().includes(q)));
  }, [insumos, busca, cat]);

  const exportCsv = () => {
    if (!view.length) return;
    const head = ['Codigo', 'Insumo', 'Categoria', 'Consumo (base ml/g/un)', 'Dias'];
    const linhas = view.map((i: any) => [i.insumo_codigo, i.insumo_nome || '', i.categoria || '', i.qtd_base ?? '', i.dias ?? '']
      .map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';'));
    const csv = '﻿' + [head.join(';'), ...linhas].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `consumo-insumo_${range.ini}_${range.fim}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const btnGran = (g: 'dia' | 'semana' | 'mes', label: string) => (
    <button onClick={() => setGran(g)} className={`text-xs rounded px-3 py-1.5 border ${gran === g ? 'bg-violet-500 text-white border-violet-500' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>{label}</button>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-100 dark:bg-violet-900/30 rounded-xl"><FlaskConical className="w-6 h-6 text-violet-600 dark:text-violet-400" /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Consumo Teórico de Insumo</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Saída de produto explodida na ficha técnica → quanto saiu de cada insumo (em ml / g / un)</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {btnGran('dia', 'Dia')}{btnGran('semana', 'Semana')}{btnGran('mes', 'Mês')}
          <Input type="date" value={dataRef} onChange={e => setDataRef(e.target.value)} className="w-auto h-8" />
          <span className="text-sm text-gray-500 dark:text-gray-400">{range.ini === range.fim ? fmtDataBR(range.ini) : `${fmtDataBR(range.ini)} → ${fmtDataBR(range.fim)}`}</span>
          <div className="relative ml-auto"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar insumo…" className="pl-9 h-8 w-56" /></div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!view.length}><Download className="w-4 h-4 mr-1.5" />CSV</Button>
        </div>

        {cats.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setCat(null)} className={`text-xs rounded px-2.5 py-1 border ${!cat ? 'bg-gray-700 text-white border-gray-700' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>Todas</button>
            {cats.map(c => <button key={c} onClick={() => setCat(x => x === c ? null : c)} className={`text-xs rounded px-2.5 py-1 border ${cat === c ? 'bg-violet-500 text-white border-violet-500' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>{c}</button>)}
          </div>
        )}

        {loading ? <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        : view.length === 0 ? <Card className="card-dark"><CardContent className="py-16 text-center text-gray-400">Sem consumo no período (ou fichas/de-para pendentes).</CardContent></Card>
        : (
          <Card className="card-dark">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800"><tr>
                  <th className="w-8"></th>
                  <th className="text-left font-medium px-3 py-2">Cód.</th>
                  <th className="text-left font-medium px-3 py-2">Insumo</th>
                  <th className="text-left font-medium px-3 py-2">Categoria</th>
                  <th className="text-right font-medium px-3 py-2">Consumo (ml/g/un)</th>
                  <th className="text-right font-medium px-3 py-2">Dias</th>
                </tr></thead>
                <tbody>
                  {view.map((i: any) => (
                    <>
                      <tr key={i.insumo_codigo} onClick={() => abrirSerie(i.insumo_codigo)} className="border-b border-gray-50 dark:border-gray-800/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="text-center text-gray-400">{aberto === i.insumo_codigo ? <ChevronDown className="w-4 h-4 inline" /> : <ChevronRight className="w-4 h-4 inline" />}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-500">{i.insumo_codigo}</td>
                        <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{i.insumo_nome || <span className="text-gray-400 italic">sem cadastro</span>}</td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{i.categoria || 'Outros'}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtNum(i.qtd_base)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-500">{i.dias}</td>
                      </tr>
                      {aberto === i.insumo_codigo && (
                        <tr className="bg-gray-50/60 dark:bg-gray-800/20">
                          <td></td>
                          <td colSpan={5} className="px-3 py-2">
                            {loadingSerie ? <Loader2 className="w-4 h-4 animate-spin" />
                            : !serie || serie.length === 0 ? <span className="text-xs text-gray-400">Sem detalhe diário.</span>
                            : (
                              <div className="flex flex-wrap gap-2">
                                {serie.map((s: any) => (
                                  <span key={s.data} className="text-xs rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-2 py-1">
                                    {fmtDataBR(s.data)}: <b className="tabular-nums">{fmtNum(s.qtd_base)}</b>
                                  </span>
                                ))}
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
