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

interface Produto {
  id_produto_sisfood_cotacao: number; cod_interno: string | null; codigo_planilha?: string | null; fator_correcao?: boolean; nome: string | null; marca: string | null;
  gramatura: string | null; estoque: number | null; nome_secao: string | null; id_secao_cotacao: number | null;
  nome_fornecedor: string | null; fornecedor_ultimo: string | null; preco_atual: number | null; preco_anterior: number | null; preco_data: string | null;
  cod_duplicado?: boolean; cod_invalido?: boolean; tem_ficha?: boolean; base?: string | null; embalagem?: number | null; fonte?: string;
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
  // cadastro manual de insumo (mestre)
  const [novoOpen, setNovoOpen] = useState(false);
  const [nCod, setNCod] = useState('');
  const [nNome, setNNome] = useState('');
  const [nCat, setNCat] = useState('');
  const [nUnid, setNUnid] = useState('un');
  const [nEmb, setNEmb] = useState('');
  const [nPreco, setNPreco] = useState('');
  const [nFc, setNFc] = useState(false);
  const [criando, setCriando] = useState(false);

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

  const criarInsumo = async () => {
    if (!barId) return;
    if (!/^i\d{2,}$/i.test(nCod.trim())) { toast({ title: 'Código inválido', description: 'Use i + números (ex.: i0638)', variant: 'destructive' }); return; }
    if (!nNome.trim()) { toast({ title: 'Informe o nome', variant: 'destructive' }); return; }
    setCriando(true);
    try {
      const r = await api.post('/api/operacional/insumos', { bar_id: barId, action: 'criar_insumo', codigo: nCod.trim().toLowerCase(), nome: nNome.trim(), categoria: nCat.trim(), base: nUnid, embalagem: Number(String(nEmb).replace(',', '.')) || 0, custo_unitario: Number(String(nPreco).replace(',', '.')) || 0, fator_correcao: nFc });
      if (!r.success) throw new Error(r.error);
      toast({ title: `Insumo ${r.codigo} cadastrado` });
      setNovoOpen(false); setNCod(''); setNNome(''); setNCat(''); setNUnid('un'); setNEmb(''); setNPreco(''); setNFc(false);
      await carregar();
    } catch (e: any) { toast({ title: 'Erro ao cadastrar', description: e?.message, variant: 'destructive' }); }
    finally { setCriando(false); }
  };

  const [delConfirm, setDelConfirm] = useState<any | null>(null);
  const excluirInsumo = async (g: any) => {
    try {
      const r = await api.post('/api/operacional/insumos', { bar_id: barId, action: 'excluir_insumo', codigo: codShow(g.rep), id_prod: g.rep.id_produto_sisfood_cotacao });
      if (!r.success) throw new Error(r.error);
      toast({ title: 'Insumo excluído' });
      setDelConfirm(null);
      await carregar();
    } catch (e: any) { toast({ title: 'Erro ao excluir', description: e?.message, variant: 'destructive' }); }
  };

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

