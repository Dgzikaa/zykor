'use client';

import { Badge } from '@/components/ui/badge';
import { STATUS_LABEL, STATUS_COLOR, type PedidoStatus } from '@/app/financeiro/pedidos-pagamento/types';

// Item mínimo de um freela lançado (1 diária) — comum à operação e ao financeiro.
export type FreelaItem = {
  id: string;
  beneficiario_nome?: string | null | undefined;
  funcao?: string | null | undefined; // cargo (ex.: "Atendimento") — enriquecido pelo chamador
  valor: number;
  status: PedidoStatus;
  data_competencia?: string | null | undefined;
  data_vencimento: string;
};

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const DIA_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
function rotuloDia(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DIA_SEMANA[dt.getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}
const Funcao = ({ f }: { f?: string | null }) => f ? <span className="text-muted-foreground font-normal"> · {f}</span> : null;

/**
 * Lista de freelas agrupada — por DIA (operação: fechar semana) ou por PESSOA (financeiro:
 * aprovar). Fonte única de layout; o que muda é a chave do grupo e a coluna de ações (`acao`).
 * O cargo (função) aparece ao lado do nome da pessoa (no cabeçalho por-pessoa, na linha por-dia).
 */
export function FreelaPorDia({
  itens, acao, mostrarStatus = true, agruparPor = 'dia',
}: {
  itens: FreelaItem[];
  acao?: (it: FreelaItem) => React.ReactNode;
  mostrarStatus?: boolean;
  agruparPor?: 'dia' | 'pessoa';
}) {
  const porPessoa = agruparPor === 'pessoa';
  const chaveGrupo = (it: FreelaItem) => porPessoa ? (it.beneficiario_nome || '—') : (it.data_competencia || it.data_vencimento);
  const rotuloGrupo = (k: string) => porPessoa ? k : rotuloDia(k);
  const rotuloLinha = (it: FreelaItem) => porPessoa ? rotuloDia(it.data_competencia || it.data_vencimento) : (it.beneficiario_nome || '—');
  const unidade = porPessoa ? 'diária(s)' : 'freela(s)';

  const grupos = new Map<string, FreelaItem[]>();
  for (const it of itens) {
    const k = chaveGrupo(it);
    (grupos.get(k) || grupos.set(k, []).get(k)!).push(it);
  }
  // Por pessoa: alfabético. Por dia: mais recente primeiro.
  const chaves = Array.from(grupos.keys()).sort((a, b) => porPessoa ? a.localeCompare(b, 'pt-BR') : b.localeCompare(a));

  return (
    <div className="space-y-2">
      {chaves.map((k) => {
        const lista = grupos.get(k)!.slice().sort((a, b) => porPessoa
          ? (a.data_competencia || a.data_vencimento).localeCompare(b.data_competencia || b.data_vencimento)
          : (a.beneficiario_nome || '').localeCompare(b.beneficiario_nome || '', 'pt-BR'));
        const total = lista.reduce((s, i) => s + Number(i.valor || 0), 0);
        return (
          <div key={k} className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-muted/50">
              <span className="text-sm font-semibold truncate">
                {rotuloGrupo(k)}{porPessoa && <Funcao f={lista[0]?.funcao} />}
                <span className="text-muted-foreground font-normal"> · {lista.length} {unidade}</span>
              </span>
              <span className="text-sm font-semibold shrink-0">{fmtBRL(total)}</span>
            </div>
            <div className="divide-y divide-[hsl(var(--border))]/50">
              {lista.map((it) => (
                <div key={it.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <span className="flex-1 truncate">{rotuloLinha(it)}{!porPessoa && <Funcao f={it.funcao} />}</span>
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
