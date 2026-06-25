'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { ChefHat, Plus, Trash2, Search, Boxes, Utensils } from 'lucide-react';

const UNIDADES = ['un', 'kg', 'g', 'L', 'ml', 'porção'];

function FichasInner() {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const barId = selectedBar?.id;
  const sp = useSearchParams();

  const [producoes, setProducoes] = useState<any[]>([]);
  const [insumos, setInsumos] = useState<any[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [itens, setItens] = useState<any[]>([]);
  const [loadingItens, setLoadingItens] = useState(false);

  // form de novo componente
  const [tipo, setTipo] = useState<'insumo' | 'producao'>('insumo');
  const [busca, setBusca] = useState('');
  const [escolhido, setEscolhido] = useState<any>(null); // insumo ou produção escolhida
  const [qtd, setQtd] = useState('1');
  const [unidade, setUnidade] = useState('un');

  const carregarProducoes = useCallback(async () => {
    if (!barId) return;
    const r = await api.get(`/api/operacional/producoes?bar_id=${barId}`);
    if (r.success) setProducoes(r.producoes || []);
  }, [barId]);

  const carregarInsumos = useCallback(async () => {
    if (!barId) return;
    const r = await api.get(`/api/operacional/insumos?bar_id=${barId}`);
    if (r.success) setInsumos(r.produtos || []);
  }, [barId]);

  useEffect(() => { carregarProducoes(); carregarInsumos(); }, [carregarProducoes, carregarInsumos]);

  // preseleção via ?producao=
  useEffect(() => {
    const p = sp.get('producao');
    if (p) setSel(Number(p));
  }, [sp]);

  const carregarItens = useCallback(async (id: number) => {
    setLoadingItens(true);
    try {
      const r = await api.get(`/api/operacional/producoes/ficha?producao_id=${id}`);
      if (r.success) setItens(r.itens || []);
    } finally { setLoadingItens(false); }
  }, []);
  useEffect(() => { if (sel) carregarItens(sel); else setItens([]); }, [sel, carregarItens]);

  const producaoSel = producoes.find(p => p.id === sel) || null;

  const opcoes = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (tipo === 'insumo') {
      return insumos.filter(i => !q || (i.nome || '').toLowerCase().includes(q) || (i.cod_interno || '').toLowerCase().includes(q)).slice(0, 30);
    }
    return producoes.filter(p => p.id !== sel && (!q || (p.nome || '').toLowerCase().includes(q))).slice(0, 30);
  }, [tipo, busca, insumos, producoes, sel]);

  const adicionar = async () => {
    if (!sel || !escolhido) { toast({ title: 'Escolha o componente', variant: 'destructive' }); return; }
    const payload: any = { producao_id: sel, componente_tipo: tipo, quantidade: Number(qtd) || 0, unidade };
    if (tipo === 'insumo') { payload.insumo_codigo = escolhido.cod_interno; payload.insumo_id_vmarket = escolhido.id_produto_sisfood_cotacao; payload.nome_componente = escolhido.nome; }
    else { payload.producao_ref = escolhido.id; payload.nome_componente = escolhido.nome; }
    try {
      const r = await api.post('/api/operacional/producoes/ficha', payload);
      if (!r.success) throw new Error(r.error);
      setEscolhido(null); setBusca(''); setQtd('1');
      await carregarItens(sel); await carregarProducoes();
    } catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
  };

  const remover = async (id: number) => {
    try { const r = await api.delete(`/api/operacional/producoes/ficha?id=${id}`); if (!r.success) throw new Error(r.error); if (sel) { await carregarItens(sel); await carregarProducoes(); } }
    catch (e: any) { toast({ title: 'Erro', description: e?.message, variant: 'destructive' }); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Lista de produções */}
      <Card className="card-dark lg:col-span-1">
        <CardContent className="p-0">
          <div className="px-3 py-2 text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">Produções</div>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
            {producoes.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-gray-400">Cadastre produções em <strong>Insumos › Produções</strong>.</div>
            ) : producoes.map(p => (
              <button key={p.id} onClick={() => setSel(p.id)}
                className={`w-full text-left px-3 py-2 text-sm transition ${sel === p.id ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-medium' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>
                {p.nome}
                <span className="block text-xs text-gray-400">{p.qtd_componentes} itens · rende {Number(p.rendimento || 0).toLocaleString('pt-BR')} {p.unidade}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Ficha da produção selecionada */}
      <Card className="card-dark lg:col-span-2">
        <CardContent className="py-3">
          {!producaoSel ? (
            <div className="py-16 text-center text-gray-400"><ChefHat className="w-10 h-10 mx-auto mb-2 opacity-40" />Selecione uma produção para montar a ficha.</div>
          ) : (
            <>
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{producaoSel.nome}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Rende {Number(producaoSel.rendimento || 0).toLocaleString('pt-BR')} {producaoSel.unidade}{producaoSel.secao ? ` · ${producaoSel.secao}` : ''}</p>
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
                      <select value={unidade} onChange={e => setUnidade(e.target.value)} className="h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm">
                        {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
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
                          <button key={tipo === 'insumo' ? o.id_produto_sisfood_cotacao : o.id} onClick={() => { setEscolhido(o); }}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/40">
                            {o.nome} {tipo === 'insumo' && o.cod_interno && <span className="text-xs text-gray-400 font-mono">· {o.cod_interno}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Itens da ficha */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 dark:text-gray-400 border-b"><tr>
                    <th className="text-left font-medium px-2 py-1.5">Componente</th>
                    <th className="text-left font-medium px-2 py-1.5">Tipo</th>
                    <th className="text-right font-medium px-2 py-1.5">Qtd</th>
                    <th className="w-8"></th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {loadingItens ? <tr><td colSpan={4} className="px-2 py-6 text-center text-gray-400">Carregando…</td></tr>
                    : itens.length === 0 ? <tr><td colSpan={4} className="px-2 py-6 text-center text-gray-400">Ficha vazia — adicione os insumos/produções acima.</td></tr>
                    : itens.map(it => (
                      <tr key={it.id}>
                        <td className="px-2 py-1.5 text-gray-900 dark:text-gray-100">{it.nome_componente || it.insumo_codigo || `#${it.producao_ref}`}</td>
                        <td className="px-2 py-1.5"><span className={`text-[10px] rounded px-1.5 py-0.5 ${it.componente_tipo === 'producao' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>{it.componente_tipo === 'producao' ? 'Produção' : 'Insumo'}</span></td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{Number(it.quantidade || 0).toLocaleString('pt-BR')} {it.unidade || ''}</td>
                        <td className="px-2 py-1.5 text-right"><button onClick={() => remover(it.id)} className="text-red-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
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
            <p className="text-sm text-gray-500 dark:text-gray-400">Receitas que ligam insumos e produções</p>
          </div>
        </div>

        <Tabs defaultValue="producao">
          <TabsList>
            <TabsTrigger value="producao"><ChefHat className="w-4 h-4 mr-1.5" />Produção</TabsTrigger>
            <TabsTrigger value="finalizacao"><Utensils className="w-4 h-4 mr-1.5" />Finalização</TabsTrigger>
          </TabsList>

          <TabsContent value="producao">
            <Suspense fallback={<div className="py-16 text-center text-gray-400">Carregando…</div>}>
              <FichasInner />
            </Suspense>
          </TabsContent>

          <TabsContent value="finalizacao">
            <Card className="card-dark">
              <CardContent className="py-12 text-center">
                <Utensils className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Finalização (montagem do prato)</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
                  Aqui vai a ficha de finalização de cada item do cardápio (insumos + produções usados na montagem/finalização do prato).
                  Entra na próxima fase, ligada ao cardápio.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
