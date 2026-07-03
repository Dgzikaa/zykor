'use client';

import { useCallback, useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api-client';
import { CreditCard, Loader2, RefreshCw, Send, CheckCircle2, AlertTriangle, X, ChevronDown, ChevronRight, Building2, Landmark } from 'lucide-react';

const fmtBRL = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const brDia = (d: string) => { const [y, m, dd] = String(d).split('-'); return dd && m ? `${dd}/${m}` : d; };
// ontem em horário de Brasília (UTC-3)
const ontemBRT = () => { const d = new Date(Date.now() - 3 * 3600 * 1000); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
const tipoLabel: Record<string, string> = { CREDITO: 'Crédito', DEBITO: 'Débito', PIX: 'PIX' };

export default function StoneRecebiveisPage() {
  return <ProtectedRoute><Conteudo /></ProtectedRoute>;
}

// Exportado p/ reuso na aba "Stone" de /financeiro/receitas (Receitas CA).
export function StoneRecebiveisConteudo() { return <Conteudo />; }

function Conteudo() {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const barId = selectedBar?.id;

  const [data, setData] = useState(ontemBRT());
  const [preview, setPreview] = useState<any | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lancando, setLancando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [resultado, setResultado] = useState<any | null>(null);
  // filtros (só de visualização — o lançamento sempre processa todos os pendentes)
  const [fTipos, setFTipos] = useState<Set<string>>(new Set());
  const [fBandeiras, setFBandeiras] = useState<Set<string>>(new Set());
  const [fStatus, setFStatus] = useState<'todos' | 'pendente' | 'lancado'>('todos');
  const [colapsadas, setColapsadas] = useState<Set<string>>(new Set()); // CNPJs recolhidos
  const toggleColapso = (emp: string) => setColapsadas((s) => { const n = new Set(s); n.has(emp) ? n.delete(emp) : n.add(emp); return n; });

  const carregar = useCallback(async () => {
    if (!barId) return;
    setLoading(true); setErro(null); setResultado(null);
    try {
      const r = await api.get(`/api/financeiro/stone/contas-a-receber-diario?data=${data}&bar_id=${barId}`);
      setPreview(r);
    } catch (e: any) { setPreview(null); setErro(e?.message || 'Erro no preview'); }
    finally { setLoading(false); }
  }, [barId, data]);
  useEffect(() => { carregar(); }, [carregar]);

  const lancar = async () => {
    if (!barId) return;
    setConfirmar(false); setLancando(true);
    try {
      const r = await api.post('/api/financeiro/stone/contas-a-receber-diario', { data, bar_id: barId });
      setResultado(r);
      const falhas = (r.resultados || []).filter((x: any) => x.ok === false).length;
      toast({
        title: falhas ? `Lançado com ${falhas} erro(s)` : 'Lançado no Conta Azul',
        description: `${r.total} lançamento(s) processado(s)`,
        variant: falhas ? 'destructive' : 'default',
      });
      carregar();
    } catch (e: any) { toast({ title: 'Erro ao lançar', description: e?.message, variant: 'destructive' }); }
    finally { setLancando(false); }
  };

  const resumo = preview?.resumo;
  const recebiveis: any[] = preview?.recebiveis || [];
  const compensacao: any[] = preview?.compensacao || [];
  const pendentes = recebiveis.filter((r) => !r.ja_lancado).length + compensacao.filter((c) => !c.ja_lancado).length;

  // filtros
  const bandeirasDisp = Array.from(new Set(recebiveis.map((r) => r.bandeira).filter((b: string) => b && b !== '—'))).sort();
  const toggle = (set: Set<string>, v: string, setter: (s: Set<string>) => void) => {
    const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); setter(n);
  };
  const statusOk = (ja: boolean) => fStatus === 'todos' || (fStatus === 'pendente' ? !ja : ja);
  const recebiveisView = recebiveis.filter((r) =>
    (fTipos.size === 0 || fTipos.has(r.tipo)) &&
    (fBandeiras.size === 0 || fBandeiras.has(r.bandeira)) &&
    statusOk(!!r.ja_lancado));
  const compensacaoView = compensacao.filter((c) => statusOk(!!c.ja_lancado));
  const filtroAtivo = fTipos.size > 0 || fBandeiras.size > 0 || fStatus !== 'todos';
  const totalFiltrado = recebiveisView.reduce((s, r) => s + Number(r.valor || 0), 0);
  const limparFiltros = () => { setFTipos(new Set()); setFBandeiras(new Set()); setFStatus('todos'); };

  // Agrupamento por CNPJ (empresa) — cada um vai para as suas contas no CA.
  const empresas = Array.from(new Set([
    ...recebiveisView.map((r) => r.empresa),
    ...compensacaoView.map((c) => c.empresa),
  ].filter(Boolean))) as string[];
  const grupoDe = (emp: string) => {
    const recs = recebiveisView.filter((r) => (r.empresa || '') === emp);
    const comps = compensacaoView.filter((c) => (c.empresa || '') === emp);
    const contas = Array.from(new Set(recs.map((r) => r.conta).filter(Boolean)));
    const bruto = recs.reduce((s, r) => s + Number(r.bruto || 0), 0);
    const liquido = recs.reduce((s, r) => s + Number(r.valor || 0), 0);
    const pend = recs.filter((r) => !r.ja_lancado).length + comps.filter((c) => !c.ja_lancado).length;
    return { emp, recs, comps, contas, bruto, liquido, pend };
  };

  return (
    <div className="container mx-auto px-3 py-5 max-w-5xl space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><CreditCard className="w-5 h-5" /> Recebíveis Stone → Conta Azul</h1>
          <p className="text-sm text-muted-foreground">Lança o líquido dos recebíveis do dia no CA (crédito, débito, PIX) + o par de taxa. Idempotente — não duplica.</p>
        </div>
      </div>

      {/* Controles */}
      <Card className="card-dark">
        <CardContent className="py-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Data (dia Stone · 00h–24h)</label>
            <Input type="date" value={data} max={ontemBRT()} onChange={e => setData(e.target.value)} className="h-9 w-44" />
          </div>
          <Button variant="outline" onClick={carregar} disabled={loading || !barId} className="h-9">
            {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}Atualizar preview
          </Button>
          {recebiveis.length > 0 && pendentes === 0 && !loading ? (
            <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4" />Já lançado neste dia
            </span>
          ) : (
            <Button onClick={() => setConfirmar(true)} disabled={loading || lancando || !barId || pendentes === 0}
              className="h-9 bg-emerald-600 hover:bg-emerald-700 ml-auto">
              {lancando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
              Lançar no CA{pendentes > 0 ? ` (${pendentes})` : ''}
            </Button>
          )}
        </CardContent>
      </Card>

      {erro && (
        <Card className="card-dark border-red-300 dark:border-red-900/50">
          <CardContent className="py-4 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />{erro}
          </CardContent>
        </Card>
      )}

      {/* Resumo */}
      {resumo && !erro && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Tile label="Recebíveis" valor={String(resumo.recebiveis)} />
          <Tile label="Total bruto" valor={fmtBRL(resumo.total_bruto)} />
          <Tile label="Taxa do dia" valor={fmtBRL(resumo.total_taxa)} cor="amber" />
          <Tile label="Líquido (caixa)" valor={fmtBRL(resumo.total_liquido)} cor="emerald" />
        </div>
      )}

      {/* Filtros (visualização) */}
      {!erro && recebiveis.length > 0 && (
        <Card className="card-dark">
          <CardContent className="py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Tipo:</span>
              {([['CREDITO', 'Crédito'], ['DEBITO', 'Débito'], ['PIX', 'PIX']] as const).map(([v, l]) => (
                <button key={v} onClick={() => toggle(fTipos, v, setFTipos)}
                  className={`text-xs rounded-md px-2 py-1 border transition ${fTipos.has(v) ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 dark:border-gray-600 text-muted-foreground hover:bg-muted'}`}>{l}</button>
              ))}
            </div>
            {bandeirasDisp.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Bandeira:</span>
                {bandeirasDisp.map((b) => (
                  <button key={b} onClick={() => toggle(fBandeiras, b, setFBandeiras)}
                    className={`text-xs rounded-md px-2 py-1 border transition ${fBandeiras.has(b) ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 dark:border-gray-600 text-muted-foreground hover:bg-muted'}`}>{b}</button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Status:</span>
              <select value={fStatus} onChange={e => setFStatus(e.target.value as any)}
                className="h-7 rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-2 text-xs">
                <option value="todos">Todos</option>
                <option value="pendente">Pendentes</option>
                <option value="lancado">Lançados</option>
              </select>
            </div>
            {filtroAtivo && (
              <button onClick={limparFiltros} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline ml-auto">limpar filtros</button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recebíveis agrupados por CNPJ → conta de destino no CA */}
      {!erro && (
        <Card className="card-dark">
          <CardContent className="py-3">
            <div className="text-sm font-medium mb-3 flex items-center justify-between">
              <span>Recebíveis por CNPJ (líquido → conta no CA)</span>
              {filtroAtivo && <span className="text-xs text-muted-foreground font-normal">{recebiveisView.length} de {recebiveis.length} · {fmtBRL(totalFiltrado)}</span>}
            </div>

            {loading ? (
              <div className="py-6 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
            ) : recebiveis.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">Nenhum recebível neste dia.</div>
            ) : empresas.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">Nenhum recebível com esses filtros.</div>
            ) : (
              <div className="space-y-3">
                {empresas.map((emp) => {
                  const g = grupoDe(emp);
                  const aberto = !colapsadas.has(emp);
                  return (
                    <div key={emp} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                      {/* header do CNPJ (clique expande/recolhe) */}
                      <button onClick={() => toggleColapso(emp)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 bg-muted/40 hover:bg-muted/70 transition text-left">
                        {aberto ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                        <Building2 className="w-4 h-4 shrink-0 text-muted-foreground" />
                        <span className="font-semibold">{emp}</span>
                        <div className="hidden sm:flex items-center gap-1 ml-1.5">
                          {g.contas.map((c) => (
                            <Badge key={c} variant="outline" className="text-[10px] inline-flex items-center gap-1"><Landmark className="w-2.5 h-2.5" />{c}</Badge>
                          ))}
                        </div>
                        <div className="ml-auto flex items-center gap-3">
                          {g.pend > 0
                            ? <span className="text-[11px] rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5">{g.pend} pendente(s)</span>
                            : <span className="text-[11px] text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />lançado</span>}
                          <div className="text-right leading-tight">
                            <div className="text-[11px] text-muted-foreground tabular-nums">bruto {fmtBRL(g.bruto)}</div>
                            <div className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">líq {fmtBRL(g.liquido)}</div>
                          </div>
                        </div>
                      </button>

                      {aberto && (
                        <div className="pb-2">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="text-xs text-muted-foreground border-b"><tr>
                                <th className="text-left font-medium px-2 py-1.5">Descrição</th>
                                <th className="text-left font-medium px-2 py-1.5">Conta destino</th>
                                <th className="text-right font-medium px-2 py-1.5">Venc.</th>
                                <th className="text-right font-medium px-2 py-1.5">Tx</th>
                                <th className="text-right font-medium px-2 py-1.5">Bruto</th>
                                <th className="text-right font-medium px-2 py-1.5">Taxa</th>
                                <th className="text-right font-medium px-2 py-1.5">Líquido</th>
                                <th className="text-right font-medium px-2 py-1.5">Status</th>
                              </tr></thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {g.recs.length === 0 ? <tr><td colSpan={8} className="px-2 py-3 text-center text-xs text-muted-foreground">Sem recebíveis com esses filtros.</td></tr>
                                : g.recs.map((r, i) => (
                                  <tr key={i}>
                                    <td className="px-2 py-1.5"><Badge variant="outline" className="text-[10px] mr-1">{tipoLabel[r.tipo] || r.tipo}</Badge>{r.descricao}</td>
                                    <td className="px-2 py-1.5"><span className="inline-flex items-center gap-1 text-xs"><Landmark className="w-3 h-3 text-muted-foreground shrink-0" />{r.conta}</span></td>
                                    <td className="px-2 py-1.5 text-right tabular-nums">{brDia(r.vencimento)}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{r.transacoes}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmtBRL(r.bruto)}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums text-amber-600 dark:text-amber-400">{fmtBRL(r.taxa)}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums font-medium">{fmtBRL(r.valor)}</td>
                                    <td className="px-2 py-1.5 text-right">
                                      {r.ja_lancado ? <span className="text-[11px] text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />lançado</span>
                                        : <span className="text-[11px] text-muted-foreground">pendente</span>}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {/* par de taxa do CNPJ */}
                          {g.comps.length > 0 && (
                            <div className="mt-2 mx-2 rounded-md bg-muted/30 px-2.5 py-2 space-y-1">
                              <div className="text-[11px] text-muted-foreground font-medium inline-flex items-center gap-1">
                                <Landmark className="w-3 h-3" />Taxa do dia — par que se compensa · {g.comps[0]?.conta}
                              </div>
                              {g.comps.map((c, i) => (
                                <div key={i} className="flex items-center justify-between gap-2 text-xs">
                                  <span>
                                    <Badge variant="outline" className={`text-[10px] mr-1.5 ${c.tipo === 'DESPESA' ? 'text-red-600 border-red-300' : 'text-emerald-600 border-emerald-300'}`}>{c.tipo}</Badge>
                                    {c.descricao} <span className="text-muted-foreground">· {c.categoria}</span>
                                  </span>
                                  <span className="flex items-center gap-2">
                                    <span className="tabular-nums font-medium">{fmtBRL(c.valor)}</span>
                                    {c.ja_lancado ? <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" />lançado</span>
                                      : <span className="text-muted-foreground">pendente</span>}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-2">Cada CNPJ vai para as suas contas no Conta Azul. A despesa (TAXA MAQUININHA) e a compensação (Outras Receitas) se anulam — o caixa fica no líquido.</p>
          </CardContent>
        </Card>
      )}

      {/* Resultado do lançamento */}
      {resultado && (
        <Card className="card-dark">
          <CardContent className="py-3">
            <div className="text-sm font-medium mb-2">Resultado do lançamento</div>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {(resultado.resultados || []).map((x: any, i: number) => (
                <div key={i} className="flex items-center justify-between gap-2 text-xs border-b border-gray-100 dark:border-gray-800 py-1">
                  <span className="truncate">{x.chave} · {x.natureza}</span>
                  <span className="shrink-0">
                    {x.skipped ? <span className="text-muted-foreground">↷ {x.motivo}</span>
                      : x.ok ? <span className="text-emerald-600 dark:text-emerald-400">✓ {fmtBRL(x.valor)}</span>
                      : <span className="text-red-600 dark:text-red-400">✗ {x.erro || 'erro'}</span>}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmação de lançamento */}
      {confirmar && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmar(false); }}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-md space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Send className="w-4 h-4 text-emerald-600" />Confirmar lançamento no CA</h4>
              <button onClick={() => setConfirmar(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Vai criar <b>{pendentes}</b> lançamento(s) pendente(s) no Conta Azul do <b>{selectedBar?.nome}</b>, referente a <b>{brDia(data)}</b>.
              O Conta Azul <b>não permite excluir</b> lançamento pela API — confira o preview antes.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmar(false)}>Cancelar</Button>
              <Button onClick={lancar} disabled={lancando} className="bg-emerald-600 hover:bg-emerald-700">
                {lancando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}Lançar {pendentes}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ label, valor, cor }: { label: string; valor: string; cor?: 'amber' | 'emerald' }) {
  const c = cor === 'amber' ? 'text-amber-600 dark:text-amber-400'
    : cor === 'emerald' ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-gray-900 dark:text-white';
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-card">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`text-base font-bold ${c}`}>{valor}</div>
    </div>
  );
}
