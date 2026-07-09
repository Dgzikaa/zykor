'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { DateInputBR } from '@/components/ui/date-input-br';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Loader2, Upload, Send, EyeOff, RotateCcw, CheckCircle2, Plus, CreditCard, Lock, Archive } from 'lucide-react';

interface Cartao { id: string; banco: string; tipo: string; dono: string }
interface Fatura {
  id: string; bar_id: number; vencimento: string; valor_informado: number | null;
  status: string; cartao?: Cartao;
  totais?: { total: number; lancado: number; novos: number };
}
interface Linha {
  id: string; banco: string; data_transacao: string; descricao: string; valor: number;
  tipo: 'compra' | 'pagamento' | 'estorno'; parcela: string | null; cartao_final: string | null;
  titular_nome: string | null; bar_id: number | null; categoria_id: string | null;
  categoria_nome: string | null; contaazul_lancamento_id: string | null; status: 'novo' | 'lancado' | 'ignorado';
}
interface Opcao { value: string; label: string }
interface OpcoesBar { categorias: Opcao[]; fornecedores: Opcao[]; contas: Opcao[] }

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtDataBR = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || '—'); };
const BANCO_LABEL: Record<string, string> = { itau: 'Itaú', nubank: 'Nubank' };
const bancoNome = (b?: string) => BANCO_LABEL[b || ''] || (b ? b[0].toUpperCase() + b.slice(1) : '');
const cartaoNome = (c?: Cartao) => (c ? `${bancoNome(c.banco)} ${c.tipo} ${c.dono}` : 'Cartão');

