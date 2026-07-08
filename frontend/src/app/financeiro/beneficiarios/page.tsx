'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Users, Loader2, Search, Layers, Merge, ChevronRight } from 'lucide-react';
import AtracoesTab from './_components/AtracoesTab';

type Benef = {
  canonical_key: string; nome: string; documento: string | null;
  qtd_cadastros_ca: number; qtd_pagamentos: number; total_pago: number;
  primeiro_pgto: string | null; ultimo_pgto: string | null;
};
type Par = {
  key_a: string; nome_a: string; total_a: number; cad_a: number;
  key_b: string; nome_b: string; total_b: number; cad_b: number; similaridade: number;
};

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export default function BeneficiariosPage() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const { setPageTitle } = usePageTitle();
  useEffect(() => {
    setPageTitle('👥 Beneficiários');
    return () => setPageTitle('');
  }, [setPageTitle]);
  const [aba, setAba] = useState<'lista' | 'atracoes' | 'categorias' | 'duplicados'>('lista');

  const [linhas, setLinhas] = useState<Benef[]>([]);
  const [resumo, setResumo] = useState<{ pessoas: number; total_pago: number; com_duplicados: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [soDup, setSoDup] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [pares, setPares] = useState<Par[]>([]);
  const [loadingDup, setLoadingDup] = useState(false);
  const [unificando, setUnificando] = useState<string | null>(null);

  const [aberto, setAberto] = useState<string | null>(null);
  const [det, setDet] = useState<any>(null);
  const [loadingDet, setLoadingDet] = useState(false);

  const abrirDetalhe = async (key: string) => {
    if (aberto === key) { setAberto(null); return; }
    setAberto(key); setDet(null); setLoadingDet(true);
    try {
      const res = await api.get(`/api/financeiro/beneficiarios/detalhe?key=${encodeURIComponent(key)}`);
      setDet(res);
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao abrir detalhe', message: e?.message }); }
    finally { setLoadingDet(false); }
  };

  // Aba "Por categoria" (cruzamento: classe -> fornecedores)
  const [cats, setCats] = useState<any[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [catAberta, setCatAberta] = useState<string | null>(null);
  const [forn, setForn] = useState<any[]>([]);
  const [loadingForn, setLoadingForn] = useState(false);

  const carregarCats = useCallback(async () => {
    if (!selectedBar) return;
    setLoadingCats(true);
    try { const res = await api.get('/api/financeiro/beneficiarios/por-categoria'); setCats(res.categorias || []); }
    catch (e: any) { showToast({ type: 'error', title: 'Erro', message: e?.message }); }
    finally { setLoadingCats(false); }
  }, [selectedBar, showToast]);

  const abrirCat = async (categoria: string) => {
    if (catAberta === categoria) { setCatAberta(null); return; }
    setCatAberta(categoria); setForn([]); setLoadingForn(true);
    try { const res = await api.get(`/api/financeiro/beneficiarios/por-categoria?categoria=${encodeURIComponent(categoria)}`); setForn(res.fornecedores || []); }
    catch (e: any) { showToast({ type: 'error', title: 'Erro', message: e?.message }); }
    finally { setLoadingForn(false); }
  };
  useEffect(() => { if (aba === 'categorias' && cats.length === 0) carregarCats(); }, [aba, carregarCats, cats.length]);

  const carregar = useCallback(async () => {
    if (!selectedBar) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/financeiro/beneficiarios/historico?q=${encodeURIComponent(q)}&so_duplicados=${soDup ? '1' : '0'}&page=${page}&limit=100`);
      setLinhas(res.beneficiarios || []); setResumo(res.resumo || null); setTotal(res.total || 0);
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao carregar', message: e?.message }); }
    finally { setLoading(false); }
  }, [selectedBar, q, soDup, page, showToast]);

  const carregarDup = useCallback(async () => {
    if (!selectedBar) return;
    setLoadingDup(true);
    try {
      const res = await api.get('/api/financeiro/beneficiarios/duplicados');
      setPares(res.pares || []);
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao carregar duplicados', message: e?.message }); }
    finally { setLoadingDup(false); }
  }, [selectedBar, showToast]);

  useEffect(() => { setPage(1); }, [q, soDup]);
  useEffect(() => { if (aba === 'lista') { const t = setTimeout(carregar, 300); return () => clearTimeout(t); } }, [aba, carregar]);
  useEffect(() => { if (aba === 'duplicados') carregarDup(); }, [aba, carregarDup]);

  const unificar = async (p: Par) => {
    setUnificando(p.key_a + p.key_b);
    try {
      await api.post('/api/financeiro/beneficiarios/unificar', { keys: [p.key_a, p.key_b], nome: p.total_a >= p.total_b ? p.nome_a : p.nome_b });
      showToast({ type: 'success', title: 'Unificado', message: `${p.nome_a} + ${p.nome_b} viraram uma pessoa só.` });
      setPares(prev => prev.filter(x => !(x.key_a === p.key_a && x.key_b === p.key_b)));
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao unificar', message: e?.message }); }
    finally { setUnificando(null); }
  };

  return (
    <ProtectedRoute>
      <div className="mx-auto px-3 py-5">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-5 h-5" />
        </div>
        <p className="text-sm text-muted-foreground mb-4">Controle por pessoa — cadastros do Conta Azul unificados num só, com histórico de pagamentos.</p>

        <Tabs value={aba} onValueChange={(v) => setAba(v as 'lista' | 'atracoes' | 'categorias' | 'duplicados')} className="mb-4">
          <TabsList>
            <TabsTrigger value="lista">Lista</TabsTrigger>
            <TabsTrigger value="atracoes">Atrações</TabsTrigger>
            <TabsTrigger value="categorias">Por categoria</TabsTrigger>
            <TabsTrigger value="duplicados">Prováveis duplicados</TabsTrigger>
          </TabsList>
        </Tabs>

        {aba === 'atracoes' && <AtracoesTab />}

        {aba === 'lista' && (
          <>
            {resumo && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Pessoas</div><div className="text-lg font-bold">{resumo.pessoas}</div></CardContent></Card>
                <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Total pago</div><div className="text-lg font-bold">{fmtBRL(resumo.total_pago)}</div></CardContent></Card>
                <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Com cadastros duplicados no CA</div><div className="text-lg font-bold text-amber-600">{resumo.com_duplicados}</div></CardContent></Card>
              </div>
            )}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome…" className="pl-8" />
              </div>
              <Button variant={soDup ? 'default' : 'outline'} size="sm" onClick={() => setSoDup(s => !s)}>
                <Layers className="w-4 h-4 mr-1.5" />{soDup ? 'Mostrando duplicados' : 'Só duplicados'}
              </Button>
            </div>
            {loading ? (
              <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
            ) : linhas.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground"><Users className="w-9 h-9 mx-auto mb-2 opacity-40" />Nenhum beneficiário.</CardContent></Card>
            ) : (
              <Card className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b"><tr>
                    <th className="text-left px-3 py-2 sticky left-0 bg-card min-w-[200px]">Pessoa</th>
                    <th className="text-left px-3 py-2 whitespace-nowrap">Documento</th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">Pagamentos</th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">Total pago</th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">Último</th>
                  </tr></thead>
                  <tbody>
                    {linhas.map((b) => (
                      <Fragment key={b.canonical_key}>
                        <tr className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => abrirDetalhe(b.canonical_key)}>
                          <td className="px-3 py-1.5 sticky left-0 bg-card">
                            <div className="font-medium truncate max-w-[240px] flex items-center gap-1">
                              <ChevronRight className={`w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform ${aberto === b.canonical_key ? 'rotate-90' : ''}`} />
                              {b.nome}
                            </div>
                            {Number(b.qtd_cadastros_ca) > 1 && <span className="text-[10px] text-amber-600 ml-[18px]">⚠ {b.qtd_cadastros_ca} cadastros no CA unificados</span>}
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{b.documento || '—'}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{b.qtd_pagamentos}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-medium">{fmtBRL(Number(b.total_pago))}</td>
                          <td className="px-3 py-1.5 text-right whitespace-nowrap text-muted-foreground">{b.ultimo_pgto || '—'}</td>
                        </tr>
                        {aberto === b.canonical_key && (
                          <tr className="bg-muted/20"><td colSpan={5} className="px-3 py-3">
                            {loadingDet ? (
                              <div className="py-4 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
                            ) : det ? (
                              <div className="space-y-3">
                                <div className="flex gap-4 text-xs flex-wrap">
                                  <span>Saídas: <b className="text-red-600">{fmtBRL(det.resumo.saidas)}</b></span>
                                  {det.resumo.entradas > 0 && <span>Entradas: <b className="text-emerald-600">{fmtBRL(det.resumo.entradas)}</b></span>}
                                  <span className="text-muted-foreground">{det.resumo.qtd} lançamentos · principal: <b>{det.resumo.categoria_principal || '—'}</b></span>
                                </div>
                                {det.categorias?.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {det.categorias.slice(0, 10).map((c: any) => (
                                      <span key={c.categoria} className="text-[11px] rounded bg-muted px-2 py-0.5">{c.categoria}: <b>{fmtBRL(c.valor)}</b></span>
                                    ))}
                                  </div>
                                )}
                                <div className="max-h-72 overflow-y-auto rounded border bg-card">
                                  <table className="w-full text-xs">
                                    <thead className="text-muted-foreground border-b sticky top-0 bg-card"><tr>
                                      <th className="text-left px-2 py-1 whitespace-nowrap">Data</th>
                                      <th className="text-left px-2">Categoria</th>
                                      <th className="text-left px-2">Descrição</th>
                                      <th className="text-right px-2 whitespace-nowrap">Valor</th>
                                    </tr></thead>
                                    <tbody>
                                      {det.itens.slice(0, 300).map((i: any, idx: number) => (
                                        <tr key={idx} className="border-b last:border-0">
                                          <td className="px-2 py-1 whitespace-nowrap text-muted-foreground">{i.data || i.competencia || '—'}</td>
                                          <td className="px-2 truncate max-w-[140px]">{i.categoria || '—'}</td>
                                          <td className="px-2 truncate max-w-[220px] text-muted-foreground">{i.descricao || '—'}</td>
                                          <td className={`px-2 text-right whitespace-nowrap tabular-nums ${i.tipo === 'RECEITA' ? 'text-emerald-600' : ''}`}>{fmtBRL(i.valor)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ) : null}
                          </td></tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
            {total > 100 && (
              <div className="flex items-center justify-between mt-3 text-sm gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</Button>
                <span className="text-muted-foreground text-center">Página {page} de {Math.ceil(total / 100)} · {total} pessoas</span>
                <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 100) || loading} onClick={() => setPage(p => p + 1)}>Próxima</Button>
              </div>
            )}
          </>
        )}

        {aba === 'categorias' && (
          <>
            <p className="text-sm text-muted-foreground mb-3">Onde o dinheiro vai, por tipo. Clique numa categoria pra ver os fornecedores dela.</p>
            {loadingCats ? (
              <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
            ) : (
              <Card className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b"><tr>
                    <th className="text-left px-3 py-2 min-w-[200px]">Categoria</th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">Fornecedores</th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">Pagamentos</th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">Média/mês</th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">Total</th>
                  </tr></thead>
                  <tbody>
                    {cats.map((c) => (
                      <Fragment key={c.categoria}>
                        <tr className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => abrirCat(c.categoria)}>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-1 font-medium">
                              <ChevronRight className={`w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform ${catAberta === c.categoria ? 'rotate-90' : ''}`} />
                              <span className="truncate max-w-[240px]">{c.categoria}</span>
                            </div>
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{c.qtd_fornecedores}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{c.qtd_pagamentos}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{fmtBRL(c.media_mes)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-medium">{fmtBRL(c.total)}</td>
                        </tr>
                        {catAberta === c.categoria && (
                          <tr className="bg-muted/20"><td colSpan={5} className="px-3 py-2">
                            {loadingForn ? (
                              <div className="py-3 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
                            ) : (
                              <div className="space-y-0.5 max-h-80 overflow-y-auto">
                                {forn.map((f) => (
                                  <div key={f.canonical_key} className="flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-muted/40">
                                    <span className="truncate max-w-[60%]">{f.nome}</span>
                                    <span className="text-muted-foreground whitespace-nowrap">{f.qtd}× · <b className="text-foreground">{fmtBRL(f.total)}</b></span>
                                  </div>
                                ))}
                                {forn.length === 0 && <div className="text-xs text-muted-foreground px-2">—</div>}
                              </div>
                            )}
                          </td></tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </>
        )}

        {aba === 'duplicados' && (
          <>
            <p className="text-sm text-muted-foreground mb-3">Pessoas com nome parecido que parecem ser a mesma. Confira e clique <b>Unificar</b> — o histórico junta e o Conta Azul não é alterado (reversível).</p>
            {loadingDup ? (
              <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
            ) : pares.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground"><Merge className="w-9 h-9 mx-auto mb-2 opacity-40" />Nenhum provável duplicado. 🎉</CardContent></Card>
            ) : (
              <div className="space-y-2">
                {pares.map((p) => (
                  <Card key={p.key_a + p.key_b}>
                    <CardContent className="py-3 flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-[220px] text-sm">
                        <div className="truncate"><b>{p.nome_a}</b> <span className="text-muted-foreground">· {fmtBRL(Number(p.total_a))}</span></div>
                        <div className="truncate"><b>{p.nome_b}</b> <span className="text-muted-foreground">· {fmtBRL(Number(p.total_b))}</span></div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">semelhança {(Number(p.similaridade) * 100).toFixed(0)}%</div>
                      </div>
                      <Button size="sm" onClick={() => unificar(p)} disabled={unificando === p.key_a + p.key_b}>
                        {unificando === p.key_a + p.key_b ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Merge className="w-4 h-4 mr-2" />}
                        Unificar
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
