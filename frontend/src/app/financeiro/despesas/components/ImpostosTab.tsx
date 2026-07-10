'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Receipt, Loader2, Send, Check, AlertTriangle, FileText } from 'lucide-react';
import { NfceImportBox } from './NfceImportBox';

type Tributo = { sigla: string; nome: string; valor: number; vencimento: string; periodicidade: 'mensal' | 'trimestral'; ja_lancado: boolean; valor_lancado: number | null; chave?: string };
type Base = { faturamento_nf: number; faturamento_stone: number; faturamento: number; couvert: number; gorjeta: number; bebidas_frias: number; base_lucro: number; base_monofasica: number };
type CnpjBlock = { cnpj_indice: number | null; cnpj_label: string; cnpj_documento: string | null; origem_xml: boolean; base: Base; tributos: Tributo[] };
type Preview = { bar_id: number; ano: number; mes: number; competencia: string; origem_xml: boolean; por_cnpj: CnpjBlock[]; base: Base; tributos: Tributo[] };

const fmtBRL = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const brDate = (d: string) => (d ? d.split('-').reverse().join('/') : '—');
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function ultimosMeses(n: number) {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
  const out: { ano: number; mes: number; label: string; key: string }[] = [];
  for (let i = 0; i < n; i++) { const ano = d.getFullYear(), mes = d.getMonth() + 1; out.push({ ano, mes, label: `${MESES[mes - 1]}/${ano}`, key: `${ano}-${mes}` }); d.setMonth(d.getMonth() - 1); }
  return out;
}

