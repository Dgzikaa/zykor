'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageShell } from '@/components/layout/PageShell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useApiSWR } from '@/hooks/useApiSWR';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { ChevronLeft, ChevronRight, Loader2, Scale, Info } from 'lucide-react';

/**
 * Planejado × Realizado.
 *
 * Pedido do Rodrigo: "era pra ter tantos garçons na semana e na vdd foram tanto… tava
 * projetado 14k e deu 17k, já mostrar certinho aonde foi os aumentos".
 *
 * É POR SEMANA E POR GRUPO, não por dia nem por função — não por escolha de design, mas
 * porque o realizado não existe nessa granularidade: o freela é pago por semana
 * (competência = segunda) e em 5 categorias grossas. Comparar por função daria um número
 * inventado com cara de preciso.
 */

type Grupo = {
  nome: string; diarias_planejadas: number; diarias_pagas: number;
  custo_projetado: number; custo_pago: number; diferenca: number | null;
};
type Semana = {
  inicio: string; fim: string;
  faturamento_previsto: number; faturamento_real: number;
  custo_projetado: number; custo_pago: number;
  diferenca_custo: number | null; diferenca_faturamento: number | null;
  tem_pagamento: boolean; grupos: Grupo[];
};

const fmtBRL = (v: number | null) =>
  v == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
const fmtDelta = (v: number | null) => {
  if (v == null) return '—';
  const s = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Math.abs(v));
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${s}`;
};
const corDelta = (v: number | null, inverter = false) => {
  if (v == null || v === 0) return 'text-muted-foreground';
  const ruim = inverter ? v < 0 : v > 0; // custo acima do projetado é ruim; faturamento abaixo é ruim
  return ruim ? 'text-rose-600' : 'text-emerald-600';
};
const dm = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}`;

export default function ComparativoPage() {
  const { setPageTitle } = usePageTitle();
  useEffect(() => { setPageTitle('⚖️ Planejado × Realizado'); return () => setPageTitle(''); }, [setPageTitle]);

  const [mesRef, setMesRef] = useState(() => new Date().toISOString().slice(0, 7));
  const [ano, mes] = mesRef.split('-').map(Number);
  const de = `${mesRef}-01`;
  const ate = new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);

  const { data, isLoading } = useApiSWR<{ semanas: Semana[] }>(`/api/operacao/comparativo?de=${de}&ate=${ate}`);
  const semanas = useMemo(() => data?.semanas || [], [data]);
  const [aberta, setAberta] = useState<string | null>(null);

  const mudarMes = (n: number) => {
    const d = new Date(Date.UTC(ano, mes - 1 + n, 1));
    setMesRef(d.toISOString().slice(0, 7));
  };

  const comPagamento = semanas.filter(s => s.tem_pagamento);
  const totalProj = comPagamento.reduce((t, s) => t + s.custo_projetado, 0);
  const totalPago = comPagamento.reduce((t, s) => t + s.custo_pago, 0);

  return (
    <PageShell width="wide">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => mudarMes(-1)}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm font-medium inline-flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-muted-foreground" />
            {String(mes).padStart(2, '0')}/{ano}
          </span>
          <Button variant="outline" size="sm" onClick={() => mudarMes(1)}><ChevronRight className="w-4 h-4" /></Button>
        </div>
        {comPagamento.length > 0 && (
          <div className="text-sm">
            Nas semanas já pagas: <b className="tabular-nums">{fmtBRL(totalProj)}</b> projetado ·{' '}
            <b className="tabular-nums">{fmtBRL(totalPago)}</b> pago ·{' '}
            <b className={`tabular-nums ${corDelta(totalPago - totalProj)}`}>{fmtDelta(totalPago - totalProj)}</b>
          </div>
        )}
      </div>

      {isLoading ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Carregando…
        </CardContent></Card>
      ) : semanas.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nada planejado neste mês.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {semanas.map(s => {
            const expandida = aberta === s.inicio;
            return (
              <Card key={s.inicio}>
                <CardContent className="py-3">
                  <button className="w-full text-left" onClick={() => setAberta(expandida ? null : s.inicio)}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="font-medium text-sm">{dm(s.inicio)} — {dm(s.fim)}</span>
                      <div className="flex items-center gap-5 text-sm">
                        <span className="text-muted-foreground">
                          Faturamento {fmtBRL(s.faturamento_previsto)}
                          {s.faturamento_real > 0 && (
                            <> → <b className="tabular-nums">{fmtBRL(s.faturamento_real)}</b>{' '}
                              <span className={corDelta(s.diferenca_faturamento, true)}>{fmtDelta(s.diferenca_faturamento)}</span>
                            </>
                          )}
                        </span>
                        <span>
                          Freela {fmtBRL(s.custo_projetado)}
                          {s.tem_pagamento ? (
                            <> → <b className="tabular-nums">{fmtBRL(s.custo_pago)}</b>{' '}
                              <span className={`font-semibold ${corDelta(s.diferenca_custo)}`}>{fmtDelta(s.diferenca_custo)}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground text-xs"> · ainda não pago</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </button>

                  {expandida && (
                    <div className="mt-3 border-t border-[hsl(var(--border))] pt-2">
                      {!s.tem_pagamento ? (
                        <p className="text-xs text-muted-foreground py-2">
                          O freela desta semana ainda não foi lançado no financeiro — por isso não há
                          realizado. Não é diferença zero, é diferença desconhecida.
                        </p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="text-left font-normal py-1">Grupo</th>
                              <th className="text-right font-normal py-1">Diárias plan.</th>
                              <th className="text-right font-normal py-1">Diárias pagas</th>
                              <th className="text-right font-normal py-1">Projetado</th>
                              <th className="text-right font-normal py-1">Pago</th>
                              <th className="text-right font-normal py-1 w-24">Diferença</th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.grupos.map(g => (
                              <tr key={g.nome} className="border-t border-[hsl(var(--border))]">
                                <td className="py-1">{g.nome}</td>
                                <td className="py-1 text-right tabular-nums">{g.diarias_planejadas || '—'}</td>
                                <td className="py-1 text-right tabular-nums">{g.diarias_pagas || '—'}</td>
                                <td className="py-1 text-right tabular-nums">{fmtBRL(g.custo_projetado)}</td>
                                <td className="py-1 text-right tabular-nums">{fmtBRL(g.custo_pago)}</td>
                                <td className={`py-1 text-right tabular-nums font-semibold ${corDelta(g.diferenca)}`}>
                                  {fmtDelta(g.diferenca)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <p>
          A comparação é <b>por semana e por grupo</b> porque é assim que o realizado existe: o freela
          é pago por semana (competência na segunda) e em cinco categorias — Atendimento, Bar, Cozinha,
          Segurança e Limpeza. Quebrar por função ou por dia daria um número inventado com cara de preciso.
          O <b>custo do fixo (CLT) não entra</b> em nenhum dos dois lados: a projeção é do CMO variável.
        </p>
      </div>
    </PageShell>
  );
}
