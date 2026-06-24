'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Loader2, User, Briefcase, Wallet, FileText } from 'lucide-react';
import type { Funcionario, Opcao } from '../page';

const VAZIO: Record<string, any> = {
  nome: '', cpf: '', telefone: '', email: '', tipo_contratacao: 'CLT',
  cargo_id: '', area_id: '', data_admissao: '', data_nascimento: '', data_demissao: '',
  salario_base: '', valor_diaria: '', vale_transporte_diaria: '', dias_trabalho_semana: '',
  chave_pix: '', tipo_chave_pix: '', observacoes: '', ativo: true,
};

const sel = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

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
      <DialogContent className="max-w-2xl p-0 gap-0 max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            {editando ? 'Editar funcionário' : 'Novo funcionário'}
          </DialogTitle>
          <DialogDescription>
            {editando ? 'Atualize os dados do colaborador.' : 'Preencha os dados para cadastrar um novo colaborador.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Dados pessoais */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <User className="w-3.5 h-3.5" /> Dados pessoais
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs">Nome <span className="text-red-500">*</span></Label>
                <Input value={form.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">CPF</Label>
                <Input value={form.cpf} onChange={(e) => set('cpf', e.target.value)} placeholder="000.000.000-00" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Data de nascimento</Label>
                <Input type="date" value={form.data_nascimento || ''} onChange={(e) => set('data_nascimento', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input value={form.telefone} onChange={(e) => set('telefone', e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="email@exemplo.com" />
              </div>
            </div>
          </section>

          <Separator />

          {/* Contrato */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Briefcase className="w-3.5 h-3.5" /> Contrato
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de contratação</Label>
                <select className={sel} value={form.tipo_contratacao} onChange={(e) => set('tipo_contratacao', e.target.value)}>
                  <option value="CLT">CLT</option><option value="PJ">PJ</option><option value="Freela">Freela</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cargo</Label>
                <select className={sel} value={form.cargo_id} onChange={(e) => set('cargo_id', e.target.value)}>
                  <option value="">—</option>{cargos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Área</Label>
                <select className={sel} value={form.area_id} onChange={(e) => set('area_id', e.target.value)}>
                  <option value="">—</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Data de admissão</Label>
                <Input type="date" value={form.data_admissao || ''} onChange={(e) => set('data_admissao', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{freela ? 'Valor da diária (R$)' : 'Salário base (R$)'}</Label>
                <Input type="number" step="0.01" value={freela ? form.valor_diaria : form.salario_base}
                  onChange={(e) => set(freela ? 'valor_diaria' : 'salario_base', e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Dias de trabalho/semana</Label>
                <Input type="number" value={form.dias_trabalho_semana} onChange={(e) => set('dias_trabalho_semana', e.target.value)} placeholder="Ex: 5" />
              </div>
            </div>
          </section>

          <Separator />

          {/* Pagamento */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Wallet className="w-3.5 h-3.5" /> Pagamento (PIX){freela && <span className="normal-case font-normal text-amber-600">· usado p/ pagar o freela</span>}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Chave PIX</Label>
                <Input value={form.chave_pix} onChange={(e) => set('chave_pix', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo da chave</Label>
                <select className={sel} value={form.tipo_chave_pix} onChange={(e) => set('tipo_chave_pix', e.target.value)}>
                  <option value="">—</option><option value="cpf">CPF</option><option value="cnpj">CNPJ</option>
                  <option value="email">Email</option><option value="telefone">Telefone</option><option value="aleatoria">Aleatória</option>
                </select>
              </div>
            </div>
          </section>

          <Separator />

          {/* Observações + Status */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <FileText className="w-3.5 h-3.5" /> Observações
            </h3>
            <Textarea rows={3} value={form.observacoes || ''} onChange={(e) => set('observacoes', e.target.value)} placeholder="Anotações internas (opcional)" />
            {editando && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs">Data de demissão</Label>
                  <Input type="date" value={form.data_demissao || ''} onChange={(e) => set('data_demissao', e.target.value)} />
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <Switch checked={!!form.ativo} onCheckedChange={(v) => set('ativo', v)} />
                  <Label className="text-sm cursor-pointer">Funcionário ativo</Label>
                </div>
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
            {editando ? 'Salvar alterações' : 'Cadastrar funcionário'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
