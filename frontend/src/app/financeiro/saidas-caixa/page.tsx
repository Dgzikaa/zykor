'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Banknote, Loader2, ArrowDownCircle, ArrowUpCircle, ListTree, CalendarDays, Wallet, Filter, Check, Search, Clock, Receipt, X, ChevronsUpDown } from 'lucide-react';

type Saida = { dt_gerencial: string; trn: number; num_lancamento: number | null; motivo: string; valor_saida: number; obs: string | null };
type CatOpt = { id: string; nome: string; macro?: string | null };
type Entrada = { dt_gerencial: string; trn: number; qtd_pagamentos: number; total_liquido: number; total_bruto: number };
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

type ColAlign = 'left' | 'center' | 'right';

// Cabeçalho clicável com popover de checkboxes (valores distintos + contagem), estilo /operacional/insumos.
function ColHeader({ label, align, options, selected, onChange }: {
  label: string; align: ColAlign;
  options: { value: string; count: number }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const active = selected.size > 0;

  const openMenu = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - 268)), top: r.bottom + 4 });
    setQ(''); setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onAway = () => setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('resize', onAway);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('resize', onAway); };
  }, [open]);

  const shown = q ? options.filter((o) => o.value.toLowerCase().includes(q.toLowerCase())) : options;
  const toggle = (v: string) => { const n = new Set(selected); if (n.has(v)) n.delete(v); else n.add(v); onChange(n); };
  const alignCls = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';

  return (
    <>
      <button ref={btnRef} onClick={() => (open ? setOpen(false) : openMenu())}
        className={`inline-flex items-center gap-1 hover:text-foreground ${alignCls} ${active ? 'text-primary' : ''}`}>
        <span>{label}</span>
        <Filter className={`w-3 h-3 ${active ? 'fill-primary text-primary' : 'text-muted-foreground/40'}`} />
        {active && <span className="text-[10px] rounded-full bg-primary/15 text-primary px-1 leading-4">{selected.size}</span>}
      </button>
      {open && pos && typeof document !== 'undefined' && createPortal(
        <div ref={menuRef} style={{ position: 'fixed', left: pos.left, top: pos.top, width: 256 }}
          className="z-[60] rounded-lg border bg-background shadow-xl p-2">
          <Input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar valores…" className="h-8 text-xs" />
          <div className="flex items-center justify-between px-1 py-1.5 text-[11px] text-muted-foreground">
            <button className="hover:text-primary" onClick={() => onChange(new Set(options.map((o) => o.value)))}>Todos</button>
            <span>{selected.size ? `${selected.size} sel.` : `${options.length} valores`}</span>
            <button className="hover:text-red-500" onClick={() => onChange(new Set())}>Limpar</button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {shown.length === 0 ? <div className="px-2 py-3 text-center text-xs text-muted-foreground">Nada</div>
              : shown.map((o) => {
                const on = selected.has(o.value);
                return (
                  <button key={o.value} onClick={() => toggle(o.value)} className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-muted/60 rounded">
                    <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${on ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>{on && <Check className="w-3 h-3" />}</span>
                    <span className="flex-1 truncate">{o.value}</span>
                    <span className="text-muted-foreground tabular-nums">{o.count}</span>
                  </button>
                );
              })}
          </div>
        </div>, document.body)}
    </>
  );
}

// Filtro genérico (busca livre + filtros por coluna) reaproveitado nas abas.
function useTableFilter<T>(rows: T[], colVal: Record<string, (r: T) => string>, searchKeys: (r: T) => string) {
  const [busca, setBusca] = useState('');
  const [colFilter, setColFilter] = useState<Record<string, Set<string>>>({});
  const setCol = useCallback((id: string, next: Set<string>) => {
    setColFilter((prev) => { const n = { ...prev }; if (next.size) n[id] = next; else delete n[id]; return n; });
  }, []);
  const reset = useCallback(() => { setBusca(''); setColFilter({}); }, []);

  const optionsFor = useCallback((colId: string) => {
    const q = busca.trim().toLowerCase();
    const counts = new Map<string, number>();
    for (const r of rows) {
      if (q && !searchKeys(r).toLowerCase().includes(q)) continue;
      let ok = true;
      for (const [id, sel] of Object.entries(colFilter)) {
        if (id === colId) continue;
        if (!sel.has(colVal[id](r))) { ok = false; break; }
      }
      if (!ok) continue;
      const v = colVal[colId](r);
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, 'pt-BR', { numeric: true }));
  }, [rows, busca, colFilter, colVal, searchKeys]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !searchKeys(r).toLowerCase().includes(q)) return false;
      for (const [id, sel] of Object.entries(colFilter)) if (!sel.has(colVal[id](r))) return false;
      return true;
    });
  }, [rows, busca, colFilter, colVal, searchKeys]);

  const filtrando = busca.trim() !== '' || Object.keys(colFilter).length > 0;
  return { busca, setBusca, colFilter, setCol, reset, optionsFor, filtered, filtrando };
}

