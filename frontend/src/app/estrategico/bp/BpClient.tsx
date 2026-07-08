'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { BpLinha, BpIndicador, AnaliseSemanal, DiaSemana } from './types';
import { cn } from '@/lib/utils';
import { HistoricoOrcamentoTab } from '../orcamentacao/components/HistoricoOrcamentoTab';
import { proximaVersao } from './lib/versao';

const DIAS: { key: DiaSemana; label: string; labelLong: string }[] = [
  { key: 'seg', label: 'Seg', labelLong: 'Segunda' },
  { key: 'ter', label: 'Ter', labelLong: 'Terça' },
  { key: 'qua', label: 'Qua', labelLong: 'Quarta' },
  { key: 'qui', label: 'Qui', labelLong: 'Quinta' },
  { key: 'sex', label: 'Sex', labelLong: 'Sexta' },
  { key: 'sab', label: 'Sáb', labelLong: 'Sábado' },
  { key: 'dom', label: 'Dom', labelLong: 'Domingo' },
];

const MESES_NOMES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const fmtBRL = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1000) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  }
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const fmtPct = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `${v.toFixed(1)}%`;
};

const fmtNum = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
};

interface Props {
  linhas: BpLinha[];
  indicadores: BpIndicador[];
  versoes: { ano: number; versao: string }[];
  anoAtual: number;
  versaoAtual: string;
  mesAnalise: number;
  analise: AnaliseSemanal;
  barId: number;
}

