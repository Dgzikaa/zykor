'use client';

/**
 * Dashboard de Receitas — visão unificada (área Receitas).
 *
 * Shell da Fase 1: o seletor de período compartilhado já está ligado e cada
 * gráfico entra como card à medida que for implementado. Modelo em docs/dash/
 * e plano em docs/planejamento-receitas.md. MVP no Ordinário (bar 3).
 */

import { useEffect, useState } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { PeriodRangePicker } from '@/components/receitas/PeriodRangePicker';
import { periodoPadrao, type PeriodoValor } from '@/lib/receitas/periodo';

interface CardGrafico {
  chave: string;
  titulo: string;
  descricao: string;
}

// Ordem por esforço definida no plano (Bloco 1 + extras do modelo).
const GRAFICOS: CardGrafico[] = [
  { chave: 'crescimento', titulo: 'Taxa de Crescimento', descricao: 'Faturamento por dia aberto, mês a mês.' },
  { chave: 'inputs', titulo: 'Inputs de Crescimento', descricao: 'Reservas/dia · clientes/dia · ticket médio.' },
  { chave: 'clientes-ativos', titulo: 'Clientes Ativos', descricao: 'Evolução da base ativa + correlação com faturamento.' },
  { chave: 'lotacao', titulo: 'Taxa de Lotação', descricao: 'Capacidade máxima (dias × capacidade) vs atendidos.' },
  { chave: 'dia-semana', titulo: 'Crescimento por Dia da Semana', descricao: 'Detratores/promotores nas 3 janelas (ano, mês, trimestre).' },
  { chave: 'roas', titulo: 'ROAS / Gasto Comercial', descricao: 'Retorno por real gasto (marketing + artistas + produção).' },
  { chave: 'novos-retornantes', titulo: 'Novos × Retornantes', descricao: 'Aquisição vs retorno + % de retornantes.' },
  { chave: 'nps', titulo: 'Satisfação / NPS', descricao: 'NPS mês a mês + benchmark de concorrentes.' },
];

export default function DashboardReceitasPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const [periodo, setPeriodo] = useState<PeriodoValor>(() => periodoPadrao('mes', 'trimestral'));

  useEffect(() => {
    setPageTitle('💰 Dashboard de Receitas');
    return () => setPageTitle('');
  }, [setPageTitle]);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Visão unificada de receita para {selectedBar?.nome ?? 'o bar selecionado'}.
        </p>
        <PeriodRangePicker value={periodo} onChange={setPeriodo} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {GRAFICOS.map((g) => (
          <Card key={g.chave} className="flex min-h-[180px] flex-col justify-between p-5">
            <div>
              <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">{g.titulo}</h2>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{g.descricao}</p>
            </div>
            <div className="mt-4 flex items-center justify-center rounded-lg border border-dashed border-[hsl(var(--border))] py-8 text-xs text-[hsl(var(--muted-foreground))]">
              Em construção
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
