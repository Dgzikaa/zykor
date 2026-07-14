'use client';

import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { fmtData, fmtTempo, rendAmigavel, fmtNum, fmtPct, fmtBRL, fmtPeso } from './_shared';

/**
 * Detalhe (SÓ LEITURA) de uma execução de produção: rendimento real × meta e a tabela de
 * insumos Calculado (planejado) × Usado (realizado) com desvio e custo. Reutilizável — usado
 * na aba Análise pra abrir a produção como no Histórico (sem editar/excluir).
 */
export function DetalheExecucaoModal({ execucao, barId, onClose }: { execucao: any | null; barId?: number; onClose: () => void }) {
  const [insumos, setInsumos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!execucao || !barId) return;
    let vivo = true;
    setInsumos([]); setLoading(true);
    api.get(`/api/operacional/producoes/execucao?bar_id=${barId}&execucao_id=${execucao.id}`)
      .then((r) => { if (vivo && r.success) setInsumos(r.insumos || []); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [execucao, barId]);

  if (!execucao) return null;
  const e = execucao;
  const rend = rendAmigavel(e);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">{e.producao_nome}{e.producao_codigo && <span className="text-gray-400 font-mono text-xs"> · {e.producao_codigo}</span>}</h4>
            <p className="text-xs text-gray-500">{fmtData(e.criado_em)} · {e.responsavel_nome || '—'} · {e.duracao_seg != null ? fmtTempo(e.duracao_seg) : '—'}</p>
            {e.rendimento_real != null && (
              <p className="text-xs mt-1 text-gray-600 dark:text-gray-300">
                Rendimento: <b>{fmtNum(rend.real, 2)} {rend.un}</b>
                <span className="text-gray-400"> / meta </span>
                {e.rendimento_esperado != null ? `${fmtNum(rend.esp, 2)} ${rend.un}` : '—'}
                {e.rendimento_esperado != null && e.rendimento_esperado > 0 && (() => {
                  const p = (Number(e.rendimento_real) / Number(e.rendimento_esperado)) * 100;
                  return <span className={`ml-1 font-medium ${p >= 95 && p <= 105 ? 'text-emerald-600' : p >= 90 ? 'text-amber-600' : 'text-red-600'}`}>({fmtPct(p)})</span>;
                })()}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0"><X className="w-5 h-5" /></button>
        </div>
        {e.observacao && <p className="text-xs text-gray-500 italic mb-2">“{e.observacao}”</p>}
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 dark:text-gray-400 border-b"><tr>
            <th className="text-left font-medium px-2 py-1.5">Insumo</th>
            <th className="text-right font-medium px-2 py-1.5" title="Quanto a ficha previa (planejado)">Calculado</th>
            <th className="text-right font-medium px-2 py-1.5" title="Quanto foi de fato usado (realizado)">Usado</th>
            <th className="text-right font-medium px-2 py-1.5">Desvio</th>
            <th className="text-right font-medium px-2 py-1.5">Custo real</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? <tr><td colSpan={5} className="px-2 py-4 text-center text-gray-400"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></td></tr>
            : insumos.length === 0 ? <tr><td colSpan={5} className="px-2 py-4 text-center text-gray-400">Sem insumos.</td></tr>
            : insumos.map((i) => (
              <tr key={i.id} className={i.is_mestre ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}>
                <td className="px-2 py-1.5">{i.is_mestre && <span className="text-amber-500 mr-1">★</span>}{i.nome || i.insumo_codigo || '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtPeso(i.qtd_calculada, i.unidade)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtPeso(i.qtd_real, i.unidade)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {i.desvio_pct == null ? '—' : <span className={Math.abs(i.desvio_pct) < 0.05 ? 'text-emerald-600' : Math.abs(i.desvio_pct) < 0.15 ? 'text-amber-600' : 'text-red-600'}>{i.desvio_pct > 0 ? '+' : ''}{fmtPct(i.desvio_pct * 100)}</span>}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums font-medium">{fmtBRL(i.custo_real)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
