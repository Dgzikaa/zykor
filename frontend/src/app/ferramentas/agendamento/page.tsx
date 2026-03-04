'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { SelectWithSearch } from '@/components/ui/select-with-search';
import {
  Calendar,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Trash2,
  Play,
  Plus,
  Save,
  RotateCcw,
  Search,
  Edit,
  RefreshCw,
  Wrench,
  Loader2,
  Banknote,
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface PagamentoAgendamento {
  id: string;
  cpf_cnpj: string;
  nome_beneficiario: string;
  chave_pix: string;
  valor: string;
  descricao: string;
  data_pagamento: string;
  data_competencia: string;
  categoria_id: string;
  categoria_nome?: string;
  centro_custo_id: string;
  centro_custo_nome?: string;
  codigo_solic?: string;
  status:
    | 'pendente'
    | 'agendado'
    | 'aguardando_aprovacao'
    | 'aprovado'
    | 'erro'
    | 'erro_inter';
  stakeholder_id?: string;
  nibo_agendamento_id?: string;
  inter_aprovacao_id?: string;
  bar_id?: number;
  bar_nome?: string;
  criado_por_id?: string;
  criado_por_nome?: string;
  atualizado_por_id?: string;
  atualizado_por_nome?: string;
  created_at: string;
  updated_at: string;
}

interface Stakeholder {
  id: string;
  name: string;
  document: string;
  email?: string;
  phone?: string;
  type: 'fornecedor' | 'socio' | 'funcionario';
  pixKey?: string; // Adicionado para verificar a chave PIX
}

interface InterCredencial {
  id: number;
  nome: string;
  cnpj?: string | null;
  conta_corrente?: string | null;
}

interface FolhaPreviewItem {
  nome: string;
  pix: string;
  cargo: string;
  total: number;
}

// Chaves para localStorage
const STORAGE_KEYS = {
  PAGAMENTOS: 'sgb_financeiro_pagamentos',
  BACKUP: 'sgb_financeiro_backup',
  LAST_SAVE: 'sgb_financeiro_last_save',
};

export default function AgendamentoPage() {
  const router = useRouter();
  const { setPageTitle } = usePageTitle();
  const { showToast } = useToast();
  const { selectedBar } = useBar();
  const { user } = useUser();

  // ID do bar selecionado - SEM FALLBACK para evitar usar credenciais erradas
  const barId = selectedBar?.id;
  const barNome = selectedBar?.nome;

  // Estado para verificar se o bar tem credenciais configuradas
  const [credenciaisDisponiveis, setCredenciaisDisponiveis] = useState<{
    nibo: boolean;
    inter: boolean;
    verificado: boolean;
  }>({ nibo: false, inter: false, verificado: false });

  // Helper function para toast
  const toast = useCallback((options: {
    title: string;
    description?: string;
    variant?: 'destructive';
  }) => {
    showToast({
      type: options.variant === 'destructive' ? 'error' : 'success',
      title: options.title,
      message: options.description,
    });
  }, [showToast]);

  // Estados principais
  const [pagamentos, setPagamentos] = useState<PagamentoAgendamento[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSave, setLastSave] = useState<string>('');
  const [pagandoPixId, setPagandoPixId] = useState<string | null>(null); // ID do pagamento sendo processado no Inter

  // Modal de edição
  const [modalEdicao, setModalEdicao] = useState(false);
  const [pagamentoEmEdicao, setPagamentoEmEdicao] =
    useState<PagamentoAgendamento | null>(null);

  // Modal de cadastro de stakeholder
  const [modalStakeholder, setModalStakeholder] = useState(false);
  const [stakeholderEmCadastro, setStakeholderEmCadastro] = useState({
    document: '',
    name: '',
  });
  const [isCadastrandoStakeholder, setIsCadastrandoStakeholder] =
    useState(false);

  // Modal de atualização de chave PIX
  const [modalPixKey, setModalPixKey] = useState(false);
  const [stakeholderParaPix, setStakeholderParaPix] =
    useState<Stakeholder | null>(null);
  const [pixKeyData, setPixKeyData] = useState({
    pixKey: '',
    pixKeyType: 3, // 3 = CPF/CNPJ por padrão
    isSameAsDocument: false,
  });
  const [isAtualizandoPix, setIsAtualizandoPix] = useState(false);

  // Modal de importação da folha
  const [modalFolha, setModalFolha] = useState(false);
  const [textoFolha, setTextoFolha] = useState('');
  const [previewFolha, setPreviewFolha] = useState<FolhaPreviewItem[]>([]);
  const [categoriaFolhaId, setCategoriaFolhaId] = useState('');
  const [centroCustoFolhaId, setCentroCustoFolhaId] = useState('');
  const [competenciaFolha, setCompetenciaFolha] = useState(new Date().toISOString().slice(0, 7));
  const [dataPagamentoFolha, setDataPagamentoFolha] = useState(new Date().toISOString().split('T')[0]);

  // Estados para Agendamento Automático
  const [statusProcessamento, setStatusProcessamento] = useState<{
    aba: string;
    totalLinhas: number;
    sucessos: number;
    erros: number;
  } | null>(null);
  const [logsProcessamento, setLogsProcessamento] = useState<{
    timestamp: string;
    tipo: 'sucesso' | 'erro' | 'info';
    mensagem: string;
  }[]>([]);
  const [dadosPlanilha, setDadosPlanilha] = useState<string[][]>([]);
  const [modoEdicaoPlanilha, setModoEdicaoPlanilha] = useState(false);
  
  // Estado para configurações individuais de cada linha
  const [configuracoesIndividuais, setConfiguracoesIndividuais] = useState<{
    [index: number]: {
      categoria_id: string;
      centro_custo_id: string;
      stakeholder_id?: string;
      stakeholder_nome?: string;
    }
  }>({});
  
  // Modal de configuração de categorias
  const [modalConfiguracoes, setModalConfiguracoes] = useState(false);

  // Revisão NIBO - agendamentos sem data_competencia
  const [agendamentosSemCompetencia, setAgendamentosSemCompetencia] = useState<any[]>([]);
  const [loadingRevisao, setLoadingRevisao] = useState(false);
  const [revisaoTotal, setRevisaoTotal] = useState(0);
  const [revisaoHasMore, setRevisaoHasMore] = useState(false);
  const [revisaoOffset, setRevisaoOffset] = useState(0);
  const LIMIT_REVISAO = 500;

  const carregarRevisaoNIBO = useCallback(async (offsetParam: number = 0) => {
    if (!barId) return;
    setLoadingRevisao(true);
    try {
      const res = await fetch(
        `/api/financeiro/nibo/schedules?bar_id=${barId}&sem_competencia=true&offset=${offsetParam}&limit=${LIMIT_REVISAO}`
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      const novos = json.data || [];
      setAgendamentosSemCompetencia(prev => offsetParam > 0 ? [...prev, ...novos] : novos);
      setRevisaoTotal(json.total ?? 0);
      setRevisaoHasMore(json.hasMore ?? false);
      setRevisaoOffset(offsetParam + novos.length);
    } catch (e) {
      toast({
        title: 'Erro ao carregar revisão',
        description: e instanceof Error ? e.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoadingRevisao(false);
    }
  }, [barId, toast]);

  const [tabAtivo, setTabAtivo] = useState('manual');
  useEffect(() => {
    if (tabAtivo === 'revisao' && barId) carregarRevisaoNIBO(0);
  }, [tabAtivo, barId, carregarRevisaoNIBO]);

  // Input manual
  const [novoPagamento, setNovoPagamento] = useState({
    cpf_cnpj: '',
    nome_beneficiario: '',
    chave_pix: '',
    valor: '',
    descricao: '',
    data_pagamento: '',
    data_competencia: '',
    categoria_id: '' as string,
    centro_custo_id: '' as string,
  });

  // Estados para categorias e centros de custo
  const [categorias, setCategorias] = useState<any[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<any[]>([]);
  const [interCredenciais, setInterCredenciais] = useState<InterCredencial[]>([]);
  const [interCredencialSelecionadaId, setInterCredencialSelecionadaId] = useState<string>('');
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);

  // Função para verificar se o bar tem credenciais configuradas
  const verificarCredenciaisBar = useCallback(async () => {
    if (!barId) {
      setCredenciaisDisponiveis({ nibo: false, inter: false, verificado: true });
      return;
    }

    try {
      // Verificar credenciais NIBO e Inter para o bar selecionado
      const response = await fetch(`/api/financeiro/verificar-credenciais?bar_id=${barId}`);
      const data = await response.json();
      
      setCredenciaisDisponiveis({
        nibo: data.nibo || false,
        inter: data.inter || false,
        verificado: true,
      });

      if (!data.nibo || !data.inter) {
        console.warn(`[AGENDAMENTO] Bar ${barId} (${barNome}) não tem todas as credenciais:`, data);
      }
    } catch (error) {
      console.error('Erro ao verificar credenciais:', error);
      setCredenciaisDisponiveis({ nibo: false, inter: false, verificado: true });
    }
  }, [barId, barNome]);

  // Verificar credenciais quando o bar mudar
  useEffect(() => {
    verificarCredenciaisBar();
  }, [verificarCredenciaisBar]);

  // Função para carregar categorias e centros de custo
  const loadCategoriasECentrosCusto = useCallback(async () => {
    if (!barId) return;
    
    setIsLoadingOptions(true);
    try {
      // Carregar categorias passando o bar_id
      const categoriasResponse = await fetch(`/api/financeiro/nibo/categorias?bar_id=${barId}&somente_pagamento=true`);
      const categoriasData = await categoriasResponse.json();
      if (categoriasData.categorias) {
        setCategorias(categoriasData.categorias);
      }

      // Carregar centros de custo passando o bar_id
      const centrosCustoResponse = await fetch(
        `/api/financeiro/nibo/centros-custo?bar_id=${barId}`
      );
      const centrosCustoData = await centrosCustoResponse.json();
      if (centrosCustoData.centrosCusto) {
        setCentrosCusto(centrosCustoData.centrosCusto);
      }

      // Carregar credenciais Inter disponíveis para seleção da conta de pagamento
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

  // Funções de persistência
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

      // Criar backup a cada 10 alterações
      const backupCount = localStorage.getItem('sgb_backup_count') || '0';
      if (parseInt(backupCount) % 10 === 0) {
        // TODO: Implementar createBackup quando disponível
      }
      localStorage.setItem(
        'sgb_backup_count',
        (parseInt(backupCount) + 1).toString()
      );
    } catch (error) {
      console.error('Erro ao salvar no localStorage:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar os dados localmente',
        variant: 'destructive',
      });
    }
  }, [pagamentos, toast]);

  // Salvar automaticamente quando pagamentos mudarem
  useEffect(() => {
    if (pagamentos.length > 0) {
      saveToLocalStorage();
    }
  }, [pagamentos, saveToLocalStorage]);

  const loadSavedData = useCallback(() => {
    try {
      // Verificar se é primeira vez
      const isFirstLoad = !sessionStorage.getItem('sgb_data_loaded');

      // Primeiro, tentar carregar da chave atual
      let savedData = localStorage.getItem(STORAGE_KEYS.PAGAMENTOS);
      let parsed: any = null;
      let isMigration = false;

      if (savedData) {
        parsed = JSON.parse(savedData);
      } else {
        // Se não encontrar, tentar migrar da chave antiga
        const oldData = localStorage.getItem('pagamentos_agendamento');
        if (oldData) {
          const oldParsed = JSON.parse(oldData);

          // Migrar para o novo formato
          const migratedData = {
            pagamentos: oldParsed.pagamentos || [],
            timestamp: oldParsed.lastSave || new Date().toISOString(),
          };

          // Salvar no novo formato
          localStorage.setItem(
            STORAGE_KEYS.PAGAMENTOS,
            JSON.stringify(migratedData)
          );
          localStorage.setItem(STORAGE_KEYS.LAST_SAVE, migratedData.timestamp);

          // Remover dados antigos
          localStorage.removeItem('pagamentos_agendamento');

          parsed = migratedData;
          isMigration = true;
        }
      }

      if (parsed && parsed.pagamentos && Array.isArray(parsed.pagamentos)) {
        setPagamentos(parsed.pagamentos);
        setLastSave(new Date(parsed.timestamp).toLocaleString('pt-BR'));

        // Mostrar toast se houver pagamentos E for primeira vez
        if (parsed.pagamentos.length > 0 && isFirstLoad) {
          if (isMigration) {
            toast({
              title: '🔄 Dados migrados com sucesso!',
              description: `${parsed.pagamentos.length} pagamento(s) migrado(s) do formato antigo`,
            });
          } else {
            toast({
              title: '📋 Dados carregados!',
              description: `${parsed.pagamentos.length} pagamento(s) restaurado(s)`,
            });
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados salvos:', error);
      // Tentar carregar backup se dados principais estiverem corrompidos
      // loadBackup(); // Removido para evitar dependência circular
    }
      }, [toast]);

  // Carregar dados salvos ao inicializar
  useEffect(() => {
    loadCategoriasECentrosCusto();
    loadSavedData();
  }, [loadCategoriasECentrosCusto, loadSavedData]);

  useEffect(() => {
    saveToLocalStorage();
  }, [saveToLocalStorage]);

  const createBackup = useCallback(() => {
    try {
      const backupData = {
        pagamentos,
        timestamp: new Date().toISOString(),
        version: '1.0',
        type: 'backup',
      };

      localStorage.setItem(STORAGE_KEYS.BACKUP, JSON.stringify(backupData));
    } catch (error) {
      console.error('Erro ao criar backup:', error);
    }
  }, [pagamentos]);

  const loadBackup = useCallback(() => {
    try {
      const backupData = localStorage.getItem(STORAGE_KEYS.BACKUP);
      if (backupData) {
        const parsed: any = JSON.parse(backupData);
        if (parsed.pagamentos && Array.isArray(parsed.pagamentos)) {
          setPagamentos(parsed.pagamentos);
          setLastSave(new Date(parsed.timestamp).toLocaleString('pt-BR'));

          toast({
            title: '🔄 Backup restaurado com sucesso!',
            description: `${parsed.pagamentos.length} pagamento(s) carregado(s) do backup`,
          });
        }
      }
    } catch (error) {
      console.error('Erro ao carregar backup:', error);
    }
  }, [toast]);

  const clearAllData = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.PAGAMENTOS);
      localStorage.removeItem(STORAGE_KEYS.BACKUP);
      localStorage.removeItem(STORAGE_KEYS.LAST_SAVE);
      localStorage.removeItem('sgb_backup_count');
      sessionStorage.removeItem('sgb_data_loaded');
      setPagamentos([]);
      setLastSave('');

      toast({
        title: '🧹 Dados limpos com sucesso!',
        description: 'Todos os dados locais foram removidos',
      });
    } catch (error) {
      console.error('Erro ao limpar dados:', error);
    }
  }, [toast]);

  // Métricas
  const getMetricas = () => {
    const total = pagamentos.length;
    const pendentes = pagamentos.filter(p => p.status === 'pendente').length;
    const agendados = pagamentos.filter(p => p.status === 'agendado').length;
    const aguardandoAprovacao = pagamentos.filter(
      p => p.status === 'aguardando_aprovacao'
    ).length;
    const aprovados = pagamentos.filter(p => p.status === 'aprovado').length;
    const erros = pagamentos.filter(p => p.status === 'erro').length;

    return {
      total,
      pendentes,
      agendados,
      aguardandoAprovacao,
      aprovados,
      erros,
    };
  };

  const metricas = getMetricas();

  // Funções de manipulação
  const adicionarPagamento = () => {
    // VALIDAÇÃO CRÍTICA: Verificar se o bar está selecionado
    if (!barId) {
      toast({
        title: '❌ Nenhum bar selecionado',
        description: 'Selecione um bar no menu superior antes de adicionar pagamentos',
        variant: 'destructive',
      });
      return;
    }

    if (
      !novoPagamento.cpf_cnpj ||
      !novoPagamento.nome_beneficiario ||
      !novoPagamento.valor ||
      !novoPagamento.data_pagamento ||
      !novoPagamento.categoria_id
    ) {
      toast({
        title: '❌ Campos obrigatórios',
        description:
          'Preencha CPF/CNPJ, nome, valor, data de pagamento e categoria',
        variant: 'destructive',
      });
      return;
    }

    // Validar valor (pode ser negativo para categorias de saída no NIBO)
    const valorLimpo = novoPagamento.valor
      .replace('R$', '')
      .replace('.', '')
      .replace(',', '.')
      .trim();
    const valorNumerico = parseFloat(valorLimpo);

    if (isNaN(valorNumerico) || valorNumerico === 0) {
      toast({
        title: '❌ Valor inválido',
        description: 'O valor deve ser um número diferente de zero',
        variant: 'destructive',
      });
      return;
    }

    const now = new Date().toISOString();
    const usuarioNome = user?.nome || user?.email || 'Usuário';
    const usuarioId = user?.auth_id;
    
    // Buscar nomes de categoria e centro de custo
    const categoriaSelecionada = categorias.find(c => c.nibo_id === novoPagamento.categoria_id || c.id === novoPagamento.categoria_id);
    const centroCustoSelecionado = centrosCusto.find(c => c.nibo_id === novoPagamento.centro_custo_id || c.id === novoPagamento.centro_custo_id);
    
    const novo: PagamentoAgendamento = {
      id: Date.now().toString(),
      cpf_cnpj: removerFormatacao(novoPagamento.cpf_cnpj), // Salvar sem formatação
      nome_beneficiario: novoPagamento.nome_beneficiario,
      chave_pix: novoPagamento.chave_pix,
      valor: novoPagamento.valor,
      descricao: novoPagamento.descricao,
      data_pagamento: novoPagamento.data_pagamento,
      data_competencia: novoPagamento.data_competencia,
      categoria_id: novoPagamento.categoria_id,
      categoria_nome: categoriaSelecionada?.categoria_nome || categoriaSelecionada?.name || categoriaSelecionada?.nome || '',
      centro_custo_id: novoPagamento.centro_custo_id,
      centro_custo_nome: centroCustoSelecionado?.nome || centroCustoSelecionado?.name || '',
      status: 'pendente',
      bar_id: barId,
      bar_nome: barNome || '',
      criado_por_id: usuarioId,
      criado_por_nome: usuarioNome,
      atualizado_por_id: usuarioId,
      atualizado_por_nome: usuarioNome,
      created_at: now,
      updated_at: now,
    };

    setPagamentos(prev => [...prev, novo]);
    setNovoPagamento({
      cpf_cnpj: '',
      nome_beneficiario: '',
      chave_pix: '',
      valor: '',
      descricao: '',
      data_pagamento: '',
      data_competencia: '',
      categoria_id: '',
      centro_custo_id: '',
    });

    toast({
      title: '✅ Pagamento adicionado com sucesso!',
      description: `${novoPagamento.nome_beneficiario} foi adicionado à lista de pagamentos`,
    });
  };

  const agendarPagamentos = async () => {
    // VALIDAÇÃO CRÍTICA: Verificar se o bar está selecionado
    if (!barId) {
      toast({
        title: '❌ Nenhum bar selecionado',
        description: 'Selecione um bar antes de processar pagamentos',
        variant: 'destructive',
      });
      return;
    }

    // AVISO: Se não tiver NIBO, agendamentos serão salvos apenas localmente
    if (!credenciaisDisponiveis.nibo) {
      toast({
        title: '⚠️ NIBO não configurado',
        description: `Os agendamentos serão salvos localmente. Configure o NIBO para sincronizar depois.`,
      });
      // Continua mesmo sem NIBO - agendamentos serão salvos localmente
    }

    if (pagamentos.length === 0) {
      toast({
        title: '❌ Lista vazia',
        description: 'Adicione pagamentos antes de agendar',
        variant: 'destructive',
      });
      return;
    }

    const normalizarCategoria = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim();

    const categoriasProibidas = new Set([
      'APORTE DE CAPITAL',
      'CONTRATOS',
      'OUTRAS RECEITAS',
      'DIVIDENDOS',
      'EMPRESTIMOS DE SOCIOS',
      'OUTROS INVESTIMENTOS',
      'RECEITA BRUTA',
      'RECEITA',
      'FATURAMENTO',
      'VENDAS',
    ]);

    const pendentes = pagamentos.filter(p => p.status === 'pendente');
    const invalidos = pendentes.filter(p => {
      const categoriaSelecionada = categorias.find(
        c => c.nibo_id === p.categoria_id || c.id === p.categoria_id
      );
      const nome = normalizarCategoria(
        String(
          p.categoria_nome ||
            categoriaSelecionada?.categoria_nome ||
            categoriaSelecionada?.name ||
            categoriaSelecionada?.nome ||
            ''
        )
      );
      const macro = normalizarCategoria(String(categoriaSelecionada?.categoria_macro || ''));
      const texto = `${nome} ${macro}`;
      return (
        categoriasProibidas.has(nome) ||
        categoriasProibidas.has(macro) ||
        /(^| )RECEITA( |$)|FATURAMENTO|VENDAS/.test(texto)
      );
    });

    if (invalidos.length > 0) {
      toast({
        title: '❌ Categoria inválida para pagamento',
        description: `${invalidos.length} pagamento(s) pendente(s) estão com categoria de receita/entrada. Ajuste a categoria antes de agendar.`,
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
            // 1. Verificar/criar stakeholder no NIBO
            const stakeholder = await verificarStakeholder(pagamento);

            // 2. Agendar no NIBO
            await agendarPagamentoNoNibo(pagamento, stakeholder);

            // 3. Atualizar status para agendado
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
            console.error(
              `Erro no pagamento ${pagamento.nome_beneficiario}:`,
              pagamentoError
            );
            erros++;
            continue;
          }
        }
      }

      // Mostrar resultado final
      if (sucessos > 0 && erros === 0) {
        toast({
          title: '🎯 Agendamento concluído com sucesso!',
          description: `${sucessos} pagamento(s) foram agendados no NIBO`,
        });
      } else if (sucessos > 0 && erros > 0) {
        toast({
          title: '⚠️ Agendamento parcial',
          description: `${sucessos} agendados com sucesso, ${erros} com erro`,
        });
      } else if (erros > 0) {
        toast({
          title: '❌ Erro no agendamento',
          description: `${erros} pagamento(s) falharam no agendamento`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Erro geral ao agendar pagamentos:', error);
      toast({
        title: '❌ Erro no agendamento',
        description: 'Erro geral ao processar agendamentos no NIBO',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const enviarParaInter = async (pagamento: PagamentoAgendamento) => {
    try {
      console.log('💸 Enviando pagamento para o Inter:', pagamento.nome_beneficiario);

      // Formatar valor corretamente (remover R$ e vírgulas)
      const valorNumerico = parseFloat(
        pagamento.valor.replace('R$', '').replace(',', '.').trim()
      );

      const dadosInter = {
        valor: valorNumerico.toString(),
        descricao: pagamento.descricao || `Pagamento PIX para ${pagamento.nome_beneficiario}`,
        destinatario: pagamento.nome_beneficiario,
        chave: pagamento.chave_pix,
        data_pagamento: pagamento.data_pagamento,
        bar_id: pagamento.bar_id || barId,
        inter_credencial_id: interCredencialSelecionadaId ? Number(interCredencialSelecionadaId) : null,
        agendamento_id: pagamento.nibo_agendamento_id, // Para vincular o código de solicitação ao agendamento
      };

      console.log('📤 Dados sendo enviados para o Inter:', dadosInter);

      const response = await fetch('/api/financeiro/inter/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dadosInter),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Erro ${response.status}: ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json();

      if (data.success) {
        // Atualizar pagamento com ID de aprovação do Inter
        setPagamentos(prev =>
          prev.map(p =>
            p.id === pagamento.id
              ? {
                  ...p,
                  inter_aprovacao_id: data.data?.codigoSolicitacao || '',
                  updated_at: new Date().toISOString(),
                  atualizado_por_id: user?.auth_id,
                  atualizado_por_nome: user?.nome || user?.email || 'Usuário',
                }
              : p
          )
        );

        toast({
          title: '✅ Enviado para o Inter!',
          description: `Pagamento de ${pagamento.nome_beneficiario} enviado para aprovação`,
        });

        console.log('✅ Pagamento enviado para o Inter com sucesso:', data.data?.codigoSolicitacao);
      } else {
        throw new Error(data.error || 'Erro desconhecido do Inter');
      }
    } catch (error) {
      console.error('Erro ao enviar para o Inter:', error);
      
      // Não falhar o processo todo, apenas mostrar aviso
      toast({
        title: '⚠️ Aviso: Erro no Inter',
        description: `NIBO: ✅ | Inter: ❌ - ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: 'destructive',
      });
      
      // Marcar como erro no Inter mas manter agendado no NIBO
      setPagamentos(prev =>
        prev.map(p =>
          p.id === pagamento.id
            ? {
                ...p,
                status: 'erro_inter' as any, // Status customizado para erro apenas no Inter
                updated_at: new Date().toISOString(),
                atualizado_por_id: user?.auth_id,
                atualizado_por_nome: user?.nome || user?.email || 'Usuário',
              }
            : p
        )
      );
    }
  };

  const verificarStakeholder = async (
    pagamento: PagamentoAgendamento
  ): Promise<Stakeholder> => {
    // Fluxo de folha: sempre delegar a resolução de funcionário ao backend via /employees.
    const documento = pagamento.cpf_cnpj || '';
    return {
      id: '',
      name: pagamento.nome_beneficiario,
      document: documento,
      type: 'funcionario',
      pixKey: pagamento.chave_pix || undefined,
    };
  };

  const agendarPagamentoNoNibo = async (
    pagamento: PagamentoAgendamento,
    stakeholder: Stakeholder
  ) => {
    try {
      const normalizarCategoria = (value: string) =>
        value
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toUpperCase()
          .trim();

      const categoriasProibidas = new Set([
        'APORTE DE CAPITAL',
        'CONTRATOS',
        'OUTRAS RECEITAS',
        'DIVIDENDOS',
        'EMPRESTIMOS DE SOCIOS',
        'OUTROS INVESTIMENTOS',
        'RECEITA BRUTA',
        'RECEITA',
        'FATURAMENTO',
        'VENDAS',
      ]);

      const categoriaSelecionada = categorias.find(
        c => c.nibo_id === pagamento.categoria_id || c.id === pagamento.categoria_id
      );
      const categoriaNome = String(
        pagamento.categoria_nome ||
          categoriaSelecionada?.categoria_nome ||
          categoriaSelecionada?.name ||
          categoriaSelecionada?.nome ||
          ''
      );
      const categoriaMacro = String(categoriaSelecionada?.categoria_macro || '');
      const categoriaTexto = `${normalizarCategoria(categoriaNome)} ${normalizarCategoria(categoriaMacro)}`;
      const categoriaBloqueada =
        categoriasProibidas.has(normalizarCategoria(categoriaNome)) ||
        categoriasProibidas.has(normalizarCategoria(categoriaMacro)) ||
        /(^| )RECEITA( |$)|FATURAMENTO|VENDAS/.test(categoriaTexto);

      if (categoriaBloqueada) {
        throw new Error(
          `Categoria "${categoriaNome || 'Não informada'}" é de entrada/receita e não pode ser usada para pagamento`
        );
      }

      // VALIDAÇÃO CRÍTICA: Verificar bar_id do pagamento
      const barIdFinal = pagamento.bar_id || barId;
      if (!barIdFinal) {
        throw new Error('Bar não identificado. Certifique-se de que o pagamento tem um bar associado.');
      }

      // Categoria é recomendada para NIBO, mas agora é opcional para agendamentos locais
      if (!pagamento.categoria_id && credenciaisDisponiveis.nibo) {
        console.warn('[AGENDAMENTO] Categoria não selecionada, NIBO pode rejeitar');
      }

      // Formatar valor corretamente (pt-BR robusto)
      const valorNumerico = parseCurrencyToNumber(pagamento.valor);
      if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
        throw new Error(`Valor inválido para ${pagamento.nome_beneficiario}: ${pagamento.valor}`);
      }

      // Formatar datas no formato ISO
      const dataPagamento = new Date(pagamento.data_pagamento)
        .toISOString()
        .split('T')[0];
      const dataCompetencia = pagamento.data_competencia
        ? new Date(pagamento.data_competencia).toISOString().split('T')[0]
        : dataPagamento;

      const agendamento = {
        stakeholderId: stakeholder.id || undefined,
        stakeholder_nome: stakeholder.name || pagamento.nome_beneficiario,
        stakeholder_document: stakeholder.document || pagamento.cpf_cnpj || undefined,
        stakeholder_pix_key: stakeholder.pixKey || pagamento.chave_pix || undefined,
        dueDate: dataPagamento,
        scheduleDate: dataPagamento,
        categoria_id: pagamento.categoria_id,
        categoria_nome: pagamento.categoria_nome,
        centro_custo_id: pagamento.centro_custo_id || null,
        centro_custo_nome: pagamento.centro_custo_nome,
        accrualDate: dataCompetencia,
        value: valorNumerico,
        description:
          pagamento.descricao ||
          `Pagamento PIX para ${pagamento.nome_beneficiario}`,
        reference: pagamento.codigo_solic || undefined,
        bar_id: barIdFinal,
        bar_nome: pagamento.bar_nome || barNome,
        criado_por_id: pagamento.criado_por_id || user?.auth_id,
        criado_por_nome: pagamento.criado_por_nome || user?.nome || user?.email,
      };

      const response = await fetch('/api/financeiro/nibo/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agendamento),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Erro ${response.status}: ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json();

      if (data.success) {
        setPagamentos(prev =>
          prev.map(p =>
            p.id === pagamento.id
              ? {
                  ...p,
                  nibo_agendamento_id: data.data.id,
                  updated_at: new Date().toISOString(),
                  atualizado_por_id: user?.auth_id,
                  atualizado_por_nome: user?.nome || user?.email || 'Usuário',
                }
              : p
          )
        );

        // Toast individual removido - apenas a mensagem geral será exibida
      } else {
        throw new Error(data.error || 'Erro desconhecido na resposta do NIBO');
      }
    } catch (error) {
      console.error('Erro ao agendar no NIBO:', error);

      // Atualizar status do pagamento para erro
      setPagamentos(prev =>
        prev.map(p =>
          p.id === pagamento.id
            ? {
                ...p,
                status: 'erro',
                updated_at: new Date().toISOString(),
                atualizado_por_id: user?.auth_id,
                atualizado_por_nome: user?.nome || user?.email || 'Usuário',
              }
            : p
        )
      );

      toast({
        title: '❌ Erro no agendamento NIBO',
        description: `Erro ao agendar ${pagamento.nome_beneficiario}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: 'destructive',
      });

      throw error;
    }
  };

  // Funções utilitárias
  const formatarDocumento = (valor: string): string => {
    const apenasDigitos = valor.replace(/\D/g, '');

    if (apenasDigitos.length <= 11) {
      return apenasDigitos
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }

    return apenasDigitos
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  };

  const removerFormatacao = (valor: string): string => valor.replace(/\D/g, '');

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

  const formatCurrency = (value: number): string =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const abrirModalFolha = () => {
    if (!barId) {
      toast({
        title: '❌ Nenhum bar selecionado',
        description: 'Selecione um bar antes de importar a folha',
        variant: 'destructive',
      });
      return;
    }

    if (!categoriaFolhaId && categorias.length > 0) {
      const categoriaSalario = categorias.find((c: any) => {
        const nome = String(c.categoria_nome || c.name || c.nome || '').toLowerCase();
        return nome.includes('sal') || nome.includes('folha') || nome.includes('funcion');
      });
      if (categoriaSalario) {
        setCategoriaFolhaId(categoriaSalario?.nibo_id || categoriaSalario?.id || '');
      }
    }

    setModalFolha(true);
  };

  const processarPreviewFolha = useCallback(() => {
    const linhas = textoFolha
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    const ignorarLinha = (linhaLower: string): boolean => {
      return (
        linhaLower.includes('qtd\t') ||
        linhaLower.includes('nome completo') ||
        linhaLower.includes('pagamentos pj') ||
        linhaLower.includes('totais')
      );
    };

    const normalizeHeader = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    // Padrão para layout novo (sem cabeçalho): nome | pix | valor | descrição ...
    let indiceNome = 0;
    let indicePix = 1;
    let indiceCargo = 3;
    let indiceValor = 2;
    let inicioDados = 0;

    const extrairNomeEPix = (prefixo: string): { nome: string; pix: string } => {
      const base = prefixo.trim();
      if (!base) return { nome: '', pix: '' };

      const emailMatch = base.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      if (emailMatch?.[0]) {
        return {
          nome: base.replace(emailMatch[0], '').trim(),
          pix: emailMatch[0].trim(),
        };
      }

      const uuidMatch = base.match(
        /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
      );
      if (uuidMatch?.[0]) {
        return {
          nome: base.replace(uuidMatch[0], '').trim(),
          pix: uuidMatch[0].trim(),
        };
      }

      const cpfCnpjMatch = base.match(
        /(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{11,14})(?!.*(\d{11,14}))/i
      );
      if (cpfCnpjMatch?.[0]) {
        return {
          nome: base.replace(cpfCnpjMatch[0], '').trim(),
          pix: cpfCnpjMatch[0].trim(),
        };
      }

      const phoneMatch = base.match(
        /(\(?\d{2}\)?\s*9?\s*\d{4,5}[-\s]?\d{4})$/i
      );
      if (phoneMatch?.[0]) {
        return {
          nome: base.slice(0, phoneMatch.index).trim(),
          pix: phoneMatch[0].trim(),
        };
      }

      const partes = base.split(/\s{2,}/).filter(Boolean);
      if (partes.length >= 2) {
        return {
          nome: partes.slice(0, -1).join(' ').trim(),
          pix: partes[partes.length - 1].trim(),
        };
      }

      return { nome: base, pix: '' };
    };

    // Detectar cabeçalho dinâmico (suporta formato antigo e novo).
    if (linhas.length > 0) {
      const headerCols = linhas[0].split('\t').map(c => normalizeHeader(c));
      const headerPossuiCampos = headerCols.some(
        h =>
          h.includes('nome_beneficiario') ||
          h.includes('nome completo') ||
          h.includes('chave_pix') ||
          h === 'pix' ||
          h === 'valor' ||
          h === 'total'
      );

      if (headerPossuiCampos) {
        const idxNome = headerCols.findIndex(h => h.includes('nome_beneficiario') || h.includes('nome completo') || h === 'nome');
        const idxPix = headerCols.findIndex(h => h.includes('chave_pix') || h === 'pix' || h.includes('chave'));
        const idxCargo = headerCols.findIndex(h => h === 'cargo' || h.includes('funcao'));
        const idxValor = headerCols.findIndex(h => h === 'valor');
        const idxTotal = headerCols.findIndex(h => h === 'total');

        if (idxNome >= 0) indiceNome = idxNome;
        if (idxPix >= 0) indicePix = idxPix;
        if (idxCargo >= 0) indiceCargo = idxCargo;
        if (idxTotal >= 0) {
          indiceValor = idxTotal;
        } else if (idxValor >= 0) {
          indiceValor = idxValor;
        }

        inicioDados = 1; // pular cabeçalho
      }
    }

    const preview: FolhaPreviewItem[] = [];

    for (const linha of linhas.slice(inicioDados)) {
      const linhaLower = linha.toLowerCase();
      if (ignorarLinha(linhaLower)) continue;

      if (linha.includes('\t')) {
        const cols = linha.split('\t').map(c => c.trim());
        if (cols.length < 2) continue;

        const nome = cols[indiceNome] || cols[0] || '';
        const pix = cols[indicePix] || '';
        const cargo = cols[indiceCargo] || cols[3] || 'Funcionário';
        const totalBruto =
          cols[indiceValor] ||
          cols.find(c => /R\$\s*[\d.,]+|^-?\d+[.,]\d{2}$/.test(c)) ||
          '';
        const total = parseCurrencyToNumber(totalBruto);

        if (!nome || total <= 0) continue;
        preview.push({ nome, pix, cargo, total });
        continue;
      }

      // Fallback para texto com espaços (sem TAB), ex:
      // NOME ... PIX ... R$ 1.234,56 DESCRICAO 06/06/2026 15/02/2026
      const matchLinha = linha.match(
        /^(.*?)\s+R\$\s*([\d.]+,\d{2})\s+(.*?)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}\/\d{2}\/\d{4}))?\s*$/
      );
      if (!matchLinha) continue;

      const prefixoNomePix = matchLinha[1] || '';
      const valorBruto = matchLinha[2] || '';
      const descricaoLinha = (matchLinha[3] || '').trim();
      const total = parseCurrencyToNumber(`R$ ${valorBruto}`);
      if (total <= 0) continue;

      const { nome, pix } = extrairNomeEPix(prefixoNomePix);
      if (!nome) continue;

      preview.push({
        nome,
        pix,
        cargo: descricaoLinha || 'Funcionário',
        total,
      });
    }

    setPreviewFolha(preview);

    if (preview.length === 0) {
      toast({
        title: 'Nenhuma linha válida',
        description: 'Cole a planilha com TAB ou texto em linhas, contendo nome e valor positivo.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Prévia da folha gerada',
      description: `${preview.length} linha(s) pronta(s) para importação`,
    });
  }, [textoFolha, toast]);

  const importarFolhaParaLista = () => {
    if (!categoriaFolhaId) {
      toast({
        title: 'Categoria obrigatória',
        description: 'Selecione uma categoria para os lançamentos da folha',
        variant: 'destructive',
      });
      return;
    }

    if (previewFolha.length === 0) {
      toast({
        title: 'Prévia vazia',
        description: 'Gere a prévia da folha antes de importar',
        variant: 'destructive',
      });
      return;
    }

    const now = new Date().toISOString();
    const usuarioNome = user?.nome || user?.email || 'Usuário';
    const usuarioId = user?.auth_id;
    const categoriaSelecionada = categorias.find(
      c => c.nibo_id === categoriaFolhaId || c.id === categoriaFolhaId
    );
    const centroSelecionado = centrosCusto.find(
      c => c.nibo_id === centroCustoFolhaId || c.id === centroCustoFolhaId
    );

    const pagamentosFolha: PagamentoAgendamento[] = previewFolha.map((item, index) => {
      const documentoLimpo = removerFormatacao(item.pix);
      const documento =
        documentoLimpo.length === 11 || documentoLimpo.length === 14
          ? documentoLimpo
          : '';

      return {
        id: `${Date.now()}-${index}`,
        cpf_cnpj: documento,
        nome_beneficiario: item.nome,
        chave_pix: item.pix,
        valor: formatCurrency(item.total),
        descricao: `Folha ${competenciaFolha} - ${item.cargo}`,
        data_pagamento: dataPagamentoFolha,
        data_competencia: `${competenciaFolha}-01`,
        categoria_id: categoriaFolhaId,
        categoria_nome:
          categoriaSelecionada?.categoria_nome ||
          categoriaSelecionada?.name ||
          categoriaSelecionada?.nome ||
          '',
        centro_custo_id: centroCustoFolhaId || '',
        centro_custo_nome: centroSelecionado?.nome || centroSelecionado?.name || '',
        status: 'pendente',
        bar_id: barId,
        bar_nome: barNome || '',
        criado_por_id: usuarioId,
        criado_por_nome: usuarioNome,
        atualizado_por_id: usuarioId,
        atualizado_por_nome: usuarioNome,
        created_at: now,
        updated_at: now,
      };
    });

    setPagamentos(prev => [...prev, ...pagamentosFolha]);
    setModalFolha(false);
    setPreviewFolha([]);
    setTextoFolha('');

    toast({
      title: '✅ Folha importada',
      description: `${pagamentosFolha.length} pagamento(s) adicionado(s) à lista`,
    });
  };

  const buscarStakeholder = async (document: string) => {
    // Remover formatação antes de validar e buscar
    const documentoLimpo = removerFormatacao(document);

    if (!documentoLimpo || documentoLimpo.length < 11) {
      toast({
        title: 'CPF/CNPJ inválido',
        description: 'Digite um CPF ou CNPJ válido',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch(
        `/api/financeiro/nibo/stakeholders?q=${documentoLimpo}`
      );
      const data = await response.json();

      if (data.success && data.data.length > 0) {
        const stakeholder = data.data[0];

        // Stakeholder encontrado - verificar se tem chave PIX
        if (stakeholder.pixKey && stakeholder.pixKey.trim() !== '') {
          // Tem chave PIX - preencher tudo
          setNovoPagamento(prev => ({
            ...prev,
            nome_beneficiario: stakeholder.name,
            cpf_cnpj: formatarDocumento(stakeholder.document),
            chave_pix: stakeholder.pixKey,
          }));

          toast({
            title: '✅ Stakeholder encontrado!',
            description: `${stakeholder.name} foi encontrado com chave PIX`,
          });
        } else {
          // Não tem chave PIX - preencher dados e abrir modal para cadastrar PIX
          setNovoPagamento(prev => ({
            ...prev,
            nome_beneficiario: stakeholder.name,
            cpf_cnpj: formatarDocumento(stakeholder.document),
            chave_pix: '',
          }));

          // Preparar dados para modal de PIX
          setStakeholderParaPix(stakeholder);
          setPixKeyData({
            pixKey: '',
            pixKeyType: 3, // CPF/CNPJ por padrão
            isSameAsDocument: false,
          });
          setModalPixKey(true);

          toast({
            title: '⚠️ Stakeholder sem chave PIX',
            description: `${stakeholder.name} foi encontrado, mas precisa cadastrar chave PIX`,
          });
        }
      } else {
        // Stakeholder não encontrado - abrir modal para cadastrar
        setStakeholderEmCadastro({
          document: documentoLimpo,
          name: '',
        });
        setModalStakeholder(true);

        toast({
          title: '❌ Stakeholder não encontrado',
          description: 'Cadastre um novo stakeholder para continuar',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Erro ao buscar stakeholder:', error);
      toast({
        title: 'Erro na busca',
        description: 'Erro ao buscar stakeholder',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return (
          <Badge
            variant="secondary"
            className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
          >
            Pendente
          </Badge>
        );
      case 'agendado':
        return (
          <Badge
            variant="secondary"
            className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
          >
            Agendado
          </Badge>
        );
      case 'aguardando_aprovacao':
        return (
          <Badge
            variant="secondary"
            className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
          >
            Aguardando Aprovação
          </Badge>
        );
      case 'aprovado':
        return (
          <Badge
            variant="secondary"
            className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
          >
            Aprovado
          </Badge>
        );
      case 'erro':
        return (
          <Badge
            variant="secondary"
            className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
          >
            Erro
          </Badge>
        );
      case 'erro_inter':
        return (
          <Badge
            variant="secondary"
            className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
          >
            NIBO ✅ | Inter ❌
          </Badge>
        );
      default:
        return <Badge variant="secondary">Desconhecido</Badge>;
    }
  };

  const limparLista = () => {
    const quantidade = pagamentos.length;
    setPagamentos([]);
    toast({
      title: '🧹 Lista limpa!',
      description: `${quantidade} pagamento(s) foram removidos da lista`,
    });
  };

  const removerPagamento = (id: string) => {
    const pagamento = pagamentos.find(p => p.id === id);
    setPagamentos(prev => prev.filter(p => p.id !== id));
    toast({
      title: '🗑️ Pagamento excluído!',
      description: `${pagamento?.nome_beneficiario || 'Pagamento'} foi removido da lista`,
    });
  };

  // Função para pagar PENDENTES direto no Inter (sem NIBO)
  const pagarPendentesInterDireto = async () => {
    // VALIDAÇÃO CRÍTICA: Verificar se o bar está selecionado
    if (!barId) {
      toast({
        title: '❌ Nenhum bar selecionado',
        description: 'Selecione um bar antes de processar pagamentos',
        variant: 'destructive',
      });
      return;
    }

    // VALIDAÇÃO CRÍTICA: Verificar se tem credenciais do Inter
    if (!credenciaisDisponiveis.inter) {
      toast({
        title: '❌ Credenciais Inter não configuradas',
        description: `O bar "${barNome}" não possui credenciais Inter (certificados PIX) configuradas.`,
        variant: 'destructive',
      });
      return;
    }

    if (!interCredencialSelecionadaId) {
      toast({
        title: '❌ Selecione a API Inter',
        description: 'Escolha qual conta Inter será usada para este pagamento',
        variant: 'destructive',
      });
      return;
    }

    const pendentes = pagamentos.filter(p => p.status === 'pendente');
    
    if (pendentes.length === 0) {
      toast({
        title: 'Nenhum pagamento pendente',
        description: 'Não há pagamentos com status "pendente" para processar',
        variant: 'destructive',
      });
      return;
    }

    // Verificar se todos têm chave PIX
    const semChavePix = pendentes.filter(p => !p.chave_pix);
    if (semChavePix.length > 0) {
      toast({
        title: 'Chave PIX faltando',
        description: `${semChavePix.length} pagamento(s) não possuem chave PIX cadastrada`,
        variant: 'destructive',
      });
      return;
    }

    setPagandoPixId('direct'); // Indicador de que está processando direto
    setIsProcessing(true);
    let sucessos = 0;
    let erros = 0;

    toast({
      title: '💸 Enviando PIX direto...',
      description: `Processando ${pendentes.length} pagamento(s) diretamente no Inter (sem NIBO)`,
    });

    for (const pagamento of pendentes) {
      try {
        // Extrair valor numérico
        const valorLimpo = pagamento.valor.replace(/[^\d,.-]/g, '').replace(',', '.');
        const valorNumerico = parseFloat(valorLimpo);

        if (isNaN(valorNumerico) || valorNumerico <= 0) {
          throw new Error('Valor inválido para pagamento');
        }

        console.log(`[PIX-DIRETO] Enviando pagamento para ${pagamento.nome_beneficiario}: R$ ${valorNumerico}`);

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
          // Salvar localmente no banco (sem NIBO)
          try {
            await fetch('/api/financeiro/nibo/schedules', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                stakeholderId: null,
                stakeholder_nome: pagamento.nome_beneficiario,
                dueDate: pagamento.data_pagamento,
                scheduleDate: pagamento.data_pagamento,
                categoria_id: pagamento.categoria_id || null,
                categoria_nome: pagamento.categoria_nome || null,
                centro_custo_id: pagamento.centro_custo_id || null,
                centro_custo_nome: pagamento.centro_custo_nome || null,
                accrualDate: pagamento.data_competencia || pagamento.data_pagamento,
                value: valorNumerico,
                description: pagamento.descricao || `Pagamento PIX para ${pagamento.nome_beneficiario}`,
                bar_id: pagamento.bar_id || barId,
                bar_nome: pagamento.bar_nome || barNome,
                criado_por_id: user?.auth_id,
                criado_por_nome: user?.nome || user?.email,
              }),
            });
          } catch (saveError) {
            console.warn('[PIX-DIRETO] Erro ao salvar no banco (não crítico):', saveError);
          }

          // Atualizar status para aguardando_aprovacao
          setPagamentos(prev =>
            prev.map(p =>
              p.id === pagamento.id
                ? {
                    ...p,
                    status: 'aguardando_aprovacao',
                    inter_aprovacao_id: data.data?.codigoSolicitacao || '',
                    updated_at: new Date().toISOString(),
                    atualizado_por_id: user?.auth_id,
                    atualizado_por_nome: user?.nome || user?.email || 'Usuário',
                  }
                : p
            )
          );
          sucessos++;
        } else {
          const credInfo = data?.credencial
            ? ` [credencial_id=${data.credencial.credencial_id}, cert=${data.credencial.cert_file || 'n/a'}, key=${data.credencial.key_file || 'n/a'}]`
            : '';
          throw new Error((data.error || 'Erro ao enviar PIX') + credInfo);
        }
      } catch (error) {
        console.error(`[PIX-DIRETO] Erro no pagamento ${pagamento.nome_beneficiario}:`, error);
        
        // Marcar como erro
        setPagamentos(prev =>
          prev.map(p =>
            p.id === pagamento.id
              ? {
                  ...p,
                  status: 'erro_inter',
                  updated_at: new Date().toISOString(),
                }
              : p
          )
        );
        erros++;
      }
    }

    setPagandoPixId(null);
    setIsProcessing(false);

    // Mostrar resultado final
    if (sucessos > 0 && erros === 0) {
      toast({
        title: '✅ PIX enviados com sucesso!',
        description: `${sucessos} pagamento(s) enviados para aprovação no Inter`,
      });
    } else if (sucessos > 0 && erros > 0) {
      toast({
        title: '⚠️ Processamento parcial',
        description: `${sucessos} enviados, ${erros} com erro`,
      });
    } else if (erros > 0) {
      toast({
        title: '❌ Erro no processamento',
        description: `${erros} pagamento(s) falharam`,
        variant: 'destructive',
      });
    }
  };

  // Função para pagar TODOS os agendados no Inter de uma vez
  const pagarAgendadosInter = async () => {
    // VALIDAÇÃO CRÍTICA: Verificar se o bar está selecionado
    if (!barId) {
      toast({
        title: '❌ Nenhum bar selecionado',
        description: 'Selecione um bar antes de processar pagamentos',
        variant: 'destructive',
      });
      return;
    }

    // VALIDAÇÃO CRÍTICA: Verificar se tem credenciais do Inter
    if (!credenciaisDisponiveis.inter) {
      toast({
        title: '❌ Credenciais Inter não configuradas',
        description: `O bar "${barNome}" não possui credenciais Inter (certificados PIX) configuradas. Configure antes de continuar.`,
        variant: 'destructive',
      });
      return;
    }

    if (!interCredencialSelecionadaId) {
      toast({
        title: '❌ Selecione a API Inter',
        description: 'Escolha qual conta Inter será usada para este pagamento',
        variant: 'destructive',
      });
      return;
    }

    const agendados = pagamentos.filter(p => p.status === 'agendado');
    
    if (agendados.length === 0) {
      toast({
        title: 'Nenhum pagamento agendado',
        description: 'Não há pagamentos com status "agendado" para processar',
        variant: 'destructive',
      });
      return;
    }

    // Verificar se todos os pagamentos são do bar atual
    const pagamentosOutroBar = agendados.filter(p => p.bar_id && p.bar_id !== barId);
    if (pagamentosOutroBar.length > 0) {
      toast({
        title: '⚠️ Pagamentos de outro bar detectados',
        description: `${pagamentosOutroBar.length} pagamento(s) pertencem a outro bar. Selecione o bar correto ou remova-os.`,
        variant: 'destructive',
      });
      return;
    }

    // Verificar se todos têm chave PIX
    const semChavePix = agendados.filter(p => !p.chave_pix);
    if (semChavePix.length > 0) {
      toast({
        title: 'Chave PIX faltando',
        description: `${semChavePix.length} pagamento(s) não possuem chave PIX cadastrada`,
        variant: 'destructive',
      });
      return;
    }

    setPagandoPixId('all'); // Indicador de que está processando todos
    let sucessos = 0;
    let erros = 0;

    toast({
      title: 'Iniciando processamento...',
      description: `Enviando ${agendados.length} pagamento(s) PIX para o Inter`,
    });

    for (const pagamento of agendados) {
      try {
        // Extrair valor numérico
        const valorLimpo = pagamento.valor.replace(/[^\d,.-]/g, '').replace(',', '.');
        const valorNumerico = parseFloat(valorLimpo);

        if (isNaN(valorNumerico) || valorNumerico <= 0) {
          throw new Error('Valor inválido para pagamento');
        }

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
            agendamento_id: pagamento.nibo_agendamento_id, // Para vincular o código de solicitação ao agendamento
          }),
        });

        const data = await response.json();

        if (data.success) {
          // Atualizar status do pagamento
          setPagamentos(prev =>
            prev.map(p =>
              p.id === pagamento.id
                ? {
                    ...p,
                    status: 'aguardando_aprovacao' as const,
                    inter_aprovacao_id: data.data?.codigoSolicitacao,
                    codigo_solic: data.data?.codigoSolicitacao,
                    updated_at: new Date().toISOString(),
                    atualizado_por_id: user?.auth_id,
                    atualizado_por_nome: user?.nome || user?.email || 'Usuário',
                  }
                : p
            )
          );
          sucessos++;
        } else {
          // Atualizar status para erro
          setPagamentos(prev =>
            prev.map(p =>
              p.id === pagamento.id
                ? { 
                    ...p, 
                    status: 'erro_inter' as const, 
                    updated_at: new Date().toISOString(),
                    atualizado_por_id: user?.auth_id,
                    atualizado_por_nome: user?.nome || user?.email || 'Usuário',
                  }
                : p
            )
          );
          erros++;
          console.error(`Erro ao enviar PIX para ${pagamento.nome_beneficiario}:`, data.error, data?.credencial || {});
        }
      } catch (error: any) {
        console.error(`Erro ao enviar PIX para ${pagamento.nome_beneficiario}:`, error);
        
        setPagamentos(prev =>
          prev.map(p =>
            p.id === pagamento.id
              ? { 
                  ...p, 
                  status: 'erro_inter' as const, 
                  updated_at: new Date().toISOString(),
                  atualizado_por_id: user?.auth_id,
                  atualizado_por_nome: user?.nome || user?.email || 'Usuário',
                }
              : p
          )
        );
        erros++;
      }

      // Pequeno delay entre requisições para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setPagandoPixId(null);

    if (erros === 0) {
      toast({
        title: '✅ Todos os PIX enviados!',
        description: `${sucessos} pagamento(s) enviados para aprovação no Inter`,
      });
    } else {
      toast({
        title: '⚠️ Processamento concluído com erros',
        description: `${sucessos} sucesso(s), ${erros} erro(s)`,
        variant: 'destructive',
      });
    }
  };

  // Função para processar dados colados automaticamente
  // ETAPA 2: Buscar stakeholders por nome no NIBO
  const buscarStakeholdersNibo = async (conta: 'Ordinário' | 'Deboche') => {
    if (dadosPlanilha.length === 0) {
      toast({
        title: 'Nenhum dado encontrado',
        description: 'Cole os dados na área acima antes de buscar stakeholders',
        variant: 'destructive',
      });
      return;
    }

    const bar_id = conta === 'Ordinário' ? 3 : 4;
    setIsProcessing(true);
    setLogsProcessamento([]);
    
    const adicionarLog = (tipo: 'sucesso' | 'erro' | 'info', mensagem: string) => {
      const timestamp = new Date().toLocaleTimeString();
      setLogsProcessamento(prev => [...prev, { timestamp, tipo, mensagem }]);
    };

    let encontrados = 0;
    let naoEncontrados = 0;
    const novasConfigs = { ...configuracoesIndividuais };

    adicionarLog('info', `Buscando stakeholders no NIBO para ${dadosPlanilha.length} beneficiários...`);

    try {
      for (let i = 0; i < dadosPlanilha.length; i++) {
        const linha = dadosPlanilha[i];
        const nome_beneficiario = linha[0]?.trim();
        const chave_pix = linha[1]?.trim(); // Pegar chave PIX para busca por CPF/CNPJ

        if (!nome_beneficiario) {
          adicionarLog('erro', `Linha ${i + 1}: Nome vazio`);
          naoEncontrados++;
          continue;
        }

        try {
          // Debug: mostrar o que está sendo enviado
          console.log(`[DEBUG] Buscando: nome="${nome_beneficiario}", chave_pix="${chave_pix}"`);
          
          const response = await fetch('/api/agendamento/buscar-stakeholder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: nome_beneficiario, chave_pix, bar_id }),
          });

          const data = await response.json();
          
          if (data.success && data.found) {
            // Salvar stakeholder_id na configuração da linha
            novasConfigs[i] = {
              ...novasConfigs[i],
              stakeholder_id: data.stakeholder.id,
              stakeholder_nome: data.stakeholder.name,
            };
            const matchInfo = data.matchType ? ` (${data.matchType})` : '';
            adicionarLog('sucesso', `${nome_beneficiario}: Encontrado como "${data.stakeholder.name}"${matchInfo}`);
            encontrados++;
          } else {
            // Não encontrou - criar automaticamente
            adicionarLog('info', `${nome_beneficiario}: Não encontrado, criando no NIBO...`);
            
            try {
              const createResponse = await fetch('/api/agendamento/criar-supplier', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome: nome_beneficiario, chave_pix, bar_id }),
              });

              const createData = await createResponse.json();
              
              if (createData.success) {
                novasConfigs[i] = {
                  ...novasConfigs[i],
                  stakeholder_id: createData.supplier.id,
                  stakeholder_nome: createData.supplier.name,
                };
                adicionarLog('sucesso', `${nome_beneficiario}: CRIADO no NIBO (ID: ${createData.supplier.id})`);
                encontrados++;
              } else {
                adicionarLog('erro', `${nome_beneficiario}: Erro ao criar - ${createData.error}`);
                naoEncontrados++;
              }
            } catch (createError) {
              adicionarLog('erro', `${nome_beneficiario}: Erro ao criar supplier`);
              naoEncontrados++;
            }
          }
        } catch (error) {
          adicionarLog('erro', `${nome_beneficiario}: Erro de comunicação`);
          naoEncontrados++;
        }

        // Pequena pausa entre requests
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      setConfiguracoesIndividuais(novasConfigs);
      
      adicionarLog('info', `Busca concluída: ${encontrados} encontrados, ${naoEncontrados} não encontrados`);

      toast({
        title: 'Busca de stakeholders concluída',
        description: `${encontrados} encontrados, ${naoEncontrados} não encontrados`,
        variant: naoEncontrados > 0 ? 'destructive' : undefined,
      });

    } catch (error) {
      adicionarLog('erro', `Erro geral: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ETAPA 3: Agendar no NIBO (sem PIX)
  const agendarNoNibo = async (conta: 'Ordinário' | 'Deboche') => {
    if (dadosPlanilha.length === 0) {
      toast({
        title: 'Nenhum dado encontrado',
        description: 'Cole os dados na área acima antes de agendar',
        variant: 'destructive',
      });
      return;
    }

    // Verificar se todas as linhas têm categoria E stakeholder
    const linhasIncompletas = dadosPlanilha.filter((_, index) => {
      const config = configuracoesIndividuais[index];
      return !config?.categoria_id || !config?.stakeholder_id;
    });

    if (linhasIncompletas.length > 0) {
      toast({
        title: 'Configurações incompletas',
        description: `${linhasIncompletas.length} linha(s) sem categoria ou stakeholder. Execute as etapas anteriores.`,
        variant: 'destructive',
      });
      return;
    }

    const bar_id = conta === 'Ordinário' ? 3 : 4;
    setIsProcessing(true);
    setLogsProcessamento([]);
    
    const adicionarLog = (tipo: 'sucesso' | 'erro' | 'info', mensagem: string) => {
      const timestamp = new Date().toLocaleTimeString();
      setLogsProcessamento(prev => [...prev, { timestamp, tipo, mensagem }]);
    };

    let sucessos = 0;
    let erros = 0;

    adicionarLog('info', `Agendando ${dadosPlanilha.length} pagamentos no NIBO para conta "${conta}"`);

    try {
      for (let i = 0; i < dadosPlanilha.length; i++) {
        const linha = dadosPlanilha[i];
        const [nome_beneficiario, chave_pix, valor, descricao, data_pagamento, data_competencia] = linha;
        const config = configuracoesIndividuais[i];

        // Validações básicas
        if (!valor?.trim()) {
          adicionarLog('erro', `Linha ${i + 1} (${nome_beneficiario}): Valor vazio`);
          erros++;
          continue;
        }

        try {
          const response = await fetch('/api/agendamento/agendar-nibo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stakeholder_id: config.stakeholder_id,
              stakeholder_nome: config.stakeholder_nome || nome_beneficiario,
              nome_beneficiario: nome_beneficiario?.trim(),
              valor: valor?.trim(),
              descricao: descricao?.trim() || '',
              data_pagamento: data_pagamento?.trim() || '',
              data_competencia: data_competencia?.trim() || '',
              categoria_id: config.categoria_id,
              centro_custo_id: config.centro_custo_id,
              bar_id,
            }),
          });

          const data = await response.json();
          
          if (data.success) {
            adicionarLog('sucesso', `${nome_beneficiario}: Agendado no NIBO (${data.nibo_id})`);
            sucessos++;
          } else {
            adicionarLog('erro', `${nome_beneficiario}: ${data.error}`);
            erros++;
          }
        } catch (error) {
          adicionarLog('erro', `${nome_beneficiario}: Erro de comunicação`);
          erros++;
        }

        // Pequena pausa entre requests
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      setStatusProcessamento({
        aba: conta,
        totalLinhas: dadosPlanilha.length,
        sucessos,
        erros,
      });

      adicionarLog('info', `Agendamento NIBO concluído: ${sucessos} sucessos, ${erros} erros`);

      toast({
        title: 'Agendamento NIBO concluído!',
        description: `${sucessos} agendamentos criados, ${erros} erros`,
        variant: erros > 0 ? 'destructive' : undefined,
      });

    } catch (error) {
      adicionarLog('erro', `Erro geral: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ETAPA 4: Enviar PIX (opcional, separado) - usa a API antiga
  const processarDadosAutomatico = async (conta: 'Ordinário' | 'Deboche') => {
    if (dadosPlanilha.length === 0) {
      toast({
        title: 'Nenhum dado encontrado',
        description: 'Cole os dados na área acima antes de processar',
        variant: 'destructive',
      });
      return;
    }

    // Verificar se todas as linhas têm categoria configurada (centro de custo é opcional)
    const linhasSemConfiguracao = dadosPlanilha.filter((_, index) => 
      !configuracoesIndividuais[index]?.categoria_id
    );

    if (linhasSemConfiguracao.length > 0) {
      toast({
        title: 'Configurações incompletas',
        description: `${linhasSemConfiguracao.length} linha(s) sem categoria configurada`,
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    setLogsProcessamento([]);
    
    const adicionarLog = (tipo: 'sucesso' | 'erro' | 'info', mensagem: string) => {
      const timestamp = new Date().toLocaleTimeString();
      setLogsProcessamento(prev => [...prev, { timestamp, tipo, mensagem }]);
    };

    let sucessos = 0;
    let erros = 0;

    adicionarLog('info', `Iniciando processamento de ${dadosPlanilha.length} linhas para conta "${conta}"`);

    try {
      for (let i = 0; i < dadosPlanilha.length; i++) {
        const linha = dadosPlanilha[i];
        
        // Validar se a linha tem dados suficientes
        if (linha.length < 6) {
          adicionarLog('erro', `Linha ${i + 1}: Dados insuficientes (${linha.length} colunas, esperado 6)`);
          erros++;
          continue;
        }

        const [nome_beneficiario, chave_pix, valor, descricao, data_pagamento, data_competencia] = linha;

        // Validações básicas
        if (!chave_pix?.trim()) {
          adicionarLog('erro', `Linha ${i + 1}: Chave PIX vazia`);
          erros++;
          continue;
        }

        if (!nome_beneficiario?.trim()) {
          adicionarLog('erro', `Linha ${i + 1}: Nome do beneficiário vazio`);
          erros++;
          continue;
        }

        if (!valor?.trim()) {
          adicionarLog('erro', `Linha ${i + 1}: Valor vazio`);
          erros++;
          continue;
        }

        try {
          // Obter configurações individuais desta linha
          const configLinha = configuracoesIndividuais[i];
          
          // Apenas categoria_id é obrigatório, centro_custo_id é opcional
          if (!configLinha?.categoria_id) {
            adicionarLog('erro', `Linha ${i + 1}: Categoria não configurada`);
            erros++;
            continue;
          }

          // Chamar API para processar o agendamento + pagamento
          const response = await fetch('/api/agendamento/processar-automatico', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conta,
              chave_pix: chave_pix.trim(),
              nome_beneficiario: nome_beneficiario.trim(),
              valor: valor.trim(),
              descricao: descricao?.trim() || '',
              data_pagamento: data_pagamento?.trim() || '',
              data_competencia: data_competencia?.trim() || '',
              categoria_id: configLinha.categoria_id,
              centro_custo_id: configLinha.centro_custo_id,
            }),
          });

          const data = await response.json();
          
          if (data.success) {
            adicionarLog('sucesso', `${nome_beneficiario}: R$ ${valor} - Agendamento NIBO + PIX processados com sucesso`);
            if (data.detalhes) {
              adicionarLog('info', `  → Bar: ${data.detalhes.conta} (ID: ${data.detalhes.bar_id}) | NIBO: ${data.detalhes.agendamento_nibo} | PIX: ${data.detalhes.codigo_pix}`);
            }
            sucessos++;
          } else {
            adicionarLog('erro', `${nome_beneficiario}: ${data.error || 'Erro desconhecido'}`);
            erros++;
          }
        } catch (error) {
          adicionarLog('erro', `${nome_beneficiario}: Erro de comunicação - ${error}`);
          erros++;
        }

        // Pequena pausa entre requests para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Atualizar status final
      setStatusProcessamento({
        aba: conta,
        totalLinhas: dadosPlanilha.length,
        sucessos,
        erros,
      });

      adicionarLog('info', `Processamento concluído: ${sucessos} sucessos, ${erros} erros`);

      toast({
        title: '🎉 Processamento concluído!',
        description: `${sucessos} pagamentos processados com sucesso, ${erros} erros`,
      });

    } catch (error) {
      adicionarLog('erro', `Erro geral no processamento: ${error}`);
      toast({
        title: 'Erro no processamento',
        description: 'Ocorreu um erro durante o processamento dos dados',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ProtectedRoute requiredModule="financeiro">
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-2 py-4 max-w-[98vw]">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-muted rounded-xl w-fit">
                <Wrench className="w-6 h-6 text-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Ferramenta de Agendamento
                </h1>
                <p className="text-muted-foreground">
                  Gerencie agendamentos de pagamentos PIX com integração NIBO e Inter
                </p>
                {lastSave && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    Último salvamento: {lastSave}
                  </p>
                )}
              </div>
            </div>

            {/* Indicador de bar ativo - só mostra se tudo estiver ok */}
            {barId && credenciaisDisponiveis.verificado && credenciaisDisponiveis.nibo && credenciaisDisponiveis.inter && (
              <div className="mt-4 p-3 bg-muted/40 border border-border rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-foreground" />
                  <span className="text-sm text-foreground font-medium">
                    Bar ativo: {barNome} - Credenciais NIBO e Inter configuradas
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar com Métricas */}
            <div className="w-full lg:w-80 flex-shrink-0">
              <Card className="card-dark shadow-sm lg:sticky lg:top-6">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">
                    Resumo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {credenciaisDisponiveis.inter && (
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">
                        API Inter para pagamento
                      </Label>
                      <SelectWithSearch
                        value={interCredencialSelecionadaId}
                        onValueChange={(value) => setInterCredencialSelecionadaId(value || '')}
                        placeholder="Selecione a credencial Inter"
                        options={interCredenciais.map((cred) => ({
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
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Total
                      </span>
                    </div>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      {metricas.total}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <Clock className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">
                        Pendentes
                      </span>
                    </div>
                    <span className="text-lg font-bold text-foreground">
                      {metricas.pendentes}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <Calendar className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">
                        Agendados
                      </span>
                    </div>
                    <span className="text-lg font-bold text-foreground">
                      {metricas.agendados}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <Clock className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">
                        Aguardando Aprovação
                      </span>
                    </div>
                    <span className="text-lg font-bold text-foreground">
                      {metricas.aguardandoAprovacao}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <CheckCircle className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">
                        Aprovados
                      </span>
                    </div>
                    <span className="text-lg font-bold text-foreground">
                      {metricas.aprovados}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <AlertCircle className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">
                        Erros
                      </span>
                    </div>
                    <span className="text-lg font-bold text-foreground">
                      {metricas.erros}
                    </span>
                  </div>

                  {/* Botões de Ação */}
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
                    {/* Botão principal: PIX Direto (sem NIBO) */}
                    <Button
                      onClick={pagarPendentesInterDireto}
                      disabled={isProcessing || pagandoPixId !== null || metricas.pendentes === 0 || !credenciaisDisponiveis.inter || !barId || !interCredencialSelecionadaId}
                      variant="outline"
                      className="w-full"
                      title={!credenciaisDisponiveis.inter ? 'Credenciais Inter não configuradas' : 'Enviar PIX direto sem passar pelo NIBO'}
                    >
                      {pagandoPixId === 'direct' ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Enviando PIX...
                        </>
                      ) : (
                        <>
                          <Banknote className="w-4 h-4 mr-2" />
                          PIX Direto ({metricas.pendentes} pendentes)
                        </>
                      )}
                    </Button>

                    {/* Separador */}
                    <div className="relative py-2">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                      </div>
                      <div className="relative flex justify-center">
                        <span className="px-2 bg-white dark:bg-gray-800 text-xs text-gray-500">ou via NIBO</span>
                      </div>
                    </div>

                    <Button
                      onClick={agendarPagamentos}
                      disabled={isProcessing || metricas.pendentes === 0 || !barId}
                      className="w-full btn-primary"
                      title={!credenciaisDisponiveis.nibo ? 'Agendamentos serão salvos localmente (NIBO não configurado)' : ''}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {credenciaisDisponiveis.nibo ? 'Agendar no NIBO' : 'Agendar (Local)'}
                    </Button>
                    <Button
                      onClick={pagarAgendadosInter}
                      disabled={isProcessing || pagandoPixId !== null || metricas.agendados === 0 || !credenciaisDisponiveis.inter || !barId || !interCredencialSelecionadaId}
                      variant="outline"
                      className="w-full"
                      title={!credenciaisDisponiveis.inter ? 'Credenciais Inter não configuradas para este bar' : ''}
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

            {/* Conteúdo Principal */}
            <div className="flex-1">
              {/* Bloquear tudo se não houver bar ou credenciais */}
              {/* Estado de loading enquanto verifica credenciais */}
              {!credenciaisDisponiveis.verificado ? (
                <Card className="card-dark border-0 shadow-lg">
                  <CardContent className="py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin" />
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        Verificando credenciais...
                      </h2>
                      <p className="text-gray-600 dark:text-gray-400">
                        Aguarde enquanto verificamos as configurações do bar selecionado.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (!barId) ? (
                <Card className="card-dark border-0 shadow-lg">
                  <CardContent className="py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full">
                        <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
                      </div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        Nenhum bar selecionado
                      </h2>
                      <p className="text-gray-600 dark:text-gray-400 max-w-md">
                        Selecione um bar no menu superior para começar a usar a ferramenta de agendamento.
                      </p>
                      {barId && (
                        <div className="flex flex-col gap-2 text-sm">
                          <div className={`flex items-center gap-2 ${credenciaisDisponiveis.nibo ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                            {credenciaisDisponiveis.nibo ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                            <span>NIBO: {credenciaisDisponiveis.nibo ? 'Configurado' : 'Não configurado (agendamento local)'}</span>
                          </div>
                          <div className={`flex items-center gap-2 ${credenciaisDisponiveis.inter ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                            {credenciaisDisponiveis.inter ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                            <span>Inter (PIX): {credenciaisDisponiveis.inter ? 'Configurado' : 'Não configurado'}</span>
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                        Entre em contato com o administrador para configurar as credenciais faltantes.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
              /* Tabs de Funcionalidades */
              <Tabs value={tabAtivo} onValueChange={setTabAtivo} className="space-y-6">
                <TabsList className="grid w-full grid-cols-4 bg-muted/70 border border-border p-1 rounded-lg">
                  <TabsTrigger
                    value="manual"
                    className="data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:border data-[state=active]:border-border/70 dark:text-gray-300 rounded-md"
                  >
                    Adicionar Manual
                  </TabsTrigger>
                  <TabsTrigger
                    value="automatico"
                    className="data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:border data-[state=active]:border-border/70 dark:text-gray-300 rounded-md"
                  >
                    Agendamento Automático
                  </TabsTrigger>
                  <TabsTrigger
                    value="lista"
                    className="data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:border data-[state=active]:border-border/70 dark:text-gray-300 rounded-md"
                  >
                    Lista de Pagamentos
                  </TabsTrigger>
                  <TabsTrigger
                    value="revisao"
                    className="data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:border data-[state=active]:border-border/70 dark:text-gray-300 rounded-md"
                  >
                    Revisão NIBO
                  </TabsTrigger>
                </TabsList>

                {/* Tab: Adicionar Manual */}
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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label
                            htmlFor="cpf_cnpj"
                            className="text-gray-700 dark:text-gray-300"
                          >
                            CPF/CNPJ *
                          </Label>
                          <div className="flex gap-2 mt-1">
                            <Input
                              id="cpf_cnpj"
                              value={novoPagamento.cpf_cnpj}
                              onChange={e =>
                                setNovoPagamento(prev => ({
                                  ...prev,
                                  cpf_cnpj: formatarDocumento(e.target.value),
                                }))
                              }
                              placeholder="000.000.000-00 ou 00.000.000/0000-00"
                              className="flex-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                            />
                            <button
                              onClick={() =>
                                buscarStakeholder(novoPagamento.cpf_cnpj)
                              }
                              type="button"
                              className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                            >
                              <Search className="w-4 h-4" />
                              <span>Buscar</span>
                            </button>
                          </div>
                        </div>
                        <div>
                          <Label
                            htmlFor="nome"
                            className="text-gray-700 dark:text-gray-300"
                          >
                            Nome do Beneficiário *
                          </Label>
                          <Input
                            id="nome"
                            value={novoPagamento.nome_beneficiario}
                            onChange={e =>
                              setNovoPagamento(prev => ({
                                ...prev,
                                nome_beneficiario: e.target.value,
                              }))
                            }
                            placeholder="Nome completo"
                            className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                          />
                        </div>
                        <div>
                          <Label
                            htmlFor="chave_pix"
                            className="text-gray-700 dark:text-gray-300"
                          >
                            Chave PIX
                          </Label>
                          <Input
                            id="chave_pix"
                            value={novoPagamento.chave_pix}
                            onChange={e =>
                              setNovoPagamento(prev => ({
                                ...prev,
                                chave_pix: e.target.value,
                              }))
                            }
                            placeholder="CPF, CNPJ, email ou telefone"
                            className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                          />
                        </div>
                        <div>
                          <Label
                            htmlFor="valor"
                            className="text-gray-700 dark:text-gray-300"
                          >
                            Valor *
                          </Label>
                          <Input
                            id="valor"
                            value={novoPagamento.valor}
                            onChange={e =>
                              setNovoPagamento(prev => ({
                                ...prev,
                                valor: e.target.value,
                              }))
                            }
                            placeholder="R$ 0,00"
                            className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                          />
                        </div>
                        <div>
                          <Label
                            htmlFor="data_pagamento"
                            className="text-gray-700 dark:text-gray-300"
                          >
                            Data de Pagamento *
                          </Label>
                          <Input
                            id="data_pagamento"
                            type="date"
                            value={novoPagamento.data_pagamento}
                            onChange={e =>
                              setNovoPagamento(prev => ({
                                ...prev,
                                data_pagamento: e.target.value,
                              }))
                            }
                            className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <Label
                            htmlFor="data_competencia"
                            className="text-gray-700 dark:text-gray-300"
                          >
                            Data de Competência
                          </Label>
                          <Input
                            id="data_competencia"
                            type="date"
                            value={novoPagamento.data_competencia}
                            onChange={e =>
                              setNovoPagamento(prev => ({
                                ...prev,
                                data_competencia: e.target.value,
                              }))
                            }
                            className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                      
                      {/* Campo obrigatório: Categoria (centro de custo é opcional) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label
                            htmlFor="categoria"
                            className="text-gray-700 dark:text-gray-300"
                          >
                            Categoria *
                          </Label>
                          <SelectWithSearch
                            value={novoPagamento.categoria_id}
                            onValueChange={(value) =>
                              setNovoPagamento(prev => ({
                                ...prev,
                                categoria_id: value || '',
                              }))
                            }
                            placeholder="Selecione uma categoria"
                            options={categorias.map(cat => ({
                              value: cat.id,
                              label: cat.categoria_nome,
                            }))}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label
                            htmlFor="centro_custo"
                            className="text-gray-700 dark:text-gray-300"
                          >
                            Centro de Custo (opcional)
                          </Label>
                          <SelectWithSearch
                            value={novoPagamento.centro_custo_id}
                            onValueChange={(value) =>
                              setNovoPagamento(prev => ({
                                ...prev,
                                centro_custo_id: value || '',
                              }))
                            }
                            placeholder="Selecione um centro de custo"
                            options={centrosCusto.map(cc => ({
                              value: cc.id,
                              label: cc.nome,
                            }))}
                            className="mt-1"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label
                          htmlFor="descricao"
                          className="text-gray-700 dark:text-gray-300"
                        >
                          Descrição
                        </Label>
                        <Textarea
                          id="descricao"
                          value={novoPagamento.descricao}
                          onChange={e =>
                            setNovoPagamento(prev => ({
                              ...prev,
                              descricao: e.target.value,
                            }))
                          }
                          placeholder="Descrição do pagamento"
                          className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        />
                      </div>
                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={adicionarPagamento}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Adicionar à Lista</span>
                        </button>
                        <button 
                          onClick={limparLista} 
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg font-medium transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Limpar Lista</span>
                        </button>
                        <button
                          onClick={abrirModalFolha}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          <span>Pagar Folha</span>
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab: Agendamento Automático */}
                <TabsContent value="automatico">
                  <Card className="card-dark border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-gray-900 dark:text-white">
                        Agendamento Automático
                      </CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-400">
                        Cole dados diretamente do Excel/Sheets (Ctrl+C/Ctrl+V) e processe automaticamente
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Instruções */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                        <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
                          📋 Como usar
                        </h3>
                        <div className="text-xs text-blue-600 dark:text-blue-500 space-y-1">
                          <div>1. <strong>Copie</strong> os dados do Excel/Sheets (selecione as linhas e Ctrl+C)</div>
                          <div>2. <strong>Cole</strong> na área abaixo (clique e Ctrl+V)</div>
                          <div>3. <strong>Configure</strong> categoria e centro de custo</div>
                          <div>4. <strong>Processe</strong> - cria agendamento no NIBO + envia pagamento PIX</div>
                        </div>
                      </div>

                      {/* Área de Cole dos Dados */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-gray-700 dark:text-gray-300 font-medium">
                            Área de Dados (Cole aqui com Ctrl+V)
                          </Label>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setDadosPlanilha([])}
                              className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg font-medium transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Limpar</span>
                            </button>
                            <button
                              onClick={() => setModoEdicaoPlanilha(!modoEdicaoPlanilha)}
                              className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg font-medium transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                              <span>{modoEdicaoPlanilha ? 'Visualizar' : 'Editar'}</span>
                            </button>
                          </div>
                        </div>

                        <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                          <textarea
                            className="w-full h-32 p-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono resize-none border-0 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                            placeholder="Cole os dados aqui (Ctrl+V)&#10;Formato esperado:&#10;nome_beneficiario	chave_pix	valor	descricao	data_pagamento	data_competencia&#10;João Silva	11999999999	100,00	Pagamento teste	01/01/2024	01/01/2024"
                            value={dadosPlanilha.map(row => row.join('\t')).join('\n')}
                            onChange={(e) => {
                              const linhas = e.target.value.split('\n').filter(linha => linha.trim());
                              // Limpar cada célula de espaços extras
                              const dados = linhas.map(linha => 
                                linha.split('\t').map(celula => celula.trim())
                              );
                              setDadosPlanilha(dados);
                            }}
                            onPaste={(e) => {
                              e.preventDefault();
                              const texto = e.clipboardData.getData('text');
                              let linhas = texto.split('\n').filter(linha => linha.trim());
                              
                              // Verificar se a primeira linha é cabeçalho e pular
                              if (linhas.length > 0) {
                                const primeiraLinha = linhas[0].toLowerCase();
                                if (primeiraLinha.includes('nome_beneficiario') || 
                                    primeiraLinha.includes('chave_pix') ||
                                    primeiraLinha.includes('beneficiario') ||
                                    primeiraLinha.includes('nome') && primeiraLinha.includes('pix')) {
                                  linhas = linhas.slice(1); // Pular cabeçalho
                                }
                              }
                              
                              // Limpar cada célula de espaços extras e caracteres invisíveis
                              const dados = linhas.map(linha => 
                                linha.split('\t').map(celula => celula.trim())
                              );
                              setDadosPlanilha(dados);
                            }}
                          />
                        </div>

                        {/* Preview da Planilha */}
                        {dadosPlanilha.length > 0 && (
                          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                Preview dos Dados ({dadosPlanilha.length} linhas)
                              </h4>
                              
                              {/* Botões de Configuração */}
                              <div className="flex gap-2">
                                {/* Botão Auto-configurar por Descrição */}
                                <button
                                  onClick={() => {
                                    // Mapeamento de descrições para categorias do NIBO (Ordinário)
                                    // IDs corretos baseados no histórico de agendamentos
                                    const mapeamentoDescricaoCategoria: Record<string, string> = {
                                      'SALARIO': 'a8172f9d-4e62-401e-87d0-4612e2bba698', // SALARIO FUNCIONARIOS (ID correto do histórico)
                                      'SALÁRIO': 'a8172f9d-4e62-401e-87d0-4612e2bba698',
                                      'COMISSAO': '1de3a811-276f-46c5-8897-c9e12c6d1798', // COMISSÃO 10%
                                      'COMISSÃO': '1de3a811-276f-46c5-8897-c9e12c6d1798',
                                    };
                                    
                                    const novasConfiguracoes: { [key: number]: { categoria_id: string; centro_custo_id: string } } = {};
                                    let configurados = 0;
                                    let naoEncontrados = 0;
                                    
                                    dadosPlanilha.forEach((linha, index) => {
                                      const descricao = (linha[3] || '').toUpperCase().trim();
                                      const categoriaId = mapeamentoDescricaoCategoria[descricao];
                                      
                                      if (categoriaId) {
                                        novasConfiguracoes[index] = {
                                          categoria_id: categoriaId,
                                          centro_custo_id: configuracoesIndividuais[index]?.centro_custo_id || ''
                                        };
                                        configurados++;
                                      } else {
                                        novasConfiguracoes[index] = {
                                          categoria_id: configuracoesIndividuais[index]?.categoria_id || '',
                                          centro_custo_id: configuracoesIndividuais[index]?.centro_custo_id || ''
                                        };
                                        naoEncontrados++;
                                      }
                                    });
                                    
                                    setConfiguracoesIndividuais(novasConfiguracoes);
                                    
                                    toast({
                                      title: '✅ Auto-configuração concluída',
                                      description: `${configurados} linha(s) com SALARIO/COMISSAO configuradas automaticamente${naoEncontrados > 0 ? `. ${naoEncontrados} linha(s) com descrição diferente.` : ''}`,
                                    });
                                  }}
                                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                  <span>Auto-configurar</span>
                                </button>
                                
                                {/* Botão Configurar Manualmente */}
                                <button
                                  onClick={() => setModalConfiguracoes(true)}
                                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                  <Wrench className="w-4 h-4" />
                                  <span>Configurar Manual</span>
                                </button>
                              </div>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-gray-100 dark:bg-gray-700">
                                    <th className="p-3 text-left text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600">Nome</th>
                                    <th className="p-3 text-left text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600">Chave PIX</th>
                                    <th className="p-3 text-left text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600">Valor</th>
                                    <th className="p-3 text-left text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600">Descrição</th>
                                    <th className="p-3 text-left text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600">Data Pgto</th>
                                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">Data Comp</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {dadosPlanilha.slice(0, 10).map((linha, index) => (
                                    <tr key={index} className="border-b border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                      <td className="p-3 text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-600 text-sm">{linha[0] || '-'}</td>
                                      <td className="p-3 text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-600 text-sm font-mono">{linha[1] || '-'}</td>
                                      <td className="p-3 text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-600 text-sm font-semibold">{linha[2] || '-'}</td>
                                      <td className="p-3 text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-600 text-sm">{linha[3] || '-'}</td>
                                      <td className="p-3 text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-600 text-sm">{linha[4] || '-'}</td>
                                      <td className="p-3 text-gray-900 dark:text-white text-sm">{linha[5] || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {dadosPlanilha.length > 10 && (
                                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 text-center">
                                  ... e mais {dadosPlanilha.length - 10} linhas
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>


                      {/* Etapas de Processamento */}
                      {dadosPlanilha.length > 0 && (
                        <div className="space-y-4">
                          {/* Status das Etapas */}
                          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
                              Status das Etapas
                            </h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-gray-600 dark:text-gray-400">1. Categorias configuradas:</span>
                                {(() => {
                                  const configuradas = dadosPlanilha.filter((_, i) => configuracoesIndividuais[i]?.categoria_id).length;
                                  return (
                                    <span className={`font-medium ${configuradas === dadosPlanilha.length ? 'text-green-600' : 'text-yellow-600'}`}>
                                      {configuradas}/{dadosPlanilha.length}
                                    </span>
                                  );
                                })()}
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-gray-600 dark:text-gray-400">2. Stakeholders encontrados:</span>
                                {(() => {
                                  const encontrados = dadosPlanilha.filter((_, i) => configuracoesIndividuais[i]?.stakeholder_id).length;
                                  return (
                                    <span className={`font-medium ${encontrados === dadosPlanilha.length ? 'text-green-600' : encontrados > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
                                      {encontrados}/{dadosPlanilha.length}
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>

                          {/* ETAPA 2: Buscar Stakeholders */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                              onClick={() => buscarStakeholdersNibo('Ordinário')}
                              disabled={isProcessing}
                              className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white h-12 flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isProcessing ? (
                                <RefreshCw className="w-5 h-5 animate-spin" />
                              ) : (
                                <Search className="w-5 h-5" />
                              )}
                              <span>2. Buscar Stakeholders (Ordinário)</span>
                            </button>

                            <button
                              onClick={() => buscarStakeholdersNibo('Deboche')}
                              disabled={isProcessing}
                              className="bg-purple-100 hover:bg-purple-200 dark:bg-purple-900 dark:hover:bg-purple-800 text-purple-900 dark:text-purple-100 border border-purple-300 dark:border-purple-700 h-12 flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isProcessing ? (
                                <RefreshCw className="w-5 h-5 animate-spin" />
                              ) : (
                                <Search className="w-5 h-5" />
                              )}
                              <span>2. Buscar Stakeholders (Deboche)</span>
                            </button>
                          </div>

                          {/* ETAPA 3: Agendar no NIBO */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                              onClick={() => agendarNoNibo('Ordinário')}
                              disabled={isProcessing || dadosPlanilha.some((_, index) => 
                                !configuracoesIndividuais[index]?.categoria_id || !configuracoesIndividuais[index]?.stakeholder_id
                              )}
                              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white h-12 flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isProcessing ? (
                                <RefreshCw className="w-5 h-5 animate-spin" />
                              ) : (
                                <Calendar className="w-5 h-5" />
                              )}
                              <span>3. Agendar no NIBO (Ordinário)</span>
                            </button>

                            <button
                              onClick={() => agendarNoNibo('Deboche')}
                              disabled={isProcessing || dadosPlanilha.some((_, index) => 
                                !configuracoesIndividuais[index]?.categoria_id || !configuracoesIndividuais[index]?.stakeholder_id
                              )}
                              className="bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-900 dark:text-blue-100 border border-blue-300 dark:border-blue-700 h-12 flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isProcessing ? (
                                <RefreshCw className="w-5 h-5 animate-spin" />
                              ) : (
                                <Calendar className="w-5 h-5" />
                              )}
                              <span>3. Agendar no NIBO (Deboche)</span>
                            </button>
                          </div>

                          {/* ETAPA 4: Enviar PIX (Opcional) */}
                          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                              Etapa opcional: Envia PIX pelo Banco Inter (NIBO + PIX de uma vez)
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <button
                                onClick={() => processarDadosAutomatico('Ordinário')}
                                disabled={isProcessing || dadosPlanilha.some((_, index) => 
                                  !configuracoesIndividuais[index]?.categoria_id
                                )}
                                className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white h-12 flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isProcessing ? (
                                  <RefreshCw className="w-5 h-5 animate-spin" />
                                ) : (
                                  <Banknote className="w-5 h-5" />
                                )}
                                <span>4. NIBO + PIX (Ordinário)</span>
                              </button>

                              <button
                                onClick={() => processarDadosAutomatico('Deboche')}
                                disabled={isProcessing || dadosPlanilha.some((_, index) => 
                                  !configuracoesIndividuais[index]?.categoria_id
                                )}
                                className="bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 text-green-900 dark:text-green-100 border border-green-300 dark:border-green-700 h-12 flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isProcessing ? (
                                  <RefreshCw className="w-5 h-5 animate-spin" />
                                ) : (
                                  <Banknote className="w-5 h-5" />
                                )}
                                <span>4. NIBO + PIX (Deboche)</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Status do Processamento */}
                      {statusProcessamento && (
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                          <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                            Status do Processamento
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Conta processada:</span>
                              <span className="font-medium text-gray-900 dark:text-white">{statusProcessamento.aba}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Linhas encontradas:</span>
                              <span className="font-medium text-gray-900 dark:text-white">{statusProcessamento.totalLinhas}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Pagamentos processados:</span>
                              <span className="font-medium text-green-600 dark:text-green-400">{statusProcessamento.sucessos}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Erros encontrados:</span>
                              <span className="font-medium text-red-600 dark:text-red-400">{statusProcessamento.erros}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Logs do Processamento */}
                      {logsProcessamento.length > 0 && (
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                          <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
                            Logs do Processamento
                          </h4>
                          <div className="max-h-64 overflow-y-auto space-y-2">
                            {logsProcessamento.map((log, index) => (
                              <div
                                key={index}
                                className={`text-xs p-2 rounded ${
                                  log.tipo === 'sucesso'
                                    ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                                    : log.tipo === 'erro'
                                    ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                                    : 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
                                }`}
                              >
                                <span className="font-medium">[{log.timestamp}]</span> {log.mensagem}
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={() => setLogsProcessamento([])}
                            className="mt-3 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg font-medium transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Limpar Logs</span>
                          </button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab: Lista de Pagamentos */}
                <TabsContent value="lista">
                  <Card className="card-dark border-0 shadow-lg">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-gray-900 dark:text-white">
                            Lista de Pagamentos
                          </CardTitle>
                          <CardDescription className="text-gray-600 dark:text-gray-400">
                            {pagamentos.length} pagamento(s) na lista
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {pagamentos.length === 0 ? (
                        <div className="text-center py-12">
                          <FileText className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                          <p className="text-gray-500 dark:text-gray-400">
                            Nenhum pagamento na lista
                          </p>
                          <p className="text-sm text-gray-400 dark:text-gray-500">
                            Adicione pagamentos manualmente para começar
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {pagamentos.map(pagamento => (
                            <div
                              key={pagamento.id}
                              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="font-medium text-gray-900 dark:text-white">
                                    {pagamento.nome_beneficiario}
                                  </h3>
                                  {getStatusBadge(pagamento.status)}
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600 dark:text-gray-400">
                                  <div>
                                    <span className="font-medium">
                                      CPF/CNPJ:
                                    </span>{' '}
                                    {pagamento.cpf_cnpj
                                      ? formatarDocumento(pagamento.cpf_cnpj)
                                      : 'Não informado'}
                                  </div>
                                  <div>
                                    <span className="font-medium">Valor:</span>{' '}
                                    {pagamento.valor}
                                  </div>
                                  <div>
                                    <span className="font-medium">Data:</span>{' '}
                                    {new Date(
                                      pagamento.data_pagamento
                                    ).toLocaleDateString('pt-BR')}
                                  </div>
                                  <div>
                                    <span className="font-medium">
                                      Chave PIX:
                                    </span>{' '}
                                    {pagamento.chave_pix || 'Não informada'}
                                  </div>
                                </div>
                                {/* Segunda linha: Categoria, Centro de Custo, Bar, Usuário */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600 dark:text-gray-400 mt-2">
                                  <div>
                                    <span className="font-medium">Categoria:</span>{' '}
                                    {pagamento.categoria_nome || 'N/A'}
                                  </div>
                                  <div>
                                    <span className="font-medium">Centro de Custo:</span>{' '}
                                    {pagamento.centro_custo_nome || 'N/A'}
                                  </div>
                                  <div className={pagamento.bar_id && pagamento.bar_id !== barId ? 'text-orange-600 dark:text-orange-400 font-semibold' : ''}>
                                    <span className="font-medium">Bar:</span>{' '}
                                    {pagamento.bar_nome || 'Não definido'}
                                    {pagamento.bar_id && pagamento.bar_id !== barId && (
                                      <span className="ml-2 text-xs bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 px-1 rounded">
                                        Bar diferente!
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {pagamento.descricao && (
                                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                    <span className="font-medium">
                                      Descrição:
                                    </span>{' '}
                                    {pagamento.descricao}
                                  </div>
                                )}
                                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-500 grid grid-cols-2 gap-1">
                                  <div>
                                    <span className="font-medium">Criado:</span>{' '}
                                    {new Date(pagamento.created_at).toLocaleString('pt-BR')}
                                  </div>
                                  <div>
                                    <span className="font-medium">Criado por:</span>{' '}
                                    {pagamento.criado_por_nome || 'Não registrado'}
                                  </div>
                                  <div>
                                    <span className="font-medium">Atualizado:</span>{' '}
                                    {new Date(pagamento.updated_at).toLocaleString('pt-BR')}
                                  </div>
                                  <div>
                                    <span className="font-medium">Atualizado por:</span>{' '}
                                    {pagamento.atualizado_por_nome || 'Não registrado'}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-4">
                                <Button
                                  onClick={() => removerPagamento(pagamento.id)}
                                  size="sm"
                                  className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white h-8 w-8 p-0 rounded-lg shadow-sm"
                                  title="Remover pagamento"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab: Revisão NIBO - sem data_competencia */}
                <TabsContent value="revisao">
                  <Card className="card-dark border-0 shadow-lg">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-gray-900 dark:text-white">
                            Agendamentos sem data de competência
                          </CardTitle>
                          <CardDescription className="text-gray-600 dark:text-gray-400">
                            {revisaoTotal > 0 ? `${agendamentosSemCompetencia.length} de ${revisaoTotal} carregado(s)` : 'Lista para o financeiro revisar e preencher data de competência no NIBO'}
                          </CardDescription>
                        </div>
                        <Button
                          onClick={() => carregarRevisaoNIBO(0)}
                          disabled={loadingRevisao}
                          variant="outline"
                          size="sm"
                        >
                          {loadingRevisao ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                          Recarregar
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {loadingRevisao && agendamentosSemCompetencia.length === 0 ? (
                        <div className="text-center py-12">
                          <Loader2 className="w-10 h-10 animate-spin mx-auto text-gray-400" />
                          <p className="mt-2 text-gray-500">Carregando...</p>
                        </div>
                      ) : agendamentosSemCompetencia.length === 0 ? (
                        <div className="text-center py-12">
                          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                          <p className="text-gray-600 dark:text-gray-400 font-medium">Nenhum agendamento sem data de competência</p>
                          <p className="text-sm text-gray-500 mt-1">Todos os registros estão com data de competência preenchida.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-600">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                  <th className="px-4 py-2 text-left font-medium">Data Venc.</th>
                                  <th className="px-4 py-2 text-left font-medium">Valor</th>
                                  <th className="px-4 py-2 text-left font-medium">Fornecedor</th>
                                  <th className="px-4 py-2 text-left font-medium">Categoria</th>
                                  <th className="px-4 py-2 text-left font-medium">Descrição</th>
                                  <th className="px-4 py-2 text-left font-medium">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {agendamentosSemCompetencia.map((a: any) => (
                                  <tr key={a.id} className="border-t border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <td className="px-4 py-2">{a.data_vencimento ? new Date(a.data_vencimento).toLocaleDateString('pt-BR') : '-'}</td>
                                    <td className="px-4 py-2 font-medium">{typeof a.valor === 'number' ? a.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : a.valor}</td>
                                    <td className="px-4 py-2">{a.stakeholder_nome || '-'}</td>
                                    <td className="px-4 py-2">{a.categoria_nome || '-'}</td>
                                    <td className="px-4 py-2 max-w-[200px] truncate">{a.descricao || '-'}</td>
                                    <td className="px-4 py-2">{a.status || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {revisaoHasMore && (
                            <Button
                              onClick={() => carregarRevisaoNIBO(revisaoOffset)}
                              disabled={loadingRevisao}
                              variant="outline"
                              className="w-full"
                            >
                              {loadingRevisao ? 'Carregando...' : `Carregar mais (${agendamentosSemCompetencia.length} de ${revisaoTotal})`}
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
              )}
            </div>
          </div>
        </div>

        {/* Modal: Importar Folha */}
        <Dialog open={modalFolha} onOpenChange={setModalFolha}>
          <DialogContent className="max-w-5xl max-h-[90vh] bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white">
                Importar Folha de Pagamento
              </DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400">
                Cole a planilha (tabulada), gere a previa e importe os pagamentos para a lista.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-700 dark:text-gray-300">Data de pagamento *</Label>
                  <Input
                    type="date"
                    value={dataPagamentoFolha}
                    onChange={e => setDataPagamentoFolha(e.target.value)}
                    className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-700 dark:text-gray-300">Competência (AAAA-MM) *</Label>
                  <Input
                    type="month"
                    value={competenciaFolha}
                    onChange={e => setCompetenciaFolha(e.target.value)}
                    className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-700 dark:text-gray-300">Categoria padrão *</Label>
                  <SelectWithSearch
                    value={categoriaFolhaId}
                    onValueChange={value => setCategoriaFolhaId(value || '')}
                    placeholder="Selecione a categoria da folha"
                    options={categorias.map(cat => ({
                      value: cat.nibo_id || cat.id,
                      label: cat.categoria_nome || cat.name || cat.nome,
                    }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-gray-700 dark:text-gray-300">Centro de custo padrão (opcional)</Label>
                  <SelectWithSearch
                    value={centroCustoFolhaId}
                    onValueChange={value => setCentroCustoFolhaId(value || '')}
                    placeholder="Selecione um centro de custo"
                    options={centrosCusto.map(cc => ({
                      value: cc.nibo_id || cc.id,
                      label: cc.nome || cc.name,
                    }))}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-gray-700 dark:text-gray-300">Cole a planilha da folha (TAB)</Label>
                <textarea
                  className="w-full h-40 mt-1 p-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono resize-none border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  value={textoFolha}
                  onChange={e => setTextoFolha(e.target.value)}
                  placeholder="Cole aqui as linhas da folha copiadas do Excel/Sheets"
                />
              </div>

              <div className="flex gap-3">
                <Button onClick={processarPreviewFolha} variant="outline">
                  Gerar Prévia
                </Button>
                <Button
                  onClick={importarFolhaParaLista}
                  className="btn-primary"
                  disabled={previewFolha.length === 0}
                >
                  Importar {previewFolha.length > 0 ? `${previewFolha.length} pagamento(s)` : 'Folha'}
                </Button>
              </div>

              {previewFolha.length > 0 && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-3 py-2 text-left">Nome</th>
                        <th className="px-3 py-2 text-left">PIX</th>
                        <th className="px-3 py-2 text-left">Cargo</th>
                        <th className="px-3 py-2 text-left">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewFolha.slice(0, 20).map((item, idx) => (
                        <tr key={`${item.nome}-${idx}`} className="border-t border-gray-200 dark:border-gray-600">
                          <td className="px-3 py-2">{item.nome}</td>
                          <td className="px-3 py-2">{item.pix}</td>
                          <td className="px-3 py-2">{item.cargo}</td>
                          <td className="px-3 py-2 font-medium">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal para cadastrar stakeholder */}
        <Dialog open={modalStakeholder} onOpenChange={setModalStakeholder}>
          <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white">
                Cadastrar Novo Stakeholder
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-gray-700 dark:text-gray-300">
                  CPF/CNPJ
                </Label>
                <Input
                  value={formatarDocumento(stakeholderEmCadastro.document)}
                  disabled
                  className="mt-1 bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <Label className="text-gray-700 dark:text-gray-300">
                  Nome Completo *
                </Label>
                <Input
                  value={stakeholderEmCadastro.name}
                  onChange={(e) =>
                    setStakeholderEmCadastro(prev => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Nome completo do stakeholder"
                  className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setModalStakeholder(false)}
                className="btn-outline"
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  if (!stakeholderEmCadastro.name.trim()) {
                    toast({
                      title: 'Nome obrigatório',
                      description: 'Digite o nome do stakeholder',
                      variant: 'destructive',
                    });
                    return;
                  }

                  setIsCadastrandoStakeholder(true);
                  try {
                    const response = await fetch('/api/financeiro/nibo/stakeholders', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: stakeholderEmCadastro.name,
                        document: stakeholderEmCadastro.document,
                        type: 'fornecedor',
                      }),
                    });

                    const data = await response.json();
                    if (data.success) {
                      // Preencher formulário com dados do novo stakeholder
                      setNovoPagamento(prev => ({
                        ...prev,
                        nome_beneficiario: stakeholderEmCadastro.name,
                        cpf_cnpj: formatarDocumento(stakeholderEmCadastro.document),
                        chave_pix: '',
                      }));

                      // Preparar para cadastrar chave PIX
                      setStakeholderParaPix(data.data);
                      setPixKeyData({
                        pixKey: '',
                        pixKeyType: 3,
                        isSameAsDocument: false,
                      });
                      
                      setModalStakeholder(false);
                      setModalPixKey(true);

                      toast({
                        title: '✅ Stakeholder cadastrado!',
                        description: 'Agora cadastre a chave PIX',
                      });
                    } else {
                      throw new Error(data.error || 'Erro ao cadastrar');
                    }
                  } catch (error) {
                    console.error('Erro ao cadastrar stakeholder:', error);
                    toast({
                      title: 'Erro no cadastro',
                      description: 'Não foi possível cadastrar o stakeholder',
                      variant: 'destructive',
                    });
                  } finally {
                    setIsCadastrandoStakeholder(false);
                  }
                }}
                disabled={isCadastrandoStakeholder}
                className="btn-primary"
              >
                {isCadastrandoStakeholder ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Cadastrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal para cadastrar chave PIX */}
        <Dialog open={modalPixKey} onOpenChange={setModalPixKey}>
          <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white">
                Cadastrar Chave PIX
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-gray-700 dark:text-gray-300">
                  Stakeholder
                </Label>
                <Input
                  value={stakeholderParaPix?.name || ''}
                  disabled
                  className="mt-1 bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <Label className="text-gray-700 dark:text-gray-300">
                  Usar CPF/CNPJ como chave PIX?
                </Label>
                <div className="flex items-center space-x-2 mt-2">
                  <input
                    type="checkbox"
                    id="sameAsDocument"
                    checked={pixKeyData.isSameAsDocument}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setPixKeyData(prev => ({
                        ...prev,
                        isSameAsDocument: checked,
                        pixKey: checked ? (stakeholderParaPix?.document || '') : '',
                        pixKeyType: checked ? 3 : 3, // 3 = CPF/CNPJ
                      }));
                    }}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <label htmlFor="sameAsDocument" className="text-sm text-gray-700 dark:text-gray-300">
                    Sim, usar {formatarDocumento(stakeholderParaPix?.document || '')} como chave PIX
                  </label>
                </div>
              </div>
              {!pixKeyData.isSameAsDocument && (
                <div>
                  <Label className="text-gray-700 dark:text-gray-300">
                    Chave PIX *
                  </Label>
                  <Input
                    value={pixKeyData.pixKey}
                    onChange={(e) =>
                      setPixKeyData(prev => ({
                        ...prev,
                        pixKey: e.target.value,
                      }))
                    }
                    placeholder="Digite a chave PIX (CPF, CNPJ, email, telefone ou chave aleatória)"
                    className="mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setModalPixKey(false)}
                className="btn-outline"
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  const chavePixFinal = pixKeyData.isSameAsDocument 
                    ? (stakeholderParaPix?.document || '')
                    : pixKeyData.pixKey;

                  if (!chavePixFinal.trim()) {
                    toast({
                      title: 'Chave PIX obrigatória',
                      description: 'Digite uma chave PIX válida',
                      variant: 'destructive',
                    });
                    return;
                  }

                  setIsAtualizandoPix(true);
                  try {
                    const response = await fetch(`/api/financeiro/nibo/stakeholders/${stakeholderParaPix?.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: stakeholderParaPix?.name || '',
                        document: stakeholderParaPix?.document || '',
                        pixKey: chavePixFinal,
                        pixKeyType: pixKeyData.pixKeyType,
                      }),
                    });

                    const data = await response.json();
                    if (data.success) {
                      // Atualizar formulário com a chave PIX
                      setNovoPagamento(prev => ({
                        ...prev,
                        chave_pix: chavePixFinal,
                      }));

                      setModalPixKey(false);
                      toast({
                        title: '✅ Chave PIX cadastrada!',
                        description: 'Agora você pode finalizar o pagamento',
                      });
                    } else {
                      throw new Error(data.error || 'Erro ao atualizar');
                    }
                  } catch (error) {
                    console.error('Erro ao atualizar chave PIX:', error);
                    toast({
                      title: 'Erro na atualização',
                      description: 'Não foi possível cadastrar a chave PIX',
                      variant: 'destructive',
                    });
                  } finally {
                    setIsAtualizandoPix(false);
                  }
                }}
                disabled={isAtualizandoPix}
                className="btn-primary"
              >
                {isAtualizandoPix ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Cadastrar Chave PIX
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Configuração de Categorias */}
        <Dialog open={modalConfiguracoes} onOpenChange={setModalConfiguracoes}>
          <DialogContent className="max-w-6xl max-h-[90vh] bg-white dark:bg-gray-800">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white">
                Configurar Categorias e Centros de Custo ({dadosPlanilha.length} linhas)
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Auto-configuração por Descrição */}
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <h4 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-3">
                  🪄 Auto-configurar por Descrição
                </h4>
                <p className="text-xs text-green-700 dark:text-green-300 mb-3">
                  Mapeia automaticamente a categoria baseado na descrição (SALARIO → Salário Funcionários, COMISSAO → Comissão 10%)
                </p>
                <button
                  onClick={() => {
                    // Mapeamento de descrições para categorias do NIBO (Ordinário)
                    // IDs corretos baseados no histórico de agendamentos
                    const mapeamentoDescricaoCategoria: Record<string, string> = {
                      'SALARIO': 'a8172f9d-4e62-401e-87d0-4612e2bba698', // SALARIO FUNCIONARIOS (ID correto do histórico)
                      'SALÁRIO': 'a8172f9d-4e62-401e-87d0-4612e2bba698',
                      'COMISSAO': '1de3a811-276f-46c5-8897-c9e12c6d1798', // COMISSÃO 10%
                      'COMISSÃO': '1de3a811-276f-46c5-8897-c9e12c6d1798',
                    };
                    
                    const novasConfiguracoes: any = {};
                    let configurados = 0;
                    let naoEncontrados = 0;
                    
                    dadosPlanilha.forEach((linha, index) => {
                      const descricao = (linha[3] || '').toUpperCase().trim();
                      const categoriaId = mapeamentoDescricaoCategoria[descricao];
                      
                      if (categoriaId) {
                        novasConfiguracoes[index] = {
                          categoria_id: categoriaId,
                          centro_custo_id: configuracoesIndividuais[index]?.centro_custo_id || ''
                        };
                        configurados++;
                      } else {
                        // Manter configuração existente se houver
                        novasConfiguracoes[index] = {
                          categoria_id: configuracoesIndividuais[index]?.categoria_id || '',
                          centro_custo_id: configuracoesIndividuais[index]?.centro_custo_id || ''
                        };
                        naoEncontrados++;
                      }
                    });
                    
                    setConfiguracoesIndividuais(novasConfiguracoes);
                    
                    toast({
                      title: '✅ Auto-configuração concluída',
                      description: `${configurados} linha(s) configurada(s)${naoEncontrados > 0 ? `, ${naoEncontrados} não encontrada(s)` : ''}`,
                    });
                  }}
                  className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Auto-configurar Categorias pela Descrição
                </button>
              </div>

              {/* Configuração Rápida */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">
                  ⚡ Configuração Rápida - Aplicar para todas as linhas
                </h4>
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Label className="text-blue-800 dark:text-blue-200 text-sm mb-1 block">Categoria</Label>
                    <SelectWithSearch
                      value=""
                      onValueChange={(value) => {
                        if (value) {
                          const novasConfiguracoes: any = {};
                          dadosPlanilha.forEach((_, index) => {
                            novasConfiguracoes[index] = {
                              categoria_id: value,
                              centro_custo_id: configuracoesIndividuais[index]?.centro_custo_id || ''
                            };
                          });
                          setConfiguracoesIndividuais(novasConfiguracoes);
                        }
                      }}
                      placeholder="Escolher categoria..."
                      options={categorias.map(cat => ({
                        value: cat.id.toString(),
                        label: cat.categoria_nome
                      }))}
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-blue-800 dark:text-blue-200 text-sm mb-1 block">Centro de Custo</Label>
                    <SelectWithSearch
                      value=""
                      onValueChange={(value) => {
                        if (value) {
                          const novasConfiguracoes: any = {};
                          dadosPlanilha.forEach((_, index) => {
                            novasConfiguracoes[index] = {
                              categoria_id: configuracoesIndividuais[index]?.categoria_id || '',
                              centro_custo_id: value
                            };
                          });
                          setConfiguracoesIndividuais(novasConfiguracoes);
                        }
                      }}
                      placeholder="Escolher centro..."
                      options={centrosCusto.map(cc => ({
                        value: cc.id.toString(),
                        label: cc.nome
                      }))}
                    />
                  </div>
                </div>
              </div>

              {/* Seções Individuais de Configuração */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                  Configurações Individuais
                </h4>
                
                <div className="max-h-[450px] overflow-y-auto space-y-4 pr-2" style={{ overflowX: 'visible' }}>
                  {dadosPlanilha.map((linha, index) => (
                    <div key={index} className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-shadow">
                      {/* Header do Pagamento */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-semibold rounded-full">
                              {index + 1}
                            </span>
                            <h5 className="text-sm font-semibold text-gray-900 dark:text-white">
                              {linha[0] || 'Nome não informado'}
                            </h5>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                            <span className="font-mono">{linha[1] || 'PIX não informado'}</span>
                            <span className="font-semibold text-green-600 dark:text-green-400">{linha[2] || 'Valor não informado'}</span>
                            <span>{linha[3] || 'Sem descrição'}</span>
                          </div>
                        </div>
                        
                        {/* Status da Configuração */}
                        <div className="ml-4">
                          {configuracoesIndividuais[index]?.categoria_id ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-medium rounded-full">
                              <CheckCircle className="w-3 h-3" />
                              Configurado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-xs font-medium rounded-full">
                              <AlertCircle className="w-3 h-3" />
                              Pendente
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Dropdowns de Configuração */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-gray-700 dark:text-gray-300 text-sm font-medium">
                            Categoria *
                          </Label>
                          <SelectWithSearch
                            key={`categoria-${index}`}
                            value={configuracoesIndividuais[index]?.categoria_id || ''}
                            onValueChange={(value) => {
                              const currentIndex = index; // Capturar o índice atual
                              console.log(`🔍 Categoria selecionada para linha ${currentIndex}:`, value);
                              setConfiguracoesIndividuais(prev => {
                                console.log('📋 Estado anterior:', prev);
                                console.log('📋 Atualizando linha:', currentIndex);
                                const novoEstado = {
                                  ...prev,
                                  [currentIndex]: {
                                    ...prev[currentIndex],
                                    categoria_id: value || '',
                                    centro_custo_id: prev[currentIndex]?.centro_custo_id || ''
                                  }
                                };
                                console.log('📋 Novo estado:', novoEstado);
                                console.log('📋 Linha atualizada:', currentIndex, novoEstado[currentIndex]);
                                return novoEstado;
                              });
                            }}
                            placeholder="Selecionar categoria..."
                            searchPlaceholder="Buscar categoria..."
                            options={categorias.map(cat => ({
                              value: cat.id.toString(),
                              label: cat.categoria_nome
                            }))}
                            className="w-full"
                            dropdownDirection="up"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-gray-700 dark:text-gray-300 text-sm font-medium">
                            Centro de Custo *
                          </Label>
                          <SelectWithSearch
                            key={`centro-custo-${index}`}
                            value={configuracoesIndividuais[index]?.centro_custo_id || ''}
                            onValueChange={(value) => {
                              const currentIndex = index; // Capturar o índice atual
                              console.log(`🔍 Centro de custo selecionado para linha ${currentIndex}:`, value);
                              setConfiguracoesIndividuais(prev => {
                                console.log('📋 Estado anterior (CC):', prev);
                                console.log('📋 Atualizando linha:', currentIndex);
                                const novoEstado = {
                                  ...prev,
                                  [currentIndex]: {
                                    ...prev[currentIndex],
                                    categoria_id: prev[currentIndex]?.categoria_id || '',
                                    centro_custo_id: value || ''
                                  }
                                };
                                console.log('📋 Novo estado (CC):', novoEstado);
                                console.log('📋 Linha atualizada:', currentIndex, novoEstado[currentIndex]);
                                return novoEstado;
                              });
                            }}
                            placeholder="Selecionar centro de custo..."
                            searchPlaceholder="Buscar centro de custo..."
                            options={centrosCusto.map(cc => ({
                              value: cc.id.toString(),
                              label: cc.nome
                            }))}
                            className="w-full"
                            dropdownDirection="up"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="flex justify-between">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {(() => {
                  const configuradas = dadosPlanilha.filter((_, index) => 
                    configuracoesIndividuais[index]?.categoria_id
                  ).length;
                  return `${configuradas}/${dadosPlanilha.length} linhas configuradas`;
                })()}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setModalConfiguracoes(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    setModalConfiguracoes(false);
                    toast({
                      title: 'Configurações salvas',
                      description: 'Categorias e centros de custo configurados com sucesso'
                    });
                  }}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-colors font-medium"
                >
                  Salvar Configurações
                </button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}
