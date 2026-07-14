'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageShell } from '@/components/layout/PageShell';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useModuloPermissao } from '@/hooks/useModuloPermissao';
import { BadgeSomenteLeitura } from '@/components/permissions/BadgeSomenteLeitura';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api-client';
import { HandCoins, Loader2, Plus, Search, Send, ChevronLeft, ChevronRight, Check, X, Pencil, Trash2, Lock, Unlock, CheckCircle2 } from 'lucide-react';
import { STATUS_LABEL, STATUS_COLOR, type PedidoStatus } from '@/app/financeiro/pedidos-pagamento/types';

type Freela = { id: string; nome: string; funcao: string | null; valor_padrao: number | null; chave_pix: string | null; contaazul_pessoa_id: string | null };
type Pedido = { id: string; beneficiario_nome: string | null; valor: number; status: PedidoStatus; data_vencimento: string; data_competencia: string | null; contaazul_pessoa_id: string | null };

const norm = (s?: string | null) => (s || '').trim().toLowerCase();
const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const parseValor = (v: string) => { const n = parseFloat(v.replace(/[R$\s.]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseISO = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const ddmm = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}`; };
/** Segunda-feira da semana da data (seg→dom, padrão dos relatórios). */
function mondayOf(d: Date) { const x = new Date(d); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); x.setHours(0, 0, 0, 0); return x; }
function weekInfo(monISO: string) {
  const mon = parseISO(monISO);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const payTue = new Date(sun); payTue.setDate(sun.getDate() + 2); // diárias pagam na terça seguinte
  return { monISO, sunISO: toISO(sun), payTueISO: toISO(payTue) };
}
const RASCUNHO: PedidoStatus = 'rascunho';

export default function FreelasOperacaoPage() {
  const { selectedBar } = useBar();
  const barId = selectedBar?.id;
  const { toast } = useToast();
  const { setPageTitle } = usePageTitle();
  const { soLeitura, podeInserir } = useModuloPermissao('/operacional/freelas');
  useEffect(() => { setPageTitle('🤝 Freelas — Fechamento da Semana'); return () => setPageTitle(''); }, [setPageTitle]);

  const [monISO, setMonISO] = useState(() => toISO(mondayOf(new Date())));
  const semana = useMemo(() => weekInfo(monISO), [monISO]);

  const [roster, setRoster] = useState<Freela[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [dia, setDia] = useState(() => { const h = toISO(new Date()); const w = weekInfo(toISO(mondayOf(new Date()))); return h >= w.monISO && h <= w.sunISO ? h : w.monISO; });
  const [sel, setSel] = useState<Record<string, { on: boolean; valor: string }>>({});
  const [lancando, setLancando] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');

  const carregar = useCallback(async () => {
    if (!barId) return;
    setLoading(true);
    try {
      const r = await api.get(`/api/operacional/freelas?semana=${semana.monISO}`);
      if (r.success) { setRoster(r.roster || []); setPedidos(r.pedidos || []); }
    } catch (e: any) { toast({ title: 'Erro ao carregar freelas', description: e?.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [barId, semana.monISO, toast]);
  useEffect(() => { carregar(); }, [carregar]);

  const rascunhos = useMemo(() => pedidos.filter(p => p.status === RASCUNHO), [pedidos]);
  const enviados = useMemo(() => pedidos.filter(p => p.status !== RASCUNHO), [pedidos]);
  const totalRascunho = useMemo(() => rascunhos.reduce((s, p) => s + Number(p.valor || 0), 0), [rascunhos]);
  const totalEnviado = useMemo(() => enviados.reduce((s, p) => s + Number(p.valor || 0), 0), [enviados]);
  // "reabrir" só faz sentido pra quem ainda está aguardando aprovação (o financeiro ainda não mexeu).
  const reabriveis = useMemo(() => enviados.filter(p => p.status === 'aguardando_aprovacao').length, [enviados]);

  const navSemana = (delta: number) => { const d = parseISO(monISO); d.setDate(d.getDate() + delta * 7); setMonISO(toISO(d)); setSel({}); };

  const toggle = (f: Freela) => setSel(p => {
    const cur = p[f.id];
    if (cur?.on) return { ...p, [f.id]: { on: false, valor: cur.valor } };
    return { ...p, [f.id]: { on: true, valor: cur?.valor ?? (f.valor_padrao ? String(f.valor_padrao).replace('.', ',') : '') } };
  });
  const setValor = (id: string, valor: string) => setSel(p => ({ ...p, [id]: { on: p[id]?.on ?? true, valor } }));
  const selecionados = useMemo(() => Object.entries(sel).filter(([, v]) => v.on), [sel]);
  const totalNovo = useMemo(() => selecionados.reduce((s, [, v]) => s + parseValor(v.valor), 0), [selecionados]);

  const rosterVisivel = useMemo(() => {
    const q = norm(busca);
    const base = q ? roster.filter(f => norm(f.nome).includes(q) || norm(f.funcao).includes(q)) : roster;
    return [...base].sort((a, b) => {
      const aOn = sel[a.id]?.on ? 1 : 0, bOn = sel[b.id]?.on ? 1 : 0;
      if (aOn !== bOn) return bOn - aOn;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
  }, [roster, busca, sel]);

  // Agrupa por freela (1 linha, N diárias somadas).
  const grupos = (list: Pedido[]) => {
    const m = new Map<string, { nome: string; itens: Pedido[]; total: number }>();
    for (const p of list) {
      const key = p.contaazul_pessoa_id || norm(p.beneficiario_nome) || p.id;
      const g = m.get(key) || { nome: p.beneficiario_nome || '—', itens: [], total: 0 };
      g.itens.push(p); g.total += Number(p.valor || 0); m.set(key, g);
    }
    for (const g of m.values()) g.itens.sort((a, b) => (a.data_competencia || a.data_vencimento).localeCompare(b.data_competencia || b.data_vencimento));
    return Array.from(m.entries()).map(([key, g]) => ({ key, ...g }));
  };
  const gruposRascunho = useMemo(() => grupos(rascunhos), [rascunhos]);
  const gruposEnviado = useMemo(() => grupos(enviados), [enviados]);

  const lancar = async () => {
    const itens = selecionados.map(([freela_id, v]) => ({ freela_id, valor: parseValor(v.valor) })).filter(i => i.valor > 0);
    if (itens.length === 0) return toast({ title: 'Selecione freelas e informe os valores', variant: 'destructive' });
    setLancando(true);
    try {
      const res = await api.post('/api/operacional/freelas', { action: 'lancar', data_competencia: dia, data_vencimento: semana.payTueISO, itens });
      toast({ title: `${res.criados} diária(s) no rascunho`, description: `Dia ${ddmm(dia)} · total ${fmtBRL(res.total)}.` });
      setSel({}); await carregar();
    } catch (e: any) { toast({ title: 'Erro ao lançar', description: e?.message, variant: 'destructive' }); }
    finally { setLancando(false); }
  };

  const salvarEdicao = async (p: Pedido) => {
    const v = parseValor(editVal);
    if (!(v > 0)) return toast({ title: 'Valor inválido', variant: 'destructive' });
    try { await api.put('/api/operacional/freelas', { id: p.id, valor: v }); setEditId(null); await carregar(); }
    catch (e: any) { toast({ title: 'Erro ao editar', description: e?.message, variant: 'destructive' }); }
  };
  const excluir = async (p: Pedido) => {
    if (!window.confirm(`Remover a diária de ${p.beneficiario_nome || 'freela'} (${ddmm(p.data_competencia || p.data_vencimento)} · ${fmtBRL(p.valor)})?`)) return;
    try { await api.delete(`/api/operacional/freelas?id=${p.id}`); await carregar(); }
    catch (e: any) { toast({ title: 'Erro ao remover', description: e?.message, variant: 'destructive' }); }
  };

  const encerrarSemana = async () => {
    if (rascunhos.length === 0) return;
    if (!window.confirm(`Encerrar a semana e enviar ${rascunhos.length} diária(s) (${fmtBRL(totalRascunho)}) ao financeiro? Depois disso quem agenda o pagamento é o financeiro.`)) return;
    setEncerrando(true);
    try {
      const res = await api.post('/api/operacional/freelas', { action: 'encerrar', mon: semana.monISO, sun: semana.sunISO });
      toast({ title: 'Semana encerrada', description: `${res.alterados} diária(s) enviada(s) ao financeiro.` });
      await carregar();
    } catch (e: any) { toast({ title: 'Erro ao encerrar', description: e?.message, variant: 'destructive' }); }
    finally { setEncerrando(false); }
  };
  const reabrirSemana = async () => {
    if (!window.confirm('Reabrir a semana? As diárias que o financeiro ainda NÃO aprovou voltam a rascunho pra você editar.')) return;
    setEncerrando(true);
    try {
      const res = await api.post('/api/operacional/freelas', { action: 'reabrir', mon: semana.monISO, sun: semana.sunISO });
      toast({ title: 'Semana reaberta', description: `${res.alterados} diária(s) voltaram a rascunho.` });
      await carregar();
    } catch (e: any) { toast({ title: 'Erro ao reabrir', description: e?.message, variant: 'destructive' }); }
    finally { setEncerrando(false); }
  };

  return (
    <PageShell width="wide">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 rounded-xl"><HandCoins className="w-6 h-6 text-amber-600 dark:text-amber-400" /></div>
        <div className="flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">Freelas da Semana {soLeitura && <BadgeSomenteLeitura />}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Monte a semana e encerre pra mandar ao financeiro · {selectedBar?.nome || `Bar ${barId ?? ''}`}</p>
        </div>
      </div>

      {/* Navegação da semana */}
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navSemana(-1)}><ChevronLeft className="w-4 h-4" /></Button>
        <div className="text-sm px-1">
          <span className="font-medium">Semana {ddmm(semana.monISO)} a {ddmm(semana.sunISO)}</span>
          <span className="text-muted-foreground"> · pagamento terça {ddmm(semana.payTueISO)}</span>
        </div>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navSemana(1)}><ChevronRight className="w-4 h-4" /></Button>
      </div>

      {loading ? (
        <div className="py-12 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-muted-foreground" /></div>
      ) : (
        <>
          {/* Já enviado ao financeiro (read-only) */}
          {enviados.length > 0 && (
            <Card className="border-indigo-400/50">
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-indigo-600" />
                    Enviado ao financeiro · {enviados.length} diária(s) · {fmtBRL(totalEnviado)}
                  </div>
                  {podeInserir && reabriveis > 0 && (
                    <Button size="sm" variant="outline" onClick={reabrirSemana} disabled={encerrando}>
                      <Unlock className="w-4 h-4 mr-1.5" />Reabrir ({reabriveis})
                    </Button>
                  )}
                </div>
                <div className="space-y-1.5">
                  {gruposEnviado.map(g => (
                    <div key={g.key} className="rounded-lg border border-[hsl(var(--border))] p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate text-sm">{g.nome}{g.itens.length > 1 && <span className="text-muted-foreground text-xs"> · {g.itens.length} diárias</span>}</span>
                        <span className="font-semibold text-sm shrink-0">{fmtBRL(g.total)}</span>
                      </div>
                      <div className="mt-1">
                        {g.itens.map(p => (
                          <div key={p.id} className="flex items-center gap-2 text-xs py-1 border-t border-[hsl(var(--border))]/40 first:border-t-0">
                            <span className="text-muted-foreground w-12 shrink-0">{ddmm(p.data_competencia || p.data_vencimento)}</span>
                            <span className="flex-1 tabular-nums font-medium">{fmtBRL(p.valor)}</span>
                            <Badge className={`${STATUS_COLOR[p.status]} text-[10px] shrink-0`}>{STATUS_LABEL[p.status]}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rascunho da semana (editável) + Encerrar */}
          {rascunhos.length > 0 && (
            <Card className="border-amber-400/60">
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-amber-600" />
                    Rascunho da semana · {rascunhos.length} diária(s) · {fmtBRL(totalRascunho)}
                  </div>
                  {podeInserir && (
                    <Button size="sm" onClick={encerrarSemana} disabled={encerrando}>
                      {encerrando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
                      Encerrar semana ({rascunhos.length})
                    </Button>
                  )}
                </div>
                <div className="space-y-1.5">
                  {gruposRascunho.map(g => (
                    <div key={g.key} className="rounded-lg border border-[hsl(var(--border))] p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate text-sm">{g.nome}{g.itens.length > 1 && <span className="text-muted-foreground text-xs"> · {g.itens.length} diárias</span>}</span>
                        <span className="font-semibold text-sm shrink-0">{fmtBRL(g.total)}</span>
                      </div>
                      <div className="mt-1">
                        {g.itens.map(p => (
                          <div key={p.id} className="flex items-center gap-2 text-xs py-1 border-t border-[hsl(var(--border))]/40 first:border-t-0">
                            <span className="text-muted-foreground w-12 shrink-0">{ddmm(p.data_competencia || p.data_vencimento)}</span>
                            {editId === p.id ? (
                              <div className="flex items-center gap-1 flex-1">
                                <Input value={editVal} onChange={e => setEditVal(e.target.value)} inputMode="decimal" className="h-7 w-24 text-right text-xs" />
                                <Button size="sm" className="h-7 px-2" onClick={() => salvarEdicao(p)}><Check className="w-3 h-3" /></Button>
                                <button onClick={() => setEditId(null)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
                              </div>
                            ) : (
                              <>
                                <span className="flex-1 tabular-nums font-medium">{fmtBRL(p.valor)}</span>
                                {podeInserir && <>
                                  <button onClick={() => { setEditId(p.id); setEditVal(String(p.valor).replace('.', ',')); }} title="Editar valor" className="text-muted-foreground hover:text-indigo-600 shrink-0"><Pencil className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => excluir(p)} title="Remover diária" className="text-muted-foreground hover:text-red-600 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                                </>}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Adicionar diárias */}
          {podeInserir && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Dia trabalhado:</span>
                <Input type="date" value={dia} min={semana.monISO} max={semana.sunISO} onChange={e => setDia(e.target.value)} className="h-8 w-40" />
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar freela por nome ou função..." className="h-9 pl-8" />
              </div>
              <div className="space-y-1.5">
                {rosterVisivel.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhum freela {busca ? `para "${busca}"` : 'cadastrado'}.</CardContent></Card>
                ) : rosterVisivel.map(f => {
                  const s = sel[f.id];
                  return (
                    <div key={f.id} className={`flex items-center gap-3 rounded-lg border p-2.5 ${s?.on ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-900/10' : 'border-[hsl(var(--border))]'}`}>
                      <input type="checkbox" checked={!!s?.on} onChange={() => toggle(f)} className="accent-emerald-600 w-4 h-4" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-sm">{f.nome}</div>
                        <div className="text-xs text-muted-foreground truncate">{f.funcao || '—'}{f.chave_pix ? ` · PIX ${f.chave_pix}` : ' · sem PIX'}{!f.contaazul_pessoa_id && <span className="text-amber-600"> · sem fornecedor no CA (financeiro vincula)</span>}</div>
                      </div>
                      <div className="w-28 shrink-0">
                        <Input value={s?.valor ?? ''} onChange={e => setValor(f.id, e.target.value)} placeholder={f.valor_padrao ? String(f.valor_padrao).replace('.', ',') : 'valor'} inputMode="decimal" className="h-8 text-right" disabled={!s?.on} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {selecionados.length > 0 && (
                <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-lg border bg-card shadow-lg p-3">
                  <div className="text-sm"><b>{selecionados.length}</b> freela(s) · dia {ddmm(dia)} · total <b>{fmtBRL(totalNovo)}</b></div>
                  <Button onClick={lancar} disabled={lancando}>
                    {lancando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Lançando...</> : <><Plus className="w-4 h-4 mr-2" />Adicionar ao rascunho</>}
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </PageShell>
  );
}
