'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';

interface Item {
  sistema: string;
  categoria: string;
  grupo: string;
  produto: string;
  quantidade: number;
  valor: number;
}
interface Grupo {
  categoria: string;
  total_valor: number;
  total_qtd: number;
  itens: Item[];
}
interface Resp {
  success: boolean;
  total_cesta: number;
  grupos: Grupo[];
}

const LABEL: Record<string, string> = {
  comida: 'Comida',
  bebida: 'Bebida',
  drink: 'Drink',
  sem_classificacao: 'Sem classificação (grupo pendente)',
  eco_copo: 'Eco Copos',
  ingresso: 'Ingressos (entrada)',
  fora: 'Fora da cesta',
};
const CESTA = new Set(['comida', 'bebida', 'drink']);

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  barId: number;
  data: string;
}

export function MixDetalheModal({ open, onOpenChange, barId, data }: Props) {
  const [resp, setResp] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !barId || !data) return;
    setLoading(true);
    setErro(null);
    fetch(`/api/analitico/evento/cesta?data=${data}&bar_id=${barId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setResp(j);
        else setErro(j.error || 'Erro ao carregar');
      })
      .catch(() => setErro('Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [open, barId, data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mix de consumo — detalhamento</DialogTitle>
          <DialogDescription>
            Tudo que entrou em cada categoria, por origem (ContaHub / Yuzer). Eco copos,
            ingressos e itens fora da cesta aparecem separados e não contam no mix.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="py-10 text-center text-sm text-gray-400">Carregando…</div>
        )}
        {erro && <div className="py-10 text-center text-sm text-red-500">{erro}</div>}

        {!loading && !erro && resp && (
          <div className="space-y-5">
            {resp.grupos.map((g) => {
              const pct =
                CESTA.has(g.categoria) && resp.total_cesta > 0
                  ? (g.total_valor / resp.total_cesta) * 100
                  : null;
              return (
                <div key={g.categoria}>
                  <div className="flex items-baseline justify-between mb-1">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {LABEL[g.categoria] || g.categoria}
                      {pct !== null && (
                        <span className="ml-2 text-xs font-normal text-gray-400">
                          {pct.toFixed(1)}% da cesta
                        </span>
                      )}
                    </h4>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      {formatCurrency(g.total_valor)}
                      <span className="ml-1 text-xs font-normal text-gray-400">
                        · {g.total_qtd.toLocaleString('pt-BR')} un
                      </span>
                    </span>
                  </div>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500">
                        <tr>
                          <th className="text-left font-medium px-3 py-1.5">Produto</th>
                          <th className="text-left font-medium px-3 py-1.5">Origem</th>
                          <th className="text-left font-medium px-3 py-1.5">Grupo</th>
                          <th className="text-right font-medium px-3 py-1.5">Qtd</th>
                          <th className="text-right font-medium px-3 py-1.5">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.itens.map((i, idx) => (
                          <tr
                            key={idx}
                            className="border-t border-gray-100 dark:border-gray-700/60"
                          >
                            <td className="px-3 py-1.5 text-gray-800 dark:text-gray-200">
                              {i.produto}
                            </td>
                            <td className="px-3 py-1.5">
                              <Badge
                                variant="outline"
                                className={
                                  i.sistema === 'Yuzer'
                                    ? 'border-violet-300 text-violet-700 dark:text-violet-300'
                                    : 'border-blue-300 text-blue-700 dark:text-blue-300'
                                }
                              >
                                {i.sistema}
                              </Badge>
                            </td>
                            <td className="px-3 py-1.5 text-gray-500">{i.grupo}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                              {i.quantidade.toLocaleString('pt-BR')}
                            </td>
                            <td className="px-3 py-1.5 text-right tabular-nums font-medium text-gray-900 dark:text-gray-100">
                              {formatCurrency(i.valor)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
            {!resp.grupos.length && (
              <div className="py-10 text-center text-sm text-gray-400">
                Sem produtos para esta data.
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
