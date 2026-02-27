"use client";
import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Calendar,
  Download,
  Filter,
  AlertTriangle,
  Clock,
  User,
  DollarSign,
  TrendingDown,
  FileText,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Info
} from "lucide-react";
import { LoadingState } from '@/components/ui/loading-state';
import { toast } from 'sonner';
import { useBar } from '@/contexts/BarContext';

interface LancamentoRetroativo {
  id: string;
  tipo: string;
  status: string;
  valor: number;
  valorPago: number;
  dataCompetencia: string | null;
  dataVencimento: string | null;
  dataCriacao: string | null;
  dataAtualizacao: string | null;
  criadoPor: string | null;
  atualizadoPor: string | null;
  descricao: string;
  referencia: string;
  categoriaId: string | null;
  categoriaNome: string | null;
  categoriaTipo: string | null;
  stakeholderId: string | null;
  stakeholderNome: string | null;
  stakeholderTipo: string | null;
  centrosCusto: any[];
  isPaid: boolean;
  isDued: boolean;
  isFlagged: boolean;
  hasInstallment: boolean;
  hasRecurrence: boolean;
}

interface Estatisticas {
  total: number;
  totalPagos: number;
  totalPendentes: number;
  valorTotal: number;
  valorPago: number;
  valorPendente: number;
  porUsuario: Record<string, { count: number; valor: number }>;
  porCategoria: Record<string, { count: number; valor: number }>;
}

interface ConsultaResult {
  success: boolean;
  filtros: {
    criadoApos: string;
    criadoAntes: string | null;
    competenciaAntes: string;
    competenciaApos: string | null;
    barId: number;
    mesesRetroativos: number;
    limiteAutoAplicado: boolean;
  };
  estatisticas: Estatisticas;
  data: LancamentoRetroativo[];
  total: number;
  paginasConsultadas: number;
  registrosApiOriginal: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  }).format(value);
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('pt-BR');
};

const formatDateTime = (dateString: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('pt-BR');
};

