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
import { Package, RefreshCw, Search, Boxes, ChefHat, Plus, Pencil, Trash2, X, ListTree, Utensils, TrendingUp, TrendingDown, Download, Loader2, ChevronDown } from 'lucide-react';
import Link from 'next/link';

const fmtBRL = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '';

interface Produto {
  id_produto_sisfood_cotacao: number; cod_interno: string | null; nome: string | null; marca: string | null;
  gramatura: string | null; estoque: number | null; nome_secao: string | null; id_secao_cotacao: number | null;
  nome_fornecedor: string | null; preco_atual: number | null; preco_anterior: number | null; preco_data: string | null;
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

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return produtos.filter(p => {
      if (secaoSel !== 'todas' && String(p.id_secao_cotacao) !== secaoSel) return false;
      if (!q) return true;
      return (p.nome || '').toLowerCase().includes(q) || (p.cod_interno || '').toLowerCase().includes(q)
        || (p.marca || '').toLowerCase().includes(q) || (p.nome_fornecedor || '').toLowerCase().includes(q);
    });
  }, [produtos, busca, secaoSel]);
  const semDepara = produtos.filter(p => !p.cod_interno).length;

  // ---------- PRODUTOS (cardápio) ----------
  const [prodCard, setProdCard] = useState<any[]>([]);
  const [buscaCard, setBuscaCard] = useState('');
  const [importandoCard, setImportandoCard] = useState(false);
  const carregarCardapio = useCallback(async () => {
    if (!barId) return;
    try { const r = await api.get(`/api/operacional/produtos?bar_id=${barId}`); if (r.success) setProdCard(r.produtos || []); } catch { /* */ }
  }, [barId]);
  useEffect(() => { carregarCardapio(); }, [carregarCardapio]);
  const importarCardapio = async () => {
    if (!barId) return; setImportandoCard(true);
    try {
      const r = await api.post('/api/operacional/produtos', { bar_id: barId, action: 'importar' });
      if (!r.success) throw new Error(r.error);
      toast({ title: 'Cardápio importado', description: `${r.importados} novos produtos` });
      await carregarCardapio();
    } catch (e: any) { toast({ title: 'Erro ao importar', description: e?.message, variant: 'destructive' }); }
    finally { setImportandoCard(false); }
  };
  const excluirProduto = async (id: number) => {
    if (!confirm('Excluir este produto?')) return;
    try { await api.delete(`/api/operacional/produtos?id=${id}`); await carregarCardapio(); }
    catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
  };
  const cardFiltrado = useMemo(() => {
    const q = buscaCard.trim().toLowerCase();
    return prodCard.filter(p => !q || (p.nome || '').toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q));
  }, [prodCard, buscaCard]);

  // ---------- PRODUÇÕES ----------
  const vazio = { nome: '', unidade: 'un', rendimento: '1', secao: '', observacao: '' };
  const [producoes, setProducoes] = useState<any[]>([]);
  const [form, setForm] = useState<any>(vazio);
  const [editId, setEditId] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [importandoPrep, setImportandoPrep] = useState(false);
  const carregarProducoes = useCallback(async () => {
    if (!barId) return;
    try { const r = await api.get(`/api/operacional/producoes?bar_id=${barId}`); if (r.success) setProducoes(r.producoes || []); } catch { /* */ }
  }, [barId]);
  useEffect(() => { carregarProducoes(); }, [carregarProducoes]);
  const salvarProducao = async () => {
    if (!barId || !form.nome.trim()) { toast({ title: 'Informe o nome da produção', variant: 'destructive' }); return; }
    setSalvando(true);
    try {
      const payload = { ...form, bar_id: barId, rendimento: Number(form.rendimento) || 1 };
      const r = editId ? await api.put('/api/operacional/producoes', { ...payload, id: editId }) : await api.post('/api/operacional/producoes', payload);
      if (!r.success) throw new Error(r.error);
      toast({ title: editId ? 'Produção atualizada' : 'Produção criada' });
      setForm(vazio); setEditId(null); await carregarProducoes();
    } catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
    finally { setSalvando(false); }
  };
  const editarProducao = (p: any) => { setEditId(p.id); setForm({ nome: p.nome || '', unidade: p.unidade || 'un', rendimento: String(p.rendimento ?? '1'), secao: p.secao || '', observacao: p.observacao || '' }); };
  const excluirProducao = async (id: number) => {
    if (!confirm('Excluir esta produção e a ficha dela?')) return;
    try { const r = await api.delete(`/api/operacional/producoes?id=${id}`); if (!r.success) throw new Error(r.error); await carregarProducoes(); }
    catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
  };
  const importarPreparos = async () => {
    if (!barId) return; setImportandoPrep(true);
    try {
      const r = await api.post('/api/operacional/producoes', { bar_id: barId, action: 'importar' });
      if (!r.success) throw new Error(r.error);
      toast({ title: 'Preparos importados', description: `${r.importados} novas produções` });
      await carregarProducoes();
    } catch (e: any) { toast({ title: 'Erro ao importar', description: e?.message, variant: 'destructive' }); }
    finally { setImportandoPrep(false); }
  };
  const UNIDADES = ['un', 'kg', 'g', 'L', 'ml', 'porção'];

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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cadastros</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Insumos, produtos, produções e preços · {selectedBar?.nome || `Bar ${barId ?? ''}`}{syncedEm && <> · sync {new Date(syncedEm).toLocaleString('pt-BR')}</>}</p>
            </div>
          </div>
          <Button onClick={sincronizar} disabled={sincronizando || !barId} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${sincronizando ? 'animate-spin' : ''}`} />{sincronizando ? 'Sincronizando…' : 'Sincronizar VMarket'}
          </Button>
        </div>

        <Tabs defaultValue="insumos">
          <TabsList>
            <TabsTrigger value="insumos"><Boxes className="w-4 h-4 mr-1.5" />Insumos</TabsTrigger>
            <TabsTrigger value="produtos"><Utensils className="w-4 h-4 mr-1.5" />Produtos</TabsTrigger>
            <TabsTrigger value="producoes"><ChefHat className="w-4 h-4 mr-1.5" />Produções</TabsTrigger>
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
              <Badge variant="outline">{filtrados.length} de {produtos.length} insumos</Badge>
              {semDepara > 0 && <Badge variant="outline" className="text-amber-600 border-amber-300">{semDepara} sem código</Badge>}
            </div>
            <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
                  <th className="text-left font-medium px-3 py-2">Cód.</th>
                  <th className="text-left font-medium px-3 py-2">Insumo</th>
                  <th className="text-left font-medium px-3 py-2">Marca</th>
                  <th className="text-left font-medium px-3 py-2">Seção</th>
                  <th className="text-right font-medium px-3 py-2">Estoque</th>
                  <th className="text-right font-medium px-3 py-2">Preço (últ.)</th>
                  <th className="text-left font-medium px-3 py-2">Fornecedor</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {loading ? <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                  : filtrados.length === 0 ? <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400">Nenhum insumo.</td></tr>
                  : filtrados.map(p => {
                    const subiu = p.preco_anterior != null && p.preco_atual != null && p.preco_atual > p.preco_anterior;
                    const caiu = p.preco_anterior != null && p.preco_atual != null && p.preco_atual < p.preco_anterior;
                    return (
                      <tr key={p.id_produto_sisfood_cotacao} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-300">{p.cod_interno || <span className="text-amber-500">—</span>}</td>
                        <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{p.nome}</td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{p.marca || '—'}</td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{p.nome_secao || '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-200">{p.estoque ?? '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap">
                          {fmtBRL(p.preco_atual)}
                          {subiu && <TrendingUp className="inline w-3 h-3 ml-1 text-red-500" />}
                          {caiu && <TrendingDown className="inline w-3 h-3 ml-1 text-emerald-500" />}
                        </td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{p.nome_fornecedor || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div></CardContent></Card>
          </TabsContent>

          {/* ===== PRODUTOS (cardápio) ===== */}
          <TabsContent value="produtos" className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2 items-center">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input value={buscaCard} onChange={e => setBuscaCard(e.target.value)} placeholder="Buscar produto…" className="pl-9" />
              </div>
              <Button onClick={importarCardapio} disabled={importandoCard} variant="outline" className="whitespace-nowrap">
                <Download className={`w-4 h-4 mr-2 ${importandoCard ? 'animate-pulse' : ''}`} />{importandoCard ? 'Importando…' : 'Importar do Cardápio'}
              </Button>
            </div>
            <Badge variant="outline">{cardFiltrado.length} de {prodCard.length} produtos</Badge>
            <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
                  <th className="text-left font-medium px-3 py-2">Código</th>
                  <th className="text-left font-medium px-3 py-2">Produto</th>
                  <th className="text-left font-medium px-3 py-2">Categoria</th>
                  <th className="text-left font-medium px-3 py-2">Ativo</th>
                  <th className="text-right font-medium px-3 py-2">Ações</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {prodCard.length === 0 ? <tr><td colSpan={5} className="px-3 py-10 text-center text-gray-400">Nenhum produto. Use <strong>Importar do Cardápio</strong> pra puxar a planilha.</td></tr>
                  : cardFiltrado.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-300">{p.codigo}</td>
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{p.nome}</td>
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{p.categoria || '—'}</td>
                      <td className="px-3 py-2">{p.ativo ? <span className="text-emerald-600 text-xs">Sim</span> : <span className="text-gray-400 text-xs">Não</span>}</td>
                      <td className="px-3 py-2 text-right"><button onClick={() => excluirProduto(p.id)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500" title="Excluir"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div></CardContent></Card>
          </TabsContent>

          {/* ===== PRODUÇÕES ===== */}
          <TabsContent value="producoes" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">Preparos internos (não existem no VMarket). A receita é montada na <strong>Ficha Técnica</strong>.</p>
              <Button onClick={importarPreparos} disabled={importandoPrep} variant="outline" className="whitespace-nowrap">
                <Download className={`w-4 h-4 mr-2 ${importandoPrep ? 'animate-pulse' : ''}`} />{importandoPrep ? 'Importando…' : 'Importar preparos'}
              </Button>
            </div>
            <Card className="card-dark"><CardContent className="py-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                <div className="sm:col-span-4"><label className="text-xs text-gray-500 dark:text-gray-400">Nome da produção *</label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Molho da casa" /></div>
                <div className="sm:col-span-2"><label className="text-xs text-gray-500 dark:text-gray-400">Rende</label><Input type="number" step="0.01" value={form.rendimento} onChange={e => setForm({ ...form, rendimento: e.target.value })} /></div>
                <div className="sm:col-span-2"><label className="text-xs text-gray-500 dark:text-gray-400">Unidade</label>
                  <select value={form.unidade} onChange={e => setForm({ ...form, unidade: e.target.value })} className="h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm">{UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}</select>
                </div>
                <div className="sm:col-span-2"><label className="text-xs text-gray-500 dark:text-gray-400">Seção</label><Input value={form.secao} onChange={e => setForm({ ...form, secao: e.target.value })} placeholder="Cozinha…" /></div>
                <div className="sm:col-span-2 flex gap-1">
                  <Button onClick={salvarProducao} disabled={salvando} className="flex-1"><Plus className="w-4 h-4 mr-1" />{editId ? 'Salvar' : 'Adicionar'}</Button>
                  {editId && <Button variant="outline" onClick={() => { setEditId(null); setForm(vazio); }}><X className="w-4 h-4" /></Button>}
                </div>
              </div>
            </CardContent></Card>
            <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
                  <th className="text-left font-medium px-3 py-2">Produção</th>
                  <th className="text-left font-medium px-3 py-2">Rendimento</th>
                  <th className="text-left font-medium px-3 py-2">Seção</th>
                  <th className="text-right font-medium px-3 py-2">Itens na ficha</th>
                  <th className="text-right font-medium px-3 py-2">Ações</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {producoes.length === 0 ? <tr><td colSpan={5} className="px-3 py-10 text-center text-gray-400">Nenhuma produção. Cadastre acima ou use <strong>Importar preparos</strong>.</td></tr>
                  : producoes.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{p.nome}{!p.ativo && <span className="text-xs text-gray-400"> (inativa)</span>}</td>
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{Number(p.rendimento || 0).toLocaleString('pt-BR')} {p.unidade}</td>
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{p.secao || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-500">{p.qtd_componentes}</td>
                      <td className="px-3 py-2"><div className="flex items-center justify-end gap-1">
                        <Link href={`/operacional/fichas-tecnicas?producao=${p.id}`} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-indigo-600 dark:text-indigo-400" title="Abrir ficha técnica"><ListTree className="w-4 h-4" /></Link>
                        <button onClick={() => editarProducao(p)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500" title="Editar"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => excluirProducao(p.id)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                      </div></td>
                    </tr>
                  ))}
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
