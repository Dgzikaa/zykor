'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { DateInputBR } from '@/components/ui/date-input-br';
import { ArrowRightLeft, Search, Trash2, Loader2, Plus } from 'lucide-react';

type Insumo = { id: number; codigo: string; nome: string; categoria?: string | null; preco_atual: number | null };
type Item = { codigo: string; nome: string; quantidade: number; custo_unitario: number };

const fmtBRL = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtQtd = (v: any) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const fmtData = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
const hojeISO = () => new Date().toISOString().slice(0, 10);
const parseNum = (s: string) => { const n = Number(String(s).replace(',', '.')); return Number.isFinite(n) ? n : 0; };

// Aba Trocas (item 2): quem ENVIA registra. Escolhe pra quem enviou (outro bar) + os insumos e qtd
// (custo puxa do preço do insumo → valor = Σ). Ao registrar, o Desvio dos dois bares corrige na hora
// (saída no emissor, entrada no recebedor). Lançamento no Conta Azul = passo seguinte (ainda não liga aqui).
export default function TrocasTab({ barId, onLancado }: { barId: number; onLancado?: () => void }) {
  const { selectedBar, availableBars } = useBar();
  const { toast } = useToast();
  const outrosBares = useMemo(() => availableBars.filter((b) => b.id !== barId), [availableBars, barId]);

  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [busca, setBusca] = useState('');
  const [itens, setItens] = useState<Item[]>([]);
  const [barDestino, setBarDestino] = useState<number | null>(null);
  const [dataComp, setDataComp] = useState(hojeISO());
  const [descricao, setDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [trocas, setTrocas] = useState<any[]>([]);
  const [caPreview, setCaPreview] = useState<{ id: string; competencia: string; plano: any[]; pix?: any } | null>(null);
  const [caLoading, setCaLoading] = useState<string | null>(null);
  const [caLancando, setCaLancando] = useState(false);

  // preview (dry-run) dos lançamentos no CA — mostra as pernas SEM postar nada
  const abrirPreviewCA = async (trocaId: string) => {
    setCaLoading(trocaId);
    try {
      const r = await api.post(`/api/financeiro/trocas/${trocaId}/lancar-ca`, { dryRun: true });
      if (!r.success) throw new Error(r.error);
      setCaPreview({ id: trocaId, competencia: r.competencia, plano: r.plano || [], pix: r.pix });
    } catch (e: any) {
      toast({ title: 'Erro no preview', description: e?.message || 'Falha', variant: 'destructive' });
    } finally { setCaLoading(null); }
  };
  // confirma → posta de verdade (CA não tem DELETE)
  const confirmarCA = async () => {
    if (!caPreview) return;
    setCaLancando(true);
    try {
      const r = await api.post(`/api/financeiro/trocas/${caPreview.id}/lancar-ca`, { dryRun: false });
      if (!r.success) throw new Error(r.error || 'Falha ao lançar');
      if (r.pix?.erro) {
        toast({ title: 'Lançado no CA — mas o PIX falhou', description: `${r.pix.erro}. Faça o PIX manualmente.`, variant: 'destructive' });
      } else if (r.pix?.codigo) {
        toast({ title: 'Lançado + PIX agendado', description: 'CA (2 pernas) + PIX no Inter da contraparte pro bar recebedor' });
      } else {
        toast({ title: 'Lançado no Conta Azul', description: 'Receita a receber no emissor + despesa a pagar no recebedor' });
      }
      setCaPreview(null); carregarTrocas();
    } catch (e: any) {
      toast({ title: 'Erro ao lançar no CA', description: e?.message || 'Falha', variant: 'destructive' });
    } finally { setCaLancando(false); }
  };

  useEffect(() => {
    if (!barId) return;
    api.get(`/api/operacional/insumos?bar_id=${barId}`).then((r) => { if (r.success) setInsumos(r.insumos || []); }).catch(() => {});
  }, [barId]);

  const carregarTrocas = useCallback(() => {
    api.get('/api/financeiro/trocas').then((r) => { if (r.success) setTrocas(r.trocas || []); }).catch(() => {});
  }, []);
  useEffect(() => { carregarTrocas(); }, [carregarTrocas, barId]);

  const filtrados = useMemo(() => {
    const s = busca.trim().toLowerCase();
    if (!s) return [];
    return insumos.filter((i) => (i.nome || '').toLowerCase().includes(s) || (i.codigo || '').toLowerCase().includes(s)).slice(0, 12);
  }, [insumos, busca]);

  const addItem = (i: Insumo) => {
    setItens((prev) => prev.some((x) => x.codigo === i.codigo) ? prev
      : [...prev, { codigo: i.codigo, nome: i.nome, quantidade: 1, custo_unitario: Number(i.preco_atual) || 0 }]);
    setBusca('');
  };
  const setQtd = (cod: string, q: number) => setItens((prev) => prev.map((x) => x.codigo === cod ? { ...x, quantidade: q } : x));
  const rmItem = (cod: string) => setItens((prev) => prev.filter((x) => x.codigo !== cod));
  const valor = useMemo(() => itens.reduce((s, i) => s + (i.quantidade || 0) * (i.custo_unitario || 0), 0), [itens]);

  const salvar = async () => {
    if (!barDestino) { toast({ title: 'Escolha pra quem foi a troca', variant: 'destructive' }); return; }
    if (itens.length === 0) { toast({ title: 'Adicione ao menos um insumo', variant: 'destructive' }); return; }
    setSalvando(true);
    try {
      const r = await api.post('/api/financeiro/trocas', {
        bar_destino: barDestino, data_competencia: dataComp, descricao,
        itens: itens.map((i) => ({ insumo_codigo: i.codigo, quantidade: i.quantidade, custo_unitario: i.custo_unitario })),
      });
      if (!r.success) throw new Error(r.error);
      toast({ title: 'Troca registrada', description: `${fmtBRL(r.valor)} · o desvio dos dois bares já foi corrigido` });
      setItens([]); setDescricao(''); setBarDestino(null);
      carregarTrocas(); onLancado?.();
    } catch (e: any) {
      toast({ title: 'Erro ao registrar troca', description: e?.message || 'Falha ao registrar', variant: 'destructive' });
    } finally { setSalvando(false); }
  };

  const nomeBar = (id: number) => availableBars.find((b) => b.id === id)?.nome || `Bar ${id}`;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4 space-y-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <ArrowRightLeft className="w-4 h-4 text-indigo-500" />
            <span><b>{selectedBar?.nome || 'Este bar'}</b> enviou/emprestou insumo pra outro bar. Registra aqui pra corrigir o estoque (desvio) dos dois.</span>
          </div>

          {outrosBares.length === 0 ? (
            <div className="text-sm text-gray-400 py-4 text-center">Você só tem acesso a um bar — sem contraparte pra troca.</div>
          ) : (
            <>
              {/* Pra quem enviou + competência */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Enviou pra qual bar?</label>
                  <select value={barDestino ?? ''} onChange={(e) => setBarDestino(e.target.value ? Number(e.target.value) : null)}
                    className="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm mt-1">
                    <option value="">Selecione…</option>
                    {outrosBares.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Data (competência)</label>
                  <div className="mt-1"><DateInputBR value={dataComp} onChange={setDataComp} /></div>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Descrição (opcional)</label>
                  <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="ex.: empréstimo de cerveja" className="mt-1" />
                </div>
              </div>

              {/* Busca de insumo */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar insumo por nome ou código…" className="pl-9" />
                {filtrados.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl max-h-64 overflow-y-auto">
                    {filtrados.map((i) => (
                      <button key={i.id} onClick={() => addItem(i)} className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800/60">
                        <span className="truncate">{i.nome} <span className="text-xs text-gray-400 font-mono">{i.codigo}</span></span>
                        <span className="text-xs text-gray-500 shrink-0 flex items-center gap-1">{i.preco_atual != null ? fmtBRL(i.preco_atual) : 's/ preço'}<Plus className="w-3.5 h-3.5 text-indigo-500" /></span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Itens da troca */}
              {itens.length > 0 && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 text-xs uppercase">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">Insumo</th>
                        <th className="text-right font-medium px-3 py-2 w-28">Qtd</th>
                        <th className="text-right font-medium px-3 py-2">Custo un.</th>
                        <th className="text-right font-medium px-3 py-2">Subtotal</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {itens.map((it) => (
                        <tr key={it.codigo}>
                          <td className="px-3 py-2">{it.nome} <span className="text-xs text-gray-400 font-mono">{it.codigo}</span></td>
                          <td className="px-3 py-2 text-right">
                            <Input value={String(it.quantidade)} inputMode="decimal" onChange={(e) => setQtd(it.codigo, parseNum(e.target.value))}
                              className="h-8 w-24 text-right tabular-nums ml-auto" />
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtBRL(it.custo_unitario)}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtBRL(it.quantidade * it.custo_unitario)}</td>
                          <td className="px-3 py-2 text-center"><button onClick={() => rmItem(it.codigo)} className="text-red-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-gray-600 dark:text-gray-300">Valor da troca: <b className="tabular-nums">{fmtBRL(valor)}</b> <span className="text-xs text-gray-400">(Σ custo dos insumos)</span></div>
                <Button onClick={salvar} disabled={salvando || !barDestino || itens.length === 0}>
                  {salvando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-1.5" />}Registrar troca
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Histórico de trocas do bar */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 text-sm font-semibold flex items-center gap-2"><ArrowRightLeft className="w-4 h-4 text-indigo-500" />Trocas do bar</div>
          {trocas.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">Nenhuma troca registrada ainda.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Data</th>
                    <th className="text-left font-medium px-3 py-2">Sentido</th>
                    <th className="text-left font-medium px-3 py-2">Contraparte</th>
                    <th className="text-left font-medium px-3 py-2">Itens</th>
                    <th className="text-right font-medium px-3 py-2">Valor</th>
                    <th className="text-right font-medium px-3 py-2">Conta Azul</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {trocas.map((t) => {
                    const enviou = t.sentido === 'enviou';
                    const contraparte = enviou ? t.bar_destino : t.bar_origem;
                    return (
                      <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-3 py-2 whitespace-nowrap">{fmtData(t.data_competencia)}</td>
                        <td className="px-3 py-2"><Badge variant="outline" className={enviou ? 'text-amber-700 border-amber-300' : 'text-emerald-700 border-emerald-300'}>{enviou ? '↑ enviou' : '↓ recebeu'}</Badge></td>
                        <td className="px-3 py-2">{nomeBar(contraparte)}</td>
                        <td className="px-3 py-2 text-gray-500 text-xs">{(t.troca_itens || []).map((i: any) => `${i.insumo_codigo}×${fmtQtd(i.quantidade)}`).join(', ')}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtBRL(t.valor)}</td>
                        <td className="px-3 py-2 text-right">
                          {t.status !== 'ca_lancado' ? (
                            <button onClick={() => abrirPreviewCA(t.id)} disabled={caLoading === t.id}
                              className="text-xs px-2 py-1 rounded border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50">
                              {caLoading === t.id ? '…' : 'Lançar'}
                            </button>
                          ) : t.inter_codigo_solicitacao ? (
                            <Badge variant="outline" className="text-emerald-700 border-emerald-300">✓ CA + PIX</Badge>
                          ) : (
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant="outline" className="text-amber-700 border-amber-300" title={t.inter_pix_erro || ''}>CA ok · PIX falhou</Badge>
                              {t.inter_pix_erro && <span className="text-[10px] text-amber-600 max-w-[180px] truncate" title={t.inter_pix_erro}>{t.inter_pix_erro}</span>}
                              <button onClick={() => abrirPreviewCA(t.id)} disabled={caLoading === t.id}
                                className="text-xs px-2 py-1 rounded border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50">
                                {caLoading === t.id ? '…' : 'Tentar PIX de novo'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview (dry-run) dos lançamentos no CA antes de confirmar */}
      {caPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !caLancando && setCaPreview(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-lg w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1 font-semibold text-gray-900 dark:text-white"><ArrowRightLeft className="w-4 h-4 text-indigo-500" />Lançar troca (Conta Azul + PIX)</div>
            <p className="text-xs text-gray-500 mb-3">Competência {fmtData(caPreview.competencia)}. ⚠️ O Conta Azul não permite excluir lançamento e o <b>PIX é dinheiro de verdade</b> — confira antes de confirmar.</p>
            <div className="space-y-2">
              {caPreview.plano.length === 0 && <div className="text-sm text-gray-400 text-center py-3">Nada a lançar.</div>}
              {caPreview.plano.map((l, i) => (
                <div key={i} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${l.ok ? 'border-gray-200 dark:border-gray-700' : 'border-red-300 bg-red-50 dark:bg-red-900/20'}`}>
                  <div>
                    <div className="font-medium text-gray-800 dark:text-gray-100">{l.sinal === 'RECEITA' ? 'Receita a receber' : 'Despesa a pagar'} · {nomeBar(l.bar)}</div>
                    <div className="text-xs text-gray-500">{l.ok ? l.categoria_nome : (l.erro || 'não resolvido')}</div>
                  </div>
                  <div className="tabular-nums font-semibold">{fmtBRL(l.valor)}</div>
                </div>
              ))}
            </div>

            {/* PIX no Inter (dinheiro de verdade) */}
            {caPreview.pix && (
              <div className={`mt-2 rounded-lg border px-3 py-2 text-sm ${caPreview.pix.ja_enviado ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20' : caPreview.pix.ok ? 'border-indigo-200 dark:border-indigo-700' : 'border-amber-300 bg-amber-50 dark:bg-amber-900/20'}`}>
                <div className="font-medium text-gray-800 dark:text-gray-100 flex items-center gap-1.5"><ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500" />PIX no Inter</div>
                {caPreview.pix.ja_enviado ? (
                  <div className="text-xs text-emerald-600 mt-0.5">✓ PIX já enviado nesta troca — não envia de novo.</div>
                ) : caPreview.pix.ok ? (
                  <div className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                    <b>{nomeBar(caPreview.pix.pagador_bar)}</b> paga <b className="tabular-nums">{fmtBRL(caPreview.pix.valor)}</b> → <b>{nomeBar(caPreview.pix.recebedor_bar)}</b>
                    <span className="text-gray-400"> · chave …{String(caPreview.pix.chave || '').slice(-6)}</span>
                  </div>
                ) : (
                  <div className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">Sem PIX: {caPreview.pix.erro}. Só as pernas do Conta Azul serão lançadas.</div>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setCaPreview(null)} disabled={caLancando}>Cancelar</Button>
              <Button onClick={confirmarCA} disabled={caLancando || caPreview.plano.length === 0 || caPreview.plano.some((l) => !l.ok)}>
                {caLancando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}Confirmar lançamento
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
