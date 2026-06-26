'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { ShoppingCart, Search, ChevronDown, Loader2, ExternalLink, Tag } from 'lucide-react';

const fmtBRL = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const primeiroDiaMes = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };
const hojeISO = () => new Date().toISOString().slice(0, 10);

const ORIGEM: Record<string, { txt: string; cls: string }> = {
  cotacao: { txt: 'Cotação', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  cotacao_homologada: { txt: 'Homologada', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  pedido_manual: { txt: 'Manual', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
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
  const [aberto, setAberto] = useState<number | null>(null);
  const [itens, setItens] = useState<Record<number, any[]>>({});
  const [loadingItens, setLoadingItens] = useState<number | null>(null);

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

  const pedidosView = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return pedidos.filter((p) => {
      if (fornFiltro && p.fornecedor !== fornFiltro) return false;
      if (!q) return true;
      return (p.fornecedor || '').toLowerCase().includes(q) || (p.cnpj || '').includes(q) || String(p.id_pedido).includes(q);
    });
  }, [pedidos, busca, fornFiltro]);

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

        <Tabs defaultValue="pedidos">
          <TabsList>
            <TabsTrigger value="pedidos"><ShoppingCart className="w-4 h-4 mr-1.5" />Pedidos ({pedidos.length})</TabsTrigger>
            <TabsTrigger value="cotacoes"><Tag className="w-4 h-4 mr-1.5" />Cotações ({cotacoes.length})</TabsTrigger>
          </TabsList>

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
                        <th className="text-left font-medium px-3 py-2">Data</th>
                        <th className="text-left font-medium px-3 py-2">Fornecedor</th>
                        <th className="text-left font-medium px-3 py-2">Origem</th>
                        <th className="text-right font-medium px-3 py-2">Itens</th>
                        <th className="text-right font-medium px-3 py-2">Valor</th>
                        <th className="w-8 px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {loading ? (
                        <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                      ) : pedidosView.length === 0 ? (
                        <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400">Nenhum pedido no período.</td></tr>
                      ) : pedidosView.map((p) => {
                        const o = ORIGEM[p.origem] || { txt: p.origem || '—', cls: 'bg-gray-100 text-gray-600' };
                        return (
                          <Fragment key={p.id_pedido}>
                            <tr onClick={() => abrir(p.id_pedido)} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer">
                              <td className="px-3 py-2"><ChevronDown className={`w-4 h-4 transition-transform ${aberto === p.id_pedido ? 'rotate-180' : ''}`} /></td>
                              <td className="px-3 py-2 whitespace-nowrap">{fmtData(p.data)}</td>
                              <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{p.fornecedor}</td>
                              <td className="px-3 py-2"><span className={`text-[10px] rounded px-1.5 py-0.5 ${o.cls}`}>{o.txt}</span></td>
                              <td className="px-3 py-2 text-right tabular-nums text-gray-500">{p.qtd_itens}</td>
                              <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtBRL(p.valor_total)}</td>
                              <td className="px-3 py-2 text-center">{p.url_nfe && <a href={p.url_nfe} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-indigo-500 hover:text-indigo-600"><ExternalLink className="w-3.5 h-3.5" /></a>}</td>
                            </tr>
                            {aberto === p.id_pedido && (
                              <tr className="bg-gray-50/60 dark:bg-gray-800/30">
                                <td colSpan={7} className="px-3 py-2">
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
                                            <td className="px-2 py-1">{it.nome_cotacao}{it.marca_cotacao ? <span className="text-gray-400"> · {it.marca_cotacao}</span> : ''}</td>
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
