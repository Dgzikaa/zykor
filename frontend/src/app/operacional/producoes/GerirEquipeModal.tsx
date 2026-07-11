'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, X, Users, Pencil } from 'lucide-react';

export function GerirEquipeModal({ barId, responsaveis, podeInserir, podeEditar, podeExcluir, onClose, onChanged }: {
  barId: number; responsaveis: any[]; podeInserir: boolean; podeEditar: boolean; podeExcluir: boolean;
  onClose: () => void; onChanged: () => void;
}) {
  const { toast } = useToast();
  const [novoNome, setNovoNome] = useState('');
  const [novoCargo, setNovoCargo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editCargo, setEditCargo] = useState('');

  const adicionar = async () => {
    const nome = novoNome.trim();
    if (!nome) { toast({ title: 'Informe o nome', variant: 'destructive' }); return; }
    setSalvando(true);
    const r = await api.post('/api/operacional/pessoas-responsaveis', { bar_id: barId, nome, cargo: novoCargo.trim() || null });
    setSalvando(false);
    if (r.success) { setNovoNome(''); setNovoCargo(''); onChanged(); }
    else toast({ title: 'Erro ao adicionar', description: r.error, variant: 'destructive' });
  };

  const iniciarEdicao = (p: any) => { setEditId(p.id); setEditNome(p.nome); setEditCargo(p.cargo || ''); };
  const salvarEdicao = async () => {
    const nome = editNome.trim();
    if (!nome) { toast({ title: 'Informe o nome', variant: 'destructive' }); return; }
    setSalvando(true);
    const r = await api.put('/api/operacional/pessoas-responsaveis', { id: editId, nome, cargo: editCargo.trim() || null });
    setSalvando(false);
    if (r.success) { setEditId(null); onChanged(); }
    else toast({ title: 'Erro ao salvar', description: r.error, variant: 'destructive' });
  };

  const desativar = async (p: any) => {
    setSalvando(true);
    const r = await api.delete(`/api/operacional/pessoas-responsaveis?id=${p.id}`);
    setSalvando(false);
    if (r.success) onChanged();
    else toast({ title: 'Erro ao remover', description: r.error, variant: 'destructive' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Gerir equipe de produção</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-5 h-5" /></button>
        </div>

        {/* Adicionar — só quem tem Inserir */}
        {podeInserir && (
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
            <p className="text-xs font-medium text-gray-500 mb-2">Adicionar pessoa</p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-[11px] text-gray-400">Nome *</label>
                <Input value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Nome completo"
                  onKeyDown={e => { if (e.key === 'Enter') adicionar(); }} />
              </div>
              <div className="w-36">
                <label className="text-[11px] text-gray-400">Cargo</label>
                <Input value={novoCargo} onChange={e => setNovoCargo(e.target.value)} placeholder="Ex.: Cozinha"
                  onKeyDown={e => { if (e.key === 'Enter') adicionar(); }} />
              </div>
              <Button onClick={adicionar} disabled={salvando} className="gap-1.5">
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Adicionar
              </Button>
            </div>
          </div>
        )}

        {/* Lista */}
        <div className="max-h-80 overflow-y-auto px-5 py-3">
          {responsaveis.length === 0 && <p className="text-sm text-gray-400 py-6 text-center">Nenhuma pessoa cadastrada ainda.</p>}
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {responsaveis.map(p => (
              <li key={p.id} className="py-2 flex items-center gap-2">
                {editId === p.id ? (
                  <>
                    <Input value={editNome} onChange={e => setEditNome(e.target.value)} className="flex-1 h-8" />
                    <Input value={editCargo} onChange={e => setEditCargo(e.target.value)} placeholder="Cargo" className="w-28 h-8" />
                    <Button size="sm" onClick={salvarEdicao} disabled={salvando} className="h-8">Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditId(null)} className="h-8">Cancelar</Button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-900 dark:text-white">{p.nome}</span>
                      {p.cargo && <span className="text-xs text-gray-400 ml-2">{p.cargo}</span>}
                    </div>
                    {podeEditar && (
                      <button onClick={() => iniciarEdicao(p)} title="Editar"
                        className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"><Pencil className="w-4 h-4" /></button>
                    )}
                    {podeExcluir && (
                      <button onClick={() => desativar(p)} disabled={salvando} title="Remover"
                        className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
