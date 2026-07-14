'use client';

import { Badge } from '@/components/ui/badge';
import { STATUS_LABEL, STATUS_COLOR, type PedidoStatus } from '@/app/financeiro/pedidos-pagamento/types';

// Item mínimo de um freela lançado (1 diária) — comum à operação e ao financeiro.
export type FreelaItem = {
  id: string;
  beneficiario_nome: string | null;
  valor: number;
  status: PedidoStatus;
  data_competencia: string | null;
  data_vencimento: string;
};

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const DIA_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
function rotuloDia(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DIA_SEMANA[dt.getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/**
 * Lista de freelas AGRUPADA POR DIA → pessoas que trabalharam naquele dia.
 * Fonte única de layout p/ a operação (fechar semana) e o financeiro (aprovar) —
 * o que muda é só a coluna de ações (render prop `acao`).
 */
export function FreelaPorDia({
  itens, acao, mostrarStatus = true,
}: {
  itens: FreelaItem[];
  /** Ações por pessoa (editar/remover na operação; aprovar/agendar no financeiro). */
  acao?: (it: FreelaItem) => React.ReactNode;
  mostrarStatus?: boolean;
}) {
  // Agrupa por dia trabalhado (competência; fallback vencimento), dia mais recente primeiro.
  const porDia = new Map<string, FreelaItem[]>();
  for (const it of itens) {
    const dia = it.data_competencia || it.data_vencimento;
    (porDia.get(dia) || porDia.set(dia, []).get(dia)!).push(it);
  }
  const dias = Array.from(porDia.keys()).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-2">
      {dias.map((dia) => {
        const lista = porDia.get(dia)!.slice().sort((a, b) => (a.beneficiario_nome || '').localeCompare(b.beneficiario_nome || '', 'pt-BR'));
        const total = lista.reduce((s, i) => s + Number(i.valor || 0), 0);
        return (
          <div key={dia} className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-muted/50">
              <span className="text-sm font-semibold">{rotuloDia(dia)} <span className="text-muted-foreground font-normal">· {lista.length} freela(s)</span></span>
              <span className="text-sm font-semibold">{fmtBRL(total)}</span>
            </div>
            <div className="divide-y divide-[hsl(var(--border))]/50">
              {lista.map((it) => (
                <div key={it.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <span className="flex-1 truncate">{it.beneficiario_nome || '—'}</span>
                  {mostrarStatus && <Badge className={`${STATUS_COLOR[it.status]} text-[10px] shrink-0`}>{STATUS_LABEL[it.status]}</Badge>}
                  <span className="tabular-nums font-medium w-24 text-right shrink-0">{fmtBRL(it.valor)}</span>
                  {acao && <div className="shrink-0 flex items-center gap-1">{acao(it)}</div>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
