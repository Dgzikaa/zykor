'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BpLinha, BpIndicador, DiaSemana } from './types';
import { useRouter } from 'next/navigation';

const DIAS: { key: DiaSemana; label: string }[] = [
  { key: 'seg', label: 'Seg' },
  { key: 'ter', label: 'Ter' },
  { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' },
  { key: 'sex', label: 'Sex' },
  { key: 'sab', label: 'Sáb' },
  { key: 'dom', label: 'Dom' },
];

const formatBRL = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatPct = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `${v.toFixed(1)}%`;
};

const formatNum = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
};

interface Props {
  linhas: BpLinha[];
  indicadores: BpIndicador[];
  versoes: { ano: number; versao: string }[];
  anoAtual: number;
  versaoAtual: string;
  barId: number;
}

export function BpClient({ linhas, indicadores, versoes, anoAtual, versaoAtual }: Props) {
  const router = useRouter();
  const [versaoSelecionada, setVersaoSelecionada] = useState(`${anoAtual}|${versaoAtual}`);

  const indicadorMap = useMemo(() => {
    const m = new Map<string, BpIndicador>();
    indicadores.forEach(i => m.set(i.indicador, i));
    return m;
  }, [indicadores]);

  const blocos = useMemo(() => {
    const ordemBlocos = [
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
    linhas.forEach(l => {
      const arr = grouped.get(l.bloco) || [];
      arr.push(l);
      grouped.set(l.bloco, arr);
    });
    return ordemBlocos
      .filter(b => grouped.has(b))
      .map(b => ({ bloco: b, linhas: (grouped.get(b) || []).sort((a, b) => a.ordem - b.ordem) }));
  }, [linhas]);

  const totaisBloco = useMemo(() => {
    const totais = new Map<string, number>();
    blocos.forEach(({ bloco, linhas }) => {
      const soma = linhas.reduce((acc, l) => acc + (l.valor_mensal || 0), 0);
      totais.set(bloco, soma);
    });
    return totais;
  }, [blocos]);

  const receitaTotal = totaisBloco.get('Receitas') || 0;
  const ebitda = blocos.reduce((acc, { bloco, linhas: ls }) => {
    if (bloco === 'Receitas') return acc + ls.reduce((s, l) => s + (l.valor_mensal || 0), 0);
    return acc + ls.reduce((s, l) => s + (l.valor_mensal || 0), 0);
  }, 0);

  const distribuicaoSemana = useMemo(() => {
    const totalPorDia: Record<DiaSemana, { receita: number; cache: number }> = {
      seg: { receita: 0, cache: 0 },
      ter: { receita: 0, cache: 0 },
      qua: { receita: 0, cache: 0 },
      qui: { receita: 0, cache: 0 },
      sex: { receita: 0, cache: 0 },
      sab: { receita: 0, cache: 0 },
      dom: { receita: 0, cache: 0 },
    };
    linhas.forEach(l => {
      if (!l.por_dia_semana) return;
      const isReceita = l.tipo === 'receita';
      DIAS.forEach(({ key }) => {
        const v = Number(l.por_dia_semana?.[key] || 0);
        if (isReceita) totalPorDia[key].receita += v;
        else if (l.linha === 'Programacao Artistica') totalPorDia[key].cache += v;
      });
    });
    return DIAS.map(d => ({
      dia: d.label,
      receita: totalPorDia[d.key].receita,
      cache: totalPorDia[d.key].cache,
      pct_cache: totalPorDia[d.key].receita > 0
        ? (totalPorDia[d.key].cache / totalPorDia[d.key].receita) * 100
        : 0,
    }));
  }, [linhas]);

  const breakeven = Number(indicadorMap.get('breakeven_mensal')?.valor || 0);
  const custoFixo = Number(indicadorMap.get('custo_fixo_total')?.valor || 0);
  const margemContrib = Number(indicadorMap.get('margem_contribuicao_pct')?.valor || 0);
  const ticketBar = Number(indicadorMap.get('ticket_medio_bar')?.valor || 0);
  const ticketEntrada = Number(indicadorMap.get('ticket_medio_entrada')?.valor || 0);
  const nPessoas = Number(indicadorMap.get('n_pessoas_mes')?.valor || 0);
  const cmvAlvo = Number(indicadorMap.get('cmv_alvo_pct')?.valor || 0);
  const margemLiquida = Number(indicadorMap.get('margem_liquida_pct')?.valor || 0);

  const handleChangeVersao = (val: string) => {
    setVersaoSelecionada(val);
    const [ano, versao] = val.split('|');
    router.push(`/estrategico/bp?ano=${ano}&versao=${encodeURIComponent(versao)}`);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Business Plan</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Plano financeiro anual com projeções por dia da semana e mensais.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Versão:</span>
          <Select value={versaoSelecionada} onValueChange={handleChangeVersao}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {versoes.length === 0 && (
                <SelectItem value={`${anoAtual}|${versaoAtual}`}>{`${versaoAtual} (${anoAtual})`}</SelectItem>
              )}
              {versoes.map(v => (
                <SelectItem key={`${v.ano}|${v.versao}`} value={`${v.ano}|${v.versao}`}>
                  {v.versao} ({v.ano})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {linhas.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Nenhum BP encontrado para esta versão. Cadastre em meta.bp_linha.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Receita Total Mensal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatBRL(receitaTotal)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">BreakEven</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatBRL(breakeven)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Receita necessária pra zerar
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">EBITDA Projetado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${ebitda >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatBRL(ebitda)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{formatPct(margemLiquida)} margem líquida</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Margem Contribuição</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPct(margemContrib)}</div>
                <p className="text-xs text-muted-foreground mt-1">Custo fixo: {formatBRL(custoFixo)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniIndicador label="Tkt Médio Bar" valor={formatBRL(ticketBar)} />
            <MiniIndicador label="Tkt Médio Entrada" valor={formatBRL(ticketEntrada)} />
            <MiniIndicador label="Pessoas/mês" valor={formatNum(nPessoas)} />
            <MiniIndicador label="CMV alvo" valor={formatPct(cmvAlvo)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Projeção por dia da semana</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distribuicaoSemana}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="dia" />
                    <YAxis tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value, name) => [formatBRL(Number(value)), String(name) === 'receita' ? 'Receita' : 'Cachê']}
                    />
                    <Bar dataKey="receita" name="Receita" fill="#3b82f6">
                      {distribuicaoSemana.map((entry, idx) => (
                        <Cell key={idx} fill={entry.dia === 'Sex' || entry.dia === 'Sáb' ? '#1e40af' : '#3b82f6'} />
                      ))}
                    </Bar>
                    <Bar dataKey="cache" name="Cachê" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-7 gap-2 text-xs">
                {distribuicaoSemana.map(d => (
                  <div key={d.dia} className="border rounded p-2">
                    <div className="font-semibold">{d.dia}</div>
                    <div className="text-muted-foreground">Receita: {formatBRL(d.receita)}</div>
                    <div className="text-muted-foreground">Cachê: {formatBRL(d.cache)}</div>
                    <div className={d.pct_cache > 25 ? 'text-red-600' : 'text-green-600'}>
                      {formatPct(d.pct_cache)} cachê/fat
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>DRE Mensal Projetado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Bloco</th>
                      <th className="text-left py-2 px-2">Linha</th>
                      <th className="text-right py-2 px-2">Valor Mensal</th>
                      <th className="text-right py-2 px-2 hidden md:table-cell">% Receita</th>
                      <th className="text-left py-2 px-2 hidden lg:table-cell">Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blocos.map(({ bloco, linhas }) => (
                      <>
                        {linhas.map((l, idx) => (
                          <tr key={l.id} className="border-b border-muted hover:bg-muted/30">
                            {idx === 0 && (
                              <td rowSpan={linhas.length + 1} className="align-top py-2 px-2 font-medium text-xs uppercase text-muted-foreground border-r">
                                {bloco}
                              </td>
                            )}
                            <td className="py-2 px-2">{l.linha}</td>
                            <td className={`text-right py-2 px-2 font-mono ${(l.valor_mensal || 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {formatBRL(l.valor_mensal)}
                            </td>
                            <td className="text-right py-2 px-2 hidden md:table-cell text-muted-foreground">
                              {l.percentual_receita !== null ? formatPct(l.percentual_receita) : '—'}
                            </td>
                            <td className="py-2 px-2 hidden lg:table-cell text-xs text-muted-foreground">
                              {l.observacao || ''}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-muted/40 font-semibold border-b-2">
                          <td className="py-2 px-2 text-xs uppercase text-muted-foreground">Subtotal {bloco}</td>
                          <td className={`text-right py-2 px-2 font-mono ${(totaisBloco.get(bloco) || 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatBRL(totaisBloco.get(bloco))}
                          </td>
                          <td className="text-right py-2 px-2 hidden md:table-cell text-muted-foreground">
                            {receitaTotal > 0 ? formatPct(((totaisBloco.get(bloco) || 0) / receitaTotal) * 100) : '—'}
                          </td>
                          <td className="hidden lg:table-cell" />
                        </tr>
                      </>
                    ))}
                    <tr className="bg-blue-50 dark:bg-blue-950 font-bold text-base border-t-4">
                      <td className="py-3 px-2" colSpan={2}>EBITDA Projetado</td>
                      <td className={`text-right py-3 px-2 font-mono ${ebitda >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {formatBRL(ebitda)}
                      </td>
                      <td className="text-right py-3 px-2 hidden md:table-cell">{formatPct(margemLiquida)}</td>
                      <td className="hidden lg:table-cell" />
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notas e direcionamentos</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                <li>Artístico: <strong>Achar 6k de cachê por semana</strong></li>
                <li>Produção e Material Operação: <strong>Explodir categorias e definir budgets de cada linha</strong></li>
                <li>Marketing: <strong>Gerir o Budget total com consumações</strong></li>
                <li>Mudar o pagamento da Meta para semanal</li>
                <li>Mudar o benefício da semana pra R$100</li>
                <li>Separar tipos de benefício</li>
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function MiniIndicador({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="border rounded-lg p-3 bg-card">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{valor}</div>
    </div>
  );
}
