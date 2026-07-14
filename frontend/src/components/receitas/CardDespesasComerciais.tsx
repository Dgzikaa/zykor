'use client';

/**
 * Card "Despesas Comerciais & ROI" do Dashboard de Receitas.
 * Barras agrupadas: mídia, artista, produção e benefício (eixo esq., R$) + ROI como
 * linha (eixo dir.). ROI = (faturamento × 0,6) ÷ despesas comerciais.
 * Recebe os pontos já buscados pela página (mesma fonte do KPI de faturamento).
 */

import { Loader2 } from 'lucide-react';
import { ChartCard, GraficoBarrasAgrupadas } from '@/components/graficos/Charts';

const money0 = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const roiFmt = (v: number) => `${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×`;

export interface PontoDespesa {
  key: string;
  label: string;
  midia: number;
  artista: number;
  producao: number;
  beneficio: number;
  roi: number | null;
}

export function CardDespesasComerciais({ pontos, loading }: { pontos: PontoDespesa[]; loading: boolean }) {
  return (
    <ChartCard
      titulo="Despesas Comerciais & ROI"
      subtitulo="mídia, artista, produção e benefício (barras) × ROI (linha) — ROI = (faturamento × 0,6) ÷ despesas"
      className="md:col-span-2"
    >
      {loading ? (
        <div className="flex h-[340px] items-center justify-center text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !pontos.length ? (
        <div className="flex h-[340px] items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">Sem dados no período selecionado.</div>
      ) : (
        <GraficoBarrasAgrupadas
          data={pontos}
          xKey="label"
          series={[
            { key: 'midia', nome: 'Mídia', cor: '#6366f1' },
            { key: 'artista', nome: 'Artista', cor: '#ec4899' },
            { key: 'producao', nome: 'Produção', cor: '#f59e0b' },
            { key: 'beneficio', nome: 'Benefício', cor: '#14b8a6' },
          ]}
          lineKey="roi"
          nomeLinha="ROI"
          formatV={money0}
          formatLine={roiFmt}
          corLinha="#22c55e"
          height={340}
          rotacaoX={pontos.length > 8 ? 30 : 0}
        />
      )}
    </ChartCard>
  );
}