export function ImpostosTab() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const opcoesMes = useMemo(() => ultimosMeses(12), []);
  const [sel, setSel] = useState(opcoesMes[0]?.key || '');
  const [data, setData] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [lancando, setLancando] = useState(false);
  const [lancandoChave, setLancandoChave] = useState<string | null>(null);

  const { ano, mes } = useMemo(() => { const [a, m] = sel.split('-').map(Number); return { ano: a, mes: m }; }, [sel]);

  const carregar = useCallback(async () => {
    if (!selectedBar?.id || !ano || !mes) return;
    setLoading(true); setConfirmando(false);
    try {
      const r = await api.get(`/api/financeiro/fechamento/impostos?bar_id=${selectedBar.id}&ano=${ano}&mes=${mes}`);
      if (r?.error) throw new Error(r.error);
      setData(r);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar impostos', message: e?.message });
      setData(null);
    } finally { setLoading(false); }
  }, [selectedBar?.id, ano, mes, showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const blocos = data?.por_cnpj || [];
  const temMultiCnpj = blocos.length > 1;
  const pendentes = blocos.flatMap((c) => c.tributos.filter((t) => t.valor >= 0.01 && !t.ja_lancado));
  const totalImpostos = (data?.tributos || []).reduce((s, t) => s + Number(t.valor || 0), 0);

  const postLancar = async (extra: any) => {
    if (!selectedBar?.id) return;
    try {
      const r = await api.post('/api/financeiro/fechamento/impostos', { bar_id: selectedBar.id, ano, mes, ...extra });
      if (r?.ok || r?.skipped) showToast({ type: 'success', title: r?.skipped ? 'Nada a lançar' : 'Impostos lançados no Conta Azul' });
      else {
        const err = (r?.resultados || []).find((x: any) => !x.ok)?.erro || r?.error || 'Erro';
        showToast({ type: 'error', title: 'Falha ao lançar', message: err });
      }
      await carregar();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Falha ao lançar', message: e?.message });
    }
  };
  const lancarTodos = async () => { setLancando(true); try { await postLancar({}); } finally { setLancando(false); setConfirmando(false); } };
  const lancarUm = async (chave: string) => { setLancandoChave(chave); try { await postLancar({ chave }); } finally { setLancandoChave(null); } };
  const ocupado = lancando || lancandoChave !== null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5"><Receipt className="h-5 w-5 text-primary" /></div>
          <div>
            <h2 className="font-semibold">Simulação de Impostos</h2>
            <p className="text-sm text-muted-foreground">Simulado por CNPJ (IRPJ, CSLL, ICMS, COFINS, PIS) — cada CNPJ declara separado.</p>
          </div>
        </div>
        <select value={sel} onChange={(e) => setSel(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
          {opcoesMes.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>Faturamento = <b>maior</b> entre NF e Stone, <b>por CNPJ</b>. IRPJ/CSLL tiram gorjeta e couvert; PIS/COFINS também tiram <b>bebida fria (monofásico)</b>, que vem do XML importado abaixo. Sem XML, a bebida fria fica 0 nesse CNPJ.</span>
      </div>

      {/* Importar XML das NFC-e (separa faturamento + bebida fria por CNPJ) */}
      {selectedBar?.id && <NfceImportBox barId={selectedBar.id} ano={ano} mes={mes} onImported={carregar} />}

      {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>}

      {/* Um bloco por CNPJ */}
      {!loading && blocos.map((c) => {
        const b = c.base;
        return (
          <Card key={c.cnpj_indice ?? 'unico'}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-semibold truncate">{c.cnpj_label}</span>
                  {c.cnpj_documento && <span className="text-xs text-muted-foreground font-mono hidden sm:inline">{c.cnpj_documento}</span>}
                </div>
                {temMultiCnpj && (
                  c.origem_xml
                    ? <span className="text-[11px] rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5">bebida fria do XML</span>
                    : <span className="text-[11px] rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5">sem XML · bebida fria 0</span>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <div><div className="text-xs text-muted-foreground">Faturamento (usado)</div><div className="font-semibold tabular-nums">{fmtBRL(b.faturamento)}</div><div className="text-[10px] text-muted-foreground">NF {fmtBRL(b.faturamento_nf)} · Stone {fmtBRL(b.faturamento_stone)}</div></div>
                <div><div className="text-xs text-muted-foreground">Couvert</div><div className="font-semibold tabular-nums">{fmtBRL(b.couvert)}</div></div>
                <div><div className="text-xs text-muted-foreground">Gorjeta</div><div className="font-semibold tabular-nums">{fmtBRL(b.gorjeta)}</div></div>
                <div><div className="text-xs text-muted-foreground">Bebida fria</div><div className="font-semibold tabular-nums">{fmtBRL(b.bebidas_frias)}</div></div>
                <div><div className="text-xs text-muted-foreground">Base lucro</div><div className="font-semibold tabular-nums">{fmtBRL(b.base_lucro)}</div></div>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground bg-muted/30">
                      <th className="text-left font-medium px-3 py-2">Tributo</th>
                      <th className="text-left font-medium px-3 py-2 hidden sm:table-cell">Vencimento</th>
                      <th className="text-right font-medium px-3 py-2">Valor simulado</th>
                      <th className="text-center font-medium px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.tributos.map((t) => (
                      <tr key={t.chave || t.sigla} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium">{t.sigla} <span className="text-[10px] text-muted-foreground">{t.periodicidade === 'trimestral' ? 'trim' : 'mensal'}</span></td>
                        <td className="px-3 py-2 text-muted-foreground tabular-nums hidden sm:table-cell">{brDate(t.vencimento)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtBRL(t.valor)}</td>
                        <td className="px-3 py-2 text-center">
                          {t.ja_lancado ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><Check className="h-3.5 w-3.5" /> lançado</span>
                            : t.valor >= 0.01 ? (
                              <button onClick={() => lancarUm(t.chave || t.sigla)} disabled={ocupado}
                                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted/60 disabled:opacity-50" title="Lançar este imposto no Conta Azul">
                                {lancandoChave === (t.chave || t.sigla) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Lançar
                              </button>
                            ) : <span className="text-xs text-muted-foreground/40">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {!loading && blocos.length === 0 && <Card><CardContent className="p-10 text-center text-muted-foreground">Sem base no período.</CardContent></Card>}

      {/* Total agregado + lançar todos */}
      {!loading && blocos.length > 0 && (
        <Card>
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Total de impostos {temMultiCnpj ? '(soma dos CNPJs)' : ''}: </span>
              <b className="tabular-nums">{fmtBRL(totalImpostos)}</b>
            </div>
            <div className="flex items-center justify-end gap-3">
              {confirmando ? (
                <>
                  <span className="text-xs text-muted-foreground">Confirmar {pendentes.length} lançamento(s) no CA?</span>
                  <button onClick={() => setConfirmando(false)} className="rounded-md border px-3 h-9 text-sm hover:bg-muted/60">Cancelar</button>
                  <button onClick={lancarTodos} disabled={ocupado} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-9 text-sm font-medium text-primary-foreground disabled:opacity-50">
                    {lancando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Confirmar
                  </button>
                </>
              ) : (
                <button onClick={() => setConfirmando(true)} disabled={loading || ocupado || pendentes.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-9 text-sm font-medium text-primary-foreground disabled:opacity-50">
                  <Send className="h-4 w-4" /> Lançar todos os pendentes{pendentes.length ? ` (${pendentes.length})` : ''}
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
