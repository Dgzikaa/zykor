'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Plus, Loader2, AlertCircle, Receipt } from 'lucide-react';
import { type Pedido } from './types';
import { NovoPedidoDialog } from './components/NovoPedidoDialog';
import { PedidoDetailDialog } from './components/PedidoDetailDialog';
import { PedidoCard, type Opcao } from './components/PedidoCard';
import { FreelaTab } from './components/FreelaTab';
import { BoletoTab } from './components/BoletoTab';
import { CartaoTab } from './components/CartaoTab';
import TrocasTab from './components/TrocasTab';

type ModoPagamento = 'pagamentos' | 'freela' | 'boleto' | 'cartao' | 'trocas';

type TabKey = 'solicitado' | 'aprovado' | 'recusado' | 'todos';

// "Aprovado" agrupa aprovado/agendado/pago — o status detalhado (agendado vs pago)
// fica visível dentro do pedido. "Solicitado" inclui os que falharam na aprovação
// (erro_ca/erro_inter), pois ainda precisam de ação do financeiro.
const TAB_STATUS: Record<TabKey, (s: string) => boolean> = {
  solicitado: (s) => s === 'aguardando_aprovacao' || s === 'erro_ca' || s === 'erro_inter',
  aprovado: (s) => s === 'aprovado' || s === 'agendado' || s === 'pago',
  recusado: (s) => s === 'rejeitado' || s === 'cancelado',
  todos: () => true,
};

export default function PedidosPagamentoPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const barId = selectedBar?.id ?? null;

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [podeAprovar, setPodeAprovar] = useState(false);
  const [tab, setTab] = useState<TabKey>('solicitado');
  const [soMeus, setSoMeus] = useState(false);
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

  const carregar = useCallback(async () => {
    if (!barId) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/financeiro/pedidos-pagamento?escopo=${soMeus ? 'meus' : 'todos'}`);
      setPedidos(res.pedidos || []);
      setPodeAprovar(!!res.pode_aprovar);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar', message: e?.message });
    } finally {
      setLoading(false);
    }
  }, [barId, soMeus, showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  // Opções do CA (categorias / contas pagadoras / fornecedores) — só se pode aprovar.
  useEffect(() => {
    if (!barId || !podeAprovar) return;
    let vivo = true;
    const j = (p: Promise<Response>) => p.then(r => r.json()).catch(() => ({}));
    Promise.all([
      j(fetch(`/api/financeiro/contaazul/categorias?bar_id=${barId}`)),
      j(fetch(`/api/financeiro/contaazul/contas-financeiras?bar_id=${barId}`)),
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
  const filtrados = useMemo(() => pedidosLista.filter(p => TAB_STATUS[tab](p.status)), [pedidosLista, tab]);
  const countSolicitado = useMemo(() => pedidosLista.filter(p => TAB_STATUS.solicitado(p.status)).length, [pedidosLista]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="mx-auto px-3 py-5">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2"><Receipt className="w-5 h-5" /> Pedidos de Pagamento</h1>
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
              <TabsTrigger value="cartao">Cartão</TabsTrigger>
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
                {podeAprovar && (
                  <Button variant={soMeus ? 'default' : 'ghost'} size="sm" onClick={() => setSoMeus(s => !s)}>
                    {soMeus ? 'Mostrando: meus' : 'Mostrando: todos'}
                  </Button>
                )}
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
