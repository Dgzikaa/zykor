'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { PagamentoAgendamento } from '../types';
import { ImportarFolhaForm } from './ImportarFolhaForm';

type NiboListaItem = {
  nibo_id?: string;
  id?: string;
  categoria_nome?: string;
  name?: string;
  nome?: string;
};

export interface ImportarFolhaModalProps {
  isOpen: boolean;
  onClose: () => void;
  barId?: number;
  barNome?: string;
  categorias: NiboListaItem[];
  centrosCusto: NiboListaItem[];
  onImportado: (pagamentos: PagamentoAgendamento[]) => void;
}

export function ImportarFolhaModal({
  isOpen,
  onClose,
  barId,
  barNome,
  categorias,
  centrosCusto,
  onImportado,
}: ImportarFolhaModalProps) {
  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white">
            Importar Folha de Pagamento
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400">
            Cole a planilha (tabulada), gere a prévia e importe os pagamentos para
            a lista.
          </DialogDescription>
        </DialogHeader>

        <ImportarFolhaForm
          barId={barId}
          barNome={barNome}
          categorias={categorias}
          centrosCusto={centrosCusto}
          onImportado={onImportado}
          onAfterImport={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
