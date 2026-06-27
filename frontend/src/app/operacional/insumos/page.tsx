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
import { Package, RefreshCw, Search, Boxes, TrendingUp, TrendingDown, Loader2, ChevronDown, BarChart3, Zap, Utensils, Pencil, Plus, Trash2 } from 'lucide-react';

const fmtBRL = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '';

// 1 insumo = 1 linha (cadastro Zykor). VMarket (compras) só alimenta o preço via silver.
interface Insumo {
  id: number; codigo: string; nome: string; categoria: string | null; unidade_medida: string | null;
  fator_correcao?: boolean; curva_a?: boolean; frequencia?: string | null; preco_atual: number | null; preco_anterior: number | null; preco_data: string | null;
  fornecedor: string | null; tem_compra?: boolean; tem_ficha?: boolean; base?: string | null; embalagem?: number | null;
}
interface SemCadastro { id_vmarket: number; cod_interno: string | null; codigo_vmarket: string | null; nome: string; nome_secao: string | null; preco: number | null; preco_data: string | null; fornecedor: string | null; }

export default function InsumosPage() {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const barId = selectedBar?.id;

  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [semCadastro, setSemCadastro] = useState<SemCadastro[]>([]);
  const [syncedEm, setSyncedEm] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [catSel, setCatSel] = useState('todas');
  const [filtro, setFiltro] = useState<'sem_ficha' | 'sem_cadastro' | 'curva_a' | null>(null);
  const [tab, setTab] = useState('insumos');
  // expandir compras de um item sem cadastro
  const [compraAberto, setCompraAberto] = useState<number | null>(null);
  const [comprasMap, setComprasMap] = useState<Record<number, any[]>>({});
  const abrirCompras = async (sc: SemCadastro) => {
    if (compraAberto === sc.id_vmarket) { setCompraAberto(null); return; }
    setCompraAberto(sc.id_vmarket);
    if (!comprasMap[sc.id_vmarket]) {
      try { const r = await api.get(`/api/operacional/insumos/compras?bar_id=${barId}&id_vmarket=${sc.id_vmarket}`); setComprasMap(m => ({ ...m, [sc.id_vmarket]: r.success ? (r.compras || []) : [] })); }
      catch { setComprasMap(m => ({ ...m, [sc.id_vmarket]: [] })); }
    }
  };

  const carregar = useCallback(async () => {
    if (!barId) return;
    setLoading(true);
    try {
      const r = await api.get(`/api/operacional/insumos?bar_id=${barId}`);
      if (r.success) { setInsumos(r.insumos || []); setSemCadastro(r.sem_cadastro || []); setSyncedEm(r.synced_em || null); }
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
      toast({ title: 'VMarket sincronizado', description: 'Compras atualizadas' });
      await carregar();
    } catch (e: any) { toast({ title: 'Erro no sync', description: e?.message || 'Falha', variant: 'destructive' }); }
    finally { setSincronizando(false); }
  };

  // vincular SKU comprado a um insumo já existente
  const [vincSc, setVincSc] = useState<SemCadastro | null>(null);
  const [vincBusca, setVincBusca] = useState('');
  const vincOpcoes = useMemo(() => {
    const q = vincBusca.trim().toLowerCase();
    return insumos.filter(i => !q || (i.nome || '').toLowerCase().includes(q) || (i.codigo || '').toLowerCase().includes(q)).slice(0, 30);
  }, [insumos, vincBusca]);
  const vincular = async (codigo: string) => {
    if (!vincSc) return;
    try {
      const r = await api.post('/api/operacional/insumos', { bar_id: barId, action: 'vincular_vmarket', id_prod_vmarket: vincSc.id_vmarket, codigo });
      if (!r.success) throw new Error(r.error);
      toast({ title: `Vinculado a ${codigo}` });
      setVincSc(null); setVincBusca(''); await carregar();
    } catch (e: any) { toast({ title: 'Erro ao vincular', description: e?.message, variant: 'destructive' }); }
  };

  const catList = useMemo(() => Array.from(new Set(insumos.map(i => i.categoria).filter(Boolean))).sort() as string[], [insumos]);
  const nSemFicha = useMemo(() => insumos.filter(i => !i.tem_ficha).length, [insumos]);
  const nCurvaA = useMemo(() => insumos.filter(i => i.curva_a).length, [insumos]);

  const insumosView = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return insumos.filter(i => {
      if (catSel !== 'todas' && (i.categoria || '') !== catSel) return false;
      if (filtro === 'sem_ficha' && i.tem_ficha) return false;
      if (filtro === 'curva_a' && !i.curva_a) return false;
      if (!q) return true;
      return (i.nome || '').toLowerCase().includes(q) || (i.codigo || '').toLowerCase().includes(q) || (i.categoria || '').toLowerCase().includes(q) || (i.fornecedor || '').toLowerCase().includes(q);
    });
  }, [insumos, busca, catSel, filtro]);

  // ---------- cadastrar insumo ----------
  const [novoOpen, setNovoOpen] = useState(false);
  const [nCod, setNCod] = useState(''); const [nNome, setNNome] = useState(''); const [nCat, setNCat] = useState('');
  const [nUnid, setNUnid] = useState('un'); const [nEmb, setNEmb] = useState(''); const [nPreco, setNPreco] = useState('');
  const [nFc, setNFc] = useState(false); const [nVmId, setNVmId] = useState<number | null>(null); const [criando, setCriando] = useState(false);
  const abrirNovoBlank = () => { setNCod(''); setNNome(''); setNCat(''); setNUnid('un'); setNEmb(''); setNPreco(''); setNFc(false); setNVmId(null); setNovoOpen(true); };
  const cadastrarDoSemCadastro = (sc: SemCadastro) => {
    setNCod(sc.cod_interno || ''); // puxa o código interno da compra (mesmo se errado — você revisa)
    setNNome(sc.nome || ''); setNCat(sc.nome_secao || ''); setNUnid('un'); setNEmb('');
    setNPreco(sc.preco != null ? String(sc.preco) : ''); setNFc(false); setNVmId(sc.id_vmarket); setNovoOpen(true);
  };
  const criarInsumo = async () => {
    if (!barId) return;
    if (!/^i\d{2,}$/i.test(nCod.trim())) { toast({ title: 'Código inválido', description: 'Use i + números (ex.: i0638)', variant: 'destructive' }); return; }
    if (!nNome.trim()) { toast({ title: 'Informe o nome', variant: 'destructive' }); return; }
    setCriando(true);
    try {
      const r = await api.post('/api/operacional/insumos', { bar_id: barId, action: 'criar_insumo', codigo: nCod.trim().toLowerCase(), nome: nNome.trim(), categoria: nCat.trim(), base: nUnid, embalagem: Number(String(nEmb).replace(',', '.')) || 0, custo_unitario: Number(String(nPreco).replace(',', '.')) || 0, fator_correcao: nFc, id_prod_vmarket: nVmId });
      if (!r.success) throw new Error(r.error);
      toast({ title: r.ligado ? `Ligado ao insumo ${r.codigo}` : `Insumo ${r.codigo} cadastrado` });
      setNovoOpen(false);
      await carregar();
    } catch (e: any) { toast({ title: 'Erro ao cadastrar', description: e?.message, variant: 'destructive' }); }
    finally { setCriando(false); }
  };

  // ---------- editar insumo ----------
  const [editIns, setEditIns] = useState<Insumo | null>(null);
  const [fCod, setFCod] = useState(''); const [fNome, setFNome] = useState(''); const [fCat, setFCat] = useState(''); const [fFc, setFFc] = useState(false);
  const [fCurvaA, setFCurvaA] = useState(false);
  const [fBase, setFBase] = useState('g'); const [fEmb, setFEmb] = useState('1');
  const abrirEditIns = (i: Insumo) => { setEditIns(i); setFCod(i.codigo || ''); setFNome(i.nome || ''); setFCat(i.categoria || ''); setFFc(!!i.fator_correcao); setFCurvaA(!!i.curva_a); setFBase(i.base || 'g'); setFEmb(String(i.embalagem ?? 1)); };
  const salvarEditIns = async () => {
    if (!editIns) return;
    try {
      const r = await api.post('/api/operacional/insumos', {
        bar_id: barId, action: 'editar', id: editIns.id, codigo: fCod.trim().toLowerCase(), nome: fNome.trim(), categoria: fCat.trim(),
        fator_correcao: fFc, curva_a: fCurvaA, unidade_medida: fBase, base: fBase, embalagem: Number(String(fEmb).replace(',', '.')) || 1,
      });
      if (!r.success) throw new Error(r.error);
      setEditIns(null); await carregar();
    } catch (e: any) { toast({ title: 'Erro ao salvar', description: e?.message, variant: 'destructive' }); }
  };
  const salvarFc = async (i: Insumo, valor: boolean) => {
    setInsumos(prev => prev.map(x => x.id === i.id ? { ...x, fator_correcao: valor } : x));
    try { await api.post('/api/operacional/insumos', { bar_id: barId, action: 'editar', id: i.id, fator_correcao: valor }); }
    catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
  };
  const salvarCurvaA = async (i: Insumo, valor: boolean) => {
    setInsumos(prev => prev.map(x => x.id === i.id ? { ...x, curva_a: valor } : x));
    try { await api.post('/api/operacional/insumos', { bar_id: barId, action: 'editar', id: i.id, curva_a: valor }); }
    catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
  };

  // ---------- excluir insumo ----------
  const [delConfirm, setDelConfirm] = useState<Insumo | null>(null);
  const excluirInsumo = async (i: Insumo) => {
    try {
      const r = await api.post('/api/operacional/insumos', { bar_id: barId, action: 'excluir_insumo', id: i.id, codigo: i.codigo });
      if (!r.success) throw new Error(r.error);
      toast({ title: 'Insumo excluído' }); setDelConfirm(null); await carregar();
    } catch (e: any) { toast({ title: 'Erro ao excluir', description: e?.message, variant: 'destructive' }); }
  };

  // ---------- fichas que usam o insumo ----------
  const [fichasIns, setFichasIns] = useState<{ codigo: string; nome: string } | null>(null);
  const [fichasData, setFichasData] = useState<any[] | null>(null);
  const abrirFichas = async (codigo: string, nome: string) => {
    setFichasIns({ codigo, nome }); setFichasData(null);
    try { const r = await api.get(`/api/operacional/insumos/fichas?bar_id=${barId}&codigo=${encodeURIComponent(codigo)}`); setFichasData(r.success ? (r.fichas || []) : []); }
    catch { setFichasData([]); }
  };

  // ---------- VARIAÇÃO DE PREÇO (camada de compras) ----------
  const [variacao, setVariacao] = useState<any[]>([]);
  const [loadingVar, setLoadingVar] = useState(false);
  const [varAberto, setVarAberto] = useState<string | null>(null);
  const [serie, setSerie] = useState<Record<string, any[]>>({});
  const [buscaVar, setBuscaVar] = useState('');
  const variacaoView = useMemo(() => {
    const q = buscaVar.trim().toLowerCase();
    const arr = !q ? variacao : variacao.filter((v: any) => (v.nome || '').toLowerCase().includes(q) || (v.codigo_planilha || '').toLowerCase().includes(q) || (v.secao || '').toLowerCase().includes(q));
    return [...arr].sort((a: any, b: any) => (b.var_pct == null ? -1 : Math.abs(b.var_pct)) - (a.var_pct == null ? -1 : Math.abs(a.var_pct)));
  }, [variacao, buscaVar]);
  const carregarVariacao = useCallback(async () => {
    if (!barId) return; setLoadingVar(true);
    try { const r = await api.get(`/api/operacional/insumos/precos?bar_id=${barId}`); if (r.success) setVariacao(r.insumos || []); }
    catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
    finally { setLoadingVar(false); }
  }, [barId, toast]);
  useEffect(() => { if (tab === 'variacao') carregarVariacao(); }, [tab, carregarVariacao]);
  const abrirSerie = async (codigo: string) => {
    if (varAberto === codigo) { setVarAberto(null); return; }
    setVarAberto(codigo);
    if (!serie[codigo]) { try { const r = await api.get(`/api/operacional/insumos/precos?bar_id=${barId}&codigo=${encodeURIComponent(codigo)}`); if (r.success) setSerie(m => ({ ...m, [codigo]: r.serie || [] })); } catch { /* */ } }
  };

  // ---------- ABC + IMPACTO ----------
  const [abcDias, setAbcDias] = useState(30);
  const [abc, setAbc] = useState<any>(null);
  const [loadingAbc, setLoadingAbc] = useState(false);
  const carregarAbc = useCallback(async () => {
    if (!barId) return; setLoadingAbc(true);
    try { const r = await api.get(`/api/operacional/insumos/analises?bar_id=${barId}&tipo=abc&ini=${new Date(Date.now() - abcDias * 86400000).toISOString().slice(0, 10)}&fim=${new Date().toISOString().slice(0, 10)}`); if (r.success) setAbc(r); }
    catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
    finally { setLoadingAbc(false); }
  }, [barId, abcDias, toast]);
  useEffect(() => { if (tab === 'abc') carregarAbc(); }, [tab, carregarAbc]);
  const [impacto, setImpacto] = useState<any[]>([]);
  const [loadingImp, setLoadingImp] = useState(false);
  const [impAberto, setImpAberto] = useState<string | null>(null);
  const carregarImpacto = useCallback(async () => {
    if (!barId) return; setLoadingImp(true);
    try { const r = await api.get(`/api/operacional/insumos/analises?bar_id=${barId}&tipo=impacto`); if (r.success) setImpacto(r.insumos || []); }
    catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
    finally { setLoadingImp(false); }
  }, [barId, toast]);
  useEffect(() => { if (tab === 'impacto') carregarImpacto(); }, [tab, carregarImpacto]);
  const corClasse = (c: string) => c === 'A' ? 'text-red-600 dark:text-red-400 border-red-300' : c === 'B' ? 'text-amber-600 dark:text-amber-400 border-amber-300' : 'text-gray-500 border-gray-300';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl"><Package className="w-6 h-6 text-emerald-600 dark:text-emerald-400" /></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Insumos</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Cadastro do Zykor (1 insumo por nome) · {selectedBar?.nome || `Bar ${barId ?? ''}`}{syncedEm && <> · compras VMarket sync {new Date(syncedEm).toLocaleString('pt-BR')}</>}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={abrirNovoBlank} disabled={!barId}><Plus className="w-4 h-4 mr-1.5" />Adicionar insumo</Button>
            <Button onClick={sincronizar} disabled={sincronizando || !barId} variant="outline">
              <RefreshCw className={`w-4 h-4 mr-2 ${sincronizando ? 'animate-spin' : ''}`} />{sincronizando ? 'Sincronizando…' : 'Sincronizar compras'}
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="insumos"><Boxes className="w-4 h-4 mr-1.5" />Insumos</TabsTrigger>
            <TabsTrigger value="variacao"><TrendingUp className="w-4 h-4 mr-1.5" />Variação de Preço</TabsTrigger>
            <TabsTrigger value="abc"><BarChart3 className="w-4 h-4 mr-1.5" />Curva ABC</TabsTrigger>
            <TabsTrigger value="impacto"><Zap className="w-4 h-4 mr-1.5" />Impacto de Variação</TabsTrigger>
          </TabsList>

          {/* ===== INSUMOS (cadastro Zykor, 1:1) ===== */}
          <TabsContent value="insumos" className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, código (i0XXX), seção ou fornecedor…" className="pl-9" />
              </div>
              <select value={catSel} onChange={e => setCatSel(e.target.value)} className="h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100">
                <option value="todas">Todas as seções ({insumos.length})</option>
                {catList.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button onClick={() => setFiltro(null)}><Badge variant="outline" className={`cursor-pointer ${!filtro ? 'ring-1 ring-emerald-400' : ''}`}>{insumos.length} insumos</Badge></button>
              {nSemFicha > 0 && <button onClick={() => setFiltro(f => f === 'sem_ficha' ? null : 'sem_ficha')}><Badge variant="outline" className={`cursor-pointer text-orange-600 border-orange-300 ${filtro === 'sem_ficha' ? 'ring-1 ring-orange-400' : ''}`}>{nSemFicha} sem ficha técnica</Badge></button>}
              {nCurvaA > 0 && <button onClick={() => setFiltro(f => f === 'curva_a' ? null : 'curva_a')}><Badge variant="outline" className={`cursor-pointer text-indigo-600 border-indigo-300 ${filtro === 'curva_a' ? 'ring-1 ring-indigo-400' : ''}`}>{nCurvaA} curva A</Badge></button>}
              {/* legenda dos ícones da coluna nome */}
              <span className="flex items-center gap-1 text-gray-400 ml-1"><Utensils className="w-3 h-3 text-red-500" /> sem ficha</span>
              <span className="flex items-center gap-1 text-gray-400"><span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 text-[9px] font-bold">A</span> curva A (contagem diária)</span>
            </div>
            {semCadastro.length > 0 && (
              <button onClick={() => setFiltro(f => f === 'sem_cadastro' ? null : 'sem_cadastro')}
                className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition ${filtro === 'sem_cadastro' ? 'bg-purple-100 border-purple-400 dark:bg-purple-900/30' : 'bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-900/15 dark:border-purple-800 dark:text-purple-200 hover:bg-purple-100'}`}>
                🔗 <b>{semCadastro.length}</b> comprado(s) no VMarket sem cadastro no Zykor — clique pra {filtro === 'sem_cadastro' ? 'voltar aos insumos' : 'cadastrar'}
              </button>
            )}

            {filtro === 'sem_cadastro' ? (
              <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
                    <th className="text-left font-medium px-3 py-2">Comprado no VMarket</th>
                    <th className="text-left font-medium px-3 py-2" title="Código interno cadastrado na compra do VMarket (mesmo que esteja errado)">Cód. interno</th>
                    <th className="text-left font-medium px-3 py-2">Seção</th>
                    <th className="text-right font-medium px-3 py-2">Última compra</th>
                    <th className="text-left font-medium px-3 py-2">Fornecedor</th>
                    <th className="w-44 px-3 py-2"></th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {semCadastro.length === 0 ? <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-400">Tudo cadastrado 🎉</td></tr>
                    : semCadastro.map(sc => (
                      <Fragment key={sc.id_vmarket}>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                            <button onClick={() => abrirCompras(sc)} className="flex items-center gap-1 text-left hover:text-indigo-600" title="Ver as compras desse item no VMarket">
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${compraAberto === sc.id_vmarket ? 'rotate-180' : ''}`} />{sc.nome}
                            </button>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-gray-500">{sc.cod_interno || '—'}</td>
                          <td className="px-3 py-2 text-gray-500">{sc.nome_secao || '—'}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="tabular-nums font-medium">{fmtBRL(sc.preco)}</div>
                            {sc.preco_data && <div className="text-[11px] text-gray-400">{fmtData(sc.preco_data)}</div>}
                          </td>
                          <td className="px-3 py-2 text-gray-500">{sc.fornecedor || '—'}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            <Button size="sm" variant="outline" className="mr-1.5" onClick={() => { setVincSc(sc); setVincBusca(''); }} title="Vincular a um insumo que já existe">vincular</Button>
                            <Button size="sm" onClick={() => cadastrarDoSemCadastro(sc)}><Plus className="w-3.5 h-3.5 mr-1" />cadastrar</Button>
                          </td>
                        </tr>
                        {compraAberto === sc.id_vmarket && (
                          <tr className="bg-gray-50/60 dark:bg-gray-800/30"><td colSpan={6} className="px-3 py-2">
                            {!comprasMap[sc.id_vmarket] ? <div className="py-3 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></div>
                            : comprasMap[sc.id_vmarket].length === 0 ? <div className="py-2 text-center text-xs text-gray-400">Sem compras registradas.</div>
                            : (
                              <table className="w-full text-xs">
                                <thead className="text-gray-400"><tr><th className="text-left px-2 py-1">Data</th><th className="text-left px-2 py-1">Pedido</th><th className="text-left px-2 py-1">Status</th><th className="text-right px-2 py-1">Qtd</th><th className="text-right px-2 py-1">Preço</th><th className="text-right px-2 py-1">Total</th><th className="text-left px-2 py-1">Fornecedor</th></tr></thead>
                                <tbody>
                                  {comprasMap[sc.id_vmarket].map((c: any, idx: number) => (
                                    <tr key={idx} className="border-t border-gray-100 dark:border-gray-800">
                                      <td className="px-2 py-1 whitespace-nowrap">{fmtData(c.data)}</td>
                                      <td className="px-2 py-1 text-gray-500">#{c.id_pedido}</td>
                                      <td className="px-2 py-1 text-gray-500">{c.status || '—'}</td>
                                      <td className="px-2 py-1 text-right tabular-nums">{c.quantidade.toLocaleString('pt-BR')}{c.gramatura ? ` ${c.gramatura}` : ''}</td>
                                      <td className="px-2 py-1 text-right tabular-nums">{fmtBRL(c.preco)}</td>
                                      <td className="px-2 py-1 text-right tabular-nums font-medium">{fmtBRL(c.total)}</td>
                                      <td className="px-2 py-1 text-gray-500">{c.fornecedor || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td></tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div></CardContent></Card>
            ) : (
              <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
                    <th className="text-left font-medium px-3 py-2">Código</th>
                    <th className="text-left font-medium px-3 py-2">Insumo</th>
                    <th className="text-left font-medium px-3 py-2">Seção</th>
                    <th className="text-center font-medium px-3 py-2" title="Fator de Correção: insumo com perda/limpeza.">FC</th>
                    <th className="text-center font-medium px-3 py-2">Unid.</th>
                    <th className="text-right font-medium px-3 py-2" title="conversão da unidade de compra para unidade de ficha técnica">Embalagem</th>
                    <th className="text-right font-medium px-3 py-2">Preço (últ.)</th>
                    <th className="text-left font-medium px-3 py-2">Fornecedor</th>
                    <th className="w-10 px-3 py-2"></th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {loading ? <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                    : insumosView.length === 0 ? <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-400">Nenhum insumo.</td></tr>
                    : insumosView.map(i => {
                      const subiu = i.preco_anterior != null && i.preco_atual != null && i.preco_atual > i.preco_anterior;
                      const caiu = i.preco_anterior != null && i.preco_atual != null && i.preco_atual < i.preco_anterior;
                      return (
                        <tr key={i.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="px-3 py-2 font-mono text-xs text-gray-500">{i.codigo}</td>
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                            <div className="flex items-center gap-2">
                              <span>{i.nome}</span>
                              <button onClick={() => abrirFichas(i.codigo, i.nome)} className={`shrink-0 ${!i.tem_ficha ? 'text-red-500 hover:text-red-700' : 'text-gray-400 hover:text-indigo-600'}`} title={!i.tem_ficha ? 'Não está em nenhuma ficha técnica' : 'Ver fichas que usam este insumo'}><Utensils className="w-3.5 h-3.5" /></button>
                              <button onClick={() => salvarCurvaA(i, !i.curva_a)} className="shrink-0" title={i.curva_a ? 'Curva A — entra na contagem diária. Clique para remover.' : 'Marcar como Curva A (contagem diária)'}>
                                <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold transition ${i.curva_a ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-gray-100 text-gray-300 hover:text-indigo-400 dark:bg-gray-800 dark:text-gray-600'}`}>A</span>
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{i.categoria || '—'}</td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => salvarFc(i, !i.fator_correcao)} title="Fator de correção (perda/limpeza)">
                              {i.fator_correcao ? <span className="text-amber-500">✓</span> : <span className="text-gray-300 hover:text-amber-400">—</span>}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-300">{i.base || '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{i.embalagem ?? '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap">
                            {fmtBRL(i.preco_atual)}
                            {i.preco_atual != null && (i.tem_compra
                              ? <span className="text-[10px] rounded px-1 ml-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" title="Última compra no VMarket">VMarket</span>
                              : <span className="text-[10px] rounded px-1 ml-1 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" title="Preço do cadastro (ainda sem compra)">cadastro</span>)}
                            {subiu && <TrendingUp className="inline w-3 h-3 ml-1 text-red-500" />}
                            {caiu && <TrendingDown className="inline w-3 h-3 ml-1 text-emerald-500" />}
                          </td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{i.fornecedor || '—'}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => abrirEditIns(i)} className="text-gray-400 hover:text-indigo-600" title="Editar insumo"><Pencil className="w-4 h-4" /></button>
                              {(i.tem_ficha || i.tem_compra)
                                ? <span className="text-gray-200 dark:text-gray-700" title={i.tem_ficha ? 'Em ficha técnica — não pode excluir' : 'Tem compra vinculada no VMarket — não pode excluir'}><Trash2 className="w-4 h-4" /></span>
                                : <button onClick={() => setDelConfirm(i)} className="text-gray-400 hover:text-red-600" title="Excluir insumo"><Trash2 className="w-4 h-4" /></button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div></CardContent></Card>
            )}
          </TabsContent>

          {/* ===== VARIAÇÃO DE PREÇO (compras) ===== */}
          <TabsContent value="variacao" className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">Variação do último preço de compra vs. a anterior (a <span className="text-red-600 dark:text-red-400">compra 0</span> é o preço da planilha). Aqui ficam as <b>variações de compra</b> do VMarket. Clique pra ver o histórico.</p>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input value={buscaVar} onChange={e => setBuscaVar(e.target.value)} placeholder="Buscar por nome, código (i0XXX) ou seção…" className="pl-9" />
            </div>
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
                  : variacaoView.length === 0 ? <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-400">{buscaVar ? 'Nenhum insumo encontrado.' : 'Sem histórico de preço ainda (vem dos pedidos).'}</td></tr>
                  : variacaoView.map(v => {
                    const cls = v.var_pct == null ? 'text-gray-400' : v.var_pct > 0.5 ? 'text-red-600 dark:text-red-400' : v.var_pct < -0.5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400';
                    return (
                      <Fragment key={v.codigo_planilha}>
                        <tr onClick={() => abrirSerie(v.codigo_planilha)} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer">
                          <td className="px-3 py-2"><ChevronDown className={`w-4 h-4 transition-transform ${varAberto === v.codigo_planilha ? 'rotate-180' : ''}`} /></td>
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{v.nome}{v.codigo_planilha && <span className="text-xs text-gray-400 font-mono"> · {v.codigo_planilha}</span>}</td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{v.secao || '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtBRL(v.preco_anterior)}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtBRL(v.preco_atual)}</td>
                          <td className={`px-3 py-2 text-right tabular-nums font-medium ${cls}`}>{v.var_pct == null ? '—' : `${v.var_pct > 0 ? '+' : ''}${v.var_pct.toFixed(1)}%`}</td>
                        </tr>
                        {varAberto === v.codigo_planilha && (
                          <tr className="bg-gray-50/60 dark:bg-gray-800/30"><td colSpan={6} className="px-3 py-2">
                            {!serie[v.codigo_planilha] ? <div className="py-3 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></div>
                            : serie[v.codigo_planilha].length === 0 ? <div className="py-2 text-center text-xs text-gray-400">Sem série.</div>
                            : (
                              <table className="w-full text-xs">
                                <thead className="text-gray-400"><tr><th className="text-left px-2 py-1">Compra</th><th className="text-left px-2 py-1">Fornecedor</th><th className="text-right px-2 py-1">Preço</th><th className="text-right px-2 py-1">Var.</th></tr></thead>
                                <tbody>
                                  {serie[v.codigo_planilha].map((s: any, idx: number) => {
                                    const prev = serie[v.codigo_planilha][idx - 1];
                                    const vp = prev && Number(prev.preco) > 0 ? ((Number(s.preco) - Number(prev.preco)) / Number(prev.preco)) * 100 : null;
                                    return (
                                      <tr key={idx} className="border-t border-gray-100 dark:border-gray-800">
                                        <td className="px-2 py-1 whitespace-nowrap">{s.fonte === 'planilha' ? <span className="text-[10px] rounded px-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">Compra 0 · planilha</span> : fmtData(s.data)}</td>
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

          {/* ===== CURVA ABC ===== */}
          <TabsContent value="abc" className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Período:</span>
              <select value={abcDias} onChange={e => setAbcDias(Number(e.target.value))} className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm">
                <option value={7}>7 dias</option><option value={30}>30 dias</option><option value={60}>60 dias</option><option value={90}>90 dias</option>
              </select>
              <span className="text-xs text-gray-400">Pareto do custo teórico (A = 80% · B = +15% · C = resto).</span>
            </div>
            {loadingAbc ? <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
            : !abc?.insumos?.length ? <Card className="card-dark"><CardContent className="py-16 text-center text-gray-400">Sem consumo teórico no período (precisa de ficha + vendas).</CardContent></Card>
            : (<>
              <div className="grid grid-cols-3 gap-2">
                {(['A', 'B', 'C'] as const).map(cl => (
                  <Card key={cl} className="card-dark"><CardContent className="py-3">
                    <div className={`text-xs uppercase font-bold ${corClasse(cl)}`}>Classe {cl}</div>
                    <div className="text-xl font-bold">{abc.resumo?.[cl]?.n ?? 0} <span className="text-sm font-normal text-gray-400">insumos</span></div>
                    <div className="text-xs text-gray-500">{fmtBRL(abc.resumo?.[cl]?.custo)}</div>
                  </CardContent></Card>
                ))}
              </div>
              <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
                    <th className="text-center font-medium px-3 py-2">Classe</th><th className="text-left font-medium px-3 py-2">Cód.</th><th className="text-left font-medium px-3 py-2">Insumo</th>
                    <th className="text-right font-medium px-3 py-2">Custo teórico</th><th className="text-right font-medium px-3 py-2">% do total</th><th className="text-right font-medium px-3 py-2">% acum.</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {abc.insumos.map((r: any) => (
                      <tr key={r.codigo} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-3 py-2 text-center"><span className={`text-[10px] rounded-full border px-2 py-0.5 font-bold ${corClasse(r.classe)}`}>{r.classe}</span></td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-500">{r.codigo}</td>
                        <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{r.nome}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtBRL(r.custo_total)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-500">{Number(r.pct).toFixed(1)}%</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-500">{Number(r.pct_acum).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div></CardContent></Card>
            </>)}
          </TabsContent>

          {/* ===== IMPACTO DE VARIAÇÃO ===== */}
          <TabsContent value="impacto" className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">Insumos que mudaram de preço e os produtos afetados. <b>Δ pp</b> = impacto estimado no CMV. Clique pra ver os produtos.</p>
            {loadingImp ? <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
            : !impacto.length ? <Card className="card-dark"><CardContent className="py-16 text-center text-gray-400">Nenhuma variação de preço relevante.</CardContent></Card>
            : (
              <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
                    <th className="w-8 px-3 py-2"></th><th className="text-left font-medium px-3 py-2">Insumo</th><th className="text-right font-medium px-3 py-2">Variação</th><th className="text-right font-medium px-3 py-2">Produtos afetados</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {impacto.map((g: any) => (
                      <Fragment key={g.insumo_codigo}>
                        <tr onClick={() => setImpAberto(a => a === g.insumo_codigo ? null : g.insumo_codigo)} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer">
                          <td className="px-3 py-2"><ChevronDown className={`w-4 h-4 transition-transform ${impAberto === g.insumo_codigo ? 'rotate-180' : ''}`} /></td>
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{g.insumo_nome}<span className="text-xs text-gray-400 font-mono"> · {g.insumo_codigo}</span></td>
                          <td className={`px-3 py-2 text-right tabular-nums font-medium ${g.var_pct > 0 ? 'text-red-600 dark:text-red-400' : g.var_pct < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{g.var_pct > 0 ? '+' : ''}{Number(g.var_pct).toFixed(1)}%</td>
                          <td className="px-3 py-2 text-right tabular-nums">{g.n_produtos}</td>
                        </tr>
                        {impAberto === g.insumo_codigo && (
                          <tr className="bg-gray-50/60 dark:bg-gray-800/30"><td colSpan={4} className="px-3 py-2">
                            <table className="w-full text-xs">
                              <thead className="text-gray-400"><tr><th className="text-left px-2 py-1">Produto</th><th className="text-right px-2 py-1">Δ custo/un</th><th className="text-right px-2 py-1">CMV atual</th><th className="text-right px-2 py-1">Δ CMV</th></tr></thead>
                              <tbody>
                                {g.produtos.map((p: any, i: number) => (
                                  <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                                    <td className="px-2 py-1">{p.produto_nome}</td>
                                    <td className="px-2 py-1 text-right tabular-nums">{fmtBRL(p.delta_custo)}</td>
                                    <td className="px-2 py-1 text-right tabular-nums text-gray-500">{p.cmv_atual == null ? '—' : `${Number(p.cmv_atual).toFixed(1)}%`}</td>
                                    <td className={`px-2 py-1 text-right tabular-nums ${p.delta_cmv_pp > 0 ? 'text-red-500' : p.delta_cmv_pp < 0 ? 'text-emerald-500' : 'text-gray-400'}`}>{p.delta_cmv_pp == null ? '—' : `${p.delta_cmv_pp > 0 ? '+' : ''}${Number(p.delta_cmv_pp).toFixed(2)}pp`}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td></tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div></CardContent></Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Modal: adicionar insumo */}
        {novoOpen && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setNovoOpen(false)}>
            <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-md space-y-3" onClick={e => e.stopPropagation()}>
              <h4 className="font-semibold text-gray-900 dark:text-white">{nVmId ? 'Cadastrar insumo (do VMarket)' : 'Adicionar insumo'}</h4>
              <p className="text-xs text-gray-500">Cadastro no Zykor. {nVmId ? 'Ligado à compra do VMarket por este código.' : 'Use o código que vai casar com o VMarket quando a compra entrar.'}</p>
              <div className="flex gap-2">
                <div className="w-32"><label className="text-xs text-gray-500">Código *</label><Input value={nCod} onChange={e => setNCod(e.target.value)} placeholder="i0638" /></div>
                <div className="flex-1"><label className="text-xs text-gray-500">Nome *</label><Input value={nNome} onChange={e => setNNome(e.target.value)} placeholder="Ex.: Polpa de Maracujá" /></div>
              </div>
              <div><label className="text-xs text-gray-500">Seção</label>
                <select value={nCat} onChange={e => setNCat(e.target.value)} className="w-full h-9 rounded-md border border-gray-200 dark:border-gray-700 bg-transparent px-2 text-sm">
                  <option value="">— selecione —</option>
                  {nCat && !catList.includes(nCat) && <option value={nCat}>{nCat}</option>}
                  {catList.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex gap-2 items-end">
                <div className="w-20"><label className="text-xs text-gray-500">Unidade</label>
                  <select value={nUnid} onChange={e => setNUnid(e.target.value)} className="w-full h-9 rounded-md border border-gray-200 dark:border-gray-700 bg-transparent px-2 text-sm">
                    {['g', 'ml', 'un'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="flex-1"><label className="text-xs text-gray-500" title="conversão da unidade de compra para unidade de ficha técnica">Embalagem</label><Input type="number" step="0.001" value={nEmb} onChange={e => setNEmb(e.target.value)} placeholder="ex.: 1000" /></div>
                <div className="w-24"><label className="text-xs text-gray-500">Preço (R$)</label><Input value={nPreco} onChange={e => setNPreco(e.target.value)} placeholder="0,00" /></div>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 pb-2"><input type="checkbox" checked={nFc} onChange={e => setNFc(e.target.checked)} />FC</label>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setNovoOpen(false)}>Cancelar</Button>
                <Button onClick={criarInsumo} disabled={criando}><Plus className="w-4 h-4 mr-1" />{criando ? 'Salvando…' : 'Cadastrar'}</Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: vincular SKU comprado a um insumo existente */}
        {vincSc && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setVincSc(null)}>
            <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-md space-y-2" onClick={e => e.stopPropagation()}>
              <h4 className="font-semibold text-gray-900 dark:text-white">Vincular ao insumo existente</h4>
              <p className="text-sm text-gray-500">Compra: <b>{vincSc.nome}</b>{vincSc.cod_interno ? <span className="font-mono text-xs text-gray-400"> · {vincSc.cod_interno}</span> : ''}. Escolha o insumo do cadastro que ela representa.</p>
              <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input value={vincBusca} onChange={e => setVincBusca(e.target.value)} placeholder="Buscar insumo (nome ou i0XXX)…" className="pl-9" /></div>
              <div className="max-h-60 overflow-y-auto rounded border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                {vincOpcoes.length === 0 ? <div className="px-3 py-3 text-xs text-gray-400">Nada encontrado.</div>
                : vincOpcoes.map(o => (
                  <button key={o.id} onClick={() => vincular(o.codigo)} className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/40">{o.nome}<span className="text-xs text-gray-400 font-mono"> · {o.codigo}</span></button>
                ))}
              </div>
              <div className="flex justify-end pt-1"><Button variant="outline" onClick={() => setVincSc(null)}>Cancelar</Button></div>
            </div>
          </div>
        )}

        {/* Modal: editar insumo */}
        {editIns && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditIns(null)}>
            <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
              <h4 className="font-semibold text-gray-900 dark:text-white">Editar insumo</h4>
              <div className="flex gap-2">
                <div className="w-32"><label className="text-xs text-gray-500" title="Código do insumo (i0XXX). Trocar aqui corrige de-para errado e renomeia em cascata (fichas, compras, unidade).">Código</label><Input value={fCod} onChange={e => setFCod(e.target.value)} placeholder="i0084" /></div>
                <div className="flex-1"><label className="text-xs text-gray-500">Nome</label><Input value={fNome} onChange={e => setFNome(e.target.value)} /></div>
              </div>
              <div><label className="text-xs text-gray-500">Seção</label>
                <select value={fCat} onChange={e => setFCat(e.target.value)} className="w-full h-9 rounded-md border border-gray-200 dark:border-gray-700 bg-transparent px-2 text-sm">
                  <option value="">— selecione —</option>
                  {fCat && !catList.includes(fCat) && <option value={fCat}>{fCat}</option>}
                  {catList.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <input type="checkbox" checked={fFc} onChange={e => setFFc(e.target.checked)} className="h-4 w-4 accent-amber-500" />
                Fator de correção (perda/limpeza)
              </label>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2.5">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
                  <input type="checkbox" checked={fCurvaA} onChange={e => setFCurvaA(e.target.checked)} className="h-4 w-4 accent-indigo-600" />
                  Curva A (contagem diária)
                </label>
                <p className="text-[11px] text-gray-500 mt-1 ml-6">
                  {fCurvaA ? 'Entra na contagem diária, semanal e mensal.' : 'Entra só na contagem semanal e mensal.'}
                  {editIns?.frequencia === 'diaria' && !fCurvaA && <span className="block text-amber-600 dark:text-amber-400">💡 Sugestão: marcar — a frequência registrada é diária.</span>}
                  {editIns?.frequencia && editIns?.frequencia !== 'diaria' && fCurvaA && <span className="block text-amber-600 dark:text-amber-400">💡 A frequência registrada é {editIns.frequencia} — confirme se é Curva A mesmo.</span>}
                </p>
              </div>
              <div className="flex gap-2">
                <div className="w-24"><label className="text-xs text-gray-500">Unidade</label>
                  <select value={fBase} onChange={e => setFBase(e.target.value)} className="h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm">
                    <option value="g">g</option><option value="ml">ml</option><option value="un">un</option>
                  </select>
                </div>
                <div className="flex-1"><label className="text-xs text-gray-500" title="conversão da unidade de compra para unidade de ficha técnica">Embalagem</label><Input type="number" step="0.001" value={fEmb} onChange={e => setFEmb(e.target.value)} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setEditIns(null)}>Cancelar</Button>
                <Button onClick={salvarEditIns}>Salvar</Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: excluir */}
        {delConfirm && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDelConfirm(null)}>
            <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
              <h4 className="font-semibold text-gray-900 dark:text-white">Excluir insumo?</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300"><b>{delConfirm.nome}</b> <span className="text-gray-400 font-mono">· {delConfirm.codigo}</span> será removido do cadastro (as compras do VMarket ficam, mas desvinculadas).</p>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setDelConfirm(null)}>Cancelar</Button>
                <Button onClick={() => excluirInsumo(delConfirm)} className="bg-red-600 hover:bg-red-700 text-white"><Trash2 className="w-4 h-4 mr-1" />Excluir</Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: fichas que usam o insumo */}
        {fichasIns && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setFichasIns(null)}>
            <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h4 className="font-semibold text-gray-900 dark:text-white">Fichas com {fichasIns.nome}</h4>
              <p className="text-xs text-gray-400 mb-3 font-mono">{fichasIns.codigo}</p>
              {fichasData == null ? <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></div>
              : fichasData.length === 0 ? <div className="py-6 text-center"><span className="text-xs rounded-full px-3 py-1 bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">Não está atrelado a nenhuma ficha</span></div>
              : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-400 border-b"><tr><th className="text-left py-1">Tipo</th><th className="text-left py-1">Cód.</th><th className="text-left py-1">Ficha</th><th className="text-right py-1">Qtd</th></tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {fichasData.map((f: any, i: number) => (
                      <tr key={i}>
                        <td className="py-1.5"><span className={`text-[10px] rounded px-1.5 py-0.5 ${f.tipo === 'producao' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>{f.tipo === 'producao' ? 'Produção' : 'Produto'}</span></td>
                        <td className="py-1.5 font-mono text-xs text-gray-500">{f.codigo}</td>
                        <td className="py-1.5 text-gray-900 dark:text-gray-100">{f.nome}</td>
                        <td className="py-1.5 text-right tabular-nums text-gray-500">{f.quantidade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="flex justify-end mt-4"><Button variant="outline" onClick={() => setFichasIns(null)}>Fechar</Button></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