  // Materiais (limpeza/descartáveis) não são insumos — viram um FILTRO. 'Outros' conta como insumo.
  const ehMaterial = (s: string | null) => /limpeza|descart/i.test(s || '');
  // unidade-base esperada pelo gramatura do VMarket (fonte da verdade)
  const gramBase = (g: string | null): string | null => {
    const s = (g || '').trim().toLowerCase();
    if (/^(un|und|unid|dz|duzia|cx|caixa|pct|pacote|fardo|saco)$/.test(s)) return 'un';
    if (/^(kg|kilo|g|gr|grama)$/.test(s)) return 'g';
    if (/^(l|lt|litro|ml)$/.test(s)) return 'ml';
    return null;
  };
  const nomeTemMedida = (n: string | null) => /(\d+[.,]?\d*)\s*(kg|kilo|grama|gr|ml|lt|litro|l|g)\b/i.test(n || '');
  const ehLiquido = (n: string | null) => /vinho|espumante|frisante|moscatel|prosecco|sparkling|whisky|vodka|\bgin\b|tequila|cacha|\brum\b|licor|conhaque|brandy|aperol|campari|cynar|vermouth|jager|bitter|absinto|steinha|amarula|cointreau|frangelico|limoncello|ballena|xarope|\bsuco\b|leite|\bagua\b|água|refri|cerveja|chopp|beats|energ|t[oô]nica|angostura|calda|azeite|\b[oó]leo\b|vinagre|bebida/i.test(n || '');
  // divergência REAL: VMarket diz UN mas está em g/ml, sem medida no nome e não é líquido (ex.: Abacaxi un = ml/1500)
  const unidDiverge = (p: Produto) => gramBase(p.gramatura ?? null) === 'un' && (p.base === 'g' || p.base === 'ml') && !nomeTemMedida(p.nome) && !ehLiquido(p.nome);
  // VMarket com código errado: produto real do VMarket cujo cod_interno não bate com o Código Planilha (correto)
  const vmErrado = (p: Produto) => p.id_produto_sisfood_cotacao >= 0 && !!p.codigo_planilha && (p.cod_interno || null) !== p.codigo_planilha;
  // Código efetivo PARA EXIBIR: só código de insumo (i0XXX). Material (cod_interno tipo d0039) fica zerado.
  const codShow = (p: Produto): string | null => p.codigo_planilha || (/^i\d/.test(p.cod_interno || '') ? p.cod_interno! : null);
  const [filtroEsp, setFiltroEsp] = useState<'variacoes' | 'invalido' | 'materiais' | 'sem_ficha' | 'unid_div' | 'sem_cadastro' | null>(null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return produtos.filter(p => {
      if (secaoSel !== 'todas' && String(p.id_secao_cotacao) !== secaoSel) return false;
      if (!q) return true;
      return (p.nome || '').toLowerCase().includes(q) || (p.cod_interno || '').toLowerCase().includes(q)
        || (p.fornecedor_ultimo || '').toLowerCase().includes(q) || (p.nome_secao || '').toLowerCase().includes(q);
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

  const salvarFc = async (p: Produto, valor: boolean) => {
    setProdutos(prev => prev.map(x => x.id_produto_sisfood_cotacao === p.id_produto_sisfood_cotacao ? { ...x, fator_correcao: valor } : x));
    try {
      await api.post('/api/operacional/insumos', { bar_id: barId, action: 'fator_correcao', id_prod: p.id_produto_sisfood_cotacao, fator_correcao: valor });
    } catch (e: any) { toast({ title: 'Erro ao salvar Fator de Correção', description: e?.message, variant: 'destructive' }); }
  };

  const salvarCodigoPlanilha = async (p: Produto, valor: string) => {
    const cod = valor.trim() || null;
    if (cod === (p.codigo_planilha ?? null)) return;
    setProdutos(prev => prev.map(x => x.id_produto_sisfood_cotacao === p.id_produto_sisfood_cotacao ? { ...x, codigo_planilha: cod } : x));
    try {
      await api.post('/api/operacional/insumos', {
        bar_id: barId, action: 'codigo_planilha', id_prod: p.id_produto_sisfood_cotacao, codigo_planilha: cod,
      });
    } catch (e: any) { toast({ title: 'Erro ao salvar Código Planilha', description: e?.message, variant: 'destructive' }); }
  };

  // Agrupa por Código Planilha (correto/estável); fallback no cod_interno do VMarket
  const [codAberto, setCodAberto] = useState<string | null>(null);
  const grupos = useMemo(() => {
    const m = new Map<string, Produto[]>();
    for (const p of filtrados) {
      const cod = p.codigo_planilha || p.cod_interno;
      const ok = cod && /^i\d/.test(cod);
      const key = ok ? `c:${cod}` : `u:${p.id_produto_sisfood_cotacao}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(p);
    }
    return Array.from(m.entries()).map(([key, prods]) => {
      const rep = [...prods].sort((a, b) => String(b.preco_data || '').localeCompare(String(a.preco_data || '')))[0];
      return { key, rep, produtos: prods, nVar: prods.length, isMaterial: ehMaterial(rep.nome_secao), temFicha: prods.some(p => p.tem_ficha), semCadastro: !ehMaterial(rep.nome_secao) && prods.every(p => p.id_produto_sisfood_cotacao >= 0) && !prods.some(p => codShow(p)) };
    }).sort((a, b) => String(a.rep.nome || '').localeCompare(String(b.rep.nome || '')));
  }, [filtrados]);
  const nInsumos = grupos.filter(g => !g.isMaterial).length;
  const nMateriais = grupos.filter(g => g.isMaterial).length;
  const nVariacoes = grupos.filter(g => !g.isMaterial && g.nVar > 1).length;
  const nInvalidos = grupos.filter(g => !g.isMaterial && vmErrado(g.rep)).length;
  const nSemFicha = grupos.filter(g => !g.isMaterial && !g.temFicha).length;
  const nUnidDiverge = grupos.filter(g => !g.isMaterial && unidDiverge(g.rep)).length;
  const nSemCadastro = grupos.filter(g => g.semCadastro).length;
  const gruposView = useMemo(() => {
    if (filtroEsp === 'materiais') return grupos.filter(g => g.isMaterial);
    if (filtroEsp === 'variacoes') return grupos.filter(g => !g.isMaterial && g.nVar > 1);
    if (filtroEsp === 'invalido') return grupos.filter(g => !g.isMaterial && vmErrado(g.rep));
    if (filtroEsp === 'sem_ficha') return grupos.filter(g => !g.isMaterial && !g.temFicha);
    if (filtroEsp === 'unid_div') return grupos.filter(g => !g.isMaterial && unidDiverge(g.rep));
    if (filtroEsp === 'sem_cadastro') return grupos.filter(g => g.semCadastro);
    return grupos.filter(g => !g.isMaterial);
  }, [grupos, filtroEsp]);

  // ---------- VARIAÇÃO DE PREÇO ----------
  const [variacao, setVariacao] = useState<any[]>([]);
  const [loadingVar, setLoadingVar] = useState(false);
  const [varAberto, setVarAberto] = useState<string | null>(null);
  const [serie, setSerie] = useState<Record<string, any[]>>({});
  const [buscaVar, setBuscaVar] = useState('');
  const variacaoView = useMemo(() => {
    const q = buscaVar.trim().toLowerCase();
    const arr = !q ? variacao : variacao.filter((v: any) =>
      (v.nome || '').toLowerCase().includes(q) || (v.codigo_planilha || '').toLowerCase().includes(q) || (v.secao || '').toLowerCase().includes(q));
    // ordena pela maior variação (módulo), nulos por último
    return [...arr].sort((a: any, b: any) => {
      const av = a.var_pct == null ? -1 : Math.abs(a.var_pct);
      const bv = b.var_pct == null ? -1 : Math.abs(b.var_pct);
      return bv - av;
    });
  }, [variacao, buscaVar]);
  const carregarVariacao = useCallback(async () => {
    if (!barId) return; setLoadingVar(true);
    try { const r = await api.get(`/api/operacional/insumos/precos?bar_id=${barId}`); if (r.success) setVariacao(r.insumos || []); }
    catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
    finally { setLoadingVar(false); }
  }, [barId, toast]);
  useEffect(() => { carregarVariacao(); }, [carregarVariacao]);
  const abrirSerie = async (codigo: string) => {
    if (varAberto === codigo) { setVarAberto(null); return; }
    setVarAberto(codigo);
    if (!serie[codigo]) {
      try { const r = await api.get(`/api/operacional/insumos/precos?bar_id=${barId}&codigo=${encodeURIComponent(codigo)}`); if (r.success) setSerie(m => ({ ...m, [codigo]: r.serie || [] })); } catch { /* */ }
    }
  };

  // ---------- CURVA ABC + IMPACTO DE VARIAÇÃO ----------
  const [tab, setTab] = useState('insumos');
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

  // modal: editar insumo (código planilha, FC, unidade, quantidade)
  const [editIns, setEditIns] = useState<Produto | null>(null);
  const [fCod, setFCod] = useState(''); const [fFc, setFFc] = useState(false);
  const [fBase, setFBase] = useState('g'); const [fEmb, setFEmb] = useState('1');
  const abrirEditIns = (p: Produto) => { setEditIns(p); setFCod(p.codigo_planilha ?? ''); setFFc(!!p.fator_correcao); setFBase(p.base || 'g'); setFEmb(String(p.embalagem ?? 1)); };
  const salvarEditIns = async () => {
    if (!editIns) return;
    const p = editIns;
    if (p.id_produto_sisfood_cotacao >= 0 && (fCod.trim() || null) !== (p.codigo_planilha ?? null)) await salvarCodigoPlanilha(p, fCod);
    if (!!fFc !== !!p.fator_correcao) await salvarFc(p, fFc);
    const embN = Number(String(fEmb).replace(',', '.')) || 1;
    if (fBase !== (p.base || 'g') || embN !== (p.embalagem ?? 1)) await salvarUnidade(p, { base: fBase, embalagem: embN });
    setEditIns(null);
  };

  // modal: fichas onde o insumo é usado
  const [fichasIns, setFichasIns] = useState<{ codigo: string; nome: string } | null>(null);
  const [fichasData, setFichasData] = useState<any[] | null>(null);
  const abrirFichas = async (codigo: string | null, nome: string | null) => {
    if (!codigo) return;
    setFichasIns({ codigo, nome: nome || codigo }); setFichasData(null);
    try { const r = await api.get(`/api/operacional/insumos/fichas?bar_id=${barId}&codigo=${encodeURIComponent(codigo)}`); setFichasData(r.success ? (r.fichas || []) : []); }
    catch { setFichasData([]); }
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
          <div className="flex items-center gap-2">
            <Button onClick={() => setNovoOpen(true)} disabled={!barId}><Plus className="w-4 h-4 mr-1.5" />Adicionar insumo</Button>
            <Button onClick={sincronizar} disabled={sincronizando || !barId} variant="outline">
              <RefreshCw className={`w-4 h-4 mr-2 ${sincronizando ? 'animate-spin' : ''}`} />{sincronizando ? 'Sincronizando…' : 'Sincronizar VMarket'}
            </Button>
          </div>
        </div>

        {novoOpen && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setNovoOpen(false)}>
            <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-md space-y-3" onClick={e => e.stopPropagation()}>
              <h4 className="font-semibold text-gray-900 dark:text-white">Adicionar insumo</h4>
              <p className="text-xs text-gray-500">Cadastro manual no mestre. Use o código que vai casar com o VMarket quando a compra entrar (aí o sistema junta sozinho).</p>
              <div className="flex gap-2">
                <div className="w-32"><label className="text-xs text-gray-500">Código *</label><Input value={nCod} onChange={e => setNCod(e.target.value)} placeholder="i0638" /></div>
                <div className="flex-1"><label className="text-xs text-gray-500">Nome *</label><Input value={nNome} onChange={e => setNNome(e.target.value)} placeholder="Ex.: Polpa África do Sul" /></div>
              </div>
              <div><label className="text-xs text-gray-500">Categoria / seção</label><Input value={nCat} onChange={e => setNCat(e.target.value)} placeholder="Ex.: BAR - HORTIFRUTI" /></div>
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

        {delConfirm && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDelConfirm(null)}>
            <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
              <h4 className="font-semibold text-gray-900 dark:text-white">Excluir insumo?</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300"><b>{delConfirm.rep?.nome}</b>{codShow(delConfirm.rep) ? <span className="text-gray-400 font-mono"> · {codShow(delConfirm.rep)}</span> : ''} será removido do cadastro. Não está em nenhuma ficha técnica.</p>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setDelConfirm(null)}>Cancelar</Button>
                <Button onClick={() => excluirInsumo(delConfirm)} className="bg-red-600 hover:bg-red-700 text-white"><Trash2 className="w-4 h-4 mr-1" />Excluir</Button>
              </div>
            </div>
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="insumos"><Boxes className="w-4 h-4 mr-1.5" />Insumos</TabsTrigger>
            <TabsTrigger value="variacao"><TrendingUp className="w-4 h-4 mr-1.5" />Variação de Preço</TabsTrigger>
            <TabsTrigger value="abc"><BarChart3 className="w-4 h-4 mr-1.5" />Curva ABC</TabsTrigger>
            <TabsTrigger value="impacto"><Zap className="w-4 h-4 mr-1.5" />Impacto de Variação</TabsTrigger>
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
              {nInvalidos > 0 && <button onClick={() => setFiltroEsp(f => f === 'invalido' ? null : 'invalido')}><Badge variant="outline" className={`cursor-pointer text-red-600 border-red-300 ${filtroEsp === 'invalido' ? 'ring-1 ring-red-400' : ''}`}>{nInvalidos} c/ cód VMarket p/ corrigir</Badge></button>}
              {nSemFicha > 0 && <button onClick={() => setFiltroEsp(f => f === 'sem_ficha' ? null : 'sem_ficha')}><Badge variant="outline" className={`cursor-pointer text-orange-600 border-orange-300 ${filtroEsp === 'sem_ficha' ? 'ring-1 ring-orange-400' : ''}`}>{nSemFicha} insumos sem ficha técnica</Badge></button>}
              {nUnidDiverge > 0 && <button onClick={() => setFiltroEsp(f => f === 'unid_div' ? null : 'unid_div')}><Badge variant="outline" className={`cursor-pointer text-amber-600 border-amber-300 ${filtroEsp === 'unid_div' ? 'ring-1 ring-amber-400' : ''}`}>{nUnidDiverge} unidade p/ revisar</Badge></button>}
              {nMateriais > 0 && <button onClick={() => setFiltroEsp(f => f === 'materiais' ? null : 'materiais')}><Badge variant="outline" className={`cursor-pointer text-gray-500 ${filtroEsp === 'materiais' ? 'ring-1 ring-gray-400' : ''}`}>{nMateriais} materiais</Badge></button>}
            </div>
            {nSemCadastro > 0 && (
              <button onClick={() => setFiltroEsp(f => f === 'sem_cadastro' ? null : 'sem_cadastro')}
                className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition ${filtroEsp === 'sem_cadastro' ? 'bg-purple-100 border-purple-400 dark:bg-purple-900/30' : 'bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-900/15 dark:border-purple-800 dark:text-purple-200 hover:bg-purple-100'}`}>
                🔗 <b>{nSemCadastro}</b> insumo(s) comprado(s) no VMarket sem cadastro no Zykor — sem código interno, invisíveis no consumo/CMV · clique pra cadastrar
              </button>
            )}
            <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
                  <th className="text-left font-medium px-3 py-2" title="Código do insumo (o correto/estável; o sistema sempre usa este).">Código</th>
                  <th className="text-left font-medium px-3 py-2">Insumo</th>
                  <th className="text-left font-medium px-3 py-2">Seção</th>
                  <th className="text-center font-medium px-3 py-2" title="Fator de Correção: insumo com perda/limpeza.">FC</th>
                  <th className="text-center font-medium px-3 py-2">Unid. medida</th>
                  <th className="text-right font-medium px-3 py-2" title="conversão da unidade de compra para unidade de ficha técnica">Embalagem</th>
                  <th className="text-right font-medium px-3 py-2">Preço (últ.)</th>
                  <th className="text-left font-medium px-3 py-2">Fornecedor</th>
                  <th className="w-10 px-3 py-2"></th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {loading ? <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                  : gruposView.length === 0 ? <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-400">Nenhum insumo.</td></tr>
                  : gruposView.map(g => {
                    const p = g.rep;
                    const subiu = p.preco_anterior != null && p.preco_atual != null && p.preco_atual > p.preco_anterior;
                    const caiu = p.preco_anterior != null && p.preco_atual != null && p.preco_atual < p.preco_anterior;
                    const aberto = codAberto === g.key;
                    return (
                      <Fragment key={g.key}>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="px-3 py-2 font-mono text-xs">
                            <div className="flex items-center gap-1">
                              <span className={codShow(p) ? 'text-gray-700 dark:text-gray-200' : (g.isMaterial ? 'text-gray-400' : 'text-red-500')}>{codShow(p) || '—'}</span>
                              {vmErrado(p) && <span title={`No VMarket está como "${p.cod_interno || '—'}" — corrigir lá`} className="text-amber-500 cursor-help">⚠</span>}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                            <div className="flex items-center gap-2">
                              {g.nVar > 1 ? (
                                <button onClick={() => setCodAberto(aberto ? null : g.key)} className="flex items-center gap-1 text-left hover:text-indigo-600">
                                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${aberto ? 'rotate-180' : ''}`} />
                                  {p.nome} <span className="text-[10px] rounded-full px-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{g.nVar} variações</span>
                                </button>
                              ) : <span>{p.nome}</span>}
                              <button onClick={() => abrirFichas(codShow(p), p.nome)} className={`shrink-0 ${!g.isMaterial && !g.temFicha ? 'text-red-500 hover:text-red-700' : 'text-gray-400 hover:text-indigo-600'}`} title={!g.isMaterial && !g.temFicha ? 'Não está em nenhuma ficha técnica' : 'Ver fichas técnicas que usam este insumo'}><Utensils className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{p.nome_secao || '—'}</td>
                          <td className="px-3 py-2 text-center">{p.fator_correcao ? <span className="text-amber-500" title="Tem fator de correção (perda/limpeza)">✓</span> : <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-300">
                            <span className={unidDiverge(p) ? 'text-amber-600 font-medium' : ''}>{p.base || '—'}</span>
                            {unidDiverge(p) && <span className="text-amber-500 ml-1 cursor-help" title={`No VMarket é "${p.gramatura}" (${gramBase(p.gramatura)}), mas está cadastrado como ${p.base}. Conferir a unidade.`}>⚠</span>}
                            {p.gramatura && <span className="block text-[10px] text-gray-400">VM: {p.gramatura}</span>}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{p.embalagem ?? '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap">
                            {fmtBRL(p.preco_atual)}
                            {p.preco_atual != null && (p.fonte === 'planilha'
                              ? <span className="text-[10px] rounded px-1 ml-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" title="Preço da planilha (ainda sem compra no VMarket)">planilha</span>
                              : <span className="text-[10px] rounded px-1 ml-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" title="Última compra no VMarket">VMarket</span>)}
                            {subiu && <TrendingUp className="inline w-3 h-3 ml-1 text-red-500" />}
                            {caiu && <TrendingDown className="inline w-3 h-3 ml-1 text-emerald-500" />}
                          </td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{p.fornecedor_ultimo || '—'}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => abrirEditIns(p)} className="text-gray-400 hover:text-indigo-600" title="Editar código, FC e unidade"><Pencil className="w-4 h-4" /></button>
                              {g.temFicha
                                ? <span className="text-gray-200 dark:text-gray-700" title="Em ficha técnica — não pode excluir"><Trash2 className="w-4 h-4" /></span>
                                : <button onClick={() => setDelConfirm(g)} className="text-gray-400 hover:text-red-600" title="Excluir insumo"><Trash2 className="w-4 h-4" /></button>}
                            </div>
                          </td>
                        </tr>
                        {aberto && g.produtos.map(v => (
                          <tr key={v.id_produto_sisfood_cotacao} className="bg-gray-50/60 dark:bg-gray-800/30 text-xs">
                            <td className="px-3 py-1 font-mono text-gray-400" title="Código no VMarket desta variação">{v.cod_interno || ''}</td>
                            <td className="px-3 py-1 pl-7 text-gray-600 dark:text-gray-300">↳ {v.nome}</td>
                            <td className="px-3 py-1 text-gray-500">{v.nome_secao || '—'}</td>
                            <td className="px-3 py-1 text-center">{v.fator_correcao ? <span className="text-amber-500" title="Fator de correção">✓</span> : <span className="text-gray-300">—</span>}</td>
                            <td className="px-3 py-1 text-center text-gray-500" title="Unidade-base">{v.base || '—'}</td>
                            <td className="px-3 py-1 text-right tabular-nums text-gray-500" title="Quantidade da embalagem (na unidade-base)">{v.embalagem ?? '—'}</td>
                            <td className="px-3 py-1 text-right tabular-nums text-gray-500">{v.preco_atual != null ? fmtBRL(v.preco_atual) : '—'}</td>
                            <td className="px-3 py-1 text-gray-500">{v.fornecedor_ultimo || '—'}</td>
                            <td></td>
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
            <p className="text-sm text-gray-500 dark:text-gray-400">Variação do último preço de compra vs. a compra anterior (a <span className="text-red-600 dark:text-red-400">compra 0</span> é o preço da planilha), ordenada da maior variação para a menor. Clique pra ver o histórico completo.</p>
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
                                        <td className="px-2 py-1 whitespace-nowrap">
                                          {s.fonte === 'planilha'
                                            ? <span className="text-[10px] rounded px-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">Compra 0 · planilha</span>
                                            : fmtData(s.data)}
                                        </td>
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
              <span className="text-xs text-gray-400">Pareto do custo teórico (A = 80% do custo · B = próximos 15% · C = resto). Foco de negociação e contagem nos <b>A</b>.</span>
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
                    <th className="text-center font-medium px-3 py-2">Classe</th>
                    <th className="text-left font-medium px-3 py-2">Cód.</th>
                    <th className="text-left font-medium px-3 py-2">Insumo</th>
                    <th className="text-right font-medium px-3 py-2">Custo teórico</th>
                    <th className="text-right font-medium px-3 py-2">% do total</th>
                    <th className="text-right font-medium px-3 py-2">% acum.</th>
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
            <p className="text-sm text-gray-500 dark:text-gray-400">Insumos que mudaram de preço e os produtos afetados. <b>Δ pp</b> = impacto estimado no CMV do produto. Clique pra ver os produtos.</p>
            {loadingImp ? <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
            : !impacto.length ? <Card className="card-dark"><CardContent className="py-16 text-center text-gray-400">Nenhuma variação de preço relevante.</CardContent></Card>
            : (
              <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
                    <th className="w-8 px-3 py-2"></th>
                    <th className="text-left font-medium px-3 py-2">Insumo</th>
                    <th className="text-right font-medium px-3 py-2">Variação</th>
                    <th className="text-right font-medium px-3 py-2">Produtos afetados</th>
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

        {/* Modal: editar insumo */}
        {editIns && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditIns(null)}>
            <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-sm space-y-3" onClick={e => e.stopPropagation()}>
              <h4 className="font-semibold text-gray-900 dark:text-white">Editar insumo</h4>
              <p className="text-sm text-gray-500">{editIns.nome}</p>
              <div>
                <label className="text-xs text-gray-500">Código Planilha</label>
                <Input value={fCod} onChange={e => setFCod(e.target.value)} placeholder="i0XXX" disabled={editIns.id_produto_sisfood_cotacao < 0} />
                {editIns.id_produto_sisfood_cotacao < 0 && <p className="text-[11px] text-gray-400 mt-0.5">Insumo só-planilha: código fixo.</p>}
                {editIns.cod_interno && editIns.cod_interno !== fCod && <p className="text-[11px] text-amber-500 mt-0.5">No VMarket está como &ldquo;{editIns.cod_interno}&rdquo;.</p>}
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <input type="checkbox" checked={fFc} onChange={e => setFFc(e.target.checked)} className="h-4 w-4 accent-amber-500" />
                Fator de correção (insumo com perda/limpeza)
              </label>
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
