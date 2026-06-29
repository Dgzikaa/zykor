'use client';

import { useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { api } from '@/lib/api-client';
import { Search, Loader2, Save, ChevronLeft, Plus, CalendarDays } from 'lucide-react';

type ItemContar = {
  insumo_id: number; codigo: string; nome: string; categoria: string | null; tipo_local: string | null;
  classe: string | null; unidade_medida: string | null; unidade_contagem: string | null; fator_contagem: number | null;
  frequencia: string | null; preco_atual: number | null;
  ultimo_final: number | null; contado: number | null;
};

const TIPOS = [
  { v: 'diaria', label: 'Diária', desc: 'Itens de giro alto, contados todo dia.' },
  { v: 'semanal', label: 'Semanal', desc: 'Diários + os de contagem semanal (segundas).' },
  { v: 'mensal', label: 'Mensal', desc: 'Inventário completo (todo dia 1º).' },
];

// Rótulos dos Locais de Contagem (tipo_local). Itens novos podem ter qualquer um.
const LOCAL_LABEL: Record<string, string> = {
  bar: 'Bar', cozinha: 'Cozinha', salao: 'Salão', drink: 'Drink',
  uniformes: 'Uniformes', limpeza: 'Limpeza', almoxarifado: 'Almoxarifado',
};
const localLabel = (l: string | null) => (l ? LOCAL_LABEL[l] || l : '—');

// Coluna conversora "Unidade de Contagem": o que você conta vs. a unidade-base.
const convLabel = (i: ItemContar) => {
  const uc = i.unidade_contagem || i.unidade_medida || 'un';
  const f = Number(i.fator_contagem) || 1;
  return f !== 1 ? `${uc} (×${f} ${i.unidade_medida || 'un'})` : uc;
};
const TIPO_DOT: Record<string, string> = { mensal: 'bg-purple-500', semanal: 'bg-blue-500', diaria: 'bg-muted-foreground/40' };
const hoje = () => new Date().toISOString().slice(0, 10);
const num = (v: string) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));
const brl = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
const fmtData = (iso: string) => iso.split('-').reverse().join('/');

