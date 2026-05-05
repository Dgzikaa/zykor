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
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Calendar,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Trash2,
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
import { AgendamentoStatusCA } from './components/AgendamentoStatusCA';
import { PagamentosList } from './components/PagamentosList';
import { NovoPagamentoForm } from './components/NovoPagamentoForm';
import { ImportarFolhaForm } from './components/ImportarFolhaForm';
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
    inter: boolean;
    verificado: boolean;
  }>({ inter: false, verificado: false });

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

  const [modalStakeholder, setModalStakeholder] = useState(false);
  const [stakeholderEmCadastro, setStakeholderEmCadastro] = useState({
    document: '',
    name: '',
  });

  const [tabAtivo, setTabAtivo] = useState('manual');

  const [categorias, setCategorias] = useState<any[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<any[]>([]);
  const [contasFinanceiras, setContasFinanceiras] = useState<any[]>([]);
  const [contaFinanceiraSelecionadaId, setContaFinanceiraSelecionadaId] = useState<string>('');
  /** Contas vinculadas à credencial Inter selecionada. Vazio = sem vínculo (mostra todas). */
  const [contasVinculadas, setContasVinculadas] = useState<Set<string>>(new Set());
  const [gerenciarContasOpen, setGerenciarContasOpen] = useState(false);
  const [ultimoPoll, setUltimoPoll] = useState<Date | null>(null);
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
        `/api/financeiro/contaazul/categorias?bar_id=${barId}`
      );
      const categoriasData = await categoriasResponse.json();
      if (categoriasData.categorias) {
        setCategorias(categoriasData.categorias);
      }

      const centrosCustoResponse = await fetch(
        `/api/financeiro/contaazul/centros-custo?bar_id=${barId}`
      );
      const centrosCustoData = await centrosCustoResponse.json();
      const centrosArr = centrosCustoData.centros_custo || centrosCustoData.centrosCusto;
      if (Array.isArray(centrosArr)) {
        setCentrosCusto(centrosArr);
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

      // Contas financeiras CA (pra registro do lançamento)
      const contasResponse = await fetch(
        `/api/financeiro/contaazul/contas-financeiras?bar_id=${barId}`
      );
      const contasData = await contasResponse.json();
      const contasArr = contasData.contas_financeiras || [];
      if (Array.isArray(contasArr)) {
        setContasFinanceiras(contasArr);
        // Restaura escolha persistida no localStorage por bar
        const saved = localStorage.getItem(`sgb_agendamento_conta_fin_bar_${barId}`);
        if (saved && contasArr.some((c: any) => c.contaazul_id === saved)) {
          setContaFinanceiraSelecionadaId(saved);
        }
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
      const savedData = localStorage.getItem(STORAGE_KEYS.PAGAMENTOS);
      if (!savedData) return;
      const parsed = JSON.parse(savedData);
      if (parsed && parsed.pagamentos && Array.isArray(parsed.pagamentos)) {
        setPagamentos(parsed.pagamentos);
        setLastSave(new Date(parsed.timestamp).toLocaleString('pt-BR'));
      }
    } catch (error) {
      console.error('Erro ao carregar dados salvos:', error);
    }
  }, []);

  useEffect(() => {
    loadCategoriasECentrosCusto();
    loadSavedData();
  }, [loadCategoriasECentrosCusto, loadSavedData]);

  // Carrega vínculos de contas CA <-> credencial Inter (por bar + cred)
  useEffect(() => {
    if (!barId || !interCredencialSelecionadaId) {
      setContasVinculadas(new Set());
      return;
    }
    const key = `sgb_agendamento_contas_inter_${barId}_${interCredencialSelecionadaId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          setContasVinculadas(new Set(arr));
          return;
        }
      } catch {
        /* ignore */
      }
    }
    setContasVinculadas(new Set());
  }, [barId, interCredencialSelecionadaId]);

  // Se a conta selecionada não está mais nos vínculos, limpa
  useEffect(() => {
    if (
      contaFinanceiraSelecionadaId &&
      contasVinculadas.size > 0 &&
      !contasVinculadas.has(contaFinanceiraSelecionadaId)
    ) {
      setContaFinanceiraSelecionadaId('');
      if (barId) localStorage.removeItem(`sgb_agendamento_conta_fin_bar_${barId}`);
    }
  }, [contasVinculadas, contaFinanceiraSelecionadaId, barId]);

  // Polling automático de status PIX no Inter (a cada 30s pra pagamentos
  // aguardando aprovação ou agendados — para quando todos finalizaram)
  useEffect(() => {
    if (!barId) return;
    const pendentes = pagamentos.filter(
      p =>
        (p.status === 'aguardando_aprovacao' || p.status === 'agendado') &&
        p.id // só os com id local
    );
    if (pendentes.length === 0) return;

    let cancelado = false;

    const fazerPoll = async () => {
      const ids = pendentes.map(p => p.id).join(',');
      try {
        const r = await fetch(
          `/api/financeiro/inter/pix/status?bar_id=${barId}&zykor_ids=${encodeURIComponent(ids)}`
        );
        if (!r.ok || cancelado) return;
        const data = await r.json();
        const byZykorId = new Map<string, any>();
        for (const pix of data.pix || []) {
          if (pix.pagamento_zykor_id) byZykorId.set(pix.pagamento_zykor_id, pix);
        }
        setPagamentos(prev =>
          prev.map(p => {
            const upd = byZykorId.get(p.id);
            if (!upd) return p;
            const interStatusUpper = String(upd.inter_status || '').toUpperCase();
            // Mapeia inter_status → status local da lista
            let novoStatus = p.status;
            if (['EXECUTADO', 'CONCLUIDO', 'PAGO', 'COMPLETED'].includes(interStatusUpper)) {
              novoStatus = 'aprovado';
            } else if (['FALHOU', 'ERRO', 'FAILED', 'REJEITADO', 'CANCELADO', 'CANCELLED'].includes(interStatusUpper)) {
              novoStatus = 'erro_inter';
            }
            return novoStatus !== p.status
              ? { ...p, status: novoStatus, updated_at: new Date().toISOString() }
              : p;
          })
        );
        setUltimoPoll(new Date());
      } catch (e) {
        // silencioso — polling não bloqueia
      }
    };

    // Primeiro poll imediato, depois a cada 30s
    void fazerPoll();
    const interval = setInterval(fazerPoll, 30000);
    return () => {
      cancelado = true;
      clearInterval(interval);
    };
  }, [barId, pagamentos]);

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

  /**
   * Fluxo end-to-end de um único pagamento:
   * 1) Cria conta a pagar no Conta Azul (despesa, vencimento = data_pagamento)
   * 2) Envia PIX no Inter com dataPagamento (Inter agenda no banco)
   *
   * Se CA falhar: status=erro_ca, NÃO envia PIX.
   * Se Inter falhar: status=erro_inter, lançamento CA já existe (usuário cancela manualmente).
   */
  /** Parse correto pra valores BRL (R$ 1.089,10 → 1089.10). */
  const parseValorBRL = (valor: string): number => {
    const limpo = String(valor || '')
      .replace(/[R$\s]/g, '')
      .replace(/\./g, '') // tira separador de milhar PRIMEIRO
      .replace(',', '.'); // depois troca decimal
    const parsed = parseFloat(limpo);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const processarPagamentoCompleto = async (
    pagamento: PagamentoAgendamento
  ): Promise<{ ok: boolean; etapa: 'ca' | 'inter'; mensagem?: string }> => {
    const valorNumerico = parseValorBRL(pagamento.valor);
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      return { ok: false, etapa: 'ca', mensagem: 'Valor inválido' };
    }

    const dataVenc = pagamento.data_pagamento;
    const dataComp = pagamento.data_competencia || dataVenc;

    // ETAPA 1 — Conta Azul
    let contaazulLancamentoId = pagamento.contaazul_lancamento_id;
    if (!contaazulLancamentoId) {
      try {
        const caResp = await fetch('/api/financeiro/contaazul/lancamentos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bar_id: pagamento.bar_id || barId,
            data_competencia: dataComp,
            data_vencimento: dataVenc,
            valor: valorNumerico,
            descricao:
              pagamento.descricao ||
              `Pagamento ${pagamento.nome_beneficiario}`,
            categoria_id: pagamento.categoria_id,
            centro_custo_id: pagamento.centro_custo_id || undefined,
            conta_financeira_id: contaFinanceiraSelecionadaId || undefined,
            // 3 caminhos pra resolver fornecedor (em ordem de preferência):
            pessoa_id: pagamento.contaazul_pessoa_id || undefined,
            cpf_cnpj: pagamento.cpf_cnpj || undefined,
            nome_beneficiario: pagamento.nome_beneficiario,
          }),
        });
        const caData = await caResp.json();
        if (!caResp.ok || !caData.success) {
          const msg = caData?.error || `CA HTTP ${caResp.status}`;
          setPagamentos(prev =>
            prev.map(p =>
              p.id === pagamento.id
                ? {
                    ...p,
                    status: 'erro_ca' as const,
                    erro_mensagem: msg,
                    updated_at: new Date().toISOString(),
                  }
                : p
            )
          );
          return { ok: false, etapa: 'ca', mensagem: msg };
        }
        contaazulLancamentoId = caData.contaazul_id;
        setPagamentos(prev =>
          prev.map(p =>
            p.id === pagamento.id
              ? {
                  ...p,
                  contaazul_lancamento_id: contaazulLancamentoId,
                  updated_at: new Date().toISOString(),
                }
              : p
          )
        );
      } catch (e: any) {
        const msg = e?.message || 'Falha rede CA';
        setPagamentos(prev =>
          prev.map(p =>
            p.id === pagamento.id
              ? { ...p, status: 'erro_ca' as const, erro_mensagem: msg }
              : p
          )
        );
        return { ok: false, etapa: 'ca', mensagem: msg };
      }
    }

    // ETAPA 2 — Inter PIX (com agendamento se data_pagamento futura)
    try {
      const response = await fetch('/api/financeiro/inter/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Envia como NUMBER pra evitar bug do parse pt-BR no backend
          valor: valorNumerico,
          destinatario: pagamento.nome_beneficiario,
          chave: pagamento.chave_pix,
          data_pagamento: dataVenc,
          descricao:
            pagamento.descricao || `Pagamento para ${pagamento.nome_beneficiario}`,
          bar_id: pagamento.bar_id || barId,
          inter_credencial_id: Number(interCredencialSelecionadaId),
          // ID local pra correlação com pix_enviados via webhook
          agendamento_id: pagamento.id,
        }),
      });
      const data = await response.json();
      if (!data.success) {
        const msg = data?.error || `Inter HTTP ${response.status}`;
        setPagamentos(prev =>
          prev.map(p =>
            p.id === pagamento.id
              ? {
                  ...p,
                  status: 'erro_inter' as const,
                  erro_mensagem: msg,
                  updated_at: new Date().toISOString(),
                }
              : p
          )
        );
        return { ok: false, etapa: 'inter', mensagem: msg };
      }
      setPagamentos(prev =>
        prev.map(p =>
          p.id === pagamento.id
            ? {
                ...p,
                status: 'aguardando_aprovacao' as const,
                inter_aprovacao_id: data.data?.codigoSolicitacao || '',
                codigo_solic: data.data?.codigoSolicitacao || '',
                erro_mensagem: undefined,
                updated_at: new Date().toISOString(),
              }
            : p
        )
      );
      return { ok: true, etapa: 'inter' };
    } catch (e: any) {
      const msg = e?.message || 'Falha rede Inter';
      setPagamentos(prev =>
        prev.map(p =>
          p.id === pagamento.id
            ? { ...p, status: 'erro_inter' as const, erro_mensagem: msg }
            : p
        )
      );
      return { ok: false, etapa: 'inter', mensagem: msg };
    }
  };

  const pagarPendentesInterDireto = async () => {
    if (!barId || !credenciaisDisponiveis.inter || !interCredencialSelecionadaId) {
      toast({ title: '❌ Configuração incompleta', variant: 'destructive' });
      return;
    }

    const pendentes = pagamentos.filter(
      p => p.status === 'pendente' || p.status === 'erro_ca' || p.status === 'erro_inter'
    );
    if (pendentes.length === 0) {
      toast({ title: 'Nenhum pendente', variant: 'destructive' });
      return;
    }

    setPagandoPixId('direct');
    setIsProcessing(true);
    let sucessos = 0;
    let errosCA = 0;
    let errosInter = 0;

    for (const pagamento of pendentes) {
      const r = await processarPagamentoCompleto(pagamento);
      if (r.ok) sucessos++;
      else if (r.etapa === 'ca') errosCA++;
      else errosInter++;
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    setPagandoPixId(null);
    setIsProcessing(false);

    if (sucessos > 0 && errosCA === 0 && errosInter === 0) {
      toast({ title: '✅ Pagamentos processados', description: `${sucessos} CA + Inter` });
    } else {
      toast({
        title: errosCA > 0 || errosInter > 0 ? '⚠️ Processado com erros' : '✅ OK',
        description: `${sucessos} ok · ${errosCA} erro CA · ${errosInter} erro Inter`,
        variant: errosCA > 0 || errosInter > 0 ? 'destructive' : undefined,
      });
    }
  };

  const handlePagamentoAdicionado = (novo: PagamentoAgendamento) => {
    setPagamentos(prev => [...prev, novo]);
  };

  const handleEditar = (id: string) => {
    const pagamento = pagamentos.find(p => p.id === id);
    if (!pagamento) return;
    const novaData = window.prompt(
      `Nova data de pagamento (AAAA-MM-DD) para ${pagamento.nome_beneficiario}:\n\nObs: se já enviado ao Inter, cancele/rejeite no app Inter primeiro, depois clique "Reenviar" aqui.`,
      pagamento.data_pagamento
    );
    if (!novaData || !/^\d{4}-\d{2}-\d{2}$/.test(novaData)) {
      if (novaData !== null) {
        toast({ title: '❌ Data inválida', description: 'Use o formato AAAA-MM-DD', variant: 'destructive' });
      }
      return;
    }
    setPagamentos(prev =>
      prev.map(p =>
        p.id === id
          ? {
              ...p,
              data_pagamento: novaData,
              // Reseta status pra permitir reenvio (mantém contaazul_lancamento_id se existir — não duplica no CA)
              status: 'pendente',
              erro_mensagem: undefined,
              updated_at: new Date().toISOString(),
            }
          : p
      )
    );
    toast({
      title: '📅 Data atualizada',
      description: `${pagamento.nome_beneficiario} → ${novaData}. Clique "Reenviar" pra processar com a nova data.`,
    });
  };

  const handleExcluir = (id: string) => {
    const pagamento = pagamentos.find(p => p.id === id);
    setPagamentos(prev => prev.filter(p => p.id !== id));
    toast({ title: '🗑️ Excluído', description: `${pagamento?.nome_beneficiario || 'Pagamento'} removido` });
  };

  const handleExcluirMultiplos = (ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setPagamentos(prev => prev.filter(p => !idSet.has(p.id)));
    toast({
      title: '🗑️ Excluídos',
      description: `${ids.length} pagamento${ids.length > 1 ? 's removidos' : ' removido'}`,
    });
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
      const r = await processarPagamentoCompleto(pagamento);
      if (r.ok) {
        toast({
          title: '✅ Pagamento processado',
          description: `${pagamento.nome_beneficiario} — CA + Inter OK`,
        });
      } else {
        toast({
          title: r.etapa === 'ca' ? '❌ Erro Conta Azul' : '❌ Erro Inter',
          description: r.mensagem || 'Falha desconhecida',
          variant: 'destructive',
        });
      }
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

          <AgendamentoStatusCA
            barId={barId}
            onSyncComplete={loadCategoriasECentrosCusto}
          />

          <div className="flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-80 flex-shrink-0">
              <Card className="card-dark shadow-sm lg:sticky lg:top-6">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">Resumo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {credenciaisDisponiveis.inter && (
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-gray-700 dark:text-gray-300">
                          API Inter (envio do PIX)
                        </Label>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!barId || !interCredencialSelecionadaId) {
                              toast({ title: 'Selecione a credencial primeiro', variant: 'destructive' });
                              return;
                            }
                            try {
                              const r = await fetch('/api/financeiro/inter/webhook/registrar', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  bar_id: barId,
                                  inter_credencial_id: Number(interCredencialSelecionadaId),
                                }),
                              });
                              const data = await r.json();
                              if (r.ok && data.success) {
                                toast({
                                  title: '✅ Webhook registrado no Inter',
                                  description: data.webhookUrl,
                                });
                              } else {
                                toast({
                                  title: '❌ Erro ao registrar webhook',
                                  description: data?.error || `HTTP ${r.status}`,
                                  variant: 'destructive',
                                });
                              }
                            } catch (e: any) {
                              toast({ title: 'Erro de rede', description: e?.message, variant: 'destructive' });
                            }
                          }}
                          disabled={!interCredencialSelecionadaId}
                          className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                          title="Registra a URL de webhook PIX no Inter pra receber atualizações em tempo real"
                        >
                          Configurar webhook
                        </button>
                      </div>
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
                      <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                        Conta bancária + certificado mTLS que dispara o PIX no Banco Inter.
                      </p>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-gray-700 dark:text-gray-300">
                        Conta financeira (registro CA)
                      </Label>
                      <button
                        type="button"
                        onClick={() => setGerenciarContasOpen(true)}
                        disabled={!interCredencialSelecionadaId}
                        className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:no-underline"
                        title={interCredencialSelecionadaId ? '' : 'Selecione uma credencial Inter primeiro'}
                      >
                        Vincular contas a esta API
                      </button>
                    </div>
                    <SearchableSelect
                      value={contaFinanceiraSelecionadaId}
                      onValueChange={v => {
                        setContaFinanceiraSelecionadaId(v || '');
                        if (barId) {
                          if (v) localStorage.setItem(`sgb_agendamento_conta_fin_bar_${barId}`, v);
                          else localStorage.removeItem(`sgb_agendamento_conta_fin_bar_${barId}`);
                        }
                      }}
                      placeholder="Selecione a conta no CA"
                      searchPlaceholder="Filtrar contas..."
                      emptyMessage="Nenhuma conta financeira"
                      className="mt-1"
                      options={contasFinanceiras
                        .filter(c => {
                          if (c.ativo === false) return false;
                          if (c.tipo && c.tipo !== 'CONTA_CORRENTE') return false;
                          if (String(c.banco || '').toUpperCase() === 'STONE') return false;
                          // Se há vínculo configurado pra essa credencial Inter, usa só vinculadas
                          if (contasVinculadas.size > 0 && !contasVinculadas.has(c.contaazul_id)) return false;
                          return true;
                        })
                        .map(c => ({
                          value: String(c.contaazul_id),
                          label: c.banco ? `${c.nome} (${c.banco})` : String(c.nome),
                          searchHint: `${c.tipo || ''} ${c.banco || ''}`,
                        }))}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                      Em qual conta do Conta Azul o lançamento será registrado. Salvo por bar.
                    </p>
                  </div>


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
                        metricas.pendentes + metricas.erros === 0 ||
                        !credenciaisDisponiveis.inter ||
                        !barId ||
                        !interCredencialSelecionadaId
                      }
                      className="w-full btn-primary"
                    >
                      {pagandoPixId === 'direct' ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <Banknote className="w-4 h-4 mr-2" />
                          Processar todos ({metricas.pendentes + metricas.erros})
                        </>
                      )}
                    </Button>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Para cada pagamento: cria conta a pagar no Conta Azul →
                      envia PIX no Inter (agenda na data informada).
                    </p>
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
                  <TabsList className="grid w-full grid-cols-3 bg-muted/70 border border-border p-1 rounded-lg">
                    <TabsTrigger
                      value="manual"
                      className="data-[state=active]:bg-muted data-[state=active]:text-foreground rounded-md"
                    >
                      Adicionar Manual
                    </TabsTrigger>
                    <TabsTrigger
                      value="folha"
                      className="data-[state=active]:bg-muted data-[state=active]:text-foreground rounded-md"
                    >
                      Importar Folha (Paste)
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
                          <Button
                            onClick={() => setTabAtivo('folha')}
                            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                          >
                            <FileText className="w-4 h-4" />
                            Pagar Folha
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="folha">
                    <Card className="card-dark border-0 shadow-lg">
                      <CardHeader>
                        <CardTitle className="text-gray-900 dark:text-white">
                          Importar Folha de Pagamento (Ctrl+C / Ctrl+V)
                        </CardTitle>
                        <CardDescription className="text-gray-600 dark:text-gray-400">
                          Copie a planilha do Excel/Sheets e cole abaixo. Cabeçalhos
                          aceitos: <code>nome_beneficiario</code>, <code>chave_pix</code>,{' '}
                          <code>valor</code>/<code>total</code>, <code>cargo</code>.
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
                          onExcluirMultiplos={handleExcluirMultiplos}
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

        <StakeholderModal
          isOpen={modalStakeholder}
          onClose={() => setModalStakeholder(false)}
          barId={barId ?? 0}
          initialDocument={stakeholderEmCadastro.document}
          initialName={stakeholderEmCadastro.name}
          onStakeholderCriado={handleStakeholderCriado}
        />

        {gerenciarContasOpen && barId && interCredencialSelecionadaId && (() => {
          const credAtual = interCredenciais.find(
            c => String(c.id) === interCredencialSelecionadaId
          );
          const storageKey = `sgb_agendamento_contas_inter_${barId}_${interCredencialSelecionadaId}`;
          return (
            <div
              className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
              onClick={() => setGerenciarContasOpen(false)}
            >
              <div
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col"
                onClick={e => e.stopPropagation()}
              >
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Vincular contas CA à credencial Inter
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Inter selecionado:{' '}
                    <strong className="text-foreground">
                      {credAtual?.nome || '—'}
                      {credAtual?.cnpj ? ` (${credAtual.cnpj})` : ''}
                    </strong>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Marque as contas CA que pertencem a esse CNPJ. Quando você
                    selecionar essa credencial Inter, só essas contas vão aparecer no
                    select. Salvo neste navegador.
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {contasFinanceiras
                    .filter(c => c.ativo !== false && (!c.tipo || c.tipo === 'CONTA_CORRENTE'))
                    .map(c => {
                      const vinculada = contasVinculadas.has(c.contaazul_id);
                      return (
                        <label
                          key={c.contaazul_id}
                          className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={vinculada}
                            onChange={() => {
                              setContasVinculadas(prev => {
                                const next = new Set(prev);
                                if (vinculada) next.delete(c.contaazul_id);
                                else next.add(c.contaazul_id);
                                localStorage.setItem(
                                  storageKey,
                                  JSON.stringify(Array.from(next))
                                );
                                return next;
                              });
                            }}
                            className="h-4 w-4"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {c.nome}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {c.banco || '—'} · {c.tipo || '—'}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                </div>
                <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setContasVinculadas(new Set());
                      localStorage.removeItem(storageKey);
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Limpar vínculo (mostra todas)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGerenciarContasOpen(false)}
                    className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </ProtectedRoute>
  );
}



