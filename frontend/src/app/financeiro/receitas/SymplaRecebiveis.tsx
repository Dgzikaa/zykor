'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Loader2, Ticket, Wallet, Percent, CalendarClock, Receipt, Check } from 'lucide-react';

type Item = {
  event_id: number; nome_evento: string | null; dt_evento: string | null;
  pedidos: number; bruto: number; taxa: number; liquido: number; cancelados: number;
  previsao_repasse: string | null; status: 'pendente' | 'lancado';
};

const fmtBRL = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const fmtNum = (v: any) => new Intl.NumberFormat('pt-BR').format(Number(v || 0));
const fmtData = (d: string | null) => { if (!d) return '—'; const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y?.slice(2)}`; };
const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const labelMes = (ym: string) => { const [y, m] = ym.split('-'); return `${MESES_PT[Number(m) - 1]}/${y}`; };

export function SymplaRecebiveis() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const [itens, setItens] = useState<Item[]>([]);
  const [resumo, setResumo] = useState<any>(null);
  const [meses, setMeses] = useState<string[]>([]);
  const [mesSel, setMesSel] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [lancandoId, setLancandoId] = useState<number | null>(null);

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
      const r = await api.get(`/api/financeiro/receitas/sympla?${qs.toString()}`);
      if (!r?.success) throw new Error(r?.error || 'Falha ao carregar');
      setItens(r.itens || []);
      setResumo(r.resumo || null);
      if ((r.meses_disponiveis || []).length) { setMeses(r.meses_disponiveis); if (!mesSel) setMesSel(r.meses_disponiveis[0]); }
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar recebíveis Sympla', message: e?.message });
    } finally { setLoading(false); }
  }, [selectedBar?.id, periodo, mesSel, showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const lancar = async (eventId: number) => {
    setLancandoId(eventId);
    try {
      const r = await api.post('/api/financeiro/receitas/sympla/lancar', { event_id: eventId });
      if (r?.ok || r?.skipped) { showToast({ type: 'success', title: r?.skipped ? 'Já estava lançado' : 'Lançado no Conta Azul' }); carregar(); }
      else showToast({ type: 'error', title: 'Falha ao lançar', message: r?.erro || r?.error || 'Erro' });
    } catch (e: any) { showToast({ type: 'error', title: 'Falha ao lançar', message: e?.message }); }
    finally { setLancandoId(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Líquido a receber por evento (já sem cancelados). Previsão de repasse = evento + 5 dias úteis.</p>
        <div className="flex items-center gap-2">
          <select value={mesSel} onChange={(e) => setMesSel(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
            {meses.length === 0 && <option value="">—</option>}
            {meses.map((m) => <option key={m} value={m}>{labelMes(m)}</option>)}
          </select>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Ticket className="h-3.5 w-3.5" /> Eventos</div>
          <div className="text-2xl font-semibold mt-1">{fmtNum(resumo?.eventos)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Líquido a receber</div>
          <div className="text-2xl font-semibold mt-1 text-emerald-600 dark:text-emerald-400">{fmtBRL(resumo?.total_liquido)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Percent className="h-3.5 w-3.5" /> Taxa Sympla</div>
          <div className="text-2xl font-semibold mt-1 text-amber-600 dark:text-amber-400">{fmtBRL(resumo?.total_taxa)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Bruto</div>
          <div className="text-2xl font-semibold mt-1">{fmtBRL(resumo?.total_bruto)}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left font-medium px-4 py-2.5">Evento</th>
                  <th className="text-left font-medium px-4 py-2.5">Data</th>
                  <th className="text-right font-medium px-4 py-2.5">Pedidos</th>
                  <th className="text-right font-medium px-4 py-2.5">Bruto</th>
                  <th className="text-right font-medium px-4 py-2.5">Taxa</th>
                  <th className="text-right font-medium px-4 py-2.5">Líquido</th>
                  <th className="text-left font-medium px-4 py-2.5">Previsão repasse</th>
                  <th className="text-center font-medium px-4 py-2.5">CA</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((e) => (
                  <tr key={e.event_id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 max-w-[320px] truncate" title={e.nome_evento || ''}>{e.nome_evento || `Evento ${e.event_id}`}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{fmtData(e.dt_evento)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{fmtNum(e.pedidos)}{e.cancelados > 0 && <span className="block text-[10px] text-red-500">{e.cancelados} canc.</span>}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{fmtBRL(e.bruto)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-amber-600 dark:text-amber-400">{fmtBRL(e.taxa)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{fmtBRL(e.liquido)}</td>
                    <td className="px-4 py-2 whitespace-nowrap"><span className="inline-flex items-center gap-1 text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" />{fmtData(e.previsao_repasse)}</span></td>
                    <td className="px-4 py-2 text-center">
                      {e.status === 'lancado'
                        ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400" title="Lançado no Conta Azul"><Check className="h-3.5 w-3.5" /> lançado</span>
                        : <button onClick={() => lancar(e.event_id)} disabled={lancandoId === e.event_id}
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted/60 disabled:opacity-50" title="Lançar no CA (conta a receber, vence na previsão)">
                            {lancandoId === e.event_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Receipt className="h-3.5 w-3.5" />} Lançar
                          </button>}
                    </td>
                  </tr>
                ))}
                {!loading && itens.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Nenhum recebível Sympla no período.</td></tr>
                )}
              </tbody>
              {itens.length > 0 && (
                <tfoot>
                  <tr className="border-t bg-muted/20 font-semibold">
                    <td className="px-4 py-2.5" colSpan={3}>Total ({fmtNum(itens.length)})</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtBRL(resumo?.total_bruto)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">{fmtBRL(resumo?.total_taxa)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{fmtBRL(resumo?.total_liquido)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        O líquido firma após a reverificação de cancelados (roda diário). O lançamento automático no Conta Azul
        (contas a receber, na data prevista) entra em seguida.
      </p>
    </div>
  );
}

export function YuzerEmConstrucao() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="rounded-full bg-muted/50 p-4"><CalendarClock className="h-8 w-8 text-muted-foreground" /></div>
      <h3 className="font-semibold">Yuzer — em construção</h3>
      <p className="text-sm text-muted-foreground max-w-md">
        O repasse líquido da Yuzer (com taxas e aluguel de equipamentos) não vem na API operacional deles.
        Aguardando retorno do dev da Yuzer sobre o endpoint de fechamento pra montar esta tela.
      </p>
    </div>
  );
}
