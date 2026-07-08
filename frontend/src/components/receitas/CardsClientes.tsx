'use client';

/**
 * Dois cards do Dashboard de Receitas alimentados por /api/clientes-ativos/evolucao
 * (fetch único): "Clientes Ativos" (evolução da base) e "Novos × Retornantes".
 */

import { useEffect, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { ChartCard, GraficoLinha, GraficoBarrasAgrupadas } from '@/components/graficos/Charts';
import { mesesEntre, type PeriodoValor } from '@/lib/receitas/periodo';

const num = (v: number) => Math.round(v || 0).toLocaleString('pt-BR');
const pct = (v: number) => `${(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

interface Mes {
  mes: string;
  mesLabel: string;
  totalClientes: number;
  novosClientes: number;
  clientesRetornantes: number;
  percentualRetornantes: number;
  baseAtiva: number;
}

export function CardsClientes({ barId, periodo }: { barId?: number; periodo: PeriodoValor }) {
  const [dados, setDados] = useState<Mes[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!barId) return;
    setLoading(true);
    const meses = mesesEntre(periodo.inicio, periodo.fim);
    api
      .get(`/api/clientes-ativos/evolucao?bar_id=${barId}&meses=${meses}`)
      .then((r: any) => setDados(r?.success ? (r.data ?? []) : []))
      .catch(() => setDados([]))
      .finally(() => setLoading(false));
  }, [barId, periodo.inicio, periodo.fim]);

  const ultimo = dados[dados.length - 1];
  const rot = dados.length > 8 ? 30 : 0;

  const corpo = (children: ReactNode, altura = 280) =>
    loading ? (
      <div className="flex items-center justify-center text-[hsl(var(--muted-foreground))]" style={{ height: altura }}>
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    ) : dados.length === 0 ? (
      <div className="flex items-center justify-center text-sm text-[hsl(var(--muted-foreground))]" style={{ height: altura }}>
        Sem dados no período.
      </div>
    ) : (
      children
    );

  return (
    <>
      <ChartCard
        titulo="Clientes Ativos"
        subtitulo="evolução da base ativa mês a mês"
        right={ultimo ? <span className="text-sm font-semibold text-[hsl(var(--foreground))]">{num(ultimo.baseAtiva)}</span> : undefined}
      >
        {corpo(
          <GraficoLinha
            data={dados}
            xKey="mesLabel"
            series={[{ key: 'baseAtiva', nome: 'Base ativa', cor: '#f59e0b' }]}
            formatV={num}
            height={280}
            area
            rotacaoX={rot}
          />,
        )}
      </ChartCard>

      <ChartCard titulo="Novos × Retornantes" subtitulo="aquisição vs retorno + % de retornantes">
        {corpo(
          <GraficoBarrasAgrupadas
            data={dados}
            xKey="mesLabel"
            series={[
              { key: 'novosClientes', nome: 'Novos', cor: '#22c55e' },
              { key: 'clientesRetornantes', nome: 'Retornantes', cor: '#3b82f6' },
            ]}
            lineKey="percentualRetornantes"
            nomeLinha="% retornantes"
            formatV={num}
            formatLine={pct}
            height={280}
            rotacaoX={rot}
          />,
        )}
      </ChartCard>
    </>
  );
}
