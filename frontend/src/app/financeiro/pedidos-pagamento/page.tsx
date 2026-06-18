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
import {
  TIPO_LABEL, STATUS_LABEL, STATUS_COLOR, formatBRL, type Pedido,
} from './types';
import { NovoPedidoDialog } from './components/NovoPedidoDialog';
import { PedidoDetailDialog } from './components/PedidoDetailDialog';
import { FreelaTab } from './components/FreelaTab';
import { BoletoTab } from './components/BoletoTab';

type ModoPagamento = 'pagamentos' | 'freela' | 'boleto' | 'cartao';

type TabKey = 'aguardando' | 'andamento' | 'concluidos' | 'recusados' | 'todos';

const TAB_STATUS: Record<TabKey, (s: string) => boolean> = {
  aguardando: (s) => s === 'aguardando_aprovacao' || s === 'erro_ca' || s === 'erro_inter',
  andamento: (s) => s === 'aprovado' || s === 'agendado',
  concluidos: (s) => s === 'pago',
  recusados: (s) => s === 'rejeitado' || s === 'cancelado',
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
  const [tab, setTab] = useState<TabKey>('aguardando');
  const [soMeus, setSoMeus] = useState(false);
  const [novoOpen, setNovoOpen] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [modo, setModo] = useState<ModoPagamento>('pagamentos');

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

  const filtrados = useMemo(() => pedidos.filter(p => TAB_STATUS[tab](p.status)), [pedidos, tab]);
  const countAguardando = useMemo(() => pedidos.filter(p => TAB_STATUS.aguardando(p.status)).length, [pedidos]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-3 py-5 max-w-5xl">
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

          {barId && modo === 'freela' && <FreelaTab barId={barId} onLancado={carregar} />}

          {barId && modo === 'boleto' && <BoletoTab onCriado={carregar} />}

          {barId && modo === 'cartao' && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              Cartão de crédito (fatura) — em breve.
            </CardContent></Card>
          )}

          {barId && modo === 'pagamentos' && (
            <>
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
                  <TabsList>
                    <TabsTrigger value="aguardando">
                      Aguardando {countAguardando > 0 && <Badge variant="secondary" className="ml-1.5">{countAguardando}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="andamento">Em andamento</TabsTrigger>
                    <TabsTrigger value="concluidos">Pagos</TabsTrigger>
                    <TabsTrigger value="recusados">Recusados</TabsTrigger>
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
                    <button
                      key={p.id}
                      onClick={() => setDetalheId(p.id)}
                      className="w-full text-left rounded-lg border border-[hsl(var(--border))] bg-card hover:bg-muted/40 transition p-3 flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{p.descricao}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">{TIPO_LABEL[p.tipo]}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {p.solicitante_nome || '—'} · vence {p.data_vencimento}
                          {p.beneficiario_nome ? ` · ${p.beneficiario_nome}` : ''}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-semibold">{formatBRL(p.valor)}</div>
                        <Badge className={`${STATUS_COLOR[p.status]} text-[10px] mt-0.5`}>{STATUS_LABEL[p.status]}</Badge>
                      </div>
                    </button>
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
