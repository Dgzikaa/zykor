'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { Target } from 'lucide-react';

/**
 * Metas do período na home (pedido do Cadu, 12/08/2026).
 *
 * Mostra SÓ A META, não o realizado. Três das métricas — "CMV Limpo", "Clientes Ativos" e
 * "CMO Fixo" — não têm definição fechada (limpo de quê? ativo em que janela? a folha CLT
 * vem de qual fonte?), e número inventado na tela inicial é pior que número nenhum.
 * Quando a definição sair, `metrica_chave` liga cada linha à fonte e o realizado entra ao lado.
 *
 * Vem do banco por bar (operations.meta_periodo) — trocar meta não exige deploy.
 */

type Item = { label: string; valor: number; formato: 'moeda' | 'percentual' | 'numero'; metrica_chave: string | null };
type Meta = { periodo_label: string; titulo: string | null; data_inicio: string; data_fim: string; itens: Item[] };

const fmt = (v: number, f: Item['formato']) => {
  if (f === 'moeda') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
    }).format(v);
  }
  if (f === 'percentual') return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
};

export function MetasPeriodo({ barId, accent }: { barId?: number; accent: string }) {
  const [meta, setMeta] = useState<Meta | null>(null);

  useEffect(() => {
    let vivo = true;
    api.get('/api/home/metas')
      .then((r: any) => { if (vivo) setMeta(r?.meta || null); })
      .catch(() => { /* a home nunca deve travar por causa disso */ });
    return () => { vivo = false; };
  }, [barId]);

  if (!meta || !meta.itens?.length) return null;

  return (
    <section className="mb-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
      <div className="px-5 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-2">
        <Target className="w-4 h-4" style={{ color: accent }} />
        <span className="font-semibold text-sm">
          {meta.periodo_label}
          {meta.titulo && <span className="font-normal text-neutral-500 dark:text-neutral-400"> — {meta.titulo}</span>}
        </span>
      </div>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {meta.itens.map(i => (
          <div key={i.label} className="flex items-center justify-between px-5 py-2.5">
            <span className="text-sm text-neutral-700 dark:text-neutral-300">{i.label}</span>
            <span className="text-sm font-semibold tabular-nums">{fmt(i.valor, i.formato)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
