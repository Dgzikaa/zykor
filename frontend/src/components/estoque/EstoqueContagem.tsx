'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { api } from '@/lib/api-client';
import {
  Search, Loader2, Save, ChevronLeft, ChevronRight, Plus, ClipboardList, CalendarDays,
} from 'lucide-react';

type MatrizRow = {
  insumo_codigo: string; nome: string; categoria: string | null; tipo_local: string | null;
  tipo_item: string | null; unidade_medida: string | null; frequencia: string | null;
  data_contagem: string; tipo_contagem: string; estoque_final: number | null; preco_atual: number | null;
};
type ItemContar = {
  insumo_id: number; codigo: string; nome: string; categoria: string | null; tipo_local: string | null;
  unidade_medida: string | null; frequencia: string | null; preco_atual: number | null;
  ultimo_final: number | null; contado: number | null;
};

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const TIPOS = [
  { v: 'diaria', label: 'Diária', desc: 'Itens de giro alto, contados todo dia.' },
  { v: 'semanal', label: 'Semanal', desc: 'Diários + os de contagem semanal (segundas).' },
  { v: 'mensal', label: 'Mensal', desc: 'Inventário completo (todo dia 1º).' },
];
const TIPO_DOT: Record<string, string> = { mensal: 'bg-purple-500', semanal: 'bg-blue-500', diaria: 'bg-muted-foreground/40' };
const hoje = () => new Date().toISOString().slice(0, 10);
const num = (v: string) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));
const brl = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
const qtd = (n: number | null | undefined) => (n == null ? '·' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(n)));
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const fmtData = (iso: string) => iso.split('-').reverse().join('/');
const capitalize = (s: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '—');

