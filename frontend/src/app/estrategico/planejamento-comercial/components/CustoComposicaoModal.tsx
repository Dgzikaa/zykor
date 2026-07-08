'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertTriangle, Loader2, RefreshCw, Check } from 'lucide-react';

const money = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export interface ComposicaoAlvo { tipo: 'art' | 'prod' | 'consumacao'; data: string; nome: string; }

const TITULO: Record<string, string> = { art: 'Custo Artístico', prod: 'Custo Produção', consumacao: 'Consumação Artistas' };
const FONTE_LABEL: Record<string, string> = {
  real_ca: 'Real do Conta Azul', override: 'Previsão manual (override)',
  projecao: 'Projeção automática (média 4 semanas)', contahub: 'ContaHub (descontos motivo “Artistas”)', vazio: 'Sem lançamento',
};

export default function CustoComposicaoModal({ alvo, barId, onClose }: {
  alvo: ComposicaoAlvo | null;
  barId?: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [d, setD] = useState<any>(null);
  const [recalculando, setRecalculando] = useState(false);
  const [feito, setFeito] = useState<string | null>(null);

  const carregar = useCallback(() => {
    if (!alvo || !barId) return;
    setLoading(true); setD(null);
    fetch(`/api/planejamento/custo-composicao?tipo=${alvo.tipo}&data=${alvo.data}`, {
      headers: { 'x-selected-bar-id': String(barId) }, cache: 'no-store',
    })
      .then(r => r.json()).then(setD).catch(() => setD({ success: false, error: 'falha ao carregar' }))
      .finally(() => setLoading(false));
  }, [alvo, barId]);

  useEffect(() => { setFeito(null); carregar(); }, [carregar]);

  const recalcular = useCallback(async () => {
    if (!alvo || !barId) return;
    setRecalculando(true); setFeito(null);
    try {
      const r = await fetch('/api/planejamento/recalcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-selected-bar-id': String(barId) },
        body: JSON.stringify({ data: alvo.data }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.error || 'falha ao recalcular');
      const valorNovo = alvo.tipo === 'prod' ? j.c_prod : j.c_art;
      setFeito(`Tabela atualizada para ${money(valorNovo)}.`);
      carregar();          // reflete a nova cascata no próprio modal
      router.refresh();    // re-executa o server component → tabela pega o novo c_art
    } catch (e: any) {
      setFeito(`Erro ao recalcular: ${e?.message || 'tente de novo'}`);
    } finally {
      setRecalculando(false);
    }
  }, [alvo, barId, carregar, router]);

  if (!alvo) return null;
  const dataBR = alvo.data.split('-').reverse().join('/');
  const isCA = alvo.tipo !== 'consumacao';
  const temItens = d?.itens?.length > 0;

  // Divergência: o que está na TABELA (real cacheado no eventos_base) x o CA AO VIVO
  // (soma dos lançamentos agora). Quando difere, um lançamento foi corrigido no CA e o
  // cache ainda não foi recomputado → oferece o "Recalcular agora".
  const realCacheado = Number(d?.candidatos?.real) || 0;
  const aoVivo = Number(d?.soma_lancamentos) || 0;
  const diverge = isCA && d?.success && Math.abs(aoVivo - realCacheado) > 0.01;

  return (
    <Dialog open={!!alvo} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{TITULO[alvo.tipo]} — {dataBR}</DialogTitle>
          <DialogDescription>{alvo.nome} · o que compõe o valor mostrado na tela</DialogDescription>
        </DialogHeader>

        {loading && <div className="py-10 flex items-center justify-center text-gray-500"><Loader2 className="h-5 w-5 animate-spin mr-2" />carregando…</div>}

        {!loading && d && !d.success && <div className="py-6 text-center text-rose-600 text-sm">{d.error || 'erro ao carregar'}</div>}

        {!loading && d?.success && (
          <div className="space-y-3">
            {/* Cabeçalho: valor + fonte */}
            <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 p-3">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-400">Valor na tela</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{money(d.valor_total)}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wide text-gray-400">Fonte</div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-200">{FONTE_LABEL[d.fonte] || d.fonte}</div>
              </div>
            </div>

            {/* Divergência tabela x CA ao vivo → botão de recálculo pontual */}
            {diverge && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-900/20 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 text-[13px] text-amber-800 dark:text-amber-200">
                    A tabela mostra <b>{money(realCacheado)}</b>, mas o Conta Azul já tem <b>{money(aoVivo)}</b> —
                    um lançamento foi corrigido no CA e o valor da tela ainda não atualizou.
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={recalcular} disabled={recalculando}
                    className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-[13px] font-medium px-3 py-1.5"
                  >
                    {recalculando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Recalcular agora
                  </button>
                  {feito && !recalculando && (
                    <span className="inline-flex items-center gap-1 text-[12px] text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5" />{feito}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Confirmação quando reconciliou (não diverge mais após recalcular) */}
            {!diverge && feito && (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-900/20 p-2.5 flex items-center gap-1.5 text-[13px] text-emerald-700 dark:text-emerald-300">
                <Check className="h-4 w-4" />{feito}
              </div>
            )}

            {/* Cascata (só custos do CA) */}
            {isCA && d.candidatos && (
              <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                {([['real', 'Real CA'], ['override', 'Override'], ['projecao', 'Projeção']] as const).map(([k, lbl]) => (
                  <div key={k} className={`rounded-md border p-2 ${d.fonte === (k === 'real' ? 'real_ca' : k) ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-800'}`}>
                    <div className="text-gray-400">{lbl}</div>
                    <div className="font-semibold text-gray-800 dark:text-gray-100">{money(d.candidatos[k])}</div>
                  </div>
                ))}
              </div>
            )}

            {isCA && d.fonte !== 'real_ca' && (
              <p className="text-[12px] text-amber-600 dark:text-amber-400">
                Ainda não há lançamento no Conta Azul pra esse dia — o valor mostrado é {d.fonte === 'override' ? 'uma previsão manual' : 'a projeção automática (média das últimas 4 semanas)'}. Quando o cachê for lançado no CA, ele substitui.
              </p>
            )}

            {/* Itens */}
            {temItens ? (
              <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 text-[11px] uppercase sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2">{isCA ? 'Lançamento' : 'Cliente / mesa'}</th>
                      <th className="text-right px-3 py-2">Valor</th>
                      {isCA && <th className="text-center px-3 py-2">Status</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {d.itens.map((it: any, i: number) => (
                      <tr key={i} className={it.dia_errado ? 'bg-rose-50/60 dark:bg-rose-900/15' : ''}>
                        <td className="px-3 py-2">
                          <div className="text-gray-900 dark:text-gray-100 flex items-center gap-1">
                            {it.dia_errado && <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
                            {it.descricao || '—'}
                          </div>
                          <div className="text-[11px] text-gray-400">{isCA ? (it.pessoa || it.categoria) : [it.mesa, it.pessoas ? `${it.pessoas} pes.` : null].filter(Boolean).join(' · ')}</div>
                          {it.dia_errado && <div className="text-[11px] text-rose-600 dark:text-rose-400">⚠ a descrição cita outro dia da semana — competência pode estar no dia errado</div>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                          {money(it.valor_usado)}
                          {isCA && it.valor_pago === 0 && <div className="text-[10px] text-gray-400">a pagar (bruto)</div>}
                        </td>
                        {isCA && <td className="px-3 py-2 text-center text-[11px] text-gray-500">{it.pago_flag ? 'Pago' : (it.status || '—')}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : isCA && d.fonte !== 'real_ca' ? null : (
              <p className="py-4 text-center text-sm text-gray-500">Sem lançamentos pra esse dia.</p>
            )}

            {temItens && (
              <div className="flex justify-between text-sm font-medium px-1">
                <span className="text-gray-500">Total ({d.count} {isCA ? 'lançamento(s)' : 'linha(s)'})</span>
                <span className="text-gray-900 dark:text-white">{money(isCA ? d.soma_lancamentos : d.valor_total)}</span>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
