'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, AlertCircle, Info } from 'lucide-react';
import type { OrcamentoMes } from './types';

const formatBRL = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
};

const formatPct = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `${v.toFixed(1)}%`;
};

interface Props {
  meses: OrcamentoMes[];
  barId: number;
  versaoBp: string;
}

export function OrcamentacaoV2Client({ meses, versaoBp }: Props) {
  const mesAtualIdx = meses.findIndex(m => m.is_atual);
  const [selectedIdx, setSelectedIdx] = useState(mesAtualIdx >= 0 ? mesAtualIdx : meses.length - 2);
  const [showOrfaos, setShowOrfaos] = useState(false);

  const mes = meses[selectedIdx];

  const blocosOrdem = useMemo(
    () => [
      'Receitas',
      'Despesas Variaveis',
      'CMV',
      'Mao-de-Obra',
      'Despesas Comerciais',
      'Despesas Administrativas',
      'Despesas Operacionais',
      'Despesas Ocupacao',
      'Contratos',
    ],
    []
  );

  if (!mes) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6 text-muted-foreground">
            Nenhum dado de orçamento disponível.
          </CardContent>
        </Card>
      </div>
    );
  }

  const variacaoEbitda = mes.totais.ebitda_realizado - mes.totais.ebitda_bp;
  const variacaoReceita = mes.totais.receita_realizado - mes.totais.receita_bp;
  const variacaoReceitaPct =
    mes.totais.receita_bp !== 0
      ? (variacaoReceita / Math.abs(mes.totais.receita_bp)) * 100
      : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Orçamentação</h1>
          <p className="text-sm text-muted-foreground mt-1">
            BP <strong>{versaoBp}</strong> vs Realizado (ContaAzul). Mês a mês, com drill por
            categoria.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedIdx(i => Math.max(0, i - 1))}
            disabled={selectedIdx === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[140px] text-center font-semibold text-lg">
            {mes.label.toUpperCase()}
            {mes.is_atual && <Badge variant="default" className="ml-2">Atual</Badge>}
            {mes.is_futuro && <Badge variant="secondary" className="ml-2">Futuro</Badge>}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedIdx(i => Math.min(meses.length - 1, i + 1))}
            disabled={selectedIdx === meses.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Receita BP"
          valor={formatBRL(mes.totais.receita_bp)}
          sub={`Realizado: ${formatBRL(mes.totais.receita_realizado)}`}
          delta={variacaoReceitaPct}
        />
        <KpiCard
          label="EBITDA BP"
          valor={formatBRL(mes.totais.ebitda_bp)}
          sub={`Realizado: ${formatBRL(mes.totais.ebitda_realizado)}`}
          delta={mes.totais.margem_realizado - mes.totais.margem_bp}
          isDeltaPp
        />
        <KpiCard
          label="Margem BP"
          valor={formatPct(mes.totais.margem_bp)}
          sub={`Realizado: ${formatPct(mes.totais.margem_realizado)}`}
        />
        <KpiCard
          label="Projetado (pendente)"
          valor={formatBRL(mes.totais.ebitda_projetado)}
          sub={`${formatBRL(mes.totais.receita_projetado)} receita | ${formatBRL(mes.totais.despesa_projetado)} despesa`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">DRE — {mes.label}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="border-b text-xs uppercase text-muted-foreground">
                  <th className="text-left py-2 px-3">Bloco</th>
                  <th className="text-left py-2 px-3">Linha</th>
                  <th className="text-right py-2 px-3">BP</th>
                  <th className="text-right py-2 px-3">Realizado</th>
                  <th className="text-right py-2 px-3 hidden md:table-cell">Projetado</th>
                  <th className="text-right py-2 px-3 hidden md:table-cell">Var R$</th>
                  <th className="text-right py-2 px-3 hidden lg:table-cell">Var %</th>
                  <th className="text-right py-2 px-3 hidden lg:table-cell">% Rec</th>
                </tr>
              </thead>
              <tbody>
                {blocosOrdem.map(bloco => {
                  const b = mes.blocos.find(x => x.bloco === bloco);
                  if (!b) return null;
                  return (
                    <>
                      {b.linhas.map(l => (
                        <tr
                          key={`${bloco}-${l.linha}`}
                          className="border-b hover:bg-muted/30 transition-colors"
                        >
                          <td className="py-2 px-3 text-xs text-muted-foreground">{bloco}</td>
                          <td className="py-2 px-3">
                            <div className="font-medium">{l.linha}</div>
                            {l.observacao && (
                              <div className="text-xs text-muted-foreground mt-0.5 hidden md:block">
                                {l.observacao}
                              </div>
                            )}
                          </td>
                          <td
                            className={`text-right py-2 px-3 font-mono ${
                              (l.bp_valor || 0) < 0 ? 'text-red-600' : 'text-green-700'
                            }`}
                          >
                            {formatBRL(l.bp_valor)}
                          </td>
                          <td
                            className={`text-right py-2 px-3 font-mono ${
                              l.realizado < 0 ? 'text-red-600' : 'text-green-700'
                            }`}
                          >
                            {formatBRL(l.realizado)}
                          </td>
                          <td className="text-right py-2 px-3 hidden md:table-cell font-mono text-muted-foreground">
                            {formatBRL(l.projetado)}
                          </td>
                          <td
                            className={`text-right py-2 px-3 hidden md:table-cell font-mono ${
                              l.variacao_abs < 0 ? 'text-red-600' : 'text-green-700'
                            }`}
                          >
                            {formatBRL(l.variacao_abs)}
                          </td>
                          <td
                            className={`text-right py-2 px-3 hidden lg:table-cell font-mono ${
                              l.variacao_pct < 0 ? 'text-red-600' : 'text-green-700'
                            }`}
                          >
                            {formatPct(l.variacao_pct)}
                          </td>
                          <td className="text-right py-2 px-3 hidden lg:table-cell font-mono text-muted-foreground">
                            {l.bp_percentual !== null ? formatPct(l.bp_percentual) : '—'}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-muted/40 font-semibold border-b-2">
                        <td className="py-2 px-3 text-xs uppercase text-muted-foreground" colSpan={2}>
                          Subtotal {bloco}
                        </td>
                        <td
                          className={`text-right py-2 px-3 font-mono ${
                            b.subtotal_bp < 0 ? 'text-red-700' : 'text-green-700'
                          }`}
                        >
                          {formatBRL(b.subtotal_bp)}
                        </td>
                        <td
                          className={`text-right py-2 px-3 font-mono ${
                            b.subtotal_realizado < 0 ? 'text-red-700' : 'text-green-700'
                          }`}
                        >
                          {formatBRL(b.subtotal_realizado)}
                        </td>
                        <td className="text-right py-2 px-3 hidden md:table-cell font-mono">
                          {formatBRL(b.subtotal_projetado)}
                        </td>
                        <td colSpan={3} className="hidden md:table-cell" />
                      </tr>
                    </>
                  );
                })}
                <tr className="bg-blue-50 dark:bg-blue-950 font-bold text-base border-t-4">
                  <td className="py-3 px-3" colSpan={2}>
                    EBITDA
                  </td>
                  <td
                    className={`text-right py-3 px-3 font-mono ${
                      mes.totais.ebitda_bp >= 0 ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {formatBRL(mes.totais.ebitda_bp)}
                  </td>
                  <td
                    className={`text-right py-3 px-3 font-mono ${
                      mes.totais.ebitda_realizado >= 0 ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {formatBRL(mes.totais.ebitda_realizado)}
                  </td>
                  <td className="text-right py-3 px-3 hidden md:table-cell font-mono">
                    {formatBRL(mes.totais.ebitda_projetado)}
                  </td>
                  <td
                    className={`text-right py-3 px-3 hidden md:table-cell font-mono ${
                      variacaoEbitda < 0 ? 'text-red-700' : 'text-green-700'
                    }`}
                  >
                    {formatBRL(variacaoEbitda)}
                  </td>
                  <td colSpan={2} className="hidden md:table-cell" />
                </tr>
                <tr className="bg-blue-50 dark:bg-blue-950 border-b">
                  <td className="py-2 px-3 text-xs uppercase text-muted-foreground" colSpan={2}>
                    Margem Líquida
                  </td>
                  <td className="text-right py-2 px-3 font-mono">{formatPct(mes.totais.margem_bp)}</td>
                  <td className="text-right py-2 px-3 font-mono">{formatPct(mes.totais.margem_realizado)}</td>
                  <td className="text-right py-2 px-3 hidden md:table-cell font-mono">{formatPct(mes.totais.margem_projetado)}</td>
                  <td colSpan={3} className="hidden md:table-cell" />
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {mes.orfaos.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Categorias não mapeadas ({mes.orfaos.length})
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Lançamentos do ContaAzul cuja categoria_nome não bate com nenhuma linha do BP. Total ignorado:{' '}
                <strong>{formatBRL(mes.orfaos.reduce((s, o) => s + o.valor_total, 0))}</strong>
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowOrfaos(s => !s)}>
              {showOrfaos ? 'Esconder' : 'Mostrar'}
            </Button>
          </CardHeader>
          {showOrfaos && (
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left py-2 px-3">Categoria ContaAzul</th>
                      <th className="text-right py-2 px-3">Qtd</th>
                      <th className="text-right py-2 px-3">Valor</th>
                      <th className="text-left py-2 px-3 hidden md:table-cell">Exemplos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mes.orfaos.map(o => (
                      <tr key={o.categoria_nome} className="border-b hover:bg-muted/30">
                        <td className="py-2 px-3 font-medium">{o.categoria_nome || '(sem categoria)'}</td>
                        <td className="text-right py-2 px-3 font-mono">{o.count}</td>
                        <td className="text-right py-2 px-3 font-mono">{formatBRL(o.valor_total)}</td>
                        <td className="py-2 px-3 hidden md:table-cell text-xs text-muted-foreground">
                          {o.exemplos.map(e => `${e.descricao} (${formatBRL(e.valor)})`).join(' • ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded p-3">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  Para incluir essas categorias no orçamento, edite a tabela{' '}
                  <code className="bg-muted px-1 rounded">meta.orcamento_subcategoria_map</code> adicionando
                  o nome exato da categoria do ContaAzul ao array de uma linha existente.
                </span>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comparativo mês a mês</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left py-2 px-3">Mês</th>
                <th className="text-right py-2 px-3">Receita BP</th>
                <th className="text-right py-2 px-3">Receita Real</th>
                <th className="text-right py-2 px-3">EBITDA BP</th>
                <th className="text-right py-2 px-3">EBITDA Real</th>
                <th className="text-right py-2 px-3">Margem Real</th>
              </tr>
            </thead>
            <tbody>
              {meses.map((m, idx) => (
                <tr
                  key={`${m.ano}-${m.mes}`}
                  className={`border-b hover:bg-muted/30 cursor-pointer transition-colors ${
                    idx === selectedIdx ? 'bg-blue-50 dark:bg-blue-950' : ''
                  }`}
                  onClick={() => setSelectedIdx(idx)}
                >
                  <td className="py-2 px-3 font-medium">
                    {m.label}
                    {m.is_atual && <Badge variant="default" className="ml-2 text-xs">Atual</Badge>}
                  </td>
                  <td className="text-right py-2 px-3 font-mono">{formatBRL(m.totais.receita_bp)}</td>
                  <td className="text-right py-2 px-3 font-mono">{formatBRL(m.totais.receita_realizado)}</td>
                  <td className={`text-right py-2 px-3 font-mono ${m.totais.ebitda_bp < 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {formatBRL(m.totais.ebitda_bp)}
                  </td>
                  <td className={`text-right py-2 px-3 font-mono ${m.totais.ebitda_realizado < 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {formatBRL(m.totais.ebitda_realizado)}
                  </td>
                  <td className="text-right py-2 px-3 font-mono">{formatPct(m.totais.margem_realizado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  valor,
  sub,
  delta,
  isDeltaPp,
}: {
  label: string;
  valor: string;
  sub?: string;
  delta?: number;
  isDeltaPp?: boolean;
}) {
  const showDelta = delta !== undefined && !Number.isNaN(delta);
  const deltaColor = showDelta ? (delta! >= 0 ? 'text-green-600' : 'text-red-600') : '';
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs uppercase text-muted-foreground font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xl md:text-2xl font-bold">{valor}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        {showDelta && (
          <div className={`text-xs mt-1 font-medium ${deltaColor}`}>
            {delta! >= 0 ? '↑' : '↓'} {Math.abs(delta!).toFixed(1)}{isDeltaPp ? 'pp' : '%'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
