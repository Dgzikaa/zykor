'use client';

import { useState } from 'react';
import { useApiSWR } from '@/hooks/useApiSWR';
import { ArrowRight, Info, CalendarDays, AlertTriangle } from 'lucide-react';

/**
 * Aba "Venda × Recebimento" — explica por que o extrato da maquininha nunca bate,
 * linha a linha, com o que o Zykor lançou no Conta Azul.
 *
 * Nasceu de duas investigações no mesmo dia (10/08/2026): o financeiro comparou o
 * extrato do dia 07/08 com o Conta Azul, achou que estava lançado errado, e nos dois
 * casos a diferença era um evento CrossBalance da Stone — 261,00 no Deboche e 348,00
 * no Ordibar. Visa e Elo batiam na vírgula; só o Mastercard tinha o evento.
 */

interface Linha {
  stone_code: string;
  empresa_nome: string | null;
  tipo: string;
  bandeira: string;
  n: number;
  bruto: number;
  liquido: number;
  dia_venda_min?: string;
  dia_venda_max?: string;
}
interface Evento {
  stone_code: string;
  empresa_nome: string | null;
  descricao: string;
  valor: number;
}
interface Comparativo {
  data: string;
  venda: Linha[];
  liquidacao: Linha[];
  eventos: Evento[];
}

const brl = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** dd/mm a partir de YYYY-MM-DD, sem passar por Date (que puxaria fuso). */
const ddmm = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

