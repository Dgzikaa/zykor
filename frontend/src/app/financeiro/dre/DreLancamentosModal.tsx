'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

export type DreLancamento = {
  data: string; data_pagamento: string | null; descricao: string;
  pessoa: string | null; categoria: string | null; tipo: string | null;
  status: string | null; valor: number;
};

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtData = (d: string) => { try { const [, m, dd] = d.split('-'); return `${dd}/${m}`; } catch { return d; } };

export function DreLancamentosModal({ open, onClose, titulo, loading, lancamentos, total, erro }: {
  open: boolean; onClose: () => void; titulo: string; loading: boolean;
  lancamentos: DreLancamento[]; total: number; erro: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-base">{titulo}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
        ) : erro ? (
          <div className="py-8 text-center text-sm text-red-600">{erro}</div>
        ) : lancamentos.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Nenhum lançamento neste período.</div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto rounded border">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground border-b sticky top-0 bg-card">
                <tr>
                  <th className="text-left px-2 py-1.5 whitespace-nowrap">Data</th>
                  <th className="text-left px-2 py-1.5">Descrição</th>
                  <th className="text-left px-2 py-1.5">Fornecedor</th>
                  <th className="text-left px-2 py-1.5">Categoria (CA)</th>
                  <th className="text-right px-2 py-1.5 whitespace-nowrap">Valor</th>
                </tr>
              </thead>
              <tbody>
                {lancamentos.map((l, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-2 py-1 whitespace-nowrap text-muted-foreground">{fmtData(l.data)}</td>
                    <td className="px-2 py-1 max-w-[260px] truncate" title={l.descricao || ''}>{l.descricao || '—'}</td>
                    <td className="px-2 py-1 max-w-[160px] truncate text-muted-foreground" title={l.pessoa || ''}>{l.pessoa || '—'}</td>
                    <td className="px-2 py-1 max-w-[160px] truncate text-muted-foreground" title={l.categoria || ''}>{l.categoria || '—'}</td>
                    <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">{fmtBRL(l.valor)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 font-bold sticky bottom-0 bg-card">
                <tr>
                  <td className="px-2 py-1.5" colSpan={4}>Total ({lancamentos.length} lançamento{lancamentos.length !== 1 ? 's' : ''})</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtBRL(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
