'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { useUser } from '@/contexts/UserContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SelectWithSearch } from '@/components/ui/select-with-search';
import {
  Calendar,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Play,
  Trash2,
  RefreshCw,
  Loader2,
  Banknote,
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';

import type {
  PagamentoAgendamento,
  Stakeholder,
  InterCredencial,
} from './types';

import { AgendamentoCredenciais } from './components/AgendamentoCredenciais';
import { PagamentosList } from './components/PagamentosList';
import { NovoPagamentoForm } from './components/NovoPagamentoForm';
import { ImportarFolhaModal } from './components/ImportarFolhaModal';
import { StakeholderModal } from './components/StakeholderModal';

const STORAGE_KEYS = {
  PAGAMENTOS: 'sgb_financeiro_pagamentos',
  BACKUP: 'sgb_financeiro_backup',
  LAST_SAVE: 'sgb_financeiro_last_save',
};

export default function AgendamentoPage() {
  const { setPageTitle } = usePageTitle();
  const { showToast } = useToast();
  const { selectedBar } = useBar();
  const { user } = useUser();

  const barId = selectedBar?.id ?? null;
  const barNome = selectedBar?.nome;

  const [credenciaisDisponiveis, setCredenciaisDisponiveis] = useState<{
    nibo: boolean;
    inter: boolean;
    verificado: boolean;
  }>({ nibo: false, inter: false, verificado: false });

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

  const [pagamentos, setPagamentos] = useState<PagamentoAgendamento[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSave, setLastSave] = useState<string>('');
  const [pagandoPixId, setPagandoPixId] = useState<string | null>(null);

  const [modalFolha, setModalFolha] = useState(false);
  const [modalStakeholder, setModalStakeholder] = useState(false);
  const [stakeholderEmCadastro, setStakeholderEmCadastro] = useState({
    document: '',
    name: '',
  });

  const [tabAtivo, setTabAtivo] = useState('manual');

  const [categorias, setCategorias] = useState<any[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<any[]>([]);
  const [interCredenciais, setInterCredenciais] = useState<InterCredencial[]>([]);
  const [interCredencialSelecionadaId, setInterCredencialSelecionadaId] = useState<string>('');
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);

  useEffect(() => {
    setPageTitle('📅 Agendamento');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const loadCategoriasECentrosCusto = useCallback(async () => {
    if (!barId) return;

    setIsLoadingOptions(true);
    try {
      const categoriasResponse = await fetch(
        `/api/financeiro/nibo/categorias?bar_id=${barId}&somente_pagamento=true`
      );
      const categoriasData = await categoriasResponse.json();
      if (categoriasData.categorias) {
        setCategorias(categoriasData.categorias);
      }

      const centrosCustoResponse = await fetch(
        `/api/financeiro/nibo/centros-custo?bar_id=${barId}`
      );
      const centrosCustoData = await centrosCustoResponse.json();
      if (centrosCustoData.centrosCusto) {
        setCentrosCusto(centrosCustoData.centrosCusto);
      }

      const interCredsResponse = await fetch(`/api/financeiro/inter/credenciais?bar_id=${barId}`);
      const interCredsData = await interCredsResponse.json();
      if (interCredsData.success && Array.isArray(interCredsData.credenciais)) {
        setInterCredenciais(interCredsData.credenciais);
        if (!interCredencialSelecionadaId && interCredsData.credenciais.length > 0) {
          setInterCredencialSelecionadaId(String(interCredsData.credenciais[0].id));
        }
      } else {
        setInterCredenciais([]);
      }
    } catch (error) {
      console.error('Erro ao carregar opções:', error);
      toast({
        title: 'Erro ao carregar opções',
        description: 'Não foi possível carregar categorias e centros de custo',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingOptions(false);
    }
  }, [toast, barId, interCredencialSelecionadaId]);

  const saveToLocalStorage = useCallback(() => {
    try {
      const dataToSave = {
        pagamentos,
        timestamp: new Date().toISOString(),
        version: '1.0',
      };
      localStorage.setItem(STORAGE_KEYS.PAGAMENTOS, JSON.stringify(dataToSave));
      localStorage.setItem(STORAGE_KEYS.LAST_SAVE, new Date().toISOString());
      setLastSave(new Date().toLocaleString('pt-BR'));
    } catch (error) {
      console.error('Erro ao salvar no localStorage:', error);
    }
  }, [pagamentos]);

  useEffect(() => {
    if (pagamentos.length > 0) {
      saveToLocalStorage();
    }
  }, [pagamentos, saveToLocalStorage]);

  const loadSavedData = useCallback(() => {
    try {
      const isFirstLoad = !sessionStorage.getItem('sgb_data_loaded');
      let savedData = localStorage.getItem(STORAGE_KEYS.PAGAMENTOS);
      let parsed: any = null;

      if (savedData) {
        parsed = JSON.parse(savedData);
      }

      if (parsed && parsed.pagamentos && Array.isArray(parsed.pagamentos)) {
        setPagamentos(parsed.pagamentos);
        setLastSave(new Date(parsed.timestamp).toLocaleString('pt-BR'));

        if (parsed.pagamentos.length > 0 && isFirstLoad) {
          toast({
            title: '📋 Dados carregados!',
            description: `${parsed.pagamentos.length} pagamento(s) restaurado(s)`,
          });
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados salvos:', error);
    }
  }, [toast]);

  useEffect(() => {
    loadCategoriasECentrosCusto();
    loadSavedData();
  }, [loadCategoriasECentrosCusto, loadSavedData]);

  const getMetricas = () => {
    const total = pagamentos.length;
    const pendentes = pagamentos.filter(p => p.status === 'pendente').length;
    const agendados = pagamentos.filter(p => p.status === 'agendado').length;
    const aguardandoAprovacao = pagamentos.filter(p => p.status === 'aguardando_aprovacao').length;
    const aprovados = pagamentos.filter(p => p.status === 'aprovado').length;
    const erros = pagamentos.filter(p => p.status === 'erro').length;
    return { total, pendentes, agendados, aguardandoAprovacao, aprovados, erros };
  };

  const metricas = getMetricas();

  const parseCurrencyToNumber = (rawValue: string): number => {
    if (!rawValue) return 0;
    let normalized = rawValue.trim();
    const isNegative = normalized.includes('-');
    normalized = normalized.replace(/[R$\s]/g, '');
    normalized = normalized.replace(/\./g, '').replace(',', '.');
    normalized = normalized.replace('-', '');
    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed)) return 0;
    return isNegative ? -Math.abs(parsed) : parsed;
  };

  const verificarStakeholder = async (pagamento: PagamentoAgendamento): Promise<Stakeholder> => {
    const documento = pagamento.cpf_cnpj || '';
    return {
      id: '',
      name: pagamento.nome_beneficiario,
      document: documento,
      type: 'funcionario',
      pixKey: pagamento.chave_pix || undefined,
    };
  };

  const agendarPagamentoNoNibo = async (pagamento: PagamentoAgendamento, stakeholder: Stakeholder) => {
    // DESABILITADO: NIBO foi substituído pelo Conta Azul
    toast({
      title: 'Funcionalidade desabilitada',
      description: 'Agendamento via NIBO foi descontinuado. Migração para Conta Azul em andamento.',
      variant: 'destructive',
    });
    
    // Evitar warnings de variáveis não usadas
    void pagamento;
    void stakeholder;
  };

  const agendarPagamentos = async () => {
    if (!barId) {
      toast({
        title: '❌ Nenhum bar selecionado',
        description: 'Selecione um bar antes de processar pagamentos',
        variant: 'destructive',
      });
      return;
    }

    if (pagamentos.length === 0) {
      toast({
        title: '❌ Lista vazia',
        description: 'Adicione pagamentos antes de agendar',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    let sucessos = 0;
    let erros = 0;

    try {
      for (const pagamento of pagamentos) {
        if (pagamento.status === 'pendente') {
          try {
            const stakeholder = await verificarStakeholder(pagamento);
            await agendarPagamentoNoNibo(pagamento, stakeholder);

            setPagamentos(prev =>
              prev.map(p =>
                p.id === pagamento.id
                  ? {
                      ...p,
                      status: 'agendado',
                      stakeholder_id: stakeholder.id,
                      updated_at: new Date().toISOString(),
                      atualizado_por_id: user?.auth_id,
                      atualizado_por_nome: user?.nome || user?.email || 'Usuário',
                    }
                  : p
              )
            );
            sucessos++;
          } catch (pagamentoError) {
            console.error(`Erro no pagamento ${pagamento.nome_beneficiario}:`, pagamentoError);
            setPagamentos(prev =>
              prev.map(p =>
                p.id === pagamento.id
                  ? { ...p, status: 'erro', updated_at: new Date().toISOString() }
                  : p
              )
            );
            erros++;
          }
        }
      }

      if (sucessos > 0 && erros === 0) {
        toast({ title: '🎯 Agendamento concluído!', description: `${sucessos} agendado(s)` });
      } else if (sucessos > 0 && erros > 0) {
        toast({ title: '⚠️ Agendamento parcial', description: `${sucessos} ok, ${erros} erros` });
      } else if (erros > 0) {
        toast({ title: '❌ Erro no agendamento', description: `${erros} falharam`, variant: 'destructive' });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const pagarAgendadosInter = async () => {
    if (!barId || !credenciaisDisponiveis.inter || !interCredencialSelecionadaId) {
      toast({
        title: '❌ Configuração incompleta',
        description: 'Selecione bar, credencial Inter e verifique configurações',
        variant: 'destructive',
      });
      return;
    }

    const agendados = pagamentos.filter(p => p.status === 'agendado');
    if (agendados.length === 0) {
      toast({ title: 'Nenhum agendado', description: 'Não há pagamentos agendados', variant: 'destructive' });
      return;
    }

    setPagandoPixId('all');
    let sucessos = 0;
    let erros = 0;

    for (const pagamento of agendados) {
      try {
        const valorLimpo = pagamento.valor.replace(/[^\d,.-]/g, '').replace(',', '.');
        const valorNumerico = parseFloat(valorLimpo);

        const response = await fetch('/api/financeiro/inter/pix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            valor: valorNumerico.toString(),
            destinatario: pagamento.nome_beneficiario,
            chave: pagamento.chave_pix,
            data_pagamento: pagamento.data_pagamento,
            descricao: pagamento.descricao || `Pagamento para ${pagamento.nome_beneficiario}`,
            bar_id: pagamento.bar_id || barId,
            inter_credencial_id: Number(interCredencialSelecionadaId),
            agendamento_id: pagamento.nibo_agendamento_id,
          }),
        });

        const data = await response.json();

        if (data.success) {
          setPagamentos(prev =>
            prev.map(p =>
              p.id === pagamento.id
                ? {
                    ...p,
                    status: 'aguardando_aprovacao' as const,
                    inter_aprovacao_id: data.data?.codigoSolicitacao,
                    codigo_solic: data.data?.codigoSolicitacao,
                    updated_at: new Date().toISOString(),
                  }
                : p
            )
          );
          sucessos++;
        } else {
          setPagamentos(prev =>
            prev.map(p => (p.id === pagamento.id ? { ...p, status: 'erro_inter' as const } : p))
          );
          erros++;
        }
      } catch (error) {
        console.error(`Erro PIX ${pagamento.nome_beneficiario}:`, error);
        setPagamentos(prev =>
          prev.map(p => (p.id === pagamento.id ? { ...p, status: 'erro_inter' as const } : p))
        );
        erros++;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setPagandoPixId(null);

    if (erros === 0) {
      toast({ title: '✅ PIX enviados!', description: `${sucessos} enviados` });
    } else {
      toast({ title: '⚠️ Erros no PIX', description: `${sucessos} ok, ${erros} erros`, variant: 'destructive' });
    }
  };

  const pagarPendentesInterDireto = async () => {
    if (!barId || !credenciaisDisponiveis.inter || !interCredencialSelecionadaId) {
      toast({ title: '❌ Configuração incompleta', variant: 'destructive' });
      return;
    }

    const pendentes = pagamentos.filter(p => p.status === 'pendente');
    if (pendentes.length === 0) {
      toast({ title: 'Nenhum pendente', variant: 'destructive' });
      return;
    }

    setPagandoPixId('direct');
    setIsProcessing(true);
    let sucessos = 0;
    let erros = 0;

    for (const pagamento of pendentes) {
      try {
        const valorLimpo = pagamento.valor.replace(/[^\d,.-]/g, '').replace(',', '.');
        const valorNumerico = parseFloat(valorLimpo);

        const response = await fetch('/api/financeiro/inter/pix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            valor: valorNumerico.toString(),
            destinatario: pagamento.nome_beneficiario,
            chave: pagamento.chave_pix,
            data_pagamento: pagamento.data_pagamento,
            descricao: pagamento.descricao || `Pagamento para ${pagamento.nome_beneficiario}`,
            bar_id: pagamento.bar_id || barId,
            inter_credencial_id: Number(interCredencialSelecionadaId),
          }),
        });

        const data = await response.json();

        if (data.success) {
          setPagamentos(prev =>
            prev.map(p =>
              p.id === pagamento.id
                ? {
                    ...p,
                    status: 'aguardando_aprovacao' as const,
                    inter_aprovacao_id: data.data?.codigoSolicitacao || '',
                    updated_at: new Date().toISOString(),
                  }
                : p
            )
          );
          sucessos++;
        } else {
          setPagamentos(prev =>
            prev.map(p => (p.id === pagamento.id ? { ...p, status: 'erro_inter' as const } : p))
          );
          erros++;
        }
      } catch (error) {
        console.error(`Erro PIX direto ${pagamento.nome_beneficiario}:`, error);
        setPagamentos(prev =>
          prev.map(p => (p.id === pagamento.id ? { ...p, status: 'erro_inter' as const } : p))
        );
        erros++;
      }
    }

    setPagandoPixId(null);
    setIsProcessing(false);

    if (erros === 0) {
      toast({ title: '✅ PIX enviados!', description: `${sucessos} enviados` });
    } else {
      toast({ title: '⚠️ Erros', description: `${sucessos} ok, ${erros} erros`, variant: 'destructive' });
    }
  };

  const handlePagamentoAdicionado = (novo: PagamentoAgendamento) => {
    setPagamentos(prev => [...prev, novo]);
  };

  const handleEditar = (id: string) => {
    toast({ title: 'Em desenvolvimento', description: 'Edição via modal em breve' });
  };

  const handleExcluir = (id: string) => {
    const pagamento = pagamentos.find(p => p.id === id);
    setPagamentos(prev => prev.filter(p => p.id !== id));
    toast({ title: '🗑️ Excluído', description: `${pagamento?.nome_beneficiario || 'Pagamento'} removido` });
  };

  const handleEnviarPix = async (id: string) => {
    const pagamento = pagamentos.find(p => p.id === id);
    if (!pagamento) return;

    if (!barId || !credenciaisDisponiveis.inter || !interCredencialSelecionadaId) {
      toast({ title: '❌ Configuração incompleta', variant: 'destructive' });
      return;
    }

    setPagandoPixId(id);

    try {
      const valorLimpo = pagamento.valor.replace(/[^\d,.-]/g, '').replace(',', '.');
      const valorNumerico = parseFloat(valorLimpo);

      const response = await fetch('/api/financeiro/inter/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valor: valorNumerico.toString(),
          destinatario: pagamento.nome_beneficiario,
          chave: pagamento.chave_pix,
          data_pagamento: pagamento.data_pagamento,
          descricao: pagamento.descricao || `Pagamento para ${pagamento.nome_beneficiario}`,
          bar_id: pagamento.bar_id || barId,
          inter_credencial_id: Number(interCredencialSelecionadaId),
          agendamento_id: pagamento.nibo_agendamento_id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setPagamentos(prev =>
          prev.map(p =>
            p.id === id
              ? {
                  ...p,
                  inter_aprovacao_id: data.data?.codigoSolicitacao || '',
                  updated_at: new Date().toISOString(),
                }
              : p
          )
        );
        toast({ title: '✅ Enviado para Inter!', description: `${pagamento.nome_beneficiario}` });
      } else {
        setPagamentos(prev =>
          prev.map(p => (p.id === id ? { ...p, status: 'erro_inter' as const } : p))
        );
        toast({ title: '❌ Erro Inter', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      console.error('Erro PIX:', error);
      toast({ title: '❌ Erro', variant: 'destructive' });
    } finally {
      setPagandoPixId(null);
    }
  };

  const handleFolhaImportada = (pagamentosFolha: PagamentoAgendamento[]) => {
    setPagamentos(prev => [...prev, ...pagamentosFolha]);
  };

  const handleStakeholderCriado = (stakeholder: Stakeholder) => {
    toast({ title: '✅ Stakeholder criado', description: stakeholder.name });
  };

  const limparLista = () => {
    const quantidade = pagamentos.length;
    setPagamentos([]);
    toast({ title: '🧹 Lista limpa', description: `${quantidade} removidos` });
  };

  const abrirModalFolha = () => {
    if (!barId) {
      toast({ title: '❌ Nenhum bar selecionado', variant: 'destructive' });
      return;
    }
    setModalFolha(true);
  };

  return (
    <ProtectedRoute requiredModule="financeiro">
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-2 py-4 max-w-[98vw]">
          <AgendamentoCredenciais
            barId={barId}
            barNome={barNome}
            onCredenciaisVerificadas={result => {
              setCredenciaisDisponiveis({ ...result, verificado: true });
            }}
          />

          {barId && credenciaisDisponiveis.verificado && (
            <div className="mb-6 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-700 dark:text-yellow-400" />
                <div className="text-sm text-yellow-700 dark:text-yellow-400">
                  <strong>Módulo em migração para Conta Azul</strong>
                  <p className="text-xs mt-1">
                    O NIBO foi substituído pelo Conta Azul. Funcionalidades de agendamento estão temporariamente desabilitadas.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-80 flex-shrink-0">
              <Card className="card-dark shadow-sm lg:sticky lg:top-6">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">Resumo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {credenciaisDisponiveis.inter && (
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">API Inter para pagamento</Label>
                      <SelectWithSearch
                        value={interCredencialSelecionadaId}
                        onValueChange={value => setInterCredencialSelecionadaId(value || '')}
                        placeholder="Selecione a credencial Inter"
                        options={interCredenciais.map(cred => ({
                          value: String(cred.id),
                          label: cred.cnpj ? `${cred.nome} (${cred.cnpj})` : cred.nome,
                        }))}
                        className="mt-1"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 dark:bg-gray-600 rounded-lg">
                        <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">{metricas.total}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <Clock className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">Pendentes</span>
                    </div>
                    <span className="text-lg font-bold text-foreground">{metricas.pendentes}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <Calendar className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">Agendados</span>
                    </div>
                    <span className="text-lg font-bold text-foreground">{metricas.agendados}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <Clock className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">Aguardando</span>
                    </div>
                    <span className="text-lg font-bold text-foreground">{metricas.aguardandoAprovacao}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <CheckCircle className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">Aprovados</span>
                    </div>
                    <span className="text-lg font-bold text-foreground">{metricas.aprovados}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <AlertCircle className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">Erros</span>
                    </div>
                    <span className="text-lg font-bold text-foreground">{metricas.erros}</span>
                  </div>

                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
                    <Button
                      onClick={pagarPendentesInterDireto}
                      disabled={
                        isProcessing ||
                        pagandoPixId !== null ||
                        metricas.pendentes === 0 ||
                        !credenciaisDisponiveis.inter ||
                        !barId ||
                        !interCredencialSelecionadaId
                      }
                      variant="outline"
                      className="w-full"
                    >
                      {pagandoPixId === 'direct' ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Enviando PIX...
                        </>
                      ) : (
                        <>
                          <Banknote className="w-4 h-4 mr-2" />
                          PIX Direto ({metricas.pendentes})
                        </>
                      )}
                    </Button>

                    <div className="relative py-2">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="px-2 bg-white dark:bg-gray-800 text-xs text-gray-500">migração em andamento</span>
                      </div>
                    </div>

                    <Button
                      onClick={agendarPagamentos}
                      disabled={isProcessing || metricas.pendentes === 0 || !barId}
                      className="w-full btn-primary"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Agendar (Desabilitado)
                    </Button>

                    <Button
                      onClick={pagarAgendadosInter}
                      disabled={
                        isProcessing ||
                        pagandoPixId !== null ||
                        metricas.agendados === 0 ||
                        !credenciaisDisponiveis.inter ||
                        !barId ||
                        !interCredencialSelecionadaId
                      }
                      variant="outline"
                      className="w-full"
                    >
                      {pagandoPixId && pagandoPixId !== 'direct' ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processando PIX...
                        </>
                      ) : (
                        <>
                          <Banknote className="w-4 h-4 mr-2" />
                          Pagar Agendados ({metricas.agendados})
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex-1">
              {!credenciaisDisponiveis.verificado ? (
                <Card className="card-dark border-0 shadow-lg">
                  <CardContent className="py-16 text-center">
                    <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-4">
                      Verificando credenciais...
                    </h2>
                  </CardContent>
                </Card>
              ) : !barId ? (
                <Card className="card-dark border-0 shadow-lg">
                  <CardContent className="py-16 text-center">
                    <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full inline-block">
                      <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-4">
                      Nenhum bar selecionado
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                      Selecione um bar no menu superior para começar.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Tabs value={tabAtivo} onValueChange={setTabAtivo} className="space-y-6">
                  <TabsList className="grid w-full grid-cols-2 bg-muted/70 border border-border p-1 rounded-lg">
                    <TabsTrigger
                      value="manual"
                      className="data-[state=active]:bg-muted data-[state=active]:text-foreground rounded-md"
                    >
                      Adicionar Manual
                    </TabsTrigger>
                    <TabsTrigger
                      value="lista"
                      className="data-[state=active]:bg-muted data-[state=active]:text-foreground rounded-md"
                    >
                      Lista de Pagamentos
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="manual">
                    <Card className="card-dark border-0 shadow-lg">
                      <CardHeader>
                        <CardTitle className="text-gray-900 dark:text-white">
                          Adicionar Pagamento Manual
                        </CardTitle>
                        <CardDescription className="text-gray-600 dark:text-gray-400">
                          Preencha os dados do pagamento para agendamento
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <NovoPagamentoForm
                          categorias={categorias}
                          centrosCusto={centrosCusto}
                          barId={barId}
                          onPagamentoAdicionado={handlePagamentoAdicionado}
                        />
                        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <Button onClick={limparLista} variant="outline" className="gap-2">
                            <Trash2 className="w-4 h-4" />
                            Limpar Lista
                          </Button>
                          <Button onClick={abrirModalFolha} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                            <FileText className="w-4 h-4" />
                            Pagar Folha
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="lista">
                    <Card className="card-dark border-0 shadow-lg">
                      <CardHeader>
                        <CardTitle className="text-gray-900 dark:text-white">Lista de Pagamentos</CardTitle>
                        <CardDescription className="text-gray-600 dark:text-gray-400">
                          {pagamentos.length} pagamento(s) na lista
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <PagamentosList
                          pagamentos={pagamentos}
                          onEditar={handleEditar}
                          onExcluir={handleExcluir}
                          onEnviarPix={handleEnviarPix}
                          isProcessing={isProcessing}
                          pagandoPixId={pagandoPixId}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </div>
        </div>

        <ImportarFolhaModal
          isOpen={modalFolha}
          onClose={() => setModalFolha(false)}
          barId={barId ?? undefined}
          barNome={barNome}
          categorias={categorias}
          centrosCusto={centrosCusto}
          onImportado={handleFolhaImportada}
        />

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