export function EstoqueContagem() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const now = new Date();
  const [mode, setMode] = useState<'tabela' | 'contar'>('tabela');

  // ---- tabelão ----
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [linhas, setLinhas] = useState<MatrizRow[]>([]);
  const [loadingTab, setLoadingTab] = useState(false);
  const [buscaTab, setBuscaTab] = useState('');
  const [areaTab, setAreaTab] = useState('');

  // ---- modal + contagem ----
  const [modalOpen, setModalOpen] = useState(false);
  const [novoTipo, setNovoTipo] = useState('diaria');
  const [novaData, setNovaData] = useState(hoje());
  const [tipoC, setTipoC] = useState('diaria');
  const [dataC, setDataC] = useState(hoje());
  const [itens, setItens] = useState<ItemContar[]>([]);
  const [valores, setValores] = useState<Record<number, string>>({});
  const [buscaC, setBuscaC] = useState('');
  const [areaC, setAreaC] = useState('');
  const [loadingC, setLoadingC] = useState(false);
  const [saving, setSaving] = useState(false);

  const carregarMes = useCallback(async () => {
    if (!selectedBar?.id) return;
    setLoadingTab(true);
    try {
      const res = await api.get(`/api/operacional/contagem/mes?ano=${ano}&mes=${mes}`);
      setLinhas(res.linhas || []);
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao carregar', message: e?.message }); }
    finally { setLoadingTab(false); }
  }, [selectedBar?.id, ano, mes, showToast]);
  useEffect(() => { carregarMes(); }, [carregarMes]);

  const mudarMes = (delta: number) => {
    let m = mes + delta, a = ano;
    if (m < 1) { m = 12; a -= 1; } if (m > 12) { m = 1; a += 1; }
    setMes(m); setAno(a);
  };

  // pivot item × data
  const { datas, tipoPorData, itensPivot, totaisPorData } = useMemo(() => {
    const dset = new Map<string, string>();
    const map = new Map<string, { row: MatrizRow; vals: Record<string, number | null> }>();
    for (const r of linhas) {
      dset.set(r.data_contagem, r.tipo_contagem);
      const ex = map.get(r.insumo_codigo) || { row: r, vals: {} };
      ex.vals[r.data_contagem] = r.estoque_final;
      map.set(r.insumo_codigo, ex);
    }
    const datas = [...dset.keys()].sort();
    const q = buscaTab.trim().toLowerCase();
    let arr = [...map.values()].filter(({ row }) =>
      (!areaTab || row.tipo_local === areaTab) &&
      (!q || row.nome?.toLowerCase().includes(q) || (row.categoria || '').toLowerCase().includes(q)));
    arr = arr.sort((a, b) => (a.row.categoria || '').localeCompare(b.row.categoria || '') || (a.row.nome || '').localeCompare(b.row.nome || ''));
    const totais: Record<string, number> = {};
    for (const d of datas) totais[d] = arr.reduce((s, { row, vals }) => s + ((vals[d] ?? 0) * (Number(row.preco_atual) || 0)), 0);
    return { datas, tipoPorData: dset, itensPivot: arr, totaisPorData: totais };
  }, [linhas, buscaTab, areaTab]);

  // ---- iniciar contagem ----
  const comecar = async () => {
    setTipoC(novoTipo); setDataC(novaData); setModalOpen(false);
    setMode('contar'); setLoadingC(true); setBuscaC(''); setAreaC('');
    try {
      const res = await api.get(`/api/operacional/contagem/itens?tipo=${novoTipo}&data=${novaData}`);
      const its: ItemContar[] = res.itens || [];
      setItens(its);
      const v: Record<number, string> = {};
      its.forEach(i => { if (i.contado != null) v[i.insumo_id] = String(i.contado); });
      setValores(v);
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao carregar itens', message: e?.message }); }
    finally { setLoadingC(false); }
  };

  const salvar = async () => {
    const payload = Object.entries(valores).filter(([, v]) => v !== '' && v != null)
      .map(([id, v]) => ({ insumo_id: Number(id), estoque_final: num(v) }));
    if (!payload.length) return showToast({ type: 'error', title: 'Conte ao menos 1 item' });
    setSaving(true);
    try {
      const res = await api.post('/api/operacional/contagem', { data: dataC, itens: payload });
      showToast({ type: 'success', title: 'Contagem salva', message: `${res.salvos} item(ns).` });
      setMode('tabela'); carregarMes();
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao salvar', message: e?.message }); }
    finally { setSaving(false); }
  };

  const itensFiltrados = useMemo(() => {
    const q = buscaC.trim().toLowerCase();
    const arr = itens.filter(i => (!areaC || i.tipo_local === areaC) && (!q || i.nome.toLowerCase().includes(q)));
    const g: Record<string, ItemContar[]> = {};
    arr.forEach(i => { const c = i.categoria || 'Sem categoria'; (g[c] ||= []).push(i); });
    return Object.entries(g);
  }, [itens, buscaC, areaC]);

  const contados = useMemo(() => Object.values(valores).filter(v => v !== '' && v != null).length, [valores]);
  const valorTotal = useMemo(() => itens.reduce((s, i) => {
    const q = num(valores[i.insumo_id] ?? '');
    return s + (q != null ? q * (Number(i.preco_atual) || 0) : 0);
  }, 0), [itens, valores]);

  if (!selectedBar?.id) {
    return <div className="py-12 text-center text-muted-foreground">Selecione um bar.</div>;
  }

  // ====================== MODO TABELÃO ======================
  if (mode === 'tabela') {
    return (
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex items-center gap-1 rounded-lg border p-0.5">
            <Button variant="ghost" size="sm" className="px-2" onClick={() => mudarMes(-1)}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-sm font-semibold w-32 text-center">{MESES[mes - 1]} {ano}</span>
            <Button variant="ghost" size="sm" className="px-2" onClick={() => mudarMes(1)}><ChevronRight className="w-4 h-4" /></Button>
          </div>
          <div className="relative flex-1 min-w-[12rem] max-w-xs">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input value={buscaTab} onChange={e => setBuscaTab(e.target.value)} placeholder="Buscar item…" className="pl-8 h-9" />
          </div>
          <select value={areaTab} onChange={e => setAreaTab(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
            <option value="">Todas as áreas</option>
            <option value="bar">Bar</option>
            <option value="cozinha">Cozinha</option>
          </select>
          <Button onClick={() => { setNovoTipo('diaria'); setNovaData(hoje()); setModalOpen(true); }} className="ml-auto gap-1.5">
            <Plus className="w-4 h-4" /> Fazer contagem
          </Button>
        </div>

        {loadingTab ? (
          <div className="py-16 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        ) : datas.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground border rounded-lg">
            <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" />
            Nenhuma contagem em {MESES[mes - 1]}. Clique em <b>Fazer contagem</b> para começar.
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="text-sm border-collapse w-full">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="sticky left-0 z-10 bg-muted/30 text-left font-medium px-3 py-2 min-w-[14rem] border-r">Item</th>
                  {datas.map(d => (
                    <th key={d} className="px-2 py-2 font-medium text-center whitespace-nowrap min-w-[3.5rem]">
                      <div className="flex items-center justify-center gap-1">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${TIPO_DOT[tipoPorData.get(d) || 'diaria']}`} />
                        {ddmm(d)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itensPivot.map(({ row, vals }) => (
                  <tr key={row.insumo_codigo} className="border-b hover:bg-muted/20">
                    <td className="sticky left-0 z-10 bg-background px-3 py-1.5 border-r">
                      <div className="font-medium leading-tight">{row.nome}</div>
                      <div className="text-xs text-muted-foreground">{row.categoria || '—'} · {row.unidade_medida || 'un'}</div>
                    </td>
                    {datas.map(d => (
                      <td key={d} className={`px-2 py-1.5 text-center tabular-nums ${vals[d] == null ? 'text-muted-foreground/40' : ''}`}>
                        {qtd(vals[d])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30 font-medium">
                  <td className="sticky left-0 z-10 bg-muted/30 px-3 py-2 border-r">Valor (preço atual)</td>
                  {datas.map(d => (
                    <td key={d} className="px-2 py-2 text-center tabular-nums whitespace-nowrap text-xs">{brl(totaisPorData[d] || 0)}</td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> mensal</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> semanal</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" /> diária</span>
        </p>

        {/* Modal: escolher o tipo de contagem */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Fazer contagem</DialogTitle>
              <DialogDescription>Escolha o tipo de contagem e a data.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-1">
              {TIPOS.map(t => (
                <button key={t.v} onClick={() => setNovoTipo(t.v)}
                  className={`w-full text-left rounded-lg border p-3 transition ${novoTipo === t.v ? 'border-primary ring-1 ring-primary bg-primary/5' : 'hover:bg-muted/40'}`}>
                  <div className="flex items-center gap-2 font-semibold">
                    <span className={`inline-block w-2 h-2 rounded-full ${TIPO_DOT[t.v]}`} />{t.label}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
                </button>
              ))}
              <div className="pt-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><CalendarDays className="w-3.5 h-3.5" /> Data da contagem</label>
                <Input type="date" value={novaData} onChange={e => setNovaData(e.target.value)} className="w-44" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={comecar}>Começar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ====================== MODO CONTAGEM (mobile) ======================
  const tipoLabel = TIPOS.find(t => t.v === tipoC)?.label || tipoC;
  return (
    <div className="max-w-2xl mx-auto pb-24">
      <div className="flex items-center gap-2 mb-1">
        <Button variant="ghost" size="sm" className="px-2" onClick={() => setMode('tabela')}><ChevronLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <h2 className="text-lg font-bold leading-tight flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${TIPO_DOT[tipoC]}`} />Contagem {tipoLabel}
          </h2>
          <p className="text-xs text-muted-foreground">{fmtData(dataC)}</p>
        </div>
        <span className="text-xs text-muted-foreground">{contados}/{itens.length}</span>
      </div>
      <div className="h-1.5 rounded bg-muted mb-3 overflow-hidden">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${itens.length ? (contados / itens.length) * 100 : 0}%` }} />
      </div>

      <div className="relative mb-2">
        <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
        <Input value={buscaC} onChange={e => setBuscaC(e.target.value)} placeholder="Buscar item…" className="pl-8" />
      </div>
      <div className="flex gap-1.5 mb-3">
        {[{ v: '', l: 'Todas' }, { v: 'bar', l: 'Bar' }, { v: 'cozinha', l: 'Cozinha' }].map(a => (
          <button key={a.v} onClick={() => setAreaC(a.v)}
            className={`text-xs px-2.5 py-1 rounded-full border transition ${areaC === a.v ? 'bg-foreground text-background' : 'hover:bg-muted/50'}`}>
            {a.l}
          </button>
        ))}
      </div>

      {loadingC ? (
        <div className="py-12 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : (
        <div className="space-y-4">
          {itensFiltrados.map(([cat, lista]) => (
            <div key={cat}>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 sticky top-0 bg-background/95 py-1">{cat}</div>
              <div className="divide-y rounded-lg border">
                {lista.map(i => {
                  const v = valores[i.insumo_id] ?? '';
                  const feito = v !== '';
                  return (
                    <div key={i.insumo_id} className={`flex items-center gap-3 px-3 py-2 ${feito ? 'bg-emerald-50/40 dark:bg-emerald-900/10' : ''}`}>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{i.nome}</div>
                        <div className="text-xs text-muted-foreground">
                          {i.unidade_medida || 'un'} · ant: {i.ultimo_final ?? '—'}
                          {feito && i.preco_atual ? <> · <b className="text-foreground">{brl((num(v) ?? 0) * Number(i.preco_atual))}</b></> : null}
                        </div>
                      </div>
                      <Input value={v} onChange={e => setValores(p => ({ ...p, [i.insumo_id]: e.target.value }))}
                        inputMode="decimal" placeholder="0" className={`w-20 text-center text-base h-10 shrink-0 ${feito ? 'border-emerald-400' : ''}`} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {itensFiltrados.length === 0 && <div className="py-8 text-center text-muted-foreground text-sm">Nenhum item.</div>}
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur px-3 py-2.5 z-20">
        <div className="container mx-auto max-w-2xl">
          {valorTotal > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5 px-0.5">
              <span>Valor contado (preço atual)</span><b className="text-foreground tabular-nums">{brl(valorTotal)}</b>
            </div>
          )}
          <Button onClick={salvar} disabled={saving} className="w-full h-11">
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando…</> : <><Save className="w-4 h-4 mr-2" />Salvar contagem ({contados})</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