/** Botão "Fazer contagem" + fluxo completo (modal tipo/data → contagem → salvar). Reutilizável. */
export function FazerContagem({ onSaved }: { onSaved?: () => void }) {
  const { selectedBar } = useBar();
  const { showToast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [contando, setContando] = useState(false);
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

  const comecar = async () => {
    setTipoC(novoTipo); setDataC(novaData); setModalOpen(false);
    setContando(true); setLoadingC(true); setBuscaC(''); setAreaC('');
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
      setContando(false);
      onSaved?.();
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao salvar', message: e?.message }); }
    finally { setSaving(false); }
  };

  const itensFiltrados = useMemo(() => {
    const q = buscaC.trim().toLowerCase();
    return itens.filter(i => (!areaC || i.tipo_local === areaC) && (!q || i.nome.toLowerCase().includes(q)));
  }, [itens, buscaC, areaC]);
  // Locais de Contagem presentes nos itens carregados (dinâmico — cobre os locais novos)
  const locais = useMemo(() => {
    const set = new Set<string>();
    itens.forEach(i => { if (i.tipo_local) set.add(i.tipo_local); });
    return Array.from(set).sort();
  }, [itens]);
  const contados = useMemo(() => Object.values(valores).filter(v => v !== '' && v != null).length, [valores]);
  const valorTotal = useMemo(() => itens.reduce((s, i) => {
    const q = num(valores[i.insumo_id] ?? '');
    return s + (q != null ? q * (Number(i.preco_atual) || 0) : 0);
  }, 0), [itens, valores]);

  const tipoLabel = TIPOS.find(t => t.v === tipoC)?.label || tipoC;

  return (
    <>
      <Button onClick={() => { setNovoTipo('diaria'); setNovaData(hoje()); setModalOpen(true); }} disabled={!selectedBar?.id} className="gap-1.5">
        <Plus className="w-4 h-4" /> Fazer contagem
      </Button>

      {/* Modal: tipo + data */}
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
                <div className="flex items-center gap-2 font-semibold"><span className={`inline-block w-2 h-2 rounded-full ${TIPO_DOT[t.v]}`} />{t.label}</div>
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

      {/* Overlay de contagem (tela cheia) */}
      {contando && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="border-b px-3 py-2.5 flex items-center gap-2">
            <Button variant="ghost" size="sm" className="px-2" onClick={() => setContando(false)}><ChevronLeft className="w-4 h-4" /></Button>
            <div className="flex-1">
              <h2 className="text-lg font-bold leading-tight flex items-center gap-2"><span className={`inline-block w-2 h-2 rounded-full ${TIPO_DOT[tipoC]}`} />Contagem {tipoLabel}</h2>
              <p className="text-xs text-muted-foreground">{fmtData(dataC)}</p>
            </div>
            <span className="text-xs text-muted-foreground">{contados}/{itens.length}</span>
          </div>
          <div className="h-1.5 bg-muted overflow-hidden"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${itens.length ? (contados / itens.length) * 100 : 0}%` }} /></div>

          <div className="px-3 py-2 flex flex-wrap items-center gap-2 border-b">
            <div className="relative flex-1 min-w-[12rem] max-w-md">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input value={buscaC} onChange={e => setBuscaC(e.target.value)} placeholder="Buscar item…" className="pl-8 h-9" />
            </div>
            {[{ v: '', l: 'Todos' }, ...locais.map(l => ({ v: l, l: localLabel(l) }))].map(a => (
              <button key={a.v} onClick={() => setAreaC(a.v)}
                className={`text-xs px-2.5 py-1.5 rounded-full border transition ${areaC === a.v ? 'bg-foreground text-background' : 'hover:bg-muted/50'}`}>{a.l}</button>
            ))}
          </div>

          <div className="flex-1 overflow-auto">
            {loadingC ? (
              <div className="py-12 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/40 text-left text-muted-foreground">
                    <th className="sticky left-0 top-0 z-30 bg-muted/40 px-3 py-2 font-medium min-w-[14rem] border-r">Item</th>
                    <th className="sticky top-0 z-20 bg-muted/40 px-3 py-2 font-medium">Local</th>
                    <th className="sticky top-0 z-20 bg-muted/40 px-3 py-2 font-medium">Unid.</th>
                    <th className="sticky top-0 z-20 bg-muted/40 px-3 py-2 font-medium">Un. Contagem</th>
                    <th className="sticky top-0 z-20 bg-muted/40 px-3 py-2 font-medium text-right">Anterior</th>
                    <th className="sticky top-0 z-20 bg-muted/40 px-3 py-2 font-medium text-right w-32">Contagem</th>
                  </tr>
                </thead>
                <tbody>
                  {itensFiltrados.map(i => {
                    const v = valores[i.insumo_id] ?? '';
                    const feito = v !== '';
                    return (
                      <tr key={i.insumo_id} className={`border-b ${feito ? 'bg-emerald-50/40 dark:bg-emerald-900/10' : 'hover:bg-muted/20'}`}>
                        <td className="sticky left-0 z-10 bg-background px-3 py-1.5 border-r">
                          <div className="font-medium leading-tight">{i.nome}</div>
                          <div className="text-xs text-muted-foreground">{i.categoria || '—'}</div>
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">{localLabel(i.tipo_local)}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{i.unidade_medida || 'un'}</td>
                        <td className="px-3 py-1.5 text-muted-foreground text-xs">{convLabel(i)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{i.ultimo_final ?? '—'}</td>
                        <td className="px-3 py-1.5 text-right">
                          <Input value={v} onChange={e => setValores(p => ({ ...p, [i.insumo_id]: e.target.value }))}
                            inputMode="decimal" placeholder="0" className={`w-24 text-center h-9 ml-auto ${feito ? 'border-emerald-400' : ''}`} />
                        </td>
                      </tr>
                    );
                  })}
                  {itensFiltrados.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">Nenhum item.</td></tr>}
                </tbody>
              </table>
            )}
          </div>

          <div className="border-t bg-background/95 backdrop-blur px-3 py-2.5">
            <div className="container mx-auto max-w-3xl">
              {valorTotal > 0 && <div className="flex justify-between text-xs text-muted-foreground mb-1.5 px-0.5"><span>Valor contado (preço atual)</span><b className="text-foreground tabular-nums">{brl(valorTotal)}</b></div>}
              <Button onClick={salvar} disabled={saving} className="w-full h-11">
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando…</> : <><Save className="w-4 h-4 mr-2" />Salvar contagem ({contados})</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
