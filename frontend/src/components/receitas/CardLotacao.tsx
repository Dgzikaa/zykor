'use client';

/**
 * Card "Taxa de Lotação" do Dashboard de Receitas.
 * Capacidade (dias × capacidade_dia) vs atendidos + linha de ocupação %, com régua.
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { ChartCard, GraficoBarrasAgrupadas } from '@/components/graficos/Charts';
import type { PeriodoValor } from '@/lib/receitas/periodo';

const num = (v: number) => Math.round(v || 0).toLocaleString('pt-BR');
const pct = (v: number) => `${(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

interface Ponto {
  key: string;
  label: string;
  capacidade: number;
  atendidos: number;
  ocupacao_pct: number | null;
}

function classifica(p: number): { txt: string; cor: string } {
  if (p < 50) return { txt: 'Sinal de alerta', cor: 'text-rose-600 dark:text-rose-400' };
  if (p < 70) return { txt: 'OK', cor: 'text-amber-600 dark:text-amber-400' };
  if (p < 90) return { txt: 'Boa taxa', cor: 'text-emerald-600 dark:text-emerald-400' };
  return { txt: 'Excelente', cor: 'text-emerald-600 dark:text-emerald-400' };
}

export function CardLotacao({ barId, periodo }: { barId?: number; periodo: PeriodoValor }) {
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [capDia, setCapDia] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!barId) return;
    setLoading(true);
    api
      .get(`/api/receitas/lotacao?bar_id=${barId}&granularidade=${periodo.granularidade}&inicio=${periodo.inicio}&fim=${periodo.fim}`)
      .then((r: any) => {
        if (r?.success) {
          setPontos(r.pontos ?? []);
          setCapDia(r.capacidade_dia ?? null);
        } else {
          setPontos([]);
          setCapDia(null);
        }
      })
      .catch(() => {
        setPontos([]);
        setCapDia(null);
      })
      .finally(() => setLoading(false));
  }, [barId, periodo.granularidade, periodo.inicio, periodo.fim]);

  const ult = pontos[pontos.length - 1];
  const cls = ult?.ocupacao_pct != null ? classifica(ult.ocupacao_pct) : null;
  const right = cls && ult?.ocupacao_pct != null ? <span className={`text-sm font-semibold ${cls.cor}`}>{pct(ult.ocupacao_pct)} · {cls.txt}</span> : undefined;

  return (
    <ChartCard titulo="Taxa de Lotação" subtitulo="capacidade máxima vs atendidos" right={right} className="md:col-span-2">
      {loading ? (
        <div className="flex h-[300px] items-center justify-center text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : capDia == null ? (
        <div className="flex h-[300px] flex-col items-center justify-center gap-1 text-center text-sm text-[hsl(var(--muted-foreground))]">
          <span>Capacidade por dia não configurada para este bar.</span>
          <span className="text-xs">Defina em Configurações → Bares para ver a taxa de lotação.</span>
        </div>
      ) : pontos.length === 0 ? (
        <div className="flex h-[300px] items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">Sem dados no período selecionado.</div>
      ) : (
        <>
          <GraficoBarrasAgrupadas
            data={pontos}
            xKey="label"
            series={[
              { key: 'capacidade', nome: `Capacidade (dias × ${capDia})`, cor: '#334155' },
              { key: 'atendidos', nome: 'Atendidos', cor: '#0ea5e9' },
            ]}
            lineKey="ocupacao_pct"
            nomeLinha="Ocupação %"
            formatV={num}
            formatLine={pct}
            height={300}
            rotacaoX={pontos.length > 8 ? 30 : 0}
          />
          <p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">
            Régua de ocupação: abaixo de 50% alerta · 50–70% ok · 70–90% boa · acima de 90% excelente.
          </p>
        </>
      )}
    </ChartCard>
  );
}
