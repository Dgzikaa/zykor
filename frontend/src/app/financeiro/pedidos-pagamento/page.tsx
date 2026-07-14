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
import { type TabKey, TAB_STATUS, isBoleto } from './statusTabs';
import { NovoPedidoDialog } from './components/NovoPedidoDialog';
import { PedidoDetailDialog } from './components/PedidoDetailDialog';
import { PedidoCard, type Opcao } from './components/PedidoCard';
import { BoletoTab } from './components/BoletoTab';
import TrocasTab from './components/TrocasTab';
import { FaturaCartaoTab } from './components/FaturaCartaoTab';
import { ConsolidadoTab } from './components/ConsolidadoTab';
import { FreelaPorDia } from '@/components/freelas/FreelaPorDia';

type ModoPagamento = 'pagamentos' | 'freela' | 'boleto' | 'fatura' | 'trocas';

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
  // #14 — seleção manual (checkbox) p/ aprovar SÓ os marcados em lote.
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const toggleSelecionado = useCallback((id: string) => setSelecionados(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  }), []);
  const [novoOpen, setNovoOpen] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [modo, setModo] = useState<ModoPagamento>('pagamentos');

  // Opções do CA (categorias/contas/fornecedores) → sugestão na criação do boleto + aprovação inline.
  const [opcoes, setOpcoes] = useState<{ categorias: Opcao[]; contas: Opcao[]; fornecedores: Opcao[]; contaPadrao: string }>({
    categorias: [], contas: [], fornecedores: [], contaPadrao: '',
  });

  useEffect(() => {
    setPageTitle('💸 Pedidos de Pagamento');
    return () => setPageTitle('');
  }, [setPageTitle]);

  // Deep-links (atalhos fixados nos grupos):
  //  ?aba=trocas|boleto|freela|cartao|fatura|pagamentos → já abre naquela aba.
  //  ?novo=1 → abre a aba Pagamentos com o popup "Novo pedido".
  // Limpa os params depois p/ não repetir ao recarregar/voltar.
  useEffect(() => {
    const aba = searchParams.get('aba');
    const novo = searchParams.get('novo') === '1';
    const abasValidas: ModoPagamento[] = ['pagamentos', 'freela', 'boleto', 'fatura', 'trocas'];
    if (aba && abasValidas.includes(aba as ModoPagamento)) setModo(aba as ModoPagamento);
    if (novo) { setModo('pagamentos'); setNovoOpen(true); }
    if (aba || novo) router.replace('/financeiro/pedidos-pagamento');
  }, [searchParams, router]);

  const carregar = useCallback(async (silent = false) => {
    if (!barId) return;
    if (!silent) setLoading(true);
    try {
      const escopo = soMeus ? 'meus' : 'todos';
      // Freela é buscado À PARTE (tipo=freela, limite alto): a lista geral ordena por created_at
      // e tem limite (100) — com muito boleto/PIX recente os freelas (mais antigos) caíam fora.
      const [res, resFreela] = await Promise.all([
        api.get(`/api/financeiro/pedidos-pagamento?escopo=${escopo}`),
        api.get(`/api/financeiro/pedidos-pagamento?tipo=freela&escopo=${escopo}&limit=500`),
      ]);
      const geral = res.pedidos || [];
      const idsGeral = new Set(geral.map((p: any) => p.id));
      const freelaExtra = (resFreela.pedidos || []).filter((p: any) => !idsGeral.has(p.id));
      setPedidos([...geral, ...freelaExtra]);
      setPodeAprovar(!!res.pode_aprovar);
    } catch (e: any) {
      if (!silent) showToast({ type: 'error', title: 'Erro ao carregar', message: e?.message });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [barId, soMeus, showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  // Freela (aba própria, layout por dia): aprovar/agendar 1 pessoa. Freela já traz categoria +
  // fornecedor do cadastro do beneficiário → aprovar/agendar com corpo vazio (a rota usa os do pedido).
  const [freelaBusy, setFreelaBusy] = useState<string | null>(null);
  const aprovarFreela = useCallback(async (id: string) => {
    setFreelaBusy(id);
    try { await api.post(`/api/financeiro/pedidos-pagamento/${id}/aprovar`, {}); await carregar(); }
    catch (e: any) { showToast({ type: 'error', title: 'Erro ao aprovar', message: e?.message }); }
    finally { setFreelaBusy(null); }
  }, [carregar, showToast]);
  const agendarFreela = useCallback(async (id: string) => {
    setFreelaBusy(id);
    try { await api.post(`/api/financeiro/pedidos-pagamento/${id}/agendar`, {}); await carregar(); }
    catch (e: any) { showToast({ type: 'error', title: 'Erro ao agendar', message: e?.message }); }
    finally { setFreelaBusy(null); }
  }, [carregar, showToast]);

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

  // Opções do CA (categorias / contas pagadoras / fornecedores). Carrega p/ QUALQUER usuário da
  // página: quem SOBE boleto também precisa da lista de categorias (sugestão + "Dividir em
  // categorias"/rateio), conta de pagamento e fornecedor. Os controles de APROVAÇÃO inline seguem
  // restritos a quem aprova (mostrarInline no PedidoCard). Bug: gate em podeAprovar deixava o
  // solicitante sem nenhuma categoria no rateio do boleto.
  useEffect(() => {
    if (!barId) return;
    let vivo = true;
    const j = (p: Promise<Response>) => p.then(r => r.json()).catch(() => ({}));
    Promise.all([
      // Só DESPESA: aqui tudo é pagamento, categoria de receita não faz sentido.
      j(fetch(`/api/financeiro/contaazul/categorias?bar_id=${barId}&tipo=DESPESA`)),
      j(fetch(`/api/financeiro/contaazul/contas-financeiras?bar_id=${barId}&somente_pagadoras=true`)),
      j(fetch(`/api/financeiro/contaazul/stakeholders?bar_id=${barId}&perfil=FORNECEDOR`)),
    ]).then(([cat, ct, fo]) => {
      if (!vivo) return;
      const contasAtivas = (ct.contas_financeiras || []).filter((c: any) => c.ativo !== false);
      const padrao = contasAtivas.find((c: any) => c.pagadora_padrao);
      setOpcoes({
        categorias: (cat.categorias || []).filter((c: any) => c.ativo !== false)
          .map((c: any) => ({ value: c.contaazul_id, label: c.nome || c.categoria_nome })),
        contas: contasAtivas
          .map((c: any) => ({ value: String(c.contaazul_id), label: c.banco ? `${c.nome} (${c.banco})` : c.nome })),
        fornecedores: (fo.pessoas || []).map((p: any) => ({ value: p.contaazul_id, label: p.nome, searchHint: p.documento || '' })),
        contaPadrao: padrao ? String(padrao.contaazul_id) : '',
      });
    });
    return () => { vivo = false; };
  }, [barId]);

  // PIX = tudo que NÃO é freela nem boleto (boleto vive na aba própria).
  const pedidosLista = useMemo(() => pedidos.filter(p => p.tipo !== 'freela' && !isBoleto(p)), [pedidos]);
  const boletosLista = useMemo(() => pedidos.filter(isBoleto), [pedidos]);
  // Freela passa pelo MESMO kanban de status do PIX. A MONTAGEM (rascunho) é da operação
  // (Operacional › Freelas — Semana); o financeiro só vê a partir de "aguardando_aprovacao"
  // (rascunho fica escondido) e faz aprovar → agendar por card, igual PIX.
  const freelasLista = useMemo(() => pedidos.filter(p => p.tipo === 'freela' && p.status !== 'rascunho'), [pedidos]);
  const listaAtiva = useMemo(() => (modo === 'freela' ? freelasLista : pedidosLista), [modo, freelasLista, pedidosLista]);
  const filtrados = useMemo(
    () => listaAtiva.filter(p => TAB_STATUS[tab](p.status) && (!soComprovante || p.precisa_comprovante)),
    [listaAtiva, tab, soComprovante]
  );
  const countSolicitado = useMemo(() => listaAtiva.filter(p => TAB_STATUS.solicitado(p.status)).length, [listaAtiva]);
  // Prontos pra AGENDAR (aprovados ainda não disparados + erros de agendamento p/ retry).
  const agendaveis = useMemo(
    () => listaAtiva.filter(p => ['aprovado', 'erro_ca', 'erro_inter'].includes(p.status) && !(p.status === 'aprovado' && p.contaazul_lancamento_id)),
    [listaAtiva]
  );

  const onSelecao = useCallback((id: string, sel: { catId: string; contaId: string; fornId: string }) => {
    setSelecoes(prev => ({ ...prev, [id]: sel }));
  }, []);

  // Núcleo do "aprovar em lote": recebe os pedidos-alvo, aprova só os que já estão prontos
  // (categoria + fornecedor), SEQUENCIAL — 1 de cada vez, sem rajada (evita rate limit CA/Inter).
  const aprovarLote = useCallback(async (alvos: Pedido[], rotulo: string) => {
    const prep = alvos.map(p => {
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
    if (!window.confirm(`Aprovar ${prontos.length} ${rotulo}?${faltando ? `\n${faltando} sem categoria/fornecedor ficam de fora.` : ''}`)) return;

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
    setSelecionados(new Set());
    showToast({
      type: err ? 'warning' : 'success',
      title: `${ok} aprovado(s)`,
      message: [err ? `${err} com erro` : '', faltando ? `${faltando} pulados (dados faltando)` : ''].filter(Boolean).join(' · ') || undefined,
    });
    carregar();
  }, [selecoes, opcoes.categorias, showToast, carregar]);

  const pendentesSolicitado = useMemo(() => listaAtiva.filter(p => TAB_STATUS.solicitado(p.status)), [listaAtiva]);
  const aprovarTodos = useCallback(() => aprovarLote(pendentesSolicitado, 'pedido(s) de uma vez'), [aprovarLote, pendentesSolicitado]);
  const aprovarSelecionados = useCallback(() => aprovarLote(pendentesSolicitado.filter(p => selecionados.has(p.id)), 'selecionado(s)'), [aprovarLote, pendentesSolicitado, selecionados]);

  // Limpa a seleção ao trocar de aba/modo/bar (evita aprovar item que não está mais à vista).
  useEffect(() => { setSelecionados(new Set()); }, [tab, modo, barId]);

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
                  ? 'Revise e aprove; depois agende. O agendamento é que cria a conta no Conta Azul e paga via Inter.'
                  : 'Abra um pedido de pagamento. O financeiro analisa e aprova.'}
              </p>
            </div>
            {modo === 'pagamentos' && <Button onClick={() => setNovoOpen(true)}><Plus className="w-4 h-4 mr-2" />Novo pedido</Button>}
          </div>

          {/* Abas por tipo de pagamento */}
          <Tabs value={modo} onValueChange={(v) => setModo(v as ModoPagamento)} className="mb-4">
            <TabsList>
              <TabsTrigger value="pagamentos">PIX</TabsTrigger>
              <TabsTrigger value="freela">Freela</TabsTrigger>
              <TabsTrigger value="boleto">Boleto</TabsTrigger>
              {podeAprovar && <TabsTrigger value="fatura">Cartão de Crédito</TabsTrigger>}
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

          {barId && modo === 'freela' && (
            <p className="text-xs text-muted-foreground mb-3">
              Os freelas são montados pela operação em <b>Operacional › Freelas (Semana)</b>. Aqui o financeiro aprova e agenda, igual ao PIX.
            </p>
          )}

          {barId && modo === 'boleto' && (
            <BoletoTab
              onCriado={carregar}
              pedidos={boletosLista}
              podeAprovar={podeAprovar}
              categorias={opcoes.categorias}
              contas={opcoes.contas}
              contaPadrao={opcoes.contaPadrao}
              fornecedores={opcoes.fornecedores}
              onOpenDetalhe={setDetalheId}
              onSelecao={onSelecao}
            />
          )}

          {barId && podeAprovar && modo === 'fatura' && <FaturaCartaoTab />}

          {barId && modo === 'trocas' && <TrocasTab barId={barId} onLancado={carregar} />}

          {barId && (modo === 'pagamentos' || modo === 'freela') && (
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
                    <TabsTrigger value="consolidado">Consolidado</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="flex items-center gap-2 flex-wrap">
                  {podeAprovar && tab === 'solicitado' && selecionados.size > 0 && (
                    <Button size="sm" onClick={aprovarSelecionados} disabled={aprovandoTodos}>
                      {aprovandoTodos ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}
                      Aprovar selecionados ({selecionados.size})
                    </Button>
                  )}
                  {podeAprovar && tab === 'solicitado' && countSolicitado > 0 && (
                    <Button variant={selecionados.size > 0 ? 'outline' : 'default'} size="sm" onClick={aprovarTodos} disabled={aprovandoTodos}>
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
                  {tab !== 'consolidado' && (
                    <Button variant={soComprovante ? 'default' : 'ghost'} size="sm" onClick={() => setSoComprovante(s => !s)}>
                      <Paperclip className="w-3.5 h-3.5 mr-1.5" />
                      {soComprovante ? 'Só c/ comprovante' : 'Todos'}
                    </Button>
                  )}
                  {podeAprovar && tab !== 'consolidado' && (
                    <Button variant={soMeus ? 'default' : 'ghost'} size="sm" onClick={() => setSoMeus(s => !s)}>
                      {soMeus ? 'Mostrando: meus' : 'Mostrando: todos'}
                    </Button>
                  )}
                </div>
              </div>

              {tab === 'consolidado' ? (
                <ConsolidadoTab pedidos={listaAtiva} onOpenDetalhe={setDetalheId} />
              ) : loading ? (
                <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
              ) : filtrados.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Receipt className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    Nenhum pedido nesta aba.
                  </CardContent>
                </Card>
              ) : modo === 'freela' ? (
                // Freela no financeiro: agrupado por PESSOA (cada pessoa → seus dias), com aprovar/agendar.
                <FreelaPorDia itens={filtrados} agruparPor="pessoa" acao={(it) => {
                  if (!podeAprovar) return null;
                  if (it.status === 'aguardando_aprovacao') return (
                    <Button size="sm" className="h-7 px-2 text-xs" disabled={freelaBusy === it.id} onClick={() => aprovarFreela(it.id)}>
                      {freelaBusy === it.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Aprovar'}
                    </Button>
                  );
                  if (['aprovado', 'erro_ca', 'erro_inter'].includes(it.status)) return (
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={freelaBusy === it.id} onClick={() => agendarFreela(it.id)}>
                      {freelaBusy === it.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Agendar'}
                    </Button>
                  );
                  return null;
                }} />
              ) : (
                <div className="space-y-2">
                  {filtrados.map((p) => (
                    <PedidoCard
                      key={p.id}
                      pedido={p}
                      podeAprovar={podeAprovar}
                      categorias={opcoes.categorias}
                      contas={opcoes.contas}
                      contaPadrao={opcoes.contaPadrao}
                      fornecedores={opcoes.fornecedores}
                      onOpen={setDetalheId}
                      onChange={carregar}
                      onSelecao={onSelecao}
                      selecionavel={tab === 'solicitado'}
                      selecionado={selecionados.has(p.id)}
                      onToggleSelecionado={toggleSelecionado}
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
