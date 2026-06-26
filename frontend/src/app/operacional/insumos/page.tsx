'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Package, RefreshCw, Search, Boxes, TrendingUp, TrendingDown, Loader2, ChevronDown } from 'lucide-react';

const fmtBRL = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '';

interface Produto {
  id_produto_sisfood_cotacao: number; cod_interno: string | null; nome: string | null; marca: string | null;
  gramatura: string | null; estoque: number | null; nome_secao: string | null; id_secao_cotacao: number | null;
  nome_fornecedor: string | null; fornecedor_ultimo: string | null; preco_atual: number | null; preco_anterior: number | null; preco_data: string | null;
  cod_duplicado?: boolean; cod_invalido?: boolean; base?: string | null; embalagem?: number | null; fonte?: string;
}
interface Secao { id_secao_cotacao: number; nome: string | null; }

export default function CadastrosPage() {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const barId = selectedBar?.id;

  // ---------- INSUMOS (catálogo VMarket) ----------
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [syncedEm, setSyncedEm] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [secaoSel, setSecaoSel] = useState<string>('todas');

  const carregar = useCallback(async () => {
    if (!barId) return;
    setLoading(true);
    try {
      const r = await api.get(`/api/operacional/insumos?bar_id=${barId}`);
      if (r.success) { setProdutos(r.produtos || []); setSecoes(r.secoes || []); setSyncedEm(r.synced_em || null); }
    } catch (e: any) { toast({ title: 'Erro', description: e?.message || 'Falha ao carregar insumos', variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [barId, toast]);
  useEffect(() => { carregar(); }, [carregar]);

  const sincronizar = async () => {
    if (!barId) return;
    setSincronizando(true);
    try {
      const r = await api.post('/api/operacional/insumos', { bar_id: barId, action: 'sync' });
      if (!r.success) throw new Error(r.error || 'Falha no sync');
      const res = r.resultado || {};
      toast({ title: 'VMarket sincronizado', description: `${res.produtos ?? 0} produtos · ${res.secoes ?? 0} seções` });
      await carregar();
    } catch (e: any) { toast({ title: 'Erro no sync', description: e?.message || 'Falha', variant: 'destructive' }); }
    finally { setSincronizando(false); }
  };

  // Materiais (limpeza/descartáveis/outros: tabaco, impostos, frete) não são insumos — viram um FILTRO
  const ehMaterial = (s: string | null) => /limpeza|descart|outros/i.test(s || '');
  const [filtroEsp, setFiltroEsp] = useState<'variacoes' | 'invalido' | 'materiais' | null>(null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return produtos.filter(p => {
      if (secaoSel !== 'todas' && String(p.id_secao_cotacao) !== secaoSel) return false;
      if (!q) return true;
      return (p.nome || '').toLowerCase().includes(q) || (p.cod_interno || '').toLowerCase().includes(q)
        || (p.fornecedor_ultimo || '').toLowerCase().includes(q);
    });
  }, [produtos, busca, secaoSel]);

  const salvarUnidade = async (p: Produto, patch: { base?: string; embalagem?: number }) => {
    setProdutos(prev => prev.map(x => x.id_produto_sisfood_cotacao === p.id_produto_sisfood_cotacao ? { ...x, ...patch } : x));
    try {
      await api.post('/api/operacional/insumos', {
        bar_id: barId, action: 'unidade', id_prod: p.id_produto_sisfood_cotacao, cod_interno: p.cod_interno,
        base: patch.base ?? p.base ?? 'g', embalagem: patch.embalagem ?? p.embalagem ?? 1,
      });
    } catch (e: any) { toast({ title: 'Erro ao salvar unidade', description: e?.message, variant: 'destructive' }); }
  };

  // Agrupa por código (mesmo i0XXX = mesmo insumo, várias descrições/fornecedores no VMarket)
  const [codAberto, setCodAberto] = useState<string | null>(null);
  const grupos = useMemo(() => {
    const m = new Map<string, Produto[]>();
    for (const p of filtrados) {
      const ok = p.cod_interno && /^i\d/.test(p.cod_interno);
      const key = ok ? `c:${p.cod_interno}` : `u:${p.id_produto_sisfood_cotacao}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(p);
    }
    return Array.from(m.entries()).map(([key, prods]) => {
      const rep = [...prods].sort((a, b) => String(b.preco_data || '').localeCompare(String(a.preco_data || '')))[0];
      return { key, rep, produtos: prods, nVar: prods.length, isMaterial: ehMaterial(rep.nome_secao) };
    }).sort((a, b) => String(a.rep.nome || '').localeCompare(String(b.rep.nome || '')));
  }, [filtrados]);
  const nInsumos = grupos.filter(g => !g.isMaterial).length;
  const nMateriais = grupos.filter(g => g.isMaterial).length;
  const nVariacoes = grupos.filter(g => !g.isMaterial && g.nVar > 1).length;
  const nInvalidos = grupos.filter(g => !g.isMaterial && g.rep.cod_invalido).length;
  const gruposView = useMemo(() => {
    if (filtroEsp === 'materiais') return grupos.filter(g => g.isMaterial);
    if (filtroEsp === 'variacoes') return grupos.filter(g => !g.isMaterial && g.nVar > 1);
    if (filtroEsp === 'invalido') return grupos.filter(g => !g.isMaterial && g.rep.cod_invalido);
    return grupos.filter(g => !g.isMaterial);
  }, [grupos, filtroEsp]);

  // ---------- VARIAÇÃO DE PREÇO ----------
  const [variacao, setVariacao] = useState<any[]>([]);
  const [loadingVar, setLoadingVar] = useState(false);
  const [varAberto, setVarAberto] = useState<number | null>(null);
  const [serie, setSerie] = useState<Record<number, any[]>>({});
  const carregarVariacao = useCallback(async () => {
    if (!barId) return; setLoadingVar(true);
    try { const r = await api.get(`/api/operacional/insumos/precos?bar_id=${barId}`); if (r.success) setVariacao(r.insumos || []); }
    catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
    finally { setLoadingVar(false); }
  }, [barId, toast]);
  useEffect(() => { carregarVariacao(); }, [carregarVariacao]);
  const abrirSerie = async (id: number) => {
    if (varAberto === id) { setVarAberto(null); return; }
    setVarAberto(id);
    if (!serie[id]) {
      try { const r = await api.get(`/api/operacional/insumos/precos?bar_id=${barId}&id_prod=${id}`); if (r.success) setSerie(m => ({ ...m, [id]: r.serie || [] })); } catch { /* */ }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl"><Package className="w-6 h-6 text-emerald-600 dark:text-emerald-400" /></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Insumos</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Catálogo de insumos e variação de preço · {selectedBar?.nome || `Bar ${barId ?? ''}`}{syncedEm && <> · sync {new Date(syncedEm).toLocaleString('pt-BR')}</>}</p>
            </div>
          </div>
          <Button onClick={sincronizar} disabled={sincronizando || !barId} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${sincronizando ? 'animate-spin' : ''}`} />{sincronizando ? 'Sincronizando…' : 'Sincronizar VMarket'}
          </Button>
        </div>

        <Tabs defaultValue="insumos">
          <TabsList>
            <TabsTrigger value="insumos"><Boxes className="w-4 h-4 mr-1.5" />Insumos</TabsTrigger>
            <TabsTrigger value="variacao"><TrendingUp className="w-4 h-4 mr-1.5" />Variação de Preço</TabsTrigger>
          </TabsList>

          {/* ===== INSUMOS (VMarket) ===== */}
          <TabsContent value="insumos" className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, código (i0XXX), marca ou fornecedor…" className="pl-9" />
              </div>
              <select value={secaoSel} onChange={e => setSecaoSel(e.target.value)} className="h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100">
                <option value="todas">Todas as seções ({produtos.length})</option>
                {secoes.map(s => <option key={s.id_secao_cotacao} value={String(s.id_secao_cotacao)}>{s.nome}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <button onClick={() => setFiltroEsp(null)}><Badge variant="outline" className={`cursor-pointer ${!filtroEsp ? 'ring-1 ring-emerald-400' : ''}`}>{nInsumos} insumos</Badge></button>
              {nVariacoes > 0 && <button onClick={() => setFiltroEsp(f => f === 'variacoes' ? null : 'variacoes')}><Badge variant="outline" className={`cursor-pointer text-blue-600 border-blue-300 ${filtroEsp === 'variacoes' ? 'ring-1 ring-blue-400' : ''}`}>{nVariacoes} com variações</Badge></button>}
              {nInvalidos > 0 && <button onClick={() => setFiltroEsp(f => f === 'invalido' ? null : 'invalido')}><Badge variant="outline" className={`cursor-pointer text-red-600 border-red-300 ${filtroEsp === 'invalido' ? 'ring-1 ring-red-400' : ''}`}>{nInvalidos} com código inválido</Badge></button>}
              {nMateriais > 0 && <button onClick={() => setFiltroEsp(f => f === 'materiais' ? null : 'materiais')}><Badge variant="outline" className={`cursor-pointer text-gray-500 ${filtroEsp === 'materiais' ? 'ring-1 ring-gray-400' : ''}`}>{nMateriais} materiais</Badge></button>}
            </div>
            <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
                  <th className="text-left font-medium px-3 py-2">Cód.</th>
                  <th className="text-left font-medium px-3 py-2">Insumo</th>
                  <th className="text-left font-medium px-3 py-2">Seção</th>
                  <th className="text-center font-medium px-3 py-2">Unid. medida</th>
                  <th className="text-right font-medium px-3 py-2" title="Quantidade da unidade-base na embalagem de compra (ex.: 1000 g = 1 kg, 5000 ml = 5 L)">Quantidade</th>
                  <th className="text-right font-medium px-3 py-2">Preço (últ.)</th>
                  <th className="text-left font-medium px-3 py-2">Fornecedor</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {loading ? <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                  : gruposView.length === 0 ? <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400">Nenhum insumo.</td></tr>
                  : gruposView.map(g => {
                    const p = g.rep;
                    const subiu = p.preco_anterior != null && p.preco_atual != null && p.preco_atual > p.preco_anterior;
                    const caiu = p.preco_anterior != null && p.preco_atual != null && p.preco_atual < p.preco_anterior;
                    const aberto = codAberto === g.key;
                    return (
                      <Fragment key={g.key}>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="px-3 py-2 font-mono text-xs">
                            {p.cod_invalido ? <span className="text-red-500" title="Código inválido no VMarket (não é i0XXX)">⚠ {p.cod_interno}</span>
                              : p.cod_interno ? <span className="text-gray-600 dark:text-gray-300">{p.cod_interno}</span>
                              : <span className="text-amber-500">—</span>}
                          </td>
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                            {g.nVar > 1 ? (
                              <button onClick={() => setCodAberto(aberto ? null : g.key)} className="flex items-center gap-1 text-left hover:text-indigo-600">
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${aberto ? 'rotate-180' : ''}`} />
                                {p.nome} <span className="text-[10px] rounded-full px-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{g.nVar} variações</span>
                              </button>
                            ) : p.nome}
                          </td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{p.nome_secao || '—'}</td>
                          <td className="px-3 py-2 text-center">
                            <select value={p.base || 'g'} onChange={e => salvarUnidade(p, { base: e.target.value })}
                              className="h-7 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 text-xs">
                              <option value="g">g</option><option value="ml">ml</option><option value="un">un</option>
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input type="number" step="0.001" key={`${p.id_produto_sisfood_cotacao}-${p.embalagem}`} defaultValue={p.embalagem ?? 1}
                              onBlur={e => { const v = Number(e.target.value) || 1; if (v !== (p.embalagem ?? 1)) salvarUnidade(p, { embalagem: v }); }}
                              className="h-7 w-20 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 text-xs text-right" />
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap">
                            {fmtBRL(p.preco_atual)}
                            {p.preco_atual != null && (p.fonte === 'planilha'
                              ? <span className="text-[10px] rounded px-1 ml-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" title="Preço da planilha (ainda sem compra no VMarket)">planilha</span>
                              : <span className="text-[10px] rounded px-1 ml-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" title="Última compra no VMarket">VMarket</span>)}
                            {subiu && <TrendingUp className="inline w-3 h-3 ml-1 text-red-500" />}
                            {caiu && <TrendingDown className="inline w-3 h-3 ml-1 text-emerald-500" />}
                          </td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{p.fornecedor_ultimo || '—'}</td>
                        </tr>
                        {aberto && g.produtos.map(v => (
                          <tr key={v.id_produto_sisfood_cotacao} className="bg-gray-50/60 dark:bg-gray-800/30 text-xs">
                            <td></td>
                            <td className="px-3 py-1 pl-7 text-gray-600 dark:text-gray-300">↳ {v.nome}</td>
                            <td className="px-3 py-1 text-gray-500">{v.nome_secao || '—'}</td>
                            <td></td><td></td>
                            <td className="px-3 py-1 text-right tabular-nums text-gray-500">{v.preco_atual != null ? fmtBRL(v.preco_atual) : '—'}</td>
                            <td className="px-3 py-1 text-gray-500">{v.fornecedor_ultimo || '—'}</td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div></CardContent></Card>
          </TabsContent>

          {/* ===== VARIAÇÃO DE PREÇO ===== */}
          <TabsContent value="variacao" className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">Variação do último preço de compra de cada insumo (vs. o pedido anterior). Clique pra ver o histórico completo.</p>
            <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
                  <th className="w-8 px-3 py-2"></th>
                  <th className="text-left font-medium px-3 py-2">Insumo</th>
                  <th className="text-left font-medium px-3 py-2">Seção</th>
                  <th className="text-right font-medium px-3 py-2">Preço anterior</th>
                  <th className="text-right font-medium px-3 py-2">Preço atual</th>
                  <th className="text-right font-medium px-3 py-2">Variação</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {loadingVar ? <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                  : variacao.length === 0 ? <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-400">Sem histórico de preço ainda (vem dos pedidos).</td></tr>
                  : variacao.map(v => {
                    const cls = v.var_pct == null ? 'text-gray-400' : v.var_pct > 0.5 ? 'text-red-600 dark:text-red-400' : v.var_pct < -0.5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400';
                    return (
                      <Fragment key={v.id_prod}>
                        <tr onClick={() => abrirSerie(v.id_prod)} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer">
                          <td className="px-3 py-2"><ChevronDown className={`w-4 h-4 transition-transform ${varAberto === v.id_prod ? 'rotate-180' : ''}`} /></td>
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{v.nome}{v.cod_interno && <span className="text-xs text-gray-400 font-mono"> · {v.cod_interno}</span>}</td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{v.secao || '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtBRL(v.preco_anterior)}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtBRL(v.preco_atual)}</td>
                          <td className={`px-3 py-2 text-right tabular-nums font-medium ${cls}`}>{v.var_pct == null ? '—' : `${v.var_pct > 0 ? '+' : ''}${v.var_pct.toFixed(1)}%`}</td>
                        </tr>
                        {varAberto === v.id_prod && (
                          <tr className="bg-gray-50/60 dark:bg-gray-800/30"><td colSpan={6} className="px-3 py-2">
                            {!serie[v.id_prod] ? <div className="py-3 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></div>
                            : serie[v.id_prod].length === 0 ? <div className="py-2 text-center text-xs text-gray-400">Sem série.</div>
                            : (
                              <table className="w-full text-xs">
                                <thead className="text-gray-400"><tr><th className="text-left px-2 py-1">Data</th><th className="text-left px-2 py-1">Fornecedor</th><th className="text-right px-2 py-1">Preço</th><th className="text-right px-2 py-1">Var.</th></tr></thead>
                                <tbody>
                                  {serie[v.id_prod].map((s: any, idx: number) => {
                                    const vp = s.preco_anterior && s.preco_anterior > 0 ? ((Number(s.preco) - Number(s.preco_anterior)) / Number(s.preco_anterior)) * 100 : null;
                                    return (
                                      <tr key={idx} className="border-t border-gray-100 dark:border-gray-800">
                                        <td className="px-2 py-1 whitespace-nowrap">{fmtData(s.data)}</td>
                                        <td className="px-2 py-1 text-gray-500">{s.fornecedor || '—'}</td>
                                        <td className="px-2 py-1 text-right tabular-nums">{fmtBRL(s.preco)}</td>
                                        <td className={`px-2 py-1 text-right tabular-nums ${vp == null ? 'text-gray-400' : vp > 0 ? 'text-red-500' : vp < 0 ? 'text-emerald-500' : 'text-gray-400'}`}>{vp == null ? '—' : `${vp > 0 ? '+' : ''}${vp.toFixed(1)}%`}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </td></tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div></CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
