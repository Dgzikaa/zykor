'use client';

/**
 * Card "Ticket Médio por Dia da Semana" — irmão do CardDiaSemana (que mostra
 * faturamento). Mesma leitura (cada dia da semana × cada mês do período, em barras
 * horizontais), só que o ticket médio de cada barra vem DIVIDIDO em duas cores:
 * porta (couvert/entrada) + bar (consumo). A soma dos dois é o ticket total.
 *
 * Serve pra responder "o TM caiu — caiu na porta ou no bar?".
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { ChartCard, GraficoBarrasAgrupadasH } from '@/components/graficos/Charts';
import { useGraficoTheme } from '@/components/graficos/GraficoBase';
import type { PeriodoValor } from '@/lib/receitas/periodo';

// eixo/tooltip com centavos (porta gira em R$ 15–25, arredondar mente); rótulo da ponta inteiro
const money2 = (v: number | null) =>
  v == null ? '—' : (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money0 = (v: number | null) =>
  v == null ? '—' : (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

// duas cores fixas da paleta validada (não ciclam por mês): âmbar = porta, azul = bar
const COR_PORTA = (th: { cores: string[] }) => th.cores[2];
const COR_BAR = (th: { cores: string[] }) => th.cores[0];

export function CardTicketDiaSemana({ barId, periodo }: { barId?: number; periodo: PeriodoValor }) {
  const th = useGraficoTheme();
  const [dias, setDias] = useState<Record<string, any>[]>([]);
  const [meses, setMeses] = useState<{ key: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Range local opcional (igual ao card de faturamento) — sobrepõe o período global
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const ini = de && ate ? de : periodo.inicio;
  const fimEff = de && ate ? ate : periodo.fim;

  useEffect(() => {
    if (!barId) return;
    setLoading(true);
    api
      .get(`/api/receitas/ticket-dia-semana-mensal?bar_id=${barId}&inicio=${ini}&fim=${fimEff}`)
      .then((r: any) => {
        if (r?.success) {
          setDias(r.dias ?? []);
          setMeses(r.meses ?? []);
        } else {
          setDias([]);
          setMeses([]);
        }
      })
      .catch(() => {
        setDias([]);
        setMeses([]);
      })
      .finally(() => setLoading(false));
  }, [barId, ini, fimEff]);

  // Um stack por mês: porta embaixo, bar em cima. O nome da série leva o mês (pro
  // tooltip), a legenda do gráfico fica desligada e o card desenha a própria com
  // 2 chips — senão seriam 2 chips por mês repetindo as mesmas duas cores.
  const series = meses.flatMap((m) => [
    { key: `${m.label}__porta`, nome: `${m.label} · Porta`, cor: COR_PORTA(th), stack: m.label, rotulo: 'nenhum' as const },
    // o rótulo (mês + total + variação) sai nesta série: é a última do stack.
    // A variação vem em `${label}__bar__var` justamente por isso.
    { key: `${m.label}__bar`, nome: `${m.label} · Bar`, cor: COR_BAR(th), stack: m.label, rotulo: 'total' as const, rotuloPrefixo: m.label },
  ]);
  // mais alto que o card de faturamento: cada barra vira 2 segmentos e o rótulo
  // carrega mês + total + variação — com 78px/mês os rótulos encostam
  const altura = Math.max(380, meses.length * 100);

  return (
    <ChartCard
      titulo="Ticket Médio por Dia da Semana"
      subtitulo="ticket médio por dia da semana, mês a mês — barra dividida em porta (couvert) + bar (consumo)"
      className="md:col-span-2"
      right={
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)}
            className="h-8 rounded-md border border-[hsl(var(--border))] bg-transparent px-1.5 text-xs text-[hsl(var(--foreground))]" />
          <span className="text-[hsl(var(--muted-foreground))]">–</span>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)}
            className="h-8 rounded-md border border-[hsl(var(--border))] bg-transparent px-1.5 text-xs text-[hsl(var(--foreground))]" />
          {(de || ate) && (
            <button onClick={() => { setDe(''); setAte(''); }} className="text-[hsl(var(--muted-foreground))] underline">limpar</button>
          )}
        </div>
      }
    >
      {loading ? (
        <div className="flex h-[340px] items-center justify-center text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !dias.length || !meses.length ? (
        <div className="flex h-[340px] items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">Sem eventos no período selecionado.</div>
      ) : (
        <>
          <div className="mb-1 flex flex-wrap items-center gap-3 text-[11px] text-[hsl(var(--muted-foreground))]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: COR_PORTA(th) }} /> Porta (couvert)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: COR_BAR(th) }} /> Bar (consumo)
            </span>
          </div>
          <GraficoBarrasAgrupadasH
            data={dias}
            yKey="dia"
            series={series}
            formatV={money2}
            formatRotulo={money0}
            height={altura}
            mostrarVariacao
            margemDireita={150}
            mostrarLegenda={false}
          />
          <p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">
            Ticket ponderado (faturamento ÷ clientes do período), não média de médias. O % é a variação do ticket
            total contra o mês anterior no mesmo dia da semana.
          </p>
        </>
      )}
    </ChartCard>
  );
}
