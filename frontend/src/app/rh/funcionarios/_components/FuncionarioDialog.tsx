'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Loader2 } from 'lucide-react';
import type { Funcionario, Opcao } from '../page';

const VAZIO: Record<string, any> = {
  nome: '', cpf: '', telefone: '', email: '', tipo_contratacao: 'CLT',
  cargo_id: '', area_id: '', data_admissao: '', data_nascimento: '', data_demissao: '',
  salario_base: '', valor_diaria: '', vale_transporte_diaria: '', dias_trabalho_semana: '',
  chave_pix: '', tipo_chave_pix: '', observacoes: '', ativo: true,
};

const sel = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';

export function FuncionarioDialog({ open, onClose, onSalvo, cargos, areas, funcionario }: {
  open: boolean; onClose: () => void; onSalvo: () => void;
  cargos: Opcao[]; areas: Opcao[]; funcionario: Funcionario | null;
}) {
  const { showToast } = useToast();
  const [form, setForm] = useState<Record<string, any>>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const editando = !!funcionario;

  useEffect(() => {
    if (!open) return;
    if (funcionario) {
      const f: Record<string, any> = { ...VAZIO };
      for (const k of Object.keys(VAZIO)) f[k] = (funcionario as any)[k] ?? (k === 'ativo' ? true : '');
      setForm(f);
    } else setForm(VAZIO);
  }, [open, funcionario]);

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));
  const freela = form.tipo_contratacao === 'Freela';

  const salvar = async () => {
    if (!String(form.nome).trim()) { showToast({ type: 'error', title: 'Nome é obrigatório' }); return; }
    setSalvando(true);
    try {
      const payload = { ...form };
      ['cargo_id', 'area_id'].forEach((k) => { payload[k] = payload[k] ? Number(payload[k]) : null; });
      ['salario_base', 'valor_diaria', 'vale_transporte_diaria', 'dias_trabalho_semana'].forEach((k) => {
        payload[k] = payload[k] === '' || payload[k] == null ? null : Number(payload[k]);
      });
      if (editando) await api.put(`/api/rh/funcionarios/${funcionario!.id}`, payload);
      else await api.post('/api/rh/funcionarios', payload);
      showToast({ type: 'success', title: editando ? 'Funcionário atualizado' : 'Funcionário cadastrado' });
      onSalvo();
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao salvar', message: e?.message }); }
    finally { setSalvando(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editando ? 'Editar funcionário' : 'Novo funcionário'}</DialogTitle></DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label className="text-xs mb-1 block">Nome *</Label>
            <Input value={form.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Nome completo" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">CPF</Label>
            <Input value={form.cpf} onChange={(e) => set('cpf', e.target.value)} placeholder="000.000.000-00" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Tipo de contratação</Label>
            <select className={sel} value={form.tipo_contratacao} onChange={(e) => set('tipo_contratacao', e.target.value)}>
              <option value="CLT">CLT</option><option value="PJ">PJ</option><option value="Freela">Freela</option>
            </select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Cargo</Label>
            <select className={sel} value={form.cargo_id} onChange={(e) => set('cargo_id', e.target.value)}>
              <option value="">—</option>{cargos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Área</Label>
            <select className={sel} value={form.area_id} onChange={(e) => set('area_id', e.target.value)}>
              <option value="">—</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Data de admissão</Label>
            <Input type="date" value={form.data_admissao || ''} onChange={(e) => set('data_admissao', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Data de nascimento</Label>
            <Input type="date" value={form.data_nascimento || ''} onChange={(e) => set('data_nascimento', e.target.value)} />
          </div>
          {freela ? (
            <div>
              <Label className="text-xs mb-1 block">Valor da diária (R$)</Label>
              <Input type="number" step="0.01" value={form.valor_diaria} onChange={(e) => set('valor_diaria', e.target.value)} />
            </div>
          ) : (
            <div>
              <Label className="text-xs mb-1 block">Salário base (R$)</Label>
              <Input type="number" step="0.01" value={form.salario_base} onChange={(e) => set('salario_base', e.target.value)} />
            </div>
          )}
          <div>
            <Label className="text-xs mb-1 block">Dias de trabalho/semana</Label>
            <Input type="number" value={form.dias_trabalho_semana} onChange={(e) => set('dias_trabalho_semana', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Telefone</Label>
            <Input value={form.telefone} onChange={(e) => set('telefone', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Email</Label>
            <Input value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Chave PIX {freela && '(p/ pagamento)'}</Label>
            <Input value={form.chave_pix} onChange={(e) => set('chave_pix', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Tipo da chave</Label>
            <select className={sel} value={form.tipo_chave_pix} onChange={(e) => set('tipo_chave_pix', e.target.value)}>
              <option value="">—</option><option value="cpf">CPF</option><option value="cnpj">CNPJ</option>
              <option value="email">Email</option><option value="telefone">Telefone</option><option value="aleatoria">Aleatória</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs mb-1 block">Observações</Label>
            <textarea className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" rows={2}
              value={form.observacoes || ''} onChange={(e) => set('observacoes', e.target.value)} />
          </div>
          {editando && (
            <>
              <div>
                <Label className="text-xs mb-1 block">Data de demissão</Label>
                <Input type="date" value={form.data_demissao || ''} onChange={(e) => set('data_demissao', e.target.value)} />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!form.ativo} onChange={(e) => set('ativo', e.target.checked)} />
                  Ativo
                </label>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button size="sm" onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
            {editando ? 'Salvar' : 'Cadastrar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
