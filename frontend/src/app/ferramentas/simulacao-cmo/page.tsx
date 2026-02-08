'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Calculator,
  Plus,
  Trash2,
  RefreshCcw,
  Save,
  Users,
  DollarSign,
  Calendar,
  TrendingUp,
  FileText,
  Edit,
  Info,
  History,
  Download,
  UserPlus,
  BarChart3,
  PieChart,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  FileSpreadsheet,
  Gift,
  Briefcase,
  UserCheck,
  UserX,
  Search,
  Phone,
  Mail,
} from 'lucide-react';
import { useBar } from '@/contexts/BarContext';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { DataTablePro } from '@/components/ui/datatable-pro';

// ==================== INTERFACES ====================

interface FuncionarioSimulacao {
  id: string;
  nome: string;
  tipo_contratacao: 'CLT' | 'PJ';
  area: string;
  diaria: number;
  vale: number;
  salario_bruto: number;
  adicionais: number;
  aviso_previo: number;
  estimativa: number;
  tempo_casa: number;
  mensalidade_sindical: number;
  dias_trabalhados: number;
}

interface SimulacaoCMO {
  id?: number;
  bar_id: number;
  mes: number;
  ano: number;
  funcionarios: FuncionarioSimulacao[];
  total_folha: number;
  total_encargos: number;
  total_geral: number;
  observacoes?: string;
  criado_por?: string;
  criado_em?: string;
}

interface FuncionarioCadastrado {
  id: number;
  bar_id: number;
  nome: string;
  cpf?: string;
  telefone?: string;
  email?: string;
  data_admissao?: string;
  data_demissao?: string;
  cargo_id?: number;
  area_id?: number;
  tipo_contratacao: 'CLT' | 'PJ';
  salario_base: number;
  vale_transporte_diaria: number;
  dias_trabalho_semana: number;
  observacoes?: string;
  ativo: boolean;
  area?: { id: number; nome: string; cor: string; adicional_noturno: number };
  cargo?: { id: number; nome: string; nivel: number };
}

interface Area {
  id: number;
  nome: string;
  cor: string;
  adicional_noturno: number;
}

interface Cargo {
  id: number;
  nome: string;
  nivel: number;
}

interface Provisao {
  id: number;
  funcionario_nome: string;
  mes: number;
  ano: number;
  salario_bruto_produtividade: number;
  decimo_terceiro: number;
  ferias: number;
  terco_ferias: number;
  fgts_provisao: number;
  provisao_certa: number;
  provisao_eventual: number;
  percentual_salario: number;
  funcionario?: { id: number; nome: string };
}

interface ProvisaoAcumulada {
  funcionario_nome: string;
  total_decimo_terceiro: number;
  total_ferias: number;
  total_fgts: number;
  total_provisao_certa: number;
  total_provisao_eventual: number;
  dias_ferias_vencidos: number;
  meses_trabalhados: number;
}

interface ComparativoCMO {
  categoria: string;
  valor_nibo: number;
  valor_simulado: number;
  diferenca: number;
  percentual_diferenca: number;
}

interface ResumoComparativo {
  mes: number;
  ano: number;
  total_nibo: number;
  total_simulado: number;
  diferenca_total: number;
  percentual_diferenca: number;
  status: 'ok' | 'alerta' | 'critico';
  detalhes: ComparativoCMO[];
}

// ==================== CONSTANTES ====================

const MESES = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

const AREAS_SIMULACAO = ['Salão', 'Liderança', 'Bar', 'Cozinha'];

const TIPOS_CONTRATACAO = [
  { value: 'CLT', label: 'CLT' },
  { value: 'PJ', label: 'PJ' },
];

// ==================== COMPONENTE PRINCIPAL ====================

