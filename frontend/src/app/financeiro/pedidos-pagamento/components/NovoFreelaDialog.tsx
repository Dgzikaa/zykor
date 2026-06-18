'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Loader2, Search, Check } from 'lucide-react';

const FUNCOES = ['Atendimento', 'Bar', 'Cozinha', 'Limpeza', 'Brigadista', 'Segurança', 'Outro'];
const TIPOS_CHAVE = ['cpf', 'cnpj', 'email', 'telefone', 'aleatoria'];

type CandidatoCA = { contaazul_id: string; nome: string; documento: string | null; ja_vinculado: boolean };

export function NovoFreelaDialog({
  open, onOpenChange, onCriado,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCriado: () => void }) {
  const { showToast } = useToast();
  const [salvando, setSalvando] = useState(false);

  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [funcao, setFuncao] = useState('Atendimento');
  const [chavePix, setChavePix] = useState('');
  const [tipoChave, setTipoChave] = useState('cpf');
  const [valorPadrao, setValorPadrao] = useState('');
  const [contaazulPessoaId, setContaazulPessoaId] = useState<string | null>(null);

  // Busca no Conta Azul (evita duplicado)
  const [buscando, setBuscando] = useState(false);
  const [candidatos, setCandidatos] = useState<CandidatoCA[]>([]);

  const reset = () => {
    setNome(''); setCpf(''); setFuncao('Atendimento'); setChavePix(''); setTipoChave('cpf');
    setValorPadrao(''); setContaazulPessoaId(null); setCandidatos([]);
  };

  const buscarCA = async () => {
    if (nome.trim().length < 2) return;
    setBuscando(true);
    try {
      const res = await api.get(`/api/financeiro/beneficiarios/buscar-ca?q=${encodeURIComponent(nome.trim())}`);
      setCandidatos(res.candidatos || []);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro na busca', message: e?.message });
    } finally {
      setBuscando(false);
    }
  };

  const vincular = (c: CandidatoCA) => {
    setContaazulPessoaId(c.contaazul_id);
    setNome(c.nome);
    if (c.documento) setCpf(c.documento);
    setCandidatos([]);
  };

  const submit = async () => {
    if (!nome.trim()) return showToast({ type: 'error', title: 'Nome é obrigatório' });
    if (!chavePix.trim()) return showToast({ type: 'error', title: 'Chave PIX é obrigatória' });
    setSalvando(true);
    try {
      await api.post('/api/financeiro/beneficiarios', {
        nome: nome.trim(),
        cpf_cnpj: cpf.trim() || null,
        tipo: 'freela',
        funcao,
        chave_pix: chavePix.trim(),
        tipo_chave: tipoChave,
        valor_padrao: valorPadrao ? Number(valorPadrao.replace('.', '').replace(',', '.')) : null,
        contaazul_pessoa_id: contaazulPessoaId,
      });
      showToast({ type: 'success', title: 'Freela cadastrado' });
      reset();
      onOpenChange(false);
      onCriado();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao salvar', message: e?.message });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!salvando) onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo freela</DialogTitle>
          <DialogDescription>Busca no Conta Azul pra reaproveitar o fornecedor e não duplicar a base.</DialogDescription>
        </DialogHeader>

        <div className="px-6 overflow-y-auto space-y-4">
          <div>
            <Label className="mb-1.5 block">Nome</Label>
            <div className="flex gap-2">
              <Input value={nome} onChange={(e) => { setNome(e.target.value); setContaazulPessoaId(null); }} placeholder="Nome do freela" />
              <Button type="button" variant="outline" onClick={buscarCA} disabled={buscando} title="Buscar no Conta Azul">
                {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            {contaazulPessoaId && (
              <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1"><Check className="w-3 h-3" /> Vinculado a um fornecedor já existente no Conta Azul.</p>
            )}
            {candidatos.length > 0 && (
              <div className="mt-2 border rounded-md divide-y max-h-40 overflow-y-auto">
                {candidatos.map((c) => (
                  <button key={c.contaazul_id} type="button" onClick={() => vincular(c)}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/40 flex items-center justify-between">
                    <span className="truncate">{c.nome} {c.documento ? <span className="text-muted-foreground">· {c.documento}</span> : ''}</span>
                    {c.ja_vinculado && <span className="text-[10px] text-amber-600 shrink-0">já vinculado</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block">CPF/CNPJ</Label>
              <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="só números" inputMode="numeric" />
            </div>
            <div>
              <Label className="mb-1.5 block">Função</Label>
              <select value={funcao} onChange={(e) => setFuncao(e.target.value)} className="h-9 w-full text-sm border rounded px-2 bg-background">
                {FUNCOES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block">Chave PIX <span className="text-red-500">*</span></Label>
              <Input value={chavePix} onChange={(e) => setChavePix(e.target.value)} placeholder="chave PIX" />
            </div>
            <div>
              <Label className="mb-1.5 block">Tipo da chave</Label>
              <select value={tipoChave} onChange={(e) => setTipoChave(e.target.value)} className="h-9 w-full text-sm border rounded px-2 bg-background">
                {TIPOS_CHAVE.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">Valor padrão por noite <span className="text-muted-foreground text-xs">(opcional, editável no lançamento)</span></Label>
            <Input value={valorPadrao} onChange={(e) => setValorPadrao(e.target.value)} placeholder="0,00" inputMode="decimal" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={submit} disabled={salvando}>
            {salvando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : 'Cadastrar freela'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
