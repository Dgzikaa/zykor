'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { ClipboardList, Loader2, Check } from 'lucide-react';

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const num = (v: any) => Number(v) || 0;
const fmtBRL = (n: number) => `${n < 0 ? '-' : ''}R$ ${Math.abs(n).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
const fmtPct = (n: number) => `${num(n).toFixed(1).replace('.', ',')}%`;

// Cada linha editável do BP (= planejado da orçamentação). value já vem do serviço.
type Linha = { nome: string; valor: number; isPct: boolean; indent?: boolean };

export function BpManual({ barId }: { barId: number }) {
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [dados, setDados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesSel, setMesSel] = useState(new Date().getMonth() + 1);
  const [cmpA, setCmpA] = useState(8);
  const [cmpB, setCmpB] = useState(9);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [salvando, setSalvando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/estrategico/orcamentacao/todos-meses?bar_id=${barId}&ano=${ano}`, { cache: 'no-store' }).then((x) => x.json());
      setDados(r.data || []);
    } catch { setDados([]); } finally { setLoading(false); }
  }, [barId, ano]);
  useEffect(() => { carregar(); }, [carregar]);

  const mesData = useMemo(() => dados.find((m) => m.mes === mesSel), [dados, mesSel]);

  // Extrai as linhas editáveis (planejado) de um mês, na ordem da estrutura.
  const linhasDoMes = useCallback((mes: any): { categoria: string; cor: string; tipo: string; linhas: Linha[]; subtotal: number }[] => {
    if (!mes) return [];
    return (mes.categorias || []).map((cat: any) => {
      const linhas: Linha[] = [];
      if (cat.modoPercentual) {
        linhas.push({ nome: cat.nome, valor: num(cat.percentual?.plan), isPct: true });
      } else {
        for (const s of cat.subcategorias || []) {
          if (s.filhos?.length) {
            linhas.push({ nome: s.nome, valor: num(s.planejado), isPct: false }); // pai (read-only via sum)
            for (const f of s.filhos) linhas.push({ nome: f.nome, valor: num(f.planejado), isPct: false, indent: true });
          } else if (s.pctFatPlan !== undefined && s.pctFatPlan !== null) {
            linhas.push({ nome: s.nome, valor: num(s.pctFatPlan), isPct: true });
          } else {
            linhas.push({ nome: s.nome, valor: num(s.planejado), isPct: false });
          }
        }
      }
      const subtotal = (cat.subcategorias || []).reduce((acc: number, s: any) => acc + num(s.planejado), 0);
      return { categoria: cat.nome, cor: cat.cor, tipo: cat.tipo, linhas, subtotal };
    });
  }, []);

  // Linhas-pai (com filhos) não são editáveis (são soma).
  const ehPai = useCallback((mes: any, nome: string) => {
    for (const c of mes?.categorias || []) for (const s of c.subcategorias || []) if (s.nome === nome && s.filhos?.length) return true;
    return false;
  }, []);

  const salvar = async (nome: string, valorStr: string) => {
    const valor = parseFloat(valorStr.replace(',', '.'));
    setSalvando(nome);
    try {
      await fetch('/api/estrategico/orcamentacao', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bar_id: barId, ano, mes: mesSel, categoria_nome: nome, valor_planejado: isNaN(valor) ? 0 : valor }),
      });
      setEditKey(null); await carregar();
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao salvar', message: e?.message }); }
    finally { setSalvando(null); }
  };

  const totais = mesData?.totais;
  const secoes = linhasDoMes(mesData);

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 via-slate-800 to-gray-900 p-5 mb-5 shadow-sm">
        <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="relative flex items-center justify-between gap-3 flex-wrap text-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center shrink-0"><ClipboardList className="w-6 h-6" /></div>
            <div>
              <h1 className="text-xl font-bold leading-tight">Business Plan (BP)</h1>
              <p className="text-sm text-white/70">100% manual — o que você salva aqui vira o planejado da Orçamentação</p>
            </div>
          </div>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="h-9 rounded-md bg-white/10 backdrop-blur border-0 text-white px-2 text-sm [color-scheme:dark]">
            {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <Tabs defaultValue="mes">
        <TabsList className="mb-4">
          <TabsTrigger value="mes">BP do mês</TabsTrigger>
          <TabsTrigger value="comparativo">Comparativo</TabsTrigger>
        </TabsList>

        {/* ===== BP do mês ===== */}
        <TabsContent value="mes">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {MESES.slice(1).map((m, i) => (
              <button key={m} onClick={() => setMesSel(i + 1)} className={cn('text-xs rounded-full px-3 py-1.5 transition-colors', mesSel === i + 1 ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-muted hover:bg-muted-foreground/20')}>{m.slice(0, 3)}</button>
            ))}
          </div>

          {loading ? <Skeleton className="h-[500px]" /> : !mesData ? <div className="py-16 text-center text-muted-foreground">Sem dados.</div> : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2 p-0 overflow-hidden rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-muted-foreground border-b bg-muted/40">
                    <tr><th className="text-left px-3 py-2">Categoria / linha</th><th className="text-right px-3 py-2 w-40">Planejado</th></tr>
                  </thead>
                  <tbody>
                    {secoes.map((sec) => (
                      <Fragment key={sec.categoria}>
                        <tr className="bg-muted/30 border-y"><td className="px-3 py-1.5 font-semibold">{sec.categoria}</td><td className="px-3 py-1.5 text-right font-semibold tabular-nums">{fmtBRL(sec.subtotal)}</td></tr>
                        {sec.linhas.map((l) => {
                          const k = `${sec.categoria}|${l.nome}`;
                          const pai = ehPai(mesData, l.nome);
                          const editando = editKey === k;
                          return (
                            <tr key={k} className="border-b last:border-0 hover:bg-muted/20">
                              <td className={cn('px-3 py-1.5 text-muted-foreground', l.indent && 'pl-7', pai && 'font-medium text-foreground')}>{l.nome}</td>
                              <td className="px-3 py-1.5 text-right">
                                {pai ? (
                                  <span className="tabular-nums text-muted-foreground">{fmtBRL(l.valor)}</span>
                                ) : editando ? (
                                  <span className="inline-flex items-center gap-1 justify-end">
                                    <Input value={editVal} onChange={(e) => setEditVal(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === 'Enter') salvar(l.nome, editVal); if (e.key === 'Escape') setEditKey(null); }}
                                      onBlur={() => salvar(l.nome, editVal)} className="w-28 h-7 text-right text-xs" />
                                    {salvando === l.nome ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 text-emerald-600" />}
                                  </span>
                                ) : (
                                  <button onClick={() => { setEditKey(k); setEditVal(String(l.valor).replace('.', ',')); }} className="tabular-nums hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded px-2 py-0.5 text-blue-600 dark:text-blue-400 font-medium">
                                    {l.isPct ? fmtPct(l.valor) : fmtBRL(l.valor)}
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </Card>

              {/* Resumo (plan) */}
              <div className="space-y-3">
                <Card className="rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm"><CardContent className="py-4 space-y-2">
                  <Resumo label="Faturamento Meta" valor={num(totais?.faturamento_meta_plan)} cor="text-blue-600 dark:text-blue-400" />
                  <Resumo label="Real Fixo" valor={num(totais?.real_fixo_plan)} />
                  <Resumo label="Break Even" valor={num(totais?.breakeven_plan)} />
                  <div className="border-t pt-2"><Resumo label="Lucro Líquido" valor={num(totais?.ebitda_plan)} cor={num(totais?.ebitda_plan) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'} bold /></div>
                  <div className="text-[11px] text-muted-foreground">Margem: {fmtPct(num(totais?.margem_ebitda_plan))}</div>
                </CardContent></Card>
                <p className="text-[11px] text-muted-foreground px-1">Tudo manual. Ao salvar, o valor vira o <b>planejado</b> daquele mês na Orçamentação (mesmo campo).</p>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ===== Comparativo ===== */}
        <TabsContent value="comparativo">
          {loading ? <Skeleton className="h-[400px]" /> : (
            <Card className="p-0 overflow-x-auto rounded-2xl border-0 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
              <div className="flex items-center gap-2 p-3 border-b">
                <select value={cmpA} onChange={(e) => setCmpA(Number(e.target.value))} className="h-8 rounded-md border border-input bg-background px-2 text-sm font-semibold">{MESES.slice(1).map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
                <span className="text-muted-foreground text-xs">vs</span>
                <select value={cmpB} onChange={(e) => setCmpB(Number(e.target.value))} className="h-8 rounded-md border border-input bg-background px-2 text-sm font-semibold">{MESES.slice(1).map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
              </div>
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-muted-foreground border-b bg-muted/40">
                  <tr><th className="text-left px-3 py-2">Categoria</th><th className="text-right px-3 py-2">{MESES[cmpA]}</th><th className="text-right px-3 py-2">{MESES[cmpB]}</th><th className="text-right px-3 py-2">Δ</th></tr>
                </thead>
                <tbody>
                  {(() => {
                    const a = dados.find((m) => m.mes === cmpA); const b = dados.find((m) => m.mes === cmpB);
                    const cats = (a?.categorias || b?.categorias || []).map((c: any) => c.nome);
                    const sub = (mes: any, nome: string) => { const c = mes?.categorias?.find((x: any) => x.nome === nome); return (c?.subcategorias || []).reduce((s: number, x: any) => s + num(x.planejado), 0); };
                    return cats.map((nome: string) => {
                      const va = sub(a, nome), vb = sub(b, nome), d = vb - va;
                      return (
                        <tr key={nome} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-3 py-1.5">{nome}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{fmtBRL(va)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{fmtBRL(vb)}</td>
                          <td className={cn('px-3 py-1.5 text-right tabular-nums', d > 0 ? 'text-red-600' : d < 0 ? 'text-emerald-600' : 'text-muted-foreground')}>{d === 0 ? '–' : `${d > 0 ? '+' : ''}${fmtBRL(d)}`}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Resumo({ label, valor, cor, bold }: { label: string; valor: number; cor?: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn('text-sm', bold ? 'font-semibold' : 'text-muted-foreground')}>{label}</span>
      <span className={cn('tabular-nums', bold ? 'text-lg font-bold' : 'text-sm font-medium', cor)}>{fmtBRL(valor)}</span>
    </div>
  );
}
