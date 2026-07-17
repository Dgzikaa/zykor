'use client';

/**
 * Consulta de Vendas por Produto — espelho do "sintético" do ContaHub, com filtros que
 * o CH não tem: grupo, local, garçom, tipo de venda, busca por produto. Fonte:
 * gold.gold_contahub_avendas_porproduto_analitico (RPC gold.consulta_vendas_produtos).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Download, Search, Filter, Check } from 'lucide-react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { toast } from 'sonner';

interface LinhaAgregada {
  produto: string;
  grupo: string | null;
  qtd: number;
  valor: number;
  desconto: number;
  custo: number;
  linhas: number;
  ticket_medio: number;
}

interface Resposta {
  success: boolean;
  total: { qtd: number; valor: number; desconto: number; custo: number; linhas: number; produtos: number };
  agregado: LinhaAgregada[];
  filtros: { grupos: string[]; locais: string[]; garcons: string[]; tipos: string[] };
}

const moeda = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v: number) => (v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const iso = (d: Date) => d.toISOString().slice(0, 10);

const PRESETS = [
  { k: 'hoje', l: 'Hoje' },
  { k: 'ontem', l: 'Ontem' },
  { k: 'semana', l: 'Semana' },
  { k: 'mes', l: 'Mês' },
  { k: 'mesPassado', l: 'Mês passado' },
  { k: 'd30', l: '30 dias' },
];

// Multiselect compacto com chips (buscável). Fecha ao clicar fora.
function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (n: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter((o) => o.toLowerCase().includes(t)) : options;
  }, [options, q]);
  const toggle = (v: string) => {
    const n = new Set(selected);
    if (n.has(v)) n.delete(v); else n.add(v);
    onChange(n);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-xs text-left hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <Filter className="w-3 h-3 text-gray-400" />
        <span className="flex-1 truncate">
          {label}
          {selected.size > 0 && (
            <span className="ml-1 text-[10px] rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1">
              {selected.size}
            </span>
          )}
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 w-64 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="h-8 text-xs" />
            <div className="flex items-center justify-between px-1 py-1 text-[11px] text-gray-500">
              <button className="hover:text-emerald-600" onClick={() => onChange(new Set(options))}>
                Todos
              </button>
              <span>
                {selected.size ? `${selected.size} sel.` : `${options.length} valores`}
              </span>
              <button className="hover:text-red-600" onClick={() => onChange(new Set())}>
                Limpar
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-2 py-3 text-center text-xs text-gray-400">Nada</div>
              ) : (
                filtered.map((o) => {
                  const on = selected.has(o);
                  return (
                    <button
                      key={o}
                      onClick={() => toggle(o)}
                      className="w-full flex items-center gap-2 px-2 py-1 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
                    >
                      <span
                        className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${
                          on ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {on && <Check className="w-3 h-3" />}
                      </span>
                      <span className="flex-1 truncate">{o}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function VendasProdutosPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();
  useEffect(() => setPageTitle('🛒 Consulta de Vendas de Produtos'), [setPageTitle]);

  const hoje = new Date();
  const primeiroDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const [di, setDi] = useState(iso(primeiroDoMes));
  const [df, setDf] = useState(iso(hoje));
  const [presetAtivo, setPresetAtivo] = useState('mes');

  const [produtoQ, setProdutoQ] = useState('');
  const [grupos, setGrupos] = useState<Set<string>>(new Set());
  const [locais, setLocais] = useState<Set<string>>(new Set());
  const [garcons, setGarcons] = useState<Set<string>>(new Set());
  const [tipos, setTipos] = useState<Set<string>>(new Set());

  const [resp, setResp] = useState<Resposta | null>(null);
  const [loading, setLoading] = useState(false);
  const [ordem, setOrdem] = useState<{ campo: keyof LinhaAgregada; dir: 'asc' | 'desc' }>({ campo: 'valor', dir: 'desc' });

  const setPreset = (k: string) => {
    const h = new Date();
    const set = (a: Date, b: Date) => { setDi(iso(a)); setDf(iso(b)); };
    if (k === 'hoje') set(h, h);
    else if (k === 'ontem') { const o = new Date(h); o.setDate(h.getDate() - 1); set(o, o); }
    else if (k === 'semana') { const s = new Date(h); s.setDate(h.getDate() - ((h.getDay() + 6) % 7)); set(s, h); }
    else if (k === 'mes') set(new Date(h.getFullYear(), h.getMonth(), 1), h);
    else if (k === 'mesPassado') set(new Date(h.getFullYear(), h.getMonth() - 1, 1), new Date(h.getFullYear(), h.getMonth(), 0));
    else { const d = new Date(h); d.setDate(h.getDate() - 29); set(d, h); }
    setPresetAtivo(k);
  };

  const carregar = useCallback(async () => {
    if (!selectedBar) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ data_inicio: di, data_fim: df });
      if (produtoQ.trim()) qs.set('produto', produtoQ.trim());
      if (grupos.size) qs.set('grupos', Array.from(grupos).join(','));
      if (locais.size) qs.set('locais', Array.from(locais).join(','));
      if (garcons.size) qs.set('garcons', Array.from(garcons).join(','));
      if (tipos.size) qs.set('tipos', Array.from(tipos).join(','));

      const r = await fetch(`/api/ferramentas/vendas-produtos?${qs.toString()}`, {
        headers: { 'x-selected-bar-id': String(selectedBar.id) },
      });
      const j: Resposta = await r.json();
      if (!j.success) {
        toast.error('Erro ao consultar');
        return;
      }
      setResp(j);
    } catch {
      toast.error('Erro ao consultar');
    } finally {
      setLoading(false);
    }
  }, [selectedBar, di, df, produtoQ, grupos, locais, garcons, tipos]);

  useEffect(() => { carregar(); }, [carregar]);

  const linhasOrdenadas = useMemo(() => {
    const arr = [...(resp?.agregado ?? [])];
    const { campo, dir } = ordem;
    arr.sort((a, b) => {
      const va = a[campo] as any;
      const vb = b[campo] as any;
      if (typeof va === 'string' || typeof vb === 'string') {
        return (dir === 'asc' ? 1 : -1) * String(va || '').localeCompare(String(vb || ''), 'pt-BR');
      }
      return (dir === 'asc' ? 1 : -1) * ((va || 0) - (vb || 0));
    });
    return arr;
  }, [resp, ordem]);

  const sortBy = (campo: keyof LinhaAgregada) =>
    setOrdem((o) => (o.campo === campo ? { campo, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: 'desc' }));
  const seta = (campo: keyof LinhaAgregada) =>
    ordem.campo === campo ? (ordem.dir === 'asc' ? ' ↑' : ' ↓') : '';

  const exportarCsv = () => {
    if (linhasOrdenadas.length === 0) return;
    const head = ['Produto', 'Grupo', 'Qtd', 'Valor', 'Desconto', 'Custo', 'Ticket médio', 'Lançamentos'];
    const rows = linhasOrdenadas.map((l) => [
      l.produto, l.grupo || '', l.qtd, l.valor, l.desconto, l.custo, l.ticket_medio, l.linhas,
    ]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendas-produtos_${di}_${df}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const total = resp?.total;

  return (
    <div className="p-4 space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-[11px] text-gray-500 block">Período</label>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.k}
                    onClick={() => setPreset(p.k)}
                    className={`rounded-md border px-2 py-1 text-xs ${
                      presetAtivo === p.k
                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white'
                        : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {p.l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] text-gray-500 block">De</label>
              <Input type="date" value={di} onChange={(e) => { setDi(e.target.value); setPresetAtivo(''); }} className="input-dark w-[9.5rem]" />
            </div>
            <div>
              <label className="text-[11px] text-gray-500 block">Até</label>
              <Input type="date" value={df} onChange={(e) => { setDf(e.target.value); setPresetAtivo(''); }} className="input-dark w-[9.5rem]" />
            </div>
            <Button variant="outline" size="icon" onClick={carregar} disabled={loading} title="Atualizar">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <label className="text-[11px] text-gray-500 block">Buscar produto</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Ex.: Parmegiana"
                  value={produtoQ}
                  onChange={(e) => setProdutoQ(e.target.value)}
                  className="input-dark pl-8"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-gray-500 block">Grupo</label>
              <MultiSelect label="Todos" options={resp?.filtros.grupos ?? []} selected={grupos} onChange={setGrupos} />
            </div>
            <div>
              <label className="text-[11px] text-gray-500 block">Local</label>
              <MultiSelect label="Todos" options={resp?.filtros.locais ?? []} selected={locais} onChange={setLocais} />
            </div>
            <div>
              <label className="text-[11px] text-gray-500 block">Garçom</label>
              <MultiSelect label="Todos" options={resp?.filtros.garcons ?? []} selected={garcons} onChange={setGarcons} />
            </div>
            <div>
              <label className="text-[11px] text-gray-500 block">Tipo de venda</label>
              <MultiSelect label="Todos" options={resp?.filtros.tipos ?? []} selected={tipos} onChange={setTipos} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Totais */}
      {total && (
        <div className="flex flex-wrap gap-2">
          <Card className="flex-1 min-w-[160px]">
            <CardContent className="p-3">
              <p className="text-xs text-gray-400">Valor total</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{moeda(total.valor)}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">desconto {moeda(total.desconto)}</p>
            </CardContent>
          </Card>
          <Card className="flex-1 min-w-[160px]">
            <CardContent className="p-3">
              <p className="text-xs text-gray-400">Quantidade</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{num(total.qtd)}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {total.produtos.toLocaleString('pt-BR')} produtos · {total.linhas.toLocaleString('pt-BR')} lançamentos
              </p>
            </CardContent>
          </Card>
          <Card className="flex-1 min-w-[160px]">
            <CardContent className="p-3">
              <p className="text-xs text-gray-400">Custo total</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{moeda(total.custo)}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                margem {total.valor > 0 ? `${(((total.valor - total.custo) / total.valor) * 100).toFixed(1)}%` : '-'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ações da tabela */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {linhasOrdenadas.length.toLocaleString('pt-BR')} produto(s)
        </p>
        <Button variant="outline" size="sm" onClick={exportarCsv} disabled={linhasOrdenadas.length === 0}>
          <Download className="w-4 h-4 mr-1" />
          CSV
        </Button>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400">
              <tr>
                <th onClick={() => sortBy('produto')} className="text-left font-medium px-3 py-2 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200">
                  Produto{seta('produto')}
                </th>
                <th onClick={() => sortBy('grupo')} className="text-left font-medium px-3 py-2 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200">
                  Grupo{seta('grupo')}
                </th>
                <th onClick={() => sortBy('qtd')} className="text-right font-medium px-3 py-2 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200">
                  Qtd{seta('qtd')}
                </th>
                <th onClick={() => sortBy('valor')} className="text-right font-medium px-3 py-2 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200">
                  Valor{seta('valor')}
                </th>
                <th onClick={() => sortBy('desconto')} className="text-right font-medium px-3 py-2 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200">
                  Desconto{seta('desconto')}
                </th>
                <th onClick={() => sortBy('custo')} className="text-right font-medium px-3 py-2 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200">
                  Custo{seta('custo')}
                </th>
                <th onClick={() => sortBy('ticket_medio')} className="text-right font-medium px-3 py-2 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200">
                  Ticket médio{seta('ticket_medio')}
                </th>
                <th onClick={() => sortBy('linhas')} className="text-right font-medium px-3 py-2 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200">
                  Lanç.{seta('linhas')}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-400">Carregando…</td>
                </tr>
              ) : linhasOrdenadas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-400">Nenhum produto no período/filtros.</td>
                </tr>
              ) : (
                linhasOrdenadas.map((l, i) => (
                  <tr key={i} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-3 py-1.5 text-gray-800 dark:text-gray-100">{l.produto}</td>
                    <td className="px-3 py-1.5 text-gray-500">{l.grupo || '-'}</td>
                    <td className="px-3 py-1.5 text-right text-gray-700 dark:text-gray-200 whitespace-nowrap tabular-nums">{num(l.qtd)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap tabular-nums">{moeda(l.valor)}</td>
                    <td className="px-3 py-1.5 text-right text-gray-500 whitespace-nowrap tabular-nums">{moeda(l.desconto)}</td>
                    <td className="px-3 py-1.5 text-right text-gray-500 whitespace-nowrap tabular-nums">{moeda(l.custo)}</td>
                    <td className="px-3 py-1.5 text-right text-gray-500 whitespace-nowrap tabular-nums">{moeda(l.ticket_medio)}</td>
                    <td className="px-3 py-1.5 text-right text-gray-400 tabular-nums">{l.linhas.toLocaleString('pt-BR')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