export function BpClient({
  linhas,
  indicadores,
  versoes,
  anoAtual,
  versaoAtual,
  mesAnalise,
  analise,
  barId,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<'dre' | 'analise' | 'historico'>('dre');
  const [novoBpOpen, setNovoBpOpen] = useState(false);

  const { setPageTitle } = usePageTitle();
  useEffect(() => {
    setPageTitle('📊 Business Plan (BP)');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const indMap = useMemo(() => {
    const m = new Map<string, BpIndicador>();
    indicadores.forEach(i => m.set(i.indicador, i));
    return m;
  }, [indicadores]);

  // Agrupar linhas por bloco para DRE (exclui Metricas Operacionais)
  const blocosDre = useMemo(() => {
    const ordem = [
      'Receitas',
      'Despesas Variaveis',
      'CMV',
      'Mao-de-Obra',
      'Despesas Comerciais',
      'Despesas Administrativas',
      'Despesas Operacionais',
      'Despesas Ocupacao',
      'Contratos',
    ];
    const grouped = new Map<string, BpLinha[]>();
    linhas
      .filter(l => l.bloco !== 'Metricas Operacionais')
      .forEach(l => {
        const arr = grouped.get(l.bloco) || [];
        arr.push(l);
        grouped.set(l.bloco, arr);
      });
    return ordem
      .filter(b => grouped.has(b))
      .map(b => ({ bloco: b, linhas: (grouped.get(b) || []).sort((a, b) => a.ordem - b.ordem) }));
  }, [linhas]);

  const totaisBloco = useMemo(() => {
    const t = new Map<string, number>();
    blocosDre.forEach(({ bloco, linhas }) => {
      t.set(bloco, linhas.reduce((s, l) => s + (l.valor_mensal || 0), 0));
    });
    return t;
  }, [blocosDre]);

  const receitaTotal = totaisBloco.get('Receitas') || 0;
  const ebitda = blocosDre.reduce((acc, { linhas }) => acc + linhas.reduce((s, l) => s + (l.valor_mensal || 0), 0), 0);

  const breakeven = Number(indMap.get('breakeven_mensal')?.valor || 0);
  const margemContrib = Number(indMap.get('margem_contribuicao_pct')?.valor || 0);
  const margemLiquida = receitaTotal > 0 ? (ebitda / receitaTotal) * 100 : 0;
  const cmvAlvo = Number(indMap.get('cmv_alvo_pct')?.valor || 0);

  const handleChangeVersao = (val: string) => {
    const [a, v] = val.split('|');
    router.push(`/estrategico/bp?ano=${a}&versao=${encodeURIComponent(v)}&mes=${mesAnalise}`);
  };
  const handleChangeMes = (val: string) => {
    router.push(`/estrategico/bp?ano=${anoAtual}&versao=${encodeURIComponent(versaoAtual)}&mes=${val}`);
  };

  const variacao = (real: number, plan: number, lowerIsBetter = false): { color: string; pct: number } => {
    if (plan === 0) return { color: 'text-gray-500', pct: 0 };
    const pct = ((real - plan) / Math.abs(plan)) * 100;
    let color = 'text-gray-500';
    if (lowerIsBetter) {
      color = real <= plan ? 'text-emerald-600' : 'text-red-600';
    } else {
      color = real >= plan ? 'text-emerald-600' : 'text-red-600';
    }
    return { color, pct };
  };

  return (
    <div className="p-3 md:p-4 space-y-3">
      {/* Seletor de versao no topo direito (sem titulo — ja esta dentro da aba BP) */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setNovoBpOpen(true)}>
          <Plus className="w-3.5 h-3.5" /> Novo BP
        </Button>
        <span className="text-xs text-muted-foreground">Versão:</span>
        <Select value={`${anoAtual}|${versaoAtual}`} onValueChange={handleChangeVersao}>
          <SelectTrigger className="w-[180px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {versoes.length === 0 ? (
              <SelectItem value={`${anoAtual}|${versaoAtual}`}>{`${versaoAtual} (${anoAtual})`}</SelectItem>
            ) : (
              versoes.map(v => (
                <SelectItem key={`${v.ano}|${v.versao}`} value={`${v.ano}|${v.versao}`}>
                  {v.versao} ({v.ano})
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <NovoBpModal
        open={novoBpOpen}
        onOpenChange={setNovoBpOpen}
        barId={barId}
        linhas={linhas}
        indicadores={indicadores}
        versaoAtual={versaoAtual}
        anoAtual={anoAtual}
        onCreated={() => router.refresh()}
      />

      {/* Indicadores macro fixos */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Receita Mensal" valor={fmtBRL(receitaTotal)} />
        <KpiCard label="BreakEven" valor={fmtBRL(breakeven)} sub="Receita pra zerar" />
        <KpiCard
          label="EBITDA Projetado"
          valor={fmtBRL(ebitda)}
          sub={`${margemLiquida.toFixed(1)}% margem`}
          accent={ebitda >= 0 ? 'green' : 'red'}
        />
        <KpiCard label="Margem Contribuição" valor={fmtPct(margemContrib)} />
        <KpiCard label="CMV Alvo" valor={fmtPct(cmvAlvo)} />
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as 'dre' | 'analise' | 'historico')}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="dre">DRE Projetada</TabsTrigger>
          <TabsTrigger value="analise">Análise Semanal</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        {/* ABA 1: DRE PROJETADA — estilo Excel */}
        <TabsContent value="dre" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr className="text-xs uppercase text-muted-foreground border-b">
                      <th className="text-left py-2 px-3 w-[180px]">Bloco</th>
                      <th className="text-left py-2 px-3">Linha</th>
                      <th className="text-right py-2 px-3 w-[140px]">Valor Mensal</th>
                      <th className="text-right py-2 px-3 w-[80px] hidden md:table-cell">% Receita</th>
                      <th className="text-left py-2 px-3 hidden lg:table-cell">Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blocosDre.map(({ bloco, linhas: ls }) => (
                      <BlocoRows key={bloco} bloco={bloco} linhas={ls} subtotal={totaisBloco.get(bloco) || 0} receitaTotal={receitaTotal} />
                    ))}
                    {/* EBITDA */}
                    <tr className="bg-blue-50 dark:bg-blue-950 font-bold text-base border-t-4 border-blue-300">
                      <td className="py-3 px-3" colSpan={2}>EBITDA</td>
                      <td className={cn("text-right py-3 px-3 font-mono", ebitda >= 0 ? 'text-emerald-700' : 'text-red-700')}>
                        {fmtBRL(ebitda)}
                      </td>
                      <td className="text-right py-3 px-3 hidden md:table-cell font-mono">{fmtPct(margemLiquida)}</td>
                      <td className="hidden lg:table-cell" />
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Notas do BP</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                <li>Artístico: achar 6k de cachê por semana</li>
                <li>Produção e Material Operação: explodir categorias e definir budgets de cada linha</li>
                <li>Marketing: gerir o budget total com consumações</li>
                <li>Mudar o pagamento da Meta para semanal</li>
                <li>Mudar o benefício da semana pra R$100</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 2: ANÁLISE SEMANAL — comparativo dia da semana */}
        <TabsContent value="analise" className="mt-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground">Mês de análise:</span>
            <Select value={String(mesAnalise)} onValueChange={handleChangeMes}>
              <SelectTrigger className="w-[160px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <SelectItem key={m} value={String(m)}>{MESES_NOMES[m]}/{anoAtual}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline">{analise.totais.eventos_count} eventos no mês</Badge>
          </div>

          {/* Tabela: dia da semana × métrica */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Planejado × Realizado por dia da semana — <span className="capitalize">{analise.label}</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Plan = BP × ocorrências do dia no mês. Real = agregado dos eventos do mês via planejamento comercial.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr className="border-b text-[10px] uppercase text-muted-foreground">
                      <th className="text-left py-2 px-2 sticky left-0 bg-muted/40 w-[150px]">Métrica</th>
                      {DIAS.map(d => (
                        <th key={d.key} className="text-right py-2 px-2">{d.label}</th>
                      ))}
                      <th className="text-right py-2 px-2 bg-blue-100 dark:bg-blue-950">Total Mês</th>
                    </tr>
                  </thead>
                  <tbody>
                    <LinhaMetrica
                      label="Eventos"
                      valores={analise.por_dia.map(d => d.eventos_count)}
                      total={analise.totais.eventos_count}
                      fmt={fmtNum}
                    />
                    <LinhaPlanReal
                      label="Pessoas"
                      plan={analise.por_dia.map(d => d.pessoas_plan)}
                      real={analise.por_dia.map(d => d.pessoas_real)}
                      totalPlan={analise.totais.pessoas_plan}
                      totalReal={analise.totais.pessoas_real}
                      fmt={fmtNum}
                      lowerIsBetter={false}
                      variacao={variacao}
                    />
                    <LinhaPlanReal
                      label="Tkt M. Bar"
                      plan={analise.por_dia.map(d => d.tb_plan)}
                      real={analise.por_dia.map(d => d.tb_real)}
                      totalPlan={
                        analise.totais.pessoas_plan > 0 ? analise.totais.fat_bar_plan / analise.totais.pessoas_plan : 0
                      }
                      totalReal={
                        analise.totais.pessoas_real > 0 ? analise.totais.fat_bar_real / analise.totais.pessoas_real : 0
                      }
                      fmt={fmtBRL}
                      lowerIsBetter={false}
                      variacao={variacao}
                    />
                    <LinhaPlanReal
                      label="Tkt M. Entrada"
                      plan={analise.por_dia.map(d => d.te_plan)}
                      real={analise.por_dia.map(d => d.te_real)}
                      totalPlan={
                        analise.totais.pessoas_plan > 0
                          ? analise.totais.fat_entrada_plan / analise.totais.pessoas_plan
                          : 0
                      }
                      totalReal={
                        analise.totais.pessoas_real > 0
                          ? analise.totais.fat_entrada_real / analise.totais.pessoas_real
                          : 0
                      }
                      fmt={fmtBRL}
                      lowerIsBetter={false}
                      variacao={variacao}
                    />
                    <LinhaPlanReal
                      label="Fat. Entrada"
                      plan={analise.por_dia.map(d => d.fat_entrada_plan)}
                      real={analise.por_dia.map(d => d.fat_entrada_real)}
                      totalPlan={analise.totais.fat_entrada_plan}
                      totalReal={analise.totais.fat_entrada_real}
                      fmt={fmtBRL}
                      lowerIsBetter={false}
                      variacao={variacao}
                    />
                    <LinhaPlanReal
                      label="Fat. Bar"
                      plan={analise.por_dia.map(d => d.fat_bar_plan)}
                      real={analise.por_dia.map(d => d.fat_bar_real)}
                      totalPlan={analise.totais.fat_bar_plan}
                      totalReal={analise.totais.fat_bar_real}
                      fmt={fmtBRL}
                      lowerIsBetter={false}
                      variacao={variacao}
                    />
                    <LinhaPlanReal
                      label="Fat. Total"
                      plan={analise.por_dia.map(d => d.fat_total_plan)}
                      real={analise.por_dia.map(d => d.fat_total_real)}
                      totalPlan={analise.totais.fat_total_plan}
                      totalReal={analise.totais.fat_total_real}
                      fmt={fmtBRL}
                      lowerIsBetter={false}
                      variacao={variacao}
                      destaque
                    />
                    <LinhaPlanReal
                      label="Cachê"
                      plan={analise.por_dia.map(d => d.cache_plan)}
                      real={analise.por_dia.map(d => d.cache_real)}
                      totalPlan={analise.totais.cache_plan}
                      totalReal={analise.totais.cache_real}
                      fmt={fmtBRL}
                      lowerIsBetter
                      variacao={variacao}
                    />
                    <LinhaPlanReal
                      label="% Cachê/Fat"
                      plan={analise.por_dia.map(d => d.pct_cache_plan)}
                      real={analise.por_dia.map(d => d.pct_cache_real)}
                      totalPlan={
                        analise.totais.fat_total_plan > 0
                          ? (analise.totais.cache_plan / analise.totais.fat_total_plan) * 100
                          : 0
                      }
                      totalReal={
                        analise.totais.fat_total_real > 0
                          ? (analise.totais.cache_real / analise.totais.fat_total_real) * 100
                          : 0
                      }
                      fmt={fmtPct}
                      lowerIsBetter
                      variacao={variacao}
                    />
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Como ler</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <p><span className="text-blue-600 font-mono">Plan</span>: o que estava no BP × número de ocorrências daquele dia da semana no mês.</p>
              <p><span className="text-gray-900 dark:text-white font-mono">Real</span>: agregado dos eventos do mês (planejamento comercial). Cor compara vs Plan.</p>
              <p><span className="text-emerald-600">Verde</span>: dentro/melhor que o BP. <span className="text-red-600">Vermelho</span>: pior que o BP (gastou mais em cachê, vendeu menos, etc).</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <HistoricoOrcamentoTab barId={barId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({
  label,
  valor,
  sub,
  accent,
}: {
  label: string;
  valor: string;
  sub?: string;
  accent?: 'green' | 'red';
}) {
  const accentClass = accent === 'green' ? 'text-emerald-600' : accent === 'red' ? 'text-red-600' : '';
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-[10px] uppercase text-muted-foreground font-medium tracking-wide">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn('text-lg md:text-xl font-bold', accentClass)}>{valor}</div>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function BlocoRows({
  bloco,
  linhas,
  subtotal,
  receitaTotal,
}: {
  bloco: string;
  linhas: BpLinha[];
  subtotal: number;
  receitaTotal: number;
}) {
  return (
    <>
      {linhas.map((l, idx) => (
        <tr key={l.id} className="border-b hover:bg-muted/30">
          {idx === 0 && (
            <td
              rowSpan={linhas.length + 1}
              className="align-top py-2 px-3 font-medium text-[10px] uppercase text-muted-foreground border-r tracking-wide"
            >
              {bloco}
            </td>
          )}
          <td className="py-2 px-3">{l.linha}</td>
          <td className={cn('text-right py-2 px-3 font-mono', (l.valor_mensal || 0) < 0 ? 'text-red-600' : 'text-emerald-700')}>
            {fmtBRL(l.valor_mensal)}
          </td>
          <td className="text-right py-2 px-3 hidden md:table-cell text-muted-foreground">
            {l.percentual_receita !== null ? fmtPct(l.percentual_receita) : '—'}
          </td>
          <td className="py-2 px-3 hidden lg:table-cell text-[11px] text-muted-foreground">{l.observacao || ''}</td>
        </tr>
      ))}
      <tr className="bg-muted/40 font-semibold border-b-2 text-xs">
        <td className="py-2 px-3 uppercase text-muted-foreground">Subtotal {bloco}</td>
        <td className={cn('text-right py-2 px-3 font-mono', subtotal < 0 ? 'text-red-700' : 'text-emerald-700')}>
          {fmtBRL(subtotal)}
        </td>
        <td className="text-right py-2 px-3 hidden md:table-cell text-muted-foreground">
          {receitaTotal > 0 ? fmtPct((subtotal / receitaTotal) * 100) : '—'}
        </td>
        <td className="hidden lg:table-cell" />
      </tr>
    </>
  );
}

function LinhaMetrica({ label, valores, total, fmt }: { label: string; valores: number[]; total: number; fmt: (v: number) => string }) {
  return (
    <tr className="border-b">
      <td className="py-2 px-2 sticky left-0 bg-background font-medium">{label}</td>
      {valores.map((v, i) => (
        <td key={i} className="text-right py-2 px-2 font-mono">{fmt(v)}</td>
      ))}
      <td className="text-right py-2 px-2 font-mono font-bold bg-blue-50 dark:bg-blue-950">{fmt(total)}</td>
    </tr>
  );
}

function LinhaPlanReal({
  label,
  plan,
  real,
  totalPlan,
  totalReal,
  fmt,
  lowerIsBetter,
  variacao,
  destaque,
}: {
  label: string;
  plan: number[];
  real: number[];
  totalPlan: number;
  totalReal: number;
  fmt: (v: number) => string;
  lowerIsBetter: boolean;
  variacao: (real: number, plan: number, lowerIsBetter?: boolean) => { color: string; pct: number };
  destaque?: boolean;
}) {
  const corTotal = variacao(totalReal, totalPlan, lowerIsBetter).color;
  return (
    <>
      <tr className={cn('border-b', destaque && 'bg-emerald-50/40 dark:bg-emerald-950/20')}>
        <td className={cn('py-1 px-2 sticky left-0 bg-background font-medium', destaque && 'bg-emerald-50/40 dark:bg-emerald-950/20')} rowSpan={2}>
          {label}
        </td>
        {plan.map((p, i) => (
          <td key={i} className="text-right py-1 px-2 font-mono text-blue-600 text-[10px]">
            <div className="opacity-60 text-[8px] uppercase">Plan</div>
            {fmt(p)}
          </td>
        ))}
        <td className={cn('text-right py-1 px-2 font-mono text-blue-700 font-bold text-[11px] bg-blue-50 dark:bg-blue-950')}>
          <div className="opacity-60 text-[8px] uppercase">Plan</div>
          {fmt(totalPlan)}
        </td>
      </tr>
      <tr className={cn('border-b-2', destaque && 'bg-emerald-50/40 dark:bg-emerald-950/20')}>
        {real.map((r, i) => {
          const { color } = variacao(r, plan[i], lowerIsBetter);
          return (
            <td key={i} className={cn('text-right py-1 px-2 font-mono text-[10px] font-semibold', color)}>
              <div className="opacity-60 text-[8px] uppercase">Real</div>
              {fmt(r)}
            </td>
          );
        })}
        <td className={cn('text-right py-1 px-2 font-mono font-bold text-[11px] bg-blue-50 dark:bg-blue-950', corTotal)}>
          <div className="opacity-60 text-[8px] uppercase">Real</div>
          {fmt(totalReal)}
        </td>
      </tr>
    </>
  );
}

// Modal: cria um novo BP copiando as linhas/indicadores da versao atual,
// permitindo editar os valores (valor_mensal) antes de salvar.
function NovoBpModal({
  open,
  onOpenChange,
  barId,
  linhas,
  indicadores,
  versaoAtual,
  anoAtual,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  barId: number;
  linhas: BpLinha[];
  indicadores: BpIndicador[];
  versaoAtual: string;
  anoAtual: number;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const sugestao = useMemo(() => proximaVersao(versaoAtual, anoAtual), [versaoAtual, anoAtual]);

  const [versao, setVersao] = useState(sugestao.versao);
  const [ano, setAno] = useState(String(sugestao.ano));
  const [salvando, setSalvando] = useState(false);
  // valores editados, keyed por id da linha
  const [valores, setValores] = useState<Record<number, string>>({});

  // Re-inicializa ao abrir (e quando a versao de origem muda)
  const initKey = `${open}|${versaoAtual}|${anoAtual}`;
  const [lastInit, setLastInit] = useState('');
  if (open && lastInit !== initKey) {
    setLastInit(initKey);
    setVersao(sugestao.versao);
    setAno(String(sugestao.ano));
    const init: Record<number, string> = {};
    for (const l of linhas) {
      if (l.valor_mensal !== null && l.valor_mensal !== undefined) {
        init[l.id] = String(l.valor_mensal);
      }
    }
    setValores(init);
  }

  // Linhas editaveis (financeiras) agrupadas por bloco, na ordem do BP.
  const blocosEditaveis = useMemo(() => {
    const editaveis = linhas
      .filter(l => l.valor_mensal !== null && l.valor_mensal !== undefined && l.tipo !== 'percentual_calc')
      .sort((a, b) => a.ordem - b.ordem);
    const grupos = new Map<string, BpLinha[]>();
    for (const l of editaveis) {
      const arr = grupos.get(l.bloco) || [];
      arr.push(l);
      grupos.set(l.bloco, arr);
    }
    return Array.from(grupos.entries());
  }, [linhas]);

  const handleSalvar = async () => {
    const versaoTrim = versao.trim();
    const anoNum = Number(ano);
    if (!versaoTrim) {
      toast({ title: 'Informe o nome da versão', variant: 'destructive' });
      return;
    }
    if (!anoNum || anoNum < 2020 || anoNum > 2100) {
      toast({ title: 'Ano inválido', variant: 'destructive' });
      return;
    }

    // Monta payload: TODAS as linhas (preservando metricas/por_dia_semana),
    // com valor_mensal sobrescrito pelas edicoes.
    const linhasPayload = linhas.map(l => ({
      bloco: l.bloco,
      linha: l.linha,
      ordem: l.ordem,
      tipo: l.tipo,
      valor_mensal: valores[l.id] !== undefined
        ? (parseFloat(valores[l.id].replace(',', '.')) || 0)
        : l.valor_mensal,
      por_dia_semana: l.por_dia_semana,
      observacao: l.observacao,
    }));

    const indicadoresPayload = indicadores.map(i => ({
      indicador: i.indicador,
      valor: i.valor,
      unidade: i.unidade,
      observacao: i.observacao,
    }));

    setSalvando(true);
    try {
      const resp = await fetch('/api/estrategico/bp/criar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bar_id: barId,
          ano: anoNum,
          versao: versaoTrim,
          linhas: linhasPayload,
          indicadores: indicadoresPayload,
        }),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        toast({ title: 'Não foi possível criar o BP', description: j?.error || 'Erro', variant: 'destructive' });
        return;
      }
      toast({ title: 'BP criado!', description: `${versaoTrim} (${anoNum}) — ${j?.linhas ?? ''} linhas` });
      onOpenChange(false);
      onCreated();
    } catch (e) {
      toast({ title: 'Erro de rede', description: e instanceof Error ? e.message : 'Erro', variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Novo Business Plan</DialogTitle>
          <DialogDescription>
            Copia o BP <strong>{versaoAtual} ({anoAtual})</strong>. Ajuste os valores e salve como uma nova versão.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Versão (mês)</label>
            <Input value={versao} onChange={e => setVersao(e.target.value)} placeholder="Ex.: Jun26" className="h-8 w-[140px]" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Ano</label>
            <Input value={ano} onChange={e => setAno(e.target.value)} className="h-8 w-[90px]" inputMode="numeric" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1 mt-1">
          <table className="w-full text-sm">
            <tbody>
              {blocosEditaveis.map(([bloco, ls]) => (
                <Fragment key={bloco}>
                  <tr className="bg-muted/40">
                    <td colSpan={2} className="py-1.5 px-2 text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">
                      {bloco}
                    </td>
                  </tr>
                  {ls.map(l => (
                    <tr key={l.id} className="border-b">
                      <td className="py-1 px-2">{l.linha}</td>
                      <td className="py-1 px-2 w-[160px]">
                        <Input
                          value={valores[l.id] ?? ''}
                          onChange={e => setValores(prev => ({ ...prev, [l.id]: e.target.value }))}
                          className="h-7 text-right font-mono text-xs"
                          inputMode="decimal"
                        />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-muted-foreground mt-2 px-1">
            Métricas operacionais (pessoas, tickets por dia) e indicadores são copiados automaticamente.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando ? 'Criando…' : 'Criar BP'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
