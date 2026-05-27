'use client';

import { memo, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MetasDesempenhoMap } from '../types';

type MetricaItem = {
  key: string;
  label: string;
  formato: string;
  sufixo?: string;
  inverso?: boolean;
};

type GrupoItem = {
  id: string;
  label: string;
  metricas: MetricaItem[];
};

type SecaoItem = {
  id: string;
  titulo: string;
  grupos: GrupoItem[];
};

interface MetasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visao: 'semanal' | 'mensal';
  metasPorSecao: SecaoItem[];
  metricasParaMetaFlat: MetricaItem[];
  metas: MetasDesempenhoMap;
  salvando: boolean;
  formatarValor: (valor: unknown, formato: string, sufixo?: string) => string;
  onSave: (editValues: Record<string, string>) => Promise<void> | void;
}

/**
 * Modal extraido de DesempenhoClient para isolar re-renders.
 * Estado `editValues` vive aqui — typing nos inputs nao re-renderiza
 * as 3557 linhas do parent (era o principal gargalo INP da pagina).
 */
function MetasModalImpl({
  open,
  onOpenChange,
  visao,
  metasPorSecao,
  metricasParaMetaFlat,
  metas,
  salvando,
  formatarValor,
  onSave,
}: MetasModalProps) {
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  // Inicializa values quando modal abre
  useEffect(() => {
    if (!open) return;
    const valoresIniciais: Record<string, string> = {};
    metricasParaMetaFlat.forEach((m) => {
      const valorAtual = metas[m.key]?.valor;
      valoresIniciais[m.key] =
        valorAtual !== null && valorAtual !== undefined && Number.isFinite(valorAtual)
          ? String(valorAtual)
          : '';
    });
    setEditValues(valoresIniciais);
  }, [open, metricasParaMetaFlat, metas]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Metas de Desempenho ({visao === 'semanal' ? 'Semanal' : 'Mensal'})</DialogTitle>
          <DialogDescription>
            Metas agrupadas por bloco do desempenho. Edite e salve quando quiser.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto px-1">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 py-2">
            {metasPorSecao.map((secao) => (
              <section key={secao.id} className="rounded-md border p-3 bg-gray-50 dark:bg-gray-800/60 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{secao.titulo}</h3>
                {secao.grupos.map((grupo) => (
                  <div key={`${secao.id}-${grupo.id}`} className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 p-2.5 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{grupo.label}</p>
                    {grupo.metricas.map((m) => (
                      <div key={m.key} className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-2 items-center">
                        <div>
                          <p className="text-sm text-gray-900 dark:text-gray-100">{m.label} - Meta</p>
                          <p className="text-[11px] text-gray-500">
                            Atual: {metas[m.key] ? formatarValor(metas[m.key].valor, m.formato, m.sufixo) : '-'} • Op. {metas[m.key]?.operador || (m.inverso ? '<=' : '>=')}
                          </p>
                        </div>
                        <Input
                          value={editValues[m.key] || ''}
                          onChange={(e) =>
                            setEditValues((prev) => ({
                              ...prev,
                              [m.key]: e.target.value,
                            }))
                          }
                          placeholder={`Ex: ${m.formato.includes('moeda') ? '103.00' : '95'}`}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </section>
            ))}
          </div>
        </div>
        <DialogFooter className="p-0 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => onSave(editValues)} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar Metas'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const MetasModal = memo(MetasModalImpl);
