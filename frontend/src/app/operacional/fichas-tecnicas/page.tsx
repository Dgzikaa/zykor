'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { ChefHat, Plus, Trash2, Search, Boxes, Utensils, Star, Loader2, Pencil } from 'lucide-react';

const UNIDADES = ['un', 'kg', 'g', 'L', 'ml', 'porção'];
const fmtBRL = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPeso = (q: any, u: string | null) => {
  const n = Number(q || 0);
  if (u === 'kg') return n < 1 && n > 0 ? `${(n * 1000).toLocaleString('pt-BR')} g` : `${n.toLocaleString('pt-BR')} kg`;
  if (u === 'L') return n < 1 && n > 0 ? `${(n * 1000).toLocaleString('pt-BR')} ml` : `${n.toLocaleString('pt-BR')} L`;
  return `${n.toLocaleString('pt-BR')}${u ? ' ' + u : ''}`;
};

interface FichaTabProps {
  kind: 'producao' | 'produto';
  lista: any[];
  insumos: any[];
  producoes: any[];
  reloadLista: () => void;
  preSel?: number | null;
}

function FichaTab({ kind, lista, insumos, producoes, reloadLista, preSel }: FichaTabProps) {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const barId = selectedBar?.id;
  const parentParam = kind === 'producao' ? 'producao_id' : 'produto_id';

  const [sel, setSel] = useState<number | null>(preSel ?? null);
  const [buscaLista, setBuscaLista] = useState('');
  const [itens, setItens] = useState<any[]>([]);
  const [loadingItens, setLoadingItens] = useState(false);

  const [tipo, setTipo] = useState<'insumo' | 'producao'>('insumo');
  const [busca, setBusca] = useState('');
  const [escolhido, setEscolhido] = useState<any>(null);
  const [qtd, setQtd] = useState('1');
  const [unidade, setUnidade] = useState('un');

  useEffect(() => { if (preSel) setSel(preSel); }, [preSel]);

  const carregarItens = useCallback(async (id: number) => {
    setLoadingItens(true);
    try {
      const r = await api.get(`/api/operacional/producoes/ficha?${parentParam}=${id}&bar_id=${barId}`);
      if (r.success) setItens(r.itens || []);
    } finally { setLoadingItens(false); }
  }, [parentParam, barId]);
  useEffect(() => { if (sel) carregarItens(sel); else setItens([]); }, [sel, carregarItens]);

  const listaView = useMemo(() => {
    const q = buscaLista.trim().toLowerCase();
    return lista.filter(p => !q || (p.nome || '').toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q));
  }, [lista, buscaLista]);

  const selObj = lista.find(p => p.id === sel) || null;
  const custoTotal = itens.reduce((s, it) => s + Number(it.custo_planilha || 0), 0);

  const opcoes = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (tipo === 'insumo') return insumos.filter(i => !q || (i.nome || '').toLowerCase().includes(q) || (i.cod_interno || '').toLowerCase().includes(q)).slice(0, 30);
    return producoes.filter(p => p.id !== sel && (!q || (p.nome || '').toLowerCase().includes(q))).slice(0, 30);
  }, [tipo, busca, insumos, producoes, sel]);

  const adicionar = async () => {
    if (!sel || !escolhido) { toast({ title: 'Escolha o componente', variant: 'destructive' }); return; }
    const payload: any = { [parentParam]: sel, componente_tipo: tipo, quantidade: Number(qtd) || 0, unidade };
    if (tipo === 'insumo') { payload.insumo_codigo = escolhido.cod_interno; payload.insumo_id_vmarket = escolhido.id_produto_sisfood_cotacao; payload.nome_componente = escolhido.nome; }
    else { payload.producao_ref = escolhido.id; payload.nome_componente = escolhido.nome; }
    try {
      const r = await api.post('/api/operacional/producoes/ficha', payload);
      if (!r.success) throw new Error(r.error);
      setEscolhido(null); setBusca(''); setQtd('1');
      await carregarItens(sel); reloadLista();
    } catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
  };
  const remover = async (id: number) => {
    try { const r = await api.delete(`/api/operacional/producoes/ficha?id=${id}`); if (!r.success) throw new Error(r.error); if (sel) { await carregarItens(sel); reloadLista(); } }
    catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
  };
  const marcarMestre = async (it: any) => {
    try { await api.put('/api/operacional/producoes/ficha', { id: it.id, is_mestre: !it.is_mestre }); if (sel) await carregarItens(sel); }
    catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
  };

  // edição de item (modal)
  const [editItem, setEditItem] = useState<any>(null);
  const [editQtd, setEditQtd] = useState('');
  const [editUni, setEditUni] = useState('');
  const abrirEdit = (it: any) => { setEditItem(it); setEditQtd(String(it.quantidade ?? '')); setEditUni(it.unidade || ''); };
  const salvarEdit = async () => {
    if (!editItem) return;
    try {
      await api.put('/api/operacional/producoes/ficha', { id: editItem.id, quantidade: Number(editQtd) || 0, unidade: editUni || null });
      setEditItem(null); if (sel) await carregarItens(sel);
    } catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
  };
  // custo pelo último preço: usa o calculado; se destoar muito da planilha (unidade a revisar), cai pro planilha
  const flagRevisar = (it: any) => Number(it.custo_planilha || 0) > 0 && it.custo_atual != null && it.custo_atual > Number(it.custo_planilha) * 5;
  const custoItemAtual = (it: any) => (it.custo_atual != null && !flagRevisar(it)) ? it.custo_atual : Number(it.custo_planilha || 0);
  const custoAtualTotal = itens.reduce((s, it) => s + custoItemAtual(it), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Lista de fichas */}
      <Card className="card-dark lg:col-span-1">
        <CardContent className="p-0">
          <div className="p-2 border-b border-gray-100 dark:border-gray-800">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input value={buscaLista} onChange={e => setBuscaLista(e.target.value)} placeholder={kind === 'producao' ? 'Buscar produção…' : 'Buscar produto…'} className="pl-9 h-9" />
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
            {listaView.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-gray-400">
                {kind === 'producao' ? 'Cadastre/importe produções em Cadastros › Produções.' : 'Importe o cardápio em Cadastros › Produtos.'}
              </div>
            ) : listaView.map(p => (
              <button key={p.id} onClick={() => setSel(p.id)}
                className={`w-full text-left px-3 py-2 text-sm transition ${sel === p.id ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-medium' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>
                {p.nome}
                <span className="block text-xs text-gray-400">{p.codigo ? `${p.codigo} · ` : ''}{p.qtd_componentes ?? 0} itens</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Ficha selecionada */}
      <Card className="card-dark lg:col-span-2">
        <CardContent className="py-3">
          {!selObj ? (
            <div className="py-16 text-center text-gray-400"><ChefHat className="w-10 h-10 mx-auto mb-2 opacity-40" />Selecione {kind === 'producao' ? 'uma produção' : 'um produto'} para ver/montar a ficha.</div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{selObj.nome}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {selObj.codigo ? `${selObj.codigo} · ` : ''}{itens.length} componentes
                    {kind === 'producao' && selObj.rendimento != null ? ` · rende ${Number(selObj.rendimento).toLocaleString('pt-BR')} ${selObj.unidade || ''}` : ''}
                  </p>
                </div>
                <div className="flex gap-5 text-right">
                  <div>
                    <div className="text-[11px] text-muted-foreground">Custo (planilha)</div>
                    <div className="text-lg font-bold">{fmtBRL(custoTotal)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">Custo (últ. preço)</div>
                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{fmtBRL(custoAtualTotal)}</div>
                  </div>
                </div>
              </div>

              {/* Adicionar componente */}
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 mb-3 space-y-2">
                <div className="flex gap-1">
                  <button onClick={() => { setTipo('insumo'); setEscolhido(null); }} className={`text-xs rounded px-2.5 py-1 flex items-center gap-1 ${tipo === 'insumo' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}><Boxes className="w-3.5 h-3.5" />Insumo</button>
                  <button onClick={() => { setTipo('producao'); setEscolhido(null); }} className={`text-xs rounded px-2.5 py-1 flex items-center gap-1 ${tipo === 'producao' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}><ChefHat className="w-3.5 h-3.5" />Produção</button>
                </div>
                {escolhido ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[180px]">
                      <label className="text-xs text-gray-500">Componente</label>
                      <div className="h-10 flex items-center px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm justify-between">
                        <span className="truncate">{escolhido.nome}</span>
                        <button onClick={() => setEscolhido(null)} className="text-gray-400 hover:text-gray-600 text-xs ml-2">trocar</button>
                      </div>
                    </div>
                    <div className="w-24"><label className="text-xs text-gray-500">Qtd</label><Input type="number" step="0.001" value={qtd} onChange={e => setQtd(e.target.value)} /></div>
                    <div className="w-28"><label className="text-xs text-gray-500">Unidade</label>
                      <select value={unidade} onChange={e => setUnidade(e.target.value)} className="h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm">{UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}</select>
                    </div>
                    <Button onClick={adicionar}><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder={tipo === 'insumo' ? 'Buscar insumo (nome ou i0XXX)…' : 'Buscar produção…'} className="pl-9" />
                    </div>
                    {busca && (
                      <div className="max-h-48 overflow-y-auto rounded border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                        {opcoes.length === 0 ? <div className="px-3 py-3 text-xs text-gray-400">Nada encontrado.</div>
                        : opcoes.map((o: any) => (
                          <button key={tipo === 'insumo' ? o.id_produto_sisfood_cotacao : o.id} onClick={() => setEscolhido(o)} className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/40">
                            {o.nome} {tipo === 'insumo' && o.cod_interno && <span className="text-xs text-gray-400 font-mono">· {o.cod_interno}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Componentes da ficha */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 dark:text-gray-400 border-b"><tr>
                    {kind === 'producao' && <th className="text-center font-medium px-2 py-1.5 w-10" title="Insumo mestre (principal)">Mestre</th>}
                    <th className="text-left font-medium px-2 py-1.5">Código</th>
                    <th className="text-left font-medium px-2 py-1.5">Componente</th>
                    <th className="text-left font-medium px-2 py-1.5">Tipo</th>
                    <th className="text-right font-medium px-2 py-1.5">Peso/Qtd</th>
                    <th className="text-right font-medium px-2 py-1.5">Preço insumo</th>
                    <th className="text-right font-medium px-2 py-1.5">Valor (plan.)</th>
                    <th className="text-right font-medium px-2 py-1.5">Valor (últ.)</th>
                    <th className="w-14"></th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {loadingItens ? <tr><td colSpan={kind === 'producao' ? 9 : 8} className="px-2 py-6 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
                    : itens.length === 0 ? <tr><td colSpan={kind === 'producao' ? 9 : 8} className="px-2 py-6 text-center text-gray-400">Ficha vazia — adicione os insumos/produções acima.</td></tr>
                    : itens.map(it => (
                      <tr key={it.id} className={it.is_mestre ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}>
                        {kind === 'producao' && (
                          <td className="px-2 py-1.5 text-center">
                            <button onClick={() => marcarMestre(it)} title={it.is_mestre ? 'Insumo mestre' : 'Marcar como mestre'}>
                              <Star className={`w-4 h-4 mx-auto ${it.is_mestre ? 'text-amber-500 fill-amber-500' : 'text-gray-300 hover:text-amber-400'}`} />
                            </button>
                          </td>
                        )}
                        <td className="px-2 py-1.5 font-mono text-xs text-gray-500">{it.componente_codigo || '—'}</td>
                        <td className="px-2 py-1.5 text-gray-900 dark:text-gray-100">{it.nome_componente || it.componente_codigo || `#${it.producao_ref}`}</td>
                        <td className="px-2 py-1.5"><span className={`text-[10px] rounded px-1.5 py-0.5 ${it.componente_tipo === 'producao' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>{it.componente_tipo === 'producao' ? 'Produção' : 'Insumo'}</span></td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{fmtPeso(it.quantidade, it.base || it.unidade)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{it.preco_atual != null ? fmtBRL(it.preco_atual) : '—'}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-medium">{fmtBRL(it.custo_planilha)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                          {flagRevisar(it) ? <span className="text-amber-500 text-xs" title="Custo destoa muito — revisar a unidade/embalagem do insumo">⚠ revisar</span>
                            : it.custo_atual != null ? fmtBRL(it.custo_atual) : '—'}
                        </td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          <button onClick={() => abrirEdit(it)} className="text-gray-400 hover:text-gray-600 mr-1" title="Editar"><Pencil className="w-4 h-4 inline" /></button>
                          <button onClick={() => remover(it.id)} className="text-red-500 hover:text-red-600" title="Remover"><Trash2 className="w-4 h-4 inline" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Modal de edição do item */}
                {editItem && (
                  <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditItem(null)}>
                    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Editar componente</h4>
                      <p className="text-sm text-gray-500 mb-3">{editItem.nome_componente}</p>
                      <div className="flex gap-2">
                        <div className="flex-1"><label className="text-xs text-gray-500">Quantidade</label><Input type="number" step="0.001" value={editQtd} onChange={e => setEditQtd(e.target.value)} /></div>
                        <div className="w-28"><label className="text-xs text-gray-500">Unidade</label>
                          <select value={editUni} onChange={e => setEditUni(e.target.value)} className="h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm">
                            <option value="">—</option>{UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setEditItem(null)}>Cancelar</Button>
                        <Button onClick={salvarEdit}>Salvar</Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FichasInner() {
  const { selectedBar } = useBar();
  const barId = selectedBar?.id;
  const sp = useSearchParams();
  const preSel = sp.get('producao') ? Number(sp.get('producao')) : null;

  const [aba, setAba] = useState<'producao' | 'finalizacao'>('producao');
  const [producoes, setProducoes] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [insumos, setInsumos] = useState<any[]>([]);

  const loadProducoes = useCallback(async () => { if (!barId) return; const r = await api.get(`/api/operacional/producoes?bar_id=${barId}`); if (r.success) setProducoes(r.producoes || []); }, [barId]);
  const loadProdutos = useCallback(async () => { if (!barId) return; const r = await api.get(`/api/operacional/produtos?bar_id=${barId}`); if (r.success) setProdutos(r.produtos || []); }, [barId]);
  const loadInsumos = useCallback(async () => { if (!barId) return; const r = await api.get(`/api/operacional/insumos?bar_id=${barId}`); if (r.success) setInsumos(r.produtos || []); }, [barId]);
  useEffect(() => { loadProducoes(); loadProdutos(); loadInsumos(); }, [loadProducoes, loadProdutos, loadInsumos]);

  return (
    <>
      <div className="flex gap-1.5 mb-4">
        <button onClick={() => setAba('producao')} className={`flex items-center gap-1.5 text-sm rounded-md px-3 py-1.5 transition ${aba === 'producao' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 hover:bg-muted text-muted-foreground'}`}><ChefHat className="w-4 h-4" />Produção</button>
        <button onClick={() => setAba('finalizacao')} className={`flex items-center gap-1.5 text-sm rounded-md px-3 py-1.5 transition ${aba === 'finalizacao' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 hover:bg-muted text-muted-foreground'}`}><Utensils className="w-4 h-4" />Finalização</button>
      </div>
      {aba === 'producao'
        ? <FichaTab kind="producao" lista={producoes} insumos={insumos} producoes={producoes} reloadLista={loadProducoes} preSel={preSel} />
        : <FichaTab kind="produto" lista={produtos} insumos={insumos} producoes={producoes} reloadLista={loadProdutos} />}
    </>
  );
}

export default function FichasTecnicasPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-xl"><ChefHat className="w-6 h-6 text-purple-600 dark:text-purple-400" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fichas Técnicas</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Produção (preparos) e Finalização (cardápio) — insumos, peso, custo e insumo mestre</p>
          </div>
        </div>
        <Suspense fallback={<div className="py-16 text-center text-gray-400">Carregando…</div>}>
          <FichasInner />
        </Suspense>
      </div>
    </div>
  );
}
