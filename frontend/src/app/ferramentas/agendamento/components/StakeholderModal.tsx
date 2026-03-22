'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
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
import { useToast } from '@/components/ui/toast';
import { criarStakeholder } from '../services/agendamento-service';
import type { Stakeholder } from '../types';
import {
  formatarDocumento,
  removerFormatacaoDocumento,
} from './NovoPagamentoForm';

export interface StakeholderModalProps {
  isOpen: boolean;
  onClose: () => void;
  barId: number;
  initialDocument: string;
  initialName: string;
  onStakeholderCriado: (stakeholder: Stakeholder) => void;
}

function montarChavePixParaApi(documento: string, pixKey: string): string | undefined {
  const pixTrim = pixKey.trim();
  if (pixTrim) return pixTrim;
  const docDigits = removerFormatacaoDocumento(documento);
  if (docDigits.length === 11 || docDigits.length === 14) return docDigits;
  return undefined;
}

export function StakeholderModal({
  isOpen,
  onClose,
  barId,
  initialDocument,
  initialName,
  onStakeholderCriado,
}: StakeholderModalProps) {
  const { showToast } = useToast();
  const [document, setDocument] = useState('');
  const [name, setName] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const toast = useCallback(
    (options: {
      title: string;
      description?: string;
      variant?: 'destructive';
    }) => {
      showToast({
        type: options.variant === 'destructive' ? 'error' : 'success',
        title: options.title,
        message: options.description,
      });
    },
    [showToast]
  );

  useEffect(() => {
    if (!isOpen) return;
    setDocument(formatarDocumento(initialDocument || ''));
    setName(initialName || '');
    setPixKey('');
  }, [isOpen, initialDocument, initialName]);

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  const handleSalvar = async () => {
    if (!name.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Digite o nome do stakeholder',
        variant: 'destructive',
      });
      return;
    }

    if (!Number.isFinite(barId)) {
      toast({
        title: 'Bar inválido',
        description: 'Selecione um bar válido para cadastrar o stakeholder',
        variant: 'destructive',
      });
      return;
    }

    const chave_pix = montarChavePixParaApi(document, pixKey);

    setIsSaving(true);
    try {
      const result = await criarStakeholder({
        nome: name.trim(),
        chave_pix,
        bar_id: barId,
      });

      if (!result.ok) {
        toast({
          title: 'Erro no cadastro',
          description: result.error || 'Não foi possível cadastrar o stakeholder',
          variant: 'destructive',
        });
        return;
      }

      const { supplier } = result.data;
      onStakeholderCriado({
        id: supplier.id,
        name: supplier.name,
        document: supplier.document,
        type: 'fornecedor',
        pixKey: supplier.pixKey ?? undefined,
      });

      toast({
        title: '✅ Stakeholder cadastrado!',
        description: result.data.message || 'Cadastro concluído no NIBO',
      });
      onClose();
    } catch (e) {
      console.error('Erro ao cadastrar stakeholder:', e);
      toast({
        title: 'Erro no cadastro',
        description: 'Não foi possível cadastrar o stakeholder',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white">
            Cadastrar Novo Stakeholder
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400">
            Preencha CPF/CNPJ, nome e chave PIX. A chave PIX pode ser omitida se for
            igual ao documento (CPF/CNPJ).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-gray-700 dark:text-gray-300">CPF/CNPJ</Label>
            <Input
              value={document}
              onChange={e => setDocument(formatarDocumento(e.target.value))}
              placeholder="000.000.000-00 ou CNPJ"
              className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <Label className="text-gray-700 dark:text-gray-300">
              Nome completo *
            </Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nome completo do stakeholder"
              className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <Label className="text-gray-700 dark:text-gray-300">Chave PIX</Label>
            <Input
              value={pixKey}
              onChange={e => setPixKey(e.target.value)}
              placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória (opcional se igual ao documento)"
              className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="btn-outline"
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSalvar}
            disabled={isSaving}
            className="btn-primary"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