export function FaturaCartaoTab() {
  const { showToast } = useToast();
  const { availableBars, selectedBar } = useBar();

  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [encerradas, setEncerradas] = useState<Fatura[]>([]);
  const [verEncerradas, setVerEncerradas] = useState(false);
  const [faturaSelId, setFaturaSelId] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [lancandoId, setLancandoId] = useState<string | null>(null);
  const [encerrando, setEncerrando] = useState(false);

  const [opcoesBar, setOpcoesBar] = useState<Record<number, OpcoesBar>>({});
  const [config, setConfig] = useState<Record<number, { fornecedorId: string; contaId: string }>>({});

  // Filtros dentro da fatura
  const [fCartaoNum, setFCartaoNum] = useState('');
  const [fBusca, setFBusca] = useState('');
  const [soCompras, setSoCompras] = useState(true);
  const [esconderLancados, setEsconderLancados] = useState(false);

  // Modais
  const [novaOpen, setNovaOpen] = useState(false);
  const [cartoesOpen, setCartoesOpen] = useState(false);

  const faturaSel = useMemo(() => [...faturas, ...encerradas].find(f => f.id === faturaSelId) || null, [faturas, encerradas, faturaSelId]);

  const carregarBase = useCallback(async () => {
    try {
      const [c, f] = await Promise.all([
        api.get('/api/financeiro/cartao-fatura/cartoes'),
        api.get('/api/financeiro/cartao-fatura/faturas?status=aberta'),
      ]);
      setCartoes(c.cartoes || []);
      setFaturas(f.faturas || []);
      setFaturaSelId(prev => prev || (f.faturas?.[0]?.id ?? null));
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar', message: e?.message });
    }
  }, [showToast]);

  const carregarEncerradas = useCallback(async () => {
    try {
      const f = await api.get('/api/financeiro/cartao-fatura/faturas?status=encerrada');
      setEncerradas(f.faturas || []);
    } catch { /* ok */ }
  }, []);

  const carregarLinhas = useCallback(async (fid: string) => {
    setCarregando(true);
    try {
      const res = await api.get(`/api/financeiro/cartao-fatura/faturas/${fid}`);
      setLinhas(res.linhas || []);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar linhas', message: e?.message });
    } finally {
      setCarregando(false);
    }
  }, [showToast]);

  const carregarOpcoesBar = useCallback(async (barId: number) => {
    const j = (p: Promise<Response>) => p.then(r => r.json()).catch(() => ({}));
    const [cat, fo, ct] = await Promise.all([
      j(fetch(`/api/financeiro/contaazul/categorias?bar_id=${barId}`)),
      j(fetch(`/api/financeiro/contaazul/stakeholders?bar_id=${barId}&perfil=FORNECEDOR`)),
      j(fetch(`/api/financeiro/contaazul/contas-financeiras?bar_id=${barId}&somente_pagadoras=true`)),
    ]);
    const contasRaw = (ct.contas_financeiras || []).filter((c: any) => c.ativo !== false);
    const fornecedoresRaw = (fo.pessoas || []);
    setOpcoesBar(prev => ({
      ...prev,
      [barId]: {
        categorias: (cat.categorias || []).filter((c: any) => c.ativo !== false).map((c: any) => ({ value: c.contaazul_id, label: c.nome || c.categoria_nome })),
        fornecedores: fornecedoresRaw.map((p: any) => ({ value: p.contaazul_id, label: p.nome })),
        contas: contasRaw.map((c: any) => ({ value: String(c.contaazul_id), label: c.banco ? `${c.nome} (${c.banco})` : c.nome })),
      },
    }));
    const padrao = contasRaw.find((c: any) => c.pagadora_padrao);
    const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const fornAuto = fornecedoresRaw.find((p: any) => /cartao|credito/.test(norm(p.nome)))?.contaazul_id || '';
    setConfig(prev => {
      const cur = prev[barId] || { fornecedorId: '', contaId: '' };
      return { ...prev, [barId]: { fornecedorId: cur.fornecedorId || fornAuto, contaId: cur.contaId || (padrao ? String(padrao.contaazul_id) : '') } };
    });
  }, []);

  useEffect(() => { carregarBase(); }, [carregarBase]);
  useEffect(() => { availableBars.forEach(b => carregarOpcoesBar(b.id)); }, [availableBars, carregarOpcoesBar]);
  useEffect(() => { if (faturaSelId) carregarLinhas(faturaSelId); else setLinhas([]); }, [faturaSelId, carregarLinhas]);
  useEffect(() => { if (verEncerradas) carregarEncerradas(); }, [verEncerradas, carregarEncerradas]);

  const importar = async (file: File) => {
    if (!faturaSelId) return;
    setLendo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('fatura_id', faturaSelId);
      const barId = localStorage.getItem('sgb_selected_bar_id');
      const res = await fetch('/api/financeiro/cartao-fatura/importar', { method: 'POST', headers: barId ? { 'x-selected-bar-id': barId } : {}, body: fd });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'falha ao importar');
      setLinhas(json.linhas || []);
      showToast({ type: 'success', title: `${BANCO_LABEL[json.banco] || json.banco} · ${json.importadas} linhas`, message: `${json.novos} novas, ${json.ja_vistos} já na fatura.` });
      carregarBase();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao importar', message: e?.message });
    } finally {
      setLendo(false);
    }
  };

  const patchLinha = async (l: Linha, updates: Partial<Linha>) => {
    setLinhas(prev => prev.map(x => (x.id === l.id ? { ...x, ...updates } : x)));
    try { await api.patch(`/api/financeiro/cartao-fatura/${l.id}`, updates); }
    catch (e: any) { showToast({ type: 'error', title: 'Erro ao salvar', message: e?.message }); if (faturaSelId) carregarLinhas(faturaSelId); }
  };

  const lancar = async (l: Linha) => {
    const bar = l.bar_id || faturaSel?.bar_id || selectedBar?.id || null;
    if (!bar) return showToast({ type: 'error', title: 'Escolha o bar da linha' });
    if (!l.categoria_id) return showToast({ type: 'error', title: 'Escolha a categoria' });
    const cfg = config[bar];
    setLancandoId(l.id);
    try {
      const res = await api.post(`/api/financeiro/cartao-fatura/${l.id}/lancar`, {
        bar_id: bar, categoria_id: l.categoria_id, categoria_nome: l.categoria_nome,
        pessoa_id: cfg?.fornecedorId || undefined, conta_financeira_id: cfg?.contaId || undefined,
        data_vencimento: faturaSel?.vencimento || undefined,
      });
      setLinhas(prev => prev.map(x => (x.id === l.id ? res.linha : x)));
      showToast({ type: 'success', title: 'Lançado no Conta Azul' });
      carregarBase();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Falha ao lançar', message: e?.message });
    } finally {
      setLancandoId(null);
    }
  };

  const encerrarFatura = async () => {
    if (!faturaSel) return;
    const naoLancados = linhas.filter(l => l.tipo === 'compra' && l.status === 'novo').length;
    const msg = naoLancados > 0
      ? `Ainda há ${naoLancados} compra(s) sem lançar. Encerrar mesmo assim?`
      : 'Encerrar esta fatura? Ela sai das faturas abertas.';
    if (!window.confirm(msg)) return;
    setEncerrando(true);
    try {
      await api.patch(`/api/financeiro/cartao-fatura/faturas/${faturaSel.id}`, { status: 'encerrada' });
      showToast({ type: 'success', title: 'Fatura encerrada' });
      setFaturaSelId(null);
      await carregarBase();
      if (verEncerradas) carregarEncerradas();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao encerrar', message: e?.message });
    } finally {
      setEncerrando(false);
    }
  };

  const reabrir = async (f: Fatura) => {
    try {
      await api.patch(`/api/financeiro/cartao-fatura/faturas/${f.id}`, { status: 'aberta' });
      showToast({ type: 'success', title: 'Fatura reaberta' });
      await carregarBase(); carregarEncerradas(); setFaturaSelId(f.id);
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao reabrir', message: e?.message }); }
  };

  const cartoesNoFiltro = useMemo(() => Array.from(new Set(linhas.map(l => l.cartao_final).filter(Boolean))) as string[], [linhas]);
  const filtradas = useMemo(() => linhas.filter(l => {
    if (soCompras && l.tipo !== 'compra') return false;
    if (esconderLancados && l.status === 'lancado') return false;
    if (fCartaoNum && l.cartao_final !== fCartaoNum) return false;
    if (fBusca && !l.descricao.toLowerCase().includes(fBusca.toLowerCase())) return false;
    return true;
  }), [linhas, soCompras, esconderLancados, fCartaoNum, fBusca]);
  const totalCompras = useMemo(() => linhas.filter(l => l.tipo === 'compra').reduce((s, l) => s + l.valor, 0), [linhas]);
  const totalLancado = useMemo(() => linhas.filter(l => l.tipo === 'compra' && l.status === 'lancado').reduce((s, l) => s + l.valor, 0), [linhas]);
  const pendentes = useMemo(() => linhas.filter(l => l.tipo === 'compra' && l.status === 'novo').length, [linhas]);

  const editavelFatura = faturaSel?.status === 'aberta';

  return (
    <div className="space-y-3">
      {/* Abas de faturas abertas + ações */}
      <div className="flex items-center gap-2 flex-wrap">
        {faturas.map(f => (
          <button key={f.id} onClick={() => setFaturaSelId(f.id)}
            className={`rounded-lg border px-3 py-1.5 text-left text-xs transition ${faturaSelId === f.id ? 'border-blue-500 bg-blue-500/10' : 'border-[hsl(var(--border))] hover:bg-muted/40'}`}>
            <div className="font-medium flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" />{cartaoNome(f.cartao)}</div>
            <div className="text-muted-foreground">vence {fmtDataBR(f.vencimento)} · {fmtBRL(f.totais?.total || 0)}{f.totais?.novos ? ` · ${f.totais.novos} a lançar` : ''}</div>
          </button>
        ))}
        <Button size="sm" onClick={() => setNovaOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />Nova fatura
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setCartoesOpen(true)}><CreditCard className="w-4 h-4 mr-1" />Cartões</Button>
        <Button size="sm" variant={verEncerradas ? 'default' : 'ghost'} onClick={() => setVerEncerradas(v => !v)}><Archive className="w-4 h-4 mr-1" />Encerradas</Button>
      </div>

      {/* Faturas encerradas */}
      {verEncerradas && (
        <Card><CardContent className="py-2">
          <p className="text-xs font-medium mb-1.5">Faturas encerradas</p>
          {encerradas.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma.</p> : (
            <div className="space-y-1">
              {encerradas.map(f => (
                <div key={f.id} className="flex items-center justify-between text-xs gap-2">
                  <span className="truncate">{cartaoNome(f.cartao)} · vence {fmtDataBR(f.vencimento)} · {fmtBRL(f.totais?.total || 0)}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button className="text-blue-600 hover:underline" onClick={() => { setFaturaSelId(f.id); }}>ver</button>
                    <button className="text-muted-foreground hover:underline" onClick={() => reabrir(f)}>reabrir</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent></Card>
      )}

      {!faturaSel ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">
          {faturas.length === 0 ? 'Crie uma fatura pra começar (+ Nova fatura).' : 'Selecione uma fatura acima.'}
        </CardContent></Card>
      ) : (
        <>
          {/* Cabeçalho da fatura + total + encerrar + upload */}
          <Card><CardContent className="py-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <div className="font-semibold flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4" />{cartaoNome(faturaSel.cartao)}
                  {faturaSel.status === 'encerrada' && <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5"><Lock className="w-3 h-3" />encerrada</span>}
                </div>
                <div className="text-xs text-muted-foreground">Vencimento {fmtDataBR(faturaSel.vencimento)}</div>
              </div>
              <div className="text-right text-sm">
                <div>Total: <b className="tabular-nums">{fmtBRL(totalCompras)}</b> · lançado {fmtBRL(totalLancado)}</div>
                {faturaSel.valor_informado != null && (
                  <div className={`text-xs ${Math.abs(totalCompras - faturaSel.valor_informado) < 0.01 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    banco: {fmtBRL(faturaSel.valor_informado)} {Math.abs(totalCompras - faturaSel.valor_informado) < 0.01 ? '✓ bate' : `· dif ${fmtBRL(totalCompras - faturaSel.valor_informado)}`}
                  </div>
                )}
              </div>
            </div>
            {editavelFatura && (
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-stretch">
                <label className="flex items-center justify-center gap-2 cursor-pointer rounded-lg border-2 border-dashed border-[hsl(var(--border))] py-3 hover:bg-muted/40 text-sm">
                  {lendo ? <><Loader2 className="w-4 h-4 animate-spin text-blue-500" />Lendo…</> : <><Upload className="w-4 h-4 text-muted-foreground" />Importar Excel/OFX/CSV nesta fatura</>}
                  <input type="file" accept=".xls,.xlsx,.csv,.ofx" className="hidden" disabled={lendo}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.currentTarget.value = ''; }} />
                </label>
                <Button variant="outline" onClick={encerrarFatura} disabled={encerrando}>
                  {encerrando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}Encerrar fatura
                </Button>
              </div>
            )}
          </CardContent></Card>

          {/* Filtros dentro da fatura */}
          <div className="flex items-center gap-2 flex-wrap text-sm">
            {cartoesNoFiltro.length > 1 && (
              <select value={fCartaoNum} onChange={(e) => setFCartaoNum(e.target.value)} className="h-8 text-xs border rounded px-1.5 bg-background">
                <option value="">Todos os cartões</option>
                {cartoesNoFiltro.map(c => <option key={c} value={c}>final {c}</option>)}
              </select>
            )}
            <Input value={fBusca} onChange={(e) => setFBusca(e.target.value)} placeholder="Buscar estabelecimento…" className="h-8 w-48 text-xs" />
            <Button size="sm" variant={soCompras ? 'default' : 'ghost'} onClick={() => setSoCompras(s => !s)}>Só compras</Button>
            <Button size="sm" variant={esconderLancados ? 'default' : 'ghost'} onClick={() => setEsconderLancados(s => !s)}>Esconder lançados</Button>
            <span className="ml-auto text-xs text-muted-foreground">{filtradas.length} linhas · {pendentes} a lançar</span>
          </div>

          {/* Tabela */}
          {carregando ? (
            <div className="py-10 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-muted-foreground" /></div>
          ) : filtradas.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhuma linha. Importe o Excel/OFX da fatura acima.</CardContent></Card>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b bg-muted/30">
                  <tr>
                    <th className="text-left py-2 px-2">Data</th>
                    <th className="text-left px-2">Estabelecimento</th>
                    <th className="text-left px-2">Titular</th>
                    <th className="text-left px-2">Cartão</th>
                    <th className="text-right px-2">Valor</th>
                    <th className="text-left px-2 w-32">Bar</th>
                    <th className="text-left px-2 w-48">Categoria</th>
                    <th className="text-right px-2">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map(l => {
                    const barEfetivo = l.bar_id ?? faturaSel.bar_id ?? selectedBar?.id ?? null;
                    const ops = barEfetivo ? opcoesBar[barEfetivo] : undefined;
                    const lancado = l.status === 'lancado';
                    const ignorado = l.status === 'ignorado';
                    return (
                      <tr key={l.id} className={`border-b last:border-0 ${ignorado ? 'opacity-40' : ''} ${lancado ? 'bg-green-500/5' : ''}`}>
                        <td className="py-1.5 px-2 whitespace-nowrap text-muted-foreground text-xs">{fmtDataBR(l.data_transacao)}</td>
                        <td className="px-2"><div className="truncate max-w-[220px]">{l.descricao}{l.parcela ? <span className="text-muted-foreground text-xs"> · {l.parcela}</span> : ''}</div></td>
                        <td className="px-2 text-xs whitespace-nowrap">{l.titular_nome || '—'}</td>
                        <td className="px-2 text-xs text-muted-foreground whitespace-nowrap">{l.cartao_final ? `••${l.cartao_final}` : '—'}</td>
                        <td className="px-2 text-right whitespace-nowrap font-medium">{fmtBRL(l.valor)}</td>
                        <td className="px-2">
                          <select value={barEfetivo ?? ''} disabled={lancado || !editavelFatura}
                            onChange={(e) => patchLinha(l, { bar_id: e.target.value ? Number(e.target.value) : null, categoria_id: null, categoria_nome: null })}
                            className="h-8 w-full text-xs border rounded px-1 bg-background disabled:opacity-60">
                            <option value="">—</option>
                            {availableBars.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
                          </select>
                        </td>
                        <td className="px-2">
                          <select value={l.categoria_id ?? ''} disabled={lancado || !barEfetivo || !editavelFatura}
                            onChange={(e) => { const id = e.target.value; patchLinha(l, { categoria_id: id || null, categoria_nome: ops?.categorias.find(c => c.value === id)?.label || null }); }}
                            className={`h-8 w-full max-w-[200px] text-xs border rounded px-1 bg-background disabled:opacity-60 ${!l.categoria_id && !lancado && editavelFatura ? 'border-amber-400' : ''}`}>
                            <option value="">{barEfetivo ? '— categoria —' : 'escolha o bar'}</option>
                            {(ops?.categorias || []).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                        </td>
                        <td className="px-2 text-right whitespace-nowrap">
                          {lancado ? (
                            <span className="inline-flex items-center gap-1 text-green-600 text-xs"><CheckCircle2 className="w-3.5 h-3.5" />Lançado</span>
                          ) : editavelFatura ? (
                            <div className="flex items-center gap-1 justify-end">
                              <Button size="sm" className="h-7 px-2" onClick={() => lancar(l)} disabled={lancandoId === l.id}>
                                {lancandoId === l.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3.5 h-3.5 mr-1" />Lançar</>}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" title={ignorado ? 'Reativar' : 'Ignorar'}
                                onClick={() => patchLinha(l, { status: ignorado ? 'novo' : 'ignorado' })}>
                                {ignorado ? <RotateCcw className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                              </Button>
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <NovaFaturaDialog open={novaOpen} onOpenChange={setNovaOpen} cartoes={cartoes}
        onAbrirCartoes={() => { setNovaOpen(false); setCartoesOpen(true); }}
        onCriada={(f) => { setNovaOpen(false); carregarBase().then(() => setFaturaSelId(f.id)); }} />
      <CartoesDialog open={cartoesOpen} onOpenChange={setCartoesOpen} cartoes={cartoes} onMudou={carregarBase} />
    </div>
  );
}

// ---------- Modal: nova fatura ----------
function NovaFaturaDialog({ open, onOpenChange, cartoes, onCriada, onAbrirCartoes }: {
  open: boolean; onOpenChange: (v: boolean) => void; cartoes: Cartao[];
  onCriada: (f: Fatura) => void; onAbrirCartoes: () => void;
}) {
  const { showToast } = useToast();
  const [cartaoId, setCartaoId] = useState('');
  const [venc, setVenc] = useState('');
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);

  const criar = async () => {
    if (!cartaoId) return showToast({ type: 'error', title: 'Selecione o cartão' });
    if (!venc) return showToast({ type: 'error', title: 'Informe o vencimento' });
    setSalvando(true);
    try {
      const res = await api.post('/api/financeiro/cartao-fatura/faturas', {
        cartao_id: cartaoId, vencimento: venc,
        valor_informado: valor ? Number(valor.replace(/\./g, '').replace(',', '.')) : undefined,
      });
      showToast({ type: 'success', title: 'Fatura criada' });
      setCartaoId(''); setVenc(''); setValor('');
      onCriada(res.fatura);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao criar', message: e?.message });
    } finally { setSalvando(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nova fatura</DialogTitle>
          <DialogDescription>Uma fatura = cartão + vencimento. Depois você sobe os Excels dela.</DialogDescription>
        </DialogHeader>
        <div className="px-6 space-y-3">
          <div>
            <Label className="mb-1.5 block">Cartão</Label>
            {cartoes.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhum cartão cadastrado. <button className="text-blue-600 hover:underline" onClick={onAbrirCartoes}>Cadastrar cartão</button></div>
            ) : (
              <SearchableSelect value={cartaoId} onValueChange={(v) => setCartaoId(v || '')} placeholder="Selecione o cartão"
                searchPlaceholder="Buscar..." emptyMessage="Nenhum" options={cartoes.map(c => ({ value: c.id, label: cartaoNome(c) }))} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block">Vencimento</Label>
              <DateInputBR value={venc} onChange={setVenc} />
            </div>
            <div>
              <Label className="mb-1.5 block">Valor da fatura <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={criar} disabled={salvando || cartoes.length === 0}>{salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Criar fatura</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Modal: cadastro de cartões ----------
function CartoesDialog({ open, onOpenChange, cartoes, onMudou }: {
  open: boolean; onOpenChange: (v: boolean) => void; cartoes: Cartao[]; onMudou: () => void;
}) {
  const { showToast } = useToast();
  const [banco, setBanco] = useState('itau');
  const [tipo, setTipo] = useState('');
  const [dono, setDono] = useState('');
  const [salvando, setSalvando] = useState(false);

  const add = async () => {
    if (!tipo.trim() || !dono.trim()) return showToast({ type: 'error', title: 'Preencha tipo e dono' });
    setSalvando(true);
    try {
      await api.post('/api/financeiro/cartao-fatura/cartoes', { banco, tipo: tipo.trim(), dono: dono.trim() });
      setTipo(''); setDono('');
      showToast({ type: 'success', title: 'Cartão cadastrado' });
      onMudou();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao cadastrar', message: e?.message });
    } finally { setSalvando(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Cartões</DialogTitle>
          <DialogDescription>Cadastre os cartões (banco + tipo + dono) pra usar nas faturas.</DialogDescription>
        </DialogHeader>
        <div className="px-6 space-y-3">
          <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-end">
            <div>
              <Label className="mb-1 block text-xs">Banco</Label>
              <select value={banco} onChange={(e) => setBanco(e.target.value)} className="h-10 text-sm border rounded px-2 bg-background">
                <option value="itau">Itaú</option>
                <option value="nubank">Nubank</option>
              </select>
            </div>
            <div><Label className="mb-1 block text-xs">Tipo</Label><Input value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="Azul, Latam…" /></div>
            <div><Label className="mb-1 block text-xs">Dono</Label><Input value={dono} onChange={(e) => setDono(e.target.value)} placeholder="Gonza, Cadu…" /></div>
            <Button onClick={add} disabled={salvando} className="h-10">{salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}</Button>
          </div>
          <div className="space-y-1 max-h-52 overflow-y-auto">
            {cartoes.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum cartão ainda.</p> :
              cartoes.map(c => <div key={c.id} className="text-sm flex items-center gap-1.5 py-0.5"><CreditCard className="w-3.5 h-3.5 text-muted-foreground" />{cartaoNome(c)}</div>)}
          </div>
        </div>
        <DialogFooter><Button onClick={() => onOpenChange(false)}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
