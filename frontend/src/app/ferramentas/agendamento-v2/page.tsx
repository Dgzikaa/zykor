'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SelectWithSearch } from '@/components/ui/select-with-search';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Calendar,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Banknote,
  Building2,
  Wallet,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';

import type { PagamentoAgendamento, Stakeholder, InterCredencial } from '../agendamento/types';
import { AgendamentoCredenciais } from '../agendamento/components/AgendamentoCredenciais';
import { AgendamentoStatusCA } from '../agendamento/components/AgendamentoStatusCA';
import { PagamentosList } from '../agendamento/components/PagamentosList';
import { NovoPagamentoForm } from '../agendamento/components/NovoPagamentoForm';
import { ImportarFolhaForm } from '../agendamento/components/ImportarFolhaForm';
import { StakeholderModal } from '../agendamento/components/StakeholderModal';

const STORAGE_KEYS = {
  PAGAMENTOS: 'sgb_financeiro_pagamentos',
};

const parseValorBRL = (valor: string): number => {
  const limpo = String(valor || '').replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(limpo);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function AgendamentoV2Page() {
  const { setPageTitle } = usePageTitle();
  const { showToast } = useToast();
  const { selectedBar } = useBar();

  const barId = selectedBar?.id ?? null;
  const barNome = selectedBar?.nome;

  const toast = useCallback(
    (options: { title: string; description?: string; variant?: 'destructive' }) => {
      showToast({
        type: options.variant === 'destructive' ? 'error' : 'success',
        title: options.title,
        message: options.description,
      });
    },
    [showToast]
  );

  const [credenciaisDisponiveis, setCredenciaisDisponiveis] = useState<{ inter: boolean; verificado: boolean }>({ inter: false, verificado: false });
  const [pagamentos, setPagamentos] = useState<PagamentoAgendamento[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pagandoPixId, setPagandoPixId] = useState<string | null>(null);
  const [modalStakeholder, setModalStakeholder] = useState(false);
  const [stakeholderEmCadastro] = useState({ document: '', name: '' });
  const [tabAtivo, setTabAtivo] = useState('manual');

  const [categorias, setCategorias] = useState<any[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<any[]>([]);
  const [contasFinanceiras, setContasFinanceiras] = useState<any[]>([]);
  const [contaFinanceiraSelecionadaId, setContaFinanceiraSelecionadaId] = useState<string>('');
  const [interCredenciais, setInterCredenciais] = useState<InterCredencial[]>([]);
  const [interCredencialSelecionadaId, setInterCredencialSelecionadaId] = useState<string>('');
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [setupConcluido, setSetupConcluido] = useState(false);

  useEffect(() => {
    setPageTitle('📅 Agendamento');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const loadOptions = useCallback(async () => {
    if (!barId) return;
    setIsLoadingOptions(true);
    try {
      const [catR, ccR, interR, contasR] = await Promise.all([
        fetch(`/api/financeiro/contaazul/categorias?bar_id=${barId}`).then(r => r.json()),
        fetch(`/api/financeiro/contaazul/centros-custo?bar_id=${barId}`).then(r => r.json()),
        fetch(`/api/financeiro/inter/credenciais?bar_id=${barId}`).then(r => r.json()),
        fetch(`/api/financeiro/contaazul/contas-financeiras?bar_id=${barId}`).then(r => r.json()),
      ]);
      setCategorias(catR.categorias || []);
      setCentrosCusto(ccR.centros_custo || ccR.centrosCusto || []);
      if (interR.success && Array.isArray(interR.credenciais)) {
        setInterCredenciais(interR.credenciais);
        const savedInter = localStorage.getItem(`sgb_agendamento_inter_bar_${barId}`);
        if (savedInter && interR.credenciais.some((c: any) => String(c.id) === savedInter)) {
          setInterCredencialSelecionadaId(savedInter);
        } else if (interR.credenciais.length === 1) {
          setInterCredencialSelecionadaId(String(interR.credenciais[0].id));
        }
      }
      const contasArr = contasR.contas_financeiras || [];
      if (Array.isArray(contasArr)) {
        setContasFinanceiras(contasArr);
        const savedConta = localStorage.getItem(`sgb_agendamento_conta_fin_bar_${barId}`);
        if (savedConta && contasArr.some((c: any) => c.contaazul_id === savedConta)) {
          setContaFinanceiraSelecionadaId(savedConta);
        }
      }
    } catch (e) {
      console.error('Erro carregar opcoes:', e);
      toast({ title: 'Erro ao carregar opções', variant: 'destructive' });
    } finally {
      setIsLoadingOptions(false);
    }
  }, [barId, toast]);

  useEffect(() => {
    loadOptions();
    const saved = localStorage.getItem(STORAGE_KEYS.PAGAMENTOS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.pagamentos) setPagamentos(parsed.pagamentos);
      } catch {}
    }
  }, [loadOptions]);

  useEffect(() => {
    if (pagamentos.length > 0) {
      localStorage.setItem(STORAGE_KEYS.PAGAMENTOS, JSON.stringify({ pagamentos, timestamp: new Date().toISOString() }));
    }
  }, [pagamentos]);

  useEffect(() => {
    if (interCredencialSelecionadaId && contaFinanceiraSelecionadaId) {
      setSetupConcluido(true);
    }
  }, [interCredencialSelecionadaId, contaFinanceiraSelecionadaId]);

  useEffect(() => {
    if (barId) {
      if (interCredencialSelecionadaId) {
        localStorage.setItem(`sgb_agendamento_inter_bar_${barId}`, interCredencialSelecionadaId);
      }
      if (contaFinanceiraSelecionadaId) {
        localStorage.setItem(`sgb_agendamento_conta_fin_bar_${barId}`, contaFinanceiraSelecionadaId);
      }
    }
  }, [barId, interCredencialSelecionadaId, contaFinanceiraSelecionadaId]);

  const interSelecionada = interCredenciais.find(c => String(c.id) === interCredencialSelecionadaId);
  const contaSelecionada = contasFinanceiras.find(c => String(c.contaazul_id) === contaFinanceiraSelecionadaId);

  const metricas = useMemo(() => {
    const t = pagamentos.length;
    return {
      total: t,
      pendentes: pagamentos.filter(p => p.status === 'pendente').length,
      agendados: pagamentos.filter(p => p.status === 'agendado').length,
      aguardandoAprovacao: pagamentos.filter(p => p.status === 'aguardando_aprovacao').length,
      aprovados: pagamentos.filter(p => p.status === 'aprovado').length,
      erros: pagamentos.filter(p => p.status?.startsWith('erro')).length,
    };
  }, [pagamentos]);

  const processarPagamentoCompleto = async (pagamento: PagamentoAgendamento): Promise<{ ok: boolean; etapa: 'ca' | 'inter'; mensagem?: string }> => {
    const valorNum = parseValorBRL(pagamento.valor);
    if (!Number.isFinite(valorNum) || valorNum <= 0) return { ok: false, etapa: 'ca', mensagem: 'Valor inválido' };

    let contaazulLancamentoId = pagamento.contaazul_lancamento_id;
    if (!contaazulLancamentoId) {
      try {
        const r = await fetch('/api/financeiro/contaazul/lancamentos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bar_id: pagamento.bar_id || barId,
            data_competencia: pagamento.data_competencia || pagamento.data_pagamento,
            data_vencimento: pagamento.data_pagamento,
            valor: valorNum,
            descricao: pagamento.descricao || `Pagamento ${pagamento.nome_beneficiario}`,
            categoria_id: pagamento.categoria_id,
            centro_custo_id: pagamento.centro_custo_id || undefined,
            conta_financeira_id: contaFinanceiraSelecionadaId || undefined,
            pessoa_id: pagamento.contaazul_pessoa_id || undefined,
            cpf_cnpj: pagamento.cpf_cnpj || undefined,
            nome_beneficiario: pagamento.nome_beneficiario,
          }),
        });
        const d = await r.json();
        if (!r.ok || !d.success) {
          const msg = d?.error || `CA HTTP ${r.status}`;
          setPagamentos(prev => prev.map(p => p.id === pagamento.id ? { ...p, status: 'erro_ca' as const, erro_mensagem: msg } : p));
          return { ok: false, etapa: 'ca', mensagem: msg };
        }
        contaazulLancamentoId = d.contaazul_id;
        setPagamentos(prev => prev.map(p => p.id === pagamento.id ? { ...p, contaazul_lancamento_id: contaazulLancamentoId } : p));
      } catch (e: any) {
        const msg = e?.message || 'Falha rede CA';
        setPagamentos(prev => prev.map(p => p.id === pagamento.id ? { ...p, status: 'erro_ca' as const, erro_mensagem: msg } : p));
        return { ok: false, etapa: 'ca', mensagem: msg };
      }
    }

    try {
      const r = await fetch('/api/financeiro/inter/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valor: valorNum,
          destinatario: pagamento.nome_beneficiario,
          chave: pagamento.chave_pix,
          data_pagamento: pagamento.data_pagamento,
          descricao: pagamento.descricao || `Pagamento para ${pagamento.nome_beneficiario}`,
          bar_id: pagamento.bar_id || barId,
          inter_credencial_id: Number(interCredencialSelecionadaId),
          agendamento_id: pagamento.id,
        }),
      });
      const d = await r.json();
      if (!d.success) {
        const msg = d?.error || `Inter HTTP ${r.status}`;
        setPagamentos(prev => prev.map(p => p.id === pagamento.id ? { ...p, status: 'erro_inter' as const, erro_mensagem: msg } : p));
        return { ok: false, etapa: 'inter', mensagem: msg };
      }
      setPagamentos(prev => prev.map(p => p.id === pagamento.id ? {
        ...p,
        status: 'aguardando_aprovacao' as const,
        inter_aprovacao_id: d.data?.codigoSolicitacao || '',
        codigo_solic: d.data?.codigoSolicitacao || '',
        erro_mensagem: undefined,
      } : p));
      return { ok: true, etapa: 'inter' };
    } catch (e: any) {
      const msg = e?.message || 'Falha rede Inter';
      setPagamentos(prev => prev.map(p => p.id === pagamento.id ? { ...p, status: 'erro_inter' as const, erro_mensagem: msg } : p));
      return { ok: false, etapa: 'inter', mensagem: msg };
    }
  };

  const processarTodos = async () => {
    if (!barId || !credenciaisDisponiveis.inter || !interCredencialSelecionadaId || !contaFinanceiraSelecionadaId) {
      toast({ title: '❌ Configuração incompleta', description: 'Selecione Inter + conta CA', variant: 'destructive' });
      return;
    }
    const pendentes = pagamentos.filter(p => p.status === 'pendente' || p.status === 'erro_ca' || p.status === 'erro_inter');
    if (pendentes.length === 0) {
      toast({ title: 'Nenhum pendente', variant: 'destructive' });
      return;
    }
    setIsProcessing(true);
    setPagandoPixId('direct');
    let ok = 0, errCA = 0, errInter = 0;
    for (const p of pendentes) {
      const r = await processarPagamentoCompleto(p);
      if (r.ok) ok++;
      else if (r.etapa === 'ca') errCA++;
      else errInter++;
      await new Promise(r => setTimeout(r, 200));
    }
    setPagandoPixId(null);
    setIsProcessing(false);
    if (ok > 0 && errCA === 0 && errInter === 0) {
      toast({ title: '✅ Pagamentos processados', description: `${ok} enviados ao Inter` });
    } else {
      toast({
        title: errCA + errInter > 0 ? '⚠️ Processado com erros' : '✅ OK',
        description: `${ok} ok · ${errCA} erro CA · ${errInter} erro Inter`,
        variant: errCA + errInter > 0 ? 'destructive' : undefined,
      });
    }
  };

  const handleEnviarPix = async (id: string) => {
    const p = pagamentos.find(x => x.id === id);
    if (!p) return;
    setPagandoPixId(id);
    try {
      const r = await processarPagamentoCompleto(p);
      if (r.ok) toast({ title: '✅ Pagamento processado', description: `${p.nome_beneficiario}` });
      else toast({ title: r.etapa === 'ca' ? '❌ Erro Conta Azul' : '❌ Erro Inter', description: r.mensagem, variant: 'destructive' });
    } finally {
      setPagandoPixId(null);
    }
  };

  const handleEditar = (id: string) => {
    const p = pagamentos.find(x => x.id === id);
    if (!p) return;
    const novaData = window.prompt(`Nova data de pagamento (AAAA-MM-DD) para ${p.nome_beneficiario}:`, p.data_pagamento);
    if (!novaData || !/^\d{4}-\d{2}-\d{2}$/.test(novaData)) {
      if (novaData !== null) toast({ title: '❌ Data inválida', variant: 'destructive' });
      return;
    }
    setPagamentos(prev => prev.map(x => x.id === id ? { ...x, data_pagamento: novaData, status: 'pendente', erro_mensagem: undefined } : x));
  };

  const handleExcluir = (id: string) => setPagamentos(prev => prev.filter(p => p.id !== id));
  const handleExcluirMultiplos = (ids: string[]) => {
    const s = new Set(ids);
    setPagamentos(prev => prev.filter(p => !s.has(p.id)));
  };
  const handlePagamentoAdicionado = (n: PagamentoAgendamento) => setPagamentos(prev => [...prev, n]);
  const handleFolhaImportada = (arr: PagamentoAgendamento[]) => setPagamentos(prev => [...prev, ...arr]);
  const handleStakeholderCriado = (s: Stakeholder) => toast({ title: '✅ Stakeholder criado', description: s.name });

  // === ESTADO 1: Verificando credenciais ===
  if (!credenciaisDisponiveis.verificado) {
    return (
      <ProtectedRoute requiredModule="financeiro">
        <div className="min-h-screen bg-background">
          <div className="container mx-auto px-2 py-4 max-w-6xl">
            <AgendamentoCredenciais barId={barId} barNome={barNome} onCredenciaisVerificadas={r => setCredenciaisDisponiveis({ ...r, verificado: true })} />
            <Card className="mt-6">
              <CardContent className="py-16 text-center">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
                <p className="text-muted-foreground mt-4">Verificando credenciais...</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  // === ESTADO 2: Sem bar selecionado ===
  if (!barId) {
    return (
      <ProtectedRoute requiredModule="financeiro">
        <div className="min-h-screen bg-background">
          <div className="container mx-auto px-2 py-4 max-w-6xl">
            <AgendamentoCredenciais barId={barId} barNome={barNome} onCredenciaisVerificadas={r => setCredenciaisDisponiveis({ ...r, verificado: true })} />
            <Card className="mt-6 border-red-500/40">
              <CardContent className="py-12 text-center">
                <AlertCircle className="w-12 h-12 text-red-600 mx-auto" />
                <p className="text-lg font-bold mt-4">Nenhum bar selecionado</p>
                <p className="text-sm text-muted-foreground mt-1">Selecione um bar no menu superior.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  // === ESTADO 3: Setup centralizado (PASSO 1) ===
  if (!setupConcluido) {
    return (
      <ProtectedRoute requiredModule="financeiro">
        <div className="min-h-screen bg-background">
          <div className="container mx-auto px-2 py-4 max-w-6xl">
            <AgendamentoCredenciais barId={barId} barNome={barNome} onCredenciaisVerificadas={r => setCredenciaisDisponiveis({ ...r, verificado: true })} />
            <div className="flex items-center justify-center min-h-[60vh]">
              <Card className="w-full max-w-xl shadow-lg">
                <CardHeader>
                  <CardTitle className="text-center text-2xl">Configurar pagamento</CardTitle>
                  <CardDescription className="text-center">
                    <strong>{barNome}</strong> — selecione de qual conta o pagamento vai sair.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 px-8 pb-8">
                  {isLoadingOptions ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Loader2 className="w-6 h-6 mx-auto animate-spin" />
                      Carregando opções...
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <Building2 className="w-4 h-4" /> 1. Credencial Inter (de onde sai o PIX)
                        </label>
                        <SelectWithSearch
                          value={interCredencialSelecionadaId}
                          onValueChange={v => setInterCredencialSelecionadaId(v || '')}
                          placeholder={interCredenciais.length === 0 ? 'Nenhuma credencial Inter cadastrada' : 'Selecione a credencial Inter'}
                          options={interCredenciais.map(c => ({ value: String(c.id), label: c.cnpj ? `${c.nome} (${c.cnpj})` : c.nome }))}
                        />
                        {interCredenciais.length === 0 && (
                          <p className="text-xs text-amber-600">
                            ⚠ Cadastre uma credencial Inter em Configurações → Credenciais antes de continuar.
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <Wallet className="w-4 h-4" /> 2. Conta Financeira no Conta Azul (registro do lançamento)
                        </label>
                        <SearchableSelect
                          value={contaFinanceiraSelecionadaId}
                          onValueChange={v => setContaFinanceiraSelecionadaId(v || '')}
                          placeholder="Selecione a conta no Conta Azul"
                          searchPlaceholder="Filtrar contas..."
                          emptyMessage="Nenhuma conta encontrada"
                          options={contasFinanceiras
                            .filter(c => c.ativo !== false && (!c.tipo || c.tipo === 'CONTA_CORRENTE') && String(c.banco || '').toUpperCase() !== 'STONE')
                            .map(c => ({
                              value: String(c.contaazul_id),
                              label: c.banco ? `${c.nome} (${c.banco})` : String(c.nome),
                              searchHint: `${c.tipo || ''} ${c.banco || ''}`,
                            }))}
                        />
                        <p className="text-xs text-muted-foreground">
                          Onde o lançamento aparece no Conta Azul. Salvo por bar.
                        </p>
                      </div>

                      <Button
                        size="lg"
                        className="w-full"
                        disabled={!interCredencialSelecionadaId || !contaFinanceiraSelecionadaId}
                        onClick={() => setSetupConcluido(true)}
                      >
                        Começar
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  // === ESTADO 4: Operação ===
  return (
    <ProtectedRoute requiredModule="financeiro">
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-2 py-4 max-w-[1400px]">
          <AgendamentoCredenciais barId={barId} barNome={barNome} onCredenciaisVerificadas={r => setCredenciaisDisponiveis({ ...r, verificado: true })} />
          <AgendamentoStatusCA barId={barId} onSyncComplete={loadOptions} />

          {/* Header compacto com setup atual */}
          <Card className="mb-4">
            <CardContent className="py-3 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex items-center gap-3 flex-1">
                <Badge variant="outline" className="gap-1">
                  <Building2 className="w-3 h-3" />
                  {interSelecionada ? (interSelecionada.cnpj ? `${interSelecionada.nome} (${interSelecionada.cnpj})` : interSelecionada.nome) : '—'}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Wallet className="w-3 h-3" />
                  {contaSelecionada ? (contaSelecionada.banco ? `${contaSelecionada.nome} (${contaSelecionada.banco})` : contaSelecionada.nome) : '—'}
                </Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSetupConcluido(false)} className="gap-1">
                <Pencil className="w-3 h-3" /> Trocar conta
              </Button>
            </CardContent>
          </Card>

          <div className="flex flex-col lg:flex-row gap-4">
            {/* Sidebar compacta */}
            <div className="w-full lg:w-64 flex-shrink-0">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Resumo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <MetricRow icon={<FileText className="w-4 h-4" />} label="Total" value={metricas.total} />
                  <MetricRow icon={<Clock className="w-4 h-4" />} label="Pendentes" value={metricas.pendentes} accent={metricas.pendentes > 0 ? 'amber' : undefined} />
                  <MetricRow icon={<Calendar className="w-4 h-4" />} label="Agendados" value={metricas.agendados} />
                  <MetricRow icon={<Clock className="w-4 h-4" />} label="Aguardando aprov." value={metricas.aguardandoAprovacao} />
                  <MetricRow icon={<CheckCircle className="w-4 h-4" />} label="Aprovados" value={metricas.aprovados} accent={metricas.aprovados > 0 ? 'green' : undefined} />
                  <MetricRow icon={<AlertCircle className="w-4 h-4" />} label="Erros" value={metricas.erros} accent={metricas.erros > 0 ? 'red' : undefined} />
                  <div className="pt-2 border-t">
                    <Button
                      onClick={processarTodos}
                      disabled={isProcessing || pagandoPixId !== null || metricas.pendentes + metricas.erros === 0}
                      className="w-full"
                    >
                      {pagandoPixId === 'direct' ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando...</>
                      ) : (
                        <><Banknote className="w-4 h-4 mr-2" /> Pagar todos ({metricas.pendentes + metricas.erros})</>
                      )}
                    </Button>
                    <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
                      Cria conta a pagar no Conta Azul → envia PIX no Inter. Sócio aprova no app Inter.
                    </p>
                  </div>
                  {pagamentos.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setPagamentos([]); toast({ title: 'Lista limpa' }); }}
                      className="w-full gap-1 text-muted-foreground"
                    >
                      <Trash2 className="w-3 h-3" /> Limpar lista
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Conteúdo principal */}
            <div className="flex-1">
              <Tabs value={tabAtivo} onValueChange={setTabAtivo}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="manual">Adicionar Manual</TabsTrigger>
                  <TabsTrigger value="folha">Importar Folha</TabsTrigger>
                  <TabsTrigger value="lista">
                    Lista
                    {pagamentos.length > 0 && <Badge variant="secondary" className="ml-2">{pagamentos.length}</Badge>}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="manual" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Adicionar Pagamento Manual</CardTitle>
                      <CardDescription>Preencha os dados do pagamento. Vai pra lista — depois clique "Pagar todos" pra enviar.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <NovoPagamentoForm
                        categorias={categorias}
                        centrosCusto={centrosCusto}
                        barId={barId}
                        onPagamentoAdicionado={handlePagamentoAdicionado}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="folha" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Importar Folha (Ctrl+C / Ctrl+V)</CardTitle>
                      <CardDescription>
                        Cole a folha do Excel/Sheets. Cabeçalhos aceitos: <code>nome_beneficiario</code>, <code>chave_pix</code>, <code>valor</code>/<code>total</code>, <code>cargo</code>.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ImportarFolhaForm
                        barId={barId ?? undefined}
                        barNome={barNome}
                        categorias={categorias}
                        centrosCusto={centrosCusto}
                        onImportado={handleFolhaImportada}
                        onAfterImport={() => setTabAtivo('lista')}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="lista" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Lista de Pagamentos</CardTitle>
                      <CardDescription>{pagamentos.length} pagamento(s) na lista</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <PagamentosList
                        pagamentos={pagamentos}
                        onEditar={handleEditar}
                        onExcluir={handleExcluir}
                        onExcluirMultiplos={handleExcluirMultiplos}
                        onEnviarPix={handleEnviarPix}
                        isProcessing={isProcessing}
                        pagandoPixId={pagandoPixId}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        <StakeholderModal
          isOpen={modalStakeholder}
          onClose={() => setModalStakeholder(false)}
          barId={barId ?? 0}
          initialDocument={stakeholderEmCadastro.document}
          initialName={stakeholderEmCadastro.name}
          onStakeholderCriado={handleStakeholderCriado}
        />
      </div>
    </ProtectedRoute>
  );
}

function MetricRow({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: 'green' | 'amber' | 'red' }) {
  const colorMap = { green: 'text-green-600', amber: 'text-amber-600', red: 'text-red-600' };
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/30">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        {icon} {label}
      </div>
      <span className={`font-semibold ${accent ? colorMap[accent] : ''}`}>{value}</span>
    </div>
  );
}
