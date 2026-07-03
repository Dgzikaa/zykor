'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Banknote, Loader2, ArrowDownCircle, ListTree, CalendarDays, Wallet, Filter, Check, Search } from 'lucide-react';

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

  const [busca, setBusca] = useState('');
  const [colFilter, setColFilter] = useState<Record<string, Set<string>>>({});
  const setCol = useCallback((id: string, next: Set<string>) => {
    setColFilter((prev) => { const n = { ...prev }; if (next.size) n[id] = next; else delete n[id]; return n; });
  }, []);

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
  // troca de mês zera filtros de coluna
  useEffect(() => { setColFilter({}); setBusca(''); }, [mesSel]);

  // valor textual de cada coluna filtrável
  const colVal: Record<string, (s: Saida) => string> = {
    dia: (s) => fmtData(s.dt_gerencial),
    turno: (s) => `#${s.trn}`,
    motivo: (s) => s.motivo || '—',
  };

  // opções (valores distintos + contagem) por coluna, respeitando os outros filtros + busca
  const optionsFor = useCallback((colId: string) => {
    const q = busca.trim().toLowerCase();
    const counts = new Map<string, number>();
    for (const s of saidas) {
      if (q && !(s.motivo || '').toLowerCase().includes(q) && !`#${s.trn}`.includes(q)) continue;
      let ok = true;
      for (const [id, sel] of Object.entries(colFilter)) {
        if (id === colId) continue;
        if (!sel.has(colVal[id](s))) { ok = false; break; }
      }
      if (!ok) continue;
      const v = colVal[colId](s);
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, 'pt-BR', { numeric: true }));
  }, [saidas, busca, colFilter]);

  const saidasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return saidas.filter((s) => {
      if (q && !(s.motivo || '').toLowerCase().includes(q) && !`#${s.trn}`.includes(q)) return false;
      for (const [id, sel] of Object.entries(colFilter)) {
        if (!sel.has(colVal[id](s))) return false;
      }
      return true;
    });
  }, [saidas, busca, colFilter]);

  const totalFiltrado = useMemo(() => saidasFiltradas.reduce((s, r) => s + Number(r.valor_saida || 0), 0), [saidasFiltradas]);
  const filtrando = busca.trim() !== '' || Object.keys(colFilter).length > 0;
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
          {aba === 'saidas' && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar motivo/turno…" className="h-9 w-52 pl-8 text-sm" />
            </div>
          )}
          <select value={mesSel} onChange={(e) => setMesSel(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
            {meses.length === 0 && <option value="">—</option>}
            {meses.map((m) => <option key={m} value={m}>{labelMes(m)}</option>)}
          </select>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* Cards resumo (do mês inteiro) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5"><ArrowDownCircle className="h-3.5 w-3.5" /> Total de saídas</div>
            <div className="text-2xl font-semibold mt-1 text-red-600 dark:text-red-400">{fmtBRL(resumo?.total_saidas)}</div>
            <div className="text-xs text-muted-foreground mt-1">no mês selecionado</div>
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
                    <th className="text-left font-medium px-4 py-2.5"><ColHeader label="Dia" align="left" options={optionsFor('dia')} selected={colFilter.dia || new Set()} onChange={(n) => setCol('dia', n)} /></th>
                    <th className="text-left font-medium px-4 py-2.5"><ColHeader label="Turno" align="left" options={optionsFor('turno')} selected={colFilter.turno || new Set()} onChange={(n) => setCol('turno', n)} /></th>
                    <th className="text-left font-medium px-4 py-2.5"><ColHeader label="Motivo" align="left" options={optionsFor('motivo')} selected={colFilter.motivo || new Set()} onChange={(n) => setCol('motivo', n)} /></th>
                    <th className="text-right font-medium px-4 py-2.5">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {saidasFiltradas.map((s, i) => (
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
                  {!loading && saidasFiltradas.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">{filtrando ? 'Nenhuma saída com esses filtros.' : 'Nenhuma saída de caixa no período.'}</td></tr>
                  )}
                </tbody>
                {saidasFiltradas.length > 0 && (
                  <tfoot>
                    <tr className="border-t bg-muted/20 font-semibold">
                      <td className="px-4 py-2.5" colSpan={3}>{filtrando ? `Filtrado (${fmtNum(saidasFiltradas.length)})` : `Total (${fmtNum(saidasFiltradas.length)})`}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-red-600 dark:text-red-400">{fmtBRL(totalFiltrado)}</td>
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
