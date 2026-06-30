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

// Classe a contar — pré-filtra a tela seguinte (insumo/limpeza/utensílio/produção).
const CLASSES = [
  { v: 'todos', label: 'Todos' },
  { v: 'insumo', label: 'Insumo' },
  { v: 'limpeza', label: 'Limpeza' },
  { v: 'utensilio', label: 'Utensílio' },
  { v: 'producao', label: 'Produção' },
];

// Unidade em que o item é CONTADO (porção, un, ml…). É a instrução pro estoqueista — o resto
// (unidade-base, conversor, preço) é dado interno e não aparece na tela de contar.
const unidadeContagem = (i: ItemContar) => i.unidade_contagem || i.unidade_medida || 'un';
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
  const [novaClasse, setNovaClasse] = useState('todos');
  const [tipoC, setTipoC] = useState('diaria');
  const [dataC, setDataC] = useState(hoje());
  const [classeC, setClasseC] = useState('todos');
  const [itens, setItens] = useState<ItemContar[]>([]);
  // valores chaveados por CÓDIGO (globalmente único: i/L/u = insumo, pc/pd = produção)
  const [valores, setValores] = useState<Record<string, string>>({});
  const [buscaC, setBuscaC] = useState('');
  const [localC, setLocalC] = useState('');
  const [loadingC, setLoadingC] = useState(false);
  const [saving, setSaving] = useState(false);

  const comecar = async () => {
    setTipoC(novoTipo); setDataC(novaData); setClasseC(novaClasse); setModalOpen(false);
    setContando(true); setLoadingC(true); setBuscaC(''); setLocalC('');
    try {
      const res = await api.get(`/api/operacional/contagem/itens?tipo=${novoTipo}&data=${novaData}`);
      const its: ItemContar[] = res.itens || [];
      setItens(its);
      const v: Record<string, string> = {};
      its.forEach(i => { if (i.contado != null) v[i.codigo] = String(i.contado); });
      setValores(v);
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao carregar itens', message: e?.message }); }
    finally { setLoadingC(false); }
  };

  const salvar = async () => {
    const payload = Object.entries(valores).filter(([, v]) => v !== '' && v != null)
      .map(([codigo, v]) => ({ codigo, estoque_final: num(v) }));
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

  // Pré-filtro por classe (escolhido no modal); depois filtra por Local de Contagem + busca.
  const itensClasse = useMemo(() => itens.filter(i => classeC === 'todos' || (i.classe || 'insumo') === classeC), [itens, classeC]);
  const itensFiltrados = useMemo(() => {
    const q = buscaC.trim().toLowerCase();
    return itensClasse.filter(i => (!localC || (i.categoria || '') === localC) && (!q || i.nome.toLowerCase().includes(q)));
  }, [itensClasse, buscaC, localC]);
  // Locais de Contagem presentes na classe escolhida (chips dinâmicos)
  const locais = useMemo(() => {
    const set = new Set<string>();
    itensClasse.forEach(i => { if (i.categoria) set.add(i.categoria); });
    return Array.from(set).sort();
  }, [itensClasse]);
  const contados = useMemo(() => itensClasse.filter(i => { const v = valores[i.codigo]; return v !== '' && v != null; }).length, [itensClasse, valores]);
  const valorTotal = useMemo(() => itensClasse.reduce((s, i) => {
    const q = num(valores[i.codigo] ?? '');
    return s + (q != null ? q * (Number(i.preco_atual) || 0) : 0);
  }, 0), [itensClasse, valores]);

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
              <label className="text-xs text-muted-foreground mb-1 block">O que vai contar?</label>
              <div className="flex flex-wrap gap-1.5">
                {CLASSES.map(c => (
                  <button key={c.v} onClick={() => setNovaClasse(c.v)}
                    className={`text-xs px-2.5 py-1.5 rounded-full border transition ${novaClasse === c.v ? 'bg-foreground text-background' : 'hover:bg-muted/50'}`}>{c.label}</button>
                ))}
              </div>
            </div>
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

      {/* Overlay de contagem (tela cheia, mobile-first) */}
      {contando && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="border-b px-3 py-2.5 flex items-center gap-2">
            <Button variant="ghost" size="sm" className="px-2" onClick={() => setContando(false)}><ChevronLeft className="w-4 h-4" /></Button>
            <div className="flex-1">
              <h2 className="text-lg font-bold leading-tight flex items-center gap-2"><span className={`inline-block w-2 h-2 rounded-full ${TIPO_DOT[tipoC]}`} />Contagem {tipoLabel}</h2>
              <p className="text-xs text-muted-foreground">{fmtData(dataC)}</p>
            </div>
            <span className="text-xs text-muted-foreground">{contados}/{itensClasse.length}</span>
          </div>
          <div className="h-1.5 bg-muted overflow-hidden"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${itensClasse.length ? (contados / itensClasse.length) * 100 : 0}%` }} /></div>

          {/* Busca + Local de Contagem (filtro) — o estoqueista escolhe o local e conta só ele */}
          <div className="px-3 py-2 space-y-2 border-b">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input value={buscaC} onChange={e => setBuscaC(e.target.value)} placeholder="Buscar item…" className="pl-8 h-9" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {[{ v: '', l: 'Todos' }, ...locais.map(l => ({ v: l, l }))].map(a => (
                <button key={a.v} onClick={() => setLocalC(a.v)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${localC === a.v ? 'bg-foreground text-background' : 'hover:bg-muted/50'}`}>{a.l}</button>
              ))}
            </div>
          </div>

          {/* Lista enxuta: só Item (+ unidade de contagem) e o campo. O resto é dado interno. */}
          <div className="flex-1 overflow-auto">
            {loadingC ? (
              <div className="py-12 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
            ) : itensFiltrados.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">Nenhum item.</div>
            ) : (
              <ul className="divide-y">
                {itensFiltrados.map(i => {
                  const v = valores[i.codigo] ?? '';
                  const feito = v !== '';
                  return (
                    <li key={i.codigo} className={`flex items-center gap-3 px-3 py-2 ${feito ? 'bg-emerald-50/40 dark:bg-emerald-900/10' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium leading-tight">{i.nome}</div>
                        <div className="text-[11px] text-muted-foreground">conta em {unidadeContagem(i)}</div>
                      </div>
                      <Input value={v} onChange={e => setValores(p => ({ ...p, [i.codigo]: e.target.value }))}
                        inputMode="decimal" placeholder="0" className={`w-24 text-center h-10 shrink-0 ${feito ? 'border-emerald-400' : ''}`} />
                    </li>
                  );
                })}
              </ul>
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
