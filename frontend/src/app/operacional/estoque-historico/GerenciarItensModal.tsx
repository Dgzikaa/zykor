'use client';

import { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api-client';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';

type CatalogoItem = {
  id: number; codigo: string; nome: string; categoria: string | null; secao: string | null;
  estoque_ideal: number | null; estoque_min: number | null; estoque_max: number | null; custo_unitario: number | null;
  unidade_contagem: string | null; fator_contagem: number | null;
};

const CATS_LIMPEZA = ['Descartáveis', 'Limpeza', 'Utensílios de Limpeza', 'Outros'];
const SECOES_UTENS = ['COZINHA', 'DRINK', 'SALÃO', 'UNIFORMES'];
const vazio = { nome: '', categoria: '', secao: '', estoque_ideal: '', estoque_min: '', estoque_max: '', preco: '', unidade_contagem: '', fator_contagem: '' };

/**
 * Modal só de cadastro (form). Adiciona um item novo ou edita um existente (quando
 * `editCodigo` é passado). A lista do catálogo já aparece na tabela principal.
 */
export function CadastrarItemModal({
  classe, open, editCodigo, onClose, onSaved,
}: { classe: 'limpeza' | 'utensilio'; open: boolean; editCodigo: string | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const isUtensilio = classe === 'utensilio';
  const [form, setForm] = useState({ ...vazio });
  const [editId, setEditId] = useState<number | null>(null);
  const [editNome, setEditNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Ao abrir: form em branco (adicionar) ou carrega o item do código (editar).
  const prepara = useCallback(async () => {
    setForm({ ...vazio }); setEditId(null); setEditNome('');
    if (!editCodigo) return;
    setLoading(true);
    try {
      const r = await api.get(`/api/operacional/estoque-cadastro?classe=${classe}`);
      const alvo = editCodigo.toUpperCase();
      const it: CatalogoItem | undefined = (r.itens || []).find((i: CatalogoItem) => String(i.codigo).toUpperCase() === alvo);
      if (it) {
        setEditId(it.id); setEditNome(it.nome);
        setForm({
          nome: it.nome || '', categoria: it.categoria || '', secao: it.secao || '',
          estoque_ideal: it.estoque_ideal == null ? '' : String(it.estoque_ideal),
          estoque_min: it.estoque_min == null ? '' : String(it.estoque_min),
          estoque_max: it.estoque_max == null ? '' : String(it.estoque_max),
          preco: it.custo_unitario == null ? '' : String(it.custo_unitario),
          unidade_contagem: it.unidade_contagem || '',
          fator_contagem: it.fator_contagem == null ? '' : String(it.fator_contagem),
        });
      }
    } finally { setLoading(false); }
  }, [classe, editCodigo]);

  useEffect(() => { if (open) prepara(); }, [open, prepara]);

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
      onSaved(); onClose();
    } catch (e: any) { toast({ title: 'Erro ao salvar', description: e?.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const excluir = async () => {
    if (!editId || !confirm(`Excluir "${editNome}"?`)) return;
    setSaving(true);
    try {
      const r = await api.post('/api/operacional/estoque-cadastro', { action: 'excluir', id: editId });
      if (!r.success) throw new Error(r.error);
      toast({ title: 'Item excluído' });
      onSaved(); onClose();
    } catch (e: any) { toast({ title: 'Erro ao excluir', description: e?.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editId ? `Editar — ${editNome}` : `Adicionar item — ${isUtensilio ? 'Utensílios' : 'Limpeza'}`}</DialogTitle>
          <DialogDescription>{editId ? 'Altere os campos do item.' : `Código gerado automaticamente (${isUtensilio ? 'u0XXX' : 'd0XXX'}).`}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        ) : (
          <div className="space-y-2">
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
                <label className="text-xs text-muted-foreground">Preço (R$ por unidade base)</label>
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

            <div className="flex items-center gap-2 pt-1">
              <Button onClick={salvar} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {editId ? 'Salvar' : 'Adicionar'}
              </Button>
              {editId && (
                <Button onClick={excluir} disabled={saving} variant="outline" className="gap-1.5 text-red-500 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />Excluir
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