// Combobox digitável de categorias (despesa) do Conta Azul.
function CategoriaCombo({ options, value, onChange }: { options: CatOpt[]; value: CatOpt | null; onChange: (c: CatOpt) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  const shown = q ? options.filter((o) => o.nome.toLowerCase().includes(q.toLowerCase())) : options;
  return (
    <div ref={boxRef} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 rounded-md border bg-background px-3 h-9 text-sm text-left">
        <span className={value ? '' : 'text-muted-foreground'}>{value ? value.nome : 'Escolher categoria…'}</span>
        <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-background shadow-xl p-2">
          <Input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar categoria…" className="h-8 text-xs" />
          <div className="max-h-56 overflow-y-auto mt-1">
            {shown.length === 0 ? <div className="px-2 py-3 text-center text-xs text-muted-foreground">Nada</div>
              : shown.map((o) => (
                <button key={o.id} type="button" onClick={() => { onChange(o); setOpen(false); setQ(''); }}
                  className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 text-left text-xs rounded hover:bg-muted/60 ${value?.id === o.id ? 'bg-muted/40' : ''}`}>
                  <span className="truncate">{o.nome}</span>
                  {o.macro && <span className="text-[10px] text-muted-foreground shrink-0">{o.macro}</span>}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LancarSaidaModal({ saida, barId, catOpts, conta, onClose, onDone }: {
  saida: Saida; barId: number; catOpts: CatOpt[]; conta: { id: string; nome: string } | null;
  onClose: () => void; onDone: (baixado: boolean) => void;
}) {
  const { showToast } = useToast();
  const [descricao, setDescricao] = useState(saida.motivo || '');
  const [categoria, setCategoria] = useState<CatOpt | null>(null);
  const [lancando, setLancando] = useState(false);

  const submit = async () => {
    if (!categoria) { showToast({ type: 'error', title: 'Escolha a categoria' }); return; }
    const v = Number(saida.valor_saida) || 0;
    if (!(v > 0)) { showToast({ type: 'error', title: 'Valor inválido' }); return; }
    setLancando(true);
    try {
      const r = await api.post('/api/financeiro/saidas-caixa/lancar', {
        bar_id: barId, trn: saida.trn, num_lancamento: saida.num_lancamento,
        dt_gerencial: saida.dt_gerencial, data_competencia: saida.dt_gerencial, data_vencimento: saida.dt_gerencial,
        descricao, valor: v, categoria_id: categoria.id,
      });
      if (r?.ok || r?.skipped) {
        showToast({ type: 'success', title: r?.skipped ? 'Já estava lançado' : 'Lançado no Conta Azul', message: r?.baixado === false ? 'Criado, mas a baixa falhou — confira no CA.' : undefined });
        onDone(!!r?.baixado);
      } else {
        showToast({ type: 'error', title: 'Falha ao lançar', message: r?.erro || r?.error || 'Erro' });
      }
    } catch (e: any) {
      showToast({ type: 'error', title: 'Falha ao lançar', message: e?.message });
    } finally { setLancando(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div className="w-full max-w-md rounded-xl border bg-background shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2"><Receipt className="h-4 w-4 text-primary" /><h3 className="font-semibold">Lançar saída no Conta Azul</h3></div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <div className="text-xs text-muted-foreground">Turno #{saida.trn} · {fmtData(saida.dt_gerencial)} · conta a pagar (baixa imediata)</div>
          <div>
            <label className="text-xs text-muted-foreground">Descrição</label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} className="h-9 mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Valor</label>
              <div className="mt-1 h-9 flex items-center justify-end rounded-md border bg-muted/40 px-3 font-semibold tabular-nums">{fmtBRL(saida.valor_saida)}</div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Categoria (despesa)</label>
              <div className="mt-1"><CategoriaCombo options={catOpts} value={categoria} onChange={setCategoria} /></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Competência</label>
              <div className="mt-1 h-9 flex items-center rounded-md border bg-muted/40 px-3 text-muted-foreground">{fmtData(saida.dt_gerencial)}</div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Vencimento</label>
              <div className="mt-1 h-9 flex items-center rounded-md border bg-muted/40 px-3 text-muted-foreground">{fmtData(saida.dt_gerencial)}</div>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Conta</label>
            <div className="mt-1 h-9 flex items-center rounded-md border bg-muted/40 px-3 text-muted-foreground">{conta?.nome || 'Caixa Dinheiro'}</div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button onClick={onClose} className="rounded-md border px-3 h-9 text-sm hover:bg-muted/60">Cancelar</button>
          <button onClick={submit} disabled={lancando || !categoria}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-9 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {lancando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />} Lançar
          </button>
        </div>
      </div>
    </div>
  );
}

export function FluxoContaHub({ only }: { only?: 'entradas' | 'saidas' | 'turnos' }) {
  const { selectedBar } = useBar();
  const { showToast } = useToast();

  const [aba, setAba] = useState<'entradas' | 'saidas' | 'turnos'>(only ?? 'entradas');
  const [meses, setMeses] = useState<string[]>([]);
  const [mesSel, setMesSel] = useState<string>('');
  const [saidas, setSaidas] = useState<Saida[]>([]);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [resumo, setResumo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Lançar saída no CA
  const [lancados, setLancados] = useState<Record<string, boolean>>({}); // "trn-num" -> baixado
  const [entLanc, setEntLanc] = useState<Record<string, boolean>>({}); // dt_gerencial -> baixado (entradas)
  const [catOpts, setCatOpts] = useState<CatOpt[]>([]);
  const [contaCaixa, setContaCaixa] = useState<{ id: string; nome: string } | null>(null);
  const [modal, setModal] = useState<Saida | null>(null);
  const lancKey = (trn: number, num: number | null) => `${trn}-${num}`;

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
      setEntradas(r.entradas || []);
      setTurnos(r.turnos || []);
      setResumo(r.resumo || null);
      const lm: Record<string, boolean> = {};
      for (const l of (r.lancados || [])) lm[lancKey(l.trn, l.num_lancamento)] = !!l.baixado;
      setLancados(lm);
      const em: Record<string, boolean> = {};
      for (const l of (r.entradas_lancadas || [])) em[l.dt_gerencial] = !!l.baixado;
      setEntLanc(em);
      if ((r.meses_disponiveis || []).length) {
        setMeses(r.meses_disponiveis);
        if (!mesSel) setMesSel(r.meses_disponiveis[0]);
      }
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar fluxo de dinheiro', message: e?.message });
    } finally {
      setLoading(false);
    }
  }, [selectedBar?.id, periodo, mesSel, showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  // categorias (despesa) + conta Caixa Dinheiro pro modal de lançamento
  useEffect(() => {
    if (!selectedBar?.id) return;
    (async () => {
      try {
        const r = await api.get(`/api/financeiro/saidas-caixa/lancar?bar_id=${selectedBar.id}`);
        setCatOpts(r?.categorias || []);
        setContaCaixa(r?.conta || null);
      } catch { /* silencioso — o modal avisa se faltar */ }
    })();
  }, [selectedBar?.id]);

  // Filtros por aba
  const fSaidas = useTableFilter<Saida>(
    saidas,
    { dia: (s) => fmtData(s.dt_gerencial), turno: (s) => `#${s.trn}`, motivo: (s) => s.motivo || '—' },
    (s) => `${s.motivo || ''} #${s.trn}`,
  );
  const fEntradas = useTableFilter<Entrada>(
    entradas,
    { dia: (e) => fmtData(e.dt_gerencial), turno: (e) => `#${e.trn}` },
    (e) => `#${e.trn} ${fmtData(e.dt_gerencial)}`,
  );
  useEffect(() => { fSaidas.reset(); fEntradas.reset(); }, [mesSel]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalSaidasFiltrado = useMemo(() => fSaidas.filtered.reduce((s, r) => s + Number(r.valor_saida || 0), 0), [fSaidas.filtered]);
  const totalEntradasFiltrado = useMemo(() => fEntradas.filtered.reduce((s, r) => s + Number(r.total_liquido || 0), 0), [fEntradas.filtered]);

  const ticketSaida = resumo?.qtd_saidas ? Number(resumo.total_saidas) / Number(resumo.qtd_saidas) : 0;
  const mediaEntradaDia = resumo?.dias_entrada ? Number(resumo.total_entradas) / Number(resumo.dias_entrada) : 0;

  return (
    <div className="p-4 md:p-6 mx-auto space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {only ? <div /> : (
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5"><Banknote className="h-6 w-6 text-primary" /></div>
            <div>
              <h1 className="text-xl font-semibold">Fluxo Dinheiro</h1>
              <p className="text-sm text-muted-foreground">Entradas e saídas de dinheiro do caixa por turno — ContaHub.</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          {aba === 'entradas' && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={fEntradas.busca} onChange={(e) => fEntradas.setBusca(e.target.value)} placeholder="Buscar dia/turno…" className="h-9 w-52 pl-8 text-sm" />
            </div>
          )}
          {aba === 'saidas' && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={fSaidas.busca} onChange={(e) => fSaidas.setBusca(e.target.value)} placeholder="Buscar motivo/turno…" className="h-9 w-52 pl-8 text-sm" />
            </div>
          )}
          <select value={mesSel} onChange={(e) => setMesSel(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
            {meses.length === 0 && <option value="">—</option>}
            {meses.map((m) => <option key={m} value={m}>{labelMes(m)}</option>)}
          </select>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* Cards resumo (do mês) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5"><ArrowUpCircle className="h-3.5 w-3.5 text-emerald-500" /> Entradas (dinheiro)</div>
            <div className="text-2xl font-semibold mt-1 text-emerald-600 dark:text-emerald-400">{fmtBRL(resumo?.total_entradas)}</div>
            <div className="text-xs text-muted-foreground mt-1">{fmtNum(resumo?.dias_entrada)} dias · média {fmtBRL(mediaEntradaDia)}/dia</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5"><ArrowDownCircle className="h-3.5 w-3.5 text-red-500" /> Saídas (sangria)</div>
            <div className="text-2xl font-semibold mt-1 text-red-600 dark:text-red-400">{fmtBRL(resumo?.total_saidas)}</div>
            <div className="text-xs text-muted-foreground mt-1">{fmtNum(resumo?.qtd_saidas)} retiradas · {fmtNum(resumo?.dias)} dias</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Líquido do mês</div>
            <div className="text-2xl font-semibold mt-1">{fmtBRL(Number(resumo?.total_entradas || 0) - Number(resumo?.total_saidas || 0))}</div>
            <div className="text-xs text-muted-foreground mt-1">entradas − saídas</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5"><ListTree className="h-3.5 w-3.5" /> Ticket saída</div>
            <div className="text-2xl font-semibold mt-1">{fmtBRL(ticketSaida)}</div>
            <div className="text-xs text-muted-foreground mt-1">por retirada</div>
          </CardContent>
        </Card>
      </div>

      {/* Abas (ocultas quando embutido numa única aba de Receitas/Despesas) */}
      {!only && (
        <div className="flex gap-1 border-b">
          {([['entradas', 'Entradas de Caixa', ArrowUpCircle], ['saidas', 'Saídas de Caixa', ArrowDownCircle], ['turnos', 'Por turno', ListTree]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${aba === id ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      )}

      {aba === 'entradas' && (
        <>
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
            <Clock className="h-4 w-4 mt-0.5 shrink-0" />
            <span>O dinheiro recebido é lançado como <b>conta a receber</b> no Conta Azul automaticamente (categoria <b>Dinheiro</b>, conta <b>Caixa Dinheiro</b>) — soma do dia, todo dia às 12h.</span>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left font-medium px-4 py-2.5"><ColHeader label="Dia" align="left" options={fEntradas.optionsFor('dia')} selected={fEntradas.colFilter.dia || new Set()} onChange={(n) => fEntradas.setCol('dia', n)} /></th>
                      <th className="text-left font-medium px-4 py-2.5"><ColHeader label="Turno" align="left" options={fEntradas.optionsFor('turno')} selected={fEntradas.colFilter.turno || new Set()} onChange={(n) => fEntradas.setCol('turno', n)} /></th>
                      <th className="text-right font-medium px-4 py-2.5">Pgtos</th>
                      <th className="text-right font-medium px-4 py-2.5">Dinheiro recebido</th>
                      <th className="text-center font-medium px-4 py-2.5">CA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fEntradas.filtered.map((e, i) => (
                      <tr key={`${e.trn}-${e.dt_gerencial}-${i}`} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span className="font-medium">{fmtData(e.dt_gerencial)}</span>
                          <span className="text-xs text-muted-foreground ml-1.5">{dow(e.dt_gerencial)}</span>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground tabular-nums">#{e.trn}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{fmtNum(e.qtd_pagamentos)}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{fmtBRL(e.total_liquido)}</td>
                        <td className="px-4 py-2 text-center">
                          {e.dt_gerencial in entLanc ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400" title="Lançado no Conta Azul"><Check className="h-3.5 w-3.5" /> lançado</span>
                          ) : (
                            <span className="text-xs text-muted-foreground" title="Será lançado automaticamente (cron 12h)">pendente</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!loading && fEntradas.filtered.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">{fEntradas.filtrando ? 'Nenhuma entrada com esses filtros.' : 'Nenhuma entrada de dinheiro no período.'}</td></tr>
                    )}
                  </tbody>
                  {fEntradas.filtered.length > 0 && (
                    <tfoot>
                      <tr className="border-t bg-muted/20 font-semibold">
                        <td className="px-4 py-2.5" colSpan={3}>{fEntradas.filtrando ? `Filtrado (${fmtNum(fEntradas.filtered.length)})` : `Total (${fmtNum(fEntradas.filtered.length)})`}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{fmtBRL(totalEntradasFiltrado)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {aba === 'saidas' && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left font-medium px-4 py-2.5"><ColHeader label="Dia" align="left" options={fSaidas.optionsFor('dia')} selected={fSaidas.colFilter.dia || new Set()} onChange={(n) => fSaidas.setCol('dia', n)} /></th>
                    <th className="text-left font-medium px-4 py-2.5"><ColHeader label="Turno" align="left" options={fSaidas.optionsFor('turno')} selected={fSaidas.colFilter.turno || new Set()} onChange={(n) => fSaidas.setCol('turno', n)} /></th>
                    <th className="text-left font-medium px-4 py-2.5"><ColHeader label="Motivo" align="left" options={fSaidas.optionsFor('motivo')} selected={fSaidas.colFilter.motivo || new Set()} onChange={(n) => fSaidas.setCol('motivo', n)} /></th>
                    <th className="text-right font-medium px-4 py-2.5">Valor</th>
                    <th className="text-center font-medium px-4 py-2.5">CA</th>
                  </tr>
                </thead>
                <tbody>
                  {fSaidas.filtered.map((s, i) => (
                    <tr key={`${s.trn}-${s.num_lancamento}-${i}`} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className="font-medium">{fmtData(s.dt_gerencial)}</span>
                        <span className="text-xs text-muted-foreground ml-1.5">{dow(s.dt_gerencial)}</span>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground tabular-nums">#{s.trn}</td>
                      <td className="px-4 py-2">{s.motivo || <span className="text-muted-foreground/40">—</span>}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold text-red-600 dark:text-red-400">{fmtBRL(s.valor_saida)}</td>
                      <td className="px-4 py-2 text-center">
                        {lancados[lancKey(s.trn, s.num_lancamento)] !== undefined ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400" title="Já lançado no Conta Azul"><Check className="h-3.5 w-3.5" /> lançado</span>
                        ) : (
                          <button onClick={() => setModal(s)} title="Lançar no Conta Azul (contas a pagar)"
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted/60">
                            <Receipt className="h-3.5 w-3.5" /> Lançar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!loading && fSaidas.filtered.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">{fSaidas.filtrando ? 'Nenhuma saída com esses filtros.' : 'Nenhuma saída de caixa no período.'}</td></tr>
                  )}
                </tbody>
                {fSaidas.filtered.length > 0 && (
                  <tfoot>
                    <tr className="border-t bg-muted/20 font-semibold">
                      <td className="px-4 py-2.5" colSpan={3}>{fSaidas.filtrando ? `Filtrado (${fmtNum(fSaidas.filtered.length)})` : `Total (${fmtNum(fSaidas.filtered.length)})`}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-red-600 dark:text-red-400">{fmtBRL(totalSaidasFiltrado)}</td>
                      <td />
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
        Fonte: ContaHub. <b>Entradas</b> = pagamentos recebidos em dinheiro (por turno). <b>Saídas</b> = seção &quot;Lançamentos do CAIXA&quot;
        do relatório de turno (retirada p/ cofre/escritório, diferença de caixa etc.).
      </p>

      {modal && selectedBar?.id && (
        <LancarSaidaModal
          saida={modal}
          barId={selectedBar.id}
          catOpts={catOpts}
          conta={contaCaixa}
          onClose={() => setModal(null)}
          onDone={(baixado) => { setLancados((m) => ({ ...m, [lancKey(modal.trn, modal.num_lancamento)]: baixado })); setModal(null); }}
        />
      )}
    </div>
  );
}

export default function FluxoDinheiroPage() {
  return (
    <ProtectedRoute>
      <FluxoContaHub />
    </ProtectedRoute>
  );
}
