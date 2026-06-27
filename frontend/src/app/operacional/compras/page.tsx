'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { ShoppingCart, Search, ChevronDown, Loader2, ExternalLink, Tag, BarChart3, TrendingUp, Users, Package, ArrowRightLeft } from 'lucide-react';

const fmtBRL = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const primeiroDiaMes = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };
const hojeISO = () => new Date().toISOString().slice(0, 10);
const fmtPrazo = (d: string) => { const iso = String(d).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : String(d); };

const ORIGEM: Record<string, { txt: string; cls: string }> = {
  cotacao: { txt: 'Cotação', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  cotacao_homologada: { txt: 'Homologada', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  pedido_manual: { txt: 'Manual', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
};

// cor do status do pedido VMarket (id_pedido_status): 6=Entrega Confirmada, 1/2=em andamento, 9=cancelado
const corStatus = (id: number): string => {
  if (id === 6) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  if (id === 9) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  if (id === 1 || id === 2) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
};

export default function ComprasPage() {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const barId = selectedBar?.id;

  const [de, setDe] = useState(primeiroDiaMes());
  const [ate, setAte] = useState(hojeISO());
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [cotacoes, setCotacoes] = useState<any[]>([]);
  const [resumo, setResumo] = useState<any>(null);
  const [topForn, setTopForn] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [buscaProduto, setBuscaProduto] = useState('');
  const [produtoQ, setProdutoQ] = useState('');
  const [fornFiltro, setFornFiltro] = useState<string | null>(null);
  const [statusFiltro, setStatusFiltro] = useState<number | null>(null);
  const [aberto, setAberto] = useState<number | null>(null);
  const [itens, setItens] = useState<Record<number, any[]>>({});
  const [loadingItens, setLoadingItens] = useState<number | null>(null);
  const [tab, setTab] = useState('pedidos');
  const [analises, setAnalises] = useState<any>(null);
  const [loadingAn, setLoadingAn] = useState(false);

  const carregar = useCallback(async () => {
    if (!barId) return;
    setLoading(true);
    try {
      const r = await api.get(`/api/operacional/compras?bar_id=${barId}&de=${de}&ate=${ate}${produtoQ ? `&produto=${encodeURIComponent(produtoQ)}` : ''}`);
      if (r.success) {
        setPedidos(r.pedidos || []);
        setCotacoes(r.cotacoes || []);
        setResumo(r.resumo || null);
        setTopForn(r.topFornecedores || []);
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message || 'Falha ao carregar compras', variant: 'destructive' });
    } finally { setLoading(false); }
  }, [barId, de, ate, produtoQ, toast]);
  useEffect(() => { carregar(); }, [carregar]);
  // debounce da busca por produto (consulta o backend)
  useEffect(() => { const t = setTimeout(() => setProdutoQ(buscaProduto.trim()), 400); return () => clearTimeout(t); }, [buscaProduto]);

  // Análises (insights) — carrega sob demanda ao abrir a aba ou trocar o período
  const carregarAnalises = useCallback(async () => {
    if (!barId) return;
    setLoadingAn(true);
    try {
      const r = await api.get(`/api/operacional/compras?bar_id=${barId}&analises=1&de=${de}&ate=${ate}`);
      if (r.success) setAnalises(r.analises || null);
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message || 'Falha ao carregar análises', variant: 'destructive' });
    } finally { setLoadingAn(false); }
  }, [barId, de, ate, toast]);
  useEffect(() => { if (tab === 'analises') carregarAnalises(); }, [tab, carregarAnalises]);

  const abrir = async (id: number) => {
    if (aberto === id) { setAberto(null); return; }
    setAberto(id);
    if (!itens[id]) {
      setLoadingItens(id);
      try {
        const r = await api.get(`/api/operacional/compras?bar_id=${barId}&id_pedido=${id}`);
        if (r.success) setItens((m) => ({ ...m, [id]: r.itens || [] }));
      } catch (e: any) {
        toast({ title: 'Erro', description: e?.message || 'Falha ao carregar itens', variant: 'destructive' });
      } finally { setLoadingItens(null); }
    }
  };

  const statusList = useMemo(() => {
    const m = new Map<number, { id: number; nome: string; n: number }>();
    for (const p of pedidos) { const id = p.id_pedido_status; const o = m.get(id) || { id, nome: p.nm_status || `Status ${id}`, n: 0 }; o.n++; m.set(id, o); }
    return Array.from(m.values()).sort((a, b) => b.n - a.n);
  }, [pedidos]);

  const pedidosView = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return pedidos.filter((p) => {
      if (fornFiltro && p.fornecedor !== fornFiltro) return false;
      if (statusFiltro != null && p.id_pedido_status !== statusFiltro) return false;
      if (!q) return true;
      return (p.fornecedor || '').toLowerCase().includes(q) || (p.cnpj || '').includes(q) || String(p.id_pedido).includes(q);
    });
  }, [pedidos, busca, fornFiltro, statusFiltro]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl"><ShoppingCart className="w-6 h-6 text-indigo-600 dark:text-indigo-400" /></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Compras</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Pedidos e cotações (VMarket) · {selectedBar?.nome || `Bar ${barId ?? ''}`}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="w-auto" />
            <span className="text-gray-400">→</span>
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="w-auto" />
          </div>
        </div>

        {/* Resumo */}
        {resumo && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Total comprado</div><div className="text-xl font-bold">{fmtBRL(resumo.total_comprado)}</div></CardContent></Card>
            <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Pedidos</div><div className="text-xl font-bold">{resumo.n_pedidos}</div></CardContent></Card>
            <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Ticket médio</div><div className="text-xl font-bold">{fmtBRL(resumo.ticket_medio)}</div></CardContent></Card>
            <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Economia (cotações)</div><div className="text-xl font-bold text-emerald-600">{fmtBRL(resumo.economia_cotacoes)}</div></CardContent></Card>
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pedidos"><ShoppingCart className="w-4 h-4 mr-1.5" />Pedidos ({pedidos.length})</TabsTrigger>
            <TabsTrigger value="cotacoes"><Tag className="w-4 h-4 mr-1.5" />Cotações ({cotacoes.length})</TabsTrigger>
            <TabsTrigger value="analises"><BarChart3 className="w-4 h-4 mr-1.5" />Análises</TabsTrigger>
          </TabsList>

          {/* ===== ANÁLISES ===== */}
          <TabsContent value="analises" className="space-y-4">
            {loadingAn ? <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
            : !analises ? <Card><CardContent className="py-16 text-center text-gray-400">Sem dados de compras no período.</CardContent></Card>
            : <AnalisesCompras a={analises} />}
          </TabsContent>

          {/* ===== PEDIDOS ===== */}
          <TabsContent value="pedidos" className="space-y-3">
            {topForn.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {topForn.map((f) => (
                  <button key={f.fornecedor} onClick={() => setFornFiltro((x) => x === f.fornecedor ? null : f.fornecedor)}
                    className={`text-xs rounded-full px-2.5 py-1 border transition ${fornFiltro === f.fornecedor ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                    {f.fornecedor} <span className="opacity-70">· {fmtBRL(f.valor)}</span>
                  </button>
                ))}
              </div>
            )}
            {statusList.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {statusList.map((s) => (
                  <button key={s.id} onClick={() => setStatusFiltro((x) => x === s.id ? null : s.id)}
                    className={`text-[11px] rounded-full px-2.5 py-1 border transition ${statusFiltro === s.id ? `${corStatus(s.id)} ring-1 ring-offset-1 ring-gray-400 border-transparent` : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                    {s.nome} <span className="opacity-70">· {s.n}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por fornecedor, CNPJ ou nº do pedido…" className="pl-9" />
              </div>
              <div className="relative flex-1">
                <Tag className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input value={buscaProduto} onChange={(e) => setBuscaProduto(e.target.value)} placeholder="Buscar por produto (ex.: abacaxi)…" className="pl-9 pr-8" />
                {buscaProduto !== produtoQ && <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
              </div>
            </div>
            {produtoQ && !loading && <p className="text-xs text-gray-500">Mostrando {pedidosView.length} pedido(s) com &ldquo;{produtoQ}&rdquo;.</p>}

            <Card className="card-dark overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase">
                      <tr>
                        <th className="w-8 px-3 py-2"></th>
                        <th className="text-left font-medium px-3 py-2" title="Data do pedido (dt_inclusao)">Pedido</th>
                        <th className="text-left font-medium px-3 py-2" title="Data de entrega (dt_entrega)">Entrega</th>
                        <th className="text-left font-medium px-3 py-2">Fornecedor</th>
                        <th className="text-left font-medium px-3 py-2">Status</th>
                        <th className="text-left font-medium px-3 py-2">Origem</th>
                        <th className="text-right font-medium px-3 py-2">Itens</th>
                        <th className="text-right font-medium px-3 py-2">Valor</th>
                        <th className="w-8 px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {loading ? (
                        <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                      ) : pedidosView.length === 0 ? (
                        <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-400">Nenhum pedido no período.</td></tr>
                      ) : pedidosView.map((p) => {
                        const o = ORIGEM[p.origem] || { txt: p.origem || '—', cls: 'bg-gray-100 text-gray-600' };
                        return (
                          <Fragment key={p.id_pedido}>
                            <tr onClick={() => abrir(p.id_pedido)} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer">
                              <td className="px-3 py-2"><ChevronDown className={`w-4 h-4 transition-transform ${aberto === p.id_pedido ? 'rotate-180' : ''}`} /></td>
                              <td className="px-3 py-2 whitespace-nowrap">{fmtData(p.data)}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-gray-500">{p.dt_entrega ? fmtData(p.dt_entrega) : (p.dt_prazo_entrega ? <span className="italic text-gray-400" title="Previsão de entrega (dt_prazo_entrega)">prev. {fmtPrazo(p.dt_prazo_entrega)}</span> : '—')}</td>
                              <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{p.fornecedor}</td>
                              <td className="px-3 py-2"><span className={`text-[10px] rounded px-1.5 py-0.5 ${corStatus(p.id_pedido_status)}`}>{p.nm_status || '—'}</span></td>
                              <td className="px-3 py-2"><span className={`text-[10px] rounded px-1.5 py-0.5 ${o.cls}`}>{o.txt}</span></td>
                              <td className="px-3 py-2 text-right tabular-nums text-gray-500">{p.qtd_itens}</td>
                              <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtBRL(p.valor_total)}</td>
                              <td className="px-3 py-2 text-center">{p.url_nfe && <a href={p.url_nfe} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-indigo-500 hover:text-indigo-600"><ExternalLink className="w-3.5 h-3.5" /></a>}</td>
                            </tr>
                            {aberto === p.id_pedido && (
                              <tr className="bg-gray-50/60 dark:bg-gray-800/30">
                                <td colSpan={9} className="px-3 py-2">
                                  {loadingItens === p.id_pedido ? <div className="py-4 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></div>
                                  : (itens[p.id_pedido] || []).length === 0 ? <div className="py-3 text-center text-xs text-gray-400">Sem itens.</div>
                                  : (
                                    <table className="w-full text-xs">
                                      <thead className="text-gray-400"><tr>
                                        <th className="text-left font-medium px-2 py-1">Insumo</th>
                                        <th className="text-left font-medium px-2 py-1">Produto</th>
                                        <th className="text-left font-medium px-2 py-1">Seção</th>
                                        <th className="text-right font-medium px-2 py-1">Qtd</th>
                                        <th className="text-right font-medium px-2 py-1">Preço</th>
                                        <th className="text-right font-medium px-2 py-1">Total</th>
                                      </tr></thead>
                                      <tbody>
                                        {(itens[p.id_pedido] || []).map((it) => (
                                          <tr key={it.id_pedido_item} className="border-t border-gray-100 dark:border-gray-800">
                                            <td className="px-2 py-1 font-mono">{it.cod_interno || <span className="text-amber-500">—</span>}</td>
                                            <td className="px-2 py-1">{it.nome || it.nome_cotacao || '—'}{it.marca_cotacao ? <span className="text-gray-400"> · {it.marca_cotacao}</span> : ''}</td>
                                            <td className="px-2 py-1 text-gray-500">{it.nome_secao || '—'}</td>
                                            <td className="px-2 py-1 text-right tabular-nums">{Number(it.quantidade || 0).toLocaleString('pt-BR')}{it.gramatura_cotacao ? ` ${it.gramatura_cotacao}` : ''}</td>
                                            <td className="px-2 py-1 text-right tabular-nums">{fmtBRL(it.preco)}</td>
                                            <td className="px-2 py-1 text-right tabular-nums font-medium">{fmtBRL(it.total)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== COTAÇÕES ===== */}
          <TabsContent value="cotacoes">
            <Card className="card-dark overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">Data</th>
                        <th className="text-left font-medium px-3 py-2">Cotação</th>
                        <th className="text-left font-medium px-3 py-2">Fornecedor</th>
                        <th className="text-left font-medium px-3 py-2">Status</th>
                        <th className="text-right font-medium px-3 py-2">Economia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {loading ? (
                        <tr><td colSpan={5} className="px-3 py-10 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                      ) : cotacoes.length === 0 ? (
                        <tr><td colSpan={5} className="px-3 py-10 text-center text-gray-400">Nenhuma cotação no período.</td></tr>
                      ) : cotacoes.map((c) => (
                        <tr key={c.id_cotacao_sisfood} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="px-3 py-2 whitespace-nowrap">{fmtData(c.data)}</td>
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{c.nome || `#${c.id_cotacao_sisfood}`}</td>
                          <td className="px-3 py-2 text-gray-500">{c.fornecedor || '—'}</td>
                          <td className="px-3 py-2"><span className={`text-[10px] rounded px-1.5 py-0.5 ${c.cotacao_fechada ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>{c.cotacao_fechada ? 'Fechada' : 'Aberta'}</span></td>
                          <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{fmtBRL(c.valor_economizado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

const fmtNum = (v: any) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

function AnalisesCompras({ a }: { a: any }) {
  const h = a?.headline || {};
  const topForn: any[] = a?.top_fornecedores || [];
  const topProd: any[] = a?.top_produtos || [];
  const subiu: any[] = a?.subiu_preco || [];
  const comp: any[] = a?.comparativo_fornecedor || [];
  const maxForn = Math.max(1, ...topForn.map((f) => Number(f.valor) || 0));
  const maxProd = Math.max(1, ...topProd.map((p) => Number(p.valor) || 0));

  return (
    <div className="space-y-4">
      {/* Headline */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Total comprado</div><div className="text-xl font-bold text-blue-600 dark:text-blue-400">{fmtBRL(h.valor_total)}</div></CardContent></Card>
        <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Pedidos</div><div className="text-xl font-bold">{h.n_pedidos ?? 0}</div></CardContent></Card>
        <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Fornecedores</div><div className="text-xl font-bold">{h.n_fornecedores ?? 0}</div></CardContent></Card>
        <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Ticket médio</div><div className="text-xl font-bold">{fmtBRL(h.ticket_medio)}</div></CardContent></Card>
        <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Economia cotação</div><div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{fmtBRL(h.economia_cotacao)}</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Fornecedores */}
        <Card><CardContent className="p-0">
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2 text-sm font-semibold"><Users className="w-4 h-4 text-indigo-500" />Top 10 fornecedores</div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {topForn.length === 0 ? <div className="px-4 py-6 text-center text-sm text-gray-400">Sem dados.</div> : topForn.map((f, i) => (
              <div key={f.fornecedor} className="px-4 py-2 relative">
                <div className="absolute inset-y-0 left-0 bg-indigo-50 dark:bg-indigo-900/10" style={{ width: `${(Number(f.valor) / maxForn) * 100}%` }} />
                <div className="relative flex items-center justify-between gap-2">
                  <div className="min-w-0"><span className="text-gray-400 text-xs mr-1.5">{i + 1}.</span><span className="text-sm text-gray-800 dark:text-gray-100 truncate">{f.fornecedor}</span>
                    <span className="block text-[11px] text-gray-400">{f.n_pedidos} pedidos · ticket {fmtBRL(f.ticket)}</span></div>
                  <span className="text-sm font-semibold tabular-nums whitespace-nowrap">{fmtBRL(f.valor)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent></Card>

        {/* Top Produtos */}
        <Card><CardContent className="p-0">
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2 text-sm font-semibold"><Package className="w-4 h-4 text-violet-500" />Top 10 produtos</div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {topProd.length === 0 ? <div className="px-4 py-6 text-center text-sm text-gray-400">Sem dados.</div> : topProd.map((p, i) => (
              <div key={p.nome + i} className="px-4 py-2 relative">
                <div className="absolute inset-y-0 left-0 bg-violet-50 dark:bg-violet-900/10" style={{ width: `${(Number(p.valor) / maxProd) * 100}%` }} />
                <div className="relative flex items-center justify-between gap-2">
                  <div className="min-w-0"><span className="text-gray-400 text-xs mr-1.5">{i + 1}.</span><span className="text-sm text-gray-800 dark:text-gray-100 truncate">{p.nome}</span>
                    <span className="block text-[11px] text-gray-400">{fmtNum(p.qtd)} un · {p.n_compras} compras · méd {fmtBRL(p.preco_medio)}</span></div>
                  <span className="text-sm font-semibold tabular-nums whitespace-nowrap">{fmtBRL(p.valor)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent></Card>
      </div>

      {/* Subiu de preço */}
      <Card><CardContent className="p-0">
        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2 text-sm font-semibold"><TrendingUp className="w-4 h-4 text-red-500" />Produtos que subiram de preço<span className="text-xs font-normal text-gray-400">(1ª × última compra no período · exclui troca de unidade)</span></div>
        {subiu.length === 0 ? <div className="px-4 py-6 text-center text-sm text-gray-400">Nenhuma alta de preço relevante no período.</div> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="text-xs text-gray-500 border-b border-gray-100 dark:border-gray-800"><tr>
              <th className="text-left font-medium px-4 py-2">Produto</th>
              <th className="text-right font-medium px-3 py-2">Preço inicial</th>
              <th className="text-right font-medium px-3 py-2">Preço atual</th>
              <th className="text-right font-medium px-4 py-2">Variação</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {subiu.map((s, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-2 text-gray-800 dark:text-gray-100">{s.nome}<span className="block text-[11px] text-gray-400">{fmtData(s.data_ini)} → {fmtData(s.data_fim)}</span></td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtBRL(s.preco_ini)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(s.preco_fim)}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold text-red-600 dark:text-red-400">+{fmtNum(s.var_pct)}%</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </CardContent></Card>

      {/* Comparativo de fornecedores */}
      <Card><CardContent className="p-0">
        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2 text-sm font-semibold"><ArrowRightLeft className="w-4 h-4 text-amber-500" />Mesmo insumo, fornecedores diferentes<span className="text-xs font-normal text-gray-400">(oportunidade de economia)</span></div>
        {comp.length === 0 ? <div className="px-4 py-6 text-center text-sm text-gray-400">Sem insumo comprado de 2+ fornecedores no período.</div> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="text-xs text-gray-500 border-b border-gray-100 dark:border-gray-800"><tr>
              <th className="text-left font-medium px-4 py-2">Insumo</th>
              <th className="text-left font-medium px-3 py-2">Mais barato</th>
              <th className="text-right font-medium px-3 py-2">Menor</th>
              <th className="text-left font-medium px-3 py-2">Mais caro</th>
              <th className="text-right font-medium px-3 py-2">Maior</th>
              <th className="text-right font-medium px-4 py-2">Diferença</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {comp.map((c, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-2 text-gray-800 dark:text-gray-100">{c.nome}<span className="text-gray-400 font-mono text-[11px]"> · {c.cod_interno}</span></td>
                  <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400 text-xs truncate max-w-[180px]">{c.forn_barato}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{fmtBRL(c.menor)}</td>
                  <td className="px-3 py-2 text-red-600 dark:text-red-400 text-xs truncate max-w-[180px]">{c.forn_caro}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">{fmtBRL(c.maior)}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">+{fmtNum(c.spread_pct)}%</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </CardContent></Card>
    </div>
  );
}
