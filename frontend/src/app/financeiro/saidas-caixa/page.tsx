'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Banknote, Loader2, ArrowDownCircle, ListTree, CalendarDays, Wallet } from 'lucide-react';

type Saida = { dt_gerencial: string; trn: number; num_lancamento: number | null; motivo: string; valor_saida: number; obs: string | null };
type Turno = {
  dt_gerencial: string; trn: number;
  total_saidas: number; qtd_saidas: number; total_entradas_itemizadas: number;
  saldo_anterior: number | null; inicio_declarado: number | null; diferenca_abertura: number | null;
  recebimentos_dinheiro: number | null; saldo_final: number | null;
};

const fmtBRL = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const fmtNum = (v: any) => new Intl.NumberFormat('pt-BR').format(Number(v || 0));
const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const fmtData = (d: string) => { try { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y.slice(2)}`; } catch { return d; } };
const dow = (d: string) => { try { const [y, m, dd] = d.split('-').map(Number); return DOW[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()]; } catch { return ''; } };
const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const labelMes = (ym: string) => { const [y, m] = ym.split('-'); return `${MESES_PT[Number(m) - 1]}/${y}`; };
const cell = (v: number | null | undefined) => (v == null ? <span className="text-muted-foreground/40">—</span> : fmtBRL(v));

function SaidasCaixaInner() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();

  const [aba, setAba] = useState<'saidas' | 'turnos'>('saidas');
  const [meses, setMeses] = useState<string[]>([]);
  const [mesSel, setMesSel] = useState<string>('');
  const [saidas, setSaidas] = useState<Saida[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [resumo, setResumo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const periodo = useMemo(() => {
    if (!mesSel) return null;
    const [y, m] = mesSel.split('-').map(Number);
    const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { de: `${mesSel}-01`, ate: `${mesSel}-${String(ultimo).padStart(2, '0')}` };
  }, [mesSel]);

  const carregar = useCallback(async () => {
    if (!selectedBar?.id) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (periodo) { qs.set('de', periodo.de); qs.set('ate', periodo.ate); }
      const r = await api.get(`/api/financeiro/saidas-caixa?${qs.toString()}`);
      if (!r?.success) throw new Error(r?.error || 'Falha ao carregar');
      setSaidas(r.saidas || []);
      setTurnos(r.turnos || []);
      setResumo(r.resumo || null);
      if ((r.meses_disponiveis || []).length) {
        setMeses(r.meses_disponiveis);
        if (!mesSel) setMesSel(r.meses_disponiveis[0]);
      }
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar saídas de caixa', message: e?.message });
    } finally {
      setLoading(false);
    }
  }, [selectedBar?.id, periodo, mesSel, showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const ticket = resumo?.qtd_saidas ? Number(resumo.total_saidas) / Number(resumo.qtd_saidas) : 0;

  return (
    <div className="p-4 md:p-6 mx-auto space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5"><Banknote className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-xl font-semibold">Saídas de Caixa</h1>
            <p className="text-sm text-muted-foreground">Dinheiro que saiu do caixa em cada turno (sangria/retirada) — ContaHub.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={mesSel} onChange={(e) => setMesSel(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
            {meses.length === 0 && <option value="">—</option>}
            {meses.map((m) => <option key={m} value={m}>{labelMes(m)}</option>)}
          </select>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5"><ArrowDownCircle className="h-3.5 w-3.5" /> Total de saídas</div>
            <div className="text-2xl font-semibold mt-1 text-red-600 dark:text-red-400">{fmtBRL(resumo?.total_saidas)}</div>
            <div className="text-xs text-muted-foreground mt-1">no período selecionado</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5"><ListTree className="h-3.5 w-3.5" /> Retiradas</div>
            <div className="text-2xl font-semibold mt-1">{fmtNum(resumo?.qtd_saidas)}</div>
            <div className="text-xs text-muted-foreground mt-1">lançamentos de saída</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Dias com saída</div>
            <div className="text-2xl font-semibold mt-1">{fmtNum(resumo?.dias)}</div>
            <div className="text-xs text-muted-foreground mt-1">dias operacionais</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Ticket médio</div>
            <div className="text-2xl font-semibold mt-1">{fmtBRL(ticket)}</div>
            <div className="text-xs text-muted-foreground mt-1">por retirada</div>
          </CardContent>
        </Card>
      </div>

      {/* Abas */}
      <div className="flex gap-1 border-b">
        {([['saidas', 'Saídas', ArrowDownCircle], ['turnos', 'Por turno', ListTree]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${aba === id ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {aba === 'saidas' && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left font-medium px-4 py-2.5">Dia</th>
                    <th className="text-left font-medium px-4 py-2.5">Turno</th>
                    <th className="text-left font-medium px-4 py-2.5">Motivo</th>
                    <th className="text-right font-medium px-4 py-2.5">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {saidas.map((s, i) => (
                    <tr key={`${s.trn}-${s.num_lancamento}-${i}`} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className="font-medium">{fmtData(s.dt_gerencial)}</span>
                        <span className="text-xs text-muted-foreground ml-1.5">{dow(s.dt_gerencial)}</span>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground tabular-nums">#{s.trn}</td>
                      <td className="px-4 py-2">{s.motivo || <span className="text-muted-foreground/40">—</span>}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold text-red-600 dark:text-red-400">{fmtBRL(s.valor_saida)}</td>
                    </tr>
                  ))}
                  {!loading && saidas.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Nenhuma saída de caixa no período.</td></tr>
                  )}
                </tbody>
                {saidas.length > 0 && (
                  <tfoot>
                    <tr className="border-t bg-muted/20 font-semibold">
                      <td className="px-4 py-2.5" colSpan={3}>Total ({fmtNum(saidas.length)})</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-red-600 dark:text-red-400">{fmtBRL(resumo?.total_saidas)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {aba === 'turnos' && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left font-medium px-4 py-2.5">Dia</th>
                    <th className="text-left font-medium px-4 py-2.5">Turno</th>
                    <th className="text-right font-medium px-4 py-2.5">Saldo anterior</th>
                    <th className="text-right font-medium px-4 py-2.5">Início decl.</th>
                    <th className="text-right font-medium px-4 py-2.5">Recebim. $</th>
                    <th className="text-right font-medium px-4 py-2.5">Saídas</th>
                    <th className="text-right font-medium px-4 py-2.5">Saldo final</th>
                  </tr>
                </thead>
                <tbody>
                  {turnos.map((t) => (
                    <tr key={`${t.trn}-${t.dt_gerencial}`} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className="font-medium">{fmtData(t.dt_gerencial)}</span>
                        <span className="text-xs text-muted-foreground ml-1.5">{dow(t.dt_gerencial)}</span>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground tabular-nums">#{t.trn}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{cell(t.saldo_anterior)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {cell(t.inicio_declarado)}
                        {t.diferenca_abertura != null && Math.abs(Number(t.diferenca_abertura)) > 0 && (
                          <span className={`block text-[10px] ${Number(t.diferenca_abertura) < 0 ? 'text-red-500' : 'text-amber-500'}`}>Dif {fmtBRL(t.diferenca_abertura)}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{cell(t.recebimentos_dinheiro)}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold text-red-600 dark:text-red-400">
                        {Number(t.total_saidas) > 0 ? fmtBRL(t.total_saidas) : <span className="text-muted-foreground/40">—</span>}
                        {t.qtd_saidas > 0 && <span className="block text-[10px] text-muted-foreground">{t.qtd_saidas}x</span>}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">{cell(t.saldo_final)}</td>
                    </tr>
                  ))}
                  {!loading && turnos.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Sem turnos no período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Fonte: relatório de turno do ContaHub (seção &quot;Lançamentos do CAIXA&quot;). &quot;Saídas&quot; = dinheiro que saiu do caixa
        (retirada p/ cofre/escritório, diferença de caixa etc.). O motivo vem da descrição do lançamento.
      </p>
    </div>
  );
}

export default function SaidasCaixaPage() {
  return (
    <ProtectedRoute>
      <SaidasCaixaInner />
    </ProtectedRoute>
  );
}
