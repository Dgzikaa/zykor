'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SortableList } from '@/components/drag-drop/SortableList';
import { useChecklistPersistence } from '@/hooks/useDragAndDropPersistence';
import { useToast } from '@/hooks/use-toast';

interface ChecklistTemplate {
  id: string;
  nome: string;
  descricao: string;
  area: 'cozinha' | 'salao' | 'bar' | 'limpeza' | 'abertura' | 'fechamento';
  prioridade: 'baixa' | 'media' | 'alta' | 'critica';
  ordem: number;
  ativo: boolean;
  items_count: number;
  created_at: string;
}

interface ChecklistReorderManagerProps {
  initialChecklists?: ChecklistTemplate[];
  onReorder?: (checklists: ChecklistTemplate[]) => void;
  disabled?: boolean;
}

export function ChecklistReorderManager({
  initialChecklists = [],
  onReorder,
  disabled = false,
}: ChecklistReorderManagerProps) {
  const { toast } = useToast();

  // Use persistence hook for checklists
  const {
    items: checklists,
    setItems: setChecklists,
    isLoading,
    reset,
    forceSave,
  } = useChecklistPersistence(initialChecklists);

  const [hasChanges, setHasChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Update persistence when initial data changes
  useEffect(() => {
    if (initialChecklists.length > 0 && !isLoading) {
      setChecklists(initialChecklists);
    }
  }, [initialChecklists, isLoading, setChecklists]);

  // Handle reorder
  const handleReorder = (newChecklists: ChecklistTemplate[]) => {
    // Update ordem field based on new position
    const updatedChecklists = newChecklists.map((checklist, index) => ({
      ...checklist,
      ordem: index + 1,
    }));

    setChecklists(updatedChecklists);
    setHasChanges(true);

    // Call external handler if provided
    if (onReorder) {
      onReorder(updatedChecklists);
    }
  };

  // Save to server
  const handleSave = async () => {
    try {
      const response = await fetch('/api/operacional/checklists/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          checklists: checklists.map((c: any) => ({
            id: c.id,
            ordem: c.ordem,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao salvar ordem dos checklists');
      }

      forceSave();
      setHasChanges(false);
      setLastSaved(new Date());

      toast({
        title: 'Ordem salva!',
        description: 'A nova ordem dos checklists foi salva com sucesso.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar a nova ordem. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  // Reset to original order
  const handleReset = () => {
    reset();
    setHasChanges(false);

    toast({
      title: 'Ordem resetada',
      description: 'A ordem foi restaurada para o padrão original.',
    });
  };

  // Get area badge color
  const getAreaColor = (area: string) => {
    switch (area) {
      case 'cozinha':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300';
      case 'salao':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'bar':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300';
      case 'limpeza':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'abertura':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'fechamento':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  // Get priority badge color
  const getPriorityColor = (prioridade: string) => {
    switch (prioridade) {
      case 'critica':
        return 'bg-red-500 text-white';
      case 'alta':
        return 'bg-orange-500 text-white';
      case 'media':
        return 'bg-yellow-500 text-white';
      case 'baixa':
        return 'bg-green-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  if (isLoading) {
    return (
      <Card className="card-dark">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-gray-200 dark:bg-gray-700 rounded"
                ></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-dark">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="card-title-dark">
              🔄 Reordenar Checklists
            </CardTitle>
            <p className="card-description-dark mt-2">
              Arraste os checklists para reorganizar a ordem de execução.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {hasChanges && (
              <Badge
                variant="secondary"
                className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300"
              >
                Alterações pendentes
              </Badge>
            )}

            {lastSaved && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Salvo em {lastSaved.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Instructions */}
        <Alert>
          <AlertDescription>
            <strong>Como usar:</strong> Arraste os checklists para reorganizar a
            ordem. No desktop, use{' '}
            <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">
              Ctrl + ↑/↓
            </kbd>{' '}
            para mover via teclado.
          </AlertDescription>
        </Alert>

        {/* Sortable List */}
        <SortableList
          items={checklists as any}
          onReorder={handleReorder}
          disabled={disabled}
          renderItem={(checklist: ChecklistTemplate, index) => (
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {checklist.nome}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <Badge className={getPriorityColor(checklist.prioridade)}>
                    {checklist.prioridade}
                  </Badge>
                  <Badge className={getAreaColor(checklist.area)}>
                    {checklist.area}
                  </Badge>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {checklist.descricao}
              </p>

              {/* Meta info */}
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{checklist.items_count} itens</span>
                <span>
                  {checklist.ativo ? (
                    <Badge
                      variant="outline"
                      className="text-green-600 border-green-600"
                    >
                      Ativo
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-gray-500 border-gray-500"
                    >
                      Inativo
                    </Badge>
                  )}
                </span>
              </div>
            </div>
          )}
          getId={(checklist: ChecklistTemplate) => checklist.id}
          gap="md"
          itemClassName="hover:bg-gray-50 dark:hover:bg-gray-800/50"
        />

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSave}
              disabled={!hasChanges || disabled}
              className="btn-primary-dark"
            >
              💾 Salvar Ordem
            </Button>

            <Button
              onClick={handleReset}
              variant="outline"
              disabled={!hasChanges || disabled}
              className="btn-secondary-dark"
            >
              🔄 Resetar
            </Button>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400">
            {checklists.length} checklists configurados
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
