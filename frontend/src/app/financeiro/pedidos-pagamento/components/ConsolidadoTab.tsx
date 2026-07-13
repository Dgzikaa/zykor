'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { ChevronDown, ChevronRight, Copy, CalendarClock, Receipt } from 'lucide-react';
import { isoToBr } from '@/components/ui/date-input-br';
import { STATUS_LABEL, STATUS_COLOR, formatBRL, type Pedido } from '../types';

// Consolidado = visão diária dos PIX que já foram decididos (aprovado/agendado/pago) — o
// "o que sai do caixa em cada dia", que antes vivia no grupo do WhatsApp. Exclui o que ainda
// espera aprovação, recusado, cancelado e rascunho.
const STATUS_CONSOLIDADO = new Set(['aprovado', 'agendado', 'pago', 'erro_ca', 'erro_inter']);

type AgruparPor = 'vencimento' | 'competencia';
const SEM_VENC = 'sem-data';
const dataDoPedido = (p: Pedido, por: AgruparPor) =>
  ((por === 'competencia' ? p.data_competencia : p.data_vencimento) || '').slice(0, 10) || SEM_VENC;

// 'YYYY-MM-DD' → Date ao meio-dia local (evita o shift de fuso que joga pro dia anterior).
function parseLocalDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function labelDia(chave: string, por: AgruparPor): string {
  if (chave === SEM_VENC) return por === 'competencia' ? 'Sem competência' : 'Sem vencimento';
  const d = parseLocalDate(chave);
  if (!d) return isoToBr(chave) || chave;
  return `${DIAS_SEMANA[d.getDay()]}, ${isoToBr(chave)}`;
}

// Texto no mesmo formato das mensagens do grupo — pra colar em qualquer lugar.
function textoResumoDia(chave: string, itens: Pedido[], por: AgruparPor): string {
  const cabecalho = `📅 ${labelDia(chave, por)} — ${itens.length} pagamento(s) · ${formatBRL(
    itens.reduce((s, p) => s + (p.valor || 0), 0)
  )}`;
  const blocos = itens.map((p) =>
    [
      `Valor: ${formatBRL(p.valor)}`,
      `Descrição: ${p.descricao}`,
      p.categoria_nome ? `Categoria: ${p.categoria_nome}` : null,
      p.chave_pix ? `Pix: ${p.chave_pix}` : null,
      p.beneficiario_nome ? `Favorecido: ${p.beneficiario_nome}` : null,
      p.data_competencia ? `Competência: ${isoToBr(p.data_competencia)}` : null,
      `Vencimento: ${isoToBr(p.data_vencimento) || '—'}`,
    ]
      .filter(Boolean)
      .join('\n')
  );
  return `${cabecalho}\n\n${blocos.join('\n\n')}`;
}

/**
 * Aba "Consolidado": agrupa os PIX por dia de vencimento, ordena por data e mostra
 * subtotal por dia + total geral. Cada dia é recolhível e tem "Copiar resumo".
 */
export function ConsolidadoTab({
  pedidos,
  onOpenDetalhe,
}: {
  pedidos: Pedido[];
  onOpenDetalhe: (id: string) => void;
}) {
  const { showToast } = useToast();
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  const [agruparPor, setAgruparPor] = useState<AgruparPor>('vencimento');

  const grupos = useMemo(() => {
    const inclusos = pedidos.filter((p) => STATUS_CONSOLIDADO.has(p.status));
    const mapa = new Map<string, Pedido[]>();
    for (const p of inclusos) {
      const chave = dataDoPedido(p, agruparPor);
      (mapa.get(chave) ?? mapa.set(chave, []).get(chave)!).push(p);
    }
    // Dias em ordem cronológica (data mais próxima primeiro); "sem data" no fim.
    const chaves = [...mapa.keys()].sort((a, b) => {
      if (a === SEM_VENC) return 1;
      if (b === SEM_VENC) return -1;
      return a.localeCompare(b);
    });
    return chaves.map((chave) => {
      const itens = mapa.get(chave)!.sort((a, b) => (b.valor || 0) - (a.valor || 0));
      const total = itens.reduce((s, p) => s + (p.valor || 0), 0);
      return { chave, itens, total };
    });
  }, [pedidos, agruparPor]);

  const totalGeral = useMemo(() => grupos.reduce((s, g) => s + g.total, 0), [grupos]);
  const qtdTotal = useMemo(() => grupos.reduce((s, g) => s + g.itens.length, 0), [grupos]);

  const toggle = (chave: string) =>
    setRecolhidos((prev) => {
      const next = new Set(prev);
      next.has(chave) ? next.delete(chave) : next.add(chave);
      return next;
    });

  const copiar = async (chave: string, itens: Pedido[]) => {
    try {
      await navigator.clipboard.writeText(textoResumoDia(chave, itens, agruparPor));
      showToast({ type: 'success', title: 'Resumo copiado', message: 'Cole onde quiser (WhatsApp, e-mail...).' });
    } catch {
      showToast({ type: 'error', title: 'Não deu pra copiar', message: 'Seu navegador bloqueou a área de transferência.' });
    }
  };

  if (grupos.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Receipt className="w-10 h-10 mx-auto mb-2 opacity-40" />
          Nenhum pagamento aprovado/agendado no período.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Agrupar por: Vencimento (o que sai do caixa no dia) × Competência (regime contábil) */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">Agrupar por</span>
        <div className="inline-flex rounded-lg border border-[hsl(var(--border))] p-0.5">
          {([['vencimento', 'Vencimento'], ['competencia', 'Competência']] as [AgruparPor, string][]).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setAgruparPor(v)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition ${agruparPor === v ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Total geral */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-[hsl(var(--border))] bg-muted/30 px-4 py-3">
        <span className="text-sm text-muted-foreground">
          {qtdTotal} pagamento(s) em {grupos.length} dia(s)
        </span>
        <span className="text-lg font-bold">{formatBRL(totalGeral)}</span>
      </div>

      {grupos.map(({ chave, itens, total }) => {
        const aberto = !recolhidos.has(chave);
        return (
          <div key={chave} className="rounded-lg border border-[hsl(var(--border))] bg-card overflow-hidden">
            {/* Cabeçalho do dia */}
            <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/20">
              <button onClick={() => toggle(chave)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                {aberto ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                <CalendarClock className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="font-semibold truncate">{labelDia(chave, agruparPor)}</span>
                <Badge variant="secondary" className="shrink-0">{itens.length}</Badge>
              </button>
              <span className="font-bold shrink-0">{formatBRL(total)}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 shrink-0"
                onClick={() => copiar(chave, itens)}
                title="Copiar resumo do dia no formato de mensagem"
              >
                <Copy className="w-3.5 h-3.5 sm:mr-1" />
                <span className="hidden sm:inline">Copiar</span>
              </Button>
            </div>

            {/* Itens do dia */}
            {aberto && (
              <div className="divide-y divide-[hsl(var(--border))]">
                {itens.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onOpenDetalhe(p.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left transition hover:bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{p.descricao}</span>
                        <Badge className={`${STATUS_COLOR[p.status]} text-[10px] shrink-0`}>{STATUS_LABEL[p.status]}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {p.beneficiario_nome ? `${p.beneficiario_nome}` : 'Sem favorecido'}
                        {p.categoria_nome ? ` · ${p.categoria_nome}` : ''}
                        {p.chave_pix ? ` · ${p.chave_pix}` : ''}
                      </div>
                    </div>
                    <span className="font-semibold shrink-0">{formatBRL(p.valor)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
