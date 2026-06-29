'use client';

import { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api-client';
import { Loader2, Plus, Pencil, Trash2, X } from 'lucide-react';

type Item = {
  id: number; codigo: string; nome: string; categoria: string | null; secao: string | null;
  estoque_ideal: number | null; estoque_min: number | null; estoque_max: number | null; custo_unitario: number | null;
  unidade_contagem: string | null; fator_contagem: number | null;
};

const CATS_LIMPEZA = ['Descartáveis', 'Limpeza', 'Utensílios de Limpeza', 'Outros'];
const SECOES_UTENS = ['COZINHA', 'DRINK', 'SALÃO', 'UNIFORMES'];
const vazio = { nome: '', categoria: '', secao: '', estoque_ideal: '', estoque_min: '', estoque_max: '', preco: '', unidade_contagem: '', fator_contagem: '' };

/** Modal de cadastro/edição dos itens de uma classe (limpeza|utensilio). Código auto-gerado. */
export function GerenciarItensModal({
  classe, open, onClose, onChanged,
}: { classe: 'limpeza' | 'utensilio'; open: boolean; onClose: () => void; onChanged: () => void }) {
  const { toast } = useToast();
  const isUtensilio = classe === 'utensilio';
  const [itens, setItens] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...vazio });
  const [saving, setSaving] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/api/operacional/estoque-cadastro?classe=${classe}`);
      if (r.success) setItens(r.itens || []);
    } finally { setLoading(false); }
  }, [classe]);

  useEffect(() => { if (open) { carregar(); setEditId(null); setForm({ ...vazio }); } }, [open, carregar]);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const salvar = async () => {
    if (!form.nome.trim()) return toast({ title: 'Informe o nome', variant: 'destructive' });
    setSaving(true);
    try {
      const payload: any = {
        action: editId ? 'editar' : 'criar', id: editId ?? undefined, classe,
        nome: form.nome, preco: form.preco,
        unidade_contagem: form.unidade_contagem || undefined, fator_contagem: form.fator_contagem || undefined,
      };
      if (isUtensilio) { payload.secao = form.secao || 'COZINHA'; payload.estoque_min = form.estoque_min; payload.estoque_max = form.estoque_max; }
      else { payload.categoria = form.categoria || 'Limpeza'; payload.estoque_ideal = form.estoque_ideal; }
      const r = await api.post('/api/operacional/estoque-cadastro', payload);
      if (!r.success) throw new Error(r.error);
      toast({ title: editId ? 'Item atualizado' : `Item criado (${r.codigo})` });
      setEditId(null); setForm({ ...vazio });
      await carregar(); onChanged();
    } catch (e: any) { toast({ title: 'Erro ao salvar', description: e?.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const editar = (i: Item) => {
    setEditId(i.id);
    setForm({
      nome: i.nome || '', categoria: i.categoria || '', secao: i.secao || '',
      estoque_ideal: i.estoque_ideal == null ? '' : String(i.estoque_ideal),
      estoque_min: i.estoque_min == null ? '' : String(i.estoque_min),
      estoque_max: i.estoque_max == null ? '' : String(i.estoque_max),
      preco: i.custo_unitario == null ? '' : String(i.custo_unitario),
      unidade_contagem: i.unidade_contagem || '',
      fator_contagem: i.fator_contagem == null ? '' : String(i.fator_contagem),
    });
  };

  const excluir = async (i: Item) => {
    if (!confirm(`Excluir "${i.nome}"?`)) return;
    try {
      const r = await api.post('/api/operacional/estoque-cadastro', { action: 'excluir', id: i.id });
      if (!r.success) throw new Error(r.error);
      toast({ title: 'Item excluído' });
      await carregar(); onChanged();
    } catch (e: any) { toast({ title: 'Erro ao excluir', description: e?.message, variant: 'destructive' }); }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar itens — {isUtensilio ? 'Utensílios' : 'Limpeza'}</DialogTitle>
          <DialogDescription>Código gerado automaticamente ({isUtensilio ? 'u0XXX' : 'd0XXX'}).</DialogDescription>
        </DialogHeader>

        {/* Form add/edit */}
        <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{editId ? 'Editar item' : 'Novo item'}</span>
            {editId && <button onClick={() => { setEditId(null); setForm({ ...vazio }); }} className="text-xs text-muted-foreground flex items-center gap-1"><X className="w-3 h-3" />cancelar edição</button>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground">Nome</label>
              <Input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Nome do item" className="h-9" />
            </div>
            {isUtensilio ? (
              <div>
                <label className="text-xs text-muted-foreground">Seção (Local)</label>
                <select value={form.secao} onChange={e => set('secao', e.target.value)} className="w-full h-9 rounded-md border bg-background px-2 text-sm">
                  <option value="">Selecione…</option>
                  {SECOES_UTENS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="text-xs text-muted-foreground">Categoria</label>
                <select value={form.categoria} onChange={e => set('categoria', e.target.value)} className="w-full h-9 rounded-md border bg-background px-2 text-sm">
                  <option value="">Selecione…</option>
                  {CATS_LIMPEZA.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground">Preço (R$)</label>
              <Input value={form.preco} onChange={e => set('preco', e.target.value)} inputMode="decimal" placeholder="0,00" className="h-9" />
            </div>
            {isUtensilio ? (
              <>
                <div><label className="text-xs text-muted-foreground">Est. Mín</label><Input value={form.estoque_min} onChange={e => set('estoque_min', e.target.value)} inputMode="decimal" placeholder="—" className="h-9" /></div>
                <div><label className="text-xs text-muted-foreground">Est. Máx</label><Input value={form.estoque_max} onChange={e => set('estoque_max', e.target.value)} inputMode="decimal" placeholder="—" className="h-9" /></div>
              </>
            ) : (
              <div><label className="text-xs text-muted-foreground">Estoque Ideal</label><Input value={form.estoque_ideal} onChange={e => set('estoque_ideal', e.target.value)} inputMode="decimal" placeholder="—" className="h-9" /></div>
            )}
            <div><label className="text-xs text-muted-foreground">Conta em</label><Input value={form.unidade_contagem} onChange={e => set('unidade_contagem', e.target.value)} placeholder="unid / caixa / pct" className="h-9" /></div>
            <div><label className="text-xs text-muted-foreground">Contém (qtd base)</label><Input value={form.fator_contagem} onChange={e => set('fator_contagem', e.target.value)} inputMode="decimal" placeholder="1" className="h-9" /></div>
          </div>
          <p className="text-[11px] text-muted-foreground">Preço é por <b>unidade base</b>. Ex.: Canudo cx c/ 20 → conta em &ldquo;caixa&rdquo;, contém 20, preço 16,54/unid.</p>
          <Button onClick={salvar} disabled={saving} size="sm" className="gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editId ? 'Salvar alterações' : 'Adicionar'}
          </Button>
        </div>

        {/* Lista */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase"><tr>
              <th className="text-left px-2 py-1.5 font-medium">Cód.</th>
              <th className="text-left px-2 py-1.5 font-medium">Nome</th>
              <th className="text-left px-2 py-1.5 font-medium">{isUtensilio ? 'Seção' : 'Categoria'}</th>
              <th className="text-right px-2 py-1.5 font-medium">{isUtensilio ? 'Mín/Máx' : 'Ideal'}</th>
              <th className="text-right px-2 py-1.5 font-medium">Preço</th>
              <th className="px-2 py-1.5"></th>
            </tr></thead>
            <tbody className="divide-y">
              {loading ? <tr><td colSpan={6} className="py-6 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              : itens.length === 0 ? <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Nenhum item.</td></tr>
              : itens.map(i => (
                <tr key={i.id} className="hover:bg-muted/20">
                  <td className="px-2 py-1.5 font-mono text-xs text-muted-foreground">{i.codigo}</td>
                  <td className="px-2 py-1.5">{i.nome}</td>
                  <td className="px-2 py-1.5 text-muted-foreground text-xs">{(isUtensilio ? i.secao : i.categoria) || '—'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-xs text-muted-foreground">{isUtensilio ? `${i.estoque_min ?? '—'} / ${i.estoque_max ?? '—'}` : (i.estoque_ideal ?? '—')}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{i.custo_unitario ? Number(i.custo_unitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap">
                    <button onClick={() => editar(i)} className="text-muted-foreground hover:text-foreground p-1"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => excluir(i)} className="text-muted-foreground hover:text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
