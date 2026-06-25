'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Package, RefreshCw, Search, Boxes, ChefHat } from 'lucide-react';

interface Produto {
  id_produto_sisfood_cotacao: number;
  cod_interno: string | null;
  nome: string | null;
  marca: string | null;
  gramatura: string | null;
  gramatura_contagem: string | null;
  estoque: number | null;
  nome_secao: string | null;
  id_secao_cotacao: number | null;
  nome_fornecedor: string | null;
  fator_embalagem: string | null;
  nao_requer_cotacao: number | null;
  cod_barras: string | null;
  dt_alteracao: string | null;
}
interface Secao { id_secao_cotacao: number; nome: string | null; fl_calc_cmv_faturamento: number | null; }

export default function InsumosPage() {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const barId = selectedBar?.id;
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
      if (r.success) {
        setProdutos(r.produtos || []);
        setSecoes(r.secoes || []);
        setSyncedEm(r.synced_em || null);
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message || 'Falha ao carregar insumos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [barId, toast]);
  useEffect(() => { carregar(); }, [carregar]);

  const sincronizar = async () => {
    if (!barId) return;
    setSincronizando(true);
    try {
      const r = await api.post('/api/operacional/insumos', { bar_id: barId, action: 'sync' });
      if (!r.success) throw new Error(r.error || 'Falha no sync');
      const res = r.resultado || {};
      toast({ title: 'VMarket sincronizado', description: `${res.produtos ?? 0} produtos · ${res.secoes ?? 0} seções · ${res.fornecedores ?? 0} fornecedores` });
      await carregar();
    } catch (e: any) {
      toast({ title: 'Erro no sync', description: e?.message || 'Falha', variant: 'destructive' });
    } finally {
      setSincronizando(false);
    }
  };

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return produtos.filter(p => {
      if (secaoSel !== 'todas' && String(p.id_secao_cotacao) !== secaoSel) return false;
      if (!q) return true;
      return (p.nome || '').toLowerCase().includes(q)
        || (p.cod_interno || '').toLowerCase().includes(q)
        || (p.marca || '').toLowerCase().includes(q)
        || (p.nome_fornecedor || '').toLowerCase().includes(q);
    });
  }, [produtos, busca, secaoSel]);

  const semDepara = produtos.filter(p => !p.cod_interno).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl"><Package className="w-6 h-6 text-emerald-600 dark:text-emerald-400" /></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Insumos</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Catálogo VMarket · {selectedBar?.nome || `Bar ${barId ?? ''}`}
                {syncedEm && <> · sync {new Date(syncedEm).toLocaleString('pt-BR')}</>}
              </p>
            </div>
          </div>
          <Button onClick={sincronizar} disabled={sincronizando || !barId} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${sincronizando ? 'animate-spin' : ''}`} />
            {sincronizando ? 'Sincronizando…' : 'Sincronizar VMarket'}
          </Button>
        </div>

        <Tabs defaultValue="produtos">
          <TabsList>
            <TabsTrigger value="produtos"><Boxes className="w-4 h-4 mr-1.5" />Produtos</TabsTrigger>
            <TabsTrigger value="producoes"><ChefHat className="w-4 h-4 mr-1.5" />Produções</TabsTrigger>
          </TabsList>

          {/* ===== PRODUTOS ===== */}
          <TabsContent value="produtos" className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, código (i0XXX), marca ou fornecedor…" className="pl-9" />
              </div>
              <select value={secaoSel} onChange={e => setSecaoSel(e.target.value)}
                className="h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100">
                <option value="todas">Todas as seções ({produtos.length})</option>
                {secoes.map(s => <option key={s.id_secao_cotacao} value={String(s.id_secao_cotacao)}>{s.nome}</option>)}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Badge variant="outline">{filtrados.length} de {produtos.length} produtos</Badge>
              {semDepara > 0 && <Badge variant="outline" className="text-amber-600 border-amber-300">{semDepara} sem código de insumo</Badge>}
            </div>

            <Card className="card-dark overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">Cód. insumo</th>
                        <th className="text-left font-medium px-3 py-2">Produto</th>
                        <th className="text-left font-medium px-3 py-2">Marca</th>
                        <th className="text-left font-medium px-3 py-2">Gramatura</th>
                        <th className="text-left font-medium px-3 py-2">Seção</th>
                        <th className="text-right font-medium px-3 py-2">Estoque</th>
                        <th className="text-left font-medium px-3 py-2">Fornecedor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {loading ? (
                        <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400">Carregando…</td></tr>
                      ) : filtrados.length === 0 ? (
                        <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400">Nenhum produto.</td></tr>
                      ) : filtrados.map(p => (
                        <tr key={p.id_produto_sisfood_cotacao} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-300">{p.cod_interno || <span className="text-amber-500">—</span>}</td>
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{p.nome}</td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{p.marca || '—'}</td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{p.gramatura || '—'}</td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{p.nome_secao || '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-200">{p.estoque ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{p.nome_fornecedor || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== PRODUÇÕES ===== */}
          <TabsContent value="producoes">
            <Card className="card-dark">
              <CardContent className="py-12 text-center">
                <ChefHat className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Produções (preparos)</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
                  Preparos internos (ex.: massa de quibe, molhos) não existem no VMarket — eles nascem na <strong>Ficha Técnica</strong>,
                  montando insumos. Esta aba será preenchida quando o módulo de Ficha Técnica entrar.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