export default function ConsultasPage() {
  const { selectedBar, isLoading: barLoading } = useBar();
  
  // Estados dos filtros
  const [criadoApos, setCriadoApos] = useState('');
  const [criadoAntes, setCriadoAntes] = useState('');
  const [competenciaAntes, setCompetenciaAntes] = useState('');
  const [competenciaApos, setCompetenciaApos] = useState('');
  const [mesesRetroativos, setMesesRetroativos] = useState('3'); // Limite de meses para buscar (3 = mais rápido)
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<string[]>([]); // Filtro de categorias (múltiplas)
  
  // Categorias CMV (preset útil)
  const CATEGORIAS_CMV = [
    'Custo Bebidas',
    'CUSTO BEBIDAS',
    'Custo Comida',
    'CUSTO COMIDA',
    'CUSTO COMIDAS',
    'Custo Drinks',
    'CUSTO DRINKS',
    'Custo Outros',
    'CUSTO OUTROS'
  ];
  
  // Todas as categorias disponíveis (organizadas)
  const CATEGORIAS_DISPONIVEIS = [
    { group: 'CMV - Custos', items: ['Custo Bebidas', 'CUSTO BEBIDAS', 'Custo Comida', 'CUSTO COMIDA', 'CUSTO COMIDAS', 'Custo Drinks', 'CUSTO DRINKS', 'Custo Outros', 'CUSTO OUTROS'] },
    { group: 'Pessoal', items: ['FREELA ATENDIMENTO', 'FREELA BAR', 'FREELA COZINHA', 'FREELA LIMPEZA', 'FREELA SEGURANÇA', 'SALARIO FUNCIONARIOS', 'SALÁRIO FUNCIONÁRIOS', 'PRO LABORE', 'COMISSÃO 10%', 'VALE TRANSPORTE', 'PROVISÃO TRABALHISTA'] },
    { group: 'Operação', items: ['Materiais de Limpeza e Descartáveis', 'Materiais Operação', 'Utensílios', 'UTENSILIOS', 'Outros Operação', 'OUTROS OPERAÇÃO', 'MANUTENÇÃO', 'Manutenção'] },
    { group: 'Infraestrutura', items: ['ÁGUA', 'LUZ', 'GÁS', 'INTERNET', 'ALUGUEL/CONDOMÍNIO/IPTU'] },
    { group: 'Atrações/Eventos', items: ['Atrações Programação', 'Atrações/Eventos', 'Produção Eventos'] },
    { group: 'Administrativo', items: ['Administrativo Deboche', 'Administrativo Ordinário', 'Escritório Central', 'Marketing', 'IMPOSTO'] },
    { group: 'Investimentos', items: ['[Investimento] Equipamentos', '[Investimento] Obras', '[Investimento] Outros Investimentos'] },
  ];
  
  // Estados de resultado
  const [resultado, setResultado] = useState<ConsultaResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estados de UI
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showUsuarios, setShowUsuarios] = useState(true);
  const [showCategorias, setShowCategorias] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleBuscar = useCallback(async () => {
    if (!criadoApos || !competenciaAntes) {
      toast.error('Preencha os campos obrigatórios: "Criado após" e "Competência antes de"');
      return;
    }

    if (barLoading || !selectedBar?.id) {
      toast.error('Aguarde o carregamento do bar ou selecione um bar');
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setLoading(true);
    setError(null);
    setResultado(null);

    try {
      const params = new URLSearchParams({
        bar_id: selectedBar.id.toString(),
        criado_apos: criadoApos,
        competencia_antes: competenciaAntes,
        meses_retroativos: mesesRetroativos
      });

      if (criadoAntes) {
        params.set('criado_antes', criadoAntes);
      }
      if (competenciaApos) {
        params.set('competencia_apos', competenciaApos);
      }
      if (categoriasSelecionadas.length > 0) {
        params.set('categorias', categoriasSelecionadas.join(','));
      }

      const response = await fetch(
        `/api/financeiro/nibo/consultas/lancamentos-retroativos?${params}`,
        { signal }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao buscar dados');
      }

      if (!Array.isArray(data.data)) {
        throw new Error('Resposta inválida: dados não são uma lista');
      }
      if (data.data.length !== data.total) {
        console.warn('[Consultas] Inconsistência API: data.length=%d, total=%d', data.data.length, data.total);
      }

      setResultado(data);
      toast.success(`Encontrados ${data.total} lançamentos retroativos`);

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [criadoApos, criadoAntes, competenciaAntes, competenciaApos, mesesRetroativos, categoriasSelecionadas, selectedBar?.id, barLoading]);

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleExportCSV = () => {
    if (!resultado || resultado.data.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    const headers = [
      'ID',
      'Tipo',
      'Status',
      'Valor',
      'Valor Pago',
      'Data Competência',
      'Data Vencimento',
      'Data Criação',
      'Criado Por',
      'Descrição',
      'Categoria',
      'Stakeholder'
    ];

    const rows = resultado.data.map(item => [
      item.id,
      item.tipo,
      item.status,
      item.valor.toFixed(2),
      item.valorPago.toFixed(2),
      item.dataCompetencia || '',
      item.dataVencimento || '',
      item.dataCriacao || '',
      item.criadoPor || '',
      item.descricao,
      item.categoriaNome || '',
      item.stakeholderNome || ''
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lancamentos-retroativos-${criadoApos}-a-${competenciaAntes}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success('CSV exportado com sucesso!');
  };

  // Exemplo padrão para facilitar o uso
  const handleExemploFiltro = () => {
    setCriadoApos('2026-01-15');
    setCompetenciaAntes('2026-01-01');
    setCriadoAntes('');
    setCompetenciaApos('');
    toast.info('Filtro de exemplo aplicado: lançamentos criados após 15/01/2026 com competência antes de 01/01/2026');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <Search className="w-6 h-6 text-blue-600" />
            Consultas NIBO
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Consulte lançamentos retroativos e analise padrões de registro
          </p>
        </div>

        {/* Card de Filtros */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-lg mb-6">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
                  <Filter className="w-5 h-5 text-blue-600" />
                  Lançamentos Retroativos
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400 mt-1">
                  Encontre lançamentos criados após uma data mas com competência anterior
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExemploFiltro}
                className="text-blue-600 border-blue-300 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-700 dark:hover:bg-blue-900/20"
              >
                <Info className="w-4 h-4 mr-2" />
                Exemplo
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Explicação do filtro */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium mb-1">Como funciona:</p>
                  <p>Esta consulta busca lançamentos que foram <strong>criados</strong> após uma data específica, 
                  mas que têm <strong>data de competência</strong> anterior. Útil para identificar lançamentos 
                  retroativos que podem impactar relatórios de períodos já fechados.</p>
                </div>
              </div>
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Data de Criação */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-500" />
                  Data de Criação (quando foi registrado)
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Criado após *
                    </label>
                    <input
                      type="date"
                      value={criadoApos}
                      onChange={(e) => setCriadoApos(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Criado antes (opcional)
                    </label>
                    <input
                      type="date"
                      value={criadoAntes}
                      onChange={(e) => setCriadoAntes(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Data de Competência */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-green-500" />
                  Data de Competência (período do lançamento)
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Competência após (opcional)
                    </label>
                    <input
                      type="date"
                      value={competenciaApos}
                      onChange={(e) => setCompetenciaApos(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Competência antes de *
                    </label>
                    <input
                      type="date"
                      value={competenciaAntes}
                      onChange={(e) => setCompetenciaAntes(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Filtro de Categoria (múltiplas) */}
            <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Filter className="w-4 h-4 text-orange-500" />
                Filtrar por Categoria (múltiplas)
              </h4>
              <div className="flex flex-col gap-2">
                <select
                  multiple
                  value={categoriasSelecionadas}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, opt => opt.value);
                    setCategoriasSelecionadas(selected);
                  }}
                  className="w-full min-h-[100px] px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CATEGORIAS_DISPONIVEIS.map((grupo) => (
                    <optgroup key={grupo.group} label={grupo.group}>
                      {grupo.items.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Segure Ctrl (Windows) ou Cmd (Mac) para selecionar várias categorias
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCategoriasSelecionadas(CATEGORIAS_CMV)}
                    className="text-xs"
                  >
                    📦 Apenas CMV
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCategoriasSelecionadas([])}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Limpar
                  </Button>
                </div>
                {categoriasSelecionadas.length > 0 && (
                  <p className="text-xs text-orange-600 dark:text-orange-400">
                    Filtrando por: {categoriasSelecionadas.join(', ')}
                  </p>
                )}
              </div>
            </div>

            {/* Limite de meses - para otimização */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Limite de meses retroativos
                </label>
                <select
                  value={mesesRetroativos}
                  onChange={(e) => setMesesRetroativos(e.target.value)}
                  disabled={!!competenciaApos}
                  className="w-full sm:w-48 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="0.25">⚡ Última semana</option>
                  <option value="0.5">⚡ Últimas 2 semanas</option>
                  <option value="1">🚀 Último mês</option>
                  <option value="2">Últimos 2 meses</option>
                  <option value="3">Últimos 3 meses</option>
                  <option value="6">Últimos 6 meses</option>
                  <option value="12">Últimos 12 meses</option>
                  <option value="24">Últimos 24 meses</option>
                </select>
                {competenciaApos ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Desabilitado quando "Competência após" é preenchido
                  </p>
                ) : (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Busca automática limitada a {parseFloat(mesesRetroativos) < 1 
                      ? `${Math.round(parseFloat(mesesRetroativos) * 4)} semana(s)` 
                      : `${mesesRetroativos} mês(es)`} antes da data de competência
                  </p>
                )}
              </div>
            </div>

            {/* Botão de busca */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                onClick={handleBuscar}
                disabled={loading || !criadoApos || !competenciaAntes}
                className="bg-blue-600 hover:bg-blue-700 text-white flex-1 sm:flex-none"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Buscar Lançamentos
                  </>
                )}
              </Button>

              {resultado && resultado.data.length > 0 && (
                <Button
                  variant="outline"
                  onClick={handleExportCSV}
                  className="text-green-600 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/20"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exportar CSV
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Erro */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <XCircle className="w-5 h-5" />
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Resultados */}
        {resultado && (
          <div className="space-y-6">
            {/* Info sobre o limite aplicado */}
            {resultado.filtros.limiteAutoAplicado && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-medium">Otimização aplicada</p>
                    <p>A busca foi limitada a <strong>{
                      resultado.filtros.mesesRetroativos < 1 
                        ? `${Math.round(resultado.filtros.mesesRetroativos * 4)} semana(s)` 
                        : `${resultado.filtros.mesesRetroativos} mês(es)`
                    }</strong> (a partir de {formatDate(resultado.filtros.competenciaApos)}) para maior velocidade. 
                    Consultadas <strong>{resultado.paginasConsultadas}</strong> páginas ({resultado.registrosApiOriginal} registros da API). 
                    Se precisar buscar mais histórico, aumente o limite ou preencha o campo "Competência após".</p>
                  </div>
                </div>
              </div>
            )}

            {/* Cards de Estatísticas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-xs font-medium">Total Encontrado</p>
                      <p className="text-2xl font-bold">{resultado.estatisticas.total}</p>
                    </div>
                    <FileText className="w-8 h-8 text-blue-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-100 text-xs font-medium">Valor Total</p>
                      <p className="text-lg font-bold">{formatCurrency(resultado.estatisticas.valorTotal)}</p>
                    </div>
                    <DollarSign className="w-8 h-8 text-red-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100 text-xs font-medium">Pagos</p>
                      <p className="text-2xl font-bold">{resultado.estatisticas.totalPagos}</p>
                    </div>
                    <CheckCircle2 className="w-8 h-8 text-green-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-amber-100 text-xs font-medium">Pendentes</p>
                      <p className="text-2xl font-bold">{resultado.estatisticas.totalPendentes}</p>
                    </div>
                    <Clock className="w-8 h-8 text-amber-200" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Análise por Usuário e Categoria */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Por Usuário */}
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-lg">
                <CardHeader className="pb-2">
                  <button
                    onClick={() => setShowUsuarios(!showUsuarios)}
                    className="w-full flex items-center justify-between"
                  >
                    <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <User className="w-4 h-4 text-purple-500" />
                      Por Usuário
                    </CardTitle>
                    {showUsuarios ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </CardHeader>
                {showUsuarios && (
                  <CardContent className="pt-0">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {Object.entries(resultado.estatisticas.porUsuario)
                        .sort((a, b) => b[1].count - a[1].count)
                        .map(([usuario, stats]) => (
                          <div key={usuario} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <div>
                              <span className="text-sm font-medium text-gray-900 dark:text-white">{usuario}</span>
                              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({stats.count} lançamentos)</span>
                            </div>
                            <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                              {formatCurrency(stats.valor)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Por Categoria */}
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-lg">
                <CardHeader className="pb-2">
                  <button
                    onClick={() => setShowCategorias(!showCategorias)}
                    className="w-full flex items-center justify-between"
                  >
                    <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-orange-500" />
                      Por Categoria
                    </CardTitle>
                    {showCategorias ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </CardHeader>
                {showCategorias && (
                  <CardContent className="pt-0">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {Object.entries(resultado.estatisticas.porCategoria)
                        .sort((a, b) => b[1].valor - a[1].valor)
                        .map(([categoria, stats]) => (
                          <div key={categoria} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <div>
                              <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{categoria}</span>
                              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({stats.count})</span>
                            </div>
                            <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                              {formatCurrency(stats.valor)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>

            {/* Lista de Lançamentos */}
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Lançamentos Retroativos ({resultado.total})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {resultado.data.length === 0 ? (
                  <div className="text-center py-8">
                    <Search className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-400 font-medium">
                      Nenhum lançamento retroativo encontrado
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                      Tente ajustar os filtros de data
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {resultado.data
                      .slice(0, resultado.total)
                      .map((lancamento) => {
                      const isExpanded = expandedItems.has(lancamento.id);
                      
                      return (
                        <div
                          key={lancamento.id}
                          className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                        >
                          {/* Header do item */}
                          <button
                            onClick={() => toggleExpand(lancamento.id)}
                            className="w-full p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className={`p-2 rounded-lg flex-shrink-0 ${
                                  lancamento.isPaid 
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                                }`}>
                                  {lancamento.isPaid ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                  ) : (
                                    <Clock className="w-4 h-4" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                    {lancamento.descricao || lancamento.stakeholderNome || 'Sem descrição'}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      Comp: {formatDate(lancamento.dataCompetencia)}
                                    </span>
                                    <span className="hidden sm:inline">•</span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      Criado: {formatDate(lancamento.dataCriacao)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="text-base font-bold text-red-600 dark:text-red-400">
                                    {formatCurrency(lancamento.valor)}
                                  </p>
                                  <Badge variant={lancamento.isPaid ? "default" : "secondary"} className="text-xs">
                                    {lancamento.status}
                                  </Badge>
                                </div>
                                {isExpanded ? (
                                  <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                )}
                              </div>
                            </div>
                          </button>

                          {/* Detalhes expandidos */}
                          {isExpanded && (
                            <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                <div>
                                  <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">ID</p>
                                  <p className="text-gray-900 dark:text-white font-mono text-xs truncate">{lancamento.id}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Tipo</p>
                                  <p className="text-gray-900 dark:text-white">{lancamento.tipo}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Categoria</p>
                                  <p className="text-gray-900 dark:text-white">{lancamento.categoriaNome || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Stakeholder</p>
                                  <p className="text-gray-900 dark:text-white">{lancamento.stakeholderNome || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Criado por</p>
                                  <p className="text-gray-900 dark:text-white font-medium">{lancamento.criadoPor || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Data/Hora Criação</p>
                                  <p className="text-gray-900 dark:text-white">{formatDateTime(lancamento.dataCriacao)}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Data Vencimento</p>
                                  <p className="text-gray-900 dark:text-white">{formatDate(lancamento.dataVencimento)}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Atualizado por</p>
                                  <p className="text-gray-900 dark:text-white">{lancamento.atualizadoPor || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Última Atualização</p>
                                  <p className="text-gray-900 dark:text-white">{formatDateTime(lancamento.dataAtualizacao)}</p>
                                </div>
                                {lancamento.referencia && (
                                  <div className="sm:col-span-2 lg:col-span-3">
                                    <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Referência</p>
                                    <p className="text-gray-900 dark:text-white">{lancamento.referencia}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