/** Ontem em horário de Brasília (UTC-3) — o último dia com movimento fechado. */
function ontemBRT(): string {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function Tabela({
  titulo,
  subtitulo,
  linhas,
  destaque,
  mostrarOrigem,
}: {
  titulo: string;
  subtitulo: string;
  linhas: Linha[];
  destaque: string;
  mostrarOrigem?: boolean;
}) {
  const total = linhas.reduce((s, l) => s + Number(l.liquido || 0), 0);
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className={`px-4 py-3 border-b ${destaque}`}>
        <p className="font-medium text-sm">{titulo}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitulo}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b">
            <tr>
              <th className="text-left font-medium px-3 py-2">Forma</th>
              {mostrarOrigem && <th className="text-left font-medium px-3 py-2">Venda de</th>}
              <th className="text-right font-medium px-3 py-2">Qtd</th>
              <th className="text-right font-medium px-3 py-2">Líquido</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr>
                <td colSpan={mostrarOrigem ? 4 : 3} className="px-3 py-6 text-center text-muted-foreground">
                  Nada neste dia.
                </td>
              </tr>
            )}
            {linhas.map((l, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-3 py-2">
                  {l.tipo === 'PIX' ? 'PIX' : `${l.bandeira} ${l.tipo.toLowerCase()}`}
                </td>
                {mostrarOrigem && (
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {l.dia_venda_min === l.dia_venda_max
                      ? ddmm(l.dia_venda_min)
                      : `${ddmm(l.dia_venda_min)}–${ddmm(l.dia_venda_max)}`}
                  </td>
                )}
                <td className="px-3 py-2 text-right text-muted-foreground">{l.n}</td>
                <td className="px-3 py-2 text-right tabular-nums">{brl(Number(l.liquido))}</td>
              </tr>
            ))}
          </tbody>
          {linhas.length > 0 && (
            <tfoot>
              <tr className="font-medium bg-muted/40">
                <td className="px-3 py-2" colSpan={mostrarOrigem ? 3 : 2}>
                  Total
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{brl(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export function VendaXLiquidacao() {
  const [data, setData] = useState(ontemBRT());
  const { data: resp, isLoading } = useApiSWR<{ comparativo: Comparativo }>(
    `/api/financeiro/stone/venda-x-liquidacao?data=${data}`
  );

  const comp = resp?.comparativo;
  const empresas = Array.from(
    new Set([
      ...(comp?.venda || []).map(l => l.empresa_nome || l.stone_code),
      ...(comp?.liquidacao || []).map(l => l.empresa_nome || l.stone_code),
    ])
  );

  return (
    <div className="space-y-5">
      {/* Explicação — o motivo da aba existir */}
      <div className="rounded-xl border bg-blue-500/5 border-blue-500/20 p-4 space-y-3">
        <div className="flex items-start gap-2.5">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm">
            <p className="font-medium">
              O extrato da maquininha e o Conta Azul mostram o mesmo dinheiro em dias diferentes —
              e não deveriam bater linha a linha.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 pt-1">
              <div className="rounded-lg bg-background/60 border p-3">
                <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">
                  Venda
                </p>
                <p className="mt-1">
                  O dia em que o cliente passou o cartão. É isso que o Zykor lança no Conta Azul,
                  com o vencimento no campo próprio.
                </p>
              </div>
              <div className="rounded-lg bg-background/60 border p-3">
                <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">
                  Recebimento (extrato)
                </p>
                <p className="mt-1">
                  O dia em que a Stone pagou. Débito cai em <strong>D+1</strong>, crédito em
                  ~<strong>30 dias</strong>, PIX no mesmo dia.
                </p>
              </div>
            </div>
            <p className="text-muted-foreground">
              Por isso o débito que você vê no extrato de hoje é a venda de <em>ontem</em>. Se
              quiser conferir um print do extrato, escolha o dia dele e compare com a coluna{' '}
              <strong>Recebimento</strong> — não com a de Venda.
            </p>
          </div>
        </div>
      </div>

      {/* Seletor de dia */}
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <label htmlFor="dia-comparativo" className="text-sm text-muted-foreground">
          Dia:
        </label>
        <input
          id="dia-comparativo"
          type="date"
          value={data}
          onChange={e => setData(e.target.value)}
          className="rounded-lg border bg-background px-3 py-1.5 text-sm"
        />
        {isLoading && <span className="text-xs text-muted-foreground">carregando…</span>}
      </div>

      {/* Eventos que abatem o repasse — a causa da dúvida mais comum */}
      {(comp?.eventos?.length ?? 0) > 0 && (
        <div className="rounded-xl border bg-amber-500/5 border-amber-500/25 p-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm space-y-2">
              <p className="font-medium">A Stone abateu valores do repasse deste dia</p>
              <p className="text-muted-foreground">
                Esses descontos <strong>não aparecem nas vendas</strong> — só no repasse. É por
                isso que o total do extrato pode vir menor que a soma abaixo.
              </p>
              <ul className="space-y-1 pt-1">
                {comp!.eventos.map((ev, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="tabular-nums font-medium text-amber-700 dark:text-amber-500">
                      {brl(Number(ev.valor))}
                    </span>
                    <span className="text-muted-foreground">
                      — {ev.descricao} ({ev.empresa_nome || ev.stone_code})
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground pt-1">
                <strong>CrossBalance</strong> é transferência entre carteiras da própria Stone:
                sai de uma, entra em outra. Não é perda de venda nem erro de lançamento.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Lado a lado, por empresa (cada bar fatura em mais de um CNPJ) */}
      {empresas.map(emp => (
        <div key={emp} className="space-y-2">
          <p className="text-sm font-medium">{emp}</p>
          <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
            <Tabela
              titulo="Venda"
              subtitulo={`Passou o cartão em ${ddmm(comp?.data)} — é o que vai pro Conta Azul`}
              linhas={(comp?.venda || []).filter(l => (l.empresa_nome || l.stone_code) === emp)}
              destaque="bg-emerald-500/10"
            />
            <div className="hidden lg:flex items-center justify-center pt-16">
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <Tabela
              titulo="Recebimento"
              subtitulo={`Caiu na conta em ${ddmm(comp?.data)} — é o que a maquininha mostra`}
              linhas={(comp?.liquidacao || []).filter(l => (l.empresa_nome || l.stone_code) === emp)}
              destaque="bg-blue-500/10"
              mostrarOrigem
            />
          </div>
        </div>
      ))}

      {!isLoading && empresas.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Sem movimento da Stone neste dia.
        </p>
      )}
    </div>
  );
}