export default function CMOUnificadoPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();
  const { user } = useUser();
  const { toast } = useToast();

  // Estados gerais
  const [loading, setLoading] = useState(true);
  const [mesAtual, setMesAtual] = useState(() => new Date().getMonth() + 1);
  const [anoAtual, setAnoAtual] = useState(() => new Date().getFullYear());
  const [abaAtiva, setAbaAtiva] = useState('dashboard');

  // Estados do Dashboard
  const [comparativo, setComparativo] = useState<ResumoComparativo | null>(null);
  const [provTotais, setProvTotais] = useState({
    total_provisao_certa: 0,
    total_provisao_eventual: 0,
    total_decimo_terceiro: 0,
    total_ferias: 0,
    total_fgts: 0
  });

  // Estados de Funcionários
  const [funcionariosCadastrados, setFuncionariosCadastrados] = useState<FuncionarioCadastrado[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [isDialogFuncOpen, setIsDialogFuncOpen] = useState(false);
  const [editingFuncionario, setEditingFuncionario] = useState<FuncionarioCadastrado | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState('ativos');
  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    telefone: '',
    email: '',
    data_admissao: '',
    cargo_id: '',
    area_id: '',
    tipo_contratacao: 'CLT',
    salario_base: '',
    vale_transporte_diaria: '11',
    dias_trabalho_semana: '6',
    observacoes: '',
  });

  // Estados de Simulação
  const [funcionariosSimulacao, setFuncionariosSimulacao] = useState<FuncionarioSimulacao[]>([]);
  const [observacoesSimulacao, setObservacoesSimulacao] = useState('');
  const [historicoSimulacoes, setHistoricoSimulacoes] = useState<SimulacaoCMO[]>([]);
  const [salvandoSimulacao, setSalvandoSimulacao] = useState(false);
  const [simulacaoAtualId, setSimulacaoAtualId] = useState<number | undefined>();

  // Estados de Provisões
  const [provisoes, setProvisoes] = useState<Provisao[]>([]);
  const [provisoesAcumuladas, setProvisoesAcumuladas] = useState<ProvisaoAcumulada[]>([]);
  const [calculandoProvisoes, setCalculandoProvisoes] = useState(false);

  // Estados de Importação
  const [importando, setImportando] = useState(false);

  // ==================== FUNÇÕES DE CÁLCULO (SIMULAÇÃO) ====================

  const obterAdicionalNoturno = (area: string): number => {
    const adicionalPorArea: Record<string, number> = {
      'Salão': 125,
      'Bar': 125,
      'Cozinha': 115,
      'Liderança': 0,
    };
    return adicionalPorArea[area] || 0;
  };

  const calcularValoresFuncionario = (func: FuncionarioSimulacao) => {
    const salarioBrutoEstimativa = func.salario_bruto + func.estimativa;
    const adicionalNoturno = obterAdicionalNoturno(func.area);
    const drsNoturno = adicionalNoturno * 0.2;
    const produtividade = func.salario_bruto * 0.05;
    const descValeTransporte = func.salario_bruto * -0.06;
    const baseINSS = salarioBrutoEstimativa + adicionalNoturno + drsNoturno + func.tempo_casa + produtividade;
    const inss = baseINSS * -0.08;
    
    let ir = 0;
    const baseIR = (func.salario_bruto - 528) * 0.075 - 158.4;
    if (baseIR > 0) ir = baseIR * -1;
    
    const salarioLiquido = func.salario_bruto + adicionalNoturno + drsNoturno + func.tempo_casa + produtividade + descValeTransporte + inss + ir;
    const inssEmpresa = Math.abs(inss);
    const fgts = Math.abs(inss);
    const provisaoCerta = (func.salario_bruto + adicionalNoturno + drsNoturno + func.tempo_casa + produtividade) * 0.27;

    let custoEmpresa = 0;
    if (func.tipo_contratacao === 'CLT') {
      const somaEncargos = inssEmpresa + fgts + Math.abs(descValeTransporte) + provisaoCerta + func.mensalidade_sindical;
      custoEmpresa = (somaEncargos / 30 * func.dias_trabalhados) + func.aviso_previo + func.adicionais;
    } else {
      const somaPJ = func.salario_bruto + func.tempo_casa + func.vale + func.adicionais + func.aviso_previo;
      custoEmpresa = (somaPJ / 30) * func.dias_trabalhados;
    }

    return {
      adicionalNoturno,
      drsNoturno,
      produtividade,
      descValeTransporte,
      inss,
      ir,
      salarioLiquido,
      inssEmpresa,
      fgts,
      provisaoCerta,
      custoEmpresa
    };
  };

  const calcularTotaisGerais = () => {
    let totalFolha = 0;
    let totalEncargos = 0;
    let totalGeral = 0;

    funcionariosSimulacao.forEach(func => {
      const valores = calcularValoresFuncionario(func);
      totalFolha += valores.salarioLiquido;
      totalEncargos += valores.inssEmpresa + valores.fgts + valores.provisaoCerta;
      totalGeral += valores.custoEmpresa;
    });

    return { totalFolha, totalEncargos, totalGeral };
  };

  // ==================== FUNÇÕES DE CARREGAMENTO ====================

  const carregarDadosDashboard = useCallback(async () => {
    if (!selectedBar) return;
    
    try {
      // Primeiro, garantir que folha e provisões estejam calculadas (auto_calcular=true)
      const [folhaRes, provCalcRes] = await Promise.all([
        fetch(`/api/rh/folha-pagamento?bar_id=${selectedBar.id}&mes=${mesAtual}&ano=${anoAtual}&auto_calcular=true`),
        fetch(`/api/rh/provisoes?bar_id=${selectedBar.id}&mes=${mesAtual}&ano=${anoAtual}&auto_calcular=true`)
      ]);

      // Agora buscar comparativo e totais
      const [compRes, provRes] = await Promise.all([
        fetch(`/api/rh/cmo-comparativo?bar_id=${selectedBar.id}&mes=${mesAtual}&ano=${anoAtual}`),
        fetch(`/api/rh/provisoes?bar_id=${selectedBar.id}&mes=${mesAtual}&ano=${anoAtual}`)
      ]);

      const [compData, provData] = await Promise.all([
        compRes.json(),
        provRes.json()
      ]);

      if (compData.success) setComparativo(compData.data);
      if (provData.success) setProvTotais(provData.totais);

    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    }
  }, [selectedBar, mesAtual, anoAtual]);

  const carregarFuncionarios = useCallback(async () => {
    if (!selectedBar) return;
    
    try {
      const [funcRes, areasRes, cargosRes] = await Promise.all([
        fetch(`/api/rh/funcionarios?bar_id=${selectedBar.id}`),
        fetch(`/api/rh/areas?bar_id=${selectedBar.id}&ativo=true`),
        fetch(`/api/rh/cargos?bar_id=${selectedBar.id}&ativo=true`)
      ]);

      const [funcData, areasData, cargosData] = await Promise.all([
        funcRes.json(),
        areasRes.json(),
        cargosRes.json()
      ]);

      if (funcData.success) setFuncionariosCadastrados(funcData.data);
      if (areasData.success) setAreas(areasData.data);
      if (cargosData.success) setCargos(cargosData.data);

    } catch (error) {
      console.error('Erro ao carregar funcionários:', error);
    }
  }, [selectedBar]);

  const carregarSimulacao = useCallback(async () => {
    if (!selectedBar || !user) return;
    
    try {
      const response = await fetch(`/api/operacional/cmo-simulacao?bar_id=${selectedBar.id}&mes=${mesAtual}&ano=${anoAtual}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setFuncionariosSimulacao(data.data.funcionarios || []);
        setObservacoesSimulacao(data.data.observacoes || '');
        setSimulacaoAtualId(data.data.id);
      } else {
        setFuncionariosSimulacao([]);
        setObservacoesSimulacao('');
        setSimulacaoAtualId(undefined);
      }
    } catch (error) {
      console.error('Erro ao carregar simulação:', error);
    }
  }, [selectedBar, user, mesAtual, anoAtual]);

  const carregarHistoricoSimulacoes = useCallback(async () => {
    if (!selectedBar) return;
    
    try {
      const response = await fetch(`/api/operacional/cmo-simulacao?bar_id=${selectedBar.id}`);
      const data = await response.json();
      if (data.success) {
        setHistoricoSimulacoes(data.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }
  }, [selectedBar]);

  const carregarProvisoes = useCallback(async () => {
    if (!selectedBar) return;
    
    try {
      // auto_calcular=true para calcular automaticamente se não existir
      const response = await fetch(`/api/rh/provisoes?bar_id=${selectedBar.id}&mes=${mesAtual}&ano=${anoAtual}&auto_calcular=true`);
      const data = await response.json();
      if (data.success) {
        setProvisoes(data.data);
        setProvTotais(data.totais);
      }
    } catch (error) {
      console.error('Erro ao carregar provisões:', error);
    }
  }, [selectedBar, mesAtual, anoAtual]);

  const carregarProvisoesAcumuladas = useCallback(async () => {
    if (!selectedBar) return;
    
    try {
      const response = await fetch(`/api/rh/provisoes?bar_id=${selectedBar.id}&acumulado=true`);
      const data = await response.json();
      if (data.success) {
        setProvisoesAcumuladas(data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar provisões acumuladas:', error);
    }
  }, [selectedBar]);

  // ==================== EFFECTS ====================

  useEffect(() => {
    setPageTitle('Simulação de CMO');
  }, [setPageTitle]);

  useEffect(() => {
    const carregarDados = async () => {
      if (!selectedBar) return;
      setLoading(true);
      
      await Promise.all([
        carregarDadosDashboard(),
        carregarFuncionarios(),
        carregarSimulacao(),
        carregarHistoricoSimulacoes(),
        carregarProvisoes()
      ]);
      
      setLoading(false);
    };
    
    carregarDados();
  }, [selectedBar, mesAtual, anoAtual, carregarDadosDashboard, carregarFuncionarios, carregarSimulacao, carregarHistoricoSimulacoes, carregarProvisoes]);

  useEffect(() => {
    if (abaAtiva === 'provisoes-acumuladas') {
      carregarProvisoesAcumuladas();
    }
  }, [abaAtiva, carregarProvisoesAcumuladas]);

  // ==================== FUNÇÕES DE AÇÃO ====================

  // Funcionários
  const salvarFuncionario = async () => {
    if (!selectedBar || !formData.nome) {
      toast({ title: 'Erro', description: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }

    try {
      const payload = {
        ...formData,
        bar_id: selectedBar.id,
        cargo_id: formData.cargo_id ? parseInt(formData.cargo_id) : null,
        area_id: formData.area_id ? parseInt(formData.area_id) : null,
        salario_base: parseFloat(formData.salario_base) || 0,
        vale_transporte_diaria: parseFloat(formData.vale_transporte_diaria) || 0,
        dias_trabalho_semana: parseInt(formData.dias_trabalho_semana) || 6,
        registrar_alteracao_contrato: !!editingFuncionario,
        id: editingFuncionario?.id
      };

      const res = await fetch('/api/rh/funcionarios', {
        method: editingFuncionario ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.success) {
        toast({ title: 'Sucesso', description: editingFuncionario ? 'Funcionário atualizado' : 'Funcionário cadastrado' });
        setIsDialogFuncOpen(false);
        carregarFuncionarios();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível salvar', variant: 'destructive' });
    }
  };

  const abrirNovoFuncionario = () => {
    setEditingFuncionario(null);
    setFormData({
      nome: '', cpf: '', telefone: '', email: '',
      data_admissao: new Date().toISOString().split('T')[0],
      cargo_id: '', area_id: '', tipo_contratacao: 'CLT',
      salario_base: '', vale_transporte_diaria: '11',
      dias_trabalho_semana: '6', observacoes: '',
    });
    setIsDialogFuncOpen(true);
  };

  const abrirEdicaoFuncionario = (func: FuncionarioCadastrado) => {
    setEditingFuncionario(func);
    setFormData({
      nome: func.nome,
      cpf: func.cpf || '',
      telefone: func.telefone || '',
      email: func.email || '',
      data_admissao: func.data_admissao || '',
      cargo_id: func.cargo_id?.toString() || '',
      area_id: func.area_id?.toString() || '',
      tipo_contratacao: func.tipo_contratacao,
      salario_base: func.salario_base.toString(),
      vale_transporte_diaria: func.vale_transporte_diaria.toString(),
      dias_trabalho_semana: func.dias_trabalho_semana.toString(),
      observacoes: func.observacoes || '',
    });
    setIsDialogFuncOpen(true);
  };

  // Simulação
  const adicionarFuncionarioSimulacao = () => {
    const novoFunc: FuncionarioSimulacao = {
      id: `func-${Date.now()}`,
      nome: '',
      tipo_contratacao: 'CLT',
      area: 'Salão',
      diaria: 0,
      vale: 0,
      salario_bruto: 0,
      adicionais: 0,
      aviso_previo: 0,
      estimativa: 0,
      tempo_casa: 0,
      mensalidade_sindical: 0,
      dias_trabalhados: 30
    };
    setFuncionariosSimulacao([...funcionariosSimulacao, novoFunc]);
  };

  const importarFuncionariosCadastrados = async () => {
    if (!selectedBar) return;
    
    try {
      const response = await fetch(`/api/rh/funcionarios?bar_id=${selectedBar.id}&ativo=true`);
      const result = await response.json();
      
      if (!result.success || !result.data || result.data.length === 0) {
        toast({ title: 'Nenhum funcionário encontrado', description: 'Cadastre funcionários na aba "Funcionários"', variant: 'destructive' });
        return;
      }

      const funcionariosImportados: FuncionarioSimulacao[] = result.data.map((func: FuncionarioCadastrado) => ({
        id: `func-${func.id}-${Date.now()}`,
        nome: func.nome,
        tipo_contratacao: func.tipo_contratacao,
        area: func.area?.nome || 'Salão',
        diaria: func.vale_transporte_diaria,
        vale: func.vale_transporte_diaria * 30,
        salario_bruto: func.salario_base,
        adicionais: 0,
        aviso_previo: 0,
        estimativa: 0,
        tempo_casa: 0,
        mensalidade_sindical: 0,
        dias_trabalhados: 30
      }));

      const substituir = funcionariosSimulacao.length === 0 || 
        confirm(`Substituir os ${funcionariosSimulacao.length} funcionário(s) atuais pelos ${funcionariosImportados.length} do cadastro?`);

      if (substituir) {
        setFuncionariosSimulacao(funcionariosImportados);
      } else {
        setFuncionariosSimulacao([...funcionariosSimulacao, ...funcionariosImportados]);
      }

      toast({ title: 'Sucesso', description: `${funcionariosImportados.length} funcionário(s) importado(s)` });
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível importar', variant: 'destructive' });
    }
  };

  const salvarSimulacao = async () => {
    if (!selectedBar || !user) return;

    setSalvandoSimulacao(true);
    try {
      const totais = calcularTotaisGerais();
      const simulacao: SimulacaoCMO = {
        id: simulacaoAtualId,
        bar_id: selectedBar.id,
        mes: mesAtual,
        ano: anoAtual,
        funcionarios: funcionariosSimulacao,
        total_folha: totais.totalFolha,
        total_encargos: totais.totalEncargos,
        total_geral: totais.totalGeral,
        observacoes: observacoesSimulacao,
        criado_por: user.email
      };

      const response = await fetch('/api/operacional/cmo-simulacao', {
        method: simulacaoAtualId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simulacao)
      });

      const data = await response.json();
      if (data.success) {
        toast({ title: 'Sucesso', description: 'Simulação salva' });
        setSimulacaoAtualId(data.data?.id);
        carregarHistoricoSimulacoes();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível salvar', variant: 'destructive' });
    } finally {
      setSalvandoSimulacao(false);
    }
  };

  // Provisões
  const calcularProvisoes = async () => {
    if (!selectedBar) return;

    setCalculandoProvisoes(true);
    try {
      const response = await fetch('/api/rh/provisoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bar_id: selectedBar.id, mes: mesAtual, ano: anoAtual })
      });

      const result = await response.json();
      if (result.success) {
        toast({ title: 'Sucesso', description: result.message });
        carregarProvisoes();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível calcular', variant: 'destructive' });
    } finally {
      setCalculandoProvisoes(false);
    }
  };

  // Importação
  const importarDaPlanilha = async (tipo: 'funcionarios' | 'provisoes') => {
    if (!selectedBar) return;
    
    setImportando(true);
    try {
      const endpoint = tipo === 'funcionarios' ? '/api/rh/importar-planilha' : '/api/rh/importar-provisoes';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bar_id: selectedBar.id })
      });

      const result = await response.json();
      if (result.success) {
        toast({ title: 'Importação concluída', description: result.message });
        if (tipo === 'funcionarios') carregarFuncionarios();
        else carregarProvisoes();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({ title: 'Erro', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'destructive' });
    } finally {
      setImportando(false);
    }
  };

  // ==================== HELPERS ====================

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
  };

  const formatarData = (data?: string) => {
    if (!data) return '-';
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'alerta': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'critico': return <AlertCircle className="h-5 w-5 text-red-500" />;
      default: return null;
    }
  };

  // Filtrar funcionários
  const funcionariosFiltrados = funcionariosCadastrados.filter(func => {
    const matchSearch = func.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchAtivo = filtroAtivo === 'todos' || 
                      (filtroAtivo === 'ativos' && func.ativo) ||
                      (filtroAtivo === 'inativos' && !func.ativo);
    return matchSearch && matchAtivo;
  });

  // Estatísticas
  const funcStats = {
    total: funcionariosCadastrados.length,
    ativos: funcionariosCadastrados.filter(f => f.ativo).length,
    clt: funcionariosCadastrados.filter(f => f.ativo && f.tipo_contratacao === 'CLT').length,
    pj: funcionariosCadastrados.filter(f => f.ativo && f.tipo_contratacao === 'PJ').length,
    folhaTotal: funcionariosCadastrados.filter(f => f.ativo).reduce((acc, f) => acc + f.salario_base, 0)
  };

  const totaisSimulacao = calcularTotaisGerais();

  // ==================== RENDER ====================

  if (!selectedBar) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="p-8">
          <CardContent>
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-center text-muted-foreground">Selecione um bar para gerenciar o CMO</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCcw className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        
        {/* Header com seleção de mês/ano */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Users className="h-6 w-6" />
                  Gestão de CMO
                </h1>
                <p className="text-muted-foreground">Custo de Mão de Obra - {selectedBar.nome}</p>
              </div>
              <div className="flex gap-2">
                <Select value={mesAtual.toString()} onValueChange={(v) => setMesAtual(parseInt(v))}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map(m => (
                      <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={anoAtual.toString()} onValueChange={(v) => setAnoAtual(parseInt(v))}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2022, 2023, 2024, 2025, 2026].map(a => (
                      <SelectItem key={a} value={a.toString()}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Abas principais */}
        <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="dashboard">
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="funcionarios">
              <Users className="h-4 w-4 mr-2" />
              Funcionários
            </TabsTrigger>
            <TabsTrigger value="simulacao">
              <Calculator className="h-4 w-4 mr-2" />
              Simulação
            </TabsTrigger>
            <TabsTrigger value="provisoes">
              <Calendar className="h-4 w-4 mr-2" />
              Provisões
            </TabsTrigger>
            <TabsTrigger value="importar">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Importar
            </TabsTrigger>
          </TabsList>

          {/* ==================== ABA DASHBOARD ==================== */}
          <TabsContent value="dashboard">
            {/* Cards de resumo */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Funcionários Ativos</p>
                      <p className="text-3xl font-bold">{funcStats.ativos}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="default">{funcStats.clt} CLT</Badge>
                        <Badge variant="secondary">{funcStats.pj} PJ</Badge>
                      </div>
                    </div>
                    <Users className="h-10 w-10 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Folha Base</p>
                      <p className="text-2xl font-bold">{formatarMoeda(funcStats.folhaTotal)}</p>
                    </div>
                    <DollarSign className="h-10 w-10 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Provisões</p>
                      <p className="text-2xl font-bold">{formatarMoeda(provTotais.total_provisao_certa)}</p>
                    </div>
                    <TrendingUp className="h-10 w-10 text-orange-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className={comparativo?.status === 'critico' ? 'border-red-500' : comparativo?.status === 'alerta' ? 'border-yellow-500' : ''}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Simulado vs NIBO</p>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(comparativo?.status || 'ok')}
                        <p className="text-2xl font-bold">{comparativo?.percentual_diferenca?.toFixed(0) || 0}%</p>
                      </div>
                    </div>
                    <PieChart className={`h-10 w-10 ${
                      comparativo?.status === 'ok' ? 'text-green-500' :
                      comparativo?.status === 'alerta' ? 'text-yellow-500' : 'text-red-500'
                    }`} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Comparativo por categoria */}
            <Card>
              <CardHeader>
                <CardTitle>Comparativo por Categoria - {MESES[mesAtual - 1]?.label}/{anoAtual}</CardTitle>
                <CardDescription>CMO Simulado vs Realizado no NIBO</CardDescription>
              </CardHeader>
              <CardContent>
                {!comparativo?.detalhes?.length ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p>Nenhum dado disponível. Calcule a folha de pagamento primeiro.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {comparativo.detalhes.map((item, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">{item.categoria}</span>
                          <Badge variant={Math.abs(item.percentual_diferenca) > 20 ? 'destructive' : Math.abs(item.percentual_diferenca) > 10 ? 'secondary' : 'outline'}>
                            {item.percentual_diferenca > 0 ? '+' : ''}{item.percentual_diferenca.toFixed(0)}%
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">NIBO (Real)</p>
                            <p className="font-medium">{formatarMoeda(item.valor_nibo)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Simulado</p>
                            <p className="font-medium">{formatarMoeda(item.valor_simulado)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Diferença</p>
                            <p className={`font-medium flex items-center gap-1 ${item.diferenca > 0 ? 'text-red-500' : 'text-green-500'}`}>
                              {item.diferenca > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                              {formatarMoeda(Math.abs(item.diferenca))}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== ABA FUNCIONÁRIOS ==================== */}
          <TabsContent value="funcionarios">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">{funcStats.total}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold">{funcStats.ativos}</p>
                      <p className="text-xs text-muted-foreground">Ativos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-2xl font-bold">{funcStats.clt}</p>
                      <p className="text-xs text-muted-foreground">CLT</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="text-2xl font-bold">{funcStats.pj}</p>
                      <p className="text-xs text-muted-foreground">PJ</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-lg font-bold">{formatarMoeda(funcStats.folhaTotal)}</p>
                      <p className="text-xs text-muted-foreground">Folha Base</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Lista */}
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <CardTitle>Lista de Funcionários</CardTitle>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 w-[200px]"
                      />
                    </div>
                    <Select value={filtroAtivo} onValueChange={setFiltroAtivo}>
                      <SelectTrigger className="w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="ativos">Ativos</SelectItem>
                        <SelectItem value="inativos">Inativos</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={abrirNovoFuncionario}>
                      <Plus className="h-4 w-4 mr-2" /> Novo
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {funcionariosFiltrados.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2" />
                      <p>Nenhum funcionário encontrado</p>
                    </div>
                  ) : (
                    funcionariosFiltrados.map(func => (
                      <div key={func.id} className="border rounded-lg p-4 flex justify-between items-center hover:bg-muted/50">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {func.nome}
                              {!func.ativo && <Badge variant="destructive" className="text-xs">Inativo</Badge>}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                              {func.cargo?.nome || '-'} • {func.area?.nome || '-'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <Badge variant={func.tipo_contratacao === 'CLT' ? 'default' : 'secondary'}>
                              {func.tipo_contratacao}
                            </Badge>
                            <p className="font-medium mt-1">{formatarMoeda(func.salario_base)}</p>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => abrirEdicaoFuncionario(func)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== ABA SIMULAÇÃO ==================== */}
          <TabsContent value="simulacao">
            {/* Ações */}
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-2">
                  <Button onClick={importarFuncionariosCadastrados} variant="outline">
                    <UserPlus className="h-4 w-4 mr-2" /> Importar do Cadastro
                  </Button>
                  <Button onClick={adicionarFuncionarioSimulacao} variant="outline">
                    <Plus className="h-4 w-4 mr-2" /> Adicionar Manual
                  </Button>
                  <Button onClick={salvarSimulacao} disabled={salvandoSimulacao}>
                    {salvandoSimulacao ? <RefreshCcw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvar Simulação
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Totais */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Total Folha</p>
                  <p className="text-2xl font-bold">{formatarMoeda(totaisSimulacao.totalFolha)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Total Encargos</p>
                  <p className="text-2xl font-bold">{formatarMoeda(totaisSimulacao.totalEncargos)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Custo Total</p>
                  <p className="text-2xl font-bold text-primary">{formatarMoeda(totaisSimulacao.totalGeral)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Lista de funcionários da simulação */}
            <Card>
              <CardHeader>
                <CardTitle>Funcionários na Simulação ({funcionariosSimulacao.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {funcionariosSimulacao.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calculator className="h-8 w-8 mx-auto mb-2" />
                    <p>Nenhum funcionário na simulação</p>
                    <p className="text-sm">Importe do cadastro ou adicione manualmente</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {funcionariosSimulacao.map((func, index) => {
                      const valores = calcularValoresFuncionario(func);
                      return (
                        <Card key={func.id} className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                            <div className="md:col-span-2">
                              <Input
                                placeholder="Nome"
                                value={func.nome}
                                onChange={(e) => {
                                  const updated = [...funcionariosSimulacao];
                                  updated[index].nome = e.target.value;
                                  setFuncionariosSimulacao(updated);
                                }}
                              />
                            </div>
                            <Select
                              value={func.tipo_contratacao}
                              onValueChange={(v) => {
                                const updated = [...funcionariosSimulacao];
                                updated[index].tipo_contratacao = v as 'CLT' | 'PJ';
                                setFuncionariosSimulacao(updated);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="CLT">CLT</SelectItem>
                                <SelectItem value="PJ">PJ</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select
                              value={func.area}
                              onValueChange={(v) => {
                                const updated = [...funcionariosSimulacao];
                                updated[index].area = v;
                                setFuncionariosSimulacao(updated);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {AREAS_SIMULACAO.map(a => (
                                  <SelectItem key={a} value={a}>{a}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              placeholder="Salário"
                              value={func.salario_bruto || ''}
                              onChange={(e) => {
                                const updated = [...funcionariosSimulacao];
                                updated[index].salario_bruto = parseFloat(e.target.value) || 0;
                                setFuncionariosSimulacao(updated);
                              }}
                            />
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-primary">{formatarMoeda(valores.custoEmpresa)}</span>
                              <Button variant="ghost" size="icon" onClick={() => {
                                setFuncionariosSimulacao(funcionariosSimulacao.filter(f => f.id !== func.id));
                              }}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {/* Observações */}
                <div className="mt-6">
                  <Label>Observações</Label>
                  <Textarea
                    value={observacoesSimulacao}
                    onChange={(e) => setObservacoesSimulacao(e.target.value)}
                    placeholder="Anotações sobre esta simulação..."
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== ABA PROVISÕES ==================== */}
          <TabsContent value="provisoes">
            {/* Cards de resumo */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Gift className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-lg font-bold">{formatarMoeda(provTotais.total_decimo_terceiro)}</p>
                      <p className="text-xs text-muted-foreground">13º Salário</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-lg font-bold">{formatarMoeda(provTotais.total_ferias)}</p>
                      <p className="text-xs text-muted-foreground">Férias</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="text-lg font-bold">{formatarMoeda(provTotais.total_fgts)}</p>
                      <p className="text-xs text-muted-foreground">FGTS</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-lg font-bold">{formatarMoeda(provTotais.total_provisao_certa)}</p>
                      <p className="text-xs text-muted-foreground">Provisão Certa</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="text-lg font-bold">{formatarMoeda(provTotais.total_provisao_eventual)}</p>
                      <p className="text-xs text-muted-foreground">Eventual</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Lista de provisões */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Provisões de {MESES[mesAtual - 1]?.label}/{anoAtual}</CardTitle>
                  <Button onClick={calcularProvisoes} disabled={calculandoProvisoes}>
                    {calculandoProvisoes ? <RefreshCcw className="h-4 w-4 mr-2 animate-spin" /> : <Calculator className="h-4 w-4 mr-2" />}
                    Calcular
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {provisoes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-8 w-8 mx-auto mb-2" />
                    <p>Nenhuma provisão calculada</p>
                    <p className="text-sm">Clique em &quot;Calcular&quot; para gerar as provisões do mês</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {provisoes.map(prov => (
                      <div key={prov.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <div className="font-medium">{prov.funcionario?.nome || prov.funcionario_nome}</div>
                          <Badge variant={prov.percentual_salario > 30 ? 'destructive' : 'secondary'}>
                            {prov.percentual_salario.toFixed(0)}%
                          </Badge>
                        </div>
                        <div className="grid grid-cols-4 gap-4 mt-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">13º</p>
                            <p className="font-medium text-green-600">{formatarMoeda(prov.decimo_terceiro)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Férias</p>
                            <p className="font-medium text-blue-600">{formatarMoeda(prov.ferias)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">FGTS</p>
                            <p className="font-medium text-orange-600">{formatarMoeda(prov.fgts_provisao)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total</p>
                            <p className="font-bold text-primary">{formatarMoeda(prov.provisao_certa)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== ABA IMPORTAR ==================== */}
          <TabsContent value="importar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Importar Funcionários
                  </CardTitle>
                  <CardDescription>Importe funcionários da planilha Google Sheets</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Os funcionários serão importados das abas &quot;CMO Semana&quot; ou &quot;Simulação CMO Mês&quot;.
                    Funcionários já existentes (mesmo nome) serão ignorados.
                  </p>
                  <Button onClick={() => importarDaPlanilha('funcionarios')} disabled={importando} className="w-full">
                    {importando ? <RefreshCcw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                    Importar Funcionários
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Importar Provisões
                  </CardTitle>
                  <CardDescription>Importe o histórico de provisões desde 2022</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Serão importadas as 553 linhas de provisões históricas da aba &quot;PROVISÕES&quot;.
                    Cada registro inclui 13º, férias, FGTS e rescisão.
                  </p>
                  <Button onClick={() => importarDaPlanilha('provisoes')} disabled={importando} variant="secondary" className="w-full">
                    {importando ? <RefreshCcw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                    Importar Provisões
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ==================== DIALOG FUNCIONÁRIO ==================== */}
      <Dialog open={isDialogFuncOpen} onOpenChange={setIsDialogFuncOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingFuncionario ? 'Editar Funcionário' : 'Novo Funcionário'}</DialogTitle>
            <DialogDescription>Preencha os dados do funcionário</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="dados">Dados Pessoais</TabsTrigger>
              <TabsTrigger value="contrato">Contrato</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="nome">Nome Completo *</Label>
                  <Input id="nome" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="cpf">CPF</Label>
                  <Input id="cpf" value={formData.cpf} onChange={(e) => setFormData({ ...formData, cpf: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input id="telefone" value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="contrato" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data de Admissão</Label>
                  <Input type="date" value={formData.data_admissao} onChange={(e) => setFormData({ ...formData, data_admissao: e.target.value })} />
                </div>
                <div>
                  <Label>Tipo de Contratação</Label>
                  <Select value={formData.tipo_contratacao} onValueChange={(v) => setFormData({ ...formData, tipo_contratacao: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_CONTRATACAO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Área</Label>
                  <Select value={formData.area_id} onValueChange={(v) => setFormData({ ...formData, area_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {areas.map(a => <SelectItem key={a.id} value={a.id.toString()}>{a.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cargo</Label>
                  <Select value={formData.cargo_id} onValueChange={(v) => setFormData({ ...formData, cargo_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {cargos.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Salário Base</Label>
                  <Input type="number" step="0.01" value={formData.salario_base} onChange={(e) => setFormData({ ...formData, salario_base: e.target.value })} />
                </div>
                <div>
                  <Label>Vale Transporte (Diária)</Label>
                  <Input type="number" step="0.01" value={formData.vale_transporte_diaria} onChange={(e) => setFormData({ ...formData, vale_transporte_diaria: e.target.value })} />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogFuncOpen(false)}>Cancelar</Button>
            <Button onClick={salvarFuncionario}>{editingFuncionario ? 'Salvar Alterações' : 'Cadastrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
