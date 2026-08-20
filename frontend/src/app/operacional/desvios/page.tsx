'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageShell } from '@/components/layout/PageShell';
import { OrdemFiltro, cmpNome } from '@/components/filtros/FiltroBarra';
import { useModuloPermissao } from '@/hooks/useModuloPermissao';
import { BadgeSomenteLeitura } from '@/components/permissions/BadgeSomenteLeitura';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Scale, Loader2, Search, CalendarDays, AlertTriangle, TrendingUp, TrendingDown, Boxes, ChefHat, Drumstick, Pencil, Check, X, RefreshCw, Filter, Eye, EyeOff, Download, LineChart } from 'lucide-react';
import { AbaAnalises } from './AbaAnalises';

// célula com lápis (padrão Orçamentação): mostra valor + lápis no hover; clica → input com ✓/✕; salva e recalcula.
// kg/L têm sub-unidade prática (g/ml). O desperdício quase sempre é pequeno (ex.: 32 g),
// então o editor entra em g/ml por padrão e converte pra base (kg/L) ao salvar. Chip de
// unidade sempre visível no editor pra nunca haver ambiguidade (evita digitar 32 = 32 kg).
const SUBUNIT: Record<string, { fator: number; sub: string; base: string }> = {
  kg: { fator: 1000, sub: 'g', base: 'kg' },
  l: { fator: 1000, sub: 'ml', base: 'L' },
  litro: { fator: 1000, sub: 'ml', base: 'L' },
};
// mostra a quantidade na unidade mais legível: kg/L pequenos (|v|<1) viram g/ml
function fmtComUnidade(v: any, unidade?: string | null): string {
  if (v == null || v === '') return '—';
  const n = Number(v);
  const su = SUBUNIT[(unidade || '').toLowerCase()];
  if (su && n !== 0 && Math.abs(n) < 1)
    return `${(n * su.fator).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ${su.sub}`;
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: su ? 3 : 1 })}${unidade ? ' ' + (su ? su.base : unidade) : ''}`;
}

function PencilCell({ value, fmt, onSave, disabled, unidade }: { value: number | null; fmt: (v: any) => string; onSave: (v: number | null) => void; disabled?: boolean; unidade?: string | null }) {
  const su = unidade ? SUBUNIT[unidade.toLowerCase()] : undefined;
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState('');
  const [emSub, setEmSub] = useState(!!su); // kg/L começam em g/ml (o caso comum do desperdício)
  const mostrar = (val: number | null) => val == null || !val ? '—' : (unidade ? fmtComUnidade(val, unidade) : fmt(val));
  if (disabled) return <span className="tabular-nums text-gray-400">{mostrar(value)}</span>;
  const parse = () => (v.trim() === '' ? null : Number(v.replace(',', '.')));
  const commit = () => {
    setEditing(false);
    const raw = parse();
    const n = raw == null ? null : (su && emSub ? raw / su.fator : raw);
    if ((n ?? 0) !== (value ?? 0)) onSave(n);
  };
  const abrir = () => { setV(value == null ? '' : String(su && emSub ? +(value * su.fator).toFixed(3) : value)); setEditing(true); };
  const trocarUnidade = () => {
    if (!su) return;
    const cur = parse(); const novo = !emSub;
    if (cur != null) setV(String(novo ? +(cur * su.fator).toFixed(3) : +(cur / su.fator).toFixed(6)));
    setEmSub(novo);
  };
  if (editing) return (
    <span className="inline-flex items-center gap-0.5 justify-end">
      {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
      <input autoFocus value={v} inputMode="decimal" onChange={e => setV(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        className="w-16 text-right tabular-nums rounded px-1 py-0.5 text-sm border border-indigo-400 ring-1 ring-indigo-300 bg-transparent" />
      {su && <button onClick={trocarUnidade} title="clique pra trocar entre g e kg" className="text-[10px] font-semibold px-1 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/70">{emSub ? su.sub : su.base}</button>}
      <button onClick={commit} className="text-emerald-600 hover:text-emerald-700"><Check className="w-3.5 h-3.5" /></button>
      <button onClick={() => setEditing(false)} className="text-red-500 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
    </span>
  );
  return (
    <span onClick={abrir}
      className="group/cell inline-flex items-center gap-1 justify-end cursor-pointer rounded px-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
      <span className="tabular-nums">{value ? mostrar(value) : <span className="text-gray-300">—</span>}</span>
      <Pencil className="w-3 h-3 text-indigo-400 opacity-0 group-hover/cell:opacity-100" />
    </span>
  );
}

// Filtro por coluna numérica (estilo Excel): ≥ mín / ≤ máx + atalhos. `abs` = filtra pelo módulo
// do valor (usado nas colunas de Desvio, p/ "desvio ≥ R$1000" pegar tanto perda quanto sobra).
//
// `sinal` existe porque min/max sozinhos NÃO conseguem responder "só os negativos" nas colunas de
// Desvio: elas filtram pelo módulo, que joga fora justamente o sinal ("esse mín e máx fica um pouco
// confuso… como eu filtro somente os negativos?" — Isaías, 12/08/2026). Ele é avaliado sobre o
// valor REAL, e combina com min/max: sinal 'neg' + mín 1000 = perdas acima de R$ 1.000.
type NumCond = { min: number | null; max: number | null; sinal?: 'neg' | 'pos' | null };
const NUM_ABS = new Set(['desvio_qtd', 'desvio_rs']); // colunas filtradas pelo módulo
function NumHeader({ label, title, cond, onChange, abs, className }: {
  label: string; title?: string; cond: NumCond; onChange: (c: NumCond) => void; abs?: boolean;
  /** Usado para esconder a coluna no celular (`hidden md:table-cell`). */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const active = cond.min != null || cond.max != null || !!cond.sinal;
  const openMenu = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ left: Math.max(8, Math.min(r.right - 224, window.innerWidth - 232)), top: r.bottom + 4 });
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const away = () => setOpen(false);
    window.addEventListener('mousedown', onDown); window.addEventListener('resize', away);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('resize', away); };
  }, [open]);
  const set = (k: 'min' | 'max', v: string) => {
    const t = v.trim(); const n = t === '' ? null : Number(t.replace(',', '.'));
    onChange({ ...cond, [k]: n == null || Number.isNaN(n) ? null : n });
  };
  return (
    <th className={`text-right font-medium px-3 py-2 ${className || ''}`} title={title}>
      <button ref={btnRef} onClick={() => (open ? setOpen(false) : openMenu())}
        className={`inline-flex items-center gap-1 justify-end hover:text-gray-700 dark:hover:text-gray-200 ${active ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
        <span>{label}</span>
        <Filter className={`w-3 h-3 ${active ? 'fill-emerald-500 text-emerald-500' : 'text-gray-300 dark:text-gray-600'}`} />
      </button>
      {open && pos && typeof document !== 'undefined' && createPortal(
        <div ref={menuRef} style={{ position: 'fixed', left: pos.left, top: pos.top, width: 216 }}
          className="z-[60] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-2 normal-case text-left">
          <div className="text-[11px] text-gray-500 mb-1.5">{label}{abs ? ' — filtra pelo valor absoluto' : ''}</div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs text-gray-500 w-5 text-right">≥</span>
            <input value={cond.min ?? ''} inputMode="decimal" onChange={e => set('min', e.target.value)} placeholder="mín"
              className="flex-1 h-8 text-xs text-right tabular-nums rounded border border-gray-300 dark:border-gray-600 bg-transparent px-2" />
          </div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-xs text-gray-500 w-5 text-right">≤</span>
            <input value={cond.max ?? ''} inputMode="decimal" onChange={e => set('max', e.target.value)} placeholder="máx"
              className="flex-1 h-8 text-xs text-right tabular-nums rounded border border-gray-300 dark:border-gray-600 bg-transparent px-2" />
          </div>
          {/* Só perdas / só sobras vêm PRIMEIRO e maiores: é o filtro que o time usa de fato.
              Preservam o mín/máx já digitado, então dá pra compor "perdas ≥ 1.000". */}
          {abs && (
            <div className="flex items-center gap-1 mb-2">
              <button onClick={() => onChange({ ...cond, sinal: cond.sinal === 'neg' ? null : 'neg' })}
                className={`flex-1 text-[11px] px-1.5 py-1 rounded border ${cond.sinal === 'neg' ? 'border-red-400 bg-red-50 dark:bg-red-900/25 text-red-700 dark:text-red-300 font-medium' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                − só perdas
              </button>
              <button onClick={() => onChange({ ...cond, sinal: cond.sinal === 'pos' ? null : 'pos' })}
                className={`flex-1 text-[11px] px-1.5 py-1 rounded border ${cond.sinal === 'pos' ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/25 text-emerald-700 dark:text-emerald-300 font-medium' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                + só sobras
              </button>
            </div>
          )}
          <div className="flex items-center gap-1 flex-wrap">
            <button onClick={() => onChange({ ...cond, min: 0.0001, max: null })} className="text-[11px] px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">&gt; 0</button>
            {abs && <button onClick={() => onChange({ ...cond, min: 1000, max: null })} className="text-[11px] px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">≥ 1.000</button>}
            <button onClick={() => onChange({ min: null, max: null, sinal: null })} className="text-[11px] px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400">limpar</button>
          </div>
        </div>, document.body)}
    </th>
  );
}

// aplica os filtros numéricos de coluna a uma linha (só as colunas presentes na aba são consideradas)
const passNum = (row: any, numF: Record<string, NumCond>) => Object.entries(numF).every(([id, c]) => {
  if (!c || (c.min == null && c.max == null && !c.sinal)) return true;
  const raw = row[id];
  if (raw === undefined) return true; // coluna não existe nesta aba
  const real = Number(raw) || 0;
  // sinal olha o valor REAL; min/max seguem no módulo nas colunas de desvio (ver NumCond)
  if (c.sinal === 'neg' && !(real < 0)) return false;
  if (c.sinal === 'pos' && !(real > 0)) return false;
  const v = NUM_ABS.has(id) ? Math.abs(real) : real;
  if (c.min != null && v < c.min) return false;
  if (c.max != null && v > c.max) return false;
  return true;
});
const numAtivo = (numF: Record<string, NumCond>) => Object.values(numF).some(c => c && (c.min != null || c.max != null || !!c.sinal));

const fmtBRL = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtQtd = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const fmtData = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const ddmm = (d: string) => d ? d.split('-').reverse().slice(0, 2).join('/') : '—';

// Célula de estoque (inicial/real) com tooltip de DEBUG: separa a CONTAGEM crua do que está
// EMBUTIDO em pré-batches contados (ex.: whisky dentro de um Pré-Batch). `tipo`: 'ini' | 'fim'.
// `comp` vem de gold.fn_desvios_composicao (via API). Marca "pb" quando há pré-batch no valor.
function EstoqueCell({ valor, comp, tipo }: { valor: number; comp: any; tipo: 'ini' | 'fim' }) {
  if (!comp) return <>{fmtQtd(valor)}</>;
  const cont = Number(tipo === 'ini' ? comp.contagem_ini : comp.contagem_fim);
  const pb = Number(tipo === 'ini' ? comp.prebatch_ini : comp.prebatch_fim);
  const temPb = Math.abs(pb) > 0.0001;
  const lista = (comp.prebatches || []).filter((p: any) => p.quando === tipo);
  const title = temPb
    ? `Contagem: ${fmtQtd(cont)} + em pré-batch: ${fmtQtd(pb)}\n` +
      lista.map((p: any) => `• ${p.nome}: ${fmtQtd(p.embutido)} (de ${fmtQtd(p.qtd_prebatch)} contado)`).join('\n')
    : `Contagem: ${fmtQtd(cont)} (sem pré-batch)`;
  return (
    <span title={title} className={temPb ? 'cursor-help underline decoration-dotted decoration-amber-400 underline-offset-2' : 'cursor-help'}>
      {fmtQtd(valor)}{temPb && <sup className="ml-0.5 text-[9px] text-amber-500">pb</sup>}
    </span>
  );
}
// Olhinho "não controlamos este item" — usado nas TRÊS abas (Insumos, Produções, Proteínas).
// É flag do CADASTRO do insumo (operations.insumos.ignorar_desvio), então vale para qualquer
// período e granularidade: marcar na diária já reflete no semanal e no mensal.
function BotaoOlho({ it, onToggle }: { it: any; onToggle: (it: any) => void }) {
  return (
    <button
      onClick={() => onToggle(it)}
      title={it.ignorado
        ? 'Item fora do desvio — clique pra voltar a contabilizar'
        : 'Não controlamos este item: tirar do desvio (some da lista e do total)'}
      className={`mr-1.5 align-middle ${it.ignorado ? 'text-amber-600 dark:text-amber-400' : 'text-gray-300 hover:text-gray-500 dark:hover:text-gray-300'}`}
    >
      {it.ignorado ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
    </button>
  );
}

// dd/mm do dia anterior a `d` (fim da semana = contagem de fechamento − 1 = domingo)
const ddmmPrev = (d: string) => { const dt = new Date(d + 'T00:00:00'); dt.setDate(dt.getDate() - 1); return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`; };

const TIPOS = [{ k: 'diaria', l: 'Diária' }, { k: 'semanal', l: 'Semanal' }, { k: 'mensal', l: 'Mensal' }];

// 3 cards de headline (Desvio total / Perdas / Sobras) — reusado nas 3 abas
function HeadCards({ head }: { head: any }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <Card className="card-dark"><CardContent className="py-3">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">Desvio total</div>
        <div className={`text-2xl font-bold ${(head?.desvio_total ?? 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{fmtBRL(head?.desvio_total)}</div>
        <div className="text-[11px] text-gray-400">estoque real − teórico no período</div>
      </CardContent></Card>
      <Card className="card-dark"><CardContent className="py-3">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">Perdas (faltou estoque)</div>
        <div className="text-2xl font-bold text-red-600 dark:text-red-400">{fmtBRL(head?.perdas)}</div>
        <div className="text-[11px] text-gray-400">sobrou menos do que as vendas explicam</div>
      </CardContent></Card>
      <Card className="card-dark"><CardContent className="py-3">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">Sobras (sobrou estoque)</div>
        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmtBRL(head?.sobras)}</div>
        <div className="text-[11px] text-gray-400">restou mais do que as vendas explicam</div>
      </CardContent></Card>
    </div>
  );
}

// caixa de análise (perda vs período anterior + drivers) — reusado nas 3 abas
function AnaliseBlock({ analise, tipo }: { analise: any; tipo: string | null }) {
  if (!(analise?.insights?.length > 0)) return null;
  const lv = analise.level as 'alert' | 'warn' | 'info';
  const cls = lv === 'alert' ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/15'
    : lv === 'warn' ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/15'
      : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/15';
  const labelTipo = tipo === 'diaria' ? 'diária' : tipo === 'semanal' ? 'semanal' : 'mensal';
  const bullet = (l: string) => l === 'alert' ? '⚠️' : l === 'warn' ? '⚠' : '•';
  return (
    <div className={`rounded-lg border px-4 py-3 ${cls}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <AlertTriangle className={`w-4 h-4 ${lv === 'alert' ? 'text-rose-600 dark:text-rose-400' : lv === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`} />
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Análise de desvios — contagem {labelTipo}</span>
        {analise.anterior && <span className="text-xs text-gray-500">vs {fmtData(analise.anterior)}</span>}
      </div>
      <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
        {analise.insights.map((ins: any, i: number) => (
          <li key={i} className="flex gap-1.5"><span className="shrink-0">{bullet(ins.level)}</span><span>{ins.texto}</span></li>
        ))}
      </ul>
    </div>
  );
}

export default function DesviosPage() {
  const { selectedBar } = useBar();
  const { soLeitura } = useModuloPermissao('/operacional/desvios');
  const { setPageTitle } = usePageTitle();
  useEffect(() => { setPageTitle('⚖️ Desvios de Consumo'); return () => setPageTitle(''); }, [setPageTitle]);
  const barId = selectedBar?.id;
  const [tipo, setTipo] = useState('diaria');
  const [datas, setDatas] = useState<string[]>([]);
  const [ini, setIni] = useState<string | null>(null);
  const [fim, setFim] = useState<string | null>(null);
  // prévia da semana em andamento (abertura da semana → última contagem diária; só Curva A)
  const [andamentoWin, setAndamentoWin] = useState<{ ini: string; fim: string } | null>(null);
  const [andamento, setAndamento] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const { toast } = useToast();
  const [res, setRes] = useState<any | null>(null);
  const [busca, setBusca] = useState('');
  // Ordem das 3 abas. Padrão segue o servidor (maior desvio primeiro — é como se analisa);
  // A–Z entra pra quem está PROCURANDO um item específico (pedido do Isaías, 04/08).
  const [ordem, setOrdem] = useState<'desvio' | 'az'>('desvio');
  const [aba, setAba] = useState('insumos');
  const [soCurvaA, setSoCurvaA] = useState(false);
  // Itens que o time não controla (olhinho). 'ativos' é o padrão pedido: a tela abre mostrando
  // só o que é acompanhado de fato. Mesma convenção da tela de Consumação.
  const [modoIgnorados, setModoIgnorados] = useState<'ativos' | 'todos' | 'so_ignorados'>('ativos');
  const [filtroDado, setFiltroDado] = useState<'sem_contagem' | 'sem_ficha' | null>(null);
  // "só linhas com desperdício lançado" — vale nas 3 abas e em qualquer granularidade
  const [soDesperdicio, setSoDesperdicio] = useState(false);
  const [filtroArea, setFiltroArea] = useState<string | null>(null);
  const [filtroSecaoProd, setFiltroSecaoProd] = useState<'Comida' | 'Drinks' | null>(null);
  // filtros por coluna numérica (estilo Excel) — compartilhados entre as 3 abas por id de coluna
  const [numF, setNumF] = useState<Record<string, NumCond>>({});
  const setNum = useCallback((id: string, c: NumCond) => setNumF(p => ({ ...p, [id]: c })), []);
  const condOf = (id: string): NumCond => numF[id] ?? { min: null, max: null };
  const [rowsProt, setRowsProt] = useState<any[]>([]);
  const [protAnalise, setProtAnalise] = useState<any>(null);
  const [loadingAba, setLoadingAba] = useState(false);

  // carrega datas do tipo selecionado e pré-seleciona as 2 mais recentes
  useEffect(() => {
    if (!barId) return;
    setAndamento(false);
    api.get(`/api/operacional/desvios?tipo=${tipo}`).then((r) => {
      if (r.success) {
        const ds: string[] = r.datas || [];
        setDatas(ds);
        setAndamentoWin(r.andamento || null);
        if (ds.length >= 2) { setFim(ds[0]); setIni(ds[1]); }
        else { setFim(ds[0] || null); setIni(null); setRes(null); }
      }
    });
  }, [barId, tipo]);

  // silent=true → recarrega SEM blankar a tabela com spinner (usado após salvar no lápis:
  // a tabela fica visível e atualiza no lugar quando o recálculo volta, sem piscar).
  const carregar = useCallback(async (a: string, b: string, t: string, emAndamento = false, silent = false) => {
    if (!barId || !a || !b) return;
    if (!silent) setLoading(true);
    try {
      const r = await api.get(`/api/operacional/desvios?ini=${a}&fim=${b}&tipo=${t}${emAndamento ? '&andamento=1' : ''}`);
      if (r.success) setRes(r);
    } finally { if (!silent) setLoading(false); }
  }, [barId]);
  useEffect(() => { if (ini && fim) carregar(ini, fim, tipo, andamento); }, [ini, fim, tipo, andamento, carregar]);

  // Seletor único de Semanal/Mensal: cada período é a janela [ini, fim) entre duas contagens
  // consecutivas (datas vêm DESC); fim = a contagem que fecha a semana/mês.
  const periodos = useMemo(() => {
    const out: { ini: string; fim: string }[] = [];
    for (let i = 0; i + 1 < datas.length; i++) out.push({ fim: datas[i], ini: datas[i + 1] });
    return out;
  }, [datas]);
  // Diária = 1 só dia selecionado: a janela é [dia, próxima contagem). O dia mais recente (datas[0])
  // ainda não tem contagem de fechamento, então não pode ser início — começa em datas[1].
  const diasDiaria = useMemo(() => {
    const out: { dia: string; fim: string }[] = [];
    for (let i = 1; i < datas.length; i++) out.push({ dia: datas[i], fim: datas[i - 1] });
    return out;
  }, [datas]);
  const labelPeriodo = (p: { ini: string; fim: string }) =>
    tipo === 'mensal'
      ? new Date(p.ini + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      // semana operacional: ini (segunda) → fim−1 (domingo); fim é a contagem de fechamento da semana seguinte
      : `${ddmm(p.ini)} – ${ddmmPrev(p.fim)}`;

  // abas Produções / Proteínas (leitura) — carregam sob demanda
  // Proteínas tem fn própria (balanço VMarket × utilizado produção); Produções vem do mesmo fn_desvios
  const carregarAba = useCallback(async () => {
    if (!barId || !ini || !fim || aba !== 'proteinas') return;
    setLoadingAba(true);
    try {
      const r = await api.get(`/api/operacional/desvios?ini=${ini}&fim=${fim}&aba=proteina&tipo=${tipo}${andamento ? '&andamento=1' : ''}`);
      if (r.success) { setRowsProt(r.itens || []); setProtAnalise(r.analise || null); }
    } finally { setLoadingAba(false); }
  }, [barId, ini, fim, aba, tipo, andamento]);
  useEffect(() => { carregarAba(); }, [carregarAba]);
  // após salvar (res muda), recarrega a aba Proteínas pra refletir utilizado/desperdício
  useEffect(() => { if (aba === 'proteinas' && res) carregarAba(); }, [res]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ordenação das listas: 'desvio' mantém a ordem do servidor (|desvio R$| desc); 'az' ordena
  // pelo nome com localeCompare pt-BR (acento/Ç no lugar certo). Vale pras 3 abas.
  const aplicarOrdem = useCallback((rows: any[]) =>
    ordem === 'az' ? [...rows].sort((a, b) => cmpNome(a.insumo_nome, b.insumo_nome)) : rows, [ordem]);

  // Produções = linhas is_producao do fn_desvios (balanço ancorado no estoque, com Produzido)
  // prodBase = antes do filtro Comida/Drinks (alimenta os contadores dos chips); prodView = já filtrado.
  const prodBase = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return (res?.itens || []).filter((i: any) => i.is_producao
      && ((tipo !== 'diaria' && !andamento) || i.curva_a === true) // diária / semana em andamento: só Curva A
      && (!soCurvaA || i.curva_a === true)         // filtro Só Curva A (semanal/mensal)
      && (modoIgnorados === 'todos' || (modoIgnorados === 'so_ignorados' ? i.ignorado : !i.ignorado))
      && (!soDesperdicio || Number(i.desperdicio || 0) !== 0)
      && passNum(i, numF)
      && (!s || (i.insumo_nome || '').toLowerCase().includes(s) || (i.insumo_codigo || '').toLowerCase().includes(s)));
  }, [res, busca, tipo, soCurvaA, andamento, numF, modoIgnorados, soDesperdicio]);
  const cntProdComida = useMemo(() => prodBase.filter((i: any) => i.secao_prod === 'Comida').length, [prodBase]);
  const cntProdDrinks = useMemo(() => prodBase.filter((i: any) => i.secao_prod === 'Drinks').length, [prodBase]);
  const prodView = useMemo(() => aplicarOrdem(prodBase.filter((i: any) => !filtroSecaoProd || i.secao_prod === filtroSecaoProd)), [prodBase, filtroSecaoProd, aplicarOrdem]);
  const protView = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return aplicarOrdem(rowsProt.filter((i: any) =>
      (modoIgnorados === 'todos' || (modoIgnorados === 'so_ignorados' ? i.ignorado : !i.ignorado))
      && (!soDesperdicio || Number(i.desperdicio || 0) !== 0)
      && passNum(i, numF)
      && (!s || (i.insumo_nome || '').toLowerCase().includes(s) || (i.insumo_cod || '').toLowerCase().includes(s))));
  }, [rowsProt, busca, numF, aplicarOrdem, modoIgnorados, soDesperdicio]);

  // edita em qualquer granularidade (lápis); salva no dia de início do período
  const editavel = !!ini; // edita em qualquer granularidade; salva no dia de início do período
  // Desperdício (Gonza): quebra por curva.
  //  - Diária: só Curva A (é o que tem contagem diária) — lança o dia.
  //  - Semanal: Curva A é READ-ONLY = soma dos diários; NÃO-Curva-A vira input MANUAL da semana
  //    (não tem diário pra somar). Salva no início da semana; o fn_desvios soma em [ini, fim).
  //  - Mensal: read-only (consolida as semanas).
  const podeEditarDesperd = useCallback(
    (it: any) => editavel && (tipo === 'diaria' || (tipo === 'semanal' && it?.curva_a !== true)),
    [editavel, tipo]
  );
  const salvar = useCallback(async (kind: 'produzido' | 'desperdicio' | 'utilizado', codigo: string, payload: { fornadas?: number | null; qtd?: number | null }) => {
    if (!ini || !fim) return;
    try {
      await api.post('/api/operacional/desvios', { tipo: kind, codigo, data: ini, ...payload });
      await carregar(ini, fim, tipo, andamento, true); // reload SILENCIOSO (não blanka a tabela)
    } catch { /* silencioso; recarrega no próximo */ }
  }, [ini, fim, tipo, andamento, carregar]);

  // Atualizar estoque: puxa a contagem da planilha (últimos 14 dias, aba INSUMOS) e recarrega os desvios.
  // Mesma sincronização da tela de Estoque — útil pra refletir uma contagem recém-lançada sem trocar de tela.
  const sincronizarEstoque = useCallback(async () => {
    if (!barId) return;
    setSincronizando(true);
    try {
      const r = await api.post('/api/operacional/estoque-historico', { action: 'sync' });
      if (!r.success) throw new Error(r.error);
      toast({ title: 'Estoque atualizado', description: `${r.upserted ?? 0} linhas da planilha de contagem` });
      if (ini && fim) await carregar(ini, fim, tipo, andamento, true);
    } catch (e: any) {
      toast({ title: 'Erro ao atualizar estoque', description: e?.message, variant: 'destructive' });
    } finally { setSincronizando(false); }
  }, [barId, ini, fim, tipo, andamento, carregar, toast]);

  // Olhinho: marca/desmarca "não controlamos este item". É flag do CADASTRO do insumo, então
  // vale pra todos os períodos — não é ajuste de uma semana. Recarrega pra refletir nos totais.
  const alternarIgnorado = useCallback(async (it: any) => {
    try {
      const novo = !it.ignorado;
      // `insumo_cod` é o nome da coluna na fn de proteína; as outras duas abas usam `insumo_codigo`.
      const codigo = it.insumo_codigo ?? it.insumo_cod;
      const r = await api.post('/api/operacional/desvios', {
        tipo: 'ignorar', codigo, ignorar: novo,
      });
      if (!r.success) throw new Error(r.error);
      toast({
        title: novo ? 'Fora do desvio' : 'De volta ao desvio',
        description: novo
          ? `${it.insumo_nome} não entra mais na conta (nem no total). Use "Ver ignorados" pra desfazer.`
          : `${it.insumo_nome} volta a ser contabilizado.`,
      });
      if (ini && fim) await carregar(ini, fim, tipo, andamento, true);
    } catch (e: any) {
      toast({ title: 'Erro ao marcar', description: e?.message, variant: 'destructive' });
    }
  }, [ini, fim, tipo, andamento, carregar, toast]);

  // Insumos = só insumos (exclui produção e proteína, que têm aba própria).
  // Semanal/mensal: esconde item fora de ficha (Gonza: sem ficha não entra no desvio nem tem
  // desperdício — nunca tem saída teórica). Filtro "Só Curva A" separado.
  //
  // EXCEÇÃO: linha com desperdício lançado no período NUNCA some. Sem isso, quem lançava
  // desperdício num item sem ficha via o valor sumir ao trocar pra semanal/mensal — a fn_desvios
  // somava certo, mas a linha era filtrada aqui, então parecia que "não entrou" (Isaías,
  // 12/08/2026: "quando a galera lança desperdício, consegue deixar entrar no semanal e mensal
  // também? só ir somando"). Ex. bar 4, semana 03–10/08: Laranja Pera, 0,084 kg, sem ficha.
  const itensView = useMemo(() => {
    const s = busca.trim().toLowerCase();
    const rows = (res?.itens || []).filter((i: any) => !i.is_producao && !i.is_proteina
      && (tipo === 'diaria' || andamento || i.tem_ficha || Number(i.desperdicio || 0) !== 0)
      // Ignorados ficam FORA por padrão — e como os cards de headline somam a partir desta
      // view, sair daqui já tira do Desvio total/Perdas/Sobras, que é o pedido.
      && (modoIgnorados === 'todos' || (modoIgnorados === 'so_ignorados' ? i.ignorado : !i.ignorado))
      && (!soDesperdicio || Number(i.desperdicio || 0) !== 0)
      && (!soCurvaA || i.curva_a === true)
      && (!filtroDado || i.dado_faltando === filtroDado)
      && (!filtroArea || i.area === filtroArea)
      && passNum(i, numF)
      && (!s || (i.insumo_nome || '').toLowerCase().includes(s) || (i.insumo_codigo || '').toLowerCase().includes(s)));
    return aplicarOrdem(rows);
  }, [res, busca, tipo, andamento, soCurvaA, filtroDado, filtroArea, numF, modoIgnorados, soDesperdicio, aplicarOrdem]);

  // contadores dos chips de filtro (igual /operacional/insumos) — base = aba ativa sem o filtro Curva A
  const baseRows = useMemo(() => {
    const s = busca.trim().toLowerCase();
    const items = (res?.itens || []) as any[];
    const match = (i: any) => !s || (i.insumo_nome || '').toLowerCase().includes(s)
      || (i.insumo_codigo || i.insumo_cod || '').toLowerCase().includes(s);
    if (aba === 'proteinas') return rowsProt.filter(match);
    if (aba === 'producoes') return items.filter((i) => i.is_producao && match(i));
    // mesma exceção da itensView: item com desperdício conta, mesmo sem ficha
    return items.filter((i) => !i.is_producao && !i.is_proteina
      && (i.tem_ficha || Number(i.desperdicio || 0) !== 0) && match(i));
  }, [res, busca, aba, rowsProt]);
  const cntTotal = baseRows.length;
  const cntCurvaA = baseRows.filter((i: any) => i.curva_a === true).length;
  // Conta sobre TODOS os itens da aba (baseRows já ignora o filtro de modo), senão o chip
  // "fora do desvio" zeraria justamente quando eles estão escondidos — que é o padrão.
  const cntIgnorados = baseRows.filter((i: any) => i.ignorado).length;
  // Quantos itens tiveram desperdício lançado no período — atalho pra conferir o que a equipe
  // registrou, em qualquer granularidade (na semanal/mensal os valores são a soma dos dias).
  const cntDesperdicio = baseRows.filter((i: any) => Number(i.desperdicio || 0) !== 0).length;
  const cntSemContagem = baseRows.filter((i: any) => i.dado_faltando === 'sem_contagem').length;
  const cntSemFicha = baseRows.filter((i: any) => i.dado_faltando === 'sem_ficha').length;
  // contagem por área (chips de filtro por área) — só Insumos
  const areaList = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of baseRows) m[i.area] = (m[i.area] || 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [baseRows]);

  // headline acompanha o filtro: soma o desvio_rs da view atual de cada aba (exclui pendente)
  const headFrom = (rows: any[]) => rows.reduce((a: any, i: any) => {
    if (i.pendente) return a; const v = Number(i.desvio_rs || 0);
    a.desvio_total += v; if (v < 0) a.perdas += v; else a.sobras += v; return a;
  }, { desvio_total: 0, perdas: 0, sobras: 0 });
  const h = useMemo(() => headFrom(itensView), [itensView]); // eslint-disable-line react-hooks/exhaustive-deps
  const hProd = useMemo(() => headFrom(prodView), [prodView]); // eslint-disable-line react-hooks/exhaustive-deps
  const hProt = useMemo(() => headFrom(protView), [protView]); // eslint-disable-line react-hooks/exhaustive-deps

  // Linhas da aba ativa — é o que a tela mostra e o que o CSV exporta.
  const rowsAtivas = aba === 'insumos' ? itensView : aba === 'producoes' ? prodView : protView;

  // Exporta a aba ATIVA exatamente como está na tela: filtros, ordem e itens fora do desvio
  // já aplicados (pedido do Isaías, 12/08/2026 — "é para apresentar nas reuniões dos sócios").
  // Números saem com vírgula decimal e separador ';' pro Excel pt-BR abrir já como número, e o
  // arquivo leva BOM pra não quebrar acento. Fecha com uma linha TOTAL (soma do que está filtrado).
  const exportarCSV = () => {
    if (!rowsAtivas.length) return;
    const q = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const n = (v: any, dec = 3) => (v == null || v === '' || Number.isNaN(Number(v)) ? '' : Number(v).toFixed(dec).replace('.', ','));
    const sim = (v: any) => (v ? 'Sim' : '');
    let head: string[];
    let linhas: string[];
    if (aba === 'insumos') {
      head = ['Insumo', 'Codigo', 'Unidade', 'Area', 'Curva A', 'Fora do desvio', 'Estoque ini', 'Compras', 'Troca', 'Saida teorica', 'Desperdicio', 'Estoque fim teorico', 'Estoque real', 'Desvio (qtd)', 'Desvio (R$)'];
      linhas = rowsAtivas.map((i: any) => [
        q(i.insumo_nome), q(i.insumo_codigo), q(i.unidade || ''), q(i.area || ''), q(sim(i.curva_a)), q(sim(i.ignorado)),
        n(i.estoque_ini), n(i.compra), n(i.troca), n(i.saida_teorica), n(i.desperdicio),
        n(i.estoque_fim_teorico), n(i.estoque_fim_real), n(i.desvio_qtd), n(i.desvio_rs, 2),
      ].join(';'));
    } else if (aba === 'producoes') {
      head = ['Producao', 'Codigo', 'Unidade', 'Secao', 'Curva A', 'Fora do desvio', 'Estoque ini', 'Produzido', 'Saida teorica', 'Desperdicio', 'Estoque fim teorico', 'Estoque real', 'Desvio (qtd)', 'Desvio (R$)'];
      linhas = rowsAtivas.map((i: any) => [
        q(i.insumo_nome), q(i.insumo_codigo), q(i.unidade || ''), q(i.secao_prod || ''), q(sim(i.curva_a)), q(sim(i.ignorado)),
        n(i.estoque_ini), n(i.produzido), n(i.saida_teorica), n(i.desperdicio),
        n(i.estoque_fim_teorico), n(i.estoque_fim_real), n(i.desvio_qtd), n(i.desvio_rs, 2),
      ].join(';'));
    } else {
      head = ['Proteina', 'Codigo', 'Fora do desvio', 'Estoque ini', 'Compras', 'Troca', 'Utilizado Producao', 'Saida Direta', 'Desperdicio', 'Estoque fim teorico', 'Estoque real', 'Desvio (qtd)', 'Desvio (R$)'];
      linhas = rowsAtivas.map((i: any) => [
        q(i.insumo_nome), q(i.insumo_cod), q(sim(i.ignorado)),
        n(i.estoque_ini), n(i.comprou), n(i.troca), n(i.utilizado_producao), n(i.saida_direta), n(i.desperdicio),
        n(i.estoque_fim_teorico), n(i.estoque_fim_real), n(i.desvio_qtd), n(i.desvio_rs, 2),
      ].join(';'));
    }
    const tot = headFrom(rowsAtivas);
    linhas.push([q('TOTAL'), ...Array(head.length - 2).fill(''), n(tot.desvio_total, 2)].join(';'));
    linhas.push([q('PERDAS'), ...Array(head.length - 2).fill(''), n(tot.perdas, 2)].join(';'));
    linhas.push([q('SOBRAS'), ...Array(head.length - 2).fill(''), n(tot.sobras, 2)].join(';'));
    const csv = '﻿' + [head.join(';'), ...linhas].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `desvios_${aba}_${tipo}${andamento ? '-andamento' : ''}_${ini}_${fim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell width="wide">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-100 dark:bg-rose-900/30 rounded-xl"><Scale className="w-6 h-6 text-rose-600 dark:text-rose-400" /></div>
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">{soLeitura && <BadgeSomenteLeitura />}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Estoque real × teórico (ini + compras + produzido − vendas×ficha − desperdício) · {selectedBar?.nome || ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Em Análises não há "aba atual em CSV" pra exportar — a tela é gráfico e ranking. */}
            {aba !== 'analises' && <button onClick={exportarCSV} disabled={!rowsAtivas.length}
              title="Baixa a aba atual em CSV (Excel), com os filtros que estão aplicados na tela"
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50">
              <Download className="w-4 h-4" />Exportar CSV
            </button>}
            <button onClick={sincronizarEstoque} disabled={sincronizando || !barId}
              title="Puxa a contagem da planilha (últimos 14 dias) e recarrega os desvios"
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${sincronizando ? 'animate-spin' : ''}`} />{sincronizando ? 'Atualizando…' : 'Atualizar estoque'}
            </button>
          </div>
        </div>

        {/* Tipo + Período — some em Análises, que tem os PRÓPRIOS recortes (semana/mês + intervalo).
            Deixar os dois na tela fazia parecer que o seletor de cima mandava no gráfico, e não
            manda: o de cima escolhe UMA janela, o de lá escolhe uma série (Rodrigo, 20/08/2026). */}
        {aba !== 'analises' && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {TIPOS.map(t => (
              <button key={t.k} onClick={() => setTipo(t.k)} className={`rounded-md px-3 py-1.5 text-sm border ${tipo === t.k ? 'bg-rose-500 text-white border-rose-500' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>{t.l}</button>
            ))}
          </div>
          <span className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
          <CalendarDays className="w-4 h-4 text-gray-400" />
          {tipo === 'diaria' ? (
            <>
              <span className="text-sm text-gray-500">Dia</span>
              <select value={ini || ''} onChange={e => { const d = diasDiaria.find(x => x.dia === e.target.value); if (d) { setIni(d.dia); setFim(d.fim); } }} className="h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm">
                {diasDiaria.length === 0 && <option value="">—</option>}
                {diasDiaria.map(d => <option key={d.dia} value={d.dia}>{fmtData(d.dia)}</option>)}
              </select>
              {/* A contagem de `fim` é feita de manhã, então o consumo medido vai só até fim−1.
                  Sem dizer isso, comparar com a tela de Saídas (que inclui os dois extremos) dá
                  impressão de número divergente — foi o que o dono viu em 14/08/2026. */}
              {ini && fim && (
                <span className="text-xs text-gray-400" title="A contagem do dia final é feita de manhã, antes do consumo daquele dia">
                  estoque {ddmm(ini)} → {ddmm(fim)} · consumo {ddmm(ini)} a {ddmmPrev(fim)}
                </span>
              )}
            </>
          ) : (
            <>
              <span className="text-sm text-gray-500">{tipo === 'semanal' ? 'Semana' : 'Mês'}</span>
              <select value={andamento && andamentoWin ? `__and__${andamentoWin.fim}` : (fim || '')} onChange={e => {
                if (tipo === 'semanal' && andamentoWin && e.target.value === `__and__${andamentoWin.fim}`) { setAndamento(true); setIni(andamentoWin.ini); setFim(andamentoWin.fim); return; }
                setAndamento(false);
                const p = periodos.find(x => x.fim === e.target.value); if (p) { setIni(p.ini); setFim(p.fim); }
              }} className="h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm capitalize">
                {periodos.length === 0 && !andamentoWin && <option value="">—</option>}
                {tipo === 'semanal' && andamentoWin && <option value={`__and__${andamentoWin.fim}`}>🔴 Semana atual (em andamento) · {ddmm(andamentoWin.ini)} → {ddmm(andamentoWin.fim)}</option>}
                {periodos.map(p => <option key={p.fim} value={p.fim}>{labelPeriodo(p)}</option>)}
              </select>
              {/* A contagem de `fim` é feita de manhã, então o consumo medido vai só até fim−1.
                  Sem dizer isso, comparar com a tela de Saídas (que inclui os dois extremos) dá
                  impressão de número divergente — foi o que o dono viu em 14/08/2026. */}
              {ini && fim && (
                <span className="text-xs text-gray-400" title="A contagem do dia final é feita de manhã, antes do consumo daquele dia">
                  estoque {ddmm(ini)} → {ddmm(fim)} · consumo {ddmm(ini)} a {ddmmPrev(fim)}
                </span>
              )}
            </>
          )}
        </div>
        )}
        {aba !== 'analises' && andamento && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/15 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Prévia da <b>semana em andamento</b> ({ddmm(andamentoWin?.ini || ini || '')} → {ddmm(andamentoWin?.fim || fim || '')}): considera só itens de <b>Curva A</b> (contados todo dia). O fechamento completo entra na contagem de segunda-feira.</span>
          </div>
        )}

        <Tabs value={aba} onValueChange={setAba}>
          <TabsList>
            <TabsTrigger value="insumos"><Boxes className="w-4 h-4 mr-1.5" />Insumos</TabsTrigger>
            <TabsTrigger value="producoes"><ChefHat className="w-4 h-4 mr-1.5" />Produções</TabsTrigger>
            <TabsTrigger value="proteinas"><Drumstick className="w-4 h-4 mr-1.5" />Proteínas</TabsTrigger>
            {/* Análises: a evolução no tempo. As três abas acima são o retrato de UMA janela. */}
            <TabsTrigger value="analises"><LineChart className="w-4 h-4 mr-1.5" />Análises</TabsTrigger>
          </TabsList>

          {/* Busca, "só perdas/só sobras", ordem e chips filtram LINHA DE LISTA. Em Análises não
              existe lista pra filtrar — ficavam boiando na tela, sem efeito nenhum. */}
          {aba !== 'analises' && (<>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar…" className="pl-9" />
              {numAtivo(numF) && (
                <button onClick={() => setNumF({})}
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100">
                  <Filter className="w-3 h-3" />Limpar filtros<X className="w-3 h-3" />
                </button>
              )}
            </div>
            {/* Atalho de 1 clique pro filtro mais usado. O popover da coluna continua lá pra quem
                quer combinar com faixa de valor; isto aqui é pra "só quero ver o que faltou". */}
            <div className="flex gap-1 shrink-0">
              <button onClick={() => setNum('desvio_rs', { ...condOf('desvio_rs'), sinal: condOf('desvio_rs').sinal === 'neg' ? null : 'neg' })}
                title="Mostra só as linhas com desvio negativo (faltou estoque)"
                className={`inline-flex items-center gap-1 h-10 px-3 rounded-md border text-sm ${condOf('desvio_rs').sinal === 'neg' ? 'border-red-400 bg-red-50 dark:bg-red-900/25 text-red-700 dark:text-red-300 font-medium' : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                <TrendingDown className="w-4 h-4" />Só perdas
              </button>
              <button onClick={() => setNum('desvio_rs', { ...condOf('desvio_rs'), sinal: condOf('desvio_rs').sinal === 'pos' ? null : 'pos' })}
                title="Mostra só as linhas com desvio positivo (sobrou estoque)"
                className={`inline-flex items-center gap-1 h-10 px-3 rounded-md border text-sm ${condOf('desvio_rs').sinal === 'pos' ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/25 text-emerald-700 dark:text-emerald-300 font-medium' : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                <TrendingUp className="w-4 h-4" />Só sobras
              </button>
            </div>
            <OrdemFiltro value={ordem} onChange={setOrdem} cor="rose" options={[['desvio', 'Maior desvio'], ['az', 'A–Z']] as const} />
          </div>
          {/* Filtros (contadores clicáveis, igual /operacional/insumos): total, Curva A, área, dado faltando.
              Antes o bloco inteiro só existia em Insumos (e Produções fora da diária); agora aparece nas
              três abas, porque "fora do desvio" e "com desperdício" valem para todas. */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {(aba === 'insumos' || (aba === 'producoes' && tipo !== 'diaria')) && (
              <button onClick={() => { setSoCurvaA(false); setFiltroDado(null); setFiltroArea(null); setSoDesperdicio(false); }}><Badge variant="outline" className={`cursor-pointer ${!soCurvaA && !filtroDado && !filtroArea && !soDesperdicio ? 'ring-1 ring-emerald-400' : ''}`}>{cntTotal} {aba === 'producoes' ? 'produções' : 'insumos'}</Badge></button>
            )}
            {(aba === 'insumos' || aba === 'producoes') && tipo !== 'diaria' && cntCurvaA > 0 && <button onClick={() => { setSoCurvaA(true); setFiltroDado(null); setFiltroArea(null); }}><Badge variant="outline" className={`cursor-pointer text-indigo-600 border-indigo-300 ${soCurvaA ? 'ring-1 ring-indigo-400' : ''}`}>{cntCurvaA} curva A</Badge></button>}
            {aba === 'insumos' && areaList.length > 1 && areaList.map(([a, n]) => (
              <button key={a} onClick={() => setFiltroArea(f => f === a ? null : a)}><Badge variant="outline" className={`cursor-pointer ${filtroArea === a ? 'ring-1 ring-violet-400 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300' : 'text-gray-600 dark:text-gray-300'}`}>{n} {a}</Badge></button>
            ))}
            {aba === 'insumos' && cntSemContagem > 0 && <button onClick={() => setFiltroDado(f => f === 'sem_contagem' ? null : 'sem_contagem')}><Badge variant="outline" className={`cursor-pointer text-amber-700 dark:text-amber-400 border-amber-300 ${filtroDado === 'sem_contagem' ? 'ring-1 ring-amber-400 bg-amber-50 dark:bg-amber-900/20' : ''}`}>⚠ {cntSemContagem} sem contagem final</Badge></button>}
            {aba === 'insumos' && cntSemFicha > 0 && <button onClick={() => setFiltroDado(f => f === 'sem_ficha' ? null : 'sem_ficha')}><Badge variant="outline" className={`cursor-pointer text-amber-700 dark:text-amber-400 border-amber-300 ${filtroDado === 'sem_ficha' ? 'ring-1 ring-amber-400 bg-amber-50 dark:bg-amber-900/20' : ''}`}>⚠ {cntSemFicha} sem ficha</Badge></button>}
            {/* Desperdício lançado no período. Vale nas 3 abas e em qualquer granularidade — na
                semanal/mensal o valor da coluna já é a SOMA dos dias, então este chip é o caminho
                pra conferir o que a equipe registrou sem caçar linha por linha. */}
            {cntDesperdicio > 0 && (
              <button onClick={() => setSoDesperdicio(v => !v)}>
                <Badge variant="outline" className={`cursor-pointer text-rose-700 dark:text-rose-400 border-rose-300 ${soDesperdicio ? 'ring-1 ring-rose-400 bg-rose-50 dark:bg-rose-900/20' : ''}`}>
                  🗑 {cntDesperdicio} com desperdício
                </Badge>
              </button>
            )}
            {/* Ignorados: só aparece se existir algum marcado — senão é ruído numa tela que já
                tem muitos chips. Clique alterna entre esconder (padrão) e ver só os ignorados. */}
            {cntIgnorados > 0 && (
              <button onClick={() => setModoIgnorados(m => m === 'so_ignorados' ? 'ativos' : 'so_ignorados')}>
                <Badge variant="outline" className={`cursor-pointer text-gray-600 dark:text-gray-300 ${modoIgnorados === 'so_ignorados' ? 'ring-1 ring-amber-400 bg-amber-50 dark:bg-amber-900/20' : ''}`}>
                  <EyeOff className="w-3 h-3 mr-1 inline" />{cntIgnorados} fora do desvio
                </Badge>
              </button>
            )}
          </div>
          </>)}

          {/* ===== INSUMOS (VMarket → ContaHub, estoque âncora) ===== */}
          <TabsContent value="insumos" className="space-y-4 mt-3">

        <HeadCards head={h} />
        <AnaliseBlock analise={res?.analise} tipo={tipo} />

        {/* Tabela */}
        <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
              {/*
                No celular ficam só as 4 colunas de AÇÃO: insumo, o campo de desperdício e o desvio
                que ele explica. As 7 colunas do balanço (estoque ini, compras, troca, saída teórica,
                fim teórico, real e a área) são a memória de cálculo — leitura de conferência, feita
                sentado. 11 colunas em ~390px dão 35px cada e a tabela vira ilegível justamente pra
                quem está no salão lançando a perda.
              */}
              <th className="text-left font-medium px-3 py-2">Insumo</th>
              <th className="text-left font-medium px-3 py-2 hidden md:table-cell">Área</th>
              <NumHeader className="hidden md:table-cell" label="Estoque ini" title="Contagem no início do período" cond={condOf('estoque_ini')} onChange={c => setNum('estoque_ini', c)} />
              <NumHeader className="hidden md:table-cell" label="Compras" cond={condOf('compra')} onChange={c => setNum('compra', c)} />
              <NumHeader className="hidden md:table-cell" label="Troca" title="Troca entre bares: + recebeu (entrada), − enviou (saída)" cond={condOf('troca')} onChange={c => setNum('troca', c)} />
              <NumHeader className="hidden md:table-cell" label="Saída teórica" title="Vendas × ficha técnica (consumo esperado)" cond={condOf('saida_teorica')} onChange={c => setNum('saida_teorica', c)} />
              <NumHeader label="Desperdício" title="Saída manual: lata que estourou, item que deu problema. Curva A: lança no diário (a semana soma). Não-curva-A: lança direto o desperdício da semana aqui." cond={condOf('desperdicio')} onChange={c => setNum('desperdicio', c)} />
              <NumHeader className="hidden md:table-cell" label="Estoque fim teórico" title="ini + compras + produzido − saída teórica − desperdício" cond={condOf('estoque_fim_teorico')} onChange={c => setNum('estoque_fim_teorico', c)} />
              <NumHeader className="hidden md:table-cell" label="Estoque real" title="Contagem do dia seguinte (estoque que sobrou de fato)" cond={condOf('estoque_fim_real')} onChange={c => setNum('estoque_fim_real', c)} />
              <NumHeader label="Desvio (qtd)" title="Estoque real − estoque fim teórico (negativo = faltou). Filtra pelo módulo." cond={condOf('desvio_qtd')} onChange={c => setNum('desvio_qtd', c)} abs />
              <NumHeader label="Desvio (R$)" title="Filtra pelo módulo (perda ou sobra)." cond={condOf('desvio_rs')} onChange={c => setNum('desvio_rs', c)} abs />
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? <tr><td colSpan={11} className="px-3 py-10 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              : itensView.length === 0 ? <tr><td colSpan={11} className="px-3 py-10 text-center text-gray-400">Sem dados nesse período.</td></tr>
              : itensView.map((it: any, i: number) => (
                <tr key={i} className={`hover:bg-gray-50 dark:hover:bg-gray-800/40 ${it.sem_producao ? 'bg-amber-50/60 dark:bg-amber-900/15' : it.suspeita ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''}`}>
                  <td className={`px-3 py-2 text-gray-900 dark:text-gray-100 ${it.ignorado ? 'opacity-60' : ''}`}>
                    <BotaoOlho it={it} onToggle={alternarIgnorado} />
                    {it.sem_producao && <span title="Produção sem 'produzido' informado — desvio vem do balanço bruto (est_ini + compras − vendas × ficha). Sobra grande pode ser produção não registrada."><AlertTriangle className="w-3.5 h-3.5 inline text-amber-500 mr-1" /></span>}
                    <span className={it.ignorado ? 'line-through decoration-amber-400/60' : ''}>{it.insumo_nome}</span>
                    {it.insumo_nome !== it.insumo_codigo && <span className="text-xs text-gray-400 font-mono ml-1">{it.insumo_codigo}</span>}
                    {it.unidade && <span className="ml-1.5 text-[10px] text-gray-400" title="Quantidades desta linha estão nesta unidade de contagem">· {it.unidade}</span>}
                    {it.is_producao && <Badge variant="outline" className="ml-1.5 text-[10px] text-indigo-600 border-indigo-300">produção</Badge>}
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell"><Badge variant="outline">{it.area}</Badge></td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500 hidden md:table-cell">{<EstoqueCell valor={it.estoque_ini} comp={it.composicao} tipo="ini" />}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500 hidden md:table-cell">{fmtQtd(it.compra)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums hidden md:table-cell ${it.troca ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-300'}`} title={it.troca ? (it.troca > 0 ? 'Recebeu por troca' : 'Enviou por troca') : undefined}>{it.troca ? `${it.troca > 0 ? '+' : ''}${fmtQtd(it.troca)}` : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell">{fmtQtd(it.saida_teorica)}</td>
                  <td className="px-3 py-2 text-right"><PencilCell value={it.desperdicio} fmt={fmtQtd} unidade={it.unidade} disabled={!podeEditarDesperd(it)} onSave={(v) => salvar('desperdicio', it.insumo_codigo, { qtd: v })} /></td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium hidden md:table-cell">{fmtQtd(it.estoque_fim_teorico)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium hidden md:table-cell">{<EstoqueCell valor={it.estoque_fim_real} comp={it.composicao} tipo="fim" />}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${it.desvio_qtd < 0 ? 'text-red-600 dark:text-red-400' : it.desvio_qtd > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{`${it.desvio_qtd > 0 ? '+' : ''}${fmtQtd(it.desvio_qtd)}`}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${it.desvio_rs < -10 ? 'text-red-600 dark:text-red-400' : it.desvio_rs > 10 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                    {it.desvio_rs < -10 ? <TrendingDown className="w-3 h-3 inline mr-0.5" /> : it.desvio_rs > 10 ? <TrendingUp className="w-3 h-3 inline mr-0.5" /> : null}{fmtBRL(it.desvio_rs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></CardContent></Card>
          </TabsContent>

          {/* ===== PRODUÇÕES (Controle de Produção → ContaHub) ===== */}
          <TabsContent value="producoes" className="space-y-3 mt-3">
            <HeadCards head={hProd} />
            <AnaliseBlock analise={res?.analise_producao} tipo={tipo} />
            <p className="text-xs text-gray-500 dark:text-gray-400">Balanço da produção: estoque ini + <b>Produzido</b> (fornadas na diária) − saída teórica (vendas×ficha) − desperdício. {editavel ? 'Na diária você lança as fornadas.' : 'Semanal/mensal somam as fornadas do dia.'} Diária só Curva A.</p>
            {/* Filtro Comida / Drinks (seção da produção: pc=Cozinha, pd=Bar) */}
            {(cntProdComida > 0 || cntProdDrinks > 0) && (
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setFiltroSecaoProd(null)}><Badge variant="outline" className={`cursor-pointer ${!filtroSecaoProd ? 'ring-1 ring-emerald-400' : 'text-gray-600 dark:text-gray-300'}`}>{prodBase.length} todas</Badge></button>
                {cntProdComida > 0 && <button onClick={() => setFiltroSecaoProd(f => f === 'Comida' ? null : 'Comida')}><Badge variant="outline" className={`cursor-pointer text-amber-700 dark:text-amber-400 border-amber-300 ${filtroSecaoProd === 'Comida' ? 'ring-1 ring-amber-400 bg-amber-50 dark:bg-amber-900/20' : ''}`}>🍳 {cntProdComida} Comida</Badge></button>}
                {cntProdDrinks > 0 && <button onClick={() => setFiltroSecaoProd(f => f === 'Drinks' ? null : 'Drinks')}><Badge variant="outline" className={`cursor-pointer text-sky-700 dark:text-sky-400 border-sky-300 ${filtroSecaoProd === 'Drinks' ? 'ring-1 ring-sky-400 bg-sky-50 dark:bg-sky-900/20' : ''}`}>🍸 {cntProdDrinks} Drinks</Badge></button>}
              </div>
            )}
            <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
                  <th className="text-left font-medium px-3 py-2">Produção</th>
                  <NumHeader label="Estoque ini" cond={condOf('estoque_ini')} onChange={c => setNum('estoque_ini', c)} />
                  <NumHeader label="Produzido" title="Produção feita no período. Na diária: nº de fornadas (× rendimento)." cond={condOf('produzido')} onChange={c => setNum('produzido', c)} />
                  <NumHeader label="Saída teórica" title="Vendas × ficha técnica" cond={condOf('saida_teorica')} onChange={c => setNum('saida_teorica', c)} />
                  <NumHeader label="Desperdício" cond={condOf('desperdicio')} onChange={c => setNum('desperdicio', c)} />
                  <NumHeader label="Estoque fim teórico" title="ini + produzido − saída teórica − desperdício" cond={condOf('estoque_fim_teorico')} onChange={c => setNum('estoque_fim_teorico', c)} />
                  <NumHeader label="Estoque real" cond={condOf('estoque_fim_real')} onChange={c => setNum('estoque_fim_real', c)} />
                  <NumHeader label="Desvio (qtd)" title="Filtra pelo módulo." cond={condOf('desvio_qtd')} onChange={c => setNum('desvio_qtd', c)} abs />
                  <NumHeader label="Desvio (R$)" title="Filtra pelo módulo (perda ou sobra)." cond={condOf('desvio_rs')} onChange={c => setNum('desvio_rs', c)} abs />
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {loading ? <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
                  : prodView.length === 0 ? <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-400">Sem produção nesse período.</td></tr>
                  : prodView.map((it: any, i: number) => (
                    <tr key={i} className={`hover:bg-gray-50 dark:hover:bg-gray-800/40 ${it.sem_producao ? 'bg-amber-50/60 dark:bg-amber-900/15' : ''}`}>
                      <td className={`px-3 py-2 text-gray-900 dark:text-gray-100 ${it.ignorado ? 'opacity-60' : ''}`}>
                        <BotaoOlho it={it} onToggle={alternarIgnorado} />
                        {it.sem_producao && <span title="Produção sem 'produzido' informado — desvio vem do balanço bruto. Sobra grande pode ser produção não registrada."><AlertTriangle className="w-3.5 h-3.5 inline text-amber-500 mr-1" /></span>}
                        <span className={it.ignorado ? 'line-through decoration-amber-400/60' : ''}>{it.insumo_nome}</span>
                        <span className="text-xs text-gray-400 font-mono ml-1">{it.insumo_codigo}</span>
                        {it.unidade && <span className="ml-1.5 text-[10px] text-gray-400" title="Quantidades desta linha estão nesta unidade de contagem">· {it.unidade}</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-500">{<EstoqueCell valor={it.estoque_ini} comp={it.composicao} tipo="ini" />}</td>
                      <td className="px-3 py-2 text-right"><PencilCell value={it.produzido} fmt={fmtQtd} disabled={!editavel} onSave={(v) => salvar('produzido', it.insumo_codigo, { qtd: v })} /></td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtQtd(it.saida_teorica)}</td>
                      <td className="px-3 py-2 text-right"><PencilCell value={it.desperdicio} fmt={fmtQtd} unidade={it.unidade} disabled={!podeEditarDesperd(it)} onSave={(v) => salvar('desperdicio', it.insumo_codigo, { qtd: v })} /></td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtQtd(it.estoque_fim_teorico)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{<EstoqueCell valor={it.estoque_fim_real} comp={it.composicao} tipo="fim" />}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${it.desvio_qtd < 0 ? 'text-red-600 dark:text-red-400' : it.desvio_qtd > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{`${it.desvio_qtd > 0 ? '+' : ''}${fmtQtd(it.desvio_qtd)}`}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-semibold ${it.desvio_rs < -10 ? 'text-red-600 dark:text-red-400' : it.desvio_rs > 10 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{fmtBRL(it.desvio_rs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div></CardContent></Card>
          </TabsContent>

          {/* ===== PROTEÍNAS (VMarket → Utilizado Produção) ===== */}
          <TabsContent value="proteinas" className="space-y-3 mt-3">
            <HeadCards head={hProt} />
            <AnaliseBlock analise={protAnalise} tipo={tipo} />
            <p className="text-xs text-gray-500 dark:text-gray-400">Balanço da proteína: estoque ini + <b>Compras</b> (VMarket) − <b>Utilizado Produção</b> (processada em preparos) − <b>Saída Direta</b> (vendida direto no produto) − desperdício. Desvio negativo = faltou (perda/furo). Em kg.</p>
            <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
                  <th className="text-left font-medium px-3 py-2">Proteína</th>
                  <NumHeader label="Estoque ini" cond={condOf('estoque_ini')} onChange={c => setNum('estoque_ini', c)} />
                  <NumHeader label="Compras" title="Compras VMarket no período" cond={condOf('comprou')} onChange={c => setNum('comprou', c)} />
                  <NumHeader label="Troca" title="Troca entre bares: + recebeu, − enviou" cond={condOf('troca')} onChange={c => setNum('troca', c)} />
                  <NumHeader label="Utilizado Produção" title="Proteína processada em preparos (Controle de Produção / fornadas × ficha)" cond={condOf('utilizado_producao')} onChange={c => setNum('utilizado_producao', c)} />
                  <NumHeader label="Saída Direta" title="Proteína vendida direto no produto (vendas × ficha)" cond={condOf('saida_direta')} onChange={c => setNum('saida_direta', c)} />
                  <NumHeader label="Desperdício" cond={condOf('desperdicio')} onChange={c => setNum('desperdicio', c)} />
                  <NumHeader label="Estoque fim teórico" title="ini + compras − utilizado produção − saída direta − desperdício" cond={condOf('estoque_fim_teorico')} onChange={c => setNum('estoque_fim_teorico', c)} />
                  <NumHeader label="Estoque real" cond={condOf('estoque_fim_real')} onChange={c => setNum('estoque_fim_real', c)} />
                  <NumHeader label="Desvio (qtd)" title="Filtra pelo módulo." cond={condOf('desvio_qtd')} onChange={c => setNum('desvio_qtd', c)} abs />
                  <NumHeader label="Desvio (R$)" title="Filtra pelo módulo (perda ou sobra)." cond={condOf('desvio_rs')} onChange={c => setNum('desvio_rs', c)} abs />
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {loadingAba ? <tr><td colSpan={11} className="px-3 py-10 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
                  : protView.length === 0 ? <tr><td colSpan={11} className="px-3 py-10 text-center text-gray-400">Sem proteína (marque com o badge P em Insumos) comprada/contada nesse período.</td></tr>
                  : protView.map((it: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className={`px-3 py-2 text-gray-900 dark:text-gray-100 ${it.ignorado ? 'opacity-60' : ''}`}>
                        <BotaoOlho it={it} onToggle={alternarIgnorado} />
                        <span className={it.ignorado ? 'line-through decoration-amber-400/60' : ''}>{it.insumo_nome}</span>
                        <span className="text-xs text-gray-400 font-mono ml-1">{it.insumo_cod}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-500">{<EstoqueCell valor={it.estoque_ini} comp={it.composicao} tipo="ini" />}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtQtd(it.comprou)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${it.troca ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-300'}`} title={it.troca ? (it.troca > 0 ? 'Recebeu por troca' : 'Enviou por troca') : undefined}>{it.troca ? `${it.troca > 0 ? '+' : ''}${fmtQtd(it.troca)}` : '—'}</td>
                      <td className="px-3 py-2 text-right"><PencilCell value={it.utilizado_producao} fmt={fmtQtd} disabled={!editavel} onSave={(v) => salvar('utilizado', it.insumo_cod, { qtd: v })} /></td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtQtd(it.saida_direta)}</td>
                      <td className="px-3 py-2 text-right"><PencilCell value={it.desperdicio} fmt={fmtQtd} unidade={it.unidade || 'kg'} disabled={!podeEditarDesperd(it)} onSave={(v) => salvar('desperdicio', it.insumo_cod, { qtd: v })} /></td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtQtd(it.estoque_fim_teorico)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{<EstoqueCell valor={it.estoque_fim_real} comp={it.composicao} tipo="fim" />}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${it.desvio_qtd < -0.05 ? 'text-red-600 dark:text-red-400' : it.desvio_qtd > 0.05 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{it.desvio_qtd > 0 ? '+' : ''}{fmtQtd(it.desvio_qtd)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-semibold ${it.desvio_rs < -10 ? 'text-red-600 dark:text-red-400' : it.desvio_rs > 10 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{fmtBRL(it.desvio_rs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div></CardContent></Card>
          </TabsContent>

          <TabsContent value="analises" className="mt-0">
            <AbaAnalises />
          </TabsContent>
        </Tabs>
    </PageShell>
  );
}
