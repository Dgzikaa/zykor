'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { Loader2 } from 'lucide-react';

export interface CadastrarFornecedorModalProps {
  isOpen: boolean;
  onClose: () => void;
  barId: number | null | undefined;
  initialNome?: string;
  initialPix?: string;
  /** Chamado após criação bem-sucedida no CA — recebe o pessoa criada. */
  onCadastrado: (pessoa: {
    contaazul_id: string;
    nome: string;
    documento: string | null;
  }) => void;
}

function detectarDocumento(pix: string): string {
  const digits = String(pix || '').replace(/\D/g, '');
  if (digits.length === 11 || digits.length === 14) return digits;
  return '';
}

function formatarDocumento(doc: string): string {
  const d = doc.replace(/\D/g, '');
  if (d.length === 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (d.length === 14) {
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return doc;
}

export function CadastrarFornecedorModal({
  isOpen,
  onClose,
  barId,
  initialNome = '',
  initialPix = '',
  onCadastrado,
}: CadastrarFornecedorModalProps) {
  const { showToast } = useToast();
  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [tipoPessoa, setTipoPessoa] = useState<'Física' | 'Jurídica' | 'Estrangeira'>('Física');
  const [tipoPerfil, setTipoPerfil] = useState<'Fornecedor' | 'Cliente' | 'Transportadora'>('Fornecedor');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setNome(initialNome);
    const docDetectado = detectarDocumento(initialPix);
    setDocumento(docDetectado ? formatarDocumento(docDetectado) : '');
    setEmail('');
    setTelefone('');
    setTipoPessoa(docDetectado.length === 14 ? 'Jurídica' : 'Física');
    setTipoPerfil('Fornecedor');
  }, [isOpen, initialNome, initialPix]);

  const submit = async () => {
    if (!barId) {
      showToast({
        type: 'error',
        title: 'Bar não selecionado',
        message: 'Selecione um bar antes de cadastrar',
      });
      return;
    }
    if (!nome.trim()) {
      showToast({
        type: 'error',
        title: 'Nome obrigatório',
        message: 'Digite o nome do fornecedor',
      });
      return;
    }

    setSalvando(true);
    try {
      const r = await fetch('/api/financeiro/contaazul/pessoas/cadastrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bar_id: barId,
          nome: nome.trim(),
          documento: documento.replace(/\D/g, '') || null,
          email: email.trim() || null,
          telefone: telefone.replace(/\D/g, '') || null,
          tipo_pessoa: tipoPessoa,
          tipo_perfil: tipoPerfil,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) {
        showToast({
          type: 'error',
          title: '❌ Erro ao cadastrar no CA',
          message: data?.error || `HTTP ${r.status}`,
        });
        return;
      }
      showToast({
        type: 'success',
        title: '✅ Fornecedor cadastrado',
        message: `${nome} criado no Conta Azul`,
      });
      onCadastrado({
        contaazul_id: data.contaazul_id,
        nome: data.nome || nome.trim(),
        documento: documento.replace(/\D/g, '') || null,
      });
      onClose();
    } catch (e: any) {
      showToast({
        type: 'error',
        title: 'Erro de rede',
        message: e?.message || 'Falha ao cadastrar',
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg bg-white dark:bg-gray-800">
        <DialogHeader>
          <DialogTitle>Cadastrar fornecedor no Conta Azul</DialogTitle>
          <DialogDescription>
            Cria a pessoa no Conta Azul e libera o pagamento. PIX continua vindo da folha
            (CA não armazena chave PIX).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-gray-700 dark:text-gray-300">Nome *</Label>
            <Input
              value={nome}
              onChange={e => setNome(e.target.value)}
              className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
              placeholder="Nome completo / razão social"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-700 dark:text-gray-300">Tipo de pessoa</Label>
              <Select value={tipoPessoa} onValueChange={v => setTipoPessoa(v as any)}>
                <SelectTrigger className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Física">Física</SelectItem>
                  <SelectItem value="Jurídica">Jurídica</SelectItem>
                  <SelectItem value="Estrangeira">Estrangeira</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-700 dark:text-gray-300">Perfil</Label>
              <Select value={tipoPerfil} onValueChange={v => setTipoPerfil(v as any)}>
                <SelectTrigger className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fornecedor">Fornecedor</SelectItem>
                  <SelectItem value="Cliente">Cliente</SelectItem>
                  <SelectItem value="Transportadora">Transportadora</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-gray-700 dark:text-gray-300">CPF / CNPJ (opcional)</Label>
            <Input
              value={documento}
              onChange={e => setDocumento(formatarDocumento(e.target.value.replace(/\D/g, '')))}
              className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-700 dark:text-gray-300">Email (opcional)</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <Label className="text-gray-700 dark:text-gray-300">Telefone (opcional)</Label>
              <Input
                value={telefone}
                onChange={e => setTelefone(e.target.value)}
                className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button className="btn-primary" onClick={submit} disabled={salvando}>
            {salvando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cadastrando...
              </>
            ) : (
              'Cadastrar no Conta Azul'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
