'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { DateInputBR } from '@/components/ui/date-input-br';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Loader2, Upload, Send, EyeOff, RotateCcw, CheckCircle2, CreditCard } from 'lucide-react';

interface Linha {
  id: string;
  banco: 'itau' | 'nubank';
  origem_formato: string;
  data_transacao: string;
  descricao: string;
  valor: number;
  tipo: 'compra' | 'pagamento' | 'estorno';
  parcela: string | null;
  cartao_final: string | null;
  titular_nome: string | null;
  bar_id: number | null;
  categoria_id: string | null;
  categoria_nome: string | null;
  contaazul_lancamento_id: string | null;
  status: 'novo' | 'lancado' | 'ignorado';
}
interface Opcao { value: string; label: string }
interface OpcoesBar { categorias: Opcao[]; fornecedores: Opcao[]; contas: Opcao[] }

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtDataBR = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || '—'); };
const BANCO_LABEL: Record<string, string> = { itau: 'Itaú', nubank: 'Nubank' };

export function FaturaCartaoTab() {
  const { showToast } = useToast();
  const { availableBars, selectedBar } = useBar();

  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [lendo, setLendo] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [lancandoId, setLancandoId] = useState<string | null>(null);
  const [vencimento, setVencimento] = useState('');

  const [opcoesBar, setOpcoesBar] = useState<Record<number, OpcoesBar>>({});
  // Config por bar: fornecedor "cartão" (contato CA) + conta pagadora — usados no lançamento.
  const [config, setConfig] = useState<Record<number, { fornecedorId: string; contaId: string }>>({});

  // Filtros
  const [fBanco, setFBanco] = useState('');
  const [fCartao, setFCartao] = useState('');
  const [fBar, setFBar] = useState('');
  const [fBusca, setFBusca] = useState('');
  const [soCompras, setSoCompras] = useState(true);
  const [esconderLancados, setEsconderLancados] = useState(false);

  const barNome = useCallback((id: number | null) => availableBars.find(b => b.id === id)?.nome || `Bar ${id}`, [availableBars]);

  const carregarLista = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await api.get('/api/financeiro/cartao-fatura');
      setLinhas(res.linhas || []);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar', message: e?.message });
    } finally {
      setCarregando(false);
    }
  }, [showToast]);

  const carregarOpcoesBar = useCallback(async (barId: number) => {
    const j = (p: Promise<Response>) => p.then(r => r.json()).catch(() => ({}));
    const [cat, fo, ct] = await Promise.all([
      j(fetch(`/api/financeiro/contaazul/categorias?bar_id=${barId}`)),
      j(fetch(`/api/financeiro/contaazul/stakeholders?bar_id=${barId}&perfil=FORNECEDOR`)),
      j(fetch(`/api/financeiro/contaazul/contas-financeiras?bar_id=${barId}&somente_pagadoras=true`)),
    ]);
    const contasRaw = (ct.contas_financeiras || []).filter((c: any) => c.ativo !== false);
    const fornecedoresRaw = (fo.pessoas || []);
    setOpcoesBar(prev => ({
      ...prev,
      [barId]: {
        categorias: (cat.categorias || []).filter((c: any) => c.ativo !== false).map((c: any) => ({ value: c.contaazul_id, label: c.nome || c.categoria_nome })),
        fornecedores: fornecedoresRaw.map((p: any) => ({ value: p.contaazul_id, label: p.nome })),
        contas: contasRaw.map((c: any) => ({ value: String(c.contaazul_id), label: c.banco ? `${c.nome} (${c.banco})` : c.nome })),
      },
    }));
    // Defaults do bar (trocáveis, sem sobrescrever escolha do usuário):
    //  - conta = pagadora_padrao do bar
    //  - fornecedor "cartão" = última escolha salva (localStorage) OU match por nome (cartão/crédito)
    const padrao = contasRaw.find((c: any) => c.pagadora_padrao);
    const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const salvo = typeof window !== 'undefined' ? localStorage.getItem(`fatura_forn_bar_${barId}`) : null;
    const fornAuto = (salvo && fornecedoresRaw.some((p: any) => p.contaazul_id === salvo))
      ? salvo
      : (fornecedoresRaw.find((p: any) => /cartao|credito/.test(norm(p.nome)))?.contaazul_id || '');
    setConfig(prev => {
      const cur = prev[barId] || { fornecedorId: '', contaId: '' };
      return {
        ...prev,
        [barId]: {
          fornecedorId: cur.fornecedorId || fornAuto,
          contaId: cur.contaId || (padrao ? String(padrao.contaazul_id) : ''),
        },
      };
    });
  }, []);

  useEffect(() => { carregarLista(); }, [carregarLista]);
  useEffect(() => { availableBars.forEach(b => carregarOpcoesBar(b.id)); }, [availableBars, carregarOpcoesBar]);

  const importar = async (file: File) => {
    setLendo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const barId = localStorage.getItem('sgb_selected_bar_id');
      const res = await fetch('/api/financeiro/cartao-fatura/importar', {
        method: 'POST',
        headers: barId ? { 'x-selected-bar-id': barId } : {},
        body: fd,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'falha ao importar');
      showToast({
        type: 'success',
        title: `${BANCO_LABEL[json.banco] || json.banco} · ${json.importadas} linhas`,
        message: `${json.novos} novas, ${json.ja_vistos} já vistas (ignoradas na dedup).`,
      });
      await carregarLista();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao importar fatura', message: e?.message });
    } finally {
      setLendo(false);
    }
  };

  const patchLinha = async (l: Linha, updates: Partial<Linha>) => {
    setLinhas(prev => prev.map(x => (x.id === l.id ? { ...x, ...updates } : x)));
    try {
      await api.patch(`/api/financeiro/cartao-fatura/${l.id}`, updates);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao salvar', message: e?.message });
      carregarLista();
    }
  };

  const lancar = async (l: Linha) => {
    const bar = l.bar_id || selectedBar?.id || null;
    if (!bar) return showToast({ type: 'error', title: 'Escolha o bar da linha' });
    if (!l.categoria_id) return showToast({ type: 'error', title: 'Escolha a categoria' });
    if (!vencimento) return showToast({ type: 'error', title: 'Informe o vencimento da fatura no topo' });
    // fornecedor/conta: usa o config do bar se tiver; senão o back resolve (fornecedor cartão
    // por nome + conta pagadora padrão do bar).
    const cfg = config[bar];
    setLancandoId(l.id);
    try {
      const res = await api.post(`/api/financeiro/cartao-fatura/${l.id}/lancar`, {
        bar_id: bar,
        categoria_id: l.categoria_id,
        categoria_nome: l.categoria_nome,
        pessoa_id: cfg?.fornecedorId || undefined,
        conta_financeira_id: cfg?.contaId || undefined,
        data_vencimento: vencimento,
      });
      setLinhas(prev => prev.map(x => (x.id === l.id ? res.linha : x)));
      showToast({ type: 'success', title: 'Lançado no Conta Azul' });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Falha ao lançar', message: e?.message });
    } finally {
      setLancandoId(null);
    }
  };

  const cartoes = useMemo(
    () => Array.from(new Set(linhas.map(l => l.cartao_final).filter(Boolean))) as string[],
    [linhas]
  );

  const filtradas = useMemo(() => linhas.filter(l => {
    if (soCompras && l.tipo !== 'compra') return false;
    if (esconderLancados && l.status === 'lancado') return false;
    if (fBanco && l.banco !== fBanco) return false;
    if (fCartao && l.cartao_final !== fCartao) return false;
    if (fBar && String(l.bar_id ?? '') !== fBar) return false;
    if (fBusca && !l.descricao.toLowerCase().includes(fBusca.toLowerCase())) return false;
    return true;
  }), [linhas, soCompras, esconderLancados, fBanco, fCartao, fBar, fBusca]);

  const totalFiltrado = filtradas.reduce((s, l) => s + (l.tipo === 'compra' ? l.valor : 0), 0);
  const pendentes = filtradas.filter(l => l.status === 'novo' && l.tipo === 'compra').length;

  return (
    <div className="space-y-3">
      {/* Upload */}
      <label className="flex flex-col items-center justify-center gap-2 cursor-pointer rounded-lg border-2 border-dashed border-[hsl(var(--border))] py-6 hover:bg-muted/40 transition">
        {lendo ? (
          <><Loader2 className="w-7 h-7 animate-spin text-blue-500" /><span className="text-sm text-muted-foreground">Lendo a fatura…</span></>
        ) : (
          <>
            <Upload className="w-7 h-7 text-muted-foreground" />
            <span className="text-sm font-medium">Importar fatura em aberto</span>
            <span className="text-xs text-muted-foreground">Itaú (.xls/.xlsx) ou Nubank (.ofx recomendado / .csv) — detecta o banco sozinho</span>
          </>
        )}
        <input type="file" accept=".xls,.xlsx,.csv,.ofx" className="hidden" disabled={lendo}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.currentTarget.value = ''; }} />
      </label>

      {/* Config de lançamento (fornecedor + conta por bar) + vencimento */}
      <Card>
        <CardContent className="py-3 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-medium flex items-center gap-1.5"><CreditCard className="w-4 h-4" /> Lançamento — {selectedBar?.nome || 'bar atual'}</span>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Vencimento da fatura</Label>
              <DateInputBR value={vencimento} onChange={setVencimento} className="h-8 w-40" />
            </div>
          </div>
          {selectedBar && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">Fornecedor cartão (contato CA)</Label>
                <SearchableSelect
                  value={config[selectedBar.id]?.fornecedorId || ''}
                  onValueChange={(v) => {
                    const bid = selectedBar.id;
                    setConfig(c => ({ ...c, [bid]: { ...c[bid], fornecedorId: v || '', contaId: c[bid]?.contaId || '' } }));
                    if (typeof window !== 'undefined') {
                      if (v) localStorage.setItem(`fatura_forn_bar_${bid}`, v);
                      else localStorage.removeItem(`fatura_forn_bar_${bid}`);
                    }
                  }}
                  placeholder="Fornecedor cartão" searchPlaceholder="Buscar contato..." emptyMessage="Nenhum" options={opcoesBar[selectedBar.id]?.fornecedores || []} />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">Conta pagadora</Label>
                <SearchableSelect
                  value={config[selectedBar.id]?.contaId || ''}
                  onValueChange={(v) => { const bid = selectedBar.id; setConfig(c => ({ ...c, [bid]: { ...c[bid], contaId: v || '', fornecedorId: c[bid]?.fornecedorId || '' } })); }}
                  placeholder="Conta pagadora" searchPlaceholder="Filtrar..." emptyMessage="Nenhuma" options={opcoesBar[selectedBar.id]?.contas || []} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <select value={fBanco} onChange={(e) => setFBanco(e.target.value)} className="h-8 text-xs border rounded px-1.5 bg-background">
          <option value="">Todos os bancos</option>
          <option value="itau">Itaú</option>
          <option value="nubank">Nubank</option>
        </select>
        <select value={fCartao} onChange={(e) => setFCartao(e.target.value)} className="h-8 text-xs border rounded px-1.5 bg-background">
          <option value="">Todos os cartões</option>
          {cartoes.map(c => <option key={c} value={c}>final {c}</option>)}
        </select>
        <select value={fBar} onChange={(e) => setFBar(e.target.value)} className="h-8 text-xs border rounded px-1.5 bg-background">
          <option value="">Todos os bares</option>
          {availableBars.map(b => <option key={b.id} value={String(b.id)}>{b.nome}</option>)}
        </select>
        <Input value={fBusca} onChange={(e) => setFBusca(e.target.value)} placeholder="Buscar estabelecimento…" className="h-8 w-48 text-xs" />
        <Button size="sm" variant={soCompras ? 'default' : 'ghost'} onClick={() => setSoCompras(s => !s)}>Só compras</Button>
        <Button size="sm" variant={esconderLancados ? 'default' : 'ghost'} onClick={() => setEsconderLancados(s => !s)}>Esconder lançados</Button>
        <span className="ml-auto text-xs text-muted-foreground">{filtradas.length} linhas · {pendentes} a lançar · total <b>{fmtBRL(totalFiltrado)}</b></span>
      </div>

      {/* Tabela */}
      {carregando ? (
        <div className="py-12 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-muted-foreground" /></div>
      ) : filtradas.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">Nenhuma linha. Importe uma fatura acima.</CardContent></Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b bg-muted/30">
              <tr>
                <th className="text-left py-2 px-2">Data</th>
                <th className="text-left px-2">Estabelecimento</th>
                <th className="text-left px-2">Titular</th>
                <th className="text-left px-2">Cartão</th>
                <th className="text-right px-2">Valor</th>
                <th className="text-left px-2 w-32">Bar</th>
                <th className="text-left px-2 w-48">Categoria</th>
                <th className="text-right px-2">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(l => {
                // Linha sem bar assume o bar ATUAL (a fatura em geral é do bar selecionado).
                const barEfetivo = l.bar_id ?? selectedBar?.id ?? null;
                const ops = barEfetivo ? opcoesBar[barEfetivo] : undefined;
                const lancado = l.status === 'lancado';
                const ignorado = l.status === 'ignorado';
                return (
                  <tr key={l.id} className={`border-b last:border-0 ${ignorado ? 'opacity-40' : ''} ${lancado ? 'bg-green-500/5' : ''}`}>
                    <td className="py-1.5 px-2 whitespace-nowrap text-muted-foreground text-xs">{fmtDataBR(l.data_transacao)}</td>
                    <td className="px-2">
                      <div className="truncate max-w-[220px]">{l.descricao}{l.parcela ? <span className="text-muted-foreground text-xs"> · {l.parcela}</span> : ''}</div>
                    </td>
                    <td className="px-2 text-xs whitespace-nowrap">{l.titular_nome || '—'}</td>
                    <td className="px-2 text-xs text-muted-foreground whitespace-nowrap">{l.cartao_final ? `••${l.cartao_final}` : '—'}</td>
                    <td className="px-2 text-right whitespace-nowrap font-medium">{fmtBRL(l.valor)}</td>
                    <td className="px-2">
                      <select value={barEfetivo ?? ''} disabled={lancado}
                        onChange={(e) => patchLinha(l, { bar_id: e.target.value ? Number(e.target.value) : null, categoria_id: null, categoria_nome: null })}
                        className="h-8 w-full text-xs border rounded px-1 bg-background disabled:opacity-60">
                        <option value="">—</option>
                        {availableBars.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
                      </select>
                    </td>
                    <td className="px-2">
                      <select value={l.categoria_id ?? ''} disabled={lancado || !barEfetivo}
                        onChange={(e) => {
                          const id = e.target.value;
                          patchLinha(l, { categoria_id: id || null, categoria_nome: ops?.categorias.find(c => c.value === id)?.label || null });
                        }}
                        className={`h-8 w-full max-w-[200px] text-xs border rounded px-1 bg-background disabled:opacity-60 ${!l.categoria_id && !lancado ? 'border-amber-400' : ''}`}>
                        <option value="">{barEfetivo ? '— categoria —' : 'escolha o bar'}</option>
                        {(ops?.categorias || []).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </td>
                    <td className="px-2 text-right whitespace-nowrap">
                      {lancado ? (
                        <span className="inline-flex items-center gap-1 text-green-600 text-xs"><CheckCircle2 className="w-3.5 h-3.5" />Lançado</span>
                      ) : (
                        <div className="flex items-center gap-1 justify-end">
                          <Button size="sm" className="h-7 px-2" onClick={() => lancar(l)} disabled={lancandoId === l.id}>
                            {lancandoId === l.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3.5 h-3.5 mr-1" />Lançar</>}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" title={ignorado ? 'Reativar' : 'Ignorar'}
                            onClick={() => patchLinha(l, { status: ignorado ? 'novo' : 'ignorado' })}>
                            {ignorado ? <RotateCcw className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </Button>
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
      <p className="text-[11px] text-muted-foreground">
        💡 Fatura <b>em aberto</b> pra CMV — cada linha vira 1 lançamento no Conta Azul (no bar escolhido). Reimportar toda semana é seguro: a dedup por FITID/hash mostra só o que é novo. Pagamentos da fatura e estornos ficam de fora (filtro “Só compras”).
      </p>
    </div>
  );
}
