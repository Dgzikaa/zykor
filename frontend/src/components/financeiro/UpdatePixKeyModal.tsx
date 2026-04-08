'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface Stakeholder {
  id: string;
  name: string;
  document: string;
  email?: string;
  phone?: string;
  type: 'fornecedor' | 'socio' | 'funcionario';
}

interface UpdatePixKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stakeholder: Stakeholder | null;
  cpfCnpj: string;
  onSuccess: (updatedStakeholder: Stakeholder) => void;
}

export function UpdatePixKeyModal({
  open,
  onOpenChange,
  stakeholder,
  cpfCnpj,
  onSuccess,
}: UpdatePixKeyModalProps) {
  const { toast } = useToast();
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState<number>(3); // 3 = CPF/CNPJ
  const [isCpfCnpj, setIsCpfCnpj] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleCpfCnpjChange = (checked: boolean) => {
    setIsCpfCnpj(checked);
    if (checked) {
      setPixKey(cpfCnpj);
      setPixKeyType(3); // CPF/CNPJ
    } else {
      setPixKey('');
      setPixKeyType(3);
    }
  };

  const handleUpdate = async () => {
    if (!stakeholder || !pixKey.trim()) {
      toast({
        title: 'Chave PIX obrigatória',
        description: 'Digite a chave PIX para continuar',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdating(true);

    try {
      // Preparar dados para atualização
      const updateData = {
        name: stakeholder.name,
        document: {
          number: stakeholder.document,
          type: stakeholder.document.length === 11 ? 'CPF' : 'CNPJ',
        },
        communication: {
          email: stakeholder.email || '',
          phone: stakeholder.phone || '',
        },
        address: {},
        bankAccountInformation: {
          pixKey: pixKey,
          pixKeyType: pixKeyType,
        },
        companyInformation: {},
      };

      const response = await fetch(
        `/api/financeiro/contaazul/stakeholders/${stakeholder.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        }
      );

      const data = await response.json();

      if (data.success) {
        const updatedStakeholder = {
          ...stakeholder,
          pixKey: data.data.pixKey,
          pixKeyType: data.data.pixKeyType,
        };

        onSuccess(updatedStakeholder);
        onOpenChange(false);

        // Reset form
        setPixKey('');
        setIsCpfCnpj(false);
        setPixKeyType(3);

        toast({
          title: 'Chave PIX atualizada',
          description: 'Chave PIX foi atualizada com sucesso no Conta Azul',
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Erro ao atualizar chave PIX:', error);
      toast({
        title: 'Erro na atualização',
        description: 'Erro ao atualizar chave PIX no Conta Azul',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setPixKey('');
    setIsCpfCnpj(false);
    setPixKeyType(3);
  };

  if (!stakeholder) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="modal-dark">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white">
            Atualizar Chave PIX
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label className="text-gray-700 dark:text-gray-300">
              Stakeholder
            </Label>
            <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="font-medium text-gray-900 dark:text-white">
                {stakeholder.name}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                CPF/CNPJ: {stakeholder.document}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              checked={isCpfCnpj}
              onCheckedChange={handleCpfCnpjChange}
            />
            <Label
              htmlFor="is-cpf-cnpj"
              className="text-gray-700 dark:text-gray-300"
            >
              Chave PIX é o mesmo CPF/CNPJ?
            </Label>
          </div>

          <div>
            <Label
              htmlFor="pix-key"
              className="text-gray-700 dark:text-gray-300"
            >
              Chave PIX *
            </Label>
            <Input
              id="pix-key"
              value={pixKey}
              onChange={e => setPixKey(e.target.value)}
              placeholder={isCpfCnpj ? cpfCnpj : 'Digite a chave PIX'}
              disabled={isCpfCnpj}
              className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:text-gray-500 dark:disabled:text-gray-400"
            />
          </div>

          <div>
            <Label className="text-gray-700 dark:text-gray-300">
              Tipo de Chave
            </Label>
            <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {pixKeyType === 1 && 'Telefone'}
                {pixKeyType === 2 && 'Email'}
                {pixKeyType === 3 && 'CPF/CNPJ'}
                {pixKeyType === 4 && 'Chave Aleatória'}
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleCancel}
            variant="outline"
            className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleUpdate}
            disabled={isUpdating || !pixKey.trim()}
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {isUpdating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Atualizando...
              </>
            ) : (
              'Atualizar Chave PIX'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

