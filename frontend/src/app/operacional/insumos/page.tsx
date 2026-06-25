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
import { Package, RefreshCw, Search, Boxes, ChefHat, Plus, Pencil, Trash2, X, ListTree, Utensils, TrendingUp, TrendingDown, Download, Loader2, ChevronDown, Star } from 'lucide-react';

const fmtBRL = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '';
const UNIDADES = ['un', 'kg', 'g', 'L', 'ml', 'porção'];
const fmtPeso = (q: any, u: string | null) => {
  const n = Number(q || 0);
  if (u === 'g' || u === 'kg') { const g = u === 'kg' ? n * 1000 : n; return g >= 1000 ? `${(g / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg` : `${g.toLocaleString('pt-BR')} g`; }
  if (u === 'ml' || u === 'L') { const ml = u === 'L' ? n * 1000 : n; return ml >= 1000 ? `${(ml / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} L` : `${ml.toLocaleString('pt-BR')} ml`; }
  return `${n.toLocaleString('pt-BR')}${u ? ' ' + u : ''}`;
};

// Modal de Ficha Técnica de uma Produção (rendimento + componentes)
function FichaModal({ producao, barId, insumos, producoes, onClose, onChanged }: {
  producao: any; barId: number; insumos: any[]; producoes: any[]; onClose: () => void; onChanged: () => void;
}) {
  const { toast } = useToast();
  const [rend, setRend] = useState(String(producao.rendimento ?? '1'));
  const [uni, setUni] = useState(producao.unidade || 'un');
  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState<'insumo' | 'producao'>('insumo');
  const [busca, setBusca] = useState('');
  const [escolhido, setEscolhido] = useState<any>(null);
  const [qtd, setQtd] = useState('1');
  const [unid, setUnid] = useState('g');

  const carregar = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get(`/api/operacional/producoes/ficha?producao_id=${producao.id}&bar_id=${barId}`); if (r.success) setItens(r.itens || []); }
    finally { setLoading(false); }
  }, [producao.id, barId]);
  useEffect(() => { carregar(); }, [carregar]);

  const salvarRend = async () => {
    try { await api.put('/api/operacional/producoes', { id: producao.id, rendimento: Number(rend) || 0, unidade: uni }); onChanged(); toast({ title: 'Rendimento salvo' }); }
    catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
  };

  const opcoes = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (tipo === 'insumo') return insumos.filter(i => !q || (i.nome || '').toLowerCase().includes(q) || (i.cod_interno || '').toLowerCase().includes(q)).slice(0, 30);
    return producoes.filter(p => p.id !== producao.id && (!q || (p.nome || '').toLowerCase().includes(q))).slice(0, 30);
  }, [tipo, busca, insumos, producoes, producao.id]);

  const adicionar = async () => {
    if (!escolhido) { toast({ title: 'Escolha o componente', variant: 'destructive' }); return; }
    const payload: any = { producao_id: producao.id, componente_tipo: tipo, quantidade: Number(qtd) || 0, unidade: unid };
    if (tipo === 'insumo') { payload.insumo_codigo = escolhido.cod_interno; payload.insumo_id_vmarket = escolhido.id_produto_sisfood_cotacao; payload.nome_componente = escolhido.nome; }
    else { payload.producao_ref = escolhido.id; payload.nome_componente = escolhido.nome; }
    try { const r = await api.post('/api/operacional/producoes/ficha', payload); if (!r.success) throw new Error(r.error); setEscolhido(null); setBusca(''); setQtd('1'); await carregar(); onChanged(); }
    catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
  };
  const remover = async (id: number) => { try { await api.delete(`/api/operacional/producoes/ficha?id=${id}`); await carregar(); onChanged(); } catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); } };
  const marcarMestre = async (it: any) => { try { await api.put('/api/operacional/producoes/ficha', { id: it.id, is_mestre: !it.is_mestre }); await carregar(); } catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); } };

  const custoTotal = itens.reduce((s, it) => s + Number(it.custo_planilha || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-4 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Ficha técnica · {producao.nome}</h3>
            <p className="text-xs text-gray-400 font-mono">{producao.codigo || 'sem código'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {/* Rendimento */}
        <div className="flex items-end gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="w-32"><label className="text-xs text-gray-500">Rendimento</label><Input type="number" step="0.01" value={rend} onChange={e => setRend(e.target.value)} /></div>
          <div className="w-28"><label className="text-xs text-gray-500">Unidade</label>
            <select value={uni} onChange={e => setUni(e.target.value)} className="h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm">{UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}</select>
          </div>
          <Button variant="outline" onClick={salvarRend}>Salvar rendimento</Button>
          <div className="flex-1" />
          <div className="text-right"><div className="text-[11px] text-muted-foreground">Custo da ficha</div><div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{fmtBRL(custoTotal)}</div></div>
        </div>

        {/* Adicionar componente */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
          <div className="flex gap-1">
            <button onClick={() => { setTipo('insumo'); setEscolhido(null); }} className={`text-xs rounded px-2.5 py-1 flex items-center gap-1 ${tipo === 'insumo' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}><Boxes className="w-3.5 h-3.5" />Insumo</button>
            <button onClick={() => { setTipo('producao'); setEscolhido(null); }} className={`text-xs rounded px-2.5 py-1 flex items-center gap-1 ${tipo === 'producao' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}><ChefHat className="w-3.5 h-3.5" />Produção</button>
          </div>
          {escolhido ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[160px]"><label className="text-xs text-gray-500">Componente</label>
                <div className="h-10 flex items-center px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm justify-between"><span className="truncate">{escolhido.nome}</span><button onClick={() => setEscolhido(null)} className="text-gray-400 text-xs ml-2">trocar</button></div>
              </div>
              <div className="w-24"><label className="text-xs text-gray-500">Qtd</label><Input type="number" step="0.001" value={qtd} onChange={e => setQtd(e.target.value)} /></div>
              <div className="w-24"><label className="text-xs text-gray-500">Unidade</label>
                <select value={unid} onChange={e => setUnid(e.target.value)} className="h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm">{UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}</select>
              </div>
              <Button onClick={adicionar}><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
            </div>
          ) : (
            <>
              <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input value={busca} onChange={e => setBusca(e.target.value)} placeholder={tipo === 'insumo' ? 'Buscar insumo (nome ou i0XXX)…' : 'Buscar produção…'} className="pl-9" /></div>
              {busca && (
                <div className="max-h-44 overflow-y-auto rounded border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                  {opcoes.length === 0 ? <div className="px-3 py-3 text-xs text-gray-400">Nada encontrado.</div>
                  : opcoes.map((o: any) => (
                    <button key={tipo === 'insumo' ? o.id_produto_sisfood_cotacao : o.id} onClick={() => setEscolhido(o)} className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/40">{o.nome}{tipo === 'insumo' && o.cod_interno && <span className="text-xs text-gray-400 font-mono"> · {o.cod_interno}</span>}</button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Componentes */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 dark:text-gray-400 border-b"><tr>
              <th className="text-center font-medium px-2 py-1.5 w-10">Mestre</th>
              <th className="text-left font-medium px-2 py-1.5">Código</th>
              <th className="text-left font-medium px-2 py-1.5">Componente</th>
              <th className="text-right font-medium px-2 py-1.5">Peso/Qtd</th>
              <th className="text-right font-medium px-2 py-1.5">Valor</th>
              <th className="w-8"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? <tr><td colSpan={6} className="px-2 py-6 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              : itens.length === 0 ? <tr><td colSpan={6} className="px-2 py-6 text-center text-gray-400">Ficha vazia — adicione os insumos acima.</td></tr>
              : itens.map(it => (
                <tr key={it.id} className={it.is_mestre ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}>
                  <td className="px-2 py-1.5 text-center"><button onClick={() => marcarMestre(it)} title={it.is_mestre ? 'Insumo mestre' : 'Marcar como mestre'}><Star className={`w-4 h-4 mx-auto ${it.is_mestre ? 'text-amber-500 fill-amber-500' : 'text-gray-300 hover:text-amber-400'}`} /></button></td>
                  <td className="px-2 py-1.5 font-mono text-xs text-gray-500">{it.componente_codigo || '—'}</td>
                  <td className="px-2 py-1.5 text-gray-900 dark:text-gray-100">{it.nome_componente}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtPeso(it.quantidade, it.base || it.unidade)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-medium">{fmtBRL(it.custo_planilha)}</td>
                  <td className="px-2 py-1.5 text-right"><button onClick={() => remover(it.id)} className="text-red-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface Produto {
  id_produto_sisfood_cotacao: number; cod_interno: string | null; nome: string | null; marca: string | null;
  gramatura: string | null; estoque: number | null; nome_secao: string | null; id_secao_cotacao: number | null;
  nome_fornecedor: string | null; fornecedor_ultimo: string | null; preco_atual: number | null; preco_anterior: number | null; preco_data: string | null;
  cod_duplicado?: boolean; cod_invalido?: boolean; base?: string | null; embalagem?: number | null;
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
        || (p.marca || '').toLowerCase().includes(q) || (p.fornecedor_ultimo || '').toLowerCase().includes(q);
    });
  }, [produtos, busca, secaoSel]);
  const semDepara = produtos.filter(p => !p.cod_interno).length;

  const salvarUnidade = async (p: Produto, patch: { base?: string; embalagem?: number }) => {
    setProdutos(prev => prev.map(x => x.id_produto_sisfood_cotacao === p.id_produto_sisfood_cotacao ? { ...x, ...patch } : x));
    try {
      await api.post('/api/operacional/insumos', {
        bar_id: barId, action: 'unidade', id_prod: p.id_produto_sisfood_cotacao, cod_interno: p.cod_interno,
        base: patch.base ?? p.base ?? 'g', embalagem: patch.embalagem ?? p.embalagem ?? 1,
      });
    } catch (e: any) { toast({ title: 'Erro ao salvar unidade', description: e?.message, variant: 'destructive' }); }
  };

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
  const vazio = { nome: '', secao: '' };
  const [producoes, setProducoes] = useState<any[]>([]);
  const [form, setForm] = useState<any>(vazio);
  const [editId, setEditId] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [importandoPrep, setImportandoPrep] = useState(false);
  const [fichaProd, setFichaProd] = useState<any | null>(null); // produção com modal de ficha aberto
  const carregarProducoes = useCallback(async () => {
    if (!barId) return;
    try { const r = await api.get(`/api/operacional/producoes?bar_id=${barId}`); if (r.success) setProducoes(r.producoes || []); } catch { /* */ }
  }, [barId]);
  useEffect(() => { carregarProducoes(); }, [carregarProducoes]);
  const salvarProducao = async () => {
    if (!barId || !form.nome.trim()) { toast({ title: 'Informe o nome da produção', variant: 'destructive' }); return; }
    setSalvando(true);
    try {
      const payload = { bar_id: barId, nome: form.nome, secao: form.secao };
      const r = editId
        ? await api.put('/api/operacional/producoes', { ...payload, id: editId })
        : await api.post('/api/operacional/producoes', payload);
      if (!r.success) throw new Error(r.error);
      setForm(vazio); setEditId(null);
      await carregarProducoes();
      // ao criar uma nova produção, já abre o modal da ficha técnica
      if (!editId && r.producao) { toast({ title: 'Produção criada', description: 'Agora monte a ficha técnica' }); setFichaProd({ ...r.producao, qtd_componentes: 0, custo_total: 0 }); }
      else toast({ title: 'Produção atualizada' });
    } catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
    finally { setSalvando(false); }
  };
  const editarProducao = (p: any) => { setEditId(p.id); setForm({ nome: p.nome || '', secao: p.secao || '' }); };
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
              {produtos.filter(p => p.cod_duplicado).length > 0 && <Badge variant="outline" className="text-red-600 border-red-300">{produtos.filter(p => p.cod_duplicado).length} com código duplicado</Badge>}
              {produtos.filter(p => p.cod_invalido).length > 0 && <Badge variant="outline" className="text-red-600 border-red-300">{produtos.filter(p => p.cod_invalido).length} com código inválido</Badge>}
            </div>
            <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
                  <th className="text-left font-medium px-3 py-2">Cód.</th>
                  <th className="text-left font-medium px-3 py-2">Insumo</th>
                  <th className="text-left font-medium px-3 py-2">Marca</th>
                  <th className="text-left font-medium px-3 py-2">Seção</th>
                  <th className="text-center font-medium px-3 py-2">Unid. base</th>
                  <th className="text-right font-medium px-3 py-2">Embalagem</th>
                  <th className="text-right font-medium px-3 py-2">Preço (últ.)</th>
                  <th className="text-left font-medium px-3 py-2">Fornecedor</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {loading ? <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                  : filtrados.length === 0 ? <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400">Nenhum insumo.</td></tr>
                  : filtrados.map(p => {
                    const subiu = p.preco_anterior != null && p.preco_atual != null && p.preco_atual > p.preco_anterior;
                    const caiu = p.preco_anterior != null && p.preco_atual != null && p.preco_atual < p.preco_anterior;
                    return (
                      <tr key={p.id_produto_sisfood_cotacao} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-3 py-2 font-mono text-xs">
                          {p.cod_invalido ? <span className="text-red-500" title="Código inválido no VMarket (não é i0XXX)">⚠ {p.cod_interno}</span>
                            : p.cod_duplicado ? <span className="text-red-500" title="Código duplicado — outro insumo usa o mesmo código no VMarket">⚠ {p.cod_interno}</span>
                            : p.cod_interno ? <span className="text-gray-600 dark:text-gray-300">{p.cod_interno}</span>
                            : <span className="text-amber-500">—</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{p.nome}</td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{p.marca || '—'}</td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{p.nome_secao || '—'}</td>
                        <td className="px-3 py-2 text-center">
                          <select value={p.base || 'g'} onChange={e => salvarUnidade(p, { base: e.target.value })}
                            className="h-7 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 text-xs">
                            <option value="g">g/kg</option><option value="ml">ml/L</option><option value="un">un</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input type="number" step="0.001" defaultValue={p.embalagem ?? 1}
                            onBlur={e => { const v = Number(e.target.value) || 1; if (v !== (p.embalagem ?? 1)) salvarUnidade(p, { embalagem: v }); }}
                            className="h-7 w-20 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 text-xs text-right" />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap">
                          {fmtBRL(p.preco_atual)}
                          {subiu && <TrendingUp className="inline w-3 h-3 ml-1 text-red-500" />}
                          {caiu && <TrendingDown className="inline w-3 h-3 ml-1 text-emerald-500" />}
                        </td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{p.fornecedor_ultimo || '—'}</td>
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
                <div className="sm:col-span-6"><label className="text-xs text-gray-500 dark:text-gray-400">Nome da produção *</label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Molho da casa" /></div>
                <div className="sm:col-span-3"><label className="text-xs text-gray-500 dark:text-gray-400">Seção</label><Input value={form.secao} onChange={e => setForm({ ...form, secao: e.target.value })} placeholder="Cozinha…" /></div>
                <div className="sm:col-span-3 flex gap-1">
                  <Button onClick={salvarProducao} disabled={salvando} className="flex-1"><Plus className="w-4 h-4 mr-1" />{editId ? 'Salvar' : 'Adicionar'}</Button>
                  {editId && <Button variant="outline" onClick={() => { setEditId(null); setForm(vazio); }}><X className="w-4 h-4" /></Button>}
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">O rendimento e os insumos são definidos na ficha técnica (botão ao lado de cada produção).</p>
            </CardContent></Card>
            <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
                  <th className="text-left font-medium px-3 py-2">Código</th>
                  <th className="text-left font-medium px-3 py-2">Produção</th>
                  <th className="text-right font-medium px-3 py-2">Rendimento</th>
                  <th className="text-left font-medium px-3 py-2">Unidade</th>
                  <th className="text-right font-medium px-3 py-2">Custo total</th>
                  <th className="text-right font-medium px-3 py-2">Itens</th>
                  <th className="text-right font-medium px-3 py-2">Ações</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {producoes.length === 0 ? <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400">Nenhuma produção. Cadastre acima ou use <strong>Importar preparos</strong>.</td></tr>
                  : producoes.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">{p.codigo || '—'}</td>
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{p.nome}{!p.ativo && <span className="text-xs text-gray-400"> (inativa)</span>}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{Number(p.rendimento || 0).toLocaleString('pt-BR')}</td>
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{p.unidade || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{p.custo_total ? fmtBRL(p.custo_total) : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-500">{p.qtd_componentes}</td>
                      <td className="px-3 py-2"><div className="flex items-center justify-end gap-1">
                        {p.qtd_componentes > 0
                          ? <button onClick={() => setFichaProd(p)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-indigo-600 dark:text-indigo-400" title="Ver/editar ficha técnica"><ListTree className="w-4 h-4" /></button>
                          : <button onClick={() => setFichaProd(p)} className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700" title="Cadastrar ficha técnica"><Plus className="w-3.5 h-3.5" />Ficha</button>}
                        <button onClick={() => editarProducao(p)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500" title="Editar nome"><Pencil className="w-4 h-4" /></button>
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

        {fichaProd && barId && (
          <FichaModal producao={fichaProd} barId={barId} insumos={produtos} producoes={producoes}
            onClose={() => setFichaProd(null)} onChanged={carregarProducoes} />
        )}
      </div>
    </div>
  );
}
