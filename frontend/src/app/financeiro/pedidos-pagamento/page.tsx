'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { getSupabaseClient } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Plus, Loader2, AlertCircle, Receipt, Paperclip, Check, CalendarClock } from 'lucide-react';
import { type Pedido } from './types';
import { NovoPedidoDialog } from './components/NovoPedidoDialog';
import { PedidoDetailDialog } from './components/PedidoDetailDialog';
import { PedidoCard, type Opcao } from './components/PedidoCard';
import { FreelaTab } from './components/FreelaTab';
import { BoletoTab } from './components/BoletoTab';
import { CartaoTab } from './components/CartaoTab';
import TrocasTab from './components/TrocasTab';
import { FaturaCartaoTab } from './components/FaturaCartaoTab';

type ModoPagamento = 'pagamentos' | 'freela' | 'boleto' | 'cartao' | 'fatura' | 'trocas';

type TabKey = 'solicitado' | 'aprovado' | 'recusado' | 'todos';

// Fluxo 2 etapas: "Solicitado" = só o que espera APROVAÇÃO. "Aprovado" agrupa
// aprovado/agendado/pago + os erros de AGENDAMENTO (erro_ca/erro_inter) — que acontecem
// depois da aprovação e precisam de "Agendar" de novo.
const TAB_STATUS: Record<TabKey, (s: string) => boolean> = {
  solicitado: (s) => s === 'aguardando_aprovacao',
  aprovado: (s) => ['aprovado', 'agendado', 'pago', 'erro_ca', 'erro_inter'].includes(s),
  recusado: (s) => s === 'rejeitado' || s === 'cancelado',
  todos: () => true,
};

export default function PedidosPagamentoPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const barId = selectedBar?.id ?? null;

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [podeAprovar, setPodeAprovar] = useState(false);
  const [tab, setTab] = useState<TabKey>('solicitado');
  const [soMeus, setSoMeus] = useState(false);
  const [soComprovante, setSoComprovante] = useState(false);
  const [aprovandoTodos, setAprovandoTodos] = useState(false);
  const [agendandoTodos, setAgendandoTodos] = useState(false);
  // Seleções (categoria/conta/fornecedor) de cada card — alimenta o "Aprovar todos".
  const [selecoes, setSelecoes] = useState<Record<string, { catId: string; contaId: string; fornId: string }>>({});
  const [novoOpen, setNovoOpen] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [modo, setModo] = useState<ModoPagamento>('pagamentos');

  // Opções do CA carregadas 1x (só p/ quem aprova) → aprovação inline no card.
  const [opcoes, setOpcoes] = useState<{ categorias: Opcao[]; contas: Opcao[]; fornecedores: Opcao[] }>({
    categorias: [], contas: [], fornecedores: [],
  });

  useEffect(() => {
    setPageTitle('💸 Pedidos de Pagamento');
    return () => setPageTitle('');
  }, [setPageTitle]);

  // Deep-link "Novo pedido": `?novo=1` (ex.: atalho fixado no grupo de pagamentos) já
  // abre o popup. Limpa o param da URL depois p/ não reabrir ao recarregar/voltar.
  useEffect(() => {
    if (searchParams.get('novo') === '1') {
      setModo('pagamentos');
      setNovoOpen(true);
      router.replace('/financeiro/pedidos-pagamento');
    }
  }, [searchParams, router]);

  const carregar = useCallback(async (silent = false) => {
    if (!barId) return;
    if (!silent) setLoading(true);
    try {
      const res = await api.get(`/api/financeiro/pedidos-pagamento?escopo=${soMeus ? 'meus' : 'todos'}`);
      setPedidos(res.pedidos || []);
      setPodeAprovar(!!res.pode_aprovar);
    } catch (e: any) {
      if (!silent) showToast({ type: 'error', title: 'Erro ao carregar', message: e?.message });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [barId, soMeus, showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  // REAL-TIME (push): o servidor emite um "ping" por Broadcast a cada escrita
  // (criar/aprovar/rejeitar/pagar/editar) → a lista atualiza no mesmo segundo, sem
  // recarregar a tela. Sem RLS/dado no payload — o client só refetcha pela API.
  // Debounce curto colapsa rajadas (várias pessoas subindo pedidos juntas).
  useEffect(() => {
    if (!barId) return;
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    let deb: ReturnType<typeof setTimeout> | null = null;
    const agendar = () => {
      if (deb) clearTimeout(deb);
      deb = setTimeout(() => { if (!cancelled) carregar(true); }, 400);
    };
    (async () => {
      const supabase = await getSupabaseClient();
      if (!supabase || cancelled) return;
      channel = supabase
        .channel(`pedidos-pagamento:bar:${barId}`, { config: { broadcast: { self: false } } })
        .on('broadcast', { event: 'change' }, agendar)
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (deb) clearTimeout(deb);
      if (channel) getSupabaseClient().then((s) => s?.removeChannel(channel!)).catch(() => {});
    };
  }, [barId, carregar]);

  // Fallback do real-time: poll silencioso (12s) + ao voltar o foco pra aba. Cobre
  // rede caindo / broadcast perdido, sem piscar spinner. Só na aba "Pagamentos".
  useEffect(() => {
    if (!barId || modo !== 'pagamentos') return;
    const tick = () => { if (document.visibilityState === 'visible') carregar(true); };
    const t = setInterval(tick, 12000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [barId, modo, carregar]);

  // Opções do CA (categorias / contas pagadoras / fornecedores) — só se pode aprovar.
  useEffect(() => {
    if (!barId || !podeAprovar) return;
    let vivo = true;
    const j = (p: Promise<Response>) => p.then(r => r.json()).catch(() => ({}));
    Promise.all([
      j(fetch(`/api/financeiro/contaazul/categorias?bar_id=${barId}`)),
      j(fetch(`/api/financeiro/contaazul/contas-financeiras?bar_id=${barId}&somente_pagadoras=true`)),
      j(fetch(`/api/financeiro/contaazul/stakeholders?bar_id=${barId}&perfil=FORNECEDOR`)),
    ]).then(([cat, ct, fo]) => {
      if (!vivo) return;
      setOpcoes({
        categorias: (cat.categorias || []).filter((c: any) => c.ativo !== false)
          .map((c: any) => ({ value: c.contaazul_id, label: c.nome || c.categoria_nome })),
        contas: (ct.contas_financeiras || []).filter((c: any) => c.ativo !== false)
          .map((c: any) => ({ value: String(c.contaazul_id), label: c.banco ? `${c.nome} (${c.banco})` : c.nome })),
        fornecedores: (fo.pessoas || []).map((p: any) => ({ value: p.contaazul_id, label: p.nome, searchHint: p.documento || '' })),
      });
    });
    return () => { vivo = false; };
  }, [barId, podeAprovar]);

  // Freela é gerido/aprovado na aba própria (semanal) — fora da lista principal.
  const pedidosLista = useMemo(() => pedidos.filter(p => p.tipo !== 'freela'), [pedidos]);
  const filtrados = useMemo(
    () => pedidosLista.filter(p => TAB_STATUS[tab](p.status) && (!soComprovante || p.precisa_comprovante)),
    [pedidosLista, tab, soComprovante]
  );
  const countSolicitado = useMemo(() => pedidosLista.filter(p => TAB_STATUS.solicitado(p.status)).length, [pedidosLista]);
  // Prontos pra AGENDAR (aprovados ainda não disparados + erros de agendamento p/ retry).
  const agendaveis = useMemo(
    () => pedidosLista.filter(p => ['aprovado', 'erro_ca', 'erro_inter'].includes(p.status) && !(p.status === 'aprovado' && p.contaazul_lancamento_id)),
    [pedidosLista]
  );

  const onSelecao = useCallback((id: string, sel: { catId: string; contaId: string; fornId: string }) => {
    setSelecoes(prev => ({ ...prev, [id]: sel }));
  }, []);

  // Aprova em LOTE os pendentes que já estão prontos (categoria + fornecedor). SEQUENCIAL —
  // 1 de cada vez, sem rajada (evita rate limit do CA/Inter). Pula os incompletos e reporta.
  const aprovarTodos = useCallback(async () => {
    const pendentes = pedidosLista.filter(p => TAB_STATUS.solicitado(p.status));
    const prep = pendentes.map(p => {
      const sel = selecoes[p.id] || { catId: '', contaId: '', fornId: '' };
      const catId = sel.catId || p.categoria_id || p.categoria_sugerida_id || '';
      const fornId = sel.fornId || p.contaazul_pessoa_id || '';
      const contaId = sel.contaId || p.conta_financeira_id || '';
      return { p, catId, fornId, contaId, ready: !!catId && !!fornId };
    });
    const prontos = prep.filter(x => x.ready);
    const faltando = prep.length - prontos.length;
    if (!prontos.length) {
      return showToast({ type: 'warning', title: 'Nada pronto pra aprovar', message: 'Faltam categoria e/ou fornecedor nos pedidos.' });
    }
    if (!window.confirm(`Aprovar ${prontos.length} pedido(s) de uma vez?${faltando ? `\n${faltando} sem categoria/fornecedor ficam de fora.` : ''}`)) return;

    setAprovandoTodos(true);
    let ok = 0, err = 0;
    for (const x of prontos) {
      try {
        await api.post(`/api/financeiro/pedidos-pagamento/${x.p.id}/aprovar`, {
          categoria_id: x.catId,
          categoria_nome: opcoes.categorias.find(c => c.value === x.catId)?.label,
          contaazul_pessoa_id: x.fornId,
          conta_financeira_id: x.contaId || undefined,
        });
        ok++;
      } catch {
        err++;
      }
    }
    setAprovandoTodos(false);
    showToast({
      type: err ? 'warning' : 'success',
      title: `${ok} aprovado(s)`,
      message: [err ? `${err} com erro` : '', faltando ? `${faltando} pulados (dados faltando)` : ''].filter(Boolean).join(' · ') || undefined,
    });
    carregar();
  }, [pedidosLista, selecoes, opcoes.categorias, showToast, carregar]);

  // Agenda em LOTE (dispara CA + Inter) os aprovados. SEQUENCIAL — 1 timing, sem rate burst.
  const agendarTodos = useCallback(async () => {
    if (!agendaveis.length) return showToast({ type: 'warning', title: 'Nada pra agendar' });
    if (!window.confirm(`Agendar ${agendaveis.length} pedido(s)? Isso cria a conta no Conta Azul e dispara o PIX no Inter de cada um.`)) return;
    setAgendandoTodos(true);
    let ok = 0, err = 0;
    for (const p of agendaveis) {
      try { await api.post(`/api/financeiro/pedidos-pagamento/${p.id}/agendar`, {}); ok++; }
      catch { err++; }
    }
    setAgendandoTodos(false);
    showToast({ type: err ? 'warning' : 'success', title: `${ok} agendado(s)`, message: err ? `${err} com erro — confira os que ficaram em erro.` : undefined });
    carregar();
  }, [agendaveis, showToast, carregar]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="mx-auto px-3 py-5">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <Receipt className="w-5 h-5" />
              <p className="text-sm text-muted-foreground">
                {podeAprovar
                  ? 'Revise, comente e aprove. Aprovar cria a conta no Conta Azul e agenda o PIX no Inter.'
                  : 'Abra um pedido de pagamento. O financeiro analisa e aprova.'}
              </p>
            </div>
            {modo === 'pagamentos' && <Button onClick={() => setNovoOpen(true)}><Plus className="w-4 h-4 mr-2" />Novo pedido</Button>}
          </div>

          {/* Abas por tipo de pagamento */}
          <Tabs value={modo} onValueChange={(v) => setModo(v as ModoPagamento)} className="mb-4">
            <TabsList>
              <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
              <TabsTrigger value="freela">Freela</TabsTrigger>
              <TabsTrigger value="boleto">Boleto</TabsTrigger>
              <TabsTrigger value="cartao">Fatura Cartão Fechado</TabsTrigger>
              {podeAprovar && <TabsTrigger value="fatura">Fatura Cartão Aberto</TabsTrigger>}
              <TabsTrigger value="trocas">Trocas</TabsTrigger>
            </TabsList>
          </Tabs>

          {!barId && (
            <Card className="border-red-500/40">
              <CardContent className="py-10 text-center">
                <AlertCircle className="w-10 h-10 text-red-600 mx-auto mb-2" />
                <p className="font-semibold">Nenhum bar selecionado</p>
                <p className="text-sm text-muted-foreground">Selecione um bar no menu superior.</p>
              </CardContent>
            </Card>
          )}

          {barId && modo === 'freela' && <FreelaTab barId={barId} podeAprovar={podeAprovar} onLancado={carregar} />}

          {barId && modo === 'boleto' && <BoletoTab onCriado={carregar} />}

          {barId && modo === 'cartao' && <CartaoTab />}

          {barId && podeAprovar && modo === 'fatura' && <FaturaCartaoTab />}

          {barId && modo === 'trocas' && <TrocasTab barId={barId} onLancado={carregar} />}

          {barId && modo === 'pagamentos' && (
            <>
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
                  <TabsList>
                    <TabsTrigger value="solicitado">
                      Solicitado {countSolicitado > 0 && <Badge variant="secondary" className="ml-1.5">{countSolicitado}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="aprovado">Aprovado</TabsTrigger>
                    <TabsTrigger value="recusado">Recusado</TabsTrigger>
                    <TabsTrigger value="todos">Todos</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="flex items-center gap-2 flex-wrap">
                  {podeAprovar && tab === 'solicitado' && countSolicitado > 0 && (
                    <Button size="sm" onClick={aprovarTodos} disabled={aprovandoTodos}>
                      {aprovandoTodos ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}
                      Aprovar todos ({countSolicitado})
                    </Button>
                  )}
                  {podeAprovar && tab === 'aprovado' && agendaveis.length > 0 && (
                    <Button size="sm" onClick={agendarTodos} disabled={agendandoTodos}>
                      {agendandoTodos ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CalendarClock className="w-4 h-4 mr-1.5" />}
                      Agendar todos ({agendaveis.length})
                    </Button>
                  )}
                  <Button variant={soComprovante ? 'default' : 'ghost'} size="sm" onClick={() => setSoComprovante(s => !s)}>
                    <Paperclip className="w-3.5 h-3.5 mr-1.5" />
                    {soComprovante ? 'Só c/ comprovante' : 'Todos'}
                  </Button>
                  {podeAprovar && (
                    <Button variant={soMeus ? 'default' : 'ghost'} size="sm" onClick={() => setSoMeus(s => !s)}>
                      {soMeus ? 'Mostrando: meus' : 'Mostrando: todos'}
                    </Button>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
              ) : filtrados.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Receipt className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    Nenhum pedido nesta aba.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {filtrados.map((p) => (
                    <PedidoCard
                      key={p.id}
                      pedido={p}
                      podeAprovar={podeAprovar}
                      categorias={opcoes.categorias}
                      contas={opcoes.contas}
                      fornecedores={opcoes.fornecedores}
                      onOpen={setDetalheId}
                      onChange={carregar}
                      onSelecao={onSelecao}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <NovoPedidoDialog open={novoOpen} onOpenChange={setNovoOpen} onCriado={carregar} />
        {barId && (
          <PedidoDetailDialog
            pedidoId={detalheId}
            barId={barId}
            onClose={() => setDetalheId(null)}
            onChange={carregar}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
